# SolMind App

SolMind is an AI-assisted coaching platform for human Guides and Explorers.

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
| `/guide` | Guide Assistant dashboard preview |
| `/explorer` | Explorer conversation preview |

Authentication, Supabase persistence, invitations, onboarding workflows, conversation storage, safety escalation, and role-based access control are not yet implemented.

## Canonical SolMind Roles

Use these role names consistently:

- Admin
- Guide
- Explorer

## Canonical Assistant Names

Use these assistant names consistently:

- SolMind Virtual Guide — Explorer-facing assistant
- Guide Assistant — Guide-facing assistant

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
      DashboardCard.tsx
      ExplorerTopicList.tsx
      PageShell.tsx
      Panel.tsx
      SectionLabel.tsx

  lib/
    solmind/
      dashboardPanels.ts
      navigation.ts
      pages.ts
      roles.ts
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

Use small, focused commits.

Recommended pattern:

```powershell
git status
```

```powershell
git add .
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
3. Add Supabase project setup.
4. Add database migrations aligned with the SolMind data model.
5. Add passwordless login scaffolding for Guides and Explorers.
6. Add Admin password plus code flow.
7. Add invitation flow scaffolding.
8. Add Explorer consent and onboarding flow.
9. Add Guide dashboard data shell.
10. Add safety flag architecture and tests.

Safety, consent, role access, and privacy behavior must be implemented carefully and verified before production use.