import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelProject,
  completeProject,
  createProject,
  fetchProjects,
  projectProgress,
  setDocumentProject,
  type ProjectProgress,
  type ProjectRow,
} from "../lib/projects";
import { fetchCompanyDocumentStats, type DocumentStatRow } from "../lib/documents";
import { fetchCompanyMembers } from "../lib/company";
import { postCorporateUpdate } from "../lib/corporateUpdates";
import { formatMoney as money } from "../lib/format";
import type { Database } from "../types/database";
import { Toast } from "../components/Toast";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface ProjectsPageProps {
  profile: Profile;
  company: Company;
  onProfileChanged: () => void;
  onCompanyChanged: () => void;
}

const EMOJI_CHOICES = ["📁", "🚀", "🏗", "🧾", "⚖️", "🔬", "🎯", "🌍", "🧩", "🏆"];

export function ProjectsPage({ profile, company, onProfileChanged, onCompanyChanged }: ProjectsPageProps) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [docs, setDocs] = useState<DocumentStatRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [taggingFor, setTaggingFor] = useState<ProjectRow | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [target, setTarget] = useState("5");
  const [pool, setPool] = useState("0");
  const [dueDay, setDueDay] = useState("");

  const isOwner = company.owner_id === profile.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, d, m] = await Promise.all([
        fetchProjects(company.id),
        fetchCompanyDocumentStats(company.id),
        fetchCompanyMembers(company.id),
      ]);
      setProjects(p);
      setDocs(d);
      setMembers(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load projects.");
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  const progressById = useMemo(
    () => new Map(projects.map((p) => [p.id, projectProgress(p, docs)] as const)),
    [projects, docs],
  );

  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status !== "active");

  function memberName(id: string): string {
    if (id === profile.id) return "You";
    return members.find((m) => m.id === id)?.display_name ?? "A coworker";
  }

  function showStatus(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      await createProject({
        companyId: company.id,
        name: name.trim(),
        description: description.trim() || null,
        emoji,
        targetDocuments: Math.max(1, Number(target) || 1),
        bonusPool: Math.max(0, Number(pool) || 0),
        dueDay: dueDay ? Number(dueDay) : null,
        createdBy: profile.id,
        currentTreasury: company.treasury,
      });
      setShowCreate(false);
      setName("");
      setDescription("");
      setPool("0");
      setDueDay("");
      showStatus(`${emoji} "${name.trim()}" is open for business.`);
      await load();
      onCompanyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(progress: ProjectProgress) {
    setBusy(true);
    setError(null);
    try {
      const payouts = await completeProject(progress);
      const summary = payouts.length
        ? payouts.map((p) => `${memberName(p.memberId)} ${money(p.amount)}`).join(", ")
        : "no bonus pool to split";
      showStatus(`${progress.project.emoji} "${progress.project.name}" delivered — ${summary}.`);
      await postCorporateUpdate({
        companyId: company.id,
        title: `${progress.project.emoji} Project delivered: ${progress.project.name}`,
        body: `${progress.done} document${progress.done === 1 ? "" : "s"} completed.${
          payouts.length ? ` Bonus pool of ${money(progress.project.bonus_pool)} split: ${summary}.` : ""
        }`,
        postedBy: profile.id,
        category: "announcement",
      });
      await load();
      onProfileChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't close that project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(project: ProjectRow) {
    setBusy(true);
    setError(null);
    try {
      await cancelProject(project, company.treasury);
      showStatus(
        project.bonus_pool > 0
          ? `Cancelled — ${money(project.bonus_pool)} returned to the treasury.`
          : "Project cancelled.",
      );
      await load();
      onCompanyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel that project.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTag(documentId: string, projectId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await setDocumentProject(documentId, projectId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't file that document.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Pulling the project files…</div>;
  }

  // Anything not already filed under this project, newest first.
  const taggable = taggingFor ? docs.filter((d) => d.project_id !== taggingFor.id).slice(0, 40) : [];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🚩 Projects</h1>
            <p className="text-sm text-stone-500">
              Group work into an initiative with a target and a bonus pool. Day {company.current_day} ·
              🏛 {money(company.treasury)} in the treasury
            </p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              + New Project
            </button>
          )}
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {active.length === 0 && (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            {isOwner
              ? "No projects running. Open one to give the team a shared target."
              : "No projects running — your owner can open one."}
          </p>
        )}

        {active.map((p) => {
          const progress = progressById.get(p.id);
          if (!progress) return null;
          const overdue = p.due_day != null && company.current_day > p.due_day;
          return (
            <section
              key={p.id}
              className={`rounded-lg border p-4 ${
                progress.ready ? "border-emerald-300 bg-emerald-50" : overdue ? "border-red-300 bg-red-50" : "border-stone-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-stone-900">
                    {p.emoji} {p.name}
                  </h2>
                  {p.description && <p className="mt-0.5 text-xs text-stone-500">{p.description}</p>}
                </div>
                <span className="shrink-0 text-right text-xs text-stone-500">
                  {p.bonus_pool > 0 && <span className="block font-medium text-emerald-700">💰 {money(p.bonus_pool)} pool</span>}
                  {p.due_day != null && (
                    <span className={overdue ? "text-red-600" : ""}>
                      due Day {p.due_day}
                      {overdue && " — late"}
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full ${progress.ready ? "bg-emerald-600" : "bg-stone-500"}`}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {progress.done} of {p.target_documents} complete
                {progress.tagged > progress.done && ` · ${progress.tagged - progress.done} still in flight`}
              </p>

              {progress.contributors.length > 0 && (
                <p className="mt-1 text-xs text-stone-400">
                  {progress.contributors.map((c) => `${memberName(c.memberId)} ×${c.done}`).join(" · ")}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTaggingFor(p)}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                >
                  📎 File work under this
                </button>
                {isOwner && progress.ready && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleComplete(progress)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    ✅ Deliver & pay out
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleCancel(p)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-400 hover:bg-stone-100 hover:text-red-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {closed.length > 0 && (
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">📦 Closed</h2>
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className="text-xs font-medium text-stone-500 hover:text-stone-800"
              >
                {showClosed ? "Hide" : "Show"} {closed.length}
              </button>
            </div>
            {showClosed && (
              <ul className="mt-2 flex flex-col gap-1">
                {closed.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
                    <span className="text-stone-700">
                      {p.emoji} {p.name}
                    </span>
                    <span className="text-xs text-stone-400">
                      {p.status === "completed" ? `delivered · ${money(p.bonus_pool)} paid` : "cancelled"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">New project</h2>
            <p className="mt-1 text-xs text-stone-500">
              The bonus pool is taken from the treasury now and split between contributors when you deliver.
            </p>

            <label className="mt-4 text-xs font-medium text-stone-500">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q3 Compliance Sweep"
              className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            <label className="mt-3 text-xs font-medium text-stone-500">What's it for? (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

            <label className="mt-3 text-xs font-medium text-stone-500">Icon</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`h-9 w-9 rounded-md border text-lg ${emoji === e ? "border-emerald-500 bg-emerald-50" : "border-stone-200 hover:bg-stone-50"}`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500">Documents</label>
                <input
                  type="number"
                  min="1"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500">Bonus pool</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pool}
                  onChange={(e) => setPool(e.target.value)}
                  className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-medium text-stone-500">Due Day</label>
                <input
                  type="number"
                  min={company.current_day}
                  placeholder="—"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="mt-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-stone-400">Treasury: {money(company.treasury)} available.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={handleCreate}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busy ? "Opening…" : "Open project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {taggingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={() => setTaggingFor(null)}>
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">
              File work under {taggingFor.emoji} {taggingFor.name}
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Already-completed documents count toward the target the moment you file them.
            </p>
            <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {taggable.length === 0 && <li className="p-4 text-center text-sm text-stone-400">Nothing left to file.</li>}
              {taggable.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 border-b border-stone-100 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                    {d.status === "completed" ? "✅" : "🕗"} {d.title}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTag(d.id, taggingFor.id)}
                    className="shrink-0 rounded-md border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                  >
                    File it
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setTaggingFor(null)}
              className="mt-3 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <Toast message={status} onDismiss={() => setStatus(null)} />
    </div>
  );
}
