import { useCallback, useEffect, useState } from "react";
import {
  fetchInbox,
  sendEmailToCoworker,
  sendEmailToClient,
  recordClientReply,
  sendEmailToNpc,
  recordNpcReply,
  markRead,
  markUnread,
  markAllRead,
  setEmailFlagged,
  setEmailArchived,
  type EmailRow,
} from "../lib/emails";
import {
  loadEmailComposeDraft,
  saveEmailComposeDraft,
  clearEmailComposeDraft,
  loadSnoozedUntil,
  saveSnoozedUntil,
} from "../lib/storage";
import { relativeTime } from "../lib/time";

const CANNED_REPLIES = [
  "Thanks for the update - noted!",
  "On it, will have this back to you shortly.",
  "Could you send a bit more detail on this?",
  "Sounds good, approved.",
  "I'll need a few more days on this one.",
];
import { fetchCompanyMembers } from "../lib/company";
import { fetchCompanyNpcs, resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { fetchCustomNpcPersonas, type CustomNpcPersonaRow } from "../lib/customNpcPersonas";
import { CLIENTS, getClient } from "../data/clients";
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
  const [customNpcPersonas, setCustomNpcPersonas] = useState<CustomNpcPersonaRow[]>([]);
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
  const [emailQuery, setEmailQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [senderFilter, setSenderFilter] = useState<"all" | "coworker" | "client" | "npc">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [snoozed, setSnoozed] = useState<Record<string, number>>(() => loadSnoozedUntil());
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [copyLabel, setCopyLabel] = useState("📋 Copy");

  const load = useCallback(async () => {
    setLoading(true);
    const [inbox, companyMembers, companyNpcs, customPersonas] = await Promise.all([
      fetchInbox(profile.id),
      profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCompanyNpcs(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCustomNpcPersonas(profile.company_id) : Promise.resolve([]),
    ]);
    setEmails(inbox);
    setMembers(companyMembers);
    setNpcs(companyNpcs);
    setCustomNpcPersonas(customPersonas);
    setLoading(false);
  }, [profile.id, profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Autosaves whatever's in the compose form to this browser, restored the
  // next time Compose is opened fresh (not via Reply/Forward) - mirrors the
  // same draft-preserving pattern used for document field values.
  useEffect(() => {
    if (!showCompose) return;
    if (!recipient && !subject && !body) return;
    saveEmailComposeDraft({ recipient: recipient ? `${recipient.type}:${recipient.id}` : "", subject, body });
  }, [showCompose, recipient, subject, body]);

  useEffect(() => {
    if (!openEmail && !showCompose) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenEmail(null);
        setShowCompose(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [openEmail, showCompose]);

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
    return npc ? (resolveNpcPersona(npc, customNpcPersonas)?.name ?? "AI Coworker") : "AI Coworker";
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

  function senderTypeOf(email: EmailRow): "coworker" | "client" | "npc" {
    if (email.sender_client_id || email.recipient_client_id) return "client";
    if (email.sender_npc_id || email.recipient_npc_id) return "npc";
    return "coworker";
  }

  function openCompose(prefill?: { recipient: RecipientChoice | null; subject: string; body: string }) {
    setOpenEmail(null);
    setError(null);
    if (prefill) {
      setRecipient(prefill.recipient);
      setSubject(prefill.subject);
      setBody(prefill.body);
    }
    setShowCompose(true);
  }

  function handleReply(email: EmailRow) {
    const other: RecipientChoice | null = email.sender_client_id
      ? { type: "client", id: email.sender_client_id }
      : email.sender_npc_id
        ? { type: "npc", id: email.sender_npc_id }
        : email.sender_id
          ? { type: "coworker", id: email.sender_id }
          : null;
    if (!other) return;
    openCompose({
      recipient: other,
      subject: email.subject.startsWith("Re: ") ? email.subject : `Re: ${email.subject}`,
      body: "",
    });
  }

  function handleForward(email: EmailRow) {
    const quoted = email.body
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    openCompose({
      recipient: null,
      subject: email.subject.startsWith("Fwd: ") ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---- Forwarded message from ${senderLabel(email)} ----\n${quoted}`,
    });
  }

  function handleSnooze(email: EmailRow) {
    const next = { ...snoozed, [email.id]: Date.now() + 24 * 3_600_000 };
    setSnoozed(next);
    saveSnoozedUntil(next);
    setOpenEmail(null);
  }

  async function handleToggleUnread(email: EmailRow) {
    if (email.read_at) {
      await markUnread(email.id);
    } else {
      await markRead(email.id);
    }
    load();
  }

  async function handleArchiveAllRead() {
    const readEmails = emails.filter((e) => e.recipient_id === profile.id && e.read_at && !e.archived);
    await Promise.all(readEmails.map((e) => setEmailArchived(e.id, true)));
    load();
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
        // The custom persona backing this hire can be deleted after the fact
        // (hired coworkers stay hired) - fall back to a generic persona
        // rather than crashing the send.
        const persona = resolveNpcPersona(npc, customNpcPersonas) ?? {
          key: npc.id,
          name: "AI Coworker",
          avatar: "🤖",
          suggestedTitle: npc.job_title,
          suggestedLevel: npc.level,
          personality: "A helpful AI coworker.",
          hireCost: 0,
        };
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
      clearEmailComposeDraft();
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
    const persona = npc ? resolveNpcPersona(npc, customNpcPersonas) : null;
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

  async function handleMarkAllRead() {
    const unreadIds = emails
      .filter((e) => e.recipient_id === profile.id && !e.read_at)
      .map((e) => e.id);
    await markAllRead(unreadIds);
    load();
  }

  async function handleToggleFlag(email: EmailRow) {
    await setEmailFlagged(email.id, !email.flagged);
    load();
  }

  async function handleToggleArchive(email: EmailRow) {
    await setEmailArchived(email.id, !email.archived);
    if (openEmail?.id === email.id) setOpenEmail(null);
    load();
  }

  const now = Date.now();
  const activeSnoozedIds = new Set(Object.keys(snoozed).filter((id) => snoozed[id] > now));
  const visibleEmails = emails
    .filter((e) => showArchived || !e.archived)
    .filter((e) => !unreadOnly || (e.recipient_id === profile.id && !e.read_at))
    .filter((e) => !flaggedOnly || e.flagged)
    .filter((e) => senderFilter === "all" || senderTypeOf(e) === senderFilter)
    .filter((e) => showSnoozed || !activeSnoozedIds.has(e.id))
    .filter((e) => {
      const q = emailQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        e.subject.toLowerCase().includes(q) ||
        senderLabel(e).toLowerCase().includes(q) ||
        recipientLabel(e).toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) =>
      sortOrder === "newest" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at),
    );
  const unreadCount = emails.filter((e) => e.recipient_id === profile.id && !e.read_at).length;
  const flaggedCount = emails.filter((e) => e.flagged).length;
  const readCount = emails.filter((e) => e.recipient_id === profile.id && e.read_at && !e.archived).length;
  const snoozedCount = activeSnoozedIds.size;

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
              onClick={() => {
                const draft = loadEmailComposeDraft();
                if (draft && (draft.subject || draft.body || draft.recipient)) {
                  const [type, id] = draft.recipient.split(":");
                  setRecipient(type ? { type: type as "coworker" | "client" | "npc", id } : null);
                  setSubject(draft.subject);
                  setBody(draft.body);
                }
                setShowCompose(true);
              }}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
            >
              ✉️ Compose
            </button>
          </div>
        </div>

        {error && !showCompose && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        {emails.length > 0 && (
          <p className="text-xs text-stone-400">
            {emails.length} emails · {unreadCount} unread · {flaggedCount} flagged
            {snoozedCount > 0 && ` · ${snoozedCount} snoozed`}
          </p>
        )}

        {emails.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={emailQuery}
              onChange={(e) => setEmailQuery(e.target.value)}
              placeholder="Search subject or sender…"
              className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setUnreadOnly((v) => !v)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                unreadOnly ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
              }`}
            >
              Unread only
            </button>
            <button
              type="button"
              onClick={() => setFlaggedOnly((v) => !v)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                flaggedOnly ? "bg-amber-500 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
              }`}
            >
              ⭐ Flagged only
            </button>
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                showArchived ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
              }`}
            >
              {showArchived ? "Showing archived" : "Show archived"}
            </button>
            {snoozedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSnoozed((v) => !v)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  showSnoozed ? "bg-sky-600 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
                }`}
              >
                😴 {showSnoozed ? "Hide snoozed" : `Show snoozed (${snoozedCount})`}
              </button>
            )}
            <select
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value as typeof senderFilter)}
              className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-500 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">Everyone</option>
              <option value="coworker">Coworkers</option>
              <option value="client">Clients</option>
              <option value="npc">AI Coworkers</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
              className="shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              {sortOrder === "newest" ? "↓ Newest" : "↑ Oldest"}
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="shrink-0 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Mark all read ({unreadCount})
              </button>
            )}
            {readCount > 0 && (
              <button
                type="button"
                onClick={handleArchiveAllRead}
                className="shrink-0 text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                Archive all read ({readCount})
              </button>
            )}
          </div>
        )}

        {emails.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            No emails yet. Send one to a coworker or a client.
          </p>
        ) : visibleEmails.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            No emails match that search/filter.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleEmails.map((email) => {
              const isUnread = email.recipient_id === profile.id && !email.read_at;
              return (
                <div
                  key={email.id}
                  className={`relative flex flex-col gap-0.5 rounded-md border border-stone-100 hover:bg-stone-50 ${
                    isUnread ? "bg-emerald-50/50" : "bg-white"
                  } ${email.archived ? "opacity-60" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => openEmailDetail(email)}
                    className="flex flex-col gap-0.5 p-3 pr-16 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isUnread ? "font-semibold text-stone-900" : "text-stone-700"}`}>
                        {senderLabel(email)} → {recipientLabel(email)}
                      </span>
                      <span className="text-xs text-stone-400" title={new Date(email.created_at).toLocaleString()}>
                        {relativeTime(email.created_at)}
                      </span>
                    </div>
                    <span className={`text-sm ${isUnread ? "font-medium text-stone-800" : "text-stone-500"}`}>
                      {email.flagged && "⭐ "}
                      {email.subject}
                      {email.archived && " · archived"}
                    </span>
                  </button>
                  {email.recipient_id === profile.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFlag(email);
                      }}
                      title={email.flagged ? "Remove flag" : "Flag as important"}
                      className={`absolute right-3 top-3 text-lg leading-none ${
                        email.flagged ? "text-amber-500" : "text-stone-300 hover:text-stone-400"
                      }`}
                    >
                      {email.flagged ? "★" : "☆"}
                    </button>
                  )}
                </div>
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
            <p className="print-area mt-3 whitespace-pre-wrap text-sm text-stone-700">{openEmail.body}</p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(openEmail.body).catch(() => {});
                  setCopyLabel("Copied!");
                  setTimeout(() => setCopyLabel("📋 Copy"), 1500);
                }}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                🖨 Print
              </button>
              <button
                type="button"
                onClick={() => handleForward(openEmail)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                ↪ Forward
              </button>
              {openEmail.sender_id && openEmail.sender_id !== profile.id && (
                <button
                  type="button"
                  onClick={() => handleReply(openEmail)}
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  ↩ Reply
                </button>
              )}
              {openEmail.recipient_id === profile.id && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSnooze(openEmail)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    😴 Snooze 1d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleUnread(openEmail)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {openEmail.read_at ? "Mark Unread" : "Mark Read"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFlag(openEmail)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {openEmail.flagged ? "☆ Unflag" : "⭐ Flag"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleArchive(openEmail)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    {openEmail.archived ? "Unarchive" : "🗄 Archive"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setOpenEmail(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Close
              </button>
            </div>
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
                    const persona = resolveNpcPersona(npc, customNpcPersonas);
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

            <div className="mt-3 flex items-center justify-between">
              <label className="text-xs font-medium text-stone-500">Message</label>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${e.target.value}` : e.target.value));
                  e.target.value = "";
                }}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-500 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Insert a quick phrase…</option>
                {CANNED_REPLIES.map((phrase) => (
                  <option key={phrase} value={phrase}>
                    {phrase}
                  </option>
                ))}
              </select>
            </div>
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
                const persona = resolveNpcPersona(npc, customNpcPersonas);
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
