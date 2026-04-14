"use client";

import { useState, useRef, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP);
}

interface BrandData {
  url: string;
  title: string;
  description: string;
  screenshot: string;
  palette: {
    primary: string[];
    all: string[];
    background: string;
    text: string;
  };
  typography: {
    fonts: string[];
    bodyFont: string;
    headings: { tag: string; font: string; size: string; weight: string; color: string }[];
    fontSizes: string[];
  };
  logos: string[];
  logoCount?: number;
  logoVariants?: { type: string; theme: string; src: string }[];
  favicon: string;
  brand?: { name: string; candidates: { name: string; count: number }[] };
  shareId?: string | null;
  brandDiff?: {
    noChanges?: boolean;
    extractedAt?: string;
    colors?: { added: string[]; removed: string[] };
    fonts?: { added: string[]; removed: string[] };
    logos?: { previousLogos: string[]; newLogos: string[] };
  } | null;
}

// === COLOR HELPERS ===
function hexToRgbTuple(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function hexToRgbStr(hex: string): string {
  const t = hexToRgbTuple(hex);
  return t ? `${t[0]}, ${t[1]}, ${t[2]}` : hex;
}

function hexToHsl(hex: string): string {
  const t = hexToRgbTuple(hex);
  if (!t) return "";
  const [r, g, b] = t.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

function hexToCmyk(hex: string): string {
  const t = hexToRgbTuple(hex);
  if (!t) return "";
  const [r, g, b] = t.map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return "0, 0, 0, 100";
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return `${Math.round(c * 100)}, ${Math.round(m * 100)}, ${Math.round(y * 100)}, ${Math.round(k * 100)}`;
}

function colorName(hex: string): string {
  const t = hexToRgbTuple(hex);
  if (!t) return "";
  const [r, g, b] = t;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const sat = max === min ? 0 : (max - min) / (max + min);
  if (sat < 0.1) {
    if (l < 0.1) return "Black";
    if (l > 0.95) return "White";
    if (l < 0.35) return "Charcoal";
    if (l < 0.6) return "Gray";
    return "Light gray";
  }
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  if (hue < 15 || hue >= 345) return "Red";
  if (hue < 45) return "Orange";
  if (hue < 65) return "Yellow";
  if (hue < 170) return "Green";
  if (hue < 200) return "Cyan";
  if (hue < 260) return "Blue";
  if (hue < 290) return "Purple";
  if (hue < 345) return "Pink";
  return "";
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function isLight(hex: string): boolean {
  const t = hexToRgbTuple(hex);
  if (!t) return false;
  const [r, g, b] = t;
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function CopyCell({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <td
      className={`py-3 sm:py-4 px-3 sm:px-5 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors ${className || ""}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <span className="text-xs sm:text-sm font-mono font-semibold text-green-600 dark:text-green-400">Copied!</span> : children}
    </td>
  );
}

function ColorRow({ color }: { color: string }) {
  const name = colorName(color);
  const rgb = hexToRgbStr(color);
  const hsl = hexToHsl(color);
  const cmyk = hexToCmyk(color);
  return (
    <tr className="result-card border-t border-black/[0.06] dark:border-white/[0.06] transition-colors">
      <CopyCell value={color.toUpperCase()}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg border border-black/10 dark:border-white/10 flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono font-bold text-xs sm:text-sm text-black dark:text-white">
            {color.toUpperCase()}
          </span>
        </div>
      </CopyCell>
      <CopyCell value={name} className="text-xs sm:text-sm text-black/60 dark:text-white/60 font-medium">
        <span>{name}</span>
      </CopyCell>
      <CopyCell value={rgb} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60">
        <span>{rgb}</span>
      </CopyCell>
      <CopyCell value={hsl} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60 hidden! md:table-cell!">
        <span>{hsl}</span>
      </CopyCell>
      <CopyCell value={cmyk} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60 hidden! lg:table-cell!">
        <span>{cmyk}</span>
      </CopyCell>
    </tr>
  );
}

function ShareButton({ shareId }: { shareId: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const link = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm rounded-full border border-black/15 dark:border-white/15 text-black dark:text-white font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden sm:inline text-green-600 dark:text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </button>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrandData | null>(null);
  const [error, setError] = useState("");

  const heroRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const blobsRef = useRef<HTMLDivElement>(null);

  // Tracks which extracted fonts actually loaded successfully (Google Fonts hit)
  // vs which ones are unavailable so we can label the specimen as a fallback.
  const [loadedFonts, setLoadedFonts] = useState<Record<string, boolean>>({});

  // Dynamically inject Google Fonts <link> tags for every extracted font name.
  // Most brand sites use Google Fonts, so this resolves the common case. For
  // fonts that 404 (proprietary/self-hosted), document.fonts.check() will
  // report false and the UI shows a "fallback preview" badge.
  useEffect(() => {
    if (!data?.typography.fonts.length) {
      setLoadedFonts({});
      return;
    }

    // Skip obviously-mangled / generic / system names
    const isUsable = (name: string) => {
      if (!name) return false;
      if (/^__/.test(name)) return false;
      if (/[0-9a-f]{6,}/.test(name)) return false;
      const generic = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial"];
      if (generic.includes(name.toLowerCase())) return false;
      return true;
    };

    const fonts = data.typography.fonts.filter(isUsable);
    const links: HTMLLinkElement[] = [];

    fonts.forEach((font) => {
      const family = font.replace(/\s+/g, "+");
      // Request multiple weights so the heading specimens render correctly
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.fontName = font;
      document.head.appendChild(link);
      links.push(link);
    });

    // After fonts have had a chance to load, check which ones are actually
    // available and update state so the UI can label fallbacks.
    const checkFonts = async () => {
      try {
        if (document.fonts && typeof document.fonts.ready?.then === "function") {
          await document.fonts.ready;
        }
      } catch {
        // ignore
      }
      const result: Record<string, boolean> = {};
      fonts.forEach((font) => {
        try {
          // 16px is the default check size; the second arg is sample text
          result[font] = document.fonts?.check(`16px "${font}"`) ?? false;
        } catch {
          result[font] = false;
        }
      });
      setLoadedFonts(result);
    };

    // Run checks shortly after injection so the network request resolves
    const t1 = setTimeout(checkFonts, 800);
    const t2 = setTimeout(checkFonts, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      links.forEach((l) => l.remove());
    };
  }, [data]);

  // Hero entrance animation
  useGSAP(() => {
    if (data || loading || !heroRef.current) return;
    gsap.set(".hero-badge", { y: 24, opacity: 0 });
    gsap.set(".hero-line", { y: 60, opacity: 0 });
    gsap.set(".hero-sub", { y: 16, opacity: 0 });
    gsap.set(".hero-form", { y: 20, opacity: 0 });
    gsap.set(".hero-chip", { y: 10, opacity: 0 });
    const tl = gsap.timeline({ defaults: { ease: "power3.out", clearProps: "opacity,transform" } });
    tl.to(".hero-badge", { y: 0, opacity: 1, duration: 0.7 })
      .to(".hero-line", { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 }, "<0.3")
      .to(".hero-sub", { y: 0, opacity: 1, duration: 0.7 }, "<0.4")
      .to(".hero-form", { y: 0, opacity: 1, duration: 0.7 }, "<0.2")
      .to(".hero-chip", { y: 0, opacity: 1, duration: 0.5, stagger: 0.05 }, "<0.2");
  }, { dependencies: [data, loading], scope: heroRef });

  // Floating background blobs
  useGSAP(() => {
    if (!blobsRef.current) return;
    const blobs = blobsRef.current.querySelectorAll(".blob");
    blobs.forEach((blob, i) => {
      gsap.to(blob, {
        x: `+=${i % 2 === 0 ? 60 : -80}`,
        y: `+=${i % 2 === 0 ? -50 : 70}`,
        duration: 8 + i * 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });
  }, { scope: blobsRef });

  // Results entrance animation — sidebar slides from left, main content staggers in
  useGSAP(() => {
    if (!data || !resultsRef.current) return;
    gsap.set(".brand-sidebar", { x: -40, opacity: 0 });
    gsap.set(".result-section", { y: 40, opacity: 0 });
    gsap.set(".result-card", { y: 24, opacity: 0 });

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.to(".brand-sidebar", { x: 0, opacity: 1, duration: 0.9, clearProps: "opacity,transform" })
      .to(".result-section", { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, clearProps: "opacity,transform" }, "<0.2")
      .to(".result-card", { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, clearProps: "opacity,transform" }, "<0.2");
  }, { dependencies: [data], scope: resultsRef });

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setData(null);

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to extract brand data");
    } finally {
      setLoading(false);
    }
  }



  const allColors = data
    ? [
        ...data.palette.primary,
        ...(data.palette.background !== "#ffffff" ? [data.palette.background] : []),
        ...(data.palette.text !== "#000000" ? [data.palette.text] : []),
        ...data.palette.all,
      ].filter((c, i, arr) => arr.indexOf(c) === i && /^#[0-9a-f]{6}$/i.test(c))
    : [];

  const heroPrimary = data?.palette.primary[0] || data?.palette.all[0] || "#111111";

  return (
    <div className="h-screen bg-white dark:bg-black relative flex flex-col overflow-hidden" style={data ? { height: 'auto', minHeight: '100vh', overflow: 'visible' } : {}}>
      {/* === ANIMATED BACKGROUND BLOBS === */}
      {!data && (
        <div ref={blobsRef} className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="blob absolute top-[10%] left-[15%] w-[400px] h-[400px] rounded-full bg-orange-500/[0.08] dark:bg-orange-500/[0.12] blur-[120px]" />
          <div className="blob absolute top-[40%] right-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/[0.05] dark:bg-blue-500/[0.08] blur-[120px]" />
          <div className="blob absolute bottom-[10%] left-[40%] w-[450px] h-[450px] rounded-full bg-orange-400/[0.05] dark:bg-orange-400/[0.08] blur-[120px]" />
        </div>
      )}

      {/* === TOP NAV === */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <button
            onClick={() => { setData(null); setUrl(""); setError(""); }}
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.prod.website-files.com/637a83b536c04ad1891311c6/66866eee08b9e45d38e08dc5_Freshboost%20Purple.png"
              alt="Freshboost"
              className="h-7 sm:h-8 w-auto"
            />
          </button>

          {data && (
            <div className="flex items-center gap-2 min-w-0">
              {/* Share button */}
              {data.shareId && <ShareButton shareId={data.shareId} />}
              <form onSubmit={handleExtract} className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter URL..."
                  className="hidden sm:block min-w-0 w-full sm:w-72 px-3 sm:px-4 py-2 text-sm rounded-full bg-white dark:bg-white/5 border border-black/15 dark:border-white/15 text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-3 sm:px-5 py-2 text-sm rounded-full bg-[#eb742e] text-white font-semibold hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-transform shrink-0"
                >
                  {loading ? "..." : <><span className="hidden sm:inline">Extract</span><span className="sm:hidden">⟳ Re-extract</span></>}
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* === HERO === */}
      {!data && !loading && (
        <section ref={heroRef} className="relative max-w-5xl mx-auto px-4 sm:px-6 flex flex-col items-center justify-center flex-1 text-center py-6 sm:py-12 min-h-0">
          <a href="https://freshboost.co" target="_blank" rel="noopener noreferrer" className="hero-badge inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/15 dark:border-white/15 bg-white/60 dark:bg-white/[0.03] backdrop-blur text-black/70 dark:text-white/70 text-[11px] font-bold uppercase tracking-[0.16em] mb-6 sm:mb-8 hover:border-black/30 dark:hover:border-white/30 transition-colors">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-[#eb742e] animate-ping opacity-75" />
              <span className="relative w-2 h-2 rounded-full bg-[#eb742e]" />
            </span>
            A Freshboost tool
          </a>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[-0.04em] text-black dark:text-white leading-[0.92]">
            <span className="hero-line block">Extract any brand&apos;s</span>
            <span className="hero-line block italic font-serif font-normal mt-2">
              design <span className="relative inline-block">
                DNA<span className="text-[#eb742e]">.</span>
              </span>
            </span>
          </h1>

          <p className="hero-sub mt-4 sm:mt-6 text-black/55 dark:text-white/55 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto px-2">
            Drop a URL. Get logos, colors, typography, and the brand name
            pulled straight from the live page.
          </p>

          <form onSubmit={handleExtract} className="hero-form mt-6 sm:mt-8 relative w-full max-w-2xl mx-auto">
            <div className="group relative">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-[#eb742e] via-orange-400 to-blue-500 opacity-0 group-focus-within:opacity-60 blur transition-opacity duration-500" />
              <div className="relative flex items-center bg-white dark:bg-black rounded-full border border-black/15 dark:border-white/15 p-1.5 sm:p-2 group-focus-within:border-transparent transition-colors">
                <div className="pl-3 sm:pl-5 pr-1 sm:pr-2 text-black/30 dark:text-white/30">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://google.com"
                  className="flex-1 min-w-0 px-1 sm:px-2 py-2.5 sm:py-3 bg-transparent text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none text-sm sm:text-base"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="px-4 sm:px-7 py-2.5 sm:py-3 rounded-full bg-[#eb742e] text-white font-bold text-xs sm:text-sm hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 transition-transform shrink-0"
                >
                  Extract →
                </button>
              </div>
            </div>
          </form>



          {error && (
            <div className="mt-6 inline-block text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-5 py-3 text-sm">
              {error}
            </div>
          )}
        </section>
      )}

      {/* === LOADING === */}
      {loading && (
        <section className="flex-1 flex items-center justify-center px-6 text-center">
          <div className="inline-flex flex-col items-center gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-2 border-black/10 dark:border-white/10" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#eb742e] animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-black dark:border-t-white animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
            </div>
            <div>
              <p className="text-black dark:text-white font-bold text-lg">Analyzing brand…</p>
              <p className="text-black/40 dark:text-white/40 text-sm mt-1.5 font-mono">scanning · parsing · extracting</p>
            </div>
          </div>
        </section>
      )}

      {/* === RESULTS — Brandfetch-style two-column layout === */}
      {data && (
        <div ref={resultsRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 sm:gap-8">

            {/* ============ SIDEBAR (sticky brand card) ============ */}
            <aside className="brand-sidebar space-y-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:scrollbar-hide">
              <div className="rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
                {/* Banner — uses signature color */}
                <div
                  className="h-32 relative"
                  style={{ background: `linear-gradient(135deg, ${heroPrimary} 0%, ${heroPrimary}cc 100%)` }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
                </div>

                {/* Avatar overlapping banner */}
                <div className="px-6 -mt-12 relative">
                  {data.favicon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={data.favicon}
                      alt=""
                      className="w-24 h-24 rounded-2xl border-4 border-white dark:border-white/10 bg-white shadow-lg p-2 object-contain"
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-2xl border-4 border-white dark:border-black bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-3xl font-bold shadow-lg">
                      {(data.title || getDomain(data.url)).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Brand info */}
                <div className="px-6 pt-4 pb-6">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-white leading-tight break-words">
                    {data.brand?.name || getDomain(data.url)}
                  </h2>

                  <div className="inline-flex items-center mt-2 text-xs">
                    <span className="font-medium text-black/60 dark:text-white/60">Extracted brand</span>
                  </div>

                  {data.description && (
                    <p className="mt-4 text-sm text-black/60 dark:text-white/60 leading-relaxed line-clamp-5">
                      {data.description}
                    </p>
                  )}

                  <a
                    href={data.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors group"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="font-mono group-hover:underline">{getDomain(data.url)}</span>
                  </a>

                  {/* Quick stats */}
                  <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-2xl font-bold text-black dark:text-white">{(data.logos?.length || 0) + (data.logoVariants?.length || 0)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-bold mt-0.5">Logos</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-black dark:text-white">{allColors.length}</p>
                      <p className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-bold mt-0.5">Colors</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-black dark:text-white">{data.typography.fonts.length}</p>
                      <p className="text-[10px] uppercase tracking-wider text-black/40 dark:text-white/40 font-bold mt-0.5">Fonts</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* === LIVE PREVIEW === */}
              {data.screenshot && (
                <div className="result-card rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <span className="ml-2 text-[10px] font-mono text-black/40 dark:text-white/40 truncate">{getDomain(data.url)}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.screenshot} alt="Website preview" className="w-full block" />
                </div>
              )}
            </aside>

            {/* ============ MAIN CONTENT ============ */}
            <main className="min-w-0">

              {error && (
                <div className="mb-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl px-5 py-3 text-sm">
                  {error}
                </div>
              )}

              {/* === BRAND CHANGE DIFF === */}
              {data.brandDiff && (
                <section className="result-section mb-10">
                  {data.brandDiff.noChanges ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] px-5 py-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                      <p className="text-sm text-black/70 dark:text-white/70">
                        <span className="font-semibold text-black dark:text-white">No changes detected</span>
                        {data.brandDiff.extractedAt && (
                          <> since last extraction on{" "}
                            <span className="font-mono">{new Date(data.brandDiff.extractedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
                      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0 animate-pulse" />
                        <div>
                          <p className="font-bold text-black dark:text-white text-sm">Brand changes detected</p>
                          {data.brandDiff.extractedAt && (
                            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                              Compared with extraction from{" "}
                              {new Date(data.brandDiff.extractedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                        {/* Color diff */}
                        {data.brandDiff.colors && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40 mb-3">Colors</p>
                            <div className="flex flex-wrap gap-3">
                              {data.brandDiff.colors.added.map((c) => (
                                <div key={`add-${c}`} className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded border border-black/10 dark:border-white/10 flex-shrink-0" style={{ backgroundColor: c }} />
                                  <span className="font-mono text-xs text-black dark:text-white">{c.toUpperCase()}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-full px-2 py-0.5">New</span>
                                </div>
                              ))}
                              {data.brandDiff.colors.removed.map((c) => (
                                <div key={`rem-${c}`} className="flex items-center gap-2 opacity-60">
                                  <div className="w-5 h-5 rounded border border-black/10 dark:border-white/10 flex-shrink-0 relative overflow-hidden" style={{ backgroundColor: c }}>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="w-full h-px bg-red-500 rotate-45" />
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs text-black/60 dark:text-white/60 line-through">{c.toUpperCase()}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-full px-2 py-0.5">Removed</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Font diff */}
                        {data.brandDiff.fonts && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40 mb-3">Typography</p>
                            <div className="flex flex-wrap gap-3">
                              {data.brandDiff.fonts.added.map((f) => (
                                <div key={`fadd-${f}`} className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-black dark:text-white" style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-full px-2 py-0.5">New</span>
                                </div>
                              ))}
                              {data.brandDiff.fonts.removed.map((f) => (
                                <div key={`frem-${f}`} className="flex items-center gap-2 opacity-60">
                                  <span className="text-sm text-black/50 dark:text-white/50 line-through" style={{ fontFamily: `"${f}", sans-serif` }}>{f}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-full px-2 py-0.5">Removed</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Logo visual diff — before / after */}
                        {data.brandDiff.logos && (
                          <div className="px-5 py-4">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-black/40 dark:text-white/40 mb-4">Logos</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Previous logos */}
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Before</p>
                                <div className="flex flex-wrap gap-3">
                                  {data.brandDiff.logos.previousLogos.length > 0 ? data.brandDiff.logos.previousLogos.map((src, i) => (
                                    <div key={i} className="relative rounded-xl border-2 border-red-300 dark:border-red-700 bg-white overflow-hidden">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt={`Previous logo ${i + 1}`}
                                        className="w-24 h-16 object-contain p-2"
                                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 bg-red-500/10 text-red-600 dark:text-red-400 text-[9px] font-bold text-center py-0.5">OLD</div>
                                    </div>
                                  )) : (
                                    <p className="text-xs text-black/40 dark:text-white/40 italic">No previous logos</p>
                                  )}
                                </div>
                              </div>
                              {/* New logos */}
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-500 mb-2">After</p>
                                <div className="flex flex-wrap gap-3">
                                  {data.brandDiff.logos.newLogos.map((src, i) => (
                                    <div key={i} className="relative rounded-xl border-2 border-green-300 dark:border-green-700 bg-white overflow-hidden">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={src}
                                        alt={`New logo ${i + 1}`}
                                        className="w-24 h-16 object-contain p-2"
                                        onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 bg-green-500/10 text-green-600 dark:text-green-400 text-[9px] font-bold text-center py-0.5">NEW</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* === LOGOS === */}
              {((data.logoVariants?.length ?? 0) > 0 || data.logos.length > 0) && (
                <section className="result-section mb-16">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black dark:text-white mb-6">
                    {getDomain(data.url)}&apos;s Recent Logos
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(data.logoVariants && data.logoVariants.length > 0
                      ? data.logoVariants.map((v) => ({ src: v.src, label: v.type === "logo" ? (v.theme === "dark" ? "White" : "Black") : `${v.type} ${v.theme}`, format: "PNG", dark: v.theme === "dark" }))
                      : data.logos.map((src, i) => {
                          let format = "PNG";
                          if (src.startsWith("data:image/svg")) format = "SVG";
                          else if (src.startsWith("data:image/x-icon") || src.startsWith("data:image/vnd.microsoft.icon")) format = "ICO";
                          else if (src.startsWith("data:image/gif")) format = "GIF";
                          else if (src.startsWith("data:image/webp")) format = "WEBP";
                          else if (src.startsWith("data:image/jpeg") || src.startsWith("data:image/jpg")) format = "JPG";
                          const isFavicon = i >= (data.logoCount ?? data.logos.length);
                          const label = isFavicon ? "Favicon" : `Logo ${String(i + 1).padStart(2, "0")}`;
                          return { src, label, format, dark: false };
                        })
                    ).map((item, i) => (
                      <div
                        key={i}
                        className="result-card group rounded-3xl overflow-hidden border border-black/[0.04] dark:border-white/[0.04] hover:border-black/20 dark:hover:border-white/20 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300"
                      >
                        <div className={`flex items-center justify-center p-8 sm:p-16 min-h-[180px] sm:min-h-[280px] ${item.dark ? "bg-[#1a1a1a]" : "bg-white"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.src}
                            alt={item.label}
                            className="max-h-32 max-w-[280px] object-contain transition-transform duration-500 group-hover:scale-110"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              const canvas = document.createElement("canvas");
                              const size = 32;
                              canvas.width = size;
                              canvas.height = size;
                              const ctx = canvas.getContext("2d");
                              if (!ctx) return;
                              ctx.drawImage(img, 0, 0, size, size);
                              const data = ctx.getImageData(0, 0, size, size).data;
                              let lightPixels = 0;
                              let totalPixels = 0;
                              for (let p = 0; p < data.length; p += 4) {
                                if (data[p + 3] < 30) continue;
                                totalPixels++;
                                const brightness = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
                                if (brightness > 220) lightPixels++;
                              }
                              if (totalPixels > 0 && lightPixels / totalPixels > 0.6) {
                                const container = img.parentElement;
                                if (container) container.style.backgroundColor = "#1a1a1a";
                              }
                            }}
                            onError={(e) => {
                              const card = e.currentTarget.closest(".result-card");
                              if (card) (card as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="px-6 py-4 flex items-center justify-between bg-[#f3f3f3] dark:bg-white/[0.04]">
                          <span className="text-sm font-bold text-black dark:text-white">
                            {item.label}
                          </span>
                          <span className="text-xs font-mono font-bold text-black/40 dark:text-white/40">
                            {item.format}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* === COLORS === */}
              {allColors.length > 0 && (
                <section className="result-section mb-16">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black dark:text-white mb-4 sm:mb-6">
                    {getDomain(data.url)}&apos;s Brand Colors
                  </h3>

                  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-x-auto">
                    <table className="w-full min-w-[400px]">
                      <thead>
                        <tr className="bg-black/[0.02] dark:bg-white/[0.02]">
                          <th className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-black/50 dark:text-white/50">Hex Code</th>
                          <th className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-black/50 dark:text-white/50">Color name</th>
                          <th className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-black/50 dark:text-white/50">RGB</th>
                          <th className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-black/50 dark:text-white/50 hidden md:table-cell">HSL</th>
                          <th className="text-left py-3 sm:py-4 px-3 sm:px-5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-black/50 dark:text-white/50 hidden lg:table-cell">CMYK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allColors.map((c, i) => (
                          <ColorRow key={i} color={c} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* === TYPOGRAPHY === */}
              {data.typography.fonts.length > 0 && (
                <section className="result-section mb-16">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black dark:text-white mb-4 sm:mb-6">
                    {getDomain(data.url)}&apos;s Typography
                  </h3>

                  <div className="grid gap-4">
                    {data.typography.fonts.map((font, i) => {
                      const isLoaded = loadedFonts[font];
                      // Always provide a sensible fallback stack so even unloaded
                      // fonts render as readable Latin letters, not emoji glyphs.
                      const fontStack = `"${font}", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
                      return (
                      <div key={i} className="result-card rounded-2xl sm:rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                        <div className="p-5 sm:p-8">
                          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 flex-wrap">
                            <h4 className="text-lg sm:text-xl font-bold text-black dark:text-white break-all">{font}</h4>
                            {font === data.typography.bodyFont && (
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] border border-black/15 dark:border-white/15 text-black/70 dark:text-white/70 px-2.5 py-1 rounded-full">Body</span>
                            )}
                            {data.typography.headings.some((h) => h.font === font) && (
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-black dark:bg-white text-white dark:text-black px-2.5 py-1 rounded-full">Heading</span>
                            )}
                            {isLoaded === true && (
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full">
                                ● Loaded
                              </span>
                            )}
                            {isLoaded === false && (
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                Fallback preview
                              </span>
                            )}
                          </div>
                          <p className="text-2xl sm:text-4xl text-black dark:text-white leading-tight mb-2" style={{ fontFamily: fontStack }}>
                            Aa Bb Cc Dd Ee Ff Gg
                          </p>
                          <p className="text-sm sm:text-base text-black/50 dark:text-white/50 leading-relaxed" style={{ fontFamily: fontStack }}>
                            The quick brown fox jumps over the lazy dog 0123456789
                          </p>
                        </div>
                        {data.typography.headings.filter((h) => h.font === font).length > 0 && (
                          <div className="border-t border-black/10 dark:border-white/10 px-5 sm:px-8 py-3 flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-1 bg-black/[0.015] dark:bg-white/[0.01]">
                            {data.typography.headings.filter((h) => h.font === font).map((h, j) => (
                              <span key={j} className="text-xs font-mono text-black/40 dark:text-white/40">
                                <span className="font-bold text-black/70 dark:text-white/70">{h.tag.toUpperCase()}</span> · {h.size} · {h.weight}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </main>
          </div>
        </div>
      )}
      {/* === FOOTER === */}
      <footer className="mt-auto border-t border-black/[0.06] dark:border-white/[0.06] py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-center">
          <p className="text-xs sm:text-sm text-black/40 dark:text-white/40">
            Built by{" "}
            <a
              href="https://freshboost.co"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#eb742e] hover:text-[#d4651f] transition-colors"
            >
              Freshboost
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
