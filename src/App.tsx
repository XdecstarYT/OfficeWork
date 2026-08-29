import { useState } from "react";
import { FilingCabinet } from "./pages/FilingCabinet";
import { AiClients } from "./pages/AiClients";
import { AuthScreen } from "./pages/AuthScreen";
import { CompanyGate } from "./pages/CompanyGate";
import { CompanyPage } from "./pages/CompanyPage";
import { WorkPage } from "./pages/WorkPage";
import { SettingsModal } from "./components/SettingsModal";
import { awardMoney } from "./lib/company";
import { useApiKey } from "./hooks/useApiKey";
import { useSession } from "./hooks/useSession";
import { useProfile } from "./hooks/useProfile";
import { signOut } from "./lib/auth";
import type { DocumentTemplate, ClientRequest } from "./types/template";

type Tab = "cabinet" | "clients" | "company" | "work";

function App() {
  const { session, user, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(user?.id ?? null);
  const [tab, setTab] = useState<Tab>("cabinet");
  const [startedTemplate, setStartedTemplate] = useState<DocumentTemplate | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { apiKey, hasApiKey, setApiKey } = useApiKey();

  async function handleCompleteRequest(request: ClientRequest) {
    if (!user) return;
    await awardMoney(user.id, request.payout);
    refreshProfile();
  }

  if (sessionLoading) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading…</div>;
  }

  if (!session || !user) {
    return <AuthScreen />;
  }

  if (profileLoading || !profile) {
    return <div className="flex h-screen items-center justify-center text-stone-400">Loading profile…</div>;
  }

  if (!profile.company_id) {
    return <CompanyGate userId={user.id} onDone={refreshProfile} />;
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏢</span>
            <h1 className="text-base font-semibold text-stone-900">Office Quest</h1>
          </div>
          <nav className="flex gap-1">
            <TabButton active={tab === "cabinet"} onClick={() => setTab("cabinet")}>
              📁 Filing Cabinet
            </TabButton>
            <TabButton active={tab === "work"} onClick={() => setTab("work")}>
              📥 My Work
            </TabButton>
            <TabButton active={tab === "company"} onClick={() => setTab("company")}>
              🏛 Company
            </TabButton>
            <TabButton active={tab === "clients"} onClick={() => setTab("clients")}>
              🤝 AI Clients
            </TabButton>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 tabular-nums">
            💵 ${profile.money.toFixed(2)}
          </span>
          <span className="text-xs text-stone-400">
            {profile.job_title} · Level {profile.level}
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Settings"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {tab === "cabinet" && <FilingCabinet onStart={setStartedTemplate} />}
        {tab === "work" && <WorkPage profile={profile} onProfileChanged={refreshProfile} />}
        {tab === "company" && <CompanyPage profile={profile} onProfileChanged={refreshProfile} />}
        {tab === "clients" && (
          <AiClients
            apiKey={apiKey}
            hasApiKey={hasApiKey}
            onOpenSettings={() => setShowSettings(true)}
            onCompleteRequest={handleCompleteRequest}
          />
        )}
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

      {showSettings && (
        <SettingsModal
          currentKey={apiKey}
          onSave={setApiKey}
          onClose={() => setShowSettings(false)}
        />
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {children}
    </button>
  );
}

export default App;
