import { useCallback, useEffect, useState } from "react";
import { fetchCompanyMembers, awardMoney, awardXp, claimMilestone } from "../lib/company";
import { fetchCompanyDocuments } from "../lib/documents";
import { fetchCompanyActivity, type ActivityItem } from "../lib/activity";
import { fetchCorporateUpdates, type CorporateUpdateRow } from "../lib/corporateUpdates";
import { fetchCompanyNpcs } from "../lib/npcs";
import { CAREER_MILESTONES, isMilestoneComplete } from "../data/careerMilestones";
import type { NotificationCounts } from "../hooks/useNotifications";
import { careerProgress } from "../lib/careerLevel";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

type Tab =
  | "dashboard"
  | "cabinet"
  | "clients"
  | "company"
  | "work"
  | "inbox"
  | "meetings"
  | "updates"
  | "activity"
  | "leaderboard"
  | "archive";

interface DashboardPageProps {
  profile: Profile;
  company: Company | null;
  notifications: NotificationCounts;
  onNavigate: (tab: Tab) => void;
  onProfileChanged: () => void;
}

const EVENT_ICON: Record<string, string> = {
  requested: "📋",
  assigned: "📌",
  submitted: "📤",
  completed: "✅",
  approved: "✅",
  rejected: "↩️",
  sent: "➡️",
};

export function DashboardPage({ profile, company, notifications, onNavigate, onProfileChanged }: DashboardPageProps) {
  const [memberCount, setMemberCount] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<CorporateUpdateRow | null>(null);
  const [updatesPosted, setUpdatesPosted] = useState(0);
  const [npcCount, setNpcCount] = useState(0);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const careerXp = careerProgress(profile.xp);

  const load = useCallback(async () => {
    if (!profile.company_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [m, docs, activity, updates, npcs] = await Promise.all([
      fetchCompanyMembers(profile.company_id),
      fetchCompanyDocuments(profile.company_id),
      fetchCompanyActivity(profile.company_id, 5),
      fetchCorporateUpdates(profile.company_id),
      fetchCompanyNpcs(profile.company_id),
    ]);
    setMembers(m);
    setMemberCount(m.length);
    setTasksCompleted(docs.filter((d) => d.status === "completed").length);
    setRecentActivity(activity);
    setLatestUpdate(updates[0] ?? null);
    setUpdatesPosted(updates.length);
    setNpcCount(npcs.length);
    setLoading(false);
  }, [profile.company_id]);

  async function handleClaimMilestone(milestoneId: string, rewardMoney: number, rewardXp: number) {
    setClaimingId(milestoneId);
    try {
      // The RPC is atomic and only reports true for the call that actually
      // claimed it, so a second click (or a race with another claim in
      // flight) never pays out the reward twice.
      const newlyClaimed = await claimMilestone(milestoneId);
      if (newlyClaimed) {
        if (rewardMoney > 0) await awardMoney(profile.id, rewardMoney);
        if (rewardXp > 0) await awardXp(profile.id, rewardXp);
      }
      onProfileChanged();
    } finally {
      setClaimingId(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`dashboard-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "document_events" }, () => load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "corporate_updates", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
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

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading dashboard…</div>;
  }

  const notificationTotal = notifications.pendingApproval + notifications.unreadEmail + notifications.overdue;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">
            👋 Welcome back, {profile.display_name}
          </h1>
          <p className="text-sm text-stone-500">
            {profile.job_title} at {company?.name ?? "your company"} · Rank {profile.level}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile emoji="💵" label="Money" value={`$${profile.money.toFixed(2)}`} />
          <StatTile
            emoji="⭐"
            label="Career Level"
            value={`Lvl ${careerXp.level}`}
            sub={`${careerXp.intoLevel}/${careerXp.xpPerLevel} XP`}
          />
          <StatTile emoji="🏢" label="Team Size" value={String(memberCount)} />
          <StatTile emoji="✅" label="Tasks Completed" value={String(tasksCompleted)} />
        </div>

        {company?.career_mode && (
          <section className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              🎯 Career Mode
            </h2>
            <p className="mt-1 text-xs text-indigo-500">
              Optional milestones with a one-time reward each — claim them as you reach them.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {CAREER_MILESTONES.map((milestone) => {
                const claimed = profile.claimed_milestones.includes(milestone.id);
                const complete = isMilestoneComplete(milestone.id, {
                  tasksCompleted,
                  money: profile.money,
                  careerLevel: careerXp.level,
                  npcCount,
                  currentDay: company?.current_day ?? 1,
                  updatesPosted,
                });
                return (
                  <div
                    key={milestone.id}
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                      claimed
                        ? "border-emerald-200 bg-emerald-50"
                        : complete
                          ? "border-indigo-200 bg-white"
                          : "border-stone-100 bg-stone-50"
                    }`}
                  >
                    <div className={complete || claimed ? "" : "opacity-50"}>
                      <p className="text-sm font-medium text-stone-800">
                        {milestone.emoji} {milestone.label}
                      </p>
                      <p className="text-xs text-stone-500">
                        {milestone.description}
                        {(milestone.rewardMoney > 0 || milestone.rewardXp > 0) && (
                          <>
                            {" "}
                            — reward:{" "}
                            {[
                              milestone.rewardMoney > 0 ? `$${milestone.rewardMoney}` : null,
                              milestone.rewardXp > 0 ? `${milestone.rewardXp} XP` : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </>
                        )}
                      </p>
                    </div>
                    {claimed ? (
                      <span className="shrink-0 text-xs font-medium text-emerald-700">✓ Claimed</span>
                    ) : complete ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMilestone(milestone.id, milestone.rewardMoney, milestone.rewardXp)}
                        disabled={claimingId !== null}
                        className="shrink-0 rounded-md bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                      >
                        {claimingId === milestone.id ? "Claiming…" : "🎁 Claim"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-stone-400">Locked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {notificationTotal > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">
              🔔 Needs Your Attention
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {notifications.pendingApproval > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("work")}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100"
                >
                  ✅ {notifications.pendingApproval} awaiting your approval
                </button>
              )}
              {notifications.unreadEmail > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("inbox")}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100"
                >
                  ✉️ {notifications.unreadEmail} unread email{notifications.unreadEmail === 1 ? "" : "s"}
                </button>
              )}
              {notifications.overdue > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate("work")}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm hover:bg-amber-100"
                >
                  ⏰ {notifications.overdue} overdue
                </button>
              )}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <QuickAction emoji="📁" label="Browse Filing Cabinet" onClick={() => onNavigate("cabinet")} />
            <QuickAction emoji="🤝" label="Ask AI Clients for Work" onClick={() => onNavigate("clients")} />
            <QuickAction emoji="📥" label="Check My Work" onClick={() => onNavigate("work")} />
            <QuickAction emoji="🏆" label="View Leaderboard" onClick={() => onNavigate("leaderboard")} />
          </div>
        </section>

        {latestUpdate && (
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              📰 Latest Corporate Update
            </h2>
            <h3 className="mt-1 text-sm font-semibold text-stone-900">{latestUpdate.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{latestUpdate.body}</p>
            <button
              type="button"
              onClick={() => onNavigate("updates")}
              className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all updates →
            </button>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              🗞 Recent Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate("activity")}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all →
            </button>
          </div>
          {recentActivity.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-center text-sm text-stone-400">
              Nothing has happened yet — go grab some work.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border border-stone-100 px-3 py-2"
                >
                  <span className="text-base leading-none">{EVENT_ICON[item.event_type] ?? "•"}</span>
                  <p className="flex-1 text-sm text-stone-700">
                    <span className="font-medium text-stone-900">{actorName(item.actor_id)}</span>{" "}
                    {item.event_type}{" "}
                    <span className="font-medium text-stone-900">"{item.documentTitle}"</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-400">
        {emoji} {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-stone-900">{value}</p>
      {sub && <p className="text-[10px] text-stone-400">{sub}</p>}
    </div>
  );
}

function QuickAction({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
    >
      {emoji} {label}
    </button>
  );
}
