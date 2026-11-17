import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import { normalizeLibrary, tasteSeeds } from "./state.mjs";

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
