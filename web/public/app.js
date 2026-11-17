const $ = (id) => document.getElementById(id);
const audio = $("audio");
const blank = () => ({ revision: 0, library: { likes: [], playlists: [], plays: [] } });
let state = blank();
let user = null;
let signup = false;
let queue = [];
let now = null;
let listened = 0;
let lastPosition = 0;
let lastSaved = 0;
let playStarted = 0;
let routeNumber = 0;
let toastTimer;
let refresh;
let mutation = Promise.resolve();
let dialogAction;
let recommendations = [];
let recommendationsRevision = -1;
let signingOut = false;

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(label, fn, description) {
  const el = node("button", label);
  el.type = "button";
  if (description) { el.setAttribute("aria-label", description); el.title = description; }
  el.onclick = fn;
  return el;
}
function art(song) { return song.thumbnail || "https://i.ytimg.com/vi/" + song.id + "/mqdefault.jpg"; }
function artist(song) { return song.artists?.map((a) => a.name).join(", ") || "Unknown artist"; }
function say(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4800);
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
  const data = response.status === 204 ? null : await response.json();
  if (response.ok || (path === "state" && response.status === 409)) return { data, status: response.status };
  if (user && (response.status === 401 || response.status === 403 && data.error.includes("disabled"))) showLogin(data.error);
  throw new Error(data.error || "Aftertone is temporarily unavailable.");
}
function showLogin(message = "") {
  user = null;
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  now = null;
  queue = [];
  state = blank();
  recommendations = [];
  recommendationsRevision = -1;
  $("shell").hidden = $("search").hidden = $("signout").hidden = $("player").hidden = true;
  $("query").value = "";
  if (location.hash) history.replaceState(null, "", "/");
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
  $("shell").hidden = $("search").hidden = $("signout").hidden = false;
  $("admin-link").hidden = !user.admin;
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
  signingOut = true;
  try {
    await refresh?.catch(() => {});
    await api("logout", {}, false);
    showLogin();
  } catch (error) { signingOut = false; say(error.message); }
};

function edit(change, redraw = true) {
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
        syncLikeButtons();
        if (redraw) render();
        return;
      }
    }
    throw new Error("The library changed on another device. Try again.");
  });
  mutation = operation.catch((error) => say(error.message));
  return operation;
}
const liked = (song) => state.library.likes.some((entry) => entry.song.id === song.id);
function markLike(target, song) {
  const on = liked(song);
  target.textContent = on ? "♥" : "♡";
  target.setAttribute("aria-pressed", String(on));
  target.setAttribute("aria-label", on ? "Unlike song" : "Like song");
}
function syncLikeButtons() { if (now) markLike($("like-now"), now); }
function toggle(song) {
  const on = !liked(song);
  edit((library) => {
    library.likes = library.likes.filter((entry) => entry.song.id !== song.id);
    if (on) library.likes.unshift({ song, at: Date.now() });
  }).catch(() => {});
}
function play(song, tracks = [song]) {
  if (!user) return;
  saveProgress(true);
  now = song;
  queue = tracks;
  listened = lastPosition = lastSaved = 0;
  playStarted = Date.now();
  $("art").src = art(song);
  $("song").textContent = song.title;
  $("artist").textContent = artist(song);
  $("player").hidden = false;
  syncLikeButtons();
  audio.src = "/api/stream?" + new URLSearchParams({
    id: song.id, title: song.title, artist: song.artists?.[0]?.name || "", duration: song.durationSec || 0,
  });
  audio.play().catch((error) => { if (error.name === "NotAllowedError") say("Press play to start listening."); });
}
function seekQueue(direction) {
  if (!now) return;
  const index = queue.findIndex((track) => track.id === now.id);
  if (queue[index + direction]) play(queue[index + direction], queue);
}
function saveProgress(force = false) {
  if (!now || listened < 12 || !force && listened - lastSaved < 30 && lastSaved !== 0) return;
  const song = now;
  const at = playStarted;
  const ms = Math.round(listened * 1000);
  if (Math.round(lastSaved * 1000) >= ms) return;
  lastSaved = listened;
  edit((library) => {
    library.plays = [{ song, at, ms }, ...library.plays.filter((row) => row.at !== at || row.song.id !== song.id)].slice(0, 3000);
  }, false).catch(() => {});
}
audio.ontimeupdate = () => {
  const passed = audio.currentTime - lastPosition;
  if (passed > 0 && passed < 3) listened += passed;
  lastPosition = audio.currentTime;
  saveProgress();
};
audio.onpause = () => saveProgress(true);
audio.onended = () => { saveProgress(true); seekQueue(1); };
audio.onerror = async () => {
  if (!user || !now) return;
  try { await api("me"); say("This track couldn’t play. Try a different result."); }
  catch (error) { say(error.message); }
};
$("previous").onclick = () => seekQueue(-1);
$("next").onclick = () => seekQueue(1);
$("like-now").onclick = () => { if (now) toggle(now); };
$("add-now").onclick = () => { if (now) addDialog(now); };

function openDialog(title, fields, action) {
  $("dialog-title").textContent = title;
  $("playlist-fields").replaceChildren(...fields);
  dialogAction = action;
  $("dialog").showModal();
}
$("cancel").onclick = () => $("dialog").close();
$("playlist-form").onsubmit = (event) => {
  event.preventDefault();
  if (dialogAction?.() !== false) $("dialog").close();
};
function playlistName(existing) {
  const label = node("label", "Playlist name");
  const input = node("input");
  input.required = true;
  input.maxLength = 160;
  input.value = existing || "";
  label.append(input);
  return [label, input];
}
function newPlaylist(song) {
  const [label, input] = playlistName();
  openDialog("New playlist", [label], () => {
    const name = input.value.trim();
    if (!name) return false;
    const id = "prism:" + crypto.randomUUID().replaceAll("-", "");
    edit((library) => library.playlists.unshift({ id, name, songs: song ? [song] : [] })).catch(() => {});
  });
}
function addDialog(song) {
  if (!state.library.playlists.length) return newPlaylist(song);
  const label = node("label", "Playlist");
  const select = node("select");
  for (const playlist of state.library.playlists) {
    const option = node("option", playlist.name);
    option.value = playlist.id;
    select.append(option);
  }
  label.append(select);
  openDialog("Add to playlist", [label], () => {
    const id = select.value;
    edit((library) => {
      const playlist = library.playlists.find((row) => row.id === id);
      if (playlist && !playlist.songs.some((track) => track.id === song.id)) playlist.songs.push(song);
    }).then(() => say("Added to playlist.")).catch(() => {});
  });
}

function tracks(songs, { cards = false, playlist = null } = {}) {
  const panel = node("div", "", cards ? "grid" : "rows");
  if (!songs.length) return node("p", "There are no songs here yet.");
  for (const song of songs) {
    const row = node("article", "", cards ? "card" : "row");
    const cover = button("", () => play(song, songs), "Play " + song.title);
    cover.className = "cover";
    const image = node("img");
    image.src = art(song); image.alt = ""; image.loading = "lazy";
    cover.append(image, node("span", "▶"));
    const caption = node("div");
    caption.append(node("strong", song.title), node(cards ? "small" : "p", artist(song)));
    const actions = node("div", "", cards ? "card-actions" : "row-actions");
    const like = button("", () => toggle(song));
    markLike(like, song);
    actions.append(like, button("＋", () => addDialog(song), "Add to playlist"));
    if (playlist) actions.append(button("×", () => edit((library) => {
      const target = library.playlists.find((item) => item.id === playlist);
      if (target) target.songs = target.songs.filter((item) => item.id !== song.id);
    }).catch(() => {}), "Remove from playlist"));
    row.append(cover, caption, actions);
    panel.append(row);
  }
  return panel;
}
function section(title, contents, action) {
  const panel = node("section", "", "section");
  const header = node("div", "", "section-head");
  header.append(node("h2", title));
  if (action) header.append(action);
  panel.append(header, contents);
  return panel;
}
function heading(title, subtitle) {
  const header = node("div", "", "hero");
  header.append(node("h1", title));
  if (subtitle) header.append(node("p", subtitle));
  return header;
}
const topics = ["Hindi", "English", "Indie", "Pop", "Rock", "Hip-hop", "Chill", "Workout"];
function searchFor(q) { location.hash = "search=" + encodeURIComponent(q); }
$("search").onsubmit = (event) => { event.preventDefault(); if ($("query").value.trim()) searchFor($("query").value.trim()); };
function playlistIndex() {
  const panel = node("div");
  for (const playlist of state.library.playlists) {
    const row = node("div", "", "library-row");
    const details = node("div");
    const link = node("a", playlist.name);
    link.href = "#playlist=" + playlist.id;
    details.append(link, node("p", playlist.songs.length + " songs"));
    row.append(details);
    panel.append(row);
  }
  if (!panel.children.length) panel.append(node("p", "Create a playlist or add a song to start one."));
  return panel;
}
async function renderAccounts(main, freshness) {
  main.append(heading("Accounts", "Manage who can sign in to Aftertone."));
  const list = node("div");
  main.append(list);
  let next = "";
  async function page() {
    const data = (await api("admin/users?page=" + encodeURIComponent(next))).data;
    if (freshness !== routeNumber) return;
    for (const account of data.users) {
      const info = node("div");
      const date = account.created ? new Date(account.created).toLocaleDateString() : "Unknown";
      info.append(node("strong", account.id || account.uid), node("p", "Created " + date + " · " + (account.admin ? "Administrator" : account.disabled ? "Disabled" : "Active")));
      const row = node("div", "", "library-row");
      row.append(info);
      if (!account.admin) row.append(button(account.disabled ? "Enable" : "Disable", async (event) => {
        event.currentTarget.disabled = true;
        try { await api("admin/users", { uid: account.uid, disabled: !account.disabled }); render(); }
        catch (error) { say(error.message); }
      }));
      list.append(row);
    }
    next = data.next;
    if (next) list.append(button("Load more", (event) => {
      event.currentTarget.remove();
      page().catch((error) => say(error.message));
    }));
  }
  await page();
}
function playlistPage(main, key) {
  const playlist = state.library.playlists.find(({ id }) => id === key);
  if (!playlist) { main.append(heading("Playlist unavailable")); return; }
  const actions = node("div", "", "chips");
  if (playlist.songs.length) actions.append(button("Play", () => play(playlist.songs[0], playlist.songs)));
  actions.append(button("Rename", () => {
    const [label, input] = playlistName(playlist.name);
    openDialog("Rename playlist", [label], () => {
      const name = input.value.trim();
      if (!name) return false;
      edit((library) => {
        const current = library.playlists.find(({ id }) => id === key);
        if (current) current.name = name;
      }).catch(() => {});
    });
  }), button("Delete", () => {
    openDialog("Delete playlist?", [node("p", playlist.name)], () => {
      edit((library) => { library.playlists = library.playlists.filter(({ id }) => id !== key); })
        .then(() => { location.hash = "playlists"; }).catch(() => {});
    });
  }));
  main.append(heading(playlist.name), actions, tracks(playlist.songs, { playlist: key }));
}
async function render() {
  if (!user) return;
  const step = ++routeNumber;
  const [route, rawQuery] = (location.hash.slice(1) || "home").split(/=(.*)/s);
  const main = $("main");
  main.replaceChildren();
  for (const link of $("nav").querySelectorAll("a")) {
    if (link.hash === "#" + route) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const { likes, playlists, plays } = state.library;
  const mostRecent = [...new Map(plays.map((row) => [row.song.id, row.song]).reverse()).values()].reverse().slice(0, 12);
  try {
    if (route === "likes") main.append(heading("Liked songs"), tracks(likes.map(({ song }) => song)));
    else if (route === "playlists") main.append(heading("Playlists"), section("Your playlists", playlistIndex(), button("New playlist", () => newPlaylist())));
    else if (route === "playlist") playlistPage(main, rawQuery);
    else if (route === "history") main.append(heading("Listening history"), tracks(plays.map(({ song }) => song)));
    else if (route === "admin" && user.admin) await renderAccounts(main, step);
    else if (route === "search") {
      const q = decodeURIComponent(rawQuery || "");
      $("query").value = q;
      const loading = node("p", "Searching…");
      main.append(heading(q || "Search"), loading);
      const { data } = await api("search?q=" + encodeURIComponent(q));
      if (step === routeNumber) loading.replaceWith(tracks(data));
    } else {
      const explore = route === "explore";
      main.append(heading(explore ? "Explore" : "Home", explore ? "Find something new by mood, language, or genre." : ""));
      if (explore) {
        const chips = node("div", "", "chips");
        chips.append(...topics.map((topic) => button(topic, () => searchFor(topic + " music"))));
        main.append(chips);
      }
      if (!explore && mostRecent.length) main.append(section("Listen again", tracks(mostRecent.slice(0, 6), { cards: true })));
      const suggestions = node("div");
      const hasTaste = likes.length || playlists.some(({ songs }) => songs.length) || plays.length;
      if (hasTaste) main.append(section(explore ? "New for you" : "Quick picks", suggestions));
      if (!explore && likes.length) main.append(section("Liked songs", tracks(likes.slice(0, 6).map(({ song }) => song), { cards: true })));
      if (!hasTaste) {
        main.append(section("Find your first track", node("p", "Search for a song or browse Explore. Your likes and listening will shape your recommendations.")));
        return;
      }
      if (recommendationsRevision !== state.revision) {
        const revision = state.revision;
        suggestions.append(node("p", "Finding songs for you…"));
        const { data } = await api("recommendations");
        if (state.revision === revision) {
          recommendations = data;
          recommendationsRevision = revision;
        }
      }
      if (step === routeNumber) suggestions.replaceChildren(recommendations.length
        ? tracks(recommendations.slice(0, explore ? 24 : 12), { cards: true })
        : node("p", "No new matches right now. Try Explore or add a few more likes."));
    }
  } catch (error) { if (step === routeNumber) main.append(node("p", error.message)); }
}

window.onhashchange = () => { window.scrollTo(0, 0); render(); };
async function pull() {
  const owner = user?.uid;
  if (!owner || signingOut || document.hidden && audio.paused) return;
  try {
    const { data } = await api("state?revision=" + state.revision);
    if (data && owner === user?.uid && data.revision > state.revision) {
      state = data;
      syncLikeButtons();
      if (!$("dialog").open && location.hash !== "#admin") render();
    }
  } catch { /* Session errors are displayed by api. */ }
}
window.addEventListener("focus", pull);
setInterval(pull, 20000);
openAccount().catch((error) => showLogin(error.message.includes("Sign in") ? "" : error.message));
