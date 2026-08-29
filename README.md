# Office Quest

A multiplayer "cozy job simulator" — fill out realistic office paperwork
(memos, invoices, HR forms, reports) pulled from a large categorized
template library, earn Money, and grow your rank inside a shared company
with real coworkers.

## Status

- **Template library: 1111 templates** across 11 categories (the original
  10 plus a "Blank & Freeform" pack) — see [Generating templates](#generating-the-template-library)
  for how the library was built.
- **Filing-cabinet browsing UI**: category tree with live counts, search,
  favorites, recently used, template detail modal.
- **Multiplayer companies** (Supabase-backed): sign up, create a company
  (you become Owner) or join one with an invite code. Every member has a
  custom job title and a numeric level — anyone can assign or manage
  someone with a strictly lower level than their own.
- **Work assignment**: a manager can assign any template to someone they
  outrank; anyone can request a template be sent to themselves. Templates
  with a signature field require sign-off from someone who outranks the
  assignee before they're marked complete (self-requested work is exempt,
  so a solo owner never gets stuck with nobody able to approve it).
- **Send to person**: reassign an open document to any coworker.
- **Money**: a wallet on your account (`profiles.money`), credited on
  completion — correctly even when a different person (your manager)
  is the one who approves the work.
- **AI Clients**: a roster of 8 recurring client personas. With a free Groq
  API key configured in Settings, each client hands out a live, dynamically
  generated paperwork request and supports a negotiation chat (the client
  can counter-offer payout/deadline). Without a key, each client falls back
  to a static preview request so the feature still works end-to-end.

Not yet built: a live-preview fill-out screen (the current fill-out form is
plain inputs, no rendered document preview), an avatar/office world,
XP/leveling, cosmetics.

## Getting started

```bash
npm install
npm run dev
```

Sign up, then either create a company (you're the Owner) or join one with a
coworker's invite code (shown on their Company tab). To use AI Clients' live
mode (dynamic requests + negotiation chat), open Settings (⚙️ in the header)
and paste a free Groq API key from [console.groq.com/keys](https://console.groq.com/keys)
— no payment required. It's stored only in your browser's local storage and
used only for direct browser→Groq calls.

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
loaded client-side via `import.meta.glob`. Accounts, companies, ranks, and
work items live in Supabase (Postgres + Auth + Realtime) under Row Level
Security — see `supabase` migrations applied to the `office-quest` project
for the full schema. Per-browser conveniences (favorites, recently used, the
Groq key) stay in `localStorage`; anything another person's actions need to
affect (Money, rank, document status) lives server-side. AI Clients calls
Groq's free-tier API directly from the browser with a user-supplied key.

## Multiplayer model

- **Companies**: created with a random 6-character invite code. The creator
  becomes Owner at level 100; joining via code makes you an Employee at
  level 1.
- **Ranks**: fully custom per company — any member can rename job titles and
  set numeric levels for anyone with a level below their own (enforced both
  client-side and by RLS).
- **Work items** (`documents` table): created either as `requested` (you
  asking for a template yourself) or `assigned` (someone who outranks you
  assigning it to you). Submitting a non-signature template completes it
  immediately and pays you; submitting a signature-bearing assigned template
  moves it to `pending_approval` until someone who outranks the assignee
  approves (→ paid + completed) or rejects (→ back to `assigned` with a
  note) it.
- **Realtime**: your profile and your company's documents update live via
  Supabase Realtime subscriptions, so an assignment or approval from a
  coworker shows up without a refresh.

## Build order

1. Template data + browser — done
2. Money stat + AI Clients (dynamic requests, negotiation chat) — done
3. Multiplayer: accounts, companies, ranks, work assignment, approvals — done
4. Fill-out live document preview + archive
5. Avatar & office world
6. Progression & polish (XP/levels, cosmetics, streaks, dashboard)
