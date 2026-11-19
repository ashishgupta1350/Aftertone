import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import { normalizeLibrary, tasteSeeds } from "./state.mjs";
import { parseLyrics } from "./lyrics.mjs";
import { moveTrack } from "./public/ui.js";
import { firstAudioSource, matchesAlternateTrack } from "./music.mjs";
import { normalizeTaste } from "./discover.mjs";

const a = { id: "aaaaaaaaaaa", title: "A", artists: [{ name: "First artist" }] };
const b = { id: "bbbbbbbbbbb", title: "B", artists: [{ name: "Second artist" }] };
const c = { id: "ccccccccccc", title: "C", artists: [{ name: "Excluded artist" }] };

test("preserves liked order and track order across Android and web", () => {
  const library = normalizeLibrary({
    likes: [{ song: a, at: 1 }, { song: b, at: 2 }],
    playlists: [{ id: "prism:phone", name: "Phone playlist", songs: [a, b] }],
    plays: [{ song: b, at: 7, ms: 20000 }],
  });
  deepEqual(library.likes.map(({ song }) => song.id), [b.id, a.id]);
  deepEqual(library.playlists[0].songs.map(({ id }) => id), [a.id, b.id]);
  equal(library.plays[0].ms, 20000);
});

test("builds recommendations from multiple devices' library and history signals", () => {
  const time = 1000;
  const library = normalizeLibrary({
    likes: [{ song: a, at: time }],
    playlists: [{ id: "prism:web", name: "Web playlist", songs: [b] }],
    plays: [{ song: b, at: time, ms: 20000 }, { song: c, at: time, ms: 20000, excluded: true }],
  });
  const taste = tasteSeeds(library, time);
  deepEqual(taste.artists, ["Second artist", "First artist"]);
  deepEqual([...taste.known], [a.id, b.id]);
});

test("keeps a skipped taste setup distinct from a new account and validates choices", () => {
  equal(normalizeTaste(null), null);
  deepEqual(normalizeTaste({ languages: [], genres: [], artists: [] }), { languages: [], genres: [], artists: [] });
  deepEqual(normalizeTaste({
    languages: ["english", "hindi", "english", "indie"],
    genres: ["indie", "chill", "hindi"],
    artists: [" Arijit Singh ", "Arijit Singh", "", null],
  }), { languages: ["hindi", "english"], genres: ["indie"], artists: ["Arijit Singh"] });
});

test("rebasing a playlist move keeps tracks added by Android", () => {
  const tracks = [a, c, b];
  moveTrack(tracks, a.id, b.id, 1);
  deepEqual(tracks.map(({ id }) => id), [c.id, b.id, a.id]);
  moveTrack(tracks, a.id, "removed0000", -1);
  deepEqual(tracks.map(({ id }) => id), [c.id, b.id, a.id]);
});

test("parses lyric offsets, repeated lines, and intentional gaps", () => {
  deepEqual(parseLyrics("[offset:+250]\n[00:02.10][00:08.1]Chorus\n[00:03.000]\n[00:00.0]Intro"), [
    { at: 0.25, text: "Intro" }, { at: 2.35, text: "Chorus" },
    { at: 3.25, text: "" }, { at: 8.35, text: "Chorus" },
  ]);
});

test("a matching alternate can start while the primary lookup is still pending", async () => {
  let releaseAlternate;
  const alternate = new Promise((resolve) => { releaseAlternate = resolve; });
  let primarySignal;
  const result = await firstAudioSource(() => alternate, (signal) => {
    primarySignal = signal;
    releaseAlternate("alternate");
    return new Promise((_, reject) => signal.addEventListener("abort", reject, { once: true }));
  }, 0);
  equal(result, "alternate");
  equal(primarySignal.aborted, true);
});

test("an immediate alternate miss starts the primary without waiting for the hedge", async () => {
  equal(await firstAudioSource(async () => null, async () => "primary", 10000), "primary");
  equal(await firstAudioSource(async () => null, async () => null), null);
});

test("a cancelled source lookup never starts its second provider", async () => {
  const parent = new AbortController();
  let fallbackCalls = 0;
  const result = await firstAudioSource((signal) => {
    parent.abort();
    equal(signal.aborted, true);
    return null;
  }, () => { fallbackCalls++; return "fallback"; }, 10000, parent.signal);
  equal(result, null);
  equal(fallbackCalls, 0);
});

test("recognizes film title punctuation and credits without silently changing edits", () => {
  const candidate = {
    type: "song", name: "Tu Mil Jaaye (From &quot;KING&quot;)", duration: 315,
    artists: { primary: [{ name: "Sachin-Jigar" }, { name: "Arijit Singh" }] },
  };
  const album = { title: 'Tu Mil Jaaye (From "KING")', artists: ["Kumaar", "Arijit Singh"], durationSec: 316 };
  equal(matchesAlternateTrack(candidate, album), true);
  equal(matchesAlternateTrack(candidate, { ...album, durationSec: 223 }), false);
  equal(matchesAlternateTrack(candidate, { ...album, title: "Tu Mil Jaaye (Remix)" }), false);
  equal(matchesAlternateTrack(candidate, { ...album, title: 'Tu Mil Jaaye (From "Another Film")' }), false);
  equal(matchesAlternateTrack(candidate, { ...album, artists: ["Unrelated artist"] }), false);
});
