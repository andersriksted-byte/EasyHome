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

// Priser gemmes på skærmen: gamle dage ændrer sig aldrig, så kun de nyeste dage hentes igen.
// Det holder antallet af kald nede – Energi Data Service afviser for mange kald (429).
const PKEY = (ar) => 'easyhome.elprices.' + ar;
function cached(ar) { try { return JSON.parse(localStorage.getItem(PKEY(ar)) || '[]'); } catch (e) { return []; } }
function store(ar, recs) { try { localStorage.setItem(PKEY(ar), JSON.stringify(recs)); } catch (e) { /* fuld eller blokeret */ } }
let backoffUntil = 0;
// Energi Data Service tillader kun 1 kald i minuttet pr. adresse. Skærmen henter derfor først fra jeres server
// (som deler priserne mellem skærmene). Har serveren ingen priser, henter skærmen selv – højst én gang i minuttet,
// også på tværs af genindlæsninger – og deler resultatet med serveren.
async function direct(ar) {
  // Reserve uden server: elprisenligenu.dk – én fil pr. dag (i går, i dag og i morgen)
  const dayFile = (d) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const res = await Promise.all([-1, 0, 1].map((k) => fetch(`https://www.elprisenligenu.dk/api/v1/prices/${dayFile(addD(new Date(), k))}_${ar}.json`).then((r) => (r.ok ? r.json() : [])).catch(() => [])));
  const recs = res.flat().filter((x) => x && typeof x.DKK_per_kWh === 'number').map((x) => ({ t: new Date(x.time_start).toISOString(), p: x.DKK_per_kWh * 1000 }));
  if (!recs.length) throw new Error('Kunne ikke hente elpriser lige nu');
  workerFetch(`/el/prices?area=${ar}`, { method: 'POST', body: JSON.stringify({ records: recs }) }).catch(() => {});
  return recs;
}
async function fetchRange(ar) {
  let fromServer = null; let err = null;
  try { const j = await (await workerFetch(`/el/prices?area=${ar}`)).json(); if (!j.error) fromServer = j.records || []; else err = j.error; } catch (e) { err = e.message; }
  if (fromServer && fromServer.length) return fromServer;
  try { return await direct(ar); } catch (e) { throw new Error(err && err !== 'NO_PROXY' ? err : e.message); }
}
let inflight = null;
export async function loadPrices(force = false) {
  if (inflight) return inflight; // kun én hentning ad gangen
  inflight = loadPricesNow(force).finally(() => { inflight = null; });
  return inflight;
}
async function loadPricesNow(force) {
  const ar = area();
  if (Date.now() < backoffUntil) return;
  if (ar === state.area && Date.now() - state.pricesAt < (force ? 60000 : 20 * 60000)) return; // også ved "opdater": højst én gang i minuttet
  let have = cached(ar).filter((r) => Date.parse(r.t) > Date.now() - 36 * 86400000); // 35 dage tilbage til at regne forbrugets pris ud
  if (!state.prices.length && have.length) { state.prices = have.map((r) => ({ t: new Date(r.t), spot: r.p / 1000 })); state.area = ar; }
  // Hent fra i går (eller fra hullet i det gemte) til og med i morgen
  const lastDay = have.length ? new Date(have[have.length - 1].t) : null;
  try {
    const fresh = await fetchRange(ar);
    const m = new Map(have.map((r) => [r.t, r])); fresh.filter((r) => r.p !== null && r.p !== undefined).forEach((r) => m.set(new Date(r.t).toISOString(), { t: new Date(r.t).toISOString(), p: r.p }));
    have = [...m.values()].sort((a, b) => Date.parse(a.t) - Date.parse(b.t)); store(ar, have);
    state.prices = have.map((r) => ({ t: new Date(r.t), spot: r.p / 1000 })); // kr/kWh uden moms
    state.area = ar; state.pricesAt = Date.now(); state.error = '';
  } catch (e) {
    if (/429|travlt/.test(e.message)) { backoffUntil = Date.now() + 70000; state.error = 'Energi Data Service har travlt – prøver igen om et minut'; }
    else state.error = e.message;
    if (!state.prices.length) throw new Error(state.error);
  }
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

// ---------- Historik: forbrug dag for dag for de seneste år (til måned, kvartal, år og sammenligning) ----------
state.daily = []; state.dailyAt = 0; state.histError = '';
export async function loadHistory(force = false) {
  if (!state.status || !state.status.configured) return;
  if (!force && Date.now() - state.dailyAt < 6 * 3600000) return;
  const y = new Date().getFullYear(); const out = [];
  for (let yr = y - 4; yr <= y; yr++) {
    const to = yr === y ? ymd(new Date()) : `${yr + 1}-01-01`;
    try {
      const j = await (await workerFetch(`/el/usage?agg=Day&from=${yr}-01-01&to=${to}`)).json();
      if (j.error) throw new Error(j.error);
      (j.points || []).forEach((p) => out.push({ t: day0(new Date(p.t)), kwh: p.kwh }));
    } catch (e) { if (yr === y) state.histError = e.message; } // ældre år findes måske ikke (nyt hus, ny måler)
  }
  const seen = new Map(); out.forEach((d) => seen.set(+d.t, d));
  state.daily = [...seen.values()].sort((a, b) => a.t - b.t); state.dailyAt = Date.now();
  if (state.daily.length) state.histError = '';
}
export const years = () => [...new Set(state.daily.map((d) => d.t.getFullYear()))].sort();
const sum = (l) => l.reduce((s, d) => s + d.kwh, 0);
export const dayKwh = (y, m, d) => { const x = state.daily.find((v) => v.t.getFullYear() === y && v.t.getMonth() === m && v.t.getDate() === d); return x ? x.kwh : null; };
export function monthKwh(y, m) { const l = state.daily.filter((d) => d.t.getFullYear() === y && d.t.getMonth() === m); return l.length ? sum(l) : null; }
export function quarterKwh(y, q) { const l = state.daily.filter((d) => d.t.getFullYear() === y && Math.floor(d.t.getMonth() / 3) === q); return l.length ? sum(l) : null; }
export function yearKwh(y) { const l = state.daily.filter((d) => d.t.getFullYear() === y); return l.length ? sum(l) : null; }
// Akkumuleret forbrug fra 1. januar, dag for dag (til at sammenligne år)
export function cumulative(y) {
  let acc = 0; return state.daily.filter((d) => d.t.getFullYear() === y).map((d) => { acc += d.kwh; return { doy: Math.floor((d.t - new Date(y, 0, 1)) / 86400000), kwh: acc }; });
}
// Samme periode sidste år til sammenligning: forbrug fra 1. januar til samme dato
export function ytd(y, upto = new Date()) {
  const lim = new Date(y, upto.getMonth(), upto.getDate()); return sum(state.daily.filter((d) => d.t.getFullYear() === y && d.t <= lim));
}
export const hourly = (day) => state.usage.filter((u) => +day0(u.t) === +day0(day));

// ---------- Vasketid: billigste sammenhængende timer ----------
// Tidsrum som [fra, til]; nat (fx 22–7) går hen over midnat
const inWin = (h, w) => (w[0] <= w[1] ? h >= w[0] && h < w[1] : h >= w[0] || h < w[1]);
// Billigste vindue på n timer mellem to tidspunkter (kun hele timer, der ikke er gået)
export function cheapestBetween(a, b, n = 2, win = [0, 24]) {
  const t0 = new Date(); t0.setMinutes(0, 0, 0);
  let hs = []; for (let d = day0(a); d < b; d = addD(d, 1)) hs = hs.concat(hours(d));
  // Kun timer i det valgte tidsrum (fx dagtimer 7–22), så vasken både starter og slutter i tidsrummet
  hs = hs.filter((h) => h.t >= t0 && h.t >= a && +h.t + 3600000 <= +b && inWin(h.t.getHours(), win));
  let best = null;
  for (let i = 0; i + n <= hs.length; i++) {
    if (+hs[i + n - 1].t - +hs[i].t !== (n - 1) * 3600000) continue; // skal være sammenhængende
    const avg = hs.slice(i, i + n).reduce((s, h) => s + h.price, 0) / n;
    if (!best || avg < best.avg) best = { from: hs[i].t, to: new Date(+hs[i + n - 1].t + 3600000), avg };
  }
  return best;
}
// Ugens mønster: gennemsnitspris pr. ugedag og time de seneste 4 uger → typisk billigste tid på hver ugedag
export function weekPattern(n = 2, win = [0, 24]) {
  const cut = Date.now() - 28 * 86400000; const acc = {}; // "dag-time" → [sum, antal]
  state.prices.filter((p) => +p.t > cut && +p.t < Date.now()).forEach((p) => { const k = p.t.getDay() + '-' + p.t.getHours(); const v = total(p); acc[k] = acc[k] || [0, 0]; acc[k][0] += v; acc[k][1]++; });
  const avg = (d, h) => { const x = acc[((d + Math.floor(h / 24)) % 7) + '-' + (h % 24)]; return x ? x[0] / x[1] : null; };
  const span = win[0] <= win[1] ? win[1] - win[0] : win[1] + 24 - win[0]; // timer i tidsrummet
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    let best = null;
    for (let s = win[0]; s + n <= win[0] + span; s++) { const vs = Array.from({ length: n }, (_, k) => avg(d, s + k)); if (vs.some((v) => v === null)) continue; const a = vs.reduce((t, v) => t + v, 0) / n; if (!best || a < best.avg) best = { day: d, h: s % 24, avg: a }; }
    return best;
  }).filter(Boolean);
}
