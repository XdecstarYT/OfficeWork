import { useState } from "react";
import { createCompany, joinCompany } from "../lib/company";
import { signOut } from "../lib/auth";

interface CompanyGateProps {
  userId: string;
  onDone: () => void;
}

export function CompanyGate({ userId, onDone }: CompanyGateProps) {
  const [mode, setMode] = useState<"create" | "join" | "solo">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "create") {
        await createCompany(name.trim(), userId);
      } else if (mode === "solo") {
        await createCompany(name.trim() || "My Office", userId, { started: true });
      } else {
        await joinCompany(code, userId);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-stone-900">Join an Office</h1>
        <p className="mt-1 text-sm text-stone-500">
          Create a new company, join one with an invite code, or play solo.
        </p>

        <div className="mt-4 flex gap-1 rounded-md bg-stone-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              mode === "create" ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              mode === "join" ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            Join with Code
          </button>
          <button
            type="button"
            onClick={() => setMode("solo")}
            className={`flex-1 rounded px-3 py-1.5 font-medium transition-colors ${
              mode === "solo" ? "bg-white shadow-sm" : "text-stone-500"
            }`}
          >
            🧍 Solo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {mode === "join" ? (
            <input
              type="text"
              placeholder="Invite code (e.g. AB12CD)"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          ) : (
            <input
              type="text"
              placeholder={mode === "solo" ? "Office name (optional)" : "Company name"}
              required={mode === "create"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}
          {mode === "solo" && (
            <p className="text-xs text-stone-400">
              No waiting room, no invite code needed - you can still share one later if you want
              friends to join.
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "create"
                ? "Create Company"
                : mode === "solo"
                  ? "Start Playing"
                  : "Join Company"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 text-xs text-stone-400 hover:text-stone-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
