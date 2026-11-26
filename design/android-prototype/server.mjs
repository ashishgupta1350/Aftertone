import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
const allowedPrefixes = [
  "design/android-prototype/",
  "design/icons/",
  "app/src/main/res/font/",
];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/design/android-prototype/" });
      res.end();
      return;
    }
    const decoded = decodeURIComponent(url.pathname);
    const requested = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
    const absolute = path.resolve(repoRoot, `.${requested}`);
    const relative = path
      .relative(repoRoot, absolute)
      .split(path.sep)
      .join("/");
    if (
      !allowedPrefixes.some((prefix) => relative.startsWith(prefix)) ||
      relative.startsWith("../") ||
      path.isAbsolute(relative)
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    if (!(await stat(absolute)).isFile()) throw new Error("Not a file");
    const content = await readFile(absolute);
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(absolute)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.PROTOTYPE_PORT) || 4381, "127.0.0.1", () =>
  console.log(
    `Aftertone Android prototype: http://127.0.0.1:${server.address().port}/design/android-prototype/`,
  ),
);
