export const tracks = [
  {
    id: "dreamscape",
    title: "Dreamscape",
    artist: "Aurora Lights",
    album: "Somewhere, softly",
    duration: 236,
    art: "./assets/dreamscape.png",
    mood: "DREAM POP",
    favorite: true,
  },
  {
    id: "violet",
    title: "Violet Hours",
    artist: "The Quiet Atlas",
    album: "After the sun",
    duration: 214,
    art: "./assets/violet-hours.svg",
    mood: "AMBIENT",
    favorite: false,
  },
  {
    id: "eternal",
    title: "Eternal",
    artist: "Nord Grove",
    album: "Evergreen",
    duration: 198,
    art: "./assets/eternal.svg",
    mood: "INDIE FOLK",
    favorite: false,
  },
  {
    id: "slow",
    title: "Slow Motion",
    artist: "Aurora Lights",
    album: "Somewhere, softly",
    duration: 251,
    art: "./assets/dreamscape.png",
    mood: "DREAM POP",
    favorite: false,
  },
  {
    id: "blue",
    title: "Before the Blue",
    artist: "The Quiet Atlas",
    album: "After the sun",
    duration: 187,
    art: "./assets/violet-hours.svg",
    mood: "AMBIENT",
    favorite: true,
  },
];

export const templatePalettes = Object.freeze({
  aurora: Object.freeze(["dusk", "rose", "moon"]),
  rosemary: Object.freeze(["roseglass", "violetglass", "champagne"]),
});

export function initialState(saved = {}) {
  const template = Object.hasOwn(templatePalettes, saved.template)
    ? saved.template
    : "aurora";
  const paletteByTemplate = Object.fromEntries(
    Object.entries(templatePalettes).map(([key, values]) => {
      const stored = saved.paletteByTemplate?.[key];
      const legacy = key === "aurora" ? saved.palette : null;
      return [
        key,
        values.includes(stored)
          ? stored
          : values.includes(legacy)
            ? legacy
            : values[0],
      ];
    }),
  );
  if (templatePalettes[template].includes(saved.palette))
    paletteByTemplate[template] = saved.palette;
  return {
    screen: "player",
    sheet: null,
    trackIndex: 0,
    position: 84,
    playing: false,
    shuffle: false,
    repeat: "off",
    volume: 65,
    previousVolume: 65,
    template,
    palette: paletteByTemplate[template],
    paletteByTemplate,
    iconShape: ["orb", "squircle"].includes(saved.iconShape)
      ? saved.iconShape
      : "orb",
    favorites: Array.isArray(saved.favorites)
      ? saved.favorites.filter((id) => tracks.some((t) => t.id === id))
      : tracks.filter((t) => t.favorite).map((t) => t.id),
    queue: tracks.map((t) => t.id),
    libraryFilter: "playlists",
    search: "",
    eqPreset: "Balanced",
    eq: [0, 0, 0, 0, 0],
    sleepMinutes: null,
    sleepEndsAt: null,
    lastScreen: "home",
    playlist: [],
  };
}

export function selectTemplate(state, id) {
  if (!Object.hasOwn(templatePalettes, id)) return false;
  state.paletteByTemplate[state.template] = state.palette;
  state.template = id;
  state.palette = state.paletteByTemplate[id] || templatePalettes[id][0];
  return true;
}

export function selectPalette(state, id) {
  if (!templatePalettes[state.template].includes(id)) return false;
  state.palette = id;
  state.paletteByTemplate[state.template] = id;
  return true;
}

export function currentTrack(state) {
  return tracks[state.trackIndex];
}
export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
export function selectTrack(state, id) {
  const next = tracks.findIndex((t) => t.id === id);
  if (next < 0) return;
  if (!state.queue.includes(id)) state.queue.push(id);
  state.trackIndex = next;
  state.position = 0;
  state.playing = true;
}
export function stepTrack(state, direction, random = Math.random) {
  if (direction < 0 && state.position > 3) {
    state.position = 0;
    return;
  }
  const ordered = state.queue
    .map((id) => tracks.findIndex((t) => t.id === id))
    .filter((i) => i >= 0);
  if (state.shuffle && direction > 0 && ordered.length > 1) {
    const others = ordered.filter((i) => i !== state.trackIndex);
    state.trackIndex =
      others[Math.min(others.length - 1, Math.floor(random() * others.length))];
  } else {
    const index = ordered.indexOf(state.trackIndex);
    state.trackIndex =
      ordered[(index + direction + ordered.length) % ordered.length] ??
      state.trackIndex;
  }
  state.position = 0;
}
export function tick(state, elapsedSeconds) {
  if (!state.playing) return;
  state.position += elapsedSeconds;
  if (state.position < currentTrack(state).duration) return;
  if (state.repeat === "one") {
    state.position %= currentTrack(state).duration;
    return;
  }
  const atEnd =
    state.queue.indexOf(currentTrack(state).id) === state.queue.length - 1;
  if (atEnd && state.repeat === "off" && !state.shuffle) {
    state.position = currentTrack(state).duration;
    state.playing = false;
    return;
  }
  stepTrack(state, 1);
}
export function toggleFavorite(state) {
  const id = currentTrack(state).id;
  state.favorites = state.favorites.includes(id)
    ? state.favorites.filter((f) => f !== id)
    : [...state.favorites, id];
}
export function cycleRepeat(state) {
  state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
}
export function seek(state, seconds) {
  state.position = Math.max(
    0,
    Math.min(currentTrack(state).duration, Number(seconds) || 0),
  );
}
