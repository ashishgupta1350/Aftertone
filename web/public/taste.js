import { $, artwork, button, node } from "./ui.js";

export const topics = [
  ["hindi", "Hindi", "language", "Hindi songs"],
  ["english", "English", "language", "English pop songs"],
  ["punjabi", "Punjabi", "language", "Punjabi songs"],
  ["tamil", "Tamil", "language", "Tamil songs"],
  ["telugu", "Telugu", "language", "Telugu songs"],
  ["pop", "Pop", "genre", "pop songs"],
  ["indie", "Indie", "genre", "indie songs"],
  ["rock", "Rock", "genre", "rock songs"],
  ["hiphop", "Hip-hop", "genre", "hip hop songs"],
  ["dance", "Dance & electronic", "genre", "dance electronic songs"],
  ["chill", "Chill", "mood", "chill songs"],
  ["workout", "Workout", "mood", "workout music"],
  ["focus", "Focus", "mood", "focus instrumental music"],
];

export function createTastePicker({ loadArtists, save }) {
  const dialog = $("taste-dialog");
  const panel = $("taste-panel");
  const notice = $("taste-notice");
  let picks;
  let editing;
  let step;
  let request = 0;
  let submitting = false;

  function chips(kind, label, values) {
    const group = node("fieldset");
    group.append(node("legend", label));
    const choices = node("div", "", "taste-options");
    for (const [id, text, type] of topics) {
      if (type !== kind) continue;
      const chip = button(text, () => {
        if (values.has(id)) values.delete(id);
        else values.add(id);
        chip.setAttribute("aria-pressed", String(values.has(id)));
      }, "taste-chip");
      chip.setAttribute("aria-pressed", String(values.has(id)));
      choices.append(chip);
    }
    group.append(choices);
    return group;
  }

  function showArtists() {
    const input = node("input");
    input.id = "taste-search";
    input.type = "search";
    input.maxLength = 100;
    input.placeholder = "Search artists";
    input.setAttribute("aria-label", "Search artists");
    const selected = node("div", "", "taste-options");
    const results = node("div", "", "taste-artists");
    results.setAttribute("aria-live", "polite");
    let timer;

    function update() {
      selected.replaceChildren(...[...picks.artists].map(([key, name]) => {
        const remove = button(name, () => {
          picks.artists.delete(key);
          notice.textContent = "";
          update();
          input.focus();
        }, "taste-chip", "remove");
        remove.setAttribute("aria-label", "Remove " + name);
        return remove;
      }));
      for (const card of results.querySelectorAll("[data-artist]")) {
        card.setAttribute("aria-pressed", String(picks.artists.has(card.dataset.artist)));
      }
    }

    async function find() {
      if (!dialog.open || step !== 2 || !panel.contains(input)) return;
      const id = ++request;
      const query = input.value.trim();
      results.textContent = "Finding artists…";
      try {
        const items = await loadArtists(query, [...picks.languages]);
        if (id !== request || !dialog.open || !panel.contains(input)) return;
        results.replaceChildren(...items.map((entry) => {
          const key = entry.name.toLowerCase();
          const card = button("", () => {
            if (picks.artists.has(key)) picks.artists.delete(key);
            else if (picks.artists.size < 8) picks.artists.set(key, entry.name);
            else { notice.textContent = "Choose up to eight artists."; return; }
            notice.textContent = "";
            update();
          }, "taste-artist");
          card.dataset.artist = key;
          card.append(artwork(node("img"), entry, false, "48px"), node("span", entry.name));
          return card;
        }));
        if (!items.length) results.textContent = query ? "No artists found." : "Search to find your favorite artists.";
        update();
      } catch {
        if (id === request && dialog.open && panel.contains(input)) {
          results.replaceChildren(node("p", "Artists are temporarily unavailable."), button("Retry", find, "quiet compact"));
        }
      }
    }
    input.addEventListener("input", () => {
      clearTimeout(timer);
      request++;
      timer = setTimeout(find, 250);
    });
    panel.append(input, selected, results);
    update();
    void find();
  }

  function show({ focus = true } = {}) {
    request++;
    notice.textContent = "";
    $("taste-heading").textContent = step === 1 ? "What do you listen to?" : "Who do you listen to?";
    $("taste-description").textContent = step === 1
      ? "Choose the languages and genres you want to hear more often."
      : "Pick up to eight favorite artists to shape your Quick picks.";
    $("taste-back").hidden = step !== 2;
    $("taste-skip").textContent = editing ? "Cancel" : "Skip for now";
    $("taste-next").textContent = step === 1 ? "Continue" : editing ? "Save preferences" : "Start listening";
    panel.replaceChildren();
    if (step === 1) panel.append(chips("language", "Languages", picks.languages), chips("genre", "Genres", picks.genres));
    else showArtists();
    if (focus) $("taste-heading").focus();
  }

  async function submit(skip = false) {
    if (submitting) return;
    submitting = true;
    const controls = [...dialog.querySelectorAll("button")];
    for (const control of controls) control.disabled = true;
    notice.textContent = "";
    try {
      await save(skip ? { languages: [], genres: [], artists: [] } :
        { languages: [...picks.languages], genres: [...picks.genres], artists: [...picks.artists.values()] });
      if (dialog.open) dialog.close();
    } catch (error) {
      notice.textContent = error.message;
    } finally {
      submitting = false;
      for (const control of controls) control.disabled = false;
    }
  }

  $("taste-back").onclick = () => { step = 1; show(); };
  $("taste-next").onclick = () => {
    if (step === 1) { step = 2; show(); }
    else void submit();
  };
  $("taste-skip").onclick = () => { if (editing) dialog.close(); else void submit(true); };
  dialog.addEventListener("cancel", (event) => {
    if (!submitting && editing) return;
    event.preventDefault();
    if (!submitting) void submit(true);
  });
  dialog.addEventListener("close", () => { request++; });

  return {
    open(value, edit = false) {
      if (dialog.open) return;
      editing = edit;
      picks = {
        languages: new Set(value?.languages),
        genres: new Set(value?.genres),
        artists: new Map(value?.artists?.map((name) => [name.toLowerCase(), name])),
      };
      step = 1;
      show({ focus: false });
      dialog.showModal();
      $("taste-heading").focus();
    },
    close() { if (dialog.open) dialog.close(); },
    get openByUser() { return dialog.open; },
  };
}
