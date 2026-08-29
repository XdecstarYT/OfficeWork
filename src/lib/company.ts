import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

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

export async function joinCompany(inviteCode: string, userId: string): Promise<Company> {
  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("invite_code", inviteCode.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!company) throw new Error("No company found with that invite code.");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ company_id: company.id, job_title: "Employee", level: DEFAULT_EMPLOYEE_LEVEL })
    .eq("id", userId);
  if (profileError) throw profileError;

  return company;
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const { data } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  return data;
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

export async function leaveCompany(userId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ company_id: null, job_title: "Employee", level: DEFAULT_EMPLOYEE_LEVEL })
    .eq("id", userId);
  if (error) throw error;
}
