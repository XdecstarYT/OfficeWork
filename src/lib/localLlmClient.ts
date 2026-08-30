/**
 * Minimal client for any OpenAI-compatible chat completions endpoint - the
 * shape Ollama, LM Studio, llama.cpp's server, and most other local LLM
 * runners all expose. Raw fetch, no SDK, and no API key required by default
 * (most local servers ignore auth entirely).
 */
import type { LlmConfig } from "./llmConfig";

export interface LlmToolFunction {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmTool {
  type: "function";
  function: LlmToolFunction;
}

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface LlmCompletionResult {
  content: string | null;
  toolCalls: LlmToolCall[];
}

export class LocalLlmError extends Error {}

export async function llmChatCompletion(params: {
  config: LlmConfig;
  messages: LlmMessage[];
  tools?: LlmTool[];
  forceToolName?: string;
  maxTokens?: number;
}): Promise<LlmCompletionResult> {
  const { config, messages, tools, forceToolName, maxTokens } = params;

  if (!config.baseUrl.trim()) {
    throw new LocalLlmError("No local LLM configured. Set a base URL in Settings.");
  }

  let response: Response;
  try {
    response = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens ?? 2048,
        ...(tools ? { tools } : {}),
        ...(forceToolName
          ? { tool_choice: { type: "function", function: { name: forceToolName } } }
          : {}),
      }),
    });
  } catch {
    throw new LocalLlmError(
      `Couldn't reach a local LLM at ${config.baseUrl}. Is it running? Check the URL in Settings.`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new LocalLlmError(`Local LLM error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  if (!message) {
    throw new LocalLlmError("The local LLM returned no message.");
  }

  return {
    content: message.content ?? null,
    toolCalls: message.tool_calls ?? [],
  };
}

export function parseToolArguments<T>(call: LlmToolCall): T {
  return JSON.parse(call.function.arguments) as T;
}
