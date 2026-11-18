import { ApiError } from "./firebase.mjs";
import { musicArtists, musicRequest, musicRows, musicRowArt, musicRowTitle, musicTracks, search } from "./music.mjs";
import { tasteSeeds, track, trackIdentity } from "./state.mjs";
import { topics } from "./public/taste.js";

const byTopic = new Map(topics.map(([id, , , query]) => [id, query]));
const charts = new Map();
const chartRegions = new Map([
  ["hindi", ["IN", /weekly videos hindi/i]],
  ["punjabi", ["IN", /weekly videos punjabi/i]],
  ["tamil", ["IN", /weekly videos tamil/i]],
  ["telugu", ["IN", /weekly videos telugu/i]],
  ["english", ["US", /daily top music videos/i]],
  ["pop", ["US", /pop music videos/i]],
  ["rock", ["US", /\d+ rock music videos/i]],
  ["hiphop", ["US", /hip hop music videos/i]],
  ["dance", ["US", /dance & electronic music videos/i]],
]);
const year = () => new Date().getUTCFullYear();

export function normalizeTaste(input) {
  if (!input || !Array.isArray(input.languages) || !Array.isArray(input.genres) || !Array.isArray(input.artists)) return null;
  const tags = (kind, values) => topics.filter(([id, , group]) => group === kind && values.includes(id)).map(([id]) => id);
  const artists = new Map();
  for (const value of input.artists.slice(0, 8)) {
    if (typeof value !== "string") continue;
    const name = value.trim().slice(0, 120);
    if (name) artists.set(name.toLowerCase(), name);
  }
  return { languages: tags("language", input.languages), genres: tags("genre", input.genres), artists: [...artists.values()] };
}

export const knownTopic = (id) => id === "popular" || id === "new" || byTopic.has(id);

function cached(key, load) {
  const before = charts.get(key);
  if (before?.until > Date.now()) return before.value;
  if (charts.size >= 32) charts.delete(charts.keys().next().value);
  const value = load().catch((error) => {
    if (charts.get(key)?.value === value) charts.delete(key);
    throw error;
  });
  charts.set(key, { value, until: Date.now() + 30 * 60000 });
  return value;
}

function chartPage(region) {
  return cached("chart:" + region, () => musicRequest("browse", {
    browseId: "FEmusic_charts", formData: { selectedValues: [region] },
  }, region));
}

function chartRows(page) {
  return [...musicRows(page, "musicTwoRowItemRenderer")].map((row) => ({
    title: row.title?.runs?.map(({ text }) => text).join("") ?? "",
    id: row.navigationEndpoint?.browseEndpoint?.browseId,
  })).filter(({ id }) => /^VL[A-Za-z\d_-]+$/.test(id));
}

async function chartSongs(topic) {
  const [region, name] = chartRegions.get(topic);
  const row = chartRows(await chartPage(region)).find(({ title }) => name.test(title));
  if (!row) return [];
  return cached("playlist:" + row.id, async () => musicTracks(await musicRequest("browse", { browseId: row.id }), true)
    .filter((song) => song.durationSec >= 90 && !/\b(?:trailer|teaser|glimpse|promo)\b/i.test(song.title)));
}

function newReleases(region) {
  return cached("releases:" + region, async () => {
    const page = await musicRequest("browse", { browseId: "FEmusic_new_releases" }, region);
    const releases = new Map();
    for (const row of musicRows(page, "musicTwoRowItemRenderer")) {
      const id = row.navigationEndpoint?.browseEndpoint?.browseId;
      if (!/^MPREb_[A-Za-z\d_-]+$/.test(id) || releases.has(id)) continue;
      releases.set(id, row);
      if (releases.size >= 6) break;
    }
    const albums = await Promise.allSettled([...releases].map(async ([id, row]) => {
      const artwork = musicRowArt(row);
      const artists = musicArtists(row.subtitle?.runs ?? []);
      const title = row.title?.runs?.map(({ text }) => text).join("") ?? "";
      const tracks = musicTracks(await musicRequest("browse", { browseId: id }, region));
      return tracks.slice(0, 2).map((song) => track({
        ...song, artists: song.artists.length ? song.artists : artists,
        album: { id, title }, thumbnail: artwork || song.thumbnail,
      })).filter(Boolean);
    }));
    return albums.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  });
}

function uniqueArtists(rows) {
  const artists = new Map();
  for (const row of rows) {
    const type = row.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    const name = musicRowTitle(row);
    if (type === "MUSIC_PAGE_TYPE_ARTIST" && name && !artists.has(name.toLowerCase())) {
      artists.set(name.toLowerCase(), { name, thumbnail: musicRowArt(row) });
    }
  }
  return [...artists.values()];
}

export async function tasteArtists(query, languages) {
  if (query) {
    const page = await musicRequest("search", { query, params: "EgWKAQIgAWoKEAMQBBAJEAoQBQ%3D%3D" });
    return uniqueArtists(musicRows(page, "musicResponsiveListItemRenderer")).slice(0, 12);
  }
  const regions = new Set(languages.map((language) => chartRegions.get(language)?.[0]).filter(Boolean));
  if (!regions.size) { regions.add("IN"); regions.add("US"); }
  const pages = await Promise.allSettled([...regions].map(chartPage));
  const lists = pages.filter((value) => value.status === "fulfilled").map(({ value }) =>
    uniqueArtists(musicRows(value, "musicResponsiveListItemRenderer")));
  const artists = new Map();
  for (let i = 0; i < 12; i++) for (const list of lists) {
    const entry = list[i];
    if (entry) artists.set(entry.name.toLowerCase(), entry);
  }
  return [...artists.values()].slice(0, 12);
}

async function popular(topic) {
  if (chartRegions.has(topic)) {
    const songs = await chartSongs(topic).catch(() => []);
    if (songs.length) return songs;
  }
  return search("latest " + (byTopic.get(topic) || "popular songs") + " " + year(), true);
}

function blend(lists, known, knownTracks) {
  const songs = [];
  for (let index = 0; index < 50 && songs.length < 24; index++) {
    for (const list of lists) {
      const song = list[index];
      if (!song || known.has(song.id)) continue;
      const identity = trackIdentity(song);
      if (identity && knownTracks.has(identity)) continue;
      if (identity) knownTracks.add(identity);
      known.add(song.id);
      songs.push(song);
      if (songs.length >= 24) break;
    }
  }
  return songs;
}

function rotate(items, offset) {
  const start = offset % Math.max(1, items.length);
  return items.slice(start).concat(items.slice(0, start));
}

export async function recommend(library, preferences, topic, rotation) {
  const languages = preferences?.languages.length ? preferences.languages : ["hindi", "english"];
  const genres = preferences?.genres ?? [];
  const day = Math.floor(Date.now() / 86400000);
  const { artists, known, knownTracks } = library ? tasteSeeds(library) : {
    artists: [], known: new Set(), knownTracks: new Set(),
  };
  let requests;
  if (topic === "popular") {
    requests = languages.map(popular);
  } else if (topic === "new") {
    requests = [...new Set(languages.map((language) => chartRegions.get(language)[0]))].map(newReleases);
  } else if (topic) {
    requests = [popular(topic)];
    if (topics.some(([id, , kind]) => id === topic && kind !== "language")) {
      const names = [...new Set([...(preferences?.artists ?? []), ...artists])];
      requests.push(...rotate(names, day + rotation).slice(0, 2).map((name) =>
        search(name + " " + byTopic.get(topic), true)));
    }
  } else {
    const learned = rotate(artists.slice(1, 14), day + rotation);
    const explicit = rotate(preferences?.artists ?? [], day + rotation);
    const preferred = [...new Map([artists[0], explicit[0], ...learned.slice(0, 1), ...explicit.slice(1), ...learned]
      .filter(Boolean).map((name) => [name.toLowerCase(), name])).values()].slice(0, 3);
    const discovery = rotate([...genres, ...languages], day + rotation);
    const current = discovery.slice(0, 3);
    requests = preferred.map((name) => search(name + " songs", true));
    requests.push(...current.map((choice) => {
      if (!genres.includes(choice) || languages.includes("english")) return popular(choice);
      const language = topics.find(([id]) => id === languages[(day + rotation) % languages.length])[1];
      return search("latest " + language + " " + byTopic.get(choice) + " " + year(), true);
    }));
  }
  const groups = await Promise.allSettled(requests);
  if (groups.every((group) => group.status === "rejected")) throw new ApiError(502, "Discovery is temporarily unavailable.");
  const lists = groups.map((group) => group.status === "fulfilled" ? group.value : []);
  if (topic && library) {
    const favored = new Set([...artists.slice(0, 12), ...(preferences?.artists ?? [])].map((name) => name.toLowerCase()));
    const taste = (song) => Number(song.artists.some(({ name }) => favored.has(name.toLowerCase())));
    for (let index = 0; index < lists.length; index++) lists[index] = lists[index].toSorted((a, b) => taste(b) - taste(a));
  }
  if (rotation && !topic) {
    for (let index = 0; index < lists.length; index++) lists[index] = rotate(lists[index], rotation % 7);
  }
  return blend(lists, known, knownTracks);
}
