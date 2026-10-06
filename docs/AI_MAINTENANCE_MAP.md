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
- `/login` - sign-in preview: the approved sign-in screens, local and in-memory, not connected
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

The bounded S01R2 `/explorer/compass-comparison` route is a second
browser-memory-only review surface for the conversation-first portion of that
experience. `src/app/explorer/compass-comparison/page.tsx` stays thin;
`src/components/solmind/ExplorerCompassComparison.tsx` owns client
orchestration; `ExplorerCompassComparisonParts.tsx` owns presentation; and
`src/lib/solmind/explorerCompassComparison.ts` owns pure deterministic state.
It demonstrates fixed local Virtual Guide turns, Compass attention distinct
from confirmed Priority, a conversation-mediated Forming Waypoint,
provenance-linked quotations, and separate whole-conversation,
Reached-Waypoint, and exact-quotation sharing explanations. It adds no
provider, persistence, authentication, server route, notification, actual
sharing, deployment, or real-user effect. Genuine provider conversation stays
in separately gated S03.

The `/login` sign-in preview follows the same split. `src/app/login/page.tsx`
stays thin; `src/components/solmind/SignInPreview.tsx` owns the one client
boundary; `SignInPreviewParts.tsx` owns presentation; and
`src/lib/solmind/signInPreview.ts` owns the approved copy and the pure
screen transitions. It shows the sign-in screens approved for UAT (A1, A2,
A3, A3A, A4, M1, M2, M3) in their approved layouts, sends and checks
nothing, keeps entries only in page memory, and adds no route handler,
server action, cookie, Supabase or auth-module use. Its own additions are
styled apart: a separate "Preview controls" band (the disclosure, a message
switcher, and on A3 and A3A a remembered-browser switch), an example-screen
callout beside each code screen's claims, and explanations beside
unconnected controls. Guide opens A3 and Admin opens A3A; either goes on to
A4 for that role, ticked or not, unless the remembered-browser switch is on:
then the tick box is hidden, because the browser is already remembered and
the box would do nothing; the button reads "Sign in", explains beside itself
that it skips the code, and the screen stays. The tick box and the switch
are page memory only, and the password field is uncontrolled, so its value
never reaches the preview's state or markup.
A new-code request keeps A4, M1 or M2 on screen with what was typed; only the
preview switcher moves between the code screens.
Wiring it to real sign-in is login step 6.

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
or real-user path. Login step 2 (app `05884ed`) later added the AUTH-RLS-DEC-037
rate limits inside the dormant issuance function, again without a caller.
Login step 4 later added a dormant, server-only, provider-neutral
verification-code delivery boundary and a loopback-only development SMTP
transport under `src/lib/solmind/auth/`, again without a caller or a real
provider. Login step 5 then added the dormant code module, the issuing and
redeeming callers, and their composition root beside them, again with no
route, server action, cookie, session or runtime caller. Login step 6's
sub-slice S6-2 then added the dormant session-cookie policy and the
login-step cookie writer, again with no route or caller, so nothing writes a
cookie at runtime. Login step 6's sub-slice
S6-6 then added a dormant, server-only caller of the banked session-creation
function and the pure session-duration rule it uses, again with no route,
cookie or runtime caller. Login step 6's sub-slice S6-7 then added the
dormant Supabase identity bridge beside the request-auth client, which holds
a provider sign-in's cookies in memory, again with no route or runtime caller.
Login step 6's sub-slice S6-1 then added the dormant verification pepper
source, the login route configuration with its startup check, and the shared
login contact normalizer, again with no route or runtime caller.

Still not implemented: permissive or role-aware RLS policies and grants;
runtime login/session callers; effectful provider provisioning; Explorer
invitation callers; onboarding/Compass persistence; sendability timing or
expiry; genuine provider conversation; safety-flag runtime handling; and
operational Guide/Admin runtime workflows.

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
      SignInPreview.tsx
      SignInPreviewParts.tsx

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
      signInPreview.ts
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
| Suggested Waypoint whole-path local safety kernel | `tests/whole-path/suggestedWaypointWholePathSafety.ts`; focused tests and folder README | Effect-free pre-credential gate for the future `CARRY-001` / `RPR-011` local authenticated proof. It requires two exact, necessary but non-authorizing local-effect interlocks, the literal `solmind-app` project, loopback Supabase API `54321`, database port `54322`, one separately owned loopback application port, one bounded run ID, and five closed synthetic role labels covering both unrelated-role directions plus an ended-relationship actor. It derives only reserved `synthetic.invalid` recipients and adds no client, key read, principal, cookie, process, file, database row, provider, hosted request, deployment, or real-user effect. The code-visible interlocks never replace active workflow and human authority; fixture lifecycle, isolated role sessions, runner execution, zero-residue proof, and final reset remain separately owned. |
| Suggested Waypoint Guide command route | `src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointGuideCommandRouteContract.ts`; co-located focused and route tests; `.env.example` | First authenticated same-origin browser write edge for Guide create/save draft, schedule send, and Pull Back. It rejects query/path and exact-body authority before cookie/auth/dependency IO, loads one configured trusted origin, applies the shared bounded JSON guard once, injects the path relationship once, delegates actor/role/relationship derivation and the closed RPC to the banked composition once, revalidates the exact function-bound command row, and emits only the shared four-field value-free browser result. The current UI invokes save draft and schedule send for an existing complete draft plus Pull Back for a pending version. It adds no delivery worker or scheduler, Explorer command edge, provider, deployment, hosted data, or real-user activation. |
| Suggested Waypoint Guide draft and Pull Back browser edge | `src/lib/solmind/suggestedWaypointGuideCommandClient.ts`; `src/lib/solmind/suggestedWaypointGuideDraftContentBrowserContract.ts`; `src/lib/solmind/suggestedWaypointPullBackCountdown.ts`; `src/components/solmind/GuideSuggestedWaypointDetail.tsx`; co-located focused and browser tests | Production Guide command UI caller for an existing complete Guide-only draft and its pending version. One shared content owner snapshots and validates normalized single-line destination, multiline why, and unique bounded arrival signals for both detail parsing and the server route. The client builds exact save, schedule, and Pull Back snapshots from the authoritative detail, preserves identical bytes and operation identity across transport-uncertain retry, exposes explicit check-status recovery, and reloads the authoritative detail after conclusive results. Policy and deadline authority remain server-owned; the countdown is display-only. The protected pending-version selector never appears in visible copy, announcements, logs, or URLs. It adds no blank-draft compose, delete, correction, withdrawal, Explorer command, worker, provider, deployment, or real-user activation. |
| Suggested Waypoint Explorer command route and browser edge | `src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointExplorerCommandRouteContract.ts`; `src/lib/solmind/suggestedWaypointExplorerCommandClient.ts`; `src/components/solmind/ExplorerSuggestedWaypointDetail.tsx`; co-located focused, route, and browser tests | Explicit Mark as read and Acknowledge receipt path over server-derived Explorer identity and relationship authority. The browser sends only command kind, UUIDv4 operation identity, and the current version selector; it never supplies actor, role, relationship, or Guide-visible private-read data. One command runs at a time, transport-uncertain retry preserves exact bytes, conclusive outcomes require an authoritative detail read, and late or wrong-target results cannot mutate the view. Opening remains write-free. It adds no comparison/adoption/response command, worker, provider, deployment, hosted data, or real-user activation. |
| Shared UI | `src/components/solmind/*.tsx` | Reusable presentational components |
| Role model | `src/lib/solmind/roles.ts` | Canonical role strings, labels, and home routes |
| Route metadata | `src/lib/solmind/pages.ts` | Page titles, descriptions, and hrefs |
| Navigation | `src/lib/solmind/navigation.ts` | Primary nav items and route labels |
| Login options | `src/lib/solmind/loginOptions.ts` | Static login option copy and auth summaries; retained, no longer used by `/login` |
| Sign-in preview | `src/lib/solmind/signInPreview.ts` | Approved sign-in copy and pure screen transitions for the unconnected `/login` preview |
| Sign-in preview UI | `src/components/solmind/SignInPreview.tsx`, `SignInPreviewParts.tsx` | The one client boundary and its presentation for `/login` |
| Dashboard panels | `src/lib/solmind/dashboardPanels.ts` | Static Admin and Guide panel definitions |
| Route access preview | `src/lib/solmind/routeAccess.ts` | Static route-access preview rules |
| Explorer onboarding | `src/lib/solmind/onboarding.ts` | Exact S01 structured-form fields and distinct required-form/optional-First-Compass states |
| Terms | `src/lib/solmind/terms.ts` | Canonical product and assistant terms |
| Conversation/profile/topics | `src/lib/solmind/*.ts` | Static Explorer preview content |
| Admin access probe | `src/app/admin/access/route.ts` | Opaque Admin access probe returning `{ allowed }`; does not protect pages; its composition persists bounded Auth/RLS audit rows (AUD-3) |
| Server authorization | `src/lib/solmind/auth/*.ts` | Deny-by-default request-auth boundary, role context, route-access decisions, relationship guards, the bounded audit event model, and the audit event writer |
| Role/AI context | `src/lib/solmind/context/*.ts` | Explorer-facing and AI-role context assembly; keeps Explorer-private and Guide-private context separate |
| Provider-free Explorer-safe context kernel (`PRJ01_R-WS09-WI021-S03A`) | `src/lib/solmind/context/explorerContext.ts`; `src/lib/solmind/context/explorerSafeContext.ts`; co-located tests | Direct-import server-only runtime validation and deterministic nine-layer Explorer projection. Summary continuity now requires the exact banked published projection: published container and target publication, active/paused relationship, published revision, and Explorer-facing published section. Cross-contract tests pin every accepted Summary vocabulary to the owning migrations. The kernel stays off the context barrel and proves exact keys, role/binding separation, privacy-byte absence, limits, immutability, and canonical serialization. It is not a provider prompt, source repository, snapshot/audit owner, context budget, route/UI path, or real-user conversation. |
| Provider-neutral Virtual Guide conversation contract (`PRJ01_R-WS09-WI021-S03B`) | `src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts`; co-located focused tests | Direct-import server-only validation around the exact compact S03A serialization and opaque invocation, Explorer, session, snapshot, and fingerprint bindings. The boundary passes a frozen request only to one injected transport, enforces caller cancellation and a bounded timeout, validates an exact invocation-bound response, and exposes a closed value-free error algebra. Tests use an in-memory fake transport. Context retrieval, authorization/consent refresh, fingerprint creation or verification, provider selection/adapter/credentials, persistence, audit writing, route/UI wiring, deployment, and real-user activation remain separate gates. |
| Authorized Virtual Guide context composition (`PRJ01_R-WS09-WI021-S03C`) | `src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts`; co-located focused tests | Direct-import server-only composition over exactly two injected source capabilities. It validates server-issued request IDs, self-Explorer actor/account binding, active onboarding, adult affirmation, active/paused relationship binding, and equality of active-required versus accepted consent IDs; runs the S03A allowlist; binds the same Explorer/session; hashes the exact compact serialization; and revalidates a minimized authorization proof/version before returning a frozen S03B request. Source mutation, accessor/extra capabilities, stale authorization, excluded-continuity canaries, prompt-injection data, cancellation and value-free failure are tested. Concrete repository/database loading, persisted snapshots, S03D pre-I/O evidence, provider selection/call, route/UI wiring, deployment and real-user activation remain separate gates. |
| Virtual Guide pre-dispatch evidence (`PRJ01_R-WS09-WI021-S03D`) | `supabase/migrations/20260924000000_virtual_guide_predispatch_evidence.sql`; `supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql`; `supabase/tests/virtual_guide_predispatch_evidence_*_test.sql` | Dormant service-role-only atomic database boundary. It locks and revalidates the current Explorer account/role, allowed Explorer session type and active status, profile/onboarding, relationship/Practice, single-Guide topology (no other current Guide relationship), active/approved Practice and Organization, restricted-mode state, adult affirmation and exact current required-consent set; recomputes the AV1 proof; then creates one bounded context snapshot, one started invocation and exactly two value-free Family E events. Canonical arrays, stabilized consent definition, advisory serialization, unique indexes and a lock timeout make exact retry idempotent and explicitly no-dispatch. The hardening migration makes every authority and exact-retry comparison null-safe, requires a non-null contract version on populated invocation evidence, and reports snapshot or invocation identifier reuse under another operation, normally as `operation_conflict` (a racing reuse can instead end in the lock timeout, and a check that runs earlier, such as stale authorization, reports its own error first). It has no context loader, provider call, credential reader, route/UI wiring, message persistence, safety runtime, deployment or real-user activation. |
| OpenAI Luna Virtual Guide transport (`PRJ01_R-WS09-WI021-S03E`) | `src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts`; co-located focused tests | Dormant direct-import server-only S03B transport mapping. It fixes the OpenAI Responses endpoint, model `gpt-5.6-luna`, medium reasoning, `store: false`, fixed anti-injection Virtual Guide instructions and a bounded response body/output. Only the S03B authorized-context string is provider input; no separate Explorer/session/snapshot metadata is sent. Configuration/accessor, HTTP, redirect, model/status, tool-output, malformed/mixed content, refusal, oversize, credential-leak and dependency cases use fake HTTP. Environment/credential selection, the pre-dispatch gate (an S03D `created` outcome plus server composition), route/UI wiring, deployment and any real provider call remain separate gates. |
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
| Verification redemption CAS (dormant DEF5-S2) | `supabase/migrations/20260712000000_verification_challenge_redemption_function.sql`; `supabase/tests/verification_challenge_redemption_*_test.sql` | Dormant service-role-only verification redemption function and sequential/concurrent proofs. The concurrency suite commits reserved synthetic rows outside its outer rollback boundary, performs targeted cleanup, and requires Paul's explicit approval for the documented recovery cleanup after a hard failure. It does not issue challenges, create sessions, wire routes, or activate a runtime path. Its only app caller is login step 5's dormant redeeming caller. |
| Verification challenge issuance (dormant DEF5-S3, with login step 2 abuse limits) | `supabase/migrations/20260713000000_verification_challenge_issuance_function.sql`; `supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql`; `supabase/tests/verification_challenge_issuance_*_test.sql`; `supabase/tests/verification_issuance_abuse_limits*_test.sql` | Banked dormant service-role-only issuance function, structurally-open partial unique index, exact embedded Family B issuance audit, and sequential/concurrent proofs. Login step 2 (app `05884ed`) adds the AUTH-RLS-DEC-037 limits: at most six committed issuances per normalized contact in a rolling hour across all purposes, a non-extending 15-minute lockout after the sixth, writeless `denied` outcomes, and the contact-plus-creation-time index. The function requires a READ COMMITTED transaction begun at most 10 seconds earlier and sets `transaction_timeout` to 60 seconds for the rest of the calling transaction; per its comment, callers make each call in its own short transaction and must not change `transaction_timeout` afterwards. Its only app caller is login step 5's dormant issuing caller, and it has no runtime caller or invitation route; the follow-up recorded at banking measures the lockout's inner count with realistic stored history before any caller is approved, so that measurement must happen before login step 5's issuing caller is approved or banked. Both UUID binding inputs are present together or both null; the null pair is restricted to approved pre-account purposes. |
| Verification-code delivery boundary (dormant, login step 4) | `src/lib/solmind/auth/verificationCodeDelivery.ts`; `src/lib/solmind/auth/__tests__/verificationCodeDelivery.test.ts` | Direct-import server-only, provider-neutral delivery boundary described in `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md` section 7.1.3. It prepares a delivery only from an `issued` issuance outcome, which is a trusted-caller precondition rather than proof that a challenge committed; it checks every field, rejects unknown keys, and returns an opaque handle that serializes to `{}`. It calls one injected transport's `send` at most once per prepared handle within a caller-set 10 ms to 15 s elapsed-time ceiling, with retry ceiling 0 and no fallback transport; a handle cannot be delivered twice, but two handles prepared with the same challenge and code are two sends. A retry is supersede-and-reissue under AUTH-RLS-DEC-033, which spends budget under AUTH-RLS-DEC-037. Results are a frozen, value-free `{ outcome }` from the closed nine-value set; the boundary meters no spend and passes through whatever closed outcome the transport returns, before the ceiling, a throw, rejection or unknown value becomes `ambiguous`. At the ceiling the boundary aborts the transport and gives it one turn to report; only the literal `ambiguous` (or a rejection) can win then, and anything else, including an unknown value, or no answer, is `timeout`, so no success is reported after the deadline. `timeout` is treated like `ambiguous` because the code may or may not have been sent. It generates no code, holds no verifier, pepper or credential, writes nothing to a database, audit table or log, reads no environment variable, does not reveal whether an account exists, and stays off every barrel. Only login step 5's dormant callers and composition root use it; it has no runtime caller, route or environment wiring, and the routes belong to login step 6. The step 5 caller must bind each delivery to its own issuance answer, its unit tests must prove that ordering (the answer comes before the delivery), with commit before answer left to the separately gated database proof, and it must prepare exactly one delivery per issuance answer, keep no copy of the code, and reach the transport only through `deliverVerificationCode`, never by calling its `send` directly; a future provider adapter must state and prove its own spend ceiling and delivery proof. |
| Local development SMTP code transport (dormant, login step 4) | `src/lib/solmind/auth/localSmtpVerificationCodeDelivery.ts`; `src/lib/solmind/auth/verificationCodeEmailWording.ts`; `src/lib/solmind/auth/__tests__/localSmtpVerificationCodeDelivery.test.ts` | Server-only transport for the delivery boundary. It emails the code to the local test mailbox over plain SMTP with the built-in `node:net` and no new dependency. Host, port, sender, wording and timeout are required settings with no defaults, and it reads no environment variable; the host must be exactly `127.0.0.1` or `::1`, and `localhost` and every other name or address are refused. The email's sender, subject and body live in `src/lib/solmind/auth/verificationCodeEmailWording.ts`; the transport takes them as required settings with no defaults, accepts printable ASCII only, and requires the code token exactly once in the body and never in the subject. It sends one 7bit `text/plain; charset=us-ascii` message with dot-stuffed body lines under one overall deadline, with no AUTH or STARTTLS. Before the message, a 4xx reply or a refused or dropped connection is `retryable_failure`, a 5xx, unexpected or malformed reply is `terminal_failure`, and a timeout is `timeout`; once the message bytes start to be written, a 250 is `accepted`, never `delivered`, and every other reply, including 4xx and 5xx, and a lost, late or unreadable reply is `ambiguous`, because a failure reply does not prove the message was not queued; when the boundary's ceiling aborts it, it reports `ambiguous` if the message had started and `timeout` if not. Its spend ceiling is 0. SMS returns a fixed `terminal_failure` without a connection, because SMS is disabled locally. Login step 5's public callers module bounds how many delivery attempts are in progress through the delivery boundary at once. Tests use an in-process loopback server, never the local Supabase stack or its mail catcher. It is dormant: only login step 5's dormant composition root composes it. |
| Verification code module (dormant, login step 5) | `src/lib/solmind/auth/verificationCode.ts`; `src/lib/solmind/auth/__tests__/verificationCode.test.ts` | Direct-import server-only code generation and the AUTH-RLS-DEC-032 verifier. Codes come from Node's `randomInt`, uniformly from 000000 to 999999, and challenge UUIDs from `randomUUID`. The verifier is `svf1:` plus 64 lowercase hexadecimal characters of HMAC-SHA-256 keyed by the pepper over `solmind-verification-challenge-svf1`, the lowercase canonical UUID, the purpose and the code, joined by 0x0A; the tests reproduce the register's known-answer verifier and the banked redemption pgTAP fixtures' verifiers. Every input check is a whole-string match: an uppercase UUID, or a value with a final LF, CR, CRLF, U+2028 or U+2029, is refused before any HMAC, and tests pin this. The pepper (at least 32 bytes) is a Node `KeyObject` behind an opaque handle that serializes to `{}`. It compares no verifiers (the banked redemption function's byte-exact comparison is the only one), reads no environment variable, logs nothing, and stays off every barrel. It does not provide the pepper's source or its startup check, which are owed before activation. |
| Verification challenge callers (dormant, login step 5) | `src/lib/solmind/auth/verificationChallengeCallersCore.ts` (restricted); `src/lib/solmind/auth/verificationChallengeCallers.ts` (public); `src/lib/solmind/auth/__tests__/verificationChallengeIssuance.test.ts`; `src/lib/solmind/auth/__tests__/verificationChallengeRedemption.test.ts` | Direct-import server-only issuing and redeeming callers over an injected, abortable RPC seam that the service-role client satisfies; each calls exactly one fixed function and neither accepts a function name. The restricted core's factories take a slot pool as a separate argument; only the public module and three named unit-test files may import it, which a boundary test checks with TypeScript's parser. The public module owns two pools, four issuance slots and four redemption slots shared by every caller built through it by any root; its factories take no pool and refuse a dependency object that carries one, and the parser-checked `src` references show no importer of the core besides the public module and three named unit tests, so no caller built through the public factories can supply a pool (reflective loading could still reach the core's exported factories). The issuing caller gives every request a fresh challenge UUID (the fixed nil UUID only if `randomUUID` ever failed), checks it against the issuance function's own rules, takes an issuance slot (or returns `busy` without issuing), generates the code, computes the verifier and calls `public.solmind_issue_verification_challenge` once. A monotonic caller response deadline (how long the caller waits for an answer) is recorded before the call, a timer aborts the call's signal at it, which requests cancellation through `fetch`, and the deadline is checked when the answer settles and again before a delivery or before accepting a redemption, so nothing late is acted on, even if the event loop stalled. Only a timely answer of exactly one row `{ outcome: "issued" }` is treated as an issuance; only then does the caller prepare exactly one delivery and hand it to `deliverVerificationCode`, never to the transport directly, with no retry, keeping the code only for that single local delivery attempt (no memory-erasure claim). `denied` stays `denied`, the fixed `solmind_issue_ineligible_contact` and `solmind_issue_invalid_binding` errors are `ineligible`, and anything else, including a late or lost answer, is `failed` and delivers nothing. Every outcome maps to one generic outward acknowledgment carrying the UUID. The redeeming caller takes the route's purpose and the client's selector and code, refuses a malformed one without a database call, takes a redemption slot (or returns `busy`), and maps `public.solmind_redeem_verification_challenge` to `redeemed`, `denied`, `busy`, `invalid_request` or `failed`. A slot is held until the call has settled (and, for issuance, until the delivery boundary has returned); a call that never settles holds its slot indefinitely, so a pool fails closed to `busy`. The bound proved: per loaded copy of the public module in one server process, at most four issuances (each a database call followed by at most one delivery attempt through the delivery boundary) and four redemption calls are in progress at the client, for every caller built through the public factories, whichever roots built them; nothing is bounded across processes, or after the delivery boundary has returned. This meets login step 4's duty to bound how many sends run at once. An `issued` or `redeemed` answer shows committed state only if READ COMMITTED isolation, one transaction per call, commit before the answer, and no POST replay all hold; the tests prove one POST with no replay through the real postgrest-js client for both callers, and the rest must be proved by a local database run (it needs AUTH-RLS-DEF-011 approval) before any database use. Results are frozen and value-free, and nothing logs. They do not provide the shared contact normalizer of AUTH-RLS-DEC-033 or the route-owned purpose and eligibility, which are owed before activation. No route, server action, cookie, session or runtime caller uses them. |
| Verification challenge composition root (dormant, login step 5) | `src/lib/solmind/auth/verificationChallengeComposition.ts`; `src/lib/solmind/auth/__tests__/verificationChallengeComposition.test.ts` | Direct-import server-only root that wires the public callers to the service-role client from `createServiceRoleClient()` (which reads its two existing variables only when the root is called) and to login step 4's local SMTP transport with the approved email, through explicit configuration with no defaults: the pepper handle, the local SMTP host and port, the delivery ceiling and the caller response deadline for database calls. It takes no slot pool and cannot be given one, so every root shares the public module's pools. The client is postgrest-js 2.108.2: its `abortSignal()` passes the caller's signal to `fetch`, so the abort requests cancellation through `fetch`; whether the transport cancels, and whether and when the call then settles, depend on the transport (postgrest-js turns `fetch`'s AbortError into an error answer), and nothing proves that PostgreSQL stopped. Composition failures become one fixed value-free error. Tests inject the database client and transport, drive the real postgrest-js client through a fake `fetch` for both callers, and prove that every root shares the one pool of four issuance and four redemption slots; the boundary tests prove the server-only first line, the exact imports, that application code reads no environment variable while the modules load, the absence from all three barrels, that the restricted core has only its named importers (by literal reference; computed references and `import.meta` are refused in every non-test file, the ten guarded modules included: login step 4's three, these four, and the three of login step 6's sub-slice S6-1), and, with TypeScript's parser, that no other application file reaches these modules, login step 4's or S6-1's through any static, side-effect, re-export, `import x = require()`, dynamic `import()` (in any spacing or comment form), `require()` (called or used as a value), `typeof import()` or `import.meta` reference, with any computed reference and any `import.meta` use refused; reflective loading (`createRequire`, `module.require`, the `Function` constructor) is beyond a source parser. Nothing calls it; the pepper's source and startup check, the shared contact normalizer, the route-owned purpose and eligibility, response timing and the routes are owed by activation and login step 6. Login step 6's sub-slice S6-1 adds the pepper's source, the startup check and the normalizer, dormant; wiring them is the route slices'. |
| Session-cookie policy and login-step cookie writer (dormant, login step 6 sub-slice S6-2) | `src/lib/solmind/auth/sessionCookiePolicy.ts` (pure); `src/lib/solmind/supabase/loginCookieWriter.ts` (server-only); `src/lib/solmind/auth/__tests__/sessionCookiePolicy.test.ts`; `src/lib/solmind/supabase/__tests__/loginCookieWriter.test.ts` | `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Sections 4, 5.2, 6 and 14. The pure policy imports nothing, reads no environment variable and adds no setting. Given the trusted origin in the canonical form that `loadTrustedApplicationOrigin()` returns, it gives one of two frozen policies: `https` gives `Secure` and the `__Host-solmind-auth` and `__Host-solmind-session` names; plain `http` only on `127.0.0.1`, `::1` or `localhost` gives `solmind-auth` and `solmind-session` with no `Secure`; any other origin is a configuration failure. Every cookie gets `HttpOnly`, `SameSite=Lax`, `Path=/` and no `Domain`; a session write gets the session's remaining life (1 to 3600 seconds) as Max-Age, and a removal an empty value and Max-Age 0. It names the auth cookie's chunks as the installed `@supabase/ssr` 0.12.0 does and its PKCE code verifier as `@supabase/auth-js` 2.108.2 does (`N-code-verifier`, from the storage key that `cookieOptions.name` sets), holds the three no-store headers, and owns the one shared Section 14 format check that every future reader of the auth cookie uses: each chunk may hold only A-Z, a-z, 0-9, `-` and `_`, and the joined value must start with `base64-`, or the auth cookie counts as absent. The server-only writer sits beside `requestAuthClient.ts`, imports neither `@supabase/ssr` nor any Next.js module, and is handed the response by the route's composition root. At login it accepts only the auth cookie and its chunks, and, for removals only, the code verifier and its chunks; any other name, a non-empty code verifier, a repeated name, or writes that are not one complete value deny with nothing written. Otherwise it sets the no-store headers first, clears every other auth chunk and code verifier the request carries (fixation), and writes the session chunks and the binding cookie with the database's session UUID, never reading the request's binding cookie. At logout it writes removals only: it plans the fixed clears of the auth cookie, the code verifier and the binding cookie regardless of earlier authentication or provider outcomes, and adds permitted names from readable cookie lists. Invalid configuration or a malformed call denies before writing. A response-setter exception can stop the clears partway and returns `failed`. A removal is always a `set` with Max-Age 0, never the framework's cookie delete, which drops `Secure`. Writer outcomes are frozen and value-free; absent and malformed format-check reads contain no cookie values, and present reads contain frozen copies of the permitted auth cookies. Nothing throws or logs; if the response throws mid-write, the result is `failed` and the composition root must discard that response. Open for Paul: a value that passes the format check can still decode to a code point above U+10FFFF, which the installed library's decoder names in the error it passes to its warning, so no reader may rely on the check until contract 25 Section 14 is corrected. Both modules are dormant: no route, page, middleware or caller uses them, they write nothing at runtime, and they stay off every barrel, which the boundary tests check with TypeScript's parser. |
| Session creation and supersession (banked dormant DEF5-S4) | `supabase/migrations/20260716000000_user_session_creation_function.sql`; `supabase/migrations/20260716001000_user_session_creation_chronology_guard.sql`; `supabase/tests/user_session_creation_*_test.sql` | Banked service-role-only primitive consuming committed account-bound `login` or `role_reentry` redemption evidence. It includes a protected freshness policy, account-wide active-session and per-challenge uniqueness, safe exact retry, atomic supersession, embedded Family B session audit, and an all-history `(used_at, challenge UUID)` guard that prevents delayed never-sessionized older evidence from superseding newer login evidence. The correction is banked in `d2fbb0e`; the three plans contain 49/51/50 assertions and clean reset passed 14 files / 502 assertions. Its only app caller is login step 6's dormant session-creation caller (sub-slice S6-6), which nothing calls and which targets the current definition in `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; it has no runtime caller, route, cookie, provider action, provisioning path, cloud action, or real-user activation. |
| Session-creation caller and duration rule (dormant, login step 6 sub-slice S6-6) | `src/lib/solmind/supabase/userSessionCreationCaller.ts` (server-only); `src/lib/solmind/auth/loginSessionDuration.ts` (pure); `src/lib/solmind/supabase/__tests__/userSessionCreationCaller.test.ts`; `src/lib/solmind/auth/__tests__/loginSessionDuration.test.ts` | Direct-import, off every barrel. The pure duration rule (no import, no clock) holds `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Section 7: the requested duration is the provider access token's remaining life in whole seconds, rounded down, minus 120, capped at 3600, and under 1 the login is denied; the cookies' Max-Age is the session's remaining life in whole seconds from the returned `expires_at`, with no cap, and a remaining life under 1 second, or over 3600 seconds (which only a server clock behind the database's can show), is refused, so no cookie may be written; `expires_at` is read only in the exact form PostgreSQL prints. The server-only caller calls `public.solmind_create_user_session` once per `create` through an injected RPC seam that the service-role client satisfies, with the server-derived account, the role the route's login path fixes, the challenge the route has just redeemed, the purpose fixed to `login` and the computed duration; any other key (a purpose, a duration, a session id) or malformed value is `invalid_request` with no call. It uses login step 5's kind of caller response deadline (monotonic, an abort through `fetch`, rechecked before acceptance), accepts only exactly one `created` or `existing` row with a canonical session UUID and an exactly printed expiry, maps the function's seven fixed refusals of the evidence, account or role to `denied` and everything else to `failed`, and returns frozen results. Refusals contain only `outcome`; successful results contain `outcome`, `sessionId` and `maxAgeSeconds` (the session UUID, for the binding cookie, and the Max-Age); nothing logs, reads the environment or throws once constructed. The function's exact-retry branch answers `existing` before its freshness check, so the caller never retries and offers no lookup or recovery, and the route slices must call it only after their own `redeemed` for that challenge in the same request; the tests show that postgrest-js 2.108.2 sends one POST per call and replays none. Committed state also needs a standalone READ COMMITTED call and commit before the answer, which the route slice's database run must prove. A test checks the refusal lists, the arguments, the duration bounds, the outputs and the grants (all privileges revoked from PUBLIC, execute revoked from `anon` and `authenticated` and granted to `service_role`) against the current definition in `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`. No runtime caller uses the pair; the dormant session caller uses the duration rule. The boundary tests' parser-covered source-reference checks (TypeScript's parser, with computed references refused by login step 5's boundary test; reflective loading is beyond a source parser) find no other application file that references or names either module. |
| Supabase identity bridge (dormant, login step 6 sub-slice S6-7) | `src/lib/solmind/supabase/loginIdentityBridge.ts` (server-only); `src/lib/solmind/supabase/__tests__/loginIdentityBridge.test.ts` | `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Section 6, hold then write, and `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md` Section 7.9 (AUTH-RLS-DEC-035). It sits beside `requestAuthClient.ts` in the request-auth adapter layer where contract 25 Sections 5.1 and 6 keep `@supabase/ssr`, imports only `server-only` and `@supabase/ssr`, and reads no cookie, environment variable or setting; the route's composition root passes the Supabase URL and anon key, the auth cookie name from the same S6-2 policy it gives the writer, a provider deadline, a fetch, the link seam (the service-role client's Auth admin API) and a value-free cleanup-failure signal. Required precondition, an S6-8 composition gate: the link seam's client must reach Supabase Auth through a non-logging, non-rejecting fetch boundary, because the library itself logs a rejected fetch's error, in time or after the deadline, where the bridge cannot prevent it. Each sign-in builds one `@supabase/ssr` server client whose cookie reader returns no cookies and whose cookie setter only holds, in memory, the cookies the library hands over after its sign-in event. Guides and the Admin: `signInWithPassword` (refused credentials give `credentials_refused` with nothing held), then, after the route's redemption, the hold's `assertProviderUser` with the bound provider user id. Explorers: after the route's redemption, `exchangeExplorerLink` asks the link seam for a `magiclink` link, denies a link made for any other user before any exchange, and exchanges its token hash at once with `verifyOtp` (type `email`). The answer's user, the session's user, the access token's subject and the held cookies' access token must agree and equal the bound id. `release` hands over the held `{ name, value }` cookies, which S6-2's writer accepts, only after that assertion and when the caller states `created` or `existing`, a precondition the trusted caller attests. A refused first release while the hold is pending starts cleanup. Repeated release attempts return `refused` without another provider operation. `discard` immediately attempts best-effort local revocation of that one transient session (`POST /logout`, scope `local`, with the session's own access token); only a successful answer is `cleaned`, and anything else raises the signal and still denies. Each sign-in or exchange is one attempt with its own client, transport and recovered access tokens, so concurrent attempts never share a token: while it is open, the access token in every answer to its request (whatever the library makes of the answer) and in every completed hand-over is kept, for cleanup only; it gives a hold only when the session is well formed, the hand-over carries that session's token and no other token was recovered, and otherwise every recovered token immediately gets best-effort local revocation. A successful answer read only after the deadline (whole or through a delayed body) never gives a hold or a release, and its token immediately gets best-effort local revocation; a timeout does not establish whether Supabase created a session, and if no access token is ever recovered, revocation cannot be attempted. `accessTokenExpiresAt` is the access token's `exp` claim (contract 25 Section 7); the session's stored `expires_at` does not redefine it. The bridge waits at most the configured deadline for each provider call (the hold client's requests are aborted then; the link seam has no abort), and the hold client's transport never rejects. The configuration, dependencies and request objects themselves are read through own data properties only, so no getter on them runs; the link seam's `generateLink` and the library's answers are read as ordinary properties. If the answer's user, the session's user, the token's subject and the held cookies' token disagree, the result is `failed`; if they agree but are not the bound id, `denied`; either way the bridge immediately attempts best-effort local revocation of a session that came back. Every result except a successful release carries no token, cookie value, password, email, link token or provider id; the bridge throws nothing once constructed, and its own code logs nothing. It is dormant: no application runtime caller is introduced (no route, page or middleware uses it), the unit tests invoke the bridge, it writes nothing at runtime, and it stays off every barrel, which the boundary tests check with TypeScript's parser. |
| Session logout writer (dormant, login step 6a) | `supabase/migrations/20261004000000_user_session_logout_function.sql`; `supabase/tests/user_session_logout_*_test.sql` | Dormant `public.solmind_logout_user_session(account, presented session)`. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available, as for session creation. It takes the shared account-domain advisory lock and then the presented row's lock, reads one database clock, and changes the presented session to `logged_out` with that `ended_at` only when it is the account's active, unexpired session, embedding one Family B `session_logged_out` / `end` / `user_logout` row in the same transaction. A non-active session of the account returns `already_ended` with no write; an unknown or other-account session fails closed with `solmind_logout_unknown_session` and no write; every other error raised in its body, an assertion failure included, leaves as one fixed `solmind_logout_*` identifier with no underlying text; it never changes another session and reads no evidence. The three plans contain 50/64/93 assertions. It has no caller, route, cookie, Supabase sign-out, provider action, cloud action, or real-user activation; login step 6's logout route depends on it. |
| Login configuration: pepper source, route configuration and contact normalizer (dormant, login step 6 sub-slice S6-1) | `src/lib/solmind/auth/verificationPepperSource.ts` (server-only); `src/lib/solmind/auth/loginRouteConfiguration.ts` (server-only); `src/lib/solmind/auth/loginContactNormalizer.ts` (pure); `src/lib/solmind/auth/__tests__/verificationPepperSource.test.ts`; `src/lib/solmind/auth/__tests__/loginRouteConfiguration.test.ts`; `src/lib/solmind/auth/__tests__/loginContactNormalizer.test.ts` | The settings that banked decisions already require, which Paul's 2026-10-05 evening decision 1 placed within login step 6 (no `supabase/config.toml` or hosted configuration change; the contract 25 wording that records that meaning, and its register record, are sub-slice S6-3's). The server-only pepper source takes the pepper from one variable, `SOLMIND_VERIFICATION_PEPPER` (listed with an empty value in `.env.example`): 32 to 64 bytes as base64url text with no padding (43 to 86 characters), accepted only in that one canonical form, so the platform's lenient decoder cannot widen what is accepted. It refuses the pepper if `NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER` is also present (a tripwire for that one name, not a guarantee that the value is exposed nowhere else), and any failure throws one fixed, value-free `VerificationPepperSourceError` (`verification_pepper_unavailable`), with whatever was thrown inside dropped unread. A success returns login step 5's opaque pepper handle, which serializes to `{}`; the module then overwrites its decoded copy of the bytes with zeros, which does not erase the text in the environment. The server-only route configuration returns exactly the step 5 root's configuration as one frozen plain object: the pepper and fixed delivery settings reviewed with the code (host `127.0.0.1`; port 54325, which a test checks against `supabase/config.toml`'s `[inbucket] smtp_port`; a 5,000 ms delivery ceiling; and a 6,000 ms caller response deadline, longer than the issuance function's two lock waits of up to 2,000 ms each, which a test reads from the current migration). A test hands it to the real root with fake dependencies and checks that both callers are keyed by the loaded pepper. `checkLoginVerificationConfigurationAtStartup` is AUTH-RLS-DEC-032's startup check; calling it when the server starts (Next.js 16's `instrumentation.ts` `register`, in the Node.js runtime only) is the first activating slice's duty (S6-8), which must also compose the local transport only for a loopback trusted origin. The pure normalizer is AUTH-RLS-DEC-033's one shared function for login emails: it bounds the input at 512 characters, removes surrounding ASCII whitespace, refuses anything that is not printable ASCII (no Unicode folding, so look-alikes are refused), lowercases A-Z, and accepts the result only if it passes the current issuance function's email check exactly; tests compare its pattern with the migration's text and its behavior with the delivery boundary's canonical check for every printable character. A refusal is `null`; a success returns the canonical email, which is a contact value. Phone normalization joins it with phone sign-in, outside step 6. All three are dormant: no application runtime caller is introduced, and they stay off every barrel. The login step 5 boundary test (VCB-004) now guards them as well, and their own boundary tests check their imports, their environment reads and their names with TypeScript's parser. |
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
- Audit persistence beyond the banked dormant DEF5-S2 redemption, DEF5-S3 issuance, DEF5-S4 session, and S02 protected-setting Family F subsets: remaining login/provisioning (Family B), Admin sensitive-access (Family C), safety/escalation (Family D), and content/AI-lifecycle (Family E, except the two S03D pre-dispatch pairs) audit vocabularies and runtime wiring; a real operational logging/alarm mechanism (the AUD-3 operational signal is an injectable no-op seam); the deferred system-context/null-actor guarded-read vocabulary (AUTH-RLS-DEF-019); and any audit retention/review tooling. No new audit table grants, policies, or hidden-schema Data API exposure exist.
- Authentication middleware. MVP0 deliberately prefers explicit per-route and server-action composition over middleware (register decision AUTH-RLS-DEC-017); do not introduce middleware without a specific approved justification.
- The runtime login/provisioning write path, including any runtime caller of the banked dormant session primitive (its one app caller, login step 6's dormant sub-slice S6-6 caller, has no route or runtime wiring), any caller of the dormant invitation functions, and all provider-identity/provisioning writes.
- S02 onboarding, Compass, Route, Waypoint, conversation, notification, and
  remaining persistence. The protected setting, local fixture, immutable
  Guide-authored Summary publication, Explorer-private exact-review draft,
  Explorer-confirmed Shared Snapshot, and preserved-lineage foundations are
  banked dormant. No application caller, operational send/expiry timer,
  permissive role path, hosted data, provider behavior, deployment, or
  real-user path is banked.
- S03 genuine provider conversation beyond the provider-free S03A kernel,
  provider-neutral S03B dispatch contract, source-injected S03C authorization
  composer, protected S03D pre-dispatch evidence and dormant S03E Luna adapter:
  server composition of S03C, S03D and S03E; binding of the dispatched bytes to
  the stored context fingerprint; terminal invocation status and output
  persistence; concrete source repositories, runtime credentials/provider
  activation, session/message persistence, safety response, route and UI.
- A separately reviewed successor S03D evidence contract (a new contract
  version) that records, at snapshot creation, the remaining `solmind-docs`
  `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md` Section 12 snapshot
  fields (Methodology Context Pack version, typed source IDs including
  `related_reflection_ids`, policy/behavior versions) and an S03E
  instruction/template version. v1 snapshots are write-once by contract (no
  update path or role grant exists; the database does not block an
  owner-level update), and v1 evidence alone never authorizes an
  Explorer-facing dispatch.
- S03D composition gates before any caller: a source-ID derivation rule that
  defines which identifiers populate `context_source_ids` (the S03C result
  exposes no source-ID set), and a stable logical operation ID bound to the
  immediate Explorer message identity, whose exact derivation (including
  whether a deliberate new attempt after a terminal failure receives a new ID)
  the composition slice fixes (no-double-dispatch holds per operation ID only).
- A single-source AV1 producer before any S03D caller. S03C and the
  composition caller must obtain the AV1 proof from one owner, so the caller's
  proof string cannot drift from the database recomputation. The composition
  slice owns this.
- S03D caller preconditions from review #91a: call the gate only under READ
  COMMITTED, and keep the lock order in `docs/AGENT_TASK_RULES.md`, including
  for a top-down Organization cascade; check the existing invitation-acceptance
  writer against that order when composition lands. The composition slice
  owns both.
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
