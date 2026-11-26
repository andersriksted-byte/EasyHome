// Trafik: Vejdirektoratets trafikmeldinger (uheld, kø, spærringer, vejarbejde) via workerens /trafik.
// Meldingerne sorteres efter afstand fra jeres hjem og filtreres efter den valgte radius.
import { workerFetch, hasProxy, settings } from './util.js';

export const state = { items: null, cache: {}, busy: {}, at: 0, err: '', flow: false, tt: false };

export const KINDS = {
  uheld: { label: 'Uheld', icon: '💥', c: '#E5484D' },
  koe: { label: 'Kø', icon: '🚗', c: '#F59E0B' },
  spaerring: { label: 'Spærring', icon: '⛔', c: '#DC2626' },
  vejr: { label: 'Vejforhold', icon: '❄️', c: '#0EA5E9' },
  haendelse: { label: 'Hændelse', icon: '⚠️', c: '#EAB308' },
  vejarbejde: { label: 'Vejarbejde', icon: '🚧', c: '#F97316' }
};

export const cfg = () => ({ radius: 30, roadworks: true, ...(settings.trafik || {}) });

// Området, der hentes for: en firkant omkring hjemmet (radius) eller omkring turen fra hjem til mål
export function bboxFor(a, b, radiusKm) {
  const pad = (km) => [km / 111, km / (111 * Math.cos((a.lat * Math.PI) / 180))];
  if (b) { const [py, px] = pad(8); return [Math.min(a.lon, b.lon) - px, Math.min(a.lat, b.lat) - py, Math.max(a.lon, b.lon) + px, Math.max(a.lat, b.lat) + py]; }
  if (!radiusKm) return [8.0, 54.5, 15.2, 57.8];
  const [py, px] = pad(radiusKm); return [a.lon - px, a.lat - py, a.lon + px, a.lat + py];
}
export async function load(bbox, force = false) {
  if (!hasProxy()) { state.err = 'NO_PROXY'; return false; }
  const key = bbox ? bbox.map((v) => v.toFixed(2)).join(',') : '';
  const c0 = state.cache[key];
  if (state.busy[key] || (!force && c0 && Date.now() - c0.at < 2 * 60000) || (c0 && Date.now() - c0.at < 20000)) return false;
  state.busy[key] = true;
  try {
    const j = await (await workerFetch('/trafik' + (key ? '?bbox=' + key : ''))).json();
    if (j.error) throw new Error(j.error);
    const all = (j.items || []).map((x) => ({ ...x, from: x.from ? new Date(x.from) : null, to: x.to ? new Date(x.to) : null, seen: x.seen ? new Date(x.seen) : null }));
    state.cache[key] = { at: Date.now(), items: all, tt: !!j.tt };
    // Alle områder, der er hentet for nylig (fx omkring hjem og på vej til næste aftale), lægges sammen – near()/along() vælger selv ud
    const ids = new Set(); const union = [];
    Object.values(state.cache).filter((c) => Date.now() - c.at < 10 * 60000).forEach((c) => c.items.forEach((x) => { if (!ids.has(x.id)) { ids.add(x.id); union.push(x); } }));
    state.items = merge(union, !!j.tt);
    state.at = Date.now(); state.err = ''; state.flow = !!j.flow; state.tt = !!j.tt;
    return true;
  } catch (e) { state.err = e.message || 'Fejl'; state.cache[key] = { at: Date.now() - 90000, items: [], tt: false }; return true; } finally { state.busy[key] = false; }
}
// TomTom (aktuelle, med forsinkelse) og Vejdirektoratet (officielle tekster) slås sammen.
// Er TomTom med, skjules Vejdirektoratets uheld/kø, der er mere end 3 timer gamle og som TomTom ikke længere ser – de er sandsynligvis ryddet.
function merge(all, haveTT) {
  const tt = all.filter((x) => x.src === 'tt'); const vd = all.filter((x) => x.src !== 'tt');
  const near = (a, b, k) => km(a, b) < k;
  const acute = (x) => ['uheld', 'koe', 'haendelse'].includes(x.kind);
  const keepVd = vd.filter((x) => {
    if (!haveTT || !acute(x)) return true;
    const old = x.from && Date.now() - x.from.getTime() > 3 * 3600000;
    return !old || tt.some((t) => acute(t) && near(t, x, 3));
  });
  // En TomTom-melding, der dækker det samme som en fra Vejdirektoratet, giver forsinkelsen videre og vises ikke dobbelt
  const keepTt = tt.filter((t) => { const v = keepVd.find((x) => x.kind === t.kind && near(t, x, 1.5)); if (v) { v.delay = t.delay; v.seen = t.seen; return false; } return true; });
  return keepVd.concat(keepTt);
}

const rad = (d) => (d * Math.PI) / 180;
export function km(a, b) {
  const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Meldinger tæt på (radius 0 = hele landet). Akutte hændelser først, derefter vejarbejde; inden for hver gruppe efter afstand
export function near(place, opts = {}) {
  if (!state.items || !place) return [];
  const c = { ...cfg(), ...opts };
  const now = Date.now();
  return state.items
    .filter((x) => !x.future && (!x.from || x.from.getTime() <= now + 3600000) && (!x.to || x.to.getTime() > now))
    .filter((x) => c.roadworks || x.kind !== 'vejarbejde')
    .map((x) => ({ ...x, km: km(place, x) }))
    .filter((x) => !c.radius || x.km <= c.radius)
    .sort((a, b) => (a.kind === 'vejarbejde') - (b.kind === 'vejarbejde') || a.km - b.km);
}

// Afstand (km) fra et punkt til den lige linje mellem a og b – bruges til "meldinger på vejen"
function segKm(p, a, b) {
  const k = 111.32; const cx = Math.cos(rad((a.lat + b.lat) / 2));
  const P = [(p.lon - a.lon) * k * cx, (p.lat - a.lat) * k]; const B = [(b.lon - a.lon) * k * cx, (b.lat - a.lat) * k];
  const L = B[0] ** 2 + B[1] ** 2; const t = L ? Math.max(0, Math.min(1, (P[0] * B[0] + P[1] * B[1]) / L)) : 0;
  return Math.hypot(P[0] - t * B[0], P[1] - t * B[1]);
}
// Meldinger langs turen fra a til b (inden for en korridor, der bliver bredere på lange ture, fordi vejen sjældent er lige)
export function along(a, b) {
  if (!state.items || !a || !b) return [];
  const len = km(a, b); const width = Math.max(3, Math.min(15, len * 0.08));
  const now = Date.now(); const c = cfg();
  return state.items
    .filter((x) => !x.future && (!x.from || x.from.getTime() <= now + 3600000) && (!x.to || x.to.getTime() > now))
    .filter((x) => c.roadworks || x.kind !== 'vejarbejde')
    .map((x) => ({ ...x, km: km(a, x), off: segKm(x, a, b) }))
    .filter((x) => x.off <= width)
    .sort((p, q) => (p.kind === 'vejarbejde') - (q.kind === 'vejarbejde') || p.km - q.km);
}
