import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_TEMPLATES,
  searchTemplates,
  getTemplateMeta,
  loadTemplate,
  metaFromTemplate,
  type TemplateMeta,
} from "../lib/templates";
import { CategoryTree, type CategorySelection } from "../components/CategoryTree";
import { SearchBar } from "../components/SearchBar";
import { TemplateCard } from "../components/TemplateCard";
import { TemplateDetailModal } from "../components/TemplateDetailModal";
import { TemplateBuilder } from "../components/TemplateBuilder";
import { fetchProjects, type ProjectRow } from "../lib/projects";
import { AssignTaskModal, type AssignTaskDetails } from "../components/AssignTaskModal";
import { useFavorites } from "../hooks/useFavorites";
import { useRecent } from "../hooks/useRecent";
import type { DocumentStatRow } from "../lib/documents";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { useNpcWorkAssignment } from "../hooks/useNpcWorkAssignment";
import { resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { BLANK_PAGE_TEMPLATE } from "../data/blankPage";
import { fetchCompanyMembers } from "../lib/company";
import { assignWork, fetchCompanyDocumentStats } from "../lib/documents";
import { pickBestAssignee, type AssigneeCandidate } from "../lib/aiClient";
import { estimatePayout } from "../lib/documents";
import { downloadCsv } from "../lib/csv";
import {
  loadCabinetViewMode,
  saveCabinetViewMode,
  loadCabinetSortMode,
  saveCabinetSortMode,
  type CabinetViewMode,
} from "../lib/storage";
import { TAXONOMY } from "../data/taxonomy";
import type { Database } from "../types/database";
import type { Difficulty, DocumentTemplate } from "../types/template";
import type { LlmConfig } from "../lib/llmConfig";

type SortMode = "relevance" | "name" | "time" | "difficulty" | "payout";
const DIFFICULTY_ORDER: Record<Difficulty, number> = { quick: 0, standard: 1, detailed: 2 };
type TimeFilter = "all" | "short" | "medium" | "long";

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
  const [activeTemplate, setActiveTemplate] = useState<TemplateMeta | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<DocumentTemplate | null>(null);
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
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const saved = loadCabinetSortMode();
    return saved === "relevance" || saved === "name" || saved === "time" || saved === "difficulty" || saved === "payout"
      ? saved
      : "relevance";
  });
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [viewMode, setViewMode] = useState<CabinetViewMode>(() => loadCabinetViewMode());
  const { favorites, toggleFavorite } = useFavorites();
  const { recentIds, clearRecent } = useRecent();
  const [companyDocsForStats, setCompanyDocsForStats] = useState<DocumentStatRow[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { customTemplates, addCustomTemplate, removeCustomTemplate, canRemoveTemplate } = useCustomTemplates(
    profile.company_id,
    profile.id,
  );
  const { npcs, customNpcPersonas, npcWorking, assignTemplateToNpc } = useNpcWorkAssignment(profile, llmConfig);
  const [pickingNpcForTemplate, setPickingNpcForTemplate] = useState<DocumentTemplate | null>(null);
  const [smartAssigning, setSmartAssigning] = useState(false);
  const [activeProjects, setActiveProjects] = useState<ProjectRow[]>([]);

  useEffect(() => {
    if (profile.company_id) {
      fetchCompanyMembers(profile.company_id).then(setMembers);
      fetchCompanyDocumentStats(profile.company_id).then(setCompanyDocsForStats);
      fetchProjects(profile.company_id).then((p) => setActiveProjects(p.filter((x) => x.status === "active")));
    }
  }, [profile.company_id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "/") {
        const target = e.target as HTMLElement;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current && query) {
        setQuery("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  useEffect(() => {
    saveCabinetSortMode(sortMode);
  }, [sortMode]);

  useEffect(() => {
    saveCabinetViewMode(viewMode);
  }, [viewMode]);

  /** Browsing only ever needs a template's metadata; its fields and body are
   * fetched here, at the moment someone actually acts on it. Custom templates
   * and the Blank Page are already held in full, so they skip the fetch. */
  const resolveFullTemplate = useCallback(
    async (meta: TemplateMeta): Promise<DocumentTemplate | undefined> => {
      const custom = customTemplates.find((t) => t.id === meta.id);
      if (custom) return custom;
      if (meta.id === BLANK_PAGE_TEMPLATE.id) return BLANK_PAGE_TEMPLATE;
      return loadTemplate(meta.id);
    },
    [customTemplates],
  );

  /** Opens the assign flow for a template we already hold in full - used by
   * the builder, whose freshly-built template isn't in the index or the saved
   * custom list yet. */
  function startWithTemplate(template: DocumentTemplate) {
    setActiveTemplate(null);
    setShowBuilder(false);
    setAssignTargetId(profile.id);
    setAssigningTemplate(template);
  }

  async function handleStart(meta: TemplateMeta) {
    const template = await resolveFullTemplate(meta);
    if (!template) {
      showStatus("Couldn't open that template - try again.", 4000);
      return;
    }
    startWithTemplate(template);
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

  async function handleSmartAssign(meta: TemplateMeta) {
    if (!profile.company_id) return;
    setActiveTemplate(null);
    setSmartAssigning(true);
    try {
      const template = await resolveFullTemplate(meta);
      if (!template) {
        showStatus("Couldn't open that template - try again.", 4000);
        return;
      }
      const docs = await fetchCompanyDocumentStats(profile.company_id);
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

  const difficultyCounts = useMemo(() => {
    const counts: Record<Difficulty, number> = { quick: 0, standard: 0, detailed: 0 };
    for (const t of ALL_TEMPLATES) counts[t.difficulty]++;
    return counts;
  }, []);

  const inTimeRange = (t: TemplateMeta, filter: TimeFilter) => {
    if (filter === "all") return true;
    if (filter === "short") return t.estimatedMinutes < 5;
    if (filter === "medium") return t.estimatedMinutes >= 5 && t.estimatedMinutes <= 15;
    return t.estimatedMinutes > 15;
  };

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
    if (timeFilter !== "all") {
      templates = templates.filter((t) => inTimeRange(t, timeFilter));
    }
    return templates;
  }, [selection, difficultyFilter, timeFilter]);

  const filtered = useMemo(() => {
    const results = searchTemplates(scoped, query);
    if (sortMode === "relevance") return results;
    const sorted = [...results];
    if (sortMode === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortMode === "time") sorted.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
    else if (sortMode === "difficulty")
      sorted.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
    else if (sortMode === "payout") sorted.sort((a, b) => estimatePayout(b) - estimatePayout(a));
    return sorted;
  }, [scoped, query, sortMode]);

  const activeFilterCount =
    (query ? 1 : 0) + (difficultyFilter !== "all" ? 1 : 0) + (timeFilter !== "all" ? 1 : 0) +
    (selection.categoryId ? 1 : 0);

  function clearAllFilters() {
    setQuery("");
    setDifficultyFilter("all");
    setTimeFilter("all");
    setSelection({ categoryId: null, subcategoryId: null });
  }

  function handleJumpToRandomCategory() {
    const cat = TAXONOMY[Math.floor(Math.random() * TAXONOMY.length)];
    setSelection({ categoryId: cat.id, subcategoryId: null });
  }

  function handleExportCsv() {
    downloadCsv(
      "filing-cabinet-templates.csv",
      [
        ["Title", "Category", "Subcategory", "Difficulty", "Est. Minutes", "Est. Payout"],
        ...filtered.map((t) => [t.title, t.category, t.subcategory, t.difficulty, t.estimatedMinutes, estimatePayout(t)]),
      ],
    );
  }

  const categoryName = selection.categoryId ? TAXONOMY.find((c) => c.id === selection.categoryId)?.name : null;
  const subcategoryName =
    selection.categoryId && selection.subcategoryId
      ? TAXONOMY.find((c) => c.id === selection.categoryId)?.subcategories.find((s) => s.id === selection.subcategoryId)?.name
      : null;

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
    () => recentIds.map((id) => getTemplateMeta(id)).filter((t): t is TemplateMeta => !!t),
    [recentIds],
  );

  const popularTemplates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of companyDocsForStats) {
      if (d.status !== "completed" || !d.template_id) continue;
      counts.set(d.template_id, (counts.get(d.template_id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => getTemplateMeta(id))
      .filter((t): t is TemplateMeta => !!t);
  }, [companyDocsForStats]);

  function handleSurpriseMe() {
    const pool = filtered.length > 0 ? filtered : ALL_TEMPLATES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) setActiveTemplate(pick);
  }

  const isBrowsingRoot = !selection.categoryId && !selection.subcategoryId && !query;

  const sidebarContent = (
    <>
      <button
        type="button"
        onClick={() => setActiveTemplate(metaFromTemplate(BLANK_PAGE_TEMPLATE))}
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
        <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Filing Cabinet
        </h2>
        <p className="mb-3 px-1 text-xs text-stone-400">{ALL_TEMPLATES.length.toLocaleString()} templates total</p>
        <button
          type="button"
          onClick={handleJumpToRandomCategory}
          className="mb-3 flex w-full items-center gap-2 rounded-md border border-dashed border-stone-300 bg-white px-2.5 py-2 text-left text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          🔀 Jump to Random Category
        </button>
        {sidebarContent}
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SearchBar ref={searchInputRef} value={query} onChange={setQuery} />
            </div>
            <button
              type="button"
              onClick={handleSurpriseMe}
              className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
              title="Open a random template"
            >
              🎲 Surprise Me
            </button>
          </div>

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
                  {d !== "all" && <span className="ml-1 opacity-70">({difficultyCounts[d]})</span>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {([
                ["all", "Any time"],
                ["short", "<5m"],
                ["medium", "5-15m"],
                ["long", "15m+"],
              ] as [TimeFilter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTimeFilter(value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    timeFilter === value
                      ? "bg-stone-800 text-white"
                      : "border border-stone-300 text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                ✕ Clear filters
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100"
                title="Export the current list as CSV"
              >
                ⬇ CSV
              </button>
              <div className="flex overflow-hidden rounded-md border border-stone-300 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2 py-1 font-medium ${viewMode === "grid" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"}`}
                  title="Grid view"
                >
                  ▦
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2 py-1 font-medium ${viewMode === "list" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"}`}
                  title="List view"
                >
                  ☰
                </button>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-stone-500">
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
                  <option value="payout">Payout (High-Low)</option>
                </select>
              </label>
            </div>
          </div>

          {(categoryName || subcategoryName) && (
            <div className="flex items-center gap-1 text-xs text-stone-500">
              <button type="button" onClick={() => setSelection({ categoryId: null, subcategoryId: null })} className="hover:text-stone-800 hover:underline">
                All Documents
              </button>
              {categoryName && (
                <>
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => setSelection({ categoryId: selection.categoryId, subcategoryId: null })}
                    className="hover:text-stone-800 hover:underline"
                  >
                    {categoryName}
                  </button>
                </>
              )}
              {subcategoryName && (
                <>
                  <span>/</span>
                  <span className="font-medium text-stone-700">{subcategoryName}</span>
                </>
              )}
            </div>
          )}

          {isBrowsingRoot && (
            <>
              <Section
                title={`🧩 Custom Templates (shared with your team)${customTemplates.length > 0 ? ` (${customTemplates.length})` : ""}`}
                emptyLabel="Build one with the drag-and-drop template builder, top-left — anyone on your team can use it."
              >
                {customTemplates.map(metaFromTemplate).map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isFavorite={favorites.has(t.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setActiveTemplate}
                  />
                ))}
              </Section>

              <Section
                title={`⭐ Favorites${favoriteTemplates.length > 0 ? ` (${favoriteTemplates.length})` : ""}`}
                emptyLabel="Star a template to pin it here."
              >
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
                headerExtra={
                  recentTemplates.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Clear
                    </button>
                  ) : undefined
                }
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

              {popularTemplates.length > 0 && (
                <Section title="🔥 Popular With Your Team" emptyLabel="">
                  {popularTemplates.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isFavorite={favorites.has(t.id)}
                      onToggleFavorite={toggleFavorite}
                      onOpen={setActiveTemplate}
                    />
                  ))}
                </Section>
              )}
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
                <div className={viewMode === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2"}>
                  {visibleFiltered.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isFavorite={favorites.has(t.id)}
                      onToggleFavorite={toggleFavorite}
                      onOpen={setActiveTemplate}
                      compact={viewMode === "list"}
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
              ? async (t) => {
                  const full = await resolveFullTemplate(t);
                  setActiveTemplate(null);
                  if (full) setPickingNpcForTemplate(full);
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
          onDuplicate={async (t) => {
            const full = await resolveFullTemplate(t);
            setActiveTemplate(null);
            if (!full) return;
            setDuplicateSource(full);
            setShowBuilder(true);
          }}
          onTagClick={(tag) => {
            setActiveTemplate(null);
            setSelection({ categoryId: null, subcategoryId: null });
            setQuery(tag);
          }}
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
          initialTemplate={duplicateSource ?? undefined}
          heading={duplicateSource ? `🧬 Duplicate "${duplicateSource.title}"` : undefined}
          onClose={() => {
            setShowBuilder(false);
            setDuplicateSource(null);
          }}
          onSaveTemplate={(t) => {
            addCustomTemplate(t);
            setShowBuilder(false);
            setDuplicateSource(null);
          }}
          onFillOutNow={(t) => {
            setDuplicateSource(null);
            startWithTemplate(t);
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
          projectOptions={activeProjects.map((p) => ({ id: p.id, label: `${p.emoji} ${p.name}` }))}
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
  headerExtra,
}: {
  title: string;
  emptyLabel: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
        {headerExtra}
      </div>
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
