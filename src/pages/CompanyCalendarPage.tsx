import { useCallback, useEffect, useState } from "react";
import { fetchCompany, fetchCompanyMembers } from "../lib/company";
import { fetchMeetings, type BoardMeetingRow } from "../lib/boardMeetings";
import { fetchCompanyDocuments, type DocumentRow } from "../lib/documents";
import { fetchTimeOffRequests, type TimeOffRequestRow } from "../lib/timeOff";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface CompanyCalendarPageProps {
  profile: Profile;
}

type AgendaKind = "meeting" | "due" | "leave";

interface AgendaItem {
  id: string;
  date: string;
  time: string | null;
  emoji: string;
  label: string;
  kind: AgendaKind;
  mine: boolean;
}

const KIND_LABEL: Record<AgendaKind, string> = { meeting: "Meetings", due: "Due Work", leave: "Time Off" };

export function CompanyCalendarPage({ profile }: CompanyCalendarPageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [meetings, setMeetings] = useState<BoardMeetingRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<AgendaKind | "all">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [copyLabel, setCopyLabel] = useState("📋 Copy Agenda");

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [c, m, mt, docs, off] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchCompanyMembers(profile.company_id),
      fetchMeetings(profile.company_id),
      fetchCompanyDocuments(profile.company_id),
      fetchTimeOffRequests(profile.company_id),
    ]);
    setCompany(c);
    setMembers(m);
    setMeetings(mt);
    setDocuments(docs);
    setTimeOff(off);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`calendar-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_meetings", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_off_requests", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  function nameFor(id: string | null) {
    if (!id) return "someone";
    if (id === profile.id) return "You";
    return members.find((m) => m.id === id)?.display_name ?? "someone";
  }

  if (loading || !company) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading calendar…</div>;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const items: AgendaItem[] = [];
  for (const mt of meetings) {
    const d = new Date(mt.scheduled_at);
    const iso = d.toISOString().slice(0, 10);
    if (iso < todayIso) continue;
    items.push({
      id: `mt-${mt.id}`,
      date: iso,
      time: d.toISOString().slice(11, 16),
      emoji: "📅",
      label: `Board Meeting: "${mt.title}"`,
      kind: "meeting",
      mine: mt.created_by === profile.id,
    });
  }
  for (const d of documents) {
    if (!d.due_at || d.status === "completed") continue;
    const due = new Date(d.due_at);
    const iso = due.toISOString().slice(0, 10);
    if (iso < todayIso) continue;
    items.push({
      id: `doc-${d.id}`,
      date: iso,
      time: due.toISOString().slice(11, 16),
      emoji: "📄",
      label: `"${d.title}" due — ${d.assigned_to ? nameFor(d.assigned_to) : "unassigned"}`,
      kind: "due",
      mine: d.assigned_to === profile.id,
    });
  }
  for (const r of timeOff) {
    if (r.status !== "approved") continue;
    if (r.end_date < todayIso) continue;
    const startIso = r.start_date < todayIso ? todayIso : r.start_date;
    items.push({
      id: `off-${r.id}`,
      date: startIso,
      time: null,
      emoji: "🌴",
      label: `${nameFor(r.member_id)} on leave through ${r.end_date}`,
      kind: "leave",
      mine: r.member_id === profile.id,
    });
  }

  items.sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));

  const kindCounts = items.reduce<Record<AgendaKind, number>>(
    (acc, item) => {
      acc[item.kind]++;
      return acc;
    },
    { meeting: 0, due: 0, leave: 0 },
  );

  const visibleItems = items
    .filter((item) => kindFilter === "all" || item.kind === kindFilter)
    .filter((item) => !mineOnly || item.mine);

  const grouped = new Map<string, AgendaItem[]>();
  for (const item of visibleItems) {
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date)!.push(item);
  }
  const dates = [...grouped.keys()].sort();

  function daysUntilLabel(date: string): string {
    const diffDays = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86_400_000);
    if (diffDays === 0) return "";
    if (diffDays === 1) return "in 1 day";
    return `in ${diffDays} days`;
  }

  function handleCopyAgenda() {
    const text = dates
      .map((date) => {
        const header = date === todayIso ? "Today" : new Date(`${date}T00:00:00`).toLocaleDateString();
        const lines = grouped.get(date)!.map((item) => `  ${item.emoji} ${item.label}`);
        return [header, ...lines].join("\n");
      })
      .join("\n\n");
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("📋 Copy Agenda"), 1500);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🗓 Company Calendar</h1>
            <p className="text-sm text-stone-500">
              Day {company.current_day} · {items.length} item{items.length === 1 ? "" : "s"} across {new Set(items.map((i) => i.date)).size} day
              {new Set(items.map((i) => i.date)).size === 1 ? "" : "s"} — 📅 {kindCounts.meeting} · 📄 {kindCounts.due} · 🌴 {kindCounts.leave}
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleCopyAgenda}
              className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              {copyLabel}
            </button>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "meeting", "due", "leave"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  kindFilter === k ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
                }`}
              >
                {k === "all" ? "All" : KIND_LABEL[k]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMineOnly((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                mineOnly ? "bg-sky-600 text-white" : "border border-stone-300 text-stone-500 hover:bg-stone-100"
              }`}
            >
              Only mine
            </button>
          </div>
        )}

        {dates.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing on the calendar right now.</p>
        ) : (
          dates.map((date) => (
            <div key={date} className="flex flex-col gap-2">
              <h2
                className={`text-xs font-semibold uppercase tracking-wider ${
                  date === todayIso ? "text-sky-600" : "text-stone-400"
                }`}
              >
                {date === todayIso
                  ? "Today"
                  : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                {daysUntilLabel(date) && <span className="ml-1.5 font-normal normal-case text-stone-400">({daysUntilLabel(date)})</span>}
              </h2>
              <div className="flex flex-col gap-1.5">
                {grouped.get(date)!.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-stone-700 ${
                      date === todayIso ? "border-sky-200 bg-sky-50/40" : "border-stone-100 bg-white"
                    }`}
                  >
                    <span>{item.emoji}</span>
                    <span className="flex-1">
                      {item.label}
                      {item.mine && <span className="ml-1.5 text-[10px] font-medium text-emerald-600">YOU</span>}
                    </span>
                    {item.time && <span className="text-xs text-stone-400">{item.time}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
