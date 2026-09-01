import { useCallback, useEffect, useState } from "react";
import {
  fetchCorporateUpdates,
  postCorporateUpdate,
  deleteCorporateUpdate,
  setCorporateUpdatePinned,
  type CorporateUpdateRow,
} from "../lib/corporateUpdates";
import { fetchCompanyMembers, awardMoney, awardXp } from "../lib/company";
import { rollCorporateEvent } from "../data/corporateEvents";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface CorporateUpdatesPageProps {
  profile: Profile;
  company: Company;
}

export function CorporateUpdatesPage({ profile, company }: CorporateUpdatesPageProps) {
  const [updates, setUpdates] = useState<CorporateUpdateRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [query, setQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");

  const isOwner = profile.id === company.owner_id;

  const load = useCallback(async () => {
    setLoading(true);
    const [rows, m] = await Promise.all([
      fetchCorporateUpdates(company.id),
      fetchCompanyMembers(company.id),
    ]);
    setUpdates(rows);
    setMembers(m);
    setLoading(false);
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`corporate-updates-${company.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corporate_updates", filter: `company_id=eq.${company.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [company.id, load]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      await postCorporateUpdate({
        companyId: company.id,
        title: title.trim(),
        body: body.trim(),
        postedBy: profile.id,
      });
      setShowCompose(false);
      setTitle("");
      setBody("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that update.");
    } finally {
      setPosting(false);
    }
  }

  async function handleRollEvent() {
    setRolling(true);
    setError(null);
    try {
      const event = rollCorporateEvent();
      await Promise.all(
        members.flatMap((m) => [
          event.moneyPerMember !== 0 ? awardMoney(m.id, event.moneyPerMember) : null,
          event.xpPerMember !== 0 ? awardXp(m.id, event.xpPerMember) : null,
        ]),
      );
      const effectLine =
        event.moneyPerMember !== 0 || event.xpPerMember !== 0
          ? `\n\n(Company-wide: ${event.moneyPerMember !== 0 ? `${event.moneyPerMember > 0 ? "+" : ""}$${event.moneyPerMember} money` : ""}${
              event.moneyPerMember !== 0 && event.xpPerMember !== 0 ? ", " : ""
            }${event.xpPerMember !== 0 ? `${event.xpPerMember > 0 ? "+" : ""}${event.xpPerMember} XP` : ""} per person.)`
          : "";
      await postCorporateUpdate({
        companyId: company.id,
        title: `${event.emoji} ${event.headline}`,
        body: `${event.body}${effectLine}`,
        postedBy: profile.id,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't trigger an event.");
    } finally {
      setRolling(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this update? This can't be undone.")) return;
    try {
      await deleteCorporateUpdate(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that update.");
    }
  }

  async function handleTogglePin(u: CorporateUpdateRow) {
    try {
      await setCorporateUpdatePinned(u.id, !u.pinned);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't pin that update.");
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading updates…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">📰 Corporate Updates</h1>
            <p className="text-sm text-stone-500">Company-wide news and announcements.</p>
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleRollEvent}
                disabled={rolling}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                {rolling ? "Rolling…" : "🎲 Trigger Event"}
              </button>
              <button
                type="button"
                onClick={() => setShowCompose(true)}
                className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
              >
                📢 Post Update
              </button>
            </div>
          )}
        </div>

        {error && !showCompose && <p className="text-sm text-red-600">{error}</p>}

        {updates.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search updates…"
              className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {updates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            {isOwner
              ? "Nothing posted yet — share the first company-wide update."
              : "No corporate updates yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {updates
              .filter((u) => !authorFilter || u.posted_by === authorFilter)
              .filter((u) => {
                const q = query.trim().toLowerCase();
                return !q || u.title.toLowerCase().includes(q) || u.body.toLowerCase().includes(q);
              })
              .slice()
              .sort((a, b) => Number(b.pinned) - Number(a.pinned))
              .map((u) => (
              <article
                key={u.id}
                className={`rounded-xl border p-5 shadow-sm ${
                  u.pinned ? "border-amber-300 bg-amber-50/40" : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Company-Wide
                    </span>
                    {u.pinned && <span className="text-xs" title="Pinned">📌</span>}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(u.created_at).toLocaleString()}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-semibold text-stone-900">{u.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                  {u.body}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-400">
                    — {members.find((m) => m.id === u.posted_by)?.display_name ?? "Leadership"}
                  </p>
                  <div className="flex items-center gap-3">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleTogglePin(u)}
                        className="text-xs font-medium text-amber-600 hover:text-amber-800"
                      >
                        {u.pinned ? "Unpin" : "📌 Pin"}
                      </button>
                    )}
                    {(isOwner || u.posted_by === profile.id) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showCompose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowCompose(false)}
        >
          <form
            onSubmit={handlePost}
            className="flex w-full max-w-lg flex-col gap-3 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">Post a Corporate Update</h2>
            <p className="text-xs text-stone-500">Every member of the company will see this.</p>
            <input
              type="text"
              placeholder="Headline (e.g. Q3 Results, New Office Policy...)"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <textarea
              placeholder="Write the update…"
              rows={6}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={posting}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {posting ? "Posting…" : "Post to Everyone"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
