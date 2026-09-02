import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { GameEntryScreen } from "./pages/GameEntryScreen";
import { CompanyGate } from "./pages/CompanyGate";
import { GameLobby } from "./pages/GameLobby";
import { awardMoney } from "./lib/company";
import { DEFAULT_LLM_CONFIG } from "./lib/llmConfig";
import { careerProgress } from "./lib/careerLevel";
import { useSession } from "./hooks/useSession";
import { useProfile } from "./hooks/useProfile";
import { useCompany } from "./hooks/useCompany";
import { useNotifications } from "./hooks/useNotifications";
import { signOut } from "./lib/auth";
import {
  loadFontSize,
  saveFontSize,
  loadSoundEnabled,
  saveSoundEnabled,
  resetLocalPreferences,
  loadContrastMode,
  saveContrastMode,
  loadCompactNav,
  saveCompactNav,
  loadDismissedChangelogVersion,
  saveDismissedChangelogVersion,
  loadPlaytimeToday,
  addPlaytimeMinute,
  type FontSize,
  type ContrastMode,
} from "./lib/storage";
import { playChime } from "./lib/sound";
import type { ClientRequest } from "./types/template";

// Each tab is its own chunk, downloaded only when opened - with 10 tabs and a
// 1000+-template library, shipping every page's code upfront on first load
// (a single >2MB bundle) was the main contributor to a slow/laggy startup.
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const FilingCabinet = lazy(() => import("./pages/FilingCabinet").then((m) => ({ default: m.FilingCabinet })));
const AiClients = lazy(() => import("./pages/AiClients").then((m) => ({ default: m.AiClients })));
const CompanyPage = lazy(() => import("./pages/CompanyPage").then((m) => ({ default: m.CompanyPage })));
const WorkPage = lazy(() => import("./pages/WorkPage").then((m) => ({ default: m.WorkPage })));
const InboxPage = lazy(() => import("./pages/InboxPage").then((m) => ({ default: m.InboxPage })));
const BoardMeetingsPage = lazy(() =>
  import("./pages/BoardMeetingsPage").then((m) => ({ default: m.BoardMeetingsPage })),
);
const CorporateUpdatesPage = lazy(() =>
  import("./pages/CorporateUpdatesPage").then((m) => ({ default: m.CorporateUpdatesPage })),
);
const ActivityFeedPage = lazy(() =>
  import("./pages/ActivityFeedPage").then((m) => ({ default: m.ActivityFeedPage })),
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })),
);
const ArchivePage = lazy(() => import("./pages/ArchivePage").then((m) => ({ default: m.ArchivePage })));
const CompanyCalendarPage = lazy(() =>
  import("./pages/CompanyCalendarPage").then((m) => ({ default: m.CompanyCalendarPage })),
);

type Tab =
  | "dashboard"
  | "cabinet"
  | "clients"
  | "company"
  | "work"
  | "inbox"
  | "meetings"
  | "updates"
  | "activity"
  | "leaderboard"
  | "archive"
  | "calendar";

const APP_VERSION = "1.3.0";

const CHANGELOG: { version: string; notes: string[] }[] = [
  {
    version: "1.3.0",
    notes: [
      "About & What's New panels, high-contrast mode, compact nav, and a session clock.",
      "Alt+←/→ now cycles tabs, and Esc closes whichever dialog is open.",
    ],
  },
  {
    version: "1.2.0",
    notes: [
      "Command palette (⌘K), keyboard shortcuts help, and a Preferences panel.",
      "Notification chime, adjustable text size, and drafts that autosave.",
    ],
  },
];

const TAB_META: { id: Tab; label: string; emoji: string }[] = [
  { id: "dashboard", label: "Dashboard", emoji: "🏠" },
  { id: "cabinet", label: "Filing Cabinet", emoji: "📁" },
  { id: "work", label: "My Work", emoji: "📥" },
  { id: "inbox", label: "Inbox", emoji: "✉️" },
  { id: "company", label: "Company", emoji: "🏛" },
  { id: "calendar", label: "Calendar", emoji: "🗓" },
  { id: "meetings", label: "Board Meetings", emoji: "📅" },
  { id: "updates", label: "Corporate Updates", emoji: "📰" },
  { id: "activity", label: "Activity", emoji: "🗞" },
  { id: "leaderboard", label: "Leaderboard", emoji: "🏆" },
  { id: "archive", label: "Archive", emoji: "🗄" },
  { id: "clients", label: "AI Clients", emoji: "🤝" },
];

function App() {
  const { session, user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id ?? null);
  const { company, loading: companyLoading, refresh: refreshCompany } = useCompany(profile?.company_id ?? null);
  const notifications = useNotifications(profile);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(() => loadFontSize());
  const [soundEnabled, setSoundEnabled] = useState(() => loadSoundEnabled());
  const [contrastMode, setContrastMode] = useState<ContrastMode>(() => loadContrastMode());
  const [compactNav, setCompactNav] = useState(() => loadCompactNav());
  const [showAbout, setShowAbout] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [playtimeToday, setPlaytimeToday] = useState(() => loadPlaytimeToday());
  const [isAway, setIsAway] = useState(false);
  const [debugCopied, setDebugCopied] = useState(false);
  const sessionStartRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const paletteInputRef = useRef<HTMLInputElement>(null);

  const notificationTotal =
    notifications.pendingApproval + notifications.unreadEmail + notifications.overdue + notifications.pendingTimeOff;

  useEffect(() => {
    const prefix = isAway ? "(Away) " : notificationTotal > 0 ? `(${notificationTotal > 99 ? "99+" : notificationTotal}) ` : "";
    document.title = `${prefix}Office Quest`;
  }, [notificationTotal, isAway]);

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.dataset.contrast = contrastMode;
  }, [contrastMode]);

  // Live clock + idle/away detection + once-a-minute local playtime tally,
  // all driven off one 30s interval so we're not stacking multiple timers.
  useEffect(() => {
    function markActive() {
      lastActivityRef.current = Date.now();
    }
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("click", markActive);
    const interval = setInterval(() => {
      setNow(new Date());
      setIsAway(Date.now() - lastActivityRef.current > 10 * 60_000);
      if (document.visibilityState === "visible" && Date.now() - lastActivityRef.current < 5 * 60_000) {
        addPlaytimeMinute();
        setPlaytimeToday(loadPlaytimeToday());
      }
    }, 30_000);
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("click", markActive);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (loadDismissedChangelogVersion() !== APP_VERSION) setShowChangelog(true);
  }, []);

  function dismissChangelog() {
    saveDismissedChangelogVersion(APP_VERSION);
    setShowChangelog(false);
  }

  // Chimes once per *increase* in the notification total, not on every render
  // or on the initial load (which would otherwise chime immediately for
  // whatever's already pending the moment the page opens).
  const prevNotificationTotalRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevNotificationTotalRef.current;
    if (soundEnabled && prev !== null && notificationTotal > prev) playChime();
    prevNotificationTotalRef.current = notificationTotal;
  }, [notificationTotal, soundEnabled]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inField = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowPalette((s) => !s);
        return;
      }
      if (e.key === "Escape") {
        setShowPalette(false);
        setShowShortcuts(false);
        setShowPreferences(false);
        setShowAbout(false);
        setShowChangelog(false);
        return;
      }
      if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        setTab((current) => {
          const idx = TAB_META.findIndex((t) => t.id === current);
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const next = TAB_META[(idx + delta + TAB_META.length) % TAB_META.length];
          return next.id;
        });
        return;
      }
      if (inField) return;
      if (e.key === "?") {
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowNotifications((s) => !s);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (showPalette) paletteInputRef.current?.focus();
    else setPaletteQuery("");
  }, [showPalette]);

  const filteredPaletteTabs = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return TAB_META;
    return TAB_META.filter((t) => t.label.toLowerCase().includes(q));
  }, [paletteQuery]);

  function goToTab(t: Tab) {
    setTab(t);
    setShowPalette(false);
  }

  async function handleCompleteRequest(request: ClientRequest) {
    if (!user) return;
    await awardMoney(user.id, request.payout);
    refreshProfile();
  }

  if (sessionLoading) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading…</div>;
  }

  if (!session || !user) {
    return <GameEntryScreen onAccountReady={refreshProfile} />;
  }

  if (profileLoading || !profile) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading profile…</div>;
  }

  if (!profile.company_id) {
    return <CompanyGate userId={user.id} onDone={refreshProfile} />;
  }

  if (companyLoading || !company) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading game…</div>;
  }

  if (!company.started) {
    return (
      <GameLobby
        profile={profile}
        company={company}
        onProfileChanged={refreshProfile}
        onStarted={refreshCompany}
      />
    );
  }

  const careerXp = careerProgress(profile.xp);

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 flex-col border-b border-stone-200">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <h1 className="text-base font-semibold text-stone-900">Office Quest</h1>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span
              className="hidden text-xs text-stone-400 tabular-nums md:block"
              title="Local time"
            >
              {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 tabular-nums">
              💵 ${profile.money.toFixed(2)}
            </span>
            <span
              className="flex items-center gap-1 text-xs font-medium text-amber-700 tabular-nums"
              title={`${careerXp.intoLevel}/${careerXp.xpPerLevel} XP to next Career Level`}
            >
              ⭐ Career Lvl {careerXp.level}
            </span>
            <span className="text-xs text-stone-400">
              {profile.job_title} · Rank {profile.level}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((s) => !s)}
                className="relative rounded-md p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Notifications"
                title="Notifications (press N)"
              >
                🔔
                {notificationTotal > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                    {notificationTotal > 9 ? "9+" : notificationTotal}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-stone-200 bg-white p-2 shadow-lg"
                  onMouseLeave={() => setShowNotifications(false)}
                >
                  <NotificationRow
                    emoji="✅"
                    label="Needs your approval"
                    count={notifications.pendingApproval}
                    onClick={() => {
                      setTab("work");
                      setShowNotifications(false);
                    }}
                  />
                  <NotificationRow
                    emoji="✉️"
                    label="Unread emails"
                    count={notifications.unreadEmail}
                    onClick={() => {
                      setTab("inbox");
                      setShowNotifications(false);
                    }}
                  />
                  <NotificationRow
                    emoji="⏰"
                    label="Overdue work"
                    count={notifications.overdue}
                    onClick={() => {
                      setTab("work");
                      setShowNotifications(false);
                    }}
                  />
                  <NotificationRow
                    emoji="🌴"
                    label="Time off awaiting your decision"
                    count={notifications.pendingTimeOff}
                    onClick={() => {
                      setTab("company");
                      setShowNotifications(false);
                    }}
                  />
                  {notificationTotal === 0 && (
                    <p className="p-2 text-center text-xs text-stone-400">You're all caught up.</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPalette(true)}
              className="hidden rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 sm:block"
              title="Jump to a tab (⌘K)"
            >
              ⌘K
            </button>
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label="Preferences"
              title="Preferences"
            >
              ⚙️
            </button>
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100"
              aria-label="About Office Quest"
              title="About"
            >
              ℹ️
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Sign out?")) signOut();
              }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-6 py-2">
          {TAB_META.map((t) => (
            <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} title={compactNav ? t.label : undefined}>
              {compactNav ? t.emoji : `${t.emoji} ${t.label}`}
            </TabButton>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1">
        <Suspense
          fallback={<div className="flex-1 p-6 text-sm text-stone-400">Loading…</div>}
        >
          {tab === "dashboard" && (
            <DashboardPage
              profile={profile}
              company={company}
              notifications={notifications}
              onNavigate={setTab}
              onProfileChanged={refreshProfile}
            />
          )}
          {tab === "cabinet" && (
            <FilingCabinet
              profile={profile}
              llmConfig={DEFAULT_LLM_CONFIG}
              isOwner={company.owner_id === profile.id}
            />
          )}
          {tab === "work" && (
            <WorkPage profile={profile} onProfileChanged={refreshProfile} llmConfig={DEFAULT_LLM_CONFIG} />
          )}
          {tab === "inbox" && <InboxPage profile={profile} llmConfig={DEFAULT_LLM_CONFIG} />}
          {tab === "company" && (
            <CompanyPage profile={profile} onProfileChanged={refreshProfile} llmConfig={DEFAULT_LLM_CONFIG} />
          )}
          {tab === "calendar" && <CompanyCalendarPage profile={profile} />}
          {tab === "meetings" && <BoardMeetingsPage profile={profile} />}
          {tab === "updates" && <CorporateUpdatesPage profile={profile} company={company} />}
          {tab === "activity" && <ActivityFeedPage profile={profile} />}
          {tab === "leaderboard" && <LeaderboardPage profile={profile} />}
          {tab === "archive" && <ArchivePage profile={profile} />}
          {tab === "clients" && (
            <AiClients
              profile={profile}
              isOwner={company.owner_id === profile.id}
              llmConfig={DEFAULT_LLM_CONFIG}
              onCompleteRequest={handleCompleteRequest}
            />
          )}
        </Suspense>
      </div>

      {showPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/40 p-4 pt-24"
          onClick={() => setShowPalette(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={paletteInputRef}
              type="text"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowPalette(false);
                if (e.key === "Enter" && filteredPaletteTabs[0]) goToTab(filteredPaletteTabs[0].id);
              }}
              placeholder="Jump to a tab…"
              className="w-full border-b border-stone-200 px-4 py-3 text-sm focus:outline-none"
            />
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredPaletteTabs.length === 0 ? (
                <p className="p-3 text-center text-xs text-stone-400">No matching tab.</p>
              ) : (
                filteredPaletteTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goToTab(t.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-stone-100 ${
                      t.id === tab ? "font-medium text-stone-900" : "text-stone-600"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    {t.label}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">⌨️ Keyboard Shortcuts</h2>
            <div className="mt-4 flex flex-col gap-2 text-sm text-stone-600">
              <ShortcutRow keys="⌘/Ctrl K" label="Jump to a tab" />
              <ShortcutRow keys="N" label="Toggle notifications" />
              <ShortcutRow keys="/" label="Focus search (Filing Cabinet)" />
              <ShortcutRow keys="Alt ←/→" label="Cycle tabs" />
              <ShortcutRow keys="?" label="Show this help" />
              <ShortcutRow keys="Esc" label="Close any open dialog" />
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-5 w-full rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {showPreferences && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowPreferences(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">⚙️ Preferences</h2>
            <p className="mt-1 text-xs text-stone-400">Saved to this browser only.</p>

            <div className="mt-4">
              <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                Text Size
              </label>
              <div className="mt-1.5 flex gap-2">
                {(["compact", "normal", "large"] as FontSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setFontSize(size);
                      saveFontSize(size);
                    }}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${
                      fontSize === size
                        ? "border-stone-800 bg-stone-800 text-white"
                        : "border-stone-300 text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-4 flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">
              🔔 Notification chime
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => {
                  setSoundEnabled(e.target.checked);
                  saveSoundEnabled(e.target.checked);
                  if (e.target.checked) playChime();
                }}
                className="h-4 w-4"
              />
            </label>

            <label className="mt-3 flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">
              🔲 High contrast
              <input
                type="checkbox"
                checked={contrastMode === "high"}
                onChange={(e) => {
                  const mode: ContrastMode = e.target.checked ? "high" : "normal";
                  setContrastMode(mode);
                  saveContrastMode(mode);
                }}
                className="h-4 w-4"
              />
            </label>

            <label className="mt-2 flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">
              🧭 Compact nav (icons only)
              <input
                type="checkbox"
                checked={compactNav}
                onChange={(e) => {
                  setCompactNav(e.target.checked);
                  saveCompactNav(e.target.checked);
                }}
                className="h-4 w-4"
              />
            </label>

            <p className="mt-3 text-xs text-stone-400">
              ⏱ Time played today: {playtimeToday} min · This session:{" "}
              {Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60_000))} min
            </p>

            <button
              type="button"
              onClick={async () => {
                const info = [
                  `Office Quest v${APP_VERSION}`,
                  `URL: ${window.location.href}`,
                  `Viewport: ${window.innerWidth}x${window.innerHeight}`,
                  `User agent: ${navigator.userAgent}`,
                ].join("\n");
                try {
                  await navigator.clipboard.writeText(info);
                  setDebugCopied(true);
                  setTimeout(() => setDebugCopied(false), 1500);
                } catch {
                  // clipboard unavailable - nothing to fall back to
                }
              }}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              {debugCopied ? "Copied!" : "Copy debug info"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm("Reset all local preferences (favorites, recents, drafts, this panel)? Your game data is untouched.")) {
                  resetLocalPreferences();
                  window.location.reload();
                }
              }}
              className="mt-2 w-full rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Reset local preferences
            </button>

            <button
              type="button"
              onClick={() => setShowPreferences(false)}
              className="mt-3 w-full rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowAbout(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">🏢 Office Quest</h2>
            <p className="mt-1 text-xs text-stone-400">Version {APP_VERSION}</p>
            <p className="mt-3 text-sm text-stone-600">
              A multiplayer office paperwork simulation - fill out forms, manage a company, and climb the
              career ladder with your coworkers.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowAbout(false);
                setShowChangelog(true);
              }}
              className="mt-4 w-full rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              What's New
            </button>
            <button
              type="button"
              onClick={() => setShowAbout(false)}
              className="mt-2 w-full rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showChangelog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={dismissChangelog}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">🆕 What's New</h2>
            <div className="mt-4 max-h-72 space-y-4 overflow-y-auto">
              {CHANGELOG.map((entry) => (
                <div key={entry.version}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">v{entry.version}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-stone-600">
                    {entry.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={dismissChangelog}
              className="mt-5 w-full rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-xs text-stone-600">
        {keys}
      </kbd>
    </div>
  );
}

function NotificationRow({
  emoji,
  label,
  count,
  onClick,
}: {
  emoji: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-stone-50"
    >
      <span className="text-stone-700">
        {emoji} {label}
      </span>
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{count}</span>
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

export default App;
