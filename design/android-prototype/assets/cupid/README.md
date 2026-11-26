# Cupid Player artwork and type

The latest user-supplied Cupid player screenshot is the only visual reference for template 03. The reference provides style and composition guidance; its pixels are not embedded, cropped or reused in these assets.

- `room.svg`: original turntable-room drawing from `../../cupid-art.mjs`. The live player embeds this SVG inline so room colors respond to light/dark mode and the record responds to playback.
- `record.svg`, `moon.svg`, `roses.svg`: three original cover drawings for the demo library. They replace the earlier templates' covers whenever Cupid is selected.
- `icons/`: 36 original pixel symbols from `../../cupid-icons.mjs`, including separate sun and moon controls.
- `lovebit.ttf`: original 5 × 7 bitmap headline lettering built by `../../build-cupid-font.py`. Latin lowercase maps to the uppercase pixel letterforms. Body text uses the repository's existing Geist Mono.

The original code-authored artwork, icons, and Lovebit letterforms are made available under CC0. Existing bundled fonts retain their existing licenses. No ImageGen or downloaded icon/image pack was used for this template. Regenerate the SVGs with `node design/android-prototype/build-cupid-assets.mjs`; rebuilding the font requires the `fontTools` Python package.
