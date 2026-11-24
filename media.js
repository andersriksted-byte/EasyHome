// easyHome – billeder (fx til nedtællinger). Gemmes lokalt og i workeren, så alle skærme kan vise dem.
import { hasProxy, workerFetch } from './util.js';

const PREFIX = 'easyhome.media.';
const mem = {};
const pending = {};
let onLoaded = () => {};
export function onMediaLoaded(fn) { onLoaded = fn; }

export function getImage(id) {
  if (!id) return '';
  if (mem[id]) return mem[id];
  try { const v = localStorage.getItem(PREFIX + id); if (v) { mem[id] = v; return v; } } catch (e) { /* ignorer */ }
  fetchImage(id);
  return '';
}

async function fetchImage(id) {
  if (!hasProxy() || pending[id]) return;
  pending[id] = true;
  try {
    const r = await (await workerFetch('/media/' + encodeURIComponent(id))).json();
    if (r && r.data) { mem[id] = r.data; try { localStorage.setItem(PREFIX + id, r.data); } catch (e) { /* lokalt lager fuldt – bruges fra hukommelsen */ } onLoaded(id); }
  } catch (e) { /* prøv igen senere */ } finally { setTimeout(() => { delete pending[id]; }, 30000); }
}

export async function saveImage(file, maxPx = 1400) {
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Billedet kunne ikke læses')); i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  let data = c.toDataURL('image/jpeg', 0.82);
  if (data.length > 1500000) data = c.toDataURL('image/jpeg', 0.6);
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  mem[id] = data;
  try { localStorage.setItem(PREFIX + id, data); } catch (e) { /* ignorer */ }
  let shared = false;
  if (hasProxy()) { try { await workerFetch('/media/' + id, { method: 'POST', body: JSON.stringify({ data }) }); shared = true; } catch (e) { shared = false; } }
  return { id, shared };
}

export async function removeImage(id) {
  if (!id) return;
  delete mem[id];
  try { localStorage.removeItem(PREFIX + id); } catch (e) { /* ignorer */ }
  if (hasProxy()) { try { await workerFetch('/media/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({ delete: true }) }); } catch (e) { /* ignorer */ } }
}
