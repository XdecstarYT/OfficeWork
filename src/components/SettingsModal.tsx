import { useState } from "react";
import type { LlmConfig } from "../lib/llmConfig";

interface SettingsModalProps {
  currentConfig: LlmConfig;
  onSave: (config: LlmConfig) => void;
  onClose: () => void;
}

export function SettingsModal({ currentConfig, onSave, onClose }: SettingsModalProps) {
  const [baseUrl, setBaseUrl] = useState(currentConfig.baseUrl);
  const [model, setModel] = useState(currentConfig.model);
  const [apiKey, setApiKey] = useState(currentConfig.apiKey);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-stone-900">Settings</h2>
        <p className="mt-1 text-sm text-stone-500">
          AI Clients and email replies use a local LLM you run yourself — no cloud API key.
          Point this at any OpenAI-compatible server: the defaults below match{" "}
          <a
            href="https://ollama.com"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline"
          >
            Ollama
          </a>
          's default setup. LM Studio, llama.cpp's server, and similar tools work too — just
          change the URL and model to match.
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-stone-400">
          Base URL
        </label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434/v1/chat/completions"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-stone-400">
          Model
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="llama3.1"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <p className="mt-1 text-xs text-stone-400">
          Must be a model you've already pulled/loaded that supports tool calling for the best
          results (e.g. Llama 3.1+, Qwen2.5).
        </p>

        <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-stone-400">
          API Key (optional)
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Leave blank unless your server requires one"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Your browser calls this URL directly. If your local LLM server enforces CORS, you may
          need to allow this app's origin (for Ollama, set the <code>OLLAMA_ORIGINS</code>
          environment variable). This also only works while this app itself is served over
          plain HTTP (e.g. your local dev server) — browsers block a page served over HTTPS
          from calling an HTTP address.
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ baseUrl: baseUrl.trim(), model: model.trim(), apiKey: apiKey.trim() });
              onClose();
            }}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
