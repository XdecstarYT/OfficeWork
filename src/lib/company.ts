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

export async function createCompany(name: string, ownerId: string): Promise<Company> {
  const invite_code = generateInviteCode();
  const { data: company, error } = await supabase
    .from("companies")
    .insert({ name, invite_code, owner_id: ownerId })
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

export async function startCompany(companyId: string) {
  const { error } = await supabase.from("companies").update({ started: true }).eq("id", companyId);
  if (error) throw error;
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
  updates: { job_title?: string; level?: number },
) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", memberId);
  if (error) throw error;
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

export async function leaveCompany(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ company_id: null, job_title: "Employee", level: DEFAULT_EMPLOYEE_LEVEL })
    .eq("id", userId);
  if (error) throw error;
}
