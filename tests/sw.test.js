// Run with: node --test tests/sw.test.js
// Guards the offline copy: every file the app needs must be listed in sw.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const files = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));

test("sw.js caches every file index.html loads", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const r of refs) assert.ok(files.includes(r), `${r} is used by index.html but not cached in sw.js`);
});

test("sw.js caches every manifest icon", () => {
  const man = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  for (const i of man.icons) assert.ok(files.includes(i.src), `${i.src} missing from sw.js`);
});

test("every cached file exists", () => {
  for (const f of files) if (f !== "./") assert.ok(fs.existsSync(path.join(root, f)), `${f} listed in sw.js but missing`);
});

test("VERSION is set", () => {
  assert.match(sw, /const VERSION = "five-dice-v\d+";/);
});
