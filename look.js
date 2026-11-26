// easyHome – baggrund og gennemsigtige kort
import { settings, save, hasProxy, workerFetch, ap, setAp } from './util.js';

export const BACKGROUNDS = [
  { id: 'theme', name: 'Temaets farve', css: '' },
  { id: 'solnedgang', name: 'Solnedgang', css: 'linear-gradient(160deg,#ffb07a 0%,#f2557a 45%,#6a3d9a 100%)' },
  { id: 'nordlys', name: 'Nordlys', css: 'radial-gradient(at 20% 20%,#3ee0b0 0,transparent 45%),radial-gradient(at 80% 35%,#5b7cfa 0,transparent 50%),linear-gradient(180deg,#0b1b2b,#13294a)' },
  { id: 'hav', name: 'Hav', css: 'linear-gradient(180deg,#cdeeff 0%,#5aa9e6 55%,#1d5d9b 100%)' },
  { id: 'skov', name: 'Skov', css: 'linear-gradient(160deg,#dcefd2 0%,#7cb07a 50%,#2f5b3a 100%)' },
  { id: 'sand', name: 'Sand', css: 'linear-gradient(160deg,#fbf3e6 0%,#ecd5b8 60%,#d6b48c 100%)' },
  { id: 'nat', name: 'Nat', css: 'radial-gradient(at 70% 10%,#2c3e66 0,transparent 55%),linear-gradient(180deg,#0d1220,#1b2236)' },
  { id: 'blomst', name: 'Blomst', css: 'radial-gradient(at 15% 85%,#ffc8da 0,transparent 45%),radial-gradient(at 85% 15%,#ffe7a8 0,transparent 45%),linear-gradient(135deg,#fff3ee,#efe2ff)' }
];

const IMG_KEY = 'easyhome.bgImage';
const look = () => ap('look') || { bg: 'theme', url: '', imageId: '', alpha: 100, blur: true };
let localImg = null;
try { localImg = JSON.parse(localStorage.getItem(IMG_KEY) || 'null'); } catch (e) { localImg = null; }

export function getLook() { return look(); }

function imageCss() {
  const L = look();
  if (L.bg === 'url' && L.url) return `url("${L.url.replace(/["\\\n]/g, '')}") center/cover no-repeat`;
  if (L.bg === 'image' && localImg && localImg.id === L.imageId) return `url("${localImg.data}") center/cover no-repeat`;
  const p = BACKGROUNDS.find((b) => b.id === L.bg);
  return p && p.css ? p.css : '';
}

export function applyLook() {
  const L = look();
  const bg = imageCss();
  const root = document.documentElement;
  root.classList.toggle('has-bg', !!bg);
  root.style.setProperty('--appbg', bg || 'var(--bg)');
  const a = bg ? Math.max(0.3, Math.min(1, (L.alpha ?? 100) / 100)) : 1;
  root.style.setProperty('--cardA', String(a));
  root.style.setProperty('--cardBlur', bg && L.blur !== false && a < 1 ? '14px' : '0px');
  // Et billede gemt på en anden skærm: hent det fra workeren
  if (L.bg === 'image' && L.imageId && (!localImg || localImg.id !== L.imageId)) fetchImage(L.imageId);
}

let fetching = null;
async function fetchImage(id) {
  if (!hasProxy() || fetching === id) return;
  fetching = id;
  try {
    const r = await (await workerFetch('/bg')).json();
    if (r && r.id === id && r.data) { localImg = r; try { localStorage.setItem(IMG_KEY, JSON.stringify(r)); } catch (e) { /* for stort til lokalt lager – bruges stadig nu */ } applyLook(); }
  } catch (e) { /* prøv igen senere */ } finally { fetching = null; }
}

export function setLook(patch) { setAp('look', { ...look(), ...patch }); applyLook(); }

// Skaler billedet ned (maks 1920 px) og gem det lokalt og i workeren, så de andre skærme også får det
export async function uploadImage(file) {
  const bmp = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Billedet kunne ikke læses')); img.src = URL.createObjectURL(file); });
  const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bmp.src);
  let data = c.toDataURL('image/jpeg', 0.82);
  if (data.length > 2500000) data = c.toDataURL('image/jpeg', 0.6);
  const id = 'img-' + Date.now();
  localImg = { id, data };
  try { localStorage.setItem(IMG_KEY, JSON.stringify(localImg)); } catch (e) { /* ignorer */ }
  let shared = false;
  if (hasProxy()) { try { await workerFetch('/bg', { method: 'POST', body: JSON.stringify(localImg) }); shared = true; } catch (e) { shared = false; } }
  setLook({ bg: 'image', imageId: id });
  return { shared };
}
export const hasLocalImage = () => !!(localImg && localImg.id === look().imageId);
export const previewCss = (id) => (BACKGROUNDS.find((b) => b.id === id) || {}).css || '';
