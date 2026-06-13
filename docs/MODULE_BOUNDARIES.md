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

## Authentication Boundary

Authentication code should be isolated.

Expected future home:

```text
src/lib/solmind/auth/
```

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

Expected future home:

```text
src/lib/solmind/supabase/
```

Supabase code should not expose service-role credentials through client-accessible variables.

Never put service-role keys or bootstrap tokens in `NEXT_PUBLIC_*`.

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
