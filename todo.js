// To do: gøremål (med hvem og evt. deadline) og faste pligter på skift (turnus) – gemmes i de fælles indstillinger
import { settings, save, uid, startOfDay } from './util.js';

const T = () => { const t = settings.todo = settings.todo || {}; t.items = t.items || []; t.chores = t.chores || []; t.log = t.log || {}; return t; };
export const items = () => T().items;
export const chores = () => T().chores;

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
export const monday = (d) => { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const EVERY = [['day', 'Hver dag'], ['week', 'Hver uge'], ['2weeks', 'Hver 2. uge'], ['3weeks', 'Hver 3. uge'], ['month', 'Hver måned']];
export const PRESETS = [
  { title: 'Gåtur med hunden', icon: '🐕', every: 'day', mode: 'fast' },
  { title: 'Køkkentjans', icon: '🍽️', every: 'day', mode: 'turnus' },
  { title: 'Støvsuge', icon: '🧹', every: 'week', day: 6, mode: 'turnus' },
  { title: 'Vaske gulv', icon: '🪣', every: '2weeks', day: 6, mode: 'turnus' }
];

/* ---------- Faste pligter ---------- */
const allDays = [0, 1, 2, 3, 4, 5, 6];
const daysOf = (c) => (c.days && c.days.length ? c.days : allDays);
// Antal gange pligten har været der fra start til (ikke med) dagen d – bruges til at finde, hvis tur det er
function countDays(c, start, d) {
  const n = dayDiff(start, d); if (n <= 0) return n < 0 ? -1 : 0;
  const ds = daysOf(c); let k = Math.floor(n / 7) * ds.length;
  for (let i = Math.floor(n / 7) * 7; i < n; i++) if (ds.includes(addDays(start, i).getDay())) k++;
  return k;
}
// Pligtens "gang" på dagen d: dagligt = den dag; ugentligt = ugen; hver 2. uge = hver anden uge; månedligt = måneden
export function occurrence(c, d) {
  d = startOfDay(d); const start = c.start ? fromIso(c.start) : startOfDay(new Date());
  if (c.every === 'day') {
    if (!daysOf(c).includes(d.getDay()) || d < start) return null;
    return { key: iso(d), due: d, from: d, n: countDays(c, start, d) };
  }
  const k = { week: 1, '2weeks': 2, '3weeks': 3 }[c.every];
  if (k) {
    const w = Math.round(dayDiff(monday(start), monday(d)) / 7);
    if (((w % k) + k) % k) return null; // hver 2. eller 3. uge: kun i de uger, hvor det er dens tur
    const from = monday(d); const due = addDays(from, ((c.day ?? 6) + 6) % 7);
    return { key: iso(from), due, from, n: Math.floor(w / k) };
  }
  const n = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  return { key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, due: new Date(d.getFullYear(), d.getMonth() + 1, 0), from, n };
}
// Hvis tur er det? Fast plan: efter ugedagen. Turnus: på skift i rækkefølge, startende med den valgte.
export function whoFor(c, occ) {
  if (!occ) return '';
  if (c.swaps && c.swaps[occ.key]) return c.swaps[occ.key];
  if (c.mode === 'fast' && c.every === 'day') return (c.plan || {})[occ.due.getDay()] || '';
  const ppl = (c.people || []).filter(Boolean); if (!ppl.length) return '';
  const first = Math.max(0, ppl.indexOf(c.first));
  return ppl[(((occ.n + first) % ppl.length) + ppl.length) % ppl.length];
}
const doneOf = (c, occ) => T().log[c.id + '|' + occ.key] || null;
// Pligterne på en given dag (ugentlige og månedlige vises hele perioden, til de er gjort)
export function choresOn(d) {
  return chores().map((c) => { const occ = occurrence(c, d); return occ ? { c, occ, who: whoFor(c, occ), done: doneOf(c, occ) } : null; }).filter(Boolean);
}
export function toggleChore(id, key, by = '') {
  const t = T(); const k = id + '|' + key;
  if (t.log[k]) delete t.log[k]; else t.log[k] = { by, at: Date.now() };
  // Ryd gamle afkrydsninger (over 60 dage)
  const cut = Date.now() - 60 * 86400000; Object.keys(t.log).forEach((x) => { if ((t.log[x].at || 0) < cut) delete t.log[x]; });
  save();
}
export function addChore(p = {}) {
  const c = { id: uid(), title: p.title || '', icon: p.icon || '✅', every: p.every || 'day', mode: p.mode || 'turnus', day: p.day ?? 6, days: [], people: [], first: '', plan: {}, start: iso(new Date()) };
  chores().push(c); save(); return c;
}
export function removeChore(id) { const t = T(); t.chores = t.chores.filter((c) => c.id !== id); Object.keys(t.log).forEach((k) => { if (k.startsWith(id + '|')) delete t.log[k]; }); save(); }
// Når fordelingen ændres, regnes turnussen fra i dag, så den valgte står først nu
export function setChore(id, k, v) {
  const c = chores().find((x) => x.id === id); if (!c) return;
  c[k] = v; if (['people', 'first', 'every', 'days', 'mode'].includes(k)) { c.start = iso(new Date()); c.swaps = {}; }
  save();
}

/* ---------- Gøremål ---------- */
export function addItem(p) {
  items().push({ id: uid(), title: p.title, who: p.who || '', due: p.due || '', done: false, created: Date.now() });
  save();
}
export function toggleItem(id, by = '') {
  const x = items().find((i) => i.id === id); if (!x) return;
  x.done = !x.done; x.doneAt = x.done ? Date.now() : 0; x.doneBy = x.done ? by : '';
  // Udførte gøremål ryddes væk efter 30 dage
  const t = T(); const cut = Date.now() - 30 * 86400000; t.items = t.items.filter((i) => !i.done || (i.doneAt || 0) > cut);
  save();
}
export function removeItem(id) { const t = T(); t.items = t.items.filter((i) => i.id !== id); save(); }
// Åbne gøremål: overskredne og dem med nærmeste deadline først, uden deadline til sidst
export function openItems(who) {
  return items().filter((i) => !i.done && (!who || !i.who || i.who === who))
    .sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || String(a.due).localeCompare(String(b.due)) || a.created - b.created);
}
export const doneItems = (who) => items().filter((i) => i.done && (!who || !i.who || i.who === who)).sort((a, b) => b.doneAt - a.doneAt);
export const overdue = (i) => !!i.due && fromIso(i.due) < startOfDay(new Date());
