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
// Meldinger langs turen. Med en rigtig rute (punkter langs vejen) tæller kun meldinger, der ligger på selve vejen (inden for ~300 m),
// og TomTom's trafik på ruten (kø, uheld, vejarbejde med forsinkelse) kommer med. Uden rute: en korridor om den lige linje.
export function along(a, b, rt) {
  if (!a || !b) return [];
  const now = Date.now(); const c = cfg();
  const live = (state.items || []).filter((x) => !x.future && (!x.from || x.from.getTime() <= now + 3600000) && (!x.to || x.to.getTime() > now)).filter((x) => c.roadworks || x.kind !== 'vejarbejde');
  const pts = rt && rt.points && rt.points.length > 1 ? rt.points.map((p) => ({ lat: p[0], lon: p[1] })) : null;
  let out;
  if (pts) {
    const offRoute = (x) => { let m = Infinity; for (let i = 1; i < pts.length; i++) { const d = segKm(x, pts[i - 1], pts[i]); if (d < m) m = d; if (m < 0.05) break; } return m; };
    // Hurtig forfiltrering: kun meldinger inden for rutens omkreds
    const la = pts.map((p) => p.lat); const lo = pts.map((p) => p.lon);
    const bb = [Math.min(...lo) - 0.02, Math.min(...la) - 0.02, Math.max(...lo) + 0.02, Math.max(...la) + 0.02];
    // Vejen ruten kører på ved hvert punkt (fra vejvisningen): et vejskilt gælder fra sit punkt og frem til det næste
    const roadAt = roadIndex(pts, rt.roads || []);
    const nearestIdx = (x) => { let m = Infinity; let k = 0; for (let i = 0; i < pts.length; i++) { const d = Math.abs(pts[i].lat - x.lat) + Math.abs(pts[i].lon - x.lon); if (d < m) { m = d; k = i; } } return k; };
    out = live.filter((x) => x.lon >= bb[0] && x.lon <= bb[2] && x.lat >= bb[1] && x.lat <= bb[3]).map((x) => ({ ...x, off: offRoute(x) })).filter((x) => x.off <= 0.3)
      .filter((x) => {
        const ids = roadAt ? roadAt(nearestIdx(x)) : null;
        if (!ids || !ids.length) return x.off <= 0.12; // ukendt vej: kun hvis meldingen ligger lige på ruten
        const t = norm(x.title + ' ' + (x.text || ''));
        return ids.some((id) => t.includes(id)); // meldingen skal nævne vejen (fx "e45", "rute 15", "djurslandmotorvejen")
      });
    (rt.sections || []).forEach((sec, i) => {
      if (!c.roadworks && sec.kind === 'vejarbejde') return;
      const dup = out.find((x) => x.kind === sec.kind && km(x, sec) < 2);
      if (dup) { if (sec.delayMin && !dup.delay) dup.delay = sec.delayMin; return; }
      const K = KINDS[sec.kind] || KINDS.haendelse;
      out.push({ id: 'rt' + i, src: 'route', kind: sec.kind, title: `${K.label} på ruten`, text: '', lat: sec.lat, lon: sec.lon, delay: sec.delayMin, from: null, to: null, kommune: '', off: 0 });
    });
  } else {
    const len = km(a, b); const width = Math.max(3, Math.min(15, len * 0.08));
    out = live.map((x) => ({ ...x, off: segKm(x, a, b) })).filter((x) => x.off <= width);
  }
  return out.map((x) => ({ ...x, km: km(a, x) })).sort((p, q) => (p.kind === 'vejarbejde') - (q.kind === 'vejarbejde') || p.km - q.km);
}

// Normaliserer tekst og vej-id'er, så "E 45", "E45" og "Rute 15" kan sammenlignes
const norm = (t) => ' ' + String(t || '').toLowerCase().replace(/\b(e|rute|route|primærrute|sekundærrute)\s*(\d+)/g, '$1$2').replace(/[^a-z0-9æøå]+/g, ' ') + ' ';
function roadIndex(pts, roads) {
  if (!roads.length) return null;
  const idx = roads.map((r) => { let m = Infinity; let k = 0; pts.forEach((p, i) => { const d = Math.abs(p.lat - r.lat) + Math.abs(p.lon - r.lon); if (d < m) { m = d; k = i; } }); return { k, ids: ids(r) }; }).sort((a, b) => a.k - b.k);
  return (i) => {
    // Vejen ved punktet og nabostykkerne (et skilt ligger ofte lidt før/efter, og ved til- og frakørsler er begge veje relevante)
    let j = 0; while (j + 1 < idx.length && idx[j + 1].k <= i) j++;
    return [...new Set(idx[j].ids.concat(idx[j + 1] && idx[j + 1].k - i < 3 ? idx[j + 1].ids : []))];
  };
}
function ids(r) {
  const out = [];
  (r.nums || []).forEach((n) => { const m = /^([A-Za-z]*)\s*(\d+)$/.exec(String(n).trim()); if (!m) return; const d = m[2]; if (/^e$/i.test(m[1])) out.push(' e' + d + ' '); else { out.push(' rute' + d + ' ', ' route' + d + ' ', ' primærrute' + d + ' ', ' sekundærrute' + d + ' ', ' vej ' + d + ' '); } });
  if (r.street) { const st = norm(r.street).trim(); if (st.length > 3) out.push(st); }
  return out;
}
