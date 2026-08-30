import type { DocumentTemplate } from "../types/template";

/** A single wide-open field, no structure imposed - for writing anything freely. */
export const BLANK_PAGE_TEMPLATE: DocumentTemplate = {
  id: "blank-page",
  category: "Blank & Freeform",
  categoryId: "blank-freeform",
  subcategory: "Blank Documents",
  subcategoryId: "blank-documents",
  title: "Blank Page",
  description: "A completely blank page - just an open space to write anything you want.",
  estimatedMinutes: 2,
  difficulty: "quick",
  tags: ["blank", "freeform"],
  fields: [
    {
      id: "content",
      label: "",
      type: "textarea",
      required: false,
      placeholder: "Start typing…",
    },
  ],
  bodyTemplate: "{{content}}",
};
