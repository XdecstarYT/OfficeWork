# Office Quest

A browser-based "cozy job simulator" — fill out realistic office paperwork
(memos, invoices, HR forms, reports) pulled from a large categorized
template library, earn XP, and grow your in-game career.

## Status: Phase 1 — Template data + browser

- Taxonomy of 10 categories x ~10 subcategories (`src/data/taxonomy.ts`)
- Template data model (`src/types/template.ts`)
- Re-runnable seed script that generates templates via the Anthropic API
  (`scripts/generate-templates.ts`)
- A hand-authored validation batch (10 templates in
  `templates/finance-accounting/expense-reports/`) confirming format/quality
- Filing-cabinet browsing UI: category tree, search, favorites, recently used

## Getting started

```bash
npm install
npm run dev
```

## Generating the template library

Seed generation calls the Anthropic API and writes JSON files under
`/templates/{category}/{subcategory}/{id}.json`. It's idempotent — a
subcategory that already has its target file count is skipped.

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# smoke test: 3 templates per subcategory, one category
npx tsx scripts/generate-templates.ts --categories=correspondence --per-subcategory=3

# full run for a category (10 templates per subcategory, the default)
npx tsx scripts/generate-templates.ts --categories=human-resources

# everything (~1000 templates across all 10 categories)
npx tsx scripts/generate-templates.ts
```

## Tech stack

React + Vite + TypeScript + Tailwind CSS v4. Templates are static JSON
loaded client-side via `import.meta.glob`. Player progress/archive will be
stored locally in IndexedDB (Phase 2+). No backend, no accounts.

## Build order

1. **Template data + browser** — done (this phase)
2. Fill-out experience (form + live preview + archive)
3. Avatar & office world
4. AI coach + custom templates
5. Progression & polish, full ~1000-template generation run
