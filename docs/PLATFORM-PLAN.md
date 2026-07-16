# Marker Studio OS — Platform Plan

*The one comprehensive plan. Every change ships against this document so the
product converges instead of accumulating duct tape. Updated 2026-07-16.*

## Where we are

**Surfaces.** Admin (Today/agenda, Clients + 8-tab editor, Tasks, Photographer,
Money split across Finance/Invoices/Payments, Proposals, Agreements, Consents,
Notes, Partner, Backfill) · Client portal (Dashboard, Plan, Social, Analysis,
Finance, Documents) · Desktop DMG (Tauri shell around the hosted site, native
notifications/Touch ID/PDF preview) · Public pages (site, onboarding, plan
shares).

**Data.** One `clients` row per client with a JSONB blob (plan, social, photo,
deliverables, dashboard, analysis, invoices snapshot, docs) + relational tables
(users, invoices, payments, notes, studio tasks). Per-section server actions
merge slices of the blob. Notion stays **money-only** (budget tracker; client
record pulls). Meta/AI integrations exist but are optional — nothing core may
depend on them.

## The diagnosis (why it feels like duct tape)

1. **Each page owns a private copy of state.** Every tab seeds `useState` from
   props, saves through its own action, and forgets. Auto-save/offline exists
   only in Plan & Content so far. Editing feels different on every page.
2. **Signals are stored twice instead of derived once.** Tasks, reminders,
   agenda, calendar were separate lists a human had to keep in sync. The rule
   going forward: **the agenda derives, it never duplicates** (posts in
   production surface as "Prepare —" reminders automatically; invoices ladder
   into dunning; shoots surface themselves).
3. **Two generations of UI coexist.** The glass system (`lq-*`) is the design
   language, but a legacy editor (`components/admin/ClientForm.tsx`) and older
   patterns linger and occasionally resurface (old prompts, old save flows).
4. **Authoring ≥ automation.** Portal sections started as hand-authored;
   anything not authored looked broken (the empty dashboard). Rule: **portal
   sections must auto-build from live data; authoring is an override.**
5. **Chrome fragility.** Fixed/floating elements inside glass (backdrop-filter/
   transform) break positioning — the drawer-goes-white bug. Rule: overlays
   render through a portal on `<body>`, never inside a card.

## Target architecture

- **One client-data store.** A `useClientSection(slug, keys)` hook that gives
  every editor tab the same contract: optimistic local state, journaled draft
  in localStorage, debounced per-section save, offline queue + retry, `⌘S`,
  and one status pill. (Shipped in Plan & Content; extract and roll out.)
- **Derived agenda as the single "what now" engine** feeding: admin Today,
  notifications/push, Dock badge (desktop), and the portal's "next step".
- **Editor in 5 tabs**: Overview · Plan & Content · Tasks · Money ·
  Client-facing (portal authoring + documents) — Setup folds into Overview's
  header actions. Photography stays a jump-link.
- **Portal auto-first**: dashboard (done), analysis fallback, plan summary —
  authored content always wins when present.
- **Desktop offline (chosen: full editing + sync)**
  - *Phase 1 — done:* draft journal + offline queue in Plan & Content.
  - *Phase 2 — shipped:* the service worker (`public/sw.js`) caches static
    assets cache-first and every visited page/RSC payload network-first, so
    the last-loaded copy of anywhere you've been opens with no internet;
    unvisited pages get a branded offline screen, a global banner announces
    offline mode, and the store hook keeps rolling out to remaining tabs.
  - *Phase 3:* local-first store with a mutation log per section (the JSONB
    per-section merge maps 1:1 to this), conflict = last-writer-wins per
    section + a visible "changed remotely" nudge. The Tauri shell serves the
    cached app bundle when the network is down.
- **No online payments** (owner decision). Money = invoices, payment records,
  Notion budget sync, receipts.

## Roadmap (each step shippable)

1. ✅ Calendar redesign, planner, scaffold, day drawer, auto-save+drafts,
   auto dashboard, sidebar/chrome fixes, prep reminders derived into agenda.
2. **Store rollout:** extract `useClientSection` from Plan & Content; adopt in
   Dashboard/Portal-content, Analysis, Documents, Deliverables. Delete manual
   Save buttons everywhere. Retire `ClientForm.tsx`.
3. ✅ **Editor consolidation:** 6 focused tabs — Documents folded into
   Client-facing (Story / Analysis / Documents segments), Setup demoted to a
   quiet rail-footer entry; every legacy deep link still resolves.
4. **Offline Phase 2** (IndexedDB snapshot + offline banner + queue everywhere).
5. **Client notifications:** push/email nudges on "sent for approval",
   invoice due, plan published — reusing the agenda derivations.
6. **Offline Phase 3** (local-first + sync log). Re-evaluate scope after 4.
7. **Later / optional:** Meta insights on posted calendar entries (needs Meta
   connection), in-app AI fill (needs credits), content pillars & balance,
   full app-dependence (leaving Notion) — **only when the owner green-lights.**

## Rules of the road (apply to every PR)

- Portal look and its admin authoring surface change **together**.
- New reminders/signals are **derived in `lib/agenda.ts`**, never stored copies.
- Overlays via body portal; chrome reserves layout space (no floating overlap).
- Everything must work with **no Meta, no AI credits, no Notion** (money excepted).
- Verify UI changes in-browser at desktop + 390px widths before pushing.
