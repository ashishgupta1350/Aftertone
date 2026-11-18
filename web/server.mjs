import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { ApiError, createFirebase } from "./firebase.mjs";
import { emptyLibrary, isTrackId, normalizeLibrary } from "./state.mjs";
import { search, stream } from "./music.mjs";
import { lyrics } from "./lyrics.mjs";
import { knownTopic, normalizeTaste, recommend, tasteArtists } from "./discover.mjs";

const firebase = createFirebase();
const port = Number(process.env.PORT || 4371);
const host = process.env.HOST || "127.0.0.1";
const secureCookies = !process.env.FIREBASE_AUTH_EMULATOR_HOST;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/player.js", ["player.js", "text/javascript; charset=utf-8"]],
  ["/ui.js", ["ui.js", "text/javascript; charset=utf-8"]],
  ["/taste.js", ["taste.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/icon.png", ["icon.png", "image/png"]],
]);
const maxBody = 12 * 1024 * 1024;

async function jsonBody(req, limit = 8192) {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new ApiError(415, "Expected JSON.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limit) throw new ApiError(413, "The library is too large to sync.");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new ApiError(400, "Invalid JSON."); }
}

function cookie(name, value, maxAge) {
  return name + "=" + (value || "") + "; Path=/api; HttpOnly; SameSite=Lax; Max-Age=" + maxAge +
    (secureCookies ? "; Secure" : "");
}

function sessionResponse(res, session, native) {
  if (native) return Response.json(session);
  res.setHeader("Set-Cookie", [cookie("af_id", session.token, 3600), cookie("af_refresh", session.refresh, 30 * 86400)]);
  return Response.json({ uid: session.uid, id: session.id?.endsWith("@accounts.aftertone.invalid") ? null : session.id });
}

function cookieValue(req, name) {
  return req.headers.cookie?.split(/;\s*/).find((entry) => entry.startsWith(name + "="))?.slice(name.length + 1);
}

function libraryOf(value) {
  return value ? { revision: value.revision, library: JSON.parse(value.data) } : { revision: 0, library: emptyLibrary() };
}

function savedTaste(value) {
  if (!value?.data) return null;
  return normalizeTaste(JSON.parse(value.data));
}

function reply(res, response) {
  if (res.destroyed) {
    void response.body?.cancel();
    return;
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) return res.end();
  const body = Readable.fromWeb(response.body);
  body.on("error", () => res.destroy());
  res.once("close", () => body.destroy());
  body.pipe(res);
}

const loginAttempts = new Map();
function checkLoginRate(req) {
  const address = (req.headers["x-forwarded-for"] ?? "").split(",").at(-1).trim() || req.socket.remoteAddress;
  const now = Date.now();
  if (loginAttempts.size >= 4000) {
    for (const [key, entry] of loginAttempts) if (entry.until <= now) loginAttempts.delete(key);
    if (loginAttempts.size >= 4000 && !loginAttempts.has(address)) throw new ApiError(429, "Try again in a minute.");
  }
  const entry = loginAttempts.get(address);
  if (!entry || entry.until <= now) loginAttempts.set(address, { count: 1, until: now + 60000 });
  else if (++entry.count > 30) throw new ApiError(429, "Too many sign-in attempts. Try again in a minute.");
}

async function route(req, res, signal) {
  const url = new URL(req.url, "http://localhost");
  const { pathname: path, searchParams: query } = url;
  const post = req.method === "POST";
  const get = req.method === "GET";
  if (!post && !get) throw new ApiError(405, "Method unavailable.");
  if (get && path === "/healthz") return new Response(null, { status: 204 });
  if (get && files.has(path)) {
    const [name, type] = files.get(path);
    return new Response(await readFile(new URL("./public/" + name, import.meta.url)), { headers: { "content-type": type } });
  }
  if (!path.startsWith("/api/")) throw new ApiError(404, "Page unavailable.");
  if (req.headers["sec-fetch-site"] === "cross-site" ||
      (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) {
    throw new ApiError(403, "This request must come from Aftertone.");
  }

  if (post && (path === "/api/login" || path === "/api/signup")) {
    checkLoginRate(req);
    const body = await jsonBody(req);
    return sessionResponse(res, await firebase.account(body, path.endsWith("signup")), body.client === "android" && !req.headers.origin);
  }
  if (post && path === "/api/refresh") {
    const body = await jsonBody(req);
    const native = body.client === "android" && !req.headers.origin;
    const refresh = native ? body.refresh : cookieValue(req, "af_refresh");
    if (typeof refresh !== "string" || !refresh || refresh.length > 4096) throw new ApiError(401, "Sign in to Aftertone.");
    return sessionResponse(res, await firebase.refresh(refresh), native);
  }
  if (post && path === "/api/logout") {
    res.setHeader("Set-Cookie", [cookie("af_id", "", 0), cookie("af_refresh", "", 0)]);
    return new Response(null, { status: 204 });
  }

  const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1] ?? cookieValue(req, "af_id");
  const user = await firebase.verify(token);
  if (get && path === "/api/me") {
    const id = user.name || (user.email?.endsWith("@accounts.aftertone.invalid") ? null : user.email);
    return Response.json({ uid: user.uid, id, admin: firebase.isAdmin(user.uid) });
  }
  if (get && path === "/api/taste") {
    return Response.json(savedTaste((await firebase.taste(user.uid).get()).val()));
  }
  if (post && path === "/api/taste") {
    const preferences = normalizeTaste(await jsonBody(req));
    if (!preferences) throw new ApiError(400, "Invalid listening preferences.");
    // Realtime Database omits empty arrays. Keep the saved choice in one value, including a deliberate skip.
    await firebase.taste(user.uid).set({ data: JSON.stringify(preferences) });
    return Response.json(preferences);
  }
  if (get && path === "/api/taste/artists") {
    const requested = query.get("q")?.trim().slice(0, 100) ?? "";
    const languages = normalizeTaste({ languages: (query.get("languages") ?? "").split(","), genres: [], artists: [] }).languages;
    return Response.json(await tasteArtists(requested, languages));
  }
  if (get && path === "/api/admin/users") return Response.json(await firebase.users(user.uid, query.get("page")));
  if (post && path === "/api/admin/users") {
    const { uid, disabled } = await jsonBody(req);
    if (typeof uid !== "string" || !uid || uid.length > 128 || typeof disabled !== "boolean") throw new ApiError(400, "Invalid account.");
    await firebase.setDisabled(user.uid, uid, disabled);
    return new Response(null, { status: 204 });
  }

  const state = firebase.library(user.uid);
  if (get && path === "/api/state") {
    const version = query.get("revision");
    if (version !== null && Number(version) === ((await state.child("revision").get()).val() ?? 0)) {
      return new Response(null, { status: 204 });
    }
    return Response.json(libraryOf((await state.get()).val()));
  }
  if (post && path === "/api/state") {
    const { revision, library } = await jsonBody(req, maxBody);
    if (!Number.isSafeInteger(revision) || revision < 0 ||
        !["likes", "playlists", "plays"].every((key) => Array.isArray(library?.[key]))) throw new ApiError(400, "Invalid library.");
    const data = JSON.stringify(normalizeLibrary(library));
    const result = await state.transaction((current) => {
      if (current === null && revision > 0) return null;
      if ((current?.revision ?? 0) !== revision) return undefined;
      return { revision: revision + 1, data };
    });
    const saved = libraryOf(result.snapshot.val());
    return Response.json(saved, { status: result.committed && saved.revision === revision + 1 ? 200 : 409 });
  }
  if (get && path === "/api/recommendations") {
    const requested = query.get("topic");
    if (requested && !knownTopic(requested)) throw new ApiError(400, "Unknown discovery topic.");
    const rotation = Math.min(99, Math.max(0, Math.trunc(Number(query.get("rotation")) || 0)));
    const usesLibrary = requested !== "popular" && requested !== "new";
    const [library, taste] = await Promise.all([usesLibrary ? state.get() : null, firebase.taste(user.uid).get()]);
    return Response.json(await recommend(library ? libraryOf(library.val()).library : null, savedTaste(taste.val()), requested, rotation));
  }
  if (get && path === "/api/lyrics") {
    const title = query.get("title")?.trim().slice(0, 220);
    const artist = query.get("artist")?.trim().slice(0, 160);
    const album = query.get("album")?.trim().slice(0, 180);
    const duration = Math.min(86400, Math.max(0, Math.round(Number(query.get("duration")) || 0)));
    if (!title || !artist) throw new ApiError(400, "Track and artist are required.");
    return Response.json(await lyrics(title, artist, album, duration));
  }
  if (get && path === "/api/search") {
    const q = query.get("q")?.trim().slice(0, 160);
    if (!q) throw new ApiError(400, "Enter a song or artist.");
    return Response.json(await search(q, true));
  }
  if (get && path === "/api/stream" && isTrackId(query.get("id"))) {
    const metadata = {
      title: query.get("title")?.slice(0, 220),
      artist: query.get("artist")?.slice(0, 160),
      durationSec: Math.max(0, Math.min(Number(query.get("duration")) || 0, 86400)),
    };
    const id = query.get("id");
    return stream(id, req.headers.range ?? "bytes=0-", signal, metadata);
  }
  throw new ApiError(404, "This page is unavailable.");
}

createServer(async (req, res) => {
  const abort = new AbortController();
  res.once("close", () => abort.abort());
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' https://*.ytimg.com https://*.googleusercontent.com https://*.ggpht.com; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-ancestors 'none'; base-uri 'none'");
  try { reply(res, await route(req, res, abort.signal)); }
  catch (error) {
    if (!error.status && !abort.signal.aborted) console.error(error.code || error.name);
    reply(res, Response.json({ error: error.status ? error.message : "Aftertone is temporarily unavailable." }, { status: error.status ?? 502 }));
  }
}).listen(port, host, () => console.log("Aftertone listening on http://" + host + ":" + port));
