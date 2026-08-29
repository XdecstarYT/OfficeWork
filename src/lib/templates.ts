import type { DocumentTemplate } from "../types/template";

const modules = import.meta.glob("../../templates/**/*.json", {
  eager: true,
}) as Record<string, { default: DocumentTemplate }>;

export const ALL_TEMPLATES: DocumentTemplate[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.title.localeCompare(b.title));

export function getTemplate(id: string): DocumentTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export function searchTemplates(templates: DocumentTemplate[], query: string): DocumentTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter((t) => {
    const haystack = [t.title, t.description, t.category, t.subcategory, ...t.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
