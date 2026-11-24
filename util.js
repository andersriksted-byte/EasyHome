// easyHome – fælles hjælpefunktioner og indstillinger (gemmes i browserens localStorage på tabletten)

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = (n) => String(n).padStart(2, '0');
export const DAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
export const DAYS_LONG = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
export const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const longDate = (d) => `${cap(DAYS_LONG[d.getDay()])} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
export const uid = () => Math.random().toString(36).slice(2, 10);

export function relTime(date) {
  const min = Math.round((Date.now() - date.getTime()) / 60000);
  if (min < 1) return 'lige nu';
  if (min < 60) return `${min} min siden`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} t siden`;
  return `${date.getDate()}. ${MONTHS[date.getMonth()].slice(0, 3)}`;
}

const KEY = 'easyhome.v1';

export const DEFAULTS = {
  theme: 'auto', // 'auto' skifter mellem dagTema og natTema ved solop-/nedgang
  dayTheme: 'sand',
  nightTheme: 'aften',
  navOpen: false,
  proxy: { url: 'https://easyhome.andersriksted.workers.dev', key: '' },
  family: { name: 'Familien Riksted', members: [] }, // members: [{ id, name, color }]
  me: '', // valgt profil på denne skærm
  services: {}, // tjenester slået fra: { nyheder: false, … }
  layouts: {}, // egne forsider pr. familiemedlem: { <id>: [ … ] }
  location: { name: 'København', lat: 55.6761, lon: 12.5683 }, // ældre felt – flyttes ind i places ved start
  places: [], // [{ id, label, name, lat, lon }] – første sted er 'hjem'
  weather: { model: 'dmi_seamless', step: 60 }, // step: minutter mellem punkterne i vejrkortet
  news: { sources: ['dr-seneste', 'tv2', 'jp'], custom: [], publicProxyForTest: false, rotateSecs: 20 },
  calendars: [],
  football: { leagues: [], teams: [] },
  countdown: { name: 'Juleaften', date: '2026-12-24' }, // ældre felt – flyttes til countdowns ved start
  countdowns: undefined,
  sonos: { groupId: null },
  look: { bg: 'theme', url: '', imageId: '', alpha: 100, blur: true },
  tv: {
    channels: [
      { name: 'DR1', url: 'https://www.dr.dk/drtv/kanal/dr1_20875' },
      { name: 'DR2', url: 'https://www.dr.dk/drtv/kanal/dr2_20876' },
      { name: 'DR Ramasjang', url: 'https://www.dr.dk/drtv/ramasjang' },
      { name: 'TV-guide', url: 'https://www.dr.dk/drtv/tv-guide' }
    ]
  },
  layout: [
    { id: 'uge', w: 4, h: 1 },
    { id: 'vejr', w: 2, h: 1 },
    { id: 'nyheder', w: 2, h: 1 },
    { id: 'sonos', w: 1, h: 1 },
    { id: 'nedtaelling', w: 1, h: 1 }
  ]
};

function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? over : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = k in base ? merge(base[k], over[k]) : over[k];
    return out;
  }
  return over === undefined ? base : over;
}

function load() {
  try { return merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return structuredClone(DEFAULTS); }
}

export const settings = load();
// Felter der kun gælder for den enkelte skærm – alt andet deles mellem skærmene via workeren
export const LOCAL_ONLY = ['proxy', 'navOpen', 'me', 'gridCols', 'gridColsBy', 'timers', 'keepAwake', 'calHidden']; // gridCols: kortstørrelse pr. skærm (iPad og Mac er forskellige)
let savedHook = null;
export function onSaved(fn) { savedHook = fn; }
function write() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* fx privat tilstand */ } }
export function save() { settings.updatedAt = Date.now(); write(); if (savedHook) savedHook(); }
export function replaceSettings(obj) {
  const next = merge(DEFAULTS, obj);
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, next);
  save();
}
// Brug indstillinger fra en anden skærm, men behold denne skærms egne felter
export function applyShared(obj, updatedAt) {
  const keep = {}; LOCAL_ONLY.forEach((k) => { keep[k] = settings[k]; });
  const next = merge(DEFAULTS, obj);
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, next, keep, { updatedAt });
  write();
}
export function sharedSettings() {
  const out = {};
  for (const k of Object.keys(settings)) if (!LOCAL_ONLY.includes(k) && k !== 'updatedAt') out[k] = settings[k];
  return out;
}

export function setPath(path, value) {
  const keys = path.split('.');
  let o = settings;
  while (keys.length > 1) o = o[keys.shift()];
  o[keys[0]] = value;
  save();
}

export const hasProxy = () => !!(settings.proxy.url && settings.proxy.key);
const base = () => settings.proxy.url.replace(/\/+$/, '');

// Kalder Cloudflare-workeren (proxy + Sonos). Nøglen sendes i en header.
export async function workerFetch(path, opts = {}) {
  if (!hasProxy()) throw new Error('NO_PROXY');
  const res = await fetch(base() + path, {
    ...opts,
    headers: { 'X-Dash-Key': settings.proxy.key, ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) }
  });
  if (res.status === 401 && String(settings.proxy.key).startsWith('t1.') && authHook) authHook();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}
let authHook = null;
// Kaldes når skærmens login ikke længere gælder (fx efter "Log alle skærme ud")
export function onAuthLost(fn) { authHook = fn; }

// Henter tekst (RSS, iCal) fra en anden side via workeren, fordi browseren ellers blokerer (CORS).
export async function fetchText(url, { allowPublic = false } = {}) {
  if (hasProxy()) return (await workerFetch('/proxy?url=' + encodeURIComponent(url))).text();
  if (allowPublic) {
    const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  throw new Error('NO_PROXY');
}
