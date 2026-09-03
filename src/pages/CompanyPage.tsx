import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCompany,
  fetchCompanyMembers,
  updateMemberRank,
  leaveCompany,
  kickMember,
  awardMoney,
  awardXp,
  awardBonusToAll,
  transferMoney,
  renameCompany,
  regenerateInviteCode,
  startCompanyDay,
  endCompanyDay,
  setCareerMode,
  updateCompanyBranding,
  setSalaryPerLevel,
  paySalaries,
  incrementTotalPayrollPaid,
  checkCompanyBadges,
  updateMyBio,
  createSubsidiary,
  fetchSubsidiaries,
} from "../lib/company";
import { randomCompanyName } from "../lib/randomName";
import { fetchMemberMoods, setMyMood } from "../lib/memberMoods";
import { CompanyShoutbox } from "../components/CompanyShoutbox";
import { OrgChart } from "../components/OrgChart";

const MOOD_EMOJIS = ["😊", "😐", "😫", "🔥", "☕", "🎉"];
import {
  fetchCompanyDepartments,
  addCompanyDepartment,
  removeCompanyDepartment,
  type CompanyDepartmentRow,
} from "../lib/departments";
import {
  fetchCompanyReviews,
  createPerformanceReview,
  type PerformanceReviewRow,
} from "../lib/performanceReviews";
import {
  fetchTimeOffRequests,
  requestTimeOff,
  decideTimeOff,
  isOnLeaveToday,
  type TimeOffRequestRow,
} from "../lib/timeOff";
import { assignWork, fetchCompanyDocumentStats, payoutForStat } from "../lib/documents";
import { fetchCompanyEquipment, purchaseEquipment, type CompanyEquipmentRow } from "../lib/equipment";
import { EQUIPMENT_CATALOG, totalPayoutBonusPercent } from "../data/equipment";
import { rollEmployeeEvent } from "../data/employeeEvents";
import { COMPANY_BADGES, getCompanyBadge } from "../data/companyBadges";
import { sendEmailToCoworker } from "../lib/emails";
import { formatMoney } from "../lib/format";
import { postCorporateUpdate } from "../lib/corporateUpdates";
import { hireNpc, fireNpc, resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { createCustomNpcPersona, deleteCustomNpcPersona, customPersonaToNpcPersona } from "../lib/customNpcPersonas";
import { NPC_PERSONAS, getNpcPersona, type NpcPersona } from "../data/npcs";
import {
  generatePromotionAnnouncement,
  generateNpcPersonaIdea,
  generateCompanyMotto,
  generatePerformanceReviewDraft,
} from "../lib/aiClient";
import { accrueInterest } from "../lib/bank";
import { TemplatePickerModal } from "../components/TemplatePickerModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { AssignTaskModal, type AssignTaskDetails } from "../components/AssignTaskModal";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { useNpcWorkAssignment } from "../hooks/useNpcWorkAssignment";
import { downloadCsv } from "../lib/csv";
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

function lastActiveLabel(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === today) return "active today";
  if (dateStr === yesterday) return "active yesterday";
  return `active ${dateStr}`;
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
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A single shared banner is used for every action on this page - without
  // clearing the previous timer, an older action's delayed setStatusMessage(null)
  // could fire after a newer action just set a message, erasing it early.
  const showStatus = useCallback((message: string, ms = 4000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), ms);
  }, []);
  const [bonusTargetId, setBonusTargetId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<Profile | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sending, setSending] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(50);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [awardingEotm, setAwardingEotm] = useState(false);
  const [rollingEmployeeEvent, setRollingEmployeeEvent] = useState(false);
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
  const [salaryDraft, setSalaryDraft] = useState(2);
  const [savingSalary, setSavingSalary] = useState(false);
  const [customDepartments, setCustomDepartments] = useState<CompanyDepartmentRow[]>([]);
  const [newDeptName, setNewDeptName] = useState("");
  const [savingDept, setSavingDept] = useState(false);
  const [memberCompletedCounts, setMemberCompletedCounts] = useState<Record<string, number>>({});
  const [memberOverdueCounts, setMemberOverdueCounts] = useState<Record<string, number>>({});
  const [totalCompletedDocs, setTotalCompletedDocs] = useState(0);
  const [memberMoods, setMemberMoods] = useState<Record<string, string>>({});
  const [savingMood, setSavingMood] = useState(false);
  const [viewingBioFor, setViewingBioFor] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [showOrgChart, setShowOrgChart] = useState(false);
  const [allReviews, setAllReviews] = useState<PerformanceReviewRow[]>([]);
  const [reviewingMember, setReviewingMember] = useState<Profile | null>(null);
  const [reviewRating, setReviewRating] = useState(3);
  const [reviewComments, setReviewComments] = useState("");
  const [draftingReview, setDraftingReview] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewHistoryFor, setShowReviewHistoryFor] = useState<string | null>(null);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequestRow[]>([]);
  const [showRequestTimeOff, setShowRequestTimeOff] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [submittingTimeOff, setSubmittingTimeOff] = useState(false);
  const [generatingMotto, setGeneratingMotto] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberSort, setMemberSort] = useState<"level" | "name" | "money" | "department">("level");
  const [memberDeptFilter, setMemberDeptFilter] = useState("");
  const [npcCompletedCounts, setNpcCompletedCounts] = useState<Record<string, number>>({});
  const [equipment, setEquipment] = useState<CompanyEquipmentRow[]>([]);
  const [buyingEquipment, setBuyingEquipment] = useState<string | null>(null);
  const [summaryCopyLabel, setSummaryCopyLabel] = useState("📋 Copy Summary");
  const [inviteCopyLabel, setInviteCopyLabel] = useState("📤 Copy Invite Message");
  const [subsidiaries, setSubsidiaries] = useState<Company[]>([]);
  const [parentCompany, setParentCompany] = useState<Company | null>(null);
  const [showFoundSubsidiary, setShowFoundSubsidiary] = useState(false);
  const [subDraftName, setSubDraftName] = useState("");
  const [subDraftEmoji, setSubDraftEmoji] = useState("🏢");
  const [foundingSubsidiary, setFoundingSubsidiary] = useState(false);
  const [subCopiedId, setSubCopiedId] = useState<string | null>(null);
  const { addCustomTemplate } = useCustomTemplates(profile.company_id, profile.id);
  const { npcs, customNpcPersonas, assigningNpc, setAssigningNpc, npcWorking, assignTemplateToNpc, reloadNpcs } =
    useNpcWorkAssignment(profile, llmConfig);

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [c, m, docs, depts, reviews, timeOff, equip, moods] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchCompanyMembers(profile.company_id),
      fetchCompanyDocumentStats(profile.company_id),
      fetchCompanyDepartments(profile.company_id),
      fetchCompanyReviews(profile.company_id),
      fetchTimeOffRequests(profile.company_id),
      fetchCompanyEquipment(profile.company_id),
      fetchMemberMoods(profile.company_id),
    ]);
    setCompany(c);
    setMembers(m);
    setCustomDepartments(depts);
    setAllReviews(reviews);
    setTimeOffRequests(timeOff);
    setEquipment(equip);
    setMemberMoods(Object.fromEntries(moods.map((mo) => [mo.member_id, mo.emoji])));
    const npcCounts: Record<string, number> = {};
    const memberCounts: Record<string, number> = {};
    const overdueCounts: Record<string, number> = {};
    const now = new Date().toISOString();
    for (const d of docs) {
      if (d.status === "completed") {
        if (d.assigned_to_npc_id) {
          npcCounts[d.assigned_to_npc_id] = (npcCounts[d.assigned_to_npc_id] ?? 0) + 1;
        } else if (d.assigned_to) {
          memberCounts[d.assigned_to] = (memberCounts[d.assigned_to] ?? 0) + 1;
        }
      } else if (d.assigned_to && d.due_at && d.due_at < now) {
        overdueCounts[d.assigned_to] = (overdueCounts[d.assigned_to] ?? 0) + 1;
      }
    }
    setNpcCompletedCounts(npcCounts);
    setMemberCompletedCounts(memberCounts);
    setMemberOverdueCounts(overdueCounts);
    setTotalCompletedDocs(docs.filter((d) => d.status === "completed").length);
    if (c) {
      const [subs, parent] = await Promise.all([
        fetchSubsidiaries(c.id),
        c.parent_company_id ? fetchCompany(c.parent_company_id) : Promise.resolve(null),
      ]);
      setSubsidiaries(subs);
      setParentCompany(parent);
    }
    setLoading(false);
  }, [profile.company_id]);

  async function handleFoundSubsidiary() {
    if (!company || !subDraftName.trim()) return;
    setFoundingSubsidiary(true);
    try {
      const sub = await createSubsidiary(company.id, subDraftName.trim(), profile.id, subDraftEmoji.trim() || "🏢");
      setSubsidiaries((prev) => [sub, ...prev]);
      setShowFoundSubsidiary(false);
      setSubDraftName("");
      setSubDraftEmoji("🏢");
      showStatus(`Founded "${sub.name}" — invite code ${sub.invite_code}. Share it with whoever will run it.`, 8000);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't found that subsidiary.", 4000);
    } finally {
      setFoundingSubsidiary(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // Checked once per visit to this page (rather than on every load()/realtime
  // refresh) since it's purely a "did we cross a new threshold since last
  // time" check - the RPC is atomic so a second concurrent call from another
  // member's browser just comes back empty, never double-announces a badge.
  useEffect(() => {
    if (!profile.company_id) return;
    checkCompanyBadges()
      .then(async (newBadges) => {
        if (newBadges.length === 0) return;
        for (const key of newBadges) {
          const badge = getCompanyBadge(key);
          if (!badge) continue;
          await postCorporateUpdate({
            companyId: profile.company_id!,
            title: `${badge.emoji} Achievement Unlocked: ${badge.name}`,
            body: `The company just earned the "${badge.name}" badge — ${badge.description}`,
            postedBy: profile.id,
          });
        }
        showStatus(
          `🏅 New achievement${newBadges.length > 1 ? "s" : ""} unlocked: ${newBadges
            .map((k) => getCompanyBadge(k)?.name ?? k)
            .join(", ")}!`,
          6000,
        );
        await load();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.company_id]);

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

  function memberLevelFor(memberId: string): number {
    return members.find((m) => m.id === memberId)?.level ?? Infinity;
  }

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
    showStatus(isSelfRequest ? `Requested "${title}" for yourself.` : `Assigned "${title}".`, 4000);
  }

  async function handleKick(memberId: string) {
    const target = members.find((m) => m.id === memberId);
    try {
      await kickMember(memberId);
      setConfirmKickId(null);
      showStatus(`Removed ${target?.display_name ?? "that member"} from the company.`, 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't remove that member.", 4000);
    }
  }

  async function handleAwardBonus(memberId: string, amount: number) {
    const target = members.find((m) => m.id === memberId);
    try {
      await awardMoney(memberId, amount);
      setBonusTargetId(null);
      showStatus(`Gave ${target?.display_name ?? "that member"} a $${amount.toFixed(2)} bonus.`, 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't award that bonus.", 4000);
    }
  }

  async function handleSendMoney() {
    if (!sendTarget || !company) return;
    const amount = Number(sendAmount);
    setSending(true);
    try {
      await transferMoney(sendTarget.id, amount);
      // The receipt is a normal in-game email, so the recipient finds out the
      // same way they find out about everything else.
      await sendEmailToCoworker({
        companyId: company.id,
        senderId: profile.id,
        recipientId: sendTarget.id,
        subject: `💸 ${profile.display_name} sent you $${amount.toFixed(2)}`,
        body: sendNote.trim()
          ? `${sendNote.trim()}\n\n— ${profile.display_name}`
          : `No note attached.\n\n— ${profile.display_name}`,
      }).catch(() => {});
      showStatus(`Sent $${amount.toFixed(2)} to ${sendTarget.display_name}.`, 4000);
      setSendTarget(null);
      setSendAmount("");
      setSendNote("");
      onProfileChanged();
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't send that.", 4000);
    } finally {
      setSending(false);
    }
  }

  async function handleAwardBonusToAll(amount: number) {
    if (!company) return;
    try {
      const count = await awardBonusToAll(company.id, profile.id, profile.level, amount);
      showStatus(`Gave a $${amount.toFixed(2)} bonus to ${count} member${count === 1 ? "" : "s"}.`, 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't award company-wide bonus.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't rename the company.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't save company branding.", 4000);
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleSaveSalary() {
    if (!company) return;
    setSavingSalary(true);
    try {
      await setSalaryPerLevel(company.id, Math.max(0, salaryDraft));
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't save the salary rate.", 4000);
    } finally {
      setSavingSalary(false);
    }
  }

  async function handleAddDepartment() {
    if (!company || !newDeptName.trim()) return;
    setSavingDept(true);
    try {
      await addCompanyDepartment(company.id, profile.id, newDeptName.trim());
      setNewDeptName("");
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't add that department.", 4000);
    } finally {
      setSavingDept(false);
    }
  }

  async function handleRemoveDepartment(id: string) {
    if (!window.confirm("Remove this department? Members already assigned to it keep the label.")) return;
    await removeCompanyDepartment(id);
    await load();
  }

  async function handlePurchaseEquipment(itemKey: string) {
    if (!company) return;
    const item = EQUIPMENT_CATALOG.find((e) => e.key === itemKey);
    if (!item) return;
    if (profile.money < item.cost) {
      showStatus(`Not enough Money to buy the ${item.name}.`, 4000);
      return;
    }
    setBuyingEquipment(itemKey);
    try {
      await awardMoney(profile.id, -item.cost);
      await purchaseEquipment(company.id, itemKey, profile.id);
      showStatus(`Purchased ${item.emoji} ${item.name} — every payout is now +${totalPayoutBonusPercent([...equipment.map((e) => e.item_key), itemKey])}% company-wide.`, 5000);
      onProfileChanged();
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't complete that purchase.", 4000);
    } finally {
      setBuyingEquipment(null);
    }
  }

  function openReviewFor(m: Profile) {
    setReviewingMember(m);
    setReviewRating(3);
    setReviewComments("");
  }

  async function handleGenerateReviewDraft() {
    if (!reviewingMember) return;
    setDraftingReview(true);
    try {
      setReviewComments(
        await generatePerformanceReviewDraft({
          memberName: reviewingMember.display_name,
          jobTitle: reviewingMember.job_title,
          rating: reviewRating,
          tasksCompleted: memberCompletedCounts[reviewingMember.id] ?? 0,
          moneyEarned: reviewingMember.money,
          config: llmConfig,
        }),
      );
    } finally {
      setDraftingReview(false);
    }
  }

  async function handleSubmitReview() {
    if (!company || !reviewingMember) return;
    setSubmittingReview(true);
    try {
      await createPerformanceReview({
        companyId: company.id,
        memberId: reviewingMember.id,
        reviewerId: profile.id,
        rating: reviewRating,
        comments: reviewComments.trim(),
      });
      showStatus(`Review submitted for ${reviewingMember.display_name}.`, 4000);
      setReviewingMember(null);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't submit that review.", 4000);
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleRequestTimeOff() {
    if (!company || !timeOffStart || !timeOffEnd) return;
    setSubmittingTimeOff(true);
    try {
      await requestTimeOff({
        companyId: company.id,
        memberId: profile.id,
        startDate: timeOffStart,
        endDate: timeOffEnd,
        reason: timeOffReason.trim(),
      });
      setShowRequestTimeOff(false);
      setTimeOffStart("");
      setTimeOffEnd("");
      setTimeOffReason("");
      showStatus("Time off requested — your manager will review it.", 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't submit that request.", 4000);
    } finally {
      setSubmittingTimeOff(false);
    }
  }

  async function handleDecideTimeOff(id: string, status: "approved" | "denied") {
    await decideTimeOff(id, status, profile.id);
    await load();
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
      showStatus(err instanceof Error ? err.message : "Couldn't regenerate the invite code.", 4000);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAwardEmployeeOfMonth() {
    if (!company) return;
    setAwardingEotm(true);
    try {
      const docs = await fetchCompanyDocumentStats(company.id);
      const completedCounts = new Map<string, number>();
      for (const d of docs) {
        if (d.status === "completed" && d.assigned_to && d.assigned_to !== profile.id) {
          completedCounts.set(d.assigned_to, (completedCounts.get(d.assigned_to) ?? 0) + 1);
        }
      }
      const winnerId = [...completedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!winnerId) {
        showStatus("Nobody else has completed a task yet - nothing to award.", 4000);
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
      showStatus(`Awarded Employee of the Month to ${winner?.display_name} and posted the news.`, 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't award Employee of the Month.", 4000);
    } finally {
      setAwardingEotm(false);
    }
  }

  async function handleRollEmployeeEvent() {
    if (!company || members.length === 0) return;
    setRollingEmployeeEvent(true);
    try {
      const target = members[Math.floor(Math.random() * members.length)];
      const event = rollEmployeeEvent();
      if (event.money !== 0) await awardMoney(target.id, event.money);
      if (event.xp !== 0) await awardXp(target.id, event.xp);
      const effectLine =
        event.money !== 0 || event.xp !== 0
          ? `\n\n(${event.money !== 0 ? `${event.money > 0 ? "+" : ""}$${event.money} money` : ""}${
              event.money !== 0 && event.xp !== 0 ? ", " : ""
            }${event.xp !== 0 ? `${event.xp > 0 ? "+" : ""}${event.xp} XP` : ""}.)`
          : "";
      await sendEmailToCoworker({
        companyId: company.id,
        senderId: profile.id,
        recipientId: target.id,
        subject: `${event.emoji} ${event.headline}`,
        body: `${event.body}${effectLine}`,
      });
      showStatus(`${event.emoji} "${event.headline}" happened to ${target.display_name} — they got an email about it.`, 5000);
      if (target.id === profile.id) onProfileChanged();
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't trigger an employee event.", 4000);
    } finally {
      setRollingEmployeeEvent(false);
    }
  }

  async function handleHireNpc(personaKey: string, customPersonaId?: string) {
    if (!company) return;
    let persona: NpcPersona | undefined;
    if (customPersonaId) {
      const customRow = customNpcPersonas.find((p) => p.id === customPersonaId);
      if (!customRow) {
        showStatus("That custom persona was just removed - pick another one.", 4000);
        return;
      }
      persona = customPersonaToNpcPersona(customRow);
    } else {
      persona = getNpcPersona(personaKey);
    }
    if (!persona) return;
    if (profile.money < persona.hireCost) {
      showStatus(`You need $${persona.hireCost.toFixed(2)} to hire ${persona.name}.`, 4000);
      return;
    }
    setHiring(true);
    try {
      await awardMoney(profile.id, -persona.hireCost);
      await hireNpc({ companyId: company.id, hiredBy: profile.id, persona, customPersonaId });
      showStatus(`Hired ${persona.name} as ${persona.suggestedTitle}!`, 4000);
      setShowHire(false);
      onProfileChanged();
      await Promise.all([load(), reloadNpcs()]);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't hire that coworker.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't let that coworker go.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't reach the AI.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't create that persona.", 4000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't start the day.", 4000);
    } finally {
      setStartingDay(false);
    }
  }

  async function handleEndDay() {
    if (!company || !company.day_started_at) return;
    setEndingDay(true);
    try {
      const docs = await fetchCompanyDocumentStats(company.id);
      const since = new Date(company.day_started_at).getTime();
      const completedToday = docs.filter(
        (d) => d.status === "completed" && d.completed_at && new Date(d.completed_at).getTime() >= since,
      );
      const moneyEarned = completedToday.reduce(
        (sum, d) => sum + payoutForStat(d),
        0,
      );
      const counts = new Map<string, number>();
      for (const d of completedToday) {
        if (d.assigned_to) counts.set(d.assigned_to, (counts.get(d.assigned_to) ?? 0) + 1);
      }
      const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topName = topId ? members.find((m) => m.id === topId)?.display_name : null;
      const payroll = await paySalaries(members, company.salary_per_level);
      if (payroll > 0) await incrementTotalPayrollPaid(company.id, payroll, company.total_payroll_paid);
      // Loans compound on the day boundary rather than on read, so the balance
      // a borrower sees on the Bank page is the balance they actually owe.
      const interestCharged = await accrueInterest(company.id, company.current_day);
      await endCompanyDay(company.id);
      await postCorporateUpdate({
        companyId: company.id,
        title: `📅 Day ${company.current_day} Wrap-Up`,
        body: `${completedToday.length} task${completedToday.length === 1 ? "" : "s"} completed today, $${moneyEarned.toFixed(2)} earned company-wide.${topName ? ` Top performer: ${topName}.` : ""}${payroll > 0 ? ` 💵 $${payroll.toFixed(2)} in salaries paid out.` : ""}${interestCharged > 0 ? ` 🏦 $${interestCharged.toFixed(2)} in loan interest accrued.` : ""}`,
        postedBy: profile.id,
      });

      // A bonus "week in review" post every 7th Day, aggregating real-world
      // last-7-days activity rather than in-game days (the latter can span
      // very different amounts of real time depending on how often the
      // company plays).
      if (company.current_day % 7 === 0) {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const completedThisWeek = docs.filter(
          (d) => d.status === "completed" && d.completed_at && new Date(d.completed_at).getTime() >= weekAgo,
        );
        const weekMoney = completedThisWeek.reduce(
          (sum, d) => sum + payoutForStat(d),
          0,
        );
        const weekCounts = new Map<string, number>();
        for (const d of completedThisWeek) {
          if (d.assigned_to) weekCounts.set(d.assigned_to, (weekCounts.get(d.assigned_to) ?? 0) + 1);
        }
        const weekTopId = [...weekCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const weekTopName = weekTopId ? members.find((m) => m.id === weekTopId)?.display_name : null;
        await postCorporateUpdate({
          companyId: company.id,
          title: `🗓 Week in Review — Day ${company.current_day - 6}–${company.current_day}`,
          body: `${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} completed this week, $${weekMoney.toFixed(2)} earned company-wide.${weekTopName ? ` This week's top performer: ${weekTopName}.` : ""}`,
          postedBy: profile.id,
          category: "announcement",
        });
      }

      onProfileChanged();
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't end the day.", 4000);
    } finally {
      setEndingDay(false);
    }
  }

  async function handleAssignNpcWork(template: DocumentTemplate) {
    const message = await assignTemplateToNpc(template);
    if (message) {
      showStatus(message, 6000);
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
      showStatus(err instanceof Error ? err.message : "Couldn't update Career Mode.", 4000);
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
      showStatus("Enter a level higher than their current one.", 4000);
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
      showStatus(`Promoted ${m.display_name} to ${newTitle} and sent them the news.`, 4000);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't promote that member.", 4000);
    }
  }

  async function handleNudge(m: Profile) {
    if (!company) return;
    const count = memberOverdueCounts[m.id] ?? 0;
    try {
      await sendEmailToCoworker({
        companyId: company.id,
        senderId: profile.id,
        recipientId: m.id,
        subject: "👋 Friendly nudge",
        body: `Hey ${m.display_name} — just a heads up, you've got ${count} overdue task${count === 1 ? "" : "s"} waiting in My Work. No pressure, just didn't want it to slip through the cracks!\n\n— ${profile.display_name}`,
      });
      showStatus(`Nudged ${m.display_name} about their overdue work.`, 4000);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't send that nudge.", 4000);
    }
  }

  async function handleSetMood(emoji: string) {
    if (!profile.company_id) return;
    setSavingMood(true);
    try {
      await setMyMood(profile.id, profile.company_id, emoji);
      setMemberMoods((prev) => ({ ...prev, [profile.id]: emoji }));
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't set your mood.", 4000);
    } finally {
      setSavingMood(false);
    }
  }

  async function handleSaveBio() {
    setSavingBio(true);
    try {
      await updateMyBio(profile.id, bioDraft);
      setEditingBio(false);
      await load();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Couldn't save your bio.", 4000);
    } finally {
      setSavingBio(false);
    }
  }

  function openBuilderFor(targetId: string) {
    setAssignTargetId(targetId);
    setShowBuilder(true);
  }

  function handleExportRoster() {
    if (!company) return;
    downloadCsv(
      "team-roster.csv",
      [
        ["Name", "Title", "Level", "Department", "Money", "Streak", "Overdue"],
        ...members.map((m) => [
          m.display_name,
          m.job_title,
          m.level,
          m.department ?? "",
          m.money.toFixed(2),
          m.streak_count,
          memberOverdueCounts[m.id] ?? 0,
        ]),
      ],
    );
  }

  function handleCopySummary() {
    if (!company) return;
    const text = [
      `${company.emoji} ${company.name}`,
      company.motto ? `"${company.motto}"` : null,
      `${members.length} member${members.length === 1 ? "" : "s"} · Day ${company.current_day} · ${totalCompletedDocs} documents completed`,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
    setSummaryCopyLabel("Copied!");
    setTimeout(() => setSummaryCopyLabel("📋 Copy Summary"), 1500);
  }

  function handleCopyInviteMessage() {
    if (!company) return;
    const text = `Join ${company.name} on Office Quest! Use invite code ${company.invite_code} to sign up.`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setInviteCopyLabel("Copied!");
    setTimeout(() => setInviteCopyLabel("📤 Copy Invite Message"), 1500);
  }

  function handleResetBranding() {
    if (!window.confirm("Reset the company emoji and motto to the defaults?")) return;
    setEmojiDraft("🏢");
    setMottoDraft("");
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
      showStatus(err instanceof Error ? err.message : "Couldn't update that member's rank.", 4000);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading company…</div>;
  }

  if (!company) {
    return <div className="flex-1 p-6 text-sm text-stone-400">No company found.</div>;
  }

  const isOwner = company.owner_id === profile.id;
  const allDepartmentNames = [...new Set([...DEPARTMENTS, ...customDepartments.map((d) => d.name)])];

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
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              {summaryCopyLabel}
            </button>
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
                  setSalaryDraft(company.salary_per_level);
                  setShowSettings((s) => !s);
                }}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                ⚙️ Settings
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowFoundSubsidiary(true)}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                🏢 Found Subsidiary
              </button>
            )}
          </div>
        </div>

        {parentCompany && (
          <p className="text-xs text-stone-400">
            ⬆ Part of{" "}
            <span className="font-medium text-stone-600">
              {parentCompany.emoji} {parentCompany.name}
            </span>
          </p>
        )}

        {subsidiaries.length > 0 && (
          <section className="flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              🏢 Subsidiaries ({subsidiaries.length})
            </h2>
            <div className="flex flex-col gap-1.5">
              {subsidiaries.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-indigo-100 bg-white px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-stone-800">
                      {sub.emoji} {sub.name}
                    </span>
                    <span className="ml-1.5 text-xs text-stone-400">
                      Day {sub.current_day} · {sub.company_badges_claimed.length} badge
                      {sub.company_badges_claimed.length === 1 ? "" : "s"}
                      {sub.total_payroll_paid > 0 && ` · $${sub.total_payroll_paid.toFixed(2)} paid out`}
                    </span>
                  </span>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(sub.invite_code).catch(() => {});
                        setSubCopiedId(sub.id);
                        setTimeout(() => setSubCopiedId(null), 1500);
                      }}
                      className="shrink-0 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                    >
                      {subCopiedId === sub.id ? "Copied!" : `🔑 ${sub.invite_code}`}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-indigo-500">
              Subsidiaries are full, independent companies — join one with its invite code the same way you'd join any
              game.
            </p>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
            {company.company_badges_claimed.map((key) => {
              const badge = getCompanyBadge(key);
              if (!badge) return null;
              return (
                <span
                  key={key}
                  title={badge.description}
                  className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                >
                  {badge.emoji} {badge.name}
                </span>
              );
            })}
            {COMPANY_BADGES.filter((b) => !company.company_badges_claimed.includes(b.key)).map((badge) => (
              <span
                key={badge.key}
                title={`Locked — ${badge.description}`}
                className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-400"
              >
                🔒 {badge.name}
              </span>
            ))}
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-stone-500">
          <span>
            💰 ${members.reduce((sum, m) => sum + m.money, 0).toFixed(2)} total team money
          </span>
          <span>
            📈 avg level{" "}
            {members.length > 0 ? (members.reduce((sum, m) => sum + m.level, 0) / members.length).toFixed(1) : "0"}
          </span>
          {members.some((m) => m.streak_count > 0) && (
            <span>🔥 best streak {Math.max(...members.map((m) => m.streak_count))} days</span>
          )}
          {timeOffRequests.some((r) => isOnLeaveToday(timeOffRequests, r.member_id)) && (
            <span>🌴 {new Set(members.filter((m) => isOnLeaveToday(timeOffRequests, m.id)).map((m) => m.id)).size} on leave today</span>
          )}
        </div>

        {(() => {
          const nextBadge = COMPANY_BADGES.filter((b) => !company.company_badges_claimed.includes(b.key)).sort(
            (a, b) => a.threshold - b.threshold,
          )[0];
          if (!nextBadge) return null;
          const pct = Math.min(100, Math.round((totalCompletedDocs / nextBadge.threshold) * 100));
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <span>
                  Progress to {nextBadge.emoji} {nextBadge.name}
                </span>
                <span>
                  {totalCompletedDocs} / {nextBadge.threshold} documents
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}

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
                  onClick={handleResetBranding}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  ↺ Reset
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
              <div className="mt-1 flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
                  onClick={handleCopyInviteMessage}
                  className="rounded-md border border-stone-300 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  {inviteCopyLabel}
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Regenerating invalidates the old code — anyone who hasn't joined yet will need the
                new one.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                💵 Payroll — salary per level, paid to everyone when a Day ends
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={salaryDraft}
                  onChange={(e) => setSalaryDraft(Number(e.target.value))}
                  className="w-24 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleSaveSalary}
                  disabled={savingSalary}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingSalary ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                $0 turns payroll off. A level-5 member earns 5× this per Day ended.
                {company.total_payroll_paid > 0 && (
                  <> All-time payroll paid: <strong>${company.total_payroll_paid.toFixed(2)}</strong>.</>
                )}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-stone-400">
                🏷 Custom Departments
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {allDepartmentNames.map((d) => {
                  const customRow = customDepartments.find((cd) => cd.name === d);
                  return (
                    <span
                      key={d}
                      className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
                    >
                      {d}
                      {customRow && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDepartment(customRow.id)}
                          className="text-stone-400 hover:text-red-600"
                          aria-label={`Remove ${d}`}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="New department name…"
                  className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  disabled={savingDept || !newDeptName.trim()}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingDept ? "Adding…" : "Add"}
                </button>
              </div>
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
              <button
                type="button"
                onClick={() => setShowRequestTimeOff(true)}
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                🌴 Request Time Off
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
              {isOwner && members.length > 0 && (
                <button
                  type="button"
                  onClick={handleRollEmployeeEvent}
                  disabled={rollingEmployeeEvent}
                  className="rounded-md border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
                >
                  {rollingEmployeeEvent ? "Rolling…" : "🎲 Random Employee Event"}
                </button>
              )}
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowOrgChart((s) => !s)}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  🗂 {showOrgChart ? "Hide" : "Show"} Org Chart
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleExportRoster}
                  className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  ⬇ Export Roster
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span>Today's mood:</span>
            {MOOD_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleSetMood(emoji)}
                disabled={savingMood}
                className={`rounded-full px-1.5 py-0.5 text-sm hover:bg-stone-100 ${
                  memberMoods[profile.id] === emoji ? "bg-stone-200" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {showOrgChart && (
            <div className="rounded-md border border-stone-100 bg-stone-50 p-4">
              <OrgChart members={members} ownerId={company.owner_id} />
            </div>
          )}

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
                    {isOnLeaveToday(timeOffRequests, m.id) && (
                      <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        🌴 On Leave
                      </span>
                    )}
                    {memberMoods[m.id] && (
                      <span className="ml-1.5" title="Today's mood">
                        {memberMoods[m.id]}
                      </span>
                    )}
                    {(memberOverdueCounts[m.id] ?? 0) > 0 && (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        ⏰ {memberOverdueCounts[m.id]} overdue
                      </span>
                    )}
                    {m.streak_count > 1 && (
                      <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                        🔥 {m.streak_count}d streak
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewingBioFor(m.id)}
                      title="View bio"
                      className="ml-1.5 text-[10px] text-stone-300 hover:text-stone-500"
                    >
                      ℹ️
                    </button>
                  </p>
                  {lastActiveLabel(m.last_active_date) && (
                    <p className="text-[11px] text-stone-400">{lastActiveLabel(m.last_active_date)}</p>
                  )}
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
                        {allDepartmentNames.map((d) => (
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
                      {m.job_title} · level {m.level} · {formatMoney(m.money)}
                      {m.department && (
                        <button
                          type="button"
                          onClick={() => setMemberDeptFilter(m.department ?? "")}
                          title={`Filter team by ${m.department}`}
                          className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 hover:bg-stone-200"
                        >
                          {m.department}
                        </button>
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
                        <button
                          type="button"
                          onClick={() => openReviewFor(m)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          📝 Review
                        </button>
                        {(memberOverdueCounts[m.id] ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => handleNudge(m)}
                            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            👋 Nudge
                          </button>
                        )}
                      </>
                    )}
                    {m.id !== profile.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setSendTarget(m);
                          setSendAmount("");
                          setSendNote("");
                        }}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        💸 Send Money
                      </button>
                    )}
                    {allReviews.some((r) => r.member_id === m.id) && (
                      <button
                        type="button"
                        onClick={() => setShowReviewHistoryFor(m.id)}
                        className="rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100"
                      >
                        {allReviews.filter((r) => r.member_id === m.id).length} review
                        {allReviews.filter((r) => r.member_id === m.id).length === 1 ? "" : "s"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {company && <CompanyShoutbox companyId={company.id} profile={profile} members={members} />}

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

        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">
              🛒 Office Shop{" "}
              <span className="font-normal normal-case text-amber-500">
                ({equipment.length}/{EQUIPMENT_CATALOG.length} owned)
              </span>
            </h2>
            <p className="text-xs text-amber-600">
              One-time purchases that permanently boost everyone's task payouts, company-wide.
              {equipment.length > 0 && (
                <>
                  {" "}
                  Currently{" "}
                  <strong>+{totalPayoutBonusPercent(equipment.map((e) => e.item_key))}%</strong> on every payout.
                </>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {EQUIPMENT_CATALOG.map((item) => {
              const owned = equipment.some((e) => e.item_key === item.key);
              return (
                <div
                  key={item.key}
                  className={`flex flex-col gap-1 rounded-md border p-3 ${
                    owned ? "border-amber-300 bg-amber-100/60" : "border-amber-100 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-stone-800">
                      {item.emoji} {item.name}
                    </span>
                    <span className="text-xs font-semibold text-amber-700">+{item.payoutBonusPercent}%</span>
                  </div>
                  <p className="text-xs text-stone-500">{item.description}</p>
                  {owned ? (
                    <span className="mt-1 text-xs font-medium text-amber-700">✅ Owned</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePurchaseEquipment(item.key)}
                      disabled={buyingEquipment === item.key}
                      className="mt-1 self-start rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {buyingEquipment === item.key ? "Buying…" : `Buy for $${item.cost}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(timeOffRequests.some((r) => r.member_id === profile.id) ||
          timeOffRequests.some((r) => r.status === "pending" && profile.level > memberLevelFor(r.member_id))) && (
          <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-700">
              🌴 Time Off
              {timeOffRequests.filter((r) => r.status === "pending" && profile.level > memberLevelFor(r.member_id)).length > 0 && (
                <span className="ml-1.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium normal-case text-sky-700">
                  {timeOffRequests.filter((r) => r.status === "pending" && profile.level > memberLevelFor(r.member_id)).length} pending
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-1.5">
              {timeOffRequests
                .filter(
                  (r) =>
                    r.member_id === profile.id ||
                    (r.status === "pending" && profile.level > memberLevelFor(r.member_id)),
                )
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-100 bg-white px-3 py-2 text-sm"
                  >
                    <span>
                      {members.find((m) => m.id === r.member_id)?.display_name ?? "Someone"} · {r.start_date} to{" "}
                      {r.end_date}
                      {r.reason && <span className="text-stone-400"> — {r.reason}</span>}
                    </span>
                    {r.status === "pending" && profile.level > memberLevelFor(r.member_id) ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecideTimeOff(r.id, "approved")}
                          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecideTimeOff(r.id, "denied")}
                          className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.status === "denied"
                              ? "bg-red-100 text-red-700"
                              : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {r.status}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

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

      {showFoundSubsidiary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowFoundSubsidiary(false)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">🏢 Found a Subsidiary</h2>
            <p className="mt-1 text-xs text-stone-500">
              Creates a brand-new, fully independent company linked under {company.name}. You'll stay put here — hand
              the invite code to whoever will run it.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={subDraftEmoji}
                onChange={(e) => setSubDraftEmoji(e.target.value)}
                placeholder="🏢"
                className="w-14 rounded-md border border-stone-300 px-2 py-2 text-center text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={subDraftName}
                onChange={(e) => setSubDraftName(e.target.value)}
                placeholder="Subsidiary name"
                autoFocus
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setSubDraftName(randomCompanyName())}
                title="Suggest a name"
                className="shrink-0 rounded-md border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100"
              >
                🎲
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFoundSubsidiary(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFoundSubsidiary}
                disabled={foundingSubsidiary || !subDraftName.trim()}
                className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {foundingSubsidiary ? "Founding…" : "Found It"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRequestTimeOff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowRequestTimeOff(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">🌴 Request Time Off</h2>
            <div className="mt-3 flex gap-2">
              <label className="flex-1 text-xs text-stone-500">
                From
                <input
                  type="date"
                  value={timeOffStart}
                  onChange={(e) => setTimeOffStart(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
              <label className="flex-1 text-xs text-stone-500">
                To
                <input
                  type="date"
                  value={timeOffEnd}
                  onChange={(e) => setTimeOffEnd(e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>
            <textarea
              value={timeOffReason}
              onChange={(e) => setTimeOffReason(e.target.value)}
              placeholder="Reason (optional)…"
              rows={2}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRequestTimeOff(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestTimeOff}
                disabled={submittingTimeOff || !timeOffStart || !timeOffEnd}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submittingTimeOff ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {reviewingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setReviewingMember(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">📝 Review {reviewingMember.display_name}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {memberCompletedCounts[reviewingMember.id] ?? 0} task
              {(memberCompletedCounts[reviewingMember.id] ?? 0) === 1 ? "" : "s"} completed · $
              {reviewingMember.money.toFixed(2)}
            </p>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className={`text-2xl leading-none ${n <= reviewRating ? "text-amber-500" : "text-stone-200"}`}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Comments…"
              rows={4}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-3 flex justify-between gap-2">
              <button
                type="button"
                onClick={handleGenerateReviewDraft}
                disabled={draftingReview}
                className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              >
                {draftingReview ? "Thinking…" : "✨ AI Draft"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingMember(null)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {submittingReview ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReviewHistoryFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setShowReviewHistoryFor(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">
              Review history — {members.find((m) => m.id === showReviewHistoryFor)?.display_name}
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {allReviews
                .filter((r) => r.member_id === showReviewHistoryFor)
                .map((r) => (
                  <div key={r.id} className="rounded-md border border-stone-100 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                      <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-700">{r.comments}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      — {members.find((m) => m.id === r.reviewer_id)?.display_name ?? "A manager"}
                    </p>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setShowReviewHistoryFor(null)}
              className="mt-4 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {viewingBioFor &&
        (() => {
          const bioMember = members.find((m) => m.id === viewingBioFor);
          if (!bioMember) return null;
          const isMe = bioMember.id === profile.id;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
              onClick={() => {
                setViewingBioFor(null);
                setEditingBio(false);
              }}
            >
              <div
                className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-stone-900">
                  ℹ️ About {bioMember.display_name}
                </h2>
                {editingBio ? (
                  <>
                    <textarea
                      rows={4}
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      maxLength={280}
                      placeholder="A sentence or two about yourself…"
                      className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBio(false)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBio}
                        disabled={savingBio}
                        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {savingBio ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm text-stone-600">
                      {bioMember.bio || (isMe ? "You haven't written a bio yet." : "No bio yet.")}
                    </p>
                    <div className="mt-4 flex justify-end gap-2">
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => {
                            setBioDraft(bioMember.bio ?? "");
                            setEditingBio(true);
                          }}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingBioFor(null)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

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
              You have {formatMoney(profile.money)}. Hiring deducts the cost from your own balance.
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

      {sendTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setSendTarget(null)}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">💸 Send money to {sendTarget.display_name}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {sendTarget.job_title} · you have {formatMoney(profile.money)}
            </p>

            <label className="mt-4 block text-xs font-medium text-stone-500" htmlFor="send-amount">
              Amount
            </label>
            <input
              id="send-amount"
              type="number"
              min="0"
              step="1"
              autoFocus
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[10, 25, 50, 100].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  disabled={amount > profile.money}
                  onClick={() => setSendAmount(String(amount))}
                  className="rounded-full border border-stone-300 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                >
                  ${amount}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-xs font-medium text-stone-500" htmlFor="send-note">
              Note (optional)
            </label>
            <input
              id="send-note"
              type="text"
              placeholder="Thanks for covering the audit"
              value={sendNote}
              onChange={(e) => setSendNote(e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-stone-400">They get an email receipt either way.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendTarget(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sending || !(Number(sendAmount) > 0) || Number(sendAmount) > profile.money}
                onClick={handleSendMoney}
                aria-label="Send money"
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
