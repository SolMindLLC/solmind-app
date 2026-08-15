# SolMind App

SolMind is an AI-assisted reflective support platform for human Guides and Explorers.

This repository contains the SolMind MVP0 application shell built with Next.js, React, TypeScript, and Tailwind CSS.

## Audience and Stable Orientation Rule

This README is for developers, reviewers, and AI assistants who need a stable
orientation to the `solmind-app` repository.

Keep this file focused on durable repository purpose, architecture, routes,
local development, verification, and safety or security boundaries. It is not
an execution-status owner. Do not add:

- active weekly priorities or temporary operating status;
- project traceability IDs or other execution identifiers;
- commit hashes, proposal states, or banking evidence; or
- ordered work queues or instructions for the current slice.

Record exact implementation status and evidence in the MVP0 Slice Ledger,
current priorities and decisions in the active weekly execution workspace, and
implementation ordering in the MVP0 Implementation Task Breakdown. Update this
README only when durable repository capabilities, structure, boundaries, setup,
or validation expectations change.

## Repository Scope

The current app pairs an interactive deterministic Explorer prototype with
static MVP0 preview pages and several foundation-first backend modules. These
surfaces are development and review artifacts, not complete runtime workflows.

User-facing routes:

```text
/
/login
/admin
/guide
/guide/explorers/avery/waypoint-suggestions
/explorer
/explorer/waypoints
```

Server route handlers:

```text
/admin/access
/guide/waypoint-suggestions/relationships
```

Current route purpose:

| Route | Purpose |
|---|---|
| `/` | Public landing page (preview) |
| `/login` | Login preview |
| `/admin` | Admin dashboard preview |
| `/guide` | Guide dashboard preview |
| `/guide/explorers/avery/waypoint-suggestions` | Deterministic fixture-backed Human Guide Suggested Waypoint list, draft, Pull Back, sent-detail, and receipt review surface |
| `/explorer` | Deterministic Explorer onboarding, First Compass, Waypoint, exact-summary review, and non-live Guide-boundary prototype |
| `/explorer/waypoints` | Deterministic fixture-backed Explorer Waypoint Suggestions inbox, detail, private comparison, receipt, and exact-response review surface |
| `/admin/access` | Opaque server-side Admin access probe returning only `{ allowed }` |
| `/guide/waypoint-suggestions/relationships` | Read-only authenticated Guide entry selector for Suggested Waypoints; returns only relationship ID, Explorer display name, relationship creation time, cursor, and count |

The `/explorer` route hosts a browser-memory-only deterministic prototype. It:

- displays the preferred-name placeholder without collecting it again;
- submits the approved three required and three optional onboarding questions;
- offers a distinct, skippable First Compass;
- starts in valid zero-point Discovery mode;
- uses deterministic local responses and Explorer-confirmed Priority,
  reorientation, and private-Waypoint states;
- shows at most eight Compass points and preserves categorized overflow under
  `Other paths`;
- supports exact main-point and one-detail-level inclusion choices;
- requires a fresh exact final review before freezing an in-memory Shared
  Snapshot;
- supports `Not ready to share` with no Guide-visible conversation artifact
  and no auto-send; and
- projects only submitted onboarding answers and the exact confirmed Shared
  Snapshot into an explicitly non-live Guide result.

It makes no provider call and uses no database, route handler, cookie,
`localStorage`, `sessionStorage`, or other persistence. Refreshing clears the
experience. It does not create a real Guide session, send information, deploy a
feature, or affect a real user.

The separate `/explorer/waypoints` route is also deterministic and
browser-memory-only. It presents one synthetic delivered Suggested Waypoint
through the isolated `suggestedWaypoints.ts` contract, preserves Explorer read
state and drafted text locally, and demonstrates explicit receipt and exact
response actions. Its left navigation either reaches an existing route or
explains the intended future destination. It is not authenticated, persistent,
provider-backed, deployed, or connected to a real Human Guide.

The paired `/guide/explorers/avery/waypoint-suggestions` route is deterministic
and browser-memory-only. It demonstrates a Guide's Explorer-context list,
Guide-only draft review, the five-minute Pull Back grace period, open sent
detail, and a deliberately supplied receipt acknowledgement. It reports no
passive Explorer opens, private comparison, private question, or use in an
Explorer-owned Waypoint, and it performs no real save, send, provider, database,
notification, or user action.

Backend foundations present in the repository (high level):

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- Auth/RLS request-auth boundary, real Admin auth-source loading, server-only hardening, and enumerated RPC transport under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- Auth/RLS audit persistence for `/admin/access`: the bounded audit event model, the `public.solmind_record_audit_event` database writer function, the closed-allowlist app writer chain, and the runtime wiring.
- Dormant verification and session database primitives: verification-challenge redemption and issuance, account-bound session creation, and the all-history chronology correction.
- Dormant Explorer invitation foundations: the protected invitation-acceptance preparation helper, capacity and lock-key behavior, shared invited-identity provisioning, Guide-to-Explorer invitation issuance, replacement, revocation, and Explorer invitation acceptance with one `intake_pending` relationship.
- Dormant Explorer S02 foundations: a protected 1-100 day Shared Snapshot sendability setting (default 7), a server-only fixed-key reader, a service-role-only audited mutation, and a manually invoked local synthetic Guide/Explorer fixture.
- Dormant Summary and Shared Snapshot persistence foundation: immutable Guide-authored Summary revisions and sections, an authoritative publication record and fail-closed Explorer projection, Explorer-private exact-review drafts, immutable Explorer-confirmed Shared Snapshots with preserved lineage, and bounded service-role-only publication, unpublication, confirmation, and integrity surfaces. It has no application caller, permissive RLS policy, direct-table role grant, hosted data, provider action, deployment, or real-user path.
- Dormant Suggested Waypoint persistence and security foundation: distinct Guide draft, pending outbound, immutable delivered-version, Explorer-private read, shared receipt, protected preference, and replay-proof owners; a closed six-command/five-query service-role-only catalog; and the protected 60-3600 second send-grace policy (default 300). The fixture-backed Explorer and Guide pages still have no database caller, hosted scheduler, provider action, deployment, or real-user path.
- Closed Suggested Waypoint S03 RPC transport: server-only exact-call and
  exact-response validation over nine human functions and one separately
  constructed delivery-worker function. The dormant Admin operational query is
  excluded. The six command validators preserve the canonical closed outcome
  algebra, exact function-specific nullable fields, and call/result binding;
  transport failures remain value-free and the modules stay off the shared
  Supabase barrel. No authenticated composition, relationship enforcement,
  route, server action, hosted worker, or UI caller is included.
- Suggested Waypoint S03 authenticated composition primitive: exact
  client-safe Guide/Explorer request validation, request-auth actor/role
  derivation, Guide relationship enforcement, server-derived actor injection,
  server-resolved initial suggestion/version identifiers, and fixed
  browser-safe results. It remains a direct-import server-only dependency with
  no route, server action, UI caller, hosted worker, provider, deployment, or
  real-user activation.
- Suggested Waypoint S03 concrete request dependencies: one request-scoped,
  direct-import server-only factory wires verified request identity,
  enumerated auth-record reads, the closed human executor, and UUIDv5 scoped
  suggestion/version identifiers. Its feature-specific relationship-selector
  executor now has one read-only route caller; the human command composition,
  worker, provider, deployment, and fixture UI integration remain dormant.
- Suggested Waypoint S03 Guide relationship-selector route: the thin dynamic
  `/guide/waypoint-suggestions/relationships` JSON boundary accepts only one
  closed page size plus one optional opaque cursor, derives Guide authority
  from request cookies and server records, and returns the already-minimized
  feature-specific projection. It is not the canonical Guide Explorer roster,
  does not replace either fixture UI, writes nothing, and is not deployed.

Important technical boundaries:

- `/admin/access` is an opaque JSON probe that returns only `{ allowed }`. It does not yet mean the `/admin`, `/guide`, or `/explorer` pages are fully protected runtime workflows.
- Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred; RLS stays deny-by-default.
- Runtime audit persistence exists ONLY for the `/admin/access` boundary: the enumerated `public.solmind_record_audit_event` function writes bounded Auth/RLS rows into `audit.audit_event` (guarded-read row first, then the decision row, both required before an outward allow). No broader audit wiring, no permissive RLS policy, and no table or schema grants exist; the `audit` schema stays off the Data API.
- The verification, session, provisioning, invitation, Summary-publication, and Shared-Snapshot foundations remain dormant substrate. Provider delivery, application callers, runtime routes, cookie/session bridging, consent, persistent onboarding/Compass/Route/Waypoint state, conversation storage, operational send/expiry timing, and the safety escalation runtime workflow are not yet implemented.
- The Explorer prototype does not turn those foundations into a runtime path.
  The additional Explorer persistence owners, application callers, operational
  timing, and genuine server-side Virtual Guide conversation require separately
  reviewed implementation work.
- The Suggested Waypoint S03 relationship-selector route is the only
  browser-reachable S03 boundary. It does not protect a page or activate the
  human command composition, delivery scheduling, worker authorization,
  fixture UI replacement, deployment, or real-user readiness; those roots
  remain separately gated. All server-only S03 owners stay off client/shared
  barrels.

Authoritative implementation status and exact evidence are tracked in:

- `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11);
- `../solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`; and
- `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`.

## Canonical SolMind Roles

Use these role names consistently:

- Admin
- Guide
- Explorer

Do not use deprecated generic terms such as "client" for Explorer-facing product language.

## Canonical Assistant Names

Use these assistant names consistently:

- SolMind Virtual Guide - Explorer-facing assistant
- SolMind Guide Assistant - Guide-facing assistant

Accepted shorthand is allowed in limited UI copy after the canonical name is established, but documentation and architecture references should use the full names.

## Authentication Model

The MVP0 authentication model is:

| Role | MVP0 auth model |
|---|---|
| Explorer | Passwordless email or SMS verification |
| Guide | Password plus email or SMS verification |
| Admin | Admin password plus verification code |

Do not describe Guide login as passwordless. Guide authentication copy must remain aligned with the SolMind documentation repository.

## Source Layout

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    login/page.tsx
    admin/page.tsx
    admin/access/route.ts
    guide/page.tsx
    explorer/page.tsx

  components/
    solmind/
      BackLink.tsx
      ConversationPreview.tsx
      DashboardCard.tsx
      ExplorerExperiencePrototype.tsx
      ExplorerResponseComposer.tsx
      ExplorerTopicList.tsx
      LoginOptionList.tsx
      MiniProfileCard.tsx
      OnboardingProgressCard.tsx
      PageShell.tsx
      Panel.tsx
      RoleBadge.tsx
      RouteAccessPreview.tsx
      SectionLabel.tsx
      SessionCompass.tsx

  lib/
    solmind/
      conversation.ts
      dashboardPanels.ts
      explorerExperience.ts
      invitations.ts
      loginOptions.ts
      navigation.ts
      onboarding.ts
      pages.ts
      profile.ts
      roles.ts
      routeAccess.ts
      terms.ts
      topics.ts
      auth/        server-side deny-by-default authorization and the request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
  seed.sql
```

The Explorer prototype boundary is intentionally narrow:

- `src/app/explorer/page.tsx` is a thin Server Component.
- `src/components/solmind/ExplorerExperiencePrototype.tsx` is the only new
  `"use client"` entry point and owns transient interaction state.
- `src/components/solmind/SessionCompass.tsx` is controlled and
  presentational.
- `src/lib/solmind/explorerExperience.ts` owns pure deterministic transitions,
  exact selection, snapshot freezing, and the narrow non-live Guide
  projection.
- `src/lib/solmind/onboarding.ts` owns the structured-field definitions and
  distinct required-form/optional-First-Compass states.

Server-only modules under `src/lib/solmind/auth` and `src/lib/solmind/supabase` are kept off the shared client barrels, and each module area has co-located `__tests__` unit tests.

## Module Boundary Pattern

Use this structure as the app grows:

```text
src/app/...                 = route files and page composition
src/components/solmind/...  = reusable UI components
src/lib/solmind/...         = product constants, workflow definitions, and product rules
```

Route files should stay small. Product rules and reusable constants should not be buried inside route files.

A mock Guide result must receive the narrow projection from
`createNonLiveGuideProjection`; never pass it the complete Explorer state.

## AI Maintenance Guidance

Before using an AI coding assistant or agent on this repo, read:

```text
AGENTS.md
docs/AI_MAINTENANCE_MAP.md
docs/AGENT_TASK_RULES.md
docs/MODULE_BOUNDARIES.md
```

The project is intentionally structured so that smaller AI coding assistants can safely work on one bounded task at a time.

The canonical product documentation lives in the sibling repository:

```text
../solmind-docs
```

Most binding references before auth/database work:

- `00_SolMind_Repository_Index_v1_0.md`
- `execution/01_SolMind_Phase0_Build_Spec_v1_0.md`
- `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md`
- `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md`
- `execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
- `execution/07_SolMind_MVP0_Implementation_Task_Breakdown_v1_0.md`
- `execution/08_SolMind_MVP0_Test_Plan_v1_0.md`
- `execution/20_SolMind_MVP0_UX_And_System_Architecture_Blueprint_v0_1.md`

## Secrets and Environment Rules

Never expose server secrets through `NEXT_PUBLIC_` variables.

In particular:

- Do not put Supabase service-role keys in `NEXT_PUBLIC_*`.
- Do not expose bootstrap tokens in client components.
- Keep Admin bootstrap credentials and server-only tokens on the server side only.
- `.env.example` exists at the repo root; keep it current as environment-dependent code grows, and never place real secrets in it.

## Local Development

Install dependencies:

```powershell
npm.cmd install
```

Run the local development server:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:3000
```

## Verification Commands

Run these before committing code changes:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

On Windows PowerShell, use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1`.

## Git Workflow

Use small, focused commits. Prefer staging specific files over `git add .`.

Recommended pattern when Paul is personally running Git commands:

```powershell
git status
```

```powershell
git add [specific file/folder]
```

```powershell
git commit -m "Describe the focused change"
```

```powershell
git push
```

```powershell
git status
```

Claude Code local executor exception: Claude Code must stop before `git add`, `git commit`, and `git push` unless Paul explicitly approves those actions in the current task.

## Implementation Planning

The exact implementation order, active proposals, banking evidence, and
current priorities are controlled by the MVP0 Slice Ledger, MVP0
Implementation Task Breakdown, and active weekly execution workspace. Do not
duplicate that changing execution state here.

Durable implementation boundaries:

- Keep the Explorer prototype deterministic and non-live until protected
  persistence is separately designed, reviewed, and validated.
- Add genuine server-side Virtual Guide behavior only after provider, context,
  consent, storage, failure, and leakage-test boundaries pass.
- Keep local synthetic Guide and Explorer fixtures out of production migrations
  and universal seed data.
- Expand RLS, audit, consent, safety, and Guide runtime behavior only through
  separately reviewed changes.

Safety, consent, role access, and privacy behavior must be implemented carefully and verified before production use.
