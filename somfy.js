// easyHome – Somfy (Connexoon/TaHoma). Styres via jeres worker, som logger ind hos Somfy med TaHoma-login'et.
import { hasProxy, settings } from './util.js';

export const state = { checked: false, configured: null, devices: [], error: '', busy: {} };
let onChange = () => {};
export function onSomfyChange(fn) { onChange = fn; }


export async function refresh() {
  if (!hasProxy()) return;
  try {
    const st = await (await fetch(workerUrl('/somfy/devices'), { headers: hdr() })).json();
    if (st.configured === false) { state.configured = false; state.error = ''; }
    else if (st.error) { state.configured = true; state.error = st.error; }
    else { state.configured = true; state.error = ''; state.devices = (st.devices || []).sort((a, b) => a.label.localeCompare(b.label, 'da')); }
  } catch (e) { state.error = 'Kunne ikke nå Somfy'; }
  state.checked = true; onChange();
}
// Vi kalder workeren direkte for at kunne vise Somfys egen fejltekst
const workerUrl = (p) => settings.proxy.url.replace(/\/+$/, '') + p;
const hdr = () => ({ 'X-Dash-Key': settings.proxy.key });

export async function command(urls, cmd) {
  urls.forEach((u) => { state.busy[u] = cmd; }); onChange();
  try {
    const r = await fetch(workerUrl('/somfy/exec'), { method: 'POST', headers: { ...hdr(), 'Content-Type': 'application/json' }, body: JSON.stringify({ urls, command: cmd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Fejl ' + r.status);
  } finally {
    setTimeout(() => { urls.forEach((u) => { delete state.busy[u]; }); onChange(); }, 1500);
    [3000, 20000, 50000].forEach((t) => setTimeout(refresh, t));
  }
}

export function stateText(d) {
  const awning = d.ui === 'Awning' || d.ui === 'Pergola';
  if (d.moving) return 'Kører …';
  if (d.closure === null || d.closure === undefined) return d.rts ? '' : '';
  const v = Math.round(+d.closure);
  if (awning) return v <= 2 ? 'Inde' : v >= 98 ? 'Ude' : `Ude ${v} %`;
  return v <= 2 ? 'Oppe' : v >= 98 ? 'Nede' : `Nede ${v} %`;
}
