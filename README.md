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
- **Blank Page**: an always-pinned entry above the category tree that opens
  a template with just one wide-open field — write anything, no structure
  imposed.
- **Drag-and-drop template builder**: build your own document from scratch
  by dragging field blocks (Text, Paragraph, Date, Number, Currency,
  Checkbox, Dropdown, Signature) onto a canvas, reordering by drag, and
  editing each field's label/placeholder/required/options inline, with a
  live preview alongside. Fill it out immediately or save it to "My Custom
  Templates" (stored in your browser) to reuse or assign to coworkers later.
- **Game-first onboarding**: pick "Create a game" or "Join a game" before
  anything else, then set up your identity (display name + email handle) —
  you get a one-time join code (no real email involved) that logs you back
  into the same account on any device.
- **No email/password** — the join code above is the whole login, no
  password to remember.
- **Multiplayer companies** (Supabase-backed): create a company (you become
  Owner) or join one with an invite code. Every member has a custom job
  title and a numeric level — anyone can assign or manage someone with a
  strictly lower level than their own.
- **Pre-start lobby**: a new game doesn't drop you straight into the office.
  The Owner lands in a waiting room showing the company's Main Code and the
  players who've joined so far, and only enters the game (for everyone) by
  clicking "Start Game" — join at your own pace first.
- **Main + sub invite codes**: every company has one Main Code (joins as a
  base-level Employee) plus as many role-granting sub codes as the Owner
  wants to create from the lobby — each one assigns a specific job title
  and level the moment someone joins with it.
- **Boss-built custom tasks**: from the Company tab, a manager can either
  assign an existing template or open the drag-and-drop builder to make a
  brand-new task on the spot. Either way, a "Set Task Details" step lets
  them pick a due date and a payout before it's assigned directly to a
  coworker (or themselves) — no premade template required.
- **Corporate Updates**: a company-wide news/announcements feed. The Owner
  posts a headline + body from a new "📰 Corporate Updates" tab and every
  member sees it appear live.
- **Work assignment with a live document preview**: a manager can assign any
  template to someone they outrank; anyone can request a template be sent
  to themselves. The fill-out modal shows the actual rendered document
  (monospace, letterhead-style) updating live next to the form, for both
  filling it out and reviewing someone else's submission before approving.
  Templates with a signature field require sign-off from someone who
  outranks the assignee before they're marked complete (self-requested
  work is exempt, so a solo owner never gets stuck with nobody able to
  approve it).
- **Send to person**: reassign an open document to any coworker.
- **In-game email/Inbox**: email coworkers or any of the 8 AI Clients.
  Emailing a client gets you a reply — AI-written via your local LLM if one
  is reachable, otherwise a short canned reply so it still works.
- **Board Meetings**: schedule one, everyone RSVPs, and "Generate Minutes"
  drops a pre-filled Board Meeting Minutes document into your Work queue.
- **Money**: a wallet on your account (`profiles.money`), credited on
  completion — correctly even when a different person (your manager)
  is the one who approves the work.
- **Career XP & Levels**: a separate progression track from Money
  (`profiles.xp`) — completing a task also grants XP based on its
  difficulty, and your Career Level (shown in the header) rises every
  100 XP regardless of your company job rank.
- **Activity Feed**: a live, human-readable feed of the company's audit
  trail (who requested/assigned/submitted/approved/rejected/reassigned
  which document, and when) — built entirely from data already recorded
  in `document_events`.
- **Leaderboard**: ranks every company member by Money, tasks completed,
  and Career Level.
- **Document Archive**: the full company-wide history of completed
  documents, searchable by title and filterable by who did the work (the
  Work tab only ever shows your last 10).
- **AI Clients**: a roster of 8 recurring client personas. With a local LLM
  (e.g. [Ollama](https://ollama.com)) running at the default address, each
  client hands out a live, dynamically generated paperwork request and
  supports a negotiation chat (the client can counter-offer
  payout/deadline). Without one reachable, each client falls back to a
  static preview request so the feature still works end-to-end. There's no
  Settings screen — it always targets `http://localhost:11434` (Ollama's
  default) with the `llama3.1` model; run your local server there.

Not yet built: an avatar/office world, XP/leveling, cosmetics, a full
document archive.

## Getting started

```bash
npm install
npm run dev
```

Choose "Create a game" or "Join a game" first, then pick a display name and
an email handle (no real email needed) — you'll get a one-time code that
logs you back in later. Creating starts a new company (you're the Owner) and
drops you in a lobby with your Main Code, where you can create role-granting
sub codes and wait for friends to join before clicking "Start Game." Joining
uses a Main Code or sub code a friend shared with you.

To use AI Clients' live mode and AI-written email replies, run a local,
OpenAI-compatible LLM server on this machine — [Ollama](https://ollama.com)
is the easiest option (`ollama pull llama3.1 && ollama serve`). No API key,
account, Settings screen, or payment required; the app always calls
`http://localhost:11434` directly from your browser. Without a local LLM
running, AI Clients and client email replies fall back to static preview
content so the rest of the game still works.

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
loaded client-side via `import.meta.glob`. Accounts, companies, ranks, work
items, emails, and board meetings live in Supabase (Postgres + Auth +
Realtime) under Row Level Security. Per-browser conveniences (favorites,
recently used, custom templates you've built) stay in `localStorage`;
anything another person's actions need to affect (Money, rank, document
status, emails) lives server-side. AI Clients calls a local, OpenAI-
compatible LLM server (Ollama, at its default address) directly from the
browser — no cloud API, key, or config screen involved.

## Session-code login (no email/password)

Signup calls a Supabase Edge Function (`provision-account`) that creates a
pre-confirmed account under the hood using a synthetic address
(`oq-<code>@officequest.local`) and the join code itself as the password —
none of that is ever shown to the player. The player only ever sees their
display name, their chosen email *handle* (`handle@officequest.mail`, the
in-game identity used for the Inbox feature — a separate, purely cosmetic
concept from the technical synthetic address), and their join code. Logging
back in re-derives the same synthetic email from the code and signs in
normally — no Edge Function needed for that half.

## Multiplayer model

- **Companies**: created with a random 6-character Main Code (`invite_code`)
  and start `started = false`. The creator becomes Owner at level 100 and
  lands in a lobby; joining via the Main Code makes you an Employee at
  level 1. The Owner can also mint role-granting sub codes
  (`company_invite_codes`: code, job title, level) from the lobby — joining
  with one assigns that exact role instead. A `resolve_invite_code`
  security-definer RPC looks up either kind of code (a not-yet-a-member
  joiner has no `company_id` yet, so RLS alone can't let them read the
  companies/company_invite_codes tables directly). The game only becomes
  visible to everyone once the Owner sets `started = true`.
- **Ranks**: fully custom per company — any member can rename job titles and
  set numeric levels for anyone with a level below their own (enforced both
  client-side and by RLS).
- **Work items** (`documents` table): created either as `requested` (you
  asking for a template yourself) or `assigned` (someone who outranks you
  assigning it to you), optionally carrying a manager-set `due_at` and
  `payout_override` (falls back to a flat per-difficulty amount when unset).
  Submitting a non-signature template completes it immediately and pays
  you; submitting a signature-bearing assigned template moves it to
  `pending_approval` until someone who outranks the assignee approves
  (→ paid + completed) or rejects (→ back to `assigned` with a note) it.
- **Corporate Updates** (`corporate_updates` table): company-wide posts,
  readable by every member but insertable only by the company's Owner
  (enforced by RLS, not just the UI).
- **Emails** (`emails` table): sender/recipient can each be either a company
  member or an AI Client (by static id) — a client "reply" is just a second
  row your own client inserts on the client's behalf right after you send.
- **Board Meetings** (`board_meetings` + `board_meeting_rsvps`): anyone can
  schedule one; every current member gets an `invited` RSVP row seeded at
  creation time. "Generate Minutes" creates a self-requested document from
  the `meeting-minutes-08` ("Board Meeting Minutes") template, pre-filled
  with the attendee list.
- **Realtime**: your profile, your company's documents, emails, and board
  meetings all update live via Supabase Realtime subscriptions, so anything
  a coworker does shows up without a refresh.

## Build order

1. Template data + browser — done
2. Money stat + AI Clients (dynamic requests, negotiation chat) — done
3. Multiplayer: accounts, companies, ranks, work assignment, approvals — done
4. Session-code login, in-game email, board meetings — done
5. Live document preview in the fill-out/approval modal — done
6. Drag-and-drop template builder, pre-start lobby + sub codes, Corporate
   Updates, boss-assigned task details — done
7. Document archive, Activity Feed, Leaderboard, Career XP/levels — done
8. Avatar & office world
9. Further polish (cosmetics, streaks, a real dashboard)
