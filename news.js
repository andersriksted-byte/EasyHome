// Nyheder fra RSS-feeds. Hentes via workeren (browseren må ikke hente dem direkte pga. CORS).
import { fetchText, settings } from './util.js';

export const SOURCES = [
  { id: 'dr-seneste', group: 'DR', name: 'DR · Seneste nyt', url: 'https://www.dr.dk/nyheder/service/feeds/senestenyt' },
  { id: 'dr-alle', group: 'DR', name: 'DR · Alle nyheder', url: 'https://www.dr.dk/nyheder/service/feeds/allenyheder' },
  { id: 'dr-indland', group: 'DR', name: 'DR · Indland', url: 'https://www.dr.dk/nyheder/service/feeds/indland' },
  { id: 'dr-sporten', group: 'DR', name: 'DR · Sporten', url: 'https://www.dr.dk/nyheder/service/feeds/sporten' },
  { id: 'dr-penge', group: 'DR', name: 'DR · Penge', url: 'https://www.dr.dk/nyheder/service/feeds/penge' },
  { id: 'dr-kbh', group: 'DR', name: 'DR · P4 København', url: 'https://www.dr.dk/nyheder/service/feeds/regionale/kbh/' },
  { id: 'tv2', group: 'TV 2', name: 'TV 2 Nyheder', url: 'http://feeds.services.tv2.dk/api/feeds/nyheder/rss' },
  { id: 'jp', group: 'JP', name: 'Jyllands-Posten · Topnyheder', url: 'https://newsletter-proxy.aws.jyllands-posten.dk/v1/top-stories/jyllands-posten.dk' },
  { id: 'politiken', group: 'Politiken', name: 'Politiken · Seneste', url: 'https://politiken.dk/rss/senestenyt.rss', unverified: true },
  { id: 'berlingske', group: 'Berlingske', name: 'Berlingske', url: 'https://www.berlingske.dk/content/rss', unverified: true }
];

export function allSources() {
  return SOURCES.concat((settings.news.custom || []).map((c) => ({ ...c, group: c.name, custom: true })));
}

const strip = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const txt = (el, tag) => { const n = el.getElementsByTagName(tag)[0]; return n ? n.textContent : ''; };

export function parseFeed(xml, src) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Kunne ikke læse feedet');
  const nodes = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
  return nodes.map((n) => {
    let link = txt(n, 'link');
    const l = n.getElementsByTagName('link')[0];
    if (!link && l) link = l.getAttribute('href') || '';
    const d = txt(n, 'pubDate') || txt(n, 'published') || txt(n, 'updated') || txt(n, 'dc:date');
    const date = d ? new Date(d) : null;
    let image = '';
    for (const tag of ['media:content', 'media:thumbnail', 'enclosure']) {
      for (const el of n.getElementsByTagName(tag)) { const u = el.getAttribute('url'); const ty = el.getAttribute('type') || el.getAttribute('medium') || 'image'; if (u && /image/i.test(ty)) { image = u; break; } }
      if (image) break;
    }
    if (!image) { const m = /<img[^>]+src=["']([^"']+)["']/i.exec(txt(n, 'description') || txt(n, 'content:encoded')); if (m) image = m[1]; }
    return { title: strip(txt(n, 'title')), link: link.trim(), date: date && !isNaN(date) ? date : null, summary: strip(txt(n, 'description') || txt(n, 'summary')).slice(0, 220), image: /^https?:/.test(image) ? image : '', source: src.group, sourceId: src.id };
  }).filter((i) => i.title);
}

let cache = { key: '', t: 0, data: null };

export async function getNews() {
  const chosen = allSources().filter((s) => settings.news.sources.includes(s.id));
  const key = chosen.map((s) => s.id).join(',');
  if (cache.key === key && Date.now() - cache.t < 5 * 60000) return cache.data;
  const errors = [];
  const lists = await Promise.all(chosen.map(async (s) => {
    try { return parseFeed(await fetchText(s.url, { allowPublic: settings.news.publicProxyForTest }), s); }
    catch (e) { errors.push({ source: s.name, msg: e.message === 'NO_PROXY' ? 'Kræver forbindelse (se Indstillinger)' : e.message }); return []; }
  }));
  const seen = new Set();
  const items = lists.flat().filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  const data = { items, errors, fetched: new Date() };
  cache = { key, t: Date.now(), data };
  return data;
}
export const clearNewsCache = () => { cache = { key: '', t: 0, data: null }; };

// Tjek en adresse, før den gemmes. Er det en almindelig webside, finder vi sidens RSS-link.
export async function checkFeed(url) {
  const text = await fetchText(url, { allowPublic: settings.news.publicProxyForTest });
  try {
    const items = parseFeed(text, { group: '', id: '' });
    if (items.length) return { url, count: items.length, first: items[0].title };
  } catch (e) { /* ikke et feed – prøv at finde et i siden */ }
  const m = /<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i.exec(text);
  const href = m && /href=["']([^"']+)["']/i.exec(m[0]);
  if (href) {
    const feedUrl = new URL(href[1].replace(/&amp;/g, '&'), url).toString();
    const items = parseFeed(await fetchText(feedUrl, { allowPublic: settings.news.publicProxyForTest }), { group: '', id: '' });
    if (items.length) return { url: feedUrl, count: items.length, first: items[0].title, found: true };
  }
  throw new Error('Kunne ikke finde et nyhedsfeed på den adresse');
}
