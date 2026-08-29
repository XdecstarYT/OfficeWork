import { useState } from "react";
import { CLIENTS } from "../data/clients";
import { getPreviewRequestForClient } from "../data/clientPreviewRequests";
import { generateClientRequest } from "../lib/aiClient";
import { useClientRequests } from "../hooks/useClientRequests";
import { ClientRequestModal } from "../components/ClientRequestModal";
import type { ClientRequest } from "../types/template";

interface AiClientsProps {
  apiKey: string;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  onCompleteRequest: (request: ClientRequest) => void;
}

export function AiClients({ apiKey, hasApiKey, onOpenSettings, onCompleteRequest }: AiClientsProps) {
  const { requests, setRequest, clearRequest } = useClientRequests();
  const [loadingClientId, setLoadingClientId] = useState<string | null>(null);
  const [errorByClient, setErrorByClient] = useState<Record<string, string>>({});
  const [openClientId, setOpenClientId] = useState<string | null>(null);

  async function handleGetWork(clientId: string) {
    setErrorByClient((prev) => ({ ...prev, [clientId]: "" }));
    const client = CLIENTS.find((c) => c.id === clientId)!;

    if (!hasApiKey) {
      const preview = getPreviewRequestForClient(clientId);
      if (preview) setRequest(clientId, preview);
      setOpenClientId(clientId);
      return;
    }

    setLoadingClientId(clientId);
    try {
      const request = await generateClientRequest(client, apiKey);
      setRequest(clientId, request);
      setOpenClientId(clientId);
    } catch (err) {
      setErrorByClient((prev) => ({
        ...prev,
        [clientId]: err instanceof Error ? err.message : "Couldn't reach the client.",
      }));
    } finally {
      setLoadingClientId(null);
    }
  }

  const openClient = openClientId ? CLIENTS.find((c) => c.id === openClientId) : null;
  const openRequest = openClientId ? requests[openClientId] : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">AI Clients</h1>
            <p className="text-sm text-stone-500">
              Take on real work from recurring clients — dynamic requests you can negotiate.
            </p>
          </div>
          {!hasApiKey && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              🔑 Connect API Key
            </button>
          )}
        </div>

        {!hasApiKey && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No Anthropic API key configured — clients will hand you a fixed preview request
            instead of a live, dynamic one, and negotiation chat is unavailable. Add a key in
            Settings to unlock the full AI Clients experience.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CLIENTS.map((c) => {
            const activeRequest = requests[c.id];
            const isLoading = loadingClientId === c.id;
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.avatar}</span>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{c.name}</p>
                    <p className="text-xs text-stone-400">{c.company}</p>
                  </div>
                </div>
                <p className="text-xs text-stone-500">{c.personality}</p>

                {errorByClient[c.id] && (
                  <p className="text-xs text-red-600">{errorByClient[c.id]}</p>
                )}

                {activeRequest ? (
                  <button
                    type="button"
                    onClick={() => setOpenClientId(c.id)}
                    className="rounded-md bg-emerald-50 px-3 py-2 text-left text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    📋 {activeRequest.title} — ${activeRequest.payout}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGetWork(c.id)}
                    disabled={isLoading}
                    className="rounded-md bg-stone-800 px-3 py-2 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-50"
                  >
                    {isLoading ? "Reaching out…" : "Ask for Work"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {openClient && openRequest && (
        <ClientRequestModal
          clientPersona={openClient}
          request={openRequest}
          hasApiKey={hasApiKey}
          apiKey={apiKey}
          onClose={() => setOpenClientId(null)}
          onDecline={() => {
            clearRequest(openClient.id);
            setOpenClientId(null);
          }}
          onUpdateRequest={(updated) => setRequest(openClient.id, updated)}
          onComplete={(finalRequest) => {
            onCompleteRequest(finalRequest);
            clearRequest(openClient.id);
            setOpenClientId(null);
          }}
        />
      )}
    </div>
  );
}
