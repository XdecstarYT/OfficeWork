import { useState } from "react";
import { FilingCabinet } from "./pages/FilingCabinet";
import { AiClients } from "./pages/AiClients";
import { SettingsModal } from "./components/SettingsModal";
import { usePlayerState } from "./hooks/usePlayerState";
import { useApiKey } from "./hooks/useApiKey";
import type { DocumentTemplate, ClientRequest } from "./types/template";

type Tab = "cabinet" | "clients";

function App() {
  const [tab, setTab] = useState<Tab>("cabinet");
  const [startedTemplate, setStartedTemplate] = useState<DocumentTemplate | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { money, addMoney } = usePlayerState();
  const { apiKey, hasApiKey, setApiKey } = useApiKey();

  function handleCompleteRequest(request: ClientRequest) {
    addMoney(request.payout);
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
            <TabButton active={tab === "clients"} onClick={() => setTab("clients")}>
              🤝 AI Clients
            </TabButton>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 tabular-nums">
            💵 ${money.toFixed(2)}
          </span>
          <span className="text-xs text-stone-400">Junior Clerk · Level 1</span>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {tab === "cabinet" ? (
          <FilingCabinet onStart={setStartedTemplate} />
        ) : (
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
          Starting <strong>{startedTemplate.title}</strong>… (fill-out screen lands in Phase 2)
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
