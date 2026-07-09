# SolMind App AI Maintenance Map

Version: 0.2.0  
Repo: solmind-app  
Purpose: Help AI coding assistants safely understand, maintain, and extend the SolMind MVP0 application.

## Current Application Scope

This repository pairs the SolMind MVP0 preview UI with several banked, foundation-first backend modules. The user-facing pages remain preview and foundation surfaces, not complete runtime workflows.

User-facing routes (preview):

- `/` — public landing page
- `/login` — login preview
- `/admin` — Admin dashboard preview
- `/guide` — human Guide dashboard preview
- `/explorer` — Explorer conversation preview

Server route handlers:

- `/admin/access` — opaque server-side Admin access probe returning only `{ allowed }`

The user-facing pages are still static preview surfaces. Backend foundations are banked at a high level: Supabase schema foundations (migrations, with Row Level Security enabled deny-by-default), the Auth/RLS request-auth boundary, real Admin auth-source loading, server-only hardening, and runtime Auth/RLS audit persistence at `/admin/access` (the `audit.audit_event` writer function plus the app writer chain, wired at AUD-3). Still not implemented: permissive or role-aware RLS policies, grants, and runtime enforcement; audit persistence beyond the `/admin/access` boundary (the login/provisioning, sensitive-access, safety, and AI-lifecycle audit families); login/provisioning writes; invitations; intake workflows; conversation storage; safety-flag runtime handling; and Guide/Admin runtime workflows. See the "Banked Foundations vs Still Deferred" section below and the authoritative register in `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

## Canonical Product Documentation

The canonical SolMind product documentation lives in the sibling repository:

```text
../solmind-docs
```

Before implementing auth, database, consent, AI orchestration, safety, or role-based access, verify against the current docs there.

When instructions conflict, prioritize instructions in order as shown below unless Paul explicitly changes it:

1. Explicit instructions from Paul in the current task.
2. Approved canonical SolMind documents in `../solmind-docs/canonical`.
3. Current relevant AI Assistant workflow documents in `../solmind-docs/ai-assistant`.
4. Approved execution documents and implementation plans in `../solmind-docs/execution`.
5. External AI recommendations after Paul approves them.
6. Local app repo guidance such as `AGENTS.md`, `README.md`, and `docs/*.md`.

If implementation requirements conflict, stop and request a documentation alignment decision. Do not silently choose one interpretation.

Common references:

- `execution/01_SolMind_Phase0_Build_Spec_v1_0.md`
- `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md`
- `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md`
- `execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
- `execution/07_SolMind_MVP0_Implementation_Task_Breakdown_v1_0.md`
- `execution/08_SolMind_MVP0_Test_Plan_v1_0.md`

Auth/RLS tracking and plans (authoritative banked-vs-deferred status):

- `execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11 is the current implementation-status register)
- `execution/13_SolMind_MVP0_Auth_RLS_Request_Auth_Client_Boundary_Plan_v0_1.md`
- `execution/14_SolMind_MVP0_Auth_RLS_First_Server_Only_Route_Integration_Plan_v0_1.md`
- `execution/15_SolMind_MVP0_Auth_RLS_Real_Admin_Auth_Source_Loading_Plan_v0_1.md`
- `execution/16_SolMind_MVP0_Auth_RLS_Audit_Seam_Plan_v0_1.md`

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
    admin/access/route.ts
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
      auth/        server-side deny-by-default authorization and request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
  seed.sql
```

The `auth/`, `context/`, and `supabase/` directories hold server-only modules kept off the shared client barrels, each with co-located `__tests__` unit tests.

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
| Admin access probe | `src/app/admin/access/route.ts` | Opaque Admin access probe returning `{ allowed }`; does not protect pages; its composition persists bounded Auth/RLS audit rows (AUD-3) |
| Server authorization | `src/lib/solmind/auth/*.ts` | Deny-by-default request-auth boundary, role context, route-access decisions, relationship guards, the bounded audit event model, and the audit event writer |
| Role/AI context | `src/lib/solmind/context/*.ts` | Explorer-facing and AI-role context assembly; keeps Explorer-private and Guide-private context separate |
| Supabase integration | `src/lib/solmind/supabase/*.ts` | Server-side request-auth client (who), guarded service-role loader (what), principal mapping, session selection, and the closed-allowlist audit write executor with its admin audit-writer factory |
| Schema foundations | `supabase/migrations/*.sql` | MVP0 schemas and tables; Row Level Security enabled deny-by-default; no permissive policies or grants yet |

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

`.env.example` exists at the repo root; keep it current as environment-dependent code grows, and never place real secrets in it.

## Safe Change Pattern

1. Identify the smallest files needed for the task.
2. Check whether the change affects roles, auth, safety, consent, escalation, or privacy.
3. Update docs in the same commit when behavior or structure changes.
4. Run:

```powershell
npm.cmd run lint
npm.cmd run build
```

5. If Paul approves staging and committing, commit with a narrow message. Claude Code must stop before `git add`, `git commit`, and `git push` unless Paul explicitly approves those actions in the current task.

## Banked Foundations vs Still Deferred

Earlier guidance told agents not to start Supabase, auth, or RLS. That is no longer accurate. Several foundation-first backend modules are now banked in this repo. Treat the items below accordingly, and verify current status against `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11), which is the authoritative Auth/RLS banked-vs-deferred register.

### Banked foundations (do not re-create or duplicate)

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- The Auth/RLS request-auth boundary, real Admin auth-source loading, and server-only hardening under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- The `/admin/access` server route handler: an opaque probe returning only `{ allowed }`. It is read-only and does not protect the `/admin`, `/guide`, or `/explorer` pages.
- Auth/RLS audit persistence for `/admin/access`: the bounded event model (`src/lib/solmind/auth/authRlsAuditEvent.ts`), the enumerated `public.solmind_record_audit_event` writer function (migration `20260708000000_audit_event_writer_function.sql`), the closed-allowlist app writer chain (`auditEventWriter.ts`, `auditEventWriteExecutor.ts`, `adminAuditEventWriter.ts`), and the runtime wiring in `adminAccessRequest.ts` (AUD-1/AUD-2/AUD-3). On an allow the guarded-read row is written first, then the allow decision row, and both must persist before the outward allow (fail-closed); deny and resolution-failure rows are best-effort.

Extend these modules deliberately and in small slices. Keep server-only modules off the shared client barrels, as the existing code does.

### Still deferred (do not start without prerequisite docs, tests, and approval)

- Permissive or role-aware RLS policies, grants, and runtime access enforcement. RLS stays deny-by-default.
- Audit persistence beyond the `/admin/access` boundary: the login/provisioning (Family B), Admin sensitive-access (Family C), safety/escalation (Family D), and content/AI-lifecycle (Family E) audit vocabularies and wiring; a real operational logging/alarm mechanism (the AUD-3 operational signal is an injectable no-op seam); the deferred system-context/null-actor guarded-read vocabulary (AUTH-RLS-DEF-019); and any audit retention/review tooling. No new audit grants, policies, or Data API exposure exist.
- Authentication middleware. MVP0 deliberately prefers explicit per-route and server-action composition over middleware (register decision AUTH-RLS-DEC-017); do not introduce middleware without a specific approved justification.
- The login/provisioning write path (creating or superseding sessions and provider identities).
- AI chat persistence
- Reflection storage
- runtime escalation logic
- summaries
- vector retrieval
- billing
- calendar integrations
- NDA workflow
