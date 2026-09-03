import { supabase } from "./supabaseClient";
import { awardMoney } from "./company";
import {
  COSMETIC_BY_ID,
  DEFAULT_EQUIPPED,
  FREE_COSMETIC_IDS,
  type CosmeticSlot,
} from "../data/cosmetics";
import type { Database } from "../types/database";

export type MemberDeskRow = Database["public"]["Tables"]["member_desks"]["Row"];

export interface Desk {
  memberId: string;
  ownedItems: string[];
  equipped: Record<CosmeticSlot, string>;
  wall: string;
  floor: string;
}

function toDesk(memberId: string, row: MemberDeskRow | null): Desk {
  const stored = (row?.equipped ?? {}) as Partial<Record<CosmeticSlot, string>>;
  return {
    memberId,
    // The free starter items are implicit rather than written into every new
    // row, so adding a free item to the catalog later gives it to everyone.
    ownedItems: [...new Set([...FREE_COSMETIC_IDS, ...(row?.owned_items ?? [])])],
    equipped: { ...DEFAULT_EQUIPPED, ...stored },
    wall: row?.wall ?? "sand",
    floor: row?.floor ?? "oak",
  };
}

export async function fetchDesk(memberId: string): Promise<Desk> {
  const { data, error } = await supabase
    .from("member_desks")
    .select("*")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw error;
  return toDesk(memberId, data);
}

/** Every desk in the company, for the "visit a coworker" gallery. */
export async function fetchCompanyDesks(companyId: string): Promise<Map<string, Desk>> {
  const { data, error } = await supabase.from("member_desks").select("*").eq("company_id", companyId);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.member_id, toDesk(row.member_id, row)] as const));
}

async function saveDesk(desk: Desk, companyId: string | null): Promise<void> {
  const { error } = await supabase.from("member_desks").upsert(
    {
      member_id: desk.memberId,
      company_id: companyId,
      // Free items are re-derived on read, so only what was actually bought
      // is stored.
      owned_items: desk.ownedItems.filter((id) => !FREE_COSMETIC_IDS.includes(id)),
      equipped: desk.equipped as unknown as Database["public"]["Tables"]["member_desks"]["Row"]["equipped"],
      wall: desk.wall,
      floor: desk.floor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
  if (error) throw error;
}

/**
 * Buys an item and equips it in one go. The desk row is written before the
 * money moves, so a failed write can't leave someone charged for an item
 * they don't own - the reverse would.
 */
export async function buyCosmetic(params: {
  desk: Desk;
  companyId: string | null;
  itemId: string;
  currentMoney: number;
}): Promise<Desk> {
  const { desk, companyId, itemId, currentMoney } = params;
  const item = COSMETIC_BY_ID.get(itemId);
  if (!item) throw new Error("No such item.");
  if (desk.ownedItems.includes(itemId)) throw new Error("You already own that.");
  if (item.cost > currentMoney) throw new Error(`That costs $${item.cost}; you have $${currentMoney.toFixed(2)}.`);

  const next: Desk = {
    ...desk,
    ownedItems: [...desk.ownedItems, itemId],
    equipped: { ...desk.equipped, [item.slot]: itemId },
  };
  await saveDesk(next, companyId);
  if (item.cost > 0) await awardMoney(desk.memberId, -item.cost);
  return next;
}

export async function equipCosmetic(params: {
  desk: Desk;
  companyId: string | null;
  itemId: string;
}): Promise<Desk> {
  const { desk, companyId, itemId } = params;
  const item = COSMETIC_BY_ID.get(itemId);
  if (!item) throw new Error("No such item.");
  if (!desk.ownedItems.includes(itemId)) throw new Error("You don't own that yet.");
  const next: Desk = { ...desk, equipped: { ...desk.equipped, [item.slot]: itemId } };
  await saveDesk(next, companyId);
  return next;
}

export async function setDeskStyle(params: {
  desk: Desk;
  companyId: string | null;
  wall?: string;
  floor?: string;
}): Promise<Desk> {
  const { desk, companyId, wall, floor } = params;
  const next: Desk = { ...desk, wall: wall ?? desk.wall, floor: floor ?? desk.floor };
  await saveDesk(next, companyId);
  return next;
}
