// easyHome – køkkentimer. Flere timere kan køre på én gang. De gælder for den skærm, de startes på.
import { settings, save } from './util.js';

let onChange = () => {};
export function onTimerChange(fn) { onChange = fn; }
const list = () => (settings.timers = Array.isArray(settings.timers) ? settings.timers : []);
export const timers = () => list();

export const left = (t) => (t.paused ? t.rest : Math.max(0, t.end - Date.now()));
export function fmt(ms) {
  const s = Math.ceil(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

export function start(min, label) {
  unlockAudio();
  const ms = Math.round(min * 60000);
  list().push({ id: 't' + Date.now().toString(36), label: label || (min >= 1 ? `${min} min` : `${Math.round(min * 60)} sek`), total: ms, end: Date.now() + ms, paused: false, rest: 0, done: false });
  save(); onChange();
}
export function toggle(id) {
  const t = list().find((x) => x.id === id); if (!t || t.done) return;
  if (t.paused) { t.end = Date.now() + t.rest; t.paused = false; } else { t.rest = left(t); t.paused = true; }
  save(); onChange();
}
export function add(id, min) {
  const t = list().find((x) => x.id === id); if (!t) return;
  const ms = min * 60000;
  if (t.done) { t.done = false; t.end = Date.now() + ms; t.total = ms; } else if (t.paused) t.rest += ms; else t.end += ms;
  t.total = Math.max(t.total, left(t));
  stopAlarmIfQuiet(); save(); onChange();
}
export function remove(id) { settings.timers = list().filter((x) => x.id !== id); stopAlarmIfQuiet(); save(); onChange(); }
export function stopAll() { settings.timers = list().filter((x) => !x.done); stopAlarm(); save(); onChange(); }

// Tjekkes hvert sekund: er en timer færdig, ringer skærmen
export function tick() {
  let changed = false;
  list().forEach((t) => { if (!t.paused && !t.done && left(t) <= 0) { t.done = true; changed = true; } });
  if (changed) { save(); onChange(); }
  if (list().some((t) => t.done)) startAlarm(); else stopAlarm();
}

/* ---------- Lyd (en blid alarm, der gentages, til man trykker stop) ---------- */
let ctx = null; let alarm = null;
function unlockAudio() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; } }
function beep(at, f) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
  o.start(at); o.stop(at + 0.4);
}
function ring() { if (!ctx) return; const n = ctx.currentTime; [0, 0.45, 0.9].forEach((d, i) => beep(n + d, i === 2 ? 1175 : 880)); }
function startAlarm() { if (alarm) return; unlockAudio(); ring(); alarm = setInterval(ring, 2200); }
function stopAlarm() { if (alarm) { clearInterval(alarm); alarm = null; } }
function stopAlarmIfQuiet() { if (!list().some((t) => t.done)) stopAlarm(); }
export const ringing = () => !!alarm;
