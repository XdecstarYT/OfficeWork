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
  type DocumentRow,
} from "../lib/documents";
import { fetchCompanyMembers, awardMoney, awardXp } from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import { DocumentFieldForm } from "../components/DocumentFieldForm";
import { DocumentPreview } from "../components/DocumentPreview";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface WorkPageProps {
  profile: Profile;
  onProfileChanged: () => void;
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

export function WorkPage({ profile, onProfileChanged }: WorkPageProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDoc, setOpenDoc] = useState<DocumentRow | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [sendToId, setSendToId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectFor, setShowRejectFor] = useState<string | null>(null);

  const memberLevel = (id: string | null) => members.find((m) => m.id === id)?.level ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    const [mine, companyDocs, companyMembers] = await Promise.all([
      fetchMyDocuments(profile.id),
      profile.company_id ? fetchCompanyDocuments(profile.company_id) : Promise.resolve([]),
      profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
    ]);
    setMembers(companyMembers);

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
    setFieldValues((doc.field_values as Record<string, string>) ?? {});
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
      await awardMoney(profile.id, payoutFor(openDoc, asTemplate(openDoc)));
      await awardXp(profile.id, estimateXp(asTemplate(openDoc)));
      onProfileChanged();
    }
    setOpenDoc(null);
    load();
  }

  async function handleApprove(doc: DocumentRow) {
    await approveDocument(doc.id, profile.id);
    // Payout goes to whoever actually did the work (assigned_to), which the
    // profiles_update_by_manager RLS policy allows since approving requires
    // outranking that person. Refresh only matters for our own balance.
    if (doc.assigned_to) {
      await awardMoney(doc.assigned_to, payoutFor(doc, asTemplate(doc)));
      await awardXp(doc.assigned_to, estimateXp(asTemplate(doc)));
      if (doc.assigned_to === profile.id) onProfileChanged();
    }
    load();
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

  const myOpenWork = documents.filter(
    (d) => d.assigned_to === profile.id && ["requested", "assigned"].includes(d.status),
  );
  const needsMyApproval = documents.filter(
    (d) => d.status === "pending_approval" && profile.level > memberLevel(d.assigned_to),
  );
  const iAssignedToOthers = documents.filter(
    (d) => d.created_by === profile.id && d.assigned_to !== profile.id && d.status !== "completed",
  );
  const completed = documents.filter((d) => d.status === "completed").slice(0, 10);

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading work…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="text-lg font-semibold text-stone-900">My Work</h1>

        <Section title="📥 Your Open Work" empty="Nothing assigned right now.">
          {myOpenWork.map((d) => (
            <div key={d.id} className="relative flex items-center justify-between rounded-md border border-stone-100 p-3">
              <div>
                <p className="text-sm font-medium text-stone-800">{d.title}</p>
                <p className="text-xs text-stone-400">
                  {STATUS_LABEL[d.status]} · assigned by{" "}
                  {members.find((m) => m.id === d.created_by)?.display_name ?? "someone"}
                  {" · "}💵 ${payoutFor(d, asTemplate(d))}
                  {d.due_at && <> · ⏱ due {new Date(d.due_at).toLocaleDateString()}</>}
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
          ))}
        </Section>

        <Section title="✅ Needs Your Approval" empty="Nothing waiting on you.">
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

        <Section title="👀 Assigned to Others" empty="You haven't assigned anything.">
          {iAssignedToOthers.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-stone-100 p-3">
              <div>
                <p className="text-sm font-medium text-stone-800">{d.title}</p>
                <p className="text-xs text-stone-400">
                  {STATUS_LABEL[d.status]} · {members.find((m) => m.id === d.assigned_to)?.display_name}
                </p>
              </div>
            </div>
          ))}
        </Section>

        <Section title="🗄 Recently Completed" empty="Nothing completed yet.">
          {completed.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-stone-100 p-3 opacity-70">
              <p className="text-sm text-stone-700">{d.title}</p>
              <p className="text-xs text-stone-400">
                {members.find((m) => m.id === d.assigned_to)?.display_name}
              </p>
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
            className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">{openDoc.title}</h2>
            <div className="mt-3 grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
              <div className="overflow-y-auto pr-1">
                <DocumentFieldForm
                  fields={asTemplate(openDoc).fields}
                  values={fieldValues}
                  onChange={(id, value) => setFieldValues((prev) => ({ ...prev, [id]: value }))}
                  readOnly={openDoc.status === "pending_approval"}
                />
              </div>
              <div className="overflow-y-auto rounded-md border border-stone-100">
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
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
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
