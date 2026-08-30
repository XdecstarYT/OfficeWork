import { lazy, Suspense, useState } from "react";
import { GameEntryScreen } from "./pages/GameEntryScreen";
import { CompanyGate } from "./pages/CompanyGate";
import { GameLobby } from "./pages/GameLobby";
import { awardMoney } from "./lib/company";
import { DEFAULT_LLM_CONFIG } from "./lib/llmConfig";
import { careerProgress } from "./lib/careerLevel";
import { useSession } from "./hooks/useSession";
import { useProfile } from "./hooks/useProfile";
import { useCompany } from "./hooks/useCompany";
import { signOut } from "./lib/auth";
import type { DocumentTemplate, ClientRequest } from "./types/template";

// Each tab is its own chunk, downloaded only when opened - with 10 tabs and a
// 1000+-template library, shipping every page's code upfront on first load
// (a single >2MB bundle) was the main contributor to a slow/laggy startup.
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

type Tab =
  | "cabinet"
  | "clients"
  | "company"
  | "work"
  | "inbox"
  | "meetings"
  | "updates"
  | "activity"
  | "leaderboard"
  | "archive";

function App() {
  const { session, user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id ?? null);
  const { company, loading: companyLoading, refresh: refreshCompany } = useCompany(profile?.company_id ?? null);
  const [tab, setTab] = useState<Tab>("cabinet");
  const [startedTemplate, setStartedTemplate] = useState<DocumentTemplate | null>(null);

  async function handleCompleteRequest(request: ClientRequest) {
    if (!user) return;
    await awardMoney(user.id, request.payout);
    refreshProfile();
  }

  if (sessionLoading) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading…</div>;
  }

  if (!session || !user) {
    return <GameEntryScreen />;
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
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-stone-100 px-6 py-2">
          <TabButton active={tab === "cabinet"} onClick={() => setTab("cabinet")}>
            📁 Filing Cabinet
          </TabButton>
          <TabButton active={tab === "work"} onClick={() => setTab("work")}>
            📥 My Work
          </TabButton>
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
            ✉️ Inbox
          </TabButton>
          <TabButton active={tab === "company"} onClick={() => setTab("company")}>
            🏛 Company
          </TabButton>
          <TabButton active={tab === "meetings"} onClick={() => setTab("meetings")}>
            📅 Board Meetings
          </TabButton>
          <TabButton active={tab === "updates"} onClick={() => setTab("updates")}>
            📰 Corporate Updates
          </TabButton>
          <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
            🗞 Activity
          </TabButton>
          <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
            🏆 Leaderboard
          </TabButton>
          <TabButton active={tab === "archive"} onClick={() => setTab("archive")}>
            🗄 Archive
          </TabButton>
          <TabButton active={tab === "clients"} onClick={() => setTab("clients")}>
            🤝 AI Clients
          </TabButton>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1">
        <Suspense
          fallback={<div className="flex-1 p-6 text-sm text-stone-400">Loading…</div>}
        >
          {tab === "cabinet" && <FilingCabinet onStart={setStartedTemplate} />}
          {tab === "work" && <WorkPage profile={profile} onProfileChanged={refreshProfile} />}
          {tab === "inbox" && <InboxPage profile={profile} llmConfig={DEFAULT_LLM_CONFIG} />}
          {tab === "company" && <CompanyPage profile={profile} onProfileChanged={refreshProfile} />}
          {tab === "meetings" && <BoardMeetingsPage profile={profile} />}
          {tab === "updates" && <CorporateUpdatesPage profile={profile} company={company} />}
          {tab === "activity" && <ActivityFeedPage profile={profile} />}
          {tab === "leaderboard" && <LeaderboardPage profile={profile} />}
          {tab === "archive" && <ArchivePage profile={profile} />}
          {tab === "clients" && (
            <AiClients llmConfig={DEFAULT_LLM_CONFIG} onCompleteRequest={handleCompleteRequest} />
          )}
        </Suspense>
      </div>

      {startedTemplate && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-stone-200 bg-white p-4 text-sm shadow-lg">
          Browsing <strong>{startedTemplate.title}</strong> — use "My Work" or "Company" to
          request/assign it.
          <button
            type="button"
            onClick={() => setStartedTemplate(null)}
            className="ml-3 text-stone-400 hover:text-stone-600"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

export default App;
