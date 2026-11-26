/**
 * Original Aftertone drawings. Reference material informed the chrome, smoky
 * glass and pink/cyan lighting; no files or glyphs are imported from Wallpaper.
 * All geometry remains editable vector artwork for the later Android port.
 */
export const rosemaryGlyphs = Object.freeze({
  Play: '<path class="solid" d="M8 5.5c0-.8.9-1.2 1.5-.8l10 6.5c.6.4.6 1.2 0 1.6l-10 6.5c-.6.4-1.5 0-1.5-.8z"/>',
  Pause:
    '<rect class="solid" x="6.5" y="5" width="4" height="14" rx="1.2"/><rect class="solid" x="14" y="5" width="4" height="14" rx="1.2"/>',
  Next: '<path class="solid" d="m5.5 5.8 10 6.2-10 6.2z"/><rect class="solid" x="17" y="5.5" width="2.5" height="13" rx="1"/>',
  Previous:
    '<path class="solid" d="m18.5 5.8-10 6.2 10 6.2z"/><rect class="solid" x="4.5" y="5.5" width="2.5" height="13" rx="1"/>',
  Heart:
    '<path class="heart-face" d="M12 20.3 4.6 13a4.9 4.9 0 0 1 6.9-7l.5.5.5-.5a4.9 4.9 0 0 1 6.9 7z"/>',
  ChevronDown: '<path d="m5 9 7 7 7-7"/>',
  ChevronRight: '<path d="m9 5 7 7-7 7"/>',
  More: '<circle class="solid" cx="5" cy="12" r="1.7"/><circle class="solid" cx="12" cy="12" r="1.7"/><circle class="solid" cx="19" cy="12" r="1.7"/>',
  Shuffle:
    '<path d="M4 6h2c4.5 0 7.5 12 12 12h2M4 18h2c1.3 0 2.6-1.1 3.8-3M14.3 9c1.2-1.9 2.4-3 3.7-3h2m-3-3 3 3-3 3m0 6 3 3-3 3"/>',
  Repeat:
    '<path d="M19 8H7a4 4 0 0 0-4 4v1m2 3h12a4 4 0 0 0 4-4v-1M16 5l3 3-3 3M8 13l-3 3 3 3"/>',
  QueueMusic:
    '<path d="M4 6h13M4 11h10M4 16h7m7-4v7a2 2 0 1 1-2-2h2m0-5 3-1v4"/>',
  Equalizer:
    '<path d="M5 4v5m0 4v7m7-16v10m0 4v2m7-16v2m0 4v10"/><rect x="3" y="9" width="4" height="4" rx="1"/><rect x="10" y="14" width="4" height="4" rx="1"/><rect x="17" y="6" width="4" height="4" rx="1"/>',
  Lyrics:
    '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-8l-5.5 3v-3H5A1.5 1.5 0 0 1 3.5 16V6A1.5 1.5 0 0 1 5 4.5Z"/><path d="M7.5 9h9m-9 4h6"/>',
  Settings:
    '<path d="m9.7 3.5.8-1h3l.8 1 .4 2 1.6.9 2-.5 1.2.2 1.5 2.6-.4 1.2-1.5 1.4v1.9l1.5 1.4.4 1.2-1.5 2.6-1.2.2-2-.5-1.6.9-.4 2-.8 1h-3l-.8-1-.4-2-1.6-.9-2 .5-1.2-.2-1.5-2.6.4-1.2L5 13.2v-1.9L3.5 9.9l-.4-1.2 1.5-2.6 1.2-.2 2 .5 1.6-.9z"/><circle cx="12" cy="12.2" r="3"/>',
  VolumeDown: '<path d="M4 9h3l5-4v14l-5-4H4zM16 9a5 5 0 0 1 0 6"/>',
  VolumeUp:
    '<path d="M3 9h3l5-4v14l-5-4H3zM15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/>',
  VolumeOff: '<path d="M4 9h3l5-4v14l-5-4H4zm12 0 5 6m0-6-5 6"/>',
  Headphones:
    '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4.5" height="8" rx="2"/><rect x="16.5" y="12" width="4.5" height="8" rx="2"/>',
  Home: '<path class="solid" d="m3.5 10 8.5-7 8.5 7v10H15v-6H9v6H3.5z"/>',
  Search: '<circle cx="10.3" cy="10.3" r="6.3"/><path d="m15 15 5.3 5.3"/>',
  Library:
    '<rect x="3.5" y="4" width="4.5" height="16" rx="1.1"/><rect x="10" y="4" width="4.5" height="16" rx="1.1"/><path d="m17 4 4 15.5-3.6.9M5.5 8h.5m6-1h.5"/>',
  Close: '<path d="m6 6 12 12M18 6 6 18"/>',
  Check: '<path d="m5 12 4.5 4.5L19 7"/>',
  Palette:
    '<path d="M20.4 13.3a8.8 8.8 0 1 0-7.8 7.4 2 2 0 0 0 1.4-3.1l-.6-.9a1.7 1.7 0 0 1 1.4-2.6h3.5a2.2 2.2 0 0 0 2.1-.8Z"/><circle class="solid" cx="8" cy="8.3" r="1"/><circle class="solid" cx="13" cy="6.8" r="1"/><circle class="solid" cx="17" cy="9.6" r="1"/><circle class="solid" cx="6.4" cy="13.3" r="1"/>',
  Timer:
    '<circle cx="12" cy="13.5" r="7.5"/><path d="M9 2.5h6m-3 0V6m5.6.6 2-2M12 13.5l3-4"/>',
  PlaylistAdd: '<path d="M4 5h15M4 10h11M4 15h7m7-2v8m-4-4h8"/>',
  Album:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="12" cy="12" r="5.5"/><circle class="solid" cx="12" cy="12" r="1.4"/>',
  ArrowBack: '<path d="M20 12H4m7-7-7 7 7 7"/>',
  Download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  Song: '<path d="M10 17V5l10-2v12M10 8l10-2"/><ellipse cx="6.7" cy="17.7" rx="3.3" ry="2.8"/><ellipse cx="16.7" cy="15.7" rx="3.3" ry="2.8"/>',
  Remove: '<path d="M5 12h14"/>',
  Star: '<path class="solid" d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z"/>',
  Speaker:
    '<rect x="6" y="3" width="12" height="18" rx="2.7"/><circle cx="12" cy="14.4" r="3.2"/><circle class="solid" cx="12" cy="7.1" r="1.2"/>',
  Info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v6"/><circle class="solid" cx="12" cy="7.6" r="1"/>',
});

export const rosemaryIconNames = Object.freeze(Object.keys(rosemaryGlyphs));
let instance = 0;

export function rosemaryIcon(name, shape = "orb", id = `rg-${++instance}`) {
  if (!Object.hasOwn(rosemaryGlyphs, name))
    throw new Error(`Unknown Rosemary icon: ${name}`);
  if (!["orb", "squircle"].includes(shape))
    throw new Error(`Unknown glass shape: ${shape}`);
  if (!/^[a-zA-Z][\w-]*$/.test(id))
    throw new Error("SVG ID must be an identifier");
  const orb = shape === "orb";
  const outline = (extra = "") =>
    orb
      ? `<circle cx="32" cy="32" r="28" ${extra}/>`
      : `<rect x="4" y="4" width="56" height="56" rx="18" ${extra}/>`;
  const cyan = orb ? "M7 45a28 28 0 0 0 24 15" : "M5 44v1a16 16 0 0 0 16 16h10";
  const pink = orb ? "M33 60a28 28 0 0 0 26-17" : "M33 61h10a18 18 0 0 0 18-18";
  const highlight = orb
    ? "M8 25A25 25 0 0 1 49 12"
    : "M7 24v-3A14 14 0 0 1 21 7h23a14 14 0 0 1 10 4";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="icon rosemary-icon" data-icon="${name}" data-icon-shape="${shape}" viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-face" x1="8" y1="4" x2="52" y2="62" gradientUnits="userSpaceOnUse"><stop stop-color="#61515b"/><stop offset=".32" stop-color="#21101d"/><stop offset=".68" stop-color="#0e0911"/><stop offset="1" stop-color="#34444b"/></linearGradient>
    <linearGradient id="${id}-rim" x1="13" y1="4" x2="50" y2="61" gradientUnits="userSpaceOnUse"><stop stop-color="#fff8fd"/><stop offset=".16" stop-color="#c1b9c3"/><stop offset=".38" stop-color="#433640"/><stop offset=".58" stop-color="#0b080e"/><stop offset=".8" stop-color="#a5c7cd"/><stop offset="1" stop-color="#ff7cb4"/></linearGradient>
    <linearGradient id="${id}-glyph" x1="7" y1="3" x2="17" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="var(--icon-light,#ff9bc9)"/><stop offset=".45" stop-color="var(--icon-color,#ff4d9d)"/><stop offset="1" stop-color="var(--icon-deep,#ed0077)"/></linearGradient>
    <linearGradient id="${id}-sheen" x1="6" y1="7" x2="54" y2="57" gradientUnits="userSpaceOnUse"><stop stop-color="#fff3fc" stop-opacity=".16"/><stop offset=".47" stop-color="#fff3fc" stop-opacity="0"/><stop offset=".77" stop-color="#c9faff" stop-opacity=".03"/><stop offset="1" stop-color="#c9faff" stop-opacity=".12"/></linearGradient>
  </defs>
  <g class="icon-shell">
    ${outline('fill="#08060b" stroke="#040305" stroke-width="4"')}
    <path d="${cyan}" stroke="var(--icon-edge,#91f5ff)" stroke-width="2.3" stroke-linecap="round" opacity=".85"/>
    <path d="${pink}" stroke="var(--icon-color,#ff4d9d)" stroke-width="2.3" stroke-linecap="round"/>
    ${outline(`fill="url(#${id}-face)" stroke="url(#${id}-rim)" stroke-width="1.5"`)}
    ${outline(`fill="url(#${id}-sheen)" stroke="#d8b8cc" stroke-opacity=".17" stroke-width=".7" transform="translate(2.2 2.2) scale(.93125)"`)}
    <path d="${highlight}" stroke="#fff3fc" stroke-width="1.1" stroke-linecap="round" opacity=".65"/>
  </g>
  <g class="glass-glyph" transform="translate(16 16) scale(1.333333)" stroke="url(#${id}-glyph)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <style>.rosemary-icon .solid{fill:var(--glass-glyph-fill);stroke:none}.rosemary-icon .heart-face{fill:var(--glass-heart-fill,none)}</style>
    <g style="--glass-glyph-fill:url(#${id}-glyph)">${rosemaryGlyphs[name]}</g>
  </g>
</svg>`;
}
