import { useCallback, useEffect, useState } from "react";
import { fetchCompany, fetchCompanyMembers, updateMemberRank, leaveCompany } from "../lib/company";
import { assignWork } from "../lib/documents";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface CompanyPageProps {
  profile: Profile;
  onProfileChanged: () => void;
}

export function CompanyPage({ profile, onProfileChanged }: CompanyPageProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copyLabel, setCopyLabel] = useState("Copy Code");
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLevel, setEditLevel] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { addCustomTemplate } = useCustomTemplates();

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [c, m] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchCompanyMembers(profile.company_id),
    ]);
    setCompany(c);
    setMembers(m);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAssign(template: DocumentTemplate) {
    if (!company || !assignTargetId) return;
    const isSelfRequest = assignTargetId === profile.id;
    await assignWork({
      companyId: company.id,
      template,
      createdBy: profile.id,
      assignedTo: assignTargetId,
      isSelfRequest,
    });
    setAssignTargetId(null);
    setShowBuilder(false);
    setStatusMessage(
      isSelfRequest ? `Requested "${template.title}" for yourself.` : `Assigned "${template.title}".`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
  }

  function openBuilderFor(targetId: string) {
    setAssignTargetId(targetId);
    setShowBuilder(true);
  }

  function startEdit(m: Profile) {
    setEditingId(m.id);
    setEditTitle(m.job_title);
    setEditLevel(m.level);
  }

  async function saveEdit(memberId: string) {
    // The server also rejects promoting someone at or above your own level
    // (RLS), but clamp here too so the UI never fires a request we know will fail.
    const clampedLevel = Math.max(0, Math.min(editLevel, profile.level - 1));
    try {
      await updateMemberRank(memberId, { job_title: editTitle.trim() || "Employee", level: clampedLevel });
      setEditingId(null);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't update that member's rank.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading company…</div>;
  }

  if (!company) {
    return <div className="flex-1 p-6 text-sm text-stone-400">No company found.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">{company.name}</h1>
            <p className="text-sm text-stone-500">
              {members.length} member{members.length === 1 ? "" : "s"} · You are{" "}
              <strong>{profile.job_title}</strong> (level {profile.level})
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(company.invite_code).catch(() => {});
              setCopyLabel("Copied!");
              setTimeout(() => setCopyLabel("Copy Code"), 1500);
            }}
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            🔑 Invite Code: {company.invite_code} · {copyLabel}
          </button>
        </div>

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{statusMessage}</div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Team</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssignTargetId(profile.id)}
                className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
              >
                📋 Request Work for Myself
              </button>
              <button
                type="button"
                onClick={() => openBuilderFor(profile.id)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                🧩 Build Custom Task
              </button>
            </div>
          </div>

          {members.map((m) => {
            const isMe = m.id === profile.id;
            const iOutrank = profile.level > m.level;
            const isEditing = editingId === m.id;
            return (
              <div
                key={m.id}
                className="flex flex-col gap-2 rounded-md border border-stone-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    {m.display_name} {isMe && <span className="text-stone-400">(you)</span>}
                  </p>
                  {isEditing ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-32 rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        max={profile.level - 1}
                        value={editLevel}
                        onChange={(e) => setEditLevel(Number(e.target.value))}
                        className="w-16 rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(m.id)}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      {m.job_title} · level {m.level}
                    </p>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex gap-2">
                    {iOutrank && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          Edit Rank
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignTargetId(m.id)}
                          className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
                        >
                          Assign Work
                        </button>
                        <button
                          type="button"
                          onClick={() => openBuilderFor(m.id)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          🧩 Custom
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={async () => {
            await leaveCompany(profile.id);
            onProfileChanged();
          }}
          className="self-start text-xs text-stone-400 hover:text-red-600"
        >
          Leave company
        </button>
      </div>

      {assignTargetId && !showBuilder && (
        <TemplatePickerModal
          title={
            assignTargetId === profile.id
              ? "Request work for yourself"
              : `Assign work to ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          onPick={handleAssign}
          onClose={() => setAssignTargetId(null)}
        />
      )}

      {assignTargetId && showBuilder && (
        <TemplateBuilder
          heading={
            assignTargetId === profile.id
              ? "🧩 Build a Custom Task for Yourself"
              : `🧩 Build a Custom Task for ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          primaryLabel={assignTargetId === profile.id ? "Request for Myself" : "Assign This Task"}
          onClose={() => {
            setAssignTargetId(null);
            setShowBuilder(false);
          }}
          onSaveTemplate={addCustomTemplate}
          onFillOutNow={handleAssign}
        />
      )}
    </div>
  );
}
