import { TAXONOMY } from "../data/taxonomy";
import type { ClientPersona } from "../data/clients";
import type { NpcPersona } from "../data/npcs";
import type { ChatMessage, ClientRequest, DocumentTemplate, FieldType, TemplateField } from "../types/template";
import { llmChatCompletion, parseToolArguments, type LlmTool } from "./localLlmClient";
import type { LlmConfig } from "./llmConfig";
import type { ReferenceRow } from "./documents";
import { renderBody } from "./renderTemplate";

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "date",
  "currency",
  "number",
  "checkbox",
  "select",
  "signature",
];

const REQUEST_TOOL: LlmTool = {
  type: "function",
  function: {
    name: "submit_client_request",
    description: "Submit a one-off business paperwork request from this client.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short, specific title for the document being requested." },
        description: {
          type: "string",
          description:
            "One or two sentence in-character description of what the client needs and why, written as if the client is asking for it.",
        },
        categoryHint: {
          type: "string",
          enum: TAXONOMY.map((c) => c.id),
          description: "Which category of office work this request best fits.",
        },
        payout: { type: "number", description: "Fair payout for this task in dollars." },
        deadlineDays: { type: "integer", description: "Days until this is due, 1-14." },
        fields: {
          type: "array",
          description: "Form fields the player fills in to produce the document. At least 4.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "snake_case field id, referenced in bodyTemplate as {{id}}." },
              label: { type: "string" },
              type: { type: "string", enum: FIELD_TYPES },
              required: { type: "boolean" },
              placeholder: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
            required: ["id", "label", "type", "required"],
          },
        },
        bodyTemplate: {
          type: "string",
          description:
            "The full document body, realistically formatted, using {{field_id}} tokens matching the fields array.",
        },
      },
      required: ["title", "description", "categoryHint", "payout", "deadlineDays", "fields", "bodyTemplate"],
    },
  },
};

export async function generateClientRequest(
  clientPersona: ClientPersona,
  config: LlmConfig,
): Promise<ClientRequest> {
  const categoryList = TAXONOMY.map((c) => `${c.id}: ${c.name}`).join("\n");
  const [minPayout, maxPayout] = clientPersona.payoutRange;

  const system = `You are generating a one-off office paperwork request for a cozy office-life simulation game called "Office Quest". \
The player is an office worker who completes realistic business documents for in-game clients. \
Write as if you ARE the client below, requesting a real piece of business paperwork. Keep it grounded and realistic - \
no fantasy elements, no lorem ipsum. The document should be genuinely fillable with a real form. \
You must respond only by calling the submit_client_request tool.`;

  const user = `Client: ${clientPersona.name}, ${clientPersona.company}
Personality: ${clientPersona.personality}
Typical categories of work this client needs: ${clientPersona.categoryAffinity.join(", ")}
Payout should be between $${minPayout} and $${maxPayout}.
Deadline should be between 1 and 14 days.

Available categories:
${categoryList}

Generate one realistic, specific paperwork request from this client and submit it via the submit_client_request tool.`;

  const result = await llmChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [REQUEST_TOOL],
    forceToolName: "submit_client_request",
    maxTokens: 4000,
  });

  const call = result.toolCalls.find((c) => c.function.name === "submit_client_request");
  if (!call) {
    throw new Error("Client didn't respond with a request.");
  }

  const input = parseToolArguments<{
    title: string;
    description: string;
    categoryHint: string;
    payout: number;
    deadlineDays: number;
    fields: ClientRequest["fields"];
    bodyTemplate: string;
  }>(call);

  return {
    id: `req-${clientPersona.id}-${Date.now()}`,
    clientId: clientPersona.id,
    title: input.title,
    description: input.description,
    categoryHint: input.categoryHint,
    payout: Math.max(minPayout, Math.min(maxPayout, Math.round(input.payout))),
    deadlineDays: Math.max(1, Math.min(14, Math.round(input.deadlineDays))),
    fields: input.fields,
    bodyTemplate: input.bodyTemplate,
    isPreview: false,
    createdAt: Date.now(),
  };
}

export interface NegotiationOffer {
  payout: number;
  deadlineDays: number;
  note: string;
}

export interface NegotiationResult {
  reply: string;
  offer: NegotiationOffer | null;
}

const OFFER_TOOL: LlmTool = {
  type: "function",
  function: {
    name: "propose_terms",
    description:
      "Propose updated terms (payout and/or deadline) for the current request, if the player has asked for a change and you're willing to adjust.",
    parameters: {
      type: "object",
      properties: {
        payout: { type: "number", description: "The new proposed payout in dollars." },
        deadlineDays: { type: "integer", description: "The new proposed deadline in days." },
        note: { type: "string", description: "A short in-character note explaining the offer." },
      },
      required: ["payout", "deadlineDays", "note"],
    },
  },
};

export async function sendNegotiationMessage(
  clientPersona: ClientPersona,
  request: ClientRequest,
  history: ChatMessage[],
  userMessage: string,
  config: LlmConfig,
): Promise<NegotiationResult> {
  const system = `You are ${clientPersona.name} from ${clientPersona.company}, a client in a cozy office-life simulation game. \
Personality: ${clientPersona.personality}
You previously requested: "${request.title}" (${request.description}) for a payout of $${request.payout}, due in ${request.deadlineDays} day(s).
Stay in character. Keep replies short (1-3 sentences), office-appropriate, and friendly-but-real. \
If the player asks for more money or more time, you may reasonably negotiate - you can go up to about 50% above the original payout \
and extend the deadline by a few days, but you don't have to give in immediately and can push back once first. \
Only call the propose_terms tool when you are actually offering new terms, not for ordinary banter. \
Otherwise, just reply in plain text.`;

  const messages = [
    { role: "system" as const, content: system },
    ...history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user" as const, content: userMessage },
  ];

  const result = await llmChatCompletion({
    config,
    messages,
    tools: [OFFER_TOOL],
    maxTokens: 512,
  });

  const call = result.toolCalls.find((c) => c.function.name === "propose_terms");
  let offer: NegotiationOffer | null = null;
  if (call) {
    const input = parseToolArguments<{ payout: number; deadlineDays: number; note: string }>(call);
    offer = {
      payout: Math.round(input.payout),
      deadlineDays: Math.max(1, Math.round(input.deadlineDays)),
      note: input.note,
    };
  }

  return {
    reply: result.content ?? offer?.note ?? "...",
    offer,
  };
}

export interface EmailReply {
  subject: string;
  body: string;
}

/** Canned fallback used when the local LLM can't be reached, so emailing a client still feels like something happened. */
export function staticClientEmailReply(clientPersona: ClientPersona, subject: string): EmailReply {
  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    body: `Thanks for the note - got it. I'll follow up soon.\n\n${clientPersona.name}\n${clientPersona.company}\n\n(Couldn't reach a local LLM for a real reply - make sure one is running.)`,
  };
}

export async function generateClientEmailReply(
  clientPersona: ClientPersona,
  subject: string,
  body: string,
  config: LlmConfig,
): Promise<EmailReply> {
  const system = `You are ${clientPersona.name} from ${clientPersona.company}, a client in a cozy office-life simulation game. \
Personality: ${clientPersona.personality}
You just received an email from the player, who does office paperwork for you. Write a short, natural,
office-appropriate email reply (2-5 sentences). Stay in character. Do not use markdown formatting - plain email prose only.`;

  const result = await llmChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Subject: ${subject}\n\n${body}` },
    ],
    maxTokens: 400,
  });

  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    body: result.content ?? staticClientEmailReply(clientPersona, subject).body,
  };
}

const DRAFT_TOOL: LlmTool = {
  type: "function",
  function: {
    name: "fill_fields",
    description: "Provide realistic suggested values for the given office-document form fields.",
    parameters: {
      type: "object",
      properties: {
        values: {
          type: "object",
          description: "Map of field id to suggested value (plain string for every field type, including dates and numbers).",
          additionalProperties: { type: "string" },
        },
      },
      required: ["values"],
    },
  },
};

/**
 * Suggests values for a document's still-empty fields, using its title,
 * any already-filled fields, and any manager-provided reference data as
 * context. Only returns suggestions for fields that are both draftable
 * (not signature/checkbox) and currently empty in `filledValues`.
 */
export async function draftDocumentFields(params: {
  title: string;
  fields: TemplateField[];
  filledValues: Record<string, string>;
  referenceData?: ReferenceRow[];
  config: LlmConfig;
}): Promise<Record<string, string>> {
  const { title, fields, filledValues, referenceData, config } = params;
  const draftable = fields.filter(
    (f) => f.type !== "signature" && f.type !== "checkbox" && !filledValues[f.id]?.trim(),
  );
  if (draftable.length === 0) return {};

  const fieldList = draftable
    .map(
      (f) =>
        `- ${f.id} (label: "${f.label}", type: ${f.type}${f.options ? `, options: ${f.options.join(" / ")}` : ""})`,
    )
    .join("\n");
  const filledList = Object.entries(filledValues)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const referenceList = (referenceData ?? [])
    .filter((r) => r.label.trim() || r.value.trim())
    .map((r) => `- ${r.label}: ${r.value}`)
    .join("\n");

  const system = `You are helping an office worker in a paperwork simulation game draft the document "${title}". \
Suggest plausible, realistic, professional values for the listed empty form fields, consistent with any reference \
data and already-filled fields given below. Dates should be plausible near-future or recent dates in YYYY-MM-DD \
format. Keep text fields concise and businesslike, and textarea fields a short paragraph. \
Respond only by calling the fill_fields tool.`;
  const user = `Fields to draft:\n${fieldList}${
    filledList ? `\n\nAlready filled in (for context, do not overwrite):\n${filledList}` : ""
  }${referenceList ? `\n\nReference data:\n${referenceList}` : ""}`;

  const result = await llmChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    tools: [DRAFT_TOOL],
    forceToolName: "fill_fields",
    maxTokens: 1500,
  });

  const call = result.toolCalls.find((c) => c.function.name === "fill_fields");
  if (!call) return {};
  const input = parseToolArguments<{ values: Record<string, string> }>(call);
  return input.values ?? {};
}

/** Drafts a short congratulatory promotion announcement email body. Falls back to a canned message if the AI is unreachable. */
export async function generatePromotionAnnouncement(params: {
  promoterName: string;
  memberName: string;
  newTitle: string;
  newLevel: number;
  config: LlmConfig;
}): Promise<string> {
  const { promoterName, memberName, newTitle, newLevel, config } = params;
  const fallback = `Congratulations on your promotion to ${newTitle}! Well deserved — keep up the great work.\n\n— ${promoterName}`;
  try {
    const system = `You are writing a short, warm company announcement email congratulating a coworker on a \
promotion, in a cozy office-life simulation game. Keep it 2-4 sentences, professional but genuinely warm, \
addressed directly to them, no markdown, sign off as the promoter.`;
    const user = `${promoterName} is promoting ${memberName} to ${newTitle} (level ${newLevel}). Write the \
congratulatory email body.`;
    const result = await llmChatCompletion({
      config,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 300,
    });
    return result.content ?? fallback;
  } catch {
    return fallback;
  }
}

/** Canned fallback for an NPC coworker email reply when the hosted AI is unreachable. */
export function staticNpcEmailReply(npc: NpcPersona, subject: string): EmailReply {
  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    body: `Got your message - I'll take a look and get back to you.\n\n${npc.name}\n${npc.suggestedTitle}\n\n(Couldn't reach the AI for a real reply just now.)`,
  };
}

export async function generateNpcEmailReply(
  npc: NpcPersona,
  subject: string,
  body: string,
  config: LlmConfig,
): Promise<EmailReply> {
  const system = `You are ${npc.name}, a ${npc.suggestedTitle} at the player's company in a cozy office-life \
simulation game. Personality: ${npc.personality}
You just received an email from a coworker (your boss or teammate). Write a short, natural, office-appropriate \
email reply (2-5 sentences) as this character. Plain email prose only, no markdown.`;

  const result = await llmChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Subject: ${subject}\n\n${body}` },
    ],
    maxTokens: 400,
  });

  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    body: result.content ?? staticNpcEmailReply(npc, subject).body,
  };
}

/**
 * Asks an NPC coworker to do a piece of paperwork for you: the AI drafts
 * every field, and this returns the fully rendered document text ready to
 * drop into an email body - there's no document row involved at all, this
 * is pure flavor/convenience rather than a tracked, payable task.
 */
export async function draftDocumentAsNpc(
  npc: NpcPersona,
  template: DocumentTemplate,
  config: LlmConfig,
): Promise<string> {
  const values = await draftDocumentFields({
    title: `${template.title} (drafted by ${npc.name}, ${npc.suggestedTitle})`,
    fields: template.fields,
    filledValues: {},
    config,
  });
  return renderBody(template.bodyTemplate, values);
}
