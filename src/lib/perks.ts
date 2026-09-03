import { supabase } from "./supabaseClient";
import { careerLevelFromXp } from "./careerLevel";
import { PERK_BY_ID, PERKS, combineEffects, perkPointsForLevel, type Perk } from "../data/perks";
import type { Database } from "../types/database";

export type MemberPerkRow = Database["public"]["Tables"]["member_perks"]["Row"];

export interface PerkState {
  owned: Set<string>;
  spent: number;
  earned: number;
  available: number;
  effects: ReturnType<typeof combineEffects>;
}

export function perkState(ownedIds: Iterable<string>, xp: number): PerkState {
  const owned = new Set(ownedIds);
  const spent = [...owned].reduce((sum, id) => sum + (PERK_BY_ID.get(id)?.cost ?? 0), 0);
  const earned = perkPointsForLevel(careerLevelFromXp(xp));
  return { owned, spent, earned, available: earned - spent, effects: combineEffects(owned) };
}

/** Why a perk can't be taken right now, or null if it can. */
export function perkBlockedReason(perk: Perk, state: PerkState, careerLevel: number): string | null {
  if (state.owned.has(perk.id)) return null;
  if (careerLevel < perk.minLevel) return `Career level ${perk.minLevel}`;
  if (perk.requires && !state.owned.has(perk.requires)) {
    return `Needs ${PERK_BY_ID.get(perk.requires)?.name ?? perk.requires}`;
  }
  if (state.available < perk.cost) return `${perk.cost} point${perk.cost === 1 ? "" : "s"}`;
  return null;
}

export async function fetchMyPerks(memberId: string): Promise<string[]> {
  const { data, error } = await supabase.from("member_perks").select("perk_id").eq("member_id", memberId);
  if (error) throw error;
  return (data ?? []).map((r) => r.perk_id);
}

/** Every perk held in the company, keyed by member - used on the roster. */
export async function fetchCompanyPerks(memberIds: string[]): Promise<Map<string, string[]>> {
  if (memberIds.length === 0) return new Map();
  const { data, error } = await supabase.from("member_perks").select("member_id, perk_id").in("member_id", memberIds);
  if (error) throw error;
  const byMember = new Map<string, string[]>();
  for (const row of data ?? []) {
    byMember.set(row.member_id, [...(byMember.get(row.member_id) ?? []), row.perk_id]);
  }
  return byMember;
}

export async function takePerk(params: { memberId: string; perkId: string; xp: number; ownedIds: string[] }) {
  const { memberId, perkId, xp, ownedIds } = params;
  const perk = PERK_BY_ID.get(perkId);
  if (!perk) throw new Error("No such perk.");
  const state = perkState(ownedIds, xp);
  const blocked = perkBlockedReason(perk, state, careerLevelFromXp(xp));
  if (blocked) throw new Error(`Not available yet - ${blocked}.`);

  const { error } = await supabase.from("member_perks").insert({ member_id: memberId, perk_id: perkId });
  if (error) {
    if (error.code === "23505") throw new Error("You already have that perk.");
    throw error;
  }
}

/** Wipes every perk so the points can be spent again. Free - the cost of a
 * respec is the paperwork of picking again. */
export async function respecPerks(memberId: string) {
  const { error } = await supabase.from("member_perks").delete().eq("member_id", memberId);
  if (error) throw error;
}

export const ALL_PERKS = PERKS;
