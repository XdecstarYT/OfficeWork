import type { DocumentTemplate } from "../types/template";

const DIFFICULTY_STYLES: Record<DocumentTemplate["difficulty"], string> = {
  quick: "bg-emerald-100 text-emerald-800",
  standard: "bg-amber-100 text-amber-800",
  detailed: "bg-rose-100 text-rose-800",
};

interface TemplateCardProps {
  template: DocumentTemplate;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpen: (template: DocumentTemplate) => void;
}

export function TemplateCard({ template, isFavorite, onToggleFavorite, onOpen }: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(template)}
      className="group flex flex-col items-start gap-2 rounded-lg border border-stone-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md hover:border-stone-300"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
          {template.subcategory}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(template.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onToggleFavorite(template.id);
            }
          }}
          className={`shrink-0 text-lg leading-none ${
            isFavorite ? "text-amber-500" : "text-stone-300 hover:text-stone-400"
          }`}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </span>
      </div>

      <h3 className="text-[15px] font-semibold leading-snug text-stone-900 group-hover:text-emerald-800">
        {template.title}
      </h3>

      <p className="line-clamp-2 text-sm text-stone-500">{template.description}</p>

      <div className="mt-1 flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${DIFFICULTY_STYLES[template.difficulty]}`}>
          {template.difficulty}
        </span>
        <span className="text-stone-400">~{template.estimatedMinutes} min</span>
      </div>
    </button>
  );
}
