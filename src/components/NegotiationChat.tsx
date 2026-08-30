import { useState } from "react";
import type { ClientPersona } from "../data/clients";
import type { ChatMessage, ClientRequest } from "../types/template";
import { sendNegotiationMessage, type NegotiationOffer } from "../lib/aiClient";
import type { LlmConfig } from "../lib/llmConfig";

interface NegotiationChatProps {
  clientPersona: ClientPersona;
  request: ClientRequest;
  llmConfig: LlmConfig;
  onAcceptOffer: (offer: NegotiationOffer) => void;
}

export function NegotiationChat({ clientPersona, request, llmConfig, onAcceptOffer }: NegotiationChatProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingOffer, setPendingOffer] = useState<NegotiationOffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const nextHistory: ChatMessage[] = [...history, { role: "user", text }];
    setHistory(nextHistory);
    setLoading(true);
    try {
      const result = await sendNegotiationMessage(clientPersona, request, history, text, llmConfig);
      setHistory([...nextHistory, { role: "assistant", text: result.reply }]);
      if (result.offer) setPendingOffer(result.offer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reaching the client.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-3">
        {history.length === 0 && (
          <p className="text-sm text-stone-400">
            Say hi to {clientPersona.name}, or ask about the payout or deadline.
          </p>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm ${
              m.role === "user"
                ? "self-end bg-emerald-700 text-white"
                : "self-start bg-white text-stone-800 shadow-sm"
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="self-start text-xs text-stone-400">{clientPersona.name} is typing…</div>}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {pendingOffer && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div>
            <p className="font-medium text-emerald-900">
              New offer: ${pendingOffer.payout}, due in {pendingOffer.deadlineDays}d
            </p>
            <p className="text-emerald-700">{pendingOffer.note}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onAcceptOffer(pendingOffer);
              setPendingOffer(null);
            }}
            className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
          >
            Accept
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading}
          className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
