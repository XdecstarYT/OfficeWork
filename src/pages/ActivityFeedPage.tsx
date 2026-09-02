import { useCallback, useEffect, useState } from "react";
import { fetchCompanyActivity, type ActivityItem } from "../lib/activity";
import { fetchCompanyMembers } from "../lib/company";
import { downloadCsv } from "../lib/csv";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

const PAGE_SIZE = 100;

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ActivityFeedPageProps {
  profile: Profile;
}

const EVENT_LABEL: Record<string, string> = {
  requested: "requested",
  assigned: "assigned",
  submitted: "submitted",
  completed: "completed",
  approved: "approved",
  rejected: "sent back",
  sent: "reassigned",
};

const EVENT_ICON: Record<string, string> = {
  requested: "📋",
  assigned: "📌",
  submitted: "📤",
  completed: "✅",
  approved: "✅",
  rejected: "↩️",
  sent: "➡️",
};

export function ActivityFeedPage({ profile }: ActivityFeedPageProps) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorFilter, setActorFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [activity, companyMembers] = await Promise.all([
      fetchCompanyActivity(profile.company_id, limit),
      fetchCompanyMembers(profile.company_id),
    ]);
    setItems(activity);
    setMembers(companyMembers);
    setLoading(false);
    setLoadingMore(false);
  }, [profile.company_id, limit]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`activity-${profile.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_events" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  function actorName(actorId: string | null): string {
    if (!actorId) return "Someone";
    if (actorId === profile.id) return "You";
    return members.find((m) => m.id === actorId)?.display_name ?? "Someone";
  }

  if (loading && items.length === 0) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading activity…</div>;
  }

  const visibleItems = items
    .filter((item) => !actorFilter || item.actor_id === actorFilter)
    .filter((item) => !eventFilter || item.event_type === eventFilter);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🗞 Activity Feed</h1>
            <p className="text-sm text-stone-500">Everything happening across the company, live.</p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadCsv("activity-feed.csv", [
                  ["Date", "Actor", "Event", "Document", "Note"],
                  ...visibleItems.map((item) => [
                    new Date(item.created_at).toLocaleString(),
                    actorName(item.actor_id),
                    EVENT_LABEL[item.event_type] ?? item.event_type,
                    item.documentTitle,
                    item.note ?? "",
                  ]),
                ])
              }
              className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Everyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All events</option>
              {Object.entries(EVENT_LABEL).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            Nothing has happened yet — request or assign some work to get started.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-stone-100 px-3 py-2"
                >
                  <span className="text-base leading-none">{EVENT_ICON[item.event_type] ?? "•"}</span>
                  <div className="flex-1">
                    <p className="text-sm text-stone-700">
                      <span className="font-medium text-stone-900">{actorName(item.actor_id)}</span>{" "}
                      {EVENT_LABEL[item.event_type] ?? item.event_type}{" "}
                      <span className="font-medium text-stone-900">"{item.documentTitle}"</span>
                      {item.note && <span className="text-stone-500"> — {item.note}</span>}
                    </p>
                    <p className="text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            {items.length >= limit && (
              <button
                type="button"
                onClick={() => {
                  setLoadingMore(true);
                  setLimit((l) => l + PAGE_SIZE);
                }}
                disabled={loadingMore}
                className="self-center rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load More"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
