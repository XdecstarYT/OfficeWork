export interface LlmConfig {
  /** Full chat-completions endpoint URL, OpenAI-compatible. */
  baseUrl: string;
  model: string;
  /** Most local servers ignore this; kept for setups that do check a key. */
  apiKey: string;
}

// Ollama's OpenAI-compatible endpoint, the most common local LLM setup.
// Works the same way for LM Studio, llama.cpp's server, etc. - just run one
// on this machine with a model that supports tool calling (e.g. Llama 3.1+).
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: "http://localhost:11434/v1/chat/completions",
  model: "llama3.1",
  apiKey: "",
};
