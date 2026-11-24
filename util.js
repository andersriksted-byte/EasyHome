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
  proxy: { url: '', key: '' },
  location: { name: 'København', lat: 55.6761, lon: 12.5683 }, // ældre felt – flyttes ind i places ved start
  places: [], // [{ id, label, name, lat, lon }] – første sted er 'hjem'
  weather: { model: 'dmi_seamless' },
  news: { sources: ['dr-seneste', 'tv2', 'jp'], custom: [], publicProxyForTest: false },
  calendars: [],
  countdown: { name: 'Juleaften', date: '2026-12-24' },
  sonos: { groupId: null },
  tv: {
    channels: [
      { name: 'DR1', url: 'https://www.dr.dk/drtv/kanal/dr1_20875' },
      { name: 'DR2', url: 'https://www.dr.dk/drtv/kanal/dr2_20876' },
      { name: 'DR Ramasjang', url: 'https://www.dr.dk/drtv/ramasjang' },
      { name: 'TV-guide', url: 'https://www.dr.dk/drtv/tv-guide' }
    ]
  },
  layout: [
    { id: 'uge', size: 'L' },
    { id: 'vejr', size: 'M' },
    { id: 'steder', size: 'M' },
    { id: 'nyheder', size: 'M' },
    { id: 'sonos', size: 'S' },
    { id: 'nedtaelling', size: 'S' }
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
export function save() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* fx privat tilstand */ } }
export function replaceSettings(obj) {
  const next = merge(DEFAULTS, obj);
  for (const k of Object.keys(settings)) delete settings[k];
  Object.assign(settings, next);
  save();
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

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
