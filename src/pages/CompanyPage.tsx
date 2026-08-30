import { useCallback, useEffect, useState } from "react";
import { fetchCompany, fetchCompanyMembers, updateMemberRank, leaveCompany } from "../lib/company";
import { assignWork, estimatePayout, type ReferenceRow } from "../lib/documents";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { DocumentFieldForm } from "../components/DocumentFieldForm";
import { DocumentPreview } from "../components/DocumentPreview";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface CompanyPageProps {
  profile: Profile;
  onProfileChanged: () => void;
}

export function CompanyPage({ profile, onProfileChanged }: CompanyPageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy Code");
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<DocumentTemplate | null>(null);
  const [taskDueDays, setTaskDueDays] = useState(3);
  const [taskPayout, setTaskPayout] = useState(0);
  const [prefillValues, setPrefillValues] = useState<Record<string, string>>({});
  const [referenceRows, setReferenceRows] = useState<ReferenceRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLevel, setEditLevel] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { addCustomTemplate } = useCustomTemplates();

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [c, m] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchCompanyMembers(profile.company_id),
    ]);
    setCompany(c);
    setMembers(m);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  function reviewTaskDetails(template: DocumentTemplate) {
    setPendingTemplate(template);
    setTaskDueDays(3);
    setTaskPayout(estimatePayout(template));
    setPrefillValues({});
    setReferenceRows([]);
  }

  async function handleConfirmAssign() {
    if (!company || !assignTargetId || !pendingTemplate) return;
    const isSelfRequest = assignTargetId === profile.id;
    const filledValues = Object.fromEntries(
      Object.entries(prefillValues).filter(([, v]) => v.trim() !== ""),
    );
    const filledReferenceRows = referenceRows.filter((r) => r.label.trim() !== "" || r.value.trim() !== "");
    await assignWork({
      companyId: company.id,
      template: pendingTemplate,
      createdBy: profile.id,
      assignedTo: assignTargetId,
      isSelfRequest,
      dueInDays: taskDueDays > 0 ? taskDueDays : undefined,
      payoutOverride: taskPayout,
      ...(Object.keys(filledValues).length > 0 ? { initialFieldValues: filledValues } : {}),
      ...(filledReferenceRows.length > 0 ? { referenceData: filledReferenceRows } : {}),
    });
    const title = pendingTemplate.title;
    setAssignTargetId(null);
    setShowBuilder(false);
    setPendingTemplate(null);
    setStatusMessage(
      isSelfRequest ? `Requested "${title}" for yourself.` : `Assigned "${title}".`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
  }

  function openBuilderFor(targetId: string) {
    setAssignTargetId(targetId);
    setShowBuilder(true);
  }

  function startEdit(m: Profile) {
    setEditingId(m.id);
    setEditTitle(m.job_title);
    setEditLevel(m.level);
  }

  async function saveEdit(memberId: string) {
    // The server also rejects promoting someone at or above your own level
    // (RLS), but clamp here too so the UI never fires a request we know will fail.
    const clampedLevel = Math.max(0, Math.min(editLevel, profile.level - 1));
    try {
      await updateMemberRank(memberId, { job_title: editTitle.trim() || "Employee", level: clampedLevel });
      setEditingId(null);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't update that member's rank.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading company…</div>;
  }

  if (!company) {
    return <div className="flex-1 p-6 text-sm text-stone-400">No company found.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">{company.name}</h1>
            <p className="text-sm text-stone-500">
              {members.length} member{members.length === 1 ? "" : "s"} · You are{" "}
              <strong>{profile.job_title}</strong> (level {profile.level})
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(company.invite_code).catch(() => {});
              setCopyLabel("Copied!");
              setTimeout(() => setCopyLabel("Copy Code"), 1500);
            }}
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            🔑 Invite Code: {company.invite_code} · {copyLabel}
          </button>
        </div>

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{statusMessage}</div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Team</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignTargetId(profile.id)}
                className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
              >
                📋 Request Work for Myself
              </button>
              <button
                type="button"
                onClick={() => openBuilderFor(profile.id)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                🧩 Build Custom Task
              </button>
            </div>
          </div>

          {members.map((m) => {
            const isMe = m.id === profile.id;
            const iOutrank = profile.level > m.level;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-md border border-stone-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {m.display_name} {isMe && <span className="text-stone-400">(you)</span>}
                  </p>
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-32 rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        max={profile.level - 1}
                        value={editLevel}
                        onChange={(e) => setEditLevel(Number(e.target.value))}
                        className="w-16 rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(m.id)}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      {m.job_title} · level {m.level}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex gap-2">
                    {iOutrank && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          Edit Rank
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignTargetId(m.id)}
                          className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
                        >
                          Assign Work
                        </button>
                        <button
                          type="button"
                          onClick={() => openBuilderFor(m.id)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          🧩 Custom
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={async () => {
            await leaveCompany(profile.id);
            onProfileChanged();
          }}
          className="self-start text-xs text-stone-400 hover:text-red-600"
        >
          Leave company
        </button>
      </div>

      {assignTargetId && !showBuilder && !pendingTemplate && (
        <TemplatePickerModal
          title={
            assignTargetId === profile.id
              ? "Request work for yourself"
              : `Assign work to ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          onPick={reviewTaskDetails}
          onClose={() => setAssignTargetId(null)}
        />
      )}

      {assignTargetId && showBuilder && !pendingTemplate && (
        <TemplateBuilder
          heading={
            assignTargetId === profile.id
              ? "🧩 Build a Custom Task for Yourself"
              : `🧩 Build a Custom Task for ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          primaryLabel={assignTargetId === profile.id ? "Request for Myself" : "Assign This Task"}
          onClose={() => {
            setAssignTargetId(null);
            setShowBuilder(false);
          }}
          onSaveTemplate={addCustomTemplate}
          onFillOutNow={reviewTaskDetails}
        />
      )}

      {pendingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setPendingTemplate(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">Set Task Details</h2>
            <p className="mt-1 text-sm text-stone-500">
              "{pendingTemplate.title}" for{" "}
              {assignTargetId === profile.id
                ? "yourself"
                : members.find((m) => m.id === assignTargetId)?.display_name}
            </p>

            <div className="mt-4 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                  Due in (days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={taskDueDays}
                  onChange={(e) => setTaskDueDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-xs text-stone-400">0 = no deadline.</p>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                  Payout ($)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={taskPayout}
                  onChange={(e) => setTaskPayout(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Reference Data (optional)
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Give {assignTargetId === profile.id ? "yourself" : "them"} data to work from — e.g. a
                price sheet — without filling in the actual fields for them.
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {referenceRows.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setReferenceRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder="Item (e.g. Printer Paper)"
                      className="flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        setReferenceRows((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder="Value (e.g. $4.99/ream)"
                      className="flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setReferenceRows((prev) => prev.filter((_, i) => i !== index))}
                      className="shrink-0 text-stone-300 hover:text-red-500"
                      aria-label="Remove row"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setReferenceRows((prev) => [...prev, { label: "", value: "" }])}
                className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                + Add Row
              </button>
            </div>

            {pendingTemplate.fields.length > 0 && (
              <>
                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Fill in what you already know — {assignTargetId === profile.id ? "you'll" : "they'll"}{" "}
                  only need to fill in the rest.
                </p>
                <div className="mt-2 grid flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
                  <div className="overflow-y-auto pr-1">
                    <DocumentFieldForm
                      fields={pendingTemplate.fields}
                      values={prefillValues}
                      onChange={(id, value) => setPrefillValues((prev) => ({ ...prev, [id]: value }))}
                    />
                  </div>
                  <div className="overflow-y-auto rounded-md border border-stone-100">
                    <DocumentPreview
                      title={pendingTemplate.title}
                      bodyTemplate={pendingTemplate.bodyTemplate}
                      values={prefillValues}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTemplate(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                {assignTargetId === profile.id ? "Confirm & Request" : "Confirm & Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
