// Fodbold: favoritholdenes kampe og resultater fra ESPN's offentlige data (hentes gennem workeren)
import { settings, workerFetch } from './util.js';

export const LEAGUES = [
  { id: 'den.1', name: 'Superligaen' }, { id: 'den.2', name: '1. division' },
  { id: 'eng.1', name: 'Premier League' }, { id: 'esp.1', name: 'La Liga' }, { id: 'ger.1', name: 'Bundesliga' },
  { id: 'ita.1', name: 'Serie A' }, { id: 'fra.1', name: 'Ligue 1' }, { id: 'uefa.champions', name: 'Champions League' },
  { id: 'uefa.europa', name: 'Europa League' }, { id: 'uefa.europa.conf', name: 'Conference League' }
];
export const NATIONAL = [
  { id: '479', name: 'Danmark (herrer)', short: 'Danmark', logo: 'https://a.espncdn.com/i/teamlogos/countries/500/den.png', lg: 'nat' }
];
const COMP = { 'Danish Superliga': 'Superligaen', 'Danish Cup': 'Pokalen', 'Danish 1st Division': '1. division', 'UEFA Conference League': 'Conference League', 'UEFA Europa League': 'Europa League', 'UEFA Champions League': 'Champions League', 'International Friendly': 'Venskabskamp', 'WCQ - UEFA': 'VM-kvalifikation', 'UEFA Nations League': 'Nations League', 'UEFA European Championship Qualifying': 'EM-kvalifikation', 'FIFA World Cup': 'VM', 'UEFA European Championship': 'EM', 'English Premier League': 'Premier League', 'Spanish LALIGA': 'La Liga', 'German Bundesliga': 'Bundesliga', 'Italian Serie A': 'Serie A', 'French Ligue 1': 'Ligue 1' };
const NAMES = { Denmark: 'Danmark', Sweden: 'Sverige', Norway: 'Norge', Germany: 'Tyskland', England: 'England', Scotland: 'Skotland', Greece: 'Grækenland', Czechia: 'Tjekkiet', Belarus: 'Hviderusland', Ukraine: 'Ukraine', Spain: 'Spanien', France: 'Frankrig', Italy: 'Italien', Netherlands: 'Holland', Belgium: 'Belgien', Portugal: 'Portugal', Poland: 'Polen', Switzerland: 'Schweiz', Austria: 'Østrig', Croatia: 'Kroatien', Serbia: 'Serbien', Finland: 'Finland', Iceland: 'Island', 'Northern Ireland': 'Nordirland', 'North Macedonia': 'Nordmakedonien', 'Republic of Ireland': 'Irland', Wales: 'Wales', Lithuania: 'Litauen', Hungary: 'Ungarn', Turkey: 'Tyrkiet', 'Türkiye': 'Tyrkiet' };
const dk = (n) => NAMES[n] || n;

export const state = { matches: [], leagues: {}, error: '', at: 0, loading: false };
const teamsCache = {};

// Holdene i en liga (til valg af favoritter i Indstillinger)
export async function teamsOf(lg) {
  if (teamsCache[lg]) return teamsCache[lg];
  const j = await (await workerFetch('/espn/' + lg + '/teams')).json();
  const list = (((j.sports || [])[0] || {}).leagues || [])[0];
  const teams = ((list && list.teams) || []).map((x) => x.team).filter(Boolean).map((t) => ({ id: String(t.id), name: t.displayName, short: t.shortDisplayName || t.displayName, logo: (t.logos && t.logos[0] && t.logos[0].href) || '', lg }))
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));
  teamsCache[lg] = teams; return teams;
}

const favs = () => (settings.football && settings.football.teams) || [];
const score = (c) => (c.score == null ? '' : typeof c.score === 'object' ? (c.score.displayValue ?? String(c.score.value ?? '')) : String(c.score));
// Mål og kort fra kampoversigten (bruges, hvis kampdetaljerne ikke kan hentes)
const plays = (comp) => (comp.details || []).map((d) => ({ clock: (d.clock && d.clock.displayValue) || '', team: d.team ? String(d.team.id) : '', goal: !!d.scoringPlay, pen: !!d.penaltyKick, og: !!d.ownGoal, red: !!d.redCard, yellow: !!d.yellowCard,
  who: ((d.athletesInvolved || [])[0] || {}).displayName || (((d.participants || [])[0] || {}).athlete || {}).displayName || '' })).filter((d) => d.goal || d.red || d.yellow);
export function parse(ev, fav, lgDefault = '', slug = '') {
  const comp = (ev.competitions || [])[0] || {};
  const st = (comp.status || ev.status || {}).type || {};
  const side = (h) => { const c = (comp.competitors || []).find((x) => x.homeAway === h) || {}; const t = c.team || {};
    return { id: String(t.id || ''), name: dk(t.shortDisplayName || t.displayName || ''), abbr: t.abbreviation || '', logo: (t.logos && t.logos[0] && t.logos[0].href) || t.logo || '', score: score(c), win: !!c.winner, pens: c.shootoutScore != null ? String(c.shootoutScore) : '' }; };
  const lgName = (ev.league && ev.league.name) || lgDefault || (ev.season && ev.season.displayName) || '';
  const lg = (ev.league && ev.league.slug) || slug;
  const venue = (comp.venue && comp.venue.fullName) || '';
  return { id: String(ev.id), date: new Date(ev.date), state: st.state || 'pre', detail: st.shortDetail || '', clock: (comp.status || ev.status || {}).displayClock || '', comp: COMP[lgName] || lgName, home: side('home'), away: side('away'), fav, lg, venue, plays: plays(comp) };
}

async function schedule(t, fixture) {
  const get = async (lg) => { const r = await workerFetch(`/espn/${lg}/teams/${t.id}/schedule${fixture ? '?fixture=true' : ''}`); return (await r.json()).events || []; };
  // Landsholdet følges i alle turneringer. En klub følges kun i den turnering, den er valgt under
  // (FCK valgt under Conference League ≠ FCK i Superligaen), så dens kampe hentes fra netop den turnering.
  if (!t.lg || t.lg === 'nat') return (await get('all').catch(() => [])).map((e) => parse(e, t.id));
  const lgName = (LEAGUES.find((L) => L.id === t.lg) || {}).name;
  const ms = (await get(t.lg).catch(() => [])).map((e) => parse(e, t.id, '', t.lg));
  const own = ms.filter((m) => m.comp === lgName);
  return own.length ? own : ms;
}

const follows = () => []; // "Følg hele ligaen" er fjernet – ligaer ses under Sport, kampe kun for favorithold
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
// En hel liga: kampe fra en uge tilbage til tre uger frem (så næste runde også kommer med efter en landskampspause)
async function leagueDays(lg) {
  const a = new Date(); a.setDate(a.getDate() - 7); const b = new Date(); b.setDate(b.getDate() + 21);
  // ESPN tager ikke imod et datointerval, men gerne en hel måned – hent de måneder, ugen rører
  const mid = new Date(); mid.setDate(mid.getDate() + 10);
  const months = [...new Set([a, new Date(), mid, b].map((d) => ymd(d).slice(0, 6)))];
  const res = await Promise.all(months.map((m) => workerFetch(`/espn/${lg}/scoreboard?dates=${m}`).then((x) => x.json())));
  const name = ((res[0].leagues || [])[0] || {}).name || '';
  const seen = new Set();
  return res.flatMap((j) => j.events || []).filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).map((e) => parse(e, '', name, lg))
    .filter((m) => m.date >= a && m.date <= b).sort((x, y) => x.date - y.date);
}

export async function load(force = false) {
  const ts = favs(); const fl = follows();
  if (!ts.length && !fl.length) { state.matches = []; state.leagues = {}; state.at = Date.now(); return; }
  const live = Object.values(state.leagues).flat().concat(state.matches).some((m) => m.state === 'in' || (m.state === 'pre' && Math.abs(m.date - Date.now()) < 15 * 60000));
  if (!force && state.loading) return;
  if (!force && Date.now() - state.at < (live ? 60000 : 10 * 60000)) return;
  state.loading = true;
  try {
    const lgs = await Promise.all(fl.map((lg) => leagueDays(lg).then((m) => [lg, m]).catch(() => [lg, state.leagues[lg] || []])));
    state.leagues = Object.fromEntries(lgs);
    const all = (await Promise.all(ts.flatMap((t) => [schedule(t, false), schedule(t, true)]))).flat();
    const seen = new Map(); all.forEach((m) => { if (!seen.has(m.id) || m.state !== 'pre') seen.set(m.id, m); });
    const now = Date.now();
    // Kampe, der stadig står som "ikke spillet" flere dage efter starttid, er udskudt – de vises ikke
    state.matches = [...seen.values()].filter((m) => !(m.state === 'pre' && m.date.getTime() < now - 4 * 86400000)).sort((a, b) => a.date - b.date);
    state.error = ''; state.at = Date.now();
  } catch (e) { state.error = e.message; state.at = Date.now(); }
  state.loading = false;
}

// Kampen er spillet, men ESPN har endnu ikke resultatet
export const pending = (m) => m.state === 'pre' && m.date.getTime() < Date.now() - 3 * 3600000;
// Til kortet: kampe i gang, hvert holds næste kamp og hvert holds seneste resultat (kun fra de sidste 10 dage)
export function view() {
  const now = Date.now(); const ids = favs().map((t) => t.id);
  const live = state.matches.filter((m) => m.state === 'in');
  const next = []; const done = [];
  ids.forEach((id) => {
    const mine = state.matches.filter((m) => m.home.id === id || m.away.id === id);
    const n = mine.find((m) => m.state === 'pre' && !pending(m)); if (n && !next.includes(n) && !live.includes(n)) next.push(n);
    const d = mine.filter((m) => (m.state === 'post' || pending(m)) && now - m.date.getTime() < 10 * 86400000).pop(); if (d && !done.includes(d)) done.push(d);
  });
  next.sort((a, b) => a.date - b.date); done.sort((a, b) => b.date - a.date);
  return { live, done, next };
}

// Fulgte ligaer: rundens kampe inkl. resultater. En runde er kampe, der ligger tæt (under 2 døgn imellem).
// Runden vises, til dagen efter dens sidste kamp er gået – derefter vises næste rundes kampe.
export function leagueView() {
  const now = Date.now();
  return follows().map((lg) => {
    const ms = (state.leagues[lg] || []).slice().sort((a, b) => a.date - b.date);
    const rounds = []; ms.forEach((m) => { const last = rounds.length && rounds[rounds.length - 1]; if (last && m.date - last[last.length - 1].date < 48 * 3600000) last.push(m); else rounds.push([m]); });
    const until = (rd) => { const d = new Date(rd[rd.length - 1].date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 2); return d.getTime(); };
    const round = rounds.find((rd) => now < until(rd)) || rounds[rounds.length - 1] || [];
    const name = (LEAGUES.find((L) => L.id === lg) || {}).name || lg;
    return { lg, name, round };
  });
}

// Hvad placeringen giver (mesterskab, Europa, op- og nedrykning) – ESPN's tekster på dansk
const NOTE_DA = [[/championship round/i, 'Mesterskabsspil'], [/relegation round/i, 'Nedrykningsspil'], [/relegation play-?off/i, 'Nedrykningskval.'], [/promotion play-?off/i, 'Oprykningskval.'],
  [/champions league qual/i, 'CL-kvalifikation'], [/europa league qual/i, 'EL-kvalifikation'], [/conference league qual/i, 'ECL-kvalifikation'], [/champions league/i, 'Champions League'], [/europa league/i, 'Europa League'],
  [/conference league/i, 'Conference League'], [/relegation/i, 'Nedrykning'], [/promotion/i, 'Oprykning'], [/champion/i, 'Mester'], [/round of 16|knockout/i, 'Slutspil'], [/play-?off/i, 'Playoff']];
const noteDa = (d) => { for (const [re, t] of NOTE_DA) if (re.test(d)) return t; return d; };
// Egne kraftige farver i stedet for ESPN's pastelfarver, så placeringerne kan ses på afstand
const NOTE_COLOR = { Mester: '#16A34A', 'Champions League': '#16A34A', Mesterskabsspil: '#16A34A', Oprykning: '#16A34A', 'CL-kvalifikation': '#65A30D', Oprykningskval: '#65A30D', 'Oprykningskval.': '#65A30D',
  'Europa League': '#2563EB', 'EL-kvalifikation': '#3B82F6', 'Conference League': '#0891B2', 'ECL-kvalifikation': '#06B6D4', Slutspil: '#9333EA', Playoff: '#9333EA',
  Nedrykningsspil: '#EA580C', 'Nedrykningskval.': '#F97316', Nedrykning: '#DC2626' };
const noteColor = (t, fallback) => NOTE_COLOR[t] || fallback;
// Ligaer uden noter fra ESPN: Superligaen deles efter grundspillet i top 6 og bund 6
const FALLBACK_NOTES = { 'den.1': (rank, n) => (n === 12 ? (rank <= 6 ? { color: NOTE_COLOR.Mesterskabsspil, text: 'Mesterskabsspil' } : { color: NOTE_COLOR.Nedrykningsspil, text: 'Nedrykningsspil' }) : null) };
// Stillinger pr. liga (hentes højst hvert 10. minut)
export const tables = {};
export async function loadTable(lg) {
  const t = tables[lg];
  if (t && (t.loading || Date.now() - t.at < 10 * 60000)) return;
  tables[lg] = { ...(t || {}), loading: true };
  try {
    const j = await (await workerFetch('/espn/' + lg + '/standings')).json();
    const groups = (j.children || [{ standings: j.standings, name: '' }]).filter((c) => c.standings);
    const stat = (e, n) => { const x = (e.stats || []).find((y) => y.name === n); return x ? x.value ?? Number(x.displayValue) : null; };
    const rows = (g) => (g.standings.entries || []).map((e) => { const t = e.team || {}; return { id: String(t.id), name: dk(t.shortDisplayName || t.displayName || ''), abbr: t.abbreviation || '', logo: (t.logos && t.logos[0] && t.logos[0].href) || '',
      note: e.note && e.note.description ? (() => { const text = noteDa(e.note.description); return { color: noteColor(text, '#' + String(e.note.color || '#999').replace(/^#+/, '')), text }; })() : null,
      rank: stat(e, 'rank'), gp: stat(e, 'gamesPlayed'), w: stat(e, 'wins'), d: stat(e, 'ties'), l: stat(e, 'losses'), gd: stat(e, 'pointDifferential'), pts: stat(e, 'points') }; })
      .sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.pts - a.pts);
    const gs = groups.map((g) => ({ name: g.name || '', rows: rows(g) }));
    gs.forEach((g) => { if (FALLBACK_NOTES[lg] && !g.rows.some((x) => x.note)) g.rows.forEach((x, i) => { x.note = FALLBACK_NOTES[lg](x.rank || i + 1, g.rows.length); }); });
    tables[lg] = { at: Date.now(), groups: gs, error: '' };
  } catch (e) { tables[lg] = { at: Date.now(), groups: (t && t.groups) || [], error: e.message }; }
}

// Hele sæsonen for én liga (til Sport → turnering): hentes måned for måned, efterhånden som man bladrer
const season = {};
const monthKey = (d) => ymd(d).slice(0, 6);
export async function loadMonths(lg, dates, maxAge = 0) {
  const S = season[lg] = season[lg] || { months: {}, list: [] };
  S.at = S.at || {};
  const need = [...new Set(dates.map(monthKey))].filter((m) => !S.months[m] || (maxAge && S.months[m] !== 'loading' && Date.now() - (S.at[m] || 0) > maxAge));
  if (!need.length) return false;
  need.forEach((m) => { S.months[m] = 'loading'; });
  const res = await Promise.all(need.map((m) => workerFetch(`/espn/${lg}/scoreboard?dates=${m}`).then((x) => x.json()).then((j) => { S.months[m] = 'ok'; S.at[m] = Date.now(); return j; }).catch(() => { S.months[m] = 'err'; return {}; })));
  const name = ((res.find((j) => (j.leagues || []).length) || {}).leagues || [{}])[0].name || '';
  const have = new Map(S.list.map((m) => [m.id, m]));
  res.flatMap((j) => j.events || []).forEach((e) => have.set(String(e.id), parse(e, '', name, lg)));
  S.list = [...have.values()].sort((a, b) => a.date - b.date);
  return true;
}
export const monthLoaded = (lg, d) => !!(season[lg] && season[lg].months[monthKey(d)]);
// Runder: kampe, der ligger tæt (under 2 døgn imellem). Nyeste data fra den løbende opdatering bruges, hvor de findes
export function roundsOf(lg) {
  const live = new Map(((state.leagues || {})[lg] || []).map((m) => [m.id, m]));
  const ms = ((season[lg] || {}).list || []).map((m) => live.get(m.id) || m);
  live.forEach((m, id) => { if (!ms.some((x) => x.id === id)) ms.push(m); });
  ms.sort((a, b) => a.date - b.date);
  const rounds = []; ms.forEach((m) => { const last = rounds.length && rounds[rounds.length - 1]; if (last && m.date - last[last.length - 1].date < 48 * 3600000) last.push(m); else rounds.push([m]); });
  return rounds;
}
// Den runde, der er "nu": den første, der ikke er slut for mere end et døgn siden
export function currentRound(rounds) {
  const now = Date.now();
  const i = rounds.findIndex((rd) => { const d = new Date(rd[rd.length - 1].date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 2); return now < d.getTime(); });
  return i < 0 ? rounds.length - 1 : i;
}

// Alle kampe i én liga på én dag (fra sæsondata; nyeste stilling fra den løbende opdatering, hvor den findes)
export function matchesOn(lg, day) {
  const d = ymd(day);
  return roundsOf(lg).flat().filter((m) => ymd(m.date) === d);
}

// Live-stilling: den officielle stilling + kampe, der spilles nu (eller lige er slut og endnu ikke talt med).
// Hver række får live (kampens stilling lige nu) og move (pladser op/ned i forhold til den officielle stilling)
export function liveGroups(lg) {
  const T = tables[lg]; if (!T || !T.groups) return [];
  const today = new Date();
  const seen = new Set(); const ms = [];
  matchesOn(lg, today).concat((state.matches || []).filter((m) => m.lg === lg && ymd(m.date) === ymd(today))).forEach((m) => { if (!seen.has(m.id)) { seen.add(m.id); ms.push(m); } });
  const counted = (m) => m.state === 'in' || (m.state === 'post' && +m.date + 110 * 60000 > (T.at || 0));
  const act = ms.filter((m) => counted(m) && m.home.score !== '' && m.away.score !== '');
  return T.groups.map((g) => {
    const rows = g.rows.map((r) => ({ ...r, rank0: r.rank, gd0: r.gd }));
    let any = false;
    act.forEach((m) => {
      const h = rows.find((r) => r.id === m.home.id); const a = rows.find((r) => r.id === m.away.id);
      if (!h || !a) return; any = true;
      const hs = +m.home.score || 0; const as = +m.away.score || 0;
      [[h, hs, as], [a, as, hs]].forEach(([r, f, x]) => {
        r.gp = (+r.gp || 0) + 1; r.gd = (+r.gd || 0) + f - x;
        if (f > x) { r.w = (+r.w || 0) + 1; r.pts = (+r.pts || 0) + 3; } else if (f === x) { r.d = (+r.d || 0) + 1; r.pts = (+r.pts || 0) + 1; } else r.l = (+r.l || 0) + 1;
        r.live = { score: `${f}–${x}`, state: m.state, res: f > x ? 'w' : f === x ? 'd' : 'l' };
      });
    });
    if (any) {
      rows.sort((p, q) => (+q.pts || 0) - (+p.pts || 0) || (+q.gd || 0) - (+p.gd || 0) || (p.rank0 || 99) - (q.rank0 || 99));
      rows.forEach((r, i) => { r.rank = i + 1; r.move = (r.rank0 || r.rank) - r.rank; });
    }
    return { ...g, rows, live: any };
  });
}
