// Sport: andre sportsgrene end fodbold (ESPN og Jolpica gennem workeren) og detaljer om den enkelte kamp
import { settings, workerFetch, startOfDay } from './util.js';

export const SPORTS = [
  { id: 'f1', name: 'Formel 1', ico: '🏎️', kind: 'f1' },
  { id: 'atp', name: 'Tennis · herrer', ico: '🎾', kind: 'tennis', path: 'tennis/atp' },
  { id: 'wta', name: 'Tennis · damer', ico: '🎾', kind: 'tennis', path: 'tennis/wta' },
  { id: 'golf', name: 'Golf · PGA Tour', ico: '⛳', kind: 'golf', path: 'golf/pga' },
  { id: 'nba', name: 'Basketball · NBA', ico: '🏀', kind: 'team', path: 'basketball/nba' },
  { id: 'nfl', name: 'Amerikansk fodbold · NFL', ico: '🏈', kind: 'team', path: 'football/nfl' },
  { id: 'nhl', name: 'Ishockey · NHL', ico: '🏒', kind: 'team', path: 'hockey/nhl' }
];
export const followed = () => ((settings.sport && settings.sport.on) || []).map((id) => SPORTS.find((s) => s.id === id)).filter(Boolean);

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const getJson = async (p) => (await workerFetch(p)).json();

/* ---------- Kampe pr. dag ---------- */
const cache = {}; // `${sport}|${ymd}` → { at, items, error, loading }
export const dayData = (id, d) => cache[id + '|' + ymd(d)];
// Hvor ofte en dag hentes igen: under kampe hvert minut, i dag hvert 5. minut, andre dage sjældnere
function stale(c, d) {
  if (!c || !c.at) return true;
  const age = Date.now() - c.at; const today = startOfDay(new Date());
  if ((c.items || []).some((x) => x.state === 'in' || (x.state === 'pre' && Math.abs(x.date - Date.now()) < 15 * 60000))) return age > 60000;
  if (sameDay(d, today)) return age > 5 * 60000;
  return age > (d < today ? 6 * 3600000 : 30 * 60000);
}

const RND = [[/^final$/i, 'Finale'], [/semi/i, 'Semifinale'], [/quarter/i, 'Kvartfinale'], [/round of 16/i, 'Ottendedelsfinale'], [/round of 32/i, '3. runde'], [/group/i, 'Gruppespil'], [/qualif/i, 'Kvalifikation'], [/(\d)(st|nd|rd|th) round|round (\d)/i, (m) => `${m[1] || m[3]}. runde`]];
const roundDa = (t) => { for (const [re, v] of RND) { const m = String(t || '').match(re); if (m) return typeof v === 'function' ? v(m) : v; } return t || ''; };
const evState = (st) => ((st || {}).type || {}).state || 'pre';

function teamSide(c) {
  const t = c.team || {};
  return { id: String(t.id || ''), name: t.shortDisplayName || t.displayName || '', full: t.displayName || '', abbr: t.abbreviation || '', logo: t.logo || (t.logos && t.logos[0] && t.logos[0].href) || '',
    score: c.score == null ? '' : String(typeof c.score === 'object' ? c.score.displayValue ?? '' : c.score), win: !!c.winner,
    lines: (c.linescores || []).map((l) => (l.displayValue != null ? String(l.displayValue) : String(l.value ?? ''))), record: (((c.records || [])[0]) || {}).summary || '' };
}
function parseTeam(ev, sp) {
  const comp = (ev.competitions || [])[0] || {}; const st = comp.status || ev.status || {}; const ty = st.type || {};
  const side = (h) => teamSide((comp.competitors || []).find((x) => x.homeAway === h) || {});
  return { kind: 'team', sport: sp.id, id: String(ev.id), date: new Date(ev.date), state: ty.state || 'pre', detail: ty.shortDetail || '', clock: st.displayClock || '', period: st.period || 0,
    home: side('home'), away: side('away'), venue: (comp.venue && comp.venue.fullName) || '',
    leaders: (comp.leaders || []).slice(0, 3).map((L) => { const x = (L.leaders || [])[0] || {}; return { name: L.displayName || L.name || '', who: (x.athlete || {}).shortName || (x.athlete || {}).displayName || '', val: x.displayValue || '' }; }).filter((x) => x.who) };
}
function tennisSide(c) {
  const a = c.athlete; const r = c.roster;
  return { name: a ? a.shortName || a.displayName : r ? r.shortDisplayName || r.displayName : '', full: a ? a.displayName : (r && r.displayName) || '', flag: a && a.flag ? a.flag.href : '',
    win: !!c.winner, rank: c.curatedRank && c.curatedRank.current && c.curatedRank.current < 99 ? c.curatedRank.current : null,
    sets: (c.linescores || []).map((l) => ({ v: l.value == null ? '' : Math.round(l.value), tb: l.tiebreak, w: !!l.winner })) };
}
function parseTennis(ev, sp) {
  const out = [];
  (ev.groupings || []).forEach((g) => {
    const slug = (g.grouping && g.grouping.slug) || '';
    if (/doubles/.test(slug)) return; // kun single (double fylder meget og følges sjældent)
    (g.competitions || []).forEach((c) => {
      const cs = (c.competitors || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      out.push({ kind: 'tennis', sport: sp.id, id: String(c.id), date: new Date(c.date || c.startDate || ev.date), state: evState(c.status), detail: ((c.status || {}).type || {}).shortDetail || '',
        tour: ev.name || ev.shortName || '', round: roundDa((c.round || {}).displayName), court: (c.venue && c.venue.court) || '', p1: tennisSide(cs[0] || {}), p2: tennisSide(cs[1] || {}) });
    });
  });
  return out;
}
function parseGolf(ev, sp) {
  const c = (ev.competitions || [])[0] || {};
  const ps = c.competitors || [];
  const rnd = Math.max(0, ...ps.flatMap((p) => (p.linescores || []).filter((l) => l.value).map((l) => l.period || 0)));
  return { kind: 'golf', sport: sp.id, id: String(ev.id), date: new Date(ev.date), end: new Date(ev.endDate || ev.date), state: evState(ev.status || c.status), detail: (((ev.status || c.status || {}).type) || {}).shortDetail || '',
    name: ev.name || '', round: rnd,
    rows: ps.map((p) => { const ls = p.linescores || []; const cur = ls.find((l) => l.period === rnd) || {};
      return { pos: (p.status && p.status.position && p.status.position.displayName) || String(p.order || ''), name: (p.athlete || {}).displayName || '', flag: ((p.athlete || {}).flag || {}).href || '',
        score: p.score || 'E', today: cur.displayValue && cur.displayValue !== '-' ? cur.displayValue : '', thru: p.status ? p.status.thru : null }; }) };
}

/* ---------- Formel 1 ---------- */
const F1S = [['FirstPractice', 'Træning 1', 60], ['SecondPractice', 'Træning 2', 60], ['ThirdPractice', 'Træning 3', 60], ['SprintQualifying', 'Sprint-kvalifikation', 45], ['SprintShootout', 'Sprint-kvalifikation', 45],
  ['Sprint', 'Sprint', 45], ['Qualifying', 'Kvalifikation', 60], ['Race', 'Løb', 120]];
const f1 = { races: null, at: 0, res: {}, standings: null, stAt: 0 };
async function f1Races() {
  if (f1.races && Date.now() - f1.at < 6 * 3600000) return f1.races;
  const j = await getJson('/f1/current/races');
  f1.races = (((j.MRData || {}).RaceTable || {}).Races || []); f1.at = Date.now(); return f1.races;
}
function f1Sessions(races) {
  const now = Date.now(); const out = [];
  races.forEach((r) => F1S.forEach(([key, label, min]) => {
    const s = key === 'Race' ? { date: r.date, time: r.time } : r[key]; if (!s || !s.date) return;
    const d = new Date(`${s.date}T${s.time || '12:00:00Z'}`);
    const state = now < +d ? 'pre' : now < +d + min * 60000 ? 'in' : 'post';
    const loc = (r.Circuit && r.Circuit.Location) || {};
    out.push({ kind: 'f1', sport: 'f1', id: `${r.round}-${key}`, round: r.round, key, label, race: r.raceName || '', circuit: (r.Circuit || {}).circuitName || '', place: [loc.locality, loc.country].filter(Boolean).join(', '), date: d, state });
  }));
  return out;
}
const RESKEY = { Race: ['results', 'Results'], Sprint: ['sprint', 'SprintResults'], Qualifying: ['qualifying', 'QualifyingResults'] };
export const f1Result = (it) => f1.res[it.round + '-' + it.key];
// Resultater hentes for afsluttede løb, sprint og kvalifikation (hvert 5. minut til de foreligger)
export async function loadF1Result(it) {
  const rk = RESKEY[it.key]; if (!rk || it.state === 'pre') return null;
  const k = it.round + '-' + it.key; const c = f1.res[k];
  if (c && (c.loading || (c.rows.length && Date.now() - c.at < 30 * 60000) || Date.now() - c.at < 5 * 60000)) return c;
  f1.res[k] = { ...(c || { rows: [] }), loading: true };
  try {
    const j = await getJson(`/f1/current/${it.round}/${rk[0]}`);
    const race = (((j.MRData || {}).RaceTable || {}).Races || [])[0] || {};
    const rows = (race[rk[1]] || []).map((x) => ({ pos: x.position, code: (x.Driver || {}).code || '', name: `${(x.Driver || {}).givenName || ''} ${(x.Driver || {}).familyName || ''}`.trim(), team: (x.Constructor || {}).name || '',
      time: (x.Time && x.Time.time) || x.Q3 || x.Q2 || x.Q1 || x.status || '', pts: x.points || '' }));
    f1.res[k] = { at: Date.now(), rows };
  } catch (e) { f1.res[k] = { at: Date.now(), rows: (c && c.rows) || [], error: e.message }; }
  return f1.res[k];
}
export async function f1Standings() {
  if (f1.standings && Date.now() - f1.stAt < 30 * 60000) return f1.standings;
  const j = await getJson('/f1/current/driverStandings');
  const L = ((((j.MRData || {}).StandingsTable || {}).StandingsLists) || [])[0] || {};
  f1.standings = (L.DriverStandings || []).map((x) => ({ pos: x.position, name: `${(x.Driver || {}).givenName || ''} ${(x.Driver || {}).familyName || ''}`.trim(), team: ((x.Constructors || [])[0] || {}).name || '', pts: x.points, wins: x.wins }));
  f1.stAt = Date.now(); return f1.standings;
}

// Hent én sportsgren for én dag. ESPN dater amerikanske kampe efter deres egen tid, så dagen før hentes også, og kampene sorteres efter dansk dato.
export async function loadDay(sp, d, force = false) {
  const key = sp.id + '|' + ymd(d); const c = cache[key];
  if (c && c.loading) return c;
  if (!force && !stale(c, d)) return c;
  cache[key] = { ...(c || { items: [] }), loading: true };
  try {
    let items = [];
    if (sp.kind === 'f1') items = f1Sessions(await f1Races()).filter((x) => sameDay(x.date, d));
    else {
      const js = await Promise.all([ymd(addDays(d, -1)), ymd(d)].map((x) => getJson(`/espn/${sp.path}/scoreboard?dates=${x}`).catch(() => ({}))));
      const evs = []; const seen = new Set();
      js.forEach((j) => (j.events || (((j.leagues || [])[0] || {}).events) || []).forEach((e) => { if (!seen.has(e.id)) { seen.add(e.id); evs.push(e); } }));
      if (sp.kind === 'team') items = evs.map((e) => parseTeam(e, sp)).filter((x) => sameDay(x.date, d));
      else if (sp.kind === 'tennis') items = evs.flatMap((e) => parseTennis(e, sp)).filter((x) => sameDay(x.date, d));
      else if (sp.kind === 'golf') items = evs.map((e) => parseGolf(e, sp)).filter((x) => startOfDay(x.date) <= d && d <= x.end);
      if (!js.some((j) => j.events || j.leagues)) throw new Error('Kunne ikke hente ' + sp.name);
    }
    cache[key] = { at: Date.now(), items };
  } catch (e) { cache[key] = { at: Date.now(), items: (c && c.items) || [], error: e.message }; }
  return cache[key];
}

/* ---------- Detaljer om en fodboldkamp ---------- */
const STATS = [['possessionPct', 'Boldbesiddelse', '%'], ['totalShots', 'Skud'], ['shotsOnTarget', 'Skud på mål'], ['wonCorners', 'Hjørnespark'], ['totalPasses', 'Afleveringer'], ['passPct', 'Afleveringer der rammer', '%'],
  ['foulsCommitted', 'Frispark begået'], ['offsides', 'Offside'], ['saves', 'Redninger'], ['yellowCards', 'Gule kort'], ['redCards', 'Røde kort']];
const pct = (v) => { const n = parseFloat(String(v).replace(',', '.')); if (isNaN(n)) return v; return String(Math.round(n <= 1 ? n * 100 : n)); };
const POS = { G: 'MV', GK: 'MV', D: 'F', CD: 'F', 'CD-L': 'F', 'CD-R': 'F', LB: 'F', RB: 'F', M: 'M', CM: 'M', DM: 'M', AM: 'M', LM: 'M', RM: 'M', F: 'A', CF: 'A', LW: 'A', RW: 'A', ST: 'A' };
function playKind(e) {
  const t = `${(e.type || {}).type || ''} ${(e.type || {}).text || ''} ${e.text || ''}`;
  if (e.ownGoal || /own goal/i.test(t)) return 'og';
  if (e.scoringPlay || /goal/i.test((e.type || {}).type || '') || /^goal/i.test((e.type || {}).text || '')) return e.penaltyKick || /penalty/i.test(t) ? 'pen' : 'goal';
  if (e.redCard || /red card/i.test(t)) return 'red';
  if (e.yellowCard || /yellow card/i.test(t)) return 'yellow';
  if (/substitution/i.test(t)) return 'sub';
  if (/halftime|half time/i.test(t)) return 'ht';
  return '';
}
const names = (e) => (e.participants || []).map((p) => (p.athlete || {}).displayName).concat((e.athletesInvolved || []).map((a) => (a || {}).displayName)).filter(Boolean);
const details = {};
export const detailOf = (m) => details[m.id];
export async function loadDetail(m, force = false) {
  const c = details[m.id];
  if (c && (c.loading || (!force && Date.now() - c.at < (m.state === 'in' ? 25000 : 10 * 60000)))) return c;
  details[m.id] = { ...(c || {}), loading: true };
  try {
    if (!m.lg) throw new Error('Ingen detaljer for denne kamp');
    const j = await getJson(`/espn/${m.lg}/summary?event=${m.id}`);
    const hc = ((j.header || {}).competitions || [])[0] || {};
    const comps = hc.competitors || [];
    const sideOf = (teamId) => { const x = comps.find((y) => String((y.team || {}).id) === String(teamId)); return x ? x.homeAway : String(teamId) === m.home.id ? 'home' : String(teamId) === m.away.id ? 'away' : ''; };
    const src = (j.keyEvents || []).length ? j.keyEvents : hc.details || [];
    const events = src.map((e) => { const k = playKind(e); const ns = names(e);
      return { k, clock: (e.clock || {}).displayValue || '', side: e.team ? sideOf(e.team.id) : '', who: ns[0] || '', other: ns[1] || '', text: e.shortText || e.text || '' }; })
      .filter((e) => e.k && (e.k === 'ht' || e.side));
    const bt = ((j.boxscore || {}).teams || []);
    const st = (side) => { const t = bt.find((x) => x.homeAway === side) || bt.find((x) => String((x.team || {}).id) === (side === 'home' ? m.home.id : m.away.id)) || {}; return Object.fromEntries((t.statistics || []).map((s) => [s.name, s.displayValue])); };
    const H = st('home'); const A = st('away');
    const stats = STATS.filter(([k]) => H[k] != null && A[k] != null && H[k] !== '' ).map(([k, label, unit]) => ({ label, h: unit ? pct(H[k]) : H[k], a: unit ? pct(A[k]) : A[k], unit: unit || '' }));
    const lineup = (side) => { const r = (j.rosters || []).find((x) => x.homeAway === side) || {}; const ps = r.roster || [];
      const P = (p) => ({ n: p.jersey, name: (p.athlete || {}).displayName || '', pos: POS[(p.position || {}).abbreviation] || '', out: p.subbedOut, in: p.subbedIn });
      return { formation: r.formation || '', starters: ps.filter((p) => p.starter).map(P), subs: ps.filter((p) => !p.starter).map(P) }; };
    const g = j.gameInfo || {};
    const ref = (g.officials || []).find((o) => /referee/i.test(o.position || '')) || (g.officials || [])[0];
    const status = hc.status || {};
    details[m.id] = { at: Date.now(), events, stats, lineups: { home: lineup('home'), away: lineup('away') },
      venue: (g.venue && [g.venue.fullName, g.venue.city].filter(Boolean).join(', ')) || m.venue || '', attendance: g.attendance || 0, referee: ref ? ref.displayName : '',
      score: { home: (comps.find((x) => x.homeAway === 'home') || {}).score, away: (comps.find((x) => x.homeAway === 'away') || {}).score },
      state: (status.type || {}).state || m.state, clock: status.displayClock || '', detail: (status.type || {}).shortDetail || '' };
  } catch (e) {
    // Uden detaljer: mål og kort fra kampoversigten
    const events = (m.plays || []).map((p) => ({ k: p.og ? 'og' : p.goal ? (p.pen ? 'pen' : 'goal') : p.red ? 'red' : 'yellow', clock: p.clock, side: p.team === m.home.id ? 'home' : p.team === m.away.id ? 'away' : '', who: p.who }));
    details[m.id] = { at: Date.now(), events, stats: [], lineups: null, venue: m.venue || '', error: e.message };
  }
  return details[m.id];
}
