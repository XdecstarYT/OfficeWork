export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "currency"
  | "number"
  | "checkbox"
  | "select"
  | "signature";

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  defaultValue?: string;
  helpText?: string;
}

export type Difficulty = "quick" | "standard" | "detailed";

export interface DocumentTemplate {
  id: string;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  tags: string[];
  fields: TemplateField[];
  bodyTemplate: string;
}

export interface ClientRequest {
  id: string;
  clientId: string;
  title: string;
  description: string;
  categoryHint: string;
  payout: number;
  deadlineDays: number;
  fields: TemplateField[];
  bodyTemplate: string;
  isPreview: boolean;
  createdAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface TaxonomySubcategory {
  id: string;
  name: string;
  description: string;
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  description: string;
  subcategories: TaxonomySubcategory[];
}
