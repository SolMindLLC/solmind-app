# SolMind App AI Maintenance Map

Version: 0.2.0  
Repo: solmind-app  
Purpose: Help AI coding assistants safely understand, maintain, and extend the SolMind MVP0 application.

## Current Application Scope

This repository contains the SolMind MVP0 application shell.

Current routes:

- `/` — public landing page
- `/login` — login preview
- `/admin` — Admin dashboard preview
- `/guide` — human Guide dashboard preview
- `/explorer` — Explorer conversation preview

The app currently uses static preview pages only. Authentication, Supabase persistence, invitations, role enforcement, intake workflows, conversation storage, safety flags, and Guide/Admin workflows are not yet implemented.

## Canonical Product Documentation

The canonical SolMind product documentation lives in the sibling repository:

```text
../solmind-docs
```

Before implementing auth, database, consent, AI orchestration, safety, or role-based access, verify against the current docs there.

Most binding references:

- `execution/01_SolMind_MVP0_Build_Spec_and_Execution_Plan_v1_0.md`
- `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md`
- `execution/04_SolMind_AI_Orchestration_and_Prompting_Spec_v1_0.md`
- `execution/05_SolMind_Privacy_Security_and_Safety_Baseline_v1_0.md`
- `execution/07_SolMind_MVP0_Implementation_Task_Breakdown_v1_0.md`
- `execution/08_SolMind_MVP0_Test_Plan_v1_0.md`

## Canonical Role Names

Use these SolMind role names consistently:

- Admin
- Guide
- Explorer

Do not rename these roles casually. Avoid deprecated generic terms such as "client" in product UI and documentation.

## Virtual Assistant Names

Use these names consistently:

- SolMind Virtual Guide — Explorer-facing assistant
- SolMind Guide Assistant — Guide-facing assistant

The `/guide` route is the human Guide dashboard. Do not label the human Guide dashboard as the SolMind Guide Assistant dashboard.

## Current Source Layout

```text
src/
  app/
    page.tsx
    layout.tsx
    globals.css
    admin/page.tsx
    explorer/page.tsx
    guide/page.tsx
    login/page.tsx

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

## File Responsibility Map

| Area | Files | Responsibility |
|---|---|---|
| Routes | `src/app/**/page.tsx` | Page composition only |
| Shared UI | `src/components/solmind/*.tsx` | Reusable presentational components |
| Role model | `src/lib/solmind/roles.ts` | Canonical role strings, labels, and home routes |
| Route metadata | `src/lib/solmind/pages.ts` | Page titles, descriptions, and hrefs |
| Navigation | `src/lib/solmind/navigation.ts` | Primary nav items and route labels |
| Login options | `src/lib/solmind/loginOptions.ts` | Static login option copy and auth summaries |
| Dashboard panels | `src/lib/solmind/dashboardPanels.ts` | Static Admin and Guide panel definitions |
| Route access preview | `src/lib/solmind/routeAccess.ts` | Static route-access preview rules |
| Onboarding preview | `src/lib/solmind/onboarding.ts` | Static Explorer onboarding/checkpoint definitions |
| Terms | `src/lib/solmind/terms.ts` | Canonical product and assistant terms |
| Conversation/profile/topics | `src/lib/solmind/*.ts` | Static Explorer preview content |

## MVP0 Authentication Model

Use this model unless the canonical docs are explicitly updated:

| Role | MVP0 auth model |
|---|---|
| Explorer | Passwordless email or SMS verification |
| Guide | Password plus email or SMS verification |
| Admin | Admin password plus verification code |

Do not describe Guide login as passwordless.

## Secrets Boundary

Never expose server secrets through `NEXT_PUBLIC_` variables.

Do not expose:

- Supabase service-role keys
- Admin bootstrap tokens
- provider secrets
- server-only credentials

Add `.env.example` before implementing environment-dependent code.

## Safe Change Pattern

1. Identify the smallest files needed for the task.
2. Check whether the change affects roles, auth, safety, consent, escalation, or privacy.
3. Update docs in the same commit when behavior or structure changes.
4. Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

5. Commit with a narrow message.

## Do Not Start Yet

Do not implement these areas until the prerequisite docs and tests exist:

- Supabase schema or RLS
- authentication middleware
- AI chat persistence
- Reflection storage
- escalation logic
- summaries
- vector retrieval
- billing
- calendar integrations
- NDA workflow
