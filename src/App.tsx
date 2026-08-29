import { useState } from "react";
import { FilingCabinet } from "./pages/FilingCabinet";
import { usePlayerState } from "./hooks/usePlayerState";
import type { DocumentTemplate } from "./types/template";

function App() {
  const [startedTemplate, setStartedTemplate] = useState<DocumentTemplate | null>(null);
  const { money } = usePlayerState();

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <h1 className="text-base font-semibold text-stone-900">Office Quest</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm font-medium text-emerald-700 tabular-nums">
            💵 ${money.toFixed(2)}
          </span>
          <span className="text-xs text-stone-400">Junior Clerk · Level 1</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <FilingCabinet onStart={setStartedTemplate} />
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
    </div>
  );
}

export default App;
