"use client";

import { useState, useEffect } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

const ALLOWED_EMAIL = "techops@cyces.co";

interface Extraction {
  id: string;
  url: string;
  title: string;
  description: string;
  brand_name: string;
  palette: {
    primary: string[];
    all: string[];
    background: string;
    text: string;
  };
  typography: {
    fonts: string[];
    bodyFont: string;
    headings: { tag: string; font: string; size: string; weight: string }[];
  };
  logos: string[];
  logo_count: number;
  favicon: string;
  screenshot: string;
  extracted_at: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Restore lockout from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("admin_locked_until");
    if (stored) {
      const until = parseInt(stored);
      if (Date.now() < until) setLockedUntil(until);
      else sessionStorage.removeItem("admin_locked_until");
    }
    const storedAttempts = sessionStorage.getItem("admin_attempts");
    if (storedAttempts) setAttempts(parseInt(storedAttempts));
  }, []);

  // Countdown timer when locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        setCountdown(0);
        sessionStorage.removeItem("admin_locked_until");
        sessionStorage.removeItem("admin_attempts");
      } else {
        setCountdown(remaining);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    if (lockedUntil && Date.now() < lockedUntil) return;

    setError("");
    setLoading(true);

    // Generic message — don't reveal whether email or password is wrong
    const deny = () => {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      sessionStorage.setItem("admin_attempts", String(newAttempts));
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        sessionStorage.setItem("admin_locked_until", String(until));
        setError("Too many failed attempts. Try again in 15 minutes.");
      } else {
        setError(`Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`);
      }
      setLoading(false);
    };

    // Enforce allowed email server-side too — but don't reveal which field is wrong
    if (email !== ALLOWED_EMAIL) { deny(); return; }

    const client = getSupabase();
    if (!client) {
      setError("Authentication service unavailable. Contact the administrator.");
      setLoading(false);
      return;
    }

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      deny();
    } else {
      // Reset lockout on success
      setAttempts(0);
      sessionStorage.removeItem("admin_attempts");
      sessionStorage.removeItem("admin_locked_until");
      onLogin();
    }
    setLoading(false);
  }

  const isLocked = !!lockedUntil && Date.now() < lockedUntil;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://cdn.prod.website-files.com/637a83b536c04ad1891311c6/66866eee08b9e45d38e08dc5_Freshboost%20Purple.png"
            alt="Freshboost"
            className="h-10 w-auto mb-4 mx-auto"
          />
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Panel</h1>
          <p className="text-sm text-white/40 mt-1">Restricted access only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
              autoComplete="username"
              disabled={isLocked}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                disabled={isLocked}
                className="w-full px-4 py-3 pr-11 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          {isLocked && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span>Locked. Try again in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}</span>
            </div>
          )}

          {!isLocked && error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 rounded-xl bg-[#eb742e] text-white font-bold text-sm hover:bg-[#d4651f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-white/20">
          Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  );
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function DetailView({ item, onBack }: { item: Extraction; onBack: () => void }) {
  const [linkCopied, setLinkCopied] = useState(false);

  function copyShareLink() {
    navigator.clipboard.writeText(`${window.location.origin}/share/${item.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0a] overflow-y-auto">

      {/* Back + Share row — sits at the very top of the scroll content, always first thing visible */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a] border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white font-bold text-base active:opacity-60 transition-opacity"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          onClick={copyShareLink}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/20 text-xs font-semibold text-white active:opacity-60 transition-opacity"
        >
          {linkCopied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              Share link
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5 max-w-2xl mx-auto pb-10">
        {/* Screenshot */}
        {item.screenshot && (
          <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.screenshot} alt="Screenshot" className="w-full block" />
          </div>
        )}

        {/* Brand info */}
        <div className="flex items-center gap-3">
          {item.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.favicon} alt="" className="w-12 h-12 rounded-xl bg-white/10 p-1 object-contain" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-base font-bold">
              {(item.brand_name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-bold text-xl text-white">{item.brand_name || getDomain(item.url)}</h2>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 font-mono hover:text-white/60">
              {getDomain(item.url)}
            </a>
          </div>
        </div>

        {item.description && (
          <p className="text-sm text-white/50 leading-relaxed">{item.description}</p>
        )}

        {/* Colors */}
        {item.palette?.primary?.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-3">Colors</h4>
            <div className="flex flex-wrap gap-2">
              {[...item.palette.primary, ...(item.palette.all || [])].filter((c, i, a) => a.indexOf(c) === i).slice(0, 10).map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/[0.06]">
                  <div className="w-3.5 h-3.5 rounded-full border border-white/10 flex-shrink-0" style={{ backgroundColor: c }} />
                  <span className="text-[11px] font-mono text-white/60">{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fonts */}
        {item.typography?.fonts?.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-3">Typography</h4>
            <div className="space-y-2">
              {item.typography.fonts.map((f, i) => (
                <div key={i} className="px-4 py-3 rounded-xl bg-white/5 border border-white/[0.06] text-sm font-medium text-white">{f}</div>
              ))}
            </div>
          </div>
        )}

        {/* Logos */}
        {item.logos?.length > 0 && (
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-3">Logos</h4>
            <div className="grid grid-cols-2 gap-3">
              {item.logos.map((logo, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 flex items-center justify-center min-h-[100px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt={`Logo ${i + 1}`} className="max-h-14 max-w-full object-contain" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="pt-4 border-t border-white/[0.06] text-[11px] text-white/30 space-y-1">
          <p>Extracted: {new Date(item.extracted_at).toLocaleString()}</p>
          <p>ID: {item.id}</p>
        </div>
      </div>
    </div>
  );
}

const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
const WARN_BEFORE_MS = 30 * 1000;    // warn 30 seconds before logout

function Dashboard() {
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Extraction | null>(null);
  const [mobileDetail, setMobileDetail] = useState<Extraction | null>(null);
  const [search, setSearch] = useState("");
  const [warnLogout, setWarnLogout] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Inactivity auto-logout
  useEffect(() => {
    let logoutTimer: ReturnType<typeof setTimeout>;
    let warnTimer: ReturnType<typeof setTimeout>;
    let countdownInterval: ReturnType<typeof setInterval>;

    function resetTimers() {
      clearTimeout(logoutTimer);
      clearTimeout(warnTimer);
      clearInterval(countdownInterval);
      setWarnLogout(false);
      setCountdown(0);

      warnTimer = setTimeout(() => {
        setWarnLogout(true);
        let secs = Math.ceil(WARN_BEFORE_MS / 1000);
        setCountdown(secs);
        countdownInterval = setInterval(() => {
          secs -= 1;
          setCountdown(secs);
        }, 1000);
      }, INACTIVITY_MS - WARN_BEFORE_MS);

      logoutTimer = setTimeout(async () => {
        clearInterval(countdownInterval);
        await getSupabase()?.auth.signOut();
      }, INACTIVITY_MS);
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();

    return () => {
      clearTimeout(logoutTimer);
      clearTimeout(warnTimer);
      clearInterval(countdownInterval);
      events.forEach((e) => window.removeEventListener(e, resetTimers));
    };
  }, []);

  useEffect(() => {
    fetchExtractions();
  }, []);

  async function fetchExtractions() {
    setLoading(true);
    const { data, error } = await getSupabase()!
      .from("brand_extractions")
      .select("*")
      .order("extracted_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error.message);
    } else {
      setExtractions(data || []);
    }
    setLoading(false);
  }

  async function deleteExtraction(id: string) {
    const { error } = await getSupabase()!.from("brand_extractions").delete().eq("id", id);
    if (!error) {
      setExtractions((prev) => prev.filter((e) => e.id !== id));
      if (selected?.id === id) setSelected(null);
    }
  }

  async function handleSignOut() {
    await getSupabase()?.auth.signOut();
    window.location.reload();
  }

  const filtered = extractions.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      e.url?.toLowerCase().includes(q) ||
      e.brand_name?.toLowerCase().includes(q) ||
      e.title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Inactivity warning banner */}
      {warnLogout && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-yellow-500 text-black font-semibold text-sm px-5 py-3 rounded-2xl shadow-xl">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Auto-logout in {countdown}s due to inactivity
        </div>
      )}

      {/* Mobile full-screen detail view */}
      {mobileDetail && (
        <DetailView item={mobileDetail} onBack={() => setMobileDetail(null)} />
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#eb742e] flex items-center justify-center text-white text-xs font-bold">FB</div>
            <span className="text-sm font-bold tracking-tight">
              freshboost<span className="text-[#eb742e]">.</span> admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 hidden sm:block">{ALLOWED_EMAIL}</span>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-2xl font-bold">{extractions.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-1">Total Extractions</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-2xl font-bold">{new Set(extractions.map((e) => getDomain(e.url))).size}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-1">Unique Domains</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-2xl font-bold">
              {extractions.filter((e) => {
                const d = new Date(e.extracted_at);
                const now = new Date();
                return d.toDateString() === now.toDateString();
              }).length}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-1">Today</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-2xl font-bold">
              {extractions.reduce((sum, e) => sum + (e.logo_count || 0), 0)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mt-1">Logos Found</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by URL, brand name, or title..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            {search ? "No results found." : "No extractions yet. Extract a brand from the main page."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
            {/* Table */}
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold">Brand</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold hidden sm:table-cell">URL</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold hidden md:table-cell">Colors</th>
                    <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/40 font-bold hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          setMobileDetail(item);
                        } else {
                          setSelected(item);
                        }
                      }}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        selected?.id === item.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {item.favicon ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.favicon} alt="" className="w-7 h-7 rounded-lg bg-white/10 p-0.5 object-contain" />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-bold">
                              {(item.brand_name || getDomain(item.url)).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-white truncate max-w-[160px]">
                              {item.brand_name || getDomain(item.url)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-white/40 font-mono text-xs truncate block max-w-[200px]">
                          {getDomain(item.url)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex gap-1">
                          {item.palette?.primary?.slice(0, 4).map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-white/30 text-xs">
                          {new Date(item.extracted_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this extraction?")) deleteExtraction(item.id);
                          }}
                          className="text-white/20 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail Panel */}
            {selected && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto scrollbar-hide">
                {/* Screenshot */}
                {selected.screenshot && (
                  <div className="border-b border-white/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.screenshot} alt="Screenshot" className="w-full" />
                  </div>
                )}

                <div className="p-5 space-y-5">
                  {/* Brand info */}
                  <div className="flex items-center gap-3">
                    {selected.favicon ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={selected.favicon} alt="" className="w-10 h-10 rounded-xl bg-white/10 p-1 object-contain" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-bold">
                        {(selected.brand_name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-lg">{selected.brand_name || getDomain(selected.url)}</h3>
                      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white/40 font-mono hover:text-white/60">
                        {getDomain(selected.url)}
                      </a>
                    </div>
                  </div>

                  {selected.description && (
                    <p className="text-xs text-white/50 leading-relaxed">{selected.description}</p>
                  )}

                  {/* Colors */}
                  {selected.palette?.primary?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Colors</h4>
                      <div className="flex flex-wrap gap-2">
                        {[...selected.palette.primary, ...(selected.palette.all || [])].filter((c, i, a) => a.indexOf(c) === i).slice(0, 8).map((c, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/[0.06]">
                            <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: c }} />
                            <span className="text-[10px] font-mono text-white/60">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fonts */}
                  {selected.typography?.fonts?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Typography</h4>
                      <div className="space-y-1">
                        {selected.typography.fonts.map((f, i) => (
                          <div key={i} className="px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-sm font-medium">{f}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logos */}
                  {selected.logos?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-2">Logos ({selected.logo_count || selected.logos.length})</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {selected.logos.map((logo, i) => (
                          <div key={i} className="rounded-xl bg-white p-4 flex items-center justify-center min-h-[80px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={logo} alt={`Logo ${i + 1}`} className="max-h-12 max-w-full object-contain" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="pt-3 border-t border-white/[0.06] text-[10px] text-white/30 space-y-1">
                    <p>Extracted: {new Date(selected.extracted_at).toLocaleString()}</p>
                    <p>ID: {selected.id}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const client = getSupabase();
    if (!client) { setChecking(false); return; }

    // Check existing session
    client.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email;
      const exp = data.session?.expires_at;
      const valid = email === ALLOWED_EMAIL && (!exp || Date.now() / 1000 < exp);
      setAuthed(valid);
      setChecking(false);
    });

    // Listen for auth changes — auto-logout if session expires or user signs out elsewhere
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email;
      const exp = session?.expires_at;
      const valid = !!session && email === ALLOWED_EMAIL && (!exp || Date.now() / 1000 < exp);
      setAuthed(valid);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return authed ? <Dashboard /> : <LoginForm onLogin={() => setAuthed(true)} />;
}
