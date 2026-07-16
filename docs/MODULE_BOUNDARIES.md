# SolMind App Module Boundaries

Version: 0.2.0  
Repo: solmind-app  
Purpose: Define where code should live as the SolMind MVP0 application grows.

## Core Principle

SolMind code should be organized so that a small AI coding assistant can safely understand and modify one feature area at a time.

Prefer small, explicit modules over large mixed-purpose files.

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
      auth/        server-side deny-by-default authorization and the request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
  seed.sql
```

## Route Files

Route files live under:

```text
src/app/
```

Route files should:

- define page layout
- compose reusable components
- load feature-specific data when needed
- stay small and readable

Route files should not:

- contain large business rules
- contain safety classification logic
- contain Supabase policy assumptions
- contain long lists that belong in `src/lib/solmind`
- contain reusable UI that belongs in `src/components/solmind`

## Components

Reusable SolMind UI components live under:

```text
src/components/solmind/
```

Use this folder for components such as:

- page shells
- panels
- cards
- navigation helpers
- topic lists
- progress indicators
- consent blocks
- dashboard sections
- form components

Components should be presentational when possible.

Avoid placing core product rules inside components. If a component needs product rules, import them from `src/lib/solmind`.

## Product Logic and Constants

SolMind product constants and product logic live under:

```text
src/lib/solmind/
```

Current examples:

- `conversation.ts`
- `dashboardPanels.ts`
- `loginOptions.ts`
- `navigation.ts`
- `onboarding.ts`
- `pages.ts`
- `profile.ts`
- `roles.ts`
- `routeAccess.ts`
- `terms.ts`
- `topics.ts`

Use this area for:

- role definitions
- route definitions
- page metadata
- product terminology
- validation rules
- onboarding workflow definitions
- topic definitions
- safety rule definitions
- dashboard data-shaping helpers

## Types

When the app grows, shared TypeScript types may live near the feature module first. Introduce `src/types/` only when types are clearly shared across multiple feature areas.

Recommended future files, when needed:

```text
src/types/
  auth.ts
  roles.ts
  invitations.ts
  consent.ts
  onboarding.ts
  conversation.ts
  safety.ts
  dashboard.ts
```

Types should be explicit and stable. Avoid vague type names such as `Data`, `Item`, `Thing`, or `Result` unless they are locally obvious.

## Future Feature Areas

As MVP0 grows, prefer these feature boundaries:

```text
src/components/solmind/auth/
src/components/solmind/consent/
src/components/solmind/conversation/
src/components/solmind/dashboard/
src/components/solmind/intake/
src/components/solmind/safety/

src/lib/solmind/auth/
src/lib/solmind/consent/
src/lib/solmind/conversation/
src/lib/solmind/invitations/
src/lib/solmind/onboarding/
src/lib/solmind/safety/
src/lib/solmind/supabase/
```

Do not create all folders before they are needed. Add them when a real feature requires them.

Some of these areas are already present and banked: `src/lib/solmind/auth/`, `src/lib/solmind/context/`, and `src/lib/solmind/supabase/`. See the Authentication, Context, Supabase, Admin Access Route, and Schema Foundation boundaries below.

## Authentication Boundary

Authentication and server-side authorization code should be isolated.

Current home (banked):

```text
src/lib/solmind/auth/
```

This directory now holds the banked, deny-by-default request-auth boundary, role-context resolution, route-access decisions, relationship read guards, the real Admin auth-source port, the bounded Auth/RLS audit event model, and the audit event writer. As of AUD-3 the `/admin/access` composition (`adminAccessRequest.ts`) persists those audit events at runtime through the closed-allowlist writer chain. Server-only modules are kept off the shared client barrel. Extend it in small slices; the login/provisioning write path remains deferred.

Authentication code should handle:

- Explorer passwordless login request
- Guide password plus email/SMS verification
- Admin password plus verification code
- verification code validation
- role-aware post-login routing
- login attempt logging

Authentication code should not:

- render full pages
- contain dashboard logic
- contain safety escalation logic
- bypass role checks
- expose server-only secrets to the client

## Role Boundary

Role definitions should remain centralized.

Current home:

```text
src/lib/solmind/roles.ts
```

Do not duplicate role string literals across the app.

Canonical roles:

- Admin
- Guide
- Explorer

A person may hold multiple roles, but MVP0 role switching is not automatic.

## Guide Dashboard Boundary

The `/guide` route is the human Guide dashboard.

Do not call this route the SolMind Guide Assistant dashboard. The SolMind Guide Assistant is the AI assistant that supports the human Guide.

Guide dashboard data must remain scoped to assigned Explorers only once persistence exists.

## Invitation Boundary

Future invitation logic should be isolated.

Expected future home:

```text
src/lib/solmind/invitations/
```

Invitation logic should handle:

- Admin inviting Guides
- Guides inviting Explorers
- invite state
- invite expiration
- invite acceptance

Do not mix invitation logic into generic login components.

## Consent Boundary

Future consent logic should be isolated.

Expected future home:

```text
src/lib/solmind/consent/
src/components/solmind/consent/
```

Consent logic should handle:

- consent document versions
- adult affirmation
- AI disclosure
- Admin visibility disclosure
- crisis limitation disclosure
- accepted version
- timestamp
- blocking AI access until required consent records exist

Consent should not be hidden inside chat components.

## Conversation Boundary

Future conversation logic should remain separated from rendering.

Expected future homes:

```text
src/components/solmind/conversation/
src/lib/solmind/conversation/
```

Conversation code should not own:

- role policy
- escalation policy
- consent versioning
- Admin visibility rules

## Safety Boundary

Safety and escalation code should be isolated and heavily reviewed.

Expected future home:

```text
src/lib/solmind/safety/
src/lib/solmind/escalation/
```

Safety code must not be scattered across UI components.

## Supabase Boundary

Current home (banked):

```text
src/lib/solmind/supabase/
```

This directory now holds the banked server-side Supabase integration: the request-auth client (identity, who), the guarded service-role loader (record loads, what), principal mapping, session selection, and the audit write path (the closed-allowlist `auditEventWriteExecutor.ts` over the single enumerated `public.solmind_record_audit_event` function, assembled by `adminAuditEventWriter.ts` for the `/admin/access` composition). The request-auth client, the service-role factory, and the audit write modules are server-only and kept off the shared barrel.

Supabase code should not expose service-role credentials through client-accessible variables.

Never put service-role keys or bootstrap tokens in `NEXT_PUBLIC_*`.

## Admin Access Route Boundary

The `/admin/access` server route handler is the first banked request-auth boundary.

```text
src/app/admin/access/route.ts
```

It is a thin composition root: it reads request cookies, builds the request-auth principal source, and delegates to the server-only composition, which loads the real Admin auth source through the guarded path and returns only an opaque `{ allowed }` boolean. It is deny-by-default and fail-closed.

This route is an opaque probe. It does not protect the `/admin`, `/guide`, or `/explorer` pages, and it performs no product-record writes, creates no session, adds no RLS policy, and runs no migration. The only persistence on this path is the bounded Auth/RLS audit rows the delegated composition writes (AUD-3): on an allow, the guarded-read row and the allow decision row must both persist before the outward allow. Keep the route thin; composition, decision, and audit wiring live in `src/lib/solmind/auth`.

## Context Boundary

AI-role and Explorer-facing context assembly is isolated.

```text
src/lib/solmind/context/
```

Context code must preserve SolMind role separation. The SolMind Virtual Guide is Explorer-facing and must receive only Explorer-safe context. The SolMind Guide Assistant is Guide-facing and must receive only Guide-authorized context. Do not blend Explorer-private and Guide-private context in a single path.

The human Guide remains the human Guide; the SolMind Guide Assistant is the AI that supports the human Guide. Do not conflate them.

## Schema Foundation Boundary

Database schema foundations live under:

```text
supabase/migrations/
```

The MVP0 schemas and tables are banked through migrations, with Row Level Security enabled deny-by-default on application tables. Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred. Do not add policies, grants, or schema changes without a Database/Supabase workflow slice and approval. The authoritative Auth/RLS banked-vs-deferred status is `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

The banked dormant DEF5-S3 issuance foundation keeps the database boundary narrow: `public.solmind_issue_verification_challenge` is a service-role-only, purpose-built `SECURITY DEFINER` operation over `identity.verification_challenge`, `identity.contact_method`, and the exact Family B `audit.audit_event` row. Its partial unique index independently limits each normalized-contact/purpose pair to one structurally open challenge. It does not authorize a route, delivery provider, invitation acceptance, session creation, self-signup, Guide assignment, or rate-limit implementation. The outer app/route layer must establish invitation or self-signup eligibility before calling it, and no runtime caller may be added until the separately mandatory resend and lockout controls are implemented.

The banked dormant DEF5-S4 slice keeps session mutation separate from redemption and provisioning. `public.solmind_create_user_session` consumes committed account-bound `login` or `role_reentry` evidence, owns account-wide supersede-then-create serialization, and embeds its exact Family B audit rows. Its freshness policy and both uniqueness indexes are hidden database backstops, not client authorization. Corrective migration `20260716001000_user_session_creation_chronology_guard.sql`, banked in `d2fbb0e`, preserves the writeless exact-retry branch and requires never-sessionized evidence to be strictly newer by `(used_at, challenge UUID)` than every prior session-linked evidence tuple for the account; chronology denial is fixed and zero-write. The three DEF5-S4 plans contain 49/51/50 assertions, and clean reset passed 14 files / 502 assertions. The banked slice creates no caller, route, cookie, provider action, account/profile/role provisioning, invitation or Guide assignment dependency, cloud path, or real-user flow.

## Documentation Boundary

When any route, role behavior, authentication behavior, onboarding workflow, or dashboard behavior changes, update:

- `README.md`
- `AGENTS.md`
- `docs/AI_MAINTENANCE_MAP.md`
- `docs/AGENT_TASK_RULES.md`
- `docs/MODULE_BOUNDARIES.md`

Also check the canonical documentation in:

```text
../solmind-docs
```
