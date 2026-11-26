import { mkdir, writeFile } from "node:fs/promises";
import { cupidScene, cupidCover } from "./cupid-art.mjs";
import { cupidIcon, cupidIconNames } from "./cupid-icons.mjs";
const root = new URL("./assets/cupid/", import.meta.url);
await mkdir(root, { recursive: true });
await writeFile(new URL("room.svg", root), cupidScene());
for (const kind of ["record", "moon", "roses"])
  await writeFile(new URL(`${kind}.svg`, root), cupidCover(kind));
const icons = new URL("./icons/", root);
await mkdir(icons, { recursive: true });
for (const name of cupidIconNames)
  await writeFile(new URL(`${name}.svg`, icons), cupidIcon(name));
console.log(
  `Built the original Cupid room, 3 covers, and ${cupidIconNames.length} pixel icons.`,
);
