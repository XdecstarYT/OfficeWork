import { useEffect, useState } from "react";
import { estimatePayout } from "../lib/documents";
import { loadTemplate, type TemplateMeta } from "../lib/templates";

const DIFFICULTY_LABEL: Record<TemplateMeta["difficulty"], string> = {
  quick: "Quick",
  standard: "Standard",
  detailed: "Detailed",
};

interface TemplateDetailModalProps {
  template: TemplateMeta;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onStart: (template: TemplateMeta) => void;
  onDelete?: (template: TemplateMeta) => void;
  /** Shown as a secondary "🤖 Assign to AI Coworker" action when provided (i.e. the company has at least one hired). */
  onAssignToNpc?: (template: TemplateMeta) => void;
  /** Shown as a "🪄 Smart Assign" action when provided (owner, with at least one assignable coworker). */
  onSmartAssign?: (template: TemplateMeta) => void;
  smartAssigning?: boolean;
  /** Opens the builder pre-filled with a copy of this template. */
  onDuplicate?: (template: TemplateMeta) => void;
  /** Clicking a tag chip filters the Filing Cabinet's search by it. */
  onTagClick?: (tag: string) => void;
}

export function TemplateDetailModal({
  template,
  isFavorite,
  onToggleFavorite,
  onClose,
  onStart,
  onDelete,
  onAssignToNpc,
  onSmartAssign,
  smartAssigning,
  onDuplicate,
  onTagClick,
}: TemplateDetailModalProps) {
  const [showFields, setShowFields] = useState(false);
  const [fieldLabels, setFieldLabels] = useState<string[] | null>(null);
  const [copyLabel, setCopyLabel] = useState("📋 Copy Details");

  // The field list lives in the template's own file rather than the browse
  // index, so it's fetched only if someone actually expands it.
  useEffect(() => {
    if (!showFields || fieldLabels) return;
    let cancelled = false;
    loadTemplate(template.id).then((full) => {
      if (!cancelled) setFieldLabels(full ? full.fields.map((f) => f.label) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [showFields, fieldLabels, template.id]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
              {template.category} / {template.subcategory}
            </span>
            <h2 className="mt-1 text-xl font-semibold text-stone-900">{template.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => onToggleFavorite(template.id)}
            className={`text-xl leading-none ${isFavorite ? "text-amber-500" : "text-stone-300 hover:text-stone-400"}`}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-stone-600">{template.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {template.tags.map((tag) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                title={`Browse templates tagged "${tag}"`}
              >
                #{tag}
              </button>
            ) : (
              <span key={tag} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500">
                #{tag}
              </span>
            ),
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          <span>⏱ ~{template.estimatedMinutes} min</span>
          <span>·</span>
          <span>{DIFFICULTY_LABEL[template.difficulty]}</span>
          <span>·</span>
          <span>💵 ${estimatePayout(template)}</span>
          <span>·</span>
          <button type="button" onClick={() => setShowFields((v) => !v)} className="underline decoration-dotted hover:text-stone-800">
            {template.fieldCount} fields
          </button>
          <button
            type="button"
            onClick={() => {
              const text = `${template.title}\n${template.description}\n~${template.estimatedMinutes} min · ${DIFFICULTY_LABEL[template.difficulty]} · $${estimatePayout(template)}`;
              navigator.clipboard?.writeText(text).catch(() => {});
              setCopyLabel("Copied!");
              setTimeout(() => setCopyLabel("📋 Copy Details"), 1500);
            }}
            className="ml-auto shrink-0 text-xs font-medium text-stone-400 hover:text-stone-600"
          >
            {copyLabel}
          </button>
        </div>
        {showFields && (
          <p className="mt-1 text-xs text-stone-400">
            {fieldLabels ? fieldLabels.join(", ") : "Loading fields…"}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(template)}
              className="text-xs text-stone-400 hover:text-red-600"
            >
              Delete template
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(template)}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                🧬 Duplicate
              </button>
            )}
            {onAssignToNpc && (
              <button
                type="button"
                onClick={() => onAssignToNpc(template)}
                className="rounded-md border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
              >
                🤖 Assign to AI Coworker
              </button>
            )}
            {onSmartAssign && (
              <button
                type="button"
                onClick={() => onSmartAssign(template)}
                disabled={smartAssigning}
                className="rounded-md border border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-50"
              >
                {smartAssigning ? "Thinking…" : "🪄 Smart Assign"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onStart(template)}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
