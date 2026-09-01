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
  startCompanyDay,
  endCompanyDay,
  setCareerMode,
  updateCompanyBranding,
} from "../lib/company";
import { assignWork, fetchCompanyDocuments, payoutFor } from "../lib/documents";
import { sendEmailToCoworker } from "../lib/emails";
import { postCorporateUpdate } from "../lib/corporateUpdates";
import { hireNpc, fireNpc, resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { createCustomNpcPersona, deleteCustomNpcPersona, customPersonaToNpcPersona } from "../lib/customNpcPersonas";
import { NPC_PERSONAS, getNpcPersona, type NpcPersona } from "../data/npcs";
import {
  generatePromotionAnnouncement,
  generateNpcPersonaIdea,
  generateCompanyMotto,
} from "../lib/aiClient";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { AssignTaskModal, type AssignTaskDetails } from "../components/AssignTaskModal";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { useNpcWorkAssignment } from "../hooks/useNpcWorkAssignment";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";
import type { LlmConfig } from "../lib/llmConfig";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

const DEPARTMENTS = [
  "Executive",
  "Sales & Marketing",
  "Finance & Accounting",
  "Human Resources",
  "IT & Technical",
  "Operations",
  "Customer Service",
  "Legal & Compliance",
];

interface CompanyPageProps {
  profile: Profile;
  onProfileChanged: () => void;
  llmConfig: LlmConfig;
}

export function CompanyPage({ profile, onProfileChanged, llmConfig }: CompanyPageProps) {
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
  const [editDepartment, setEditDepartment] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bonusTargetId, setBonusTargetId] = useState<string | null>(null);
  const [bonusAmount, setBonusAmount] = useState(50);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [awardingEotm, setAwardingEotm] = useState(false);
  const EOTM_BONUS = 100;
  const [showHire, setShowHire] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [showCreateNpc, setShowCreateNpc] = useState(false);
  const [npcDraftName, setNpcDraftName] = useState("");
  const [npcDraftAvatar, setNpcDraftAvatar] = useState("🤖");
  const [npcDraftTitle, setNpcDraftTitle] = useState("Coworker");
  const [npcDraftLevel, setNpcDraftLevel] = useState(2);
  const [npcDraftCost, setNpcDraftCost] = useState(50);
  const [npcDraftPersonality, setNpcDraftPersonality] = useState("");
  const [npcAiHint, setNpcAiHint] = useState("");
  const [npcAiBusy, setNpcAiBusy] = useState(false);
  const [creatingNpcPersona, setCreatingNpcPersona] = useState(false);
  const [startingDay, setStartingDay] = useState(false);
  const [endingDay, setEndingDay] = useState(false);
  const [togglingCareerMode, setTogglingCareerMode] = useState(false);
  const [emojiDraft, setEmojiDraft] = useState("🏢");
  const [mottoDraft, setMottoDraft] = useState("");
  const [savingBranding, setSavingBranding] = useState(false);
  const [generatingMotto, setGeneratingMotto] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSort, setMemberSort] = useState<"level" | "name" | "money" | "department">("level");
  const [memberDeptFilter, setMemberDeptFilter] = useState("");
  const [npcCompletedCounts, setNpcCompletedCounts] = useState<Record<string, number>>({});
  const { addCustomTemplate } = useCustomTemplates(profile.company_id, profile.id);
  const { npcs, customNpcPersonas, assigningNpc, setAssigningNpc, npcWorking, assignTemplateToNpc, reloadNpcs } =
    useNpcWorkAssignment(profile, llmConfig);

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [c, m, docs] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchCompanyMembers(profile.company_id),
      fetchCompanyDocuments(profile.company_id),
    ]);
    setCompany(c);
    setMembers(m);
    const counts: Record<string, number> = {};
    for (const d of docs) {
      if (d.status === "completed" && d.assigned_to_npc_id) {
        counts[d.assigned_to_npc_id] = (counts[d.assigned_to_npc_id] ?? 0) + 1;
      }
    }
    setNpcCompletedCounts(counts);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  // This page is the primary source for company-shared state (day/career
  // mode/branding, the roster, hired AI coworkers, custom personas) but was
  // never live-subscribed - another member's changes only appeared once you
  // navigated away and back and load() re-ran. Every table load() reads.
  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`company-page-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: `id=eq.${profile.company_id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

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

  async function handleSaveBranding() {
    if (!company) return;
    setSavingBranding(true);
    try {
      await updateCompanyBranding(company.id, {
        emoji: emojiDraft.trim() || "🏢",
        motto: mottoDraft.trim() || null,
      });
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't save company branding.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleGenerateMotto() {
    if (!company) return;
    setGeneratingMotto(true);
    try {
      setMottoDraft(await generateCompanyMotto(company.name, llmConfig));
    } finally {
      setGeneratingMotto(false);
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

  async function handleAwardEmployeeOfMonth() {
    if (!company) return;
    setAwardingEotm(true);
    try {
      const docs = await fetchCompanyDocuments(company.id);
      const completedCounts = new Map<string, number>();
      for (const d of docs) {
        if (d.status === "completed" && d.assigned_to && d.assigned_to !== profile.id) {
          completedCounts.set(d.assigned_to, (completedCounts.get(d.assigned_to) ?? 0) + 1);
        }
      }
      const winnerId = [...completedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!winnerId) {
        setStatusMessage("Nobody else has completed a task yet - nothing to award.");
        setTimeout(() => setStatusMessage(null), 4000);
        return;
      }
      const winner = members.find((m) => m.id === winnerId);
      await awardMoney(winnerId, EOTM_BONUS);
      await postCorporateUpdate({
        companyId: company.id,
        title: "🏅 Employee of the Month",
        body: `Congratulations to ${winner?.display_name ?? "our top performer"} for completing the most work this month! A $${EOTM_BONUS.toFixed(2)} bonus is on its way.`,
        postedBy: profile.id,
      });
      setStatusMessage(`Awarded Employee of the Month to ${winner?.display_name} and posted the news.`);
      setTimeout(() => setStatusMessage(null), 4000);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't award Employee of the Month.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setAwardingEotm(false);
    }
  }

  async function handleHireNpc(personaKey: string, customPersonaId?: string) {
    if (!company) return;
    let persona: NpcPersona | undefined;
    if (customPersonaId) {
      const customRow = customNpcPersonas.find((p) => p.id === customPersonaId);
      if (!customRow) {
        setStatusMessage("That custom persona was just removed - pick another one.");
        setTimeout(() => setStatusMessage(null), 4000);
        return;
      }
      persona = customPersonaToNpcPersona(customRow);
    } else {
      persona = getNpcPersona(personaKey);
    }
    if (!persona) return;
    if (profile.money < persona.hireCost) {
      setStatusMessage(`You need $${persona.hireCost.toFixed(2)} to hire ${persona.name}.`);
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }
    setHiring(true);
    try {
      await awardMoney(profile.id, -persona.hireCost);
      await hireNpc({ companyId: company.id, hiredBy: profile.id, persona, customPersonaId });
      setStatusMessage(`Hired ${persona.name} as ${persona.suggestedTitle}!`);
      setTimeout(() => setStatusMessage(null), 4000);
      setShowHire(false);
      onProfileChanged();
      await Promise.all([load(), reloadNpcs()]);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't hire that coworker.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setHiring(false);
    }
  }

  async function handleFireNpc(npc: CompanyNpcRow) {
    const persona = resolveNpcPersona(npc, customNpcPersonas);
    if (!window.confirm(`Let ${persona?.name ?? "this coworker"} go?`)) return;
    try {
      await fireNpc(npc.id);
      await reloadNpcs();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't let that coworker go.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleGenerateNpcIdea() {
    setNpcAiBusy(true);
    try {
      const idea = await generateNpcPersonaIdea(npcAiHint, llmConfig);
      setNpcDraftName(idea.name);
      setNpcDraftAvatar(idea.avatar);
      setNpcDraftTitle(idea.jobTitle);
      setNpcDraftPersonality(idea.personality);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't reach the AI.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setNpcAiBusy(false);
    }
  }

  async function handleCreateNpcPersona() {
    if (!company || !npcDraftName.trim()) return;
    setCreatingNpcPersona(true);
    try {
      await createCustomNpcPersona({
        companyId: company.id,
        createdBy: profile.id,
        name: npcDraftName.trim(),
        avatar: npcDraftAvatar.trim() || "🤖",
        personality: npcDraftPersonality.trim(),
        jobTitle: npcDraftTitle.trim() || "Coworker",
        level: Math.max(1, npcDraftLevel),
        hireCost: Math.max(0, npcDraftCost),
      });
      setShowCreateNpc(false);
      setNpcDraftName("");
      setNpcDraftAvatar("🤖");
      setNpcDraftTitle("Coworker");
      setNpcDraftLevel(2);
      setNpcDraftCost(50);
      setNpcDraftPersonality("");
      setNpcAiHint("");
      await reloadNpcs();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't create that persona.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setCreatingNpcPersona(false);
    }
  }

  async function handleDeleteNpcPersona(id: string) {
    if (!window.confirm("Delete this custom coworker persona? Anyone already hired stays hired.")) return;
    await deleteCustomNpcPersona(id);
    await reloadNpcs();
  }

  async function handleStartDay() {
    if (!company) return;
    setStartingDay(true);
    try {
      await startCompanyDay(company);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't start the day.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setStartingDay(false);
    }
  }

  async function handleEndDay() {
    if (!company || !company.day_started_at) return;
    setEndingDay(true);
    try {
      const docs = await fetchCompanyDocuments(company.id);
      const since = new Date(company.day_started_at).getTime();
      const completedToday = docs.filter(
        (d) => d.status === "completed" && d.completed_at && new Date(d.completed_at).getTime() >= since,
      );
      const moneyEarned = completedToday.reduce(
        (sum, d) => sum + payoutFor(d, d.template_snapshot as unknown as DocumentTemplate),
        0,
      );
      const counts = new Map<string, number>();
      for (const d of completedToday) {
        if (d.assigned_to) counts.set(d.assigned_to, (counts.get(d.assigned_to) ?? 0) + 1);
      }
      const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topName = topId ? members.find((m) => m.id === topId)?.display_name : null;
      await endCompanyDay(company.id);
      await postCorporateUpdate({
        companyId: company.id,
        title: `📅 Day ${company.current_day} Wrap-Up`,
        body: `${completedToday.length} task${completedToday.length === 1 ? "" : "s"} completed today, $${moneyEarned.toFixed(2)} earned company-wide.${topName ? ` Top performer: ${topName}.` : ""}`,
        postedBy: profile.id,
      });
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't end the day.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setEndingDay(false);
    }
  }

  async function handleAssignNpcWork(template: DocumentTemplate) {
    const message = await assignTemplateToNpc(template);
    if (message) {
      setStatusMessage(message);
      setTimeout(() => setStatusMessage(null), 6000);
    }
    await load();
  }

  async function handleToggleCareerMode() {
    if (!company) return;
    setTogglingCareerMode(true);
    try {
      await setCareerMode(company.id, !company.career_mode);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't update Career Mode.");
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setTogglingCareerMode(false);
    }
  }

  async function handlePromote(m: Profile) {
    const newLevelRaw = window.prompt(
      `Promote ${m.display_name} to what level? (currently ${m.level}, must stay below yours: ${profile.level})`,
      String(Math.min(m.level + 1, profile.level - 1)),
    );
    if (newLevelRaw === null) return;
    const newLevel = Math.max(m.level + 1, Math.min(Number(newLevelRaw), profile.level - 1));
    if (!Number.isFinite(newLevel) || newLevel <= m.level) {
      setStatusMessage("Enter a level higher than their current one.");
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }
    const newTitle = window.prompt("New job title? (leave as-is to keep current)", m.job_title) || m.job_title;
    try {
      await updateMemberRank(m.id, { job_title: newTitle, level: newLevel });
      const announcement = await generatePromotionAnnouncement({
        promoterName: profile.display_name,
        memberName: m.display_name,
        newTitle,
        newLevel,
        config: llmConfig,
      });
      if (company) {
        await sendEmailToCoworker({
          companyId: company.id,
          senderId: profile.id,
          recipientId: m.id,
          subject: "🎉 You've been promoted!",
          body: announcement,
        });
      }
      setStatusMessage(`Promoted ${m.display_name} to ${newTitle} and sent them the news.`);
      setTimeout(() => setStatusMessage(null), 4000);
      await load();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Couldn't promote that member.");
      setTimeout(() => setStatusMessage(null), 4000);
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
    setEditDepartment(m.department ?? "");
  }

  async function saveEdit(memberId: string) {
    // The server also rejects promoting someone at or above your own level
    // (RLS), but clamp here too so the UI never fires a request we know will fail.
    const clampedLevel = Math.max(0, Math.min(editLevel, profile.level - 1));
    try {
      await updateMemberRank(memberId, {
        job_title: editTitle.trim() || "Employee",
        level: clampedLevel,
        department: editDepartment || null,
      });
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
            <h1 className="text-lg font-semibold text-stone-900">
              {company.emoji} {company.name}
            </h1>
            {company.motto && <p className="text-xs italic text-stone-400">"{company.motto}"</p>}
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
                  setEmojiDraft(company.emoji);
                  setMottoDraft(company.motto ?? "");
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
                Emoji &amp; Motto
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={emojiDraft}
                  onChange={(e) => setEmojiDraft(e.target.value)}
                  placeholder="🏢"
                  className="w-14 rounded-md border border-stone-300 px-2 py-2 text-center text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={mottoDraft}
                  onChange={(e) => setMottoDraft(e.target.value)}
                  placeholder="Your company's motto…"
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateMotto}
                  disabled={generatingMotto}
                  className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                >
                  {generatingMotto ? "Thinking…" : "✨ Generate Motto"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={savingBranding}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingBranding ? "Saving…" : "Save"}
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
            <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 p-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">🎯 Career Mode</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Adds an optional milestone track with one-off rewards — built for solo play, but works for
                  any company.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleCareerMode}
                disabled={togglingCareerMode}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  company.career_mode
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "border border-stone-300 text-stone-600 hover:bg-stone-100"
                }`}
              >
                {company.career_mode ? "On" : "Off"}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
              📅 Day {company.current_day}
            </h2>
            <p className="text-xs text-sky-600">
              {company.day_status === "active"
                ? "The workday is underway."
                : company.day_status === "ended"
                  ? "Today has wrapped up — start the next day when you're ready."
                  : "The office hasn't opened yet today."}
            </p>
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-2">
              {company.day_status !== "active" ? (
                <button
                  type="button"
                  onClick={handleStartDay}
                  disabled={startingDay}
                  className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {startingDay ? "Starting…" : "▶ Start Day"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEndDay}
                  disabled={endingDay}
                  className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                >
                  {endingDay ? "Wrapping up…" : "⏹ End Day"}
                </button>
              )}
            </div>
          )}
        </div>

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
              {isOwner && members.length > 1 && (
                <button
                  type="button"
                  onClick={handleAwardEmployeeOfMonth}
                  disabled={awardingEotm}
                  className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-100 disabled:opacity-50"
                >
                  {awardingEotm ? "Awarding…" : "🏅 Employee of the Month"}
                </button>
              )}
            </div>
          </div>

          {members.length > 4 && (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <input
                type="search"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search team…"
                className="min-w-0 flex-1 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <select
                value={memberSort}
                onChange={(e) => setMemberSort(e.target.value as typeof memberSort)}
                className="shrink-0 rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="level">Sort: Level</option>
                <option value="name">Sort: Name</option>
                <option value="money">Sort: Money</option>
                <option value="department">Sort: Department</option>
              </select>
              {new Set(members.map((m) => m.department).filter(Boolean)).size > 0 && (
                <select
                  value={memberDeptFilter}
                  onChange={(e) => setMemberDeptFilter(e.target.value)}
                  className="shrink-0 rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">All departments</option>
                  {[...new Set(members.map((m) => m.department).filter((d): d is string => !!d))].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {members
            .filter((m) => m.display_name.toLowerCase().includes(memberQuery.trim().toLowerCase()))
            .filter((m) => !memberDeptFilter || m.department === memberDeptFilter)
            .slice()
            .sort((a, b) => {
              if (memberSort === "name") return a.display_name.localeCompare(b.display_name);
              if (memberSort === "money") return b.money - a.money;
              if (memberSort === "department") return (a.department ?? "").localeCompare(b.department ?? "");
              return b.level - a.level;
            })
            .map((m) => {
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
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
                      <select
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="rounded border border-stone-300 px-2 py-1 text-xs"
                      >
                        <option value="">No department</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
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
                      {m.department && (
                        <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                          {m.department}
                        </span>
                      )}
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
                        {profile.level - 1 > m.level && (
                          <button
                            type="button"
                            onClick={() => handlePromote(m)}
                            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            🎉 Promote
                          </button>
                        )}
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

        <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-700">
                🤖 AI Coworkers
              </h2>
              <p className="text-xs text-violet-500">
                Hire an AI-powered teammate — email them, or ask them to draft paperwork for you.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHire(true)}
              className="shrink-0 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800"
            >
              + Hire Coworker
            </button>
          </div>

          {npcs.length === 0 ? (
            <p className="text-xs text-violet-400">No AI coworkers hired yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {npcs.map((npc) => {
                const persona = resolveNpcPersona(npc, customNpcPersonas);
                return (
                  <div
                    key={npc.id}
                    className="flex items-center justify-between rounded-md border border-violet-100 bg-white px-3 py-2"
                  >
                    <span className="text-sm text-stone-800">
                      {persona?.avatar ?? "🤖"} <strong>{persona?.name ?? "Unknown"}</strong>{" "}
                      <span className="text-xs text-stone-400">
                        {npc.job_title} · level {npc.level}
                        {npcCompletedCounts[npc.id] > 0 && ` · ✅ ${npcCompletedCounts[npc.id]} completed`}
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setAssigningNpc(npc)}
                        disabled={npcWorking}
                        className="text-xs font-medium text-violet-700 hover:text-violet-900 disabled:opacity-50"
                      >
                        📋 Assign Work
                      </button>
                      {(npc.hired_by === profile.id || isOwner) && (
                        <button
                          type="button"
                          onClick={() => handleFireNpc(npc)}
                          className="text-xs text-stone-400 hover:text-red-600"
                        >
                          Let go
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`Leave ${company.name}? You'll rejoin as a base Employee elsewhere.`)) return;
            await leaveCompany(profile.id);
            onProfileChanged();
          }}
          className="self-start text-xs text-stone-400 hover:text-red-600"
        >
          Leave company
        </button>
      </div>

      {assigningNpc && !npcWorking && (
        <TemplatePickerModal
          title={`What should ${resolveNpcPersona(assigningNpc, customNpcPersonas)?.name ?? "your coworker"} work on?`}
          companyId={profile.company_id}
          onPick={handleAssignNpcWork}
          onClose={() => setAssigningNpc(null)}
        />
      )}

      {npcWorking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="rounded-xl bg-white px-6 py-5 text-sm font-medium text-stone-600 shadow-xl">
            🤖 Working on it…
          </div>
        </div>
      )}

      {assignTargetId && !showBuilder && !pendingTemplate && (
        <TemplatePickerModal
          title={
            assignTargetId === profile.id
              ? "Request work for yourself"
              : `Assign work to ${members.find((m) => m.id === assignTargetId)?.display_name}`
          }
          companyId={profile.company_id}
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
          llmConfig={llmConfig}
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

      {showHire && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowHire(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">🤖 Hire an AI Coworker</h2>
            <p className="mt-1 text-sm text-stone-500">
              You have ${profile.money.toFixed(2)}. Hiring deducts the cost from your own balance.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {NPC_PERSONAS.filter((p) => !npcs.some((n) => n.persona_key === p.key)).map((persona) => (
                <div
                  key={persona.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-stone-200 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-stone-800">
                      {persona.avatar} {persona.name} — {persona.suggestedTitle}
                    </p>
                    <p className="text-xs text-stone-500">{persona.personality}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleHireNpc(persona.key)}
                    disabled={hiring}
                    className="shrink-0 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    Hire (${persona.hireCost})
                  </button>
                </div>
              ))}
              {customNpcPersonas
                .filter((p) => !npcs.some((n) => n.custom_persona_id === p.id))
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-violet-200 bg-violet-50/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-800">
                        {p.avatar} {p.name} — {p.job_title}{" "}
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                          custom
                        </span>
                      </p>
                      <p className="text-xs text-stone-500">{p.personality}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleHireNpc("", p.id)}
                        disabled={hiring}
                        className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                      >
                        Hire (${p.hire_cost})
                      </button>
                      {(p.created_by === profile.id || isOwner) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNpcPersona(p.id)}
                          className="text-xs text-stone-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              {NPC_PERSONAS.every((p) => npcs.some((n) => n.persona_key === p.key)) &&
                customNpcPersonas.every((p) => npcs.some((n) => n.custom_persona_id === p.id)) && (
                  <p className="text-sm text-stone-400">You've hired everyone available!</p>
                )}
            </div>

            {!showCreateNpc ? (
              <button
                type="button"
                onClick={() => setShowCreateNpc(true)}
                className="mt-3 self-start text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                🎨 Create Custom Coworker
              </button>
            ) : (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-violet-200 bg-violet-50/40 p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={npcAiHint}
                    onChange={(e) => setNpcAiHint(e.target.value)}
                    placeholder="Optional idea/hint for the AI…"
                    className="flex-1 rounded-md border border-violet-300 px-2 py-1.5 text-xs focus:border-violet-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateNpcIdea}
                    disabled={npcAiBusy}
                    className="shrink-0 rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    {npcAiBusy ? "Thinking…" : "✨ AI Suggest"}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={npcDraftAvatar}
                    onChange={(e) => setNpcDraftAvatar(e.target.value)}
                    placeholder="🙂"
                    className="w-14 rounded-md border border-stone-300 px-2 py-1.5 text-center text-sm"
                  />
                  <input
                    type="text"
                    value={npcDraftName}
                    onChange={(e) => setNpcDraftName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={npcDraftTitle}
                  onChange={(e) => setNpcDraftTitle(e.target.value)}
                  placeholder="Job title"
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
                <textarea
                  value={npcDraftPersonality}
                  onChange={(e) => setNpcDraftPersonality(e.target.value)}
                  placeholder="Personality / how they write…"
                  rows={2}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <label className="flex flex-1 items-center gap-1 text-xs text-stone-500">
                    Level
                    <input
                      type="number"
                      min={1}
                      value={npcDraftLevel}
                      onChange={(e) => setNpcDraftLevel(Number(e.target.value))}
                      className="w-16 rounded border border-stone-300 px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="flex flex-1 items-center gap-1 text-xs text-stone-500">
                    Hire cost $
                    <input
                      type="number"
                      min={0}
                      value={npcDraftCost}
                      onChange={(e) => setNpcDraftCost(Number(e.target.value))}
                      className="w-20 rounded border border-stone-300 px-2 py-1 text-xs"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateNpc(false)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNpcPersona}
                    disabled={creatingNpcPersona || !npcDraftName.trim()}
                    className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    {creatingNpcPersona ? "Creating…" : "Create Persona"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowHire(false)}
              className="mt-4 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
