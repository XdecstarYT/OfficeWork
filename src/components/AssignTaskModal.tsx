import { useEffect, useState } from "react";
import { DocumentFieldForm } from "./DocumentFieldForm";
import { DocumentPreview } from "./DocumentPreview";
import { estimatePayout, type ReferenceRow } from "../lib/documents";
import type { DocumentTemplate } from "../types/template";

export interface AssignTaskDetails {
  dueInDays?: number;
  payoutOverride: number;
  referenceData?: ReferenceRow[];
  initialFieldValues?: Record<string, string>;
  forceApproval: boolean;
  /** Files the new document under a company project. */
  projectId?: string | null;
}

interface AssignTaskModalProps {
  template: DocumentTemplate;
  targetLabel: string;
  isSelfRequest: boolean;
  onClose: () => void;
  onConfirm: (details: AssignTaskDetails) => void | Promise<void>;
  /** When provided, renders a "Who is this for?" picker at the top (used by Filing Cabinet, which doesn't already know a target). */
  targetOptions?: { id: string; label: string }[];
  targetId?: string;
  onTargetChange?: (id: string) => void;
  /** Active company projects; renders a "File under" picker when non-empty. */
  projectOptions?: { id: string; label: string }[];
}

type Step = "details" | "review";

export function AssignTaskModal({
  template,
  targetLabel,
  isSelfRequest,
  onClose,
  onConfirm,
  targetOptions,
  targetId,
  onTargetChange,
  projectOptions,
}: AssignTaskModalProps) {
  const [step, setStep] = useState<Step>("details");
  const [dueDays, setDueDays] = useState(3);
  const [payout, setPayout] = useState(estimatePayout(template));
  const [forceApproval, setForceApproval] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [prefillValues, setPrefillValues] = useState<Record<string, string>>({});
  const [referenceRows, setReferenceRows] = useState<ReferenceRow[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [summaryCopyLabel, setSummaryCopyLabel] = useState("📋 Copy Summary");

  const filledReferenceRows = referenceRows.filter((r) => r.label.trim() !== "" || r.value.trim() !== "");
  const filledValues = Object.fromEntries(Object.entries(prefillValues).filter(([, v]) => v.trim() !== ""));

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  async function handleFinalConfirm() {
    setConfirming(true);
    try {
      await onConfirm({
        dueInDays: dueDays > 0 ? dueDays : undefined,
        payoutOverride: payout,
        forceApproval,
        ...(projectId ? { projectId } : {}),
        ...(filledReferenceRows.length > 0 ? { referenceData: filledReferenceRows } : {}),
        ...(Object.keys(filledValues).length > 0 ? { initialFieldValues: filledValues } : {}),
      });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-1.5">
          <span className={`h-1.5 flex-1 rounded-full ${step === "details" ? "bg-emerald-600" : "bg-emerald-300"}`} />
          <span className={`h-1.5 flex-1 rounded-full ${step === "review" ? "bg-emerald-600" : "bg-stone-200"}`} />
        </div>
        {step === "details" ? (
          <>
            <h2 className="text-lg font-semibold text-stone-900">Set Task Details</h2>
            <p className="mt-1 text-sm text-stone-500">
              "{template.title}" for {targetLabel}
            </p>

            {targetOptions && (
              <>
                <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-stone-400">
                  Who is this for?
                </label>
                <select
                  value={targetId}
                  onChange={(e) => onTargetChange?.(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {targetOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="mt-4 flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                  Due in (days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[
                    ["Today", 0],
                    ["3d", 3],
                    ["1w", 7],
                    ["2w", 14],
                  ].map(([label, days]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDueDays(days as number)}
                      className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] text-stone-500 hover:bg-stone-100"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-stone-400">0 = no deadline.</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                    Payout ($)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayout(estimatePayout(template))}
                    className="text-[11px] text-stone-400 hover:text-stone-600"
                  >
                    ↺ Reset
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={payout}
                  onChange={(e) => setPayout(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {projectOptions && projectOptions.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-stone-700" htmlFor="assign-project">
                  File under a project
                </label>
                <select
                  id="assign-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">No project</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-stone-400">
                  It counts toward that project's target once it's completed.
                </p>
              </div>
            )}

            <label
              className={`mt-4 flex items-start gap-2 rounded-md border p-3 text-sm ${
                isSelfRequest ? "border-stone-200 bg-stone-50 text-stone-400" : "border-stone-200 text-stone-700"
              }`}
            >
              <input
                type="checkbox"
                checked={forceApproval}
                disabled={isSelfRequest}
                onChange={(e) => setForceApproval(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                ✅ Require review by boss before this is marked complete
                {isSelfRequest && (
                  <span className="mt-0.5 block text-xs text-stone-400">
                    Not available for work you request for yourself — nobody would be able to
                    clear it.
                  </span>
                )}
              </span>
            </label>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Reference Data (optional)
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Give {isSelfRequest ? "yourself" : "them"} data to work from — e.g. a price sheet
                — without filling in the actual fields for them.
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {referenceRows.map((row, index) => (
                  <div key={index} className="flex items-start gap-2 sm:items-center">
                    <div className="flex flex-1 flex-col gap-1.5 sm:flex-row sm:gap-2">
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) =>
                          setReferenceRows((prev) =>
                            prev.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)),
                          )
                        }
                        placeholder="Item (e.g. Printer Paper)"
                        className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                        className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setReferenceRows((prev) => prev.filter((_, i) => i !== index))}
                      className="mt-1.5 shrink-0 text-stone-300 hover:text-red-500 sm:mt-0"
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

            {template.fields.length > 0 && (
              <>
                <p className="mt-5 text-xs font-medium uppercase tracking-wide text-stone-400">
                  Fill in what you already know — {isSelfRequest ? "you'll" : "they'll"} only need
                  to fill in the rest.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <DocumentFieldForm
                      fields={template.fields}
                      values={prefillValues}
                      onChange={(id, value) => setPrefillValues((prev) => ({ ...prev, [id]: value }))}
                    />
                  </div>
                  <div className="rounded-md border border-stone-100">
                    <DocumentPreview
                      title={template.title}
                      bodyTemplate={template.bodyTemplate}
                      values={prefillValues}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep("review")}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Review →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Review Task</h2>
                <p className="mt-1 text-sm text-stone-500">Check everything before it goes out.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const text = [
                    `${template.title} for ${targetLabel}`,
                    `Due: ${dueDays > 0 ? `in ${dueDays} day${dueDays === 1 ? "" : "s"}` : "No deadline"}`,
                    `Payout: $${payout.toFixed(2)}`,
                    `Boss review required: ${forceApproval ? "Yes" : "No"}`,
                    projectId
                      ? `Project: ${projectOptions?.find((p) => p.id === projectId)?.label ?? "—"}`
                      : "Project: none",
                  ].join("\n");
                  navigator.clipboard?.writeText(text).catch(() => {});
                  setSummaryCopyLabel("Copied!");
                  setTimeout(() => setSummaryCopyLabel("📋 Copy Summary"), 1500);
                }}
                className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                {summaryCopyLabel}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-stone-200 p-3 text-sm">
                  <dl className="flex flex-col gap-2">
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Document</dt>
                      <dd className="text-right font-medium text-stone-900">{template.title}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Assigned to</dt>
                      <dd className="text-right font-medium text-stone-900">{targetLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Due</dt>
                      <dd className="text-right font-medium text-stone-900">
                        {dueDays > 0 ? `in ${dueDays} day${dueDays === 1 ? "" : "s"}` : "No deadline"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Payout</dt>
                      <dd className="text-right font-medium text-emerald-700">${payout.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-stone-500">Boss review required</dt>
                      <dd className="text-right font-medium text-stone-900">
                        {forceApproval ? "Yes ✅" : "No"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {filledReferenceRows.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      📎 Reference Data
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {filledReferenceRows.map((row, i) => (
                        <div key={i} className="flex justify-between gap-3 text-sm">
                          <span className="text-stone-600">{row.label}</span>
                          <span className="font-medium text-stone-900">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(filledValues).length > 0 && (
                  <div className="rounded-lg border border-stone-200 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      Pre-filled Fields
                    </p>
                    <div className="mt-1 flex flex-col gap-1">
                      {template.fields
                        .filter((f) => filledValues[f.id])
                        .map((f) => (
                          <div key={f.id} className="flex justify-between gap-3 text-sm">
                            <span className="text-stone-600">{f.label}</span>
                            <span className="font-medium text-stone-900">{filledValues[f.id]}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-stone-100">
                <DocumentPreview title={template.title} bodyTemplate={template.bodyTemplate} values={prefillValues} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                ← Back to Edit
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={handleFinalConfirm}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {confirming ? "Assigning…" : isSelfRequest ? "Confirm & Request" : "Confirm & Assign"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
