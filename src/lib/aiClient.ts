import { TAXONOMY } from "../data/taxonomy";
import type { ClientPersona } from "../data/clients";
import type { ChatMessage, ClientRequest, FieldType } from "../types/template";
import { groqChatCompletion, parseToolArguments, type GroqTool } from "./groqClient";

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

const REQUEST_TOOL: GroqTool = {
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
  apiKey: string,
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

  const result = await groqChatCompletion({
    apiKey,
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

const OFFER_TOOL: GroqTool = {
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
  apiKey: string,
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

  const result = await groqChatCompletion({
    apiKey,
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

/** Canned, no-API-key fallback so emailing a client still feels like something happened. */
export function staticClientEmailReply(clientPersona: ClientPersona, subject: string): EmailReply {
  return {
    subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
    body: `Thanks for the note - got it. I'll follow up soon.\n\n${clientPersona.name}\n${clientPersona.company}\n\n(Connect a Groq API key in Settings for real AI-written replies.)`,
  };
}

export async function generateClientEmailReply(
  clientPersona: ClientPersona,
  subject: string,
  body: string,
  apiKey: string,
): Promise<EmailReply> {
  const system = `You are ${clientPersona.name} from ${clientPersona.company}, a client in a cozy office-life simulation game. \
Personality: ${clientPersona.personality}
You just received an email from the player, who does office paperwork for you. Write a short, natural,
office-appropriate email reply (2-5 sentences). Stay in character. Do not use markdown formatting - plain email prose only.`;

  const result = await groqChatCompletion({
    apiKey,
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
