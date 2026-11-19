import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ApiError } from "./firebase.mjs";
import { isTrackId, track } from "./state.mjs";

const run = promisify(execFile);
const cache = new Map();
const pending = new Map();
const searches = new Map();
const unplayable = new Map();
const sources = new Map();
const selecting = new Map();
const audioMirror = "https://echostreamz.com";
const runs = (text) => text?.simpleText ?? text?.runs?.map((part) => part.text).join("") ?? "";
const thumb = (id) => "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
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

export async function musicRequest(endpoint, body, region = "IN") {
  const origin = "https://music.youtube.com";
  const version = "1.20260928.13.00";
  const response = await fetch(origin + "/youtubei/v1/" + endpoint + "?prettyPrint=false", {
    method: "POST",
    headers: {
      "content-type": "application/json", origin, "x-youtube-client-name": "67", "x-youtube-client-version": version,
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: version, hl: "en", gl: region } },
      ...body,
    }),
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new ApiError(502, "YouTube Music is temporarily unavailable.");
  return (await response.json()).contents;
}

export function* musicRows(node, key) {
  if (!node || typeof node !== "object") return;
  if (node[key]) yield node[key];
  for (const value of Object.values(node)) yield* musicRows(value, key);
}

export function musicRowTitle(row) {
  return runs(row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text);
}

export function musicRowArt(row) {
  const images = (row.thumbnail ?? row.thumbnailRenderer)?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  return images.reduce((best, image) => !best || image.width > best.width ? image : best, null)?.url;
}

const browsePageType = (browse) => browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

export function musicArtists(credits) {
  return credits.flatMap(({ text, navigationEndpoint }) => {
    const browse = navigationEndpoint?.browseEndpoint;
    return ["MUSIC_PAGE_TYPE_ARTIST", "MUSIC_PAGE_TYPE_USER_CHANNEL"].includes(browsePageType(browse))
      ? [{ name: text.replace(/\s+- Topic$/, ""), id: browse.browseId }] : [];
  });
}

export function musicTracks(contents, isVideo = false) {
  const result = new Map();
  for (const row of musicRows(contents, "musicResponsiveListItemRenderer")) {
    const id = row.playlistItemData?.videoId;
    const title = musicRowTitle(row);
    if (!isTrackId(id) || !title || result.has(id)) continue;
    const credits = row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
    const artists = musicArtists(credits);
    const collection = credits.find((credit) => browsePageType(credit.navigationEndpoint?.browseEndpoint) === "MUSIC_PAGE_TYPE_ALBUM");
    const album = collection && { title: collection.text, id: collection.navigationEndpoint.browseEndpoint.browseId };
    if (!artists.length && isVideo && credits[0]?.text) artists.push({ name: credits[0].text });
    const duration = [...credits.map((credit) => credit.text),
      ...(row.fixedColumns ?? []).map((column) => runs(column.musicResponsiveListItemFixedColumnRenderer?.text))]
      .map(seconds).find(Boolean);
    result.set(id, track({ id, title, artists, album, durationSec: duration, thumbnail: musicRowArt(row) || thumb(id), isVideo }));
    if (result.size >= (isVideo ? 50 : 24)) break;
  }
  return [...result.values()];
}

async function searchYouTubeMusic(query) {
  return musicTracks(await musicRequest("search", { query, params: "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D" }));
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
        artists: artist ? [{ name: artist }] : [], durationSec: duration, thumbnail: thumb(row.videoId), isVideo: true }));
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
const recordingKey = (value) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function recordingTitle(value) {
  const text = value.replace(/&(?:quot|#34);/gi, '"').replace(/&(?:apos|#39);/gi, "'").replace(/&amp;/gi, "&").trim();
  const soundtrack = text.match(/^(.*?)\s*[([]\s*from\s+(.+?)[)\]]$/i);
  return { title: soundtrack?.[1] ?? text, film: recordingKey(soundtrack?.[2] ?? "") };
}

export function sameRecordingTitle(left, right) {
  const a = recordingTitle(left);
  const b = recordingTitle(right);
  return recordingKey(a.title) === recordingKey(b.title) && (!a.film || !b.film || a.film === b.film);
}

export function matchesAlternateTrack(result, { title, artists, durationSec }) {
  return result.type === "song" && !result.rights && typeof result.name === "string" &&
    Number(result.duration) > 0 && Math.abs(Number(result.duration) - durationSec) <= 10 &&
    sameRecordingTitle(result.name, title) &&
    [...(result.artists?.primary ?? []), ...(result.artists?.featured ?? [])]
      .some(({ name }) => typeof name === "string" && artists.some((artist) => recordingKey(artist) === recordingKey(name)));
}

async function audioVersion(id, { title, artist, artists, durationSec }, signal) {
  if (!title || !artist || !durationSec) return null;
  const candidates = await search(title + " " + artist, true);
  if (signal.aborted) return null;
  const credits = new Set(artists.map(recordingKey));
  return candidates.find((song) => song.id !== id && !song.isVideo && song.durationSec > 0 &&
    sameRecordingTitle(song.title, title) && song.artists.some(({ name }) => credits.has(recordingKey(name)))) ?? null;
}

async function matchAlternate({ title, artist, artists, durationSec }, signal) {
  if (!title || !artist || !durationSec) return null;
  const artistPrefix = title.split(" - ")[0];
  if (artists.some((credit) => recordingKey(artistPrefix) === recordingKey(credit)) && title.includes(" - ")) {
    title = title.slice(artistPrefix.length + 3);
  }
  const cleanTitle = recordingTitle(title).title;
  const matchKey = JSON.stringify([recordingKey(title), artists.map(recordingKey), durationSec]);
  const cached = alternate.get(matchKey);
  if (cached?.until > Date.now()) return cached.url;
  const searchUrl = new URL("https://saavn.sumit.co/api/search/songs");
  searchUrl.searchParams.set("query", cleanTitle + " " + artist);
  searchUrl.searchParams.set("limit", "8");
  const answer = await fetch(searchUrl, { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
  if (!answer.ok) return null;
  const data = await answer.json();
  for (const result of data.data?.results ?? []) {
    if (!matchesAlternateTrack(result, { title, artists, durationSec })) continue;
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

const sourceKey = (id, metadata) => JSON.stringify([id, metadata?.title, metadata?.artists, metadata?.durationSec, metadata?.isVideo]);

async function probe(url, provider, signal) {
  if (!url || signal.aborted) return null;
  const response = await upstreamAudio(url, "bytes=0-1023", AbortSignal.any([signal, AbortSignal.timeout(4000)]));
  const valid = response.ok && response.headers.get("content-type")?.startsWith("audio/");
  // Read just the probe when the CDN honors Range. Never download a complete song speculatively.
  if (valid && response.status === 206 && Number(response.headers.get("content-length")) === 1024) {
    await response.arrayBuffer();
  } else {
    await response.body?.cancel();
  }
  return valid ? { url, provider } : null;
}

export async function firstAudioSource(alternateSource, primarySource, delay = 220, parent) {
  const work = new AbortController();
  const signal = parent ? AbortSignal.any([parent, work.signal]) : work.signal;
  let startPrimary;
  const ready = new Promise((done) => { startPrimary = done; });
  const timer = setTimeout(startPrimary, delay);
  function requireSource(source) {
    if (!source) throw new Error("Audio source unavailable");
    return source;
  }
  const alternateResult = Promise.resolve().then(() => signal.aborted ? null : alternateSource(signal)).then(requireSource);
  void alternateResult.catch(startPrimary);
  const primaryResult = ready.then(() => signal.aborted ? null : primarySource(signal)).then(requireSource);
  try {
    return await Promise.any([alternateResult, primaryResult]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    work.abort();
    startPrimary();
  }
}

async function mirrorSource(origin, id, signal) {
  const api = new URL("/api/v1/videos/" + id, origin);
  api.searchParams.set("local", "true");
  api.searchParams.set("fields", "videoId,adaptiveFormats");
  const result = await fetch(api, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]) });
  if (!result.ok) {
    await result.body?.cancel();
    return null;
  }
  const video = await result.json();
  if (video?.videoId !== id || !Array.isArray(video.adaptiveFormats)) return null;
  const formats = video.adaptiveFormats.filter((format) => format.type?.startsWith("audio/mp4"));
  const format = formats.find((item) => String(item.itag) === "140") ?? formats[0];
  if (typeof format?.url !== "string") return null;
  const url = new URL(format.url, origin);
  // Only stream audio from the same configured host and its documented media route.
  if (url.origin !== origin || url.username || url.password || url.pathname !== "/videoplayback") return null;
  return probe(url, "mirror", signal);
}

async function primarySource(id, signal) {
  if (unplayable.get(id) > Date.now()) return null;
  const previous = cache.get(id);
  try {
    const url = await resolve(id);
    if (signal.aborted) return null;
    const checked = await probe(url, "youtube", signal);
    if (checked) return checked;
    if (cache.get(id)?.url === url) cache.delete(id);
    if (!signal.aborted && previous?.url === url) {
      const refreshed = await probe(await resolve(id), "youtube", signal);
      if (refreshed) return refreshed;
    }
  } catch (error) {
    if (signal.aborted || error.status === 503) return null;
  }
  if (unplayable.size >= 128) unplayable.delete(unplayable.keys().next().value);
  unplayable.set(id, Date.now() + 120000);
  return null;
}

function originalSource(id, metadata, signal) {
  return firstAudioSource(
    async (work) => metadata ? probe(await matchAlternate(metadata, work), "alternate", work) : null,
    (work) => firstAudioSource(
      (mirror) => mirrorSource(audioMirror, id, mirror),
      (direct) => primarySource(id, direct),
      cache.get(id)?.until > Date.now() ? 0 : 700, work,
    ),
    220, signal,
  );
}

async function studioSource(id, metadata, signal) {
  const song = await audioVersion(id, metadata, signal);
  if (!song || signal.aborted) return null;
  const artists = song.artists.map(({ name }) => name);
  return originalSource(song.id, { title: song.title, artist: artists[0], artists, durationSec: song.durationSec }, signal);
}

function selectSource(id, metadata, key) {
  const saved = sources.get(key);
  if (saved?.until > Date.now()) return Promise.resolve(saved);
  if (selecting.has(key)) return selecting.get(key);
  const lookup = metadata?.isVideo ? firstAudioSource(
    (signal) => originalSource(id, metadata, signal),
    (signal) => studioSource(id, metadata, signal),
    2100,
  ) : originalSource(id, metadata);
  const selection = lookup.then((source) => {
    if (!source) return null;
    if (sources.size >= 128) sources.delete(sources.keys().next().value);
    const entry = { ...source, until: Date.now() + 10 * 60000 };
    sources.set(key, entry);
    return entry;
  }).finally(() => selecting.delete(key));
  selecting.set(key, selection);
  return selection;
}

export async function stream(id, range, signal, metadata) {
  if (!/^bytes=\d{1,12}-\d{0,12}$/.test(range)) throw new ApiError(416, "Invalid audio range.");
  const key = sourceKey(id, metadata);
  const started = performance.now();
  const source = await selectSource(id, metadata, key);
  const selected = performance.now();
  if (!source || signal.aborted) throw new ApiError(502, "This track is temporarily unavailable.");
  const response = await upstreamAudio(source.url, range, signal).catch(() => null);
  const audio = response && audioResponse(response);
  if (audio) {
    audio.headers.set("Server-Timing", "source;dur=" + Math.round(selected - started) + ", upstream;dur=" + Math.round(performance.now() - selected));
    return audio;
  }
  await response?.body?.cancel();
  if (response?.status === 416) {
    return new Response(null, { status: 416, headers: { "content-range": response.headers.get("content-range") ?? "bytes */*" } });
  }
  // The browser can retry with a fresh source. Never switch encodings within this ranged response.
  if (!signal.aborted && sources.get(key) === source) {
    sources.delete(key);
    if (source.provider === "youtube" && cache.get(id)?.url === source.url) cache.delete(id);
  }
  throw new ApiError(502, "This track is temporarily unavailable.");
}
