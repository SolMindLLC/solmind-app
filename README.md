# SolMind App

SolMind is an AI-assisted reflective support platform for human Guides and Explorers.

This repository contains the SolMind MVP0 application shell built with Next.js, React, TypeScript, and Tailwind CSS.

## Current MVP0 App Scope

The current app pairs an interactive deterministic Explorer prototype with
static MVP0 preview pages and several banked, foundation-first backend
modules. These surfaces are development and review artifacts, not complete
runtime workflows.

User-facing routes:

```text
/
/login
/admin
/guide
/explorer
```

Server route handlers:

```text
/admin/access
```

Current route purpose:

| Route | Purpose |
|---|---|
| `/` | Public landing page (preview) |
| `/login` | Login preview |
| `/admin` | Admin dashboard preview |
| `/guide` | Guide dashboard preview |
| `/explorer` | Deterministic Explorer onboarding, First Compass, Waypoint, exact-summary review, and non-live Guide-boundary prototype |
| `/admin/access` | Opaque server-side Admin access probe returning only `{ allowed }` |

The `/explorer` prototype is the browser-memory-only
`PRJ01_R-WS09-WI021-S01` experience. It:

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

Banked backend foundations (high level):

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- Auth/RLS request-auth boundary, real Admin auth-source loading, server-only hardening, and enumerated RPC transport under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- Auth/RLS audit persistence for `/admin/access`: the bounded audit event model, the `public.solmind_record_audit_event` database writer function, the closed-allowlist app writer chain, and the runtime wiring (AUD-1/AUD-2/AUD-3).
- Dormant verification and session database primitives: verification-challenge redemption (`DEF5-S2`), verification-challenge issuance (`DEF5-S3`), and account-bound session creation plus the all-history chronology correction (`DEF5-S4`).
- Dormant Explorer invitation foundations through `PRJ01_F-WS06-WI008-S02E`: the protected invitation-acceptance preparation helper, capacity and lock-key behavior, shared invited-identity provisioning, Guide-to-Explorer invitation issuance/replacement/revocation, and Explorer invitation acceptance with one `intake_pending` relationship.

What "banked" does and does not mean:

- `/admin/access` is an opaque JSON probe that returns only `{ allowed }`. It does not yet mean the `/admin`, `/guide`, or `/explorer` pages are fully protected runtime workflows.
- Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred; RLS stays deny-by-default.
- Runtime audit persistence exists ONLY for the `/admin/access` boundary: the enumerated `public.solmind_record_audit_event` function writes bounded Auth/RLS rows into `audit.audit_event` (guarded-read row first, then the decision row, both required before an outward allow). No broader audit wiring, no permissive RLS policy, and no table or schema grants exist; the `audit` schema stays off the Data API.
- The verification, session, provisioning, and invitation foundations remain dormant substrate. Provider delivery, application callers, runtime routes, cookie/session bridging, consent, persistent onboarding, conversation storage, and the safety escalation runtime workflow are not yet implemented.
- The remaining mapped Explorer invitation-acceptance slice is `PRJ01_F-WS06-WI008-S02F`, which owns cross-operation and inherited-debt closure. S02E is banked in synchronized app commit `5e98ebf`.
- The S01 Explorer prototype does not turn those foundations into a runtime
  path. Protected persistence belongs to `PRJ01_R-WS09-WI021-S02`; genuine
  server-side Virtual Guide conversation belongs to
  `PRJ01_R-WS09-WI021-S03`.

The authoritative banked-vs-deferred Auth/RLS and product-slice status is tracked in:

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

The S01 interactive boundary is intentionally narrow:

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

## Current Build Status

At the latest banked baseline before this proposal:

- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- Routes build successfully:
  - `/`
  - `/login`
  - `/admin`
  - `/guide`
  - `/explorer`
  - `/admin/access` (server route handler)

The S01 proposal requires its separate application and full-repository
validation gates before it may be described as banked.

## Next Implementation Direction

The exact next implementation order is controlled by the current slice ledger,
task breakdown, and separately approved proposal checkpoints.

1. Review, apply, validate, and bank `PRJ01_R-WS09-WI021-S01` only through its
   separate gates.
2. Design protected persistence and the dedicated local synthetic
   Guide/Explorer fixture under `PRJ01_R-WS09-WI021-S02`; do not place the
   fixture in a production migration or universal seed.
3. Add the genuine server-side Virtual Guide provider path only under
   `PRJ01_R-WS09-WI021-S03`, after provider, context, consent, storage,
   failure, and leakage-test boundaries pass.
4. Complete `PRJ01_F-WS06-WI008-S02F` through its independent owner.
5. Expand RLS, audit, consent, safety, and Guide runtime behavior only through
   their separately reviewed slices.

Safety, consent, role access, and privacy behavior must be implemented carefully and verified before production use.
