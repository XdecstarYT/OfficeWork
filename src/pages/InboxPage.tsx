import { useCallback, useEffect, useState } from "react";
import {
  fetchInbox,
  sendEmailToCoworker,
  sendEmailToClient,
  recordClientReply,
  markRead,
  type EmailRow,
} from "../lib/emails";
import { fetchCompanyMembers } from "../lib/company";
import { CLIENTS, getClient } from "../data/clients";
import { generateClientEmailReply, staticClientEmailReply } from "../lib/aiClient";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface InboxPageProps {
  profile: Profile;
  apiKey: string;
  hasApiKey: boolean;
}

type RecipientChoice = { type: "coworker"; id: string } | { type: "client"; id: string };

export function InboxPage({ profile, apiKey, hasApiKey }: InboxPageProps) {
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEmail, setOpenEmail] = useState<EmailRow | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [recipient, setRecipient] = useState<RecipientChoice | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [inbox, companyMembers] = await Promise.all([
      fetchInbox(profile.id),
      profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
    ]);
    setEmails(inbox);
    setMembers(companyMembers);
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

  function senderLabel(email: EmailRow): string {
    if (email.sender_id === profile.id) return "You";
    if (email.sender_client_id) return getClient(email.sender_client_id)?.name ?? "Unknown Client";
    return members.find((m) => m.id === email.sender_id)?.display_name ?? "Unknown";
  }

  function recipientLabel(email: EmailRow): string {
    if (email.recipient_id === profile.id) return "You";
    if (email.recipient_client_id) return getClient(email.recipient_client_id)?.name ?? "Unknown Client";
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
      } else {
        const client = getClient(recipient.id)!;
        await sendEmailToClient({
          companyId: profile.company_id,
          senderId: profile.id,
          clientId: client.id,
          subject: subject.trim(),
          body: body.trim(),
        });
        const reply = hasApiKey
          ? await generateClientEmailReply(client, subject.trim(), body.trim(), apiKey).catch(() =>
              staticClientEmailReply(client, subject.trim()),
            )
          : staticClientEmailReply(client, subject.trim());
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
          <button
            type="button"
            onClick={() => setShowCompose(true)}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            ✉️ Compose
          </button>
        </div>

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
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">New Email</h2>

            <label className="mt-3 text-xs font-medium text-stone-500">To</label>
            <select
              value={recipient ? `${recipient.type}:${recipient.id}` : ""}
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                setRecipient(type ? { type: type as "coworker" | "client", id } : null);
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

            {recipient?.type === "client" && !hasApiKey && (
              <p className="mt-2 text-xs text-amber-600">
                No Groq key connected — this client will send back a canned reply instead of an
                AI-written one.
              </p>
            )}
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
    </div>
  );
}
