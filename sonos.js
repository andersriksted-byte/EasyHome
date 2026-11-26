// Sonos via Sonos' officielle Control API (cloud). Workeren holder login-nøglerne, så de aldrig ligger i browseren.
import { workerFetch, hasProxy, settings, save } from './util.js';

const rawApi = async (path, method = 'GET', body) => {
  const res = await workerFetch('/sonos/api' + path, { method, body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  return t ? JSON.parse(t) : {};
};
// Når rum flyttes mellem grupper, får gruppen et nyt id, og det gamle svarer "væk" (HTTP 410/404).
// Så hentes grupperne igen, og kaldet prøves én gang til med den nye gruppe.
const api = async (path, method = 'GET', body) => {
  try { return await rawApi(path, method, body); } catch (e) {
    const m = /^\/groups\/([^/]+)(\/.*)?$/.exec(path);
    if (!m || !/HTTP 4(04|10)/.test(e.message)) throw e;
    // Hent grupperne igen og brug den gruppe, det samme rum nu er i
    const old = m[1]; const og = state.groups.find((g) => g.id === old);
    const room = og && !(og.playerIds || []).includes(anchor()) ? og.coordinatorId : anchor();
    await loadHousehold();
    const ng = groupOfPlayer(room); const nid = ng && ng.id;
    if (!nid || nid === old) throw e;
    return rawApi('/groups/' + nid + (m[2] || ''), method, body);
  }
};
// Den gruppe, denne skærm styrer, huskes som et RUM (Sonos giver grupper nye id'er, når rum flyttes – rummet er det samme).
// Det gemmes pr. skærm, så to skærme ikke skifter hinandens gruppe.
const anchor = () => settings.sonosRoom || '';
const setAnchor = (pid) => { if (pid && settings.sonosRoom !== pid) { settings.sonosRoom = pid; save(); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Coverbilleder: Sonos giver enten en almindelig https-adresse, en http-adresse eller en adresse på selve
// højttaleren i jeres net. https vises direkte; offentlige http-billeder hentes via workeren (ellers blokerer
// browseren dem); billeder på højttaleren kan ikke nås udefra, så der vises et nodeikon i stedet.
const artCache = {};
let onArt = () => {};
export function onArtLoaded(fn) { onArt = fn; }
const rawImg = (o) => (o && (o.imageUrl || (Array.isArray(o.images) && o.images.length && (o.images[0].url || o.images[0].uri)))) || '';
const isLocal = (h) => /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h) || h.endsWith('.local');
export function art(o) {
  const url = rawImg(o);
  if (!url) return '';
  if (url.startsWith('https://')) return url;
  let u; try { u = new URL(url); } catch (e) { return ''; }
  if (u.protocol !== 'http:' || isLocal(u.hostname)) return '';
  if (artCache[url] !== undefined) return artCache[url];
  artCache[url] = '';
  workerFetch('/img?url=' + encodeURIComponent(url)).then((r) => r.blob()).then((b) => { artCache[url] = URL.createObjectURL(b); onArt(); }).catch(() => {});
  return '';
}

// Reserve: når Sonos kun har et billede på selve højttaleren (typisk Apple Music og Spotify), slås coveret op
// ud fra kunstner og titel via workeren (Apples offentlige musikkatalog).
const lookCache = {};
export function lookupArt(artist, title) {
  if (!title) return '';
  const q = ((artist || '') + ' ' + title).trim().toLowerCase();
  if (lookCache[q] !== undefined) return lookCache[q];
  lookCache[q] = '';
  workerFetch('/art?q=' + encodeURIComponent(q)).then((r) => r.json()).then((j) => { if (j && j.url) { lookCache[q] = j.url; onArt(); } }).catch(() => {});
  return '';
}

export const state = { groupMeta: {}, groupsAt: 0, connected: false, checked: false, household: null, groups: [], players: [], favorites: [], playlists: [], playerVol: {}, meta: null, playback: null, volume: null, error: null };

export async function status() {
  if (!hasProxy()) { state.connected = false; state.checked = true; return state; }
  try {
    const s = await (await workerFetch('/sonos/status')).json();
    state.connected = !!s.connected; state.error = null;
  } catch (e) { state.connected = false; state.error = e.message; }
  state.checked = true;
  return state;
}

export async function startLogin() {
  const r = await (await workerFetch('/sonos/login-url', { method: 'POST', body: JSON.stringify({ returnTo: location.href.split('#')[0] }) })).json();
  location.href = r.url;
}

export async function logout() { await workerFetch('/sonos/logout', { method: 'POST', body: '{}' }); state.connected = false; }

export async function loadHousehold() {
  const hh = await api('/households');
  state.household = hh.households && hh.households[0] ? hh.households[0].id : null;
  if (!state.household) throw new Error('Ingen Sonos-husstand fundet');
  const g = await api(`/households/${state.household}/groups`);
  state.groups = g.groups || []; state.players = g.players || [];
  state.groupsAt = 0; // hent også, hvad de andre grupper spiller
  if (!state.players.some((p) => p.id === anchor())) {
    // Første gang (eller rummet findes ikke mere): den gruppe, der var valgt før, ellers en der spiller, ellers den første
    const old = state.groups.find((x) => x.id === (settings.sonos || {}).groupId);
    const playing = state.groups.find((x) => x.playbackState === 'PLAYBACK_STATE_PLAYING');
    const g = old || playing || state.groups[0]; if (g) setAnchor(g.coordinatorId || (g.playerIds || [])[0]);
  }
  try { const f = await api(`/households/${state.household}/favorites`); state.favorites = f.items || []; } catch (e) { state.favorites = []; }
  try { const pl = await api(`/households/${state.household}/playlists`); state.playlists = pl.playlists || []; } catch (e) { state.playlists = []; }
}

export async function refresh() {
  if (!state.connected) return state;
  try {
    if (!state.household) await loadHousehold();
    const gid = curGid();
    if (!gid) return state;
    const [meta, pb, vol] = await Promise.all([
      api(`/groups/${gid}/playbackMetadata`), api(`/groups/${gid}/playback`), api(`/groups/${gid}/groupVolume`)
    ]);
    state.meta = meta; state.playback = pb; state.pbAt = Date.now(); state.volume = vol; state.error = null;
    const g = currentGroup();
    if (g) {
      const vols = await Promise.all((g.playerIds || []).map((pid) => api(`/players/${pid}/playerVolume`).then((v) => [pid, v.volume]).catch(() => [pid, null])));
      state.playerVol = Object.fromEntries(vols);
    }
    // De andre grupper (fx kontoret, der spiller sit eget): hvad spiller de? Hentes hvert 10. sekund og lige efter hvert tryk.
    if (Date.now() - state.groupsAt > 10000) {
      state.groupsAt = Date.now();
      const gg = await api(`/households/${state.household}/groups`);
      state.groups = gg.groups || state.groups; state.players = gg.players || state.players;
      await Promise.all(state.groups.filter((x) => x.id !== gid).map((o) => api(`/groups/${o.id}/playbackMetadata`).then((mm) => { state.groupMeta[o.id] = metaTitle(mm); }).catch(() => {})));
    }
  } catch (e) {
    if (/HTTP 4(04|10)/.test(e.message)) { state.household = null; state.error = null; } // grupper ændret: hentes igen næste gang
    else state.error = e.message;
  }
  return state;
}

export function nowPlaying() {
  const m = state.meta || {};
  const item = m.currentItem && m.currentItem.track ? m.currentItem.track : null;
  const container = m.container || {};
  const title = item ? item.name : (container.name || m.streamInfo || '');
  const artist = item && item.artist ? item.artist.name : (m.streamInfo && item ? m.streamInfo : (container.service ? container.service.name : ''));
  // Intet cover? Så vises ikonet for den favorit, der spilles fra (fx radiokanalens logo)
  const favImg = () => { const id = currentFav(false); const f = id && state.favorites.find((x) => x.id === id); return f ? art(f) : ''; };
  const image = art(item) || art(container) || art(m.currentItem) || (item ? lookupArt(item.artist && item.artist.name, item.name) : '') || favImg();
  const playing = state.playback && /PLAYING|BUFFERING/.test(state.playback.playbackState || '');
  const group = currentGroup();
  const nx = m.nextItem && m.nextItem.track ? m.nextItem.track : null;
  const next = nx ? { title: nx.name || '', artist: nx.artist ? nx.artist.name : '', image: art(nx) || lookupArt(nx.artist && nx.artist.name, nx.name) } : null;
  const modes = (state.playback && state.playback.playModes) || {};
  return { title, artist, image, playing, group: group ? (group.playerIds || []).map(playerName).sort((a, b) => a.localeCompare(b, 'da')).join(' + ') : '', volume: state.volume ? state.volume.volume : null, next, source: container.name && container.name !== title ? container.name : '', modes };
}

const gid = () => curGid();
export const togglePlay = () => api(`/groups/${gid()}/playback/togglePlayPause`, 'POST', {});
export const next = () => api(`/groups/${gid()}/playback/skipToNextTrack`, 'POST', {});
export const prev = () => api(`/groups/${gid()}/playback/skipToPreviousTrack`, 'POST', {});
export const setVolume = (v) => api(`/groups/${gid()}/groupVolume`, 'POST', { volume: Math.max(0, Math.min(100, Math.round(v))) });
// REPLACE: favoritten erstatter køen (standard hos Sonos er at lægge den bagest, så det gamle i køen bliver ved med at spille)
export const playFavorite = (id) => api(`/groups/${gid()}/favorites`, 'POST', { favoriteId: id, action: 'REPLACE', playOnCompletion: true });
// Podcast-serier: Sonos kan ikke starte en hel serie fra en favorit, så workeren finder seriens afsnit
// og lægger dem i kø (nyeste først) som en "cloud queue", højttalerne selv henter afsnittene fra.
const isSeries = (f) => favKind(f) === 'podcast' && !/EPISODE|TRACK/.test(String((f.resource && f.resource.type) || '').toUpperCase());
export async function playFav(id) {
  const f = state.favorites.find((x) => x.id === id);
  if (!f) return playFavorite(id);
  // Sonos' egen favorit først (den kender serien, fx fra DR LYD). Kun hvis Sonos afviser den, prøver vi at bygge køen selv
  try { return await playFavorite(id); } catch (e) {
    // 502/503/504: Sonos svarede ikke i tide – højttaleren er ofte bare langsom til at hente podcasten. Vent og se, om den spiller
    if (/HTTP 50[234]/.test(e.message)) {
      for (let i = 0; i < 4; i++) { await wait(1500); try { const pb = await api(`/groups/${gid()}/playback`); if (/PLAYING|BUFFERING/.test(pb.playbackState || '')) return; } catch (e2) { /* prøv igen */ } }
      try { return await playFavorite(id); } catch (e3) { if (!/HTTP 50[234]/.test(e3.message)) throw e3; throw new Error('Sonos svarer langsomt – prøv igen om lidt'); }
    }
    if (!isSeries(f) && favKind(f) !== 'other') throw e; return playSeries(f, e);
  }
}
async function playSeries(f, firstErr) {
  let pod = null; let why = '';
  try { pod = await (await workerFetch('/podcast/resolve', { method: 'POST', body: JSON.stringify({ name: f.name }) })).json(); } catch (e) { why = e.message; }
  // Fandt vi ikke serien, så sig hvorfor – ellers starter Sonos bare det, der lå i køen i forvejen
  if (!pod || !pod.id) throw new Error('Podcasten kunne ikke sættes i kø' + (why === 'Ukendt' ? ' – workeren er ikke opdateret endnu' : why ? ': ' + why : '') + (firstErr ? ' · ' + firstErr.message : ''));
  const s = await api(`/groups/${gid()}/playbackSession/joinOrCreate`, 'POST', { appId: 'dk.easyhome.dashboard', appContext: 'easyhome' });
  if (!s.sessionId) throw new Error('Sonos gav ingen afspilning');
  await rawApi(`/playbackSessions/${s.sessionId}/playbackSession/loadCloudQueue`, 'POST', { queueBaseUrl: pod.queueBaseUrl, itemId: pod.firstId, playOnCompletion: true,
    trackMetadata: { name: pod.first, artist: { name: pod.name }, imageUrl: S_img(f) } });
  return pod;
}
const S_img = (f) => art(f) || '';
export const playerName = (pid) => (state.players.find((p) => p.id === pid) || {}).name || pid;

const metaTitle = (m) => { m = m || {}; const it = m.currentItem && m.currentItem.track;
  return { title: it ? [it.name, it.artist && it.artist.name].filter(Boolean).join(' · ') : (m.container && m.container.name) || m.streamInfo || '', image: art(it) || art(m.container) || art(m.currentItem) || '' }; };
// Gruppens navn ud fra rummene ("Stue + Køkken") og hvad den spiller
export function groupInfo(g) {
  const names = (g.playerIds || []).map(playerName).sort((a, b) => a.localeCompare(b, 'da'));
  const mine = (g.playerIds || []).includes(anchor());
  const np = mine ? nowPlaying() : null; const gm = state.groupMeta[g.id] || {};
  return { label: names.join(' + '), mine, title: np ? np.title : gm.title || '', image: np ? np.image : gm.image || '', playing: np ? np.playing : /PLAYING|BUFFERING/.test(g.playbackState || '') };
}
export const toggleGroupPlay = (id) => { const g = state.groups.find((x) => x.id === id); if (g) g.playbackState = /PLAYING/.test(g.playbackState || '') ? 'PLAYBACK_STATE_PAUSED' : 'PLAYBACK_STATE_PLAYING'; return api(`/groups/${id}/playback/togglePlayPause`, 'POST', {}); };
export const currentGroup = () => groupOfPlayer(anchor());
function curGid() { const g = currentGroup(); return g ? g.id : null; }
// "Styr" en gruppe: husk et af dens rum (det, musikken styres fra)
export function controlGroup(id) { const g = state.groups.find((x) => x.id === id); if (g) setAnchor(g.coordinatorId || (g.playerIds || [])[0]); }
// Efter en ændring af grupperne: hent dem igen, til Sonos har gjort ændringen færdig
async function settle(check = () => true) {
  for (let i = 0; i < 6; i++) { await wait(i ? 700 : 400); await loadHousehold(); if (check()) break; }
  state.groupsAt = 0;
}
export const groupOfPlayer = (pid) => state.groups.find((g) => (g.playerIds || []).includes(pid)) || null;

// Sæt hvilke rum der er i den valgte gruppe. Gruppens id kan ændre sig, så vi bruger svaret fra Sonos.
export async function setMembers(playerIds) {
  await api(`/groups/${gid()}/groups/setGroupMembers`, 'POST', { playerIds });
  if (!playerIds.includes(anchor())) setAnchor(playerIds[0]);
  const want = playerIds.slice().sort().join();
  await settle(() => ((currentGroup() || {}).playerIds || []).slice().sort().join() === want);
}
// Tag et rum ud af gruppen – også det rum, musikken startede i (gruppens "styrer").
// Sonos giver så styringen videre til et af de andre rum, og musikken fortsætter dér.
export async function removePlayer(pid) {
  const g = currentGroup(); if (!g) return;
  const rest = (g.playerIds || []).filter((x) => x !== pid); if (!rest.length) return;
  // Er det rummet, skærmen styrer fra, der tages ud, så styres der videre fra et af de andre rum
  if (pid === anchor()) setAnchor(rest[0]);
  await api(`/groups/${g.id}/groups/modifyGroupMembers`, 'POST', { playerIdsToRemove: [pid] });
  await settle(() => { const ng = currentGroup(); return ng && !(ng.playerIds || []).includes(pid); });
}
export async function soloPlayer(pid) {
  // Lav en gruppe med kun dette rum (tager det ud af den gruppe, det er i)
  const r = await api(`/households/${state.household}/groups/createGroup`, 'POST', { playerIds: [pid] });
  state.household = null;
  return r;
}
export const setPlayerVolume = (pid, v) => api(`/players/${pid}/playerVolume`, 'POST', { volume: Math.max(0, Math.min(100, Math.round(v))) });
export const playPlaylist = (id) => api(`/groups/${gid()}/playlists`, 'POST', { playlistId: id, playOnCompletion: true });

// Bland (shuffle) og gentag (repeat). Gentag skifter: fra → hele listen → én sang → fra
export async function setPlayModes(patch) {
  const gid = curGid(); if (!gid) return;
  state.playback = { ...(state.playback || {}), playModes: { ...((state.playback && state.playback.playModes) || {}), ...patch } };
  await api(`/groups/${gid}/playback/playMode`, 'POST', { playModes: patch });
}

// Hvilken favorit spiller nu? Sammenlign det, der spilles fra, med favoritterne (id eller navn).
let lastFav = null;
export function markFav(id) { lastFav = { id, group: curGid(), at: Date.now() }; }
export function playingFavId() { return currentFav(true); }
function currentFav(onlyPlaying) {
  const m = state.meta || {}; const c = m.container || {};
  const playing = !onlyPlaying || (state.playback && /PLAYING|BUFFERING/.test(state.playback.playbackState || ''));
  const n = (x) => String(x || '').trim().toLowerCase();
  const cid = c.id && c.id.objectId; const names = [c.name, m.streamInfo, m.currentItem && m.currentItem.track && m.currentItem.track.name].map(n).filter(Boolean);
  const hit = state.favorites.find((f) => { const fid = f.resource && f.resource.id && f.resource.id.objectId; return (cid && fid && cid === fid) || names.includes(n(f.name)); });
  if (hit) return playing ? hit.id : null;
  if (lastFav && playing && lastFav.group === curGid() && Date.now() - lastFav.at < 6 * 3600000) return lastFav.id;
  return null;
}

// Favoritterne i jeres egen rækkefølge (vælges under Indstillinger → Musik). Skjulte favoritter udelades.
// Er favoritten en radiostation, en playliste eller andet (album, sang, podcast)? Kan rettes under Indstillinger → Musik.
export function favKind(f) {
  const own = ((settings.sonos || {}).favKind || {})[f.id]; if (own) return own;
  const t = String((f.resource && f.resource.type) || '').toUpperCase();
  const d = `${f.description || ''} ${(f.service && f.service.name) || ''} ${(f.resource && f.resource.id && f.resource.id.serviceId) || ''}`.toLowerCase();
  if (/PODCAST|SHOW|EPISODE/.test(t) || /podcast|afsnit|episode/.test(d)) return 'podcast';
  if (/STATION|STREAM|PROGRAM|RADIO/.test(t) || /radio|station|tunein|dr lyd|radioplay|stream/.test(d)) return 'radio';
  if (/PLAYLIST/.test(t) || /playlist|afspilningsliste|spilleliste/.test(d)) return 'playlist';
  return 'other';
}
export function favorites(all = false) {
  const order = settings.sonos.favOrder || []; const hidden = settings.sonos.favHidden || [];
  const pos = (f) => { const i = order.indexOf(f.id); return i < 0 ? 1000 + state.favorites.indexOf(f) : i; };
  return state.favorites.slice().sort((a, b) => pos(a) - pos(b)).filter((f) => all || !hidden.includes(f.id));
}

// Spoling i det, der spiller (podcast-afsnit, sange). Radio har ingen længde og kan ikke spoles.
// Sonos sender ikke altid længde/position med (fx lige efter pause) – så bruges det sidst kendte for samme afsnit,
// så afspilningstiden ikke forsvinder og kommer igen
let lastPos = null;
export function position() {
  const m = state.meta || {}; const t = m.currentItem && m.currentItem.track; const pb = state.playback;
  const key = t ? (t.id && (t.id.objectId || t.id)) || t.name || '' : '';
  const playing = !!pb && /PLAYING/.test(pb.playbackState || '');
  let dur = t && +t.durationMillis; let pos = pb && pb.positionMillis != null ? +pb.positionMillis : null; let at = state.pbAt || Date.now();
  if (lastPos && lastPos.key === key) { if (!dur) dur = lastPos.dur; if (pos === null) { pos = lastPos.pos; at = lastPos.at; } }
  if (!dur || pos === null || !key) return null;
  if (!lastPos || lastPos.key !== key || lastPos.raw !== pos || lastPos.dur !== dur) lastPos = { key, dur, pos, at, raw: pos };
  return { dur, pos: Math.max(0, Math.min(dur, pos + (playing ? Date.now() - at : 0))), playing };
}
const movedTo = (ms) => { if (state.playback) { state.playback.positionMillis = Math.max(0, ms); state.pbAt = Date.now(); } };
export async function seek(ms) { movedTo(ms); await api(`/groups/${gid()}/playback/seek`, 'POST', { positionMillis: Math.max(0, Math.round(ms)) }); }
export async function seekBy(delta) { const p = position(); if (p) movedTo(Math.min(p.dur, p.pos + delta)); await api(`/groups/${gid()}/playback/seekRelative`, 'POST', { deltaMillis: Math.round(delta) }); }
