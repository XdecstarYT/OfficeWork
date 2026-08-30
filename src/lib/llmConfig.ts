export interface LlmConfig {
  /** Full chat-completions endpoint URL, OpenAI-compatible. */
  baseUrl: string;
  model: string;
  /** Most local servers ignore this; kept for setups that do check a key. */
  apiKey: string;
}

const STORAGE_KEY = "officequest.llmConfig";

// Ollama's OpenAI-compatible endpoint, the most common local LLM setup.
// Works the same way for LM Studio, llama.cpp's server, etc. - just point
// baseUrl at whatever that server exposes and set the model it has loaded.
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: "http://localhost:11434/v1/chat/completions",
  model: "llama3.1",
  apiKey: "",
};

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LLM_CONFIG };
    return { ...DEFAULT_LLM_CONFIG, ...(JSON.parse(raw) as Partial<LlmConfig>) };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

export function saveLlmConfig(config: LlmConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore storage failures
  }
}
