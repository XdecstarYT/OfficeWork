import type { TemplateField, Difficulty } from "../../src/types/template";
import type { DocKind, ProfileOverrides } from "./types";

const DEPARTMENT_OPTIONS = [
  "Sales",
  "Marketing",
  "Engineering",
  "Finance",
  "Human Resources",
  "Operations",
  "Customer Support",
  "Executive",
];

const DIVIDER =
  "--------------------------------------------------------------------";

function field(
  id: string,
  label: string,
  type: TemplateField["type"] = "text",
  required = true,
  extra: Partial<TemplateField> = {},
): TemplateField {
  return { id, label, type, required, ...extra };
}

export function buildFields(
  kind: DocKind,
  extraFields: TemplateField[],
  overrides: ProfileOverrides = {},
): TemplateField[] {
  switch (kind) {
    case "letter":
      return [
        field("sender_name", "Your Name", "text", true, { placeholder: "Your name" }),
        field("date", "Date", "date", true),
        field("recipient_name", overrides.recipientLabel ?? "Recipient Name", "text", true),
        ...extraFields,
        field("details", overrides.detailsLabel ?? "Message", "textarea", true, {
          placeholder: "Write the body of the letter here.",
        }),
        field("signature", "Signature", "signature", true),
      ];

    case "memo":
      return [
        field("to", "To", "text", true, { placeholder: "Recipient(s)" }),
        field("from", "From", "text", true, { placeholder: "Your name" }),
        field("date", "Date", "date", true),
        field("subject", "Re / Subject", "text", true),
        ...extraFields,
        field("body", "Body", "textarea", true),
      ];

    case "report":
      return [
        field("author", "Prepared By", "text", true),
        field("date", "Date", "date", true),
        ...(overrides.includePeriod === false
          ? []
          : [field("period", "Reporting Period", "text", false, { placeholder: "e.g. Q2 2026" })]),
        ...extraFields,
        field("summary", overrides.summaryLabel ?? "Summary", "textarea", true),
      ];

    case "form":
      return [
        field("subject_name", overrides.subjectLabel ?? "Name", "text", true),
        field("date", "Date", "date", true),
        ...(overrides.includeDepartment === false
          ? []
          : [field("department", "Department", "select", false, { options: DEPARTMENT_OPTIONS })]),
        ...extraFields,
        field("details", overrides.detailsLabel ?? "Details", "textarea", true),
        field("approver_name", overrides.approverLabel ?? "Approver", "text", true),
        field("signature", "Signature", "signature", true),
      ];

    case "checklist":
      return [
        field("owner", "Owner", "text", false),
        ...extraFields,
        field("items", "Items", "textarea", true, { placeholder: "One item per line" }),
      ];

    case "log":
      return [
        field("date", "Date", "date", true),
        ...extraFields,
        field("entries", overrides.entriesLabel ?? "Entries", "textarea", true),
      ];

    case "notice":
      return [
        field("date", "Date", "date", true),
        ...extraFields,
        field("body", "Details", "textarea", true),
        field("issued_by", "Issued By", "text", false),
      ];

    case "plan":
      return [
        field("owner", "Owner", "text", true),
        field("date", "Date", "date", true),
        ...extraFields,
        field("objectives", overrides.objectivesLabel ?? "Objectives", "textarea", true),
        field("timeline", "Timeline", "textarea", false),
      ];

    case "invoice":
      return [
        field("counterparty", overrides.counterpartyLabel ?? "Bill To", "textarea", true),
        field("date", "Date", "date", true),
        ...(overrides.includeDueDate === false
          ? []
          : [field("due_date", "Due Date", "date", false)]),
        ...extraFields,
        field("line_items", "Line Items", "textarea", true, {
          placeholder: "Description | Amount, one per line",
        }),
        field("total", overrides.totalLabel ?? "Total", "currency", true, { placeholder: "0.00" }),
      ];

    case "contract":
      return [
        field("party_a", overrides.partyALabel ?? "Party A", "text", true),
        field("party_b", overrides.partyBLabel ?? "Party B", "text", true),
        field("effective_date", "Effective Date", "date", true),
        ...extraFields,
        field("terms", "Terms", "textarea", true),
        field("party_a_signature", "Party A Signature", "signature", false),
        field("party_b_signature", "Party B Signature", "signature", false),
      ];
  }
}

function labelLine(f: TemplateField): string {
  return `${f.label}: {{${f.id}}}`;
}

function pairLines(fields: TemplateField[]): string {
  const lines: string[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    const a = fields[i];
    const b = fields[i + 1];
    if (b) {
      lines.push(`${labelLine(a).padEnd(40)}${labelLine(b)}`);
    } else {
      lines.push(labelLine(a));
    }
  }
  return lines.join("\n");
}

/** Field ids that buildFields() always produces for a given kind, before extraFields are spliced in. Anything else in `fields` is an extra field from the profile. */
const BASE_IDS: Record<DocKind, string[]> = {
  letter: ["sender_name", "date", "recipient_name", "details", "signature"],
  memo: ["to", "from", "date", "subject", "body"],
  report: ["author", "date", "period", "summary"],
  form: ["subject_name", "date", "department", "details", "approver_name", "signature"],
  checklist: ["owner", "items"],
  log: ["date", "entries"],
  notice: ["date", "body", "issued_by"],
  plan: ["owner", "date", "objectives", "timeline"],
  invoice: ["counterparty", "date", "due_date", "line_items", "total"],
  contract: ["party_a", "party_b", "effective_date", "terms", "party_a_signature", "party_b_signature"],
};

/** Renders any extra (profile-supplied) textarea fields as their own labeled sections, so they never get silently dropped by a kind's fixed layout. */
function extraTextareaSections(kind: DocKind, fields: TemplateField[]): string {
  const baseIds = new Set(BASE_IDS[kind]);
  const extras = fields.filter((f) => f.type === "textarea" && !baseIds.has(f.id));
  return extras.map((f) => `${f.label}:\n{{${f.id}}}`).join("\n\n");
}

export function composeBody(
  kind: DocKind,
  noun: string,
  fields: TemplateField[],
  contextLine: string | null,
): string {
  const nonTextareaNonSignature = fields.filter(
    (f) => f.type !== "textarea" && f.type !== "signature",
  );
  const extraBlock = extraTextareaSections(kind, fields);

  const title = noun.toUpperCase();

  switch (kind) {
    case "letter": {
      const sender = fields.find((f) => f.id === "sender_name")!;
      const date = fields.find((f) => f.id === "date")!;
      const recipient = fields.find((f) => f.id === "recipient_name")!;
      const middleHeader = nonTextareaNonSignature.filter(
        (f) => !["sender_name", "date", "recipient_name"].includes(f.id),
      );
      const details = fields.find((f) => f.id === "details");
      const signature = fields.find((f) => f.id === "signature");
      return [
        `{{${date.id}}}`,
        "",
        `{{${recipient.id}}}`,
        "",
        `Dear {{${recipient.id}}},`,
        "",
        middleHeader.length ? pairLines(middleHeader) : "",
        extraBlock,
        details ? `{{${details.id}}}` : "",
        "",
        "Sincerely,",
        "",
        signature ? `{{${signature.id}}}` : "",
        `{{${sender.id}}}`,
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "memo": {
      const to = fields.find((f) => f.id === "to")!;
      const from = fields.find((f) => f.id === "from")!;
      const date = fields.find((f) => f.id === "date")!;
      const subject = fields.find((f) => f.id === "subject")!;
      const extraHeaderFields = nonTextareaNonSignature.filter(
        (f) => !["to", "from", "date", "subject"].includes(f.id),
      );
      const body = fields.find((f) => f.id === "body");
      return [
        "MEMORANDUM",
        "",
        `To: {{${to.id}}}`,
        `From: {{${from.id}}}`,
        `Date: {{${date.id}}}`,
        `Re: {{${subject.id}}}`,
        extraHeaderFields.length ? pairLines(extraHeaderFields) : "",
        "",
        DIVIDER,
        "",
        extraBlock,
        body ? `{{${body.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "invoice": {
      const counterparty = fields.find((f) => f.id === "counterparty")!;
      const rest = nonTextareaNonSignature.filter((f) => f.id !== "total");
      const lineItems = fields.find((f) => f.id === "line_items");
      const total = fields.find((f) => f.id === "total");
      return [
        title,
        "",
        `${counterparty.label}:`,
        `{{${counterparty.id}}}`,
        "",
        rest.length ? pairLines(rest) : "",
        extraBlock,
        "",
        DIVIDER,
        lineItems ? `{{${lineItems.id}}}` : "",
        DIVIDER,
        "",
        total ? `${total.label.toUpperCase()}: {{${total.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "contract": {
      const partyA = fields.find((f) => f.id === "party_a")!;
      const partyB = fields.find((f) => f.id === "party_b")!;
      const effectiveDate = fields.find((f) => f.id === "effective_date")!;
      const middle = nonTextareaNonSignature.filter(
        (f) => !["party_a", "party_b", "effective_date"].includes(f.id),
      );
      const terms = fields.find((f) => f.id === "terms");
      const sigA = fields.find((f) => f.id === "party_a_signature");
      const sigB = fields.find((f) => f.id === "party_b_signature");
      return [
        "AGREEMENT",
        "",
        `Between: {{${partyA.id}}}`,
        `And: {{${partyB.id}}}`,
        `Effective Date: {{${effectiveDate.id}}}`,
        middle.length ? pairLines(middle) : "",
        "",
        DIVIDER,
        "TERMS",
        DIVIDER,
        extraBlock,
        terms ? `{{${terms.id}}}` : "",
        "",
        DIVIDER,
        "",
        `${sigA ? `{{${sigA.id}}}` : ""}                    ${sigB ? `{{${sigB.id}}}` : ""}`,
        "Party A                                  Party B",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "checklist": {
      const owner = fields.find((f) => f.id === "owner");
      const extras = nonTextareaNonSignature.filter((f) => f.id !== "owner");
      const items = fields.find((f) => f.id === "items");
      return [
        title,
        owner ? `Owner: {{${owner.id}}}` : "",
        extras.length ? pairLines(extras) : "",
        contextLine ?? "",
        extraBlock,
        "",
        DIVIDER,
        "",
        items ? `{{${items.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "log": {
      const date = fields.find((f) => f.id === "date");
      const extras = nonTextareaNonSignature.filter((f) => f.id !== "date");
      const entries = fields.find((f) => f.id === "entries");
      return [
        title,
        contextLine ?? "",
        date ? `Date: {{${date.id}}}` : "",
        extras.length ? pairLines(extras) : "",
        extraBlock,
        "",
        DIVIDER,
        entries ? `{{${entries.id}}}` : "",
        DIVIDER,
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "notice": {
      const date = fields.find((f) => f.id === "date");
      const extras = nonTextareaNonSignature.filter((f) => f.id !== "date" && f.id !== "issued_by");
      const body = fields.find((f) => f.id === "body");
      const issuedBy = fields.find((f) => f.id === "issued_by");
      return [
        "NOTICE",
        "",
        title,
        contextLine ?? "",
        date ? `Date: {{${date.id}}}` : "",
        extras.length ? pairLines(extras) : "",
        "",
        DIVIDER,
        "",
        extraBlock,
        body ? `{{${body.id}}}` : "",
        "",
        DIVIDER,
        "",
        issuedBy ? `Issued by: {{${issuedBy.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "plan": {
      const owner = fields.find((f) => f.id === "owner");
      const date = fields.find((f) => f.id === "date");
      const extras = nonTextareaNonSignature.filter((f) => !["owner", "date"].includes(f.id));
      const objectives = fields.find((f) => f.id === "objectives");
      const timeline = fields.find((f) => f.id === "timeline");
      return [
        title,
        contextLine ?? "",
        pairLines([owner, date].filter((f): f is TemplateField => !!f)),
        extras.length ? pairLines(extras) : "",
        extraBlock,
        "",
        DIVIDER,
        "OBJECTIVES",
        DIVIDER,
        objectives ? `{{${objectives.id}}}` : "",
        "",
        "Timeline:",
        timeline ? `{{${timeline.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "report": {
      const author = fields.find((f) => f.id === "author");
      const date = fields.find((f) => f.id === "date");
      const extras = nonTextareaNonSignature.filter((f) => !["author", "date"].includes(f.id));
      const summary = fields.find((f) => f.id === "summary");
      return [
        title,
        contextLine ?? "",
        pairLines([author, date].filter((f): f is TemplateField => !!f)),
        extras.length ? pairLines(extras) : "",
        "",
        DIVIDER,
        "",
        extraBlock,
        summary ? `{{${summary.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }

    case "form": {
      const subject = fields.find((f) => f.id === "subject_name");
      const date = fields.find((f) => f.id === "date");
      const approver = fields.find((f) => f.id === "approver_name");
      const signature = fields.find((f) => f.id === "signature");
      const extras = nonTextareaNonSignature.filter(
        (f) => !["subject_name", "date", "approver_name"].includes(f.id),
      );
      const details = fields.find((f) => f.id === "details");
      return [
        title,
        contextLine ?? "",
        pairLines([subject, date].filter((f): f is TemplateField => !!f)),
        extras.length ? pairLines(extras) : "",
        "",
        DIVIDER,
        extraBlock,
        details ? `{{${details.id}}}` : "",
        DIVIDER,
        "",
        approver ? `Approver: {{${approver.id}}}` : "",
        "",
        signature ? `Signature: {{${signature.id}}}` : "",
      ]
        .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
        .join("\n");
    }
  }
}

const KIND_TIME_RANGE: Record<DocKind, [number, Difficulty]> = {
  letter: [8, "quick"],
  memo: [6, "quick"],
  checklist: [7, "quick"],
  notice: [7, "quick"],
  log: [8, "standard"],
  form: [12, "standard"],
  invoice: [10, "standard"],
  report: [18, "detailed"],
  plan: [20, "detailed"],
  contract: [18, "detailed"],
};

export function estimateForVariant(kind: DocKind, index: number): { minutes: number; difficulty: Difficulty } {
  const [base, difficulty] = KIND_TIME_RANGE[kind];
  const minutes = base + (index % 4) * 2;
  return { minutes, difficulty };
}
