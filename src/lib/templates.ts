import type { DocumentTemplate, Difficulty } from "../types/template";
import templateIndex from "../data/templateIndex.json";

/**
 * Browse-level metadata for a template - everything the Filing Cabinet needs
 * to render a card, search, filter and sort, without the `fields` array or
 * `bodyTemplate` string.
 *
 * The full library is ~1.75 MB of JSON. Eagerly bundling all of it (which is
 * what `import.meta.glob(..., { eager: true })` used to do here) produced a
 * 1.78 MB JavaScript chunk that had to be downloaded *and* evaluated as
 * object literals before the Filing Cabinet, Board Meetings page, or any
 * template picker could render - seconds of blocked main thread on a phone.
 * This index is 28% of that, ships as one JSON file (parsed by the native
 * JSON parser rather than the JS parser), and comes pre-sorted by title.
 */
export interface TemplateMeta {
  id: string;
  category: string;
  categoryId: string;
  subcategory: string;
  subcategoryId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  tags: string[];
  fieldCount: number;
  requiresApproval: boolean;
}

export const ALL_TEMPLATES: TemplateMeta[] = templateIndex as TemplateMeta[];

const byId = new Map(ALL_TEMPLATES.map((t) => [t.id, t] as const));

/** Synchronous metadata lookup - safe to call during render. */
export function getTemplateMeta(id: string): TemplateMeta | undefined {
  return byId.get(id);
}

/**
 * Full template definitions are plain static files under `public/templates/`,
 * one per id, written by `npm run build:template-index`.
 *
 * They deliberately do not go through the bundler. `import.meta.glob` - eager
 * or lazy - puts all 1111 of them into the module graph, which costs either a
 * 1.78 MB eagerly-evaluated chunk or ~140 kB of import thunks and 1111 extra
 * chunks. Because the filename is the id, the URL needs no lookup map at all,
 * and the browser parses the response with its native JSON parser.
 */
const TEMPLATE_ASSET_BASE = `${import.meta.env.BASE_URL}templates/`;

const loadedCache = new Map<string, DocumentTemplate>();
const inFlight = new Map<string, Promise<DocumentTemplate | undefined>>();

/** Loads a template's full definition (fields + body), fetching it on first
 * use and caching it after. Returns undefined for an unknown id. */
export function loadTemplate(id: string): Promise<DocumentTemplate | undefined> {
  const cached = loadedCache.get(id);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(id);
  if (pending) return pending;
  const promise = fetch(`${TEMPLATE_ASSET_BASE}${encodeURIComponent(id)}.json`)
    .then((res) => (res.ok ? (res.json() as Promise<DocumentTemplate>) : undefined))
    .then((template) => {
      if (template) loadedCache.set(id, template);
      return template;
    })
    .catch(() => undefined)
    .finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  return promise;
}

/** Warms the cache for templates the player is likely to open next, without
 * blocking anything that is already rendering. */
export function prefetchTemplates(ids: string[]): void {
  for (const id of ids) {
    if (!loadedCache.has(id) && !inFlight.has(id)) void loadTemplate(id);
  }
}

/** A template already pulled in this session, if any - lets callers that
 * can't await (render paths) opportunistically use one. */
export function getLoadedTemplate(id: string): DocumentTemplate | undefined {
  return loadedCache.get(id);
}

/** Browse-level view of a template we already hold in full - custom
 * (company-built) templates and the pinned Blank Page, which never live in
 * the generated index. */
export function metaFromTemplate(t: DocumentTemplate): TemplateMeta {
  return {
    id: t.id,
    category: t.category,
    categoryId: t.categoryId,
    subcategory: t.subcategory,
    subcategoryId: t.subcategoryId,
    title: t.title,
    description: t.description,
    estimatedMinutes: t.estimatedMinutes,
    difficulty: t.difficulty,
    tags: t.tags,
    fieldCount: t.fields.length,
    requiresApproval: t.fields.some((f) => f.type === "signature"),
  };
}

export function searchTemplates<T extends { title: string; description: string; category: string; subcategory: string; tags: string[] }>(
  templates: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter((t) => {
    const haystack = [t.title, t.description, t.category, t.subcategory, ...t.tags]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
