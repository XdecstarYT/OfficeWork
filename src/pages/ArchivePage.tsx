import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCompanyDocuments, payoutFor, type DocumentRow } from "../lib/documents";
import { fetchCompanyMembers } from "../lib/company";
import { fetchCompanyNpcs, resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { fetchCustomNpcPersonas, type CustomNpcPersonaRow } from "../lib/customNpcPersonas";
import { downloadCsv } from "../lib/csv";
import { supabase } from "../lib/supabaseClient";
import { DocumentPreview } from "../components/DocumentPreview";
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
  const [npcs, setNpcs] = useState<CompanyNpcRow[]>([]);
  const [customNpcPersonas, setCustomNpcPersonas] = useState<CustomNpcPersonaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "payout">("newest");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openDoc, setOpenDoc] = useState<DocumentRow | null>(null);

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [docs, m, n, cp] = await Promise.all([
      fetchCompanyDocuments(profile.company_id),
      fetchCompanyMembers(profile.company_id),
      fetchCompanyNpcs(profile.company_id),
      fetchCustomNpcPersonas(profile.company_id),
    ]);
    setDocuments(docs.filter((d) => d.status === "completed"));
    setMembers(m);
    setNpcs(n);
    setCustomNpcPersonas(cp);
    setLoading(false);
  }, [profile.company_id]);

  function completedByLabel(d: DocumentRow): string {
    if (d.assigned_to_npc_id) {
      const npc = npcs.find((n) => n.id === d.assigned_to_npc_id);
      const persona = npc ? resolveNpcPersona(npc, customNpcPersonas) : undefined;
      return `🤖 ${persona?.name ?? "AI Coworker"}`;
    }
    return members.find((m) => m.id === d.assigned_to)?.display_name ?? "Unknown";
  }

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
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    const results = documents
      .filter((d) => {
        if (!personFilter) return true;
        if (personFilter === "__npc__") return !!d.assigned_to_npc_id;
        return d.assigned_to === personFilter;
      })
      .filter((d) => !q || d.title.toLowerCase().includes(q))
      .filter((d) => {
        if (!fromTime && !toTime) return true;
        const t = d.completed_at ? new Date(d.completed_at).getTime() : 0;
        return (!fromTime || t >= fromTime) && (!toTime || t < toTime);
      });
    const sorted = [...results];
    if (sortMode === "newest") sorted.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    else if (sortMode === "oldest") sorted.sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
    else if (sortMode === "payout")
      sorted.sort((a, b) => payoutFor(b, asTemplate(b)) - payoutFor(a, asTemplate(a)));
    return sorted;
  }, [documents, query, personFilter, sortMode, dateFrom, dateTo]);

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading archive…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🗄 Document Archive</h1>
            <p className="text-sm text-stone-500">
              Every completed document across the company — {documents.length} total.
            </p>
          </div>
          {documents.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadCsv("archive.csv", [
                  ["Title", "Completed By", "Payout", "Completed At"],
                  ...filtered.map((d) => [
                    d.title,
                    completedByLabel(d),
                    d.assigned_to_npc_id ? 0 : payoutFor(d, asTemplate(d)),
                    d.completed_at ? new Date(d.completed_at).toLocaleString() : "",
                  ]),
                ])
              }
              className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…"
            className="min-w-[10rem] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            {npcs.length > 0 && <option value="__npc__">🤖 AI Coworkers</option>}
          </select>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="payout">Highest payout</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-stone-500">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-stone-300 px-2 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </label>
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
              <button
                key={d.id}
                type="button"
                onClick={() => setOpenDoc(d)}
                className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2 text-left hover:bg-stone-50"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">{d.title}</p>
                  <p className="text-xs text-stone-400">
                    {completedByLabel(d)}
                    {!d.assigned_to_npc_id && ` · 💵 $${payoutFor(d, asTemplate(d))}`} ·{" "}
                    {d.completed_at ? new Date(d.completed_at).toLocaleDateString() : "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setOpenDoc(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">{openDoc.title}</h2>
                <p className="text-xs text-stone-400">
                  {completedByLabel(openDoc)} ·{" "}
                  {openDoc.completed_at ? new Date(openDoc.completed_at).toLocaleDateString() : "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="shrink-0 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900"
              >
                🖨 Print / Save as PDF
              </button>
            </div>
            <div className="print-area mt-3">
              <DocumentPreview
                title={openDoc.title}
                bodyTemplate={asTemplate(openDoc).bodyTemplate}
                values={(openDoc.field_values as Record<string, string>) ?? {}}
              />
            </div>
            <button
              type="button"
              onClick={() => setOpenDoc(null)}
              className="mt-3 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
