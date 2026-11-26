import {
  tracks,
  initialState,
  currentTrack,
  formatTime,
  selectTrack,
  stepTrack,
  tick,
  toggleFavorite,
  cycleRepeat,
  seek,
  selectTemplate,
  selectPalette,
  toggleCupidMode,
} from "./model.mjs";
import { rosemaryIcon, rosemaryIconNames } from "./rosemary-icons.mjs";
import { cupidIcon, cupidBow } from "./cupid-icons.mjs";
import { cupidScene } from "./cupid-art.mjs";

const screen = document.querySelector("#screen");
const phone = document.querySelector("#phone");
const sheetLayer = document.querySelector("#sheet-layer");
const toast = document.querySelector("#toast");
// Render at actual CSS size: shrinking the entire device also shrinks text and
// touch targets. Short windows get a shorter screen with scrolling body content.
function fitPreview() {
  const width = Math.min(
    390,
    document.querySelector(".preview-area").clientWidth,
  );
  const height = Math.max(760, Math.min(844, window.innerHeight - 160));
  phone.style.width = `${width}px`;
  // A definite height keeps child scroll areas inside the device when content
  // changes. An intrinsic aspect-ratio height grows with long library pages.
  phone.style.height = `${height}px`;
  phone.classList.toggle("compact-player", height < 740);
  phone.style.zoom = "1";
}
window.addEventListener("resize", fitPreview);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("aftertone-design-v1") || "{}") || {};
} catch {
  /* Storage may be disabled in a preview. */
}
const state = initialState(saved);
const requestedTemplate = new URL(location.href).searchParams.get("template");
if (requestedTemplate) selectTemplate(state, requestedTemplate);
const tokens = await fetch("./tokens.json").then((r) => {
  if (!r.ok) throw new Error("Theme tokens unavailable");
  return r.json();
});
const iconNames = rosemaryIconNames;
// These are the same source SVGs compiled into PrismIcons in the Android build.
const icons = Object.fromEntries(
  await Promise.all(
    iconNames.map(async (name) => {
      const r = await fetch(`../icons/${name}.svg`);
      if (!r.ok) throw new Error(`Missing shared icon: ${name}`);
      const text = await r.text();
      return [
        name,
        text
          .replace(
            "<svg ",
            '<svg class="icon" aria-hidden="true" focusable="false" ',
          )
          .replace(/<style>[\s\S]*?<\/style>/, ""),
      ];
    }),
  ),
);
const icon = (name) =>
  state.template === "cupid"
    ? cupidIcon(name)
    : state.template === "rosemary"
      ? rosemaryIcon(name, state.iconShape)
      : icons[name] || icons.Song;
const artFor = (t) =>
  state.template === "cupid"
    ? `./assets/cupid/${t.id === "eternal" ? "roses" : ["violet", "blue"].includes(t.id) ? "moon" : "record"}.svg`
    : t.art;
function cupidModeButton() {
  const dark = state.palette === "cupidnight";
  return button(
    dark ? "Sun" : "Moon",
    dark ? "Switch to light mode" : "Switch to dark mode",
    "cupid-mode",
    "cupid-mode-toggle",
  ).replace("title=", `aria-pressed="${dark}" title=`);
}
function browseActions() {
  return state.template === "cupid"
    ? `<div class="cupid-header-actions">${cupidModeButton()}${button("Settings", "Open settings", "settings")}</div>`
    : '<button class="avatar" data-action="settings" aria-label="Open settings">A</button>';
}
const wave = () =>
  `<span class="mini-wave" aria-hidden="true">${[5, 10, 7, 12, 8, 4, 9].map((h, i) => `<i style="--bar:${h}px;--delay:${i * -0.17}s"></i>`).join("")}</span>`;
const liked = () => state.favorites.includes(currentTrack(state).id);
const button = (name, label, action, extra = "") =>
  `<button type="button" class="icon-button ${extra}" data-action="${action}" aria-label="${label}" title="${label}">${icon(name)}</button>`;
const paletteBackground = (p) =>
  `linear-gradient(145deg,${p.top},${p.glow} 52%,${p.base})`;
const save = () => {
  try {
    localStorage.setItem(
      "aftertone-design-v1",
      JSON.stringify({
        template: state.template,
        palette: state.palette,
        paletteByTemplate: state.paletteByTemplate,
        iconShape: state.iconShape,
        favorites: state.favorites,
      }),
    );
  } catch {
    /* Keep interactions available without persistent storage. */
  }
};
let toastTimeout;
function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2700);
}

function paletteControls(compact = false) {
  return Object.entries(tokens.palettes)
    .filter(([key]) => tokens.templates[state.template].palettes.includes(key))
    .map(
      ([key, p]) =>
        `<button type="button" class="${compact ? "" : "palette-option"}" data-palette="${key}" aria-label="${p.name}" aria-pressed="${state.palette === key}" title="${p.name}" ${compact ? `style="background:${paletteBackground(p)}"` : ""}>${compact ? "" : `<span class="palette-swatch" style="background:${paletteBackground(p)}"></span><span>${p.name}</span>${state.palette === key ? '<span class="palette-check" aria-hidden="true">✓</span>' : ""}`}</button>`,
    )
    .join("");
}
function applyPalette() {
  const palette = tokens.palettes[state.palette];
  for (const name of ["base", "top", "glow", "accent", "muted"])
    phone.style.setProperty(`--${name}`, palette[name]);
  phone.style.setProperty("--ink", palette.text);
  phone.style.setProperty("--artwork-radius", `${tokens.radiiDp.artwork}px`);
  phone.style.setProperty(
    "--primary-size",
    `${tokens.spacingDp.transportPrimary}px`,
  );
  phone.dataset.palette = state.palette;
  phone.dataset.template = state.template;
  phone.dataset.iconShape = state.iconShape;
  phone.dataset.mode = state.palette === "cupidnight" ? "dark" : "light";
  document.body.dataset.mode = phone.dataset.mode;
  document.body.dataset.template = state.template;
  for (const field of [
    "paper",
    "panel",
    "border",
    "shadow",
    "highlight",
    "ribbon",
    "wall",
    "curtain",
    "curtainLight",
    "floor",
    "floorLine",
    "deck",
    "deckSide",
    "vase",
    "outline",
    "text",
    "muted",
    "accent",
  ]) {
    const variable = `--cupid-${field.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;
    phone.style.setProperty(variable, palette[field] || palette.base);
    document.body.style.setProperty(variable, palette[field] || palette.base);
  }
  for (const [variable, key] of Object.entries({
    "--icon-light": "iconLight",
    "--icon-color": "iconColor",
    "--icon-deep": "iconDeep",
    "--icon-edge": "iconEdge",
  })) {
    phone.style.setProperty(variable, palette[key] || palette.accent);
  }
  const template = tokens.templates[state.template];
  document.querySelector(".reference-note p").innerHTML =
    state.template === "cupid"
      ? "Inspired only by your Cupid player image.<br>Pixel lettering, roses, and a record.<br>Daydream or moonlight."
      : state.template === "rosemary"
        ? "Inspired by Rose Glass.<br>Original Aftertone icon drawings.<br>Smoked faces, silver light."
        : "Atmosphere from reference 01.<br>Player composition from reference 03.<br>A compact player inspired by 02.";
  document.querySelector(".design-note h1").innerHTML =
    state.template === "cupid"
      ? "A little love.<br>On repeat."
      : "A little closer<br>to the music.";
  document.querySelector(".design-description").innerHTML =
    state.template === "cupid"
      ? "A tiny room for your favorite songs.<br>Stay until the record ends."
      : "Soft light. A little glass.<br>And room for the song to breathe.";
  const componentDescriptions =
    state.template === "cupid"
      ? {
          artwork: "An illustrated record room",
          "track-info": "Pixel lettering, paper labels",
          transport: "Raised keys, a star playhead",
          "utility-dock": "Four pixel tools in one frame",
          volume: "Volume and output in Settings",
        }
      : {
          artwork: "Rounded glass, soft elevation",
          "track-info": "Quiet, centered typography",
          transport: "Tactile, luminous, familiar",
          "utility-dock": "Four tools, one glass surface",
          volume: "Simple, precise, within reach",
        };
  document
    .querySelectorAll(".component-links [data-highlight]")
    .forEach((el) => {
      el.querySelector("small").textContent =
        componentDescriptions[el.dataset.highlight];
    });
  document.querySelector(".studio-footer>span:last-child").textContent =
    `ANDROID STUDY — ${template.number}`;
  document.querySelector("#studio-template-label").innerHTML =
    `${template.name.toUpperCase()} <span class="version">${template.number}</span>`;
  document.querySelector("#active-template-label").textContent = template.name;
  document.querySelector("#desktop-templates").innerHTML = Object.entries(
    tokens.templates,
  )
    .map(
      ([id, t]) =>
        `<button data-template="${id}" aria-pressed="${id === state.template}"><span>${t.number}</span>${t.name}${id === state.template ? '<span class="template-check">✓</span>' : ""}</button>`,
    )
    .join("");
  document.querySelector("#desktop-palettes").innerHTML = paletteControls();
  document.querySelector("#compact-palettes").innerHTML = paletteControls(true);
  save();
}
function templateCards() {
  return `<div class="template-cards">${Object.entries(tokens.templates)
    .map(
      ([id, t]) =>
        `<button class="template-card ${id}" data-template="${id}" aria-pressed="${state.template === id}" aria-label="Use ${t.name} template"><span class="template-card-preview" aria-hidden="true">${["Play", "Heart", "Settings"].map((name) => (id === "cupid" ? cupidIcon(name) : id === "rosemary" ? rosemaryIcon(name, state.iconShape) : icons[name])).join("")}<span class="template-card-shine"></span></span><span class="template-card-info"><strong><span>${t.number}</span>${t.name}</strong><small>${t.description}</small></span><span class="template-selected">${state.template === id ? icon("Check") : ""}</span></button>`,
    )
    .join(
      "",
    )}</div>${state.template === "cupid" ? `<p class="sheet-section-label">Color mode</p><div class="cupid-mode-options"><button data-palette="cupidday" aria-pressed="${state.palette === "cupidday"}">${cupidIcon("Sun")}Light</button><button data-palette="cupidnight" aria-pressed="${state.palette === "cupidnight"}">${cupidIcon("Moon")}Dark</button></div>` : state.template === "rosemary" ? `<p class="sheet-section-label">Icon silhouette</p><div class="shape-options">${["orb", "squircle"].map((shape) => `<button data-shape="${shape}" aria-pressed="${state.iconShape === shape}">${rosemaryIcon("Song", shape)}<span>${shape === "orb" ? "Glass orb" : "Soft square"}</span></button>`).join("")}</div>` : ""}`;
}
function iconGallery() {
  const groups = {
    Playback: [
      "Play",
      "Pause",
      "Previous",
      "Next",
      "Shuffle",
      "Repeat",
      "VolumeDown",
      "VolumeUp",
      "VolumeOff",
    ],
    "Your library": [
      "Heart",
      "Star",
      "Song",
      "Album",
      "Library",
      "PlaylistAdd",
      "Download",
    ],
    "Listening tools": [
      "QueueMusic",
      "Equalizer",
      "Lyrics",
      "Settings",
      "Palette",
      "Timer",
      "Headphones",
      "Speaker",
    ],
    Navigation: [
      "Home",
      "Search",
      "ChevronDown",
      "ChevronRight",
      "ArrowBack",
      "Close",
      "More",
      "Check",
      "Remove",
      "Info",
    ],
  };
  if (state.template === "cupid") groups["Day & night"] = ["Sun", "Moon"];
  return `<section class="kit-content icon-atlas" aria-label="Icon family"><header class="mobile-header">${button("ArrowBack", "Back to component kit", "components")}<div class="header-identity"><span>The icon family</span><small>${tokens.templates[state.template].name.toUpperCase()}</small></div>${button("Palette", "Choose a template", "themes")}</header><p class="kit-intro">${state.template === "cupid" ? "36 little pixel symbols.<br>A whole world, one square at a time." : state.template === "rosemary" ? "34 original glass icons.<br>One material, every little interaction." : "The original Android icon family.<br>Compare the same functions in either template."}</p>${Object.entries(
    groups,
  )
    .map(
      ([title, names]) =>
        `<div class="kit-label">${title.toUpperCase()}<span>${names.length} icons</span></div><div class="icon-grid">${names.map((name) => `<div>${icon(name)}<small>${name.replace(/([a-z])([A-Z])/g, "$1 $2")}</small></div>`).join("")}</div>`,
    )
    .join("")}</section>`;
}
function trackIdentity() {
  const t = currentTrack(state);
  return `<div class="track-info" data-component="track-info">${state.template === "rosemary" ? '<span class="track-overline">A MOMENT, JUST FOR YOU</span>' : ""}<h1>${t.title}</h1><p>${t.artist}</p></div>`;
}
function scrubber() {
  const t = currentTrack(state);
  return `<div class="scrubber"><input class="range seek-range" type="range" min="0" max="${t.duration}" step="1" value="${Math.floor(state.position)}" aria-label="Playback position" aria-valuetext="${formatTime(state.position)} of ${formatTime(t.duration)}" style="--fill:${(state.position / t.duration) * 100}%"><div class="timestamps"><span data-elapsed>${formatTime(state.position)}</span><span>${formatTime(t.duration)}</span></div></div>`;
}
function transport() {
  return `<div class="transport" data-component="transport">${button("Shuffle", "Shuffle", "shuffle", state.shuffle ? "active" : "").replace("title=", `aria-pressed="${state.shuffle}" title=`)}${button("Previous", "Previous track", "previous")}<button class="play-button" data-action="play" aria-label="${state.playing ? "Pause" : "Play"}" title="${state.playing ? "Pause" : "Play"}">${icon(state.playing ? "Pause" : "Play")}</button>${button("Next", "Next track", "next")}<button class="icon-button ${state.repeat !== "off" ? "active" : ""}" data-action="repeat" aria-label="Repeat: ${state.repeat}" title="Repeat: ${state.repeat}" aria-pressed="${state.repeat !== "off"}">${icon("Repeat")}${state.repeat === "one" ? '<span class="repeat-one">1</span>' : ""}</button></div>`;
}
function utilityDock() {
  const tool = (name, label, action, visible) =>
    button(name, label, action).replace(
      "</button>",
      `<span class="tool-label">${visible}</span></button>`,
    );
  return `<nav class="utility-dock glass" aria-label="Player tools" data-component="utility-dock">${tool("QueueMusic", "Open queue", "queue", "Queue")}${tool("Equalizer", "Open equalizer", "equalizer", "Sound")}${tool("Lyrics", "Open lyrics", "lyrics", "Lyrics")}${tool("Settings", "Player settings", "settings", "Settings")}</nav>`;
}
function volumeControl() {
  return `<div class="volume" data-component="volume">${button(state.volume === 0 ? "VolumeOff" : "VolumeDown", state.volume === 0 ? "Unmute" : "Mute", "mute")}<input class="range volume-range" aria-label="Volume" aria-valuetext="${state.volume} percent" type="range" min="0" max="100" value="${state.volume}" style="--fill:${state.volume}%">${button("VolumeUp", "Output device", "output")}</div>`;
}
function favoriteButton() {
  return button(
    "Heart",
    liked() ? "Remove from liked songs" : "Add to liked songs",
    "favorite",
    `favorite ${liked() ? "active" : ""}`,
  ).replace("title=", `aria-pressed="${liked()}" title=`);
}
function player() {
  if (state.template === "cupid") return cupidPlayer();
  const t = currentTrack(state);
  return `<section class="player-screen" aria-label="Now playing"><header class="mobile-header">${button("ChevronDown", "Minimize player", "minimize")}<div class="header-identity"><span>Now playing</span><small>${state.template === "rosemary" ? "THE ROSE HOUR" : "THE EVENING EDIT"}</small></div>${button("More", "Track options", "options")}</header><div class="artwork" data-component="artwork"><img src="${artFor(t)}" alt="${t.album} cover artwork"><span class="art-badge">${wave()}<span>${t.mood}</span></span>${favoriteButton()}</div>${trackIdentity()}${scrubber()}${transport()}<div class="player-bottom">${utilityDock()}${volumeControl()}<div class="listening-status">${icon("Headphones")}<span>Just you and the music</span></div></div></section>`;
}
function cupidPlayer() {
  const t = currentTrack(state);
  return `<section class="cupid-player-screen" aria-label="Now playing"><div class="cupid-window">${cupidBow}<header class="cupid-titlebar"><button class="cupid-app-name" data-action="minimize" aria-label="Minimize player">cupid player</button><div class="cupid-header-actions">${cupidModeButton()}${button("More", "Track options", "options")}</div></header><div class="cupid-scene" data-component="artwork">${cupidScene()}<span class="cupid-heart-corner top-left">${cupidIcon("Heart")}</span><span class="cupid-heart-corner bottom-right">${cupidIcon("Heart")}</span></div><div class="cupid-player-controls"><div class="cupid-song-row" data-component="track-info"><img class="cupid-song-thumb" src="${artFor(t)}" alt="${t.album} artwork"><div class="cupid-song-meta"><small>now playing</small><h1 title="${t.title}">${t.title}</h1><p>by ${t.artist}</p></div>${favoriteButton()}</div><div class="cupid-transport" data-component="transport">${button("Previous", "Previous track", "previous")}<button class="play-button" data-action="play" aria-label="${state.playing ? "Pause" : "Play"}" title="${state.playing ? "Pause" : "Play"}">${icon(state.playing ? "Pause" : "Play")}</button>${button("Next", "Next track", "next")}</div>${scrubber()}</div><footer class="cupid-tools">${utilityDock()}</footer><span class="cupid-window-heart" aria-hidden="true">${cupidIcon("Heart")}</span></div></section>`;
}
function miniPlayer() {
  const t = currentTrack(state);
  return `<div class="mini-player glass" aria-label="Mini player"><button class="mini-art" data-action="expand" aria-label="Open now playing"><img src="${artFor(t)}" alt=""></button><button class="mini-info" data-action="expand"><strong>${t.title}</strong><small>${t.artist}</small></button>${button(state.playing ? "Pause" : "Play", state.playing ? "Pause" : "Play", "play")}${button("Next", "Next track", "next")}<span class="mini-progress"><i style="width:${(state.position / t.duration) * 100}%"></i></span></div>`;
}
function bottomNav() {
  const active =
    state.screen === "collection" ? state.lastScreen : state.screen;
  return `<nav class="bottom-nav" aria-label="Main navigation"><button data-screen="home" aria-pressed="${active === "home"}">${icon("Home")}<span>Home</span></button><button data-action="search" aria-pressed="${active === "search"}">${icon("Search")}<span>Search</span></button><button data-screen="library" aria-pressed="${active === "library"}">${icon("Library")}<span>Your library</span></button></nav>`;
}
function albumTile(track, title, subtitle, collection) {
  return `<button class="album-tile" data-collection="${collection}"><img src="${artFor(track)}" alt="${title} artwork"><strong>${title}</strong><small>${subtitle}</small></button>`;
}
function home() {
  if (state.template === "cupid") return cupidHome();
  return `<section class="browse-screen" aria-label="Home"><div class="browse-content"><header class="browse-header"><div><small>Your own little corner of sound</small><h1>Good evening.</h1></div>${browseActions()}</header><div class="filter-pills" aria-label="Home collections"><button aria-pressed="true" data-screen="home">For you</button><button data-collection="evening">Your mixes</button><button data-action="liked">Liked songs</button></div><button class="feature-card" data-collection="evening"><img src="${artFor(tracks[0])}" alt="Violet sunset over a quiet bay"><span class="eyebrow">MADE FOR YOUR SLOWER MOMENTS</span><h2>The<br>evening edit.</h2><p>A soft place to land.<br>Dream pop, quiet skies, and you.</p><span class="feature-play">${icon("Play")}</span></button><div class="section-heading"><h2>Stay a little longer</h2><button data-screen="library">See all</button></div><div class="album-grid">${albumTile(tracks[1], "Blue hour", "A little further from the noise", "blue")}${albumTile(tracks[2], "Into the evergreens", "For the winding way home", "forest")}</div><div class="section-heading"><h2>On repeat, for a reason</h2></div>${trackRow(tracks[0])}${trackRow(tracks[1])}</div>${miniPlayer()}${bottomNav()}</section>`;
}
function cupidHome() {
  return `<section class="browse-screen cupid-home" aria-label="Home"><div class="browse-content"><header class="browse-header"><div><small>a little music, a little magic</small><h1>hello, dreamer.</h1></div>${browseActions()}</header><button class="cupid-mixtape" data-collection="evening"><div class="cupid-mixtape-art">${cupidScene()}<span class="cupid-sticker">${cupidIcon("Star")} side a</span></div><div class="cupid-mixtape-caption"><div><small>made for your little daydreams</small><h2>The evening edit</h2><p>5 songs · one soft landing</p></div><span class="cupid-feature-play">${cupidIcon("Play")}</span></div></button><div class="section-heading"><h2>little collections</h2><button data-screen="library">See all</button></div><div class="album-grid">${albumTile(tracks[1], "Moonlit melodies", "For the late-night window", "blue")}${albumTile(tracks[2], "A bouquet of songs", "Something to keep close", "forest")}</div><div class="section-heading"><h2>on the record</h2></div>${trackRow(tracks[0])}${trackRow(tracks[1])}</div>${miniPlayer()}${bottomNav()}</section>`;
}
function trackRow(t) {
  return `<button class="track-row ${t.id === currentTrack(state).id ? "playing" : ""}" data-track="${t.id}" aria-label="Play ${t.title} by ${t.artist}"><img src="${artFor(t)}" alt=""><span><strong class="track-row-title">${t.title}</strong><span class="track-row-artist">${t.artist}</span></span><span class="row-end">${t.id === currentTrack(state).id ? wave() : ""}<span class="track-row-time">${formatTime(t.duration)}</span></span></button>`;
}
function playlistRow(art, title, subtitle, attribute) {
  return `<button class="playlist-row" ${attribute}>${art}<span><strong>${title}</strong><small>${subtitle}</small></span>${icon("ChevronRight")}</button>`;
}
function playlistRows() {
  return (
    playlistRow(
      `<span class="playlist-art liked-art">${icon("Heart")}</span>`,
      "Liked songs",
      `${state.favorites.length} songs · A little more you`,
      'data-action="liked"',
    ) +
    playlistRow(
      `<img class="playlist-art" src="${artFor(tracks[0])}" alt="">`,
      "The evening edit",
      "5 songs · Curated for your quieter side",
      'data-collection="evening"',
    ) +
    playlistRow(
      `<img class="playlist-art" src="${artFor(tracks[1])}" alt="">`,
      "Blue hour",
      "2 songs · Just a little after sunset",
      'data-collection="blue"',
    ) +
    playlistRow(
      `<img class="playlist-art" src="${artFor(tracks[2])}" alt="">`,
      "Into the evergreens",
      "1 song · Take the long way home",
      'data-collection="forest"',
    ) +
    (state.playlist.length
      ? playlistRow(
          `<span class="playlist-art liked-art">${icon("PlaylistAdd")}</span>`,
          "My evening",
          `${state.playlist.length} songs · Your own collection`,
          'data-collection="mine"',
        )
      : "")
  );
}
function albumRows() {
  return `<div class="album-grid">${albumTile(tracks[0], tracks[0].album, tracks[0].artist, "dream")}${albumTile(tracks[1], tracks[1].album, tracks[1].artist, "blue")}${albumTile(tracks[2], tracks[2].album, tracks[2].artist, "forest")}</div>`;
}
function libraryRows() {
  if (state.libraryFilter === "albums") return albumRows();
  if (state.libraryFilter === "playlists") return playlistRows();
  return `<section class="library-section" aria-label="Your playlists"><div class="section-heading"><h2>Playlists</h2></div>${playlistRows()}</section><section class="library-section" aria-label="Your albums"><div class="section-heading"><h2>Albums</h2></div>${albumRows()}</section>`;
}
function library() {
  return `<section class="browse-screen" aria-label="Your library"><div class="browse-content"><header class="browse-header"><div><small>Your playlists and albums</small><h1>Your library.</h1></div>${browseActions()}</header><div class="filter-pills" aria-label="Library filters">${["all", "playlists", "albums"].map((name) => `<button data-filter="${name}" aria-pressed="${state.libraryFilter === name}">${name[0].toUpperCase() + name.slice(1)}</button>`).join("")}</div><div id="library-results">${libraryRows()}</div></div>${miniPlayer()}${bottomNav()}</section>`;
}
function songSearchResults() {
  const query = state.search.trim().toLowerCase();
  const matches = tracks.filter((t) =>
    `${t.title} ${t.artist}`.toLowerCase().includes(query),
  );
  const label = query
    ? `${matches.length} ${matches.length === 1 ? "song" : "songs"} found`
    : "All songs";
  return `<p class="library-count" role="status">${label}</p>${matches.length ? matches.map(trackRow).join("") : `<div class="empty-state">${icon("Search")}No songs found.<br>Try another song title or artist.</div>`}`;
}
function searchScreen() {
  return `<section class="browse-screen" aria-label="Song search"><div class="browse-content"><header class="browse-header"><div><small>Find a song you want to hear</small><h1>Search.</h1></div>${browseActions()}</header><label class="search-field">${icon("Search")}<input type="search" id="song-search" value="${escape(state.search)}" placeholder="Search songs or artists" aria-label="Search songs" autocomplete="off"></label><div id="song-search-results">${songSearchResults()}</div></div>${miniPlayer()}${bottomNav()}</section>`;
}

const collectionMap = {
  evening: {
    title: "The evening edit",
    subtitle: "Dream pop, quiet skies, and you.",
    ids: tracks.map((t) => t.id),
    art: tracks[0].art,
  },
  blue: {
    title: "Blue hour",
    subtitle: "A little further from the noise.",
    ids: ["violet", "blue"],
    art: tracks[1].art,
  },
  forest: {
    title: "Into the evergreens",
    subtitle: "Take the long way home.",
    ids: ["eternal"],
    art: tracks[2].art,
  },
  dream: {
    title: "Somewhere, softly",
    subtitle: "Aurora Lights",
    ids: ["dreamscape", "slow"],
    art: tracks[0].art,
  },
};
function getCollection() {
  if (state.collection === "liked")
    return {
      title: "Liked songs",
      subtitle: "A little more you.",
      ids: state.favorites,
      art: tracks[0].art,
    };
  if (state.collection === "mine")
    return {
      title: "My evening",
      subtitle: "Your own little collection.",
      ids: state.playlist,
      art: tracks[0].art,
    };
  return collectionMap[state.collection] || collectionMap.evening;
}
function collection() {
  const c = getCollection();
  return `<section class="browse-screen" aria-label="${c.title}"><div class="browse-content"><header class="mobile-header">${button("ArrowBack", "Back to library", "back")}<div class="header-identity"><span>${state.collection === "dream" ? "ALBUM" : "PLAYLIST"}</span></div>${button("More", "Playlist details", "collection-info")}</header><div class="collection-header"><img src="${collectionArt(c)}" alt="${c.title} artwork"><h2>${c.title}</h2><p>${c.subtitle} · ${c.ids.length} ${c.ids.length === 1 ? "song" : "songs"}</p></div>${c.ids.length ? `<div class="collection-actions"><button class="primary-pill" data-action="play-collection">${icon("Play")} Play</button>${button("Shuffle", "Shuffle playlist", "shuffle-collection")}</div>` : ""}${c.ids.length ? c.ids.map((id) => trackRow(tracks.find((t) => t.id === id))).join("") : `<div class="empty-state">${icon("Heart")}Your favorites belong here.<br>Tap a heart to keep a song close.</div>`}</div>${miniPlayer()}${bottomNav()}</section>`;
}
function collectionArt(c) {
  return state.template === "cupid"
    ? artFor(tracks.find((t) => t.id === c.ids[0]) || tracks[0])
    : c.art;
}
function kit() {
  const glass = state.template === "rosemary";
  const names = glass
    ? rosemaryIconNames
    : state.template === "cupid"
      ? [...rosemaryIconNames, "Sun", "Moon"]
      : [
          "Heart",
          "Shuffle",
          "Repeat",
          "QueueMusic",
          "Equalizer",
          "Lyrics",
          "Settings",
          "Headphones",
          "Home",
          "Library",
        ];
  return `<section class="kit-content" aria-label="Component kit"><header class="mobile-header">${button("ArrowBack", "Back to player", "expand")}<div class="header-identity"><span>The component kit</span><small>${tokens.templates[state.template].name.toUpperCase()}</small></div>${button("Palette", "Choose a template", "themes")}</header><p class="kit-intro">${glass ? "A little chrome. A deeper kind of glass.<br>Original icons, made for Aftertone." : "The little things that make the whole.<br>Every control here works just like the player."}</p><div class="kit-label">01 / ARTWORK SURFACE <span>${state.template === "cupid" ? "Pixel paper frame" : "24 dp radius"}</span></div><div class="kit-art-row"><img src="${artFor(currentTrack(state))}" alt="Album artwork component"><p>A luminous rim.<br>Soft elevation.<br>The music in focus.</p></div><div class="kit-label">02 / TRACK & TIMELINE <span>${state.template === "cupid" ? "Lovebit / Geist Mono" : "Manrope"}</span></div><div class="kit-card glass">${trackIdentity()}${scrubber()}</div><div class="kit-label">03 / TRANSPORT <span>${state.template === "cupid" ? "Beveled keys" : "80 dp primary"}</span></div><div class="kit-card glass">${transport()}</div><div class="kit-label">04 / UTILITY DOCK <span>${state.template === "cupid" ? "Pixel toolbar" : glass ? "Polished smoke" : "Frosted glass"}</span></div>${utilityDock()}<div class="kit-label">05 / COMPACT PLAYER <span>Shared playback state</span></div>${miniPlayer()}<div class="kit-label">06 / ICON FAMILY <span>${state.template === "cupid" ? "36 original pixel icons" : glass ? "34 original glass vectors" : "Existing Android SVGs"}</span></div><div class="icon-grid">${names.map((name) => `<div>${icon(name)}<small>${name.replace(/([a-z])([A-Z])/g, "$1 $2")}</small></div>`).join("")}</div><div class="kit-label">07 / COLOR STORIES <span>${state.template === "cupid" ? "Light & dark" : "Three ways to feel it"}</span></div><div class="kit-palette-row">${Object.entries(
    tokens.palettes,
  )
    .filter(([key]) => tokens.templates[state.template].palettes.includes(key))
    .map(
      ([key, p]) =>
        `<button data-palette="${key}" aria-pressed="${key === state.palette}"><span class="palette-swatch" style="background:${paletteBackground(p)}"></span>${p.name}</button>`,
    )
    .join(
      "",
    )}</div><p class="kit-bottom-note">${glass ? "Original glass icons, in orb and soft-square silhouettes.<br>Reference files remain in your Wallpaper folder." : "Reusable icons, type, and layout.<br>Theme, spacing, and shapes are ready for the next step."}</p></section>`;
}

function render() {
  const sameView = screen.dataset.view === state.screen;
  const scrollTop =
    screen.querySelector(".browse-content,.kit-content")?.scrollTop || 0;
  screen.innerHTML = (
    {
      player,
      home,
      search: searchScreen,
      library,
      collection,
      components: kit,
      icons: iconGallery,
    }[state.screen] || player
  )();
  screen.dataset.view = state.screen;
  if (sameView) {
    const scrollable = screen.querySelector(".browse-content,.kit-content");
    if (scrollable) scrollable.scrollTop = scrollTop;
  }
  phone.classList.toggle("is-playing", state.playing);
  document
    .querySelectorAll(".preview-nav [data-screen]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.screen === state.screen)),
    );
  renderSheet();
  syncRuntime();
}
function go(next) {
  state.sheet = null;
  if (["home", "search", "library"].includes(state.screen))
    state.lastScreen = state.screen;
  state.screen = next;
  render();
}
function openSheet(name) {
  state.sheet = name;
  renderSheet();
}
let sheetReturnFocus;
function closeSheet() {
  state.sheet = null;
  renderSheet();
  sheetReturnFocus?.focus();
}
function sheet(title, subtitle, content) {
  return `<div class="sheet-backdrop"><button class="sheet-dismiss" data-action="close" aria-label="Close ${title}"></button><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><span class="sheet-handle" aria-hidden="true"></span><header class="sheet-header"><div><h2 id="sheet-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${button("Close", "Close panel", "close")}</header><div class="sheet-content">${content}</div></section></div>`;
}
const settingsRow = (name, title, detail, action, trailing = "") =>
  `<button class="settings-row" data-action="${action}">${icon(name)}<span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ""}</span><span class="trailing">${trailing}${icon("ChevronRight")}</span></button>`;
const presets = {
  Balanced: [0, 0, 0, 0, 0],
  Dreamy: [3, 1, -1, 2, 4],
  Warm: [4, 3, 1, -1, -2],
  Vocal: [-2, 0, 4, 3, 0],
};
function renderSheet() {
  const t = currentTrack(state);
  const wasOpen = !!sheetLayer.firstElementChild;
  const active = sheetLayer.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusKey = active
    ? [
        "action",
        "preset",
        "remove",
        "track",
        "palette",
        "sleep",
        "eq",
        "template",
        "shape",
      ].find((key) => active.dataset[key] !== undefined)
    : null;
  const focusValue = focusKey ? active.dataset[focusKey] : null;
  if (!state.sheet) {
    sheetLayer.innerHTML = "";
    screen.inert = false;
    document.querySelector(".status-bar").inert = false;
    return;
  }
  if (!wasOpen) sheetReturnFocus = document.activeElement;
  screen.inert = true;
  let content;
  if (state.sheet === "themes") {
    content = sheet(
      "Your templates",
      "Different worlds. The same music.",
      templateCards() +
        `<button class="template-icon-link" data-action="icon-gallery">${icon("Song")}<span>Explore the full icon family</span>${icon("ChevronRight")}</button><p class="sheet-footnote">Switch the whole look while your song stays with you. Each template remembers its own color story.</p>`,
    );
  } else if (state.sheet === "queue") {
    const remaining = state.queue.filter((id) => id !== t.id);
    content = sheet(
      "Your queue",
      "The evening edit · Your next little escape",
      `<p class="sheet-section-label">Playing now</p><div class="queue-now glass"><img src="${artFor(t)}" alt=""><span><strong>${t.title}</strong><small>${t.artist}</small></span>${wave()}</div><div class="sheet-action-row"><span class="sheet-section-label">${state.shuffle ? "Shuffle is on" : "In this mix"} · ${remaining.length} songs</span><button class="text-button" data-action="reset-queue">Reset</button></div>${
        remaining
          .map((id) => {
            const track = tracks.find((x) => x.id === id);
            return `<div class="queue-row">${trackRow(track)}<button class="icon-button" data-remove="${id}" aria-label="Remove ${track.title} from queue">${icon("Remove")}</button></div>`;
          })
          .join("") ||
        '<p class="empty-state">Just this song, for now.<br>Reset to bring the mix back.</p>'
      }<p class="sheet-footnote">Tap a song to play it. Use − to remove it from this demo queue.</p>`,
    );
  } else if (state.sheet === "lyrics") {
    content = sheet(
      "In the words",
      `${t.title} · ${t.artist}`,
      `<p class="lyrics-intro">SAMPLE LYRICS · DESIGN PREVIEW</p><div class="lyrics-lines"><p class="previous">The sky is turning<br>violet again</p><p class="current">And all the quiet<br>feels like a friend</p><p>So let the world<br>move a little slow</p><p>There's nowhere else<br>we need to go</p></div><p class="lyrics-timing">${icon("Lyrics")}Sample text for the lyrics layout</p>`,
    );
  } else if (state.sheet === "equalizer") {
    content = sheet(
      "Make it yours",
      "A little warmth. A little more space.",
      `<p class="sheet-section-label">Sound profile</p><div class="preset-pills">${Object.keys(
        presets,
      )
        .map(
          (p) =>
            `<button data-preset="${p}" aria-pressed="${p === state.eqPreset}">${p}</button>`,
        )
        .join(
          "",
        )}</div><div class="eq-chart">${[60, 250, "1k", "4k", "16k"].map((hz, i) => `<div class="eq-band"><output id="eq-value-${i}">${state.eq[i] > 0 ? "+" : ""}${state.eq[i]} dB</output><input type="range" data-eq="${i}" aria-label="Equalizer ${hz} Hz" min="-6" max="6" value="${state.eq[i]}" aria-valuetext="${state.eq[i]} decibels"><label>${hz}</label></div>`).join("")}</div><div class="sheet-action-row"><span style="font-size:10px;color:var(--muted)">Profile: <span id="eq-profile">${state.eqPreset}</span></span><button class="text-button" data-preset="Balanced">Reset</button></div><p class="sheet-footnote">Visual sound controls for this prototype. Audio processing will use the Android app's existing equalizer.</p>`,
    );
  } else if (state.sheet === "settings") {
    content = sheet(
      "Your listening room",
      "Little details. Your kind of atmosphere.",
      (state.template === "cupid"
        ? settingsRow(
            "Moon",
            "Dark mode",
            state.palette === "cupidnight"
              ? "On · Moonlight"
              : "Off · Daydream",
            "cupid-mode",
          )
        : "") +
        settingsRow(
          "Palette",
          "Template",
          tokens.templates[state.template].name,
          "themes",
        ) +
        settingsRow(
          "Palette",
          "Color story",
          tokens.palettes[state.palette].name,
          "appearance",
        ) +
        settingsRow("Equalizer", "Sound profile", state.eqPreset, "equalizer") +
        settingsRow(
          "Timer",
          "Sleep timer",
          state.sleepMinutes
            ? `${state.sleepMinutes} minutes · Timer is running`
            : "Let the music drift off with you",
          "sleep",
        ) +
        settingsRow("Headphones", "Listening on", "This phone", "output") +
        `<p class="sheet-footnote">Aftertone / ${tokens.templates[state.template].name} / ${tokens.templates[state.template].number}<br>Demo tracks and simulated playback for reviewing the interface.</p>`,
    );
  } else if (state.sheet === "appearance") {
    content = sheet(
      "Find your shade",
      "Same feeling. A different kind of light.",
      `<div class="sheet-palette-options">${Object.entries(tokens.palettes)
        .filter(([key]) =>
          tokens.templates[state.template].palettes.includes(key),
        )
        .map(
          ([key, p]) =>
            `<button class="sheet-palette" data-palette="${key}" aria-pressed="${state.palette === key}"><span class="palette-preview" style="background:${paletteBackground(p)}"></span><span><strong>${p.name}</strong><small>${{ dusk: "Soft violet, pink skies, a little stardust", rose: "A warmer glow for your softer side", moon: "Cool air, quiet water, open skies", roseglass: "Black cherry, rose light, icy cyan", violetglass: "Amethyst smoke and polished silver", champagne: "Warm pearl, blush light, a soft glint", cupidday: "Cream paper, blush borders, a rose-lit room", cupidnight: "Plum paper, soft rose, a moonlit room" }[key]}</small></span>${state.palette === key ? icon("Check") : ""}</button>`,
        )
        .join(
          "",
        )}</div><p class="sheet-footnote">The color story follows you through the player, library, compact player, and every sheet.</p>`,
    );
  } else if (state.sheet === "options") {
    content = sheet(
      t.title,
      t.artist,
      (state.template === "cupid"
        ? settingsRow(
            "Shuffle",
            "Shuffle",
            state.shuffle ? "On" : "Off",
            "shuffle",
          ) +
          settingsRow(
            "Repeat",
            "Repeat",
            { off: "Off", all: "Repeat the mix", one: "Repeat this song" }[
              state.repeat
            ],
            "repeat",
          )
        : "") +
        settingsRow(
          "Heart",
          liked() ? "Remove from liked songs" : "Add to liked songs",
          "Keep this one close",
          "favorite",
        ) +
        settingsRow(
          "PlaylistAdd",
          "Add to My evening",
          "Your personal demo playlist",
          "add-playlist",
        ) +
        settingsRow("Album", "Go to album", t.album, "album") +
        settingsRow(
          "QueueMusic",
          "Open queue",
          "See what comes next",
          "queue",
        ) +
        settingsRow(
          "Timer",
          "Sleep timer",
          "Drift off on your own time",
          "sleep",
        ),
    );
  } else if (state.sheet === "sleep") {
    content = sheet(
      "Drift off, softly",
      "Pause the music when the moment is right.",
      `<div class="sleep-options">${[5, 15, 30, 60].map((n) => `<button data-sleep="${n}" aria-pressed="${state.sleepMinutes === n}">${n} minutes</button>`).join("")}</div>${state.sleepMinutes ? `<button class="text-button" data-action="cancel-sleep">Cancel timer</button>` : ""}<p class="sheet-footnote">The timer pauses this demo's playback, even while you browse other screens.</p>`,
    );
  } else if (state.sheet === "output") {
    content = sheet(
      "Listening on",
      "A little space, just for your music.",
      `<div class="settings-row">${icon("Speaker")}<span><strong>This phone</strong><small>Selected output for this preview</small></span><span class="trailing">${icon("Check")}</span></div>${volumeControl()}<p class="sheet-footnote">Device discovery will connect to the Android app's existing audio and casting controls.</p>`,
    );
  } else if (state.sheet === "collection-info") {
    const c = getCollection();
    content = sheet(
      c.title,
      "Your little collection",
      `<p class="sheet-footnote" style="margin:0;border:0;padding:5px 0 20px">${c.subtitle}<br>${c.ids.length} songs · ${formatTime(c.ids.reduce((sum, id) => sum + tracks.find((t) => t.id === id).duration, 0))} total<br>Curated demo music for this design prototype.</p>`,
    );
  }
  sheetLayer.innerHTML = content || "";
  const sameControl = focusKey
    ? sheetLayer.querySelector(`[data-${focusKey}="${CSS.escape(focusValue)}"]`)
    : null;
  (sameControl || sheetLayer.querySelector(".sheet-header button"))?.focus();
}
function syncRuntime() {
  const t = currentTrack(state);
  phone.classList.toggle("is-playing", state.playing);
  screen.querySelectorAll('[data-action="play"]').forEach((b) => {
    const label = state.playing ? "Pause" : "Play";
    if (b.getAttribute("aria-label") !== label) {
      b.innerHTML = icon(state.playing ? "Pause" : "Play");
      b.setAttribute("aria-label", label);
      b.title = label;
    }
  });
  screen.querySelectorAll(".seek-range").forEach((r) => {
    if (document.activeElement !== r) r.value = Math.floor(state.position);
    r.style.setProperty("--fill", `${(state.position / t.duration) * 100}%`);
    r.setAttribute(
      "aria-valuetext",
      `${formatTime(state.position)} of ${formatTime(t.duration)}`,
    );
  });
  screen
    .querySelectorAll("[data-elapsed]")
    .forEach((el) => (el.textContent = formatTime(state.position)));
  screen
    .querySelectorAll(".mini-progress i")
    .forEach(
      (el) => (el.style.width = `${(state.position / t.duration) * 100}%`),
    );
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button,a");
  if (!target) return;
  if (target.matches(".wordmark")) {
    event.preventDefault();
    go("home");
    return;
  }
  if (target.dataset.template) {
    if (!selectTemplate(state, target.dataset.template)) return;
    const url = new URL(location.href);
    url.searchParams.set("template", state.template);
    history.replaceState(null, "", url);
    applyPalette();
    render();
    fitPreview();
    return;
  }
  if (target.dataset.shape) {
    if (!["orb", "squircle"].includes(target.dataset.shape)) return;
    state.iconShape = target.dataset.shape;
    applyPalette();
    render();
    return;
  }
  if (target.dataset.palette) {
    if (!selectPalette(state, target.dataset.palette)) return;
    applyPalette();
    if (state.template === "cupid" || state.screen === "components") render();
    else if (state.sheet) renderSheet();
    return;
  }
  if (target.dataset.screen) {
    go(target.dataset.screen);
    return;
  }
  if (target.dataset.highlight) {
    go("player");
    if (state.template === "cupid" && target.dataset.highlight === "volume") {
      openSheet("output");
      return;
    }
    const el = screen.querySelector(
      `[data-component="${target.dataset.highlight}"]`,
    );
    el?.classList.add("highlight-component");
    setTimeout(() => el?.classList.remove("highlight-component"), 1800);
    return;
  }
  if (target.dataset.track) {
    selectTrack(state, target.dataset.track);
    render();
    return;
  }
  if (target.dataset.collection) {
    state.collection = target.dataset.collection;
    go("collection");
    return;
  }
  if (target.dataset.filter) {
    if (!["all", "playlists", "albums"].includes(target.dataset.filter)) return;
    state.libraryFilter = target.dataset.filter;
    render();
    return;
  }
  if (target.dataset.remove) {
    state.queue = state.queue.filter((id) => id !== target.dataset.remove);
    renderSheet();
    return;
  }
  if (target.dataset.preset) {
    state.eqPreset = target.dataset.preset;
    state.eq = [...presets[state.eqPreset]];
    renderSheet();
    return;
  }
  if (target.dataset.sleep) {
    state.sleepMinutes = Number(target.dataset.sleep);
    state.sleepEndsAt = Date.now() + state.sleepMinutes * 60_000;
    closeSheet();
    notify(`Sleep timer set for ${state.sleepMinutes} minutes`);
    return;
  }
  const action = target.dataset.action;
  if (
    [
      "queue",
      "lyrics",
      "equalizer",
      "settings",
      "appearance",
      "options",
      "sleep",
      "output",
      "collection-info",
      "themes",
    ].includes(action)
  ) {
    openSheet(action);
    return;
  }
  switch (action) {
    case "cupid-mode":
      if (toggleCupidMode(state)) {
        applyPalette();
        render();
      }
      break;
    case "play":
      if (state.position >= currentTrack(state).duration) state.position = 0;
      state.playing = !state.playing;
      syncRuntime();
      break;
    case "previous":
      stepTrack(state, -1);
      render();
      break;
    case "next":
      stepTrack(state, 1);
      render();
      break;
    case "shuffle":
      state.shuffle = !state.shuffle;
      render();
      notify(
        state.shuffle
          ? "A little serendipity. Shuffle is on."
          : "Shuffle is off",
      );
      break;
    case "repeat":
      cycleRepeat(state);
      render();
      notify(
        {
          off: "Repeat is off",
          all: "Keep the whole mix going",
          one: "Keep this one a little longer",
        }[state.repeat],
      );
      break;
    case "favorite":
      toggleFavorite(state);
      save();
      render();
      notify(
        liked()
          ? "Kept close. Added to liked songs."
          : "Removed from liked songs",
      );
      break;
    case "close":
      closeSheet();
      break;
    case "minimize":
      go(state.lastScreen);
      break;
    case "expand":
      go("player");
      break;
    case "components":
      go("components");
      break;
    case "icon-gallery":
      go("icons");
      break;
    case "liked":
      state.collection = "liked";
      go("collection");
      break;
    case "back":
      go(state.lastScreen);
      break;
    case "album":
      state.collection = titlesToCollection();
      go("collection");
      break;
    case "search":
      go("search");
      screen.querySelector("#song-search")?.focus({ preventScroll: true });
      break;
    case "reset-queue":
      state.queue = tracks.map((t) => t.id);
      renderSheet();
      notify("The evening mix is back");
      break;
    case "mute":
      if (state.volume > 0) {
        state.previousVolume = state.volume;
        state.volume = 0;
      } else state.volume = state.previousVolume || 65;
      render();
      break;
    case "cancel-sleep":
      state.sleepMinutes = null;
      state.sleepEndsAt = null;
      closeSheet();
      notify("Sleep timer canceled");
      break;
    case "add-playlist":
      if (!state.playlist.includes(currentTrack(state).id))
        state.playlist.push(currentTrack(state).id);
      closeSheet();
      notify("Added to My evening in your library");
      break;
    case "play-collection":
    case "shuffle-collection": {
      const c = getCollection();
      if (!c.ids.length) break;
      state.queue = [...c.ids];
      state.shuffle = action === "shuffle-collection";
      selectTrack(
        state,
        c.ids[state.shuffle ? Math.floor(Math.random() * c.ids.length) : 0],
      );
      go("player");
      break;
    }
  }
});
function titlesToCollection() {
  return currentTrack(state).artist === "Aurora Lights"
    ? "dream"
    : currentTrack(state).id === "eternal"
      ? "forest"
      : "blue";
}
document.addEventListener("input", (event) => {
  const input = event.target;
  if (input.matches(".seek-range")) {
    seek(state, input.value);
    syncRuntime();
  }
  if (input.matches(".volume-range")) {
    state.volume = Number(input.value);
    if (state.volume) state.previousVolume = state.volume;
    document.querySelectorAll(".volume-range").forEach((r) => {
      r.value = state.volume;
      r.style.setProperty("--fill", `${state.volume}%`);
      r.setAttribute("aria-valuetext", `${state.volume} percent`);
    });
    document.querySelectorAll('[data-action="mute"]').forEach((b) => {
      b.innerHTML = icon(state.volume === 0 ? "VolumeOff" : "VolumeDown");
      b.setAttribute("aria-label", state.volume === 0 ? "Unmute" : "Mute");
      b.title = state.volume === 0 ? "Unmute" : "Mute";
    });
  }
  if (input.id === "song-search") {
    state.search = input.value;
    screen.querySelector("#song-search-results").innerHTML =
      songSearchResults();
  }
  if (input.dataset.eq !== undefined) {
    const i = Number(input.dataset.eq);
    state.eq[i] = Number(input.value);
    state.eqPreset = "Custom";
    document.querySelector(`#eq-value-${i}`).textContent =
      `${state.eq[i] > 0 ? "+" : ""}${state.eq[i]} dB`;
    input.setAttribute("aria-valuetext", `${state.eq[i]} decibels`);
    document.querySelector("#eq-profile").textContent = "Custom";
    document
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
  }
});
document.addEventListener("keydown", (event) => {
  if (!state.sheet) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [
      ...sheetLayer.querySelectorAll(".sheet button,.sheet input"),
    ].filter((el) => !el.disabled);
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
});
let previousTime = performance.now();
setInterval(() => {
  const now = performance.now(),
    before = currentTrack(state).id;
  tick(state, Math.min((now - previousTime) / 1000, 2));
  previousTime = now;
  if (state.sleepEndsAt && Date.now() >= state.sleepEndsAt) {
    state.playing = false;
    state.sleepMinutes = null;
    state.sleepEndsAt = null;
    notify("Sleep timer finished. Rest easy.");
  }
  if (before !== currentTrack(state).id) render();
  else syncRuntime();
}, 250);
applyPalette();
render();
fitPreview();
// Exposed read-only snapshot for browser verification, never an Android playback API.
window.aftertonePreview = {
  snapshot: () => structuredClone(state),
  ready: true,
};
