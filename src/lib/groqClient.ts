/**
 * Minimal client for Groq's free-tier, OpenAI-compatible chat completions API.
 * Raw fetch (no SDK needed) - see https://console.groq.com/docs/api-reference.
 */
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface GroqToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GroqTool {
  type: "function";
  function: GroqToolFunction;
}

export type GroqRole = "system" | "user" | "assistant";

export interface GroqMessage {
  role: GroqRole;
  content: string;
}

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqCompletionResult {
  content: string | null;
  toolCalls: GroqToolCall[];
}

export class GroqApiError extends Error {}

export async function groqChatCompletion(params: {
  apiKey: string;
  messages: GroqMessage[];
  tools?: GroqTool[];
  forceToolName?: string;
  maxTokens?: number;
}): Promise<GroqCompletionResult> {
  const { apiKey, messages, tools, forceToolName, maxTokens } = params;

  if (!apiKey.trim()) {
    throw new GroqApiError(
      "No Groq API key configured. Add a free key from console.groq.com in Settings.",
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: maxTokens ?? 2048,
      ...(tools ? { tools } : {}),
      ...(forceToolName
        ? { tool_choice: { type: "function", function: { name: forceToolName } } }
        : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GroqApiError(`Groq API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new GroqApiError("Groq API returned no message.");
  }

  return {
    content: message.content ?? null,
    toolCalls: message.tool_calls ?? [],
  };
}

export function parseToolArguments<T>(call: GroqToolCall): T {
  return JSON.parse(call.function.arguments) as T;
}
