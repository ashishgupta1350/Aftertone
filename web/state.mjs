export const emptyLibrary = () => ({ likes: [], playlists: [], plays: [] });
export const isTrackId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
const text = (s, max) => typeof s === "string" ? s.trim().slice(0, max) : "";
const array = (items, max, convert) => Array.isArray(items) ? items.slice(0, max).map(convert).filter(Boolean) : [];
const time = (n) => Number.isSafeInteger(n) && n >= 0 ? n : 0;

export function track(song) {
  if (!isTrackId(song?.id) || !text(song.title, 400)) return null;
  const out = {
    id: song.id, title: text(song.title, 400),
    artists: array(song.artists, 12, (a) => text(a?.name, 180) && {
      name: text(a.name, 180), ...(text(a.id, 100) && { id: text(a.id, 100) }),
    }),
    durationSec: Math.min(time(song.durationSec), 86400),
  };
  if (text(song.album?.title, 250)) out.album = { title: text(song.album.title, 250), ...(text(song.album.id, 100) && { id: text(song.album.id, 100) }) };
  if (typeof song.thumbnail === "string") {
    try {
      const url = new URL(song.thumbnail);
      if (url.protocol === "https:" && /(^|\.)(ytimg\.com|googleusercontent\.com|ggpht\.com)$/.test(url.hostname)) out.thumbnail = url.href.slice(0, 512);
    } catch { /* Missing artwork uses the standard thumbnail. */ }
  }
  if (song.isVideo) out.isVideo = true;
  if (song.explicit) out.explicit = true;
  return out;
}

function unique(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function normalizeLibrary(input) {
  const likes = array(input?.likes, 10000, (row) => {
    const song = track(row?.song);
    return song && { song, at: time(row.at) };
  });
  const playlists = array(input?.playlists, 250, (row) => {
    if (typeof row?.id !== "string" || !/^prism:[A-Za-z0-9_-]{1,90}$/.test(row.id) || !text(row.name, 160)) return null;
    return { id: row.id, name: text(row.name, 160), songs: array(row.songs, 3000, track) };
  });
  const plays = array(input?.plays, 3000, (row) => {
    const song = track(row?.song);
    const at = time(row?.at);
    return song && at && { song, at, ms: Math.min(time(row.ms), 86400000), ...(row.excluded === true && { excluded: true }) };
  });
  return {
    likes: unique(likes, (row) => row.song.id).sort((a, b) => b.at - a.at),
    playlists: unique(playlists, (row) => row.id),
    plays: unique(plays, (row) => row.song.id + ":" + row.at).sort((a, b) => b.at - a.at),
  };
}

export function trackIdentity(song) {
  const normalize = (value) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
  const artist = song.artists?.[0]?.name;
  return artist && artist !== "Unknown artist" ? normalize(song.title) + "\n" + normalize(artist) : "";
}

export function tasteSeeds(library, now = Date.now()) {
  const scores = new Map();
  const known = new Set();
  const knownTracks = new Set();
  function add(song, score) {
    known.add(song.id);
    const identity = trackIdentity(song);
    if (identity) knownTracks.add(identity);
    const artist = song.artists?.[0]?.name;
    if (!artist || artist === "Unknown artist") return;
    const key = artist.toLocaleLowerCase("en-US");
    const entry = scores.get(key) ?? { artist, score: 0 };
    entry.score += score;
    scores.set(key, entry);
  }
  library.likes.forEach(({ song }, index) => add(song, 3 / (1 + index / 80)));
  library.playlists.forEach(({ songs }) => songs.forEach((song) => add(song, 0.65)));
  library.plays.filter(({ excluded }) => !excluded).slice(0, 400).forEach(({ song, at }) =>
    add(song, 2.5 / (1 + Math.max(now - at, 0) / (14 * 86400000))));
  return { artists: [...scores.values()].sort((a, b) => b.score - a.score).map(({ artist }) => artist), known, knownTracks };
}
