/**
 * Chat-completion client with two backends, tried in order:
 *
 * 1. Hosted: the `ai-chat` Supabase Edge Function, which proxies to Groq
 *    using a server-side API key (never shipped to the browser). This is
 *    the primary path - it works for every player with no local setup.
 * 2. Local: any OpenAI-compatible endpoint configured in `config.baseUrl`
 *    (Ollama, LM Studio, llama.cpp's server, ...), used as a fallback if
 *    the hosted function is unreachable or not configured.
 */
import { supabase } from "./supabaseClient";
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

async function hostedChatCompletion(params: {
  messages: LlmMessage[];
  tools?: LlmTool[];
  forceToolName?: string;
  maxTokens?: number;
}): Promise<LlmCompletionResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-chat", { body: params });
    if (error || !data || data.error) return null;
    return { content: data.content ?? null, toolCalls: data.toolCalls ?? [] };
  } catch {
    return null;
  }
}

export async function llmChatCompletion(params: {
  config: LlmConfig;
  messages: LlmMessage[];
  tools?: LlmTool[];
  forceToolName?: string;
  maxTokens?: number;
}): Promise<LlmCompletionResult> {
  const { config, messages, tools, forceToolName, maxTokens } = params;

  const hosted = await hostedChatCompletion({ messages, tools, forceToolName, maxTokens });
  if (hosted) return hosted;

  if (!config.baseUrl.trim()) {
    throw new LocalLlmError("AI is unavailable right now - couldn't reach the hosted service.");
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
    throw new LocalLlmError(`Couldn't reach a local LLM at ${config.baseUrl}. Is it running?`);
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
