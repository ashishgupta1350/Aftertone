# Aftertone Android prototypes — Aurora, Rosemary Glass & Cupid Player

The templates are also integrated into the native Compose app. See [native Android integration](NATIVE.md) for screen mappings, selection, and APK build instructions.


A local, interactive design prototype for reviewing the Android redesign before connecting the visual system to the production player. No account, backend, or package installation is needed. This is a browser preview of the proposed Android interface; playback and audio effects are simulated. It is not an APK.

## Original and updated Rosemary versions

Use the [version chooser](http://127.0.0.1:4381/design/android-prototype/versions/) to open the restored original or the current prompted update. The original is recovered from recorded edits through 19 November 2026, 13:19 IST, and has independent source, artwork, icons, font and browser preferences under `versions/rosemary-original/`. The current prototype and native Android app are preserved. See the [recovery notes](versions/rosemary-original/README.md).

## Run

From the repository root, with Node.js installed:

```powershell
node design/android-prototype/server.mjs
```

Open **http://127.0.0.1:4381/design/android-prototype/**. The local server binds only to this computer and serves the prototype, shared icons, and bundled fonts. Set `PROTOTYPE_PORT` to use a different port.

The preview renders the phone at actual CSS size, supports 320 px and wider browser layouts, and keeps home/search/library content scrolling inside the phone. Its height adapts between 760 and 844 px; text and touch targets are never scaled down to fit the window. Short browser panels can scroll around the full device preview. The four tabs above the phone switch screens. **Components** (or **Kit** in the sidebar) opens the reusable component kit inside the same phone.

## Readability and sizing

The sizing pass uses the locally available [UI UX Pro Max skill](<C:/Users/Welcome/Desktop/Extras/.claude/skills/ui-ux-pro-max/SKILL.md>). Its design-system search and UX/HTML-stack guidance inform the shared `readability.css` layer, applied to both templates while retaining Manrope and their established palettes.

- Body and primary metadata: 16 px; secondary text and control labels: 14 px; captions: 12 px. Screen headings use 28 px, sections 20 px, and track titles 26 px.
- At least 48 px interactive targets; glass controls use 48–56 px surfaces to leave a clearly visible symbol inside the bezel. Navigation labels and player tool labels are always visible.
- Original vector glyphs are centered on their 24-unit drawing grid. Rosemary glyphs occupy a 36-unit box inside their 64-unit glass surface; the 68 standalone exports are regenerated from this updated geometry.
- Header and body gutters follow a 24 px spacing scale, reducing to 16 px on narrow screens. Adjacent controls keep 8 px gaps where space permits.
- Short player screens use a flexible artwork row. Playback controls, text and utility labels retain their defined sizes. Home, library, sheets and galleries scroll within the device frame.
- The shared token values in `tokens.json` record the new typography, control sizes and unscaled preview policy.

Browser sizing checks cover the original 740 × 763 comment viewport and widths of 320, 375, 768, 1024 and 1440 px. The preview stays at scale 1, with no horizontal page overflow. Measured navigation surfaces are 56 px, compact player controls are 48 × 48 px, timeline targets are 44 px high, and the tool dock keeps visible labels. The updated reference screenshot is `readability-preview.jpg`.

## Reference interpretation

1. **Primary reference 01:** luminous edges, a translucent purple surface, tactile circular playback controls, and a small waveform detail. Decorative chains, stickers, and Spotify branding were not carried into the functional interface.
2. **Secondary reference 02:** compact artwork, a concise track identity, and a small player card. These inform the persistent mini player.
3. **Primary reference 03:** full-height now-playing hierarchy, a large rounded cover, a cover-mounted favorite, centered title and artist, a thin timeline, five transport controls, a frosted utility dock, and a volume row.

Use **Themes** in the header, or **Player settings → Template**, to choose between three complete visual templates. **Aurora (01)** keeps Lavender dusk, Rose quartz, and Blue hour. **Rosemary Glass (02)** adds Rose noir, Smoked orchid, and Pearl rose, plus round and soft-square glass icons. **Cupid Player (03)** uses pixel-paper windows in light and dark modes. Direct links accept `?template=aurora`, `?template=rosemary`, or `?template=cupid`.

Switching templates preserves the current track, playback position, queue, favorites, volume, and equalizer state. Each template remembers its own palette. Template selection, both palette preferences, icon silhouette, and favorites persist locally; other demo state resets on reload. Earlier saved palette choices migrate into Aurora.

## Rosemary Glass — study 02

The Rose Glass examples in `C:\Users\Welcome\Desktop\Wallpaper` informed the material: dark smoked faces, bright silver bevels, pink gradient symbols, cyan reflected edges, and both circular and soft-square silhouettes. The reference PNGs and glyph files were inspected in place. **No icons, wallpapers, widgets, or other assets from that folder were imported into Aftertone.**

`rosemary-icons.mjs` contains 34 newly drawn, editable vector symbols and their shared glass material. Every icon returned by the prototype's central `icon()` renderer uses this family in Rosemary Glass, including player transport, header actions, favorites, volume, dock, navigation, search, library, menus, sheets, and status indicators inside controls. Android's system status bar remains system-style. `rosemary.css` scopes the second template's chrome, surfaces, layout refinements, and icon sizes so Aurora keeps its original visual system.

The **Themes → Explore the full icon family** screen groups all 34 icons by playback, library, listening tools, and navigation. The normal component kit also contains the entire new set. The template chooser supports **Glass orb** and **Soft square** silhouettes, applied to every screen.

To regenerate the 68 standalone original SVGs:

```powershell
node design/android-prototype/build-icons.mjs
```

Outputs are in `assets/rosemary-icons/orb/` and `assets/rosemary-icons/squircle/`. The generator reads only project-authored vector definitions. It does not read the Wallpaper folder. These exports and the material renderer are prototype assets; they are not added to the production Android icon generator, which has a different SVG contract.

## Cupid Player — study 03

The sole visual reference for this template is the latest attached Cupid player image: cream-and-blush window chrome, bows and hearts, pixel lettering, a turntable, a midnight window, a vase of roses, and a star-shaped playhead. It does not use the glass pack or the previous reference images. This is an independent visual system with its own window structure, three-button player transport, flat pixel icons, beveled controls, and paper surfaces.

**Daydream** is the light mode; **Moonlight** is the dark mode. Use the moon/sun button in the player or page header, **Settings → Dark mode**, or the two Cupid color choices. The entire template changes: player, illustrated room, Home, Search, Your Library, collections, queue, settings and component kit. The chosen mode persists independently from the other templates and does not change playback, search text, or the selected library view.

`cupid-art.mjs` contains original SVG drawings for the room and three coordinated album sleeves (record deck, moonlit window and roses). Cupid resolves every demo cover to these drawings, including the mini player and queue. `cupid-icons.mjs` supplies 36 original 8 × 8 pixel symbols. `assets/cupid/lovebit.ttf` is the original 5 × 7 **Lovebit** headline font, generated from editable bitmap patterns in `build-cupid-font.py`; body text uses the existing bundled Geist Mono. The reference screenshot is not embedded as a screen or used as an asset.

To regenerate the editable assets:

```powershell
node design/android-prototype/build-cupid-assets.mjs
# Optional font-source rebuild; requires the fontTools Python package.
py design/android-prototype/build-cupid-font.py
```

The record rotates only during simulated playback and respects reduced-motion preferences. Shuffle and repeat remain available through the player's track-options menu; queue, sound, lyrics and settings remain in the bottom tool row. Search and Your Library retain their separate destinations.

Browser checks cover both modes, mode changes from the header/settings/palette chooser, template switching with mode memory, record play/pause, seeking, Search query preservation, Cupid-only cover assets, and the 320 px layout without horizontal overflow. Saved references are `cupid-light-preview.jpg` and `cupid-dark-preview.jpg`.

## Components and behavior

The render functions in `app.mjs` are reused across the prototype rather than being separate screenshots:

| Component | Uses | Behavior |
| --- | --- | --- |
| Artwork surface | Full player, collection header, artwork specimen | Rounded rim, soft elevation, favorite control |
| Track identity | Full player, component kit | Current track title and artist |
| Scrubber | Full player, component kit | Seek by dragging or keyboard; elapsed/total labels |
| Transport | Full player, component kit | Play/pause, previous/next, shuffle, repeat all/one/off |
| Utility dock | Full player, component kit | Queue, equalizer, sample lyrics, settings |
| Volume row | Full player, output sheet | Volume and mute with restoration |
| Mini player | Home, search, library, collections, component kit | Shared playback state; expand, play/pause, skip |
| Track row | Search, collections, queue | Select a track; show current track |
| Modal sheet | Tools, appearance, sleep timer, options | Close button, backdrop, Escape, focus containment |
| Palette selector | Studio, settings, component kit | Shared color tokens and local persistence |

Home includes two mixes and the evening collection. **Your Library** is a separate destination for playlists and albums, with **All**, **Playlists**, and **Albums** filters. It includes liked songs and the **My evening** demo playlist. It has no song-search field or Songs tab.

**Search** has its own screen, input, and song results. Search matches song titles and artists in the demo catalogue. The query survives screen changes, and never filters or changes the library's selected collection view. Search results can start playback, and minimizing the full player returns to Search when opened from there. Album and playlist contents remain accessible through Your Library. Both destinations keep the shared mini player and correctly highlight their own navigation tab.

Queue entries can be removed or reset. Equalizer presets and individual bands change the visual control state. The sleep timer actually pauses the simulated player when it expires. Song names, artists, albums, and lyric text are demonstration content.

## Android integration map

The production Kotlin UI and playback engine have not been changed in this design pass. Keep the existing functional application as the source of playback truth when implementing the selected direction.

| Prototype source | Android connection |
| --- | --- |
| `tokens.json` palettes | `ui/theme/Theme.kt`, `ui/theme/Backdrops.kt`; expose the chosen story through existing appearance settings |
| Radius, spacing and size tokens | `ui/theme/Tokens.kt` / `PrismUi`; use dp and keep Android font scale support |
| Local Manrope variable font | Existing `R.font.manrope`, `AppFonts`, `FontChoice.CLEAN` |
| Glass artwork, dock and cards | Existing `ui/theme/Glass.kt` / `GlassSurface`; retain the solid fallback on devices without blur |
| `scrubber()` | `ui/player/PlayerControls.kt` / `PlayerScrubber`, `ThinSlider`; bind to the existing position state and seek callback |
| `transport()` | `ui/player/PlayerControls.kt` / `TransportRow`, `PlayDisc`, `ModeGlyph`; keep existing media-session actions |
| `volumeControl()` | `ui/player/PlayerControls.kt` / `rememberPlayerVolume`, `VolumeRow` |
| `utilityDock()` | `ui/player/PlayerControls.kt` / `PlayerActionRow`, existing queue and lyrics pages, `PlayerSheets.kt` |
| `miniPlayer()` | `ui/player/MiniPlayer.kt` / `MiniPlayer`; keep the existing player connection |
| Home and library layouts | `ui/screens/HomeScreen.kt`, `HomeStyles.kt`, existing collection/library screens |
| Shared icon SVGs | `design/icons/*.svg`, compiled by `generatePrismIcons` into the existing `PrismIcons` system |
| State in `model.mjs` | Demo state only. Replace with the existing Android `PlayerConnection`, media controller, library, and audio-effects state |

Android paths above are relative to `app/src/main/java/com/prism/music/`, except resources and the shared SVG source directory. Aurora reads icon files directly from `design/icons/`; Rosemary Glass renders its original project-local vector family. Both use Manrope directly from `app/src/main/res/font/`. The production Kotlin sources, icon generator inputs, and playback services are unchanged. For a later native Rosemary implementation, port the shared glass material to Compose and retain the individual vector glyphs.

For the native implementation, use 48 dp minimum touch targets, retain the app's TalkBack descriptions and reduced-motion preferences, keep contrast readable over actual artwork, respect system insets, and test the solid glass fallback. Actual library content, lyrics, device discovery, and audio processing belong to the existing native services.

## Verification

```powershell
node --test design/android-prototype/model.test.mjs
node --check design/android-prototype/app.mjs
node --check design/android-prototype/server.mjs
```

The 21 model tests cover playback behavior plus template switching without playback loss, independent palette memory, invalid theme choices, legacy preference migration, restoring the saved silhouette, and Cupid light/dark persistence without affecting playback or navigation. Browser review covers player/home/library navigation, seeking, queue edits, EQ presets, search, palettes, icon families, silhouettes, template switching and component specimens. No Android APK build is claimed for this browser-only design pass.

## Artwork

`assets/dreamscape.png` was generated with the built-in imagegen tool for this prototype. `assets/README.md` records the prompt. The two secondary cover illustrations are project-local SVGs. None of the attached reference screenshots is embedded as a replacement for a working screen.
