// easyHome – deler indstillinger mellem alle skærme via jeres Cloudflare Worker.
// Den nyeste ændring vinder. En ny skærm henter altid de fælles indstillinger første gang.
import { settings, hasProxy, workerFetch, onSaved, applyShared, sharedSettings } from './util.js';

const SYNCED_KEY = 'easyhome.syncedOnce';
let onRemoteChange = () => {};
let pushTimer = null;
let busy = false;
export const syncState = { ok: null, last: null, msg: '' };

const syncedOnce = () => { try { return localStorage.getItem(SYNCED_KEY) === '1'; } catch (e) { return false; } };
const markSynced = () => { try { localStorage.setItem(SYNCED_KEY, '1'); } catch (e) { /* ignorer */ } };

async function push(force = false) {
  if (!hasProxy()) return;
  if (!force && !syncedOnce()) return; // en ny skærm må aldrig overskrive de fælles indstillinger, før den har hentet dem
  try {
    await workerFetch('/settings', { method: 'POST', body: JSON.stringify({ updatedAt: settings.updatedAt || Date.now(), data: sharedSettings() }) });
    markSynced(); syncState.ok = true; syncState.last = new Date(); syncState.msg = '';
  } catch (e) { syncState.ok = false; syncState.msg = e.message; }
}

export async function syncNow() {
  if (!hasProxy() || busy) return;
  busy = true;
  try {
    const r = await (await workerFetch('/settings')).json();
    const local = settings.updatedAt || 0;
    if (r && r.data && (!syncedOnce() || (r.updatedAt || 0) > local)) {
      applyShared(r.data, r.updatedAt || Date.now());
      markSynced(); syncState.ok = true; syncState.last = new Date(); syncState.msg = '';
      onRemoteChange();
    } else if (!r || !r.data || local > (r.updatedAt || 0)) {
      await push(true);
    } else { syncState.ok = true; syncState.last = new Date(); markSynced(); }
  } catch (e) {
    syncState.ok = false;
    syncState.msg = /501/.test(e.message) ? 'Workeren skal opdateres for at dele indstillinger' : e.message;
  } finally { busy = false; }
}

export function startSync(onChange) {
  onRemoteChange = onChange || onRemoteChange;
  onSaved(() => { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); });
  syncNow();
  setInterval(syncNow, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
}
