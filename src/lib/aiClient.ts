import Anthropic from "@anthropic-ai/sdk";
import { TAXONOMY } from "../data/taxonomy";
import type { ClientPersona } from "../data/clients";
import type { ChatMessage, ClientRequest, FieldType } from "../types/template";

const MODEL = "claude-sonnet-5";
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

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const REQUEST_TOOL: Anthropic.Tool = {
  name: "submit_client_request",
  description: "Submit a one-off business paperwork request from this client.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, specific title for the document being requested." },
      description: {
        type: "string",
        description: "One or two sentence in-character description of what the client needs and why, written as if the client is asking for it.",
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
        description: "The full document body, realistically formatted, using {{field_id}} tokens matching the fields array.",
      },
    },
    required: ["title", "description", "categoryHint", "payout", "deadlineDays", "fields", "bodyTemplate"],
  },
};

export async function generateClientRequest(
  clientPersona: ClientPersona,
  apiKey: string,
): Promise<ClientRequest> {
  const categoryList = TAXONOMY.map((c) => `${c.id}: ${c.name}`).join("\n");
  const [minPayout, maxPayout] = clientPersona.payoutRange;

  const response = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `You are generating a one-off office paperwork request for a cozy office-life simulation game called "Office Quest". \
The player is an office worker who completes realistic business documents for in-game clients. \
Write as if you ARE the client below, requesting a real piece of business paperwork. Keep it grounded and realistic - \
no fantasy elements, no lorem ipsum. The document should be genuinely fillable with a real form.`,
    messages: [
      {
        role: "user",
        content: `Client: ${clientPersona.name}, ${clientPersona.company}
Personality: ${clientPersona.personality}
Typical categories of work this client needs: ${clientPersona.categoryAffinity.join(", ")}
Payout should be between $${minPayout} and $${maxPayout}.
Deadline should be between 1 and 14 days.

Available categories:
${categoryList}

Generate one realistic, specific paperwork request from this client and submit it via the submit_client_request tool.`,
      },
    ],
    tools: [REQUEST_TOOL],
    tool_choice: { type: "tool", name: "submit_client_request" },
    output_config: { effort: "medium" },
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error(`Client didn't respond with a request (stop_reason=${response.stop_reason}).`);
  }

  const input = toolUse.input as {
    title: string;
    description: string;
    categoryHint: string;
    payout: number;
    deadlineDays: number;
    fields: ClientRequest["fields"];
    bodyTemplate: string;
  };

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

const OFFER_TOOL: Anthropic.Tool = {
  name: "propose_terms",
  description: "Propose updated terms (payout and/or deadline) for the current request, if the player has asked for a change and you're willing to adjust.",
  input_schema: {
    type: "object",
    properties: {
      payout: { type: "number", description: "The new proposed payout in dollars." },
      deadlineDays: { type: "integer", description: "The new proposed deadline in days." },
      note: { type: "string", description: "A short in-character note explaining the offer." },
    },
    required: ["payout", "deadlineDays", "note"],
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
Only call the propose_terms tool when you are actually offering new terms, not for ordinary banter.`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.text }) as Anthropic.MessageParam),
    { role: "user", content: userMessage },
  ];

  const response = await client(apiKey).messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages,
    tools: [OFFER_TOOL],
    output_config: { effort: "medium" },
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

  let offer: NegotiationOffer | null = null;
  if (toolUse) {
    const input = toolUse.input as { payout: number; deadlineDays: number; note: string };
    offer = {
      payout: Math.round(input.payout),
      deadlineDays: Math.max(1, Math.round(input.deadlineDays)),
      note: input.note,
    };
  }

  return {
    reply: textBlock?.text ?? offer?.note ?? "...",
    offer,
  };
}
