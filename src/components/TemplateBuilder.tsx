import { useRef, useState } from "react";
import { DocumentPreview } from "./DocumentPreview";
import { generateCustomTemplate } from "../lib/aiClient";
import type { LlmConfig } from "../lib/llmConfig";
import type { DocumentTemplate, FieldType, TemplateField } from "../types/template";

interface BuilderField extends TemplateField {
  optionsText?: string;
}

interface PaletteEntry {
  type: FieldType;
  label: string;
  icon: string;
}

const PALETTE: PaletteEntry[] = [
  { type: "text", label: "Text", icon: "📝" },
  { type: "textarea", label: "Paragraph", icon: "📄" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "number", label: "Number", icon: "🔢" },
  { type: "currency", label: "Currency", icon: "💵" },
  { type: "checkbox", label: "Checkbox", icon: "☑️" },
  { type: "select", label: "Dropdown", icon: "🔽" },
  { type: "signature", label: "Signature", icon: "✍️" },
];

const FIELD_TYPE_DND = "application/x-officequest-field-type";
const REORDER_INDEX_DND = "application/x-officequest-reorder-index";

function buildBodyTemplate(title: string, fields: BuilderField[]): string {
  const lines: string[] = [(title.trim() || "Untitled Document").toUpperCase(), ""];
  for (const f of fields) {
    const label = f.label.trim() || "Untitled Field";
    if (f.type === "textarea") {
      lines.push(`${label}:`, `{{${f.id}}}`, "");
    } else {
      lines.push(`${label}: {{${f.id}}}`);
    }
  }
  return lines.join("\n");
}

function previewValues(fields: BuilderField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === "checkbox") continue;
    values[f.id] = `[${f.placeholder || f.label || f.type}]`;
  }
  return values;
}

interface TemplateBuilderProps {
  onClose: () => void;
  onFillOutNow: (template: DocumentTemplate) => void;
  onSaveTemplate: (template: DocumentTemplate) => void;
  /** Overrides the primary action button's label and heading, e.g. "Assign to Sam". */
  primaryLabel?: string;
  heading?: string;
  /** When provided, shows a "✨ Generate with AI" prompt that drafts the whole template from a one-line idea. */
  llmConfig?: LlmConfig;
}

export function TemplateBuilder({
  onClose,
  onFillOutNow,
  onSaveTemplate,
  primaryLabel = "Fill It Out Now",
  heading = "🧩 Build a Custom Template",
  llmConfig,
}: TemplateBuilderProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const nextSeq = useRef(1);

  async function handleGenerateWithAi() {
    if (!llmConfig || !aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError("");
    try {
      const generated = await generateCustomTemplate(aiPrompt, llmConfig);
      setTitle(generated.title);
      setDescription(generated.description);
      setFields(
        generated.fields.map((f) => ({
          ...f,
          optionsText: f.options?.join(", "),
        })),
      );
      nextSeq.current = generated.fields.length + 1;
      setShowAiPrompt(false);
      setAiPrompt("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Couldn't reach the AI.");
    } finally {
      setAiGenerating(false);
    }
  }

  function insertField(type: FieldType, atIndex: number) {
    const seq = nextSeq.current++;
    const entry = PALETTE.find((p) => p.type === type)!;
    const field: BuilderField = {
      id: `field_${seq}`,
      label: `${entry.label} Field`,
      type,
      required: false,
      placeholder: type === "select" || type === "checkbox" || type === "signature" ? undefined : "",
      options: type === "select" ? ["Option 1", "Option 2"] : undefined,
      optionsText: type === "select" ? "Option 1, Option 2" : undefined,
    };
    setFields((prev) => {
      const next = [...prev];
      next.splice(atIndex, 0, field);
      return next;
    });
  }

  function moveField(fromIndex: number, toIndex: number) {
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(adjustedTo, 0, moved);
      return next;
    });
  }

  function moveFieldBy(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    moveField(index, delta > 0 ? target + 1 : target);
  }

  function updateField(index: number, patch: Partial<BuilderField>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDropAt(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    const newType = e.dataTransfer.getData(FIELD_TYPE_DND) as FieldType | "";
    const reorderRaw = e.dataTransfer.getData(REORDER_INDEX_DND);
    if (newType) {
      insertField(newType, index);
    } else if (reorderRaw !== "") {
      moveField(Number(reorderRaw), index);
    }
  }

  function assembleTemplate(): DocumentTemplate {
    const cleanedFields: TemplateField[] = fields.map((f) => ({
      id: f.id,
      label: f.label.trim() || "Untitled Field",
      type: f.type,
      required: f.required,
      placeholder: f.placeholder || undefined,
      options:
        f.type === "select"
          ? (f.optionsText ?? "")
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    }));
    const difficulty = cleanedFields.length <= 3 ? "quick" : cleanedFields.length <= 7 ? "standard" : "detailed";
    return {
      id: `custom-${Date.now()}`,
      category: "Custom Templates",
      categoryId: "custom",
      subcategory: "My Templates",
      subcategoryId: "custom-my-templates",
      title: title.trim() || "Untitled Custom Document",
      description: description.trim() || "A custom document built with the drag-and-drop builder.",
      estimatedMinutes: Math.max(2, cleanedFields.length * 2),
      difficulty,
      tags: ["custom", "drag-and-drop"],
      fields: cleanedFields,
      bodyTemplate: buildBodyTemplate(title, fields),
    };
  }

  const canSave = fields.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{heading}</h2>
            <p className="text-xs text-stone-500">
              Tap a field type to add it (or drag it on desktop), then use ▲▼ to reorder.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <aside className="flex shrink-0 flex-col gap-2 overflow-hidden border-b border-stone-200 bg-stone-50 p-3 lg:w-[180px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <h3 className="hidden text-xs font-semibold uppercase tracking-wide text-stone-400 lg:block">
              Field Types
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {PALETTE.map((entry) => (
                <button
                  key={entry.type}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FIELD_TYPE_DND, entry.type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => insertField(entry.type, fields.length)}
                  className="flex shrink-0 cursor-grab items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700 shadow-sm hover:bg-stone-50 active:cursor-grabbing"
                >
                  <span>{entry.icon}</span>
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
            <p className="hidden text-xs text-stone-400 lg:block">
              Tap to add to the end, or drag onto the canvas to place it precisely (desktop only).
            </p>
          </aside>

          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            {llmConfig && (
              <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
                {!showAiPrompt ? (
                  <button
                    type="button"
                    onClick={() => setShowAiPrompt(true)}
                    className="text-xs font-medium text-violet-700 hover:text-violet-900"
                  >
                    ✨ Generate with AI
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-violet-700">
                      Describe the document and the AI will draft the whole thing - title, fields, and body.
                    </p>
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. an annual performance review form"
                      className="w-full rounded-md border border-violet-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    {aiError && <p className="text-xs text-red-600">{aiError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateWithAi}
                        disabled={aiGenerating || !aiPrompt.trim()}
                        className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                      >
                        {aiGenerating ? "Generating…" : "Generate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiPrompt(false);
                          setAiError("");
                        }}
                        className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title…"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-medium focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)…"
              className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(fields.length);
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDropAt(e, fields.length)}
              className="mt-4 flex min-h-[120px] flex-col gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-3 lg:min-h-[200px]"
            >
              {fields.length === 0 && (
                <p className="flex flex-1 items-center justify-center text-center text-sm text-stone-400">
                  Tap a field type on the left to start building.
                </p>
              )}
              {fields.map((f, index) => (
                <div key={f.id}>
                  {dragOverIndex === index && (
                    <div className="mb-2 h-1 rounded-full bg-emerald-400" />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(REORDER_INDEX_DND, String(index));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIndex(index);
                    }}
                    onDrop={(e) => handleDropAt(e, index)}
                    className="flex flex-col gap-2 rounded-md border border-stone-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="hidden cursor-grab text-stone-300 active:cursor-grabbing sm:inline">
                        ⠿
                      </span>
                      <div className="flex shrink-0 flex-col">
                        <button
                          type="button"
                          onClick={() => moveFieldBy(index, -1)}
                          disabled={index === 0}
                          className="leading-none text-stone-400 hover:text-stone-700 disabled:opacity-25"
                          aria-label="Move field up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFieldBy(index, 1)}
                          disabled={index === fields.length - 1}
                          className="leading-none text-stone-400 hover:text-stone-700 disabled:opacity-25"
                          aria-label="Move field down"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                        {PALETTE.find((p) => p.type === f.type)?.icon} {f.type}
                      </span>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Field label"
                        className="min-w-0 flex-1 rounded border border-stone-200 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                      <label className="flex shrink-0 items-center gap-1 text-xs text-stone-500">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                        />
                        <span className="hidden sm:inline">Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="shrink-0 text-stone-300 hover:text-red-500"
                        aria-label="Remove field"
                      >
                        ✕
                      </button>
                    </div>

                    {(f.type === "text" ||
                      f.type === "textarea" ||
                      f.type === "number" ||
                      f.type === "currency") && (
                      <input
                        type="text"
                        value={f.placeholder ?? ""}
                        onChange={(e) => updateField(index, { placeholder: e.target.value })}
                        placeholder="Placeholder text (optional)"
                        className="ml-6 rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 focus:border-emerald-500 focus:outline-none"
                      />
                    )}

                    {f.type === "select" && (
                      <input
                        type="text"
                        value={f.optionsText ?? ""}
                        onChange={(e) => updateField(index, { optionsText: e.target.value })}
                        placeholder="Comma-separated options, e.g. Yes, No, Maybe"
                        className="ml-6 rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 focus:border-emerald-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              ))}
              {dragOverIndex === fields.length && fields.length > 0 && (
                <div className="h-1 rounded-full bg-emerald-400" />
              )}
            </div>
          </main>

          <aside className="max-h-40 shrink-0 overflow-y-auto border-t border-stone-100 lg:max-h-none lg:w-[320px] lg:border-t-0 lg:border-l">
            <DocumentPreview
              title={title.trim() || "Untitled Document"}
              bodyTemplate={buildBodyTemplate(title, fields)}
              values={previewValues(fields)}
            />
          </aside>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSaveTemplate(assembleTemplate())}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            Save as Template
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onFillOutNow(assembleTemplate())}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
