# Aftertone Android prototypes — Aurora & Rosemary Glass

A local, interactive design prototype for reviewing the Android redesign before connecting the visual system to the production player. No account, backend, or package installation is needed. This is a browser preview of the proposed Android interface; playback and audio effects are simulated. It is not an APK.

## Run

From the repository root, with Node.js installed:

```powershell
node design/android-prototype/server.mjs
```

Open **http://127.0.0.1:4381/design/android-prototype/**. The local server binds only to this computer and serves the prototype, shared icons, and bundled fonts. Set `PROTOTYPE_PORT` to use a different port.

The preview fits its Android frame to the available sidebar height, supports 320 px and wider browser layouts, and keeps home/library content scrolling inside the phone. The three tabs above the phone switch screens. **Components** opens the reusable component kit inside the same phone.

## Reference interpretation

1. **Primary reference 01:** luminous edges, a translucent purple surface, tactile circular playback controls, and a small waveform detail. Decorative chains, stickers, and Spotify branding were not carried into the functional interface.
2. **Secondary reference 02:** compact artwork, a concise track identity, and a small player card. These inform the persistent mini player.
3. **Primary reference 03:** full-height now-playing hierarchy, a large rounded cover, a cover-mounted favorite, centered title and artist, a thin timeline, five transport controls, a frosted utility dock, and a volume row.

Use **Themes** in the header, or **Player settings → Template**, to choose between two complete visual templates. The original **Aurora (01)** keeps Lavender dusk, Rose quartz, and Blue hour. **Rosemary Glass (02)** adds Rose noir, Smoked orchid, and Pearl rose, plus round and soft-square glass icons. Open the new template directly with **http://127.0.0.1:4381/design/android-prototype/?template=rosemary**.

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
| Mini player | Home, library, collections, component kit | Shared playback state; expand, play/pause, skip |
| Track row | Library, collections, queue | Select a track; show current track |
| Modal sheet | Tools, appearance, sleep timer, options | Close button, backdrop, Escape, focus containment |
| Palette selector | Studio, settings, component kit | Shared color tokens and local persistence |

Home includes two mixes and the evening collection. The library supports playlists, songs, albums, track/artist search, liked songs, and adding a song to the **My evening** demo playlist. Queue entries can be removed or reset. Equalizer presets and individual bands change the visual control state. The sleep timer actually pauses the simulated player when it expires. Song names, artists, albums, and lyric text are demonstration content.

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

The 18 model tests cover playback behavior plus template switching without playback loss, independent palette memory, invalid theme choices, legacy preference migration, and restoring the saved silhouette. Browser review covers player/home/library navigation, seeking, queue edits, EQ presets, search, palettes, icon family coverage, both icon silhouettes, template switching, component specimens, and 320/390 px sidebar layouts. No Android APK build is claimed for this browser-only design pass.

## Artwork

`assets/dreamscape.png` was generated with the built-in imagegen tool for this prototype. `assets/README.md` records the prompt. The two secondary cover illustrations are project-local SVGs. None of the attached reference screenshots is embedded as a replacement for a working screen.
