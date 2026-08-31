import { useCallback, useEffect, useState } from "react";
import { CLIENTS, type ClientPersona } from "../data/clients";
import { getPreviewRequestForClient } from "../data/clientPreviewRequests";
import { generateClientRequest, generateClientPersonaIdea } from "../lib/aiClient";
import {
  fetchCustomAiClients,
  createCustomAiClient,
  deleteCustomAiClient,
  customRowToClientPersona,
  type CustomAiClientRow,
} from "../lib/customAiClients";
import { TAXONOMY } from "../data/taxonomy";
import { useClientRequests } from "../hooks/useClientRequests";
import { useClientRelationships } from "../hooks/useClientRelationships";
import { ClientRequestModal } from "../components/ClientRequestModal";
import { supabase } from "../lib/supabaseClient";
import type { LlmConfig } from "../lib/llmConfig";
import type { ClientRequest } from "../types/template";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AiClientsProps {
  profile: Profile;
  isOwner: boolean;
  llmConfig: LlmConfig;
  onCompleteRequest: (request: ClientRequest) => void;
}

const RELATIONSHIP_TIERS = [
  { threshold: 10, emoji: "🤝", label: "Trusted Partner" },
  { threshold: 5, emoji: "🌟", label: "Favorite Client" },
  { threshold: 1, emoji: "🙂", label: "Familiar Face" },
];

function relationshipTier(completions: number) {
  return RELATIONSHIP_TIERS.find((t) => completions >= t.threshold) ?? null;
}

const EMPTY_CATEGORY_TEXT = TAXONOMY.map((c) => c.id).slice(0, 2).join(", ");

export function AiClients({ profile, isOwner, llmConfig, onCompleteRequest }: AiClientsProps) {
  const { requests, setRequest, clearRequest } = useClientRequests();
  const { relationships, recordCompletion } = useClientRelationships();
  const [loadingClientId, setLoadingClientId] = useState<string | null>(null);
  const [errorByClient, setErrorByClient] = useState<Record<string, string>>({});
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [customClients, setCustomClients] = useState<CustomAiClientRow[]>([]);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [clientDraftName, setClientDraftName] = useState("");
  const [clientDraftCompany, setClientDraftCompany] = useState("");
  const [clientDraftAvatar, setClientDraftAvatar] = useState("🧑‍💼");
  const [clientDraftPersonality, setClientDraftPersonality] = useState("");
  const [clientDraftCategories, setClientDraftCategories] = useState("");
  const [clientDraftMin, setClientDraftMin] = useState(15);
  const [clientDraftMax, setClientDraftMax] = useState(50);
  const [clientAiHint, setClientAiHint] = useState("");
  const [clientAiBusy, setClientAiBusy] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);

  const companyId = profile.company_id;

  const loadCustomClients = useCallback(async () => {
    if (!companyId) return;
    setCustomClients(await fetchCustomAiClients(companyId));
  }, [companyId]);

  useEffect(() => {
    loadCustomClients();
  }, [loadCustomClients]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`custom-ai-clients-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_ai_clients", filter: `company_id=eq.${companyId}` },
        () => loadCustomClients(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, loadCustomClients]);

  const allClients: ClientPersona[] = [...CLIENTS, ...customClients.map(customRowToClientPersona)];

  async function handleGenerateClientIdea() {
    setClientAiBusy(true);
    try {
      const idea = await generateClientPersonaIdea(clientAiHint, llmConfig);
      setClientDraftName(idea.name);
      setClientDraftCompany(idea.companyName);
      setClientDraftAvatar(idea.avatar);
      setClientDraftPersonality(idea.personality);
      setClientDraftCategories(idea.categoryAffinity.join(", "));
      setClientDraftMin(idea.payoutMin);
      setClientDraftMax(idea.payoutMax);
    } catch {
      // leave the form as-is - the boss can still fill it in by hand
    } finally {
      setClientAiBusy(false);
    }
  }

  async function handleCreateClient() {
    if (!companyId || !clientDraftName.trim()) return;
    setCreatingClient(true);
    try {
      const categoryIds = new Set(TAXONOMY.map((c) => c.id));
      const categoryAffinity = clientDraftCategories
        .split(",")
        .map((s) => s.trim())
        .filter((s) => categoryIds.has(s));
      await createCustomAiClient({
        companyId,
        createdBy: profile.id,
        name: clientDraftName.trim(),
        companyName: clientDraftCompany.trim() || "Independent",
        avatar: clientDraftAvatar.trim() || "🧑‍💼",
        personality: clientDraftPersonality.trim(),
        categoryAffinity: categoryAffinity.length > 0 ? categoryAffinity : [TAXONOMY[0].id],
        payoutMin: Math.max(1, clientDraftMin),
        payoutMax: Math.max(clientDraftMin + 1, clientDraftMax),
      });
      setShowCreateClient(false);
      setClientDraftName("");
      setClientDraftCompany("");
      setClientDraftAvatar("🧑‍💼");
      setClientDraftPersonality("");
      setClientDraftCategories("");
      setClientDraftMin(15);
      setClientDraftMax(50);
      setClientAiHint("");
      await loadCustomClients();
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleDeleteClient(id: string) {
    if (!window.confirm("Delete this custom client? Its active/past requests aren't affected.")) return;
    await deleteCustomAiClient(id);
    await loadCustomClients();
  }

  async function handleGetWork(clientId: string) {
    setErrorByClient((prev) => ({ ...prev, [clientId]: "" }));
    const client = allClients.find((c) => c.id === clientId)!;

    setLoadingClientId(clientId);
    try {
      const request = await generateClientRequest(client, llmConfig);
      setRequest(clientId, request);
    } catch (err) {
      const preview = getPreviewRequestForClient(clientId);
      if (preview) {
        setRequest(clientId, preview);
        setErrorByClient((prev) => ({
          ...prev,
          [clientId]: `${err instanceof Error ? err.message : "Couldn't reach your local LLM."} Showing a preview request instead.`,
        }));
      } else {
        setErrorByClient((prev) => ({
          ...prev,
          [clientId]: err instanceof Error ? err.message : "Couldn't reach the client.",
        }));
      }
    } finally {
      setLoadingClientId(null);
      setOpenClientId(clientId);
    }
  }

  const openClient = openClientId ? allClients.find((c) => c.id === openClientId) : null;
  const openRequest = openClientId ? requests[openClientId] : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">AI Clients</h1>
            <p className="text-sm text-stone-500">
              Take on real work from recurring clients — dynamic requests you can negotiate.
            </p>
          </div>
          {isOwner && companyId && (
            <button
              type="button"
              onClick={() => setShowCreateClient(true)}
              className="shrink-0 self-start rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              🎨 Add Custom Client
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allClients.map((c) => {
            const activeRequest = requests[c.id];
            const isLoading = loadingClientId === c.id;
            const customRow = customClients.find((row) => `custom:${row.id}` === c.id);
            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.avatar}</span>
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        {c.name}
                        {customRow && (
                          <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            custom
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-stone-400">{c.company}</p>
                    </div>
                  </div>
                  {customRow && (customRow.created_by === profile.id || isOwner) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteClient(customRow.id)}
                      className="shrink-0 text-xs text-stone-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-500">{c.personality}</p>

                {(() => {
                  const tier = relationshipTier(relationships[c.id] ?? 0);
                  return tier ? (
                    <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      {tier.emoji} {tier.label} · {relationships[c.id]} completed
                    </span>
                  ) : null;
                })()}

                {errorByClient[c.id] && (
                  <p className="text-xs text-amber-600">{errorByClient[c.id]}</p>
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

      {showCreateClient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowCreateClient(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">🎨 Add a Custom Client</h2>
            <p className="mt-1 text-xs text-stone-500">
              Shared with your whole company — every request they hand out is still freshly AI-generated.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientAiHint}
                  onChange={(e) => setClientAiHint(e.target.value)}
                  placeholder="Optional idea/hint for the AI…"
                  className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateClientIdea}
                  disabled={clientAiBusy}
                  className="shrink-0 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-50"
                >
                  {clientAiBusy ? "Thinking…" : "✨ AI Suggest"}
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientDraftAvatar}
                  onChange={(e) => setClientDraftAvatar(e.target.value)}
                  placeholder="🙂"
                  className="w-14 rounded-md border border-stone-300 px-2 py-1.5 text-center text-sm"
                />
                <input
                  type="text"
                  value={clientDraftName}
                  onChange={(e) => setClientDraftName(e.target.value)}
                  placeholder="Contact name"
                  className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </div>
              <input
                type="text"
                value={clientDraftCompany}
                onChange={(e) => setClientDraftCompany(e.target.value)}
                placeholder="Their company name"
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
              <textarea
                value={clientDraftPersonality}
                onChange={(e) => setClientDraftPersonality(e.target.value)}
                placeholder="Personality / how they communicate…"
                rows={2}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={clientDraftCategories}
                onChange={(e) => setClientDraftCategories(e.target.value)}
                placeholder={`Category ids, e.g. ${EMPTY_CATEGORY_TEXT}`}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <label className="flex flex-1 items-center gap-1 text-xs text-stone-500">
                  Payout $
                  <input
                    type="number"
                    min={1}
                    value={clientDraftMin}
                    onChange={(e) => setClientDraftMin(Number(e.target.value))}
                    className="w-16 rounded border border-stone-300 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex flex-1 items-center gap-1 text-xs text-stone-500">
                  to $
                  <input
                    type="number"
                    min={1}
                    value={clientDraftMax}
                    onChange={(e) => setClientDraftMax(Number(e.target.value))}
                    className="w-16 rounded border border-stone-300 px-2 py-1 text-xs"
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateClient(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateClient}
                disabled={creatingClient || !clientDraftName.trim()}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {creatingClient ? "Adding…" : "Add Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openClient && openRequest && (
        <ClientRequestModal
          clientPersona={openClient}
          request={openRequest}
          llmConfig={llmConfig}
          onClose={() => setOpenClientId(null)}
          onDecline={() => {
            clearRequest(openClient.id);
            setOpenClientId(null);
          }}
          onUpdateRequest={(updated) => setRequest(openClient.id, updated)}
          onComplete={(finalRequest) => {
            onCompleteRequest(finalRequest);
            recordCompletion(openClient.id);
            clearRequest(openClient.id);
            setOpenClientId(null);
          }}
        />
      )}
    </div>
  );
}
