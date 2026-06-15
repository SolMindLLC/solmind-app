# SolMind App

SolMind is an AI-assisted reflective support platform for human Guides and Explorers.

This repository contains the SolMind MVP0 application shell built with Next.js, React, TypeScript, and Tailwind CSS.

## Current MVP0 App Scope

The current app is a static MVP0 preview shell with these routes:

```text
/
 /login
 /admin
 /guide
 /explorer
```

Current route purpose:

| Route | Purpose |
|---|---|
| `/` | Public landing page |
| `/login` | Login preview |
| `/admin` | Admin dashboard preview |
| `/guide` | Guide dashboard preview |
| `/explorer` | Explorer conversation preview |

Authentication, Supabase persistence, invitations, onboarding workflows, conversation storage, safety escalation, and role-based access control are not yet implemented.

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

Do not describe Guide login as passwordless. Guide authentication must remain aligned with the SolMind documentation repository before Supabase/auth implementation begins.

## Source Layout

```text
src/
  app/
    page.tsx
    login/page.tsx
    admin/page.tsx
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
      loginOptions.ts
      navigation.ts
      onboarding.ts
      pages.ts
      profile.ts
      roles.ts
      routeAccess.ts
      terms.ts
      topics.ts
```

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
- Add `.env.example` before introducing real environment-dependent code.

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

As of the current MVP0 shell checkpoint:

- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- Routes build successfully:
  - `/`
  - `/login`
  - `/admin`
  - `/guide`
  - `/explorer`

## Next Implementation Direction

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