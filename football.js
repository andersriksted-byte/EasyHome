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
function parse(ev, fav, lgDefault = '') {
  const comp = (ev.competitions || [])[0] || {};
  const st = (comp.status || ev.status || {}).type || {};
  const side = (h) => { const c = (comp.competitors || []).find((x) => x.homeAway === h) || {}; const t = c.team || {};
    return { id: String(t.id || ''), name: dk(t.shortDisplayName || t.displayName || ''), abbr: t.abbreviation || '', logo: (t.logos && t.logos[0] && t.logos[0].href) || t.logo || '', score: score(c), win: !!c.winner, pens: c.shootoutScore != null ? String(c.shootoutScore) : '' }; };
  const lgName = (ev.league && ev.league.name) || lgDefault || (ev.season && ev.season.displayName) || '';
  return { id: String(ev.id), date: new Date(ev.date), state: st.state || 'pre', detail: st.shortDetail || '', clock: (comp.status || ev.status || {}).displayClock || '', comp: COMP[lgName] || lgName, home: side('home'), away: side('away'), fav };
}

async function schedule(t, fixture) {
  const get = async (lg) => { const r = await workerFetch(`/espn/${lg}/teams/${t.id}/schedule${fixture ? '?fixture=true' : ''}`); return (await r.json()).events || []; };
  let evs = await get('all').catch(() => []);
  if (!evs.length && t.lg && t.lg !== 'nat') evs = await get(t.lg).catch(() => []);
  return evs.map((e) => parse(e, t.id));
}

const follows = () => (settings.football && settings.football.follow) || [];
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
// En hel liga: kampe en uge omkring i dag (kortet finder selv den aktuelle runde)
async function leagueDays(lg) {
  const a = new Date(); a.setDate(a.getDate() - 6); const b = new Date(); b.setDate(b.getDate() + 6);
  // ESPN tager ikke imod et datointerval, men gerne en hel måned – hent de måneder, ugen rører
  const months = [...new Set([a, new Date(), b].map((d) => ymd(d).slice(0, 6)))];
  const res = await Promise.all(months.map((m) => workerFetch(`/espn/${lg}/scoreboard?dates=${m}`).then((x) => x.json())));
  const name = ((res[0].leagues || [])[0] || {}).name || '';
  const seen = new Set();
  return res.flatMap((j) => j.events || []).filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).map((e) => parse(e, '', name))
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
// Vises den runde, der er i gang, ellers den nærmeste (den netop spillede eller den kommende).
export function leagueView() {
  const now = Date.now();
  return follows().map((lg) => {
    const ms = (state.leagues[lg] || []).slice().sort((a, b) => a.date - b.date);
    const rounds = []; ms.forEach((m) => { const last = rounds.length && rounds[rounds.length - 1]; if (last && m.date - last[last.length - 1].date < 48 * 3600000) last.push(m); else rounds.push([m]); });
    const dist = (rd) => (now < rd[0].date ? rd[0].date - now : now > rd[rd.length - 1].date.getTime() + 3 * 3600000 ? now - rd[rd.length - 1].date : 0);
    const round = rounds.length ? rounds.reduce((a, b) => (dist(b) < dist(a) ? b : a)) : [];
    const name = (LEAGUES.find((L) => L.id === lg) || {}).name || lg;
    return { lg, name, round };
  });
}
