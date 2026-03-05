# ege.sh

Personal website — static site built with [Bun](https://bun.sh) and TypeScript.

## Pages

- **Home** — WebGL animation (with CSS bat fallback), articles fetched from RSS, ASCII ripple effects
- **Projects** — GitHub repos with stats, doughnut chart, highlighted projects, and sliding carousels
- **Talks** — Conference talks with YouTube thumbnails, category filtering

## Prerequisites

- [Bun](https://bun.sh) v1.2+

## Install

```bash
bun install
```

## Build

Development build (with inline sourcemaps):

```bash
bun run build
```

Production build (minified, no sourcemaps):

```bash
bun run build:prod
```

Build the bat fallback CSS from SCSS:

```bash
bun run build:css
```

Output goes to `dist/`.

## Preview

Serve the built site locally on port 3000:

```bash
bun run preview
```

Then open [http://localhost:3000](http://localhost:3000).

## Deploy

The site is fully static. Deploy `dist/` to any static host:

- **GitHub Pages** — push `dist/` to the `gh-pages` branch or configure the repo to serve from it. A `.nojekyll` file is included automatically.
- **Any static host** — upload the contents of `dist/` (Netlify, Vercel, Cloudflare Pages, S3, etc.).

## Project Structure

```
public/           Static assets (HTML, CSS, data files) → copied to dist/
  css/            Stylesheets
  data/           JSON/XML data files served at runtime
  projects/       Projects page
  talks/          Talks page
src/
  client/         TypeScript entry points bundled for the browser
    main.ts       Home page logic
    projects.ts   Projects page logic
    talks.ts      Talks page logic
    ascii-effect.ts  ASCII ripple animation
    webgl-magic.ts   WebGL animation
  bat.scss        Bat fallback animation (SCSS source)
build.ts          Bun build script
```
