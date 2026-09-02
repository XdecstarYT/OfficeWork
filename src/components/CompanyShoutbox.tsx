import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type ChatMessageRow = Database["public"]["Tables"]["company_chat_messages"]["Row"];

interface CompanyShoutboxProps {
  companyId: string;
  profile: Profile;
  members: Profile[];
}

/** A lightweight realtime company-wide chat - deliberately just a scrolling
 * list + input, no threading/reactions/edit, so it stays a quick "shout
 * something at the team" outlet rather than competing with Inbox/Corporate
 * Updates for anything more structured. */
export function CompanyShoutbox({ companyId, profile, members }: CompanyShoutboxProps) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("company_chat_messages")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(50);
    setMessages(data ?? []);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`company-chat-${companyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_chat_messages", filter: `company_id=eq.${companyId}` },
        (payload) => {
          const incoming = payload.new as ChatMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function nameFor(senderId: string) {
    if (senderId === profile.id) return "You";
    return members.find((m) => m.id === senderId)?.display_name ?? "Someone";
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    const { data, error } = await supabase
      .from("company_chat_messages")
      .insert({ company_id: companyId, sender_id: profile.id, body: text.slice(0, 500) })
      .select()
      .single();
    setSending(false);
    if (error) {
      setDraft(text);
      return;
    }
    // Append immediately rather than waiting on the realtime echo - the
    // INSERT subscription below already de-dupes by id, so this is safe
    // even if that event arrives a moment later.
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">💬 Shoutbox</h2>
      <div ref={listRef} className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md bg-white p-2">
        {messages.length === 0 ? (
          <p className="p-2 text-center text-xs text-stone-400">No messages yet - say hi.</p>
        ) : (
          messages.map((m) => (
            <p key={m.id} className="text-sm text-stone-700">
              <span className="font-medium text-stone-900">{nameFor(m.sender_id)}:</span> {m.body}
            </p>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Say something to the team…"
          maxLength={500}
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="shrink-0 rounded-md bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
