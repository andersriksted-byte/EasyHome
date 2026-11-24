// easyHome – læsevisning: åbner en nyhed i et vindu inde i appen i stedet for at forlade siden.
// Artiklen hentes via workeren, og Mozillas Readability (samme teknik som Safaris læsevisning) finder selve teksten.
// Teksten vises i en "sandkasse" (iframe uden scripts), så intet fra nyhedssiden kan påvirke easyHome.
import { fetchText, esc, settings } from './util.js';

let loading = null;
function loadReadability() {
  if (window.Readability) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js';
      s.onload = resolve; s.onerror = () => { loading = null; reject(new Error('Læsevisningen kunne ikke hentes')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };

function frameDoc(inner) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><base target="_blank">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap">
<style>
html{background:${cssVar('card')}}
body{margin:0 auto;max-width:720px;padding:28px 32px 60px;font:18px/1.65 Manrope,system-ui,sans-serif;color:${cssVar('text')};background:${cssVar('card')}}
h1{font-size:30px;line-height:1.2;margin:4px 0 14px;font-weight:800}
h2,h3{line-height:1.3}
.meta{font-size:13px;font-weight:800;color:${cssVar('hot')};text-transform:none}
.by{font-size:14px;color:${cssVar('muted')};margin:-6px 0 16px}
.lead{font-size:20px;font-weight:600;color:${cssVar('text2')}}
img,video{max-width:100%;height:auto;border-radius:12px}
figure{margin:18px 0}figcaption{font-size:13px;color:${cssVar('muted')};margin-top:6px}
a{color:${cssVar('accent')}}
blockquote{margin:16px 0;padding-left:16px;border-left:4px solid ${cssVar('line')};color:${cssVar('text2')}}
.cut{margin-top:28px;padding:16px;border-radius:12px;background:${cssVar('bg')};font-size:15px}
</style></head><body>${inner}</body></html>`;
}

function close() {
  const m = document.getElementById('reader');
  if (m) m.remove();
  document.removeEventListener('keydown', onKey);
}
function onKey(e) { if (e.key === 'Escape') close(); }

export const isOpen = () => !!document.getElementById('reader');

export async function openReader(url, source) {
  close();
  const m = document.createElement('div');
  m.id = 'reader'; m.className = 'reader'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Nyhed');
  m.innerHTML = `<div class="rdbox">
    <div class="rdtop"><span class="rdsrc">${esc(source || host(url))}</span>
      <a class="btn line" href="${esc(url)}" target="_blank" rel="noopener">Åbn på ${esc(host(url))}</a>
      <button class="btn dark" id="rdClose">Luk</button></div>
    <div class="rdbody"><div class="empty" style="margin:24px">Henter artiklen …</div></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#rdClose').addEventListener('click', close);
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  document.addEventListener('keydown', onKey);
  m.querySelector('#rdClose').focus();

  const body = m.querySelector('.rdbody');
  try {
    const [html] = await Promise.all([fetchText(url, { allowPublic: settings.news.publicProxyForTest }), loadReadability()]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const base = doc.createElement('base'); base.href = url; doc.head.prepend(base);
    const ogImg = (doc.querySelector('meta[property="og:image"]') || {}).content || '';
    const art = new window.Readability(doc, { charThreshold: 200 }).parse();
    if (!document.getElementById('reader')) return; // lukket imens
    if (!art || !art.content) throw new Error('Ingen tekst');
    const short = (art.textContent || '').trim().length < 600;
    const img = ogImg && !art.content.includes(ogImg.split('?')[0]) ? `<img src="${esc(ogImg)}" alt="">` : '';
    const inner = `<div class="meta">${esc(source || art.siteName || host(url))}</div><h1>${esc(art.title || '')}</h1>${art.byline ? `<div class="by">${esc(art.byline)}</div>` : ''}${img}${art.content}
      ${short ? `<div class="cut">Det ser ud til, at kun en del af artiklen kunne vises – måske kræver den abonnement. Tryk <b>Åbn på ${esc(host(url))}</b> øverst for at læse hele artiklen.</div>` : ''}`;
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
    f.setAttribute('title', art.title || 'Nyhed');
    f.srcdoc = frameDoc(inner);
    body.innerHTML = ''; body.appendChild(f);
  } catch (e) {
    if (!document.getElementById('reader')) return;
    body.innerHTML = `<div class="empty" style="margin:24px">Artiklen kunne ikke vises her${e.message === 'NO_PROXY' ? ' (forbindelsen er ikke sat op)' : ''}. Tryk <b>Åbn på ${esc(host(url))}</b> øverst for at læse den på mediets egen side.</div>`;
  }
}
