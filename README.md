# SolMind App

SolMind is an AI-assisted reflective support platform for human Guides and Explorers.

This repository contains the SolMind MVP0 application shell built with Next.js, React, TypeScript, and Tailwind CSS.

## Current MVP0 App Scope

The current app pairs a static MVP0 preview UI with several banked, foundation-first backend modules. The user-facing pages remain preview and foundation surfaces, not complete runtime workflows.

User-facing routes (preview):

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
| `/explorer` | Explorer conversation preview |
| `/admin/access` | Opaque server-side Admin access probe returning only `{ allowed }` |

Banked backend foundations (high level):

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- Auth/RLS request-auth boundary, real Admin auth-source loading, and server-only hardening under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- Auth/RLS audit persistence for `/admin/access`: the bounded audit event model, the `public.solmind_record_audit_event` database writer function, the closed-allowlist app writer chain, and the runtime wiring (AUD-1/AUD-2/AUD-3).

What "banked" does and does not mean:

- `/admin/access` is an opaque JSON probe that returns only `{ allowed }`. It does not yet mean the `/admin`, `/guide`, or `/explorer` pages are fully protected runtime workflows.
- Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred; RLS stays deny-by-default.
- Runtime audit persistence exists ONLY for the `/admin/access` boundary: the enumerated `public.solmind_record_audit_event` function writes bounded Auth/RLS rows into `audit.audit_event` (guarded-read row first, then the decision row, both required before an outward allow). No broader audit wiring, no permissive RLS policy, and no table or schema grants exist; the `audit` schema stays off the Data API.
- Login/provisioning write paths, invitations, onboarding workflows, conversation storage, and the safety escalation runtime workflow are not yet implemented.

The authoritative banked-vs-deferred Auth/RLS status is tracked in `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11).

## Canonical SolMind Roles

Use these role names consistently:

- Admin
- Guide
- Explorer

Do not use deprecated generic terms such as "client" for Explorer-facing product language.

## Canonical Assistant Names

Use these assistant names consistently:

- SolMind Virtual Guide — Explorer-facing assistant
- SolMind Guide Assistant — Guide-facing assistant

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

  lib/
    solmind/
      conversation.ts
      dashboardPanels.ts
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

Server-only modules under `src/lib/solmind/auth` and `src/lib/solmind/supabase` are kept off the shared client barrels, and each module area has co-located `__tests__` unit tests.

## Module Boundary Pattern

Use this structure as the app grows:

```text
src/app/...                 = route files and page composition
src/components/solmind/...  = reusable UI components
src/lib/solmind/...         = product constants, workflow definitions, and product rules
```

Route files should stay small. Product rules and reusable constants should not be buried inside route files.

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
npm.cmd run lint
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

As of the current MVP0 checkpoint:

- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- Routes build successfully:
  - `/`
  - `/login`
  - `/admin`
  - `/guide`
  - `/explorer`
  - `/admin/access` (server route handler)

## Next Implementation Direction

Several backend foundations below are already banked (see Current MVP0 App Scope): Supabase schema foundations through migrations, the Auth/RLS request-auth boundary with the `/admin/access` probe, and runtime audit persistence for that boundary. The remaining items, plus the deferred runtime work (RLS policy/grant enforcement, audit persistence beyond the `/admin/access` boundary, and login/provisioning write paths), are the next areas.

Recommended next build areas:

1. Maintain clean module boundaries.
2. Add typed MVP0 workflow definitions.
3. Add environment and secrets conventions, including `.env.example`.
4. Add Supabase project setup.
5. Add database migrations aligned with the SolMind data model.
6. Add Explorer passwordless login scaffolding.
7. Add Guide and Admin password plus verification flows.
8. Add invitation flow scaffolding.
9. Add Explorer consent and onboarding flow.
10. Add Guide dashboard data shell.
11. Add safety flag architecture and tests.

Safety, consent, role access, and privacy behavior must be implemented carefully and verified before production use.