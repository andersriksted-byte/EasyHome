// easyHome – Madro (familiens madplan, indkøbsliste og opskrifter).
// Madro ligger på samme adresse (andersriksted-byte.github.io/Madro/), så easyHome kan bruge samme
// Firebase-login som Madro: er man logget ind i Madro på skærmen, er man også logget ind her.
// Forsidekortene læser madplanen og indkøbslisten direkte fra Madros database; hele Madro vises på Madro-siden.

export const BASE = new URL('../Madro/', location.href).href;

export const state = { status: 'idle', error: '', fid: null, plans: {}, shopping: [], recipes: {}, all: [] };
let onChange = () => {};
export function onMadroChange(fn) { onChange = fn; }

let fs = null; let started = false; const unsubs = [];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Kunne ikke hente ' + src)); document.head.appendChild(s);
  });
}

export async function start() {
  if (started) return; started = true;
  state.status = 'loading'; onChange();
  try {
    if (!window.firebase) {
      await loadScript(BASE + 'config.js');
      await loadScript(BASE + 'lib/firebase-app-compat.js');
      await loadScript(BASE + 'lib/firebase-auth-compat.js');
      await loadScript(BASE + 'lib/firebase-firestore-compat.js');
    }
    const fb = window.firebase;
    if (!fb.apps.length) fb.initializeApp(window.FIREBASE_CONFIG);
    fs = fb.firestore();
    fb.auth().onAuthStateChanged((u) => connect(u));
  } catch (e) { state.status = 'error'; state.error = e.message; onChange(); }
}

async function connect(user) {
  unsubs.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignorer */ } });
  if (!user) { state.status = 'nologin'; state.fid = null; onChange(); return; }
  try {
    const u = await fs.doc('users/' + user.uid).get();
    const fid = u.exists ? u.data().familyId : null;
    if (!fid) { state.status = 'nofamily'; onChange(); return; }
    state.fid = fid; state.status = 'ok';
    const col = (c) => fs.collection('families/' + fid + '/' + c);
    unsubs.push(col('lists').doc('shopping').onSnapshot((d) => { state.shopping = (d.exists && Array.isArray(d.data().items)) ? d.data().items : []; onChange(); }, fail));
    const mon = mondayOf(new Date());
    [mon, addDays(mon, 7)].forEach((m) => {
      const key = weekKey(m);
      unsubs.push(col('plans').doc(key).onSnapshot((d) => { state.plans[key] = d.exists ? (d.data().entries || []) : []; loadRecipes(); onChange(); }, fail));
    });
    loadAll(); setInterval(loadAll, 30 * 60000);
    onChange();
  } catch (e) { fail(e); }
}
function fail(e) { state.status = 'error'; state.error = e && e.code === 'permission-denied' ? 'Ingen adgang til familiens data' : (e && e.message) || 'Fejl'; onChange(); }

async function loadRecipes() {
  const ids = new Set();
  Object.values(state.plans).forEach((list) => list.forEach((e) => { if (e.recipeId && !state.recipes[e.recipeId]) ids.add(e.recipeId); }));
  for (const id of ids) {
    state.recipes[id] = { title: '…' };
    try { const d = await fs.doc('families/' + state.fid + '/recipes/' + id).get(); state.recipes[id] = d.exists ? d.data() : { title: 'Ukendt ret' }; } catch (e) { state.recipes[id] = { title: 'Ukendt ret' }; }
  }
  if (ids.size) onChange();
}

/* ---------- Datoer (samme ugenøgle som Madro: 2026-W48, mandag = 0) ---------- */
export function mondayOf(d) { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t; }
export function addDays(d, n) { const t = new Date(d); t.setDate(t.getDate() + n); return t; }
export function weekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dn + 3); const fy = t.getUTCFullYear(); const ft = new Date(Date.UTC(fy, 0, 4));
  const w = 1 + Math.round(((t - ft) / 864e5 - 3 + ((ft.getUTCDay() + 6) % 7)) / 7);
  return fy + '-W' + String(w).padStart(2, '0');
}

// Retterne for en dag: [{ title, image, note }]
export function mealsOn(date) {
  const list = state.plans[weekKey(mondayOf(date))] || [];
  const day = (date.getDay() + 6) % 7;
  return list.filter((e) => e.day === day).map((e) => {
    if (e.note != null) return { title: e.note, sub: e.sub || '', image: imgUrl(e.image) || (/ude|restaurant/i.test(e.note) ? BASE + 'img/spiser-ude.jpg' : ''), art: artColors(e.note), note: true };
    if (e.pendingUrl) return { title: 'Opskrift hentes …', image: '', note: true };
    const r = state.recipes[e.recipeId] || { title: '…' };
    return { title: r.title || 'Ret', image: imgUrl(r.image), art: artColors(r.title), note: false, status: shopStatus(e, r) };
  });
}
// Samme status som i Madro: er der handlet ind til retten?
const nrm = (x) => String(x || '').trim().toLowerCase();
function shopStatus(e, r) {
  if (!e.shopped) return { cls: 'none', text: 'Ikke handlet' };
  const added = (e.shopped.added || []).map(nrm);
  const open = state.shopping.filter((it) => !it.checked && (it.from || []).includes(r.title) && added.includes(nrm(it.name)));
  if (open.length) return { cls: 'wait', n: open.length, text: open.length + (open.length === 1 ? ' vare mangler' : ' varer mangler') };
  return { cls: 'done', text: added.length ? 'Handlet' : 'Har alt' };
}
// Retter uden foto får samme farver som Madros standardbillede
const ART_COLS = [['#7a3b2a', '#9a4f36'], ['#4a5634', '#5f6d42'], ['#6b2f45', '#86405a'], ['#2f4a5a', '#3d5f72'], ['#83582a', '#a06d36'], ['#3e3a5a', '#544e75'], ['#5a3a2e', '#74503f']];
function artColors(title) { let h = 7; for (const ch of String(title || '')) h = (h * 31 + ch.charCodeAt(0)) | 0; return ART_COLS[Math.abs(h) % ART_COLS.length]; }
function imgUrl(src) {
  if (!src || typeof src !== 'string') return '';
  if (/^(https?:|data:image\/)/.test(src)) return src;
  if (/^\/_blob\//.test(src)) return ''; // billeder fra Claude-appen findes ikke på nettet – brug Madros farvebillede
  try { return new URL(src.replace(/^\//, ''), BASE).href; } catch (e) { return ''; }
}

export const openItems = () => state.shopping.filter((x) => !x.checked);

// Sæt kryds ved en vare (gemmes i Madro, så alle telefoner ser det med det samme)
export async function toggleItem(id) {
  if (!fs || !state.fid) return;
  const ref = fs.doc('families/' + state.fid + '/lists/shopping');
  state.shopping = state.shopping.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)); onChange();
  try {
    await fs.runTransaction(async (tx) => {
      const d = await tx.get(ref); const items = (d.exists && d.data().items) || [];
      tx.set(ref, { items: items.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)), updatedAt: Date.now() }, { merge: true });
    });
  } catch (e) { /* onSnapshot retter visningen igen */ }
}

// Tilføj en vare fra skærmen. "2 l mælk" bliver til 2 l + mælk. Samme vare lægges sammen med den, der står på listen.
export async function addItem(text) {
  if (!fs || !state.fid) throw new Error('Madro er ikke forbundet');
  const t = String(text || '').trim(); if (!t) return;
  const m = /^(\d+(?:[.,]\d+)?)\s*(g|kg|l|dl|cl|ml|stk\.?|pk\.?|ds\.?|bdt\.?)?\s+(.+)$/i.exec(t);
  const amount = m ? parseFloat(m[1].replace(',', '.')) : null;
  const unit = m && m[2] ? m[2].toLowerCase().replace(/\.$/, '') : '';
  const name = (m ? m[3] : t).replace(/^./, (c) => c.toUpperCase());
  const norm = (x) => String(x || '').trim().toLowerCase();
  const ref = fs.doc('families/' + state.fid + '/lists/shopping');
  await fs.runTransaction(async (tx) => {
    const d = await tx.get(ref); const items = ((d.exists && d.data().items) || []).map((x) => ({ ...x }));
    const ex = items.find((x) => !x.checked && norm(x.name) === norm(name) && (x.unit || '') === unit);
    if (ex) { if (ex.amount != null && amount != null) ex.amount = Math.round((ex.amount + amount) * 100) / 100; else ex.amount = ex.amount ?? amount; }
    else items.push({ id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5), name, unit, amount, from: [], parts: {}, checked: false, createdAt: Date.now() });
    tx.set(ref, { items, updatedAt: Date.now() }, { merge: true });
  });
}

// Hele kogebogen (til inspirationskortet). Rækkefølgen blandes én gang, så kortet viser noget nyt hver gang.
async function loadAll() {
  if (!fs || !state.fid) return;
  try {
    const snap = await fs.collection('families/' + state.fid + '/recipes').get();
    const list = snap.docs.map((d) => { const r = d.data() || {}; return { id: d.id, title: r.title || '', image: imgUrl(r.image), art: artColors(r.title), time: r.time || '', theme: (r.themes || [])[0] || '', intro: intro(r) }; }).filter((r) => r.title);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    list.sort((a, b) => (b.image ? 1 : 0) - (a.image ? 1 : 0)); // retter med foto først
    state.all = list; onChange();
  } catch (e) { /* prøv igen senere */ }
}
function intro(r) {
  let d = String(r.description || '').replace(/\s+/g, ' ').trim();
  if (!d) return '';
  const m = d.match(/^.{20,140}?[.!?](\s|$)/); d = m ? m[0].trim() : d;
  return d.length > 140 ? d.slice(0, 137).replace(/\s+\S*$/, '') + '…' : d;
}
