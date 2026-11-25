// Strøm: elpriser (Energi Data Service) og eget forbrug + nettariffer (Eloverblik) – alt hentes gennem workeren
import { settings, workerFetch } from './util.js';

export const state = { prices: [], area: '', pricesAt: 0, charges: null, chargesAt: 0, usage: [], usageAt: 0, status: null, error: '', usageError: '' };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day0 = (d) => { const t = new Date(d); t.setHours(0, 0, 0, 0); return t; };
const addD = (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t; };

// Prisområde: Vestdanmark (DK1) eller Østdanmark (DK2). Automatisk ud fra jeres hjem (Storebælt ≈ 11° Ø).
export function area() {
  const a = (settings.el || {}).area;
  if (a === 'DK1' || a === 'DK2') return a;
  const home = (settings.places || [])[0];
  return home && home.lon > 10.95 ? 'DK2' : 'DK1';
}

export async function loadPrices(force = false) {
  const ar = area();
  if (!force && ar === state.area && Date.now() - state.pricesAt < 30 * 60000) return;
  // 35 dage tilbage (til at regne forbrugets pris ud) og til og med i morgen
  const from = ymd(addD(new Date(), -35)); const to = ymd(addD(new Date(), 2));
  const j = await (await workerFetch(`/el/prices?area=${ar}&from=${from}&to=${to}`)).json();
  if (j.error) throw new Error(j.error);
  state.prices = (j.records || []).map((r) => ({ t: new Date(r.t), spot: r.p / 1000 })); // kr/kWh uden moms
  state.area = ar; state.pricesAt = Date.now(); state.error = '';
}

export async function loadEloverblik(force = false) {
  if (!state.status || force) { try { state.status = await (await workerFetch('/el/status')).json(); } catch (e) { state.status = { configured: false }; } }
  if (!state.status.configured) return;
  try {
    if (!state.charges || Date.now() - state.chargesAt > 12 * 3600000) { const c = await (await workerFetch('/el/charges')).json(); if (!c.error) { state.charges = c; state.chargesAt = Date.now(); } }
    if (force || Date.now() - state.usageAt > 3 * 3600000) {
      // Eloverblik har data til og med i går (nogle gange i forgårs)
      const u = await (await workerFetch(`/el/usage?from=${ymd(addD(new Date(), -32))}&to=${ymd(new Date())}`)).json();
      if (u.error) throw new Error(u.error);
      state.usage = (u.points || []).map((p) => ({ t: new Date(p.t), kwh: p.kwh })); state.usageAt = Date.now(); state.usageError = '';
    }
  } catch (e) { state.usageError = e.message; state.usageAt = Date.now(); }
}

// Nettarif m.m. for et tidspunkt (kr/kWh uden moms) – summen af alle tariffer fra Eloverblik (net, Energinet, elafgift)
function tariffAt(t) {
  const c = state.charges; if (!c || !c.tariffs) return null;
  const h = t.getHours(); const q = h * 4 + Math.floor(t.getMinutes() / 15);
  return c.tariffs.reduce((sum, x) => {
    const p = x.prices || []; if (!p.length) return sum;
    const v = p.length >= 96 ? p[q] : p.length >= 24 ? p[h] : p[0];
    return sum + (+v || 0);
  }, 0);
}
// Hvad en kWh koster alt i alt (kr inkl. moms). Elselskabets tillæg angives inkl. moms, som selskaberne oplyser det.
export const hasTariffs = () => !!(state.charges && state.charges.tariffs && state.charges.tariffs.length);
const num = (v) => +String(v ?? '').replace(',', '.') || 0;
// Aftalen kan skifte pris på en bestemt dato (fx 1. marts 2027): så gælder det nye tillæg og abonnement fra den dag
function terms(t) {
  const e = settings.el || {}; const ch = e.change;
  if (ch && ch.from && t >= new Date(ch.from + 'T00:00:00')) return { markup: num(ch.markup), sub: num(ch.sub) };
  return { markup: num(e.markup), sub: num(e.sub) };
}
export const subscriptionNow = () => terms(new Date()).sub;
export function total(p) {
  const markup = terms(p.t).markup / 100; // øre inkl. moms → kr
  const tar = tariffAt(p.t);
  return (p.spot + (tar || 0)) * 1.25 + markup;
}

// Timepriser for en dag (gennemsnit af kvarterene)
export function hours(day) {
  const a = day0(day).getTime(); const b = a + 86400000;
  const by = new Map();
  state.prices.filter((p) => p.t >= a && p.t < b).forEach((p) => { const h = new Date(p.t); h.setMinutes(0, 0, 0); const k = +h; if (!by.has(k)) by.set(k, []); by.get(k).push(total(p)); });
  return [...by].sort((x, y) => x[0] - y[0]).map(([k, v]) => ({ t: new Date(k), price: v.reduce((s, x) => s + x, 0) / v.length }));
}
export function now() {
  const t = Date.now(); const p = state.prices.filter((x) => x.t <= t).pop();
  return p ? total(p) : null;
}
// Billigste sammenhængende vindue på n timer fra nu og frem
export function cheapest(n = 3) {
  const t0 = new Date(); t0.setMinutes(0, 0, 0);
  const hs = hours(new Date()).concat(hours(addD(new Date(), 1))).filter((h) => h.t >= t0);
  let best = null;
  for (let i = 0; i + n <= hs.length; i++) { const avg = hs.slice(i, i + n).reduce((s, h) => s + h.price, 0) / n; if (!best || avg < best.avg) best = { from: hs[i].t, to: new Date(+hs[i + n - 1].t + 3600000), avg }; }
  return best;
}

// Forbrug pr. dag med pris (prisen for hver time ganget med timens forbrug)
const priceAtHour = (t) => { const a = +t; const ps = state.prices.filter((p) => p.t >= a && p.t < a + 3600000); return ps.length ? ps.reduce((s, p) => s + total(p), 0) / ps.length : null; };
export function days(n = 30) {
  const by = new Map();
  state.usage.forEach((u) => { const k = +day0(u.t); if (!by.has(k)) by.set(k, { t: new Date(k), kwh: 0, cost: 0, priced: 0, hours: 0 }); const d = by.get(k); d.kwh += u.kwh; d.hours++; const pr = priceAtHour(u.t); if (pr !== null) { d.cost += pr * u.kwh; d.priced++; } });
  return [...by.values()].filter((d) => d.hours >= 20).sort((a, b) => a.t - b.t).slice(-n).map((d) => ({ ...d, cost: d.priced >= d.hours * 0.9 ? d.cost : null }));
}
export function monthSoFar() {
  const m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
  const ds = days(40).filter((d) => d.t >= m0);
  // Abonnementet lægges til med den andel af måneden, der er gået
  const dim = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate(); const sub = terms(m0).sub * (ds.length / dim);
  return { kwh: ds.reduce((s, d) => s + d.kwh, 0), cost: ds.every((d) => d.cost !== null) ? ds.reduce((s, d) => s + d.cost, 0) + sub : null, days: ds.length };
}
export function yesterdayHours() {
  const y = day0(addD(new Date(), -1)); const ds = days(40); const last = ds[ds.length - 1];
  const d = last ? last.t : y;
  return { day: d, hours: state.usage.filter((u) => +day0(u.t) === +d) };
}
