import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ApiError } from "./firebase.mjs";
import { isTrackId, track } from "./state.mjs";

const run = promisify(execFile);
const cache = new Map();
const pending = new Map();
const searches = new Map();
const unplayable = new Map();
const selectedAlternates = new Map();
const runs = (text) => text?.simpleText ?? text?.runs?.map((part) => part.text).join("") ?? "";
const thumb = (id) => "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
const seconds = (value) => /^\d+(?::\d{2})+$/.test(value)
  ? value.split(":").reduce((total, part) => total * 60 + Number(part), 0)
  : 0;

export async function search(query, music = false) {
  const key = query.toLowerCase() + ":" + music;
  const now = Date.now();
  const cached = searches.get(key);
  if (cached?.until > now) return cached.promise;
  if (searches.size >= 100) searches.delete(searches.keys().next().value);
  const promise = searchTracks(query, music).catch((error) => {
    if (searches.get(key)?.promise === promise) searches.delete(key);
    throw error;
  });
  searches.set(key, { until: now + 10 * 60000, promise });
  return promise;
}

async function searchTracks(query, music) {
  const tracks = await searchYouTubeMusic(query).catch(() => []);
  if (tracks.length) return tracks;
  const videos = await searchYouTube(query, music);
  if (!videos.length) throw new ApiError(502, "Music search returned no playable results. Try again in a moment.");
  return videos;
}

async function searchYouTubeMusic(query) {
  const origin = "https://music.youtube.com";
  const version = "1.20260928.13.00";
  const response = await fetch(origin + "/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: {
      "content-type": "application/json", origin, "x-youtube-client-name": "67", "x-youtube-client-version": version,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: version, hl: "en", gl: "IN" } },
      query, params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D",
    }),
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) return [];
  const result = new Map();
  function collect(node) {
    if (!node || typeof node !== "object" || result.size >= 24) return;
    const row = node.musicResponsiveListItemRenderer;
    if (row) {
      const id = row.playlistItemData?.videoId;
      const [titleColumn, infoColumn] = row.flexColumns ?? [];
      const title = runs(titleColumn?.musicResponsiveListItemFlexColumnRenderer?.text);
      if (!isTrackId(id) || !title || result.has(id)) return;
      const credits = infoColumn?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
      const artists = [];
      let album;
      for (const credit of credits) {
        const browse = credit.navigationEndpoint?.browseEndpoint;
        const kind = browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if (kind === "MUSIC_PAGE_TYPE_ARTIST" || kind === "MUSIC_PAGE_TYPE_USER_CHANNEL") {
          artists.push({ name: credit.text, id: browse.browseId });
        } else if (kind === "MUSIC_PAGE_TYPE_ALBUM") album = { title: credit.text, id: browse.browseId };
      }
      const duration = [...credits.map((credit) => credit.text),
        ...(row.fixedColumns ?? []).map((column) => runs(column.musicResponsiveListItemFixedColumnRenderer?.text))]
        .map(seconds).find(Boolean);
      const thumbnail = row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url;
      result.set(id, track({ id, title, artists, album, durationSec: duration, thumbnail: thumbnail || thumb(id) }));
      return;
    }
    for (const value of Object.values(node)) collect(value);
  }
  collect((await response.json()).contents);
  return [...result.values()];
}

async function searchYouTube(query, music) {
  const url = new URL("https://www.youtube.com/results");
  url.searchParams.set("search_query", music ? query + " song" : query);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "accept-language": "en-US,en;q=0.9" } });
  if (!response.ok) throw new ApiError(502, "Music search is temporarily unavailable.");
  const html = await response.text();
  const payload = html.match(/(?:var\s+ytInitialData\s*=|\["ytInitialData"\]\s*=)\s*(\{.+?\});?\s*<\/script>/s)?.[1];
  if (!payload) throw new ApiError(502, "Music search is temporarily unavailable.");
  const results = new Map();
  function collect(node) {
    if (!node || typeof node !== "object" || results.size >= 24) return;
    const row = node.videoRenderer;
    if (row && isTrackId(row.videoId) && runs(row.title) && !results.has(row.videoId)) {
      const duration = seconds(runs(row.lengthText));
      const artist = runs(row.ownerText ?? row.shortBylineText).replace(/\s+- Topic$/, "");
      results.set(row.videoId, track({ id: row.videoId, title: runs(row.title),
        artists: artist ? [{ name: artist }] : [], durationSec: duration, thumbnail: thumb(row.videoId) }));
    }
    for (const child of Object.values(node)) collect(child);
  }
  collect(JSON.parse(payload).contents);
  return [...results.values()];
}

async function resolve(id) {
  const now = Date.now();
  const current = cache.get(id);
  if (current?.until > now) return current.url;
  if (pending.has(id)) return pending.get(id);
  if (pending.size >= 4) throw new ApiError(503, "The player is busy. Try again in a moment.");
  const attempt = run("yt-dlp", ["--ignore-config", "--no-playlist", "--js-runtimes", "node", "--socket-timeout", "8",
    "--retries", "0", "--extractor-retries", "0", "-f", "ba[ext=m4a]/ba", "-g", "https://www.youtube.com/watch?v=" + id],
    { windowsHide: true, timeout: 24000 })
    .then(({ stdout }) => {
      const url = new URL(stdout.trim());
      if (url.protocol !== "https:" || !url.hostname.endsWith(".googlevideo.com") || url.pathname !== "/videoplayback") {
        throw new Error("Unexpected audio source");
      }
      if (cache.size >= 64) cache.delete(cache.keys().next().value);
      cache.set(id, { url, until: Date.now() + 15 * 60000 });
      return url;
    })
    .catch(() => { throw new ApiError(502, "This track is temporarily unavailable."); })
    .finally(() => pending.delete(id));
  pending.set(id, attempt);
  return attempt;
}

async function upstreamAudio(source, range, signal) {
  const upstreamAbort = new AbortController();
  const timer = setTimeout(() => upstreamAbort.abort(), 20000);
  try {
    return await fetch(source, { headers: { Range: range }, redirect: "error", signal: AbortSignal.any([signal, upstreamAbort.signal]) });
  } finally { clearTimeout(timer); }
}

function audioResponse(response) {
  if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) return null;
  const headers = new Headers();
  for (const name of ["accept-ranges", "content-type", "content-length", "content-range"]) {
    if (response.headers.has(name)) headers.set(name, response.headers.get(name));
  }
  return new Response(response.body, { headers, status: response.status });
}

const alternate = new Map();
async function matchAlternate({ title, artist, durationSec }, signal) {
  if (!title || !artist || !durationSec) return null;
  const clean = (value) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const artistKey = clean(artist);
  const cleanTitle = title.split(" - ").at(-1).replace(/\s*[(\[].*?[)\]]/g, "").trim();
  const matchKey = clean(cleanTitle) + ":" + artistKey + ":" + durationSec;
  const cached = alternate.get(matchKey);
  if (cached?.until > Date.now()) return cached.url;
  const searchUrl = new URL("https://saavn.sumit.co/api/search/songs");
  searchUrl.searchParams.set("query", cleanTitle + " " + artist);
  searchUrl.searchParams.set("limit", "8");
  const answer = await fetch(searchUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
  if (!answer.ok) return null;
  const data = await answer.json();
  for (const result of data.data?.results ?? []) {
    if (result.type !== "song" || result.rights || typeof result.name !== "string" ||
        clean(result.name) !== clean(cleanTitle) || !(Math.abs(Number(result.duration) - durationSec) <= 10) ||
        !result.artists?.primary?.some(({ name }) => typeof name === "string" && clean(name) === artistKey)) continue;
    const audio = result.downloadUrl?.find(({ quality }) => quality === "160kbps")?.url;
    if (!audio) continue;
    const url = new URL(audio);
    if (url.protocol === "https:" && url.hostname.endsWith(".saavncdn.com")) {
      if (alternate.size >= 64) alternate.delete(alternate.keys().next().value);
      alternate.set(matchKey, { url, until: Date.now() + 15 * 60000 });
      return url;
    }
  }
  return null;
}

async function youtubeAudio(id, range, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await upstreamAudio(await resolve(id), range, signal);
    const audio = audioResponse(response);
    if (audio) return audio;
    await response.body?.cancel();
    if (response.status === 416) return new Response(null, { status: 416, headers: { "content-range": response.headers.get("content-range") ?? "bytes */*" } });
    if (![403, 410].includes(response.status)) break;
    cache.delete(id);
  }
  return null;
}

export async function stream(id, range, signal, metadata) {
  if (!/^bytes=\d{1,12}-\d{0,12}$/.test(range)) throw new ApiError(416, "Invalid audio range.");
  const alternateKey = JSON.stringify([id, metadata?.title, metadata?.artist, metadata?.durationSec]);
  const cachedAlt = selectedAlternates.get(alternateKey);
  if (cachedAlt?.until > Date.now()) {
    const response = await upstreamAudio(cachedAlt.url, range, signal).catch(() => null);
    const audio = response && audioResponse(response);
    if (audio) return audio;
    if (response?.status === 416) {
      await response.body?.cancel();
      return new Response(null, { status: 416, headers: { "content-range": response.headers.get("content-range") ?? "bytes */*" } });
    }
    await response?.body?.cancel();
    selectedAlternates.delete(alternateKey);
  }
  if (!(unplayable.get(id) > Date.now())) {
    const primary = await youtubeAudio(id, range, signal).catch(() => null);
    if (primary) return primary;
    if (!signal.aborted) {
      if (unplayable.size >= 128) unplayable.delete(unplayable.keys().next().value);
      unplayable.set(id, Date.now() + 120000);
    }
  }
  if (!signal.aborted && metadata) {
    const source = await matchAlternate(metadata, signal).catch(() => null);
    if (source) {
      const response = await upstreamAudio(source, range, signal);
      const audio = audioResponse(response);
      if (audio) {
        if (selectedAlternates.size >= 64) selectedAlternates.delete(selectedAlternates.keys().next().value);
        selectedAlternates.set(alternateKey, { url: source, until: Date.now() + 15 * 60000 });
        return audio;
      }
      await response.body?.cancel();
    }
  }
  throw new ApiError(502, "This track is temporarily unavailable.");
}
