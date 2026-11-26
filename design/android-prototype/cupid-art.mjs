// Original code-native illustration inspired only by the supplied Cupid player.
// The room, record deck, window and flower arrangements are newly drawn here.
export function cupidScene() {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="cupid-room-art" viewBox="0 0 360 320" role="img" aria-label="A pink turntable beside roses and a moonlit window" shape-rendering="crispEdges">
  <path fill="var(--cupid-wall,#825068)" d="M0 0h360v320H0z"/>
  <path fill="var(--cupid-curtain,#713b56)" d="M0 0h176v174H0z"/>
  <path fill="var(--cupid-curtain-light,#965a73)" d="M12 0h10v174H12zm28 0h5v174h-5zm21 0h9v174h-9zm32 0h6v174h-6zm26 0h8v174h-8zm28 0h5v174h-5z"/>
  <path fill="var(--cupid-shadow,#523044)" d="M172 0h8v176h-8z"/>
  <path fill="var(--cupid-floor,#a66a7b)" d="m0 211 178-53 182 22v140H0z"/>
  <g fill="none" stroke="var(--cupid-floor-line,#885568)" stroke-width="1">
    <path d="M0 241h360M0 282h360M178 158 34 320m162-160-52 160m69-157 55 157m-39-154 123 112M22 205l338 17M78 188l282 12"/>
  </g>
  <path fill="var(--cupid-window-frame,#c18a95)" stroke="var(--cupid-outline,#543449)" stroke-width="2" d="M206 6h132v151H206z"/>
  <path fill="#30253f" d="M214 13h115v133H214z"/>
  <path fill="#48324f" d="M218 114h111v32H218z"/>
  <path fill="#5e3c5d" d="m218 123 22-18 22 9 26-13 24 13 17-7v39H218z"/>
  <path fill="#f4dfa3" d="M300 23h10v4h5v14h-4v6h-14v-4h-5v-5h9v-5h4v-5h-5z"/>
  <g fill="#f4d9aa"><path d="M230 27h3v9h-3zm-3 3h9v3h-9zM253 49h2v8h-2zm-3 3h8v2h-8zM317 73h2v8h-2zm-3 3h8v2h-8zM239 86h2v6h-2zm-2 2h6v2h-6zM276 20h2v2h-2zm35 34h2v2h-2zm-39 27h2v2h-2zm-42-29h2v2h-2z"/></g>
  <path fill="var(--cupid-window-frame,#c18a95)" stroke="var(--cupid-outline,#543449)" d="M267 10h7v140h-7zM210 144h124v9H210z"/>
  <path fill="var(--cupid-highlight,#f7ddce)" opacity=".7" d="M207 4h131v3H207zm2 4h3v134h-3zM269 13h2v128h-2z"/>
  <path fill="var(--cupid-shadow,#523044)" opacity=".35" d="m62 254 166-24 61 52-156 29z"/>
  <path fill="var(--cupid-deck,#f1cfbc)" stroke="var(--cupid-outline,#663b4a)" stroke-width="2" d="m72 181 161-29 43 91-172 42z"/>
  <path fill="var(--cupid-deck-side,#dca8a7)" stroke="var(--cupid-outline,#663b4a)" stroke-width="2" d="m104 285 172-42v26l-169 43-3-27zM72 181l32 104 3 27-33-103z"/>
  <path fill="var(--cupid-highlight,#fff0d8)" d="m77 182 156-26 2 5-157 27zm30 97 165-40 1 4-165 40z"/>
  <path fill="var(--cupid-outline,#663b4a)" d="m103 309 11-3 1 8-9 2zm150-35 12-4v8l-11 3zM83 211l9 1-1 10-8-1z"/>
  <g transform="translate(172 213) scale(1 .63)">
    <g class="cupid-record">
      <circle r="72" fill="#201b25" stroke="#100d16" stroke-width="2"/>
      <circle r="65" fill="none" stroke="#39313b" stroke-width="1"/><circle r="60" fill="none" stroke="#302731" stroke-width="1"/><circle r="54" fill="none" stroke="#39313b" stroke-width="1"/>
      <path d="M-52-36A64 64 0 0 1-15-62M41 48A64 64 0 0 1 5 63" fill="none" stroke="#78606c" stroke-width="2" opacity=".55"/>
      <circle r="21" fill="var(--cupid-ribbon,#eaa7b8)" stroke="var(--cupid-outline,#663b4a)" stroke-width="2"/>
      <circle r="15" fill="none" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="1"/>
      <path d="M-8-4h5v3h6v-3h5v8H5v4H2v3h-4V8h-3V4h-3z" fill="var(--cupid-outline,#663b4a)"/>
      <circle r="3" fill="var(--cupid-highlight,#fff0d8)"/>
    </g>
  </g>
  <path fill="var(--cupid-shadow,#523044)" d="m227 175 8-1 5 8-8 7-6-4z"/>
  <path d="m231 177-8 40-21 22-9-3" fill="none" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="6"/>
  <path d="m232 177-7 41-21 22" fill="none" stroke="var(--cupid-outline,#663b4a)" stroke-width="2"/>
  <path fill="var(--cupid-ribbon,#eaa7b8)" stroke="var(--cupid-outline,#663b4a)" d="m188 231 13 5-5 12-13-6z"/>
  <path fill="var(--cupid-ribbon,#eaa7b8)" stroke="var(--cupid-outline,#663b4a)" d="m252 230 8-2 4 7-8 4-5-3z"/>
  <path fill="var(--cupid-outline,#663b4a)" d="m120 288 29-7 1 8-29 8zM154 279l4-1v4l-4 1zm8-2 4-1v4l-4 1zm8-2 4-1v4l-4 1zm8-2 4-1v4l-4 1z"/>
  <path fill="var(--cupid-highlight,#fff0d8)" stroke="var(--cupid-outline,#663b4a)" d="m162 291 45-11v9l-45 11z"/>
  <path d="m168 291v4m7-6v4m7-6v4m7-6v4m7-6v4m7-6v4" stroke="var(--cupid-ribbon,#eaa7b8)" stroke-width="2"/>
  <path fill="var(--cupid-ribbon,#eaa7b8)" stroke="var(--cupid-outline,#663b4a)" d="m236 275 6-2v8l-6 2zm11-3 6-2v8l-6 2z"/>
  <g class="cupid-lid">
    <path d="m71 180 8-87 151-23 9 13-9 79z" fill="var(--cupid-lid,#e7adc4)" fill-opacity=".12" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="1.5"/>
    <path d="m79 93 10 15 150-25M89 108l-9 75m-1-90 151-23 9 13-150 25z" fill="none" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="1"/>
    <path d="m83 100 5 1-7 70m14-67 126-19" fill="none" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="3" opacity=".25"/>
    <path fill="var(--cupid-outline,#663b4a)" d="m76 177 7-1 2 8-8 2zm146-28 8-2 1 8-8 2z"/>
  </g>
  <path d="m319 171-7-58m7 58 16-78m-16 78-24-38m24 38 2-88" stroke="var(--cupid-stem,#626448)" stroke-width="2" fill="none"/>
  <g fill="var(--cupid-ribbon,#eaa7b8)" stroke="var(--cupid-outline,#663b4a)" stroke-width="1">
    <path d="m307 110 4-4 6 3 3 8-5 8-8-5zM330 90l4-5 6 4 2 7-6 8-7-5zM289 129l5-4 7 2 4 7-5 8-8-3zM317 81l5-4 6 3 1 9-6 5-7-6z"/>
  </g>
  <g fill="var(--cupid-highlight,#fff0d8)"><path d="m310 111 4-1 1 6-4 1zM333 91l4-1 1 5-4 2zM292 131l5-1 1 5-4 1zM320 82l4-1v6h-3z"/></g>
  <path fill="var(--cupid-vase,#bd86a0)" stroke="var(--cupid-outline,#663b4a)" stroke-width="2" d="m309 168-7 12-2 34 8 9 22-2 8-9-5-37-8-8z"/>
  <path d="m308 179-1 34m7-38v43m8-44 2 43m4-42 4 36" stroke="var(--cupid-highlight,#fff0d8)" stroke-width="2" opacity=".4"/>
  <path fill="var(--cupid-outline,#663b4a)" d="m307 167 19-2 2 5-19 2z"/>
  </svg>`;
}

export function cupidCover(kind) {
  const border = "#a96982",
    pink = "#dfa0b0",
    cream = "#f6e3ce";
  const base = `<path fill="${cream}" d="M0 0h160v160H0z"/><path d="M0 20h160M0 40h160M0 60h160M0 80h160M0 100h160M0 120h160M0 140h160M20 0v160M40 0v160M60 0v160M80 0v160M100 0v160M120 0v160M140 0v160" stroke="#e9c4c5" stroke-width="1"/>`;
  let content;
  if (kind === "moon")
    content = `<path fill="#c58b9e" stroke="${border}" stroke-width="3" d="M29 17h103v125H29z"/><path fill="#32273f" d="M36 24h89v110H36z"/><path fill="#5d3b60" d="m36 111 21-18 21 11 15-15 32 23v22H36z"/><path d="M77 22h7v116h-7z" fill="${pink}"/><path d="M107 40h7v4h3v11h-4v4h-12v-4h-3v-4h9zM48 45h3v11h-3zm-4 4h11v3H44zm14 28h2v6h-2zm-2 2h6v2h-6zM107 81h3v3h-3z" fill="#f4d9a1"/><path d="M30 140h105" stroke="${border}" stroke-width="5"/>`;
  else if (kind === "roses")
    content = `<path fill="#7d4b65" d="M19 15h122v133H19z"/><path d="M76 111 57 44m21 67 24-76m-24 76 4-89m-4 89 35-38" stroke="#7b825c" stroke-width="3"/><g fill="${pink}" stroke="${border}" stroke-width="2"><path d="m49 40 7-6 10 5 4 12-8 11-12-5zM95 30l8-5 9 7-1 13-12 5-8-10zM75 18l8-4 9 5v13l-11 6-9-9zM107 68l7-4 9 7-2 11-10 4-8-9z"/></g><path d="m62 104-6 35h46l-7-35z" fill="#bd87a1" stroke="${border}" stroke-width="2"/><path d="m64 112-2 24m12-26v27m10-27 2 27m5-24 5 23" stroke="${cream}" opacity=".6" stroke-width="2"/>`;
  else
    content = `<path d="m28 48 88-15 23 79-94 21z" fill="${pink}" stroke="${border}" stroke-width="2"/><ellipse cx="80" cy="82" rx="43" ry="30" fill="#25202b"/><ellipse cx="80" cy="82" rx="34" ry="23" fill="none" stroke="#4e3949"/><ellipse cx="80" cy="82" rx="13" ry="9" fill="${cream}"/><path d="m75 79 3-2 3 2 3-2 3 2v4l-6 5-6-5z" fill="${border}"/><path d="m119 46-7 38-15 15" stroke="${cream}" stroke-width="4" fill="none"/><path d="m25 47 3-28 85-12 3 26z" stroke="${border}" stroke-width="2" fill="#edb8c440"/><path d="m54 122 30-7" stroke="${border}" stroke-width="4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" shape-rendering="crispEdges">${base}${content}<path d="M5 5h150v150H5z" fill="none" stroke="${border}" stroke-width="2"/></svg>`;
}
