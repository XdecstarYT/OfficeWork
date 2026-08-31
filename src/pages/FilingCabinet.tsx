import { useEffect, useMemo, useState } from "react";
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
import { BLANK_PAGE_TEMPLATE } from "../data/blankPage";
import { fetchCompanyMembers } from "../lib/company";
import { assignWork } from "../lib/documents";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface FilingCabinetProps {
  profile: Profile;
}

export function FilingCabinet({ profile }: FilingCabinetProps) {
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
  const { favorites, toggleFavorite } = useFavorites();
  const { recentIds } = useRecent();
  const { customTemplates, addCustomTemplate, removeCustomTemplate } = useCustomTemplates(
    profile.company_id,
    profile.id,
  );

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
    setStatusMessage(
      isSelfRequest
        ? `Requested "${assigningTemplate.title}" for yourself.`
        : `Assigned "${assigningTemplate.title}" to ${members.find((m) => m.id === assignTargetId)?.display_name}.`,
    );
    setTimeout(() => setStatusMessage(null), 4000);
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
    return templates;
  }, [selection]);

  const filtered = useMemo(() => searchTemplates(scoped, query), [scoped, query]);

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
            activeTemplate.categoryId === "custom"
              ? (t) => {
                  removeCustomTemplate(t.id);
                  setActiveTemplate(null);
                }
              : undefined
          }
        />
      )}

      {showBuilder && (
        <TemplateBuilder
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
