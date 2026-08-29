import { useState } from "react";
import { createSessionAccount, loginWithCode } from "../lib/sessionAuth";

const EMAIL_SUFFIX = "@officequest.mail";

export function SessionScreen() {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [displayName, setDisplayName] = useState("");
  const [emailHandle, setEmailHandle] = useState("");
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createSessionAccount(displayName.trim(), emailHandle.trim());
      setNewCode(result.code);
      setResolvedHandle(result.emailHandle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCode() {
    if (!newCode) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (newCode) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <span className="text-2xl">🎉</span>
          <h1 className="mt-2 text-lg font-semibold text-stone-900">You're in, {displayName}!</h1>
          <p className="mt-1 text-sm text-stone-500">
            Save this code — it's the only way back into this account. There's no email or
            password.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-md bg-stone-100 px-4 py-2 font-mono text-lg font-semibold tracking-widest text-stone-800">
              {newCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(newCode).catch(() => {});
                setCopyLabel("Copied!");
                setTimeout(() => setCopyLabel("Copy"), 1500);
              }}
              className="rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              {copyLabel}
            </button>
          </div>
          {resolvedHandle && (
            <p className="mt-3 text-xs text-stone-500">
              Your in-game email:{" "}
              <span className="font-medium text-stone-700">
                {resolvedHandle}
                {EMAIL_SUFFIX}
              </span>
            </p>
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleConfirmCode}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Entering the office…" : "I've saved it — Enter the Office"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <h1 className="text-lg font-semibold text-stone-900">Office Quest</h1>
        </div>

        <div className="mb-4 flex gap-1 rounded-md bg-stone-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("new")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              mode === "new" ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            New Player
          </button>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              mode === "existing" ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            I Have a Code
          </button>
        </div>

        {mode === "new" ? (
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <p className="text-sm text-stone-500">
              Pick a display name and an email handle — no real email or password needed.
              You'll get a code to save. Whether you end up creating a company (Owner) or
              joining one (Employee), setup works the same way.
            </p>
            <input
              type="text"
              placeholder="Display name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex items-center rounded-md border border-stone-300 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
              <input
                type="text"
                placeholder="Email handle (e.g. bsmith)"
                value={emailHandle}
                onChange={(e) => setEmailHandle(e.target.value)}
                className="flex-1 rounded-md px-3 py-2 text-sm focus:outline-none"
              />
              <span className="pr-3 text-xs text-stone-400">{EMAIL_SUFFIX}</span>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Please wait…" : "Start Playing"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <p className="text-sm text-stone-500">Enter the code you saved when you signed up.</p>
            <input
              type="text"
              placeholder="Your code (e.g. AB12CD34)"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Please wait…" : "Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
