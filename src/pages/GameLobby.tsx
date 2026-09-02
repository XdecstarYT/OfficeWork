import { useCallback, useEffect, useState } from "react";
import {
  fetchCompanyMembers,
  fetchInviteCodes,
  createInviteCode,
  deleteInviteCode,
  startCompany,
  leaveCompany,
  type CompanyInviteCode,
} from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface GameLobbyProps {
  profile: Profile;
  company: Company;
  onProfileChanged: () => void;
  onStarted: () => void;
}

function CopyCode({ code, label }: { code: string; label: string }) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  return (
    <div className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</span>
      <span className="font-mono text-sm font-semibold tracking-widest text-stone-800">{code}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(code).catch(() => {});
          setCopyLabel("Copied!");
          setTimeout(() => setCopyLabel("Copy"), 1500);
        }}
        className="ml-auto shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        {copyLabel}
      </button>
    </div>
  );
}

export function GameLobby({ profile, company, onProfileChanged, onStarted }: GameLobbyProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [inviteCodes, setInviteCodes] = useState<CompanyInviteCode[]>([]);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newLevel, setNewLevel] = useState(1);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [inviteMsgCopied, setInviteMsgCopied] = useState(false);

  const COMMON_JOB_TITLES = ["Manager", "Team Lead", "Analyst", "Coordinator", "Specialist", "Associate"];

  const isOwner = profile.id === company.owner_id;

  const load = useCallback(async () => {
    const [m, codes] = await Promise.all([
      fetchCompanyMembers(company.id),
      isOwner ? fetchInviteCodes(company.id) : Promise.resolve([]),
    ]);
    setMembers(m);
    setInviteCodes(codes);
  }, [company.id, isOwner]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`lobby-${company.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `company_id=eq.${company.id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_invite_codes",
          filter: `company_id=eq.${company.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [company.id, load]);

  async function handleCreateCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clampedLevel = Math.max(0, Math.min(newLevel, profile.level - 1));
    setCreating(true);
    try {
      await createInviteCode({
        companyId: company.id,
        jobTitle: newJobTitle.trim() || "Employee",
        level: clampedLevel,
        createdBy: profile.id,
      });
      setNewJobTitle("");
      setNewLevel(1);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that code.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await startCompany(company.id);
      // Don't rely solely on the realtime subscription picking this up -
      // refresh directly so the owner's own click always works immediately.
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the game.");
      setStarting(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏢</span>
          <div>
            <h1 className="text-lg font-semibold text-stone-900">{company.name}</h1>
            <p className="text-xs text-stone-400">Waiting room — not started yet</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <CopyCode code={company.invite_code} label="Main Code" />
          <p className="text-xs text-stone-400">
            Anyone with this code can join as an Employee. Share it with friends.
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(`Join ${company.name} on Office Quest! Use invite code ${company.invite_code} to sign up.`)
                .catch(() => {});
              setInviteMsgCopied(true);
              setTimeout(() => setInviteMsgCopied(false), 1500);
            }}
            className="self-start text-xs font-medium text-stone-500 hover:text-stone-700"
          >
            {inviteMsgCopied ? "Copied!" : "📤 Copy shareable invite message"}
          </button>
        </div>

        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Players ({members.length})
          </h2>
          <div className="mt-2 flex flex-col gap-1">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-1.5 text-sm"
              >
                <span className="text-stone-800">
                  {m.id === company.owner_id && "👑 "}
                  {m.display_name} {m.id === profile.id && <span className="text-stone-400">(you)</span>}
                </span>
                <span className="text-xs text-stone-400">{m.job_title}</span>
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Sub Codes — invite with a specific role
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Create a code that assigns a job title and rank the moment someone joins with it.
            </p>

            {inviteCodes.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {inviteCodes.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md bg-white px-3 py-1.5 text-sm shadow-sm"
                  >
                    <div>
                      <span className="font-mono font-semibold tracking-widest text-stone-800">
                        {c.code}
                      </span>
                      <span className="ml-2 text-xs text-stone-400">
                        {c.job_title} · level {c.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(c.code).catch(() => {});
                          setCopiedCodeId(c.id);
                          setTimeout(() => setCopiedCodeId(null), 1500);
                        }}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        {copiedCodeId === c.id ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInviteCode(c.id).then(load)}
                        className="text-xs text-stone-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleCreateCode} className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-stone-500">Job title</label>
                <input
                  type="text"
                  list="lobby-job-titles"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. Manager"
                  className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <datalist id="lobby-job-titles">
                  {COMMON_JOB_TITLES.map((title) => (
                    <option key={title} value={title} />
                  ))}
                </datalist>
              </div>
              <div className="w-20">
                <label className="text-xs font-medium text-stone-500">Level</label>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, profile.level - 1)}
                  value={newLevel}
                  onChange={(e) => setNewLevel(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="shrink-0 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create Code"}
              </button>
            </form>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Leave this waiting room?")) return;
              await leaveCompany(profile.id);
              onProfileChanged();
            }}
            className="text-xs text-stone-400 hover:text-red-600"
          >
            Leave game
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded-md bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {starting ? "Starting…" : "🚀 Start Game"}
            </button>
          ) : (
            <p className="text-sm text-stone-400">Waiting for the boss to start the game…</p>
          )}
        </div>
      </div>
    </div>
  );
}
