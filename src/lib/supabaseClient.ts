import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// The Supabase URL and publishable/anon key are safe to ship in client code -
// they're meant to be public. Row Level Security on every table is what
// actually protects data, not secrecy of this key.
export const SUPABASE_URL = "https://cfuuhsnffowsckocvcig.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_AvinmTwnK-2uA7kVbOBXtw_TWByAMny";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
