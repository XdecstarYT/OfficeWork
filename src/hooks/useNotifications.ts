import { useCallback, useEffect, useState } from "react";
import { fetchCompanyDocumentStats } from "../lib/documents";
import { fetchCompanyMembers } from "../lib/company";
import { fetchTimeOffRequests } from "../lib/timeOff";
import { evaluateObjectives, fetchMyClaims, objectivesFor } from "../lib/objectives";
import { fetchMyLoans, isOverdue } from "../lib/bank";
import { fetchProjects, projectProgress } from "../lib/projects";
import { fetchCompany } from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface NotificationCounts {
  pendingApproval: number;
  unreadEmail: number;
  overdue: number;
  pendingTimeOff: number;
  /** Objectives you've finished but not claimed. */
  objectivesReady: number;
  /** Your loan, if it's past its due day. */
  loanOverdue: number;
  /** Projects that have hit their target and are waiting to be delivered. */
  projectsReady: number;
}

const EMPTY: NotificationCounts = {
  pendingApproval: 0,
  unreadEmail: 0,
  overdue: 0,
  pendingTimeOff: 0,
  objectivesReady: 0,
  loanOverdue: 0,
  projectsReady: 0,
};

export function useNotifications(profile: Profile | null) {
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY);

  const refresh = useCallback(async () => {
    if (!profile?.company_id) {
      setCounts(EMPTY);
      return;
    }
    const [docs, members, unreadEmails, timeOffRequests, claims, loans, projects, company] = await Promise.all([
      fetchCompanyDocumentStats(profile.company_id),
      fetchCompanyMembers(profile.company_id),
      supabase.from("emails").select("id").eq("recipient_id", profile.id).is("read_at", null),
      fetchTimeOffRequests(profile.company_id),
      fetchMyClaims(profile.id),
      fetchMyLoans(profile.id),
      fetchProjects(profile.company_id),
      fetchCompany(profile.company_id),
    ]);
    const levelOf = (id: string | null) => members.find((m) => m.id === id)?.level ?? 0;
    const now = Date.now();

    const pendingApproval = docs.filter(
      (d) => d.status === "pending_approval" && profile.level > levelOf(d.assigned_to),
    ).length;
    const overdue = docs.filter(
      (d) =>
        d.assigned_to === profile.id &&
        d.status !== "completed" &&
        !!d.due_at &&
        new Date(d.due_at).getTime() < now,
    ).length;
    const pendingTimeOff = timeOffRequests.filter(
      (r) => r.status === "pending" && profile.level > levelOf(r.member_id),
    ).length;

    // Objectives are generated client-side, so "ready to claim" is derived
    // here the same way the Dashboard panel derives it rather than stored.
    const claimedKeys = new Set(claims.map((c) => c.objective_key));
    const objectivesReady = evaluateObjectives({
      defs: objectivesFor(profile.company_id),
      docs,
      memberId: profile.id,
      claimedKeys,
    }).filter((o) => o.complete && !o.claimed).length;

    const currentDay = company?.current_day ?? 0;
    const loanOverdue = loans.filter((l) => isOverdue(l, currentDay)).length;

    // Only the owner can actually deliver a project, so only they are nudged.
    const isOwner = company?.owner_id === profile.id;
    const projectsReady = isOwner
      ? projects.filter((p) => p.status === "active" && projectProgress(p, docs).ready).length
      : 0;

    setCounts({
      pendingApproval,
      unreadEmail: unreadEmails.data?.length ?? 0,
      overdue,
      pendingTimeOff,
      objectivesReady,
      loanOverdue,
      projectsReady,
    });
  }, [profile?.id, profile?.company_id, profile?.level]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!profile?.company_id) return;
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emails", filter: `recipient_id=eq.${profile.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_off_requests", filter: `company_id=eq.${profile.company_id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.company_id, refresh]);

  return counts;
}
