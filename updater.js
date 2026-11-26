// easyHome – opdateringer: viser en besked når der ligger en ny version, og "Det er nyt" bagefter.
// Ved hver ny version: hæv APP_VERSION her OG "version" i version.json, og skriv noterne i version.json.
import { esc } from './util.js';

export const APP_VERSION = '1.99.1';
const SEEN_KEY = 'easyhome.seenVersion';
const CHECK_EVERY = 2 * 60000;

const cmp = (a, b) => {
  const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); }
  return 0;
};

async function fetchInfo() {
  const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

function notesHtml(notes) {
  return notes.map((n) => `<section class="upd-note"><h3>${esc(n.title)}</h3><div class="upd-meta">Version ${esc(n.version)} · ${esc(n.date)}</div>
    <ul>${(n.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
}

// Banner: "Ny opdatering klar"
function showBanner(info) {
  if (document.getElementById('updBanner')) return;
  const latest = (info.notes || [])[0];
  const b = el(`<div class="upd-banner" id="updBanner" role="alert">
    <div><b>Ny opdatering klar</b><span>${latest ? esc(latest.title) : 'Version ' + esc(info.version)}</span></div>
    <button class="btn primary" id="updGo">Opdater</button></div>`);
  document.body.appendChild(b);
  b.querySelector('#updGo').addEventListener('click', () => applyUpdate(info));
}

// Henter alle filer på ny (så browserens cache ikke giver den gamle version) og genstarter
async function applyUpdate(info) {
  const btn = document.getElementById('updGo');
  if (btn) { btn.disabled = true; btn.textContent = 'Opdaterer …'; }
  const files = info.files || ['index.html', 'app.js', 'app.css', 'util.js', 'updater.js', 'weather.js', 'news.js', 'calendar.js', 'sonos.js'];
  await Promise.all(files.map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
  location.reload();
}

// Dialog: "Det er nyt i easyHome"
function showWhatsNew(notes) {
  if (!notes.length) return;
  const m = el(`<div class="upd-modal" role="dialog" aria-modal="true" aria-labelledby="updTitle">
    <div class="upd-box"><h2 id="updTitle">Det er nyt i easyHome</h2>${notesHtml(notes)}
    <button class="btn primary big" id="updOk">Fint</button></div></div>`);
  document.body.appendChild(m);
  const close = () => { m.remove(); };
  m.querySelector('#updOk').addEventListener('click', close);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  m.querySelector('#updOk').focus();
}

let seenRemote = null;
async function check() {
  try {
    const info = await fetchInfo();
    if (cmp(info.version, APP_VERSION) > 0) { seenRemote = info.version; showBanner(info); }
  } catch (e) { /* offline – prøv igen senere */ }
}

export async function startUpdater() {
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { /* ignorer */ }
  if (seen !== APP_VERSION) {
    try {
      const info = await fetchInfo();
      const notes = (info.notes || []).filter((n) => cmp(n.version, APP_VERSION) <= 0 && (seen ? cmp(n.version, seen) > 0 : cmp(n.version, APP_VERSION) === 0));
      showWhatsNew(notes);
      if (cmp(info.version, APP_VERSION) > 0) showBanner(info);
    } catch (e) { /* ignorer */ }
    try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch (e) { /* ignorer */ }
  }
  setInterval(check, CHECK_EVERY);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  check();
  return seenRemote;
}
