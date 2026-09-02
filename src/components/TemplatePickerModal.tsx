import { useEffect, useMemo, useState } from "react";
import { ALL_TEMPLATES, searchTemplates } from "../lib/templates";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import type { DocumentTemplate } from "../types/template";

interface TemplatePickerModalProps {
  title: string;
  companyId: string | null;
  onPick: (template: DocumentTemplate) => void;
  onClose: () => void;
}

export function TemplatePickerModal({ title, companyId, onPick, onClose }: TemplatePickerModalProps) {
  const [query, setQuery] = useState("");
  const { customTemplates } = useCustomTemplates(companyId, null);
  const allTemplates = useMemo(
    () => [...customTemplates, ...ALL_TEMPLATES],
    [customTemplates],
  );
  const allResults = useMemo(() => searchTemplates(allTemplates, query), [allTemplates, query]);
  const results = allResults.slice(0, 30);

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
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onPick(results[0]);
          }}
          placeholder="Search templates… (Enter picks the first result)"
          className="mt-3 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {query && (
          <p className="mt-1 text-xs text-stone-400">
            {allResults.length} result{allResults.length === 1 ? "" : "s"}
            {allResults.length > 30 && " (showing first 30)"}
          </p>
        )}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-4 text-center text-sm text-stone-400">No templates found.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onPick(t)}
                    className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-stone-50"
                  >
                    <span className="text-sm font-medium text-stone-800">{t.title}</span>
                    <span className="text-xs text-stone-400">
                      {t.category} / {t.subcategory} · ~{t.estimatedMinutes} min
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
