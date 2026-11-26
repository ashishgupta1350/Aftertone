import { mkdir, writeFile } from "node:fs/promises";
import { rosemaryIcon, rosemaryIconNames } from "./rosemary-icons.mjs";

for (const shape of ["orb", "squircle"]) {
  const dir = new URL(`./assets/rosemary-icons/${shape}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  for (const name of rosemaryIconNames) {
    await writeFile(
      new URL(`${name}.svg`, dir),
      rosemaryIcon(name, shape, `rosemary-${shape}-${name}`),
    );
  }
}
console.log(
  `Created ${rosemaryIconNames.length} original Rosemary icons in two shapes (${rosemaryIconNames.length * 2} SVG files).`,
);
