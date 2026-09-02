import { useState } from "react";
import { TAXONOMY } from "../data/taxonomy";

export interface CategorySelection {
  categoryId: string | null;
  subcategoryId: string | null;
}

interface CategoryTreeProps {
  selection: CategorySelection;
  onSelect: (selection: CategorySelection) => void;
  counts: Record<string, number>;
}

export function CategoryTree({ selection, onSelect, counts }: CategoryTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(selection.categoryId ? [selection.categoryId] : []),
  );

  const toggleExpanded = (categoryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const allExpanded = expanded.size === TAXONOMY.length;

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => onSelect({ categoryId: null, subcategoryId: null })}
          className={`flex flex-1 items-center justify-between rounded-md px-2.5 py-1.5 text-left font-medium transition-colors ${
            selection.categoryId === null
              ? "bg-stone-200 text-stone-900"
              : "text-stone-700 hover:bg-stone-100"
          }`}
        >
          <span>📁 All Documents</span>
          <span className="text-xs text-stone-400 tabular-nums">{totalCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(TAXONOMY.map((c) => c.id)))}
          className="ml-1 shrink-0 text-xs text-stone-400 hover:text-stone-600"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {TAXONOMY.map((category) => {
        const isExpanded = expanded.has(category.id);
        const isActiveCategory = selection.categoryId === category.id;
        const categoryCount = category.subcategories.reduce(
          (sum, sub) => sum + (counts[sub.id] ?? 0),
          0,
        );

        return (
          <div key={category.id}>
            <div
              className={`flex items-center rounded-md px-1 py-0.5 transition-colors ${
                isActiveCategory && !selection.subcategoryId
                  ? "bg-stone-200"
                  : "hover:bg-stone-100"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(category.id)}
                className="px-1 py-1 text-stone-400 hover:text-stone-700"
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? "▾" : "▸"}
              </button>
              <button
                type="button"
                onClick={() => onSelect({ categoryId: category.id, subcategoryId: null })}
                className="flex flex-1 items-center justify-between py-1 text-left text-stone-800"
              >
                <span className="truncate">{isExpanded ? "📂" : "📁"} {category.name}</span>
                <span className="ml-2 shrink-0 text-xs text-stone-400 tabular-nums">
                  {categoryCount}
                </span>
              </button>
            </div>

            {isExpanded && (
              <div className="ml-6 flex flex-col gap-0.5 border-l border-stone-200 pl-2 py-0.5">
                {category.subcategories.map((sub) => {
                  const isActive = selection.subcategoryId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() =>
                        onSelect({ categoryId: category.id, subcategoryId: sub.id })
                      }
                      className={`flex items-center justify-between rounded-md px-2 py-1 text-left text-[13px] transition-colors ${
                        isActive
                          ? "bg-emerald-100 text-emerald-900 font-medium"
                          : "text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      <span className="truncate">{sub.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-stone-400 tabular-nums">
                        {counts[sub.id] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
