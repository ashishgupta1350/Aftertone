import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tracks,
  initialState,
  currentTrack,
  selectTrack,
  stepTrack,
  tick,
  toggleFavorite,
  cycleRepeat,
  seek,
  formatTime,
  selectTemplate,
  selectPalette,
  toggleCupidMode,
} from "./model.mjs";

test("seeking clamps to the current song and handles invalid input", () => {
  const s = initialState();
  seek(s, -4);
  assert.equal(s.position, 0);
  seek(s, 900);
  assert.equal(s.position, currentTrack(s).duration);
  seek(s, "invalid");
  assert.equal(s.position, 0);
});
test("paused playback never advances", () => {
  const s = initialState();
  tick(s, 10);
  assert.equal(s.position, 84);
});
test("repeat one restarts the same song at its remaining elapsed time", () => {
  const s = initialState();
  s.playing = true;
  s.repeat = "one";
  s.position = 235;
  tick(s, 2);
  assert.equal(s.trackIndex, 0);
  assert.equal(s.position, 1);
  assert.equal(s.playing, true);
});
test("the queue stops on its final song with repeat off", () => {
  const s = initialState();
  selectTrack(s, tracks.at(-1).id);
  s.position = currentTrack(s).duration - 1;
  tick(s, 2);
  assert.equal(s.playing, false);
  assert.equal(s.position, currentTrack(s).duration);
  assert.equal(currentTrack(s).id, tracks.at(-1).id);
});
test("repeat all wraps at the end of the current queue", () => {
  const s = initialState();
  selectTrack(s, tracks.at(-1).id);
  s.repeat = "all";
  s.position = currentTrack(s).duration;
  tick(s, 1);
  assert.equal(currentTrack(s).id, tracks[0].id);
  assert.equal(s.playing, true);
});
test("removed queue songs are skipped and selecting one adds it back", () => {
  const s = initialState();
  s.queue = s.queue.filter((id) => id !== "violet");
  stepTrack(s, 1);
  assert.equal(currentTrack(s).id, "eternal");
  selectTrack(s, "violet");
  assert.ok(s.queue.includes("violet"));
  assert.equal(s.position, 0);
  assert.equal(s.playing, true);
});
test("previous first restarts a song and then moves back through the queue", () => {
  const s = initialState();
  selectTrack(s, "eternal");
  s.position = 10;
  stepTrack(s, -1);
  assert.equal(currentTrack(s).id, "eternal");
  assert.equal(s.position, 0);
  stepTrack(s, -1);
  assert.equal(currentTrack(s).id, "violet");
});
test("shuffle stays in the current queue and avoids immediately repeating", () => {
  const s = initialState();
  s.shuffle = true;
  s.queue = ["dreamscape", "eternal"];
  stepTrack(s, 1, () => 0);
  assert.equal(currentTrack(s).id, "eternal");
  stepTrack(s, 1, () => 0.999);
  assert.equal(currentTrack(s).id, "dreamscape");
});
test("likes toggle without duplication, independently from playback", () => {
  const s = initialState();
  toggleFavorite(s);
  assert.ok(!s.favorites.includes("dreamscape"));
  toggleFavorite(s);
  assert.equal(s.favorites.filter((id) => id === "dreamscape").length, 1);
  assert.equal(s.position, 84);
});
test("repeat cycles off, all, one, and off", () => {
  const s = initialState();
  cycleRepeat(s);
  assert.equal(s.repeat, "all");
  cycleRepeat(s);
  assert.equal(s.repeat, "one");
  cycleRepeat(s);
  assert.equal(s.repeat, "off");
});
test("persisted design preferences are validated and do not restore playing state", () => {
  const s = initialState({
    palette: "invalid",
    favorites: ["eternal", "removed"],
    playing: true,
  });
  assert.equal(s.palette, "dusk");
  assert.deepEqual(s.favorites, ["eternal"]);
  assert.equal(s.playing, false);
});
test("time labels match music-player notation", () => {
  assert.equal(formatTime(84), "1:24");
  assert.equal(formatTime(236), "3:56");
  assert.equal(formatTime(-2), "0:00");
});

test("switching templates preserves the playing song, time, queue, likes and sound settings", () => {
  const s = initialState();
  selectTrack(s, "eternal");
  s.position = 39;
  s.volume = 37;
  s.eqPreset = "Warm";
  const before = {
    track: s.trackIndex,
    position: s.position,
    playing: s.playing,
    queue: [...s.queue],
    favorites: [...s.favorites],
    volume: s.volume,
    eqPreset: s.eqPreset,
  };
  assert.equal(selectTemplate(s, "rosemary"), true);
  assert.equal(s.template, "rosemary");
  assert.equal(s.palette, "roseglass");
  assert.deepEqual(
    {
      track: s.trackIndex,
      position: s.position,
      playing: s.playing,
      queue: s.queue,
      favorites: s.favorites,
      volume: s.volume,
      eqPreset: s.eqPreset,
    },
    before,
  );
});
test("each template remembers its own selected color story", () => {
  const s = initialState();
  selectPalette(s, "moon");
  selectTemplate(s, "rosemary");
  selectPalette(s, "violetglass");
  selectTemplate(s, "aurora");
  assert.equal(s.palette, "moon");
  selectTemplate(s, "rosemary");
  assert.equal(s.palette, "violetglass");
});
test("unknown templates and palettes cannot corrupt the active theme", () => {
  const s = initialState();
  assert.equal(selectTemplate(s, "__proto__"), false);
  assert.equal(selectPalette(s, "roseglass"), false);
  assert.equal(s.template, "aurora");
  assert.equal(s.palette, "dusk");
});
test("saved template, palette and shape can be restored together", () => {
  const s = initialState({
    template: "rosemary",
    palette: "champagne",
    iconShape: "squircle",
    paletteByTemplate: { aurora: "moon", rosemary: "champagne" },
  });
  assert.equal(s.template, "rosemary");
  assert.equal(s.palette, "champagne");
  assert.equal(s.iconShape, "squircle");
  selectTemplate(s, "aurora");
  assert.equal(s.palette, "moon");
});
test("existing palette preferences migrate into the original Aurora template", () => {
  const s = initialState({ palette: "rose", favorites: ["eternal"] });
  assert.equal(s.template, "aurora");
  assert.equal(s.palette, "rose");
  selectTemplate(s, "rosemary");
  assert.equal(s.palette, "roseglass");
  selectTemplate(s, "aurora");
  assert.equal(s.palette, "rose");
  assert.deepEqual(s.favorites, ["eternal"]);
});
test("invalid stored theme choices fall back independently", () => {
  const s = initialState({
    template: "invalid",
    palette: "invalid",
    iconShape: "invalid",
    paletteByTemplate: { aurora: "invalid", rosemary: "moon" },
  });
  assert.equal(s.template, "aurora");
  assert.equal(s.palette, "dusk");
  assert.equal(s.iconShape, "orb");
  selectTemplate(s, "rosemary");
  assert.equal(s.palette, "roseglass");
});

test("Cupid light/dark mode preserves the current screen, playback and search", () => {
  const s = initialState();
  selectTemplate(s, "cupid");
  assert.equal(s.palette, "cupidday");
  selectTrack(s, "violet");
  s.position = 47;
  s.screen = "search";
  s.search = "quiet";
  s.libraryFilter = "albums";
  assert.equal(toggleCupidMode(s), true);
  assert.equal(s.palette, "cupidnight");
  assert.equal(s.playing, true);
  assert.equal(s.position, 47);
  assert.equal(currentTrack(s).id, "violet");
  assert.equal(s.screen, "search");
  assert.equal(s.search, "quiet");
  assert.equal(s.libraryFilter, "albums");
  toggleCupidMode(s);
  assert.equal(s.palette, "cupidday");
});
test("Cupid remembers its dark mode independently from the other templates", () => {
  const s = initialState();
  selectPalette(s, "moon");
  selectTemplate(s, "cupid");
  toggleCupidMode(s);
  selectTemplate(s, "aurora");
  assert.equal(s.palette, "moon");
  selectTemplate(s, "cupid");
  assert.equal(s.palette, "cupidnight");
  const restored = initialState({
    template: s.template,
    palette: s.palette,
    paletteByTemplate: s.paletteByTemplate,
  });
  assert.equal(restored.palette, "cupidnight");
});
test("Cupid mode actions cannot change another template", () => {
  const s = initialState();
  assert.equal(toggleCupidMode(s), false);
  assert.equal(s.template, "aurora");
  assert.equal(s.palette, "dusk");
  assert.equal(selectPalette(s, "cupidday"), false);
});
