import { $, node, icon, button, iconButton, setIcon, artwork, artist, trackMatches, moveTrack } from "./ui.js";
import { createPlayer } from "./player.js";

const blank = () => ({ revision: 0, library: { likes: [], playlists: [], plays: [] } });
const topics = [
  ["hindi", "Hindi", "language"], ["english", "English", "language"],
  ["chill", "Chill", "mood"], ["workout", "Workout", "mood"], ["focus", "Focus", "mood"],
  ["indie", "Indie", "genre"], ["pop", "Pop", "genre"], ["rock", "Rock", "genre"], ["hiphop", "Hip-hop", "genre"],
];
let state = blank();
let user = null;
let signup = false;
let refresh;
let signingOut = false;
let routeVersion = 0;
let mutation = Promise.resolve();
let dialogAction;
let toastTimer;
let rotation = 0;
let queueOrder = null;
let pulling = false;
let pendingSync = false;
const feeds = new Map();
const collectionFilters = new Map();
const collectionLimits = new Map();

for (const el of document.querySelectorAll("[data-symbol]")) el.prepend(icon(el.dataset.symbol));

function say(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4500);
}

function raw(path, body) {
  return fetch("/api/" + path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
async function api(path, body, retry = true) {
  const response = await raw(path, body);
  if (response.status === 401 && retry && !["login", "signup", "refresh"].includes(path)) {
    refresh ??= raw("refresh", {}).finally(() => { refresh = null; });
    if ((await refresh).ok && !signingOut) return api(path, body, false);
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok || path === "state" && response.status === 409) return { data, status: response.status };
  const message = data?.error || "Aftertone is temporarily unavailable.";
  if (user && (response.status === 401 || response.status === 403 && message.toLowerCase().includes("disabled"))) showLogin(message);
  throw new Error(message);
}

function showLogin(message = "") {
  routeVersion++;
  user = null;
  player.reset();
  state = blank();
  feeds.clear();
  collectionFilters.clear();
  collectionLimits.clear();
  pendingSync = false;
  rotation = 0;
  queueOrder = null;
  $("sidebar").hidden = $("top").hidden = $("main").hidden = true;
  $("main").replaceChildren();
  $("side-playlists").replaceChildren();
  $("profile").open = false;
  $("query").value = "";
  if ($("dialog").open) $("dialog").close();
  $("login").hidden = false;
  $("auth-error").textContent = message;
}

async function openAccount() {
  const account = (await api("me")).data;
  const initial = (await api("state")).data;
  user = account;
  signingOut = false;
  state = initial;
  $("login").hidden = true;
  $("sidebar").hidden = $("top").hidden = $("main").hidden = false;
  $("admin-link").hidden = !user.admin;
  player.restore(user.uid);
  render();
}

$("credentials").onsubmit = async (event) => {
  event.preventDefault();
  $("auth-error").textContent = "";
  $("submit").disabled = true;
  try {
    await api(signup ? "signup" : "login", { id: $("username").value, password: $("password").value });
    $("password").value = "";
    await openAccount();
  } catch (error) { $("auth-error").textContent = error.message; }
  finally { $("submit").disabled = false; }
};
$("change-mode").onclick = () => {
  signup = !signup;
  $("auth-title").textContent = signup ? "Create your account" : "Sign in to Aftertone";
  $("submit").textContent = signup ? "Create account" : "Sign in";
  $("change-mode").textContent = signup ? "Back to sign in" : "Create an account";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("password").minLength = signup ? 8 : 1;
  $("auth-error").textContent = "";
};
$("signout").onclick = async () => {
  if (signingOut || $("signout").disabled) return;
  $("signout").disabled = true;
  player.save();
  player.listen(true);
  await mutation.catch(() => {});
  signingOut = true;
  try {
    await refresh?.catch(() => {});
    await api("logout", {}, false);
    history.replaceState(null, "", "/");
    showLogin();
  } catch (error) { signingOut = false; say(error.message); }
  finally { $("signout").disabled = false; }
};

function edit(change, { redraw = true, focus } = {}) {
  const owner = user?.uid;
  const operation = mutation.then(async () => {
    if (!owner || user?.uid !== owner || signingOut) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      const base = state;
      const library = structuredClone(base.library);
      change(library);
      const { data, status } = await api("state", { revision: base.revision, library });
      if (user?.uid !== owner) return;
      if (data.revision >= state.revision) state = data;
      if (status === 200) {
        player.paintLike();
        if (redraw) {
          render();
          if (focus) requestAnimationFrame(() => $(focus)?.focus());
        }
        return;
      }
    }
    throw new Error("The library changed on another device. Try again.");
  });
  mutation = operation.catch((error) => { if (owner === user?.uid) say(error.message); });
  return operation;
}

const liked = (song) => state.library.likes.some((row) => row.song.id === song.id);
function toggleLike(song) {
  const on = !liked(song);
  const at = Date.now();
  edit((library) => {
    library.likes = library.likes.filter((row) => row.song.id !== song.id);
    if (on) library.likes.unshift({ song, at });
  }).catch(() => {});
}
const player = createPlayer({
  api, say, liked, toggleLike, addToPlaylist: addDialog,
  record: (play) => edit((library) => {
    const previous = library.plays.find((row) => row.at === play.at && row.song.id === play.song.id);
    const row = previous?.ms > play.ms ? previous : play;
    library.plays = [row, ...library.plays.filter((entry) => entry.at !== play.at || entry.song.id !== play.song.id)].slice(0, 3000);
  }, { redraw: false }),
});

function openDialog(title, fields, action, save = "Save") {
  $("dialog-title").textContent = title;
  $("playlist-fields").replaceChildren(...fields);
  $("dialog-error").textContent = "";
  $("save-dialog").disabled = false;
  $("save-dialog").textContent = save;
  dialogAction = action;
  if (!$("dialog").open) $("dialog").showModal();
}
$("cancel").onclick = () => $("dialog").close();
$("playlist-form").onsubmit = async (event) => {
  event.preventDefault();
  if ($("save-dialog").disabled) return;
  $("save-dialog").disabled = true;
  $("dialog-error").textContent = "";
  try {
    if (await dialogAction?.() !== false) $("dialog").close();
  } catch (error) { $("dialog-error").textContent = error.message; }
  finally { $("save-dialog").disabled = false; }
};
function playlistName(existing) {
  const label = node("label", "Playlist name", "field");
  const input = node("input");
  input.required = true;
  input.maxLength = 160;
  input.value = existing || "";
  label.append(input);
  return [label, input];
}
function newPlaylist(song) {
  const [label, input] = playlistName();
  openDialog("New playlist", [label], async () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return false; }
    const id = "prism:" + crypto.randomUUID().replaceAll("-", "");
    await edit((library) => library.playlists.unshift({ id, name, songs: song ? [song] : [] }));
    if (!song) location.hash = "playlist=" + encodeURIComponent(id);
    else say("Added to " + name + ".");
  }, "Create");
}
function addDialog(song) {
  if (!state.library.playlists.length) return newPlaylist(song);
  const label = node("label", "Playlist", "field");
  const select = node("select");
  for (const playlist of state.library.playlists) {
    const option = node("option", playlist.name);
    option.value = playlist.id;
    select.append(option);
  }
  label.append(select);
  const create = button("Create a playlist", () => newPlaylist(song), "quiet", "plus");
  openDialog("Add to playlist", [label, create], async () => {
    const id = select.value;
    let name;
    let already;
    await edit((library) => {
      const list = library.playlists.find((row) => row.id === id);
      if (!list) throw new Error("That playlist is unavailable.");
      name = list.name;
      already = list.songs.some((track) => track.id === song.id);
      if (!already) list.songs.push(song);
    });
    say(already ? "Already in " + name + "." : "Added to " + name + ".");
  }, "Add");
}
$("new-sidebar").onclick = () => newPlaylist();

function link(text, href, className, symbol) {
  const a = node("a", text, className);
  a.href = href;
  if (symbol) a.prepend(icon(symbol));
  return a;
}
const playlistLink = (id) => "#playlist=" + encodeURIComponent(id);

function more(song, options = {}) {
  const details = node("details", "", "row-menu");
  const trigger = node("summary", "", "icon-btn");
  trigger.setAttribute("aria-label", "More options for " + song.title);
  trigger.append(icon("ellipsis"));
  const menu = node("div", "", "popover");
  function action(label, symbol, run) {
    menu.append(button(label, () => { details.open = false; run(); }, "", symbol));
  }
  action("Play next", "next", () => player.add(song, true));
  action("Add to queue", "queue", () => player.add(song));
  action(liked(song) ? "Unlike song" : "Like song", "heart", () => toggleLike(song));
  action("Add to playlist", "playlist", () => addDialog(song));
  if (options.playlist) action("Remove from playlist", "remove", () => edit((library) => {
    const target = library.playlists.find((row) => row.id === options.playlist);
    if (target) target.songs = target.songs.filter((track) => track.id !== song.id);
  }).catch(() => {}));
  details.append(trigger, menu);
  return details;
}

function trackCover(song, tracks, eager = false) {
  const play = button("", () => player.play(song, tracks), "track-cover");
  play.setAttribute("aria-label", "Play " + song.title);
  const frame = node("span", "", "cover-play");
  frame.append(icon("play"));
  play.append(artwork(node("img"), song, !eager), frame);
  return play;
}
function likeButton(song) {
  const on = liked(song);
  const el = iconButton("heart", on ? "Unlike " + song.title : "Like " + song.title, () => toggleLike(song), "like-control");
  el.setAttribute("aria-pressed", String(on));
  return el;
}
function songGrid(songs) {
  const grid = node("div", "", "song-grid");
  songs.forEach((song) => {
    const card = node("article", "", "song-card");
    const caption = node("div", "", "song-caption");
    const copy = node("div", "", "track-copy");
    const title = button(song.title, () => player.play(song, songs), "track-title");
    title.title = song.title;
    copy.append(title, node("span", artist(song)));
    caption.append(copy, more(song));
    card.append(trackCover(song, songs), caption);
    grid.append(card);
  });
  return grid;
}
function songRows(songs, options = {}) {
  if (!songs.length) return empty(options.empty || "No songs here yet.", "music");
  const list = node("ol", "", "song-rows");
  songs.slice(0, options.limit).forEach((song, i) => {
    const row = node("li", "", "song-row");
    const copy = node("div", "", "track-copy");
    const title = button(song.title, () => player.play(song, songs), "track-title");
    title.title = song.title;
    copy.append(title, node("span", artist(song)));
    const tools = node("div", "", "row-actions");
    if (options.reorder) {
      for (const [symbol, change] of [["up", -1], ["down", 1]]) {
        const anchor = songs[i + change];
        const label = "Move " + song.title + (change < 0 ? " up" : " down");
        const id = "move-" + symbol + "-" + song.id;
        const move = iconButton(symbol, label, () => {
          const fallback = change < 0 && i === 1 ? "down" : change > 0 && i === songs.length - 2 ? "up" : symbol;
          if (change > 0 && i + 1 === options.limit) collectionLimits.set(options.playlist, options.limit + 60);
          edit((library) => {
            const target = library.playlists.find(({ id }) => id === options.playlist);
            if (target && anchor) moveTrack(target.songs, song.id, anchor.id, change);
          }, { focus: "move-" + fallback + "-" + song.id }).catch(() => {});
        });
        move.id = id;
        move.disabled = !anchor;
        tools.append(move);
      }
    } else tools.append(likeButton(song));
    tools.append(more(song, options));
    row.append(trackCover(song, songs), copy);
    if (options.albums) row.append(node("span", song.album?.title || "", "row-album"));
    row.append(tools);
    list.append(row);
  });
  return list;
}

function section(title, content, action) {
  const panel = node("section", "", "shelf");
  const header = node("div", "", "section-head");
  header.append(node("h2", title));
  if (action) header.append(action);
  panel.append(header, content);
  return panel;
}
function pageTitle(title, action) {
  const header = node("header", "", "page-heading");
  header.append(node("h1", title));
  if (action) header.append(action);
  return header;
}
function empty(message, symbol = "music", action) {
  const panel = node("div", "", "empty");
  panel.append(icon(symbol), node("p", message));
  if (action) panel.append(action);
  return panel;
}
function featured(song, songs, label) {
  const banner = node("section", "", "featured");
  const background = artwork(node("img", "", "feature-glow"), song, false);
  const copy = node("div", "", "feature-copy");
  copy.append(node("p", label, "eyebrow"), node("h2", song.title), node("p", artist(song), "feature-artist"));
  const actions = node("div", "", "inline-actions");
  actions.append(button("Play now", () => player.play(song, songs), "accent", "play"),
    iconButton("queue", "Add to queue", () => player.add(song), "glass-button"));
  copy.append(actions);
  banner.append(background, copy, artwork(node("img", "", "feature-art"), song, false));
  return banner;
}

function playlistTile(playlist) {
  const tile = link("", playlistLink(playlist.id), "playlist-tile");
  const frame = node("span", "", "playlist-thumb");
  if (playlist.songs.length) {
    const songs = playlist.songs.slice(0, 4);
    if (songs.length < 4) songs.splice(1);
    frame.classList.toggle("collage", songs.length === 4);
    for (const song of songs) frame.append(artwork(node("img"), song));
  } else frame.append(icon("playlist"));
  const copy = node("span", "", "track-copy");
  copy.append(node("strong", playlist.name), node("span", playlist.songs.length + (playlist.songs.length === 1 ? " song" : " songs")));
  tile.append(frame, copy, icon("arrow"));
  return tile;
}
function playlistGrid(playlists) {
  if (!playlists.length) return empty("Create a playlist or add a song to get started.", "playlist", button("New playlist", () => newPlaylist(), "quiet", "plus"));
  const list = node("div", "", "playlist-grid");
  for (const listItem of playlists) list.append(playlistTile(listItem));
  return list;
}
function sidePlaylists(route, key) {
  const container = $("side-playlists");
  container.replaceChildren();
  for (const list of state.library.playlists.slice(0, 8)) {
    const a = link(list.name, playlistLink(list.id), "side-link", "playlist");
    a.title = list.name;
    if (route === "playlist" && key === list.id) a.setAttribute("aria-current", "page");
    container.append(a);
  }
  for (const a of $("sidebar").querySelectorAll(".sidebar-library > a")) {
    if (a.hash === "#" + route) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function collection(title, songs, { key, options, action, cover, count = true } = {}) {
  const panel = node("div", "", "collection");
  if (cover) {
    const intro = node("div", "", "collection-intro");
    const copy = node("div", "", "collection-copy");
    copy.append(node("h1", title));
    if (count) copy.append(node("p", songs.length + (songs.length === 1 ? " song" : " songs")));
    if (action) copy.append(action);
    intro.append(cover, copy);
    panel.append(intro);
  } else panel.append(pageTitle(title, action));
  const filter = node("input", "", "collection-search");
  filter.type = "search";
  filter.maxLength = 150;
  filter.setAttribute("aria-label", "Search " + title);
  filter.placeholder = "Search this collection";
  filter.value = collectionFilters.get(key) || "";
  const controls = node("div", "", "collection-controls");
  if (songs.length) controls.append(filter);
  const rows = node("div");
  function draw() {
    const query = filter.value.trim();
    collectionFilters.set(key, filter.value);
    const visible = query ? songs.filter((song) => trackMatches(song, query)) : songs;
    const limit = collectionLimits.get(key) || 60;
    rows.replaceChildren(songRows(visible, {
      ...options, limit, reorder: options?.reorder && !query, albums: true,
      empty: query ? "No songs match your search." : options?.empty,
    }));
    if (visible.length > limit) {
      rows.append(button("Show more songs", () => {
        collectionLimits.set(key, limit + 60);
        draw();
        rows.querySelectorAll(".track-title")[limit]?.focus();
      }, "quiet collection-more", "down"));
    }
  }
  filter.oninput = () => { collectionLimits.delete(key); draw(); };
  draw();
  panel.append(controls, rows);
  return panel;
}

function playlistPage(main, key) {
  const playlist = state.library.playlists.find(({ id }) => id === key);
  if (!playlist) { main.append(pageTitle("Playlist unavailable"), link("Go to Library", "#library", "quiet")); return; }
  const actions = node("div", "", "inline-actions");
  if (playlist.songs.length) actions.append(button("Play", () => player.play(playlist.songs[0], playlist.songs), "accent", "play"));
  if (playlist.songs.length > 1) actions.append(button(queueOrder === key ? "Done" : "Reorder", () => {
    queueOrder = queueOrder === key ? null : key;
    if (queueOrder) collectionFilters.delete(key);
    render();
  }, "quiet", "queue"));
  actions.append(button("Rename", () => {
    const [label, input] = playlistName(playlist.name);
    openDialog("Rename playlist", [label], async () => {
      const name = input.value.trim();
      if (!name) return false;
      await edit((library) => {
        const match = library.playlists.find(({ id }) => id === key);
        if (match) match.name = name;
      });
    });
  }, "quiet"));
  actions.append(button("Delete", () => openDialog("Delete playlist?", [node("p", playlist.name)], async () => {
    await edit((library) => { library.playlists = library.playlists.filter(({ id }) => id !== key); });
    location.hash = "playlists";
  }, "Delete"), "quiet"));
  const cover = node("div", "", "collection-art");
  if (playlist.songs.length) cover.append(artwork(node("img"), playlist.songs[0], false));
  else cover.append(icon("playlist"));
  main.append(collection(playlist.name, playlist.songs, { key, cover, action: actions,
    options: { playlist: key, reorder: queueOrder === key, empty: "Add a song to start this playlist." } }));
}

function libraryTabs(route) {
  const tabs = node("nav", "", "segmented library-tabs");
  tabs.setAttribute("aria-label", "Library sections");
  for (const [key, label] of [["library","Overview"], ["likes","Liked songs"], ["playlists","Playlists"], ["history","History"]]) {
    const item = link(label, "#" + key);
    if (key === route) item.setAttribute("aria-current", "page");
    tabs.append(item);
  }
  return tabs;
}
function libraryPage(main, route) {
  const { likes, playlists, plays } = state.library;
  main.append(libraryTabs(route));
  if (route === "likes" || route === "history") {
    const isLikes = route === "likes";
    const songs = (isLikes ? likes : plays).map(({ song }) => song);
    const cover = node("div", "", isLikes ? "collection-art liked-art" : "collection-art history-art");
    cover.append(icon(isLikes ? "heart" : "history"));
    const action = songs.length ? button("Play", () => player.play(songs[0], songs), "accent", "play") : null;
    main.append(collection(isLikes ? "Liked songs" : "Listening history", songs, {
      key: route, cover, action, count: isLikes, options: { empty: isLikes ? "Songs you like appear here." : "Music you listen to appears here." },
    }));
    return;
  }
  if (route === "playlists") {
    main.append(pageTitle("Playlists", button("New playlist", () => newPlaylist(), "accent", "plus")), playlistGrid(playlists));
    return;
  }
  main.append(pageTitle("Library", button("New playlist", () => newPlaylist(), "quiet", "plus")));
  const shortcuts = node("div", "", "library-shortcuts");
  shortcuts.append(shortcut("Liked songs", likes.length + " songs", "#likes", "heart"),
    shortcut("Listening history", plays.length + " plays", "#history", "history"));
  main.append(shortcuts, section("Your playlists", playlistGrid(playlists), link("View all", "#playlists", "section-link", "arrow")));
}
function shortcut(title, caption, href, symbol) {
  const item = link("", href, "library-shortcut");
  const copy = node("div", "", "track-copy");
  copy.append(node("strong", title), node("span", caption));
  item.append(icon(symbol), copy, icon("arrow"));
  return item;
}

function cached(path, key = path) {
  const now = Date.now();
  const previous = feeds.get(key);
  if (previous?.until > now) return previous.promise;
  if (feeds.size >= 48) feeds.delete(feeds.keys().next().value);
  const promise = api(path).then(({ data }) => data).catch((error) => {
    if (feeds.get(key)?.promise === promise) feeds.delete(key);
    throw error;
  });
  feeds.set(key, { until: now + 300000, promise });
  return promise;
}

function picks(topic) {
  const params = new URLSearchParams({ rotation });
  if (topic) params.set("topic", topic);
  return cached("recommendations?" + params, "recommendations:" + state.revision + ":" + params);
}

async function fillShelf(slot, promise, version, limit = 6, retry = render) {
  slot.setAttribute("aria-busy", "true");
  if (!slot.childElementCount) {
    const placeholders = node("div", "", "song-grid loading-songs");
    placeholders.setAttribute("aria-hidden", "true");
    for (let i = 0; i < Math.min(limit, 6); i++) placeholders.append(node("span"));
    slot.replaceChildren(node("p", "Finding music…", "sr"), placeholders);
  }
  try {
    const tracks = await promise;
    if (version !== routeVersion) return;
    slot.replaceChildren(tracks.length ? songGrid(tracks.slice(0, limit))
      : empty("No new matches yet. Try another collection.", "search"));
    return tracks;
  } catch {
    if (version !== routeVersion) return;
    slot.replaceChildren(empty("Music is temporarily unavailable.", "music", button("Retry", retry, "quiet compact", "refresh")));
  } finally {
    slot.setAttribute("aria-busy", "false");
  }
}
function recentSongs(rows) {
  const seen = new Set();
  return rows.map(({ song }) => song).filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function browseTiles() {
  const group = node("div", "", "topic-grid");
  for (const [slug, label, kind] of topics) {
    const item = link("", "#explore=" + slug, "topic-tile topic-" + slug);
    item.dataset.kind = kind;
    item.append(node("strong", label), icon("arrow"));
    group.append(item);
  }
  return group;
}

function home(main, version) {
  const { likes, playlists, plays } = state.library;
  const recent = recentSongs(plays).slice(0, 6);
  const saved = likes.slice(0, 6).map(({ song }) => song);
  const hour = new Date().getHours();
  main.append(pageTitle(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening",
    link("Explore", "#explore", "quiet home-explore", "explore")));
  const hero = node("div", "", "featured-slot");
  const collection = recent.length ? recent : saved.length ? saved : playlists.find((list) => list.songs.length)?.songs;
  if (collection?.length) hero.append(featured(collection[0], collection, recent.length ? "From your history" : "From your library"));
  main.append(hero);

  const hasTaste = likes.length || plays.some((play) => !play.excluded) || playlists.some((list) => list.songs.length);
  if (hasTaste) {
    const slot = node("div");
    const refresh = iconButton("refresh", "Refresh Quick picks", () => {
      rotation = (rotation + 1) % 100;
      refresh.disabled = true;
      fillShelf(slot, picks(), version, 6).finally(() => { refresh.disabled = false; });
    });
    main.append(section("Quick picks", slot, refresh));
    fillShelf(slot, picks(), version, 6);
  } else {
    const hindi = node("div");
    const english = node("div");
    main.append(section("Hindi music", hindi, link("Browse", "#explore=hindi", "section-link", "arrow")),
      section("English music", english, link("Browse", "#explore=english", "section-link", "arrow")));
    fillShelf(hindi, picks("hindi"), version).then((songs) => {
      if (version === routeVersion && !hero.children.length && songs?.length) hero.append(featured(songs[0], songs, "Hindi music"));
    });
    fillShelf(english, picks("english"), version).then((songs) => {
      if (version === routeVersion && !hero.children.length && songs?.length) hero.append(featured(songs[0], songs, "English music"));
    });
  }
  if (recent.length > 1) main.append(section("Listen again", songGrid(recent.slice(1)), link("History", "#history", "section-link", "arrow")));
  if (playlists.length) main.append(section("Your playlists", playlistGrid(playlists.slice(0, 6)), link("View all", "#playlists", "section-link", "arrow")));
  if (saved.length && !recent.length) main.append(section("Liked songs", songGrid(saved), link("View all", "#likes", "section-link", "arrow")));
}

function explore(main, topic, version) {
  const selected = topics.find(([slug]) => slug === topic);
  if (selected) {
    main.append(link("Explore", "#explore", "back-link"), pageTitle(selected[1]));
    const slot = node("div");
    main.append(slot);
    fillShelf(slot, picks(selected[0]), version, 24);
    return;
  }
  main.append(pageTitle("Explore"), browseTiles());
  const { likes, playlists, plays } = state.library;
  if (likes.length || playlists.some(({ songs }) => songs.length) || plays.some(({ excluded }) => !excluded)) {
    const slot = node("div");
    main.append(section("Discover for you", slot));
    fillShelf(slot, picks(), version, 12);
  }
}

function searchFor(query) {
  location.hash = "search=" + encodeURIComponent(query);
}
$("search").onsubmit = (event) => {
  event.preventDefault();
  if ($("query").value.trim()) searchFor($("query").value.trim());
};
async function searchPage(main, query, version) {
  $("query").value = query;
  main.append(pageTitle("Search"));
  if (!query) {
    main.append(section("Browse music", browseTiles()));
    return;
  }
  const body = node("div");
  body.append(node("p", "Searching…", "ui-note"));
  main.append(section("Results for “" + query + "”", body));
  try {
    const data = await cached("search?q=" + encodeURIComponent(query));
    if (version === routeVersion) body.replaceChildren(songRows(data, { albums: true, empty: "No songs matched your search." }));
  } catch (error) {
    if (version === routeVersion) body.replaceChildren(empty(error.message, "search", button("Retry", render, "quiet compact", "refresh")));
  }
}
async function accounts(main, version) {
  main.append(pageTitle("Manage accounts"));
  const list = node("div", "", "account-list");
  main.append(list);
  let next = "";
  async function page() {
    const data = (await api("admin/users?page=" + encodeURIComponent(next))).data;
    if (version !== routeVersion) return;
    for (const account of data.users) {
      const copy = node("div", "", "track-copy");
      const date = account.created ? new Date(account.created).toLocaleDateString() : "Unknown";
      copy.append(node("strong", account.id || account.uid),
        node("span", "Created " + date + " · " + (account.admin ? "Administrator" : account.disabled ? "Disabled" : "Active")));
      const row = node("div", "", "account-row");
      row.append(copy);
      if (!account.admin) row.append(button(account.disabled ? "Enable" : "Disable", async (event) => {
        event.currentTarget.disabled = true;
        try { await api("admin/users", { uid: account.uid, disabled: !account.disabled }); render(); }
        catch (error) { event.target.disabled = false; say(error.message); }
      }, "quiet"));
      list.append(row);
    }
    next = data.next;
    if (next) list.append(button("Load more", (event) => {
      event.currentTarget.remove();
      page().catch((error) => say(error.message));
    }, "quiet"));
  }
  try { await page(); }
  catch (error) { if (version === routeVersion) list.replaceChildren(empty(error.message, "profile")); }
}

function routeState() {
  const hash = location.hash.slice(1);
  const split = hash.indexOf("=");
  if (split < 0) return [hash || "home", ""];
  try { return [hash.slice(0, split), decodeURIComponent(hash.slice(split + 1))]; }
  catch { return [hash.slice(0, split), ""]; }
}
function render() {
  if (!user) return;
  pendingSync = false;
  const version = ++routeVersion;
  const [route, query] = routeState();
  const main = $("main");
  main.replaceChildren();
  const nav = ["likes","playlist","playlists","history"].includes(route) ? "library" : route;
  for (const item of $("nav").querySelectorAll("a")) {
    if (item.hash === "#" + nav) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  sidePlaylists(route, query);
  if (route === "search") searchPage(main, query, version);
  else if (route === "explore") explore(main, query, version);
  else if (route === "playlist") playlistPage(main, query);
  else if (["library","likes","playlists","history"].includes(route)) libraryPage(main, route);
  else if (route === "admin" && user.admin) accounts(main, version);
  else home(main, version);
}

window.addEventListener("hashchange", () => {
  $("profile").open = false;
  if (location.hash === "#main") {
    $("main").focus();
    return;
  }
  window.scrollTo(0, 0);
  render();
  if (location.hash === "#search" && !matchMedia("(max-width: 700px)").matches) $("query").focus();
});
document.querySelector(".skip-link").onclick = (event) => {
  event.preventDefault();
  (user ? $("main") : $("username")).focus();
};
document.addEventListener("click", (event) => {
  for (const menu of document.querySelectorAll("details[open]")) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
document.addEventListener("keydown", (event) => {
  if (!user || event.target.closest("input,textarea,select,button,summary,[contenteditable]")) return;
  if (event.key === "/" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    $("query").focus();
  } else if (event.code === "Space" && player.current() && !event.target.closest("a")) {
    event.preventDefault();
    player.toggle();
  }
});

async function pull() {
  const owner = user?.uid;
  if (!owner || signingOut || pulling || document.hidden && $("audio").paused) return;
  pulling = true;
  try {
    const { data } = await api("state?revision=" + state.revision);
    if (data && owner === user?.uid && data.revision > state.revision) {
      state = data;
      player.paintLike();
      pendingSync = true;
    }
    const active = document.activeElement;
    if (pendingSync && !document.querySelector("dialog[open]") && !active?.closest(".collection-search,details") && location.hash !== "#admin") render();
  } catch { /* Session errors are shown by api. */ }
  finally { pulling = false; }
}
window.addEventListener("focus", pull);
setInterval(pull, 20000);
openAccount().catch((error) => showLogin(error.message.includes("Sign in") ? "" : error.message));
