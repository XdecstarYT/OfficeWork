import type { TemplateField } from "../types/template";

interface DocumentFieldFormProps {
  fields: TemplateField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  readOnly?: boolean;
}

export function DocumentFieldForm({ fields, values, onChange, readOnly }: DocumentFieldFormProps) {
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => (
        <div key={f.id} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-stone-500">
            {f.label} {f.required && <span className="text-emerald-600">*</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea
              rows={3}
              disabled={readOnly}
              value={values[f.id] ?? ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              placeholder={f.placeholder}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
            />
          ) : f.type === "select" ? (
            <select
              disabled={readOnly}
              value={values[f.id] ?? ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
            >
              <option value="">Select…</option>
              {f.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <input
              type="checkbox"
              disabled={readOnly}
              checked={values[f.id] === "true"}
              onChange={(e) => onChange(f.id, e.target.checked ? "true" : "false")}
              className="h-4 w-4 self-start"
            />
          ) : (
            <input
              type={f.type === "date" ? "date" : f.type === "number" || f.type === "currency" ? "number" : "text"}
              disabled={readOnly}
              value={values[f.id] ?? ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              placeholder={f.placeholder}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
            />
          )}
        </div>
      ))}
    </div>
  );
}
