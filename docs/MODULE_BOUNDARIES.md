\# SolMind App Module Boundaries



Version: 0.1.0

Repo: solmind-app

Purpose: Define where code should live as the SolMind MVP0 application grows.



\## Core Principle



SolMind code should be organized so that a small AI coding assistant can safely understand and modify one feature area at a time.



Prefer small, explicit modules over large mixed-purpose files.



\## Current Source Layout



```text

src/

&#x20; app/

&#x20;   page.tsx

&#x20;   login/page.tsx

&#x20;   admin/page.tsx

&#x20;   guide/page.tsx

&#x20;   explorer/page.tsx



&#x20; components/

&#x20;   solmind/

&#x20;     BackLink.tsx

&#x20;     DashboardCard.tsx

&#x20;     PageShell.tsx

&#x20;     Panel.tsx

&#x20;     SectionLabel.tsx



&#x20; lib/

&#x20;   solmind/

&#x20;     navigation.ts

&#x20;     pages.ts

&#x20;     roles.ts

&#x20;     terms.ts

```



\## Route Files



Route files live under:



```text

src/app/

```



Route files should:



\* define page layout

\* compose reusable components

\* load feature-specific data when needed

\* stay small and readable



Route files should not:



\* contain large business rules

\* contain safety classification logic

\* contain Supabase policy assumptions

\* contain long lists that belong in `src/lib/solmind`

\* contain reusable UI that belongs in `src/components/solmind`



\## Components



Reusable SolMind UI components live under:



```text

src/components/solmind/

```



Use this folder for components such as:



\* page shells

\* panels

\* cards

\* navigation helpers

\* topic lists

\* progress indicators

\* consent blocks

\* dashboard sections

\* form components



Components should be presentational when possible.



Avoid placing core product rules inside components. If a component needs product rules, import them from `src/lib/solmind`.



\## Product Logic and Constants



SolMind product constants and product logic live under:



```text

src/lib/solmind/

```



Current examples:



\* `navigation.ts`

\* `pages.ts`

\* `roles.ts`

\* `terms.ts`



Future examples:



\* `auth.ts`

\* `invitations.ts`

\* `consent.ts`

\* `onboarding.ts`

\* `safety.ts`

\* `escalation.ts`

\* `guideDashboard.ts`

\* `adminDashboard.ts`



Use this area for:



\* role definitions

\* route definitions

\* page metadata

\* product terminology

\* validation rules

\* onboarding workflow definitions

\* topic definitions

\* safety rule definitions

\* dashboard data-shaping helpers



\## Types



When the app grows, shared TypeScript types should live under:



```text

src/types/

```



Recommended future files:



```text

src/types/

&#x20; auth.ts

&#x20; roles.ts

&#x20; invitations.ts

&#x20; consent.ts

&#x20; onboarding.ts

&#x20; conversation.ts

&#x20; safety.ts

&#x20; dashboard.ts

```



Types should be explicit and stable. Avoid vague type names such as `Data`, `Item`, `Thing`, or `Result` unless they are locally obvious.



\## Future Feature Areas



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



\## Authentication Boundary



Authentication code should be isolated.



Expected future home:



```text

src/lib/solmind/auth/

```



Authentication code should handle:



\* passwordless login request

\* verification code validation

\* Admin password plus code flow

\* role-aware post-login routing



Authentication code should not:



\* render full pages

\* contain dashboard logic

\* contain safety escalation logic

\* bypass role checks



\## Role Boundary



Role definitions should remain centralized.



Current home:



```text

src/lib/solmind/roles.ts

```



Do not duplicate role string literals across the app.



Use centralized role constants and types.



Canonical roles:



\* Admin

\* Guide

\* Explorer



\## Invitation Boundary



Future invitation logic should be isolated.



Expected future home:



```text

src/lib/solmind/invitations/

```



Invitation logic should handle:



\* Admin inviting Guides

\* Guides inviting Explorers

\* invite state

\* invite expiration

\* invite acceptance



Do not mix invitation logic into generic login components.



\## Consent Boundary



Future consent logic should be isolated.



Expected future home:



```text

src/lib/solmind/consent/

src/components/solmind/consent/

```



Consent logic should handle:



\* required consent screen state

\* accepted version

\* timestamp

\* consent text versioning



Consent should not be hidden inside chat components.



\## Conversation Boundary



Future conversation logic should be isolated.



Expected future home:



```text

src/lib/solmind/conversation/

src/components/solmind/conversation/

```



Conversation logic should handle:



\* Explorer messages

\* SolMind Virtual Guide responses

\* check-in prompts

\* suggested topics

\* conversation state



Conversation code should not directly decide severe safety escalation behavior. It should call safety-classification logic.



\## Safety Boundary



Future safety logic should be isolated.



Expected future home:



```text

src/lib/solmind/safety/

src/components/solmind/safety/

```



Safety logic should handle:



\* self-harm trigger classification

\* relapse-risk trigger classification

\* major contradiction flags

\* escalation routing

\* Guide notification state

\* safety audit records



Safety code is safety-critical.



Do not weaken safety behavior without explicit approval.



Do not bury safety rules inside page files or generic UI components.



\## Supabase Boundary



Future Supabase access should be isolated.



Expected future home:



```text

src/lib/solmind/supabase/

```



Supabase code should handle:



\* browser client creation

\* server client creation

\* typed database access

\* role-aware query helpers

\* storage access if needed



Supabase access should not be scattered throughout page files.



\## Database Schema Boundary



Database migrations should live outside `src`.



Expected future home:



```text

supabase/

&#x20; migrations/

&#x20; seed/

```



Any schema change should be reflected in the relevant documentation and should be verified against the SolMind data model.



Primary related document in the documentation repository:



```text

execution/03\_SolMind\_Phase0\_Data\_Model\_Spec\_v1\_0.md

```



\## Testing Boundary



Future tests should be organized by feature area.



Expected future home:



```text

tests/

&#x20; auth/

&#x20; roles/

&#x20; invitations/

&#x20; consent/

&#x20; onboarding/

&#x20; conversation/

&#x20; safety/

&#x20; rls/

```



High-priority test areas:



\* role routing

\* invitation acceptance

\* consent requirements

\* Explorer onboarding progress

\* Guide/Explorer data boundaries

\* safety trigger routing

\* Supabase Row Level Security policies



\## Naming Rules



Use explicit names.



Prefer:



```text

createGuideInvite

createExplorerInvite

verifyPasswordlessLoginCode

recordExplorerConsent

getExplorerOnboardingProgress

classifySafetyTrigger

routeSafetyEscalation

```



Avoid:



```text

handleSubmit

process

doAuth

runFlow

manager

helper

utils

```



\## Change Rules



When adding or changing a feature:



1\. Keep the route file small.

2\. Put reusable UI in `src/components/solmind`.

3\. Put product rules in `src/lib/solmind`.

4\. Put shared types in `src/types` when needed.

5\. Add tests when behavior is non-trivial.

6\. Update documentation if role behavior, safety behavior, schema, or workflow changes.

7\. Run lint and build before reporting completion.



\## Verification Commands



Run before claiming success:



```powershell

npm.cmd run lint

npm.cmd run build

```



