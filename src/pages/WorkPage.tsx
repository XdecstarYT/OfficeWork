import { useCallback, useEffect, useState } from "react";
import {
  fetchMyDocuments,
  fetchCompanyDocuments,
  submitDocument,
  approveDocument,
  rejectDocument,
  sendToPerson,
  payoutFor,
  estimateXp,
  referenceDataFor,
  type DocumentRow,
} from "../lib/documents";
import { fetchCompanyMembers, awardMoney, awardXp } from "../lib/company";
import { loadDraftFieldValues, saveDraftFieldValues, clearDraftFieldValues } from "../lib/storage";
import { fetchCompanyEquipment } from "../lib/equipment";
import { totalPayoutBonusPercent } from "../data/equipment";
import { draftDocumentFields } from "../lib/aiClient";
import { sendEmailToCoworker } from "../lib/emails";
import { supabase } from "../lib/supabaseClient";
import { renderBody } from "../lib/renderTemplate";
import { relativeTime, dueLabel, isDueSoon } from "../lib/time";
import { DocumentFieldForm } from "../components/DocumentFieldForm";
import { DocumentPreview } from "../components/DocumentPreview";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";
import type { LlmConfig } from "../lib/llmConfig";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface WorkPageProps {
  profile: Profile;
  onProfileChanged: () => void;
  llmConfig: LlmConfig;
}

function asTemplate(row: DocumentRow): DocumentTemplate {
  return row.template_snapshot as unknown as DocumentTemplate;
}

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  in_progress: "In Progress",
  submitted: "Submitted",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

const STATUS_COLOR: Record<string, string> = {
  requested: "bg-stone-100 text-stone-600",
  assigned: "bg-sky-100 text-sky-700",
  in_progress: "bg-sky-100 text-sky-700",
  submitted: "bg-violet-100 text-violet-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLOR[status] ?? "bg-stone-100 text-stone-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function WorkPage({ profile, onProfileChanged, llmConfig }: WorkPageProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDoc, setOpenDoc] = useState<DocumentRow | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sendToId, setSendToId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [bonusPercent, setBonusPercent] = useState(0);
  const [copyLabel, setCopyLabel] = useState("📋 Copy Text");
  const [workSortMode, setWorkSortMode] = useState<"due" | "payout" | "newest">("due");
  const [approvingAll, setApprovingAll] = useState(false);
  const [dismissedOverdueIds, setDismissedOverdueIds] = useState<Set<string>>(new Set());
  const [dueSoonOnly, setDueSoonOnly] = useState(false);
  const [titleFilter, setTitleFilter] = useState("");
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const memberLevel = (id: string | null) => members.find((m) => m.id === id)?.level ?? 0;

  const isOverdue = (d: DocumentRow) =>
    !!d.due_at && new Date(d.due_at).getTime() < Date.now() && d.status !== "completed";

  const load = useCallback(async () => {
    setLoading(true);
    const [mine, companyDocs, companyMembers, equipment] = await Promise.all([
      fetchMyDocuments(profile.id),
      profile.company_id ? fetchCompanyDocuments(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCompanyEquipment(profile.company_id) : Promise.resolve([]),
    ]);
    setMembers(companyMembers);
    setBonusPercent(totalPayoutBonusPercent(equipment.map((e) => e.item_key)));

    // Merge: my docs + any pending_approval docs in the company I might be able to approve.
    const byId = new Map<string, DocumentRow>();
    for (const d of mine) byId.set(d.id, d);
    for (const d of companyDocs) {
      if (d.status === "pending_approval") byId.set(d.id, d);
    }
    setDocuments([...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    setLoading(false);
  }, [profile.id, profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`documents-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  function openForFillOut(doc: DocumentRow) {
    setOpenDoc(doc);
    const draft = loadDraftFieldValues(doc.id);
    const saved = (doc.field_values as Record<string, string>) ?? {};
    // A local draft only wins if it actually has something in it - otherwise
    // an empty leftover draft object would silently blank out real saved data.
    const hasDraftContent = draft && Object.values(draft).some((v) => v?.trim());
    setFieldValues(hasDraftContent ? { ...saved, ...draft } : saved);
    setDraftError(null);
  }

  // Autosaves whatever's typed into the open form to this browser, so an
  // accidental tab switch or close doesn't lose it - cleared once the
  // document is actually submitted.
  useEffect(() => {
    if (!openDoc) return;
    saveDraftFieldValues(openDoc.id, fieldValues);
  }, [openDoc, fieldValues]);

  useEffect(() => {
    if (!openDoc && !previewDoc) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenDoc(null);
        setPreviewDoc(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [openDoc, previewDoc]);

  async function handleAiDraft() {
    if (!openDoc) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const suggestions = await draftDocumentFields({
        title: openDoc.title,
        fields: asTemplate(openDoc).fields,
        filledValues: fieldValues,
        referenceData: referenceDataFor(openDoc),
        config: llmConfig,
      });
      if (Object.keys(suggestions).length === 0) {
        setDraftError("AI didn't suggest anything - try filling in a bit more first.");
      } else {
        setFieldValues((prev) => ({ ...suggestions, ...prev }));
      }
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Couldn't reach AI for a draft.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit() {
    if (!openDoc) return;
    const nextStatus = await submitDocument(
      openDoc.id,
      profile.id,
      fieldValues,
      openDoc.requires_approval,
    );
    if (nextStatus === "completed") {
      // Self-serve completion (no approval needed) - pay the assignee, who is
      // always the caller here since this document didn't need sign-off.
      await awardMoney(profile.id, Math.round(payoutFor(openDoc, asTemplate(openDoc), bonusPercent)));
      await awardXp(profile.id, estimateXp(asTemplate(openDoc)));
      onProfileChanged();
    }
    clearDraftFieldValues(openDoc.id);
    setOpenDoc(null);
    load();
  }

  async function handleApprove(doc: DocumentRow) {
    await approveDocument(doc.id, profile.id);
    // Payout goes to whoever actually did the work (assigned_to), which the
    // profiles_update_by_manager RLS policy allows since approving requires
    // outranking that person. Refresh only matters for our own balance.
    if (doc.assigned_to) {
      await awardMoney(doc.assigned_to, Math.round(payoutFor(doc, asTemplate(doc), bonusPercent)));
      await awardXp(doc.assigned_to, estimateXp(asTemplate(doc)));
      if (doc.assigned_to === profile.id) onProfileChanged();
    }
    load();
  }

  async function handleApproveAll() {
    setApprovingAll(true);
    try {
      for (const doc of needsMyApproval) {
        await handleApprove(doc);
      }
    } finally {
      setApprovingAll(false);
    }
  }

  async function handleReject(doc: DocumentRow) {
    await rejectDocument(doc.id, profile.id, rejectNote.trim() || "Needs revision.");
    setShowRejectFor(null);
    setRejectNote("");
    load();
  }

  async function handleSendTo(doc: DocumentRow, targetId: string) {
    await sendToPerson(doc.id, profile.id, targetId);
    setSendToId(null);
    load();
  }

  async function handleRemind(d: DocumentRow) {
    if (!profile.company_id || !d.assigned_to) return;
    await sendEmailToCoworker({
      companyId: profile.company_id,
      senderId: profile.id,
      recipientId: d.assigned_to,
      subject: `Reminder: ${d.title}`,
      body: `Hey — just a friendly reminder that "${d.title}" is still waiting on you${
        d.due_at ? ` (${dueLabel(d.due_at)})` : ""
      }. Thanks!`,
    });
    setRemindedIds((prev) => new Set(prev).add(d.id));
  }

  const myOpenWork = documents
    .filter((d) => d.assigned_to === profile.id && ["requested", "assigned"].includes(d.status))
    .filter((d) => !overdueOnly || isOverdue(d))
    .filter((d) => !dueSoonOnly || (d.due_at && isDueSoon(d.due_at)))
    .filter((d) => !titleFilter.trim() || d.title.toLowerCase().includes(titleFilter.trim().toLowerCase()))
    .slice()
    .sort((a, b) => {
      if (workSortMode === "payout") {
        return payoutFor(b, asTemplate(b), bonusPercent) - payoutFor(a, asTemplate(a), bonusPercent);
      }
      if (workSortMode === "newest") {
        return b.created_at.localeCompare(a.created_at);
      }
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    });
  const myOpenWorkTotal = myOpenWork.reduce(
    (sum, d) => sum + payoutFor(d, asTemplate(d), bonusPercent),
    0,
  );
  const needsMyApproval = documents.filter(
    (d) => d.status === "pending_approval" && profile.level > memberLevel(d.assigned_to),
  );
  const iAssignedToOthers = documents
    .filter((d) => d.created_by === profile.id && d.assigned_to !== profile.id && d.status !== "completed")
    .slice()
    .sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0;
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return a.due_at.localeCompare(b.due_at);
    });
  const completed = documents.filter((d) => d.status === "completed").slice(0, 10);
  const overdueCount = documents.filter(isOverdue).length;
  const dueSoonCount = myOpenWork.filter((d) => d.due_at && isDueSoon(d.due_at)).length;

  const weekAgo = Date.now() - 7 * 86_400_000;
  const completedThisWeek = documents.filter(
    (d) => d.status === "completed" && d.assigned_to === profile.id && new Date(d.updated_at ?? d.created_at).getTime() >= weekAgo,
  );
  const weeklyEarnings = completedThisWeek.reduce((sum, d) => sum + payoutFor(d, asTemplate(d), bonusPercent), 0);

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading work…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-stone-900">
            My Work
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => setOverdueOnly((v) => !v)}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  overdueOnly ? "bg-red-600 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"
                }`}
              >
                ⏰ {overdueCount} overdue{overdueOnly ? " · showing only" : ""}
              </button>
            )}
            {dueSoonCount > 0 && (
              <button
                type="button"
                onClick={() => setDueSoonOnly((v) => !v)}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  dueSoonOnly ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                }`}
              >
                🕑 {dueSoonCount} due soon{dueSoonOnly ? " · showing only" : ""}
              </button>
            )}
          </h1>
          <p className="text-xs text-stone-400">
            This week: {completedThisWeek.length} completed · 💵 ${Math.round(weeklyEarnings)} earned
          </p>
        </div>

        <Section
          title="📥 Your Open Work"
          empty="Nothing assigned right now."
          headerExtra={
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {myOpenWork.length > 0 && (
                <span className="font-medium text-emerald-700">💵 ${Math.round(myOpenWorkTotal)} total</span>
              )}
              <input
                type="text"
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                placeholder="🔍 Filter by title…"
                className="w-32 rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <select
                value={workSortMode}
                onChange={(e) => setWorkSortMode(e.target.value as typeof workSortMode)}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="due">Sort: Due Date</option>
                <option value="payout">Sort: Payout</option>
                <option value="newest">Sort: Newest</option>
              </select>
            </div>
          }
        >
          {myOpenWork.map((d) => {
            const visiblyOverdue = isOverdue(d) && !dismissedOverdueIds.has(d.id);
            return (
            <div
              key={d.id}
              className={`relative flex items-center justify-between rounded-md border p-3 ${
                visiblyOverdue ? "border-red-200 bg-red-50" : "border-stone-100"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-stone-800">
                  {d.title}{" "}
                  {visiblyOverdue && (
                    <span className="text-xs font-semibold text-red-600">
                      ⏰ Overdue{" "}
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedOverdueIds((prev) => new Set(prev).add(d.id))
                        }
                        title="Dismiss for this session"
                        className="text-red-400 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-stone-400">
                  <StatusBadge status={d.status} /> · assigned by{" "}
                  {members.find((m) => m.id === d.created_by)?.display_name ?? "someone"}
                  {" · "}💵 ${Math.round(payoutFor(d, asTemplate(d), bonusPercent))}
                  {" · "}⭐ {estimateXp(asTemplate(d))} XP
                  {d.due_at && (
                    <>
                      {" · "}
                      <span className={isOverdue(d) ? "font-medium text-red-600" : ""} title={new Date(d.due_at).toLocaleDateString()}>
                        ⏱ {dueLabel(d.due_at)}
                      </span>
                    </>
                  )}
                  {d.approval_note && (
                    <span className="text-red-500"> · rejected: {d.approval_note}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSendToId(sendToId === d.id ? null : d.id)}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Send To…
                </button>
                <button
                  type="button"
                  onClick={() => openForFillOut(d)}
                  className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
                >
                  Fill Out
                </button>
              </div>
              {sendToId === d.id && (
                <div className="absolute right-0 top-full z-10 mt-1 rounded-md border border-stone-200 bg-white p-2 shadow-lg">
                  {members
                    .filter((m) => m.id !== profile.id)
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSendTo(d, m.id)}
                        className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-stone-50"
                      >
                        {m.display_name}
                      </button>
                    ))}
                </div>
              )}
            </div>
            );
          })}
        </Section>

        <Section
          title={`✅ Needs Your Approval${needsMyApproval.length > 0 ? ` (${needsMyApproval.length})` : ""}`}
          empty="Nothing waiting on you."
          headerExtra={
            needsMyApproval.length > 1 ? (
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={approvingAll}
                className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                {approvingAll ? "Approving…" : `✅ Approve All (${needsMyApproval.length})`}
              </button>
            ) : undefined
          }
        >
          {needsMyApproval.map((d) => (
            <div key={d.id} className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-stone-800">{d.title}</p>
              <p className="text-xs text-stone-500">
                by {members.find((m) => m.id === d.assigned_to)?.display_name}
              </p>
              <button
                type="button"
                onClick={() => openForFillOut(d)}
                className="mt-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Review submission
              </button>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(d)}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectFor(showRejectFor === d.id ? null : d.id)}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Reject
                </button>
              </div>
              {showRejectFor === d.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Why is this being sent back?"
                    className="flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleReject(d)}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                  >
                    Send Back
                  </button>
                </div>
              )}
            </div>
          ))}
        </Section>

        <Section
          title={`👀 Assigned to Others${iAssignedToOthers.length > 0 ? ` (${iAssignedToOthers.length})` : ""}`}
          empty="You haven't assigned anything."
        >
          {iAssignedToOthers.map((d) => (
            <div
              key={d.id}
              className={`flex items-center justify-between rounded-md border p-3 ${
                isOverdue(d) ? "border-red-200 bg-red-50" : "border-stone-100"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-stone-800">
                  {d.title} {isOverdue(d) && <span className="text-xs font-semibold text-red-600">⏰ Overdue</span>}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-stone-400">
                  <StatusBadge status={d.status} /> · {members.find((m) => m.id === d.assigned_to)?.display_name}
                  {" · "}assigned {relativeTime(d.created_at)}
                  {d.due_at && (
                    <>
                      {" · "}
                      <span className={isOverdue(d) ? "font-medium text-red-600" : ""} title={new Date(d.due_at).toLocaleDateString()}>
                        ⏱ {dueLabel(d.due_at)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              {d.status !== "completed" && (
                <button
                  type="button"
                  onClick={() => handleRemind(d)}
                  disabled={remindedIds.has(d.id)}
                  className="shrink-0 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  {remindedIds.has(d.id) ? "Reminded" : "🔔 Remind"}
                </button>
              )}
            </div>
          ))}
        </Section>

        <Section title={`🗄 Recently Completed${completed.length > 0 ? ` (${completed.length})` : ""}`} empty="Nothing completed yet.">
          {completed.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-stone-100 p-3 opacity-70">
              <div>
                <p className="text-sm text-stone-700">{d.title}</p>
                <p className="text-xs text-stone-400">
                  {members.find((m) => m.id === d.assigned_to)?.display_name}
                  {" · "}💵 ${Math.round(payoutFor(d, asTemplate(d), bonusPercent))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(d)}
                className="shrink-0 text-xs font-medium text-stone-500 hover:text-stone-800"
              >
                👁 View
              </button>
            </div>
          ))}
        </Section>
      </div>

      {openDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setOpenDoc(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-900">{openDoc.title}</h2>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(JSON.stringify(fieldValues, null, 2)).catch(() => {});
                  }}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  title="Copy field values as JSON"
                >
                  {"{ }"} Copy JSON
                </button>
                {openDoc.status !== "pending_approval" && (
                  <button
                    type="button"
                    onClick={() => {
                      const saved = (openDoc.field_values as Record<string, string>) ?? {};
                      setFieldValues(saved);
                      clearDraftFieldValues(openDoc.id);
                    }}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                  >
                    ↺ Clear Draft
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const text = renderBody(asTemplate(openDoc).bodyTemplate, fieldValues);
                    navigator.clipboard?.writeText(text).catch(() => {});
                    setCopyLabel("Copied!");
                    setTimeout(() => setCopyLabel("📋 Copy Text"), 1500);
                  }}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  {copyLabel}
                </button>
                {openDoc.status !== "pending_approval" && (
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={drafting}
                    className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  >
                    {drafting ? "Drafting…" : "✨ AI Draft"}
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              {Object.values(fieldValues).filter((v) => v?.trim()).length}/{asTemplate(openDoc).fields.length} fields filled
            </p>
            {draftError && <p className="mt-1 text-xs text-red-600">{draftError}</p>}

            {referenceDataFor(openDoc).length > 0 && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  📎 Reference Data — use this to fill out the form
                </p>
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {referenceDataFor(openDoc).map((row, i) => (
                    <div key={i} className="flex justify-between gap-3 text-sm">
                      <span className="text-stone-600">{row.label}</span>
                      <span className="font-medium text-stone-900">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <DocumentFieldForm
                  fields={asTemplate(openDoc).fields}
                  values={fieldValues}
                  onChange={(id, value) => setFieldValues((prev) => ({ ...prev, [id]: value }))}
                  readOnly={openDoc.status === "pending_approval"}
                />
              </div>
              <div className="rounded-md border border-stone-100">
                <DocumentPreview
                  title={openDoc.title}
                  bodyTemplate={asTemplate(openDoc).bodyTemplate}
                  values={fieldValues}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenDoc(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Close
              </button>
              {openDoc.status !== "pending_approval" && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">{previewDoc.title}</h2>
            <p className="text-xs text-stone-400">Completed by {members.find((m) => m.id === previewDoc.assigned_to)?.display_name}</p>
            <div className="mt-3 rounded-md border border-stone-100">
              <DocumentPreview
                title={previewDoc.title}
                bodyTemplate={asTemplate(previewDoc).bodyTemplate}
                values={(previewDoc.field_values as Record<string, string>) ?? {}}
              />
            </div>
            <button
              type="button"
              onClick={() => setPreviewDoc(null)}
              className="mt-4 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
  headerExtra,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
        {headerExtra}
      </div>
      {hasChildren ? (
        <div className="relative flex flex-col gap-2">{children}</div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-400">
          {empty}
        </p>
      )}
    </section>
  );
}
