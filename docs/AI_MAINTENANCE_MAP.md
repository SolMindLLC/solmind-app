# SolMind App AI Maintenance Map

Version: 0.3.3
Last Updated: 2026-10-27
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
- `/login` - Explorer, Guide and Admin sign-in through separate fixed-role owners; source wiring alone establishes no publication/banking
- `/login/explorer` - banked fixed Explorer re-entry; no client-selected return URL
- `/login/explorer/send` and `/login/explorer/verify` - POST-only Explorer
  sign-in Route Handlers called by the banked Explorer screen; same-origin
  JSON only and local loopback origin only
- `/explorer/home` - banked dynamic server-guarded Explorer shell and Sign out;
  only expiry/observation times cross to its client boundary
- `/logout` - shared same-origin JSON POST; exact presented-session termination,
  bounded provider cleanup and owned-cookie clearing; called by the banked home
- /login/guide, its two POSTs and /guide/home - connected Guide password/code
  path; source/check results alone do not establish publication/banking
- /login/admin, its two POSTs and /admin/home - connected Admin password/code
  source path, with an audited fixed-home guard; see Connected Admin ownership below
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

The retained sign-in preview follows the same split; banked `/login`
instead composes `src/components/solmind/LoginExperience.tsx` as described
below. `src/components/solmind/SignInPreview.tsx` owns the preview client
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
The separate connected Explorer wiring is proposed in login step 6; the retained preview itself stays effect-free.

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
Login step 6's sub-slice S6-5 then added two dormant, read-only,
service-role-only database lookups for sign-in, the eligible-account lookup
and the redeemed-challenge confirmation, again with no route or caller.

Login step 6's sub-slice S6-4 is not dormant. It puts the per-request check on
the guarded read path that the 8 existing route handlers share: the session
cookies are read under SolMind's own names, the auth cookie passes the shared
format check before anything of it reaches the Supabase library, and a request
is allowed only when its session-binding cookie holds the UUID of the session
the lookup selected. The format check now ends with a field check of the
session inside the cookie, so that no token text the platform would refuse
reaches the library. The adapter then asks Supabase Auth to verify the
cookie's sign-in token and nothing else, through a client that holds no
cookie, no session and no cookie setter, so the library is given no renewal
token to send. It adds no route, caller or cookie write.

Login step 6's sub-slice S6-8 is the first to call those login modules at
runtime. It adds the two Explorer sign-in Route Handlers,
`src/app/login/explorer/send/route.ts` and
`src/app/login/explorer/verify/route.ts`, their server composition and
request-scoped dependency factory, the two lookup callers, the link seam's
client, the route contract, and the server start hook that runs the login
startup check. The send route: after the request, normalization,
configuration and spare-selector checks succeed, every account-lookup
outcome returns the same acknowledgment form with an opaque selector. It
requests the fixed floor measured from composition entry. Earlier refusals
do not wait; waiter failure can return early. Only an eligible lookup row
permits real issuance. The verify route redeems the code,
confirms the account, exchanges for a Supabase session held in memory,
creates the SolMind session, and only then writes the auth and binding
cookies on one response. Both deny for a trusted origin that is not a
loopback origin, because the only delivery transport is the local
development one. The banked Explorer layer composes these routes and shared
logout; SL-069 records dated proof and limits. Guide uses a separate password/
code composition; current publication/banking is owned by SL-070. Admin uses
its separate fixed-role source owners below.
A request without both cookies is still denied by every guarded route.
Decided by Paul on 2026-10-07 (the record is
`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The
2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; each
is option 1 of the item named, in Part 2 of
`solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Morning_Checkin_Packet_2026-10-07.md`):
the two route paths, "`/login/explorer/send` and `/login/explorer/verify`"
(item 3); for the Explorer home address, "name the new page's address now,
`/explorer/home`, and build the page with the screens" (item 4); "a fixed
wait of about one and a half seconds, set from the first local run" (item
5); "one "code not accepted" result for every refused code, its words chosen
with the screens" (item 6); for the link client, "a second, separate module
used only for that one link request, exposing nothing else" (item 7); for a
missing pepper when the server starts, "the app starts, sign-in is
unavailable, and one fixed line with no value says so" (item 9); and, after
a correct code, "keep the small message naming the fixed home" (item 18),
which is the verify route's JSON answer. Paul approved the sign-in message
on 2026-10-17. Current Explorer source uses 1,500 ms; SL-069 records actual
October 19 functional evidence and October 20 banking. Neither supplies Guide
timing/shared-capacity proof.

Still outside these bounded login sources: permissive or role-aware RLS policies
and grants; effectful provider provisioning; Explorer invitation callers;
onboarding/Compass persistence; sendability timing or expiry; genuine provider
conversation; safety-flag runtime handling; and broader operational Guide/Admin
workflows. Current proof/assurance/publication/banking belongs to the complete
slice's execution records and checked receipt, not to this source inventory.

See the "Banked Foundations vs Still Deferred" section below and the
authoritative register in
`../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

## Canonical Product Documentation

The canonical SolMind product documentation lives in the sibling repository:

> Conditional source preparation, 2026-10-16. The Explorer, direct-token,
> logout and newer login/browser components described below include unbanked
> proposal layers. Their source descriptions do not establish live, connected,
> runtime-validated or banked behavior. Final predecessor reconciliation and
> complete-slice assurance remain required; do not apply this draft.

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
  instrumentation.ts        server start hook: runs the login startup check
  instrumentation-node.ts   its Node.js half
  app/
    page.tsx
    layout.tsx
    globals.css
    admin/page.tsx
    admin/access/route.ts
    explorer/page.tsx
    guide/page.tsx
    login/page.tsx
    login/explorer/send/route.ts
    login/explorer/verify/route.ts

  components/
    solmind/
      BackLink.tsx
      ConversationPreview.tsx
      DashboardCard.tsx
      ExplorerExperiencePrototype.tsx
      ExplorerResponseComposer.tsx
      ExplorerTopicList.tsx
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

Component proof counts and earlier source-only limits below describe their
original dated slices. For the current connected Guide topology and October 21
evidence, use Connected Guide ownership below and SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md; SL-069 owns the
banked Explorer evidence. These historical component limits do not override
the current exact import allowlists or imply that completed proof is pending.

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
| Suggested Waypoint local whole-path proof driver | `tests/whole-path/runSuggestedWaypointWholePath.mjs`; `playwright.whole-path.config.ts`; `vitest.whole-path.config.ts`; `tests/whole-path/suggestedWaypoint{LocalSqlFixture,PlaywrightSession,WholePathOrchestrator,DeliveryBridge.wholepath,WholePath.pw}*`; `src/lib/solmind/supabase/suggestedWaypointWholePathGuide{RelationshipEntry,Draft}Diagnostic.ts`; folder README | Opt-in local-only owner for one complete synthetic Guide-to-Explorer create, edit, schedule, Pull Back, reschedule, deadline delivery, private read, receipt acknowledgement, role-denial, and idempotent-replay proof. It requires the complete safety configuration before credential access, pins `supabase@2.115.0`, uses five isolated in-memory browser contexts, temporarily selects the schema-owned 60-second test grace, waits for authoritative Guide detail to end Pull Back, and owns bounded child processes, exact fixture teardown, result cleanup, and final database reset. Scenario diagnostics use fourteen closed, test-only, value-free step IDs; exact request-bound server seams may further localize only the Guide relationship-entry and draft-denial steps through fixed in-memory markers. Raw failures never become durable output, cleanup failure retains precedence, the first failing viewport stops later viewport work, and the first exact allowlisted category remains durable. The non-effectful contract executes the extracted finite runner pattern, pins the exact ordered step set and wrapper call sites, and directly tests combined scenario and Auth-cleanup failure. It never starts Supabase, writes durable secrets or browser state, discovers due work, schedules continuously, calls a provider, deploys, contacts hosted data, or affects real users. Since login step 6's sub-slice S6-4 its Auth fixture builds the two cookies the per-request check requires, because no sign-in route writes them yet: the auth cookie under the name the app's session-cookie policy gives, and the session-binding cookie holding the UUID of the fixture's `identity.user_session` row for that role. `tests/whole-path/suggestedWaypointRoleSessionCookies.test.ts` proves, without a database or a browser, that the app's real request-auth adapter accepts them; the driver's browser run is separate and watched. |
| Suggested Waypoint Guide command route | `src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointGuideCommandRouteContract.ts`; co-located focused and route tests; `.env.example` | First authenticated same-origin browser write edge for Guide create/save draft, schedule send, and Pull Back. It rejects query/path and exact-body authority before cookie/auth/dependency IO, loads one configured trusted origin, applies the shared bounded JSON guard once, injects the path relationship once, delegates actor/role/relationship derivation and the closed RPC to the banked composition once, revalidates the exact function-bound command row, and emits only the shared four-field value-free browser result. The current UI invokes save draft and schedule send for an existing complete draft plus Pull Back for a pending version. It adds no delivery worker or scheduler, Explorer command edge, provider, deployment, hosted data, or real-user activation. |
| Suggested Waypoint Guide draft and Pull Back browser edge | `src/lib/solmind/suggestedWaypointGuideCommandClient.ts`; `src/lib/solmind/suggestedWaypointGuideDraftContentBrowserContract.ts`; `src/lib/solmind/suggestedWaypointPullBackCountdown.ts`; `src/components/solmind/GuideSuggestedWaypointDetail.tsx`; co-located focused and browser tests | Production Guide command UI caller for an existing complete Guide-only draft and its pending version. One shared content owner snapshots and validates normalized single-line destination, multiline why, and unique bounded arrival signals for both detail parsing and the server route. The client builds exact save, schedule, and Pull Back snapshots from the authoritative detail, preserves identical bytes and operation identity across transport-uncertain retry, exposes explicit check-status recovery, and reloads the authoritative detail after conclusive results. Policy and deadline authority remain server-owned; the countdown is display-only. The protected pending-version selector never appears in visible copy, announcements, logs, or URLs. It adds no blank-draft compose, delete, correction, withdrawal, Explorer command, worker, provider, deployment, or real-user activation. |
| Suggested Waypoint Explorer command route and browser edge | `src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts`; `src/lib/solmind/supabase/suggestedWaypointExplorerCommandRouteContract.ts`; `src/lib/solmind/suggestedWaypointExplorerCommandClient.ts`; `src/components/solmind/ExplorerSuggestedWaypointDetail.tsx`; co-located focused, route, and browser tests | Explicit Mark as read and Acknowledge receipt path over server-derived Explorer identity and relationship authority. The browser sends only command kind, UUIDv4 operation identity, and the current version selector; it never supplies actor, role, relationship, or Guide-visible private-read data. One command runs at a time, transport-uncertain retry preserves exact bytes, conclusive outcomes require an authoritative detail read, and late or wrong-target results cannot mutate the view. Opening remains write-free. It adds no comparison/adoption/response command, worker, provider, deployment, hosted data, or real-user activation. |
| Shared UI | `src/components/solmind/*.tsx` | Reusable presentational components |
| Role model | `src/lib/solmind/roles.ts` | Canonical role strings, labels, and home routes |
| Route metadata | `src/lib/solmind/pages.ts` | Page titles, descriptions, and hrefs |
| Navigation | `src/lib/solmind/navigation.ts` | Primary nav items and route labels |
| Sign-in preview | `src/lib/solmind/signInPreview.ts` | Approved sign-in copy and pure transitions for the retained unconnected preview |
| Sign-in preview UI | `src/components/solmind/SignInPreview.tsx`, `SignInPreviewParts.tsx` | The retained preview boundary and presentation; connected Explorer uses LoginExperience and ExplorerSignIn |
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
| Verification redemption CAS (DEF5-S2) | `supabase/migrations/20260712000000_verification_challenge_redemption_function.sql`; `supabase/tests/verification_challenge_redemption_*_test.sql` | Service-role-only verification redemption function and sequential/concurrent proofs. The concurrency suite commits reserved synthetic rows outside its outer rollback boundary, performs targeted cleanup, and requires Paul's explicit approval for the documented recovery cleanup after a hard failure. It does not issue challenges, create sessions, wire routes, or activate a runtime path. Its only app caller is login step 5's redeeming caller, which the Explorer verify route calls since sub-slice S6-8. |
| Verification challenge issuance (DEF5-S3, with login step 2 abuse limits) | `supabase/migrations/20260713000000_verification_challenge_issuance_function.sql`; `supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql`; `supabase/migrations/20261027000000_verification_issuance_unused_code_limits.sql`; `supabase/tests/verification_challenge_issuance_*_test.sql`; `supabase/tests/verification_issuance_abuse_limits*_test.sql` | Banked service-role-only issuance function, structurally-open partial unique index, exact embedded Family B issuance audit, and sequential/concurrent proofs. Login step 2 (app `05884ed`) adds the AUTH-RLS-DEC-037 limits: at most six committed issuances per normalized contact in a rolling hour across all purposes, a non-extending 15-minute lockout after the sixth, writeless `denied` outcomes, and the contact-plus-creation-time index. Card 5 excludes used codes from the rolling-hour budget and both lockout queries; unused superseded, expired and exhausted codes still count. The function requires a READ COMMITTED transaction begun at most 10 seconds earlier and sets `transaction_timeout` to 60 seconds for the rest of the calling transaction; per its comment, callers make each call in its own short transaction and must not change `transaction_timeout` afterwards. Its only app caller is login step 5's issuing caller, which the Explorer send route calls since sub-slice S6-8, for a loopback trusted origin only; it has no invitation route; the follow-up recorded at banking measures the lockout's inner count with realistic stored history before any caller is approved, so that measurement must happen before login step 5's issuing caller is approved or banked. Both UUID binding inputs are present together or both null; the null pair is restricted to approved pre-account purposes. |
| Verification-code delivery boundary (login step 4; in use since S6-8) | `src/lib/solmind/auth/verificationCodeDelivery.ts`; `src/lib/solmind/auth/__tests__/verificationCodeDelivery.test.ts` | Direct-import server-only, provider-neutral delivery boundary described in `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md` section 7.1.3. It prepares a delivery only from an `issued` issuance outcome, which is a trusted-caller precondition rather than proof that a challenge committed; it checks every field, rejects unknown keys, and returns an opaque handle that serializes to `{}`. It calls one injected transport's `send` at most once per prepared handle within a caller-set 10 ms to 15 s elapsed-time ceiling, with retry ceiling 0 and no fallback transport; a handle cannot be delivered twice, but two handles prepared with the same challenge and code are two sends. A retry is supersede-and-reissue under AUTH-RLS-DEC-033, which spends budget under AUTH-RLS-DEC-037. Results are a frozen, value-free `{ outcome }` from the closed nine-value set; the boundary meters no spend and passes through whatever closed outcome the transport returns, before the ceiling, a throw, rejection or unknown value becomes `ambiguous`. At the ceiling the boundary aborts the transport and gives it one turn to report; only the literal `ambiguous` (or a rejection) can win then, and anything else, including an unknown value, or no answer, is `timeout`, so no success is reported after the deadline. `timeout` is treated like `ambiguous` because the code may or may not have been sent. It generates no code, holds no verifier, pepper or credential, writes nothing to a database, audit table or log, reads no environment variable, does not reveal whether an account exists, and stays off every barrel. Only login step 5's callers and composition root use it; since sub-slice S6-8 the Explorer sign-in routes call that root, for a loopback trusted origin only. The step 5 caller must bind each delivery to its own issuance answer, its unit tests must prove that ordering (the answer comes before the delivery), with commit before answer left to the separately gated database proof, and it must prepare exactly one delivery per issuance answer, keep no copy of the code, and reach the transport only through `deliverVerificationCode`, never by calling its `send` directly; a future provider adapter must state and prove its own spend ceiling and delivery proof. |
| Local development SMTP code transport (login step 4; composed for a loopback trusted origin since S6-8) | `src/lib/solmind/auth/localSmtpVerificationCodeDelivery.ts`; `src/lib/solmind/auth/verificationCodeEmailWording.ts`; `src/lib/solmind/auth/__tests__/localSmtpVerificationCodeDelivery.test.ts` | Server-only transport for the delivery boundary. It emails the code to the local test mailbox over plain SMTP with the built-in `node:net` and no new dependency. Host, port, sender, wording and timeout are required settings with no defaults, and it reads no environment variable; the host must be exactly `127.0.0.1` or `::1`, and `localhost` and every other name or address are refused. The email's sender, subject and body live in `src/lib/solmind/auth/verificationCodeEmailWording.ts`; the transport takes them as required settings with no defaults, accepts printable ASCII only, and requires the code token exactly once in the body and never in the subject. It sends one 7bit `text/plain; charset=us-ascii` message with dot-stuffed body lines under one overall deadline, with no AUTH or STARTTLS. Before the message, a 4xx reply or a refused or dropped connection is `retryable_failure`, a 5xx, unexpected or malformed reply is `terminal_failure`, and a timeout is `timeout`; once the message bytes start to be written, a 250 is `accepted`, never `delivered`, and every other reply, including 4xx and 5xx, and a lost, late or unreadable reply is `ambiguous`, because a failure reply does not prove the message was not queued; when the boundary's ceiling aborts it, it reports `ambiguous` if the message had started and `timeout` if not. Its spend ceiling is 0. SMS returns a fixed `terminal_failure` without a connection, because SMS is disabled locally. Login step 5's public callers module bounds how many delivery attempts are in progress through the delivery boundary at once. Tests use an in-process loopback server, never the local Supabase stack or its mail catcher. Only login step 5's composition root composes it, and since sub-slice S6-8 the Explorer sign-in routes call that root for a loopback trusted origin only. |
| Verification code module (login step 5; in use since S6-8) | `src/lib/solmind/auth/verificationCode.ts`; `src/lib/solmind/auth/__tests__/verificationCode.test.ts` | Direct-import server-only code generation and the AUTH-RLS-DEC-032 verifier. Codes come from Node's `randomInt`, uniformly from 000000 to 999999, and challenge UUIDs from `randomUUID`. The verifier is `svf1:` plus 64 lowercase hexadecimal characters of HMAC-SHA-256 keyed by the pepper over `solmind-verification-challenge-svf1`, the lowercase canonical UUID, the purpose and the code, joined by 0x0A; the tests reproduce the register's known-answer verifier and the banked redemption pgTAP fixtures' verifiers. Every input check is a whole-string match: an uppercase UUID, or a value with a final LF, CR, CRLF, U+2028 or U+2029, is refused before any HMAC, and tests pin this. The pepper (at least 32 bytes) is a Node `KeyObject` behind an opaque handle that serializes to `{}`. It compares no verifiers (the banked redemption function's byte-exact comparison is the only one), reads no environment variable, logs nothing, and stays off every barrel. It does not provide the pepper's source or its startup check, which are owed before activation. |
| Verification challenge callers (login step 5; in use since S6-8) | `src/lib/solmind/auth/verificationChallengeCallersCore.ts` (restricted); `src/lib/solmind/auth/verificationChallengeCallers.ts` (public); `src/lib/solmind/auth/__tests__/verificationChallengeIssuance.test.ts`; `src/lib/solmind/auth/__tests__/verificationChallengeRedemption.test.ts` | Direct-import server-only issuing and redeeming callers over an injected, abortable RPC seam that the service-role client satisfies; each calls exactly one fixed function and neither accepts a function name. The restricted core's factories take a slot pool as a separate argument; only the public module and three named unit-test files may import it, which a boundary test checks with TypeScript's parser. The public module owns two pools, four issuance slots and four redemption slots shared by every caller built through it by any root; its factories take no pool and refuse a dependency object that carries one, and the parser-checked `src` references show no importer of the core besides the public module and three named unit tests, so no caller built through the public factories can supply a pool (reflective loading could still reach the core's exported factories). The issuing caller gives every request a fresh challenge UUID (the fixed nil UUID only if `randomUUID` ever failed), checks it against the issuance function's own rules, takes an issuance slot (or returns `busy` without issuing), generates the code, computes the verifier and calls `public.solmind_issue_verification_challenge` once. A monotonic caller response deadline (how long the caller waits for an answer) is recorded before the call, a timer aborts the call's signal at it, which requests cancellation through `fetch`, and the deadline is checked when the answer settles and again before a delivery or before accepting a redemption, so nothing late is acted on, even if the event loop stalled. Only a timely answer of exactly one row `{ outcome: "issued" }` is treated as an issuance; only then does the caller prepare exactly one delivery and hand it to `deliverVerificationCode`, never to the transport directly, with no retry, keeping the code only for that single local delivery attempt (no memory-erasure claim). `denied` stays `denied`, the fixed `solmind_issue_ineligible_contact` and `solmind_issue_invalid_binding` errors are `ineligible`, and anything else, including a late or lost answer, is `failed` and delivers nothing. Every outcome maps to one generic outward acknowledgment carrying the UUID. The redeeming caller takes the route's purpose and the client's selector and code, refuses a malformed one without a database call, takes a redemption slot (or returns `busy`), and maps `public.solmind_redeem_verification_challenge` to `redeemed`, `denied`, `busy`, `invalid_request` or `failed`. A slot is held until the call has settled (and, for issuance, until the delivery boundary has returned); a call that never settles holds its slot indefinitely, so a pool fails closed to `busy`. The bound proved: per loaded copy of the public module in one server process, at most four issuances (each a database call followed by at most one delivery attempt through the delivery boundary) and four redemption calls are in progress at the client, for every caller built through the public factories, whichever roots built them; nothing is bounded across processes, or after the delivery boundary has returned. This meets login step 4's duty to bound how many sends run at once. An `issued` or `redeemed` answer shows committed state only if READ COMMITTED isolation, one transaction per call, commit before the answer, and no POST replay all hold; the tests prove one POST with no replay through the real postgrest-js client for both callers, and the rest must be proved by a local database run (it needs AUTH-RLS-DEF-011 approval) before any database use. Results are frozen and value-free, and nothing logs. They do not provide the shared contact normalizer of AUTH-RLS-DEC-033 or the route-owned purpose and eligibility, which are owed before activation. Since sub-slice S6-8 the Explorer sign-in routes use them through the composition root, and their server composition imports the public module's acknowledgment helper and one type; nothing else does. |
| Verification challenge composition root (login step 5; called by the Explorer sign-in routes since S6-8) | `src/lib/solmind/auth/verificationChallengeComposition.ts`; `src/lib/solmind/auth/__tests__/verificationChallengeComposition.test.ts` | Direct-import server-only root that wires the public callers to the service-role client from `createServiceRoleClient()` (which reads its two existing variables only when the root is called) and to login step 4's local SMTP transport with the approved email, through explicit configuration with no defaults: the pepper handle, the local SMTP host and port, the delivery ceiling and the caller response deadline for database calls. It takes no slot pool and cannot be given one, so every root shares the public module's pools. The client is postgrest-js 2.108.2: its `abortSignal()` passes the caller's signal to `fetch`, so the abort requests cancellation through `fetch`; whether the transport cancels, and whether and when the call then settles, depend on the transport (postgrest-js turns `fetch`'s AbortError into an error answer), and nothing proves that PostgreSQL stopped. Composition failures become one fixed value-free error. Tests inject the database client and transport, drive the real postgrest-js client through a fake `fetch` for both callers, and prove that every root shares the one pool of four issuance and four redemption slots; the boundary tests prove the server-only first line, the exact imports, that application code reads no environment variable while the modules load, the absence from all three barrels, that the restricted core has only its named importers (by literal reference; computed references and `import.meta` are refused in every non-test file, the ten guarded modules included: login step 4's three, these four, and the three of login step 6's sub-slice S6-1), and, with TypeScript's parser, that no other application file reaches these modules, login step 4's or S6-1's through any static, side-effect, re-export, `import x = require()`, dynamic `import()` (in any spacing or comment form), `require()` (called or used as a value), `typeof import()` or `import.meta` reference, with any computed reference and any `import.meta` use refused; reflective loading (`createRequire`, `module.require`, the `Function` constructor) is beyond a source parser. Since sub-slice S6-8 the Explorer sign-in routes' dependency factory calls it, only for a loopback trusted origin. Login step 6's sub-slice S6-1 adds the pepper's source, the startup check and the normalizer; S6-8 wires them and adds the Explorer route's purpose, eligibility lookup and response floor. The Guide and Admin routes are S6-9's. |
| Session-cookie policy and login-step cookie writer (login step 6 sub-slice S6-2; the policy read by the per-request check since S6-4; the login writer called by the Explorer sign-in routes since S6-8) | `src/lib/solmind/auth/sessionCookiePolicy.ts` (pure); `src/lib/solmind/supabase/loginCookieWriter.ts` (server-only); `src/lib/solmind/auth/__tests__/sessionCookiePolicy.test.ts`; `src/lib/solmind/supabase/__tests__/loginCookieWriter.test.ts` | `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Sections 4, 5.2, 6 and 14. The pure policy imports nothing, reads no environment variable and adds no setting. Given the trusted origin in the canonical form that `loadTrustedApplicationOrigin()` returns, it gives one of two frozen policies: `https` gives `Secure` and the `__Host-solmind-auth` and `__Host-solmind-session` names; plain `http` only on `127.0.0.1`, `::1` or `localhost` gives `solmind-auth` and `solmind-session` with no `Secure`; any other origin is a configuration failure. Every cookie gets `HttpOnly`, `SameSite=Lax`, `Path=/` and no `Domain`; a session write gets the session's remaining life (1 to 3600 seconds) as Max-Age, and a removal an empty value and Max-Age 0. It names the auth cookie's chunks as the installed `@supabase/ssr` 0.12.0 does and its PKCE code verifier as `@supabase/auth-js` 2.108.2 does (`N-code-verifier`, from the storage key that `cookieOptions.name` sets), holds the three no-store headers, and owns the one shared Section 14 format check that every future reader of the auth cookie uses: each chunk may hold only A-Z, a-z, 0-9, `-` and `_`, the joined value must start with `base64-`, and the part after `base64-`, decoded as base64url exactly as the library decodes it, must be strictly valid UTF-8 (Paul's 2026-10-05 correction of Section 14), or the auth cookie counts as absent. The server-only writer sits beside `requestAuthClient.ts`, imports neither `@supabase/ssr` nor any Next.js module, and is handed the response by the route's composition root. At login it accepts only the auth cookie and its chunks, and, for removals only, the code verifier and its chunks; any other name, a non-empty code verifier, a repeated name, or writes that are not one complete value deny with nothing written. Otherwise it sets the no-store headers first, clears every other auth chunk and code verifier the request carries (fixation), and writes the session chunks and the binding cookie with the database's session UUID, never reading the request's binding cookie. At logout it writes removals only: it plans the fixed clears of the auth cookie, the code verifier and the binding cookie regardless of earlier authentication or provider outcomes, and adds permitted names from readable cookie lists. Invalid configuration or a malformed call denies before writing. A response-setter exception can stop the clears partway and returns `failed`. A removal is always a `set` with Max-Age 0, never the framework's cookie delete, which drops `Secure`. Writer outcomes are frozen and value-free; absent and malformed format-check reads contain no cookie values, and present reads contain frozen copies of the permitted auth cookies. Nothing throws or logs; if the response throws mid-write, the result is `failed` and the composition root must discard that response. The strict UTF-8 step closes the decoder limit that review #149a confirmed (a value that passed the character and `base64-` checks could decode to a code point above U+10FFFF, which the installed library's decoder names in the error it passes to its warning): the library's decoder throws on no well-formed UTF-8, so for an auth cookie value the check returns, no decoder exception reaches that warning. It claims no more: not valid JSON (the library's separate invalid-JSON warning carries no part of the value), not an authentic session, and nothing about any other cookie a reader hands to the library. The per-request check (S6-4) applies the check before any Supabase client exists and hands the library only the sign-in token of a cookie the check accepted, never the cookie; logout (S6-12) captures an immutable candidate through that same check and passes explicit credentials to its isolated provider adapter, never a cookie-reading authenticated client. The field check that S6-4 adds as the check's last step also refuses a decoded value that is not JSON. Since sub-slice S6-8 the Explorer sign-in routes' server composition calls the login writer, only after the session exists and the held cookies were released; the guarded logout composition (S6-12) calls its clear writer after the request, cookie-read and policy prerequisites. The policy has had a runtime reader since sub-slice S6-4, the per-request adapter `requestAuthClient.ts`, which takes the cookie names, the format check and the accepted cookie's sign-in token from it; since S6-8 the sign-in routes' dependency factory resolves the policy and their route contract takes the no-store headers from it; the logout composition and Explorer verify route use the shared cleanup-candidate reader. That reader returns captured data, not authentication or renewal authority. Both stay off every barrel, and the boundary tests check with TypeScript's parser that exactly those references exist and no other application file references or names either module. |
| Session creation and supersession (banked dormant DEF5-S4) | `supabase/migrations/20260716000000_user_session_creation_function.sql`; `supabase/migrations/20260716001000_user_session_creation_chronology_guard.sql`; `supabase/tests/user_session_creation_*_test.sql` | Banked service-role-only primitive consuming committed account-bound `login` or `role_reentry` redemption evidence. It includes a protected freshness policy, account-wide active-session and per-challenge uniqueness, safe exact retry, atomic supersession, embedded Family B session audit, and an all-history `(used_at, challenge UUID)` guard that prevents delayed never-sessionized older evidence from superseding newer login evidence. The correction is banked in `d2fbb0e`; the three plans contain 49/51/50 assertions and clean reset passed 14 files / 502 assertions. Its only app caller is login step 6's session-creation caller (sub-slice S6-6), which the Explorer sign-in routes call since sub-slice S6-8 and which targets the current definition in `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; the function itself adds no route, cookie, provider action, provisioning path, cloud action, or real-user activation. |
| Session-creation caller and duration rule (login step 6 sub-slice S6-6; called by the Explorer sign-in routes since S6-8) | `src/lib/solmind/supabase/userSessionCreationCaller.ts` (server-only); `src/lib/solmind/auth/loginSessionDuration.ts` (pure); `src/lib/solmind/supabase/__tests__/userSessionCreationCaller.test.ts`; `src/lib/solmind/auth/__tests__/loginSessionDuration.test.ts` | Direct-import, off every barrel. The pure duration rule (no import, no clock) holds `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Section 7: the requested duration is the provider access token's remaining life in whole seconds, rounded down, minus 120, capped at 3600, and under 1 the login is denied; the cookies' Max-Age is the session's remaining life in whole seconds from the returned `expires_at`, with no cap, and a remaining life under 1 second, or over 3600 seconds (which only a server clock behind the database's can show), is refused, so no cookie may be written; `expires_at` is read only in the exact form PostgreSQL prints. The server-only caller calls `public.solmind_create_user_session` once per `create` through an injected RPC seam that the service-role client satisfies, with the server-derived account, the role the route's login path fixes, the challenge the route has just redeemed, the purpose fixed to `login` and the computed duration; any other key (a purpose, a duration, a session id) or malformed value is `invalid_request` with no call. It uses login step 5's kind of caller response deadline (monotonic, an abort through `fetch`, rechecked before acceptance), accepts only exactly one `created` or `existing` row with a canonical session UUID and an exactly printed expiry, maps the function's seven fixed refusals of the evidence, account or role to `denied` and everything else to `failed`, and returns frozen results. Refusals contain only `outcome`; successful results contain `outcome`, `sessionId` and `maxAgeSeconds` (the session UUID, for the binding cookie, and the Max-Age); nothing logs, reads the environment or throws once constructed. The function's exact-retry branch answers `existing` before its freshness check, so the caller never retries and offers no lookup or recovery, and the route slices must call it only after their own `redeemed` for that challenge in the same request; the tests show that postgrest-js 2.108.2 sends one POST per call and replays none. Committed state also needs a standalone READ COMMITTED call and commit before the answer, which the route slice's database run must prove. A test checks the refusal lists, the arguments, the duration bounds, the outputs and the grants (all privileges revoked from PUBLIC, execute revoked from `anon` and `authenticated` and granted to `service_role`) against the current definition in `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`. Since sub-slice S6-8 the Explorer sign-in routes' dependency factory builds the session caller and their server composition calls `create` once per request; the session caller uses the duration rule. Current boundary tests enumerate only the explicit Explorer and password-role factory/composition references; Guide uses the password-role core, and the duration rule remains internal to the session caller. TypeScript parser checks retain the off-barrel/computed-reference prohibitions; reflective loading is beyond a source parser. |
| Supabase identity bridge (login step 6 sub-slice S6-7; the Explorer exchange called by the sign-in routes since S6-8) | `src/lib/solmind/supabase/loginIdentityBridge.ts` (server-only); `src/lib/solmind/supabase/__tests__/loginIdentityBridge.test.ts` | `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Section 6, hold then write, and `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md` Section 7.9 (AUTH-RLS-DEC-035). It sits beside `requestAuthClient.ts` in the request-auth adapter layer where contract 25 Sections 5.1 and 6 keep `@supabase/ssr`, imports `server-only`, `@supabase/ssr` and the server-only pair-proof owner, reads no incoming cookie, and obtains only its optional dedicated proof key through that owner; the route's composition root passes the Supabase URL and anon key, the auth cookie name from the same S6-2 policy it gives the writer, a provider deadline, a fetch, the link seam (the service-role client's Auth admin API) and a value-free cleanup-failure signal. Required precondition, an S6-8 composition gate: the link seam's client must reach Supabase Auth through a non-logging, non-rejecting fetch boundary, because the library itself logs a rejected fetch's error, in time or after the deadline, where the bridge cannot prevent it. Each sign-in builds one `@supabase/ssr` server client whose cookie reader returns no cookies and whose cookie setter only holds, in memory, the cookies the library hands over after its sign-in event. Guides and the Admin: `signInWithPassword` (refused credentials give `credentials_refused` with nothing held), then, after the route's redemption, the hold's `assertProviderUser` with the bound provider user id. Explorers: after the route's redemption, `exchangeExplorerLink` asks the link seam for a `magiclink` link, denies a link made for any other user before any exchange, and exchanges its token hash at once with `verifyOtp` (type `email`). The answer's user, the session's user, the access token's subject and the held cookies' access token must agree and equal the bound id. `release` hands over the held `{ name, value }` cookies, which S6-2's writer accepts, only after that assertion and when the caller states `created` or `existing`, a precondition the trusted caller attests. A refused first release while the hold is pending starts cleanup. Repeated release attempts return `refused` without another provider operation. `discard` immediately attempts best-effort local revocation of that one transient session (`POST /logout`, scope `local`, with the session's own access token); only a successful answer is `cleaned`, and anything else raises the signal and still denies. Each sign-in or exchange is one attempt with its own client, transport and recovered access tokens, so concurrent attempts never share a token: while it is open, the access token in every answer to its request (whatever the library makes of the answer) and in every completed hand-over is kept, for cleanup only; it gives a hold only when the session is well formed, the hand-over carries that session's token and no other token was recovered, and otherwise every recovered token immediately gets best-effort local revocation. A successful answer read only after the deadline (whole or through a delayed body) never gives a hold or a release, and its token immediately gets best-effort local revocation; a timeout does not establish whether Supabase created a session, and if no access token is ever recovered, revocation cannot be attempted. `accessTokenExpiresAt` is the access token's `exp` claim (contract 25 Section 7); the session's stored `expires_at` does not redefine it. The bridge waits at most the configured deadline for each provider call (the hold client's requests are aborted then; the link seam has no abort), and the hold client's transport never rejects. The configuration, dependencies and request objects themselves are read through own data properties only, so no getter on them runs; the link seam's `generateLink` and the library's answers are read as ordinary properties. If the answer's user, the session's user, the token's subject and the held cookies' token disagree, the result is `failed`; if they agree but are not the bound id, `denied`; either way the bridge immediately attempts best-effort local revocation of a session that came back. Every result except a successful release carries no token, cookie value, password, email, link token or provider id; the bridge throws nothing once constructed, and its own code logs nothing. The banked Explorer dependency factory builds the link exchange behind the required fetch boundary; the connected Guide dependency factory supplies password authentication. Admin login remains dormant. Keep the bridge off every barrel and preserve only explicit server-only factory references. |
| Shared logout and pair-proof cleanup (S6-12) | `src/app/logout/route.ts`; `src/lib/solmind/supabase/logoutComposition.ts`, `logoutDependencies.ts`, `logoutRouteContract.ts`, `userSessionLogoutCaller.ts`, `logoutProviderSignOut.ts`, `credentialPairProof.ts`; shared cookie reader, identity bridge and Explorer verify composition; adjacent tests | Section 9 of `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` and the logout boundary in `docs/MODULE_BOUNDARIES.md` own ordering, exact targets and limits. Guard before cookie read; safe owned clears after readable-cookie/trusted-policy prerequisites even when later settings fail; database confirmation distinct from provider cleanup. Optional dedicated server key mints proof only from an accepted fresh pair; missing/invalid proof/key forbids renewal. The next-login backstop never renews and can target only a verified older same-account, distinct provider session. The proposed connected Explorer home calls this route; actual browser proof remains pending. No automatic administrator notification, provider revocation proof or hosted readiness is claimed. |
| Session logout writer (login step 6a; called by S6-12) | `supabase/migrations/20261004000000_user_session_logout_function.sql`; `supabase/tests/user_session_logout_*_test.sql` | `public.solmind_logout_user_session(account, presented session)`, called only through the bounded S6-12 adapter. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available, as for session creation. It takes the shared account-domain advisory lock and then the presented row's lock, reads one database clock, and changes the presented session to `logged_out` with that `ended_at` only when it is the account's active, unexpired session, embedding one Family B `session_logged_out` / `end` / `user_logout` row in the same transaction. A non-active session of the account returns `already_ended` with no write; an unknown or other-account session fails closed with `solmind_logout_unknown_session` and no write; every other error raised in its body, an assertion failure included, leaves as one fixed `solmind_logout_*` identifier with no underlying text; it never changes another session and reads no evidence. The three plans contain 50/64/93 assertions. Its new caller is `userSessionLogoutCaller.ts` through the shared logout composition. The function itself has no cookie/provider capability; cloud and real-user activation remain separate. |
| Login configuration: pepper source, route configuration and contact normalizer (login step 6 sub-slice S6-1; in use since S6-8) | `src/lib/solmind/auth/verificationPepperSource.ts` (server-only); `src/lib/solmind/auth/loginRouteConfiguration.ts` (server-only); `src/lib/solmind/auth/loginContactNormalizer.ts` (pure); `src/lib/solmind/auth/__tests__/verificationPepperSource.test.ts`; `src/lib/solmind/auth/__tests__/loginRouteConfiguration.test.ts`; `src/lib/solmind/auth/__tests__/loginContactNormalizer.test.ts` | The settings that banked decisions already require, which Paul's 2026-10-05 evening decision 1 placed within login step 6 (no `supabase/config.toml` or hosted configuration change; the contract 25 wording that records that meaning, and its register record, are sub-slice S6-3's). The server-only pepper source takes the pepper from one variable, `SOLMIND_VERIFICATION_PEPPER` (listed with an empty value in `.env.example`): 32 to 64 bytes as base64url text with no padding (43 to 86 characters), accepted only in that one canonical form, so the platform's lenient decoder cannot widen what is accepted. It refuses the pepper if `NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER` is also present (a tripwire for that one name, not a guarantee that the value is exposed nowhere else), and any failure throws one fixed, value-free `VerificationPepperSourceError` (`verification_pepper_unavailable`), with whatever was thrown inside dropped unread. A success returns login step 5's opaque pepper handle, which serializes to `{}`; the module then overwrites its decoded copy of the bytes with zeros, which does not erase the text in the environment. The server-only route configuration returns exactly the step 5 root's configuration as one frozen plain object: the pepper and fixed delivery settings reviewed with the code (host `127.0.0.1`; port 54325, which a test checks against `supabase/config.toml`'s `[inbucket] smtp_port`; a 5,000 ms delivery ceiling; and a 6,000 ms caller response deadline, longer than the issuance function's two lock waits of up to 2,000 ms each, which a test reads from the current migration). A test hands it to the real root with fake dependencies and checks that both callers are keyed by the loaded pepper. `checkLoginVerificationConfigurationAtStartup` is AUTH-RLS-DEC-032's startup check; calling it when the server starts (Next.js 16's `instrumentation.ts` `register`, in the Node.js runtime only) is done by the server start hook since sub-slice S6-8, which also composes the local transport only for a loopback trusted origin; a failed startup check writes one fixed, value-free line and the server keeps starting. The pure normalizer is AUTH-RLS-DEC-033's one shared function for login emails: it bounds the input at 512 characters, removes surrounding ASCII whitespace, refuses anything that is not printable ASCII (no Unicode folding, so look-alikes are refused), lowercases A-Z, and accepts the result only if it passes the current issuance function's email check exactly; tests compare its pattern with the migration's text and its behavior with the delivery boundary's canonical check for every printable character. A refusal is `null`; a success returns the canonical email, which is a contact value. Phone normalization joins it with phone sign-in, outside step 6. Since sub-slice S6-8 the Explorer sign-in routes use all three (the normalizer in their server composition, the configuration in their dependency factory and in the server start hook); they stay off every barrel. The login step 5 boundary test (VCB-004) now guards them as well, and their own boundary tests check their imports, their environment reads and their names with TypeScript's parser. |
| Active-session lookup with the session UUID (login step 6 sub-slice S6-3) | `supabase/migrations/20261005000000_active_user_session_lookup_session_id.sql` (replacing the definition in `supabase/migrations/20260705001000_admin_auth_rpc_lookup_functions.sql`); `supabase/tests/active_user_session_lookup_*_test.sql` | `public.solmind_find_active_user_sessions(uuid)` (AUTH-RLS-DEC-026; function 3 of `../solmind-docs/execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md`) also returns each active session's `user_session_id`, for the per-request session-binding check of `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25) Section 8, as Paul's 2026-10-05 correction of that contract requires. It is dropped and recreated in one transaction with the same argument, `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER` owner `postgres`, empty search path, single read-only SELECT (active-status and account predicates only; no expiry pre-filter, `LIMIT` or `ORDER BY`), and grants (EXECUTE for `service_role` only). It has runtime callers through `serviceRoleRpcExecutor.ts` (`/admin/access` and the Suggested Waypoint request dependencies); until the per-request check (S6-4, in its own row below) `supabaseAuthQueryClient.ts` read only the four columns it named; since then it requires `user_session_id` in every row and carries the selected session's UUID and `expires_at` to the allow result. The two plans contain 37/26 assertions; the banked `admin_access_rpc_*` suites are unchanged. |
| Sign-in lookups (login step 6 sub-slice S6-5; called by the Explorer sign-in routes since S6-8) | `supabase/migrations/20261005010000_login_account_and_redeemed_challenge_lookups.sql`; `supabase/tests/login_lookups_*_test.sql` | Two read-only, service-role-only functions for the sign-in routes (the step 6 plan's G2 and G7, accepted by Paul on 2026-10-05 as decision 2). `public.solmind_resolve_login_account(identifier, identifier type, role)` takes a canonical email, or the Admin username for the `admin` role only (checked only for what the schema requires, not blank, and lowercase form), and returns the one active account with an active, unrevoked assignment for that role, its active, verified, sign-in-enabled email contact whose stored email passes the issuance function's canonical email check, that email, and its one active `supabase` provider user id; every ineligible, unknown or ambiguous identifier (for example a username whose account has two sign-in emails) gives the same zero rows. `public.solmind_confirm_redeemed_login_challenge(account, challenge, purpose)` returns exactly one row: `true` only when that exact challenge is the account's own, with a contact, of the expected purpose (`login` or `role_reentry`), used, not invalidated, and fresh under the protected session freshness policy with the session function's comparison; `false` otherwise, a missing policy included. Both are plpgsql and STABLE, so they cannot write, security definer with an empty search path; a malformed argument raises one fixed `solmind_login_lookup_*` or `solmind_login_confirm_*` identifier that depends only on the argument; neither has an exception handler or takes a lock. The account lookup reads no challenge; the confirmation reads one challenge by its exact selector only, so it is not a newest-open lookup (AUTH-RLS-DEC-031). EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available. The two plans contain 97/78 assertions. Since sub-slice S6-8 the Explorer sign-in routes call both, through `src/lib/solmind/supabase/loginAccountLookupCallers.ts`; the functions themselves add no route, cookie, provider action, cloud action, or real-user activation, and the Guide and Admin routes (S6-9) depend on them too. |
| Explorer sign-in routes (login step 6 sub-slice S6-8) | `src/app/login/explorer/send/route.ts`; `src/app/login/explorer/verify/route.ts`; `src/app/login/explorer/send/__tests__/route.realpath.test.ts`; `src/app/login/explorer/verify/__tests__/route.realpath.test.ts` | Thin, POST-only, dynamic Route Handlers. Each loads the trusted origin, runs the same-origin JSON guard before any other work, denies any query parameter, checks the body with an exact-key parser, and makes one call into the server composition. Every answer is HTTP 200 with one of a closed set of results and the same headers (the three no-store headers and nosniff). The send route sets no cookie. The verify route reads request cookies once after the request guards. It passes names with empty values to the cookie writer and separately captures the shared-format old access/refresh/pair-proof candidate solely for bounded residual cleanup after an independently accepted fresh login. That candidate supplies no fresh-login authentication or account-lookup authority. The route hands the composition a function that makes the success response and sends a fresh fixed answer unless the composition returns `signed_in` with that response. Do not add a method, query parameter, body key, return address, role, additional cookie read or new use of incoming cookie values without its separately reviewed scope. The proposed connected Explorer screen calls these routes (S6-10); actual browser proof remains pending. Decided by Paul on 2026-10-07 (`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; option 1 of the morning check-in packet's items 3, 4, 6 and 18), in each option's words: the two paths, "`/login/explorer/send` and `/login/explorer/verify`"; for the Explorer home address, "name the new page's address now, `/explorer/home`, and build the page with the screens"; "one "code not accepted" result for every refused code, its words chosen with the screens"; and, after a correct code, "keep the small message naming the fixed home", which is the verify route's JSON answer. Paul approved the sign-in message on 2026-10-17. Actual proof of the proposed Explorer home and connected screens remains open. |
| Explorer sign-in composition and dependencies (login step 6 sub-slice S6-8) | `src/lib/solmind/supabase/explorerSignInComposition.ts`; `src/lib/solmind/supabase/explorerSignInDependencies.ts`; `src/lib/solmind/supabase/explorerSignInRouteContract.ts`; `src/lib/solmind/supabase/__tests__/explorerSignInComposition.test.ts`; `src/lib/solmind/supabase/__tests__/explorerSignInRouteContract.test.ts` | Server-only, direct-import, off every barrel. The composition holds both step orders and fixes the identifier type `email`, the role `explorer` and the purpose `login`; it takes a clock, a waiter and two dependency factories as ports and imports no Next.js module. Send: normalize, configuration first, a spare selector from the issuing caller's refused-request path, the account lookup, issuance only for exactly one row and only with both UUIDs from that row (never the null-bound `login` request the issuing caller would accept), then one acknowledgment after the wait. Verify: redeem, lookup, confirmation, the bridge's Explorer exchange, one session call, release with that call's outcome, and only then the success response and the cookie writer; once a hold exists every other exit awaits `discard`. The factory builds everything that can fail on configuration before the first database call, applies the loopback rule on both routes before the step 5 root is built, and holds the deadlines, the 1,500 ms response floor, the private reader of the two public Supabase settings, the bridge's fetch and the one fixed cleanup-failure signal line. The route contract holds the exact-key body parsers, the closed results, the fixed destination and the response headers. The wait is a floor measured from composition entry, not equal timing; earlier refusals do not wait, and waiter failure can return early. Decided by Paul on 2026-10-07 (`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; option 1 of the morning check-in packet's item 5): "a fixed wait of about one and a half seconds, set from the first local run. Accept the three limits for the local demo, and record them." Still open: the exact value; the code uses 1,500 ms until the first local run sets it. |
| Sign-in lookup callers and link client (login step 6 sub-slice S6-8) | `src/lib/solmind/supabase/loginAccountLookupCallers.ts`; `src/lib/solmind/supabase/loginLinkAdminClient.ts`; `src/lib/solmind/supabase/__tests__/loginAccountLookupCallers.test.ts`; `src/lib/solmind/supabase/__tests__/loginLinkAdminClient.test.ts` | Server-only, direct-import, off every barrel. The lookup callers call the two S6-5 functions, one fixed name each, through a narrow RPC seam under a caller response deadline, with frozen results, no retry and no log: `found` (exactly one well-formed row), `not_found` (zero rows) or `failed`; and `confirmed` only for exactly one row holding the boolean true. The link client is a second module that builds a client with the service-role key: its fetch never rejects and never logs (a failed request becomes one fixed 503), and it hands out only `generateLink`, called on the library's own object. It is the fetch boundary the identity bridge's precondition requires. Do not widen either into a generic executor or expose any other Auth admin call. Decided by Paul on 2026-10-07 (`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; option 1 of the morning check-in packet's item 7): "a second, separate module used only for that one link request, exposing nothing else". |
| Server start hook: login startup check (login step 6 sub-slice S6-8) | `src/instrumentation.ts`; `src/instrumentation-node.ts`; `src/__tests__/instrumentation.test.ts` | `register` runs, in the Node.js runtime only, a literal import of the Node.js half, which calls `checkLoginVerificationConfigurationAtStartup` once (AUTH-RLS-DEC-032). Any failure writes one fixed, value-free line to standard error and the server keeps starting; nothing is thrown and no value or error is printed. Keep the import literal: the login step 5 boundary test refuses a computed reference in every non-test file. Decided by Paul on 2026-10-07 (`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The 2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; option 1 of the morning check-in packet's item 9), for a missing pepper when the server starts: "the app starts, sign-in is unavailable, and one fixed line with no value says so". |
| Per-request check: session cookies and session binding (login step 6 sub-slice S6-4) | `src/lib/solmind/supabase/requestAuthClient.ts`; `src/lib/solmind/supabase/principalMapping.ts`; `src/lib/solmind/supabase/supabaseAuthQueryClient.ts`; `src/lib/solmind/supabase/serverAuthSourceAdapter.ts`; `src/lib/solmind/supabase/sessionSelection.ts`; `src/lib/solmind/auth/serverAuthContext.ts`; `src/lib/solmind/auth/authSource.ts`; `src/lib/solmind/auth/sessionCookiePolicy.ts`; `src/app/__tests__/guardedRoutes.perRequestCheck.realpath.test.ts`; `src/lib/solmind/supabase/__tests__/requestAuthClient.realLibrary.test.ts` and `requestAuthClient.directToken.realLibrary.test.ts`; `src/lib/solmind/auth/__tests__/sessionCookiePolicy.accessToken.test.ts`; the tests beside each changed module; `tests/whole-path/suggestedWaypointLocalAuthFixture.ts`, `suggestedWaypointLocalSqlFixture.ts` and `suggestedWaypointRoleSessionCookies.test.ts` | `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25) Sections 7, 8, 14 and 19 (Sections 8 and 19 as Paul corrected them on 2026-10-05, AUTH-RLS-DEC-044; Section 14's field check and the token-only verification of Sections 7 and 8 under the decision record that banks before this code (the entry of `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` that records the field check and the token-only verification for sub-slice S6-4, and the section of contract 25 that quotes the visitor-cookie question)), on the guarded read path of all 8 route handlers (`/admin/access` and the seven Suggested Waypoint routes). There is one read point and one compare point. The read is the request-auth adapter, which both composition roots build: it resolves the session-cookie policy from `loadTrustedApplicationOrigin()` at construction (one fixed, value-free configuration error otherwise, which `/admin/access` records, when the audit writer is available, as one `auth_resolution_failure` row for every request in place of the opaque deny decision row), reads the request's cookies once, applies the one shared format check to the auth cookie before any Supabase client exists, requires exactly one session-binding cookie holding a lowercase canonical UUID, and only then builds a client with `createClient` of `@supabase/supabase-js` (`persistSession` false, `autoRefreshToken` false, `detectSessionInUrl` false, `skipAutoInitialize` true; no cookie reader, no cookie setter, no storage) and calls `getUser(token)` on it with the accepted cookie's sign-in token, which the policy's second pure helper `readSessionAuthCookieAccessToken` hands over; an absent or malformed auth cookie, or a missing, repeated or malformed binding cookie, resolves no principal before Supabase Auth is asked. The UUID travels on the principal as `presentedSessionId`. The query client requires `user_session_id` in every session row and keeps the selected session's UUID and `expires_at`; the record adapter maps them and echoes the principal whole. The compare is `deriveTrustedServerAuthContext`, which every guarded decision calls: after the provider identity, the account and the selected session pass, it denies unless the presented UUID exactly equals the selected session's, and on an allow the trusted context carries `session: { userSessionId, expiresAt }` for server use; the proposed home projects only expiry and a fresh observation time to its client. The UUID stays server-private and neither value is logged. The UUID grants nothing on its own, and a superseded session, presented by a stale tab or by a replayed request, is denied in the same role and after a login in another role. Outward results are unchanged and value-free. No cookie is written, refreshed or cleared; `serviceRoleRpcExecutor.ts` is unchanged, and no code line of `composeRequestAuthContext.ts` or of a route file changes (five comment lines that called the adapter `@supabase/ssr`-backed are reworded, in `composeRequestAuthContext.ts`, `adminAccessRequest.ts`, `adminRouteAccess.ts` and the `/admin/access` route file). The shared format check in `sessionCookiePolicy.ts` gains its last step, the field check: the cookie is decoded exactly as the library would decode it (a leading byte-order mark kept) and parsed once as JSON, the parser's error is dropped, and the cookie counts as malformed unless, each read as an own property of the parsed object, `access_token` is a string of three non-empty parts of A-Z, a-z, 0-9, `-` and `_` joined by dots, `refresh_token` is a non-empty string, `expires_at` is a positive safe integer and `user` is absent, null or an object that is not an array; so no token text that the platform refuses as a header value (and that the library would then print) reaches the library, nor text that is not JSON. No guard is put around the library's requests. The token-only verification is the adapter's alone: the library is given the token and nothing else of the cookie, holds no session, and has no cookie setter, so it is given no renewal token to send; the adapter applies no expiry rule and reads no clock; whether a token is still good is Supabase Auth's answer, and a token that Supabase Auth refuses denies; and logout (S6-12) decides its own handling. In its tests through the installed library, with late, replayed and hand-made cookies and the clock moved between the check and the call, the library made at most one request, `GET /user`, and none to the token endpoint. Since sub-slice S6-8 the Explorer verify route writes the two cookies after a successful sign-in (Guide uses its separate password/code routes and Admin remains inactive; the banked Explorer screen calls its fixed routes); a request without both cookies is still denied by every guarded route, and all 8 routes need `SOLMIND_TRUSTED_APP_ORIGIN`. Still open: the library prints the platform's error when Supabase Auth cannot be reached (in the tests, with a stand-in for a refused connection, that line held no cookie text); and the library was tested on its own, not against the real Supabase Auth or inside a running Next.js server. The in-memory auth source takes the presented UUID from the request, never from its store. |
| Invitation acceptance and Explorer issuance foundations (`PRJ01_F-WS06-WI008-S02B` through `PRJ01_F-WS06-WI008-S02D`) | `supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; `20260718001000_invitation_acceptance_preparation.sql`; `20260718002000_guide_invitation_acceptance.sql`; `20260718003000_admin_guide_invitation_issuance.sql`; `20260721000000_explorer_engagement_capacity_foundation.sql`; `20260724000000_invited_identity_provisioning_helper_generalization.sql`; `20260725000000_explorer_invitation_issuance.sql`; related `supabase/tests/*invitation*` and `invited_identity_provisioning_helper_explorer_test.sql` | Banked dormant evidence-consumption, pre-provider reservation, Guide acceptance, Admin Guide-invitation, Explorer capacity/lock foundations, the shared invited-identity helper, and two Guide-owned Explorer issuance/revocation functions. `PRJ01_F-WS06-WI008-S02D` is banked in app commit `a9944f1` after focused 203/203 and complete 1,547/1,547 database assertions, zero-residue proof, final clean reset, lint, typecheck, 487 application tests, production build, and exact Fable 5 assurance passed. It enforces normalized-contact open-invitation capacity, same-Guide/same-Practice replacement, cross-Guide nondisplacement, expiry materialization, exact retry, explicit Guide revocation, and exact fail-closed transactional audit. It preserves the separately owned Explorer acceptance, preparation pre-check, cross-operation concurrency/debt closure, callers, provider effects, delivery, consent, sessions, cloud, deployment, and real-user gates. |
| Explorer invitation acceptance (`PRJ01_F-WS06-WI008-S02E`; banked dormant foundation) | `supabase/migrations/20260727000000_explorer_invitation_acceptance.sql`; `supabase/tests/explorer_invitation_acceptance_*_test.sql`; focused extensions to `supabase/tests/invitation_acceptance_preparation_*_test.sql` | Banked dormant service-role-only acceptance transaction plus the approved preparation capacity pre-check. It consumes committed authorizing evidence once, reuses the shared invited-identity helper, enforces first-commit-wins current-Guide capacity, creates exactly one `intake_pending` relationship with invitation provenance, accepts the invitation, revokes only same-Guide/same-Practice/same-contact open siblings, and writes the exact Family B audit rows transactionally. Focused validation passed 6 files / 436 assertions and complete validation passed 31 files / 1,777 assertions with zero synthetic residue and three clean 32-migration resets. It is banked in app commit `5e98ebf`; it remains dormant, has no app caller, and is not deployed or active for real users. |

## Prepared Guide/Admin and Explorer browser components (2026-10-16)

This dated inventory retains its original source-only review history.
Explorer connection is banked as SL-069. Guide components are reused by the
separate connected Guide owners below. Admin was preview at that checkpoint;
its separate connected source owners are below. Old component
receipts alone do not certify combined integration or real effects.

| Owner | Responsibility |
| --- | --- |
| `solmind-app/src/lib/solmind/auth/adminLoginIdentifierNormalizer.ts` | Pure server-side login identifier normalization: approved Admin username rule or existing email normalization; no lookup, stored-name migration or first-Admin setup implementation. |
| `solmind-app/src/lib/solmind/supabase/passwordRoleSignInBodies.ts` | Server-only exact raw-string bodies for four fixed-role send/verify entrypoints; no response policy, normalization or IO. |
| `solmind-app/src/lib/solmind/supabase/loginAccountLookupCallers.ts`; `solmind-app/supabase/migrations/20261016000000_login_challenge_ownership_lookup.sql` | Preserve existing eligible-account lookup and redeemed confirmation; add one fixed login ownership caller/RPC with exact challenge/account/contact-account binding and no mutation or duplicate eligibility. It is separate from the seven-function record-loading executor. SQL suites passed 56 assertions in the isolated October 21 run; see the dated test catalog. |
| `solmind-app/src/lib/solmind/supabase/passwordRoleSignInCore.ts` | Private Guide/Admin orchestration with four fixed-role entrypoints, no request-derived role/purpose/destination and no incoming credential authority. Order, hold/preparation/release/lifetime and cleanup boundaries are in [solmind-app/docs/MODULE_BOUNDARIES.md](../../solmind-app/docs/MODULE_BOUNDARIES.md#prepared-guideadmin-and-explorer-browser-boundaries-2026-10-16). Current combined Guide evidence and publication/banking status are owned by SL-070 in the execution ledger. |
| `solmind-app/src/lib/solmind/supabase/passwordRoleSignInRouteContract.ts` | Fixed Guide/Admin paths/homes, shared headers/status and closed role-specific types/results. No handler, runtime validator, cookie writer or navigation. Prototype-role routes remain unchanged. |
| `solmind-app/src/lib/solmind/signInBrowserContract.ts`; `solmind-app/src/lib/solmind/explorerSignInBrowserTransport.ts`; `solmind-app/src/lib/solmind/explorerSignInFlowController.ts` | Separate Explorer S6-10 browser-safe contract, bounded injected-fetch transport and private attempt/generation controller. No server modules, browser storage or automatic retry. The banked Explorer caller owns navigation; these pure/transport owners do not. |

Exact source/evidence owners, suite filenames and remaining measurements are in
[solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md). Author checks and fake transports are not actual SQL, provider,
transmitted HTTP/cookie, browser or banking evidence. First-Admin setup must later
reuse the approved username rule; this component does not implement that flow.

## Connected Explorer ownership (prepared 2026-10-16; banked 2026-10-20)

Explorer connection is banked as SL-069 at app 796e03b/docs 98b5ca0; dated
proof and limits remain in the execution ledger. Preserve direct-token, logout
cookie/bridge/writer and browser owners. Guide and Admin use their separate
password/code source compositions.

| Owner | Responsibility |
| --- | --- |
| `solmind-app/src/components/solmind/LoginExperience.tsx`; `solmind-app/src/app/login/page.tsx`; `solmind-app/src/app/login/explorer/page.tsx` | A1 selection, explicit Explorer fetch/wait/status/navigation ports, fixed re-entry with separate Guide and Admin branches. |
| `solmind-app/src/components/solmind/ExplorerSignIn.tsx`; `solmind-app/src/lib/solmind/explorerLoginJourney.ts` | Existing private attempt lifecycle plus value-free presentation and explicit browser waits; no role/destination authority from input. |
| `solmind-app/src/lib/solmind/auth/explorerHomeAccess.ts`; `solmind-app/src/lib/solmind/routeAccess.ts`; `solmind-app/src/app/explorer/home/page.tsx` | Exact Explorer route rule; actual principal, selected-record and binding checks; opaque denial; final fresh expiry check and minimal time projection. Raw-header ambiguity is preserved/rejected before authentication. |
| `solmind-app/src/components/solmind/ExplorerHome.tsx`; `solmind-app/src/lib/solmind/logoutBrowserRequest.ts` | One owned logout request, S1 only after confirmed completion, S2 after denial/expiry, SM-OUT-01 for uncertainty, advisory expiry and fresh request on restored cached page. |

The connected home is authentication-only, not the `/explorer` prototype or a
Virtual Guide/onboarding/consent feature gate. No GET cleanup, automatic retry,
renewal or client credential clearing is added. Local cancellation and wait
budgets do not prove remote rollback. See
[solmind-app/docs/MODULE_BOUNDARIES.md](../../solmind-app/docs/MODULE_BOUNDARIES.md#connected-explorer-request-and-view-boundaries-2026-10-16)
and [solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md#connected-explorer-proof-plan-2026-10-16).
Stay signed in remains separately deferred. Paul approved the sign-in and
finite-session reminder text on 2026-10-17; their exact words are recorded in
`solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`,
under Explorer screen copy approved - 2026-10-17. Source tests and static rendering do
not establish mounted behavior, cookie delivery, protected reload or logout.

## Explorer conversation construction - 2026-10-24

This provider-held source increment is separate from retained fixed-script
previews and the three banked logins. Its actual proof and checked publication
status belong to `solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`.
This dated section retains predecessor ownership; the current held private
request/browser owners are specified in the private successor section below.

| Owner | Proposed responsibility |
| --- | --- |
| `src/app/explorer/conversation/page.tsx`; `src/app/explorer/conversation/state/route.ts`; `src/app/explorer/conversation/commands/route.ts` | Public data-free shell; freshly authorized private no-store read; guarded same-origin JSON command. The shell and home link confer no authority. |
| `src/components/solmind/ExplorerConversation.tsx`; `src/lib/solmind/explorerConversationContract.ts` | Closed browser projection, saved-history view, pending-turn hold, stable operation/revision and exact uncertain retry. No browser identity or provider authority. |
| `src/components/solmind/ExplorerConversationFormation.tsx`; `src/lib/solmind/explorerConversationFormation.ts` | Empty Discovery, exact saved sources, explicit Priority/separate attention, captured Route history, chosen Waypoint and saved Reached evidence/time readback. |
| `src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`; `src/lib/solmind/supabase/explorerConversationRepository.ts` | Existing fixed Explorer authentication with raw duplicate-cookie preservation; four closed service-role feature RPC capabilities. |
| `src/lib/solmind/virtual-guide/explorerConversationComposition.ts`; `src/lib/solmind/virtual-guide/explorerConversationContext.ts` | Server-derived turn identities and exact replay preflight; real S03A/S03C context assembly with final revalidation and exact-byte fingerprint/evidence binding. |
| `supabase/migrations/20261024000000_explorer_conversation_composition.sql`; `supabase/migrations/20261029000000_explorer_formation_route_readback.sql` | Private persistence, immutable operation/captured Route evidence, ordered message/snapshot/invocation/audit preparation, closed settlement and deliberate formation/readback; no provider I/O. |
| `tests/browser/explorerConversation.pw.ts` and co-located feature tests | Authored browser/fake and focused contract cases. Their existence is not passing execution, real database/provider proof or source assurance. |

Context requires injected trusted versioned configuration. Its submitted intake
allowlist is `supportNow`, `usefulOutcome`, `supportStyle`, `guideContext`,
`communicationPreference`, `doNotEmphasize`, in that order, with required blanks
rejected and optional blanks absent. The actual response-set UUID is qualified by
approved field inside S03A, but appears once in physical source evidence. Duplicate
fields and cross-kind UUID reuse reject. Serialized selection revision is
`wi007-v0.1+onboarding-fields-v2`. The last24 owned current-conversation messages
and immediate turn remain; prior sessions, Reflections, summaries and Guide-private
data stay omitted. Explorer preferences do not populate Guide guardrails.
Source IDs and required prompt, policy, behavior, crisis, role,
instruction and methodology bindings remain explicit. Original v1 evidence
is not retrospectively enriched or sufficient for dispatch.

The concrete request factory supplies neither provider nor context builder.
It reads no runtime provider credential and sends no synthetic reply. A new
send remains unavailable without writing a turn while activation is held.
A saved pending turn or uncertain command holds fresh controls; replay uses
the existing exact operation and never dispatches again. Read-only reload
shows authoritative saved state and cannot invent success.

Chosen Waypoints display In progress until a later explicit Reached review
with new supporting evidence and confirmation. No sharing or Guide-private
projection is added. Full Compass categorization/Route history, broader
Waypoint lifecycle, safety runtime and genuine provider activation retain
their separate scope and gates. Governing provenance and evidence requirements
remain in `solmind-docs/execution/04_SolMind_AI_Orchestration_Spec_v1_0.md` and
`solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md`.

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

For the local Suggested Waypoint whole-path proof, the isolated validation
workspace uses `next build --webpack` only inside the outer proof
runner. The normal live-repository `npm run build` remains the mandatory
Turbopack pre-banking gate, and
`tests/whole-path/suggestedWaypointWholePathRunnerContract.test.ts` pins that
separation.

Within the proof only,
`tests/whole-path/suggestedWaypointWholePathGuideDraftDiagnostics.ts` owns the
closed Guide draft-create diagnostic result. It accepts only the shared
browser-safe command contract plus three fixed request-boundary states and may
emit only ten value-free reasons. Raw response bodies, identifiers, cookies,
database values, and error text never cross into durable runner output.

`tests/whole-path/suggestedWaypointWholePathGuideRelationshipEntryDiagnostics.ts`
separately owns the conclusive pre-draft Guide relationship-entry result. It
accepts only the existing browser-safe list contract, requires the freshly
reset fixture to be empty, and emits one of nine fixed request, authority,
fixture, or UI-projection reasons. The scenario also requires the matching
empty Guide UI before draft creation. No protected response value or raw error
crosses the scenario boundary, and product authorization remains unchanged.

The Guide command route has one inert local-proof-only diagnostic seam at
`src/lib/solmind/supabase/suggestedWaypointWholePathGuideDraftDiagnostic.ts`.
It activates only when the exact local proof gates, loopback targets, run ID,
route, method, and matching test request header are all present. The route and
outer runner may then exchange only one of ten fixed internal-stage markers
through process memory and server stderr. The browser still receives the exact
generic `command_denied` contract; ordinary runtime remains inert; no identity,
relationship, command, database, cookie, response, or raw error value is
written or retained.

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
- Audit persistence beyond the DEF5-S2 redemption, DEF5-S3 issuance and DEF5-S4 session subsets, which the Explorer sign-in routes write at run time since sub-slice S6-8, and the banked dormant S02 protected-setting Family F subset: remaining login/provisioning (Family B), Admin sensitive-access (Family C), safety/escalation (Family D), and content/AI-lifecycle (Family E, except the two S03D pre-dispatch pairs) audit vocabularies and runtime wiring; a real operational logging/alarm mechanism (the AUD-3 operational signal is an injectable no-op seam); the deferred system-context/null-actor guarded-read vocabulary (AUTH-RLS-DEF-019); and any audit retention/review tooling. No new audit table grants, policies, or hidden-schema Data API exposure exist.
- Authentication middleware. MVP0 deliberately prefers explicit per-route and server-action composition over middleware (register decision AUTH-RLS-DEC-017); do not introduce middleware without a specific approved justification.
- Remaining provisioning work includes first-Admin setup, invitation callers and
  provider-identity/provisioning writes. Explorer sign-in/shared logout and the
  separately owned Guide path retain their ledger evidence. Admin's fixed login
  source owners are listed below; wiring alone supplies no Admin runtime proof,
  timing/risk acceptance, assurance or publication/banking result.
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

## Connected Guide ownership - 2026-10-21

These source owners form the bounded connected Guide path; /guide remains the
dashboard prototype. Admin has its separate connected source owners below. Current publication/banking
status is owned by SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and its linked checked receipt; source/check results alone do not establish
banking.

| Owner | Responsibility |
| --- | --- |
| src/app/login/guide/page.tsx, src/app/login/guide/send/route.ts, src/app/login/guide/verify/route.ts; src/lib/solmind/supabase/guideSignInHttpPorts.ts | Thin fixed-Guide entry/POSTs, local same-origin guard, explicit provisional timing and plain name/value cookie projection |
| src/lib/solmind/supabase/passwordRoleSignInBodies.ts, passwordRoleSignInCore.ts, passwordRoleSignInRouteContract.ts, passwordRoleSignInHttpHandlers.ts, passwordRoleSignInDependencies.ts | Exact bodies/fixed authority; retained send acknowledgment; ownership-before-password; private holds and factor/account confirmation before session; no partial publication; bounded awaited discard |
| supabase/migrations/20261016000000_login_challenge_ownership_lookup.sql | Non-consuming service-role-only exact challenge/account/contact join; banked loginAccountLookupCallers.ts is context; SQL suites 29/27 PASS in the isolated October 21 run |
| src/lib/solmind/passwordRoleSignInBrowserContract.ts, guideSignInBrowserTransport.ts, guideSignInFlowController.ts; src/components/solmind/GuideSignIn.tsx | Guide-only requests/results and private attempt state; no password on send, storage/logging or request-selected authority |
| src/lib/solmind/auth/guideHomeAccess.ts; src/app/guide/home/page.tsx; src/components/solmind/GuideHome.tsx | Current principal/session/role/binding guard, raw-cookie ambiguity, minimal time projection, finite reminder and shared logout/Guide re-entry |
| src/components/solmind/ExplorerHomeNavigation.tsx | Presentational Conversation and Compass entry, authenticated inbox link and collapsed fixed-script previews; each feature retains its own authorization; no provider/session authority |
| src/lib/solmind/auth/adminLoginIdentifierNormalizer.ts | Shared approved Admin parser, unused by Guide; consumed by the separate Admin connection; no first-Admin setup |

October 21 R04 genuine functional/contention observations and isolated app/
SQL results are in solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
Paul's 20:17:31 CDT approval in
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json
accepts disclosed timing/capacity risks and defers real exhaustion/induced
provider/session/cookie failure timing only for private synthetic local use.
The original full protocol is not claimed passed; deferred measurements remain
required before broader exposure or real users. This dated Guide-only approval
supplies no Admin risk acceptance. Preserve accounts/private
passwords and prototype/provider/privacy boundaries. Later first-Admin setup
must reuse the username rule; existing wider names retain email sign-in.


## Connected Admin ownership - 2026-10-23

These owners describe the bounded Admin connection over the existing auth,
verification, cookie/session and audited Admin foundations. Source inventory and
component checks establish no Admin genuine journey, timing/capacity adequacy,
risk acceptance, complete assurance, publication or banking result. Current
complete-slice evidence/status belongs to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md with its checked receipt.
Guide's dated evidence/private-local approval retains its own scope.

| Owner | Responsibility |
| --- | --- |
| src/app/login/admin/page.tsx; src/components/solmind/LoginExperience.tsx | Fixed Admin re-entry and chooser branch; separate AdminSignIn client ports and accepted fixed-home navigation; no request-selected role/home |
| src/app/login/admin/send/route.ts; src/app/login/admin/verify/route.ts; src/lib/solmind/supabase/adminSignInHttpPorts.ts | Thin fixed POSTs over existing shared handlers/dependencies; same-origin local email; explicit provisional timing, no module-load auth/config IO; plain name/value projection for strict cookie reads |
| src/components/solmind/AdminSignIn.tsx; src/lib/solmind/adminSignInBrowserTransport.ts; src/lib/solmind/adminSignInFlowController.ts | Approved email/username input, private current attempt and selector, no password on send, latest uncontrolled password at verify, bounded explicit browser wait, stale/cancel/disposal protection |
| src/app/admin/home/page.tsx; src/components/solmind/AdminHome.tsx | Dynamic raw-cookie-preserving page and times-only client projection; finite advisory clock, refresh/server revalidation, shared logout and fixed Admin re-entry; no dashboard/provisioning powers |
| src/lib/solmind/auth/adminHomeAccess.ts; src/lib/solmind/auth/adminAccessRequest.ts; src/lib/solmind/auth/adminRouteAccess.ts | Fixed /admin/home authorization through one audited chain; guarded-read then allow-decision writes must both persist before final expiry check; preserve exact public probe and legacy server actor projections |
| src/lib/solmind/routeAccess.ts; src/lib/solmind/auth/adminLoginIdentifierNormalizer.ts | Fixed Admin home rule and existing approved username/email normalizer; no first-Admin setup or stored-name migration |

ADMIN_SIGN_IN_CONFIGURATION explicitly starts at floor 1,500 ms; lookup,
ownership and confirmation 3,000 ms each; provider 5,000 ms; session 18,000 ms.
These are provisional engineering values, not measured adequacy or a whole-flow
wall-clock bound; the client wait is 60,000 ms. Shared issuance/redemption pools
remain per loaded process/module, not distributed or per-account admission.
Guide measurements and its October 21 approval cannot accept Admin residual risk.

Keep /admin and standalone preview behavior separate. The public /admin/access
probe still returns exactly { allowed }; existing internal actor callers still
receive only their original actor result. Only expiresAt/observedAt cross the home
client boundary. Preserve accounts/private passwords, audit failure posture and
all separately gated provisioning/provider/cloud/real-user/cleanup boundaries.
See docs/MODULE_BOUNDARIES.md for the detailed chain; co-located Admin tests and
tests/browser/adminConnectedLogin.pw.ts are proof owners, not proof by existence.

### Admin-specific local evidence and acceptance - 2026-10-23

Admin's own isolated real browser/provider/database/mail proof completed the
functional login, authorization, refresh and shared-logout paths. Separate real
measurements covered four-slot admission/recovery, actual code exhaustion and
idle induced failures. Ordinary refusals were about 1.51-1.53 seconds; provider
failure about 5.06 seconds and session-lock failure about 2.50 seconds. These
single observations retain timing/capacity clues. A timed-out redemption later
spent its code. An induced second cookie-setter failure returned a fresh
cookieless denial, while one unpublished application session and its created
audit had committed; the test separately observed and ended that session.
This response-local handler trial does not measure natural browser-cookie
failure or guarantee remote rollback.

Paul explicitly accepted these disclosed limits for PRIVATE SYNTHETIC LOCAL
Admin use on 2026-10-23. Repeated timing distributions, partial/maintained-load
comparisons, natural browser-cookie failure timing and induced home-audit-write
failure timing are deferred. The original full protocol remains INCOMPLETE,
not passed. The pressure-comparison startup timed out before authentication
runtime; its disposable resources were fully torn down. Full source assurance,
all other checks and exact application/publication/banking gates remain required.
Broader exposure and real-user use retain separate gates. The detailed evidence,
Admin-specific decision and current slice status are owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md,
solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

### Provider-held response-length follow-through - 2026-10-24

The S03B response parser enforces the existing canonical 300-word hard cap after
normalization and the independent 8,192-character check. It counts Unicode
word-like segments with Intl.Segmenter (en, word), so punctuation-separated words
and unspaced scripts cannot bypass the cap through whitespace counting. Exactly
300 segments pass unchanged; 301 rejects the whole reply with the existing
value-free limit error. Completed, refused and safety_redirect envelopes share
this boundary. Connected composition settles failure with null reply fields,
never truncates or invents a fallback, and exact replay does not redispatch.
The response shape and wire version stay unchanged. This deterministic guard
does not prove the 40-150-word target, one question, semantic pacing,
classification, crisis handling or genuine model safety. No provider, environment,
factory, SQL, shared database or context-source behavior is activated or widened.


### Provider-held methodology screening contract - 2026-10-24

`src/lib/solmind/virtual-guide/methodologySafetyScreenContract.ts` is a
direct-import, server-only synchronous data boundary, absent from shared barrels.
It binds a closed version-UUID/content subject to its exact UTF-8 SHA-256, using
the existing 24,000-character methodology cap without text normalization. It
rejects unsafe controls, isolated surrogates, unknown/accessor/proxy properties
and widened or sparse findings. The closed result permits only pass/review/fail,
the exact subject digest and at most 16 findings from 18 declared criteria.
Citations must be exact nonempty subject substrings of at most 512 characters;
explanations are bounded to 768 characters. Duplicate criterion/excerpt pairs
and inconsistent outcomes reject. The result is a deeply frozen copy with the
server-selected version UUID. Errors contain only fixed codes.

This proves structural and byte linkage only. It does not prove semantic truth,
stored version/scope existence, invocation/policy-version provenance, screening,
Admin compliance, Guide approval, audit persistence or activation. Those belong
to the future governed caller and storage flow. There is no provider, environment,
HTTP, database, timer, log, UI or factory wiring in this contract. A parsed pass
cannot activate a pack. Preserve the independent provider-held factory and the
existing response-length guard. Focused tests use artificial data only.


### Dormant methodology storage foundation - 2026-10-24

`supabase/migrations/20261024010000_methodology_storage_foundation.sql`
creates only the logical methodology pack and immutable version tables, one
internal invoker trigger and their constraints. Typed scope foreign keys,
same-pack version/predecessor links, exact UTF-8 content digest, immutable
content/provenance and once-set screen/Admin/Guide/effective evidence are
structural controls. Both tables enable RLS with zero policies. Explicit schema,
table and trigger-function revocations deny PUBLIC, anon, authenticated and
service_role access, including inherited creation defaults. No workflow RPC,
service-role DML grant, seed, actual screen, actor approval or active data exists.

The owner-written test fixtures prove structure only. An FK-valid session/audit
record does not prove current role authority, event semantics or actual model
screening. An owner can structurally select a draft active pointer; the missing
closed workflow must enforce approved status and exact scope before any runtime
use. The schema is dormant and cannot safely activate methodology by itself.
Owner/superuser powers are not represented as RLS protection.

Existing context snapshots, legacy/v1 and synthetic v2 writers and fixtures are
unchanged. No blanket methodology FK or backfill is added: NOT VALID would still
enforce new writes and break existing arbitrary synthetic UUIDs. A future governed
successor must bind a real approved version, exact text/digest, screen/Admin/Guide
and audit evidence prospectively; load/revalidate effective context each new turn,
preserve old provenance and perform no extra dispatch on exact replay.

`supabase/tests/methodology_storage_foundation_test.sql` adds 67 rollback-only
structural/ACL/denial/immutability assertions. Normal full SQL regression,
character validation, current Executor assurance, exact application and checked
publication remain required. The earlier standalone 67-case draft proof is
separate from the migration candidate's regression; neither is operational AI
screening or human approval. Banking is final only when the current purpose
root's PUBLICATION_METHODOLOGY_STORAGE_R05/STATUS_CLOSEOUT.json is PASS.

Provider/context factory wiring, UI, current request/response contracts, shared
demo schema/data/passwords and package dependencies stay unchanged. No shared
database migration, provider activation, external AI or real-user effect follows
from source publication. Governed registration/screen persistence/closed audit,
focused Admin review, actual Guide-role checklist/approval, effective-version
resolution and affected safety/privacy runtime remain unfinished. No new slice
identity, sprint outcome, forecast, readiness or genuine-AI acceptance credit.


### Provider-held governed methodology construction - 2026-10-24

This successor is current proposal construction, NOT validated, assurance-passed,
applied, published or banked. Earlier storage/parser/response-length notes retain
their dated evidence and limits; original global object counts and no-workflow-RPC
statements describe that earlier foundation, not this additive candidate. Current
proof/publication status remains owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

The initial governed path is one explicit trusted-server-selected Guide-scoped
pack. Admin-assisted immutable preparation, a bound system screen, focused Admin
consistency review and the owning Guide's authenticated checklist/approval are
separate transitions. Other scope kinds refuse; no precedence, merge, fallback,
direct Guide authoring or new disclosure/retention policy is introduced. A failed
screen cannot be overridden into effectiveness.

Actual AI screening/inference, an approved operational pack, real human approval,
shared-demo migration/data, the default context/provider factory and genuine
connected-demo acceptance remain absent or held. Synthetic fixtures and a shaped
result are not actual model or human evidence. The approved metadata-only check
is consumed: credential_absent, no HTTP or inference. No new credential search
or retry follows. Preserve all existing private-local role-login limits,
provider boundaries and the 300-word guard.

| Owner | Narrow candidate responsibility |
| --- | --- |
| src/lib/solmind/virtual-guide/effectiveMethodologyContext.ts | Closed immutable Guide selection and exact content/digest validation. |
| src/lib/solmind/supabase/effectiveMethodologySource.ts | One closed resolver RPC with bounded cancellation, no raw table source. |
| src/lib/solmind/virtual-guide/explorerConversationContext.ts | Separate governed builder; per-turn selection and final authority/history/methodology revalidation; legacy builder retained. |
| src/lib/solmind/supabase/explorerConversationRepository.ts | Separate governed factory; only prepare changes, not read/complete/mutate. |
| supabase/migrations/20261024020000_methodology_governed_workflow.sql | Closed registration/read/screen/Admin/Guide transitions, atomic audit/effectiveness, resolver and prospective binding. |

Focused artificial-data proof owners are
src/lib/solmind/virtual-guide/effectiveMethodologyContext.test.ts,
src/lib/solmind/supabase/__tests__/effectiveMethodologySource.test.ts,
src/lib/solmind/virtual-guide/explorerConversationContext.test.ts and
src/lib/solmind/supabase/__tests__/explorerConversationRepository.test.ts.
Composition replay/refusal integration belongs in the context test without
requiring a composition source change. This map supplies no actual result/count.


### Governed workflow technical evidence update - 2026-10-24 23:32:36 CDT

The earlier construction/unrun labels are dated authorship state. This candidate
now has passing focused198/full4582/typecheck/lint/build and51-migration,
65-file/3400-assertion SQL evidence, including217 governance checks and five
actual overlap scenarios; zero-fixture/restored-trigger/owned-resource closeout
also passed. The full evidence, failures, two-cycle reconciliation and precise
synthetic-versus-genuine limits are owned by
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Do not duplicate its
proof protocol here. Full source assurance/application/publication remain gated
at this capture; banking is final only at
PUBLICATION_GOVERNANCE_R06/STATUS_CLOSEOUT.json PASS in the retained purpose root.
Default factories/provider/shared demo remain held; no real screen, operational
human approval, new slice/outcome, genuine-AI acceptance or wider effect follows.


### Provider-held exact-field exclusion matcher construction - 2026-10-25

This is current pure proposal construction, NOT validated, assurance-passed,
applied, published or banked. Current proof belongs to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Earlier governed-workflow
proof and publication retain their exact payload/date and do not prove this
increment. The default factory, dispatch path and shared database stay unchanged.

| Owner | Narrow responsibility |
| --- | --- |
| src/lib/solmind/virtual-guide/explorerContextExclusionGuard.ts | Pure bounded identifier/whole-field content matcher over supplied context/manifest. |
| src/lib/solmind/virtual-guide/explorerContextExclusionGuard.test.ts | Artificial clean/contaminated input, binding, hostile shape, normalization and intentional limitation cases. |
| src/lib/solmind/context/__tests__/explorerSafeContext.test.ts | Root-owned actual S03A forbidden-source/byte-absence canaries. |
| src/lib/solmind/virtual-guide/explorerConversationContext.test.ts | Root-owned S03C/builder canaries and test-only guard refusal before preparation/provider. |

No concrete denylist source or production composition owner is connected.
Detailed proof states/counts/results are owned by the test plan, not this map.
A clear result is only absence of a match in the supplied manifest. It proves
neither authorization nor index completeness/freshness. Whole-field content
hashing misses a private passage embedded inside a longer string, paraphrases,
encoded/Unicode-equivalent variants and content absent from the supplied index.
Typed isolation, an authoritative relationship-bound hash-only source with final
revalidation, runtime abort/audit handling and scheduled snapshot/Admin control
remain necessary before operational exclusion protection is complete.


### Pure matcher technical proof update - 2026-10-25 00:22:49 CDT

The preceding R07 unrun labels retain their initial-authorship meaning. Current
focused149/full4659/typecheck/lint/build checks passed; Root corrected one test
identity collision under cycle1of2, with original failures retained and no
matcher/runtime change. Detailed results/limits belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Complete-folder Root
assurance/application/publication remain gated at this capture; banking is final
only at PUBLICATION_EXCLUSION_R07/STATUS_CLOSEOUT.json PASS in the retained
purpose root. No authoritative source/freshness, complete exclusion coverage,
runtime audit/default wiring, scheduled control or genuine AI follows.


### Held methodology screening caller construction - 2026-10-25

Current provider-held caller construction has no validation/publication credit.
The test plan owns detailed prospective evidence:
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

| Owner | Narrow responsibility |
| --- | --- |
| src/lib/solmind/virtual-guide/methodologyScreeningComposition.ts | Injected draft/request/prepare/one-execute/one-terminal-settlement orchestration using the banked subject/result parser. |
| src/lib/solmind/virtual-guide/methodologyScreeningComposition.test.ts | Artificial ordering, binding, replay, hostile input, cancellation/drain and unconfirmed-settlement proof. |
| src/lib/solmind/supabase/methodologyScreeningRepository.ts | Exactly three existing SQL capabilities; closed owned-draft projection and strict prepare/settle shapes. |
| src/lib/solmind/supabase/__tests__/methodologyScreeningRepository.test.ts | SQL-shaped fake RPC validation, projection, immutability, failure and cancellation cases. |

No default client, credential lookup, SDK/HTTP adapter, route, UI, shared barrel,
new SQL or operational screen is introduced. Root owns any targeted real
isolated-SQL bridge with a fake model and all subsequent assurance/effects.


### Held screening caller technical proof - 2026-10-25 01:15:50 CDT

Earlier R08 unrun labels retain their initial-authorship meaning. Current
269 focused/4826 full tests, type checking, lint and normal build passed.
The targeted real-SQL/fake-model bridge passed eight cases; exact invocation/
audit state and no approval/activation were checked. Both disposable databases
were closed with shared three-volume identities unchanged. Root cycle 1 and
all initial regression/harness failures are retained. Detailed results and
limits belong to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

Immediate capability returns must be ordinary native Promises, descriptor-
checked before await. This does not undo work/resolution inside a trusted port.
Independent cleanup requests abort at twelve seconds, then owned work drains;
no real-adapter wall-time or operational latency guarantee is supplied.
No actual HTTP/model/policy/human approval, active pack, default wiring, audit
class, telemetry capability or SQL change follows. Current full-folder Root
assurance/application/publication remain gates. Checked banking becomes final
only at PUBLICATION_SCREENING_R08/STATUS_CLOSEOUT.json PASS in the retained
purpose root; no extra slice/outcome/forecast/readiness credit follows.


### Explorer assembly static source isolation construction - 2026-10-25

R09 source isolation is current unvalidated construction. The prospective proof
catalog belongs to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

| Owner | Narrow responsibility |
| --- | --- |
| eslint-rules/explorer-source-isolation.mjs | Frozen eleven-file dependency profiles and fixed-message approved-dependencies rule. |
| eslint.config.mjs | Existing presets/ignores plus the exact profile-scoped local error rule and installed restricted-global rule. |
| test/eslint/explorerSourceIsolation.test.ts | Actual plugin/config checks, current-source graph and parse-only hostile mutants. |

No product TypeScript, SQL, route, provider, default factory, dependency,
CI/service setting or assistant-workflow owner changes. Runtime source coverage,
currency and exclusion/audit/scheduled controls remain separate unfinished work.


### Explorer assembly import-boundary technical proof - 2026-10-25 01:50:01 CDT

Earlier R09 unrun labels retain initial-authorship meaning. Current188focused/
4926full/type/lint/normalbuild checks passed; no correction cycle was needed.
Actual plugin/config/eleven current modules and parsed negative fixtures were
tested. Detailed evidence and limits belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. This is a static source
boundary, not a sandbox or runtime/source-currentness/audit/model guarantee.
No productionTypeScript/SQL/provider/default/dependency change. Character/
Rootformalreview/application/live/publication/checked banking remain gates;
only PUBLICATION_SOURCE_ISOLATION_R09/STATUS_CLOSEOUT.json PASS is final banking.
Required productprivacy control does not adopt deferred optional process work
or add an accepted outcome. Source/currency gaps remain explicit preparation.


### Virtual Guide immediate transport-return guard construction - 2026-10-25

R10 is current, unvalidated proposal construction for the existing transport
boundary. Ownership stays narrow:

| Owner | Narrow responsibility |
| --- | --- |
| src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts | Ordinary same-realm native Promise guard before race; handled observer on its owned abort sentinel before generate; existing cancellation priority and value-free errors. |
| eslint-rules/explorer-source-isolation.mjs | Add only node:util after server-only in the contract's existing static profile. |
| src/lib/solmind/virtual-guide/__tests__/virtualGuideConversationTransportReturn.test.ts | Actual-call hostile immediate-return regressions with plain counted transports. |
| test/eslint/explorerSourceIsolation.test.ts | Update only the matching exact profile expectation. |

There is no default adapter/provider, timeout, late-drain, replay, policy,
restricted-state, SQL or dependency change. Internal trusted-port assimilation
and failures cannot be undone; uncooperative ports may outlive returned outcomes.
Source/currentness writer participation is preparation, not implementation.

Detailed prospective proof belongs to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. All current R10
checks, counts, durations and results are UNRUN; Root retains formal review,
exact application, live validation and publication. Checked banking is final
only when PUBLICATION_TRANSPORT_RETURN_R10/STATUS_CLOSEOUT.json is PASS in
the retained purpose root. Earlier dated evidence is not current R10 proof.


### Virtual Guide transport-return technical proof - 2026-10-25 02:24:15 CDT

Earlier R10 UNRUN statements retain initial-authorship meaning. Current initial
candidate205focused/4944full/type/lint/normalbuild passed, zero correction
cycles. Retained R09 pre-guard diagnostic10FAIL/8PASS/oneunhandled demonstrates
the defect; it is not current candidate evidence. Detailed proof/limits belong
to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Immediate native
Promise validation and owned abort observation preserve existing timeout/cancel/
parser/adapter/composition/replay behavior; no late drain, safety-state/policy,
SQL/default/provider/dependency change. Characters/Rootformalreview/application/
live/publication/checked banking remain gates; final banking only at
PUBLICATION_TRANSPORT_RETURN_R10/STATUS_CLOSEOUT.json PASS. No outcome credit.


## Private Explorer successor ownership

The current private construction and its six v3 ports are owned by
solmind-app/AGENTS.md and solmind-app/README.md. The older v1/v2/AV2 descriptions
and dated eleven-profile proof above retain their predecessor scope. The current
source graph has28 exact profiles and twelve erased type-only edges; src/lib/solmind/virtual-guide/openAiModelConfiguration.ts validates an explicitly supplied environment/model name, actual Explorer composition matches its pinned grant, and SQL stores captured model identity for replay/settlement; do not infer
new imports or activation from the older counts.

Keep explorerPrivateConfigurationCandidate.ts and explorerPrivateConfiguration.ts,
explorerSafetyReplyContract.ts, explorerSafetyReplyInvocation.ts,
openAiLunaExplorerSafetyTransport.ts, explorerConversationSafety.ts and
explorerPrivateConversationComposition.ts direct-import server-only under
src/lib/solmind/virtual-guide/. The six-port closed repository is
src/lib/solmind/supabase/explorerPrivateConversationRepository.ts. AV3 entries in
src/lib/solmind/virtual-guide/explorerConversationContext.ts are separate from
strict AV2 entries; compact input remains wi007-v0.1+onboarding-fields-v2.

supabase/migrations/20261025010000_explorer_source_exclusion.sql owns bounded
current-source inspection and committed content-free exclusion accountability;
`supabase/migrations/20261028000000_explorer_private_deferred_guard_privilege.sql` runs the existing deferred coherence check as its postgres owner at commit; its body, empty search_path, deferred timing and API-role grants stay unchanged.
supabase/migrations/20261025020000_explorer_private_safety_lifecycle.sql owns the
real first-Send container, minimum actual positive private evidence, monotonic
conversation policy and atomic terminal/formation transitions. Five legacy direct
service-role writes are retired, including all former v1 session types; preserve
definitions/history without restoring a bypass. Read-only/owner fixture evidence
grants no dispatch. Current private request wiring selects the v3 repository;
default dependencies still omit provider, readiness, builder, reviewed renderer
and operational signal. Actual assurance and unfinished gates belong to
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md.

### Finite private local HTTP configuration and dispatch - 2026-10-27

The actual private state/commands HTTP routes use
`createExplorerPrivateLocalRequestDependencies` in
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`.
The separate `createExplorerPrivateConversationRequestDependencies` retains
explicit capability injection and otherwise supplies auth/v3-repository only.
Older default/private-factory statements below refer to that explicit factory;
they do not describe the new local HTTP composition.

`src/lib/solmind/operations/explorerPrivateLocalRunProfile.ts` owns strict pinned
JSON/receipt loading and the persistent exclusive one-call claim. Absent, invalid
or expired server-selected data stays held. The browser selects neither profile
nor actor/target/authority. Receipt hashes and shaped approval fields bind trusted
operator evidence; they do not independently establish actual target isolation,
resource/source verification, screening or authenticated Admin/Guide decisions.
The two profile environment selectors are data locations, never enable flags or
approval. No OpenAI credential is read by this loader.

`src/lib/solmind/operations/explorerPrivateLocalDispatch.ts` owns request-scoped
prepared identity, fresh authenticated v3/conversation/policy checks, current
governed-methodology verification and a final authenticated reread after that
await. Changed/unknown authority, cancellation or session/run expiry refuses
forwarding. Check the key's format, then consume the durable claim, then forward;
never delete/reset it after uncertain results or use a fresh profile to retry.
Actual provider/credential and isolated-target grants remain separate.

The approved policy record supplies the exact private US English/plain-text
resource/failure strings. Keep the finite saved-turn/reload/pre-next-Send/stop/
closeout operator audit distinct from mandatory dispatch authority/exclusion.
This is not scheduled integrity/Admin paging, an independent preHTTP snapshot
scanner or an atomic database-to-HTTP lock. Genuine joined proof remains separate;
dated synthetic/source proof retains its original scope. Actual results belong
to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

### Held private request/browser owners

| Owner | Boundary |
| --- | --- |
| src/lib/solmind/explorerPrivateConversationResponse.ts | Browser-safe exact explorer-private-conversation-response.v1 envelope: version/result/assistance; bounded transient assistance with persisted:false. Imports only the closed result contract; private composition uses its erased assistance type. |
| src/lib/solmind/supabase/explorerConversationRequestDependencies.ts | Shared raw-cookie authentication; retained predecessor factory and explicit private factory selecting six v3 ports. Default private dependencies contain auth/repository only, with no new provider credential/environment lookup or operational activation. |
| src/app/explorer/conversation/state/route.ts; src/app/explorer/conversation/commands/route.ts | Private read/command composition and strict envelope validation; fresh authorization, same-origin writes and no-store remain. GET readiness requires complete injected ports/valid binding, with no ensure or evidence write. |
| src/components/solmind/ExplorerConversation.tsx | Strict envelope decoding; transient assistance outside saved history; assistance-bearing confirmed state retains the send draft and suppresses saved-reply confirmation. Authority loss still clears private state. |

The retained 70-second browser abort is a response wait, not a whole-command
budget or remote-work drain proof. New source ownership establishes no passing
checks, formal assurance, application, banking, verified operational configuration
or genuine model behavior. Provider/readiness/context/renderer/signal ports remain
absent from default wiring; supplying candidate data creates no activation grant.

### Explicit signal and dormant screening owners

| Owner | Boundary |
| --- | --- |
| src/lib/solmind/operations/explorerPrivateOperationalSignal.ts | Explicit dedicated local .jsonl path/receipt; version/time/closed-marker append only. No default/path/env lookup, directory creation, retry, private IDs or notification. No operational destination/adoption is configured; controller one-second await/abort is not proof filesystem writing stopped. |
| src/lib/solmind/virtual-guide/openAiLunaMethodologyScreeningTransport.ts | Pure explicit-policy builder binds exact subject/policy manifest/request bytes; dormant injected HTTP adapter, captured configured model/medium/store:false, no tools/background/stream/retry, structured output, no account/pack UUID model input, 128-KiB limits and 60-second local fetch/body-parse race. No key lookup, automatic policy acceptance, screen/human approval or activation. |

Both imports remain server-only with erased controller/screening-caller type
edges. Local timeout establishes no remote-stop, zero-billing or zero-retention
claim; standard provider abuse-monitoring retention remains separately disclosed.
New-module proof is initially UNRUN; earlier bridge checks cover prior bytes only.
After awaited readiness, GET reauthenticates and rereads current authority/state.
Joined-command proof, actual governance, integrity and activation gates remain.

### Private request await-budget owner

src/lib/solmind/operations/explorerPrivateRequestBudgets.ts supplies the private
factory's implemented local await bounds: auth/each supplied v3 port 10s,
readiness 15s and context 30s, combining caller/owned context cancellation.
Provider/render/signal keep existing 60/2/1s owners. The predecessor factory is
unchanged; default private wiring still supplies only wrapped auth/repository.
No remote stop, rollback, drain, synchronous-code sandbox, automatic retry or
terminal repost is established. The 70-second browser abort represents delivery
interest/uncertainty. Finite joined-path behavior and actual operational gates
still need proof; new timer fixtures are initially UNRUN and earlier bridge
checks apply only to prior bytes. The controller import is an erased type edge.

### Explicit reviewed rendering and governed-capability owners

| Owner | Boundary |
| --- | --- |
| src/lib/solmind/operations/explorerPrivateReviewedRenderer.ts | Reconstructs pinned trusted segments and explicit adult/age resource order; rejects mismatched plan prose and unsupported persistence/signal claims. Injected resource/failure strings and receipt bindings require actual review, not merely shaped input. |
| src/lib/solmind/virtual-guide/explorerPrivateGovernedCapabilities.ts | Binds copied explicit configuration, pack/Guide scope, receipt hashes, versions and supplied ports into a fingerprint. Each readiness call invokes its methodology source and requires the pinned subject digest; operational injection must supply the genuine governed resolver. Context uses the AV3 builder/adapter and current revalidation. |

Both are dormant server-only mechanisms with no default adoption, credential
lookup, model/human approval fabrication or provider activation. Actual operational
policy/resources, authenticated Admin/Guide governance, source/integrity controls
and genuine joined runtime proof remain required. New source is not a proof pass.
