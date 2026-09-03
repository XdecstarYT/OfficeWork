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
  Checkbox, Dropdown, Signature) onto a canvas — or tapping them, since
  touch devices don't fire drag events at all — reordering by drag or ▲▼
  buttons, and editing each field's label/placeholder/required/options
  inline, with a live preview alongside. Fill it out immediately or save
  it as a **shared company template** — it's stored in Supabase, not your
  browser, so the moment you save it your whole team can see and use it
  from their own Filing Cabinet too, not just you.
- **Mobile-friendly**: the Filing Cabinet's category sidebar collapses
  into a tap-to-expand accordion below `md`, the template builder's field
  palette becomes a horizontally-scrolling strip, and every modal with a
  viewport-relative max-height actually scrolls internally instead of
  silently overflowing past the screen edge or the buttons below it.
- **Game-first onboarding**: pick "Start a New Game," "Join a Game," or
  "Play Solo" before anything else, then set up your identity (display
  name + email handle) — you get a one-time join code (no real email
  involved) that logs you back into the same account on any device.
- **No email/password** — the join code above is the whole login, no
  password to remember.
- **Notifications**: a 🔔 bell in the header (badge count = total across
  all categories) opens a dropdown of what needs your attention — work
  awaiting your approval, unread emails, and your own overdue work — each
  row jumping straight to the right tab when clicked.
- **Single-player mode**: "Play Solo" (from the entry screen, or the
  "🧍 Solo" tab if you're a returning player between companies) creates a
  company that's already started — no waiting room, no invite code to
  share, straight into the game as its Owner. It's not a separate mode
  under the hood: a solo game is a perfectly ordinary company that happens
  to start pre-started, so its invite code still works if you decide to
  invite friends later.
- **Multiplayer companies** (Supabase-backed): create a company (you become
  Owner) or join one with an invite code. Every member has a custom job
  title and a numeric level — anyone can assign or manage someone with a
  strictly lower level than their own.
- **Boss powers**: a manager can award an ad-hoc money bonus to any member
  they outrank (individually, or "Bonus Everyone" to give the same amount
  to everyone they outrank in one click), or kick a member from the company
  entirely (they're reset to a base Employee, free to rejoin another
  company with an invite code).
- **Company Settings**: the Owner can rename the company and regenerate the
  main invite code (invalidating the old one) from a "⚙️ Settings" panel on
  the Company tab.
- **Employee of the Month**: a one-click Owner action that finds whoever's
  completed the most work (excluding the Owner), awards them a $100 bonus,
  and automatically posts a Corporate Update announcing it.
- **Pre-start lobby**: a new game doesn't drop you straight into the office.
  The Owner lands in a waiting room showing the company's Main Code and the
  players who've joined so far, and only enters the game (for everyone) by
  clicking "Start Game" — join at your own pace first.
- **Main + sub invite codes**: every company has one Main Code (joins as a
  base-level Employee) plus as many role-granting sub codes as the Owner
  wants to create from the lobby — each one assigns a specific job title
  and level the moment someone joins with it.
- **Boss-built custom tasks**: from the Company tab or straight from the
  Filing Cabinet, a manager can either assign an existing template or open
  the drag-and-drop builder to make a brand-new task on the spot. Either
  way, a "Set Task Details" step lets them pick a due date and a payout,
  check **"Require review by boss"** to force manager sign-off before the
  task is marked complete even when the template has no signature field,
  pre-fill any of the template's fields with data they already know (with a
  live preview), and attach freeform **Reference Data** — e.g. a price
  sheet of item/cost rows — that shows up as a read-only panel for whoever
  does the work. A final **Review** step then summarizes everything
  (assignee, due date, payout, boss-review requirement, reference data,
  pre-filled fields, and the live document preview) before it's sent.
- **Assign from the Filing Cabinet**: browsing the Filing Cabinet isn't
  read-only — hitting "Start" on any template lets you pick who it's for
  (yourself, or anyone you outrank) and goes straight into the same Set
  Task Details → Review flow, without a detour through the Company tab.
- **Corporate Updates**: a company-wide news/announcements feed. The Owner
  posts a headline + body from a new "📰 Corporate Updates" tab and every
  member sees it appear live. The poster (or the Owner) can delete a post.
- **Work assignment with a live document preview**: a manager can assign any
  template to someone they outrank; anyone can request a template be sent
  to themselves. The fill-out modal shows the actual rendered document
  (monospace, letterhead-style) updating live next to the form, for both
  filling it out and reviewing someone else's submission before approving.
  Templates with a signature field require sign-off from someone who
  outranks the assignee before they're marked complete (self-requested
  work is exempt, so a solo owner never gets stuck with nobody able to
  approve it). Overdue work (past its due date) is flagged with a red
  "⏰ Overdue" badge in My Work, plus a running overdue count next to the
  page title.
- **Send to person**: reassign an open document to any coworker.
- **In-game email/Inbox**: email coworkers or any of the 8 AI Clients.
  Emailing a client gets you a reply — AI-written via your local LLM if one
  is reachable, otherwise a short canned reply so it still works.
- **Board Meetings**: schedule one, everyone RSVPs, and "Generate Minutes"
  drops a pre-filled Board Meeting Minutes document into your Work queue.
  The organizer (or the Owner) can cancel a meeting.
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
  and Career Level, plus an **Achievements** section awarding badges
  (First Task, Workhorse, Legend, Well Off, Rich, Rising Star, Veteran,
  One Month In) computed from their existing stats — no separate tracking
  needed.
- **Document Archive**: the full company-wide history of completed
  documents, searchable by title and filterable by who did the work (the
  Work tab only ever shows your last 10). Click any entry to open it and
  hit **"🖨 Print / Save as PDF"** for a print-friendly view of just the
  rendered document — a real, keepable artifact out of the game.
- **AI Clients**: a roster of 8 recurring client personas that hand out
  live, dynamically generated paperwork requests and support a negotiation
  chat (the client can counter-offer payout/deadline). Powered by a hosted
  Groq-backed AI (see [AI architecture](#ai-architecture) below) — works
  for every player automatically, no local setup required. If the hosted
  service is ever unreachable, it falls back to a locally-configured
  OpenAI-compatible server (e.g. [Ollama](https://ollama.com)), then to a
  static preview request, so the feature always does *something*.
  Completing work for a client builds a relationship (tracked locally in
  your browser): 1 completion earns "Familiar Face", 5 earns "Favorite
  Client", 10 earns "Trusted Partner" — shown as a badge on their card.
- **AI Draft Assist**: while filling out any document, hit "✨ AI Draft" to
  have the AI suggest realistic values for the fields you haven't filled
  in yet, using the document's title and any manager-provided reference
  data as context. It never overwrites a field you've already typed
  into — only fills the gaps.
- **Dashboard**: the new default landing tab — a home base tying the rest
  of the game together at a glance: stat tiles (Money, Career Level, Team
  Size, Tasks Completed), a "🔔 Needs Your Attention" section mirroring the
  notification bell, Quick Actions to jump straight into the Filing
  Cabinet/AI Clients/My Work/Leaderboard, the latest Corporate Update, and
  your 5 most recent Activity Feed entries.
- **AI Coworkers**: hire an AI-personality NPC teammate onto your Company
  tab roster (6 personas to choose from, each with its own job title,
  starting level, personality, and one-time hire cost deducted from your
  Money). Email one from the Inbox like any other coworker and get a real
  AI-written reply in their voice (falling back to a canned reply if the
  AI is unreachable, same as clients). From the Inbox, "🤖 Ask to Draft"
  lets you pick a hired coworker and a template, and they'll draft it and
  send you their take by email — a flavor/inspiration draft, not a
  document assigned to them (NPCs don't do real paperwork). A manager can
  let one go from the Company tab at any time.
- **Random Corporate Events**: the Owner can hit "🎲 Trigger Event" on the
  Corporate Updates tab to roll one of ten flavor events (a mix of
  good, bad, and neutral) that applies a small Money/XP delta to every
  member and posts the result as a Corporate Update — a bit of unpredictable
  company-wide flavor, deliberately not skewed positive so it isn't a
  reliable way to farm Money.
- **Departments**: tag any member with a department (Executive, Sales &
  Marketing, Finance & Accounting, Human Resources, IT & Technical,
  Operations, Customer Service, Legal & Compliance, or none) from the same
  "Edit Rank" panel used for job title/level — shown as a pill next to
  their name on the Company roster and the Leaderboard. Beyond the built-in
  list, the Owner can add **Custom Departments** from Company Settings —
  they show up everywhere the built-in ones do and can be removed later
  (members already tagged with a removed department just keep the label).
- **Promotions**: a distinct "🎉 Promote" button appears next to any member
  you outrank by more than one level. It walks you through picking their
  new level and title, then sends them an AI-generated congratulatory
  email announcing the promotion (falling back to a canned message if the
  AI is unreachable).
- **Custom AI Coworkers**: the "Hire an AI Coworker" modal isn't limited to
  the 6 built-in personas — "🎨 Create Custom Coworker" lets anyone design
  their own (name, avatar emoji, job title, level, hire cost, personality),
  with an "✨ AI Suggest" button that brainstorms a full persona idea from
  an optional one-line hint you can then edit before saving. Once created
  it's shared company-wide in the hire list, just like a stock persona —
  and behaves identically everywhere (email replies, "Ask to Draft") once
  hired. The creator or the Owner can delete an unhired custom persona.
- **Custom AI Clients**: the Owner can add a company-shared custom client
  from the AI Clients tab ("🎨 Add Custom Client") — name, company, avatar,
  personality, category affinity, and payout range, also with an "✨ AI
  Suggest" brainstorming helper. A custom client hands out fully AI-generated
  requests and supports negotiation exactly like the 8 built-in ones.
- **AI Task Generator**: the drag-and-drop template builder (used for both
  custom company tasks and personal templates) has a "✨ Generate with AI"
  option — describe the document in one line and the AI drafts the whole
  thing (title, fields, and body) into the builder for you to review, tweak,
  and save or assign like any hand-built template.
- **Actual Days**: every company tracks an in-game Day counter. The Owner
  can "▶ Start Day" and "⏹ End Day" from the Company tab; ending a day
  automatically posts a Corporate Update recap (tasks completed, money
  earned company-wide, and the day's top performer) before the next day can
  start.
- **Career Mode**: an optional milestone track (toggle it on from Company
  Settings — built with solo play in mind, but works for any company) that
  appears on the Dashboard once enabled. Ten milestones (first task, task
  count and Money thresholds, Career Level thresholds, hiring your first AI
  coworker, reaching Day 5, posting your first Corporate Update) each unlock
  a one-time Money/XP reward you claim with a button once you've reached it.
- **Assign Work to AI Coworkers**: hired AI coworkers aren't just for email
  and drafts — from the Company tab, "📋 Assign Work" lets you hand one a
  template directly. They draft and complete it immediately (no payout —
  they're salaried by their hire cost, not per task) and it shows up
  properly credited to them in the Archive.
- **Company branding**: give your company an emoji and a motto from Company
  Settings, with an "✨ Generate Motto" button that brainstorms one via AI.
- **Custom AI personas can now be created and hired/added by anyone**, not
  just picked from the built-in rosters — see AI Coworkers and AI Clients
  above.
- **Quality-of-life pass** across the app: sort/filter controls (Filing
  Cabinet by name/time/difficulty, My Work overdue-only, Archive by
  date range/payout/AI-vs-human, Corporate Updates and Activity Feed by
  author, Leaderboard by department, AI Clients by category), search boxes
  (Inbox, Corporate Updates, Board Meetings), pinnable Corporate Updates,
  favoritable AI Clients, CSV export (Leaderboard, Archive), a
  time-of-day-aware Dashboard greeting with a "this week" stat and an
  upcoming-meeting preview, an "N" keyboard shortcut for notifications, and
  confirmation prompts before destructive actions (sign out, leave company,
  delete a custom template).

- **Assign work from the Filing Cabinet to AI Coworkers**: the "🤖 Assign to
  AI Coworker" action isn't limited to the Company tab — any template's
  detail modal in the Filing Cabinet (built-in or a company custom
  template) offers it too, going straight into the same hired-coworker
  picker and draft-and-complete flow.
- **Payroll**: set a per-level salary rate from Company Settings ("💵
  Payroll"). Ending the day pays every member `level × rate` out of thin
  air (not deducted from anyone), folded into that day's Corporate Update
  recap alongside the existing tasks-completed/money-earned/top-performer
  summary.
- **Performance Reviews**: anyone can leave a 1–5 star review with written
  comments for someone they outrank ("📝 Review" on the Company roster), with
  an "✨ AI Draft" button that writes comments matching the star rating from
  the employee's actual stats (tasks completed, money earned). Reviews are
  permanent — no editing or deleting — and a review-count badge on each
  member opens their full history.
- **Time Off**: request a date range with a reason ("🌴 Request Time Off" on
  the Company tab); anyone who outranks you can Approve or Deny it. Approved
  requests show a "🌴 On Leave" badge on the member's roster row for as long
  as today falls in that range.
- **AI Client Contracts**: an owner can offer a client a multi-task contract
  (a title, a task count, and a bonus payout) from their AI Clients card —
  a visible progress bar tracks completions, and whoever finishes the task
  that completes the contract collects the bonus automatically.
- **Office Shop**: spend company Money on one-time equipment (☕ Espresso
  Machine, 💺 Ergonomic Chairs, 🪑 Standing Desks, 🖨️ Fast Printers, 🖥️ Dual
  Monitors, 🖧 Server Upgrade) from a new "🛒 Office Shop" section on the
  Company tab — each item adds a permanent payout-bonus percentage that
  stacks with every other item owned and applies to every task completed
  company-wide from then on.
- **Random Employee Events**: the Owner can hit "🎲 Random Employee Event" on
  the Company tab to roll a flavor event (a mix of good, bad, and neutral)
  for one random team member — a small Money/XP delta plus an in-game email
  explaining what happened, distinct from the company-wide Random Corporate
  Events on the Corporate Updates tab.
- **Smart Assign**: from any template's detail modal in the Filing Cabinet, a
  manager can hit "🪄 Smart Assign" to let the AI pick the best-fit human
  teammate or hired AI coworker for that task — weighing job title and
  personality fit against who's currently least loaded with open work — and
  assign it immediately. If the AI is unreachable it still assigns, falling
  back to whoever has the fewest open tasks rather than failing outright.
- **Company Achievements**: completing enough documents company-wide
  unlocks a badge (🌱 Startup at 5, 📈 Growing Concern at 25, 🏢 Established
  Firm at 75, 🚀 Powerhouse at 150, 👑 Legendary at 300) — shown as a row of
  earned/locked pills at the top of the Company tab, distinct from the
  per-member badges on the Leaderboard. Each newly-earned badge is also
  announced as a Corporate Update.
- **Company Calendar**: a new "🗓 Calendar" tab aggregates everything with a
  date on it — upcoming Board Meetings, documents with an approaching due
  date, and approved time off — into a single day-grouped agenda, so
  there's one place to see what's coming up instead of checking three tabs.

### 50 more features

A large QoL and small-feature pass across nearly every tab:

**Global**
- **Command palette** — ⌘/Ctrl+K opens a searchable list to jump straight to any tab.
- **Keyboard shortcuts help** — press `?` for a cheat sheet (⌘K, N, /, Esc).
- **Notification count in the browser tab title** — e.g. "(3) Office Quest", so it's visible from another tab/window.
- **Preferences panel** (⚙️ in the header): a Text Size setting (Compact/Normal/Large, scales the whole app), a notification chime toggle (plays a short tone when your pending-approval/unread/overdue count goes up), and a "Reset local preferences" button that clears favorites/recents/drafts without touching your game data.
- **Draft autosave** — field values you're typing into a document persist to this browser if you navigate away before submitting, and restore automatically next time you open it.

**My Work**
- **Approve All** — a manager with multiple pending approvals can clear them in one click.
- **Sort** by due date, payout, or newest.
- **Running payout total** for your open work, shown next to the sort control.
- **Copy Text** — copies the rendered document body to your clipboard from the fill-out modal.
- **Dismiss overdue** — hide the ⏰ badge on a specific item for the rest of your session.

**Filing Cabinet**
- **🎲 Surprise Me** — opens a random template from whatever's currently filtered.
- **Clickable tags** — click a `#tag` in a template's detail view to filter the whole cabinet by it.
- **🧬 Duplicate** — clones any template (built-in or custom) into the builder to edit as your own.
- **🔥 Popular With Your Team** — a panel of the 5 most-completed templates company-wide.
- **`/` to focus search**, from anywhere on the page.
- **Clear** button for the Recently Used list.

**Inbox**
- **Flag** important emails (⭐, received mail only) and filter to Flagged Only.
- **Archive** an email out of the main list, with a Show Archived toggle to bring it back.
- **Quick-phrase picker** when composing — insert a canned line ("Thanks for the update", "On it", ...) instead of typing it out.

**Company**
- **💬 Shoutbox** — a lightweight realtime company-wide chat, separate from email and Corporate Updates.
- **About Me** — a short bio anyone can set on themselves (ℹ️ next to their name) and everyone can view.
- **Achievement progress bar** — how many documents until the next company badge.
- **👋 Nudge** — email a canned reminder to a teammate who currently has overdue work.
- **Week in Review** — a bonus Corporate Update summarizing the last 7 real-world days, posted automatically every 7th Day End.
- **🗂 Org Chart** — a simple level-grouped view of the whole roster.
- **Daily mood check-in** — pick an emoji each day, shown next to your name on the roster.
- **All-time payroll paid** — a running total shown in Company Settings once payroll's been used.

**Board Meetings**
- **Repeat weekly** — schedule a recurring meeting for up to 52 weeks at once.
- **Browser reminders** — opt in to a notification 15 minutes before a meeting starts (this tab needs to stay open).
- **📥 .ics export** — download any meeting to import into an external calendar app.

**Corporate Updates**
- **Emoji reactions** (👍 🎉 ❤️ 😂) on any post.
- **Category tag** (Announcement/Policy/Celebration/Other) chosen when posting, shown as a pill.
- **Filter by category**, alongside the existing author filter.

**Activity Feed**
- **Export CSV** of whatever's currently filtered.
- **Load More** — fetches the next page instead of stopping at a fixed cap.

**Leaderboard**
- **This Week / All Time** toggle for the Tasks Completed ranking.
- **Your Rank** — a one-line summary of your position across Money, Tasks, and Career Level.

**Archive**
- **Star** documents as important, with a Starred Only filter.
- **Export JSON** — a full backup of the currently-filtered documents (title, payout, who did it, field values), alongside the existing CSV export.
- **Running payout total** for whatever's currently filtered.

**AI Clients**
- **Satisfaction meter** — an active contract's completion rate, or a scale based on your relationship tier if there's no contract yet.
- **Extend a contract** — add more tasks and/or bonus on top of an active one instead of waiting for it to finish.
- **Total earned from this client**, tracked locally per client.

**Dashboard**
- **Quote of the day** — the same one all day, for everyone.
- **Streak** — consecutive real-world days you've visited, shown as a stat tile.
- **Your Rank** — a quick "#X of N by Money" summary with a link to the full Leaderboard.
- **What's Next** — combines your next Board Meeting and your next due document into one card.

### ~190 more features

A much larger follow-up pass, organized by area. Roughly 20 batches, each typechecked, built, and committed independently.

**Global (app shell)**
- Local clock, session/daily playtime tracking, About + What's New (auto-shown once per version) modals.
- High-contrast mode, compact (icon-only) nav, Alt+←/→ tab cycling, Esc closes whichever dialog is open, away badge in the tab title after 10 idle minutes, copy-debug-info button.
- Pending time-off decisions now count toward the notification bell (🌴, deep-links to Company).

**My Work**
- Due-soon filter, relative due-date labels (`lib/time.ts`), title search, section header counts, est. XP per row, colored status pills, this-week completed/earnings summary.
- Remind (email nudge) on work you assigned to others; Clear Draft, field-completion progress, Copy JSON, and a read-only viewer for completed docs.

**Filing Cabinet**
- Estimated payout on every card, sort by payout, time-range filters, difficulty counts, grid/list view toggle, category breadcrumb, CSV export, Jump to Random Category, Expand/Collapse-all category tree, search-box clear button.

**Inbox**
- Reply/Forward (with quoting), a persisted compose draft, 1-day snooze, sender-type filter, sort order, Archive All Read, print/copy/mark-unread on an open email.

**Company**
- Export roster CSV, copy company summary/invite message, team money/level/streak/on-leave stats, streak + last-active badges per member, click a department chip to filter, Office Shop and Time Off header counts.

**Board Meetings**
- Countdown labels, who-hasn't-responded + expandable attendee list, copy summary, duplicate/reschedule, today-only filter, bulk .ics export, configurable reminder lead time.

**Corporate Updates**
- In-place editing (owner), reactor-name tooltips, category quick-filters with counts, trending sort, save/star an update locally, click a byline to filter by author.

**Activity Feed / Leaderboard / Archive**
- Relative timestamps, today-only and event-count filters, streak and badge-count leaderboards, an AI-coworker leaderboard, a "you're #1" banner, quick date-range presets, a Random document button, category badges.

**AI Clients**
- Client search/sort/"my clients only", typical payout range on every card, contract history modal, duplicate a custom client, total-earned stat, CSV export.

**Dashboard / Calendar**
- Team mood-of-the-day, streak-milestone callout, This Month stat tile, calendar filter chips ("only mine"), days-until labels, copy-agenda.

**Shared building blocks**
- `TemplateBuilder` gained per-field help text, default values, duplicate-field, and a live field-count/time/difficulty summary; `DocumentFieldForm` renders that help text and a textarea character counter everywhere it's used.
- Negotiation chat auto-scrolls and offers quick-reply chips; the assign/template/client-request modals all got Esc-to-close, copy-summary buttons, and (where relevant) a due-date preset row.
- The sign-up flow gained step-progress dots, a random company-name suggester, and a warning before closing the tab with an unsaved login code.

### Stock Market

- A **shared fictional ticker** — 16 fictional companies across sectors like
  Technology, Shipping, Finance, and Food & Beverage. Prices are a pure
  function of `(symbol, calendar day)`, computed client-side with a seeded
  PRNG (a slow sine-wave "personality" per stock layered with per-day
  noise) — so every player everywhere sees the exact same price on the same
  real-world day, with no server-side price history to maintain.
- **Buy and sell** with your own Money at the current price; a position's
  average cost updates on each additional buy, and a full sell closes it
  out. Both actions log to a personal trade history and a company-wide
  **Trading Floor** feed.
- **Portfolio view**: cash, holdings value, net worth, and unrealized
  gain/loss (in $ and %) at a glance, plus per-holding gain/loss.
- Search, sector filter, and sort (name/price/today's change/held-first),
  each stock showing a 14-day sparkline and today's % change.
- New tables: `stock_holdings` (one row per player per symbol, RLS-scoped to
  the owning player only) and `stock_transactions` (a trade log, visible to
  the trader and their current company, for the Trading Floor feed).

### Subsidiaries

- A company's owner can **found a subsidiary** — a brand-new, fully
  independent company (its own invite code, roster, day counter, everything)
  linked back to its parent. Founding one does *not* move you into it: you
  stay in your current company and just also own the new one; whoever will
  actually run it joins later with the generated invite code, the same way
  anyone joins any game.
- The parent's Company page lists its subsidiaries (name, emoji, Day
  counter, badges earned, all-time payroll paid) with a copyable invite
  code; a subsidiary shows an "⬆ Part of {parent}" banner back up to its
  parent.
- New column `companies.parent_company_id`, plus RLS so a company's members
  can see its subsidiaries and a subsidiary's members can see their parent
  — and only someone who actually owns a company can declare it as the
  parent of a new one.

### Objectives

- **Daily and weekly goals** on the Dashboard, with claimable Money and XP.
  Three daily and two weekly, drawn from five kinds of goal: clear N tasks,
  earn $N, submit N for review, delegate N tasks, and work across N
  categories. Weekly targets are 4× the daily ones.
- The objective *set* is generated deterministically from
  `(company id, calendar day)` with an FNV-1a hash rather than
  `Math.random()`, so everyone in a company sees the same goals on the same
  day and a reload never reshuffles them — no table of generated objectives
  to store or keep in sync.
- Progress is measured live against the company's document history (nothing
  to increment on every action, nothing to drift), and only the *claim* is
  persisted. New table `objective_claims`, with a unique index on
  `(member_id, objective_key)` — the claim row is inserted *before* the
  money moves, so a double-click or a second tab can't pay the same
  objective twice.

### Company Bank

- Four **loan desks** — Petty Cash Advance ($150), Working Capital Line
  ($500), Expansion Loan ($1,500), Leveraged Buyout Facility ($5,000) — each
  with its own daily rate, term, and minimum credit score. One open loan at
  a time.
- **Interest compounds per in-game day**, charged when the day is ended
  rather than recomputed on read, so the balance on the Bank page is the
  balance you actually owe. Overdue loans accrue at **double rate**;
  anything still unpaid a full term past due (plus 3 days' grace) is written
  off as a default. The End Day wrap-up post reports the interest accrued.
- A **credit rating** (CCC → AAA, score out of 100) derived entirely from
  the loan book — clean repayments build it, defaults and carried debt drag
  it down — which is what gates the bigger desks. Everyone starts at 50.
- Repay in full or in part; the whole company can see the loan book
  (outstanding balances, all-time interest charged) since it's the company's
  money. New table `company_loans`.

### Analytics

- A **charts** tab over the company's real document history, with 7/14/30/90-day
  ranges and a "just my work" filter.
- Tasks completed per day (filled line), payouts earned per day and work
  created per day (bars — compare the last two to see whether the backlog is
  growing), pipeline by status and completions by difficulty (donuts), and
  tasks/payouts by worker including AI coworkers (ranked bars).
- Headline metrics: completed, earned, **median turnaround** (created →
  completed), and **on-time rate** against due dates.
- Charts are hand-rolled SVG in `src/components/charts.tsx` — the app ships
  no charting dependency. Everything draws into a fixed `viewBox` and is
  sized with CSS, so it scales with its container; values are exposed as
  `<title>` tooltips. Daily figures export to CSV.

### Your Desk

- A **customisable office**, drawn as SVG rather than assembled from stock
  art: wall and floor as tinted shapes, a desk and rug drawn as real
  furniture in the colour you bought, and everything else placed on top as
  emoji. Adding an item to the catalog is one entry in
  `src/data/cosmetics.ts` and nothing else.
- A **Cosmetics Shop** with nine slots — desk, chair, monitor, mug, lamp,
  plant, wall art, rug, office pet — from a $25 rubber duck to a $500
  mahogany executive desk and an actual window. Buying equips it
  immediately; owned items can be swapped back and forth for free.
- **Paint and flooring** are free and unlimited: six wall colours and five
  floors, including a checkerboard drawn as an SVG pattern.
- Deliberately **zero gameplay effect**. The Office Shop on the Company tab
  is where money buys payout bonuses; keeping the two catalogs apart means
  neither has to be balanced against the other.
- **Wander the floor** to see what your coworkers have done with their
  offices, and open any one of them full-size.
- New table `member_desks`. Items owned and items equipped are stored
  separately, so swapping a poster out never makes you re-buy the old one,
  and free starter items are re-derived on read rather than written into
  every row — adding a free item to the catalog later gives it to everyone.

### Perks

- A **three-branch perk tree** — Rainmaking (payouts), Treasury (credit),
  Craft (XP and objectives) — with three tiers each, gated on career level
  and on taking the tier below.
- Points come from **career levels** (one per level past the first), so
  perks are a long-run spend of the XP that already drives levelling rather
  than a new currency to grind. A free respec clears everything and gives
  the points back.
- Every effect is applied at exactly one place in the app, noted on the
  field that defines it, so a perk can't quietly do nothing:
  payouts and XP in My Work, reward size on objective claims, the daily rate
  and credit score at the Bank, and the company's cut of your payouts.
  Percentage discounts are capped when they stack.
- New table `member_perks`, unique on `(member_id, perk_id)`.

### Projects

- **Multi-document initiatives** with an icon, a target number of documents,
  an optional due Day, and a **bonus pool**.
- The pool is taken out of the treasury the moment the project opens, so the
  owner can't promise the same money to two projects; cancelling refunds it.
  On delivery it is split between contributors in proportion to how many of
  the project's documents each completed, and the delivery is announced as a
  Corporate Update.
- Work is filed under a project either when it's assigned (a picker in the
  assign modal) or afterwards from the project itself — already-completed
  documents count the moment they're filed.
- **Progress is derived from the documents**, not from a counter column, so
  it can never drift from what the Archive actually shows.
- New table `company_projects` plus `documents.project_id`. Only the owner
  can open, deliver, or cancel one.

### Company Treasury

- A configurable **cut of every completed task payout** (0–50%, default 10%)
  builds a shared company pot, which is what funds project bonus pools. The
  owner can also spend it directly, with a reason.
- Every movement is written to a **ledger** the whole company can read —
  contributions, project funding, refunds, withdrawals.
- Only a company's owner may `UPDATE public.companies`, but every member's
  work funds the treasury. That is bridged by one narrow `SECURITY DEFINER`
  function, `contribute_to_treasury`, which only ever *adds*, rejects
  non-positive and implausibly large amounts, resolves the company from the
  caller's own membership rather than a parameter, and writes the balance and
  the ledger row in the same statement so the two can't disagree.
- New columns `companies.treasury` and `companies.treasury_cut_percent`, plus
  a `treasury_transactions` ledger table.

Not yet built: cosmetics that affect other people's screens, a walkable
office map.

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

React + Vite + TypeScript + Tailwind CSS v4, no charting or UI libraries.
Templates are static JSON: a generated browse index is bundled, and each
full template is a plain file under `public/templates/` fetched by id (see
Performance below). Accounts, companies, ranks, work
items, emails, and board meetings live in Supabase (Postgres + Auth +
Realtime) under Row Level Security. Per-browser conveniences (favorites,
recently used, custom templates you've built) stay in `localStorage`;
anything another person's actions need to affect (Money, rank, document
status, emails) lives server-side. All AI features go through a hosted
Supabase Edge Function — see [AI architecture](#ai-architecture).

**Performance.** Every tab is its own lazily-loaded chunk (`React.lazy` +
`Suspense` in `App.tsx`) instead of one upfront bundle, and the Filing
Cabinet paginates its template grid 60 at a time instead of mounting all
1111+ cards.

The template library used to be pulled in with `import.meta.glob(...,
{ eager: true })`, which produced a **1.78 MB JavaScript chunk** that had to
be downloaded *and* evaluated as object literals before the Filing Cabinet,
Board Meetings, or any template picker could paint — measured at 316 ms of
parse time plus a 39 ms `localeCompare` sort at startup, and far worse on a
phone. It is now split in two:

- `npm run build:template-index` (which `npm run dev` and `npm run build`
  both run first) writes `src/data/templateIndex.json` — browse-level
  metadata only, 0.49 MB, **28% of the library**, pre-sorted by title so
  startup never pays for the sort. Fields and body text, which are ~68% of
  the bytes and are only needed once you actually open a template, are left
  out.
- The same script writes flat, minified copies to `public/templates/<id>.json`.
  `loadTemplate(id)` fetches one on demand and caches it. Because the
  filename *is* the id, there is no lookup map in the bundle, and the
  browser parses each with its native JSON parser. Keeping them out of the
  module graph matters: as lazy `import.meta.glob` chunks they cost ~140 kB
  of import thunks plus 1111 extra chunks; inlined as `?url` data URIs they
  ballooned to 3 MB.

Net: **1.78 MB → 515 kB** (66 kB gzipped) for the template chunk.
`public/templates/` is generated and git-ignored.

Query-side, `fetchCompanyDocumentStats` selects only the columns stats
surfaces need — lifting `difficulty` out of the snapshot with a PostgREST
JSON accessor (`difficulty:template_snapshot->>difficulty`) rather than
shipping the whole `template_snapshot` per row. That is a **77.8% smaller
payload** at 13 documents and scales linearly; it matters most in the
app-root notification poller, which re-runs on every realtime document
change. The Activity Feed's two-step fetch became one server-side join on
the documents FK, which also removed an `.in(document_id, [...])` filter
whose URL grew ~40 bytes per document and would eventually 414 outright.

**Reliability.** `useSession`, `useProfile` and `useCompany` used to swallow
their errors and return `null`, so a dropped request or an RLS error left
`App.tsx` rendering "Loading…" forever with no way out — the "sometimes it
just doesn't load" bug. All three now surface an error, every startup call
is wrapped in a 12-second watchdog, and the boot gates render a retryable
error screen (Try again / Leave this company / Sign out) instead of a dead
end. The boot spinner offers a Reload after 6 seconds.

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

## AI architecture

AI Clients, client email replies, and AI Draft Assist all call a shared
`llmChatCompletion()` client that tries two backends in order:

1. **Hosted (primary)**: the `ai-chat` Supabase Edge Function. The browser
   calls it via `supabase.functions.invoke`, authenticated as the signed-in
   player (the function has `verify_jwt` on, so only players of this game
   can reach it — not the open internet). The function itself reads a Groq
   API key out of `app_secrets`, a table with RLS enabled and *no policies*
   plus revoked grants for `anon`/`authenticated` — only the edge
   function's service-role connection can read it. The key never appears
   in any client-side code, bundle, or repo file.
2. **Local (fallback)**: if the hosted function is unreachable, falls back
   to whatever OpenAI-compatible endpoint is configured in `llmConfig.ts`
   (Ollama's default address, `http://localhost:11434`), so a local LLM
   still works as a backup or for offline development. If that's also
   unreachable, callers fall back further to static canned content so the
   feature never hard-fails.

This design exists specifically because the game itself is a static,
client-side SPA with no backend of its own — any API key placed directly
in its source or a `VITE_*` env var would ship verbatim in the built JS,
visible to anyone who opens dev tools on the deployed page. Routing AI
calls through a Supabase Edge Function keeps the real key server-side
while still working from a pure static frontend.

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
- **Realtime**: your profile, your company's documents, emails, board
  meetings, invite codes, and corporate updates all update live via
  Supabase Realtime subscriptions, so anything a coworker does shows up
  without a refresh. Every one of those tables has to be explicitly added
  to the `supabase_realtime` publication for `postgres_changes` events to
  fire at all — a table created without that is a silent no-op, not an
  error, which is exactly what broke "Start Game" (the owner's click
  updated the database fine, but no client ever heard about it).

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
