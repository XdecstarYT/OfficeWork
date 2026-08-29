import type { TemplateField } from "../../src/types/template";

export type DocKind =
  | "letter"
  | "memo"
  | "report"
  | "form"
  | "checklist"
  | "log"
  | "notice"
  | "plan"
  | "invoice"
  | "contract";

export interface ProfileOverrides {
  subjectLabel?: string;
  approverLabel?: string;
  detailsLabel?: string;
  summaryLabel?: string;
  recipientLabel?: string;
  entriesLabel?: string;
  objectivesLabel?: string;
  totalLabel?: string;
  partyALabel?: string;
  partyBLabel?: string;
  counterpartyLabel?: string;
  includeDepartment?: boolean;
  includePeriod?: boolean;
  includeDueDate?: boolean;
}

export interface SubcategoryProfile {
  subcategoryId: string;
  docKind: DocKind;
  /** Visible document noun, e.g. "Offer Letter" */
  noun: string;
  /** Lowercase-leading sentence fragment: "formally extends a job offer..." */
  purpose: string;
  extraFields?: TemplateField[];
  flavors: string[];
  overrides?: ProfileOverrides;
}

export function f(
  id: string,
  label: string,
  type: TemplateField["type"] = "text",
  required = true,
  extra: Partial<TemplateField> = {},
): TemplateField {
  return { id, label, type, required, ...extra };
}
