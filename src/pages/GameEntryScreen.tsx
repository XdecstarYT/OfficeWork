import { useState } from "react";
import { createSessionAccount, loginWithCode } from "../lib/sessionAuth";
import { createCompany, joinCompany } from "../lib/company";
import { supabase } from "../lib/supabaseClient";

const EMAIL_SUFFIX = "@officequest.mail";

type Step = "choose" | "create-details" | "join-details" | "identity" | "code" | "login";
type Intent = "create" | "join" | null;

export function GameEntryScreen() {
  const [step, setStep] = useState<Step>("choose");
  const [intent, setIntent] = useState<Intent>(null);

  const [gameName, setGameName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [emailHandle, setEmailHandle] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await createSessionAccount(displayName.trim(), emailHandle.trim());
      setGeneratedCode(result.code);
      setResolvedHandle(result.emailHandle);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnterOffice() {
    if (!generatedCode) return;
    setError(null);
    setLoading(true);
    try {
      await loginWithCode(generatedCode);
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error("Signed in, but couldn't find your account.");

      if (intent === "create") {
        await createCompany(gameName.trim(), userId);
      } else if (intent === "join") {
        try {
          await joinCompany(inviteCode, userId);
        } catch (err) {
          // Account exists and is signed in either way - App will fall back
          // to the "join a game" screen so they can retry the code.
          setError(err instanceof Error ? err.message : "Couldn't join that game.");
        }
      }
      // On success (or the join-failure fallback above), App.tsx takes over
      // from here based on the now-authenticated session.
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
      await loginWithCode(loginCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50">
        <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-2xl">🏢</span>
            <h1 className="text-lg font-semibold text-stone-900">Office Quest</h1>
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <Shell>
        <p className="text-sm text-stone-500">Start a new office, or join a friend's.</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setIntent("create");
              setStep("create-details");
            }}
            className="rounded-md bg-emerald-700 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800"
          >
            🏢 Start a New Game
          </button>
          <button
            type="button"
            onClick={() => {
              setIntent("join");
              setStep("join-details");
            }}
            className="rounded-md border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            🔑 Join a Game
          </button>
        </div>
        <button
          type="button"
          onClick={() => setStep("login")}
          className="mt-4 w-full text-center text-xs text-stone-400 hover:text-stone-600"
        >
          Already playing? Log in with your code
        </button>
      </Shell>
    );
  }

  if (step === "create-details") {
    return (
      <Shell>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("identity");
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-stone-500">Name your new game/company. You'll be the Owner.</p>
          <input
            type="text"
            placeholder="Company name (e.g. Northwind Logistics)"
            required
            autoFocus
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Next
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  if (step === "join-details") {
    return (
      <Shell>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep("identity");
          }}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-stone-500">Enter the invite code your friend shared with you.</p>
          <input
            type="text"
            placeholder="Invite code (e.g. AB12CD)"
            required
            autoFocus
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Next
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  if (step === "identity") {
    return (
      <Shell>
        <form onSubmit={handleCreateAccount} className="flex flex-col gap-3">
          <p className="text-sm text-stone-500">
            Now set up your player — a display name and an email handle. No real email or
            password needed.
          </p>
          <input
            type="text"
            placeholder="Display name"
            required
            autoFocus
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(intent === "create" ? "create-details" : "join-details")}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loading ? "Please wait…" : "Create Account"}
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  if (step === "code" && generatedCode) {
    return (
      <Shell>
        <div className="text-center">
          <span className="text-2xl">🎉</span>
          <h2 className="mt-2 text-base font-semibold text-stone-900">You're in, {displayName}!</h2>
          <p className="mt-1 text-sm text-stone-500">
            Save this code — it's the only way back into this account.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-md bg-stone-100 px-4 py-2 font-mono text-lg font-semibold tracking-widest text-stone-800">
              {generatedCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(generatedCode).catch(() => {});
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
            onClick={handleEnterOffice}
            disabled={loading}
            className="mt-6 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading
              ? "Entering the office…"
              : intent === "create"
                ? `I've saved it — Create "${gameName}"`
                : "I've saved it — Join the Game"}
          </button>
        </div>
      </Shell>
    );
  }

  // step === "login"
  return (
    <Shell>
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        <p className="text-sm text-stone-500">Enter the code you saved when you signed up.</p>
        <input
          type="text"
          placeholder="Your code (e.g. AB12CD34)"
          required
          autoFocus
          value={loginCode}
          onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("choose")}
            className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Please wait…" : "Continue"}
          </button>
        </div>
      </form>
    </Shell>
  );
}
