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

// Lille script i rammen: et tryk på et link sendes til easyHome, som åbner det i den interne browser (rammen har ingen adgang til appen)
const NAV_JS = `<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.href;if(!/^https?:/.test(h))return;e.preventDefault();parent.postMessage({easyNav:h},'*');},true);document.addEventListener('submit',function(e){e.preventDefault();},true);<\/script>`;
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } };

function frameDoc(inner) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><base target="_self">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap">
<style>
html{background:${cssVar('card')}}
body{margin:0 auto;max-width:980px;padding:22px 28px 40px;font:17px/1.55 Manrope,system-ui,sans-serif;color:${cssVar('text')};background:${cssVar('card')}}
h1{font-size:26px;line-height:1.2;margin:4px 0 10px;font-weight:800}
p{margin:0 0 .8em}
h2,h3{line-height:1.3;font-size:20px;margin:1.1em 0 .4em;clear:right}
ul,ol{padding-left:22px}li{margin:.2em 0}
h1+.by,.by{clear:none}
.meta{font-size:13px;font-weight:800;color:${cssVar('hot')};text-transform:none}
.by{font-size:14px;color:${cssVar('muted')};margin:-6px 0 16px}
.lead{font-size:20px;font-weight:600;color:${cssVar('text2')}}
img,video{max-width:100%;max-height:260px;width:auto;height:auto;border-radius:12px;display:block;object-fit:cover}
p:empty,div:empty,figure:empty{display:none}
*{max-width:100%;box-sizing:border-box}
body *{min-height:0!important}
figure{margin:16px 0;clear:both}figure img{margin:0 auto;max-height:300px}figcaption{font-size:13px;color:${cssVar('muted')};margin-top:6px}
a{color:${cssVar('accent')}}
blockquote{margin:16px 0;padding-left:16px;border-left:4px solid ${cssVar('line')};color:${cssVar('text2')}}
.hero{float:right;width:40%;max-height:none;aspect-ratio:4/3;object-fit:cover;margin:0 0 12px 22px;border-radius:14px}
.cut{clear:both}
.cut{margin-top:28px;padding:16px;border-radius:12px;background:${cssVar('bg')};font-size:15px}
</style></head><body>${inner}${NAV_JS}</body></html>`;
}

function close() {
  const m = document.getElementById('reader');
  if (m) m.remove();
  document.removeEventListener('keydown', onKey);
}
function onKey(e) { if (e.key === 'Escape') close(); }

export const isOpen = () => !!document.getElementById('reader');

// Henter en artikel og bygger læsevisningen (stort billede øverst). Bruges af både popup-læseren og siden Nyheder.
const artCache = {};
// Rydder op i artiklen: billeder der først hentes ved scroll (lazy), tomme reklamepladser, iframes og stribevis af linjeskift
// giver ellers store huller i teksten (fx Ekstra Bladet)
// Henter afsnit, mellemrubrikker, citater og billeder fra artiklens hovedområde i rækkefølge
function collectBlocks(doc) {
  const roots = [...doc.querySelectorAll('article, main, [itemprop="articleBody"], [class*="article-body"], [class*="ArticleBody"]')];
  let best = { len: 0, html: '' };
  roots.forEach((root) => {
    const parts = []; let len = 0; const seen = new Set();
    root.querySelectorAll('p, h2, h3, blockquote, figure, li').forEach((el) => {
      if (el.closest('nav, footer, header, aside, [class*="related"], [class*="share"], [class*="newsletter"], [class*="teaser"], [class*="byline"]')) return;
      if ([...seen].some((x) => x.contains(el))) return;
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (el.tagName === 'FIGURE') { const im = el.querySelector('img'); if (im) { seen.add(el); parts.push(el.outerHTML); } return; }
      if (el.tagName === 'LI' && (t.length < 40 || el.querySelector('a') && el.querySelector('a').textContent.trim().length > t.length * 0.6)) return;
      if (el.tagName === 'P' && t.length < 25) return;
      if (!t) return;
      const linky = [...el.querySelectorAll('a')].reduce((n, a) => n + a.textContent.length, 0);
      if (linky > t.length * 0.6) return;
      seen.add(el); len += t.length;
      parts.push(`<${el.tagName.toLowerCase()}>${el.tagName === 'BLOCKQUOTE' || el.tagName === 'LI' ? esc(t) : el.innerHTML}</${el.tagName.toLowerCase()}>`);
    });
    if (len > best.len) best = { len, html: parts.join('') };
  });
  return best;
}
export function tidy(body, url) {
  const abs = (u) => { try { return new URL(u, url).href; } catch (e) { return ''; } };
  const fromSet = (v) => (v || '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean).pop() || '';
  body.querySelectorAll('img').forEach((img) => {
    let src = img.getAttribute('src') || '';
    if (!src || /^data:|placeholder|blank|spacer|1x1|pixel/i.test(src)) {
      src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original') || fromSet(img.getAttribute('data-srcset')) || fromSet(img.getAttribute('srcset')) || '';
      const pic = img.closest('picture'); if (!src && pic) { const so = pic.querySelector('source[srcset],source[data-srcset]'); if (so) src = fromSet(so.getAttribute('srcset') || so.getAttribute('data-srcset')); }
    }
    if (!src || /^data:/.test(src)) { (img.closest('figure') || img).remove(); return; }
    img.setAttribute('src', abs(src)); ['width', 'height', 'style', 'srcset', 'sizes', 'loading'].forEach((a) => img.removeAttribute(a));
  });
  body.querySelectorAll('picture source').forEach((x) => x.remove());
  body.querySelectorAll('iframe,embed,object,svg,script,style,noscript,form,button,input,aside,[aria-hidden="true"]').forEach((x) => x.remove());
  body.querySelectorAll('[class*="related"],[class*="share"],[class*="newsletter"],[class*="teaser"],[class*="paywall"],[class*="advert"],[class*="banner"]').forEach((x) => x.remove());
  // Lister og blokke, der mest består af links ("Læs også …"), fjernes
  body.querySelectorAll('ul,ol,div,section').forEach((x) => { const t = x.textContent.replace(/\s+/g, ' ').trim(); if (!t || x.querySelector('img')) return; const l = [...x.querySelectorAll('a')].reduce((n, a) => n + a.textContent.trim().length, 0); if (l > t.length * 0.7 && t.length < 600) x.remove(); });
  body.querySelectorAll('[style]').forEach((x) => x.removeAttribute('style'));
  body.querySelectorAll('[width],[height]').forEach((x) => { if (x.tagName !== 'IMG') { x.removeAttribute('width'); x.removeAttribute('height'); } });
  // Tomme blokke (ingen tekst og intet billede/video) fjernes – indefra og ud
  [...body.querySelectorAll('div,p,section,figure,span,li,ul,h2,h3,h4,a')].reverse().forEach((x) => { if (!x.textContent.replace(/[\s\u00a0\u200b]+/g, '') && !x.querySelector('img,video')) x.remove(); });
  // Flere linjeskift i træk bliver til ét
  body.querySelectorAll('br').forEach((br) => { let n = br.nextSibling; while (n && n.nodeType === 3 && !n.textContent.trim()) n = n.nextSibling; if (n && n.nodeName === 'BR') br.remove(); });
}
export function cachedArticle(url) { return artCache[url] || null; }
export async function loadArticle(url, source, fallbackImg = '') {
  if (artCache[url]) return artCache[url];
  const [html] = await Promise.all([fetchText(url, { allowPublic: settings.news.publicProxyForTest }), loadReadability()]);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base'); base.href = url; doc.head.prepend(base);
  const ogImg = (doc.querySelector('meta[property="og:image"]') || {}).content || fallbackImg || '';
  // Artikelteksten fra sidens strukturerede data (JSON-LD) – bruges, hvis læsevisningen ikke finder teksten (fx Fyens Stiftstidende)
  let ld = null;
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((sc) => { if (ld) return; try { const walk = (o) => { if (!o || typeof o !== 'object' || ld) return; if (Array.isArray(o)) return o.forEach(walk); if (o.articleBody || (/Article/.test(o['@type']) && o.headline)) { ld = o; return; } if (o['@graph']) walk(o['@graph']); }; walk(JSON.parse(sc.textContent)); } catch (e) { /* ugyldig */ } });
  const metaDesc = (doc.querySelector('meta[property="og:description"],meta[name="description"]') || {}).content || '';
  const ogTitle = (doc.querySelector('meta[property="og:title"]') || {}).content || '';
  let art = null;
  try { art = new window.Readability(doc.cloneNode(true), { charThreshold: 200 }).parse(); } catch (e) { art = null; }
  const ldText = ld && ld.articleBody ? String(ld.articleBody) : '';
  if ((!art || (art.textContent || '').trim().length < 400) && (ldText.length > ((art && art.textContent) || '').trim().length)) {
    art = { title: ld.headline || ogTitle || (art && art.title) || '', byline: (art && art.byline) || '', siteName: '', textContent: ldText,
      content: (ld.description ? `<p class="lead">${esc(ld.description)}</p>` : '') + ldText.split(/\n{1,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('') };
  }
  // Reserve 2: saml afsnittene direkte fra sidens <article>/<main> (fx DR, hvor teksten er delt op i mange blokke).
  // Bruges, hvis den giver tydeligt mere tekst end læsevisningen
  const blocks = collectBlocks(doc);
  const curLen = ((art && art.textContent) || '').trim().length;
  if (blocks.len > Math.max(curLen * 1.3, curLen + 300)) art = { title: (art && art.title) || ogTitle, byline: (art && art.byline) || '', siteName: '', textContent: 'x'.repeat(blocks.len), content: blocks.html };
  if ((!art || !art.content) && metaDesc) art = { title: ogTitle, byline: '', siteName: '', textContent: metaDesc, content: `<p class="lead">${esc(metaDesc)}</p>` };
  if (!art || !art.content) throw new Error('Ingen tekst');
  const body = new DOMParser().parseFromString('<div>' + art.content + '</div>', 'text/html').body.firstChild;
  tidy(body, url);
  const stem = (u) => (u || '').split('?')[0].split('/').pop();
  if (ogImg) { const dup = [...body.querySelectorAll('img')].find((i) => stem(i.getAttribute('src')) === stem(ogImg)); if (dup) (dup.closest('figure') || dup).remove(); }
  const short = (art.textContent || '').trim().length < 600;
  const inner = `${ogImg ? `<img class="hero" src="${esc(ogImg)}" alt="">` : ''}<div class="meta">${esc(source || art.siteName || host(url))}</div><h1>${esc(art.title || '')}</h1>${art.byline ? `<div class="by">${esc(art.byline)}</div>` : ''}${body.innerHTML}
      ${short ? `<div class="cut">Kun en del af artiklen kunne vises – måske kræver den abonnement. <a href="${esc(url)}">Læs hele artiklen på ${esc(host(url))}</a>.</div>` : ''}`;
  artCache[url] = { title: art.title || '', doc: frameDoc(inner) };
  return artCache[url];
}
export const articleFrame = (a) => `<iframe sandbox="allow-scripts" title="${esc(a.title || 'Nyhed')}" srcdoc="${esc(a.doc)}"></iframe>`;

export async function openReader(url, source) {
  close();
  const m = document.createElement('div');
  m.id = 'reader'; m.className = 'reader'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Nyhed');
  m.innerHTML = `<div class="rdbox">
    <div class="rdtop"><span class="rdsrc">${esc(source || host(url))}</span>
      <button class="btn line" id="rdWeb">Åbn på ${esc(host(url))}</button>
      <button class="btn dark" id="rdClose">Luk</button></div>
    <div class="rdbody"><div class="empty" style="margin:24px">Henter artiklen …</div></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#rdClose').addEventListener('click', close);
  m.querySelector('#rdWeb').addEventListener('click', () => openBrowser(url));
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  document.addEventListener('keydown', onKey);
  m.querySelector('#rdClose').focus();

  const body = m.querySelector('.rdbody');
  try {
    const a = await loadArticle(url, source);
    if (!document.getElementById('reader')) return; // lukket imens
    body.innerHTML = articleFrame(a);

  } catch (e) {
    if (!document.getElementById('reader')) return;
    body.innerHTML = `<div class="empty" style="margin:24px">Artiklen kunne ikke vises her${e.message === 'NO_PROXY' ? ' (forbindelsen er ikke sat op)' : ''}. Tryk <b>Åbn på ${esc(host(url))}</b> øverst for at læse den på mediets egen side.</div>`;
  }
}

// Intern browser: siden hentes via workeren og vises i en lukket ramme inde i easyHome (ingen af sidens egne scripts køres).
// Links åbnes i samme vindue, og ← går tilbage.
const brHist = [];
function closeBrowser() { const m = document.getElementById('browser'); if (m) m.remove(); brHist.length = 0; }
export async function openBrowser(url, push = true) {
  let m = document.getElementById('browser');
  if (!m) {
    m = document.createElement('div'); m.id = 'browser'; m.className = 'reader browser'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Browser');
    m.innerHTML = `<div class="rdbox"><div class="rdtop"><button class="btn line" id="brBack" aria-label="Tilbage">←</button><span class="rdsrc" id="brHost"></span><button class="btn line" id="brReload" aria-label="Genindlæs">↻</button><button class="btn dark" id="brClose">Luk</button></div><div class="rdbody"></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#brClose').addEventListener('click', closeBrowser);
    m.querySelector('#brBack').addEventListener('click', () => { if (brHist.length > 1) { brHist.pop(); openBrowser(brHist[brHist.length - 1], false); } else closeBrowser(); });
    m.querySelector('#brReload').addEventListener('click', () => { if (brHist.length) openBrowser(brHist[brHist.length - 1], false); });
    m.addEventListener('click', (e) => { if (e.target === m) closeBrowser(); });
  }
  if (push) brHist.push(url);
  m.querySelector('#brHost').textContent = host(url);
  m.querySelector('#brBack').disabled = false;
  const body = m.querySelector('.rdbody');
  body.innerHTML = '<div class="empty" style="margin:24px">Henter siden …</div>';
  try {
    const html = await fetchText(url, { allowPublic: settings.news.publicProxyForTest });
    if (brHist[brHist.length - 1] !== url) return; // en anden side er valgt imens
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script:not([type="application/ld+json"]),iframe,object,embed').forEach((x) => x.remove());
    doc.querySelectorAll('noscript').forEach((n) => { const t = document.createElement('div'); t.innerHTML = n.textContent; n.replaceWith(...t.childNodes); });
    doc.querySelectorAll('img').forEach((img) => { const ds = img.getAttribute('data-src') || img.getAttribute('data-lazy-src'); const src = img.getAttribute('src') || ''; if (ds && (!src || /^data:/.test(src))) img.setAttribute('src', ds); img.removeAttribute('loading'); });
    doc.querySelectorAll('meta[http-equiv]').forEach((x) => x.remove());
    let base = doc.querySelector('base'); if (!base) { base = doc.createElement('base'); doc.head.prepend(base); } base.href = url; base.target = '_self';
    const out = '<!doctype html>' + doc.documentElement.outerHTML.replace(/<\/body>/i, NAV_JS + '</body>');
    body.innerHTML = `<iframe sandbox="allow-scripts" title="${esc(host(url))}"></iframe>`;
    body.firstChild.srcdoc = out;
  } catch (e) {
    body.innerHTML = `<div class="empty" style="margin:24px">Siden kunne ikke hentes${e.message === 'NO_PROXY' ? ' (forbindelsen er ikke sat op)' : ''}.</div>`;
  }
}
// Links i læsevisningen og i den interne browser
window.addEventListener('message', (e) => { const u = e.data && e.data.easyNav; if (typeof u === 'string' && /^https?:/.test(u)) openBrowser(u); });
