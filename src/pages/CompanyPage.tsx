import { useCallback, useEffect, useState } from "react";
import {
  fetchCompany,
  fetchCompanyMembers,
  updateMemberRank,
  leaveCompany,
  kickMember,
  awardMoney,
  awardBonusToAll,
  renameCompany,
  regenerateInviteCode,
} from "../lib/company";
import { assignWork } from "../lib/documents";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { AssignTaskModal, type AssignTaskDetails } from "../components/AssignTaskModal";
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
  const [pendingTemplate, setPendingTemplate] = useState<DocumentTemplate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLevel, setEditLevel] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bonusTargetId, setBonusTargetId] = useState<string | null>(null);
  const [bonusAmount, setBonusAmount] = useState(50);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);
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

  function reviewTaskDetails(template: DocumentTemplate) {
    setPendingTemplate(template);
  }

  async function handleConfirmAssign(details: AssignTaskDetails) {
    if (!company || !assignTargetId || !pendingTemplate) return;
    const isSelfRequest = assignTargetId === profile.id;
    await assignWork({
      companyId: company.id,
      template: pendingTemplate,
      createdBy: profile.id,
      assignedTo: assignTargetId,
      isSelfRequest,
      ...details,
    });
    const title = pendingTemplate.title;
    setAssignTargetId(null);
    setShowBuilder(false);
    setPendingTemplate(null);
    setStatusMessage(
      isSelfRequest ? `Requested "${title}" for yourself.` : `Assigned "${title}".`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
  }

  async function handleKick(memberId: string) {
    const target = members.find((m) => m.id === memberId);
    try {
      await kickMember(memberId);
      setConfirmKickId(null);
      setStatusMessage(`Removed ${target?.display_name ?? "that member"} from the company.`);
      setTimeout(() => setStatusMessage(null), 4000);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't remove that member.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleAwardBonus(memberId: string, amount: number) {
    const target = members.find((m) => m.id === memberId);
    try {
      await awardMoney(memberId, amount);
      setBonusTargetId(null);
      setStatusMessage(`Gave ${target?.display_name ?? "that member"} a $${amount.toFixed(2)} bonus.`);
      setTimeout(() => setStatusMessage(null), 4000);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't award that bonus.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleAwardBonusToAll(amount: number) {
    if (!company) return;
    try {
      const count = await awardBonusToAll(company.id, profile.id, profile.level, amount);
      setStatusMessage(`Gave a $${amount.toFixed(2)} bonus to ${count} member${count === 1 ? "" : "s"}.`);
      setTimeout(() => setStatusMessage(null), 4000);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't award company-wide bonus.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleRename() {
    if (!company || !nameDraft.trim() || nameDraft.trim() === company.name) {
      setShowSettings(false);
      return;
    }
    try {
      await renameCompany(company.id, nameDraft.trim());
      setShowSettings(false);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't rename the company.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleRegenerateCode() {
    if (!company) return;
    if (!window.confirm("Regenerate the main invite code? The old code will stop working.")) return;
    setRegenerating(true);
    try {
      await regenerateInviteCode(company.id);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't regenerate the invite code.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setRegenerating(false);
    }
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

  const isOwner = company.owner_id === profile.id;

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
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(company.invite_code).catch(() => {});
                setCopyLabel("Copied!");
                setTimeout(() => setCopyLabel("Copy Code"), 1500);
              }}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              🔑 Invite Code: {company.invite_code} · {copyLabel}
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(company.name);
                  setShowSettings((s) => !s);
                }}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                ⚙️ Settings
              </button>
            )}
          </div>
        </div>

        {showSettings && isOwner && (
          <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              Company Settings
            </h2>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                Company Name
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleRename}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                Main Invite Code
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700">
                  {company.invite_code}
                </span>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  disabled={regenerating}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  {regenerating ? "Regenerating…" : "🔄 Regenerate"}
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Regenerating invalidates the old code — anyone who hasn't joined yet will need the
                new one.
              </p>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{statusMessage}</div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">Team</h2>
            <div className="flex flex-wrap gap-2">
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
              {members.some((m) => profile.level > m.level) && (
                <button
                  type="button"
                  onClick={() => {
                    const amount = Number(
                      window.prompt("Bonus amount for every member you outrank?", "50"),
                    );
                    if (amount > 0) handleAwardBonusToAll(amount);
                  }}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  💰 Bonus Everyone
                </button>
              )}
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
                      {m.job_title} · level {m.level} · ${m.money.toFixed(2)}
                    </p>
                  )}
                  {bonusTargetId === m.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(Number(e.target.value))}
                        className="w-20 rounded border border-stone-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAwardBonus(m.id, bonusAmount)}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                      >
                        Give Bonus
                      </button>
                      <button
                        type="button"
                        onClick={() => setBonusTargetId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {confirmKickId === m.id && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-red-700">Remove {m.display_name} from the company?</span>
                      <button
                        type="button"
                        onClick={() => handleKick(m.id)}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Confirm Kick
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmKickId(null)}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
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
                        <button
                          type="button"
                          onClick={() => {
                            setBonusTargetId(m.id);
                            setConfirmKickId(null);
                          }}
                          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          💰 Bonus
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmKickId(m.id);
                            setBonusTargetId(null);
                          }}
                          className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          🚪 Kick
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

      {assignTargetId && !showBuilder && !pendingTemplate && (
        <TemplatePickerModal
          title={
            assignTargetId === profile.id
              ? "Request work for yourself"
              : `Assign work to ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          onPick={reviewTaskDetails}
          onClose={() => setAssignTargetId(null)}
        />
      )}

      {assignTargetId && showBuilder && !pendingTemplate && (
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
          onFillOutNow={reviewTaskDetails}
        />
      )}

      {pendingTemplate && (
        <AssignTaskModal
          template={pendingTemplate}
          targetLabel={
            assignTargetId === profile.id
              ? "yourself"
              : (members.find((m) => m.id === assignTargetId)?.display_name ?? "them")
          }
          isSelfRequest={assignTargetId === profile.id}
          onClose={() => setPendingTemplate(null)}
          onConfirm={handleConfirmAssign}
        />
      )}
    </div>
  );
}
