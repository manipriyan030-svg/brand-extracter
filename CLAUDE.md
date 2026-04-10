@AGENTS.md

# brand-extractor — project context

## What this does
A "Brandfetch-style" tool: user pastes a URL → app returns the brand's **logo, colors, typography, screenshot, and brand name**. Cyces internal tool.

## Stack
- **Next.js 16.2.2** (App Router) + React 19 + Tailwind v4 + TypeScript. **Important:** this Next version is newer than training data — see AGENTS.md, read `node_modules/next/dist/docs/` before assuming APIs.
- **Puppeteer** (headless Chromium) for live page scraping — runs server-side in the API route.
- **Python sidecar** ([python-service/main.py](python-service/main.py)) — FastAPI + spaCy `en_core_web_sm` for ORG/PRODUCT NER to pick the brand name out of page text. Runs separately on port 8000. Url overridable via `SPACY_SERVICE_URL`.

## Layout
- [src/app/page.tsx](src/app/page.tsx) — single-page client UI. Hero → URL form → results grid (logos, colors, fonts, screenshot, about).
- [src/app/api/extract/route.ts](src/app/api/extract/route.ts) — the whole backend. POST `{url}` → launches Puppeteer, runs an in-page `evaluate()` that scrapes everything, takes a screenshot, calls the spaCy sidecar, returns one big JSON blob. `maxDuration = 60`.
- [python-service/main.py](python-service/main.py) — `/extract` endpoint, scores ORG/PRODUCT entities, boosts matches that hit the URL's domain root or page title.

## How extraction works (the important part)
The `page.evaluate()` block in route.ts is where everything happens. It:
1. Walks every DOM element to collect computed colors, fonts, font sizes.
2. **Logo extraction runs a stack of strategies in this order**, each pushing to a shared `logos[]` array:
   - Text wordmark inside the home link (renders the text node as an SVG via `textToSvgDataUri`) — handles cases like `<a href="/"><p>Cyces.</p></a>`.
   - `og:image` / `twitter:image` (fetched and converted to base64 data URI).
   - **Score-based detection** — scans all `<img>` and `<svg>` near the top of the page, scoring by position, aspect ratio, "logo/brand/wordmark" hints in class/id/alt, and whether the element sits inside a home link.
   - Nav / header scan (home link first, then any img, then svgs).
   - `[class*='logo']` / `[id*='logo']` selectors.
   - `apple-touch-icon`, large favicons, default `/favicon.ico` as last resort.
3. Returns colors, fonts, headings, body styles, logos (as data URIs), favicon, title/description/themeColor, and full visible `pageText` (capped 200k) for the spaCy NER step.

Outside `evaluate()`: takes a viewport screenshot, POSTs `pageText`+`title`+`url` to spaCy sidecar, ranks colors by frequency (drops pure black/white), assembles `palette.primary` from theme-color + button bg + link color, and ships the final JSON.

## Known gaps / things to keep in mind
- **No social-media-specific handling.** Pointing this at LinkedIn/Instagram/Facebook URLs will hit auth walls — Puppeteer isn't logged in, so it scrapes the login page, not the brand. There's no API integration for any social platform yet.
- The frontend's `BrandData` type has a `logoVariants` field (`{type, theme, src}[]`) and renders it preferentially over `logos[]`, **but the API never populates it**. It's dead UI waiting for a backend to return variant-tagged logos (white/black, symbol/wordmark).
- All logos are returned as base64 data URIs, which makes the response payload large.
- Many heuristics in the logo stack overlap (og:image is checked twice; nav scan and score-based scan both look in the header). Worth consolidating before adding new sources.

## How to approach changes here
- **Don't trust your Next.js memory** — read the bundled docs in `node_modules/next/dist/docs/` first if touching routing, server actions, config, or anything framework-shaped.
- The logo extractor is a pile of heuristics, not a clean pipeline. When fixing logo bugs, add a new strategy or tighten an existing one — don't rewrite the stack unless asked. Order matters: earlier strategies win.
- Anything inside `page.evaluate()` runs in the **browser context**, not Node — no Node APIs, no imports, must be self-contained.
- The spaCy sidecar is optional; the route falls through gracefully if it's unreachable. Don't make it a hard dependency.
- Before touching social-media support: confirm with the user whether they want official APIs (LinkedIn/Meta Graph), og-only fallback, or "resolve the company's own site from the social profile and scrape that." Each is a very different implementation.
