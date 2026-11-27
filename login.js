// easyHome – familie-login. Vises på en skærm, der endnu ikke er logget ind.
import { esc, settings, save } from './util.js';

const base = () => (settings.proxy.url || '').replace(/\/+$/, '');

export const needsLogin = () => !settings.proxy.key;

export function showLogin(msg = '') {
  document.getElementById('app').hidden = true;
  let el = document.getElementById('login');
  if (!el) { el = document.createElement('div'); el.id = 'login'; el.className = 'login'; document.body.appendChild(el); }
  el.innerHTML = `<form class="loginbox" id="loginForm" autocomplete="on">
    <div class="loginlogo">⌂</div>
    <h1>Velkommen hjem</h1>
    <p class="muted">Log ind med jeres familienavn og familiekode.</p>
    <label class="f">Familienavn<input name="family" type="text" autocomplete="username" placeholder="Fx Familien Riksted" value="${esc(settings.family && settings.family.name || '')}" required></label>
    <label class="f">Familiekode<input name="code" type="password" autocomplete="current-password" required></label>
    <button class="btn primary big" type="submit">Log ind</button>
    <p class="small muted">Eller scan QR-koden fra en skærm, der er logget ind: Indstillinger → Familie → Forbind ny skærm.</p>
    <div class="small ${msg ? 'err' : ''}" id="loginMsg" role="status">${esc(msg)}</div>
    <details class="small"><summary>Avanceret</summary>
      <label class="f">Worker-adresse<input name="url" type="url" value="${esc(settings.proxy.url)}"></label>
      <label class="f">Nøgle (DASH_KEY) – kun hvis familiekoden ikke er oprettet<input name="key" type="password" autocomplete="off"></label>
    </details>
  </form>`;
  const f = el.querySelector('form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = el.querySelector('#loginMsg');
    const d = Object.fromEntries(new FormData(f));
    if (d.url) settings.proxy.url = d.url.trim();
    if (d.key && d.key.trim()) { settings.proxy.key = d.key.trim(); save(); location.reload(); return; }
    m.className = 'small'; m.textContent = 'Logger ind …';
    try {
      const r = await fetch(base() + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ family: d.family, code: d.code, device: navigator.platform || 'skærm' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) throw new Error(j.error || 'Kunne ikke logge ind (' + r.status + ')');
      settings.proxy.key = j.token;
      save();
      location.reload();
    } catch (err) {
      m.className = 'small err';
      m.textContent = err.message === 'Failed to fetch' ? 'Kan ikke nå jeres server. Tjek internettet.' : err.message;
    }
  });
}

// Ny skærm via QR-kode: adressen indeholder #pair=KODE, som byttes til et login hos workeren
export async function claimPair(code) {
  const r = await fetch(base() + '/auth/pair/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, device: navigator.platform || 'ny skærm' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.token) throw new Error(j.error || 'Kunne ikke forbinde (' + r.status + ')');
  settings.proxy.key = j.token; if (j.family && settings.family && !settings.family.name) settings.family.name = j.family;
  save();
}

export function logout(msg) {
  settings.proxy.key = '';
  save();
  showLogin(msg);
}

// Kaldes fra Indstillinger → Familie
export async function authCall(path, body) {
  const r = await fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Dash-Key': settings.proxy.key }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Fejl ' + r.status);
  return j;
}
