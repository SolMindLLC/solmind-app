# SolMind App AI Maintenance Map

Version: 0.3.3
Repo: solmind-app  
Purpose: Help AI coding assistants safely understand, maintain, and extend the SolMind MVP0 application.

## Current Application Scope

This repository pairs the SolMind MVP0 preview UI with several banked, foundation-first backend modules. Most user-facing pages remain preview and foundation surfaces, not complete runtime workflows.

Banked `PRJ01_V-WS05-WI022-S03` construction now includes the closed server-only
Suggested Waypoint RPC transport, authenticated human-request composition,
concrete server-only dependencies and stable scoped identities, a
feature-specific Guide relationship selector, its first read-only authenticated
route, and the first production Guide relationship-entry page that consumes the
route. The production Guide relationship path also has exact list and detail
browser boundaries over the banked Guide projections. The first authenticated
Guide command route is banked, and the Guide detail calls its save-draft and
schedule-send operations for an existing complete Guide-only draft plus Pull
Back for one exact protected pending version. A shared browser-safe
command-result parser and pure command-operation state owner provide identical-
byte transport-uncertain retry behavior. A server-only first-write security predecessor owns one
trusted application-origin configuration, a same-origin JSON request guard,
the exact 16,384-byte stream cap, and Unicode-scalar integrity at the existing
command composition boundary. A server-only local delivery invoker can execute
one exact already-authorized delivery job and returns only `delivered`,
`not_delivered`, or `failed`. It does not discover due work, scan protected
tables, schedule, poll, claim, lease, retry, or run continuously. No hosted
worker, provider path, deployment, or real-user activation exists.

User-facing routes:

- `/` - public landing page
- `/login` - login preview
- `/admin` - Admin dashboard preview
- `/guide` - human Guide dashboard preview
- `/guide/waypoint-suggestions` - authenticated, read-only Human Guide
  relationship entry for Suggested Waypoints; no suggestion data or command
- `/guide/waypoint-suggestions/[relationshipId]` - authenticated,
  relationship-scoped Guide Suggested Waypoint list
- `/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]` -
  authenticated, relationship-scoped Guide Suggested Waypoint detail with
  complete-draft edit, save, review, schedule send, and bounded pending-version
  Pull Back
- `/guide/explorers/avery/waypoint-suggestions` - deterministic, fixture-backed
  Human Guide Suggested Waypoint review surface; no persistence or real delivery
- `/explorer` - deterministic, browser-memory Explorer S01 experience
- `/explorer/waypoints` - authenticated, read-only Explorer Suggested Waypoint
  inbox
- `/explorer/waypoints/[suggestedWaypointId]` - authenticated Explorer
  Suggested Waypoint detail with private Mark as read and deliberate receipt
  acknowledgement

Shared browser interaction assurance uses a separate Playwright configuration
and `tests/browser/` harness. It preserves the Node-oriented Vitest
configuration and exercises the retained deterministic fixtures plus the
authenticated Explorer and Human Guide read and bounded command routes at
desktop and narrow viewports. The harness owns keyboard, focus, responsive navigation,
live-region, projection-leakage, and companion automated accessibility checks
only; it uses mocked route responses rather than Supabase, Docker, a provider,
hosted data, or a real-user path.

Server route handlers:

- `/admin/access` - opaque server-side Admin access probe returning only `{ allowed }`
- `/guide/waypoint-suggestions/relationships` - read-only authenticated
  Suggested Waypoint Guide-entry selector consumed by the production entry page
- `/guide/waypoint-suggestions/[relationshipId]/suggestions` - authenticated,
  relationship-scoped Guide list read
- `/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/detail` -
  authenticated, relationship-scoped Guide detail read
- `/guide/waypoint-suggestions/[relationshipId]/commands` - authenticated,
  same-origin Guide command route; the current UI calls save draft, schedule
  send, and Pull Back for an existing complete draft lifecycle
- `/explorer/waypoints/suggestions` - authenticated Explorer list read
- `/explorer/waypoints/[suggestedWaypointId]/detail` - authenticated Explorer
  detail read
- `/explorer/waypoints/[suggestedWaypointId]/commands` - authenticated,
  same-origin Explorer Mark as read and Acknowledge receipt command route

`PRJ01_R-WS09-WI021-S01` adds the first interactive Explorer experience
without a provider or persistence. It contains the exact structured onboarding
form, a distinct skippable First Compass, deterministic Discovery/Compass/Route
and private Waypoint transitions, main-point and one-detail-level summary
selection, a fresh exact final review, a deeply frozen in-memory Shared
Snapshot, and a non-live Guide projection. The projection contains only
submitted onboarding answers and the exact confirmed snapshot. Refreshing the
page resets the experience.

Banked dormant `PRJ01_R-WS09-WI021-S02` provides one protected global
`explorer_shared_snapshot_sendability_days` setting (1-100, default 7), a
server-only fixed-key reader, a service-role-only expected-version mutation
with exact Family F transactional audit, and one manually invoked local
synthetic Guide/Explorer fixture with setup, fail-closed cleanup, and read-only
validation. The fixture lives only under
`supabase/fixtures/`; it is not a production migration, universal seed,
hosted fixture, authentication state, runtime product behavior, or real-user
identity source.

The same S02 banking line now also contains a dormant forward-only Summary and
Shared Snapshot persistence foundation. Immutable Guide-authored revisions and
sections are exposed only through an authoritative publication record and a
fail-closed Explorer projection. Explorer-private exact-review drafts can
produce immutable Explorer-confirmed Shared Snapshots with preserved original,
addendum, and replacement lineage. The mutation and integrity surfaces are
service-role-only and bounded-lock. The foundation adds no application caller,
permissive RLS policy, direct-table role grant, operational timer, hosted data,
provider behavior, deployment, or real-user path.

`PRJ01_V-WS05-WI022-S02` adds a separate dormant Suggested Waypoint database
and security foundation. Its eight protected owners keep Guide drafts, pending
outbound bytes, immutable delivered versions, Explorer-private read state,
deliberately shared receipts, Guide preference, and replay proof structurally
separate. Six commands and five role-specific queries are `service_role`-only,
with no direct table grant or permissive RLS policy. The foundation has no
application caller in S02 itself. Separately banked S03 read routes now invoke
the minimized role queries; hosted workers, providers, deployment, and
real-user activation remain absent.

Backend foundations banked at a high level include Supabase schema foundations
with deny-by-default Row Level Security, the Auth/RLS request-auth boundary,
real Admin auth-source loading, server-only hardening, and runtime Auth/RLS
audit persistence at `/admin/access`.

DEF5-S2 through DEF5-S4 add dormant verification redemption, issuance, and
session-creation primitives. The invitation foundation additionally includes
shared authorizing-evidence consumption, Guide/Explorer pre-provider
preparation reservations, dormant Guide acceptance, dormant Admin
Guide-invitation issuance/revocation, and the Explorer capacity/lock-key
foundation.

`PRJ01_F-WS06-WI008-S02C` - shared invited-identity provisioning-helper
generalization - is banked in app commit `1dd85b5`: it replaces the
transitional Guide-only protected helper with one dormant Guide/Explorer helper
while preserving Guide behavior and prior Explorer profile information.

`PRJ01_F-WS06-WI008-S02D` - Guide-to-Explorer invitation issuance,
same-Guide replacement, and revocation - is banked in synchronized app commit
`a9944f1`: it adds two dormant service-role-only entry functions over the
banked capacity, lock, lifetime, Guide/Practice eligibility, and audit
contracts.

`PRJ01_F-WS06-WI008-S02E` - dormant Explorer invitation acceptance - is a
banked foundation. It adds one service-role-only acceptance entry function and
the approved writeless, non-authoritative preparation capacity pre-check over
the existing S02B-S02D substrate. It does not add a caller or activate a
runtime path.

None of those dormant backend slices adds an app caller, provider delivery,
invitation route, runtime acceptance path, rate-limit enforcement, cloud path,
or real-user path.

Still not implemented: permissive or role-aware RLS policies and grants;
login/session callers; effectful provider provisioning; Explorer invitation
callers; onboarding/Compass persistence; sendability timing or expiry; genuine
provider conversation; safety-flag runtime handling; and operational
Guide/Admin runtime workflows.

See the "Banked Foundations vs Still Deferred" section below and the
authoritative register in
`../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

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

- SolMind Virtual Guide - Explorer-facing assistant
- SolMind Guide Assistant - Guide-facing assistant

The `/guide` route is the human Guide dashboard. Do not label the human Guide dashboard as the SolMind Guide Assistant dashboard.

S01 uses a deterministic local script. It must not be described as a real
SolMind Virtual Guide conversation.

## Representative Source Layout

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
      auth/        server-side deny-by-default authorization and request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  fixtures/      Banked local-only setup, validation, cleanup, and operator notes; manually invoked and never a production migration or universal seed
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
  seed.sql
```

This compact tree is an orientation aid rather than an exhaustive owner list.
The File Responsibility Map below is the current owner enumeration.

The `auth/`, `context/`, and `supabase/` directories hold server-only modules kept off the shared client barrels, each with co-located `__tests__` unit tests.

## File Responsibility Map

| Area | Files | Responsibility |
|---|---|---|
| Routes | `src/app/**/page.tsx` | Page composition only |
| Explorer S01 composition | `src/app/explorer/page.tsx` | Thin Server Component composing the single S01 client boundary |
| Explorer S01 orchestration | `src/components/solmind/ExplorerExperiencePrototype.tsx` | Transient browser-memory state and events; no provider or persistence |
| Compass presentation | `src/components/solmind/SessionCompass.tsx` | Controlled fixed-frame Compass rendering; no policy or state ownership |
| Explorer S01 domain | `src/lib/solmind/explorerExperience.ts` | Pure deterministic Compass, Route, Waypoint, summary, snapshot, and narrow Guide-projection transitions |
| Suggested Waypoint pure domain | `src/lib/solmind/suggestedWaypoints.ts` | Immutable Guide authoring, shared-channel, Explorer-private engagement, replay, timing, and role-projection rules |
| Explorer Suggested Waypoint fixture UI | `src/components/solmind/ExplorerSuggestedWaypointWorkspace.tsx`; `src/lib/solmind/suggestedWaypointFixtures.ts` | Retained deterministic detail/private-comparison design fixture over one synthetic delivered suggestion; no production route owner, persistence, provider, or authenticated runtime |
| Explorer Suggested Waypoint authenticated inbox | `src/app/explorer/waypoints/page.tsx`; `src/app/explorer/waypoints/suggestions/route.ts`; `src/components/solmind/ExplorerSuggestedWaypointInbox.tsx`; `src/lib/solmind/suggestedWaypoint{ExplorerListBrowser,ExplorerListShared,PaginationShared}Contract.ts`; co-located focused and browser tests | Authenticated, read-only Explorer inbox over the banked `explorer.list` request composition; exact browser validation, delivered-current-version data only, private read state, explicit dated receipt acknowledgement, progressive opaque-cursor pagination, one bounded later-page stale-cursor reset to page one with the same page size, safe-page retention after malformed or operationally failed reset, authority-denial clearing, and suggestion-scoped navigation into the separately owned detail read. Guide-only authoring, pending, policy, Pull Back, Assistant, relationship, and private Waypoint data are structurally omitted. It adds no command, worker, provider, database, deployment, or real-user activation. |
| Explorer Suggested Waypoint authenticated detail and explicit engagement commands | `src/app/explorer/waypoints/[suggestedWaypointId]/page.tsx`; `src/app/explorer/waypoints/[suggestedWaypointId]/detail/route.ts`; `src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts`; `src/components/solmind/ExplorerSuggestedWaypointDetail.tsx`; `src/lib/solmind/suggestedWaypointExplorer{DetailBrowserContract,CommandClient}.ts`; co-located focused, route, and browser tests | Authenticated Explorer detail over the banked `explorer.get` request composition plus explicit Mark as read and Acknowledge receipt actions through the separately owned command route. Opening remains private and performs no write. Exact browser validation, immutable delivered/current-version content, Explorer-private read state, deliberate shared receipt acknowledgement, authoritative-read settlement, value-free denial/failure, byte-identical uncertain retry, and structural omission of Guide authoring, pending, policy, Pull Back, Assistant, relationship, and private Waypoint data remain enforced. It adds no comparison/adoption/response command, worker, provider, deployment, hosted data, or real-user activation. |
| Guide Suggested Waypoint fixture UI | `src/app/guide/explorers/avery/waypoint-suggestions/page.tsx`; `src/components/solmind/GuideSuggestedWaypointWorkspace.tsx`; `src/lib/solmind/guideSuggestedWaypointFixtures.ts` | Thin deterministic Explorer-context list/detail presentation over Guide-only draft, pending-send, Pull Back, open, and acknowledged states; no persistence, provider, passive Explorer telemetry, or authenticated runtime |
| Guide Suggested Waypoint relationship entry | `src/app/guide/waypoint-suggestions/page.tsx`; `src/app/guide/waypoint-suggestions/[relationshipId]/page.tsx`; `src/components/solmind/GuideSuggestedWaypointRelationshipEntry.tsx`; `src/lib/solmind/suggestedWaypoint{RelationshipBrowser,PaginationShared}Contract.ts` | Authenticated, read-only feature entry over the banked relationship-selector route; exact browser response validation, opaque-cursor pagination, one bounded later-page stale-cursor reset to page one with the same page size, distinct empty/denied/failed states, safe-page retention after malformed or operationally failed reset, authority-denial clearing, and relationship-scoped navigation without suggestion data or commands |
| Guide Suggested Waypoint relationship list | `src/app/guide/waypoint-suggestions/[relationshipId]/page.tsx`; `src/app/guide/waypoint-suggestions/[relationshipId]/suggestions/route.ts`; `src/components/solmind/GuideSuggestedWaypointRelationshipList.tsx`; `src/lib/solmind/suggestedWaypoint{GuideListBrowser,GuideListShared,PaginationShared}Contract.ts` | Authenticated, relationship-scoped, read-only Guide list over the banked `guide.list` request composition; exact browser validation, privacy-minimized lifecycle/status projection, progressive opaque-cursor pagination, one bounded later-page stale-cursor reset to page one with the same page size, safe-page retention after malformed or operationally failed reset, authority-denial clearing, and suggestion-scoped navigation into the separately owned detail read. It adds no command, worker, provider, database, deployment, or real-user activation. |
| Guide Suggested Waypoint relationship detail | `src/app/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/page.tsx`; `src/app/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/detail/route.ts`; `src/components/solmind/GuideSuggestedWaypointDetail.tsx`; `src/lib/solmind/suggestedWaypointGuide{Detail,DraftContent}BrowserContract.ts`; co-located focused and browser tests | Authenticated, relationship-scoped Guide detail over the banked `guide.get` request composition; exact browser validation, Guide-only draft/pending content, immutable delivered content, pending-policy facts, and one opaque pending-version selector. A complete Guide-only draft may be edited, saved, reviewed, and scheduled through the separately owned Guide command client; pending mode may invoke Pull Back. Every conclusive command settles through the authoritative detail read, while transport-uncertain recovery retains exact bytes and operation identity. The pending selector is never rendered or announced and remains absent from Guide lists and every Explorer projection. Deliberate dated receipt acknowledgement, fixed denied/failure states, and structural omission of Explorer-private engagement, Waypoint, conversation, evidence, and inference data remain unchanged. It adds no blank-draft compose, delete, correction, withdrawal, worker, provider, deployment, or real-user activation. |
| Suggested Waypoint display dates | `src/lib/solmind/suggestedWaypointDisplayDate.ts`; co-located focused test; Explorer and Guide list/detail consumers | Shared browser-safe `en-US` presentation for year-complete dates and date-times in the viewer's local time zone. An explicit IANA zone is a deterministic test seam only; production callers do not force UTC or another zone. This owner changes no persisted timestamp, route contract, locale preference, schema, or application-wide date design. |
| Suggested Waypoint shared command predecessor | `src/lib/solmind/suggestedWaypointCommandBrowserContract.ts`; `src/lib/solmind/suggestedWaypointCommandOperation.ts`; co-located focused tests | Browser-safe exact result parsing plus pure retry/settlement state for future Guide and Explorer command edges. It accepts only route-permitted expected outcomes, exposes value-free denied/failed results, snapshots each exact data property once, suppresses double activation, preserves one immutable serialized request and operation ID across transport-uncertain retry, ignores stale generations, and exposes semantic busy, announcement, retry, and focus intents. It adds no route, Server Action, RPC invocation, database write, worker, provider, deployment, or real-user activation. |
| Suggested Waypoint first-write security predecessor | `src/lib/solmind/auth/trustedApplicationOrigin.ts`; `src/lib/solmind/auth/sameOriginJsonWriteRequest.ts`; co-located focused tests; scalar-integrity validation in `src/lib/solmind/supabase/suggestedWaypointRequestComposition.ts` | Server-only fail-closed preparation for future Guide and Explorer command routes. One validated `SOLMIND_TRUSTED_APP_ORIGIN` value supplies authority without trusting Host or forwarded headers. The request guard requires POST, exact JSON media type, same-origin Origin plus Fetch Metadata, identity/no content encoding, canonical optional length, a bounded 16,384-byte stream, strict UTF-8 without BOM, and one frozen plain JSON object. Shared command text rejects isolated UTF-16 surrogates and Unicode line or paragraph separators while accepting valid Unicode scalar pairs. It performs no auth, RPC, database write, route, worker, provider, deployment, or real-user effect by itself. |
| Suggested Waypoint local delivery invoker | `src/lib/solmind/supabase/suggestedWaypointDeliveryWorker.ts`; co-located focused tests | Server-only exact-envelope adapter over the one-function worker RPC executor. A trusted caller supplies and retains the operation, suggestion, and expected pending-version UUIDs. The invoker snapshots those primitive values before client or transport work, invokes the enumerated delivery function once, revalidates and binds the returned payload, and projects only `delivered`, `not_delivered`, or `failed`. It never generates or rotates retry identity and adds no due-item discovery, protected-table scan, queue, claim, lease, poll, scheduler, hosted runtime, provider, deployment, or real-user activation. |
| Suggested Waypoint Guide command route | `src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointGuideCommandRouteContract.ts`; co-located focused and route tests; `.env.example` | First authenticated same-origin browser write edge for Guide create/save draft, schedule send, and Pull Back. It rejects query/path and exact-body authority before cookie/auth/dependency IO, loads one configured trusted origin, applies the shared bounded JSON guard once, injects the path relationship once, delegates actor/role/relationship derivation and the closed RPC to the banked composition once, revalidates the exact function-bound command row, and emits only the shared four-field value-free browser result. The current UI invokes save draft and schedule send for an existing complete draft plus Pull Back for a pending version. It adds no delivery worker or scheduler, Explorer command edge, provider, deployment, hosted data, or real-user activation. |
| Suggested Waypoint Guide draft and Pull Back browser edge | `src/lib/solmind/suggestedWaypointGuideCommandClient.ts`; `src/lib/solmind/suggestedWaypointGuideDraftContentBrowserContract.ts`; `src/lib/solmind/suggestedWaypointPullBackCountdown.ts`; `src/components/solmind/GuideSuggestedWaypointDetail.tsx`; co-located focused and browser tests | Production Guide command UI caller for an existing complete Guide-only draft and its pending version. One shared content owner snapshots and validates normalized single-line destination, multiline why, and unique bounded arrival signals for both detail parsing and the server route. The client builds exact save, schedule, and Pull Back snapshots from the authoritative detail, preserves identical bytes and operation identity across transport-uncertain retry, exposes explicit check-status recovery, and reloads the authoritative detail after conclusive results. Policy and deadline authority remain server-owned; the countdown is display-only. The protected pending-version selector never appears in visible copy, announcements, logs, or URLs. It adds no blank-draft compose, delete, correction, withdrawal, Explorer command, worker, provider, deployment, or real-user activation. |
| Suggested Waypoint Explorer command route and browser edge | `src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointExplorerCommandRouteContract.ts`; `src/lib/solmind/suggestedWaypointExplorerCommandClient.ts`; `src/components/solmind/ExplorerSuggestedWaypointDetail.tsx`; co-located focused, route, and browser tests | Explicit Mark as read and Acknowledge receipt path over server-derived Explorer identity and relationship authority. The browser sends only command kind, UUIDv4 operation identity, and the current version selector; it never supplies actor, role, relationship, or Guide-visible private-read data. One command runs at a time, transport-uncertain retry preserves exact bytes, conclusive outcomes require an authoritative detail read, and late or wrong-target results cannot mutate the view. Opening remains write-free. It adds no comparison/adoption/response command, worker, provider, deployment, hosted data, or real-user activation. |
| Shared UI | `src/components/solmind/*.tsx` | Reusable presentational components |
| Role model | `src/lib/solmind/roles.ts` | Canonical role strings, labels, and home routes |
| Route metadata | `src/lib/solmind/pages.ts` | Page titles, descriptions, and hrefs |
| Navigation | `src/lib/solmind/navigation.ts` | Primary nav items and route labels |
| Login options | `src/lib/solmind/loginOptions.ts` | Static login option copy and auth summaries |
| Dashboard panels | `src/lib/solmind/dashboardPanels.ts` | Static Admin and Guide panel definitions |
| Route access preview | `src/lib/solmind/routeAccess.ts` | Static route-access preview rules |
| Explorer onboarding | `src/lib/solmind/onboarding.ts` | Exact S01 structured-form fields and distinct required-form/optional-First-Compass states |
| Terms | `src/lib/solmind/terms.ts` | Canonical product and assistant terms |
| Conversation/profile/topics | `src/lib/solmind/*.ts` | Static Explorer preview content |
| Admin access probe | `src/app/admin/access/route.ts` | Opaque Admin access probe returning `{ allowed }`; does not protect pages; its composition persists bounded Auth/RLS audit rows (AUD-3) |
| Server authorization | `src/lib/solmind/auth/*.ts` | Deny-by-default request-auth boundary, role context, route-access decisions, relationship guards, the bounded audit event model, and the audit event writer |
| Role/AI context | `src/lib/solmind/context/*.ts` | Explorer-facing and AI-role context assembly; keeps Explorer-private and Guide-private context separate |
| Provider-free Explorer-safe context kernel (`PRJ01_R-WS09-WI021-S03A`) | `src/lib/solmind/context/explorerContext.ts`; `src/lib/solmind/context/explorerSafeContext.ts`; co-located tests | Direct-import server-only runtime validation and deterministic nine-layer Explorer projection. Summary continuity now requires the exact banked published projection: published container and target publication, active/paused relationship, published revision, and Explorer-facing published section. Cross-contract tests pin every accepted Summary vocabulary to the owning migrations. The kernel stays off the context barrel and proves exact keys, role/binding separation, privacy-byte absence, limits, immutability, and canonical serialization. It is not a provider prompt, source repository, snapshot/audit owner, context budget, route/UI path, or real-user conversation. |
| Supabase integration | `src/lib/solmind/supabase/*.ts` | Server-side request-auth client (who), guarded service-role loader (what), principal mapping, session selection, and the closed-allowlist audit write executor with its admin audit-writer factory |
| Banked dormant protected application setting (`PRJ01_R-WS09-WI021-S02`) | `src/lib/solmind/supabase/applicationSettingReader.ts`; `supabase/migrations/20260730000000_application_setting_foundation.sql`; `supabase/tests/application_setting_foundation_*_test.sql` | Fixed-key server-only read plus protected service-role-only mutation for the 1-100 day Shared Snapshot sendability setting. Actual changes use expected-version serialization and exact Family F same-transaction audit; same-value/current-version requests and exact already-applied retries are writeless. No routine role, browser, or direct-table mutation path exists, and no application caller is banked. |
| Banked local S02 synthetic relationship fixture | `supabase/fixtures/PRJ01_R_WS09_WI021_S02_LOCAL_FIXTURE.md`; `supabase/fixtures/prj01_r_ws09_wi021_s02_local_fixture_{setup,validate,cleanup}.sql` | Manually invoked local-development fixture for exactly one synthetic Guide, one synthetic Explorer, and one active relationship with bounded Virtual Guide behavior text. Setup and cleanup fail closed; validation is read-only. It is never a production migration, universal seed, hosted fixture, or real-user identity source. |
| Banked dormant Summary publication and Shared Snapshot foundation (`PRJ01_R-WS09-WI021-S02`) | `supabase/migrations/20260812000000_summary_shared_snapshot_realignment.sql`; `supabase/tests/summary_shared_snapshot_realignment_*_test.sql` | Forward-only, fail-closed realignment for immutable Guide-authored Summary revisions/sections, authoritative publication, the targeted Explorer projection, Explorer-private exact-review drafts, immutable confirmed Shared Snapshots, preserved lineage, and service-role-only bounded mutation/integrity surfaces. It has no caller, permissive RLS policy, direct-table role grant, operational timer, provider path, hosted data, deployment, or real-user activation. |
| Dormant Suggested Waypoint database/security foundation (`PRJ01_V-WS05-WI022-S02`) | `supabase/migrations/20260813000000_suggested_waypoint_persistence_security_foundation.sql`; `supabase/migrations/20260818000000_suggested_waypoint_explorer_relationship_invariant.sql`; `supabase/migrations/20260821000000_suggested_waypoint_destination_single_line_invariant.sql`; `supabase/migrations/20260821001000_suggested_waypoint_guide_pending_version_projection.sql`; `supabase/tests/suggested_waypoint_persistence_*_test.sql` | Eight distinct protected owners, closed six-command/five-query service-role-only catalog, authoritative send-grace deadline, immutable version/receipt/replay proof, Explorer-private read state, value-free audit evidence, structural/real-path/concurrency pgTAP proof, and forward-only corrections for the one-Guide Explorer-list invariant, destination-specific single-line enforcement, and Guide-detail-only pending-version projection. The destination correction rejects LF and Unicode line/paragraph separators through both save-draft and all three content-table triggers while preserving multiline `why` normalization and idempotent replay. The pending-version correction replaces only the exact Guide detail function, preserves its security-definer boundary and grants, and exposes the protected pending selector only while authoring mode is pending. It has no hosted worker, provider, permissive RLS policy, direct-table role grant, deployment, or real-user activation. |
| Suggested Waypoint closed S03 RPC transport (`PRJ01_V-WS05-WI022-S03`) | `src/lib/solmind/supabase/suggestedWaypointRpcContract.ts`; `src/lib/solmind/supabase/suggestedWaypointRpcExecutor.ts`; `src/lib/solmind/supabase/suggestedWaypointPaginationRpcError.ts`; `src/lib/solmind/supabase/suggestedWaypointExplorerRelationshipRpcError.ts`; `src/lib/solmind/supabase/__tests__/suggestedWaypointRpcExecutor.test.ts`; `src/lib/solmind/supabase/__tests__/suggestedWaypointRpcOutcomeAlgebra.test.ts` | Exact nine-function human and one-function worker allowlists, exact input/output validation, canonical eight-value command outcomes with function-specific nullability and call binding, lifecycle-coherent role projections, frozen copies, value-free transport-failure mapping, exact-function-bound zero-row denial for only the Guide and Explorer detail gets, exact stale-cursor classification for only the two role lists, and exact Explorer-list relationship-invariant classification to the existing denied result. Guide detail alone may carry the opaque pending-version selector, and only while authoring mode is pending; Guide lists and Explorer projections remain structurally unchanged. Every other zero-row, function, or error near match remains failed. It excludes the dormant Admin query and has no hosted worker, provider, deployment, or real-user effect. |
| Suggested Waypoint S03 authenticated request composition (`PRJ01_V-WS05-WI022-S03`) | `src/lib/solmind/supabase/suggestedWaypointRequestComposition.ts`; `src/lib/solmind/supabase/__tests__/suggestedWaypointRequestComposition.test.ts` | Direct-import server-only human-request boundary with exact client-safe Guide/Explorer shapes, single-line Guide-authored destinations, request-auth actor/role derivation, Guide relationship enforcement, server-derived actor injection, server-resolved initial suggestion/version identifiers, bound detail-denial preservation, and fixed browser-safe results. The destination-specific database invariant independently enforces the same single-line boundary without narrowing intentionally multiline `why`. Separately reviewed thin read routes and bounded Guide/Explorer command routes call this boundary; it still adds no Server Action, worker, provider, deployment, hosted data, or real-user activation. |
| Suggested Waypoint S03 concrete request dependencies (`PRJ01_V-WS05-WI022-S03`) | `src/lib/solmind/supabase/suggestedWaypointRequestDependencies.ts`; `src/lib/solmind/supabase/suggestedWaypointScopedIdentifiers.ts`; co-located focused tests | Request-scoped direct-import server-only assembly of verified request identity, enumerated auth-record reads, the closed human executor, and required stable UUIDv5 identifiers bound to exact actor/relationship/operation purposes. The relationship selector, role-safe Guide/Explorer reads, Guide command route, and Explorer engagement command route use these bounded dependencies. Blank-draft compose, delete/correction/withdrawal callers, remaining Explorer commands, Server Actions, workers, providers, deployment, hosted data, and real-user activation remain absent. |
| Suggested Waypoint S03 Guide relationship selector (`PRJ01_V-WS05-WI022-S03`) | `supabase/migrations/20260814000000_suggested_waypoint_relationship_selector.sql`; `supabase/tests/suggested_waypoint_relationship_selector_*_test.sql`; `src/lib/solmind/supabase/suggestedWaypointRelationshipSelector*.ts`; `src/lib/solmind/supabase/suggestedWaypointPaginationRpcError.ts`; co-located focused tests | Feature-specific active relationship selector with server-derived Guide authority, stable keyset pagination, exact relationship-ID/Explorer-display-name/creation-time projection, frozen browser-safe results, and exact-function-bound stale-cursor recovery. It has no generic roster semantics and excludes onboarding, appointment, Shared Snapshot, Practice, suggestion-count, contact, and private Explorer data. One read-only route and production entry page use it; no Server Action, command, deployment, or real-user activation exists. |
| Suggested Waypoint S03 Guide relationship-selector route (`PRJ01_V-WS05-WI022-S03`) | `src/app/guide/waypoint-suggestions/relationships/route.ts`; co-located route tests | Read-only browser-reachable S03 data boundary. It accepts validated pagination only, builds the read-only request-cookie accessor, delegates actor/role derivation and relationship recheck to the banked server owners, returns the fixed minimized selector result, and sets `private, no-store`. The production entry page consumes it; the route does not invoke human commands, write product data, schedule delivery, call a provider, deploy, or affect real users. |
| Schema foundations | `supabase/migrations/*.sql` | MVP0 schemas and tables; Row Level Security enabled deny-by-default; no permissive policies or grants yet |
| Write-path concurrency harness | `supabase/tests/write_path_concurrency_harness_test.sql` | Local-only pgTAP plus `dblink` foundation for deterministic multi-session race proofs; future DEF-005 function slices must reuse its distinct-session, observed-lock-contention, bounded-timeout, and teardown pattern for their owning concurrency tests |
| Verification redemption CAS (dormant DEF5-S2) | `supabase/migrations/20260712000000_verification_challenge_redemption_function.sql`; `supabase/tests/verification_challenge_redemption_*_test.sql` | Dormant service-role-only verification redemption function and sequential/concurrent proofs. The concurrency suite commits reserved synthetic rows outside its outer rollback boundary, performs targeted cleanup, and requires Paul's explicit approval for the documented recovery cleanup after a hard failure. It does not issue challenges, create sessions, wire routes, or activate a runtime path. |
| Verification challenge issuance (dormant DEF5-S3) | `supabase/migrations/20260713000000_verification_challenge_issuance_function.sql`; `supabase/tests/verification_challenge_issuance_*_test.sql` | Banked dormant service-role-only issuance function, structurally-open partial unique index, exact embedded Family B issuance audit, and sequential/concurrent proofs. It has no app caller, delivery path, invitation route, or rate-limit enforcement. Both UUID binding inputs are present together or both null; the null pair is restricted to approved pre-account purposes. |
| Session creation and supersession (banked dormant DEF5-S4) | `supabase/migrations/20260716000000_user_session_creation_function.sql`; `supabase/migrations/20260716001000_user_session_creation_chronology_guard.sql`; `supabase/tests/user_session_creation_*_test.sql` | Banked service-role-only primitive consuming committed account-bound `login` or `role_reentry` redemption evidence. It includes a protected freshness policy, account-wide active-session and per-challenge uniqueness, safe exact retry, atomic supersession, embedded Family B session audit, and an all-history `(used_at, challenge UUID)` guard that prevents delayed never-sessionized older evidence from superseding newer login evidence. The correction is banked in `d2fbb0e`; the three plans contain 49/51/50 assertions and clean reset passed 14 files / 502 assertions. It has no caller, route, cookie, provider action, provisioning path, cloud action, or real-user activation. |
| Invitation acceptance and Explorer issuance foundations (`PRJ01_F-WS06-WI008-S02B` through `PRJ01_F-WS06-WI008-S02D`) | `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; `20260718001000_invitation_acceptance_preparation.sql`; `20260718002000_guide_invitation_acceptance.sql`; `20260718003000_admin_guide_invitation_issuance.sql`; `20260721000000_explorer_engagement_capacity_foundation.sql`; `20260724000000_invited_identity_provisioning_helper_generalization.sql`; `20260725000000_explorer_invitation_issuance.sql`; related `supabase/tests/*invitation*` and `invited_identity_provisioning_helper_explorer_test.sql` | Banked dormant evidence-consumption, pre-provider reservation, Guide acceptance, Admin Guide-invitation, Explorer capacity/lock foundations, the shared invited-identity helper, and two Guide-owned Explorer issuance/revocation functions. `PRJ01_F-WS06-WI008-S02D` is banked in app commit `a9944f1` after focused 203/203 and complete 1,547/1,547 database assertions, zero-residue proof, final clean reset, lint, typecheck, 487 application tests, production build, and exact Fable 5 assurance passed. It enforces normalized-contact open-invitation capacity, same-Guide/same-Practice replacement, cross-Guide nondisplacement, expiry materialization, exact retry, explicit Guide revocation, and exact fail-closed transactional audit. It preserves the separately owned Explorer acceptance, preparation pre-check, cross-operation concurrency/debt closure, callers, provider effects, delivery, consent, sessions, cloud, deployment, and real-user gates. |
| Explorer invitation acceptance (`PRJ01_F-WS06-WI008-S02E`; banked dormant foundation) | `supabase/migrations/20260727000000_explorer_invitation_acceptance.sql`; `supabase/tests/explorer_invitation_acceptance_*_test.sql`; focused extensions to `supabase/tests/invitation_acceptance_preparation_*_test.sql` | Banked dormant service-role-only acceptance transaction plus the approved preparation capacity pre-check. It consumes committed authorizing evidence once, reuses the shared invited-identity helper, enforces first-commit-wins current-Guide capacity, creates exactly one `intake_pending` relationship with invitation provenance, accepts the invitation, revokes only same-Guide/same-Practice/same-contact open siblings, and writes the exact Family B audit rows transactionally. Focused validation passed 6 files / 436 assertions and complete validation passed 31 files / 1,777 assertions with zero synthetic residue and three clean 32-migration resets. It is banked in app commit `5e98ebf`; it remains dormant, has no app caller, and is not deployed or active for real users. |

## S01 Privacy and Visibility Rules

- Submitted onboarding answers become Guide-visible only after form submission.
- First Compass is optional and distinct from required-form completion.
- Conversation, Compass, Route, Waypoint, selection, and Private Summary Draft
  remain Explorer-private.
- Selecting summary items is not sharing.
- Final review is freshly derived from the current selection.
- `Not ready to share` creates no Guide-visible conversation artifact.
- Only explicit confirmation creates a deeply frozen in-memory Shared Snapshot.
- The non-live Guide projection receives submitted onboarding answers and that
  exact snapshot, never raw conversation or excluded items.
- Admin disclosure must say that authorized Admin access may occur under
  defined operational conditions; do not claim Admin cannot see content.

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
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:browser
npm.cmd run build
```

5. Stop at every approval gate required by the current workspace workflow.

## Banked Foundations vs Still Deferred

Earlier guidance told agents not to start Supabase, auth, or RLS. That is no longer accurate. Several foundation-first backend modules are now banked in this repo. Treat the items below accordingly, and verify current status against `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11), which is the authoritative Auth/RLS banked-vs-deferred register.

### Banked foundations (do not re-create or duplicate)

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- The Auth/RLS request-auth boundary, real Admin auth-source loading, and server-only hardening under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- The browser-safe Suggested Waypoint shared command predecessor under
  `src/lib/solmind/suggestedWaypointCommand*.ts`; it owns exact result parsing
  and pure transport-uncertain retry state only, not a route or write caller.
- The server-only Suggested Waypoint first-write security predecessor under
  `src/lib/solmind/auth/{trustedApplicationOrigin,sameOriginJsonWriteRequest}.ts`
  plus Unicode-scalar validation in the existing request composition. It owns
  strict same-origin JSON framing and one 16,384-byte cap, not a command route,
  authentication decision, or database caller.
- The relationship-scoped Suggested Waypoint Guide command route at
  `src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts` and
  its direct-import server-only route contract. It binds create/save draft,
  schedule send, and Pull Back to the existing authenticated composition and
  exact role-safe result projection. The current Guide detail calls save draft,
  schedule send, and Pull Back for an existing complete draft lifecycle, then
  settles every conclusive result through the authoritative read.
- The suggestion-scoped Suggested Waypoint Explorer command route and browser
  client at `src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts`
  and `src/lib/solmind/suggestedWaypointExplorerCommandClient.ts`. The detail
  invokes only explicit Mark as read and Acknowledge receipt, then settles
  through the authoritative detail read. Opening remains private and write-free.
- The `/admin/access` server route handler: an opaque probe returning only `{ allowed }`. It is read-only and does not protect the `/admin`, `/guide`, or `/explorer` pages.
- Auth/RLS audit persistence for `/admin/access`: the bounded event model (`src/lib/solmind/auth/authRlsAuditEvent.ts`), the enumerated `public.solmind_record_audit_event` writer function (migration `20260708000000_audit_event_writer_function.sql`), the closed-allowlist app writer chain (`auditEventWriter.ts`, `auditEventWriteExecutor.ts`, `adminAuditEventWriter.ts`), and the runtime wiring in `adminAccessRequest.ts` (AUD-1/AUD-2/AUD-3). On an allow the guarded-read row is written first, then the allow decision row, and both must persist before the outward allow (fail-closed); deny and resolution-failure rows are best-effort.
- Dormant invitation foundations through `PRJ01_F-WS06-WI008-S02D` - Guide-to-Explorer invitation issuance, same-Guide replacement, and revocation - are banked through synchronized app commit `a9944f1`. The S02D functions remain dormant over the earlier capacity, lock, and helper substrate; none has an application caller or real-user path.

The S02E Explorer acceptance files described above are banked in synchronized
app commit `5e98ebf13f2626d75c140d3d654dfbfd06258b21` after exact application,
focused and complete database validation, staged-blob equality, push, and clean
synchronization. Do not treat the banked dormant substrate as a live caller,
provider path, session/consent workflow, deployment, or real-user feature.

The S01 Explorer experience is interactive application code, but it is
deliberately deterministic and transient. Its presence does not mean S02
persistence or S03 provider integration is banked.

Extend these modules deliberately and in small slices. Keep server-only modules off the shared client barrels, as the existing code does.

### Still deferred (do not start without prerequisite docs, tests, and approval)

- Permissive or role-aware RLS policies, grants, and runtime access enforcement. RLS stays deny-by-default.
- Audit persistence beyond the banked dormant DEF5-S2 redemption, DEF5-S3 issuance, DEF5-S4 session, and S02 protected-setting Family F subsets: remaining login/provisioning (Family B), Admin sensitive-access (Family C), safety/escalation (Family D), and content/AI-lifecycle (Family E) audit vocabularies and runtime wiring; a real operational logging/alarm mechanism (the AUD-3 operational signal is an injectable no-op seam); the deferred system-context/null-actor guarded-read vocabulary (AUTH-RLS-DEF-019); and any audit retention/review tooling. No new audit table grants, policies, or hidden-schema Data API exposure exist.
- Authentication middleware. MVP0 deliberately prefers explicit per-route and server-action composition over middleware (register decision AUTH-RLS-DEC-017); do not introduce middleware without a specific approved justification.
- The runtime login/provisioning write path, including any caller of the banked dormant session primitive, any caller of the dormant invitation functions, and all provider-identity/provisioning writes.
- S02 onboarding, Compass, Route, Waypoint, conversation, notification, and
  remaining persistence. The protected setting, local fixture, immutable
  Guide-authored Summary publication, Explorer-private exact-review draft,
  Explorer-confirmed Shared Snapshot, and preserved-lineage foundations are
  banked dormant. No application caller, operational send/expiry timer,
  permissive role path, hosted data, provider behavior, deployment, or
  real-user path is banked.
- S03 genuine provider conversation beyond the banked provider-free S03A
  kernel: source repositories, current authorization/consent revalidation,
  snapshot and audit/fingerprint enforcement, context budgeting, provider
  selection/dispatch, session/message persistence, safety response, and UI.
- Guide Assistant context from these Explorer artifacts.
- Suggested Waypoint blank-draft compose, delete, correction, and withdrawal UI
  callers, remaining Explorer comparison/adoption/response command callers,
  due-item discovery and scheduling around the banked local delivery invoker,
  and a hosted delivery-worker caller beyond the banked authenticated
  composition, shared command predecessor, local delivery invoker, role-scoped
  Guide and Explorer command routes, Guide Pull Back and Explorer engagement
  callers, Guide relationship selector, and role list/detail paths.
- Production Guide dashboard integration.
- Runtime safety classification and escalation.
- Reflection storage beyond approved future slices.
- Vector retrieval.
- Billing.
- Calendar integrations.
- NDA workflow.

## S01 Test Ownership

`src/lib/solmind/__tests__/explorerExperience.test.ts` owns deterministic
acceptance proofs for S01 Compass, Route, Waypoint, summary selection, final
review, frozen snapshot, and non-live Guide projection behavior.

`src/lib/solmind/__tests__/onboarding.test.ts` owns the exact six-field
onboarding contract, required/optional distinction, Guide-visibility marker,
distinct optional First Compass offer, and corrected Admin disclosure.
