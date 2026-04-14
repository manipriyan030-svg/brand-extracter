import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let browser;
  try {
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    const browserlessToken = process.env.BROWSERLESS_TOKEN;

    if (browserlessToken) {
      // Use Browserless.io for hosted Chrome
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
      });
    } else if (isVercel) {
      // Use @sparticuz/chromium on Vercel serverless
      const chromium = (await import("@sparticuz/chromium-min")).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar"
        ),
        headless: true,
      });
    } else {
      // Local development — use locally installed Chrome
      browser = await puppeteer.launch({
        headless: true,
        channel: "chrome",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
      });
    }

    const page = await browser.newPage();
    // Force a desktop viewport so Tailwind `md:` / `lg:` styles apply.
    // Many sites use `text-white md:text-black` on the brand wordmark — at a
    // mobile-sized viewport the logo would render white-on-white and be invisible.
    await page.setViewport({ width: 1366, height: 800, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const brandData = await page.evaluate(async () => {
      // Extract colors from computed styles
      const colorSet = new Set<string>();
      const elements = document.querySelectorAll("*");

      elements.forEach((el) => {
        const style = getComputedStyle(el);
        const props = [
          "color",
          "backgroundColor",
          "borderColor",
          "outlineColor",
        ];
        props.forEach((prop) => {
          const val = style.getPropertyValue(
            prop.replace(/([A-Z])/g, "-$1").toLowerCase()
          );
          if (
            val &&
            val !== "rgba(0, 0, 0, 0)" &&
            val !== "transparent" &&
            val !== "inherit"
          ) {
            colorSet.add(val);
          }
        });
      });

      // === FONT EXTRACTION ===
      // Two sources, in order of trust:
      //   1. @font-face rules from same-origin stylesheets — these are the REAL
      //      fonts the page actually loads (including Next.js mangled ones with
      //      their src URLs).
      //   2. Computed font-family stacks from elements, with aggressive filtering
      //      to drop emoji/symbol/system fallback fonts that browsers append.

      const GENERIC_FONTS = new Set([
        "serif", "sans-serif", "monospace", "cursive", "fantasy",
        "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
        "inherit", "initial", "unset", "revert", "math", "emoji",
        "-apple-system", "blinkmacsystemfont",
      ]);
      // Icon / utility fonts that should never appear as brand typography
      const ICON_FONTS = new Set([
        "webflow-icons", "fontawesome", "font awesome", "fa", "glyphicons",
        "material icons", "material-icons", "ionicons", "icomoon",
        "remixicon", "feather", "bootstrap-icons", "octicons", "heroicons",
        "phosphor", "tabler-icons", "boxicons", "linearicons",
        "icon-font", "icon_font", "icons",
      ]);
      const isIconFont = (name: string): boolean => {
        const lower = name.toLowerCase().trim();
        if (ICON_FONTS.has(lower)) return true;
        if (/icon|glyph|awesome|symbol/i.test(lower) && !/iconic/i.test(lower)) return true;
        return false;
      };

      const isGenericFont = (name: string): boolean => {
        const lower = name.toLowerCase().trim();
        if (!lower) return true;
        if (GENERIC_FONTS.has(lower)) return true;
        if (/emoji|symbol|wingdings|webdings/i.test(lower)) return true;
        if (/^-?(webkit|moz|ms|apple)-/.test(lower)) return true;
        if (isIconFont(lower)) return true;
        return false;
      };

      // Mangled names: Next.js generates "__FontName_hash" or "__fN_hash"
      const isMangledName = (name: string): boolean => {
        return /^__/.test(name) || /^[0-9a-f]{6,}$/i.test(name);
      };

      // 1. Collect real font names from CSS font-family declarations in stylesheets
      //    (not computed styles — those can return fallback fonts)
      type WebFont = { family: string; src: string };
      const webFonts: WebFont[] = [];
      const seenFamilies = new Set<string>();

      // Scan all stylesheets for font-family values used in regular rules
      // This gets the EXACT names the website author wrote in CSS
      const cssUsedFonts = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList | null = null;
        try { rules = sheet.cssRules; } catch { continue; }
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          // @font-face rules — source of truth for loaded fonts
          if (rule.constructor.name === "CSSFontFaceRule" || (rule as CSSRule).type === 5) {
            const ffr = rule as CSSFontFaceRule;
            const family = ffr.style.getPropertyValue("font-family").replace(/['"]/g, "").trim();
            if (!family || isGenericFont(family)) continue;

            const srcRaw = ffr.style.getPropertyValue("src") || "";
            const urlMatch = srcRaw.match(/url\(([^)]+)\)/);
            let absSrc = "";
            if (urlMatch) {
              const u = urlMatch[1].replace(/['"]/g, "").trim();
              try { absSrc = new URL(u, sheet.href || window.location.href).href; }
              catch { absSrc = u; }
            }

            if (!isMangledName(family)) {
              if (!seenFamilies.has(family.toLowerCase())) {
                seenFamilies.add(family.toLowerCase());
                webFonts.push({ family, src: absSrc });
              }
            }
            // Track mangled names for later mapping
            continue;
          }
          // Regular style rules — read font-family property for exact CSS names
          if ((rule as CSSStyleRule).style) {
            const ff = (rule as CSSStyleRule).style.getPropertyValue("font-family");
            if (!ff) continue;
            for (const part of ff.split(",")) {
              const name = part.trim().replace(/['"]/g, "");
              if (name && !isGenericFont(name) && !isMangledName(name)) {
                cssUsedFonts.add(name);
              }
            }
          }
        }
      }

      // 2. Check document.fonts — exact family names of fonts the browser loaded
      const loadedFontNames = new Set<string>();
      if (document.fonts) {
        document.fonts.forEach((f: FontFace) => {
          const raw = f.family.replace(/['"]/g, "").trim();
          if (raw && !isGenericFont(raw) && !isMangledName(raw)) {
            loadedFontNames.add(raw);
          }
        });
      }

      // 3. Google Fonts <link> and @import — exact font names from the URL
      const googleFontNames = new Set<string>();
      const parseFontsFromUrl = (href: string) => {
        const matches = href.matchAll(/family=([^&:]+)/g);
        for (const m of matches) {
          const name = decodeURIComponent(m[1]).replace(/\+/g, " ").trim();
          if (name) googleFontNames.add(name);
        }
      };
      document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach((link) => {
        parseFontsFromUrl(link.getAttribute("href") || "");
      });
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules;
          if (!rules) continue;
          for (const rule of Array.from(rules)) {
            if ((rule as CSSRule).type === 3) {
              const href = (rule as CSSImportRule).href || "";
              if (href.includes("fonts.googleapis.com")) parseFontsFromUrl(href);
            }
          }
        } catch { continue; }
      }

      // 4. Resolve mangled Next.js font names via two strategies:
      //    A) CSS custom properties: --font-<real-name>: "__mangledFont_hash"
      //    B) className rules: .__className_hash { font-family: "__nameFont_hash" }
      //       where the mangled name contains camelCase hint e.g. "sFProFont" → "SF Pro"
      const mangledToReal = new Map<string, string>();

      // Helper: parse a camelCase mangled prefix like "sFPro" or "gI" into "SF Pro" or "GI"
      // Next.js pattern: __<camelCaseAbbrev>Font_<hash>
      const parseMangledName = (mangled: string): string => {
        // Extract the part between __ and Font_
        const match = mangled.match(/^__(.+?)Font_/);
        if (!match) return "";
        const abbr = match[1]; // e.g. "sFPro", "gI", "hellix"
        // Next.js camelCase convention: first word is lowercased initials,
        // subsequent words are title-cased. Split on transition from lowercase to uppercase.
        // "sFPro" → ["sF", "Pro"] → "SF Pro"
        // "gI" → ["gI"] → "GI"  (Glacial Indifference abbrev)
        // "hellix" → ["hellix"] → "Hellix"
        const parts = abbr.split(/(?<=[a-z])(?=[A-Z])/);
        return parts.map(w => w.toUpperCase() === w ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      };

      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList | null = null;
        try { rules = sheet.cssRules; } catch { continue; }
        if (!rules) continue;
        for (const rule of Array.from(rules)) {
          if ((rule as CSSStyleRule).style) {
            const style = (rule as CSSStyleRule).style;
            const selector = (rule as CSSStyleRule).selectorText || "";

            // Strategy A: --font-* CSS custom properties (most reliable)
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith("--font-")) {
                const value = style.getPropertyValue(prop);
                if (value.includes("__")) {
                  const realName = prop
                    .replace("--font-", "")
                    .split("-")
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ");
                  for (const part of value.split(",")) {
                    const mangled = part.trim().replace(/['"]/g, "");
                    if (mangled.startsWith("__") && !mangled.includes("Fallback")) {
                      mangledToReal.set(mangled, realName);
                    }
                  }
                }
              }
            }

            // Strategy B: .__className_hash rules — parse the mangled font-family name
            if (selector.includes("__className_")) {
              const ff = style.getPropertyValue("font-family");
              if (ff) {
                for (const part of ff.split(",")) {
                  const mangled = part.trim().replace(/['"]/g, "");
                  if (mangled.startsWith("__") && !mangled.includes("Fallback") && !mangledToReal.has(mangled)) {
                    const parsed = parseMangledName(mangled);
                    if (parsed) mangledToReal.set(mangled, parsed);
                  }
                }
              }
            }
          }
        }
      }

      // 5. Collect fonts actually used in computed styles of TEXT elements
      //    Skip <i>/<span> used as icon containers to avoid icon fonts polluting the list
      const TEXT_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "A", "SPAN", "DIV", "LI", "BUTTON", "LABEL", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "NAV"]);
      const computedFontNames = new Set<string>();
      elements.forEach((el) => {
        if (!TEXT_TAGS.has(el.tagName)) return;
        // Skip elements that are likely icon containers (empty or just have icon child)
        const text = el.textContent?.trim() || "";
        if (!text || text.length < 2) return;
        const ff = getComputedStyle(el).fontFamily;
        if (!ff) return;
        for (const part of ff.split(",")) {
          const name = part.trim().replace(/['"]/g, "");
          if (name && !isGenericFont(name) && !isMangledName(name)) {
            computedFontNames.add(name);
          }
        }
      });

      // 6. Build final font list — prioritize fonts that were ACTUALLY USED in elements
      const fontSet = new Set<string>();
      // Google Fonts names from <link> tags are exact and authoritative
      googleFontNames.forEach((f) => fontSet.add(f));
      // Resolved mangled Next.js font names (CSS custom props are the most reliable mapping)
      mangledToReal.forEach((realName) => fontSet.add(realName));
      // @font-face names only if they appear in computed styles (avoid icon/utility fonts)
      webFonts.forEach((wf) => {
        if (computedFontNames.has(wf.family)) fontSet.add(wf.family);
      });
      // Computed style names that are also declared in @font-face (verified as loaded custom fonts)
      computedFontNames.forEach((f) => {
        if (seenFamilies.has(f.toLowerCase()) || googleFontNames.has(f)) {
          fontSet.add(f);
        }
      });
      // document.fonts loaded names only if they appear in computed styles
      loadedFontNames.forEach((f) => {
        if (computedFontNames.has(f)) fontSet.add(f);
      });

      // Extract font sizes
      const fontSizeMap = new Map<string, number>();
      elements.forEach((el) => {
        const style = getComputedStyle(el);
        const size = style.fontSize;
        if (size) {
          fontSizeMap.set(size, (fontSizeMap.get(size) || 0) + 1);
        }
      });
      const fontSizes = [...fontSizeMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([size]) => size);

      // === BRAND LOGO EXTRACTION ===
      // Primary source: og:image (the brand's own social/share image).
      const logos: string[] = [];
      // If a text wordmark is found (e.g. "Cyces."), we record its bounding rect
      // here and screenshot it AFTER page.evaluate() returns, using Puppeteer's
      // page.screenshot({ clip }). This captures real pixels with the real web
      // font — generating an SVG inline doesn't work because SVG <img> contexts
      // don't load the page's fonts, so custom fonts fall back to Times.
      let wordmarkRect: { x: number; y: number; width: number; height: number } | null = null;
      const WORDMARK_PLACEHOLDER = "__WORDMARK_PLACEHOLDER__";

      // Helper: fetch an image URL and convert to base64 data URI
      async function fetchAsDataUri(imgUrl: string): Promise<string | null> {
        try {
          const resp = await fetch(imgUrl);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      }

      // Helper: serialize SVG to base64 data URI
      function svgToDataUri(svg: Element): string | null {
        const rect = svg.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return null;
        const clone = svg.cloneNode(true) as SVGElement;
        if (!clone.getAttribute("width")) clone.setAttribute("width", String(rect.width));
        if (!clone.getAttribute("height")) clone.setAttribute("height", String(rect.height));
        if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

        // Resolve <use href="#id"> / <use xlink:href="#id"> by inlining the
        // referenced <symbol> or element content so the SVG is self-contained.
        clone.querySelectorAll("use").forEach((use) => {
          const ref = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
          if (!ref.startsWith("#")) return;
          const target = document.querySelector(ref);
          if (!target) return;
          // If it's a <symbol>, grab its children; otherwise clone the target.
          const replacement = document.createElementNS("http://www.w3.org/2000/svg", "g");
          const source = target.tagName.toLowerCase() === "symbol" ? target : target;
          for (const child of Array.from(source.childNodes)) {
            replacement.appendChild(child.cloneNode(true));
          }
          // Copy viewBox from <symbol> as a transform if needed
          if (target.tagName.toLowerCase() === "symbol" && target.getAttribute("viewBox")) {
            replacement.setAttribute("viewBox", target.getAttribute("viewBox")!);
          }
          // Preserve transform/position attributes from <use>
          const x = use.getAttribute("x");
          const y = use.getAttribute("y");
          if (x || y) replacement.setAttribute("transform", `translate(${x || 0}, ${y || 0})`);
          use.parentNode?.replaceChild(replacement, use);
        });

        // Resolve currentColor — grab the computed color from the original SVG
        // so fills/strokes render correctly outside the page context.
        const computedColor = getComputedStyle(svg).color || "#000";
        let svgStr = new XMLSerializer().serializeToString(clone);
        svgStr = svgStr.replace(/currentColor/g, computedColor);

        try {
          return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
        } catch {
          // Fallback: percent-encode instead of base64
          return "data:image/svg+xml," + encodeURIComponent(svgStr);
        }
      }

      // STRATEGY: text wordmark inside a home link (e.g. <a href="/"><p>Cyces.</p></a>)
      //
      // We search the whole document for <a href="/"> (or equivalent) — the brand
      // link is often inside a plain <div>, not a <header>/<nav>, so we can't rely
      // on the container. Instead we rank candidates by position: the one closest
      // to the top-left of the viewport wins. That's where brand logos live.
      //
      // Image-based home links are skipped — they'll be handled by the score-based
      // strategy below.
      {
        const hostname = window.location.hostname;
        const isHomeHref = (a: Element) => {
          const href = a.getAttribute("href") || "";
          if (href === "/" || href === "./") return true;
          if (href.endsWith("//" + hostname) || href.endsWith("//" + hostname + "/")) return true;
          return false;
        };

        type WordmarkCandidate = {
          el: Element;
          rect: DOMRect;
          score: number;
        };
        const candidates: WordmarkCandidate[] = [];

        const homeLinks = Array.from(document.querySelectorAll("a")).filter(isHomeHref);
        for (const link of homeLinks) {
          if (link.querySelector("img, svg")) continue; // image logo, not a wordmark

          // Leaf text elements in document order — first one wins per link.
          const textEls: Element[] = Array.from(link.querySelectorAll("p, span, h1, h2, h3, div"))
            .filter((el) => (el.textContent || "").trim().length > 0 && (el.textContent || "").trim().length <= 25)
            .filter((el) => !el.querySelector("p, span, h1, h2, h3, div"));
          if (textEls.length === 0) {
            const t = (link.textContent || "").trim();
            if (t.length > 0 && t.length <= 25) textEls.push(link);
          }

          for (const el of textEls) {
            const rect = el.getBoundingClientRect();
            if (rect.top < 0 || rect.top > 200) continue;
            if (rect.width < 10 || rect.height < 8) continue;
            // Score: lower top + lower left = higher score. Top-left wins.
            const score = (200 - rect.top) * 2 + Math.max(0, 600 - rect.left);
            candidates.push({ el, rect, score });
            break; // first text element per link
          }
        }

        candidates.sort((a, b) => b.score - a.score);
        if (candidates.length > 0) {
          const winner = candidates[0];
          wordmarkRect = {
            x: winner.rect.x,
            y: winner.rect.y,
            width: winner.rect.width,
            height: winner.rect.height,
          };
          logos.push(WORDMARK_PLACEHOLDER); // reserves the slot so later strategies skip
        }
      }

      // STRATEGY 0: Score-based detection — find the brand logo by combining
      // position (top of page, left side), shape (logo-like aspect), and
      // semantic hints (inside home link, "logo"/"brand" in class/alt/id).
      {
        type Candidate = { el: HTMLImageElement | SVGElement; score: number; isImg: boolean };
        const candidates: Candidate[] = [];
        const hostname = window.location.hostname;

        function scoreEl(el: Element, isImg: boolean): number | null {
          const rect = el.getBoundingClientRect();
          if (rect.top < 0 || rect.top > 250) return null;
          if (rect.width < 24 || rect.width > 500) return null;
          if (rect.height < 12 || rect.height > 200) return null;
          const ar = rect.width / rect.height;
          if (ar < 0.5 || ar > 12) return null;

          let score = 0;
          // Higher = more left, more top
          score += Math.max(0, 250 - rect.top);
          score += Math.max(0, 400 - rect.left) * 0.5;
          // Logo-like aspect ratio (wordmarks are wide-ish)
          if (ar >= 1.5 && ar <= 6) score += 80;
          // Reasonable logo width
          if (rect.width >= 80 && rect.width <= 280) score += 60;

          // Semantic hints from element + ancestors (up to 4 levels)
          const hintText = (s: string) => /logo|brand|wordmark/i.test(s);
          let node: Element | null = el;
          for (let i = 0; i < 4 && node; i++) {
            const cls = node.className && typeof node.className === "string" ? node.className : (node.getAttribute("class") || "");
            const id = node.id || "";
            if (hintText(cls) || hintText(id)) { score += 200; break; }
            node = node.parentElement;
          }
          if (isImg) {
            const img = el as HTMLImageElement;
            const alt = img.alt || "";
            if (hintText(alt)) score += 150;
            if (/logo|brand/i.test(img.src)) score += 100;
          }
          // Inside a home link → very strong signal
          const link = el.closest("a");
          if (link) {
            const href = link.getAttribute("href") || "";
            if (href === "/" || href === "./" || href.endsWith("//" + hostname) || href.endsWith("//" + hostname + "/")) {
              score += 300;
            }
          }
          // Penalize tiny square icons (likely UI icons)
          if (rect.width < 40 && rect.height < 40) score -= 100;
          return score;
        }

        document.querySelectorAll("img").forEach((img) => {
          if (!(img as HTMLImageElement).src) return;
          const s = scoreEl(img, true);
          if (s !== null) candidates.push({ el: img, score: s, isImg: true });
        });
        document.querySelectorAll("svg").forEach((svg) => {
          const s = scoreEl(svg, false);
          if (s !== null) candidates.push({ el: svg, score: s, isImg: false });
        });

        candidates.sort((a, b) => b.score - a.score);
        for (const c of candidates) {
          if (logos.length >= 1) break;
          if (c.isImg) {
            const dataUri = await fetchAsDataUri((c.el as HTMLImageElement).src);
            if (dataUri && dataUri.length > 200) logos.push(dataUri);
          } else {
            const dataUri = svgToDataUri(c.el);
            if (dataUri) logos.push(dataUri);
          }
        }
      }

      // STRATEGY: Find brand logo from multiple sources, prioritized
      // Look in nav first (navigation bar), then header, then fallback selectors
      const navArea = document.querySelector("nav");
      const headerArea = document.querySelector("header");
      const topAreas = [navArea, headerArea, document.querySelector("[class*='navbar']"), document.querySelector("[class*='header']")].filter(Boolean) as Element[];

      // 1. Look for IMG in nav/header area (home link first)
      for (const area of topAreas) {
        if (logos.length >= 2) break;
        // Prioritize images inside home links
        const homeLink = area.querySelector("a[href='/'], a[href*='://'][href$='" + window.location.hostname + "'], a[href*='://'][href$='" + window.location.hostname + "/']");
        if (homeLink) {
          const img = homeLink.querySelector("img");
          if (img && img.src && img.naturalWidth > 5) {
            const dataUri = await fetchAsDataUri(img.src);
            if (dataUri && dataUri.length > 200) logos.push(dataUri);
          }
          const svg = homeLink.querySelector("svg");
          if (svg && logos.length === 0) {
            const dataUri = svgToDataUri(svg);
            if (dataUri) logos.push(dataUri);
          }
        }
        // Then any images in the area
        if (logos.length === 0) {
          for (const img of area.querySelectorAll("img")) {
            if (logos.length >= 2) break;
            if (img.src && img.naturalWidth > 10 && img.naturalWidth < 500) {
              const dataUri = await fetchAsDataUri(img.src);
              if (dataUri && dataUri.length > 200) logos.push(dataUri);
            }
          }
        }
        // SVGs in the area (first meaningful one)
        if (logos.length === 0) {
          for (const svg of area.querySelectorAll("svg")) {
            if (logos.length >= 1) break;
            const rect = svg.getBoundingClientRect();
            if (rect.width > 20 && rect.height > 15) {
              const dataUri = svgToDataUri(svg);
              if (dataUri) logos.push(dataUri);
            }
          }
        }
      }

      // 2. Elements with "logo" in class/id (only first match)
      if (logos.length === 0) {
        const logoImg = document.querySelector("[class*='logo'] img, [id*='logo'] img, [class*='Logo'] img, [class*='brand'] img");
        if (logoImg) {
          const src = (logoImg as HTMLImageElement).src;
          if (src) {
            const dataUri = await fetchAsDataUri(src);
            if (dataUri && dataUri.length > 200) logos.push(dataUri);
          }
        }
      }
      if (logos.length === 0) {
        const logoSvg = document.querySelector("[class*='logo'] svg, [id*='logo'] svg, [class*='Logo'] svg");
        if (logoSvg) {
          const dataUri = svgToDataUri(logoSvg);
          if (dataUri) logos.push(dataUri);
        }
      }

      // FALLBACKS — only run if DOM-based strategies above found nothing.
      // og:image is intentionally NOT used as a primary logo source: for most sites
      // it's a marketing share card (banner with tagline), not the actual brand logo.
      if (logos.length === 0) {
        // 3. apple-touch-icon
        const touchIcon = (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href
          || (document.querySelector('link[rel="apple-touch-icon-precomposed"]') as HTMLLinkElement)?.href;
        if (touchIcon) {
          const dataUri = await fetchAsDataUri(touchIcon);
          if (dataUri && dataUri.length > 200) logos.push(dataUri);
        }
      }
      if (logos.length === 0) {
        // 4. Large favicon
        const faviconLarge = (document.querySelector('link[rel="icon"][sizes="192x192"]') as HTMLLinkElement)?.href
          || (document.querySelector('link[rel="icon"][sizes="180x180"]') as HTMLLinkElement)?.href
          || (document.querySelector('link[rel="icon"][type="image/png"]') as HTMLLinkElement)?.href;
        if (faviconLarge) {
          const dataUri = await fetchAsDataUri(faviconLarge);
          if (dataUri && dataUri.length > 200) logos.push(dataUri);
        }
      }
      if (logos.length === 0) {
        // 5. og:image as last-resort (better than nothing)
        const ogImage = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content
          || (document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement)?.content;
        if (ogImage) {
          const dataUri = await fetchAsDataUri(ogImage);
          if (dataUri && dataUri.length > 200) logos.push(dataUri);
        }
      }
      if (logos.length === 0) {
        // 6. Default favicon
        const dataUri = await fetchAsDataUri(new URL("/favicon.ico", window.location.origin).href);
        if (dataUri && dataUri.length > 200) logos.push(dataUri);
      }

      // Favicon — prefer the largest available icon
      const favicon =
        (document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="apple-touch-icon-precomposed"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][sizes="192x192"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][sizes="180x180"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][sizes="128x128"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][sizes="96x96"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][type="image/png"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"][type="image/svg+xml"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href ||
        (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement)?.href ||
        new URL("/favicon.ico", window.location.origin).href;

      // Meta info
      const title = document.title;
      const description =
        (document.querySelector('meta[name="description"]') as HTMLMetaElement)
          ?.content || "";
      const themeColor =
        (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement)
          ?.content || "";

      // Button styles
      const buttons = document.querySelectorAll("button, a.btn, [class*='button'], [class*='btn']");
      const buttonColors: string[] = [];
      buttons.forEach((btn) => {
        const style = getComputedStyle(btn);
        const bg = style.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && !buttonColors.includes(bg)) {
          buttonColors.push(bg);
        }
      });

      // Link color
      const link = document.querySelector("a");
      const linkColor = link ? getComputedStyle(link).color : "";

      // Heading styles — pick the first non-system font from the stack and
      // return it exactly as declared.
      const pickFontForDisplay = (rawStack: string): string => {
        for (const part of rawStack.split(",")) {
          const cleaned = part.trim().replace(/['"]/g, "");
          if (!cleaned || isGenericFont(cleaned)) continue;
          if (isMangledName(cleaned)) {
            const real = mangledToReal.get(cleaned);
            if (real) return real;
            continue;
          }
          return cleaned;
        }
        return rawStack.split(",")[0]?.trim().replace(/['"]/g, "") || "";
      };

      const headings: { tag: string; font: string; size: string; weight: string; color: string }[] = [];
      ["h1", "h2", "h3"].forEach((tag) => {
        const el = document.querySelector(tag);
        if (el) {
          const s = getComputedStyle(el);
          headings.push({
            tag,
            font: pickFontForDisplay(s.fontFamily),
            size: s.fontSize,
            weight: s.fontWeight,
            color: s.color,
          });
        }
      });

      // Visible page text (for spaCy NER)
      const pageText = (document.body?.innerText || "").slice(0, 200000);

      // Body text
      const body = document.querySelector("body");
      const bodyStyle = body ? getComputedStyle(body) : null;
      const bodyFonts = bodyStyle ? bodyStyle.fontFamily.split(",").map(f => {
        const raw = f.trim().replace(/['"]/g, "");
        if (isMangledName(raw)) return mangledToReal.get(raw) || "";
        return raw;
      }) : [];
      const bodyFont = bodyFonts.find(f => f && !isGenericFont(f)) || "";
      const bodyColor = bodyStyle ? bodyStyle.color : "";
      const bodyBg = bodyStyle ? bodyStyle.backgroundColor : "";

      return {
        colors: [...colorSet],
        fonts: [...fontSet],
        webFonts,
        fontSizes,
        logos,
        wordmarkRect,
        favicon,
        title,
        description,
        themeColor,
        buttonColors,
        linkColor,
        headings,
        bodyFont,
        bodyColor,
        bodyBg,
        pageText,
      };
    });

    // If a text wordmark was identified, capture it as a real PNG via Puppeteer.
    // This renders with the page's actual web fonts (impossible inside SVG <img>).
    if (brandData.wordmarkRect) {
      const r = brandData.wordmarkRect;
      // Asymmetric padding: generous on the sides for visual breathing room,
      // tight on top/bottom so we don't bleed into the header bar's borders
      // (e.g. cyces.co has hairline accents above/below the sticky nav).
      const padX = 16;
      const padY = 4;
      const clip = {
        x: Math.max(0, Math.floor(r.x - padX)),
        y: Math.max(0, Math.floor(r.y - padY)),
        width: Math.ceil(r.width + padX * 2),
        height: Math.ceil(r.height + padY * 2),
      };
      try {
        // encoding: "base64" returns a string directly — Puppeteer v24 returns
        // Uint8Array (not Node Buffer) by default, so .toString("base64") would
        // silently produce garbage.
        const b64 = (await page.screenshot({ clip, type: "png", encoding: "base64" })) as unknown as string;
        const dataUri = `data:image/png;base64,${b64}`;
        const idx = brandData.logos.indexOf("__WORDMARK_PLACEHOLDER__");
        if (idx >= 0) brandData.logos[idx] = dataUri;
      } catch {
        brandData.logos = brandData.logos.filter((l) => l !== "__WORDMARK_PLACEHOLDER__");
      }
    }

    // Take a screenshot
    const screenshot = await page.screenshot({ encoding: "base64", type: "png", fullPage: false });

    await browser.close();

    // Use only the website's actual scraped logos (no third-party sources)
    const finalLogos: string[] = brandData.logos;
    // Track how many are actual logos (before favicon is appended)
    const logoCount = finalLogos.length;

    // Always include favicon as a logo if we have one and it's not already in the list
    if (brandData.favicon) {
      try {
        const favResp = await fetch(brandData.favicon);
        if (favResp.ok) {
          const favBuf = Buffer.from(await favResp.arrayBuffer());
          const contentType = favResp.headers.get("content-type") || "image/x-icon";
          const favDataUri = `data:${contentType};base64,${favBuf.toString("base64")}`;
          // Only add if not a duplicate of an existing logo
          if (!finalLogos.some((l) => l === favDataUri)) {
            finalLogos.push(favDataUri);
          }
        }
      } catch {
        // favicon fetch failed — skip
      }
    }

    // Call spaCy sidecar for brand-name NER
    const spacyUrl = process.env.SPACY_SERVICE_URL || "http://localhost:8000";
    let brandName = "";
    let brandCandidates: { name: string; count: number }[] = [];
    try {
      const nerResp = await fetch(`${spacyUrl}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: brandData.pageText, title: brandData.title, url }),
        signal: AbortSignal.timeout(10000),
      });
      if (nerResp.ok) {
        const ner = await nerResp.json();
        brandName = ner.brand || "";
        brandCandidates = ner.candidates || [];
      }
    } catch {
      // sidecar unavailable — continue without NER
    }

    // Process colors - convert to hex and rank by frequency
    const colorCount = new Map<string, number>();
    brandData.colors.forEach((c) => {
      const hex = rgbToHex(c);
      if (hex && hex !== "#000000" && hex !== "#ffffff") {
        colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      }
    });

    const rankedColors = [...colorCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([hex]) => hex);

    // Add bg, text, theme, button, link colors as primary
    const primaryColors: string[] = [];
    if (brandData.themeColor) primaryColors.push(brandData.themeColor);
    brandData.buttonColors.forEach((c) => {
      const hex = rgbToHex(c);
      if (hex && !primaryColors.includes(hex)) primaryColors.push(hex);
    });
    if (brandData.linkColor) {
      const hex = rgbToHex(brandData.linkColor);
      if (hex && !primaryColors.includes(hex)) primaryColors.push(hex);
    }

    // Convert favicon URL to high-quality data URI
    let faviconDataUri = "";
    if (brandData.favicon) {
      try {
        const favResp2 = await fetch(brandData.favicon);
        if (favResp2.ok) {
          const buf = Buffer.from(await favResp2.arrayBuffer());
          const ct = favResp2.headers.get("content-type") || "image/x-icon";
          faviconDataUri = `data:${ct};base64,${buf.toString("base64")}`;
        }
      } catch { /* skip */ }
    }

    const responseData = {
      url,
      title: brandData.title,
      description: brandData.description,
      screenshot: `data:image/png;base64,${screenshot}`,
      palette: {
        primary: primaryColors.slice(0, 4),
        all: rankedColors,
        background: rgbToHex(brandData.bodyBg) || "#ffffff",
        text: rgbToHex(brandData.bodyColor) || "#000000",
      },
      typography: {
        fonts: brandData.fonts.slice(0, 5),
        webFonts: brandData.webFonts.slice(0, 8),
        bodyFont: brandData.bodyFont,
        headings: brandData.headings,
        fontSizes: brandData.fontSizes,
      },
      logos: finalLogos.slice(0, 6),
      logoCount: Math.min(logoCount, 6),
      favicon: faviconDataUri || brandData.favicon,
      brand: {
        name: brandName,
        candidates: brandCandidates,
      },
    };

    // Fetch previous extraction for this URL (to compute diff)
    let brandDiff: Record<string, unknown> | null = null;
    try {
      const { data: prevRows } = await supabase
        .from("brand_extractions")
        .select("palette, typography, logos, logo_count, extracted_at")
        .eq("url", url)
        .order("extracted_at", { ascending: false })
        .limit(1);

      if (prevRows && prevRows.length > 0) {
        const prev = prevRows[0];
        const diff: {
          colors?: { added: string[]; removed: string[] };
          fonts?: { added: string[]; removed: string[] };
          logos?: { previousLogos: string[]; newLogos: string[] };
          extractedAt?: string;
          noChanges?: boolean;
        } = { extractedAt: prev.extracted_at };

        // Color diff
        const prevColors: string[] = [
          ...(prev.palette?.primary || []),
          ...(prev.palette?.all || []),
        ].filter((c: string, i: number, a: string[]) => a.indexOf(c) === i);
        const newColors = [
          ...responseData.palette.primary,
          ...responseData.palette.all,
        ].filter((c, i, a) => a.indexOf(c) === i);
        const addedColors = newColors.filter((c) => !prevColors.includes(c));
        const removedColors = prevColors.filter((c) => !newColors.includes(c));
        if (addedColors.length > 0 || removedColors.length > 0) {
          diff.colors = { added: addedColors, removed: removedColors };
        }

        // Font diff
        const prevFonts: string[] = prev.typography?.fonts || [];
        const newFonts: string[] = responseData.typography.fonts;
        const addedFonts = newFonts.filter((f) => !prevFonts.includes(f));
        const removedFonts = prevFonts.filter((f) => !newFonts.includes(f));
        if (addedFonts.length > 0 || removedFonts.length > 0) {
          diff.fonts = { added: addedFonts, removed: removedFonts };
        }

        // Logo diff — compare actual image data URIs, not just count.
        // Logos are large base64 strings; compare the first ~300 chars as a
        // fast fingerprint (the header + initial pixel data is unique enough).
        const prevLogos: string[] = (prev.logos || []).slice(0, prev.logo_count ?? 6);
        const newLogosForDiff = finalLogos.slice(0, logoCount); // actual logos, no favicon
        const fingerprint = (src: string) => src.slice(0, 300);
        const prevPrints = new Set(prevLogos.map(fingerprint));
        const newPrints = new Set(newLogosForDiff.map(fingerprint));
        const logosChanged =
          prevLogos.length !== newLogosForDiff.length ||
          newLogosForDiff.some((l) => !prevPrints.has(fingerprint(l))) ||
          prevLogos.some((l) => !newPrints.has(fingerprint(l)));

        if (logosChanged) {
          diff.logos = {
            previousLogos: prevLogos,
            newLogos: newLogosForDiff,
          };
        }

        // Only include diff if something actually changed
        if (diff.colors || diff.fonts || diff.logos) {
          brandDiff = diff;
        } else {
          brandDiff = { noChanges: true, extractedAt: prev.extracted_at };
        }
      }
    } catch (diffErr) {
      console.error("Diff fetch error:", diffErr);
    }

    // Save to Supabase (non-blocking — don't fail the response if DB write fails)
    supabase
      .from("brand_extractions")
      .insert({
        url,
        title: brandData.title,
        description: brandData.description,
        brand_name: brandName,
        palette: responseData.palette,
        typography: responseData.typography,
        logos: finalLogos.slice(0, 6),
        logo_count: Math.min(logoCount, 6),
        favicon: faviconDataUri || brandData.favicon,
        screenshot: `data:image/png;base64,${screenshot}`,
      })
      .then(({ error }) => {
        if (error) console.error("Supabase insert error:", error.message);
        else console.log("Saved extraction to Supabase for:", url);
      });

    return NextResponse.json({ ...responseData, brandDiff });
  } catch (err) {
    if (browser) await browser.close();
    
    const message = err instanceof Error ? err.message : "Unknown error";
    
    // Check if this is a Chrome not found error
    if (message.includes("Could not find Chrome") || message.includes("Executable doesn't exist") || message.includes("ENOENT")) {
      const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
      console.error("❌ Chrome not found.", isVercel ? "On Vercel deployment." : "Run: npm run setup:puppeteer");

      return NextResponse.json(
        {
          error: "Chrome not installed",
          details: message,
          fix: isVercel
            ? "Add BROWSERLESS_TOKEN environment variable or ensure Chrome is installed during build."
            : "Run: npm run setup:puppeteer",
          environment: isVercel ? "vercel" : "local",
          browserless: "Consider using Browserless.io for easier deployment"
        },
        { status: 503 }
      );
    }
    
    console.error("❌ Extraction error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function rgbToHex(rgb: string): string | null {
  if (!rgb) return null;
  if (rgb.startsWith("#")) return rgb.toLowerCase();
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const [, r, g, b] = match.map(Number);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
