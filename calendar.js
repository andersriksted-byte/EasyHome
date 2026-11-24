// Kalendere via iCal-links (Google "hemmelig adresse i iCal-format", iCloud offentlig kalender, Outlook ICS).
// Bruger biblioteket ical.js (indlæses i index.html) til at forstå gentagne aftaler.
import { fetchText, settings, startOfDay, addDays } from './util.js';

export function expandIcs(text, from, to, meta = {}) {
  const ICAL = (typeof window !== 'undefined' ? window : globalThis).ICAL;
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents('vtimezone')) { try { ICAL.TimezoneService.register(tz); } catch (e) { /* dublet */ } }
  const events = comp.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v));
  const masters = new Map();
  const exceptions = [];
  for (const ev of events) {
    if (ev.isRecurrenceException()) exceptions.push(ev); else masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) { const m = masters.get(ex.uid); if (m) m.relateException(ex); else masters.set(ex.uid + ex.recurrenceId, ex); }

  const out = [];
  const push = (summary, s, e, allDay, location) => {
    const start = s.toJSDate();
    let end = e ? e.toJSDate() : new Date(start.getTime() + (allDay ? 86400000 : 3600000));
    if (end <= from || start >= to) return;
    out.push({ title: summary || '(uden titel)', start, end, allDay, location: location || '', cal: meta.id, color: meta.color, who: meta.name });
  };
  for (const ev of masters.values()) {
    const allDay = ev.startDate.isDate;
    if (ev.isRecurring()) {
      const it = ev.iterator();
      let next; let n = 0;
      while ((next = it.next()) && n++ < 2000) {
        const occStart = next.toJSDate();
        if (occStart >= to) break;
        const d = ev.getOccurrenceDetails(next);
        push(d.item.summary, d.startDate, d.endDate, allDay, d.item.location);
      }
    } else {
      push(ev.summary, ev.startDate, ev.endDate, allDay, ev.location);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

let cache = { key: '', t: 0, data: null };

export async function getEvents(weeksAhead = 3) {
  const cals = settings.calendars.filter((c) => c.url);
  const key = cals.map((c) => c.url + c.color + c.name).join('|');
  if (cache.key === key && Date.now() - cache.t < 10 * 60000) return cache.data;
  const from = addDays(startOfDay(new Date()), -7);
  const to = addDays(from, 7 * (weeksAhead + 1));
  const errors = [];
  const lists = await Promise.all(cals.map(async (c) => {
    try {
      const url = c.url.trim().replace(/^webcal:\/\//i, 'https://');
      return expandIcs(await fetchText(url), from, to, c);
    } catch (e) {
      errors.push({ cal: c.name, msg: e.message === 'NO_PROXY' ? 'Kræver forbindelse (se Indstillinger)' : e.message });
      return [];
    }
  }));
  const data = { events: lists.flat().sort((a, b) => a.start - b.start), errors, fetched: new Date(), demo: cals.length === 0 };
  if (data.demo) data.events = demoEvents();
  cache = { key, t: Date.now(), data };
  return data;
}
export const clearCalCache = () => { cache = { key: '', t: 0, data: null }; };

// Vises kun indtil I har tilføjet jeres egne kalendere
function demoEvents() {
  const t = startOfDay(new Date());
  const at = (d, h, m) => { const x = addDays(t, d); x.setHours(h, m); return x; };
  const mk = (d, h, m, dur, title, who, color) => ({ title, start: at(d, h, m), end: new Date(at(d, h, m).getTime() + dur * 60000), allDay: false, who, color, location: '' });
  return [
    mk(0, 7, 30, 30, 'Aflevering i skole', 'Far', '#4C78D0'),
    mk(0, 15, 0, 60, 'Svømning', 'Barn 1', '#D9A400'),
    mk(0, 19, 0, 90, 'Forældremøde', 'Mor', '#D0563C'),
    mk(1, 8, 15, 30, 'Tandlæge', 'Barn 2', '#2E9D5B'),
    mk(2, 20, 0, 90, 'Padel', 'Far', '#4C78D0'),
    mk(3, 12, 0, 240, 'Fri tidligt', 'Barn 2', '#2E9D5B'),
    mk(4, 14, 0, 180, 'Fødselsdag hos farmor', 'Alle', '#7A5AC8')
  ];
}
