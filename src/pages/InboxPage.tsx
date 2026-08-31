import { useCallback, useEffect, useState } from "react";
import {
  fetchInbox,
  sendEmailToCoworker,
  sendEmailToClient,
  recordClientReply,
  sendEmailToNpc,
  recordNpcReply,
  markRead,
  type EmailRow,
} from "../lib/emails";
import { fetchCompanyMembers } from "../lib/company";
import { fetchCompanyNpcs, type CompanyNpcRow } from "../lib/npcs";
import { CLIENTS, getClient } from "../data/clients";
import { getNpcPersona } from "../data/npcs";
import {
  generateClientEmailReply,
  staticClientEmailReply,
  generateNpcEmailReply,
  staticNpcEmailReply,
  draftDocumentAsNpc,
} from "../lib/aiClient";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";
import type { LlmConfig } from "../lib/llmConfig";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface InboxPageProps {
  profile: Profile;
  llmConfig: LlmConfig;
}

type RecipientChoice =
  | { type: "coworker"; id: string }
  | { type: "client"; id: string }
  | { type: "npc"; id: string };

export function InboxPage({ profile, llmConfig }: InboxPageProps) {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [npcs, setNpcs] = useState<CompanyNpcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [recipient, setRecipient] = useState<RecipientChoice | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNpcId, setDraftNpcId] = useState<string | null>(null);
  const [showDraftTemplatePicker, setShowDraftTemplatePicker] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [inbox, companyMembers, companyNpcs] = await Promise.all([
      fetchInbox(profile.id),
      profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCompanyNpcs(profile.company_id) : Promise.resolve([]),
    ]);
    setEmails(inbox);
    setMembers(companyMembers);
    setNpcs(companyNpcs);
    setLoading(false);
  }, [profile.id, profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`emails-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emails", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  function npcName(npcId: string | null): string | null {
    if (!npcId) return null;
    const npc = npcs.find((n) => n.id === npcId);
    return npc ? (getNpcPersona(npc.persona_key)?.name ?? "AI Coworker") : "AI Coworker";
  }

  function senderLabel(email: EmailRow): string {
    if (email.sender_id === profile.id) return "You";
    if (email.sender_client_id) return getClient(email.sender_client_id)?.name ?? "Unknown Client";
    if (email.sender_npc_id) return npcName(email.sender_npc_id) ?? "AI Coworker";
    return members.find((m) => m.id === email.sender_id)?.display_name ?? "Unknown";
  }

  function recipientLabel(email: EmailRow): string {
    if (email.recipient_id === profile.id) return "You";
    if (email.recipient_client_id) return getClient(email.recipient_client_id)?.name ?? "Unknown Client";
    if (email.recipient_npc_id) return npcName(email.recipient_npc_id) ?? "AI Coworker";
    return members.find((m) => m.id === email.recipient_id)?.display_name ?? "Unknown";
  }

  async function openEmailDetail(email: EmailRow) {
    setOpenEmail(email);
    if (email.recipient_id === profile.id && !email.read_at) {
      await markRead(email.id);
      load();
    }
  }

  async function handleSend() {
    if (!recipient || !profile.company_id || !subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (recipient.type === "coworker") {
        await sendEmailToCoworker({
          companyId: profile.company_id,
          senderId: profile.id,
          recipientId: recipient.id,
          subject: subject.trim(),
          body: body.trim(),
        });
      } else if (recipient.type === "npc") {
        const npc = npcs.find((n) => n.id === recipient.id)!;
        const persona = getNpcPersona(npc.persona_key)!;
        await sendEmailToNpc({
          companyId: profile.company_id,
          senderId: profile.id,
          npcId: npc.id,
          subject: subject.trim(),
          body: body.trim(),
        });
        const reply = await generateNpcEmailReply(
          persona,
          subject.trim(),
          body.trim(),
          llmConfig,
        ).catch(() => staticNpcEmailReply(persona, subject.trim()));
        await recordNpcReply({
          companyId: profile.company_id,
          recipientId: profile.id,
          npcId: npc.id,
          subject: reply.subject,
          body: reply.body,
        });
      } else {
        const client = getClient(recipient.id)!;
        await sendEmailToClient({
          companyId: profile.company_id,
          senderId: profile.id,
          clientId: client.id,
          subject: subject.trim(),
          body: body.trim(),
        });
        const reply = await generateClientEmailReply(
          client,
          subject.trim(),
          body.trim(),
          llmConfig,
        ).catch(() => staticClientEmailReply(client, subject.trim()));
        await recordClientReply({
          companyId: profile.company_id,
          recipientId: profile.id,
          clientId: client.id,
          subject: reply.subject,
          body: reply.body,
        });
      }
      setShowCompose(false);
      setSubject("");
      setBody("");
      setRecipient(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that email.");
    } finally {
      setSending(false);
    }
  }

  async function handleAskToDraft(template: DocumentTemplate) {
    if (!profile.company_id || !draftNpcId) return;
    const npc = npcs.find((n) => n.id === draftNpcId);
    const persona = npc ? getNpcPersona(npc.persona_key) : null;
    if (!npc || !persona) return;
    setShowDraftTemplatePicker(false);
    setDrafting(true);
    try {
      const rendered = await draftDocumentAsNpc(persona, template, llmConfig);
      await recordNpcReply({
        companyId: profile.company_id,
        recipientId: profile.id,
        npcId: npc.id,
        subject: `Draft: ${template.title}`,
        body: `Here's a first draft of "${template.title}" like you asked — take a look and adjust as needed.\n\n${rendered}\n\n— ${persona.name}`,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get a draft.");
    } finally {
      setDrafting(false);
      setDraftNpcId(null);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading inbox…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">Inbox</h1>
            {profile.email_handle && (
              <p className="text-xs text-stone-400">{profile.email_handle}@officequest.mail</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {npcs.length > 0 && (
              <button
                type="button"
                onClick={() => setDraftNpcId("__pick__")}
                disabled={drafting}
                className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              >
                {drafting ? "Drafting…" : "🤖 Ask to Draft"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              ✉️ Compose
            </button>
          </div>
        </div>

        {error && !showCompose && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {emails.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            No emails yet. Send one to a coworker or a client.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {emails.map((email) => {
              const isUnread = email.recipient_id === profile.id && !email.read_at;
              return (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => openEmailDetail(email)}
                  className={`flex flex-col gap-0.5 rounded-md border border-stone-100 p-3 text-left hover:bg-stone-50 ${
                    isUnread ? "bg-emerald-50/50" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isUnread ? "font-semibold text-stone-900" : "text-stone-700"}`}>
                      {senderLabel(email)} → {recipientLabel(email)}
                    </span>
                    <span className="text-xs text-stone-400">
                      {new Date(email.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className={`text-sm ${isUnread ? "font-medium text-stone-800" : "text-stone-500"}`}>
                    {email.subject}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setOpenEmail(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs text-stone-400">
              {senderLabel(openEmail)} → {recipientLabel(openEmail)} ·{" "}
              {new Date(openEmail.created_at).toLocaleString()}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">{openEmail.subject}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{openEmail.body}</p>
            <button
              type="button"
              onClick={() => setOpenEmail(null)}
              className="mt-4 rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showCompose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowCompose(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">New Email</h2>

            <label className="mt-3 text-xs font-medium text-stone-500">To</label>
            <select
              value={recipient ? `${recipient.type}:${recipient.id}` : ""}
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                setRecipient(type ? { type: type as "coworker" | "client" | "npc", id } : null);
              }}
              className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select a recipient…</option>
              <optgroup label="Coworkers">
                {members
                  .filter((m) => m.id !== profile.id)
                  .map((m) => (
                    <option key={m.id} value={`coworker:${m.id}`}>
                      {m.display_name} ({m.job_title})
                    </option>
                  ))}
              </optgroup>
              {npcs.length > 0 && (
                <optgroup label="AI Coworkers">
                  {npcs.map((npc) => {
                    const persona = getNpcPersona(npc.persona_key);
                    return (
                      <option key={npc.id} value={`npc:${npc.id}`}>
                        {persona?.name ?? "AI Coworker"} ({npc.job_title})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label="Clients">
                {CLIENTS.map((c) => (
                  <option key={c.id} value={`client:${c.id}`}>
                    {c.name} — {c.company}
                  </option>
                ))}
              </optgroup>
            </select>

            <label className="mt-3 text-xs font-medium text-stone-500">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            <label className="mt-3 text-xs font-medium text-stone-500">Message</label>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !recipient || !subject.trim() || !body.trim()}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {draftNpcId === "__pick__" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setDraftNpcId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">Who should draft it?</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              {npcs.map((npc) => {
                const persona = getNpcPersona(npc.persona_key);
                return (
                  <button
                    key={npc.id}
                    type="button"
                    onClick={() => {
                      setDraftNpcId(npc.id);
                      setShowDraftTemplatePicker(true);
                    }}
                    className="rounded-md border border-stone-200 px-3 py-2 text-left text-sm hover:bg-stone-50"
                  >
                    {persona?.avatar ?? "🤖"} {persona?.name ?? "AI Coworker"}{" "}
                    <span className="text-xs text-stone-400">({npc.job_title})</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setDraftNpcId(null)}
              className="mt-4 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDraftTemplatePicker && draftNpcId && draftNpcId !== "__pick__" && (
        <TemplatePickerModal
          title="What should they draft?"
          companyId={profile.company_id}
          onPick={handleAskToDraft}
          onClose={() => {
            setShowDraftTemplatePicker(false);
            setDraftNpcId(null);
          }}
        />
      )}
    </div>
  );
}
