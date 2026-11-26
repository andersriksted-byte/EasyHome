// Trafik: Vejdirektoratets trafikmeldinger (uheld, kø, spærringer, vejarbejde) via workerens /trafik.
// Meldingerne sorteres efter afstand fra jeres hjem og filtreres efter den valgte radius.
import { workerFetch, hasProxy, settings } from './util.js';

export const state = { items: null, at: 0, err: '', loading: false };

export const KINDS = {
  uheld: { label: 'Uheld', icon: '💥', c: '#E5484D' },
  koe: { label: 'Kø', icon: '🚗', c: '#F59E0B' },
  spaerring: { label: 'Spærring', icon: '⛔', c: '#DC2626' },
  vejr: { label: 'Vejforhold', icon: '❄️', c: '#0EA5E9' },
  haendelse: { label: 'Hændelse', icon: '⚠️', c: '#EAB308' },
  vejarbejde: { label: 'Vejarbejde', icon: '🚧', c: '#F97316' }
};

export const cfg = () => ({ radius: 30, roadworks: true, ...(settings.trafik || {}) });

export async function load(force = false) {
  if (!hasProxy()) { state.err = 'NO_PROXY'; return false; }
  if (state.loading || (!force && state.items && Date.now() - state.at < 3 * 60000)) return false;
  state.loading = true;
  try {
    const j = await (await workerFetch('/trafik')).json();
    if (j.error) throw new Error(j.error);
    state.items = (j.items || []).map((x) => ({ ...x, from: x.from ? new Date(x.from) : null, to: x.to ? new Date(x.to) : null }));
    state.at = Date.now(); state.err = '';
    return true;
  } catch (e) { state.err = e.message || 'Fejl'; return true; } finally { state.loading = false; }
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
