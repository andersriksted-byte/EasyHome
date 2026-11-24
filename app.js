// easyHome – hovedprogram
import { esc, pad, DAYS, DAYS_LONG, MONTHS, cap, hhmm, startOfDay, addDays, sameDay, longDate, relTime, uid, settings, save, setPath, replaceSettings, hasProxy, workerFetch } from './util.js';
import * as W from './weather.js';
import * as N from './news.js';
import * as C from './calendar.js';
import * as S from './sonos.js';
import { startUpdater } from './updater.js';
import { startSync, syncNow, syncState } from './sync.js';
import * as R from './reader.js';
import * as L from './look.js';
import * as M from './media.js';
import * as A from './login.js';
import * as MD from './madro.js';
import * as MC from './mcats.js';
import * as FB from './football.js';
import * as SF from './somfy.js';
import * as TM from './timer.js';
import { onAuthLost } from './util.js';

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
  L.applyLook();
}
const themeLabel = (id) => (id === 'auto' ? 'Automatisk' : THEMES[id].label);

/* ---------- Ikoner ---------- */
const ICON = {
  sunon: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4', sunoff: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4L12 7.5zM12 3v4.5M15.8 10.3l4.3-1.4M14.3 14.7l2.7 3.7M9.7 14.7 7 18.4M8.2 10.3 3.9 8.9',
  timer: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  blinds: 'M4 4h16M5 4v9M19 4v9M5 13h14M7 7h10M7 10h10M12 13v4M10 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  somfy: 'M4 4h16M5 4v9M19 4v9M5 13h14M7 7h10M7 10h10M12 13v4M10 19a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', stop: 'M8 8h8v8H8z',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5', repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  madro: 'M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2 11h20M9 7c0-1.2 1-1.8 1-3M14 7c0-1.2 1-1.8 1-3',
  cd: 'M12 8v5l3 2M9 2h6M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', store: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
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
  { id: 'forside', label: 'Forside' }, { id: 'kalender', label: 'Kalender' }, { id: 'madro', label: 'Madro' }, { id: 'vejr', label: 'Vejret' },
  { id: 'nyheder', label: 'Nyheder' }, { id: 'musik', label: 'Musik' }, { id: 'somfy', label: 'Screens' }, { id: 'tv', label: 'DR TV' }
];
// Tjenester ("app store"): hver tjeneste kan slås til og fra under Indstillinger → Tjenester.
// Slås en tjeneste fra, skjules dens side, kort, faner og felter. Kortene på forsiden huskes til den slås til igen.
const SERVICES = [
  { id: 'madro', name: 'Madro', icon: 'madro', desc: 'Madplan, indkøbsliste og opskrifter.', pages: ['madro'], widgets: ['madplan', 'dagensret', 'indkob', 'inspiration'], tabs: [] },
  { id: 'somfy', name: 'Somfy', icon: 'blinds', desc: 'Styr screens, markiser og gardiner.', pages: ['somfy'], widgets: ['screens'], tabs: [] },
  { id: 'kalender', name: 'Kalender', icon: 'kalender', desc: 'Familiens aftaler fra iCloud m.fl.', pages: ['kalender'], widgets: ['uge', 'naeste'], tabs: [] },
  { id: 'vejr', name: 'Vejret', icon: 'vejr', desc: 'Prognoser fra DMI og andre kilder for jeres steder.', pages: ['vejr'], widgets: ['vejr', 'steder'], tabs: ['vejr'] },
  { id: 'nyheder', name: 'Nyheder', icon: 'nyheder', desc: 'Overskrifter fra DR, TV 2, JP og egne kilder.', pages: ['nyheder'], widgets: ['nyheder', 'nyhed1'], tabs: ['nyheder'] },
  { id: 'musik', name: 'Musik (Sonos)', icon: 'musik', desc: 'Styr Sonos: afspil, rum og lydstyrke.', pages: ['musik'], widgets: ['sonos'], tabs: [] },
  { id: 'tv', name: 'DR TV', icon: 'tv', desc: 'Genveje til DR\'s kanaler.', pages: ['tv'], widgets: ['tv'], tabs: ['tv'] },
  { id: 'timer', name: 'Timer nedtælling', icon: 'timer', desc: 'Køkkentimer med alarm – fx til madlavning.', pages: [], widgets: ['timer'], tabs: [] },
  { id: 'fodbold', name: 'Fodbold', icon: 'ball', desc: 'Kampe, resultater og stillinger.', pages: [], widgets: ['fodbold', 'stilling'], tabs: ['fodbold'] },
  { id: 'nedtaelling', name: 'Nedtællinger', icon: 'cd', desc: 'Dage til juleaften, ferie og fødselsdage.', pages: [], widgets: ['nedtaelling'], tabs: [] }
];
const svcOn = (id) => !settings.services || settings.services[id] !== false;
const pageOn = (p) => SERVICES.every((x) => !x.pages.includes(p) || svcOn(x.id));
const widgetOn = (w) => SERVICES.every((x) => !x.widgets.includes(w) || svcOn(x.id));
const tabOn = (t) => (t === 'musik' ? svcOn('musik') : t === 'somfy' ? svcOn('somfy') : t === 'kalender' ? svcOn('kalender') || svcOn('nedtaelling') : SERVICES.every((x) => !x.tabs.includes(t) || svcOn(x.id)));
const WIDGETS = { fodbold: 'Fodbold', stilling: 'Fodbold-stilling', naeste: 'Næste i kalenderen', dagensret: 'Dagens ret', nyhed1: 'Én nyhed ad gangen', timer: 'Timer nedtælling', screens: 'Screens (Somfy)', madplan: 'Madplan', indkob: 'Indkøbsliste', inspiration: 'Opskrift-inspiration', uge: 'Familiens uge', vejr: 'Vejret', steder: 'Vejret andre steder', nyheder: 'Nyheder', sonos: 'Musik (Sonos)', tv: 'DR TV', nedtaelling: 'Nedtælling' };
// Forsiden er et gitter af ens kvadrater. Et kort fylder w kvadrater i bredden og h i højden.
const SHAPES = [[1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [1, 3], [1, 4], [2, 2]];
const DEFAULT_SHAPE = { stilling: [1, 2], fodbold: [2, 1], naeste: [1, 1], dagensret: [2, 1], nyhed1: [2, 1], timer: [1, 1], screens: [2, 1], madplan: [4, 1], indkob: [2, 1], inspiration: [2, 1], uge: [4, 1], vejr: [2, 1], steder: [2, 1], nyheder: [2, 1], sonos: [1, 1], tv: [1, 1], nedtaelling: [1, 1] };
const LEGACY = { S: [1, 1], M: [2, 1], L: [4, 1] };
const shapeOf = (x) => (x.w && x.h ? [x.w, x.h] : LEGACY[x.size] || [1, 1]);
const FIT = ['uge']; // kort der aldrig må skære indhold af – de bliver kompakte og vokser i højden ved behov
const sizeKey = (w) => (w >= 4 ? 'L' : w >= 2 ? 'M' : 'S');
const shapeIcon = (w, h) => `<svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26"><rect x="1" y="1" width="24" height="24" rx="3" fill="none" stroke="currentColor" stroke-opacity=".3"/><rect x="2" y="2" width="${w * 5.5}" height="${h * 5.5}" rx="1.5" fill="currentColor"/></svg>`;

/* ---------- Tilstand ---------- */
const D = { weather: null, weatherErr: null, wx: {}, wxErr: {}, compare: null, news: null, cal: null };
// Steder: det første sted er 'hjem' og bruges i header og tema
const home = () => settings.places[0];
const placeLabel = (p) => p.label || p.name;
const placeById = (id) => settings.places.find((p) => p.id === id) || home();
const ui = { n1Idx: 0, n1At: Date.now(), sfMsg: '', inspIdx: 0, inspAt: Date.now(), calEdit: null, famMsg: null, cdIdx: 0, cdAt: Date.now(), cdMsg: null, bgMsg: null, sizeFor: null, newsIdx: 0, newsAt: Date.now(), feedMsg: null, feedDraft: null, page: pageFromHash(), setTab: 'familie', wPlace: null, fpPlace: 0, fpTouched: 0, editing: false, calWeek: 0, geo: null, geoMsg: '', tick: 0, connMsg: '' };
function pageFromHash() { const h = location.hash.slice(1); return [...PAGES.map((p) => p.id), 'indstillinger'].includes(h) && (h === 'indstillinger' || pageOn(h)) ? h : 'forside'; }

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- Hjælpere ---------- */
function lighten(hex, amt = 0.72) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#E7E2DA';
  const n = parseInt(m[1], 16); const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amt));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
const evStyle = (e) => `background:${lighten(e.color)};border-left-color:${esc(e.color || '#888')}`;
// Forsiden pr. person: har den valgte person sin egen forside, vises den – ellers familiens
const curLayout = () => { const own = settings.me && settings.layouts && settings.layouts[settings.me]; return own || settings.layout; };
// Tilpasses forsiden, mens en person er valgt, får personen sin egen forside (kopi af familiens første gang)
// Kortstørrelse (Store/Mellem/Små) pr. profil – og pr. skærm, da iPad og Mac er forskellige
const gcols = () => (settings.gridColsBy || {})[settings.me || ''] || settings.gridCols || 4;
function editLayout() {
  if (!settings.me || !members().some((m) => m.id === settings.me)) return settings.layout;
  settings.layouts = settings.layouts || {};
  if (!settings.layouts[settings.me]) settings.layouts[settings.me] = JSON.parse(JSON.stringify(settings.layout));
  return settings.layouts[settings.me];
}
// Valgt profil: vis kun personens egne kalendere + fælles kalendere (uden ejer)
const members = () => (settings.family && settings.family.members) || [];
const meMember = () => members().find((m) => m.id === settings.me) || null;
function mineEvent(ev) {
  const me = meMember(); if (!me) return true;
  const cal = settings.calendars.find((c) => c.id === ev.cal);
  return !cal || !cal.owner || cal.owner === me.id;
}
const initials = (n) => String(n || '?').trim().slice(0, 1).toUpperCase();
function eventsOn(day, page = false) {
  if (!D.cal) return [];
  const s = startOfDay(day); const e = addDays(s, 1); const hid = page ? settings.calHidden || [] : [];
  return D.cal.events.filter((ev) => ev.start < e && ev.end > s && mineEvent(ev) && !hid.includes(ev.cal));
}
const evTime = (ev, day) => (ev.allDay ? 'Hele dagen' : (ev.start < startOfDay(day) ? 'Fortsat' : hhmm(ev.start)));
// Dagens menu fra Madro nederst i hver dag i kalenderen
function dayMenu(d) {
  if (!svcOn('madro') || MD.state.status !== 'ok') return '';
  const ms = MD.mealsOn(d); if (!ms.length) return '';
  return `<button class="daymenu" data-act="mdOpen" data-sub="madplan" title="${esc(ms.map((m) => m.title).join(', '))}"><span aria-hidden="true">🍽️</span><span>${esc(ms.map((m) => m.title).join(' · '))}</span></button>`;
}
function evHtml(ev, day, withWho = true) {
  return `<div class="ev" style="${evStyle(ev)}"><time>${esc(evTime(ev, day))}</time>${esc(ev.title)}${withWho && ev.who ? ` <span style="font-weight:600">· ${esc(ev.who)}</span>` : ''}</div>`;
}
function weekStart(offset = 0) { const t = startOfDay(new Date()); const dow = (t.getDay() + 6) % 7; return addDays(t, -dow + offset * 7); }
const cdDays = (c) => { const t = new Date((c.date || '') + 'T00:00'); return isNaN(t) ? null : Math.round((startOfDay(t) - startOfDay(new Date())) / 86400000); };
// Nedtællinger sorteret: kommende først (nærmeste øverst), overståede til sidst
function countdowns(where = 'card') {
  const list = (settings.countdowns || []).filter((c) => (c.name || c.date) && (where === 'card' ? c.showCard !== false : where === 'top' ? c.showTop !== false : true)).map((c) => ({ ...c, days: cdDays(c) })).filter((c) => c.days !== null);
  return list.filter((c) => c.days >= 0).sort((a, b) => a.days - b.days).concat(list.filter((c) => c.days < 0).sort((a, b) => b.days - a.days));
}

const fmtTemp = (t) => (t === null || t === undefined ? '–' : `${Math.round(t)}°`);
const num = (v, d = 1) => (v === null || v === undefined ? '–' : v.toFixed(d).replace('.', ','));
const needProxyMsg = (what) => `<div class="empty">${esc(what)} kræver forbindelsen til jeres lille server (Cloudflare Worker). <button class="btn line" data-act="openSet" data-tab="forbindelse">Opsæt i Indstillinger</button></div>`;

/* ---------- Navigation ---------- */
function renderNav() {
  const nav = $('#nav');
  nav.classList.toggle('open', settings.navOpen);
  let shade = document.getElementById('navShade');
  if (!shade) { shade = document.createElement('div'); shade.id = 'navShade'; shade.className = 'navshade'; shade.dataset.act = 'toggleNav'; document.body.appendChild(shade); }
  shade.classList.toggle('show', settings.navOpen);
  const item = (p) => `<button data-act="nav" data-page="${p.id}" aria-label="${esc(p.label)}" ${ui.page === p.id ? 'aria-current="page"' : ''}>${svg(p.id)}<span class="lbl">${esc(p.label)}</span></button>`;
  nav.innerHTML = `<button class="toggle" data-act="toggleNav" aria-expanded="${settings.navOpen}" aria-label="${settings.navOpen ? 'Luk menu' : 'Åbn menu'}">${svg(settings.navOpen ? 'back' : 'menu', 22)}<span class="lbl">Luk menu</span></button>
    ${PAGES.filter((p) => pageOn(p.id)).map(item).join('')}<div class="sp"></div>
    <button class="awake" data-act="awake" aria-pressed="${!!settings.keepAwake}" aria-label="${settings.keepAwake ? 'Skærmen holdes tændt – tryk for at slå fra' : 'Hold skærmen tændt'}">${svg(settings.keepAwake ? 'sunon' : 'sunoff')}<span class="lbl">${settings.keepAwake ? 'Skærmen er altid tændt' : 'Hold skærmen tændt'}</span></button>
    ${item({ id: 'indstillinger', label: 'Indstillinger' })}`;
}

/* ---------- Hold skærmen tændt (Wake Lock) ---------- */
let wakeLock = null;
async function applyWakeLock() {
  try {
    if (settings.keepAwake && !document.hidden) {
      if (!('wakeLock' in navigator)) { toast('Denne skærm kan ikke holdes tændt fra appen – slå automatisk lås fra i enhedens indstillinger'); return; }
      if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    } else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
// Låsen slipper, når appen skjules – tag den igen, når den kommer frem
document.addEventListener('visibilitychange', applyWakeLock);

/* ---------- Header ---------- */
// Vejret i toppen: sted, nu, og hvordan det udvikler sig de næste timer
function wxTrend(w) {
  const now = Date.now();
  const next = w.hours.filter((h) => h.time.getTime() > now).slice(0, 6);
  if (!next.length) return null;
  const in3 = next[Math.min(2, next.length - 1)];
  const d = in3.temp - w.now.temp;
  const arrow = d >= 1 ? '↗' : d <= -1 ? '↘' : '→';
  const wet = (h) => h.rain >= 0.2 || [51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 85, 86, 95, 96, 99].includes(h.code);
  const nowWet = w.now.rain > 0 || wet(next[0]);
  let msg = '';
  if (!nowWet) { const r = next.find(wet); if (r) msg = (r.code >= 71 && r.code <= 86 && r.code !== 80 && r.code !== 81 && r.code !== 82 ? 'sne' : 'regn') + ' fra kl. ' + pad(r.time.getHours()); }
  else { const dry = next.find((h) => !wet(h)); msg = dry ? 'tørt fra kl. ' + pad(dry.time.getHours()) : 'regn de næste timer'; }
  if (!msg) { const c = next.find((h) => W.codeText(h.code) !== W.codeText(w.now.code)); if (c) msg = W.codeText(c.code).toLowerCase() + ' fra kl. ' + pad(c.time.getHours()); }
  return { arrow, temp: in3.temp, at: in3.time, msg };
}
function wxChip(w) {
  const t = wxTrend(w);
  return `<button class="chip wxchip" data-act="nav" data-page="vejr" aria-label="Vejret">${W.weatherIcon(w.now.code, w.now.isDay, 24)}<span class="wxc-place">${esc(placeLabel(home()))}</span><b>${fmtTemp(w.now.temp)}</b>${t ? `<span class="wxc-trend" title="Om 3 timer">${t.arrow} ${fmtTemp(t.temp)}</span>${t.msg ? `<span class="wxc-msg">· ${esc(t.msg)}</span>` : ''}` : `<span class="wxc-msg">· ${esc(W.codeText(w.now.code).toLowerCase())}</span>`}</button>`;
}

function renderHeader() {
  const now = new Date();
  const w = D.weather;
  const next = svcOn('nedtaelling') && settings.cdTop ? countdowns('all').find((c) => c.id === settings.cdTop && c.days >= 0) : null;
  $('#hdr').innerHTML = `
    <div class="clock"><b id="clk">${hhmm(now)}</b><span>${esc(longDate(now))}</span></div>
    ${w && svcOn('vejr') ? wxChip(w) : ''}
    ${next ? `<span class="chip accent">${next.days === 0 ? `I dag: ${esc(next.name)}` : `${next.days} ${next.days === 1 ? 'dag' : 'dage'} til ${esc(next.name.toLowerCase())}`}</span>` : ''}
    <div class="right">${svcOn('timer') && TM.timers().some((t) => !t.done && !t.paused) ? `<button class="chip tmchip" id="tmChip" data-act="nav" data-page="forside" aria-label="Timer">${svg('timer', 18)}<b>${TM.fmt(Math.min(...TM.timers().filter((t) => !t.done && !t.paused).map(TM.left)))}</b></button>` : ''}${ui.page === 'forside' ? `<button class="hdredit ${ui.editing ? 'on' : ''}" data-act="edit" aria-pressed="${ui.editing}" aria-label="${ui.editing ? 'Færdig med at tilpasse forsiden' : 'Tilpas forside'}" title="${ui.editing ? 'Færdig' : 'Tilpas forside'}">${ui.editing ? ico('check', 20) : ico('edit', 20)}</button>` : ''}${members().length ? `<div class="profiles${settings.me ? ' picked' : ''}" role="group" aria-label="Hvem bruger skærmen?">${members().map((m) => `<button class="avatar" data-act="pickMe" data-id="${esc(m.id)}" aria-pressed="${settings.me === m.id}" aria-label="${esc(m.name)}${settings.me === m.id ? ' (valgt – tryk for alle)' : ''}" style="--c:${esc(m.color)}">${esc(initials(m.name))}</button>`).join('')}</div>` : ''}</div>`;
}

/* ---------- Footer ---------- */
function renderFooter() {
  const np = S.nowPlaying();
  const items = D.news && D.news.items.length ? D.news.items.slice(0, 10) : [];
  const top = items.length ? items[ui.tick % items.length] : null;
  let music;
  if (S.state.connected) {
    music = `<span class="fctl"><button class="fbtn" data-act="sPrev" aria-label="Forrige nummer">${fillSvg('prev', 14)}</button><button class="pp" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 18)}</button><button class="fbtn" data-act="sNext" aria-label="Næste nummer">${fillSvg('next', 14)}</button></span>
      ${np.image ? `<span class="npart" style="background-image:url('${esc(np.image)}')" aria-hidden="true"></span>` : ''}<button class="np" data-act="nav" data-page="musik" aria-label="Gå til Musik"><b>${esc(np.title || 'Intet spiller')}</b><span>${esc(np.artist || 'Sonos')} · ${esc(np.group || '')}</span></button>
      ${np.volume !== null ? `<span class="fvol"><button class="fbtn" data-act="sVol" data-d="-5" aria-label="Skru ned">−</button><b aria-live="polite" aria-label="Lydstyrke">${np.volume}</b><button class="fbtn" data-act="sVol" data-d="5" aria-label="Skru op">+</button></span>` : ''}`;
  } else {
    music = `<button class="pp" data-act="nav" data-page="musik" aria-label="Musik">${svg('musik', 20)}</button><button class="np" data-act="nav" data-page="musik" aria-label="Gå til Musik"><b>Sonos</b><span>Ikke forbundet endnu</span></button>`;
  }
  if (!svcOn('musik')) music = '';
  const showNews = svcOn('nyheder');
  $('#ftr').hidden = !music && !showNews;
  $('#ftr').innerHTML = `${music}${music && showNews ? '<div class="sep"></div>' : ''}
    ${!showNews ? '' : top ? `<a class="ticker" href="${esc(top.link)}" data-read="${esc(top.source)}" target="_blank" rel="noopener"><b>${esc(top.source)}</b><span>${esc(top.title)}</span></a>`
      : `<button class="ticker" style="border:0;background:none;text-align:left" data-act="nav" data-page="nyheder"><b>Nyheder</b><span>${hasProxy() || settings.news.publicProxyForTest ? 'Henter …' : 'Vælg kilder og opsæt forbindelse'}</span></button>`}`;
}

/* ---------- Forside-widgets ---------- */
// Fælles overskrift for alle kort: altid én linje i samme højde. For lang tekst forkortes med …
const cardHead = (title, right = '') => `<div class="whead"><span class="lab" title="${esc(title)}">${esc(title)}</span>${right}</div>`;
// Kalenderkortet: et antal dage frem fra i dag. Antallet vælges under Tilpas forside (ellers efter kortets størrelse).
function wUge(size, h = 1, w = 1, x = null) {
  const today = startOfDay(new Date());
  const demo = D.cal && D.cal.demo ? '<span class="small muted">Eksempel</span>' : '';
  if (!D.cal) return cardHead('Kalender') + '<div class="empty">Henter kalender …</div>';
  const auto = w === 1 ? (h >= 2 ? h * 2 : 2) : Math.min(7, w * 2 - (w >= 3 ? 1 : 0));
  const n = Math.max(1, Math.min(7, +(x && x.days) || auto));
  
  const tag = (d) => (sameDay(d, today) ? 'I dag' : sameDay(d, addDays(today, 1)) ? 'I morgen' : cap(DAYS[d.getDay()]));
  const evRow = (e, d) => e.allDay ? `<div class="cw-ad" ${evRef(e)} style="--c:${esc(e.color || '#888')};--l:${lighten(e.color)}">${esc(e.title)}</div>`
    : `<div class="cw-ev" ${evRef(e)} style="--c:${esc(e.color || '#888')};--l:${lighten(e.color)}"><time>${esc(evTime(e, d))}</time><span>${esc(e.title)}</span></div>`;
  const sorted = (d) => { const now = Date.now(); const l = eventsOn(d).filter((e) => e.allDay || e.end.getTime() > now); /* overståede aftaler forsvinder */ return l.filter((e) => e.allDay).concat(l.filter((e) => !e.allDay)); };
  const list = (d) => { const l = sorted(d); return l.length ? l.map((e) => evRow(e, d)).join('') : '<span class="cw-none">Ingen aftaler</span>'; };
  // Når dagens sidste aftale er overstået, starter kortet med i morgen
  const start = sorted(today).length ? today : addDays(today, 1);
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const title = n === 1 ? (start === today ? 'I dag' : 'I morgen') : n === 2 && start === today ? 'I dag og i morgen' : 'Næste ' + n + ' dage';
  const cols = w >= 2 && n > 1 ? Math.min(n, w * 2) : 1;
  if (cols === 1) {
    return `${cardHead(title, demo)}<div class="cw-list">${days.map((d) => `<div class="cw-row${sameDay(d, today) ? ' today' : ''}"><div class="cw-date"><b>${d.getDate()}</b><span>${esc(tag(d))}</span></div><div class="cw-evs">${list(d)}</div></div>`).join('')}</div>`;
  }
  return `${cardHead(title, demo)}<div class="cw-cols days" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${days.map((d) => `<div class="cw-day${sameDay(d, today) ? ' today' : ''}"><div class="cw-dh"><span>${esc(tag(d))}</span><b>${d.getDate()}.</b></div><div class="cw-evs">${list(d)}</div></div>`).join('')}</div>`;
}
const i0 = (d, today) => (sameDay(d, today) ? 'I dag' : sameDay(d, addDays(today, 1)) ? 'I morgen' : cap(DAYS_LONG[d.getDay()]) + ' ' + d.getDate() + '.');
function pageArrows(scope, idx, n, what) {
  if (n < 2) return '';
  return `<span class="parrows"><button class="arr" data-act="wStep" data-scope="${scope}" data-dir="-1" aria-label="Forrige ${what}">‹</button>
    <span class="dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</span>
    <button class="arr" data-act="wStep" data-scope="${scope}" data-dir="1" aria-label="Næste ${what}">›</button></span>`;
}
const placeArrows = (scope, idx) => pageArrows(scope, idx, settings.places.length, 'sted');
// Kortets form: lille (1×1), bred (≥2×1), høj (1×≥2) eller stor (≥2×≥2)
const shapeKind = (w, h) => (w >= 2 && h >= 2 ? 'big' : w >= 2 ? 'wide' : h >= 2 ? 'tall' : 'tiny');
function wVejr(size, h = 1, wd = 1) {
  const n = settings.places.length;
  const idx = ((ui.fpPlace % n) + n) % n;
  const place = settings.places[idx];
  const w = D.wx[place.id];
  const title = cardHead((wd > 1 ? 'Vejret · ' : '') + placeLabel(place), placeArrows('fp', idx));
  if (!w) return `${title}<div class="empty">${D.wxErr[place.id] ? esc(D.wxErr[place.id]) : 'Henter vejret …'}</div>`;
  const kind = shapeKind(wd, h);
  const t = w.days[0];
  const now = `<div class="wxnow">${W.weatherIcon(w.now.code, w.now.isDay, 64)}<div><div class="t">${fmtTemp(w.now.temp)}</div><div class="wxtxt">${esc(W.codeText(w.now.code))}</div></div></div>
    <div class="wxsum"><span>↑ ${fmtTemp(t.max)}</span><span>↓ ${fmtTemp(t.min)}</span><span>${num(w.now.wind, 0)} m/s</span>${t.rain > 0 ? `<span class="rn">${num(t.rain)} mm</span>` : ''}</div>`;
  const hourTile = (x) => `<div class="hour"><span>${(+settings.weather.step || 60) < 60 ? hhmm(x.time) : pad(x.time.getHours())}</span>${W.weatherIcon(x.code, x.isDay, 26)}<b>${fmtTemp(x.temp)}</b><span class="r">${x.rain > 0 ? num(x.rain) + ' mm' : '&nbsp;'}</span></div>`;
  const dayRow = (d, i) => `<div class="wxday"><b>${i === 0 ? 'I dag' : cap(DAYS[d.date.getDay()])}</b>${W.weatherIcon(d.code, 1, 26)}<span class="mm">${d.rain > 0 ? num(d.rain) + ' mm' : ''}</span><span class="hl">${fmtTemp(d.min)} / <b>${fmtTemp(d.max)}</b></span></div>`;
  const hoursN = Math.min(12, { tiny: 3, tall: 4, wide: wd === 2 ? 6 : wd * 3, big: 6 }[kind]);
  const hcols = kind === 'wide' && wd === 2 ? 3 : kind === 'big' ? 3 : hoursN;
  const hours = `<div class="wxhours" style="--n:${hcols}">${wxSteps(w, hoursN).map(hourTile).join('')}</div>`;
  const days = `<div class="wxdays" data-trim>${w.days.map(dayRow).join('')}</div>`;
  const body = {
    tiny: `<div class="wx wx-tiny">${now}${hours}</div>`,
    wide: `<div class="wx wx-wide" style="grid-template-columns:minmax(0,1fr) minmax(0,${wd - 1}fr)"><div class="wxl">${now}</div><div class="wxr">${hours}${wd >= 3 ? `<div class="wxdrow">${w.days.slice(1, 1 + wd + 1).map((d) => `<div class="hour"><span>${cap(DAYS[d.date.getDay()])}</span>${W.weatherIcon(d.code, 1, 26)}<b>${fmtTemp(d.max)}</b><span class="r">${fmtTemp(d.min)}</span></div>`).join('')}</div>` : ''}</div></div>`,
    tall: `<div class="wx wx-tall">${now}${hours}${days}</div>`,
    big: `<div class="wx wx-big"><div class="wxl">${now}${hours}</div><div class="wxr">${days}</div></div>`
  }[kind];
  return title + body;
}
function wSteder(size) {
  const others = settings.places.slice(1);
  if (!others.length) return `${cardHead('Vejret andre steder')}<div class="empty">Steder tilføjes under Indstillinger → Vejret.</div>`;
  const row = (p) => {
    const w = D.wx[p.id];
    if (!w) return `<div class="row"><b>${esc(placeLabel(p))}</b><span class="small muted">${D.wxErr[p.id] ? esc(D.wxErr[p.id]) : 'Henter …'}</span></div>`;
    const days = size === 'L' ? `<div class="row" style="gap:6px">${w.days.slice(1, 4).map((d) => `<div class="hour" style="flex:1"><span>${cap(DAYS[d.date.getDay()])}</span>${W.weatherIcon(d.code, 1, 22)}<span>${fmtTemp(d.max)}/${fmtTemp(d.min)}</span></div>`).join('')}</div>` : '';
    return `<button data-act="wPlace" data-id="${esc(p.id)}" style="border:0;background:var(--bg);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;text-align:left;color:var(--text)">
      <span class="row" style="flex-wrap:nowrap;width:100%">${W.weatherIcon(w.now.code, w.now.isDay, size === 'S' ? 30 : 38)}<span style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(placeLabel(p))}</b><span class="small muted">${esc(W.codeText(w.now.code))}</span></span>
      <span style="text-align:right"><b style="font-size:22px">${fmtTemp(w.now.temp)}</b><span class="small muted" style="display:block;white-space:nowrap">${fmtTemp(w.days[0].max)} / ${fmtTemp(w.days[0].min)}${w.days[0].rain > 0 ? ' · ' + num(w.days[0].rain) + ' mm' : ''}</span></span></span>${days}</button>`;
  };
  const cols = size === 'S' ? 1 : Math.min(others.length, size === 'M' ? 2 : 4);
  return `${cardHead('Vejret andre steder')}<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:8px">${others.map(row).join('')}</div>`;
}
function newsList(n, big = false) {
  if (!hasProxy() && !settings.news.publicProxyForTest) return needProxyMsg('Nyheder');
  if (!D.news) return '<div class="empty">Henter nyheder …</div>';
  const items = D.news.items.slice(0, n);
  if (!items.length) return `<div class="empty">Ingen nyheder lige nu.${D.news.errors.length ? ' ' + esc(D.news.errors.map((e) => e.source + ': ' + e.msg).join(' · ')) : ''}</div>`;
  return `<div class="news ${big ? 'big-news' : ''}">${items.map((i) => `<a href="${esc(i.link)}" data-read="${esc(i.source)}" target="_blank" rel="noopener"><span class="meta"><span class="src">${esc(i.source)}</span>${i.date ? ' · ' + esc(relTime(i.date)) : ''}</span><b>${esc(i.title)}</b>${big && i.summary ? `<p>${esc(i.summary)}</p>` : ''}</a>`).join('')}</div>`;
}
const newsSecs = () => (settings.news.rotateSecs === undefined ? 20 : +settings.news.rotateSecs);
const newsLeft = () => Math.max(0, Math.ceil(newsSecs() - (Date.now() - ui.newsAt) / 1000));
// Nyheder fra alle valgte medier på skift (DR, TV 2, JP, DR …), så intet medie fylder det hele
function mixedNews() {
  const all = D.news ? D.news.items : []; const by = {};
  all.forEach((i) => { (by[i.sourceId] = by[i.sourceId] || []).push(i); });
  const ls = Object.values(by); const out = [];
  for (let r = 0; r < 40; r++) { let any = false; ls.forEach((l) => { if (l[r]) { out.push(l[r]); any = true; } }); if (!any) break; }
  return out;
}
// Én nyhed ad gangen – skifter selv og blander alle medier
function wNyhed1(size, h = 1, wd = 1) {
  if (!hasProxy() && !settings.news.publicProxyForTest) return cardHead('Nyheder') + needProxyMsg('Nyheder');
  const list = mixedNews();
  if (!list.length) return cardHead('Nyheder') + `<div class="empty">${D.news ? 'Ingen nyheder lige nu.' : 'Henter nyheder …'}</div>`;
  const n = list.length; const idx = ((ui.n1Idx % n) + n) % n; const it = list[idx];
  const secs = newsSecs() || 20;
  return `<a class="n1 ${it.image ? 'has-img' : ''}" href="${esc(it.link)}" data-read="${esc(it.source)}" target="_blank" rel="noopener" ${it.image ? `style="background-image:url('${esc(it.image)}')"` : ''}>
    <span class="n1-in"><span class="n1-top"><span class="n1-src">${esc(it.source)}</span><span class="parrows" data-noread><button class="arr" data-act="wStep" data-scope="n1" data-dir="-1" aria-label="Forrige nyhed">‹</button><button class="arr" data-act="wStep" data-scope="n1" data-dir="1" aria-label="Næste nyhed">›</button></span></span>
    <i class="n1-bar"><i id="n1Bar" style="width:${Math.max(0, 100 - ((Date.now() - ui.n1At) / (secs * 10)))}%"></i></i>
    <span class="n1-txt">${it.date ? `<span class="meta">${esc(relTime(it.date))}</span>` : ''}<b>${esc(it.title)}</b></span></span></a>`;
}
function newsSources() { return N.allSources().filter((src) => settings.news.sources.includes(src.id)); }
function wNyheder(size, h = 1, wd = 1) {
  const srcs = newsSources();
  if (!hasProxy() && !settings.news.publicProxyForTest) return `${cardHead('Nyheder')}${needProxyMsg('Nyheder')}`;
  if (!srcs.length) return cardHead('Nyheder') + '<div class="empty">Vælg nyhedskilder under Indstillinger → Nyheder.</div>';
  const n = srcs.length; const idx = ((ui.newsIdx % n) + n) % n; const src = srcs[idx];
  const left = n > 1 ? newsLeft() : 0;
  const head = `${cardHead(src.name, pageArrows('news', idx, n, 'nyhedskilde'))}
    ${n > 1 && newsSecs() > 0 ? `<div class="nbar" aria-hidden="true"><i id="newsBar" style="width:${(left / newsSecs()) * 100}%"></i></div>` : ''}`;
  if (!D.news) return head + '<div class="empty">Henter nyheder …</div>';
  const all = D.news.items.filter((i) => i.sourceId === src.id).slice(0, 30);
  const err = D.news.errors.find((e) => e.source === src.name);
  if (!all.length) return head + `<div class="empty">${err ? 'Kunne ikke hente lige nu: ' + esc(err.msg) : 'Ingen nyheder lige nu.'}</div>`;
  const kind = shapeKind(wd, h);
  const heroItem = kind !== 'tiny' ? all.find((i) => i.image) : null;
  const rest = heroItem ? all.filter((i) => i !== heroItem) : all;
  const link = (i, cls = '') => `<a class="${cls}" href="${esc(i.link)}" data-read="${esc(src.name)}" target="_blank" rel="noopener"><span class="meta">${i.date ? esc(relTime(i.date)) : ''}</span><b>${esc(i.title)}</b></a>`;
  const hero = heroItem ? `<a class="nhero" href="${esc(heroItem.link)}" data-read="${esc(src.name)}" target="_blank" rel="noopener"><span class="nimg" style="background-image:url('${esc(heroItem.image)}')"></span><span class="ntxt"><span class="meta">${heroItem.date ? esc(relTime(heroItem.date)) : ''}</span><b>${esc(heroItem.title)}</b></span></a>` : '';
  const cols = kind === 'big' || (kind === 'wide' && wd >= 3) ? 2 : 1;
  const list = `<div class="news nlist" data-trim style="--ncols:${heroItem && kind === 'wide' ? 1 : cols}">${rest.map((i) => link(i)).join('')}</div>`;
  return head + `<div class="nbody nb-${kind}${heroItem ? ' has-hero' : ''}">${hero}${list}</div>`;
}
function wSonos(size, h = 1, wd = 1) {
  if (!S.state.connected) return `${cardHead('Musik')}<div class="empty">Sonos er ikke forbundet endnu.</div><button class="btn line" data-act="nav" data-page="musik">Gå til Musik</button>`;
  const np = S.nowPlaying();
  const kind = shapeKind(wd, h);
  const art = np.image ? `background-image:url('${esc(np.image)}')` : '';
  const ctl = `<div class="mwctl"><button class="mwb" data-act="sPrev" aria-label="Forrige">${fillSvg('prev', 16)}</button><button class="mwb main" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 20)}</button><button class="mwb" data-act="sNext" aria-label="Næste">${fillSvg('next', 16)}</button></div>`;
  const vol = np.volume !== null ? `<label class="vol mwvol"><span class="small">Lyd</span><input type="range" min="0" max="100" value="${np.volume}" data-vol aria-label="Lydstyrke"></label>` : '';
  const info = `<div class="mwinfo"><span class="mwgrp">${esc(np.group)}</span><b>${esc(np.title || 'Intet spiller')}</b><span>${esc(np.artist || '')}</span></div>`;
  const favs = S.favorites().length ? `<div class="mwfavs" data-trim>${S.favorites().map((f) => `<button class="mtile${f.id === S.playingFavId() ? ' playing' : ''}" data-act="sFav" data-id="${esc(f.id)}"><i style="${S.art(f) ? `background-image:url('${esc(S.art(f))}')` : ''}"></i><span>${esc(f.name)}</span></button>`).join('')}</div>` : '';
  if (kind === 'tiny') return `<div class="mw mw-tiny" style="${art}"><div class="mwshade">${info}${ctl}</div></div>`;
  if (kind === 'wide') return `<div class="mw mw-wide" style="grid-template-columns:auto minmax(0,1fr)${wd >= 3 ? ` minmax(0,${wd - 2}fr)` : ''}"><div class="mwart" style="${art}"></div><div class="mwside">${info}${ctl}${vol}</div>${wd >= 3 ? `<div class="mwfavcol">${favs}</div>` : ''}</div>`;
  if (kind === 'tall') return `<div class="mw mw-tall"><div class="mwart" style="${art}"></div>${info}${ctl}${vol}${favs}</div>`;
  return `<div class="mw mw-big"><div class="mwtop"><div class="mwart" style="${art}"></div><div class="mwside">${info}${ctl}${vol}</div></div>${favs}</div>`;
}
function wTv(size, h = 1, wd = 1) {
  const ch = settings.tv.channels;
  const cols = Math.max(1, Math.min(ch.length, h >= 2 ? wd : wd * 2)); const rows = Math.max(1, Math.min(Math.ceil(ch.length / cols), h * 2));
  return `${cardHead('DR TV')}<div class="tvw" style="--c:${cols};--r:${rows}">${ch.slice(0, cols * rows).map((c) => `<a class="tvtile" href="${esc(c.url)}" target="_blank" rel="noopener">${fillSvg('play', 28)}<span class="tvname">${esc(c.name)}</span></a>`).join('')}</div>`;
}
/* ---------- Madro: madplan og indkøbsliste ---------- */
function madroStatus(title) {
  const st = MD.state;
  if (st.status === 'ok') return '';
  const msg = st.status === 'nologin' ? 'Log ind i Madro for at se den her.' : st.status === 'nofamily' ? 'Opret eller vælg familie i Madro.' : st.status === 'error' ? 'Kunne ikke hente fra Madro.' : 'Henter fra Madro …';
  return `${cardHead(title)}<button class="empty mdmsg" data-act="mdOpen" data-sub="">${esc(msg)}${['nologin', 'nofamily'].includes(st.status) ? ' <b>Åbn Madro ›</b>' : ''}</button>`;
}
function wMadplan(size, h = 1, wd = 1, x = {}) {
  const wait = madroStatus('Madplan'); if (wait) return wait;
  const kind = shapeKind(wd, h);
  const n = x.days === 1 ? 1 : 5;
  const today = startOfDay(new Date());
  const days = Array.from({ length: n }, (_, i) => addDays(today, i));
  const dayLabel = (d, i) => (i === 0 ? 'I dag' : i === 1 ? 'I morgen' : cap(DAYS[d.getDay()]) + ' ' + d.getDate() + '.');
  const bg = (m) => (m.image ? `style="background-image:url('${esc(m.image)}')"` : m.art ? `style="background-image:linear-gradient(135deg,${m.art[0]},${m.art[1]})"` : '');
  // Samme ikoner som i Madro: ✓ handlet, et tal = varer der mangler, 🛒 ikke handlet
  const badge = (m) => (m.status ? `<i class="mdst ${m.status.cls}" title="${esc(m.status.text)}" aria-label="Indkøb: ${esc(m.status.text)}">${m.status.cls === 'done' ? '✓' : m.status.cls === 'wait' ? m.status.n : '🛒'}</i>` : '');
  const meal = (m) => `<span class="mdmeal ${m.image || m.art ? 'has-img' : ''} ${m.note ? 'note' : ''}" ${bg(m)}>${badge(m)}<b>${esc(m.title)}</b></span>`;
  const cells = days.map((d, i) => { const ms = MD.mealsOn(d); return `<button class="mdday ${i === 0 ? 'today' : ''}" data-act="mdOpen" data-sub="madplan"><span class="mdlab">${dayLabel(d, i)}</span>${ms.length ? ms.slice(0, 2).map(meal).join('') : '<span class="mdnone">–</span>'}</button>`; }).join('');
  if (n === 1) {
    // Én dag: dagens retter fylder hele kortet med store billeder
    const ms = MD.mealsOn(today);
    const one = ms.length ? ms.map((m) => `<button class="mdbig ${m.image || m.art ? 'has-img' : ''}" data-act="mdOpen" data-sub="madplan" ${bg(m)}>${badge(m)}<b>${esc(m.title)}</b>${m.sub ? `<span>${esc(m.sub)}</span>` : ''}</button>`).join('') : '<button class="mdbig empty-day" data-act="mdOpen" data-sub="madplan"><b>Ingen ret planlagt</b><span>Tryk for at åbne madplanen</span></button>';
    return `${cardHead('Madplan · i dag')}<div class="mdone" style="grid-template-${wd >= h ? 'columns' : 'rows'}:repeat(${Math.max(1, Math.min(ms.length, 2))},minmax(0,1fr))">${one}</div>`;
  }
  const cols = kind === 'wide';
  const layout = cols ? `style="grid-template-columns:repeat(${n},minmax(0,1fr))"` : `style="grid-template-rows:repeat(${n},minmax(0,1fr))"`;
  return `${cardHead('Madplan · 5 dage')}<div class="mdplan md-${cols ? 'wide' : kind === 'big' ? 'list' : kind}" ${layout}>${cells}</div>`;
}
// Køretid hjemmefra til aftalens sted (hentes via workeren, gemmes 10 min)
const ROUTES = {};
const isPlace = (loc) => loc && !/^https?:|teams|zoom|meet\.google|online|virtuel/i.test(loc) && loc.trim().length > 2;
function routeFor(e) {
  if (!hasProxy() || !isPlace(e.location)) return null;
  const home = settings.places[0]; if (!home) return null;
  const key = e.location + '|' + e.start.toISOString();
  const r = ROUTES[key];
  if (!r || Date.now() - r.at > 10 * 60000) {
    ROUTES[key] = { at: Date.now(), data: r && r.data };
    workerFetch(`/route?from=${home.lat},${home.lon}&to=${encodeURIComponent(e.location)}&at=${encodeURIComponent(e.start.toISOString())}`).then((x) => x.json()).then((d) => { ROUTES[key] = { at: Date.now(), data: d }; if (ui.page === 'forside') softRender(); }).catch(() => {});
  }
  return ROUTES[key].data || null;
}
const durTxt = (min) => (min >= 60 ? `${Math.floor(min / 60)} t${min % 60 ? ' ' + (min % 60) + ' min' : ''}` : `${Math.max(1, min)} min`);
// Næste i kalenderen: hvor lang tid der er til – og hvornår man skal køre, hvis aftalen er et andet sted
function wNaeste(size, h = 1, wd = 1, x = null) {
  if (!D.cal) return cardHead('Næste') + '<div class="empty">Henter kalender …</div>';
  const now = Date.now();
  // Kun aftaler, der ikke er begyndt endnu – en aftale i gang springes over
  const evs = D.cal.events.filter((e) => !e.allDay && e.start.getTime() > now && mineEvent(e)).sort((a, b) => a.start - b.start);
  if (!evs.length) return cardHead('Næste') + '<div class="empty">Ingen kommende aftaler.</div>';
  const e = evs[0]; const running = false;
  const mins = Math.round((e.start.getTime() - now) / 60000);
  const kind = shapeKind(wd, h);
  // Ring: hvor meget af de sidste 3 timer før aftalen der er tilbage
  const frac = running ? 1 - (now - e.start) / Math.max(1, e.end - e.start) : Math.max(0, Math.min(1, mins / 180));
  const big = running ? 'Nu' : mins < 60 ? `${Math.max(1, mins)}` : mins < 24 * 60 ? `${Math.floor(mins / 60)}:${pad(mins % 60)}` : `${Math.round(mins / 1440)}`;
  const unit = running ? `til ${hhmm(e.end)}` : mins < 60 ? 'min' : mins < 24 * 60 ? 'timer' : Math.round(mins / 1440) === 1 ? 'dag' : 'dage';
  const ring = `<svg class="nx-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" class="bg"/><circle cx="50" cy="50" r="44" class="fg" style="stroke:${esc(e.color || 'var(--accent)')};stroke-dasharray:${(frac * 276.5).toFixed(1)} 276.5"/></svg>`;
  const day = sameDay(e.start, new Date()) ? 'I dag' : sameDay(e.start, addDays(new Date(), 1)) ? 'I morgen' : cap(DAYS_LONG[e.start.getDay()]);
  // Køreplan
  let drive = '';
  const rt = !running ? routeFor(e) : null;
  if (rt && rt.found && rt.min >= 3) {
    const leave = new Date(rt.departAt ? Date.parse(rt.departAt) - 5 * 60000 : e.start.getTime() - (rt.min + 5) * 60000);
    const lm = Math.round((leave - now) / 60000);
    const cls = lm <= 0 ? 'go' : lm <= 15 ? 'soon' : '';
    const traf = !rt.traffic ? '' : rt.delayMin <= 2 ? 'Trafikken er let' : rt.delayMin <= 9 ? 'Lidt trafik' : 'Tæt trafik';
    drive = `<div class="nx2-drive ${cls}"><b>${lm <= 0 ? 'Kør nu!' : 'Kør kl. ' + hhmm(leave)}</b><span>${[traf, durTxt(rt.min) + ' i bil'].filter(Boolean).join(' · ')}</span></div>`;
  }
  const until = running ? `I gang – til ${hhmm(e.end)}` : mins < 60 ? `om ${Math.max(1, mins)} min` : sameDay(e.start, new Date()) ? `om ${durTxt(mins)}` : day.toLowerCase();
  return cardHead('Næste aftale', `<span class="small muted">${day}</span>`) + `<button class="nx2" data-act="nav" data-page="kalender" style="--c:${esc(e.color || 'var(--accent)')}">
    <span class="nx2-time"><b>${hhmm(e.start)}</b><span class="${!running && mins <= 15 ? 'soon' : ''}">${esc(until)}</span></span>
    <span class="nx2-title">${esc(e.title)}</span>
    ${drive || (e.who ? `<span class="nx2-who">${esc(e.who)}</span>` : '')}
  </button>${later(evs, e, x)}`;
}
// Flere af dagens aftaler under den næste – antallet vælges under Tilpas forside
function later(evs, e, x) {
  const n = Math.max(1, Math.min(6, +(x && x.count) || 1)) - 1; if (!n) return '';
  const rest = evs.slice(1).filter((y) => sameDay(y.start, e.start)).slice(0, n);
  if (!rest.length) return '';
  return `<div class="nx-later" data-trimcard>${rest.map((y) => `<div class="nx-li" ${evRef(y)} style="--c:${esc(y.color || 'var(--accent)')}"><time>${hhmm(y.start)}</time><span>${esc(y.title)}</span></div>`).join('')}</div>`;
}
// Fodbold: én side pr. dag (i dag først). Dagens kampe fra de fulgte ligaer og favoritholdene, delt op i ligaer.
const dkey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function fbDays() {
  const fb = settings.football || {};
  const seen = new Set(); const all = [];
  Object.entries(FB.state.leagues || {}).forEach(([lg, ms]) => { if ((fb.follow || []).includes(lg)) ms.forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); all.push(m); } }); });
  (FB.state.matches || []).forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); all.push(m); } });
  const today = startOfDay(new Date());
  const keys = new Map([[dkey(today), today]]);
  all.forEach((m) => { const d = startOfDay(m.date); keys.set(dkey(d), d); });
  const days = [...keys.values()].sort((a, b) => a - b);
  // Ligaernes rækkefølge: den foretrukne først, så de fulgte, så resten (fx favoritholdenes pokal- og Europa-kampe)
  const lgName = (id) => (FB.LEAGUES.find((L) => L.id === id) || {}).name || id;
  const order = [fb.pref, ...(fb.follow || [])].filter(Boolean).map(lgName);
  return { days, all, order, today };
}
function wFodbold(size, h = 1, wd = 1) {
  const fb = settings.football || {};
  if (!(fb.teams || []).length && !(fb.follow || []).length) return cardHead('Fodbold') + '<div class="empty">Vælg hold eller ligaer under Indstillinger → Fodbold.</div>';
  if (!FB.state.at) return cardHead('Fodbold') + '<div class="empty">Henter kampe …</div>';
  const { days, all, order, today } = fbDays();
  let idx = days.findIndex((d) => dkey(d) === ui.fbDay); if (idx < 0) idx = days.findIndex((d) => +d === +today);
  const day = days[idx];
  const dayTxt = sameDay(day, today) ? 'I dag' : sameDay(day, addDays(today, 1)) ? 'I morgen' : sameDay(day, addDays(today, -1)) ? 'I går' : cap(DAYS_LONG[day.getDay()]);
  const arrows = `<span class="parrows"><button class="arr" data-act="wStep" data-scope="fb" data-dir="-1" aria-label="Dagen før" ${idx <= 0 ? 'disabled' : ''}>‹</button><button class="arr" data-act="wStep" data-scope="fb" data-dir="1" aria-label="Dagen efter" ${idx >= days.length - 1 ? 'disabled' : ''}>›</button></span>`;
  const head = cardHead(`${dayTxt} · ${day.getDate()}. ${MONTHS[day.getMonth()].slice(0, 3)}`, arrows);
  // Kun klublogo (forkortelse hvis der ikke er et logo) – navnet står i logoets beskrivelse
  const side = (t, fav) => `<span class="fb-t${t.id === fav ? ' fb-fav' : ''}" title="${esc(t.name)}">${t.logo ? `<img src="${esc(t.logo)}" alt="${esc(t.name)}" loading="lazy">` : `<b>${esc(t.abbr || t.name.slice(0, 3).toUpperCase())}</b>`}</span>`;
  const favIds = (fb.teams || []).map((t) => t.id);
  const row = (m) => {
    const pend = FB.pending(m); const fav = favIds.includes(m.home.id) ? m.home.id : favIds.includes(m.away.id) ? m.away.id : '';
    const mid = pend ? '<span class="fb-mid">–</span>' : m.state === 'pre' ? `<span class="fb-mid time">${hhmm(m.date)}</span>` : `<span class="fb-mid"><b class="${m.home.win ? 'w' : ''}">${esc(m.home.score)}</b>–<b class="${m.away.win ? 'w' : ''}">${esc(m.away.score)}</b></span>`;
    const when = m.state === 'in' ? `<span class="fb-live">● ${esc(m.clock || m.detail || 'Live')}</span>` : pend ? 'Afventer' : m.state === 'post' ? 'Slut' : '';
    return `<div class="fb-row ${m.state}"><span class="fb-when">${when}</span>${side(m.home, fav)}${mid}${side(m.away, fav)}</div>`;
  };
  const todays = all.filter((m) => sameDay(m.date, day)).sort((a, b) => a.date - b.date);
  if (!todays.length) return head + `<div class="empty">Ingen kampe ${sameDay(day, today) ? 'i dag' : 'denne dag'}.</div>`;
  const groups = new Map(); todays.forEach((m) => { const k = m.comp || 'Andre kampe'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
  const keys = [...groups.keys()].sort((a, b) => { const ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  // Brede kort: kampene står som fliser ved siden af hinanden; smalle kort: én kamp pr. linje
  if (wd >= 2) {
    const tile = (m) => { const r = row(m); return r.replace('class="fb-row ', 'class="fb-tile '); };
    return head + `<div class="fb-days">${keys.map((k) => `<div class="fb-grp"><div class="fb-sub">${esc(k)}</div><div class="fb-tiles">${groups.get(k).map(tile).join('')}</div></div>`).join('')}</div>`;
  }
  const blocks = keys.map((k) => `<div class="fb-grp"><div class="fb-sub">${esc(k)}</div>${groups.get(k).map(row).join('')}</div>`);
  return head + `<div class="fb-days">${blocks.join('')}</div>`;
}
// Stilling: én liga ad gangen (den foretrukne først) – swipe eller pile skifter liga
function stLeagues() {
  const fb = settings.football || {};
  const ids = [...new Set([fb.pref, ...(fb.follow || []), ...(fb.leagues || [])])].filter((id) => id && id !== 'nat' && FB.LEAGUES.some((L) => L.id === id));
  return ids.map((id) => FB.LEAGUES.find((L) => L.id === id));
}
function wStilling(size, h = 1, wd = 1) {
  const lgs = stLeagues();
  if (!lgs.length) return cardHead('Stilling') + '<div class="empty">Vælg ligaer under Indstillinger → Fodbold.</div>';
  const n = lgs.length; const idx = (((ui.stIdx || 0) % n) + n) % n; const L = lgs[idx];
  const head = cardHead(L.name, pageArrows('st', idx, n, 'liga'));
  const T = FB.tables[L.id];
  if (!T || !T.at) { if (!T && hasProxy()) FB.loadTable(L.id).then(() => setTimeout(softRender, 0)); return head + '<div class="empty">Henter stillingen …</div>'; }
  if (!T.groups.length) return head + '<div class="empty">Ingen stilling lige nu.</div>';
  const favIds = ((settings.football || {}).teams || []).map((t) => t.id);
  const wide = wd >= 2; const num = (v) => (v === null || v === undefined ? '' : v);
  const hdr = `<div class="st-row st-h${wide ? ' wide' : ''}"><span>#</span><span></span>${wide ? '<span>K</span><span>V</span><span>U</span><span>T</span>' : '<span>K</span>'}<span>+/-</span><span>P</span></div>`;
  const row = (t) => `<div class="st-row${wide ? ' wide' : ''}${favIds.includes(t.id) ? ' st-fav' : ''}${t.note ? ' noted' : ''}"${t.note ? ` style="--nc:${esc(t.note.color)}" title="${esc(t.note.text)}"` : ''}><span class="st-rk">${num(t.rank)}</span><span class="st-tm">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy">` : ''}<b data-abbr="${esc(t.abbr)}">${esc(wide ? t.name : t.abbr || t.name)}</b></span>${wide ? `<span>${num(t.gp)}</span><span>${num(t.w)}</span><span>${num(t.d)}</span><span>${num(t.l)}</span>` : `<span>${num(t.gp)}</span>`}<span>${t.gd > 0 ? '+' : ''}${num(t.gd)}</span><span class="st-p">${num(t.pts)}</span></div>`;
  // Forklaring på farverne (mesterskab, Europa, op- og nedrykning)
  const notes = new Map(); T.groups.forEach((g) => g.rows.forEach((t) => { if (t.note && !notes.has(t.note.text)) notes.set(t.note.text, t.note.color); }));
  const legend = notes.size ? `<div class="st-legend">${[...notes].map(([t, c]) => `<span style="--nc:${esc(c)}"><i></i>${esc(t)}</span>`).join('')}</div>` : '';
  return head + `<div class="st-wrap">${T.groups.map((g) => `${T.groups.length > 1 && g.name ? `<div class="fb-sub">${esc(g.name)}</div>` : ''}${hdr}${g.rows.map(row).join('')}`).join('')}${legend}</div>`;
}
function fodboldSettings() {
  const fb = settings.football || { leagues: [], teams: [] };
  const lgs = fb.leagues || []; const favKeys = (fb.teams || []).map((t) => t.id + '|' + t.lg);
  const chip = (t) => `<button class="fbchip" data-act="fbTeam" data-lg="${esc(t.lg)}" data-id="${esc(t.id)}" aria-pressed="${favKeys.includes(t.id + '|' + t.lg)}">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy">` : ''}<span>${esc(t.short || t.name)}</span></button>`;
  const leagueSec = (L) => { const on = lgs.includes(L.id); const teams = ui.fbTeams && ui.fbTeams[L.id];
    if (on && !teams && hasProxy()) FB.teamsOf(L.id).then((ts) => { ui.fbTeams = { ...(ui.fbTeams || {}), [L.id]: ts }; if (ui.page === 'indstillinger') renderMain(); }).catch(() => { ui.fbTeams = { ...(ui.fbTeams || {}), [L.id]: [] }; if (ui.page === 'indstillinger') renderMain(); });
    const fol = (fb.follow || []).includes(L.id);
    return on ? `<div class="fblg"><div class="row" style="justify-content:space-between"><b>${esc(L.name)}</b><button class="pill" data-act="fbFollow" data-id="${L.id}" aria-pressed="${fol}">${fol ? '✓' : '+'} Følg hele ligaen</button></div><div class="fbchips">${teams ? (teams.length ? teams.map(chip).join('') : '<span class="small muted">Kunne ikke hente holdene</span>') : '<span class="small muted">Henter hold …</span>'}</div></div>` : ''; };
  const prefOpts = [].concat((fb.follow || []).map((id) => ({ id, name: (FB.LEAGUES.find((L) => L.id === id) || {}).name || id }))).filter(Boolean);
  const prefSel = prefOpts.length > 1 ? `<label class="inl">Står øverst<select data-set="football.pref" aria-label="Foretrukken liga">${prefOpts.map((o) => `<option value="${o.id}"${(fb.pref || prefOpts[0].id) === o.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select></label>` : '';
  return `<section class="card"><div class="sechead2"><b>Ligaer</b>${prefSel}</div><div class="choices">${[{ id: 'nat', name: 'Landsholdet' }].concat(FB.LEAGUES).map((L) => `<button class="pill" data-act="fbLeague" data-id="${L.id}" aria-pressed="${lgs.includes(L.id)}">${lgs.includes(L.id) ? '✓' : '+'} ${esc(L.name)}</button>`).join('')}</div></section>
    <section class="card"><b>Favorithold</b>${!hasProxy() ? needProxyMsg('Fodbold') : ''}
      ${lgs.includes('nat') ? `<div class="fblg"><b>Landsholdet</b><div class="fbchips">${FB.NATIONAL.map(chip).join('')}</div></div>` : ''}
      ${FB.LEAGUES.map(leagueSec).join('') || ''}${!lgs.length ? '<span class="small muted">Vælg en liga først</span>' : ''}</section>`;
}
// Dagens ret: stort billede, navn, tid og om der er handlet ind. Efter kl. 20 vises morgendagens ret.
function wDagensRet(size, h = 1, wd = 1) {
  const wait = madroStatus('Dagens ret'); if (wait) return wait;
  const now = new Date(); const tomorrow = now.getHours() >= 20;
  const day = tomorrow ? addDays(startOfDay(now), 1) : startOfDay(now);
  const ms = MD.mealsOn(day); const m = ms.find((x) => !x.note) || ms[0];
  const label = tomorrow ? 'I morgen' : 'Dagens ret';
  if (!m) return `<button class="dret empty-day" data-act="mdOpen" data-sub="madplan"><span class="dret-in"><span class="dret-top"><span class="dret-lab">${label}</span></span><span class="dret-txt"><b>Ingen ret planlagt</b><span>Tryk for at åbne madplanen</span></span></span></button>`;
  const bg = m.image ? `background-image:url('${esc(m.image)}')` : m.art ? `background-image:linear-gradient(135deg,${m.art[0]},${m.art[1]})` : '';
  const st = m.status ? `<i class="mdst ${m.status.cls}" title="${esc(m.status.text)}">${m.status.cls === 'done' ? '✓' : m.status.cls === 'wait' ? m.status.n : '🛒'}</i><span class="dret-st">${esc(m.status.text)}</span>` : '';
  const kick = [m.theme, m.time, m.servings ? m.servings + ' pers.' : ''].filter(Boolean).join(' · ');
  return `<button class="dret" style="${bg}" ${m.id ? `data-act="mdRecipe" data-id="${esc(m.id)}"` : 'data-act="mdOpen" data-sub="madplan"'}>
    <span class="dret-in"><span class="dret-top"><span class="dret-lab">${label}</span><span class="dret-stw">${st}</span></span>
    <span class="dret-txt">${kick ? `<span class="dret-kick">${esc(kick)}</span>` : ''}<b>${esc(m.title)}</b>${m.intro && shapeKind(wd, h) !== 'tiny' ? `<span class="dret-intro">${esc(m.intro)}</span>` : ''}${ms.length > 1 ? `<span class="dret-more">+ ${esc(ms.filter((x) => x !== m).map((x) => x.title).join(', '))}</span>` : ''}</span></span></button>`;
}
function wIndkob(size, h = 1, wd = 1) {
  const wait = madroStatus('Indkøbsliste'); if (wait) return wait;
  const items = MD.openItems();
  const head = cardHead('Indkøbsliste', `<span class="small muted">${items.length ? items.length + (items.length === 1 ? ' vare' : ' varer') : ''}</span>`);
  const add = `<form class="shopadd" data-shopadd><input type="text" name="v" placeholder="Tilføj vare, fx 2 l mælk" aria-label="Tilføj vare til indkøbslisten" enterkeyhint="done" autocomplete="off"><button class="btn primary" aria-label="Tilføj">+</button></form>`;
  if (!items.length) return head + '<div class="empty">Listen er tom.</div>' + add;
  const cols = Math.min(3, wd, shapeKind(wd, h) === 'big' ? 2 : 3);
  const amt = (x) => [x.amount != null && x.amount !== '' ? String(x.amount).replace('.', ',') : '', x.unit || ''].join(' ').trim();
  // Opdelt i kategorier i samme rækkefølge som i Madro (gangen gennem butikken)
  const groups = new Map(); items.forEach((x) => { const c = MC.catOf(x); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(x); });
  const order = [...groups.keys()].sort((p, q) => MC.CATS.indexOf(p) - MC.CATS.indexOf(q));
  const block = (c) => `<div class="scat" style="--cc:${MC.catColor(c)}"><div class="scat-h"><span aria-hidden="true">${MC.CAT_EMO[c] || '🛒'}</span><b>${esc(c)}</b><span class="scat-n">${groups.get(c).length}</span></div>${groups.get(c).map((x) => `<div class="shopitem"><i aria-hidden="true"></i><span class="si-name">${esc(x.name)}</span>${amt(x) ? `<span class="si-amt">${esc(amt(x))}</span>` : ''}</div>`).join('')}</div>`;
  // Kategorierne fordeles i rækkefølge ned gennem spalterne, så de bliver nogenlunde lige lange
  const colsArr = Array.from({ length: cols }, () => ({ n: 0, c: [] }));
  const total = order.reduce((n, c) => n + groups.get(c).length + 1, 0); let k = 0;
  order.forEach((c) => { const sz = groups.get(c).length + 1; if (k < cols - 1 && colsArr[k].n && colsArr[k].n + sz / 2 > total / cols) k++; colsArr[k].c.push(c); colsArr[k].n += sz; });
  return head + `<div class="shoplist cats" style="--cols:${cols}">${colsArr.map((x) => `<div class="scol">${x.c.map(block).join('')}</div>`).join('')}</div>` + add;
}

// Køkkentimer: tryk på en tid for at starte. Flere timere kan køre samtidig.
const TM_PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];
function wTimer(size, h = 1, wd = 1) {
  const ts = TM.timers();
  const presets = (n) => `<div class="tmp" style="--c:${n}">${TM_PRESETS.slice(0, n * 3 - 1).map((m) => `<button data-act="tmStart" data-m="${m}">${m >= 60 ? m / 60 + ' t' : m + ' min'}</button>`).join('')}<button class="tm-any" data-act="tmPickOpen" aria-label="Vælg en anden tid">${svg('timer', 18)}<span>Andet</span></button></div>`;
  if (!ts.length) return cardHead('Timer nedtælling') + presets(wd >= 2 && h === 1 ? 5 : 3);
  const row = (t) => {
    const l = TM.left(t); const pct = t.total ? Math.max(0, Math.min(100, (l / t.total) * 100)) : 0;
    return `<div class="tmr${t.done ? ' done' : ''}${t.paused ? ' paused' : ''}">
      <div class="tmr-top"><span class="tmr-l">${esc(t.label)}</span><b data-tleft="${t.id}">${t.done ? 'Færdig!' : TM.fmt(l)}</b></div>
      <i class="tmr-bar"><i data-tbar="${t.id}" style="width:${pct}%"></i></i>
      <div class="tmr-btns">${t.done ? `<button class="tm-stop" data-act="tmRm" data-id="${t.id}">Stop</button><button data-act="tmAdd" data-id="${t.id}" data-m="1">+1 min</button>` : `<button data-act="tmToggle" data-id="${t.id}" aria-label="${t.paused ? 'Fortsæt' : 'Pause'}">${t.paused ? fillSvg('play', 16) : fillSvg('pause', 16)}</button><button data-act="tmAdd" data-id="${t.id}" data-m="1">+1 min</button><button data-act="tmRm" data-id="${t.id}" aria-label="Slet timer">✕</button>`}</div>
    </div>`;
  };
  return cardHead('Timer nedtælling') + `<div class="tmlist">${ts.map(row).join('')}<div class="tmmore">${presets(Math.min(5, Math.max(3, wd * 3)))}</div></div>`;
}
// Vælg en vilkårlig tid: tast cifre som på et telefon-ur (fx 1-2-3-0 = 12 min 30 sek)
function tmPickDigits() { return (ui.tmPick || '').replace(/^0+/, '').slice(-6); }
function tmPickParts() { const d = tmPickDigits().padStart(6, '0'); return { h: +d.slice(0, 2), m: +d.slice(2, 4), s: +d.slice(4, 6) }; }
function renderTmPicker() {
  let el = document.getElementById('tmPicker');
  if (ui.tmPick === undefined || ui.tmPick === null) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'tmPicker'; el.className = 'tmpick-shade'; el.addEventListener('click', (e) => { if (e.target === el) { ui.tmPick = null; renderTmPicker(); } }); document.body.appendChild(el); }
  const p = tmPickParts(); const any = p.h || p.m || p.s;
  const seg = (v, l) => `<span class="tps"><b>${String(v).padStart(2, '0')}</b><small>${l}</small></span>`;
  el.innerHTML = `<div class="tmpick" role="dialog" aria-modal="true" aria-label="Vælg tid til timeren">
    <div class="tp-disp ${any ? '' : 'empty'}">${seg(p.h, 'timer')}<i>:</i>${seg(p.m, 'min')}<i>:</i>${seg(p.s, 'sek')}</div>
    <div class="tp-quick">${[[5, '+5 min'], [10, '+10 min'], [30, '+30 min'], [60, '+1 t']].map(([m, l]) => `<button data-act="tmPickAdd" data-m="${m}">${l}</button>`).join('')}</div>
    <div class="tp-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<button data-act="tmKey" data-k="${k}">${k}</button>`).join('')}<button data-act="tmKey" data-k="00">00</button><button data-act="tmKey" data-k="0">0</button><button data-act="tmBack" aria-label="Slet sidste ciffer">⌫</button></div>
    <div class="tp-foot"><button class="btn line" data-act="tmPickClose">Annuller</button><button class="btn primary" data-act="tmPickStart" ${any ? '' : 'disabled'}>Start</button></div>
  </div>`;
}
function timerTick() {
  TM.tick();
  TM.timers().forEach((t) => {
    const el = document.querySelector(`[data-tleft="${t.id}"]`); if (el) el.textContent = t.done ? 'Færdig!' : TM.fmt(TM.left(t));
    const bar = document.querySelector(`[data-tbar="${t.id}"]`); if (bar && t.total) bar.style.width = Math.max(0, Math.min(100, (TM.left(t) / t.total) * 100)) + '%';
  });
  const chip = document.getElementById('tmChip'); const run = TM.timers().filter((t) => !t.done && !t.paused);
  if (chip && run.length) chip.querySelector('b').textContent = TM.fmt(Math.min(...run.map(TM.left)));
  // Alarm-boks, der kan ses på alle sider
  const done = TM.timers().filter((t) => t.done);
  let box = document.getElementById('tmAlarm');
  if (!done.length) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'tmAlarm'; box.className = 'tmalarm'; box.setAttribute('role', 'alert'); document.body.appendChild(box); }
  const txt = `⏰ ${done.map((t) => t.label).join(', ')} – tiden er gået!`;
  if (box.dataset.txt !== txt) { box.dataset.txt = txt; box.innerHTML = `<span>${esc(txt)}</span><button data-act="tmStopAll">Stop</button>`; }
}

// Somfy: screens udenfor – op, stop, "my" og ned for hver, og for alle på én gang
function wScreens(size, h = 1, wd = 1, x = {}) {
  const st = SF.state;
  if (!hasProxy()) return cardHead('Screens') + needProxyMsg('Somfy');
  if (!st.checked) return cardHead('Screens') + '<div class="empty">Henter fra Somfy …</div>';
  if (st.configured === false) return cardHead('Screens') + '<div class="empty">Somfy er ikke sat op endnu (Indstillinger → Forbindelse).</div>';
  if (st.error && !st.devices.length) return cardHead('Screens') + `<div class="empty">${esc(st.error)}</div>`;
  if (!st.devices.length) return cardHead('Screens') + '<div class="empty">Ingen screens fundet i Somfy.</div>';
  const presets = (settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS);
  const btns = (urls, d, all = false) => {
    const k = urls.join('|'); const busy = urls.some((u) => st.busy[u]);
    const devs = st.devices.filter((x) => urls.includes(x.url));
    return `<span class="sfb sfp${busy ? ' busy' : ''}">${presets.map((p) => `<button data-act="sfPreset" data-urls="${esc(k)}" data-v="${esc(String(p.v))}" aria-pressed="${devs.length > 0 && devs.every((x) => SF.atPreset(x, p.v))}">${esc(p.name)}</button>`).join('')}<button class="sfstop" data-act="sfCmd" data-urls="${esc(k)}" data-cmd="stop" aria-label="Stop">${fillSvg('stop', 12)}</button></span>`;
  };
  const rows = st.devices.map((d) => `<div class="sfrow${d.available ? '' : ' off'}"><span class="sfname"><b title="${esc(d.label)}">${esc(d.label)}</b>${SF.stateText(d) ? `<small>${esc(SF.stateText(d))}</small>` : ''}</span>${btns([d.url], d)}</div>`).join('');
  const mode = x.mode || 3; // 1 = kun alle samlet, 2 = kun hver for sig, 3 = begge
  if (mode === 1) {
    const sts = st.devices.map(SF.stateText).filter(Boolean); const same = sts.length && sts.every((t) => t === sts[0]);
    return cardHead('Screens', `<span class="small muted">${st.devices.length} stk.</span>`) + `<div class="sfone ${wd >= 2 * h ? 'one-row' : 'grid2'}" style="--cols:${wd >= 2 * h ? presets.length : Math.min(3, Math.max(2, Math.ceil(presets.length / 2)))};--prow:${wd >= 2 * h ? 1 : Math.ceil(presets.length / Math.min(3, Math.max(2, Math.ceil(presets.length / 2))))}"><span class="sfname"><b>Alle screens</b>${same ? `<small>${esc(sts[0])}</small>` : ''}</span>${st.devices.some((d) => !d.rts && d.commands.includes('setClosure')) ? `<input class="sfslider sfh sfw" type="range" min="0" max="100" step="5" value="${(() => { const p = st.devices.filter((d) => d.closure != null); return p.length ? Math.round(p.reduce((a, d) => a + +d.closure, 0) / p.length / 5) * 5 : 0; })()}" data-sfposall="1" aria-label="Hvor langt nede – alle screens">` : ''}${btns(st.devices.map((d) => d.url), null, true)}</div>`;
  }
  const all = mode === 3 && st.devices.length > 1 ? `<div class="sfrow sfall"><span class="sfname"><b>Alle</b></span>${btns(st.devices.map((d) => d.url), null, true)}</div>` : '';
  return cardHead('Screens') + `<div class="sflist">${all}${rows}</div>`;
}

// Inspiration: en ret fra kogebogen ad gangen, skifter hvert 20. sekund
function wInspiration(size, h = 1, wd = 1, x = null) {
  const wait = madroStatus('Inspiration'); if (wait) return wait;
  const meal = (x && x.meal) || '';
  const list = MD.state.all.filter((r) => MD.mealMatch(r, meal));
  if (!list.length) return cardHead('Inspiration') + `<div class="empty">${MD.state.all.length ? 'Ingen opskrifter med ' + esc(meal.toLowerCase()) + '.' : 'Henter opskrifter …'}</div>`;
  const n = list.length; const idx = ((ui.inspIdx % n) + n) % n; const r = list[idx];
  const kind = shapeKind(wd, h);
  const bg = r.image ? `background-image:url('${esc(r.image)}')` : `background-image:linear-gradient(135deg,${r.art[0]},${r.art[1]})`;
  const kick = [r.theme, r.time].filter(Boolean).join(' · ');
  return `<div class="insp" style="${bg}"><div class="insp-in">
    <div class="whead"><span class="lab">Prøv noget nyt${meal ? ' · ' + esc(meal.toLowerCase()) : ''}</span><span class="parrows"><button class="arr" data-act="wStep" data-scope="insp" data-dir="-1" aria-label="Forrige opskrift">‹</button><button class="arr" data-act="wStep" data-scope="insp" data-dir="1" aria-label="Næste opskrift">›</button></span></div>
    <div class="nbar insp-bar" aria-hidden="true"><i id="inspBar" style="width:${Math.max(0, 100 - ((Date.now() - ui.inspAt) / 200))}%"></i></div>
    <button class="insp-go" data-act="mdRecipe" data-id="${esc(r.id)}">${kick ? `<span class="insp-kick">${esc(kick)}</span>` : ''}<b>${esc(r.title)}</b>${r.intro && kind !== 'tiny' ? `<span class="insp-intro">${esc(r.intro)}</span>` : ''}</button>
  </div></div>`;
}

function wNed(size, h = 1, wd = 1) {
  const list = countdowns();
  if (!list.length) return '<div class="cdcard"><div class="cdinner">' + cardHead('Nedtælling') + '<div class="empty">Vælg nedtællinger til kortet under Indstillinger → Kalender.</div></div></div>';
  const n = list.length; const idx = ((ui.cdIdx % n) + n) % n; const c = list[idx];
  const d = new Date(c.date + 'T00:00');
  const img = M.getImage(c.imageId);
  const label = c.days < 0 ? esc(c.name) + ' er overstået' : c.days === 0 ? 'I dag!' : (c.days === 1 ? 'dag til ' : 'dage til ') + esc(c.name.toLowerCase());
  return `<div class="cdcard ${img ? 'has-img' : ''}" ${img ? `style="background-image:url('${img}')"` : ''}>
    <div class="cdinner">${cardHead(c.name, pageArrows('cd', idx, n, 'nedtælling'))}
    <div class="cdw"><div class="cdn">${c.days < 0 ? '✓' : c.days}</div><div class="cdl">${label}</div><div class="cdd">${cap(DAYS_LONG[d.getDay()])} ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}</div></div></div></div>`;
}

const WRENDER = { stilling: wStilling, fodbold: wFodbold, naeste: wNaeste, dagensret: wDagensRet, nyhed1: wNyhed1, timer: wTimer, screens: wScreens, madplan: wMadplan, indkob: wIndkob, inspiration: wInspiration, uge: wUge, vejr: wVejr, steder: wSteder, nyheder: wNyheder, sonos: wSonos, tv: wTv, nedtaelling: wNed };

function pageForside() {
  const inLayout = (id) => curLayout().some((x) => x.id === id);
  const edit = ui.editing ? `<section class="card editpanel">
      <div class="row" style="justify-content:space-between"><span class="lab">${meMember() ? `${esc(meMember().name)}s forside${settings.layouts && settings.layouts[settings.me] ? ` · <button class="linkbtn" data-act="resetMyLayout">brug familiens forside</button>` : ''}` : 'Familiens forside'}</span><span class="wopt" role="group" aria-label="Størrelse på kortene">${[[4, 'Store'], [5, 'Mellem'], [6, 'Små']].map(([v, l]) => `<button data-act="gridCols" data-v="${v}" aria-pressed="${gcols() === v}">${l}</button>`).join('')}</span></div>
      <div class="choices">${Object.entries(WIDGETS).filter(([id]) => widgetOn(id)).map(([id, name]) => `<button class="pill" data-act="toggleW" data-id="${id}" aria-pressed="${inLayout(id)}">${inLayout(id) ? '✓' : '+'} ${esc(name)}</button>`).join('')}</div>
    </section>` : '';
  const cards = curLayout().filter((x) => WIDGETS[x.id] && widgetOn(x.id)).map((x) => {
    const [w, h] = shapeOf(x);
    const picker = ui.editing && ui.sizeFor === x.id ? `<div class="shapes" role="group" aria-label="Størrelse på ${esc(WIDGETS[x.id])}">${SHAPES.map(([sw, sh]) => `<button class="shape" data-act="shape" data-id="${x.id}" data-w="${sw}" data-h="${sh}" aria-pressed="${sw === w && sh === h}" aria-label="${sw} gange ${sh} kvadrater">${shapeIcon(sw, sh)}<span>${sw}×${sh}</span></button>`).join('')}</div>` : '';
    return `
    <section class="card w" data-wid="${x.id}" ${FIT.includes(x.id) ? `data-fit data-h="${h}"` : ''} style="--w:${w};--h:${h}">
      ${ui.editing ? `<div class="wbar"><button class="handle" aria-label="Træk for at flytte ${esc(WIDGETS[x.id])}">${GRIP}Flyt</button><span class="nm">${esc(WIDGETS[x.id])}</span>
        ${x.id === 'screens' ? `<span class="wopt" role="group" aria-label="Betjening">${[[1, 'Alle samlet'], [2, 'Hver for sig'], [3, 'Begge']].map(([v, l]) => `<button data-act="wOpt" data-id="screens" data-k="mode" data-v="${v}" aria-pressed="${(x.mode || 3) === v}">${l}</button>`).join('')}</span>` : ''}
        ${x.id === 'naeste' ? `<select class="wsel" data-wsel="naeste" data-k="count" aria-label="Antal aftaler">${[1, 2, 3, 4, 5, 6].map((v) => `<option value="${v}"${String(x.count || 1) === String(v) ? ' selected' : ''}>${v === 1 ? 'Kun den næste' : v + ' aftaler'}</option>`).join('')}</select>` : ''}
        ${x.id === 'uge' ? `<select class="wsel" data-wsel="uge" data-k="days" aria-label="Antal dage">${[['', 'Automatisk'], ...[1, 2, 3, 4, 5, 6, 7].map((v) => [String(v), v === 1 ? '1 dag' : v + ' dage'])].map(([v, l]) => `<option value="${v}"${String(x.days || '') === v ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}
        ${x.id === 'inspiration' ? `<select class="wsel" data-wsel="inspiration" data-k="meal" aria-label="Måltid">${['', ...MD.MEALS].map((m) => `<option value="${m}"${(x.meal || '') === m ? ' selected' : ''}>${m || 'Alle måltider'}</option>`).join('')}</select>` : ''}
        ${x.id === 'madplan' ? `<span class="wopt" role="group" aria-label="Antal dage">${[[1, '1 dag'], [5, '5 dage']].map(([v, l]) => `<button data-act="wOpt" data-id="madplan" data-k="days" data-v="${v}" aria-pressed="${(x.days || 5) === v}">${l}</button>`).join('')}</span>` : ''}
        <button class="sz" data-act="sizeFor" data-id="${x.id}" aria-expanded="${ui.sizeFor === x.id}" aria-label="Vælg størrelse (nu ${w} gange ${h})">${shapeIcon(w, h)}<span>${w}×${h}</span></button>
        <button class="x" data-act="toggleW" data-id="${x.id}" aria-label="Fjern ${esc(WIDGETS[x.id])}">×</button></div>${picker}` : ''}
      ${WRENDER[x.id](sizeKey(w), h, w, x)}
    </section>`;
  }).join('');
  const me = meMember();
  return `${edit}<div class="gridwrap"><div class="grid ${ui.editing ? 'editing' : ''}" id="grid" style="--gcols:${gcols()}">${cards || '<div class="empty">Forsiden er tom. Tryk "Tilpas forside" og vælg kort.</div>'}</div></div>`;
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
  const meK0 = meMember(); const cals = settings.calendars.filter((c) => c.url && (!meK0 || !c.owner || c.owner === meK0.id));
  const meK = meMember();
  return `<div class="ptitle"><h1>Kalender</h1><span class="muted" style="font-weight:700">${esc(title)}</span>
      <div class="tools"><button class="btn" data-act="calPrev" aria-label="Forrige uge">‹</button><button class="btn" data-act="calToday">I dag</button><button class="btn" data-act="calNext" aria-label="Næste uge">›</button></div></div>
    ${D.cal && D.cal.demo ? '<div class="empty">Viser eksempler. Tilføj jeres kalendere under Indstillinger → Kalendere.</div>' : ''}
    ${D.cal && D.cal.errors.length ? `<div class="err">${esc(D.cal.errors.map((e) => e.cal + ': ' + e.msg).join(' · '))}</div>` : ''}
    ${calTimeGrid(days, today)}
    ${cals.length ? `<div class="legend">${calGroups(cals).map((g) => { const on = g.ids.some((id) => !(settings.calHidden || []).includes(id)); return `<button class="lchip${on ? '' : ' off'}" data-act="calShow" data-id="${esc(g.ids.join(','))}" aria-pressed="${on}" style="--c:${esc(g.color)};--l:${lighten(g.color)}"><i></i>${esc(g.name)}</button>`; }).join('')}</div>` : ''}`;
}
// Ugen som timegitter: heldagsaftaler øverst, aftaler placeret efter klokkeslæt, dagens menu nederst
const CAL_HH = 52; // højde pr. time i px
let calRefs = [];
const evRef = (e) => { if (calRefs.length > 2000) calRefs = []; calRefs.push(e); return `data-act="calEv" data-i="${calRefs.length - 1}" role="button" tabindex="0"`; };
function calTimeGrid(days, today) {
  const now0 = Date.now(); const evs = days.map((d) => eventsOn(d, true).filter((e) => !sameDay(d, today) || e.allDay || e.end.getTime() > now0)); // i dag: overståede aftaler vises ikke
  const allDay = evs.map((l, i) => l.filter((e) => e.allDay || (e.start <= startOfDay(days[i]) && e.end >= addDays(startOfDay(days[i]), 1))));
  const timed = evs.map((l, i) => l.filter((e) => !allDay[i].includes(e)));
  const cols = 'grid-template-columns:52px repeat(7,minmax(0,1fr))';
  const head = `<div class="tg-row tg-head" style="${cols}"><span></span>${days.map((d) => `<div class="${sameDay(d, today) ? 'today' : ''}">${cap(DAYS[d.getDay()]).slice(0, 3)} <b>${d.getDate()}.</b></div>`).join('')}</div>`;
  const ad = allDay.some((l) => l.length) ? `<div class="tg-row tg-all" style="${cols}"><span class="tg-lab">Hele<br>dagen</span>${allDay.map((l) => `<div>${l.map((e) => `<div class="ev" ${evRef(e)} style="${evStyle(e)}">${esc(e.title)}</div>`).join('')}</div>`).join('')}</div>` : '';
  const hours = Array.from({ length: 24 }, (_, h) => `<span class="tg-h" style="top:${h * CAL_HH}px">${h ? pad(h) + ':00' : ''}</span>`).join('');
  const now = new Date();
  const body = days.map((d, i) => {
    const s0 = startOfDay(d).getTime();
    const items = timed[i].map((e) => ({ e, a: Math.max(0, (e.start - s0) / 3600000), b: Math.min(24, (e.end - s0) / 3600000) })).sort((x, y) => x.a - y.a || y.b - x.b);
    // Overlappende aftaler deler bredden
    let group = [], end = -1; const groups = [];
    items.forEach((it) => { if (it.a >= end && group.length) { groups.push(group); group = []; } group.push(it); end = Math.max(end, it.b); });
    if (group.length) groups.push(group);
    groups.forEach((g) => { const lanes = []; g.forEach((it) => { let k = lanes.findIndex((x) => x <= it.a); if (k < 0) { k = lanes.length; lanes.push(0); } lanes[k] = it.b; it.k = k; }); g.forEach((it) => { it.n = lanes.length; }); });
    const html = items.map(({ e, a, b, k, n }) => { const h = Math.max(0.5, b - a) * CAL_HH - 2; return `<div class="ev tg-ev${h < 40 ? ' short' : ''}" ${evRef(e)} style="${evStyle(e)};top:${a * CAL_HH}px;height:${h}px;left:calc(${(k / n) * 100}% + 2px);width:calc(${100 / n}% - 4px)" title="${esc(e.title)}"><time>${esc(evTime(e, d))}</time><span>${esc(e.title)}</span></div>`; }).join('');
    const nowLine = sameDay(d, today) ? `<i class="tg-now" style="top:${((now - s0) / 3600000) * CAL_HH}px"></i>` : '';
    return `<div class="tg-day${sameDay(d, today) ? ' today' : ''}">${html}${nowLine}</div>`;
  }).join('');
  const menus = days.map((d) => dayMenu(d));
  const menu = menus.some(Boolean) ? `<div class="tg-row tg-menu" style="${cols}"><span></span>${menus.map((m) => `<div>${m}</div>`).join('')}</div>` : '';
  requestAnimationFrame(calScroll);
  return `<div class="tgrid" data-swipe="cal">${head}${ad}<div class="tg-body" id="tgBody"><div class="tg-inner" style="${cols};height:${24 * CAL_HH}px"><div class="tg-hours">${hours}</div>${body}</div></div>${menu}</div>`;
}
// Info om en aftale
function showEvent(e) {
  const sd = startOfDay(e.start), ed = startOfDay(new Date(e.end - 1));
  const dt = (d) => `${cap(DAYS_LONG[d.getDay()])} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
  const when = e.allDay ? (sameDay(sd, ed) ? dt(sd) + ' · hele dagen' : `${dt(sd)} – ${dt(ed)}`) : sameDay(sd, ed) ? `${dt(sd)} · ${hhmm(e.start)}–${hhmm(e.end)}` : `${dt(sd)} ${hhmm(e.start)} – ${dt(ed)} ${hhmm(e.end)}`;
  const mins = Math.round((e.end - e.start) / 60000);
  const dur = e.allDay ? '' : mins < 60 ? `${mins} min` : `${num(mins / 60, mins % 60 ? 1 : 0)} t`;
  const cal = settings.calendars.find((c) => c.id === e.cal);
  const notes = String(e.notes || '').trim();
  const m = document.createElement('div'); m.className = 'upd-modal';
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="upd-box evinfo" style="--c:${esc(e.color || '#888')}"><h2>${esc(e.title)}</h2>
    <div class="evi-row"><span>🕒</span><span>${esc(when)}${dur ? ` <span class="muted">· ${dur}</span>` : ''}</span></div>
    ${e.location ? `<div class="evi-row"><span>📍</span><span>${esc(e.location)}</span></div>` : ''}
    <div class="evi-row"><span><i class="evi-dot"></i></span><span>${esc((cal && cal.name) || e.who || 'Kalender')}</span></div>
    ${notes ? `<div class="evi-notes">${esc(notes)}</div>` : ''}
    <button class="btn primary big" data-close>Luk</button></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('click', (ev) => { if (ev.target === m || ev.target.closest('[data-close]')) close(); });
}
// Start ved kl. 7 (eller lige før nu i dag), og behold placeringen ved opdateringer
function calScroll() {
  const el = document.getElementById('tgBody'); if (!el) return;
  const key = String(ui.calWeek || 0);
  if (ui.calScrollKey !== key) { ui.calScrollKey = key; ui.calScrollTop = Math.max(0, Math.min(7, new Date().getHours() - 1)) * CAL_HH - 10; }
  el.scrollTop = ui.calScrollTop;
  el.onscroll = () => { if (el.clientHeight) ui.calScrollTop = el.scrollTop; };
}
// Kalendere med samme navn og farve vises og skjules samlet
function calGroups(cals) {
  const m = new Map();
  cals.forEach((c) => { const k = (c.name || '').trim().toLowerCase() + '|' + String(c.color || '').toLowerCase(); if (!m.has(k)) m.set(k, { name: c.name, color: c.color, ids: [] }); m.get(k).ids.push(c.id); });
  return [...m.values()];
}
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 86400000 + 1) / 7); }

/* ---------- Vejr ---------- */
// Vejrsiden: stort "lige nu"-kort, de næste 24 timer som kurve og 7 dage – alt på én skærm
function wxTheme(code, isDay) {
  if (!isDay) return 'night';
  if ([95, 96, 99].includes(code)) return 'storm';
  if (code >= 71 && code <= 86 && ![80, 81, 82].includes(code)) return 'snow';
  if ((code >= 51 && code <= 67) || [80, 81, 82].includes(code)) return 'rain';
  if (code >= 2) return 'cloud';
  return 'sun';
}
// Udviklingen de næste 24 timer i hele sætninger: temperatur, regn, sol og vind
// Timerne for en valgt dag: i dag = de næste 24 timer fra nu, ellers hele dagen 00–23
function wxHours(w, day) {
  if (!day) return w.hours.filter((h) => h.time.getTime() > Date.now() - 3600000).slice(0, 24);
  const d = addDays(startOfDay(new Date()), day).toDateString();
  return w.hours.filter((h) => h.time.toDateString() === d);
}
function wxStory(w, day = 0) {
  const H = wxHours(w, day); if (!H.length) return [];
  const today = !day;
  const hh = (h) => 'kl. ' + pad(h.time.getHours());
  const out = [];
  const mx = H.reduce((a, b) => (b.temp > a.temp ? b : a)); const mn = H.reduce((a, b) => (b.temp < a.temp ? b : a));
  out.push({ k: 'temp', t: `${today ? fmtTemp(w.now.temp) + ' nu · ' : ''}højst ${fmtTemp(mx.temp)} ${hh(mx)} · lavest ${fmtTemp(mn.temp)} ${hh(mn)}` });
  const wet = H.filter((h) => h.rain >= 0.1);
  if (!wet.length) out.push({ k: 'rain', t: today ? 'Tørt det næste døgn' : 'Tørt hele dagen' });
  else { const tot = wet.reduce((a, h) => a + h.rain, 0); const first = wet[0], last = wet[wet.length - 1]; out.push({ k: 'rain', t: `Regn ${first === H[0] && today ? 'nu' : 'fra ' + hh(first)} til kl. ${pad((last.time.getHours() + 1) % 24)} · i alt ${num(tot)} mm` }); }
  const d0 = (H.find((h) => h.isDay) || H[0]).time.toDateString(); const sunH = H.filter((h) => h.isDay && h.time.toDateString() === d0); const sunMin = sunH.reduce((a, h) => a + (h.sun || 0), 0);
  if (sunH.length && H[0].sun !== null) {
    if (sunMin < 20) { const cl = Math.round(sunH.reduce((a, h) => a + (h.cloud || 0), 0) / sunH.length); out.push({ k: 'sun', t: cl > 80 ? 'Overskyet – ingen sol i sigte' : 'Næsten ingen sol' }); }
    else { const best = sunH.filter((h) => (h.sun || 0) >= 30); out.push({ k: 'sun', t: `${!today ? 'Sol' : d0 === new Date().toDateString() ? 'I dag sol' : 'I morgen sol'} i ca. ${num(sunMin / 60)} timer${best.length ? `, mest kl. ${pad(best[0].time.getHours())}–${pad((best[best.length - 1].time.getHours() + 1) % 24)}` : ''}` }); }
  }
  if (H[0].wind !== null) {
    const wmax = H.reduce((a, b) => (b.wind > a.wind ? b : a)); const g = Math.max(...H.map((h) => h.gust || 0));
    const now = today ? w.now.wind : H[0].wind; const dir = W.windDirText(today ? w.now.windDir : wmax.windDir);
    if (!today) { out.push({ k: 'wind', t: `Op til ${num(wmax.wind, 0)} m/s fra ${dir} ${hh(wmax)}${g >= 10 ? ` · stød op til ${num(g, 0)} m/s` : ''}` }); return out; }
    const change = wmax.wind - now >= 3 ? `, tager til ${num(wmax.wind, 0)} m/s ${hh(wmax)}` : wmax.wind - now <= -3 ? ', aftager' : '';
    out.push({ k: 'wind', t: `${num(now, 0)} m/s fra ${dir}${change}${g >= 10 ? ` · stød op til ${num(g, 0)} m/s` : ''}` });
  }
  return out;
}
const STORY_ICON = { temp: '🌡️', rain: '🌧️', sun: '☀️', wind: '💨' };
function hourChart(H, today = true) {
  if (H.length < 2) return '';
  const n = H.length; const Wd = 960, Ht = 110;
  const ts = H.map((h) => h.temp); const mx = Math.max(...ts), mn = Math.min(...ts); const span = Math.max(4, mx - mn);
  const x = (i) => ((i + 0.5) * Wd) / n; const y = (t) => 26 + (1 - (t - mn) / span) * (Ht - 40);
  const pts = H.map((h, i) => [x(i), y(h.temp)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[Math.min(pts.length - 1, i + 2)]; d += ` C${x1 + (x2 - x0) / 6},${y1 + (y2 - y0) / 6} ${x2 - (x3 - x1) / 6},${y2 - (y3 - y1) / 6} ${x2},${y2}`; }
  // Tal og prikker lægges som HTML ovenpå, så de ikke bliver trukket skæve, når kurven strækkes i bredden
  const labels = H.map((h, i) => (i % 3 === 0 ? `<span class="mg-pt" style="left:${(x(i) / Wd) * 100}%;top:${(y(h.temp) / Ht) * 100}%"><b>${Math.round(h.temp)}°</b><i></i></span>` : '')).join('');
  const maxRain = Math.max(1, ...H.map((h) => h.rain || 0));
  const col = (i, span = 3) => `grid-column:${i + 1} / span ${span}`;
  const every3 = (f) => H.map((h, i) => (i % 3 === 0 ? f(h, i) : '')).join('');
  return `<div class="mg" style="--n:${n}">
    <div class="mg-row mg-time">${every3((h, i) => `<span style="${col(i)}">${i === 0 && today ? 'Nu' : pad(h.time.getHours())}</span>`)}</div>
    <div class="mg-row mg-ico">${every3((h, i) => `<span style="${col(i)}">${W.weatherIcon(h.code, h.isDay, 28)}</span>`)}</div>
    <div class="mg-tw"><svg class="mg-temp" viewBox="0 0 ${Wd} ${Ht}" preserveAspectRatio="none" aria-label="Temperatur"><defs><linearGradient id="tfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${pts[n - 1][0]},${Ht} L${pts[0][0]},${Ht} Z" fill="url(#tfill)"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>${labels}</div>
    <div class="mg-lab">Sol og skyer</div>
    <div class="mg-row mg-sky">${H.map((h) => `<i title="${h.sun || 0} min sol · ${h.cloud ?? '–'} % skyer" style="--sun:${h.isDay ? Math.min(1, (h.sun || 0) / 60) : 0};--cloud:${(h.cloud || 0) / 100}" class="${h.isDay ? '' : 'night'}"></i>`).join('')}</div>
    <div class="mg-lab">Regn</div>
    <div class="mg-row mg-rain">${H.map((h) => `<i style="--r:${Math.min(1, (h.rain || 0) / maxRain)}" title="${num(h.rain || 0)} mm"></i>`).join('')}</div>
    <div class="mg-row mg-rainv">${every3((h, i) => { const r = H.slice(i, i + 3).reduce((a, x) => a + (x.rain || 0), 0); return `<span style="${col(i)}">${r >= 0.1 ? num(r) + ' mm' : ''}</span>`; })}</div>
    <div class="mg-lab">Vind (m/s)</div>
    <div class="mg-row mg-wind">${every3((h, i) => `<span style="${col(i)}"><svg width="18" height="18" viewBox="0 0 24 24" style="transform:rotate(${(h.windDir || 0) + 180}deg)"><path d="M12 3l6 16-6-4-6 4z" fill="currentColor"/></svg><b>${num(h.wind, 0)}</b>${h.gust ? `<small>(${num(h.gust, 0)})</small>` : ''}</span>`)}</div>
  </div>`;
}
function pageVejr() {
  const place = placeById(ui.wPlace);
  const w = D.wx[place.id];
  const idx = settings.places.indexOf(place);
  const model = W.MODELS.find((m) => m.id === settings.weather.model) || W.MODELS[0];
  const seg = settings.places.length > 1 ? `<div class="wseg">${settings.places.map((p, i) => `<button data-act="wPlace" data-id="${esc(p.id)}" aria-pressed="${p.id === place.id}">${i === 0 ? ico('home', 14) : ''}<span>${esc(placeLabel(p))}</span></button>`).join('')}</div>` : '';
  let body = `<div class="empty">${D.wxErr[place.id] ? esc(D.wxErr[place.id]) : 'Henter vejret …'}</div>`;
  if (w) {
    const dsel = Math.min(ui.wxDay || 0, w.days.length - 1);
    const t0 = w.days[0];
    const maxT = Math.max(...w.days.map((d) => d.max)); const minT = Math.min(...w.days.map((d) => d.min)); const span = Math.max(1, maxT - minT);
    const trend = wxTrend(w);
    const stat = (label, val, extra = '') => `<div class="wstat"><span>${label}</span><b>${val}</b>${extra}</div>`;
    const arrow = `<svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${(w.now.windDir || 0) + 180}deg)"><path d="M12 3l6 16-6-4-6 4z" fill="currentColor"/></svg>`;
    body = `<div class="wxpage">
      <section class="wxhero wx-${wxTheme(w.now.code, w.now.isDay)}">
        <div class="wxh-top"><span>${esc(placeLabel(place))}${place.label && place.label !== place.name ? ` · ${esc(place.name)}` : ''}</span><span>${esc(model.name)} · ${hhmm(w.fetched)}</span></div>
        <div class="wxh-main">${W.weatherIcon(w.now.code, w.now.isDay, 96)}<div><div class="wxh-t">${fmtTemp(w.now.temp)}</div><div class="wxh-c">${esc(W.codeText(w.now.code))}</div></div></div>
        <div class="wxh-sub">Føles som ${fmtTemp(w.now.feels)} · ↑ ${fmtTemp(t0.max)} ↓ ${fmtTemp(t0.min)}${trend && trend.msg ? ` · ${esc(trend.msg)}` : ''}</div>
        <div class="wstats">
          ${stat('Vind', `${arrow} ${num(w.now.wind, 0)} m/s`, `<small>fra ${W.windDirText(w.now.windDir)}</small>`)}
          ${stat('Fugt', (w.now.humidity ?? '–') + ' %')}
          ${stat('Sol', `${hhmm(t0.sunrise)}`, `<small>ned ${hhmm(t0.sunset)}</small>`)}
        </div>
      </section>
      <section class="card wx24"><div class="wx24head"><b>${dsel ? cap(DAYS_LONG[addDays(startOfDay(new Date()), dsel).getDay()]) + ' ' + addDays(startOfDay(new Date()), dsel).getDate() + '. ' + MONTHS[addDays(startOfDay(new Date()), dsel).getMonth()] : 'De næste 24 timer'}</b>${dsel ? '<button class="linkbtn" data-act="wxDay" data-i="0">Tilbage til i dag</button>' : ''}</div><div class="wxstory">${wxStory(w, dsel).map((x) => `<div class="ws ws-${x.k}"><span aria-hidden="true">${STORY_ICON[x.k]}</span>${esc(cap(x.t))}</div>`).join('')}</div>${hourChart(wxHours(w, dsel), !dsel)}</section>
      <section class="card wx7"><div class="lab">7 dage</div><div class="w7">${w.days.map((d, i) => `<button class="w7r ${i === 0 ? 'today' : ''} ${i === dsel ? 'sel' : ''}" data-act="wxDay" data-i="${i}" aria-pressed="${i === dsel}"><b>${i === 0 ? 'I dag' : cap(DAYS[d.date.getDay()])}</b>${W.weatherIcon(d.code, 1, 28)}
        <span class="w7rain">${d.rain > 0.05 ? num(d.rain) + ' mm' : ''}</span><span class="w7sun">${d.sunH != null && d.sunH >= 0.1 ? '☀ ' + num(d.sunH) + ' t' : ''}</span><span class="w7wind">${d.windDir != null ? `<svg width="12" height="12" viewBox="0 0 24 24" style="transform:rotate(${d.windDir + 180}deg)"><path d="M12 3l6 16-6-4-6 4z" fill="currentColor"/></svg>` : ''}${num(d.wind, 0)}</span><span class="w7min">${fmtTemp(d.min)}</span>
        <div class="rng"><i style="left:${((d.min - minT) / span) * 100}%;right:${100 - ((d.max - minT) / span) * 100}%"></i></div><span class="w7max">${fmtTemp(d.max)}</span></button>`).join('')}</div></section>
    </div>`;
  }
  const cmp = D.compare ? `<section class="card"><div class="lab">Sammenligning af kilder · ${esc(placeLabel(place))} · i dag og i morgen</div>
    <div style="overflow-x:auto"><table class="cmp"><thead><tr><th>Kilde</th><th>Nu</th><th class="n">I dag maks/min</th><th class="n">Nedbør i dag</th><th class="n">I morgen maks/min</th><th class="n">Nedbør i morgen</th></tr></thead><tbody>
    ${D.compare.map((r) => r.err ? `<tr><td>${esc(r.name)}</td><td colspan="5" class="err">${esc(r.err)}</td></tr>` : `<tr class="${r.id === settings.weather.model ? 'sel' : ''}"><td>${esc(r.name)}</td><td>${fmtTemp(r.d.now.temp)} ${esc(W.codeText(r.d.now.code).toLowerCase())}</td><td class="n">${fmtTemp(r.d.days[0].max)} / ${fmtTemp(r.d.days[0].min)}</td><td class="n">${num(r.d.days[0].rain)} mm</td><td class="n">${fmtTemp(r.d.days[1].max)} / ${fmtTemp(r.d.days[1].min)}</td><td class="n">${num(r.d.days[1].rain)} mm</td></tr>`).join('')}
    </tbody></table></div></section>` : '';
  return `<div class="ptitle"><h1>Vejret</h1>${seg}<div class="tools"><button class="btn line" data-act="compare" aria-pressed="${!!D.compare}">${D.compare ? 'Luk sammenligning' : 'Sammenlign kilder'}</button></div></div>
    ${cmp}${body}`;
}

/* ---------- Screens (Somfy) ---------- */
function pageSomfy() {
  const st = SF.state;
  const head = '<div class="ptitle"><h1>Screens</h1></div>';
  if (!st.checked) return head + '<div class="empty">Henter fra Somfy …</div>';
  if (st.configured === false) return head + '<div class="empty">Somfy er ikke sat op endnu (Indstillinger → Forbindelse).</div>';
  if (!st.devices.length) return head + `<div class="empty">${esc(st.error || 'Ingen screens fundet i Somfy.')}</div>`;
  const presets = settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS;
  const pbtns = (devs) => { const k = devs.map((d) => d.url).join('|'); return `${presets.map((p) => `<button data-act="sfPreset" data-urls="${esc(k)}" data-v="${esc(String(p.v))}" aria-pressed="${devs.every((x) => SF.atPreset(x, p.v))}">${esc(p.name)}</button>`).join('')}<button class="sfstop" data-act="sfCmd" data-urls="${esc(k)}" data-cmd="stop" aria-label="Stop">${fillSvg('stop', 12)}</button>`; };
  const awn = (d) => d.ui === 'Awning' || d.ui === 'Pergola';
  const card = (d) => {
    const v = d.closure === null || d.closure === undefined ? null : Math.round(+d.closure);
    const busy = !!st.busy[d.url];
    return `<section class="card sfcard${d.available ? '' : ' off'}${busy ? ' busy' : ''}">
      <div class="sfc-head"><b title="${esc(d.label)}">${esc(d.label)}</b><span>${esc(SF.stateText(d) || (d.rts ? 'RTS' : ''))}</span></div>
      <div class="sfc-body">
        <div class="sfwin ${awn(d) ? 'awning' : ''}" aria-hidden="true"><i style="height:${v === null ? 50 : Math.max(4, v)}%;${v === null ? 'opacity:.35' : ''}"></i></div>
        ${v !== null && !d.rts && d.commands.some((c) => c === 'setClosure' || c === 'setDeployment') ? `<input class="sfslider" type="range" min="0" max="100" step="5" value="${v}" data-sfpos="${esc(d.url)}" aria-label="${awn(d) ? 'Hvor langt ude' : 'Hvor langt nede'} – ${esc(d.label)}" orient="vertical">` : ''}
      </div>
      <div class="sfc-btns sfp">${pbtns([d])}</div>
    </section>`;
  };
  // Alle screens på én gang – også med skyder, ligesom den enkelte screen
  const pos = st.devices.filter((d) => d.closure !== null && d.closure !== undefined && !awn(d));
  const avg = pos.length ? Math.round(pos.reduce((a, d) => a + +d.closure, 0) / pos.length / 5) * 5 : null;
  const canSlide = st.devices.some((d) => !d.rts && d.commands.some((c) => c === 'setClosure' || c === 'setDeployment'));
  const all = st.devices.length > 1 ? `<section class="card sfallcard"><div class="sfall-l"><b>Alle screens</b><span>${avg === null ? '' : avg <= 2 ? 'Oppe' : avg >= 98 ? 'Nede' : `I gennemsnit ${avg} % nede`}</span></div>
    ${canSlide ? `<div class="sfall-win"><div class="sfwin" aria-hidden="true"><i style="height:${avg === null ? 50 : Math.max(4, avg)}%"></i></div><input class="sfslider sfh" type="range" min="0" max="100" step="5" value="${avg ?? 0}" data-sfposall="1" aria-label="Hvor langt nede – alle screens"></div>` : ''}
    <div class="sfp">${pbtns(st.devices)}</div></section>` : '';
  return head + all + `<div class="sfgrid" style="--n:${st.devices.length}">${st.devices.map(card).join('')}</div>`;
}

/* ---------- Nyheder ---------- */
function pageNyheder() {
  const srcs = newsSources();
  const all = D.news ? D.news.items : [];
  // Blandet: kilderne skiftes, så ét medie ikke fylder det hele. Én kilde: kun den.
  const mixed = () => { const by = {}; all.forEach((i) => { (by[i.sourceId] = by[i.sourceId] || []).push(i); }); const ls = Object.values(by); const out = []; for (let r = 0; out.length < all.length; r++) { let any = false; ls.forEach((l) => { if (l[r]) { out.push(l[r]); any = true; } }); if (!any) break; } return out; };
  const items = (ui.newsFilter ? all.filter((i) => i.sourceId === ui.newsFilter) : mixed()).slice(0, 60);
  const view = settings.newsView || 'read';
  if (!items.find((i) => i.link === ui.newsSel)) ui.newsSel = items[0] ? items[0].link : null;
  const sel = items.find((i) => i.link === ui.newsSel);
  const views = `<div class="wseg">${[['read', 'Læs'], ['grid', 'Overblik'], ['list', 'Liste']].map(([v, l]) => `<button data-act="newsView" data-v="${v}" aria-pressed="${view === v}"><span>${l}</span></button>`).join('')}</div>`;
  const chips = `<div class="nfilter">${[{ id: '', name: 'Blandet' }].concat(srcs).map((x) => `<button class="chipbtn" data-act="newsFilter" data-id="${esc(x.id)}" aria-pressed="${(ui.newsFilter || '') === x.id}"><span class="cbt">${esc(x.name)}</span></button>`).join('')}</div>`;
  const list = items.map((i) => `<button class="nrow ${i.link === ui.newsSel ? 'on' : ''}" data-act="newsPick" data-url="${esc(i.link)}">${i.image ? `<span class="nthumb" style="background-image:url('${esc(i.image)}')"></span>` : ''}<span class="ntx"><span class="meta">${esc(i.source)}${i.date ? ' · ' + esc(relTime(i.date)) : ''}</span><b>${esc(i.title)}</b></span></button>`).join('');
  const top = `<div class="ptitle"><h1>Nyheder</h1>${views}${chips}<div class="tools"><button class="btn line" data-act="newsRefresh" aria-label="Opdater nyhederne">${svg('refresh', 18)}</button></div></div>`;
  const none = `<div class="empty">${D.news ? 'Ingen nyheder lige nu.' : 'Henter nyheder …'}</div>`;
  if (view === 'grid') return top + (items.length ? `<div class="ngrid">${items.map((i) => `<a class="ncard" href="${esc(i.link)}" data-read="${esc(i.source)}" target="_blank" rel="noopener">${i.image ? `<span class="ncimg" style="background-image:url('${esc(i.image)}')"></span>` : ''}<span class="nctx"><span class="meta">${esc(i.source)}${i.date ? ' · ' + esc(relTime(i.date)) : ''}</span><b>${esc(i.title)}</b></span></a>`).join('')}</div>` : none);
  if (view === 'list') return top + (items.length ? `<section class="card nlist2">${items.map((i) => `<a class="nl" href="${esc(i.link)}" data-read="${esc(i.source)}" target="_blank" rel="noopener"><span class="nlsrc">${esc(i.source)}</span><b>${esc(i.title)}</b><span class="nltime">${i.date ? esc(relTime(i.date)) : ''}</span></a>`).join('')}</section>` : none);
  let pane = '<div class="empty">Vælg en nyhed.</div>';
  if (sel) {
    const a = R.cachedArticle(sel.link);
    pane = a ? R.articleFrame(a) : ui.newsErr === sel.link ? `<div class="npfail">${sel.image ? `<img src="${esc(sel.image)}" alt="">` : ''}<h2>${esc(sel.title)}</h2><a class="btn line" href="${esc(sel.link)}" target="_blank" rel="noopener">Læs på mediets egen side</a></div>` : '<div class="empty">Henter artiklen …</div>';
    if (!a && ui.newsErr !== sel.link) R.loadArticle(sel.link, sel.source, sel.image).then(() => { if (ui.page === 'nyheder') renderMain(); }).catch(() => { ui.newsErr = sel.link; if (ui.page === 'nyheder') renderMain(); });
  }
  return `${top}
    <div class="newspage"><section class="card nside">${list || `<div class="empty">${D.news ? 'Ingen nyheder lige nu.' : 'Henter nyheder …'}</div>`}</section><section class="card npane">${pane}</section></div>`;
}

/* ---------- Musik ---------- */
function sonosRooms() {
  const cg = S.currentGroup();
  const members = cg ? cg.playerIds || [] : [];
  const coord = cg ? cg.coordinatorId : null;
  const players = [...S.state.players].sort((x, y) => x.name.localeCompare(y.name, 'da'));
  const rows = players.map((pl) => {
    const inG = members.includes(pl.id);
    const isCoord = pl.id === coord;
    const other = !inG ? S.groupOfPlayer(pl.id) : null;
    const vol = S.state.playerVol[pl.id];
    const status = isCoord ? 'styrer' : inG ? 'med' : other && other.playerIds.length > 1 ? esc(other.name) : other && other.playbackState === 'PLAYBACK_STATE_PLAYING' ? 'spiller selv' : 'ledig';
    return `<div class="room ${inG ? 'on' : ''}">
      <button class="rtoggle" data-act="sMember" data-pid="${esc(pl.id)}" aria-pressed="${inG}" ${isCoord && members.length < 2 ? 'disabled' : ''} aria-label="${inG ? 'Tag ' + esc(pl.name) + ' ud af gruppen' : 'Føj ' + esc(pl.name) + ' til gruppen'}"><span class="rbox">${inG ? '✓' : ''}</span><span class="rname"><b>${esc(pl.name)}</b><span class="psub">${status}</span></span></button>
      ${inG && vol !== undefined && vol !== null ? `<input class="rslider" type="range" min="0" max="100" value="${vol}" data-pvol="${esc(pl.id)}" aria-label="Lydstyrke i ${esc(pl.name)}">` : ''}
    </div>`;
  }).join('');
  return `<section class="card mcol">
      <div class="mhead"><span class="lab">Rum</span></div>
      <div class="rooms mscroll">${rows || '<span class="muted">Ingen rum fundet</span>'}</div>
    </section>`;
}
function pageMusik() {
  if (!hasProxy()) return `<div class="ptitle"><h1>Musik</h1></div>${needProxyMsg('Sonos')}`;
  if (!S.state.connected) return `<div class="ptitle"><h1>Musik</h1></div><section class="card"><b style="font-size:18px">Forbind jeres Sonos</b>
    <div><button class="btn primary big" data-act="sConnect">Forbind Sonos</button></div>${S.state.error ? `<div class="err">${esc(S.state.error)}</div>` : ''}</section>`;
  const np = S.nowPlaying();
  const nowFav = S.playingFavId();
  const tile = (act, id, name, img) => `<button class="mtile${act === 'sFav' && id === nowFav ? ' playing' : ''}" data-act="${act}" data-id="${esc(id)}" ${act === 'sFav' && id === nowFav ? 'aria-current="true"' : ''}><i style="${img ? `background-image:url('${esc(img)}')` : ''}"></i><span>${esc(name)}</span></button>`;
  const favs = S.favorites().map((f) => tile('sFav', f.id, f.name, S.art(f))).join('');
  const pls = S.state.playlists.map((pl) => tile('sPlaylist', pl.id, pl.name, S.art(pl))).join('');
  return `<div class="music">
    <section class="player mplayer">
      <div class="art" style="${np.image ? `background-image:url('${esc(np.image)}')` : ''}"></div>
      <div class="mnow"><b>${esc(np.title || 'Intet spiller')}</b><span>${esc(np.artist || '')}</span><span class="mgrp">${esc(np.group)}</span></div>
      <div class="ctl"><button class="mode" data-act="sShuffle" aria-pressed="${!!np.modes.shuffle}" aria-label="Bland sangene">${svg('shuffle', 20)}</button><button data-act="sPrev" aria-label="Forrige">${fillSvg('prev', 18)}</button><button class="pbig" data-act="sPlay" aria-label="${np.playing ? 'Pause' : 'Afspil'}">${fillSvg(np.playing ? 'pause' : 'play', 22)}</button><button data-act="sNext" aria-label="Næste">${fillSvg('next', 18)}</button><button class="mode" data-act="sRepeat" aria-pressed="${!!(np.modes.repeat || np.modes.repeatOne)}" aria-label="${np.modes.repeatOne ? 'Gentag én sang' : np.modes.repeat ? 'Gentag hele listen' : 'Gentag fra'}">${svg('repeat', 20)}${np.modes.repeatOne ? '<i>1</i>' : ''}</button></div>
      <div class="mqueue">${np.source ? `<div class="mq-src" title="${esc(np.source)}">Fra ${esc(np.source)}</div>` : ''}${np.next ? `<div class="mq-lab">Næste</div><div class="mq-row"><span class="mq-art" style="${np.next.image ? `background-image:url('${esc(np.next.image)}')` : ''}"></span><span class="mq-txt"><b>${esc(np.next.title)}</b><span>${esc(np.next.artist)}</span></span></div>` : ''}</div>
      ${np.volume !== null ? `<label class="vol"><span class="small">Lyd</span><input type="range" min="0" max="100" value="${np.volume}" data-vol aria-label="Lydstyrke for hele gruppen"></label>` : ''}
    </section>
    ${sonosRooms()}
    <section class="card mcol">
      <div class="mhead"><span class="lab">Favoritter</span><button class="chipbtn" data-act="sReload" aria-label="Opdater rum og favoritter">${svg('refresh', 16)}</button></div>
      <div class="mscroll"><div class="mtiles">${favs || '<span class="muted small">Ingen favoritter endnu.</span>'}</div>
        ${pls ? `<div class="lab" style="margin:12px 0 8px">Sonos-playlister</div><div class="mtiles">${pls}</div>` : ''}</div>
      
    </section>
    ${S.state.error ? `<div class="err" style="grid-column:1/-1">${esc(S.state.error)}</div>` : ''}
  </div>`;
}

/* ---------- DR TV ---------- */
function pageTv() {
  return `<div class="ptitle"><h1>DR TV</h1></div>
    <div class="tvgrid">${settings.tv.channels.map((c) => `<a class="tvtile" href="${esc(c.url)}" target="_blank" rel="noopener">${fillSvg('play', 36)}${esc(c.name)}<small>Åbner DRTV</small></a>`).join('')}</div>`;
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

// Vejrkortets intervaller: 15 min, 30 min eller 1 time (indstilles under Vejr)
function wxSteps(w, n) {
  const step = +settings.weather.step || 60;
  if (step >= 60 || !w.quarters || !w.quarters.length) return w.hours.slice(0, n);
  const q = w.quarters; const per = step / 15; const out = [];
  const first = q.findIndex((x) => x.time.getMinutes() % step === 0);
  for (let i = Math.max(0, first); i < q.length && out.length < n; i += per) {
    const part = q.slice(i, i + per);
    out.push({ ...q[i], rain: part.reduce((a, x) => a + (x.rain || 0), 0) });
  }
  return out;
}
function sonosConnSection() {
  return `<section class="card"><b>Sonos</b><div class="muted">${!hasProxy() ? 'Opsæt forbindelsen først.' : S.state.connected ? 'Forbundet.' : 'Ikke forbundet.'}</div>
      <div class="row">${hasProxy() && !S.state.connected ? '<button class="btn primary" data-act="sConnect">Forbind Sonos</button>' : ''}${S.state.connected ? '<button class="btn line" data-act="sLogout">Afbryd Sonos</button>' : ''}</div>
      ${settings.proxy.url ? `<div class="empty" style="display:flex;flex-direction:column;gap:6px"><b>Redirect-adresse til Sonos</b><span class="small">Skal stå præcis sådan under Redirect URI i jeres Sonos-integration:</span>
        <code id="redir" style="user-select:all;font-size:15px;word-break:break-all">${esc(settings.proxy.url.replace(/\/+$/, '') + '/sonos/callback')}</code>
        <div><button class="btn" data-act="copyRedir">Kopiér adressen</button></div></div>` : ''}</section>`;
}
function calSection(s) {
  return `<section class="card wide"><b>Kalendere</b>
      <details class="howto"><summary>Sådan finder du kalenderlinket</summary><p class="note">Indsæt et link for hver kalender (fx én pr. familiemedlem). <b>iPhone/iPad:</b> Kalender → Kalendere → tryk ⓘ ved kalenderen → slå <i>Offentlig kalender</i> til → <i>Del link</i> → Kopiér. <b>Mac:</b> Kalender → højreklik på kalenderen → Del kalender → <i>Offentlig kalender</i> → kopiér adressen. Linket starter med <code>webcal://</code> – det klarer dashboardet. Andre: Google ("Hemmelig adresse i iCal-format") og Outlook (ICS-link) virker også. Behandl linkene som adgangskoder.</p></details>
      <div class="calgrid">${s.calendars.map((c, i) => { const err = D.cal && D.cal.errors.find((e) => e.cal === c.name); const open = ui.calEdit === c.id || !c.url; const own = members().find((m) => m.id === c.owner); return `<div class="caltile ${open ? 'open' : ''} ${err ? 'bad' : ''}" style="--c:${esc(c.color)}">
        <label class="caldot" title="Farve"><input type="color" data-cal="${i}" data-field="color" value="${esc(c.color)}" aria-label="Farve for ${esc(c.name)}"></label>
        <input class="calname" type="text" data-cal="${i}" data-field="name" value="${esc(c.name)}" aria-label="Navn">
        ${err ? `<span class="calwarn" title="${esc(err.msg)}">!</span>` : ''}
        <select class="calown" data-cal="${i}" data-field="owner" aria-label="Hvis kalender" style="${own ? `--o:${esc(own.color)}` : ''}"><option value="">Fælles</option>${members().map((m) => `<option value="${esc(m.id)}" ${c.owner === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
        <button class="calbtn" data-act="calEdit" data-id="${esc(c.id)}" aria-label="Rediger link for ${esc(c.name)}" aria-expanded="${open}">${ico('edit', 16)}</button>
        <button class="calbtn" data-act="calRm" data-i="${i}" aria-label="Fjern ${esc(c.name)}">×</button>
        ${open ? `<input class="calurl" type="url" data-cal="${i}" data-field="url" value="${esc(c.url)}" placeholder="Indsæt kalenderlink (webcal:// eller https://)" aria-label="Kalenderlink">` : ''}
      </div>`; }).join('')}
      <button class="caladd" data-act="calAdd">+ Tilføj kalender</button></div>
      </section>`;
}
function cdSection(s) {
  return `<section class="card wide"><div class="sechead2"><b>Nedtællinger</b><button class="svc mini ${settings.cdTop ? 'on' : ''}" data-act="cdTopToggle" role="switch" aria-checked="${!!settings.cdTop}"><span>Vis øverst på skærmen</span><span class="tgl" aria-hidden="true"><i></i></span></button></div>
      <div class="cdrows">${(s.countdowns || []).map((c, i) => { const img = M.getImage(c.imageId); return `<div class="cdrow">
        <button class="cdthumb" data-act="cdImg" data-i="${i}" aria-label="Vælg billede til ${esc(c.name || 'nedtælling')}" style="${img ? `background-image:url('${img}')` : ''}">${img ? '' : '+ billede'}</button>
        <label class="f">Navn<input type="text" data-cd="${i}" data-field="name" value="${esc(c.name)}" placeholder="Fx Sommerferie"></label>
        <label class="f">Dato<input type="date" data-cd="${i}" data-field="date" value="${esc(c.date)}"></label>
        <span class="cdshow"><label class="check small"><input type="checkbox" data-cdshow="${i}" data-k="showCard" ${c.showCard !== false ? 'checked' : ''}>Vis i kortet på forsiden</label>${settings.cdTop ? `<label class="check small"><input type="radio" name="cdtop" data-cdtop="${esc(c.id)}" ${settings.cdTop === c.id ? 'checked' : ''}>Vis øverst på skærmen</label>` : ''}</span>
        <span class="row" style="gap:6px">${c.imageId ? `<button class="ibtn" data-act="cdImgRm" data-i="${i}">Fjern billede</button>` : ''}<button class="ibtn danger" data-act="cdRm" data-i="${i}" aria-label="Slet nedtællingen ${esc(c.name)}">Slet</button></span>
      </div>`; }).join('')}</div>
      <input type="file" id="cdFile" accept="image/*" hidden>
      <div><button class="btn primary" data-act="cdAdd">+ Tilføj nedtælling</button></div>
      ${ui.cdMsg ? `<div class="small ${ui.cdMsg.err ? 'err' : 'muted'}">${esc(ui.cdMsg.text)}</div>` : ''}
    </section>`;
}
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
      <div class="sechead"><div><h2>Steder</h2></div></div>
      <ul class="plist">${rows}</ul>
      <div class="addbox">
        <label class="search">${ico('search', 20)}<input type="text" id="geoQ" placeholder="Tilføj sted – søg fx Skagen eller Spodsbjerg" aria-label="Søg efter et sted at tilføje" enterkeyhint="search"></label>
        <button class="btn primary" data-act="geoSearch">Søg</button>
      </div>
      ${results}${ui.geoMsg ? `<div class="err">${esc(ui.geoMsg)}</div>` : ''}
    </section>
    <section class="card wide">
      <div class="sechead"><div><h2>Vejrkilde</h2></div></div>
      <div class="srgrid">${sources}</div>
    </section>
    <section class="card">
      <div class="sechead"><div><h2>Interval i vejrkortet</h2></div></div>
      <div class="row">${[[15, '15 min'], [30, '30 min'], [60, '1 time']].map(([v, l]) => `<button class="pill" data-act="wStepSet" data-v="${v}" aria-pressed="${(+s.weather.step || 60) === v}">${l}</button>`).join('')}</div>
    </section>`;
}

function lookSettings() {
  const lk = L.getLook();
  const tiles = L.BACKGROUNDS.map((b) => `<button class="bgtile" data-act="bgPick" data-id="${b.id}" aria-pressed="${lk.bg === b.id}"><span class="bgprev" style="background:${b.css || 'var(--bg)'}"></span><span>${esc(b.name)}</span></button>`).join('')
    + `<button class="bgtile" data-act="bgFile" aria-pressed="${lk.bg === 'image'}"><span class="bgprev bgplus">${lk.bg === 'image' && L.hasLocalImage() ? '' : '+'}</span><span>Eget billede</span></button>`;
  const alpha = lk.alpha ?? 100;
  return `
    <section class="card wide"><b>Baggrund</b>
      <div class="bgtiles">${tiles}</div>
      <input type="file" id="bgFileInput" accept="image/*" hidden>
      <div class="row" style="flex-wrap:nowrap"><input type="url" id="bgUrl" placeholder="Eller indsæt adressen på et billede (https://…)" value="${esc(lk.bg === 'url' ? lk.url : '')}" aria-label="Billedadresse"><button class="btn primary" data-act="bgUrl">Brug</button></div>
      ${ui.bgMsg ? `<div class="small ${ui.bgMsg.err ? 'err' : 'muted'}">${esc(ui.bgMsg.text)}</div>` : ''}
    </section>
    <section class="card"><b>Kortenes gennemsigtighed</b>
      <label class="vol" style="max-width:520px"><span class="small" style="width:44px">${alpha} %</span><input type="range" min="40" max="100" step="5" value="${alpha}" data-look-alpha aria-label="Kortenes dækkevne i procent"></label>
      <label class="check"><input type="checkbox" data-look-blur ${lk.blur !== false ? 'checked' : ''}>Slør baggrunden bag kortene, så teksten er nem at læse</label>
    </section>`;
}
const SET_TABS = [
  { id: 'familie', label: 'Familie' },
  { id: 'tjenester', label: 'Tjenester' },
  { id: 'vejr', label: 'Vejret' }, { id: 'nyheder', label: 'Nyheder' }, { id: 'kalender', label: 'Kalender' }, 
  { id: 'musik', label: 'Musik' }, { id: 'tv', label: 'DR TV' }, { id: 'somfy', label: 'Somfy' }, { id: 'fodbold', label: 'Fodbold' }, { id: 'udseende', label: 'Udseende' }, { id: 'forbindelse', label: 'Forbindelse' }
];
function pageIndstillinger() {
  const s = settings;
  const groups = {};
  N.allSources().forEach((src) => { (groups[src.group] = groups[src.group] || []).push(src); });
  const tabs = SET_TABS.filter((t) => tabOn(t.id));
  const tab = tabs.some((t) => t.id === ui.setTab) ? ui.setTab : 'familie';
  const needsConn = ['nyheder', 'kalender', 'musik'].includes(tab) && !hasProxy();
  const T = {
    tjenester: () => `<section class="card wide"><div class="store">${SERVICES.map((x) => { const on = svcOn(x.id); return `<button class="svc ${on ? 'on' : ''}" data-act="svcToggle" data-id="${x.id}" role="switch" aria-checked="${on}">
      <span class="appico">${svg(x.icon, 30)}</span><span class="appmain"><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></span><span class="tgl" aria-hidden="true"><i></i></span></button>`; }).join('')}</div></section>`,
    vejr: () => vejrSettings(),
    fodbold: () => fodboldSettings(),
    nyheder: () => `
    <section class="card wide"><div class="sechead2"><b>Nyhedskilder</b><label class="inl">Skift kilde i kortet<select data-set="news.rotateSecs" aria-label="Skift kilde i nyhedskortet">${[10, 15, 20, 30, 45, 60, 0].map((v) => `<option value="${v}" ${newsSecs() === v ? 'selected' : ''}>${v ? 'hvert ' + v + '. sek' : 'aldrig'}</option>`).join('')}</select></label></div>
      <div class="srcgrid">${Object.values(groups).flat().map((src) => `<label class="srcchip"><input type="checkbox" data-news="${esc(src.id)}" ${s.news.sources.includes(src.id) ? 'checked' : ''}><span class="srcname" title="${esc(src.name)}">${esc(src.name)}</span>${src.unverified ? '<span class="srcq" title="Afprøves">?</span>' : ''}${src.custom ? `<button class="srcx" data-act="customRm" data-id="${esc(src.id)}" aria-label="Fjern ${esc(src.name)}">×</button>` : ''}</label>`).join('')}</div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="cName" placeholder="Egen kilde: navn" aria-label="Navn på egen kilde" value="${esc(ui.feedDraft ? ui.feedDraft.name : '')}"><input type="url" id="cUrl" placeholder="RSS- eller nyhedsside-adresse" aria-label="Adresse" value="${esc(ui.feedDraft ? ui.feedDraft.url : '')}"><button class="btn primary" data-act="customAdd">Tilføj</button></div>
      ${ui.feedMsg ? `<div class="small ${ui.feedMsg.err ? 'err' : 'muted'}">${esc(ui.feedMsg.text)}</div>` : ''}
      ${D.news && D.news.errors.length ? `<div class="err small">Virker ikke lige nu: ${esc(D.news.errors.map((e) => e.source + ' (' + e.msg + ')').join(' · '))}</div>` : ''}</section>`,
    kalender: () => `
    ${svcOn('kalender') ? calSection(s) : ''}
    ${svcOn('nedtaelling') ? cdSection(s) : ''}`,
    tv: () => `
    <section class="card"><b>DR TV-knapper</b>${s.tv.channels.map((c, i) => `<div class="calrow" style="grid-template-columns:1fr 2fr auto"><input type="text" data-tv="${i}" data-field="name" value="${esc(c.name)}" aria-label="Navn"><input type="url" data-tv="${i}" data-field="url" value="${esc(c.url)}" aria-label="Adresse"><button class="btn" data-act="tvRm" data-i="${i}">Fjern</button></div>`).join('')}
      <div><button class="btn" data-act="tvAdd">+ Tilføj knap</button></div></section>`,
    udseende: () => lookSettings() + `
    <section class="card wide"><b>Farvetema</b>${themePicker()}
      ${s.theme === 'auto' ? `<div class="form"><label class="f">Om dagen<select data-set="dayTheme">${Object.keys(THEMES).map((k) => `<option value="${k}" ${s.dayTheme === k ? 'selected' : ''}>${THEMES[k].label}</option>`).join('')}</select></label>
        <label class="f">Efter solnedgang<select data-set="nightTheme">${Object.keys(THEMES).map((k) => `<option value="${k}" ${s.nightTheme === k ? 'selected' : ''}>${THEMES[k].label}</option>`).join('')}</select></label></div>` : ''}</section>`,
    musik: () => {
      const fav = S.favorites(true); const hidden = settings.sonos.favHidden || [];
      return `<section class="card wide"><b>Favoritter</b>
        ${!S.state.connected ? '<div class="muted">Forbind Sonos under Forbindelse for at se jeres favoritter.</div>' : !fav.length ? '<div class="muted">Ingen favoritter i Sonos endnu.</div>' : `<div class="favorder">${fav.map((f, i) => `<div class="forow${hidden.includes(f.id) ? ' off' : ''}">
          <span class="foart" style="${S.art(f) ? `background-image:url('${esc(S.art(f))}')` : ''}"></span><b title="${esc(f.name)}">${esc(f.name)}</b>
          <button class="fobtn" data-act="favMove" data-id="${esc(f.id)}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Flyt ${esc(f.name)} op">${svg('up', 18)}</button>
          <button class="fobtn" data-act="favMove" data-id="${esc(f.id)}" data-d="1" ${i === fav.length - 1 ? 'disabled' : ''} aria-label="Flyt ${esc(f.name)} ned">${svg('down', 18)}</button>
          <label class="check small"><input type="checkbox" data-favshow="${esc(f.id)}" ${hidden.includes(f.id) ? '' : 'checked'}>Vis</label></div>`).join('')}</div>`}
      </section>`;
    },
    somfy: () => { const l = settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS; return `
    <section class="card"><b>Knapper på Screens-kortet</b>
      <div class="sprows">${l.map((p, i) => `<div class="sprow"><input type="text" data-sp="${i}" data-field="name" value="${esc(p.name)}" aria-label="Navn på knap"><select data-sp="${i}" data-field="v" aria-label="Stilling">${[['0', 'Helt op / inde'], ['25', '25 % nede'], ['50', 'Halvt nede'], ['75', '75 % nede'], ['90', '90 % nede'], ['100', 'Helt nede / ude'], ['my', 'My-stilling']].map(([v, t]) => `<option value="${v}" ${String(p.v) === v ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn" data-act="spRm" data-i="${i}" aria-label="Fjern ${esc(p.name)}">Fjern</button></div>`).join('')}</div>
      <div class="row"><button class="btn primary" data-act="spAdd">+ Tilføj knap</button>${settings.somfyPresets && settings.somfyPresets.length ? '<button class="btn line" data-act="spReset">Standard</button>' : ''}</div>
      <details class="howto"><summary>Om mellemstillinger</summary><p class="note">Halvt, 25 % osv. virker kun med Somfy io-motorer. Ældre RTS-motorer kan kun køre helt op, helt ned eller til deres my-stilling.</p></details>
    </section>`; },
    familie: () => `
    <section class="card"><b>Familien</b>
      <label class="f">Familienavn (bruges ved login)<input type="text" data-set="family.name" value="${esc(s.family.name)}" placeholder="Fx Familien Riksted"></label>
      <div class="memrows">${s.family.members.map((m, i) => `<div class="memrow"><span class="avatar" style="--c:${esc(m.color)}" aria-hidden="true">${esc(initials(m.name))}</span>
        <input type="text" data-mem="${i}" data-field="name" value="${esc(m.name)}" placeholder="Navn" aria-label="Navn">
        <input type="color" data-mem="${i}" data-field="color" value="${esc(m.color)}" aria-label="Farve">
        <button class="btn" data-act="memRm" data-i="${i}" aria-label="Fjern ${esc(m.name)}">Fjern</button></div>`).join('')}</div>
      <div><button class="btn primary" data-act="memAdd">+ Tilføj familiemedlem</button></div>
    </section>
    <section class="card"><b>Familie-login</b>
      <div class="form"><label class="f">Ny familiekode<input type="password" id="famCode" autocomplete="new-password"></label>
      <label class="f">Gentag koden<input type="password" id="famCode2" autocomplete="new-password"></label></div>
      <div class="row"><button class="btn primary" data-act="famCodeSave">Gem familiekode</button>${ui.famMsg ? `<span class="small ${ui.famMsg.err ? 'err' : 'muted'}">${esc(ui.famMsg.text)}</span>` : ''}</div>
      <div class="row" style="border-top:1.5px solid var(--line);padding-top:12px"><button class="btn line" data-act="logoutHere">Log denne skærm ud</button><button class="btn line danger" data-act="logoutAll">Log alle skærme ud</button></div>
    </section>`,
    forbindelse: () => `
    <section class="card"><b>Forbindelse til jeres server</b>
      <div class="form"><label class="f">Worker-adresse<input type="url" data-set="proxy.url" value="${esc(s.proxy.url)}" placeholder="https://easyhome.ditnavn.workers.dev" autocomplete="off"></label>
      <label class="f">Nøgle (DASH_KEY)<input type="password" data-set="proxy.key" value="${esc(s.proxy.key)}" autocomplete="off"></label></div>
      <div class="row"><button class="btn primary" data-act="testConn">Test forbindelse</button><span class="small" id="connMsg">${esc(ui.connMsg)}</span></div>
      ${hasProxy() ? `<div class="small ${syncState.ok === false ? 'err' : 'muted'}"><b>Deling mellem skærme:</b> ${syncState.ok === false ? esc(syncState.msg) : syncState.last ? 'aktiv ✓ – senest ' + hhmm(syncState.last) : 'starter …'}</div>` : ''}
</section>
      ${svcOn('musik') ? sonosConnSection() : ''}
      ${svcOn('somfy') ? `<section class="card"><b>Somfy</b>
        <div class="muted">${SF.state.configured === false ? 'Ikke sat op.' : SF.state.error ? esc(SF.state.error) : SF.state.checked ? `Forbundet · ${SF.state.devices.length} enheder` : 'Ikke tjekket endnu.'}</div>
        <div class="row"><button class="btn primary" data-act="sfTest">Test Somfy</button>${ui.sfMsg ? `<span class="small muted">${esc(ui.sfMsg)}</span>` : ''}</div>
        <details class="howto"><summary>Sådan sætter du Somfy op</summary><p class="note">Cloudflare → <b>Workers &amp; Pages</b> → <b>easyhome</b> → <b>Settings</b> → <b>Variables and Secrets</b> → <b>Add</b>. Tilføj to af typen <b>Secret</b>: <code>SOMFY_USER</code> (mailen I logger ind i TaHoma-appen med) og <code>SOMFY_PASSWORD</code> (adgangskoden). Tryk <b>Deploy</b>, og tryk derefter <b>Test Somfy</b> her.</p></details></section>` : ''}`
  };
  return `<div class="ptitle"><h1>Indstillinger</h1></div>
  <div class="tabs" role="tablist" aria-label="Indstillinger">${tabs.map((t) => `<button role="tab" class="tab" data-act="setTab" data-tab="${t.id}" aria-selected="${t.id === tab}">${esc(t.label)}</button>`).join('')}</div>
  ${needsConn ? '<div class="empty">Denne del kræver forbindelsen til jeres server. <button class="btn line" data-act="setTab" data-tab="forbindelse">Gå til Forbindelse</button></div>' : ''}
  <div class="form" role="tabpanel">${T[tab]()}</div>`;
}

const PAGE_RENDER = { somfy: pageSomfy, madro: () => '', forside: pageForside, kalender: pageKalender, vejr: pageVejr, nyheder: pageNyheder, musik: pageMusik, tv: pageTv, indstillinger: pageIndstillinger };

// Madro vises som hele appen i en ramme, der bliver liggende (så den ikke genindlæses ved hver opdatering)
let madroSub = '';
function showMadroFrame(on) {
  let f = document.getElementById('madroFrame');
  $('#main').hidden = on;
  if (!on) { if (f) f.hidden = true; return; }
  if (!f) { f = document.createElement('iframe'); f.id = 'madroFrame'; f.className = 'madroframe'; f.title = 'Madro'; f.src = MD.BASE + (madroSub ? '#' + madroSub : ''); $('#main').after(f); }
  else if (madroSub) { try { f.contentWindow.location.hash = madroSub; } catch (e) { /* ignorer */ } }
  madroSub = ''; f.hidden = false;
}
function renderMain(keepScroll = true) {
  const m = $('#main'); const y = m.scrollTop;
  if (ui.hdrPage !== ui.page) { ui.hdrPage = ui.page; renderHeader(); }
  showMadroFrame(ui.page === 'madro');
  m.innerHTML = PAGE_RENDER[ui.page]();
  if (ui.page === 'forside') { scaleGrid(); fitCards(); trimCards(); }
  if (keepScroll) m.scrollTop = y;
}
// Sørg for at kort som kalenderen altid viser alt: først kompakt visning, derefter scroll inde i kortet (størrelsen ændres aldrig)
function fitCards() {
  const grid = document.getElementById('grid'); if (!grid) return;
  const cell = parseFloat(getComputedStyle(grid).gridAutoRows) || 240;
  const gap = parseFloat(getComputedStyle(grid).rowGap) || 16;
  grid.querySelectorAll('.w[data-fit]').forEach((card) => {
    const base = +card.dataset.h || 1;
    card.style.setProperty('--h', base); card.classList.remove('compact', 'grown', 'scrolly', 'at-end');
    const over = () => card.scrollHeight > card.clientHeight + 2;
    if (!over()) return;
    card.classList.add('compact');
    if (!over()) return;
    // Størrelsen er brugerens valg: i stedet for at vokse kan man scrolle inde i kortet
    card.classList.add('scrolly');
    const edge = () => card.classList.toggle('at-end', card.scrollTop + card.clientHeight >= card.scrollHeight - 4);
    card.addEventListener('scroll', edge, { passive: true }); edge();
  });
}
// Lister (nyheder, dage, favoritter) viser kun hele elementer – det sidste, der ikke kan være der, fjernes
// Mellem/Små kort: forsiden lægges ud som ved Store (4 i bredden) og skaleres derefter ned,
// så tekst, ikoner og afstande bliver mindre i samme forhold som kortene.
function scaleGrid() {
  const wrap = document.querySelector('.gridwrap'); if (!wrap) return;
  const cols = gcols();
  const narrow = window.matchMedia('(max-width:900px)').matches;
  wrap.style.zoom = ''; wrap.style.width = '';
  const grid = document.getElementById('grid'); if (grid) grid.style.gridAutoRows = '';
  if (narrow) return;
  const k = cols > 4 ? 4 / cols : 1;
  if (k < 1) { const W = wrap.getBoundingClientRect().width; wrap.style.width = (W / k) + 'px'; wrap.style.zoom = k; }
  // Rækkehøjden tilpasses skærmen, så der altid er plads til 3 hele kort i højden uden at scrolle
  const m = $('#main'); const cs = getComputedStyle(m);
  let above = 0; [...m.children].forEach((el) => { if (el === wrap || el.classList.contains('editpanel') || el.offsetParent === null) return; if (el.compareDocumentPosition(wrap) & Node.DOCUMENT_POSITION_FOLLOWING) above += el.getBoundingClientRect().height + (parseFloat(getComputedStyle(m).rowGap) || 0); });
  const avail = m.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - above;
  const gap = (parseFloat(getComputedStyle(grid).rowGap) || 16) * k;
  const row = (avail - 2 * gap) / 3;
  if (grid && row > 120) grid.style.gridAutoRows = (row / k) + 'px';
}
function trimCards() {
  document.querySelectorAll('#grid .w [data-trim]').forEach((list) => {
    let guard = 60;
    while (guard-- > 0 && list.children.length > 1 && list.scrollHeight > list.clientHeight + 1) list.lastElementChild.remove();
    while (list.lastElementChild && list.lastElementChild.classList.contains('fb-sub')) list.lastElementChild.remove(); // ingen overskrift uden kampe under
  });
  // Stilling: er der ikke plads til hele klubnavnet, bruges forkortelsen (aldrig halve navne)
  document.querySelectorAll('#grid .st-tm b').forEach((b) => { if (b.scrollWidth > b.clientWidth + 1 && b.dataset.abbr) b.textContent = b.dataset.abbr; });
  // Lister, der må fylde resten af kortet: fjern de sidste, til hele kortet kan ses
  document.querySelectorAll('#grid .w [data-trimcard]').forEach((list) => {
    const card = list.closest('.w'); let guard = 20;
    const bottom = () => card.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(card).paddingBottom) || 0) + 1;
    while (guard-- > 0 && list.children.length && (card.scrollHeight > card.clientHeight + 1 || list.lastElementChild.getBoundingClientRect().bottom > bottom())) list.lastElementChild.remove();
    if (!list.children.length) list.remove();
  });
}
let fitTimer = null;
window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (ui.page === 'forside') renderMain(); }, 150); });
// Opdater kun hvis brugeren ikke er i gang med at skrive eller trække
function softRender() {
  if (ui.page === 'indstillinger' || drag) return;
  const ae = document.activeElement; if (ae && ae.closest && ae.closest('#main') && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; // man skriver

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
  if (!svcOn('nyheder')) return;
  if (!hasProxy() && !settings.news.publicProxyForTest) { D.news = null; renderFooter(); return; }
  try { D.news = await N.getNews(); } catch (e) { D.news = { items: [], errors: [{ source: 'Nyheder', msg: e.message }] }; }
  renderFooter(); softRender();
}
async function loadCal() {
  if (!svcOn('kalender')) return;
  try { D.cal = await C.getEvents(); } catch (e) { D.cal = { events: [], errors: [{ cal: 'Kalender', msg: e.message }] }; }
  softRender();
}
async function loadSonos(full = false) {
  if (!svcOn('musik')) { renderFooter(); return; }
  if (full || !S.state.checked) await S.status();
  if (S.state.connected) { if (full) S.state.household = null; await S.refresh(); }
  renderFooter();
  if (ui.page === 'musik' || (ui.page === 'forside' && curLayout().some((x) => x.id === 'sonos'))) softRender();
}
function loadFootball(force = false) { if (!svcOn('fodbold') || !hasProxy()) return;
  if (curLayout().some((x) => x.id === 'stilling')) stLeagues().forEach((L) => FB.loadTable(L.id).then(() => { if (ui.page === 'forside') softRender(); })); FB.load(force).then(() => { if (ui.page === 'forside' && curLayout().some((x) => x.id === 'fodbold')) softRender(); }); }
function loadAll() { loadFootball(); loadWeather(); loadNews(); loadCal(); loadSonos(true); if (svcOn('madro')) MD.start(); if (svcOn('somfy')) SF.refresh(); }

/* ---------- Handlinger ---------- */
const act = {
  nav: (b) => { if (settings.navOpen) { settings.navOpen = false; save(); } ui.page = b.dataset.page; ui.editing = false; ui.fbDay = null; history.replaceState(null, '', '#' + ui.page); renderNav(); renderMain(false); $('#main').focus({ preventScroll: true }); if (ui.page === 'musik') loadSonos(); },
  toggleNav: () => { settings.navOpen = !settings.navOpen; save(); renderNav(); },
  nextTheme: () => { const i = THEME_ORDER.indexOf(settings.theme); settings.theme = THEME_ORDER[(i + 1) % THEME_ORDER.length]; save(); applyTheme(); renderHeader(); if (ui.editing || ui.page === 'indstillinger') renderMain(); },
  setTheme: (b) => { settings.theme = b.dataset.theme; save(); applyTheme(); renderHeader(); renderMain(); },
  edit: () => { ui.editing = !ui.editing; renderHeader(); renderMain(); },
  toggleW: (b) => {
    const id = b.dataset.id; const i = editLayout().findIndex((x) => x.id === id);
    if (i >= 0) editLayout().splice(i, 1); else { const [w, h] = DEFAULT_SHAPE[id] || [1, 1]; editLayout().push({ id, w, h }); }
    save(); renderMain();
  },
  sizeFor: (b) => { ui.sizeFor = ui.sizeFor === b.dataset.id ? null : b.dataset.id; renderMain(); },
  resetMyLayout: () => { if (settings.layouts) delete settings.layouts[settings.me]; save(); renderMain(); },
  gridCols: (b) => { settings.gridColsBy = { ...(settings.gridColsBy || {}), [settings.me || '']: +b.dataset.v }; save(); renderMain(); },
  wOpt: (b) => { const x = editLayout().find((y) => y.id === b.dataset.id); if (x) { x[b.dataset.k] = +b.dataset.v; save(); renderMain(); } },
  shape: (b) => { const x = editLayout().find((y) => y.id === b.dataset.id); if (x) { x.w = +b.dataset.w; x.h = +b.dataset.h; delete x.size; ui.sizeFor = null; save(); renderMain(); } },
  calPrev: () => { ui.calWeek--; renderMain(); }, calNext: () => { ui.calWeek++; renderMain(); }, calToday: () => { ui.calWeek = 0; renderMain(); },
  wModel: (b) => { settings.weather.model = b.dataset.model; save(); D.wx = {}; renderMain(); loadWeather(); },
  compare: () => { if (D.compare) { D.compare = null; renderMain(); return; } D.compare = []; renderMain(false); loadCompare(); },
  svcToggle: (b) => {
    const id = b.dataset.id; settings.services = { ...(settings.services || {}), [id]: !svcOn(id) }; save();
    if (!pageOn(ui.page)) ui.page = 'forside';
    renderAll(); if (svcOn(id)) loadAll();
  },
  wStepSet: (b) => { settings.weather.step = +b.dataset.v; save(); renderMain(); },
  awake: () => { settings.keepAwake = !settings.keepAwake; save(); applyWakeLock(); renderNav(); toast(settings.keepAwake ? 'Skærmen holdes tændt' : 'Skærmen må slukke igen'); },
  favMove: (b) => {
    const ids = S.favorites(true).map((f) => f.id); const i = ids.indexOf(b.dataset.id); const j = i + +b.dataset.d;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; settings.sonos.favOrder = ids; save(); renderMain();
  },
  tmStart: (b) => { TM.start(+b.dataset.m); },
  tmPickOpen: () => { ui.tmPick = ''; renderTmPicker(); },
  tmPickClose: () => { ui.tmPick = null; renderTmPicker(); },
  tmKey: (b) => { ui.tmPick = (tmPickDigits() + b.dataset.k).slice(-6); renderTmPicker(); },
  tmBack: () => { ui.tmPick = tmPickDigits().slice(0, -1); renderTmPicker(); },
  tmPickAdd: (b) => { const p = tmPickParts(); let t = p.h * 3600 + p.m * 60 + p.s + +b.dataset.m * 60; t = Math.min(t, 99 * 3600 + 59 * 60 + 59); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s2 = t % 60; ui.tmPick = String(h).padStart(2, '0') + String(m).padStart(2, '0') + String(s2).padStart(2, '0'); renderTmPicker(); },
  tmPickStart: () => {
    const p = tmPickParts(); const sec = p.h * 3600 + p.m * 60 + p.s; if (!sec) return;
    const label = [p.h ? p.h + ' t' : '', p.m ? p.m + ' min' : '', p.s ? p.s + ' sek' : ''].filter(Boolean).join(' ');
    TM.start(sec / 60, label); ui.tmPick = null; renderTmPicker();
  },
  tmToggle: (b) => { TM.toggle(b.dataset.id); },
  tmAdd: (b) => { TM.add(b.dataset.id, +b.dataset.m); },
  tmRm: (b) => { TM.remove(b.dataset.id); timerTick(); },
  tmStopAll: () => { TM.stopAll(); timerTick(); },
  sfPreset: (b) => {
    const urls = b.dataset.urls.split('|'); const v = b.dataset.v === 'my' ? 'my' : +b.dataset.v;
    SF.preset(SF.state.devices.filter((d) => urls.includes(d.url)), v).then((skip) => { if (skip) toast(skip === 1 ? 'Én screen kan ikke stille sig på en mellemstilling' : skip + ' screens kan ikke stille sig på en mellemstilling'); }).catch((e) => toast('Somfy: ' + e.message));
  },
  spAdd: () => { settings.somfyPresets = (settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS.map((p) => ({ ...p }))).concat([{ id: uid(), name: 'Ny', v: 75 }]); save(); renderMain(); },
  spRm: (b) => { const l = (settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS.map((p) => ({ ...p }))); l.splice(+b.dataset.i, 1); settings.somfyPresets = l; save(); renderMain(); },
  spReset: () => { settings.somfyPresets = []; save(); renderMain(); },
  sfCmd: (b) => { SF.command(b.dataset.urls.split('|'), b.dataset.cmd).catch((e) => toast('Somfy: ' + e.message)); },
  sfTest: () => { ui.sfMsg = 'Tjekker …'; renderMain(); SF.refresh().then(() => { ui.sfMsg = SF.state.configured === false ? 'Somfy-login mangler i workeren.' : SF.state.error ? SF.state.error : `Forbundet ✓ ${SF.state.devices.length} enheder fundet.`; renderMain(); }); },
  mdRecipe: (b) => {
    const id = b.dataset.id; madroSub = 'opskrifter'; act.nav({ dataset: { page: 'madro' } });
    // Åbn opskriften inde i Madro, så snart Madro har hentet kogebogen
    let tries = 0; const t = setInterval(() => {
      const f = document.getElementById('madroFrame'); tries++;
      try { const w = f && f.contentWindow; if (w && w.getRecipe && w.getRecipe(id)) { clearInterval(t); w.openRecipe(id); } } catch (e) { /* ignorer */ }
      if (tries > 60) clearInterval(t);
    }, 250);
  },
  mdOpen: (b) => { madroSub = b.dataset.sub || ''; act.nav({ dataset: { page: 'madro' } }); },
  sShuffle: () => { const m = S.nowPlaying().modes; S.setPlayModes({ shuffle: !m.shuffle }).catch(() => toast('Sonos kunne ikke skifte')); renderMain(); },
  sRepeat: () => { const m = S.nowPlaying().modes; const nx = m.repeatOne ? { repeat: false, repeatOne: false } : m.repeat ? { repeat: false, repeatOne: true } : { repeat: true, repeatOne: false }; S.setPlayModes(nx).catch(() => toast('Sonos kunne ikke skifte')); renderMain(); },
  wxDay: (b) => { ui.wxDay = +b.dataset.i; renderMain(); },
  newsView: (b) => { settings.newsView = b.dataset.v; save(); renderMain(false); },
  newsPick: (b) => { ui.newsSel = b.dataset.url; renderMain(); },
  newsFilter: (b) => { ui.newsFilter = b.dataset.id; ui.newsSel = null; renderMain(false); },
  sVol: (b) => {
    if (!S.state.volume) return;
    const v = Math.max(0, Math.min(100, (S.state.volume.volume || 0) + +b.dataset.d));
    S.state.volume.volume = v; renderFooter();
    clearTimeout(volTimer); volTimer = setTimeout(() => sonosDo(() => S.setVolume(v)), 350);
  },
  pickMe: (b) => { settings.me = settings.me === b.dataset.id ? '' : b.dataset.id; save(); renderHeader(); renderMain(); },
  memAdd: () => { const colors = ['#D0563C', '#4C78D0', '#D9A400', '#2E9D5B', '#7A5AC8', '#C2407E']; const m = settings.family.members; m.push({ id: uid(), name: '', color: colors[m.length % colors.length] }); save(); renderMain(); setTimeout(() => { const el = document.querySelectorAll('[data-mem][data-field=name]'); if (el.length) el[el.length - 1].focus(); }, 50); },
  memRm: (b) => { const [m] = settings.family.members.splice(+b.dataset.i, 1); if (m) { settings.calendars.forEach((c) => { if (c.owner === m.id) c.owner = ''; }); if (settings.me === m.id) settings.me = ''; } save(); renderHeader(); renderMain(); },
  famCodeSave: async () => {
    const a = $('#famCode').value; const b2 = $('#famCode2').value;
    if (a.length < 6) { ui.famMsg = { err: true, text: 'Koden skal være mindst 6 tegn.' }; renderMain(); return; }
    if (a !== b2) { ui.famMsg = { err: true, text: 'De to koder er ikke ens.' }; renderMain(); return; }
    try { await A.authCall('/auth/setup', { family: settings.family.name, code: a }); ui.famMsg = { err: false, text: `Gemt ✓ Log ind på nye skærme med "${settings.family.name}" og koden.` }; }
    catch (e) { ui.famMsg = { err: true, text: /404|Ukendt/.test(e.message) ? 'Workeren er ikke opdateret endnu – prøv igen om et par minutter.' : e.message }; }
    renderMain();
  },
  logoutHere: () => { A.logout('Skærmen er logget ud.'); },
  logoutAll: async () => {
    try { const r = await A.authCall('/auth/logout-all'); settings.proxy.key = r.token; save(); ui.famMsg = { err: false, text: 'Alle andre skærme er logget ud ✓' }; }
    catch (e) { ui.famMsg = { err: true, text: e.message }; }
    renderMain();
  },
  cdTopToggle: () => {
    if (settings.cdTop) settings.cdTop = '';
    else { const n = countdowns('all').find((c) => c.days >= 0) || (settings.countdowns || [])[0]; settings.cdTop = n ? n.id : ''; }
    save(); renderHeader(); renderMain();
  },
  cdAdd: () => { settings.countdowns = (settings.countdowns || []).concat([{ id: uid(), name: '', date: '', imageId: '' }]); save(); renderMain(); setTimeout(() => { const el = document.querySelectorAll('[data-cd][data-field=name]'); if (el.length) el[el.length - 1].focus(); }, 50); },
  cdRm: (b) => { const [c] = settings.countdowns.splice(+b.dataset.i, 1); if (c && settings.cdTop === c.id) settings.cdTop = ''; if (c && c.imageId) M.removeImage(c.imageId); ui.cdIdx = 0; save(); renderHeader(); renderMain(); },
  cdImg: (b) => { const f = $('#cdFile'); if (f) { f.dataset.i = b.dataset.i; f.value = ''; f.click(); } },
  cdImgRm: (b) => { const c = settings.countdowns[+b.dataset.i]; if (c) { M.removeImage(c.imageId); c.imageId = ''; save(); renderMain(); } },
  bgPick: (b) => { ui.bgMsg = null; L.setLook({ bg: b.dataset.id }); renderMain(); },
  bgFile: () => { const f = $('#bgFileInput'); if (f) f.click(); },
  bgUrl: () => {
    const u = ($('#bgUrl') || {}).value || '';
    if (!/^https:\/\//i.test(u.trim())) { ui.bgMsg = { err: true, text: 'Adressen skal starte med https://' }; renderMain(); return; }
    ui.bgMsg = null; L.setLook({ bg: 'url', url: u.trim() }); renderMain();
  },
  newsSecs: (b) => { settings.news.rotateSecs = +b.dataset.v; ui.newsAt = Date.now(); save(); renderMain(); },
  newsToggle: (b) => { toggleNews(b.dataset.id); renderMain(); },
  newsRefresh: () => { N.clearNewsCache(); D.news = null; renderMain(); loadNews(); },
  sPlay: () => sonosDo(S.togglePlay), sNext: () => sonosDo(S.next), sPrev: () => sonosDo(S.prev),
  sFav: (b) => { S.markFav(b.dataset.id); sonosDo(() => S.playFavorite(b.dataset.id)); },
  sGroup: (b) => { settings.sonos.groupId = b.dataset.id; save(); loadSonos(); },
  sReload: () => loadSonos(true),
  sMember: (b) => {
    const cg = S.currentGroup(); if (!cg) return;
    const pid = b.dataset.pid; const cur = cg.playerIds || [];
    if (cur.includes(pid)) { if (cur.length < 2) return; sonosDo(() => S.removePlayer(pid)); return; }
    sonosDo(() => S.setMembers(cur.concat([pid])));
  },
  sAll: () => sonosDo(() => S.setMembers(S.state.players.map((p) => p.id))),
  sOnly: () => { const cg = S.currentGroup(); if (cg) sonosDo(() => S.setMembers([cg.coordinatorId])); },
  sPlaylist: (b) => sonosDo(() => S.playPlaylist(b.dataset.id)),
  sConnect: async () => { try { await S.startLogin(); } catch (e) { toast('Kunne ikke starte Sonos-login: ' + e.message); } },
  sLogout: async () => { try { await S.logout(); toast('Sonos afbrudt'); renderAll(); } catch (e) { toast(e.message); } },
  testConn: async () => {
    ui.connMsg = 'Tester …'; const el = $('#connMsg'); if (el) el.textContent = ui.connMsg;
    try { const r = await (await workerFetch('/health')).json(); ui.connMsg = r.ok ? `Forbindelsen virker ✓ (Sonos ${r.sonosConfigured ? 'klar' : 'ikke sat op i workeren'})` : 'Uventet svar'; loadAll(); await syncNow(); }
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
    if (b.dataset.scope === 'n1') { const m = Math.max(1, mixedNews().length); ui.n1Idx = (((ui.n1Idx + dir) % m) + m) % m; ui.n1At = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'insp') { const m = Math.max(1, MD.state.all.length); /* indekset tages modulo den filtrerede liste */ ui.inspIdx = (((ui.inspIdx + dir) % m) + m) % m; ui.inspAt = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'st') { const m = Math.max(1, stLeagues().length); ui.stIdx = ((((ui.stIdx || 0) + dir) % m) + m) % m; ui.stTouched = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'fb') { const { days, today } = fbDays(); let i = days.findIndex((d) => dkey(d) === ui.fbDay); if (i < 0) i = days.findIndex((d) => +d === +today); const n = days[Math.max(0, Math.min(days.length - 1, i + dir))]; ui.fbDay = n ? dkey(n) : null; ui.fbTouched = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'cd') { const m = Math.max(1, countdowns().length); ui.cdIdx = (((ui.cdIdx + dir) % m) + m) % m; ui.cdAt = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'cal') { ui.calWeek += dir; renderMain(); return; }
    if (b.dataset.scope === 'news') { const m = Math.max(1, newsSources().length); ui.newsIdx = (((ui.newsIdx + dir) % m) + m) % m; ui.newsAt = Date.now(); renderMain(); return; }
    if (b.dataset.scope === 'fp') { ui.fpPlace = (((ui.fpPlace + dir) % n) + n) % n; ui.fpTouched = Date.now(); }
    else { const i = settings.places.indexOf(placeById(ui.wPlace)); ui.wPlace = settings.places[(((i + dir) % n) + n) % n].id; D.compare = null; }
    renderMain();
  },
  wPlace: (b) => { ui.wPlace = b.dataset.id; D.compare = null; if (ui.page !== 'vejr') { ui.page = 'vejr'; history.replaceState(null, '', '#vejr'); renderNav(); } renderMain(false); },
  customAdd: async () => {
    const name = $('#cName').value.trim(); let url = $('#cUrl').value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!name || !url) { ui.feedMsg = { err: true, text: 'Skriv både et navn og en adresse.' }; renderMain(); return; }
    ui.feedMsg = { err: false, text: 'Tester feedet …' }; ui.feedDraft = { name, url }; renderMain();
    try {
      const r = await N.checkFeed(url);
      const id = 'c-' + uid(); settings.news.custom.push({ id, name, url: r.url }); settings.news.sources.push(id); save();
      ui.feedMsg = { err: false, text: `${name} er tilføjet ✓ (${r.count} nyheder${r.found ? ', feedet blev fundet på siden' : ''}). Seneste: ${r.first}` }; ui.feedDraft = null;
      N.clearNewsCache(); loadNews();
    } catch (e) {
      ui.feedMsg = { err: true, text: e.message === 'NO_PROXY' ? 'Opsæt forbindelsen først.' : /415|403/.test(e.message) ? 'Workeren afviste adressen – opdatér workeren i Cloudflare (se chatten) eller prøv sidens RSS-adresse.' : /HTTP 502/.test(e.message) ? 'Siden svarede ikke. Tjek adressen.' : e.message };
    }
    renderMain();
  },
  customRm: (b) => { settings.news.custom = settings.news.custom.filter((c) => c.id !== b.dataset.id); settings.news.sources = settings.news.sources.filter((x) => x !== b.dataset.id); save(); N.clearNewsCache(); renderMain(); loadNews(); },
  calAdd: () => { const colors = ['#D0563C', '#4C78D0', '#D9A400', '#2E9D5B', '#7A5AC8']; const c = { id: uid(), name: 'Ny kalender', color: colors[settings.calendars.length % colors.length], url: '' }; settings.calendars.push(c); ui.calEdit = c.id; save(); renderMain(); setTimeout(() => { const el = document.querySelectorAll('.calname'); if (el.length) { el[el.length - 1].focus(); el[el.length - 1].select(); } }, 50); },
  calEdit: (b) => { ui.calEdit = ui.calEdit === b.dataset.id ? null : b.dataset.id; renderMain(); },
  calEv: (b) => { const e = calRefs[+b.dataset.i]; if (e) showEvent(e); },
  fbLeague: (b) => { const fb = settings.football = settings.football || { leagues: [], teams: [] }; fb.leagues = fb.leagues || []; const id = b.dataset.id; fb.leagues = fb.leagues.includes(id) ? fb.leagues.filter((x) => x !== id) : fb.leagues.concat(id); if (!fb.leagues.includes(id)) { fb.teams = (fb.teams || []).filter((t) => t.lg !== id); fb.follow = (fb.follow || []).filter((x) => x !== id); } save(); renderMain(); loadFootball(true); },
  fbFollow: (b) => { const fb = settings.football = settings.football || { leagues: [], teams: [] }; const f = fb.follow || []; const id = b.dataset.id; fb.follow = f.includes(id) ? f.filter((x) => x !== id) : f.concat(id); save(); renderMain(); loadFootball(true); },
  fbTeam: (b) => { const fb = settings.football = settings.football || { leagues: [], teams: [] }; fb.teams = fb.teams || []; const id = b.dataset.id; const lg = b.dataset.lg;
    if (fb.teams.some((t) => t.id === id && t.lg === lg)) fb.teams = fb.teams.filter((t) => !(t.id === id && t.lg === lg)); // samme klub kan følges i én turnering uden de andre
    else { const t = (lg === 'nat' ? FB.NATIONAL : (ui.fbTeams || {})[lg] || []).find((x) => x.id === id); if (t) fb.teams.push({ id: t.id, name: t.name, short: t.short, logo: t.logo, lg }); }
    save(); renderMain(); loadFootball(true); },
  calShow: (b) => { const ids = b.dataset.id.split(','); const h = settings.calHidden || []; const show = b.getAttribute('aria-pressed') !== 'true'; settings.calHidden = h.filter((x) => !ids.includes(x)).concat(show ? [] : ids); save(); renderMain(); },
  calRm: (b) => { settings.calendars.splice(+b.dataset.i, 1); save(); C.clearCalCache(); renderMain(); loadCal(); },
  tvAdd: () => { settings.tv.channels.push({ name: 'Ny knap', url: 'https://www.dr.dk/drtv' }); save(); renderMain(); },
  tvRm: (b) => { settings.tv.channels.splice(+b.dataset.i, 1); save(); renderMain(); },
  copyRedir: async () => { try { await navigator.clipboard.writeText($('#redir').textContent); toast('Adressen er kopieret'); } catch (e) { toast('Markér adressen og kopiér med ⌘C'); } },
};
function toggleNews(id) {
  const s = settings.news.sources; const i = s.indexOf(id);
  if (i >= 0) s.splice(i, 1); else s.push(id);
  save(); N.clearNewsCache(); loadNews();
}
let volTimer = null;
async function sonosDo(fn) { try { await fn(); setTimeout(() => loadSonos(), 400); } catch (e) { toast('Sonos: ' + e.message); } }

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-noread]') ? null : e.target.closest('a[data-read]');
  if (link) { e.preventDefault(); R.openReader(link.href, link.dataset.read); return; }
  const b = e.target.closest('[data-act]');
  if (b && act[b.dataset.act]) {
    e.preventDefault();
    // Sonos og Somfy svarer langsomt: lad knappen pulsere, indtil svaret er kommet
    if (/^(s[A-Z]|sf)/.test(b.dataset.act) && !/^(sfTest|spAdd|spRm|spReset)$/.test(b.dataset.act)) { b.classList.add('pending'); setTimeout(() => b.classList.remove('pending'), 10000); }
    act[b.dataset.act](b, e);
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-look-alpha')) { L.setLook({ alpha: +t.value }); const lab = t.previousElementSibling; if (lab) lab.textContent = t.value + ' %'; }
});
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; if (e.target.id === 'geoQ') act.geoSearch(); else if (e.target.dataset && e.target.dataset.place !== undefined) e.target.blur(); });
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-shopadd]'); if (!f) return;
  e.preventDefault();
  const inp = f.querySelector('input'); const v = inp.value.trim(); if (!v) return;
  inp.value = '';
  MD.addItem(v).then(() => { toast(v + ' er sat på listen'); const typing = document.querySelector('.shopadd input'); const keep = typing && typing.value; if (!keep) { renderMain(); const n = document.querySelector('.shopadd input'); if (n) n.focus(); } }).catch(() => { inp.value = v; toast('Kunne ikke gemme i Madro'); });
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.wsel) { const x = editLayout().find((y) => y.id === t.dataset.wsel); if (x) { x[t.dataset.k] = t.value; ui.inspIdx = 0; ui.inspAt = Date.now(); save(); renderMain(); } return; }
  if (t.dataset.set) {
    const v = t.type === 'checkbox' ? t.checked : t.value.trim();
    setPath(t.dataset.set, v);
    if (t.dataset.set.startsWith('proxy.')) { S.state.checked = false; }
    if (t.dataset.set === 'weather.model') { D.wx = {}; loadWeather(); }
    if (t.dataset.set === 'news.publicProxyForTest') { N.clearNewsCache(); loadNews(); }
    if (t.dataset.set.endsWith('Theme')) { applyTheme(); renderHeader(); }
  } else if (t.dataset.news) { toggleNews(t.dataset.news); }
  else if (t.dataset.cal !== undefined) { settings.calendars[+t.dataset.cal][t.dataset.field] = t.value.trim(); if (t.dataset.field === 'url' && t.value.trim()) ui.calEdit = null; save(); C.clearCalCache(); loadCal(); if (t.dataset.field !== 'name') renderMain(); }
  else if (t.id === 'bgFileInput' && t.files && t.files[0]) {
    ui.bgMsg = { err: false, text: 'Gemmer billedet …' }; renderMain();
    L.uploadImage(t.files[0]).then((r) => { ui.bgMsg = { err: false, text: r.shared ? 'Billedet er gemt og deles med jeres andre skærme ✓' : 'Billedet er gemt på denne skærm.' }; renderMain(); })
      .catch((e) => { ui.bgMsg = { err: true, text: e.message }; renderMain(); });
  }
  else if (t.id === 'cdFile' && t.files && t.files[0]) {
    const i = +t.dataset.i; ui.cdMsg = { err: false, text: 'Gemmer billedet …' }; renderMain();
    M.saveImage(t.files[0]).then((r) => { const c = settings.countdowns[i]; if (c) { if (c.imageId) M.removeImage(c.imageId); c.imageId = r.id; save(); } ui.cdMsg = { err: false, text: r.shared ? 'Billedet er gemt og deles med jeres andre skærme ✓' : 'Billedet er gemt på denne skærm.' }; renderMain(); })
      .catch((e) => { ui.cdMsg = { err: true, text: e.message }; renderMain(); });
  }
  else if (t.dataset.favshow !== undefined) {
    const h = new Set(settings.sonos.favHidden || []); if (t.checked) h.delete(t.dataset.favshow); else h.add(t.dataset.favshow);
    settings.sonos.favHidden = [...h]; save(); renderMain();
  }
  else if (t.dataset.sfposall !== undefined) {
    const v = +t.value; const devs = SF.state.devices;
    devs.forEach((d) => { if (!d.rts && d.closure !== null && d.closure !== undefined) d.closure = v; });
    SF.preset(devs, v).then((skip) => { if (skip) toast(skip === 1 ? 'Én screen kan ikke stille sig på en mellemstilling' : skip + ' screens kan ikke stille sig på en mellemstilling'); }).catch((e) => toast('Somfy: ' + e.message));
  }
  else if (t.dataset.sfpos !== undefined) {
    const d = SF.state.devices.find((x) => x.url === t.dataset.sfpos);
    if (d) { const v = +t.value; d.closure = v; SF.preset([d], v).catch((e) => toast('Somfy: ' + e.message)); }
  }
  else if (t.dataset.sp !== undefined) {
    const l = (settings.somfyPresets && settings.somfyPresets.length ? settings.somfyPresets : SF.DEFAULT_PRESETS.map((p) => ({ ...p })));
    const p = l[+t.dataset.sp]; if (p) { p[t.dataset.field] = t.dataset.field === 'v' ? (t.value === 'my' ? 'my' : +t.value) : t.value.trim(); settings.somfyPresets = l; save(); }
  }
  else if (t.dataset.mem !== undefined) { const m = settings.family.members[+t.dataset.mem]; if (m) { m[t.dataset.field] = t.value.trim(); save(); renderHeader(); renderMain(); } }
  else if (t.dataset.cdtop !== undefined) { settings.cdTop = t.dataset.cdtop; save(); renderHeader(); }
  else if (t.dataset.cdshow !== undefined) { const c = settings.countdowns[+t.dataset.cdshow]; if (c) { c[t.dataset.k] = t.checked; ui.cdIdx = 0; save(); renderHeader(); } }
  else if (t.dataset.cd !== undefined) { const c = settings.countdowns[+t.dataset.cd]; if (c) { c[t.dataset.field] = t.value.trim(); save(); renderHeader(); } }
  else if (t.hasAttribute('data-look-blur')) { L.setLook({ blur: t.checked }); }
  else if (t.dataset.place !== undefined) { settings.places[+t.dataset.place].label = t.value.trim(); save(); renderHeader(); }
  else if (t.dataset.tv !== undefined) { settings.tv.channels[+t.dataset.tv][t.dataset.field] = t.value.trim(); save(); }
  else if (t.hasAttribute('data-vol')) { sonosDo(() => S.setVolume(+t.value)); }
  else if (t.dataset.pvol) { sonosDo(() => S.setPlayerVolume(t.dataset.pvol, +t.value)); }
});
window.addEventListener('hashchange', () => { const p = pageFromHash(); if (p !== ui.page) { ui.page = p; renderNav(); renderMain(false); } });

/* ---------- Swipe i kort med flere sider (vejr, nyheder) ---------- */
const SWIPE_SCOPE = { stilling: 'st', fodbold: 'fb', nyhed1: 'n1', vejr: 'fp', nyheder: 'news', nedtaelling: 'cd', inspiration: 'insp' };
let swipe = null; let swipedAt = 0;
document.addEventListener('pointerdown', (e) => {
  if (ui.editing || e.target.closest('.hours, input, .handle')) return; // timeoversigten scroller selv vandret
  const card = e.target.closest('.w'); const scope = card && SWIPE_SCOPE[card.dataset.wid];
  if (!scope) { const pg = e.target.closest('[data-swipe]'); if (!pg) return; swipe = { x: e.clientX, y: e.clientY, scope: pg.dataset.swipe }; return; }
  swipe = { x: e.clientX, y: e.clientY, scope };
}, true);
document.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x; const dy = e.clientY - swipe.y; const sc = swipe.scope; swipe = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  swipedAt = Date.now();
  act.wStep({ dataset: { scope: sc, dir: dx < 0 ? '1' : '-1' } });
}, true);
document.addEventListener('pointercancel', () => { swipe = null; }, true);
// Et swipe må ikke samtidig åbne en nyhed
document.addEventListener('click', (e) => { if (Date.now() - swipedAt < 400) { e.preventDefault(); e.stopPropagation(); } }, true);

/* ---------- Træk og slip på forsiden (virker med finger og mus) ----------
   Kortet løftes op og følger fingeren, de andre kort glider på plads, og kortet lander blødt.
   Mus: træk hvor som helst på kortet. Finger: træk i "Flyt", eller hold fingeren på kortet et øjeblik. */
let drag = null;
const gridZoom = () => { const w = document.querySelector('.gridwrap'); return (w && +w.style.zoom) || 1; };
document.addEventListener('pointerdown', (e) => {
  if (!ui.editing || e.button > 0) return;
  const card = e.target.closest('#grid .w'); if (!card) return;
  const onHandle = !!e.target.closest('.handle');
  if (!onHandle && e.target.closest('button, input, select, a, label, .shapes')) return;
  if (onHandle) e.preventDefault();
  drag = { card, id: card.dataset.wid, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, active: false, onHandle, touch: e.pointerType === 'touch', lockUntil: 0 };
  if (drag.touch && !onHandle) drag.timer = setTimeout(() => { if (drag && !drag.active) startDrag(); }, 260);
});
function startDrag() {
  const d = drag; d.active = true; clearTimeout(d.timer);
  const k = gridZoom(); d.k = k;
  const r = d.card.getBoundingClientRect(); d.rect = r;
  const g = d.card.cloneNode(true);
  g.classList.add('dragghost'); g.removeAttribute('id');
  Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width / k + 'px', height: r.height / k + 'px', zoom: k });
  document.body.appendChild(g); d.ghost = g;
  requestAnimationFrame(() => g.classList.add('lifted'));
  d.card.classList.add('dragslot');
  try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* ignorer */ }
  autoScroll();
}
function moveGhost() { const d = drag; if (!d || !d.ghost) return; d.ghost.style.transform = `translate(${(d.x - d.x0) / d.k}px,${(d.y - d.y0) / d.k}px)`; }
function autoScroll() {
  if (!drag || !drag.active) return;
  const m = $('#main'); const r = m.getBoundingClientRect(); const edge = 90;
  const v = drag.y < r.top + edge ? -(r.top + edge - drag.y) : drag.y > r.bottom - edge ? drag.y - (r.bottom - edge) : 0;
  if (v) { m.scrollTop += Math.max(-22, Math.min(22, v / 4)); reorderAt(drag.x, drag.y); }
  requestAnimationFrame(autoScroll);
}
// Flyt pladsholderen hen under fingeren og lad de andre kort glide på plads (FLIP-animation)
function reorderAt(x, y) {
  const d = drag; if (!d || Date.now() < d.lockUntil) return;
  const el = document.elementFromPoint(x, y); const over = el && el.closest('#grid .w');
  if (!over || over === d.card) return;
  const grid = $('#grid'); const cards = [...grid.children];
  const from = cards.indexOf(d.card); const to = cards.indexOf(over);
  const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
  grid.insertBefore(d.card, from < to ? over.nextSibling : over);
  const k = d.k || 1;
  cards.forEach((c) => {
    const a = c.getBoundingClientRect(); const b = before.get(c);
    const dx = (b.left - a.left) / k; const dy = (b.top - a.top) / k;
    if (!dx && !dy) return;
    c.style.transition = 'none'; c.style.transform = `translate(${dx}px,${dy}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; c.style.transform = ''; }));
  });
  d.lockUntil = Date.now() + 180;
}
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (drag.touch && !drag.onHandle) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; } // fingeren scroller siden
    if (dist < (drag.onHandle ? 3 : 6)) return;
    startDrag();
  }
  e.preventDefault();
  moveGhost(); reorderAt(e.clientX, e.clientY);
});
// Hold siden stille, mens et kort trækkes med fingeren
document.addEventListener('touchmove', (e) => { if (drag && drag.active) e.preventDefault(); }, { passive: false });
const endDrag = () => {
  const d = drag; if (!d) return;
  clearTimeout(d.timer); drag = null;
  if (!d.active) return;
  swipedAt = Date.now(); // et træk må ikke blive til et tryk
  const order = [...$('#grid').children].map((c) => c.dataset.wid);
  editLayout().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const r = d.card.getBoundingClientRect(); const g = d.ghost;
  g.classList.remove('lifted'); g.classList.add('landing');
  g.style.transform = `translate(${(r.left - d.rect.left) / d.k}px,${(r.top - d.rect.top) / d.k}px)`;
  setTimeout(() => { g.remove(); d.card.classList.remove('dragslot'); save(); }, 240);
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- Start ---------- */
function boot() {
  if (A.needsLogin()) { applyTheme(); A.showLogin(); return; }
  onAuthLost(() => A.logout('Skærmen er logget ud. Log ind igen.'));
  if (!Array.isArray(settings.countdowns)) { const c = settings.countdown || {}; settings.countdowns = c.name || c.date ? [{ id: uid(), name: c.name || '', date: c.date || '', imageId: '' }] : []; save(); }
  // Kun én nedtælling øverst: vælg den nærmeste, første gang
  if (settings.cdTop === undefined) { const n = countdowns('top').find((c) => c.days >= 0); settings.cdTop = n ? n.id : ''; save(); }
  if (!settings.weather.stepRev) { settings.weather.step = 60; settings.weather.stepRev = 1; save(); } // vejrkortet viser timer som standard
  M.onMediaLoaded(() => softRender());
  TM.onTimerChange(() => { renderHeader(); if (ui.page === 'forside') softRender(); });
  setInterval(timerTick, 1000);
  applyWakeLock(); document.addEventListener('pointerdown', () => { if (settings.keepAwake && !wakeLock) applyWakeLock(); }, { passive: true });
  MD.onMadroChange(() => { if (ui.page === 'forside' || ui.page === 'kalender') softRender(); });
  SF.onSomfyChange(() => { if (ui.page === 'somfy' || (ui.page === 'forside' && curLayout().some((x) => x.id === 'screens'))) softRender(); });
  setInterval(() => { if (svcOn('somfy') && !document.hidden && (ui.page === 'somfy' || curLayout().some((x) => x.id === 'screens'))) SF.refresh(); }, ui.page === 'somfy' ? 20000 : 60000);
  // Madplan og indkøbsliste på forsiden – brugeren bad selv om dem (én gang)
  if ((settings.layoutRev || 1) < 3) { const have = new Set(settings.layout.map((x) => x.id)); settings.layout = [{ id: 'madplan', w: 4, h: 1 }, { id: 'indkob', w: 2, h: 1 }].filter((x) => !have.has(x.id)).concat(settings.layout); settings.layoutRev = 3; save(); }
  S.onArtLoaded(() => { renderFooter(); if (['forside', 'musik'].includes(ui.page)) softRender(); });
  if (settings.layout.some((x) => !x.w)) { settings.layout = settings.layout.map((x) => { const [w, h] = shapeOf(x); return { id: x.id, w, h }; }); save(); }
  if (settings.navOpen) { settings.navOpen = false; }
  // Engangsoprydning: 'Vejret andre steder' blev sat på forsiden automatisk i 1.1.0 – fjern det igen
  if ((settings.layoutRev || 1) < 2) { settings.layout = settings.layout.filter((x) => x.id !== 'steder'); settings.layoutRev = 2; save(); }
  if (!settings.places.length) { const l = settings.location; settings.places = [{ id: 'hjem', label: 'Hjem', name: l.name, lat: l.lat, lon: l.lon }]; save(); }
  const q = new URLSearchParams(location.search);
  if (q.get('sonos') === 'ok') { toast('Sonos er forbundet ✓'); history.replaceState(null, '', location.pathname + '#musik'); ui.page = 'musik'; }
  if (q.get('sonos') === 'fejl') { toast('Sonos-login mislykkedes – prøv igen'); history.replaceState(null, '', location.pathname + '#musik'); ui.page = 'musik'; }
  renderAll();
  loadAll();
  startUpdater();
  startSync(() => { C.clearCalCache(); N.clearNewsCache(); D.wx = {}; D.compare = null; renderAll(); loadAll(); });
  setInterval(() => { const c = $('#clk'); const n = new Date(); if (c) c.textContent = hhmm(n); if (n.getSeconds() === 0) { renderHeader(); applyTheme(); } }, 1000);
  setInterval(() => { ui.tick++; renderFooter(); }, 8000);
  setInterval(loadWeather, 15 * 60000);
  // Nyhedskortet: tæl ned og skift til næste medie efter 20 sekunder
  setInterval(() => {
    const bar = document.getElementById('newsBar');
    if (!bar || ui.editing || ui.page !== 'forside' || drag || R.isOpen()) { ui.newsAt = Date.now(); if (bar) bar.style.width = '100%'; return; }
    const left = newsLeft();
    if (left <= 0) { act.wStep({ dataset: { scope: 'news', dir: '1' } }); return; }
    bar.style.width = (left / newsSecs()) * 100 + '%';
  }, 1000);
  // "Næste i kalenderen" tæller ned i minutter
  setInterval(() => { if ((ui.page === 'forside' && !ui.editing && curLayout().some((x) => x.id === 'naeste' || x.id === 'uge')) || (ui.page === 'kalender' && !document.querySelector('.upd-modal'))) softRender(); }, 60000);
  // "Én nyhed ad gangen": skift efter samme tid som nyhedskortet
  setInterval(() => {
    const on = ui.page === 'forside' && !ui.editing && !drag && !R.isOpen() && curLayout().some((x) => x.id === 'nyhed1') && widgetOn('nyhed1') && mixedNews().length > 1;
    if (!on) { ui.n1At = Date.now(); return; }
    const secs = newsSecs() || 20; const left = secs * 1000 - (Date.now() - ui.n1At);
    const bar = document.getElementById('n1Bar'); if (bar) bar.style.width = Math.max(0, left / (secs * 10)) + '%';
    if (left <= 0) act.wStep({ dataset: { scope: 'n1', dir: '1' } });
  }, 1000);
  // Inspirationskortet: ny ret hvert 20. sekund
  setInterval(() => {
    const on = ui.page === 'forside' && !ui.editing && !drag && curLayout().some((x) => x.id === 'inspiration') && widgetOn('inspiration') && MD.state.all.length > 1;
    if (!on) { ui.inspAt = Date.now(); return; }
    const left = 20000 - (Date.now() - ui.inspAt);
    const bar = document.getElementById('inspBar'); if (bar) bar.style.width = Math.max(0, left / 200) + '%';
    if (left <= 0) act.wStep({ dataset: { scope: 'insp', dir: '1' } });
  }, 1000);
  // Nedtællingskortet: skift til næste nedtælling hvert 10. sekund, når der er flere
  setInterval(() => {
    if (ui.page !== 'forside' || ui.editing || drag || R.isOpen() || !svcOn('nedtaelling') || !widgetOn('nedtaelling') || !curLayout().some((x) => x.id === 'nedtaelling') || countdowns().length < 2) { ui.cdAt = Date.now(); return; }
    if (Date.now() - ui.cdAt >= 10000) act.wStep({ dataset: { scope: 'cd', dir: '1' } });
  }, 1000);
  setInterval(() => { if (ui.fpPlace !== 0 && Date.now() - ui.fpTouched > 3 * 60000) { ui.fpPlace = 0; softRender(); } }, 30000);
  setInterval(() => { if (ui.stIdx && Date.now() - (ui.stTouched || 0) > 45000) { ui.stIdx = 0; softRender(); } }, 15000); // stilling: tilbage til den foretrukne liga
  setInterval(() => { if (ui.fbDay && Date.now() - (ui.fbTouched || 0) > 45000) { ui.fbDay = null; softRender(); } }, 15000); // i dag er altid standard: tilbage efter under et minut
  setInterval(loadNews, 5 * 60000);
  setInterval(() => { if (!document.hidden) loadFootball(); }, 60000); // FB.load bestemmer selv: hvert minut under kampe, ellers hvert 10. minut
  setInterval(loadCal, 10 * 60000);
  setInterval(() => { if (S.state.connected && !document.hidden) loadSonos(); }, 8000);
  // Opdater dag-visninger ved midnat
  setInterval(() => { const n = new Date(); if (n.getHours() === 0 && n.getMinutes() === 0 && n.getSeconds() < 2) softRender(); }, 1000);
}
boot();
