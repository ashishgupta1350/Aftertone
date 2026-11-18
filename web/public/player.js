import { $, node, iconButton, setIcon, artwork, artist, button } from "./ui.js";

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}
function shuffled(rows) {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createPlayer({ api, say, liked, toggleLike, addToPlaylist, record }) {
  const audio = $("audio");
  const dialog = $("now-playing");
  const transport = [];
  const scrubbers = [];
  const volumeControls = [];
  const likeControls = [];
  let owner = null;
  let queue = [];
  let index = -1;
  let shuffle = false;
  let repeat = "off";
  let activePanel = "lyrics";
  let lyricRequest = 0;
  let lyricKey = null;
  let lyricRows = [];
  let lyricLine = -1;
  let startAt = null;
  let resumePosition = 0;
  let activation = null;
  let listened = 0;
  let lastPosition = 0;
  let lastSaved = 0;
  let lastPersist = 0;
  let failed = false;

  const current = () => queue[index];
  const mediaTime = () => startAt ?? (audio.hasAttribute("src") ? audio.currentTime : resumePosition);
  const stateKey = () => "aftertone.player." + owner;
  const totalTime = () => Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(current()?.durationSec) || 0;

  function save() {
    if (!owner || !current()) return;
    try {
      localStorage.setItem(stateKey(), JSON.stringify({
        queue, index, position: mediaTime(),
        volume: audio.volume, muted: audio.muted, shuffle, repeat,
      }));
    } catch { /* A restricted browser can still play. */ }
  }

  function listen(force = false) {
    if (!owner || !current() || !activation || listened < 12 || listened <= lastSaved ||
      (!force && lastSaved > 0 && listened - lastSaved < 30)) return;
    const at = activation;
    const previous = lastSaved;
    lastSaved = listened;
    record({ song: current(), at, ms: Math.round(listened * 1000) }).catch(() => {
      if (activation === at) lastSaved = Math.min(lastSaved, previous);
    });
  }

  function reset() {
    owner = null;
    index = -1;
    queue = [];
    shuffle = false;
    repeat = "off";
    failed = false;
    activation = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.volume = 1;
    audio.muted = false;
    startAt = null;
    resumePosition = 0;
    if (dialog.open) dialog.close();
    $("player").hidden = true;
    document.body.classList.remove("has-player");
    if (navigator.mediaSession) navigator.mediaSession.metadata = null;
    lyricRequest++;
    lyricKey = null;
    lyricRows = [];
  }

  function restore(uid) {
    reset();
    owner = uid;
    try {
      const value = JSON.parse(localStorage.getItem(stateKey()));
      if (!Array.isArray(value?.queue) || !Number.isInteger(value.index) || !value.queue[value.index]) return;
      queue = value.queue.filter((song) => /^[A-Za-z0-9_-]{11}$/.test(song?.id) && typeof song.title === "string");
      index = queue.indexOf(value.queue[value.index]);
      if (index < 0) return;
      audio.volume = Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : 1;
      audio.muted = value.muted === true;
      shuffle = value.shuffle === true;
      repeat = ["all", "one"].includes(value.repeat) ? value.repeat : "off";
      select(index, false, Math.max(0, Number(value.position) || 0));
    } catch { /* Start with an empty queue if storage is unavailable. */ }
  }

  function showMessage(message, retry = false) {
    const panel = $("playback-message");
    panel.hidden = !message;
    panel.replaceChildren();
    if (message) panel.append(node("span", message));
    if (retry) panel.append(button("Retry", () => start(), "quiet compact", "refresh"));
  }

  function select(position, autoplay = true, offset = 0) {
    if (!queue[position]) return;
    listen(true);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    index = position;
    startAt = null;
    resumePosition = offset;
    activation = null;
    listened = lastPosition = lastSaved = 0;
    failed = false;
    showMessage("");
    lyricKey = null;
    lyricRows = [];
    lyricLine = -1;
    lyricRequest++;
    updateTrack();
    if (autoplay) start();
    save();
  }

  function start() {
    const song = current();
    if (!owner || !song) return;
    if (failed || !audio.hasAttribute("src")) {
      if (failed) resumePosition = mediaTime();
      startAt = resumePosition;
      failed = false;
      showMessage("");
      activation ||= Date.now();
      audio.src = "/api/stream?" + new URLSearchParams({
        id: song.id, title: song.title, artist: song.artists?.[0]?.name ?? "", duration: song.durationSec || 0,
      });
    }
    const selected = activation;
    audio.play().catch((error) => {
      if (activation === selected && error.name === "NotAllowedError") say("Press play to start listening.");
    });
  }

  function play(song, songs = [song]) {
    listen(true);
    const list = songs.length ? [...songs] : [song];
    const target = list.indexOf(song) >= 0 ? list.indexOf(song) : list.findIndex((row) => row.id === song.id);
    queue = shuffle ? [song, ...shuffled(list.filter((_, i) => i !== target))] : list;
    if (target < 0 && !shuffle) queue.unshift(song);
    // The old song was recorded before replacing its queue.
    activation = null;
    select(shuffle ? 0 : Math.max(0, target));
  }

  function add(song, next = false) {
    if (!current()) {
      queue = [song];
      select(0, false);
    } else {
      if (next) queue.splice(index + 1, 0, song);
      else queue.push(song);
      renderQueue();
      paintControls();
      save();
    }
    say(next ? "Added to Play next." : "Added to the queue.");
  }

  function step(direction, ended = false) {
    if (!current()) return;
    if (direction < 0 && mediaTime() > 3) {
      seek(0);
      return;
    }
    if (ended && repeat === "one") return select(index);
    const position = index + direction;
    if (queue[position]) return select(position);
    if (repeat === "all") {
      if (ended && shuffle) queue = shuffled(queue);
      return select(direction > 0 ? 0 : queue.length - 1);
    }
    if (ended) save();
  }

  function seek(seconds) {
    if (!current()) return;
    const desired = Math.min(Math.max(0, seconds), totalTime() || seconds);
    if (audio.readyState > 0 && audio.hasAttribute("src") && !failed) {
      lastPosition = desired;
      audio.currentTime = desired;
    } else {
      resumePosition = desired;
      if (audio.hasAttribute("src") && !failed) startAt = desired;
    }
    paintProgress();
    save();
  }

  function toggle() {
    if (!audio.paused && !audio.ended && !failed) audio.pause();
    else {
      if (audio.ended) seek(0);
      start();
    }
  }

  function paintControls() {
    const playing = !audio.paused && !audio.ended && !failed;
    for (const controls of transport) {
      setIcon(controls.play, playing ? "pause" : "play", playing ? "Pause" : "Play");
      controls.next.disabled = index >= queue.length - 1 && repeat !== "all";
      controls.previous.disabled = index < 1 && mediaTime() <= 3 && repeat !== "all";
      controls.shuffle.setAttribute("aria-pressed", String(shuffle));
      controls.repeat.setAttribute("aria-pressed", String(repeat !== "off"));
      setIcon(controls.repeat, repeat === "one" ? "repeatOne" : "repeat", "Repeat " + (repeat === "one" ? "track" : repeat));
    }
    for (const controls of volumeControls) {
      const muted = audio.muted || audio.volume === 0;
      setIcon(controls.mute, muted ? "mute" : "volume", muted ? "Unmute" : "Mute");
      controls.volume.value = muted ? 0 : audio.volume;
    }
  }

  function paintProgress() {
    const position = mediaTime();
    const duration = totalTime();
    for (const { elapsed, slider, total } of scrubbers) {
      elapsed.textContent = clock(position);
      total.textContent = clock(duration);
      slider.max = duration || 1;
      slider.disabled = duration <= 0;
      if (!slider.matches(":active")) slider.value = position;
      slider.style.setProperty("--fill", (duration ? Math.min(position / duration, 1) * 100 : 0) + "%");
      slider.setAttribute("aria-valuetext", clock(position) + " of " + clock(duration));
    }
    if (navigator.mediaSession && duration > 0) {
      try { navigator.mediaSession.setPositionState({ duration, position: Math.min(position, duration), playbackRate: audio.playbackRate }); }
      catch { /* Position state is optional. */ }
    }
    followLyrics();
  }

  function paintLike() {
    if (!current()) return;
    const selected = liked(current());
    for (const el of likeControls) {
      el.setAttribute("aria-pressed", String(selected));
      setIcon(el, "heart", selected ? "Unlike song" : "Like song");
    }
  }

  function updateTrack() {
    const song = current();
    $("player").hidden = !song;
    document.body.classList.toggle("has-player", Boolean(song));
    if (!song) return;
    [ $("art"), $("playing-glow"), $("playing-art") ].forEach((image) => artwork(image, song, false));
    for (const id of ["song", "playing-song"]) $(id).textContent = song.title;
    for (const id of ["artist", "playing-artist"]) $(id).textContent = artist(song);
    if (navigator.mediaSession && typeof MediaMetadata === "function") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title, artist: artist(song), album: song.album?.title || "",
        artwork: [{ src: $("art").src }],
      });
    }
    paintControls();
    paintProgress();
    paintLike();
    renderQueue();
    if (dialog.open && activePanel === "lyrics") loadLyrics();
  }

  function mountTransport(container) {
    const controls = {
      shuffle: iconButton("shuffle", "Shuffle", () => {
        shuffle = !shuffle;
        if (shuffle) queue.splice(index + 1, Infinity, ...shuffled(queue.slice(index + 1)));
        renderQueue();
        paintControls();
        save();
      }, "mode-control"),
      previous: iconButton("previous", "Previous track", () => step(-1)),
      play: iconButton("play", "Play", toggle, "play-toggle"),
      next: iconButton("next", "Next track", () => step(1)),
      repeat: iconButton("repeat", "Repeat off", () => {
        repeat = { off: "all", all: "one", one: "off" }[repeat];
        paintControls();
        save();
      }, "mode-control"),
    };
    container.append(...Object.values(controls));
    transport.push(controls);
  }

  function mountProgress(container) {
    const elapsed = node("span", "0:00");
    const total = node("span", "0:00");
    const slider = node("input", "", "seek");
    slider.type = "range";
    slider.min = 0;
    slider.step = 0.1;
    slider.setAttribute("aria-label", "Seek");
    slider.oninput = () => seek(Number(slider.value));
    container.append(elapsed, slider, total);
    scrubbers.push({ elapsed, slider, total });
  }

  function mountVolume(container) {
    const volume = node("input", "", "volume-slider");
    volume.type = "range";
    volume.min = 0;
    volume.max = 1;
    volume.step = 0.01;
    volume.setAttribute("aria-label", "Volume");
    volume.oninput = () => {
      audio.muted = false;
      audio.volume = Number(volume.value);
      save();
    };
    const mute = iconButton("volume", "Mute", () => {
      if (!audio.volume) audio.volume = 0.65;
      else audio.muted = !audio.muted;
      save();
    });
    const group = node("div", "", "volume-controls");
    group.append(mute, volume);
    container.append(group);
    volumeControls.push({ mute, volume });
  }

  function mountActions(container) {
    const like = iconButton("heart", "Like song", () => current() && toggleLike(current()), "like-control");
    container.append(like, iconButton("playlist", "Add to playlist", () => current() && addToPlaylist(current())));
    likeControls.push(like);
  }

  function renderQueue(focus) {
    if (!dialog.open || activePanel !== "queue") return;
    const container = $("queue-panel");
    container.replaceChildren();
    if (current()) {
      const row = node("div", "", "queue-current");
      row.append(node("h3", "Now playing"), queueTrack(current(), () => {}));
      row.lastChild.disabled = true;
      container.append(row);
    }
    const upcoming = queue.slice(index + 1);
    if (!upcoming.length) { container.append(node("p", "Add tracks to play next.", "ui-note")); return; }
    const list = node("ol", "", "queue-list");
    upcoming.forEach((song, i) => {
      const pos = index + 1 + i;
      const row = node("li", "", "queue-row");
      row.append(queueTrack(song, () => select(pos)));
      const tools = node("div", "", "queue-tools");
      for (const [symbol, label, offset] of [["up", "Move up", -1], ["down", "Move down", 1]]) {
        const move = iconButton(symbol, label + " " + song.title, () => {
          const next = pos + offset;
          [queue[pos], queue[next]] = [queue[next], queue[pos]];
          renderQueue({ pos: next, symbol });
          save();
        });
        move.dataset.position = String(pos);
        move.dataset.direction = symbol;
        move.disabled = offset < 0 ? i === 0 : i === upcoming.length - 1;
        tools.append(move);
      }
      tools.append(iconButton("remove", "Remove " + song.title + " from queue", () => {
        queue.splice(pos, 1);
        renderQueue({ pos: Math.min(pos, queue.length - 1), symbol: "up" });
        paintControls();
        save();
      }));
      row.append(tools);
      list.append(row);
    });
    container.append(list);
    if (focus) {
      const selector = '[data-position="' + focus.pos + '"][data-direction="' + focus.symbol + '"]';
      (list.querySelector(selector + ":enabled") ?? list.querySelector("button"))?.focus();
    }
  }

  function queueTrack(song, action) {
    const track = button("", action, "queue-track");
    const copy = node("span", "", "track-copy");
    copy.append(node("strong", song.title), node("span", artist(song)));
    track.append(artwork(node("img"), song), copy);
    return track;
  }

  async function loadLyrics() {
    const song = current();
    if (!song || lyricKey === song.id) return;
    lyricKey = song.id;
    lyricRows = [];
    const request = ++lyricRequest;
    const panel = $("lyrics-panel");
    panel.replaceChildren(node("p", "Loading lyrics…", "ui-note"));
    try {
      const params = new URLSearchParams({
        title: song.title, artist: song.artists?.[0]?.name || "",
        album: song.album?.title || "", duration: Math.round(totalTime()),
      });
      const { data } = song.artists?.length ? await api("lyrics?" + params) : { data: { kind: "missing" } };
      if (request !== lyricRequest) return;
      if (data.kind === "synced") {
        const list = node("ol", "", "synced-lyrics");
        lyricRows = data.lines.map(({ at, text }) => {
          if (!text) return { at, line: null };
          const row = node("li");
          const line = button(text, () => seek(at));
          line.title = "Seek to " + clock(at);
          row.append(line);
          list.append(row);
          return { at, line };
        });
        lyricLine = -1;
        panel.replaceChildren(list);
        panel.scrollTop = 0;
        followLyrics();
      } else if (data.kind === "plain") {
        panel.replaceChildren(node("p", data.text, "plain-lyrics"));
      } else {
        panel.replaceChildren(node("p", data.kind === "instrumental" ? "Instrumental track." : "Lyrics are unavailable for this track.", "ui-note"));
      }
    } catch (error) {
      if (request !== lyricRequest) return;
      panel.replaceChildren(node("p", error.message, "ui-note"), button("Retry lyrics", () => { lyricKey = null; loadLyrics(); }, "quiet compact"));
    }
  }

  function followLyrics() {
    if (!dialog.open || activePanel !== "lyrics" || !lyricRows.length) return;
    let low = 0;
    let high = lyricRows.length;
    const time = mediaTime();
    while (low < high) {
      const middle = (low + high) >> 1;
      if (lyricRows[middle].at <= time) low = middle + 1;
      else high = middle;
    }
    const next = low - 1;
    if (lyricLine === next) return;
    lyricRows[lyricLine]?.line?.removeAttribute("aria-current");
    lyricLine = next;
    const line = lyricRows[next]?.line;
    if (line) {
      line.setAttribute("aria-current", "true");
      const panel = $("lyrics-panel");
      const offset = line.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      panel.scrollTo({
        top: Math.max(0, panel.scrollTop + offset - panel.clientHeight * 0.32),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    }
  }

  function open(panel = "lyrics") {
    if (!current()) return;
    activePanel = panel;
    if (!dialog.open) dialog.showModal();
    $("lyrics-panel").hidden = panel !== "lyrics";
    $("queue-panel").hidden = panel !== "queue";
    $("lyrics-tab").setAttribute("aria-pressed", String(panel === "lyrics"));
    $("queue-tab").setAttribute("aria-pressed", String(panel === "queue"));
    if (panel === "lyrics") { loadLyrics(); followLyrics(); }
    else renderQueue();
  }

  mountTransport($("mini-controls"));
  mountTransport($("playing-controls"));
  mountProgress($("mini-progress"));
  mountProgress($("playing-progress"));
  mountActions($("mini-tools"));
  mountActions($("playing-actions"));
  $("mini-tools").append(iconButton("lyrics", "Open lyrics", () => open("lyrics"), "mini-lyrics"),
    iconButton("queue", "Open Up Next", () => open("queue"), "mini-queue"));
  mountVolume($("mini-tools"));
  mountVolume($("playing-controls"));
  $("open-player").onclick = () => open();
  $("close-player").onclick = () => dialog.close();
  $("lyrics-tab").onclick = () => open("lyrics");
  $("queue-tab").onclick = () => open("queue");

  audio.onloadedmetadata = () => {
    if (startAt !== null) {
      const at = startAt;
      startAt = null;
      seek(at);
    }
    paintProgress();
  };
  audio.ontimeupdate = () => {
    const position = audio.currentTime;
    const passed = position - lastPosition;
    if (!audio.seeking && passed > 0 && passed < 3) listened += passed;
    lastPosition = position;
    listen();
    paintProgress();
    paintControls();
    if (Date.now() - lastPersist >= 5000) {
      lastPersist = Date.now();
      save();
    }
  };
  audio.onplay = paintControls;
  audio.onpause = () => { listen(true); paintControls(); save(); };
  audio.onended = () => { listen(true); step(1, true); paintControls(); };
  audio.onvolumechange = paintControls;
  audio.onerror = () => {
    if (!owner || !current() || !audio.hasAttribute("src")) return;
    failed = true;
    showMessage("This track couldn’t play.", true);
    paintControls();
    say("This track couldn’t play. Press play to retry.");
    api("me").catch(() => {});
  };
  window.addEventListener("pagehide", save);

  if (navigator.mediaSession) {
    const bindings = { play: start, pause: () => audio.pause(), nexttrack: () => step(1),
      previoustrack: () => step(-1), seekto: (event) => seek(event.seekTime) };
    for (const [action, fn] of Object.entries(bindings)) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* Optional browser support. */ }
    }
  }
  return { play, add, restore, reset, paintLike, save, toggle, current, listen };
}
