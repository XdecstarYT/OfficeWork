# Office Quest

A browser-based "cozy job simulator" — fill out realistic office paperwork
(memos, invoices, HR forms, reports) pulled from a large categorized
template library, earn Money, and grow your in-game career.

## Status

- **Template library: 1111 templates** across 11 categories (the original
  10 plus a "Blank & Freeform" pack) — see [Generating templates](#generating-the-template-library)
  for how the library was built.
- **Filing-cabinet browsing UI**: category tree with live counts, search,
  favorites, recently used, template detail modal.
- **Money stat**: a tracked player stat (`src/lib/playerState.ts`), shown in
  the header, earned by completing AI Client requests.
- **AI Clients**: a roster of 8 recurring client personas. With an Anthropic
  API key configured in Settings, each client hands out a live, dynamically
  generated paperwork request and supports a negotiation chat (the client
  can counter-offer payout/deadline). Without a key, each client falls back
  to a static preview request so the feature still works end-to-end.

Not yet built: the actual fill-out form + live document preview + archive
(planned next), avatar/office world, XP/leveling, cosmetics.

## Getting started

```bash
npm install
npm run dev
```

To use AI Clients' live mode (dynamic requests + negotiation chat), open
Settings (⚙️ in the header) and paste an Anthropic API key. It's stored only
in your browser's local storage and used only for direct browser→Anthropic
calls — fine for this local single-player game, not a pattern to copy into
a real multi-user product.

## Generating the template library

There are two independent generators. Both write JSON files under
`/templates/{category}/{subcategory}/{id}.json` and are idempotent — a
subcategory that already has its target file count is skipped.

**Offline (no API key, instant)** — the one actually used to build the
current library. Builds templates procedurally from per-subcategory
profiles (`scripts/offline/profiles.ts`) and a shared document-shape
composer (`scripts/offline/compose.ts`). Variants within a subcategory
share field structure/body shape and differ in title/description/tags —
a deliberate trade of per-template bespokeness for reaching scale with no
API cost:

```bash
npx tsx scripts/generate-templates-offline.ts
npx tsx scripts/generate-templates-offline.ts --per-subcategory=5   # fewer per subcategory
```

**API-driven (`ANTHROPIC_API_KEY` required, higher quality/cost)** — calls
Claude to write a genuinely distinct batch of templates per subcategory:

```bash
export ANTHROPIC_API_KEY=sk-ant-...

# smoke test: 3 templates per subcategory, one category
npx tsx scripts/generate-templates.ts --categories=correspondence --per-subcategory=3

# everything
npx tsx scripts/generate-templates.ts
```

The `finance-accounting/expense-reports` and `blank-freeform/blank-documents`
subcategories are hand-authored (not generator output) and are skipped by
both scripts since they're already at their target count.

## Tech stack

React + Vite + TypeScript + Tailwind CSS v4. Templates are static JSON
loaded client-side via `import.meta.glob`. Player state (Money, favorites,
recently used, API key, active client requests) is in `localStorage`;
the planned document archive will move to IndexedDB. No backend, no
accounts — AI Clients calls the Anthropic API directly from the browser
with a user-supplied key.

## Build order

1. Template data + browser — done
2. Money stat + AI Clients (dynamic requests, negotiation chat) — done
3. Fill-out experience (form + live preview + archive) — next
4. Avatar & office world
5. Progression & polish (XP/levels, cosmetics, streaks, dashboard)
