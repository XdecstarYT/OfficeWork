import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
export type CompanyInviteCode = Database["public"]["Tables"]["company_invite_codes"]["Row"];

const OWNER_LEVEL = 100;
const DEFAULT_EMPLOYEE_LEVEL = 1;

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function createCompany(
  name: string,
  ownerId: string,
  options?: { started?: boolean },
): Promise<Company> {
  const invite_code = generateInviteCode();
  const { data: company, error } = await supabase
    .from("companies")
    .insert({ name, invite_code, owner_id: ownerId, ...(options?.started ? { started: true } : {}) })
    .select()
    .single();
  if (error) throw error;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ company_id: company.id, job_title: "Owner", level: OWNER_LEVEL })
    .eq("id", ownerId);
  if (profileError) throw profileError;

  return company;
}

/**
 * Founds a subsidiary under an existing company - a fully independent
 * company (its own invite code, roster, day counter, everything) linked
 * back to its parent for display purposes. Unlike createCompany, this does
 * NOT move the caller into it: the founding owner stays put in their
 * current company and simply owns this new one too (RLS's `companies_select`
 * already lets an owner see companies they own regardless of membership).
 * Whoever will actually run it joins later with the generated invite code.
 */
export async function createSubsidiary(
  parentCompanyId: string,
  name: string,
  ownerId: string,
  emoji: string,
): Promise<Company> {
  const invite_code = generateInviteCode();
  const { data: company, error } = await supabase
    .from("companies")
    .insert({ name, invite_code, owner_id: ownerId, parent_company_id: parentCompanyId, emoji })
    .select()
    .single();
  if (error) throw error;
  return company;
}

export async function fetchSubsidiaries(parentCompanyId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("parent_company_id", parentCompanyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Resolves a main invite_code or a role-granting sub code via a security-definer
 * RPC (the joining user has no company_id yet, so RLS alone can't let them read
 * the companies/company_invite_codes rows directly to find out where to go).
 */
export async function joinCompany(code: string, userId: string): Promise<Company> {
  const { data, error } = await supabase.rpc("resolve_invite_code", { p_code: code.trim() });
  if (error) throw error;
  const match = data?.[0];
  if (!match) throw new Error("No game found with that code.");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ company_id: match.company_id, job_title: match.job_title, level: match.level })
    .eq("id", userId);
  if (profileError) throw profileError;

  const company = await fetchCompany(match.company_id);
  if (!company) throw new Error("Joined, but couldn't load the game.");
  return company;
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  return data;
}

export async function renameCompany(companyId: string, name: string) {
  const { error } = await supabase.from("companies").update({ name }).eq("id", companyId);
  if (error) throw error;
}

export async function updateCompanyBranding(companyId: string, updates: { emoji?: string; motto?: string | null }) {
  const { error } = await supabase.from("companies").update(updates).eq("id", companyId);
  if (error) throw error;
}

export async function regenerateInviteCode(companyId: string): Promise<string> {
  const invite_code = generateInviteCode();
  const { error } = await supabase.from("companies").update({ invite_code }).eq("id", companyId);
  if (error) throw error;
  return invite_code;
}

export async function startCompany(companyId: string) {
  // .select().single() so a 0-row update (RLS silently blocked it - not the
  // owner, wrong id) throws instead of looking like a no-op success.
  const { data, error } = await supabase
    .from("companies")
    .update({ started: true })
    .eq("id", companyId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchInviteCodes(companyId: string): Promise<CompanyInviteCode[]> {
  const { data, error } = await supabase
    .from("company_invite_codes")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createInviteCode(params: {
  companyId: string;
  jobTitle: string;
  level: number;
  createdBy: string;
  label?: string;
}): Promise<CompanyInviteCode> {
  const { companyId, jobTitle, level, createdBy, label } = params;
  const { data, error } = await supabase
    .from("company_invite_codes")
    .insert({
      company_id: companyId,
      code: generateInviteCode(),
      job_title: jobTitle,
      level,
      created_by: createdBy,
      ...(label ? { label } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInviteCode(id: string) {
  const { error } = await supabase.from("company_invite_codes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCompanyMembers(companyId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("company_id", companyId)
    .order("level", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateMemberRank(
  memberId: string,
  updates: { job_title?: string; level?: number; department?: string | null },
) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", memberId);
  if (error) throw error;
}

export async function updateMyBio(userId: string, bio: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ bio: bio.trim() || null })
    .eq("id", userId);
  if (error) throw error;
}

/** Bumps the caller's daily activity streak - call once per Dashboard visit.
 * Same calendar day: no-op. The very next day: streak+1. Any bigger gap:
 * resets to 1. Returns the resulting streak so the caller can render it
 * immediately without waiting on a refetch. */
export async function touchActivityStreak(
  userId: string,
  lastActiveDate: string | null,
  currentStreak: number,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  if (lastActiveDate === today) return currentStreak;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const nextStreak = lastActiveDate === yesterday ? currentStreak + 1 : 1;
  const { error } = await supabase
    .from("profiles")
    .update({ last_active_date: today, streak_count: nextStreak })
    .eq("id", userId);
  if (error) throw error;
  return nextStreak;
}

/**
 * Credits `amount` to userId's money. Allowed by RLS when userId is the
 * caller themselves (self-serve completion) or a coworker the caller
 * outranks (manager approving someone else's submission).
 */
export async function awardMoney(userId: string, amount: number) {
  const { data: current, error: fetchError } = await supabase
    .from("profiles")
    .select("money")
    .eq("id", userId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("profiles")
    .update({ money: current.money + amount })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Credits `amount` Career XP - a separate, non-spendable progression track
 * from Money. Same RLS rules as awardMoney (self, or a manager crediting a
 * subordinate they outrank).
 */
/**
 * Sends money to a coworker. Goes through a SECURITY DEFINER RPC: RLS only
 * lets you update a profile you strictly outrank, so a peer transfer can't be
 * expressed as a policy - and doing it as two client writes would let a
 * tampered client post the credit without the debit. The function takes the
 * money from the caller, checks both sides share a company, and locks the
 * sender's row so two tabs can't spend the same balance.
 *
 * Returns the sender's new balance.
 */
export async function transferMoney(recipientId: string, amount: number): Promise<number> {
  const { data, error } = await supabase.rpc("transfer_money", {
    p_recipient: recipientId,
    p_amount: amount,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));
  return data as number;
}

export async function awardXp(userId: string, amount: number) {
  const { data: current, error: fetchError } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", userId)
    .single();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("profiles")
    .update({ xp: current.xp + amount })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Removes a member from the company via a security-definer RPC - a plain
 * client update can't do this itself, since setting company_id to null would
 * fail the profiles_update_by_manager policy's implicit WITH CHECK (which
 * requires the target's post-update company_id to still equal the caller's).
 */
export async function kickMember(memberId: string) {
  const { error } = await supabase.rpc("kick_member", { p_member_id: memberId });
  if (error) throw error;
}

/** Awards a one-off bonus to every current member the caller outranks. */
export async function awardBonusToAll(companyId: string, callerId: string, callerLevel: number, amount: number) {
  const members = await fetchCompanyMembers(companyId);
  const targets = members.filter((m) => m.id !== callerId && callerLevel > m.level);
  await Promise.all(targets.map((m) => awardMoney(m.id, amount)));
  return targets.length;
}

export async function leaveCompany(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ company_id: null, job_title: "Employee", level: DEFAULT_EMPLOYEE_LEVEL })
    .eq("id", userId);
  if (error) throw error;
}

/** Starts (or resumes into a new numbered) in-game day. Coming from "ended"
 * advances current_day; coming from "not_started" (the very first day)
 * keeps it at 1. */
export async function startCompanyDay(company: Company) {
  const nextDay = company.day_status === "ended" ? company.current_day + 1 : company.current_day;
  const { error } = await supabase
    .from("companies")
    .update({ day_status: "active", day_started_at: new Date().toISOString(), current_day: nextDay })
    .eq("id", company.id);
  if (error) throw error;
}

export async function endCompanyDay(companyId: string) {
  const { error } = await supabase.from("companies").update({ day_status: "ended" }).eq("id", companyId);
  if (error) throw error;
}

export async function setCareerMode(companyId: string, enabled: boolean) {
  const { error } = await supabase.from("companies").update({ career_mode: enabled }).eq("id", companyId);
  if (error) throw error;
}

/** Records a career milestone as claimed for the calling user via an atomic
 * server-side RPC (rather than a client-side read-modify-write of the
 * claimed_milestones array, which two rapid claims could race and lose one
 * of). Returns whether this call is the one that actually claimed it - the
 * caller should only award the reward when this is true, so a retried or
 * duplicate claim never pays out twice. */
export async function claimMilestone(milestoneId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_milestone", { p_milestone_id: milestoneId });
  if (error) throw error;
  return data ?? false;
}

/** Atomically checks completed-document thresholds server-side and appends
 * any newly-crossed company badges to companies.company_badges_claimed,
 * returning just the newly-earned badge keys (empty if none) - so calling
 * this repeatedly (e.g. every CompanyPage load) never re-announces the
 * same badge twice. */
export async function checkCompanyBadges(): Promise<string[]> {
  const { data, error } = await supabase.rpc("check_company_badges");
  if (error) throw error;
  return data ?? [];
}

export async function setSalaryPerLevel(companyId: string, amount: number) {
  const { error } = await supabase.from("companies").update({ salary_per_level: amount }).eq("id", companyId);
  if (error) throw error;
}

/** Pays every member `level * salary_per_level` - run as part of ending the
 * day. Uses awardMoney's own read-then-write per member rather than a bulk
 * update, same as awardBonusToAll, since RLS is enforced per-row anyway. */
export async function paySalaries(members: Profile[], salaryPerLevel: number): Promise<number> {
  if (salaryPerLevel <= 0) return 0;
  let total = 0;
  await Promise.all(
    members.map((m) => {
      const salary = m.level * salaryPerLevel;
      if (salary <= 0) return Promise.resolve();
      total += salary;
      return awardMoney(m.id, salary);
    }),
  );
  return total;
}

/** Adds to the company's all-time payroll-paid running total, shown as a
 * stat in Company Settings. Read-then-write like the rest of this file's
 * counters - the End Day button that drives this can't be pressed twice at
 * once by the same owner, so the race window is negligible. */
export async function incrementTotalPayrollPaid(companyId: string, amount: number, currentTotal: number) {
  if (amount <= 0) return;
  const { error } = await supabase
    .from("companies")
    .update({ total_payroll_paid: currentTotal + amount })
    .eq("id", companyId);
  if (error) throw error;
}
