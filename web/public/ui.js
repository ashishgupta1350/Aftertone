export const $ = (id) => document.getElementById(id);
export function node(tag, text = "", className = "") {
  const el = document.createElement(tag);
  if (text !== "") el.textContent = text;
  if (className) el.className = className;
  return el;
}

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  library: '<path d="M4 5v14M8 5v14m4-14 4-1 4 14-4 1z"/>',
  heart: '<path d="M20.8 8.5c0 4.2-8.8 9.6-8.8 9.6S3.2 12.7 3.2 8.5a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7.3M3 5v6h6m3-3v5l3 2"/>',
  profile: '<circle cx="12" cy="8" r="3.3"/><path d="M5 20v-1.5a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5V20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3.2"/>',
  previous: '<path d="M6 5v14m12-13-10 6 10 6z" fill="currentColor"/>',
  next: '<path d="M18 5v14M6 6l10 6-10 6z" fill="currentColor"/>',
  shuffle: '<path d="M4 6h2c3 0 4 2 6 6s3 6 6 6h2m-4-3 4 3-4 3M4 18h2c2 0 3-1 4-2m4-8c1-1 2-2 4-2h2m-4-3 4 3-4 3"/>',
  repeat: '<path d="m17 2 4 4-4 4M4 11V8a2 2 0 0 1 2-2h15m-14 8-4 4 4 4m13-9v3a2 2 0 0 1-2 2H3"/>',
  repeatOne: '<path d="m17 2 4 4-4 4M4 10V8a2 2 0 0 1 2-2h15M7 14l-4 4 4 4m13-8v2a2 2 0 0 1-2 2H3m8-7 1-1v5"/>',
  volume: '<path d="M3 10h4l4-4v12l-4-4H3zm12-2a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 10h4l4-4v12l-4-4H3zm13 0 4 4m0-4-4 4"/>',
  lyrics: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 5h10M7 13h7"/>',
  queue: '<path d="M4 6h16M4 11h16M4 16h10m3-1 4 3-4 3z"/>',
  playlist: '<path d="M4 6h15M4 11h15M4 16h8m6-2v6m-3-3h6"/>',
  music: '<path d="M10 17V6l10-2v11M10 9l10-2"/><ellipse cx="7" cy="17.5" rx="3" ry="2"/><ellipse cx="17" cy="15.5" rx="3" ry="2"/>',
  ellipsis: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  remove: '<path d="m6 6 12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2 6m2-11v5h-5"/>',
  expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
};

export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("symbol");
  svg.innerHTML = paths[name] ?? paths.music;
  return svg;
}

export function button(text, action, className = "", symbol) {
  const el = node("button", text, className);
  el.type = "button";
  el.onclick = action;
  if (symbol) el.prepend(icon(symbol));
  return el;
}

export function iconButton(symbol, label, action, className = "") {
  const el = button("", action, "icon-btn " + className);
  setIcon(el, symbol, label);
  return el;
}

export function setIcon(el, symbol, label) {
  if (el.dataset.icon !== symbol) el.replaceChildren(icon(symbol));
  el.dataset.icon = symbol;
  if (label) {
    el.setAttribute("aria-label", label);
    el.title = label;
  }
}

export function artwork(image, song, lazy = true, sizes = "64px") {
  const source = song?.thumbnail;
  const video = song?.id ? "https://i.ytimg.com/vi/" + song.id + "/" : null;
  const albumSize = /^(https:\/\/[^/]+\.(?:googleusercontent|ggpht)\.com\/[^?=]+)=(?:w\d+-h\d+|s\d+)([^?]*)$/;
  const album = source?.match(albumSize);
  const resized = (width) => album[1] + "=w" + width + "-h" + width + album[2];
  const videoSize = video && (source?.startsWith(video) ||
    source?.startsWith("https://i.ytimg.com/vi_webp/" + song.id + "/"));
  const defaultVideo = video && video + "hqdefault.jpg";
  const albumFallbacks = album ? [544, 480, 226].map(resized) : [];
  const videoFallbacks = videoSize ? [video + "sddefault.jpg", defaultVideo] : [];
  const candidates = [...new Set([...albumFallbacks, ...videoFallbacks, source, defaultVideo, "/icon.png"].filter(Boolean))];
  image.alt = "";
  image.loading = lazy ? "lazy" : "eager";
  image.decoding = "async";
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.classList.remove("art-fallback");
  const fallback = (failed) => {
    let next = candidates.shift();
    while (next && next === failed) next = candidates.shift();
    next ||= "/icon.png";
    if (next === "/icon.png") {
      image.onerror = null;
      image.classList.add("art-fallback");
    }
    image.src = next;
  };
  image.onerror = () => {
    const failed = image.currentSrc || image.src;
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    fallback(failed);
  };
  if (album) {
    image.sizes = sizes;
    // Include YouTube Music's native cover sizes. Some intermediate sizes fail on valid covers.
    image.srcset = [60, 120, 226, 544, 1200].map((width) => resized(width) + " " + width + "w").join(", ");
    image.src = resized(544);
  } else if (videoSize || !source && video) {
    image.sizes = sizes;
    image.srcset = video + "mqdefault.jpg 320w, " + video + "hq720.jpg 1280w";
    image.src = video + "hqdefault.jpg";
  } else fallback();
  return image;
}
export const artist = (song) => song?.artists?.map(({ name }) => name).filter(Boolean).join(", ") || "Unknown artist";

export function trackMatches(song, query) {
  const value = query.trim().toLocaleLowerCase();
  return [song.title, artist(song), song.album?.title].some((entry) => entry?.toLocaleLowerCase().includes(value));
}

export function moveTrack(tracks, id, anchor, direction) {
  const from = tracks.findIndex((song) => song.id === id);
  if (from < 0 || id === anchor || !tracks.some((song) => song.id === anchor)) return;
  const [song] = tracks.splice(from, 1);
  tracks.splice(tracks.findIndex((track) => track.id === anchor) + (direction > 0 ? 1 : 0), 0, song);
}
