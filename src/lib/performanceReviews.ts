import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type PerformanceReviewRow = Database["public"]["Tables"]["performance_reviews"]["Row"];

export async function fetchCompanyReviews(companyId: string): Promise<PerformanceReviewRow[]> {
  const { data, error } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPerformanceReview(params: {
  companyId: string;
  memberId: string;
  reviewerId: string;
  rating: number;
  comments: string;
}): Promise<PerformanceReviewRow> {
  const { data, error } = await supabase
    .from("performance_reviews")
    .insert({
      company_id: params.companyId,
      member_id: params.memberId,
      reviewer_id: params.reviewerId,
      rating: params.rating,
      comments: params.comments,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
