import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_TEMPLATES, searchTemplates, getTemplate } from "../lib/templates";
import { CategoryTree, type CategorySelection } from "../components/CategoryTree";
import { SearchBar } from "../components/SearchBar";
import { TemplateCard } from "../components/TemplateCard";
import { TemplateDetailModal } from "../components/TemplateDetailModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { AssignTaskModal, type AssignTaskDetails } from "../components/AssignTaskModal";
import { useFavorites } from "../hooks/useFavorites";
import { useRecent } from "../hooks/useRecent";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { useNpcWorkAssignment } from "../hooks/useNpcWorkAssignment";
import { resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { BLANK_PAGE_TEMPLATE } from "../data/blankPage";
import { fetchCompanyMembers } from "../lib/company";
import { assignWork, fetchCompanyDocuments } from "../lib/documents";
import { pickBestAssignee, type AssigneeCandidate } from "../lib/aiClient";
import type { Database } from "../types/database";
import type { Difficulty, DocumentTemplate } from "../types/template";
import type { LlmConfig } from "../lib/llmConfig";

type SortMode = "relevance" | "name" | "time" | "difficulty";
const DIFFICULTY_ORDER: Record<Difficulty, number> = { quick: 0, standard: 1, detailed: 2 };

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface FilingCabinetProps {
  profile: Profile;
  llmConfig: LlmConfig;
  isOwner: boolean;
}

export function FilingCabinet({ profile, llmConfig, isOwner }: FilingCabinetProps) {
  const [selection, setSelection] = useState<CategorySelection>({
    categoryId: null,
    subcategoryId: null,
  });
  const [query, setQuery] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [assigningTemplate, setAssigningTemplate] = useState<DocumentTemplate | null>(null);
  const [assignTargetId, setAssignTargetId] = useState<string>(profile.id);
  const [members, setMembers] = useState<Profile[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatus = useCallback((message: string, ms = 4000) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), ms);
  }, []);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const { favorites, toggleFavorite } = useFavorites();
  const { recentIds } = useRecent();
  const { customTemplates, addCustomTemplate, removeCustomTemplate, canRemoveTemplate } = useCustomTemplates(
    profile.company_id,
    profile.id,
  );
  const { npcs, customNpcPersonas, npcWorking, assignTemplateToNpc } = useNpcWorkAssignment(profile, llmConfig);
  const [pickingNpcForTemplate, setPickingNpcForTemplate] = useState<DocumentTemplate | null>(null);
  const [smartAssigning, setSmartAssigning] = useState(false);

  useEffect(() => {
    if (profile.company_id) {
      fetchCompanyMembers(profile.company_id).then(setMembers);
    }
  }, [profile.company_id]);

  function handleStart(template: DocumentTemplate) {
    setActiveTemplate(null);
    setShowBuilder(false);
    setAssignTargetId(profile.id);
    setAssigningTemplate(template);
  }

  async function handleAssignToNpc(npc: CompanyNpcRow) {
    if (!pickingNpcForTemplate) return;
    const template = pickingNpcForTemplate;
    setPickingNpcForTemplate(null);
    const message = await assignTemplateToNpc(template, npc);
    if (message) {
      showStatus(message, 6000);
    }
  }

  async function handleSmartAssign(template: DocumentTemplate) {
    if (!profile.company_id) return;
    setActiveTemplate(null);
    setSmartAssigning(true);
    try {
      const docs = await fetchCompanyDocuments(profile.company_id);
      const openCountFor = (matcher: (d: (typeof docs)[number]) => boolean) =>
        docs.filter((d) => d.status !== "completed" && matcher(d)).length;

      const humanCandidates: AssigneeCandidate[] = [
        { id: profile.id, name: "Myself", jobTitle: profile.job_title, isNpc: false, openTaskCount: openCountFor((d) => d.assigned_to === profile.id) },
        ...members
          .filter((m) => m.id !== profile.id && profile.level > m.level)
          .map((m) => ({
            id: m.id,
            name: m.display_name,
            jobTitle: m.job_title,
            isNpc: false,
            openTaskCount: openCountFor((d) => d.assigned_to === m.id),
          })),
      ];
      const npcCandidates: AssigneeCandidate[] = npcs.map((npc) => {
        const persona = resolveNpcPersona(npc, customNpcPersonas);
        return {
          id: npc.id,
          name: persona?.name ?? "Unknown",
          jobTitle: npc.job_title,
          personality: persona?.personality,
          isNpc: true,
          openTaskCount: openCountFor((d) => d.assigned_to_npc_id === npc.id),
        };
      });
      const candidates = [...humanCandidates, ...npcCandidates];
      if (candidates.length === 0) {
        showStatus("Nobody available to smart-assign to.", 4000);
        return;
      }

      const pick = await pickBestAssignee(template, candidates, llmConfig);
      const chosenNpc = npcs.find((n) => n.id === pick.candidateId);
      if (chosenNpc) {
        const message = await assignTemplateToNpc(template, chosenNpc);
        showStatus(message || `🪄 Smart-assigned "${template.title}" to an AI coworker — ${pick.reason}`, 6000);
        return;
      }

      const chosenHuman = candidates.find((c) => c.id === pick.candidateId && !c.isNpc);
      if (!chosenHuman) {
        showStatus("Smart Assign couldn't settle on anyone — try again.", 4000);
        return;
      }
      const isSelfRequest = chosenHuman.id === profile.id;
      await assignWork({
        companyId: profile.company_id,
        template,
        createdBy: profile.id,
        assignedTo: chosenHuman.id,
        isSelfRequest,
      });
      showStatus(`🪄 Smart-assigned "${template.title}" to ${chosenHuman.name} — ${pick.reason}`, 6000);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Smart Assign couldn't complete.", 4000);
    } finally {
      setSmartAssigning(false);
    }
  }

  async function handleConfirmAssign(details: AssignTaskDetails) {
    if (!profile.company_id || !assigningTemplate) return;
    const isSelfRequest = assignTargetId === profile.id;
    await assignWork({
      companyId: profile.company_id,
      template: assigningTemplate,
      createdBy: profile.id,
      assignedTo: assignTargetId,
      isSelfRequest,
      ...details,
    });
    showStatus(
      isSelfRequest
        ? `Requested "${assigningTemplate.title}" for yourself.`
        : `Assigned "${assigningTemplate.title}" to ${members.find((m) => m.id === assignTargetId)?.display_name}.`,
      4000,
    );
    setAssigningTemplate(null);
  }

  const assignableTargets = [
    { id: profile.id, label: "Myself" },
    ...members.filter((m) => m.id !== profile.id && profile.level > m.level).map((m) => ({ id: m.id, label: m.display_name })),
  ];

  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of ALL_TEMPLATES) {
      counts[t.subcategoryId] = (counts[t.subcategoryId] ?? 0) + 1;
    }
    return counts;
  }, []);

  const scoped = useMemo(() => {
    let templates = ALL_TEMPLATES;
    if (selection.subcategoryId) {
      templates = templates.filter((t) => t.subcategoryId === selection.subcategoryId);
    } else if (selection.categoryId) {
      templates = templates.filter((t) => t.categoryId === selection.categoryId);
    }
    if (difficultyFilter !== "all") {
      templates = templates.filter((t) => t.difficulty === difficultyFilter);
    }
    return templates;
  }, [selection, difficultyFilter]);

  const filtered = useMemo(() => {
    const results = searchTemplates(scoped, query);
    if (sortMode === "relevance") return results;
    const sorted = [...results];
    if (sortMode === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === "time") sorted.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
    else if (sortMode === "difficulty")
      sorted.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
    return sorted;
  }, [scoped, query, sortMode]);

  // Rendering 1000+ cards at once is what actually makes browsing feel
  // laggy (huge DOM, hover/focus style recalculation on every one). Page it.
  const PAGE_SIZE = 60;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selection, query]);
  const visibleFiltered = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const favoriteTemplates = useMemo(
    () => ALL_TEMPLATES.filter((t) => favorites.has(t.id)),
    [favorites],
  );

  const recentTemplates = useMemo(
    () => recentIds.map((id) => getTemplate(id)).filter((t): t is DocumentTemplate => !!t),
    [recentIds],
  );

  const isBrowsingRoot = !selection.categoryId && !selection.subcategoryId && !query;

  const sidebarContent = (
    <>
      <button
        type="button"
        onClick={() => setActiveTemplate(BLANK_PAGE_TEMPLATE)}
        className="mb-1 flex w-full items-center gap-2 rounded-md border border-dashed border-stone-300 bg-white px-2.5 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        📄 Blank Page
      </button>
      <button
        type="button"
        onClick={() => setShowBuilder(true)}
        className="mb-3 flex w-full items-center gap-2 rounded-md border border-dashed border-stone-300 bg-white px-2.5 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        🧩 Build Custom Template
      </button>

      <CategoryTree selection={selection} onSelect={setSelection} counts={subcategoryCounts} />
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
      {/* Mobile: collapsible accordion so browsing categories doesn't eat the whole screen */}
      <details className="shrink-0 border-b border-stone-200 bg-stone-50 md:hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
          📁 Filing Cabinet — Browse Categories
        </summary>
        <div className="max-h-72 overflow-y-auto p-4 pt-0">{sidebarContent}</div>
      </details>

      {/* Desktop: always-visible sidebar */}
      <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-stone-200 bg-stone-50 p-4 md:block">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Filing Cabinet
        </h2>
        {sidebarContent}
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <SearchBar value={query} onChange={setQuery} />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {(["all", "quick", "standard", "detailed"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficultyFilter(d)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                    difficultyFilter === d
                      ? "bg-stone-800 text-white"
                      : "border border-stone-300 text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
              Sort
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="name">Name (A-Z)</option>
                <option value="time">Est. Time</option>
                <option value="difficulty">Difficulty</option>
              </select>
            </label>
          </div>

          {isBrowsingRoot && (
            <>
              <Section
                title="🧩 Custom Templates (shared with your team)"
                emptyLabel="Build one with the drag-and-drop template builder, top-left — anyone on your team can use it."
              >
                {customTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isFavorite={favorites.has(t.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setActiveTemplate}
                  />
                ))}
              </Section>

              <Section title="⭐ Favorites" emptyLabel="Star a template to pin it here.">
                {favoriteTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isFavorite
                    onToggleFavorite={toggleFavorite}
                    onOpen={setActiveTemplate}
                  />
                ))}
              </Section>

              <Section
                title="🕘 Recently Used"
                emptyLabel="Documents you complete will show up here."
              >
                {recentTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isFavorite={favorites.has(t.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setActiveTemplate}
                  />
                ))}
              </Section>
            </>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                {query
                  ? `Results for "${query}"`
                  : selection.subcategoryId || selection.categoryId
                    ? "Templates"
                    : "All Documents"}
              </h2>
              <span className="text-xs text-stone-400">{filtered.length} templates</span>
            </div>

            {filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">
                No templates found. Try a different search or category.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleFiltered.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isFavorite={favorites.has(t.id)}
                      onToggleFavorite={toggleFavorite}
                      onOpen={setActiveTemplate}
                    />
                  ))}
                </div>
                {visibleCount < filtered.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="self-center rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    Show More ({filtered.length - visibleCount} remaining)
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {activeTemplate && (
        <TemplateDetailModal
          template={activeTemplate}
          isFavorite={favorites.has(activeTemplate.id)}
          onToggleFavorite={toggleFavorite}
          onClose={() => setActiveTemplate(null)}
          onStart={(t) => {
            setActiveTemplate(null);
            handleStart(t);
          }}
          onDelete={
            activeTemplate.categoryId === "custom" && canRemoveTemplate(activeTemplate.id, isOwner)
              ? (t) => {
                  if (!window.confirm(`Delete "${t.title}"? This can't be undone.`)) return;
                  removeCustomTemplate(t.id);
                  setActiveTemplate(null);
                }
              : undefined
          }
          onAssignToNpc={
            npcs.length > 0
              ? (t) => {
                  setActiveTemplate(null);
                  setPickingNpcForTemplate(t);
                }
              : undefined
          }
          onSmartAssign={
            isOwner &&
            (members.some((m) => m.id !== profile.id && profile.level > m.level) || npcs.length > 0)
              ? handleSmartAssign
              : undefined
          }
          smartAssigning={smartAssigning}
        />
      )}

      {pickingNpcForTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => !npcWorking && setPickingNpcForTemplate(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-900">Who should work on this?</h2>
            <p className="mt-1 text-xs text-stone-500">"{pickingNpcForTemplate.title}"</p>
            <div className="mt-3 flex flex-col gap-1.5">
              {npcs.map((npc) => {
                const persona = resolveNpcPersona(npc, customNpcPersonas);
                return (
                  <button
                    key={npc.id}
                    type="button"
                    disabled={npcWorking}
                    onClick={() => handleAssignToNpc(npc)}
                    className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-50"
                  >
                    <span>
                      {persona?.avatar ?? "🤖"} {persona?.name ?? "AI Coworker"}
                    </span>
                    <span className="text-xs text-stone-400">{npc.job_title}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPickingNpcForTemplate(null)}
              disabled={npcWorking}
              className="mt-4 self-end rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
            >
              {npcWorking ? "Working…" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {showBuilder && (
        <TemplateBuilder
          llmConfig={llmConfig}
          onClose={() => setShowBuilder(false)}
          onSaveTemplate={(t) => {
            addCustomTemplate(t);
            setShowBuilder(false);
          }}
          onFillOutNow={(t) => {
            setShowBuilder(false);
            handleStart(t);
          }}
        />
      )}

      {assigningTemplate && (
        <AssignTaskModal
          template={assigningTemplate}
          targetLabel={
            assignTargetId === profile.id
              ? "yourself"
              : (members.find((m) => m.id === assignTargetId)?.display_name ?? "them")
          }
          isSelfRequest={assignTargetId === profile.id}
          targetOptions={assignableTargets}
          targetId={assignTargetId}
          onTargetChange={setAssignTargetId}
          onClose={() => setAssigningTemplate(null)}
          onConfirm={handleConfirmAssign}
        />
      )}

      {statusMessage && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-lg">
          {statusMessage}
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="ml-3 text-emerald-400 hover:text-emerald-600"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  emptyLabel,
  children,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      {hasChildren ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-400">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}
