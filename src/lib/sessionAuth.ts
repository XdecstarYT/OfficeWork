import { supabase, SUPABASE_PUBLISHABLE_KEY } from "./supabaseClient";

const EMAIL_DOMAIN = "officequest.local";
const PROVISION_FN_URL = "https://cfuuhsnffowsckocvcig.supabase.co/functions/v1/provision-account";

function synthEmail(code: string): string {
  return `oq-${code.toLowerCase()}@${EMAIL_DOMAIN}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Creates a brand-new account (no email/password). Deliberately does NOT sign
 * in yet - the caller should show the code and let the player confirm they've
 * saved it before calling loginWithCode, otherwise the auth state change
 * would immediately navigate away from the "here's your code" screen.
 */
export async function createSessionAccount(
  displayName: string,
  emailHandle: string,
): Promise<{ code: string; emailHandle: string }> {
  const response = await fetch(PROVISION_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ displayName, emailHandle }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "Couldn't create an account.");
  }
  return { code: result.code as string, emailHandle: result.emailHandle as string };
}

/** Logs back into an existing account using its join code. */
export async function loginWithCode(rawCode: string): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) throw new Error("Enter a valid code.");

  const { error } = await supabase.auth.signInWithPassword({
    email: synthEmail(code),
    password: code,
  });
  if (error) throw new Error("That code wasn't recognized.");
}
