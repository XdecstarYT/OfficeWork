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

interface AgendaItem {
  id: string;
  date: string;
  time: string | null;
  emoji: string;
  label: string;
}

export function CompanyCalendarPage({ profile }: CompanyCalendarPageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [meetings, setMeetings] = useState<BoardMeetingRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequestRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    });
  }

  items.sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));
  const grouped = new Map<string, AgendaItem[]>();
  for (const item of items) {
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date)!.push(item);
  }
  const dates = [...grouped.keys()].sort();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">🗓 Company Calendar</h1>
          <p className="text-sm text-stone-500">
            Day {company.current_day} · upcoming board meetings, work due dates, and time off.
          </p>
        </div>

        {dates.length === 0 ? (
          <p className="text-sm text-stone-400">Nothing on the calendar right now.</p>
        ) : (
          dates.map((date) => (
            <div key={date} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                {date === todayIso
                  ? "Today"
                  : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
              </h2>
              <div className="flex flex-col gap-1.5">
                {grouped.get(date)!.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border border-stone-100 bg-white px-3 py-2 text-sm text-stone-700"
                  >
                    <span>{item.emoji}</span>
                    <span className="flex-1">{item.label}</span>
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
