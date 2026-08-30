import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCompanyDocuments, payoutFor, type DocumentRow } from "../lib/documents";
import { fetchCompanyMembers } from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ArchivePageProps {
  profile: Profile;
}

function asTemplate(row: DocumentRow): DocumentTemplate {
  return row.template_snapshot as unknown as DocumentTemplate;
}

export function ArchivePage({ profile }: ArchivePageProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("");

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [docs, m] = await Promise.all([
      fetchCompanyDocuments(profile.company_id),
      fetchCompanyMembers(profile.company_id),
    ]);
    setDocuments(docs.filter((d) => d.status === "completed"));
    setMembers(m);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`archive-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => !personFilter || d.assigned_to === personFilter)
      .filter((d) => !q || d.title.toLowerCase().includes(q))
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  }, [documents, query, personFilter]);

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading archive…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">🗄 Document Archive</h1>
          <p className="text-sm text-stone-500">
            Every completed document across the company — {documents.length} total.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-400">
            {documents.length === 0
              ? "Nothing completed yet."
              : "No completed documents match that search/filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">{d.title}</p>
                  <p className="text-xs text-stone-400">
                    {members.find((m) => m.id === d.assigned_to)?.display_name ?? "Unknown"} · 💵 $
                    {payoutFor(d, asTemplate(d))} ·{" "}
                    {d.completed_at ? new Date(d.completed_at).toLocaleDateString() : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
