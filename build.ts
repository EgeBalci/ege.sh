/**
 * Build script - produces a fully static site in dist/.
 *
 * Steps:
 *   1. Clean dist/
 *   2. Copy static assets from public/ (HTML, CSS, etc.)
 *   3. Bundle client TypeScript into dist/js/
 *   4. Write .nojekyll for GitHub Pages
 */

import { rm, mkdir, cp, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const DIST = "./dist";
const PUBLIC = "./public";
const isMinify = process.argv.includes("--minify");

// --------------- helpers ---------------

/** Recursively copy a directory, skipping a set of directory names. */
async function copyDir(src: string, dest: string, skip = new Set<string>()) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const s = await stat(srcPath);
    if (s.isDirectory()) {
      if (skip.has(entry)) continue;
      await copyDir(srcPath, destPath, skip);
    } else {
      await cp(srcPath, destPath);
    }
  }
}

// --------------- build steps ---------------

// 1. Clean
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
console.log("Cleaned dist/");

// 2. Copy public/ → dist/, skipping js/ (we regenerate it)
await copyDir(PUBLIC, DIST, new Set(["js"]));
console.log("Copied static assets → dist/");

// 3. Bundle client TypeScript (main)
const result = await Bun.build({
  entrypoints: ["./src/client/main.ts"],
  outdir: join(DIST, "js"),
  naming: "bundle.js",
  target: "browser",
  minify: isMinify,
  sourcemap: isMinify ? "none" : "inline",
});

if (!result.success) {
  console.error("Main bundle failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}
console.log(`Bundled ${result.outputs.length} file(s) → dist/js/bundle.js`);

// 3b. Bundle projects page TypeScript
const projectsResult = await Bun.build({
  entrypoints: ["./src/client/projects.ts"],
  outdir: join(DIST, "js"),
  naming: "projects.js",
  target: "browser",
  minify: isMinify,
  sourcemap: isMinify ? "none" : "inline",
});

if (!projectsResult.success) {
  console.error("Projects bundle failed:");
  for (const log of projectsResult.logs) {
    console.error(log);
  }
  process.exit(1);
}
console.log(`Bundled ${projectsResult.outputs.length} file(s) → dist/js/projects.js`);

// 3c. Bundle talks page TypeScript
const talksResult = await Bun.build({
  entrypoints: ["./src/client/talks.ts"],
  outdir: join(DIST, "js"),
  naming: "talks.js",
  target: "browser",
  minify: isMinify,
  sourcemap: isMinify ? "none" : "inline",
});

if (!talksResult.success) {
  console.error("Talks bundle failed:");
  for (const log of talksResult.logs) {
    console.error(log);
  }
  process.exit(1);
}
console.log(`Bundled ${talksResult.outputs.length} file(s) → dist/js/talks.js`);

// 4. Write .nojekyll so GitHub Pages serves files starting with _ or .
await Bun.write(join(DIST, ".nojekyll"), "");
console.log("Wrote .nojekyll");

console.log("\n✓ Static site ready in dist/");
