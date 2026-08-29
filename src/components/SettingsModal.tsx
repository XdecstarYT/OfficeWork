import { useState } from "react";

interface SettingsModalProps {
  currentKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

export function SettingsModal({ currentKey, onSave, onClose }: SettingsModalProps) {
  const [value, setValue] = useState(currentKey);

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
          Add a free Groq API key to unlock AI Clients: dynamic client requests and live
          negotiation chat. Get one at{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline"
          >
            console.groq.com/keys
          </a>{" "}
          — no payment required.
        </p>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-stone-400">
          Groq API Key
        </label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="gsk_..."
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />

        <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Your key is stored only in this browser's local storage and used only for direct
          calls from your browser to Groq's API. This is fine for a local single-player game,
          but never do this in a real multi-user product — a client-side key can be read by
          anyone with access to this browser.
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
              onSave(value.trim());
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
