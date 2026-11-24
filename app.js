// easyHome – hovedprogram
import { esc, pad, DAYS, MONTHS, cap, hhmm, startOfDay, addDays, sameDay, longDate, relTime, uid, settings, save, setPath, replaceSettings, hasProxy, workerFetch } from './util.js';
import * as W from './weather.js';
import * as N from './news.js';
import * as C from './calendar.js';
import * as S from './sonos.js';
import { startUpdater } from './updater.js';

const $ = (s, r = document) => r.querySelector(s);

/* ---------- Temaer ---------- */
const THEMES = {
  sand: { label: 'Sand', bg: '#F4F1EC', card: '#FFFFFF', text: '#1E1E1C', text2: '#3D3B37', muted: '#5E5B55', accent: '#2F6B5E', onAccent: '#FFFFFF', good: '#2F6B5E', line: '#E4DED4', track: '#E7E2DA', warn: '#C8662B', hot: '#B23A12', nav: '#1E1E1C', navFg: '#D8D3CA', navSoft: '#2C2B28', badge: '#E9A27A', inv: '#1E1E1C', invFg: '#F4F1EC', invSoft: '#3A3936', dayBg: '#FAF8F4' },
  nordisk: { label: 'Nordisk', bg: '#EEF1F5', card: '#FFFFFF', text: '#17202B', text2: '#334155', muted: '#526071', accent: '#2D5BD7', onAccent: '#FFFFFF', good: '#2E7D5B', line: '#DCE2EA', track: '#E2E7EE', warn: '#D9822B', hot: '#B4321C', nav: '#17202B', navFg: '#C9D3E0', navSoft: '#253141', badge: '#FFB088', inv: '#17202B', invFg: '#EEF1F5', invSoft: '#2E3B4D', dayBg: '#F6F8FB' },
  skov: { label: 'Skov', bg: '#EEF0E8', card: '#FFFFFF', text: '#1C2418', text2: '#38432F', muted: '#56614A', accent: '#3F7A3A', onAccent: '#FFFFFF', good: '#3F7A3A', line: '#DDE2D2', track: '#E1E5D8', warn: '#C2662D', hot: '#A8431C', nav: '#22301F', navFg: '#CBD5C2', navSoft: '#2F4029', badge: '#E6B36A', inv: '#22301F', invFg: '#EEF0E8', invSoft: '#3A4C33', dayBg: '#F7F8F3' },
  terracotta: { label: 'Terracotta', bg: '#FFF6EC', card: '#FFFFFF', text: '#2A211C', text2: '#4A3D34', muted: '#6B5D53', accent: '#B83A24', onAccent: '#FFFFFF', good: '#2E7D5B', line: '#F0E2D2', track: '#F2E6D8', warn: '#E08A2E', hot: '#B23A12', nav: '#2A211C', navFg: '#E8DCCF', navSoft: '#3A2E27', badge: '#F2B48A', inv: '#2A211C', invFg: '#FFF6EC', invSoft: '#4A3D34', dayBg: '#FFFBF6' },
  aften: { label: 'Aften', bg: '#121417', card: '#1C1F24', text: '#ECEDEE', text2: '#C4C8CE', muted: '#9AA1AB', accent: '#7CC4FF', onAccent: '#0B0D10', good: '#6FD3A0', line: '#2A2F37', track: '#2A2F37', warn: '#FFB454', hot: '#FF8A65', nav: '#0B0D10', navFg: '#A7ADB6', navSoft: '#1C1F24', badge: '#FFB454', inv: '#0B0D10', invFg: '#ECEDEE', invSoft: '#2A2F37', dayBg: '#181B20' }
};
const THEME_ORDER = ['auto', 'sand', 'nordisk', 'skov', 'terracotta', 'aften'];

function isNight() {
  const d = D.weather && D.weather.days[0];
  const now = new Date();
  if (d) return now < d.sunrise || now > d.sunset;
  return now.getHours() < 7 || now.getHours() >= 18;
}
function currentThemeId() {
  if (settings.theme === 'auto') return isNight() ? settings.nightTheme : settings.dayTheme;
  return THEMES[settings.theme] ? settings.theme : 'sand';
}
function applyTheme() {
  const T = THEMES[currentThemeId()];
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(T)) if (k !== 'label') r.setProperty('--' + k, v);
  document.documentElement.style.colorScheme = currentThemeId() === 'aften' ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = T.nav;
}
const themeLabel = (id) => (id === 'auto' ? 'Automatisk' : THEMES[id].label);

/* ---------- Ikoner ---------- */
const ICON = {
  menu: 'M4 7h16M4 12h16M4 17h16', back: 'M15 6l-6 6 6 6',
  forside: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  kalender: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4',
  vejr: 'M8 19h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 8 19zM9 3v1.5M3.5 8.5H2M5 5l1 1M14 5l-1 1',
  nyheder: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  musik: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  tv: 'M3 6h18v12H3zM8 21h8M10 10l4 2-4 2z',
  indstillinger: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  grip: '', play: 'M8 5v14l11-7z', pause: 'M7 5h3v14H7zM14 5h3v14h-3z', next: 'M6 5l9 7-9 7zM17 5v14', prev: 'M18 5l-9 7 9 7zM7 5v14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7'
};
const svg = (name, size = 24, extra = '') => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}><path d="${ICON[name]}"/></svg>`;
const fillSvg = (name, size = 20) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="${ICON[name]}"/></svg>`;
const GRIP = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

const PAGES = [
  { id: 'forside', label: 'Forside' }, { id: 'kalender', label: 'Kalender' }, { id: 'vejr', label: 'Vejret' },
  { id: 'nyheder', label: 'Nyheder' }, { id: 'musik', label: 'Musik' }, { id: 'tv', label: 'DR TV' }
];
const WIDGETS = { uge: 'Familiens uge', vejr: 'Vejret', steder: 'Vejret andre steder', nyheder: 'Nyheder', sonos: 'Musik (Sonos)', tv: 'DR TV', nedtaelling: 'Nedtælling' };
const DEFAULT_SIZE = { uge: 'L', vejr: 'M', steder: 'M', nyheder: 'M', sonos: 'S', tv: 'S', nedtaelling: 'S' };
const SPAN = { S: 1, M: 2, L: 4 };
const SIZE_NAME = { S: 'Lille', M: 'Mellem', L: 'Stor' };

/* ---------- Tilstand ---------- */
const D = { weather: null, weatherErr: null, wx: {}, wxErr: {}, compare: null, news: null, cal: null };
// Steder: det første sted er 'hjem' og bruges i header og tema
const home = () => settings.places[0];
const placeLabel = (p) => p.label || p.name;
const placeById = (id) => settings.places.find((p) => p.id === id) || home();
const ui = { page: pageFromHash(), setTab: 'vejr', wPlace: null, fpPlace: 0, fpTouched: 0, editing: false, calWeek: 0, geo: null, geoMsg: '', tick: 0, connMsg: '' };
function pageFromHash() { const h = location.hash.slice(1); return [...PAGES.map((p) => p.id), 'indstillinger'].includes(h) ? h : 'forside'; }

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- Hjælpere ---------- */
function lighten(hex, amt = 0.72) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#E7E2DA';
  const n = parseInt(m[1], 16); const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amt));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
const evStyle = (e) => `background:${lighten(e.color)};border-left-color:${esc(e.color || '#888')}`;
function eventsOn(day) {
  if (!D.cal) return [];
  const s = startOfDay(day); const e = addDays(s, 1);
  return D.cal.events.filter((ev) => ev.start < e && ev.end > s);
}
const evTime = (ev, day) => (ev.allDay ? 'Hele dagen' : (ev.start < startOfDay(day) ? 'Fortsat' : hhmm(ev.start)));
function evHtml(ev, day, withWho = true) {
  return `<div class="ev" style="${evStyle(ev)}"><time>${esc(evTime(ev, day))}</time>${esc(ev.title)}${withWho && ev.who ? ` <span style="font-weight:600">· ${esc(ev.who)}</span>` : ''}</div>`;
}
function weekStart(offset = 0) { const t = startOfDay(new Date()); const dow = (t.getDay() + 6) % 7; return addDays(t, -dow + offset * 7); }
function countdownDays() {
  const t = new Date(settings.countdown.date + 'T00:00'); if (isNaN(t)) return null;
  return Math.round((startOfDay(t) - startOfDay(new Date())) / 86400000);
}
const fmtTemp = (t) => (t === null || t === undefined ? '–' : `${Math.round(t)}°`);
const num = (v, d = 1) => (v === null || v === undefined ? '–' : v.toFixed(d).replace('.', ','));
const needProxyMsg = (what) => `<div class="empty">${esc(what)} kræver forbindelsen til jeres lille server (Cloudflare Worker). <button class="btn line" data-act="openSet" data-tab="forbindelse">Opsæt i Indstillinger</button></div>`;

/* ---------- Navigation ---------- */
function renderNav() {
  const nav = $('#nav');
  nav.classList.toggle('open', settings.navOpen);
  const item = (p) => `<button data-act="nav" data-page="${p.id}" aria-label="${esc(p.label)}" ${ui.page === p.id ? 'aria-current="page"' : ''}>${svg(p.id)}<span class="lbl">${esc(p.label)}</span></button>`;
  nav.innerHTML = `<button class="toggle" data-act="toggleNav" aria-expanded="${settings.navOpen}" aria-label="${settings.navOpen ? 'Luk menu' : 'Åbn menu'}">${svg(settings.navOpen ? 'back' : 'menu', 22)}<span class="lbl">Luk menu</span></button>
    ${PAGES.map(item).join('')}<div class="sp"></div>${item({ id: 'indstillinger', label: 'Indstillinger' })}`;
}

/* ---------- Header ---------- */
function renderHeader() {
  const now = new Date();
  const w = D.weather;
  const cd = countdownDays();
  $('#hdr').innerHTML = `
    <div class="clock"><b id="clk">${hhmm(now)}</b><span>${esc(longDate(now))}</span></div>
    ${w ? `<button class="chip" data-act="nav" data-page="vejr">${W.weatherIcon(w.now.code, w.now.isDay, 24)} ${fmtTemp(w.now.temp)} · ${esc(W.codeText(w.now.code).toLowerCase())}</button>` : ''}
    ${cd !== null && cd >= 0 ? `<span class="chip accent">${cd === 0 ? `I dag: ${esc(settings.countdown.name)}` : `${cd} ${cd === 1 ? 'dag' : 'dage'} til ${esc(settings.countdown.name.toLowerCase())}`}</span>` : ''}
    <div class="right">
      <button class="chip" data-act="nextTheme" aria-label="Skift farvetema (nu: ${esc(themeLabel(settings.theme))})"><span style="width:22px;height:22px;border-radius:99px;background:var(--accent);border:3px solid var(--nav)"></span>${esc(themeLabel(settings.theme))}</button>
    </div>`;
}

/* ---------- Footer ---------- */
function renderFooter() {
  const np = S.nowPlaying();
  const items = D.news && D.news.items.length ? D.news.items.slice(0, 10) : [];
  const top = items.length ? items[ui.tick % items.length] : null;
  let music;
  if (S.state.connected) {
    music = `<button class="pp" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 18)}</button>
      <div class="np"><b>${esc(np.title || 'Intet spiller')}</b><span>Sonos · ${esc(np.group || '')}</span></div>`;
  } else {
    music = `<button class="pp" data-act="nav" data-page="musik" aria-label="Musik">${svg('musik', 20)}</button><div class="np"><b>Sonos</b><span>Ikke forbundet endnu</span></div>`;
  }
  $('#ftr').innerHTML = `${music}<div class="sep"></div>
    ${top ? `<a class="ticker" href="${esc(top.link)}" target="_blank" rel="noopener"><b>${esc(top.source)}</b><span>${esc(top.title)}</span></a>`
      : `<button class="ticker" style="border:0;background:none;text-align:left" data-act="nav" data-page="nyheder"><b>Nyheder</b><span>${hasProxy() || settings.news.publicProxyForTest ? 'Henter …' : 'Vælg kilder og opsæt forbindelse'}</span></button>`}`;
}

/* ---------- Forside-widgets ---------- */
function wUge(size) {
  const today = startOfDay(new Date());
  const demo = D.cal && D.cal.demo ? '<div class="small muted">Eksempel – tilføj jeres kalendere i Indstillinger</div>' : '';
  if (!D.cal) return '<div class="lab">Familiens uge</div><div class="empty">Henter kalender …</div>';
  if (size === 'S') {
    const t = eventsOn(today); const m = eventsOn(addDays(today, 1));
    return `<div class="lab">I dag</div><div class="evlist" style="display:flex;flex-direction:column;gap:6px">${t.length ? t.map((e) => evHtml(e, today)).join('') : '<div class="small muted">Ingen aftaler</div>'}</div>
      <div style="margin-top:auto;border-top:2px dashed var(--line);padding-top:8px;display:flex;flex-direction:column;gap:6px"><div class="lab">I morgen</div>${m.slice(0, 3).map((e) => evHtml(e, addDays(today, 1), false)).join('') || '<div class="small muted">Ingen aftaler</div>'}</div>${demo}`;
  }
  const days = size === 'M' ? [0, 1, 2].map((i) => addDays(today, i)) : [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart(0), i));
  return `<div class="row" style="justify-content:space-between"><span class="lab">${size === 'M' ? 'Næste 3 dage' : 'Familiens uge'}</span>${demo}</div>
    <div class="days" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">${days.map((d) => `
      <div class="day ${sameDay(d, today) ? 'today' : ''}"><h3>${cap(DAYS[d.getDay()])} <span>${d.getDate()}.</span></h3>
      ${eventsOn(d).slice(0, size === 'M' ? 5 : 4).map((e) => evHtml(e, d, false)).join('')}</div>`).join('')}</div>`;
}
function placeArrows(scope, idx) {
  const n = settings.places.length;
  if (n < 2) return '';
  return `<span class="parrows"><button class="arr" data-act="wStep" data-scope="${scope}" data-dir="-1" aria-label="Forrige sted">‹</button>
    <span class="dots" aria-hidden="true">${settings.places.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</span>
    <button class="arr" data-act="wStep" data-scope="${scope}" data-dir="1" aria-label="Næste sted">›</button></span>`;
}
function wVejr(size) {
  const n = settings.places.length;
  const idx = ((ui.fpPlace % n) + n) % n;
  const place = settings.places[idx];
  const w = D.wx[place.id];
  const title = `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="lab" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Vejret · ${esc(placeLabel(place))}</span>${placeArrows('fp', idx)}</div>`;
  if (!w) return `${title}<div class="empty">${D.wxErr[place.id] ? esc(D.wxErr[place.id]) : 'Henter vejret …'}</div>`;
  const head = `${title}
    <div class="wnow">${W.weatherIcon(w.now.code, w.now.isDay, size === 'S' ? 48 : 56)}<div><div class="t">${fmtTemp(w.now.temp)}</div><div class="small muted">${esc(W.codeText(w.now.code))} · føles som ${fmtTemp(w.now.feels)}</div></div></div>`;
  if (size === 'S') return head + `<div class="small" style="margin-top:auto">I dag ${fmtTemp(w.days[0].max)} / ${fmtTemp(w.days[0].min)} · vind ${num(w.now.wind, 0)} m/s</div>`;
  const hours = `<div class="hours">${w.hours.slice(0, size === 'M' ? 8 : 12).map((h) => `<div class="hour"><span>${pad(h.time.getHours())}</span>${W.weatherIcon(h.code, h.isDay, 26)}<span>${fmtTemp(h.temp)}</span><span class="r">${h.rain > 0 ? num(h.rain) + ' mm' : '&nbsp;'}</span></div>`).join('')}</div>`;
  if (size === 'M') return head + hours;
  return head + hours + `<div class="row" style="gap:8px">${w.days.slice(1, 6).map((d) => `<div class="hour" style="flex:1"><span>${cap(DAYS[d.date.getDay()])}</span>${W.weatherIcon(d.code, 1, 26)}<span>${fmtTemp(d.max)} / ${fmtTemp(d.min)}</span></div>`).join('')}</div>`;
}
function wSteder(size) {
  const others = settings.places.slice(1);
  if (!others.length) return `<div class="lab">Vejret andre steder</div><div class="empty">Steder tilføjes under Indstillinger → Vejret.</div>`;
  const row = (p) => {
    const w = D.wx[p.id];
    if (!w) return `<div class="row"><b>${esc(placeLabel(p))}</b><span class="small muted">${D.wxErr[p.id] ? esc(D.wxErr[p.id]) : 'Henter …'}</span></div>`;
    const days = size === 'L' ? `<div class="row" style="gap:6px">${w.days.slice(1, 4).map((d) => `<div class="hour" style="flex:1"><span>${cap(DAYS[d.date.getDay()])}</span>${W.weatherIcon(d.code, 1, 22)}<span>${fmtTemp(d.max)}/${fmtTemp(d.min)}</span></div>`).join('')}</div>` : '';
    return `<button data-act="wPlace" data-id="${esc(p.id)}" style="border:0;background:var(--bg);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;text-align:left;color:var(--text)">
      <span class="row" style="flex-wrap:nowrap;width:100%">${W.weatherIcon(w.now.code, w.now.isDay, size === 'S' ? 30 : 38)}<span style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(placeLabel(p))}</b><span class="small muted">${esc(W.codeText(w.now.code))}</span></span>
      <span style="text-align:right"><b style="font-size:22px">${fmtTemp(w.now.temp)}</b><span class="small muted" style="display:block;white-space:nowrap">${fmtTemp(w.days[0].max)} / ${fmtTemp(w.days[0].min)}${w.days[0].rain > 0 ? ' · ' + num(w.days[0].rain) + ' mm' : ''}</span></span></span>${days}</button>`;
  };
  const cols = size === 'S' ? 1 : Math.min(others.length, size === 'M' ? 2 : 4);
  return `<div class="lab">Vejret andre steder</div><div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:8px">${others.map(row).join('')}</div>`;
}
function newsList(n, big = false) {
  if (!hasProxy() && !settings.news.publicProxyForTest) return needProxyMsg('Nyheder');
  if (!D.news) return '<div class="empty">Henter nyheder …</div>';
  const items = D.news.items.slice(0, n);
  if (!items.length) return `<div class="empty">Ingen nyheder lige nu.${D.news.errors.length ? ' ' + esc(D.news.errors.map((e) => e.source + ': ' + e.msg).join(' · ')) : ''}</div>`;
  return `<div class="news ${big ? 'big-news' : ''}">${items.map((i) => `<a href="${esc(i.link)}" target="_blank" rel="noopener"><span class="meta"><span class="src">${esc(i.source)}</span>${i.date ? ' · ' + esc(relTime(i.date)) : ''}</span><b>${esc(i.title)}</b>${big && i.summary ? `<p>${esc(i.summary)}</p>` : ''}</a>`).join('')}</div>`;
}
function wNyheder(size) { return `<div class="lab">Nyheder</div>${newsList({ S: 3, M: 5, L: 8 }[size])}`; }
function wSonos(size) {
  if (!S.state.connected) return `<div class="lab">Musik</div><div class="empty">Sonos er ikke forbundet endnu.</div><button class="btn line" data-act="nav" data-page="musik">Gå til Musik</button>`;
  const np = S.nowPlaying();
  return `<div class="lab">Musik · ${esc(np.group)}</div>
    <div class="row" style="flex-wrap:nowrap">${np.image ? `<span class="art" style="width:64px;flex:none;background-image:url('${esc(np.image)}')"></span>` : ''}<div><b style="font-size:17px">${esc(np.title || 'Intet spiller')}</b><div class="small muted">${esc(np.artist || '')}</div></div></div>
    <div class="row" style="margin-top:auto"><button class="btn dark" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 18)}</button><button class="btn" data-act="sNext" aria-label="Næste">${fillSvg('next', 18)}</button>
    ${size !== 'S' && np.volume !== null ? `<label class="vol" style="flex:1"><span class="small">Lyd</span><input type="range" min="0" max="100" value="${np.volume}" data-vol aria-label="Lydstyrke"></label>` : ''}</div>`;
}
function wTv(size) {
  const ch = settings.tv.channels.slice(0, size === 'S' ? 2 : 4);
  return `<div class="lab">DR TV</div><div class="row" style="flex:1;align-items:stretch">${ch.map((c) => `<a class="tvtile" style="flex:1;min-height:90px;font-size:18px" href="${esc(c.url)}" target="_blank" rel="noopener">${fillSvg('play', 28)}${esc(c.name)}</a>`).join('')}</div>`;
}
function wNed() {
  const cd = countdownDays();
  return `<div class="lab">Nedtælling</div>${cd === null ? '<div class="empty">Vælg en dato i Indstillinger</div>' : `<div style="font-size:64px;font-weight:800;line-height:1">${cd < 0 ? '✓' : cd}</div><div style="font-weight:700">${cd < 0 ? esc(settings.countdown.name) + ' er overstået' : (cd === 1 ? 'dag til ' : 'dage til ') + esc(settings.countdown.name.toLowerCase())}</div>`}`;
}
const WRENDER = { uge: wUge, vejr: wVejr, steder: wSteder, nyheder: wNyheder, sonos: wSonos, tv: wTv, nedtaelling: wNed };

function pageForside() {
  const inLayout = (id) => settings.layout.some((x) => x.id === id);
  const edit = ui.editing ? `<section class="card editpanel">
      <div class="lab">Vælg hvad der skal være på forsiden. Træk i <b style="color:var(--text)">Flyt</b> for at ændre rækkefølgen, og vælg <b style="color:var(--text)">S, M eller L</b> for størrelsen.</div>
      <div class="choices">${Object.entries(WIDGETS).map(([id, name]) => `<button class="pill" data-act="toggleW" data-id="${id}" aria-pressed="${inLayout(id)}">${inLayout(id) ? '✓' : '+'} ${esc(name)}</button>`).join('')}</div>
      <div class="lab" style="margin-top:6px">Farvetema</div>${themePicker()}
    </section>` : '';
  const cards = settings.layout.filter((x) => WIDGETS[x.id]).map((x) => `
    <section class="card w" data-wid="${x.id}" style="--span:${SPAN[x.size] || 1}">
      ${ui.editing ? `<div class="wbar"><button class="handle" aria-label="Træk for at flytte ${esc(WIDGETS[x.id])}">${GRIP}Flyt</button><span class="nm">${esc(WIDGETS[x.id])}</span>
        ${['S', 'M', 'L'].map((z) => `<button class="sz" data-act="size" data-id="${x.id}" data-size="${z}" aria-pressed="${x.size === z}" aria-label="${SIZE_NAME[z]}">${z}</button>`).join('')}
        <button class="x" data-act="toggleW" data-id="${x.id}" aria-label="Fjern ${esc(WIDGETS[x.id])}">×</button></div>` : ''}
      ${WRENDER[x.id](x.size)}
    </section>`).join('');
  return `<div class="ptitle"><h1>Forside</h1><div class="tools"><button class="btn ${ui.editing ? 'dark' : 'line'}" data-act="edit">${ui.editing ? 'Færdig' : 'Tilpas forside'}</button></div></div>
    ${edit}<div class="grid ${ui.editing ? 'editing' : ''}" id="grid">${cards || '<div class="empty">Forsiden er tom. Tryk "Tilpas forside" og vælg kort.</div>'}</div>`;
}
function themePicker() {
  return `<div class="themes">${THEME_ORDER.map((id) => {
    const t = id === 'auto' ? null : THEMES[id];
    const sw = t ? [t.bg, t.nav, t.accent, t.warn] : [THEMES[settings.dayTheme].bg, THEMES[settings.dayTheme].accent, THEMES[settings.nightTheme].bg, THEMES[settings.nightTheme].accent];
    return `<button class="theme" data-act="setTheme" data-theme="${id}" aria-pressed="${settings.theme === id}"><span class="sw">${sw.map((c) => `<i style="background:${c}"></i>`).join('')}</span>${esc(themeLabel(id))}</button>`;
  }).join('')}</div>`;
}

/* ---------- Kalender ---------- */
function pageKalender() {
  const ws = weekStart(ui.calWeek); const today = startOfDay(new Date());
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
  const we = days[6];
  const title = `Uge ${isoWeek(ws)} · ${ws.getDate()}. ${MONTHS[ws.getMonth()].slice(0, 3)} – ${we.getDate()}. ${MONTHS[we.getMonth()].slice(0, 3)}`;
  const cals = settings.calendars.length ? settings.calendars : [];
  return `<div class="ptitle"><h1>Kalender</h1><span class="muted" style="font-weight:700">${esc(title)}</span>
      <div class="tools"><button class="btn" data-act="calPrev" aria-label="Forrige uge">‹</button><button class="btn" data-act="calToday">I dag</button><button class="btn" data-act="calNext" aria-label="Næste uge">›</button></div></div>
    ${D.cal && D.cal.demo ? '<div class="empty">Viser eksempler. Tilføj jeres kalendere under Indstillinger → Kalendere.</div>' : ''}
    ${D.cal && D.cal.errors.length ? `<div class="err">${esc(D.cal.errors.map((e) => e.cal + ': ' + e.msg).join(' · '))}</div>` : ''}
    <div class="days calweek" style="grid-template-columns:repeat(7,minmax(0,1fr))">${days.map((d) => `
      <div class="day ${sameDay(d, today) ? 'today' : ''}"><h3>${cap(DAYS[d.getDay()])} <span>${d.getDate()}.</span></h3>${eventsOn(d).map((e) => evHtml(e, d)).join('') || '<span class="small muted">–</span>'}</div>`).join('')}</div>
    ${cals.length ? `<div class="legend">${cals.map((c) => `<span style="background:${lighten(c.color)}">${esc(c.name)}</span>`).join('')}</div>` : ''}`;
}
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 86400000 + 1) / 7); }

/* ---------- Vejr ---------- */
function pageVejr() {
  const place = placeById(ui.wPlace);
  const w = D.wx[place.id];
  const places = settings.places.map((p, i) => `<button class="pill" data-act="wPlace" data-id="${esc(p.id)}" aria-pressed="${p.id === place.id}">${i === 0 ? '⌂ ' : ''}${esc(placeLabel(p))}</button>`).join('');
  const pills = W.MODELS.map((m) => `<button class="pill" data-act="wModel" data-model="${m.id}" aria-pressed="${settings.weather.model === m.id}">${esc(m.name)}</button>`).join('');
  const model = W.MODELS.find((m) => m.id === settings.weather.model) || W.MODELS[0];
  let body = `<div class="empty">${D.wxErr[place.id] ? esc(D.wxErr[place.id]) : 'Henter …'}</div>`;
  if (w) {
    const maxT = Math.max(...w.days.map((d) => d.max)); const minT = Math.min(...w.days.map((d) => d.min)); const span = Math.max(1, maxT - minT);
    body = `<div class="form" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
      <section class="card"><div class="lab">Lige nu · ${esc(placeLabel(place))}${place.label && place.label !== place.name ? ` <span class="muted">(${esc(place.name)})</span>` : ''}</div>
        <div class="wnow">${W.weatherIcon(w.now.code, w.now.isDay, 72)}<div><div class="t" style="font-size:56px">${fmtTemp(w.now.temp)}</div><div class="muted">${esc(W.codeText(w.now.code))}</div></div></div>
        <div class="small">Føles som ${fmtTemp(w.now.feels)} · Vind ${num(w.now.wind, 0)} m/s fra ${W.windDirText(w.now.windDir)} · Fugt ${w.now.humidity ?? '–'}%</div>
        <div class="small muted">Sol op ${hhmm(w.days[0].sunrise)} · ned ${hhmm(w.days[0].sunset)}</div>
        <div class="small muted" style="margin-top:auto">Kilde: ${esc(model.name)} via Open-Meteo · opdateret ${hhmm(w.fetched)}</div></section>
      <section class="card"><div class="lab">De næste 24 timer</div><div class="hours">${w.hours.slice(0, 24).map((h) => `<div class="hour"><span>${pad(h.time.getHours())}</span>${W.weatherIcon(h.code, h.isDay, 28)}<span>${fmtTemp(h.temp)}</span><span class="r">${h.rain > 0 ? num(h.rain) + ' mm' : '&nbsp;'}</span></div>`).join('')}</div>
        <div class="lab" style="margin-top:8px">7 dage</div><div class="dlist">${w.days.map((d, i) => `<div class="drow"><b>${i === 0 ? 'I dag' : cap(DAYS[d.date.getDay()])}</b>${W.weatherIcon(d.code, 1, 30)}
          <div class="rng"><i style="left:${((d.min - minT) / span) * 100}%;right:${100 - ((d.max - minT) / span) * 100}%"></i></div>
          <span style="font-weight:700;white-space:nowrap">${fmtTemp(d.min)} / ${fmtTemp(d.max)}</span><span class="rain small" style="color:var(--accent);white-space:nowrap">${d.rain > 0 ? num(d.rain) + ' mm' : ''}</span></div>`).join('')}</div></section></div>`;
  }
  const cmp = D.compare ? `<section class="card"><div class="lab">Sammenligning af kilder · ${esc(placeLabel(place))} · i dag og i morgen</div>
    <div style="overflow-x:auto"><table class="cmp"><thead><tr><th>Kilde</th><th>Nu</th><th class="n">I dag maks/min</th><th class="n">Nedbør i dag</th><th class="n">I morgen maks/min</th><th class="n">Nedbør i morgen</th></tr></thead><tbody>
    ${D.compare.map((r) => r.err ? `<tr><td>${esc(r.name)}</td><td colspan="5" class="err">${esc(r.err)}</td></tr>` : `<tr class="${r.id === settings.weather.model ? 'sel' : ''}"><td>${esc(r.name)}</td><td>${fmtTemp(r.d.now.temp)} ${esc(W.codeText(r.d.now.code).toLowerCase())}</td><td class="n">${fmtTemp(r.d.days[0].max)} / ${fmtTemp(r.d.days[0].min)}</td><td class="n">${num(r.d.days[0].rain)} mm</td><td class="n">${fmtTemp(r.d.days[1].max)} / ${fmtTemp(r.d.days[1].min)}</td><td class="n">${num(r.d.days[1].rain)} mm</td></tr>`).join('')}
    </tbody></table></div></section>` : '';
  return `<div class="ptitle"><h1>Vejret</h1><div class="tools"><button class="btn line" data-act="compare">${D.compare ? 'Opdater sammenligning' : 'Sammenlign kilder'}</button></div></div>
    <div class="row">${placeArrows('page', settings.places.indexOf(place))}${places}</div><div class="row">${pills}</div><div class="small muted">${esc(model.desc)}</div>${body}${cmp}`;
}

/* ---------- Nyheder ---------- */
function pageNyheder() {
  const src = N.allSources();
  return `<div class="ptitle"><h1>Nyheder</h1><div class="tools"><button class="btn line" data-act="newsRefresh">${svg('refresh', 18)} Opdater</button></div></div>
    <div class="row">${src.map((s) => `<button class="pill" data-act="newsToggle" data-id="${esc(s.id)}" aria-pressed="${settings.news.sources.includes(s.id)}">${esc(s.name)}</button>`).join('')}</div>
    ${D.news && D.news.errors.length ? `<div class="err">${esc(D.news.errors.map((e) => e.source + ': ' + e.msg).join(' · '))}</div>` : ''}
    <section class="card">${newsList(40, true)}</section>`;
}

/* ---------- Musik ---------- */
function sonosRooms() {
  const cg = S.currentGroup();
  const members = cg ? cg.playerIds || [] : [];
  const coord = cg ? cg.coordinatorId : null;
  const players = [...S.state.players].sort((x, y) => x.name.localeCompare(y.name, 'da'));
  const groupPills = S.state.groups.map((g) => `<button class="pill" data-act="sGroup" data-id="${esc(g.id)}" aria-pressed="${g.id === settings.sonos.groupId}">${esc(g.name)}${g.playbackState === 'PLAYBACK_STATE_PLAYING' ? ' ♪' : ''}</button>`).join('');
  const rows = players.map((pl) => {
    const inG = members.includes(pl.id);
    const isCoord = pl.id === coord;
    const other = !inG ? S.groupOfPlayer(pl.id) : null;
    const vol = S.state.playerVol[pl.id];
    return `<div class="room ${inG ? 'on' : ''}">
      <button class="rtoggle" data-act="sMember" data-pid="${esc(pl.id)}" aria-pressed="${inG}" ${isCoord ? 'disabled' : ''} aria-label="${inG ? 'Tag ' + esc(pl.name) + ' ud af gruppen' : 'Føj ' + esc(pl.name) + ' til gruppen'}"><span class="rbox">${inG ? '✓' : ''}</span>
        <span class="rname"><b>${esc(pl.name)}</b><span class="psub">${isCoord ? 'Styrer gruppen' : inG ? 'Spiller med' : other && other.playerIds.length > 1 ? 'I gruppen ' + esc(other.name) : other && other.playbackState === 'PLAYBACK_STATE_PLAYING' ? 'Spiller sit eget' : 'Ledig'}</span></span></button>
      ${inG && vol !== undefined && vol !== null ? `<label class="vol rvol"><span class="small">Lyd</span><input type="range" min="0" max="100" value="${vol}" data-pvol="${esc(pl.id)}" aria-label="Lydstyrke i ${esc(pl.name)}"></label>` : ''}
    </div>`;
  }).join('');
  return `<section class="card"><div class="lab">Styr gruppe</div><div class="row">${groupPills || '<span class="muted">Ingen rum fundet</span>'}</div></section>
    <section class="card"><div class="row" style="justify-content:space-between"><span class="lab">Rum i ${esc(cg ? cg.name : 'gruppen')}</span>
      <span class="row" style="gap:6px"><button class="btn" data-act="sAll">Alle rum sammen</button><button class="btn" data-act="sOnly">Kun ${esc(cg && S.state.players.find((x) => x.id === coord) ? S.state.players.find((x) => x.id === coord).name : 'dette rum')}</button></span></div>
      <div class="rooms">${rows}</div>
      <div class="note">Tryk på et rum for at sætte det sammen med gruppen eller tage det ud. Rummet, der styrer gruppen, kan ikke tages ud – vælg i stedet en anden gruppe ovenfor.</div></section>`;
}
function pageMusik() {
  if (!hasProxy()) return `<div class="ptitle"><h1>Musik</h1></div>${needProxyMsg('Sonos')}`;
  if (!S.state.connected) return `<div class="ptitle"><h1>Musik</h1></div><section class="card"><b style="font-size:18px">Forbind jeres Sonos</b>
    <p class="note">Du logger ind hos Sonos én gang og giver dashboardet lov til at styre afspilning. Login-nøglerne gemmes i jeres egen worker, ikke på tabletten.</p>
    <div><button class="btn primary big" data-act="sConnect">Forbind Sonos</button></div>${S.state.error ? `<div class="err">${esc(S.state.error)}</div>` : ''}</section>`;
  const np = S.nowPlaying();
  const groups = S.state.groups.map((g) => `<button class="pill" data-act="sGroup" data-id="${esc(g.id)}" aria-pressed="${g.id === settings.sonos.groupId}">${esc(g.name)}${g.playbackState === 'PLAYBACK_STATE_PLAYING' ? ' ♪' : ''}</button>`).join('');
  return `<div class="ptitle"><h1>Musik</h1><div class="tools"><button class="btn line" data-act="sReload">${svg('refresh', 18)} Opdater rum</button></div></div>
    <div class="row" style="align-items:flex-start;flex-wrap:wrap">
      <section class="player" style="width:300px;flex:none">
        <div class="art" style="${np.image ? `background-image:url('${esc(np.image)}')` : ''}"></div>
        <div><b style="font-size:20px">${esc(np.title || 'Intet spiller')}</b><div style="opacity:.8">${esc(np.artist || '')}</div><div class="small" style="opacity:.7">${esc(np.group)}</div></div>
        <div class="ctl"><button data-act="sPrev" aria-label="Forrige">${fillSvg('prev', 18)}</button><button class="pbig" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 22)}</button><button data-act="sNext" aria-label="Næste">${fillSvg('next', 18)}</button></div>
        ${np.volume !== null ? `<label class="vol"><span class="small">Lyd</span><input type="range" min="0" max="100" value="${np.volume}" data-vol aria-label="Lydstyrke"></label>` : ''}
      </section>
      <div style="flex:1;min-width:280px;display:flex;flex-direction:column;gap:14px">
        ${sonosRooms()}
        <section class="card"><div class="lab">Favoritter fra Sonos</div>${S.state.favorites.length ? `<div class="favs">${S.state.favorites.map((f) => `<button class="fav" data-act="sFav" data-id="${esc(f.id)}"><i style="${f.imageUrl ? `background-image:url('${esc(f.imageUrl)}')` : ''}"></i>${esc(f.name)}</button>`).join('')}</div>` : '<div class="muted small">Ingen favoritter endnu.</div>'}
          <div class="note">Apple Music, radio og andre tjenester: tryk ♡ / "Føj til Sonos-favoritter" i Sonos-appen ved en playliste, et album eller en station – så dukker den op her.</div></section>
        ${S.state.playlists.length ? `<section class="card"><div class="lab">Sonos-playlister</div><div class="favs">${S.state.playlists.map((pl) => `<button class="fav" data-act="sPlaylist" data-id="${esc(pl.id)}"><i></i>${esc(pl.name)}</button>`).join('')}</div></section>` : ''}
        ${S.state.error ? `<div class="err">${esc(S.state.error)}</div>` : ''}
      </div></div>`;
}

/* ---------- DR TV ---------- */
function pageTv() {
  return `<div class="ptitle"><h1>DR TV</h1></div>
    <div class="tvgrid">${settings.tv.channels.map((c) => `<a class="tvtile" href="${esc(c.url)}" target="_blank" rel="noopener">${fillSvg('play', 36)}${esc(c.name)}<small>Åbner DRTV</small></a>`).join('')}</div>
    <p class="note">DR tillader ikke, at deres afspiller vises inde i andre sider, så kanalerne åbner i DRTV. På en Android-tablet med Fully Kiosk kan du vælge, at links åbner i DRTV-appen, og komme tilbage til dashboardet med tilbage-knappen. Live-tv på DRTV kræver ikke login. Adresserne kan ændres under Indstillinger.</p>`;
}

/* ---------- Indstillinger ---------- */
const ICO2 = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10'
};
const ico = (n, size = 20) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICO2[n]}"/></svg>`;

function vejrSettings() {
  const s = settings;
  const many = s.places.length > 1;
  const rows = s.places.map((p, i) => {
    const w = D.wx[p.id];
    return `<li class="prow ${i === 0 ? 'is-home' : ''}">
      <span class="pico">${ico(i === 0 ? 'home' : 'pin', 22)}</span>
      <div class="pmain">
        <label class="pname">${ico('edit', 16)}<input type="text" data-place="${i}" value="${esc(p.label || '')}" placeholder="${esc(p.name)}" aria-label="Navn på stedet ${esc(p.name)}" enterkeyhint="done"></label>
        <span class="psub">${i === 0 ? '<b class="hometag">Hjem</b>' : ''}${esc(p.name)}${w ? ` · nu ${fmtTemp(w.now.temp)}` : ''}</span>
      </div>
      <div class="pact">
        ${i > 0 ? `<button class="ibtn" data-act="placeHome" data-i="${i}" aria-label="Gør ${esc(placeLabel(p))} til hjem">${ico('home', 18)}<span>Gør til hjem</span></button>` : ''}
        ${many ? `<button class="ibtn danger" data-act="placeRm" data-i="${i}" aria-label="Fjern ${esc(placeLabel(p))}">${ico('trash', 18)}</button>` : ''}
      </div></li>`;
  }).join('');
  const results = ui.geo ? (ui.geo.length ? `<ul class="glist">${ui.geo.map((g, i) => `<li><button data-act="geoPick" data-i="${i}"><span class="gname"><b>${esc(g.name)}</b><span class="psub">${esc(g.area)}</span></span><span class="gadd">${ico('plus', 18)} Tilføj</span></button></li>`).join('')}</ul>` : '<div class="empty">Ingen steder fundet. Prøv et andet navn.</div>') : '';
  const sources = W.MODELS.map((m) => {
    const on = s.weather.model === m.id;
    return `<button class="srcard" data-act="wModel" data-model="${m.id}" aria-pressed="${on}"><span class="srhead"><b>${esc(m.name)}</b><span class="srcheck">${on ? ico('check', 16) : ''}</span></span><span class="psub">${esc(m.desc)}</span></button>`;
  }).join('');
  return `
    <section class="card wide">
      <div class="sechead"><div><h2>Steder</h2><p class="note">Skift mellem stederne med pilene i vejrkortet. Hjem vises også i toppen af skærmen. Tryk på et navn for at omdøbe det.</p></div></div>
      <ul class="plist">${rows}</ul>
      <div class="addbox">
        <label class="search">${ico('search', 20)}<input type="text" id="geoQ" placeholder="Tilføj sted – søg fx Skagen eller Spodsbjerg" aria-label="Søg efter et sted at tilføje" enterkeyhint="search"></label>
        <button class="btn primary" data-act="geoSearch">Søg</button>
      </div>
      ${results}${ui.geoMsg ? `<div class="err">${esc(ui.geoMsg)}</div>` : ''}
    </section>
    <section class="card wide">
      <div class="sechead"><div><h2>Vejrkilde</h2><p class="note">Gælder for alle steder. Du kan altid sammenligne kilderne på siden Vejret.</p></div></div>
      <div class="srgrid">${sources}</div>
    </section>`;
}

const SET_TABS = [
  { id: 'vejr', label: 'Vejret' }, { id: 'nyheder', label: 'Nyheder' }, { id: 'kalender', label: 'Kalender' }, { id: 'musik', label: 'Musik' },
  { id: 'tv', label: 'DR TV' }, { id: 'udseende', label: 'Udseende' }, { id: 'forbindelse', label: 'Forbindelse' }, { id: 'backup', label: 'Sikkerhedskopi' }
];
function pageIndstillinger() {
  const s = settings;
  const groups = {};
  N.allSources().forEach((src) => { (groups[src.group] = groups[src.group] || []).push(src); });
  const tab = SET_TABS.some((t) => t.id === ui.setTab) ? ui.setTab : 'vejr';
  const needsConn = ['nyheder', 'kalender', 'musik'].includes(tab) && !hasProxy();
  const T = {
    vejr: () => vejrSettings(),
    nyheder: () => `
    <section class="card wide"><b>Nyhedskilder</b><p class="note">Vælg en eller flere. Nyhederne blandes og sorteres efter tid. Kilder markeret "afprøves" er ikke bekræftet endnu.</p>
      <div class="form">${Object.entries(groups).map(([g, list]) => `<div>${list.map((src) => `<label class="check"><input type="checkbox" data-news="${esc(src.id)}" ${s.news.sources.includes(src.id) ? 'checked' : ''}>${esc(src.name)}${src.unverified ? ' <span class="small muted">(afprøves)</span>' : ''}${src.custom ? ` <button class="btn" data-act="customRm" data-id="${esc(src.id)}" aria-label="Fjern ${esc(src.name)}">Fjern</button>` : ''}</label>`).join('')}</div>`).join('')}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="cName" placeholder="Navn, fx Lokalavisen" aria-label="Navn på egen kilde"><input type="url" id="cUrl" placeholder="RSS-adresse" aria-label="RSS-adresse"><button class="btn primary" data-act="customAdd">Tilføj</button></div>
      <label class="check"><input type="checkbox" data-set="news.publicProxyForTest" ${s.news.publicProxyForTest ? 'checked' : ''}>Brug en offentlig test-proxy til nyheder, indtil jeres worker er klar (kun til afprøvning)</label></section>`,
    kalender: () => `
    <section class="card wide"><b>Kalendere</b>
      <p class="note">Indsæt et link for hver kalender (fx én pr. familiemedlem). <b>iPhone/iPad:</b> Kalender → Kalendere → tryk ⓘ ved kalenderen → slå <i>Offentlig kalender</i> til → <i>Del link</i> → Kopiér. <b>Mac:</b> Kalender → højreklik på kalenderen → Del kalender → <i>Offentlig kalender</i> → kopiér adressen. Linket starter med <code>webcal://</code> – det klarer dashboardet. Andre: Google ("Hemmelig adresse i iCal-format") og Outlook (ICS-link) virker også. Behandl linkene som adgangskoder.</p>
      ${s.calendars.map((c, i) => `<div class="calrow"><input type="text" data-cal="${i}" data-field="name" value="${esc(c.name)}" aria-label="Navn"><input type="color" data-cal="${i}" data-field="color" value="${esc(c.color)}" aria-label="Farve"><input type="url" data-cal="${i}" data-field="url" value="${esc(c.url)}" placeholder="https://… .ics" aria-label="iCal-link"><button class="btn" data-act="calRm" data-i="${i}">Fjern</button></div>`).join('')}
      <div><button class="btn primary" data-act="calAdd">+ Tilføj kalender</button></div>
      ${D.cal && D.cal.errors.length ? `<div class="err">${esc(D.cal.errors.map((e) => e.cal + ': ' + e.msg).join(' · '))}</div>` : ''}</section>
    <section class="card wide"><b>Nedtælling</b><label class="f">Begivenhed<input type="text" data-set="countdown.name" value="${esc(s.countdown.name)}"></label><label class="f">Dato<input type="date" data-set="countdown.date" value="${esc(s.countdown.date)}"></label></section>`,
    musik: () => `
    <section class="card wide"><b>Sonos</b><div class="muted">${!hasProxy() ? 'Opsæt forbindelsen først.' : S.state.connected ? 'Forbundet.' : 'Ikke forbundet.'}</div>
      <div class="row">${hasProxy() && !S.state.connected ? '<button class="btn primary" data-act="sConnect">Forbind Sonos</button>' : ''}${S.state.connected ? '<button class="btn line" data-act="sLogout">Afbryd Sonos</button>' : ''}</div></section>`,
    tv: () => `
    <section class="card wide"><b>DR TV-knapper</b>${s.tv.channels.map((c, i) => `<div class="calrow" style="grid-template-columns:1fr 2fr auto"><input type="text" data-tv="${i}" data-field="name" value="${esc(c.name)}" aria-label="Navn"><input type="url" data-tv="${i}" data-field="url" value="${esc(c.url)}" aria-label="Adresse"><button class="btn" data-act="tvRm" data-i="${i}">Fjern</button></div>`).join('')}
      <div><button class="btn" data-act="tvAdd">+ Tilføj knap</button></div></section>`,
    udseende: () => `
    <section class="card wide"><b>Farvetema</b>${themePicker()}
      ${s.theme === 'auto' ? `<div class="form"><label class="f">Om dagen<select data-set="dayTheme">${Object.keys(THEMES).map((k) => `<option value="${k}" ${s.dayTheme === k ? 'selected' : ''}>${THEMES[k].label}</option>`).join('')}</select></label>
        <label class="f">Efter solnedgang<select data-set="nightTheme">${Object.keys(THEMES).map((k) => `<option value="${k}" ${s.nightTheme === k ? 'selected' : ''}>${THEMES[k].label}</option>`).join('')}</select></label></div>` : ''}</section>`,
    forbindelse: () => `
    <section class="card wide"><b>Forbindelse til jeres server</b>
      <p class="note">Nyheder, kalendere og Sonos går gennem en lille gratis Cloudflare Worker, som I selv ejer. Se README.md for opsætning. Vejret virker uden.</p>
      <div class="form"><label class="f">Worker-adresse<input type="url" data-set="proxy.url" value="${esc(s.proxy.url)}" placeholder="https://easyhome.ditnavn.workers.dev" autocomplete="off"></label>
      <label class="f">Nøgle (DASH_KEY)<input type="password" data-set="proxy.key" value="${esc(s.proxy.key)}" autocomplete="off"></label></div>
      <div class="row"><button class="btn primary" data-act="testConn">Test forbindelse</button><span class="small" id="connMsg">${esc(ui.connMsg)}</span></div>
      ${s.proxy.url ? `<div class="empty" style="display:flex;flex-direction:column;gap:6px"><b>Redirect-adresse til Sonos</b><span class="small">Skal stå præcis sådan under Redirect URI i jeres Sonos-integration:</span>
        <code id="redir" style="user-select:all;font-size:15px;word-break:break-all">${esc(s.proxy.url.replace(/\/+$/, '') + '/sonos/callback')}</code>
        <div><button class="btn" data-act="copyRedir">Kopiér adressen</button></div></div>` : ''}</section>`,
    backup: () => `
    <section class="card wide"><b>Sikkerhedskopi</b><p class="note">Kopiér indstillingerne til en anden skærm, eller gem dem. Teksten indeholder jeres nøgle og kalenderlinks – del den ikke.</p>
      <textarea id="cfg" aria-label="Indstillinger som tekst">${esc(JSON.stringify(settings, null, 2))}</textarea>
      <div class="row"><button class="btn" data-act="copyCfg">Kopiér</button><button class="btn primary" data-act="importCfg">Indlæs fra feltet</button></div></section>`
  };
  return `<div class="ptitle"><h1>Indstillinger</h1></div>
  <div class="tabs" role="tablist" aria-label="Indstillinger">${SET_TABS.map((t) => `<button role="tab" class="tab" data-act="setTab" data-tab="${t.id}" aria-selected="${t.id === tab}">${esc(t.label)}</button>`).join('')}</div>
  ${needsConn ? '<div class="empty">Denne del kræver forbindelsen til jeres server. <button class="btn line" data-act="setTab" data-tab="forbindelse">Gå til Forbindelse</button></div>' : ''}
  <div class="form" role="tabpanel">${T[tab]()}</div>`;
}

const PAGE_RENDER = { forside: pageForside, kalender: pageKalender, vejr: pageVejr, nyheder: pageNyheder, musik: pageMusik, tv: pageTv, indstillinger: pageIndstillinger };

function renderMain(keepScroll = true) {
  const m = $('#main'); const y = m.scrollTop;
  m.innerHTML = PAGE_RENDER[ui.page]();
  if (keepScroll) m.scrollTop = y;
}
// Opdater kun hvis brugeren ikke er i gang med at skrive eller trække
function softRender() {
  if (ui.page === 'indstillinger' || drag) return;
  renderMain();
}
function renderAll() { applyTheme(); renderNav(); renderHeader(); renderMain(false); renderFooter(); }

/* ---------- Data ---------- */
async function loadWeather() {
  await Promise.all(settings.places.map(async (p) => {
    try { D.wx[p.id] = await W.getForecast(p.lat, p.lon, settings.weather.model); D.wxErr[p.id] = null; }
    catch (e) { D.wxErr[p.id] = 'Kunne ikke hente vejret: ' + e.message; }
  }));
  D.weather = D.wx[home().id] || null; D.weatherErr = D.wxErr[home().id] || null;
  applyTheme(); renderHeader(); softRender();
}
async function loadCompare() {
  D.compare = await Promise.all(W.MODELS.filter((m) => m.id !== 'best_match').map(async (m) => {
    try { const p = placeById(ui.wPlace); return { id: m.id, name: m.name, d: await W.getForecast(p.lat, p.lon, m.id) }; }
    catch (e) { return { id: m.id, name: m.name, err: e.message }; }
  }));
  softRender();
}
async function loadNews() {
  if (!hasProxy() && !settings.news.publicProxyForTest) { D.news = null; renderFooter(); return; }
  try { D.news = await N.getNews(); } catch (e) { D.news = { items: [], errors: [{ source: 'Nyheder', msg: e.message }] }; }
  renderFooter(); softRender();
}
async function loadCal() {
  try { D.cal = await C.getEvents(); } catch (e) { D.cal = { events: [], errors: [{ cal: 'Kalender', msg: e.message }] }; }
  softRender();
}
async function loadSonos(full = false) {
  if (full || !S.state.checked) await S.status();
  if (S.state.connected) { if (full) S.state.household = null; await S.refresh(); }
  renderFooter();
  if (ui.page === 'musik' || (ui.page === 'forside' && settings.layout.some((x) => x.id === 'sonos'))) softRender();
}
function loadAll() { loadWeather(); loadNews(); loadCal(); loadSonos(true); }

/* ---------- Handlinger ---------- */
const act = {
  nav: (b) => { ui.page = b.dataset.page; ui.editing = false; history.replaceState(null, '', '#' + ui.page); renderNav(); renderMain(false); $('#main').focus({ preventScroll: true }); if (ui.page === 'musik') loadSonos(); },
  toggleNav: () => { settings.navOpen = !settings.navOpen; save(); renderNav(); },
  nextTheme: () => { const i = THEME_ORDER.indexOf(settings.theme); settings.theme = THEME_ORDER[(i + 1) % THEME_ORDER.length]; save(); applyTheme(); renderHeader(); if (ui.editing || ui.page === 'indstillinger') renderMain(); },
  setTheme: (b) => { settings.theme = b.dataset.theme; save(); applyTheme(); renderHeader(); renderMain(); },
  edit: () => { ui.editing = !ui.editing; renderMain(); },
  toggleW: (b) => {
    const id = b.dataset.id; const i = settings.layout.findIndex((x) => x.id === id);
    if (i >= 0) settings.layout.splice(i, 1); else settings.layout.push({ id, size: DEFAULT_SIZE[id] || 'S' });
    save(); renderMain();
  },
  size: (b) => { const x = settings.layout.find((y) => y.id === b.dataset.id); if (x) { x.size = b.dataset.size; save(); renderMain(); } },
  calPrev: () => { ui.calWeek--; renderMain(); }, calNext: () => { ui.calWeek++; renderMain(); }, calToday: () => { ui.calWeek = 0; renderMain(); },
  wModel: (b) => { settings.weather.model = b.dataset.model; save(); D.wx = {}; renderMain(); loadWeather(); },
  compare: () => { D.compare = D.compare || []; renderMain(); loadCompare(); },
  newsToggle: (b) => { toggleNews(b.dataset.id); renderMain(); },
  newsRefresh: () => { N.clearNewsCache(); D.news = null; renderMain(); loadNews(); },
  sPlay: () => sonosDo(S.togglePlay), sNext: () => sonosDo(S.next), sPrev: () => sonosDo(S.prev),
  sFav: (b) => sonosDo(() => S.playFavorite(b.dataset.id)),
  sGroup: (b) => { settings.sonos.groupId = b.dataset.id; save(); loadSonos(); },
  sReload: () => loadSonos(true),
  sMember: (b) => {
    const cg = S.currentGroup(); if (!cg) return;
    const pid = b.dataset.pid; const cur = cg.playerIds || [];
    const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : cur.concat([pid]);
    if (!next.length) return;
    b.disabled = true; sonosDo(() => S.setMembers(next));
  },
  sAll: () => sonosDo(() => S.setMembers(S.state.players.map((p) => p.id))),
  sOnly: () => { const cg = S.currentGroup(); if (cg) sonosDo(() => S.setMembers([cg.coordinatorId])); },
  sPlaylist: (b) => sonosDo(() => S.playPlaylist(b.dataset.id)),
  sConnect: async () => { try { await S.startLogin(); } catch (e) { toast('Kunne ikke starte Sonos-login: ' + e.message); } },
  sLogout: async () => { try { await S.logout(); toast('Sonos afbrudt'); renderAll(); } catch (e) { toast(e.message); } },
  testConn: async () => {
    ui.connMsg = 'Tester …'; const el = $('#connMsg'); if (el) el.textContent = ui.connMsg;
    try { const r = await (await workerFetch('/health')).json(); ui.connMsg = r.ok ? `Forbindelsen virker ✓ (Sonos ${r.sonosConfigured ? 'klar' : 'ikke sat op i workeren'})` : 'Uventet svar'; loadAll(); }
    catch (e) { ui.connMsg = e.message === 'NO_PROXY' ? 'Udfyld adresse og nøgle først' : 'Fejl: ' + e.message + ' – tjek adresse og nøgle'; }
    renderMain();
  },
  geoSearch: async () => {
    const q = ($('#geoQ') || {}).value || ''; if (!q.trim()) return;
    try { ui.geo = await W.geocode(q.trim()); ui.geoMsg = ''; } catch (e) { ui.geoMsg = e.message; }
    renderMain();
  },
  geoPick: (b) => {
    const g = ui.geo[+b.dataset.i];
    if (settings.places.some((p) => Math.abs(p.lat - g.lat) < 0.01 && Math.abs(p.lon - g.lon) < 0.01)) { toast(g.name + ' er allerede tilføjet'); return; }
    settings.places.push({ id: uid(), label: '', name: g.name, lat: g.lat, lon: g.lon }); save(); ui.geo = null; renderMain(); loadWeather(); toast('Tilføjet: ' + g.name + ' – giv det gerne et navn');
  },
  placeHome: (b) => { const i = +b.dataset.i; const [p] = settings.places.splice(i, 1); settings.places.unshift(p); save(); D.compare = null; renderMain(); loadWeather(); toast(placeLabel(p) + ' er nu hjem'); },
  placeRm: (b) => { ui.fpPlace = 0; const [p] = settings.places.splice(+b.dataset.i, 1); delete D.wx[p.id]; if (ui.wPlace === p.id) ui.wPlace = null; save(); renderMain(); loadWeather(); },
  addPlace: () => { ui.setTab = 'vejr'; ui.page = 'indstillinger'; history.replaceState(null, '', '#indstillinger'); renderNav(); renderMain(false); setTimeout(() => { const q = $('#geoQ'); if (q) { q.scrollIntoView({ block: 'center' }); q.focus(); } }, 50); },
  openSet: (b) => { ui.setTab = b.dataset.tab; act.nav({ dataset: { page: 'indstillinger' } }); },
  setTab: (b) => { ui.setTab = b.dataset.tab; ui.geo = null; renderMain(false); },
  wStep: (b) => {
    const n = settings.places.length; const dir = +b.dataset.dir;
    if (b.dataset.scope === 'fp') { ui.fpPlace = (((ui.fpPlace + dir) % n) + n) % n; ui.fpTouched = Date.now(); }
    else { const i = settings.places.indexOf(placeById(ui.wPlace)); ui.wPlace = settings.places[(((i + dir) % n) + n) % n].id; D.compare = null; }
    renderMain();
  },
  wPlace: (b) => { ui.wPlace = b.dataset.id; D.compare = null; if (ui.page !== 'vejr') { ui.page = 'vejr'; history.replaceState(null, '', '#vejr'); renderNav(); } renderMain(false); },
  customAdd: () => {
    const name = $('#cName').value.trim(); const url = $('#cUrl').value.trim();
    if (!name || !/^https?:\/\//.test(url)) { toast('Skriv et navn og en adresse der starter med https://'); return; }
    const id = 'c-' + uid(); settings.news.custom.push({ id, name, url }); settings.news.sources.push(id); save(); N.clearNewsCache(); renderMain(); loadNews();
  },
  customRm: (b) => { settings.news.custom = settings.news.custom.filter((c) => c.id !== b.dataset.id); settings.news.sources = settings.news.sources.filter((x) => x !== b.dataset.id); save(); N.clearNewsCache(); renderMain(); loadNews(); },
  calAdd: () => { const colors = ['#D0563C', '#4C78D0', '#D9A400', '#2E9D5B', '#7A5AC8']; settings.calendars.push({ id: uid(), name: 'Ny kalender', color: colors[settings.calendars.length % colors.length], url: '' }); save(); renderMain(); },
  calRm: (b) => { settings.calendars.splice(+b.dataset.i, 1); save(); C.clearCalCache(); renderMain(); loadCal(); },
  tvAdd: () => { settings.tv.channels.push({ name: 'Ny knap', url: 'https://www.dr.dk/drtv' }); save(); renderMain(); },
  tvRm: (b) => { settings.tv.channels.splice(+b.dataset.i, 1); save(); renderMain(); },
  copyRedir: async () => { try { await navigator.clipboard.writeText($('#redir').textContent); toast('Adressen er kopieret'); } catch (e) { toast('Markér adressen og kopiér med ⌘C'); } },
  copyCfg: async () => { try { await navigator.clipboard.writeText($('#cfg').value); toast('Kopieret'); } catch (e) { $('#cfg').select(); toast('Markeret – kopiér manuelt'); } },
  importCfg: () => { try { replaceSettings(JSON.parse($('#cfg').value)); C.clearCalCache(); N.clearNewsCache(); renderAll(); loadAll(); toast('Indstillinger indlæst'); } catch (e) { toast('Teksten kunne ikke læses: ' + e.message); } }
};
function toggleNews(id) {
  const s = settings.news.sources; const i = s.indexOf(id);
  if (i >= 0) s.splice(i, 1); else s.push(id);
  save(); N.clearNewsCache(); loadNews();
}
async function sonosDo(fn) { try { await fn(); setTimeout(() => loadSonos(), 400); } catch (e) { toast('Sonos: ' + e.message); } }

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b && act[b.dataset.act]) { e.preventDefault(); act[b.dataset.act](b, e); }
});
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; if (e.target.id === 'geoQ') act.geoSearch(); else if (e.target.dataset && e.target.dataset.place !== undefined) e.target.blur(); });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.set) {
    const v = t.type === 'checkbox' ? t.checked : t.value.trim();
    setPath(t.dataset.set, v);
    if (t.dataset.set.startsWith('proxy.')) { S.state.checked = false; }
    if (t.dataset.set === 'weather.model') { D.wx = {}; loadWeather(); }
    if (t.dataset.set === 'news.publicProxyForTest') { N.clearNewsCache(); loadNews(); }
    if (t.dataset.set.startsWith('countdown') || t.dataset.set.endsWith('Theme')) { applyTheme(); renderHeader(); }
  } else if (t.dataset.news) { toggleNews(t.dataset.news); }
  else if (t.dataset.cal !== undefined) { settings.calendars[+t.dataset.cal][t.dataset.field] = t.value.trim(); save(); C.clearCalCache(); loadCal(); }
  else if (t.dataset.place !== undefined) { settings.places[+t.dataset.place].label = t.value.trim(); save(); renderHeader(); }
  else if (t.dataset.tv !== undefined) { settings.tv.channels[+t.dataset.tv][t.dataset.field] = t.value.trim(); save(); }
  else if (t.hasAttribute('data-vol')) { sonosDo(() => S.setVolume(+t.value)); }
  else if (t.dataset.pvol) { sonosDo(() => S.setPlayerVolume(t.dataset.pvol, +t.value)); }
});
window.addEventListener('hashchange', () => { const p = pageFromHash(); if (p !== ui.page) { ui.page = p; renderNav(); renderMain(false); } });

/* ---------- Træk og slip på forsiden (virker med finger og mus) ---------- */
let drag = null;
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.handle'); if (!h || !ui.editing) return;
  const card = h.closest('.w'); if (!card) return;
  e.preventDefault();
  drag = { card, id: card.dataset.wid, last: card.dataset.wid };
  card.classList.add('dragging');
  try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const m = $('#main'); const r = m.getBoundingClientRect();
  if (e.clientY < r.top + 70) m.scrollBy(0, -24); else if (e.clientY > r.bottom - 70) m.scrollBy(0, 24);
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const over = el && el.closest('.w');
  if (!over || over.dataset.wid === drag.last) return;
  drag.last = over.dataset.wid;
  if (over === drag.card) return;
  const grid = $('#grid'); const cards = [...grid.children];
  const from = cards.indexOf(drag.card); const to = cards.indexOf(over);
  grid.insertBefore(drag.card, from < to ? over.nextSibling : over);
});
const endDrag = () => {
  if (!drag) return;
  drag.card.classList.remove('dragging');
  const order = [...$('#grid').children].map((c) => c.dataset.wid);
  settings.layout.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  save(); drag = null;
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- Start ---------- */
function boot() {
  // Engangsoprydning: 'Vejret andre steder' blev sat på forsiden automatisk i 1.1.0 – fjern det igen
  if ((settings.layoutRev || 1) < 2) { settings.layout = settings.layout.filter((x) => x.id !== 'steder'); settings.layoutRev = 2; save(); }
  if (!settings.places.length) { const l = settings.location; settings.places = [{ id: 'hjem', label: 'Hjem', name: l.name, lat: l.lat, lon: l.lon }]; save(); }
  const q = new URLSearchParams(location.search);
  if (q.get('sonos') === 'ok') { toast('Sonos er forbundet ✓'); history.replaceState(null, '', location.pathname + '#musik'); ui.page = 'musik'; }
  if (q.get('sonos') === 'fejl') { toast('Sonos-login mislykkedes – prøv igen'); history.replaceState(null, '', location.pathname + '#musik'); ui.page = 'musik'; }
  renderAll();
  loadAll();
  startUpdater();
  setInterval(() => { const c = $('#clk'); const n = new Date(); if (c) c.textContent = hhmm(n); if (n.getSeconds() === 0) { renderHeader(); applyTheme(); } }, 1000);
  setInterval(() => { ui.tick++; renderFooter(); }, 8000);
  setInterval(loadWeather, 15 * 60000);
  setInterval(() => { if (ui.fpPlace !== 0 && Date.now() - ui.fpTouched > 3 * 60000) { ui.fpPlace = 0; softRender(); } }, 30000);
  setInterval(loadNews, 5 * 60000);
  setInterval(loadCal, 10 * 60000);
  setInterval(() => { if (S.state.connected && !document.hidden) loadSonos(); }, 8000);
  // Opdater dag-visninger ved midnat
  setInterval(() => { const n = new Date(); if (n.getHours() === 0 && n.getMinutes() === 0 && n.getSeconds() < 2) softRender(); }, 1000);
}
boot();
