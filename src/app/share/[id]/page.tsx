"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ── helpers (duplicated from page.tsx to keep this page self-contained) ──────

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}
function hexToRgbStr(hex: string) {
  const t = hexToRgbTuple(hex);
  return t ? `${t[0]}, ${t[1]}, ${t[2]}` : hex;
}
function hexToHsl(hex: string) {
  const t = hexToRgbTuple(hex);
  if (!t) return "";
  const [r, g, b] = t.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
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
function hexToCmyk(hex: string) {
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
function colorName(hex: string) {
  const t = hexToRgbTuple(hex);
  if (!t) return "";
  const [r, g, b] = t;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
  return "Pink";
}
function getDomain(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

// ── types ────────────────────────────────────────────────────────────────────

interface Extraction {
  id: string;
  url: string;
  title: string;
  description: string;
  brand_name: string;
  palette: { primary: string[]; all: string[]; background: string; text: string };
  typography: { fonts: string[]; bodyFont: string; headings: { tag: string; font: string; size: string; weight: string; color: string }[] };
  logos: string[];
  logo_count: number;
  favicon: string;
  screenshot: string;
  extracted_at: string;
}

// ── color row ────────────────────────────────────────────────────────────────

function CopyCell({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <td
      className={`py-3 sm:py-4 px-3 sm:px-5 cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors ${className || ""}`}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
    >
      {copied ? <span className="text-xs font-mono font-semibold text-green-600">Copied!</span> : children}
    </td>
  );
}

function ColorRow({ color }: { color: string }) {
  return (
    <tr className="border-t border-black/[0.06] dark:border-white/[0.06]">
      <CopyCell value={color.toUpperCase()}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg border border-black/10 flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-mono font-bold text-xs sm:text-sm text-black dark:text-white">{color.toUpperCase()}</span>
        </div>
      </CopyCell>
      <CopyCell value={colorName(color)} className="text-xs sm:text-sm text-black/60 dark:text-white/60 font-medium"><span>{colorName(color)}</span></CopyCell>
      <CopyCell value={hexToRgbStr(color)} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60"><span>{hexToRgbStr(color)}</span></CopyCell>
      <CopyCell value={hexToHsl(color)} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60 hidden md:table-cell"><span>{hexToHsl(color)}</span></CopyCell>
      <CopyCell value={hexToCmyk(color)} className="text-xs sm:text-sm font-mono text-black/60 dark:text-white/60 hidden lg:table-cell"><span>{hexToCmyk(color)}</span></CopyCell>
    </tr>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Extraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/share?id=${id}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const row = await res.json();
        setData(row as Extraction);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-black/10" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#eb742e] animate-spin" />
      </div>
    </div>
  );

  if (notFound || !data) return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-black dark:text-white mb-2">Brand not found</h1>
        <p className="text-black/50 dark:text-white/50 text-sm">This share link may have expired or the brand data was deleted.</p>
        <a href="/" className="mt-6 inline-block px-5 py-2.5 rounded-full bg-[#eb742e] text-white font-semibold text-sm hover:scale-105 transition-transform">
          Extract a brand →
        </a>
      </div>
    </div>
  );

  const heroPrimary = data.palette.primary[0] || data.palette.all[0] || "#111111";
  const allColors = [
    ...data.palette.primary,
    ...(data.palette.background !== "#ffffff" ? [data.palette.background] : []),
    ...(data.palette.text !== "#000000" ? [data.palette.text] : []),
    ...data.palette.all,
  ].filter((c, i, arr) => arr.indexOf(c) === i && /^#[0-9a-f]{6}$/i.test(c));

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://cdn.prod.website-files.com/637a83b536c04ad1891311c6/66866eee08b9e45d38e08dc5_Freshboost%20Purple.png"
              alt="Freshboost"
              className="h-7 sm:h-8 w-auto"
            />
          </a>
          <div className="flex items-center gap-2">
            <span className="text-xs text-black/40 dark:text-white/40 hidden sm:block">
              Shared · {new Date(data.extracted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            {/* Copy link — icon only on mobile, icon+text on desktop */}
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-black/15 dark:border-white/15 text-sm font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="hidden sm:inline text-green-600 dark:text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="hidden sm:inline">Copy link</span>
                </>
              )}
            </button>
            {/* Extract CTA — short on mobile */}
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-full bg-[#eb742e] text-white font-semibold text-sm hover:scale-105 transition-transform shrink-0"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Extract brand</span>
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 sm:gap-8">

          {/* Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
              <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${heroPrimary} 0%, ${heroPrimary}cc 100%)` }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
              </div>
              <div className="px-6 -mt-12 relative">
                {data.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.favicon} alt="" className="w-24 h-24 rounded-2xl border-4 border-white dark:border-white/10 bg-white shadow-lg p-2 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className="w-24 h-24 rounded-2xl border-4 border-white bg-black flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {(data.title || getDomain(data.url)).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="px-6 pt-4 pb-6">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-black dark:text-white leading-tight break-words">
                  {data.brand_name || getDomain(data.url)}
                </h2>
                <div className="inline-flex items-center mt-2 text-xs">
                  <span className="font-medium text-black/60 dark:text-white/60">Extracted brand</span>
                </div>
                {data.description && (
                  <p className="mt-4 text-sm text-black/60 dark:text-white/60 leading-relaxed line-clamp-5">{data.description}</p>
                )}
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition-colors group">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="font-mono group-hover:underline">{getDomain(data.url)}</span>
                </a>
                <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.logos?.length || 0}</p>
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

            {/* Screenshot */}
            {data.screenshot && (
              <div className="rounded-3xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/10 dark:border-white/10 bg-black/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="ml-2 text-[10px] font-mono text-black/40 truncate">{getDomain(data.url)}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.screenshot} alt="Website preview" className="w-full block" />
              </div>
            )}
          </aside>

          {/* Main */}
          <main className="min-w-0">

            {/* Logos */}
            {data.logos?.length > 0 && (
              <section className="mb-16">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black dark:text-white mb-6">
                  {getDomain(data.url)}&apos;s Logos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.logos.map((src, i) => {
                    let format = "PNG";
                    if (src.startsWith("data:image/svg")) format = "SVG";
                    else if (src.startsWith("data:image/x-icon") || src.startsWith("data:image/vnd.microsoft.icon")) format = "ICO";
                    else if (src.startsWith("data:image/webp")) format = "WEBP";
                    const isFavicon = i >= (data.logo_count ?? data.logos.length);
                    const label = isFavicon ? "Favicon" : `Logo ${String(i + 1).padStart(2, "0")}`;
                    return (
                      <div key={i} className="rounded-3xl overflow-hidden border border-black/[0.04] dark:border-white/[0.04]">
                        <div className="flex items-center justify-center p-8 sm:p-16 min-h-[180px] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={label} className="max-h-32 max-w-[280px] object-contain" onError={(e) => { const card = e.currentTarget.closest(".rounded-3xl"); if (card) (card as HTMLElement).style.display = "none"; }} />
                        </div>
                        <div className="px-6 py-4 flex items-center justify-between bg-[#f3f3f3] dark:bg-white/[0.04]">
                          <span className="text-sm font-bold text-black dark:text-white">{label}</span>
                          <span className="text-xs font-mono font-bold text-black/40">{format}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Colors */}
            {allColors.length > 0 && (
              <section className="mb-16">
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
                      {allColors.map((c, i) => <ColorRow key={i} color={c} />)}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Typography */}
            {data.typography.fonts.length > 0 && (
              <section className="mb-16">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-black dark:text-white mb-4 sm:mb-6">
                  {getDomain(data.url)}&apos;s Typography
                </h3>
                <div className="grid gap-4">
                  {data.typography.fonts.map((font, i) => (
                    <div key={i} className="rounded-2xl sm:rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.02] overflow-hidden">
                      <div className="p-5 sm:p-8">
                        <p className="text-4xl sm:text-6xl font-bold text-black dark:text-white leading-none mb-4" style={{ fontFamily: `"${font}", sans-serif` }}>
                          Aa
                        </p>
                        <p className="text-base sm:text-lg text-black/70 dark:text-white/70 leading-relaxed" style={{ fontFamily: `"${font}", sans-serif` }}>
                          The quick brown fox jumps over the lazy dog
                        </p>
                      </div>
                      <div className="px-5 sm:px-8 py-4 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] flex items-center justify-between">
                        <span className="font-bold text-sm text-black dark:text-white">{font}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="mt-4 pt-8 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs text-black/30 dark:text-white/30">
                Extracted on {new Date(data.extracted_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
              </p>
              <a href="/" className="text-xs font-semibold text-[#eb742e] hover:underline">
                Extract your own brand →
              </a>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
