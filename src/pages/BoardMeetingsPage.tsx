import { useCallback, useEffect, useState } from "react";
import {
  fetchMeetings,
  fetchRsvpsForMeetings,
  scheduleMeeting,
  setRsvp,
  cancelMeeting,
  type BoardMeetingRow,
  type RsvpRow,
} from "../lib/boardMeetings";
import { fetchCompanyMembers } from "../lib/company";
import { assignWork } from "../lib/documents";
import { getTemplate } from "../lib/templates";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const BOARD_MEETING_MINUTES_TEMPLATE_ID = "meeting-minutes-08";

interface BoardMeetingsPageProps {
  profile: Profile;
}

export function BoardMeetingsPage({ profile }: BoardMeetingsPageProps) {
  const [meetings, setMeetings] = useState<BoardMeetingRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSchedule, setShowSchedule] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [meetingRows, companyMembers] = await Promise.all([
      fetchMeetings(profile.company_id),
      fetchCompanyMembers(profile.company_id),
    ]);
    setMeetings(meetingRows);
    setMembers(companyMembers);
    setRsvps(await fetchRsvpsForMeetings(meetingRows.map((m) => m.id)));
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`board-meetings-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_meetings", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "board_meeting_rsvps" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.company_id || !scheduledAt) return;
    setError(null);
    try {
      await scheduleMeeting({
        companyId: profile.company_id,
        title: title.trim(),
        agenda: agenda.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
        createdBy: profile.id,
        memberIds: members.map((m) => m.id),
      });
      setShowSchedule(false);
      setTitle("");
      setAgenda("");
      setScheduledAt("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't schedule that meeting.");
    }
  }

  async function handleRsvp(meetingId: string, status: "attending" | "declined") {
    await setRsvp(meetingId, profile.id, status);
    load();
  }

  async function handleCancel(meeting: BoardMeetingRow) {
    if (!window.confirm(`Cancel "${meeting.title}"? This can't be undone.`)) return;
    try {
      await cancelMeeting(meeting.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel that meeting.");
    }
  }

  async function handleGenerateMinutes(meeting: BoardMeetingRow) {
    if (!profile.company_id) return;
    const template = getTemplate(BOARD_MEETING_MINUTES_TEMPLATE_ID);
    if (!template) {
      setError("Board Meeting Minutes template not found in the library.");
      return;
    }
    const attendees = rsvps
      .filter((r) => r.meeting_id === meeting.id && r.status === "attending")
      .map((r) => members.find((m) => m.id === r.user_id)?.display_name)
      .filter(Boolean)
      .join("\n");

    await assignWork({
      companyId: profile.company_id,
      template,
      createdBy: profile.id,
      assignedTo: profile.id,
      isSelfRequest: true,
      initialFieldValues: {
        to: "All Attendees",
        from: profile.display_name,
        date: new Date(meeting.scheduled_at).toLocaleDateString(),
        subject: meeting.title,
        attendees,
        action_items: "",
        body: meeting.agenda ?? "",
      },
    });
    setStatusMessage(`Minutes for "${meeting.title}" added to your Work — check "My Work".`);
    setTimeout(() => setStatusMessage(null), 5000);
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading meetings…</div>;
  }

  const now = Date.now();
  const q = query.trim().toLowerCase();
  const matchesQuery = (m: BoardMeetingRow) => !q || m.title.toLowerCase().includes(q);
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at).getTime() >= now && matchesQuery(m));
  const past = meetings.filter((m) => new Date(m.scheduled_at).getTime() < now && matchesQuery(m));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">Board Meetings</h1>
            <p className="text-sm text-stone-500">Schedule a meeting and see who's attending.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSchedule(true)}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            📅 Schedule Meeting
          </button>
        </div>

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{statusMessage}</div>
        )}

        {meetings.length > 3 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search meetings by title…"
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        )}

        <MeetingList
          title="Upcoming"
          meetings={upcoming}
          rsvps={rsvps}
          members={members}
          profile={profile}
          onRsvp={handleRsvp}
          onGenerateMinutes={handleGenerateMinutes}
          onCancel={handleCancel}
          emptyLabel="No upcoming meetings."
        />
        <MeetingList
          title="Past"
          meetings={past}
          rsvps={rsvps}
          members={members}
          profile={profile}
          onRsvp={handleRsvp}
          onGenerateMinutes={handleGenerateMinutes}
          onCancel={handleCancel}
          emptyLabel="No past meetings yet."
        />
      </div>

      {showSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowSchedule(false)}
        >
          <form
            onSubmit={handleSchedule}
            className="flex w-full max-w-lg flex-col gap-3 rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">Schedule a Board Meeting</h2>
            <input
              type="text"
              placeholder="Title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <textarea
              placeholder="Agenda (optional)"
              rows={3}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MeetingList({
  title,
  meetings,
  rsvps,
  members,
  profile,
  onRsvp,
  onGenerateMinutes,
  onCancel,
  emptyLabel,
}: {
  title: string;
  meetings: BoardMeetingRow[];
  rsvps: RsvpRow[];
  members: Profile[];
  profile: Profile;
  onRsvp: (meetingId: string, status: "attending" | "declined") => void;
  onGenerateMinutes: (meeting: BoardMeetingRow) => void;
  onCancel: (meeting: BoardMeetingRow) => void;
  emptyLabel: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      {meetings.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-400">
          {emptyLabel}
        </p>
      ) : (
        meetings.map((meeting) => {
          const meetingRsvps = rsvps.filter((r) => r.meeting_id === meeting.id);
          const myRsvp = meetingRsvps.find((r) => r.user_id === profile.id);
          const attendingCount = meetingRsvps.filter((r) => r.status === "attending").length;
          const declinedCount = meetingRsvps.filter((r) => r.status === "declined").length;
          const canCancel = meeting.created_by === profile.id || profile.level >= 100;
          const isToday = new Date(meeting.scheduled_at).toDateString() === new Date().toDateString();
          return (
            <div key={meeting.id} className="rounded-md border border-stone-100 p-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
                  {meeting.title}
                  {isToday && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      Today
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-stone-400">
                    {new Date(meeting.scheduled_at).toLocaleString()}
                  </p>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(meeting)}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      🗑️ Cancel
                    </button>
                  )}
                </div>
              </div>
              {meeting.agenda && <p className="mt-1 text-xs text-stone-500">{meeting.agenda}</p>}
              <p className="mt-1 text-xs text-stone-400">
                ✅ {attendingCount} attending · ❌ {declinedCount} declined · organized by{" "}
                {members.find((m) => m.id === meeting.created_by)?.display_name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRsvp(meeting.id, "attending")}
                  className={`rounded-md border px-3 py-1 text-xs font-medium ${
                    myRsvp?.status === "attending"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-stone-300 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  ✅ Attending
                </button>
                <button
                  type="button"
                  onClick={() => onRsvp(meeting.id, "declined")}
                  className={`rounded-md border px-3 py-1 text-xs font-medium ${
                    myRsvp?.status === "declined"
                      ? "border-stone-600 bg-stone-600 text-white"
                      : "border-stone-300 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  ❌ Can't Make It
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateMinutes(meeting)}
                  className="rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  📝 Generate Minutes
                </button>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
