const cache = new Map();
const limit = 500;
const lrcOrigin = "https://lrclib.net";

export function parseLyrics(lrc) {
  const offset = Number(lrc.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  const rows = new Map();
  for (const line of lrc.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, "").trim();
    for (const [,minutes,seconds,fraction] of stamps) {
      const at = Math.max(0, Number(minutes) * 60 + Number(seconds) + Number("0." + (fraction ?? "0")) + offset);
      if (!rows.has(at) || text) rows.set(at, [rows.get(at), text].filter(Boolean).join("\n"));
    }
  }
  return [...rows].sort(([a], [b]) => a - b).map(([at, text]) => ({ at, text }));
}

function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

async function request(path, params) {
  const url = new URL(path, lrcOrigin);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    headers: { "user-agent": "Aftertone Web (https://github.com/ashishgupta1350/Aftertone)" },
    signal: AbortSignal.timeout(6000),
    redirect: "error",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Lyrics provider unavailable");
  return response.json();
}

async function lookup(title, artist, album, duration) {
  const params = { track_name: title, artist_name: artist };
  let match = await request("/api/get-cached", {
    ...params, ...(album && { album_name: album }), ...(duration && { duration }),
  });
  if (!match || Math.abs(Number(match.duration) - duration) > 4 && duration) {
    const found = await request("/api/search", params);
    match = Array.isArray(found) ? found.find((row) =>
      normalize(row.trackName) === normalize(title) && normalize(row.artistName) === normalize(artist) &&
      (!duration || Math.abs(Number(row.duration) - duration) <= 4)
    ) : null;
  }
  if (!match) return { kind: "missing" };
  if (match.instrumental) return { kind: "instrumental" };
  const lines = parseLyrics(String(match.syncedLyrics ?? "").slice(0, 80000));
  if (lines.some(({ text }) => text)) return { kind: "synced", lines };
  const text = String(match.plainLyrics ?? "").trim().slice(0, 40000);
  return text ? { kind: "plain", text } : { kind: "missing" };
}

export function lyrics(title, artist, album, duration) {
  const key = JSON.stringify([title, artist, album, duration]);
  const now = Date.now();
  const known = cache.get(key);
  if (known?.until > now) return known.promise;
  if (cache.size >= limit) cache.delete(cache.keys().next().value);
  const entry = { until: now + 30 * 60000 };
  entry.promise = lookup(title, artist, album, duration).catch((error) => {
    if (cache.get(key) === entry) cache.delete(key);
    throw error;
  });
  cache.set(key, entry);
  return entry.promise;
}
