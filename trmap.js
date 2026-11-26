// Trafikkort: Leaflet med et roligt baggrundskort (OpenStreetMap/CARTO), Vejdirektoratets meldinger som prikker
// og – hvis workeren har en TomTom-nøgle – et trafiklag, der farver vejene efter hvor flydende trafikken kører.
import { workerFetch } from './util.js';
import { KINDS } from './trafik.js';

let loading = null;
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = './leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = './leaflet.js';
      s.onload = resolve; s.onerror = () => { loading = null; reject(new Error('Kortet kunne ikke hentes')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

let M = null; // { map, el, base, dark, flow, layer, viewKey }

// Trafiklaget hentes gennem workeren (med nøglen i en header), så TomTom-nøglen aldrig ligger i browseren
function flowLayer() {
  const Grid = window.L.GridLayer.extend({
    createTile(c, done) {
      const img = document.createElement('img'); img.alt = ''; img.className = 'tr-flow';
      workerFetch(`/trafik/flow/${c.z}/${c.x}/${c.y}`).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) img.src = URL.createObjectURL(b); done(null, img); }).catch((e) => done(e, img));
      return img;
    }
  });
  return new Grid({ opacity: 0.9, minZoom: 6, maxZoom: 17, zIndex: 5 });
}

function baseLayer(dark) {
  return window.L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`, {
    subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap · © CARTO · Vejdirektoratet' + '' });
}

// Tegner kortet i elementet (eller genbruger det, hvis det allerede står der)
export async function sync(el, { home, dest, items, flow, dark, radius }) {
  if (!el) return;
  try { await loadLeaflet(); } catch (e) { el.innerHTML = '<div class="empty">Kortet kunne ikke hentes.</div>'; return; }
  const L = window.L;
  if (!M || M.el !== el || !el.contains(M.map.getContainer())) {
    if (M) { try { M.map.remove(); } catch (e) { /* allerede væk */ } }
    const box = document.createElement('div'); box.className = 'tr-leaf'; el.innerHTML = ''; el.appendChild(box);
    const map = L.map(box, { zoomControl: true, attributionControl: true, preferCanvas: true });
    M = { map, el, base: null, dark: null, flow: null, layer: L.layerGroup().addTo(map), viewKey: '' };
    map.attributionControl.setPrefix('');
  }
  const { map } = M;
  if (M.dark !== dark) { if (M.base) M.base.remove(); M.base = baseLayer(dark).addTo(map); M.dark = dark; }
  if (flow && !M.flow) M.flow = flowLayer().addTo(map);
  if (!flow && M.flow) { M.flow.remove(); M.flow = null; }

  M.layer.clearLayers();
  if (dest) L.polyline([[home.lat, home.lon], [dest.lat, dest.lon]], { color: '#6E56CF', weight: 4, opacity: 0.55, dashArray: '8 8' }).addTo(M.layer);
  items.forEach((x) => {
    const K = KINDS[x.kind] || KINDS.haendelse;
    const icon = L.divIcon({ className: 'tr-pin', html: `<span style="--kc:${K.c}">${K.icon}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
    L.marker([x.lat, x.lon], { icon, zIndexOffset: x.kind === 'vejarbejde' ? 0 : 500 }).bindPopup(`<b>${esc(K.label)}</b><br>${esc(x.title)}`, { maxWidth: 260 }).addTo(M.layer);
  });
  const hm = L.divIcon({ className: 'tr-pin home', html: '<span>🏠</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
  L.marker([home.lat, home.lon], { icon: hm, zIndexOffset: 1000 }).addTo(M.layer);
  if (dest) L.marker([dest.lat, dest.lon], { icon: L.divIcon({ className: 'tr-pin home', html: '<span>📍</span>', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000 }).addTo(M.layer);

  // Udsnittet sættes kun, når mål eller radius skifter – ellers bliver kortet, hvor brugeren har flyttet det hen
  const key = dest ? `d${dest.lat},${dest.lon}` : `r${radius}`;
  if (M.viewKey !== key) {
    M.viewKey = key;
    if (dest) map.fitBounds(L.latLngBounds([[home.lat, home.lon], [dest.lat, dest.lon]]).pad(0.15));
    else if (radius) map.fitBounds(L.latLng(home.lat, home.lon).toBounds(radius * 2000));
    else map.fitBounds([[54.55, 8.0], [57.8, 15.2]]);
  }
  setTimeout(() => map.invalidateSize(), 0);
}

// Flyt kortet hen til en melding (tryk på et kort i listen)
export function focus(lat, lon) { if (M) M.map.setView([lat, lon], Math.max(M.map.getZoom(), 13), { animate: true }); }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
