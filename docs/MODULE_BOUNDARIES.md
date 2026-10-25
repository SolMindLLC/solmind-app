# SolMind App Module Boundaries

> Source reconciliation, 2026-10-21. Explorer login, direct-token request checks
> and shared logout are banked under SL-069. Dated actual evidence and limits
> remain in the execution ledger. Connected Guide source and October 21
> observations are described below; SL-070 and its linked checked receipt own
> current publication/banking status. Source/check results alone are not banking.
> Earlier component descriptions retain their historical source-only limits.

Version: 0.2.3
Repo: solmind-app  
Last Updated: 2026-10-24
Purpose: Define where code should live as the SolMind MVP0 application grows.

## Core Principle

SolMind code should be organized so that a small AI coding assistant can safely understand and modify one feature area at a time.

Prefer small, explicit modules over large mixed-purpose files.

## Current Source Layout

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
    login/explorer/page.tsx
    explorer/home/page.tsx
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
      auth/        server-side deny-by-default authorization and the request-auth boundary
      context/     Explorer-facing and AI-role context assembly helpers
      supabase/    server-side Supabase integration (request-auth client, service-role loader, mapping)

supabase/
  config.toml
  fixtures/      Banked manually invoked local-only S02 fixture; never production migration or universal seed
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

`src/app/explorer/page.tsx` remains a thin Server Component. It composes the
interactive S01 client boundary without owning its state transitions.

`src/app/explorer/waypoints/page.tsx` and its suggestion-scoped detail page are
thin Server Components for the authenticated S03 Explorer inbox and detail.
The detail's explicit engagement actions use a separate same-origin command
Route Handler; the Server Components own no command state or authority. They
must not import or extend `ExplorerExperiencePrototype.tsx`.

`src/app/guide/explorers/avery/waypoint-suggestions/page.tsx` is the paired thin
Server Component for the deterministic Human Guide review surface. It composes
only `GuideSuggestedWaypointWorkspace.tsx`.

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

### Explorer S01 components

- `ExplorerExperiencePrototype.tsx` is the only new S01 `"use client"` entry
  point. It orchestrates transient browser-memory stages and event handling.
- `SessionCompass.tsx` is a controlled presentational component. It renders a
  fixed Priority-up frame, readable zone labels, current attention, zero
  through eight visible points, and `Other paths`.

Neither component may own provider, persistence, auth, consent-version,
safety, or visibility policy. The mock Guide view receives only the narrow
projection returned by `createNonLiveGuideProjection`.

The bounded S01R2 conversation-first review surface keeps a parallel but
separate ownership split:

- `ExplorerCompassComparison.tsx` owns transient browser orchestration and
  focus/viewport handling;
- `ExplorerCompassComparisonParts.tsx` owns presentational screen regions and
  controls; and
- `explorerCompassComparison.ts` owns the pure deterministic conversation,
  Compass, Waypoint, quotation, navigation, and disclosure transitions.

`src/app/explorer/compass-comparison/page.tsx` only composes that client
boundary. The surface inherits S01's no-provider, no-persistence, no-auth,
no-notification, and no-real-user constraints. Its fixed replies must not be
described as semantic interpretation or a genuine model response. S03 remains
the owner of server-side provider conversation.

The retained sign-in preview keeps the same split: `SignInPreview.tsx` owns
its client boundary, `SignInPreviewParts.tsx` owns presentation, and
`signInPreview.ts` owns the approved copy and pure screen transitions.
Banked `/login` composes connected Explorer LoginExperience. The separate
Guide and Admin use their separate bounded connections. Screens follow their approved
mockups; the preview's own additions are styled apart (a "Preview controls"
band, with a remembered-browser switch on A3 and A3A, an example-screen
callout beside each code screen's claims, and explanations beside
unconnected controls). Within that preview, Guide opens A3 and Admin opens A3A;
both go on to A4 for that role, or, with the remembered-browser switch on,
explain beside the "Sign in" button that the code is skipped and stay. The
password field is uncontrolled, so its value never reaches state or markup.
A new-code request keeps A4, M1 or M2 on screen with what was typed; only the
preview switcher moves between the code screens.
It must not import the `auth/` or `supabase/` modules, persist entries, or
send or check credentials or codes; drafts remain in page memory. Connected
Explorer uses separate login step 6 owners. `LoginOptionList.tsx` and
`loginOptions.ts` are retained but no longer used by `/login`.

### Suggested Waypoint components

- `ExplorerSuggestedWaypointWorkspace.tsx` owns only fixture-local view state
  for the Explorer inbox, detail, private comparison, acknowledgement, and
  exact-response review surface.
- `SuggestedWaypointStatusPill.tsx` is a presentational status component.
- `suggestedWaypointFixtures.ts` constructs the synthetic delivered state by
  calling the pure domain rather than duplicating lifecycle rules in React.
- `GuideSuggestedWaypointWorkspace.tsx` owns only fixture-local Guide list,
  draft, pending-send, Pull Back, sent-detail, withdrawal, and receipt-review
  presentation.
- `guideSuggestedWaypointFixtures.ts` constructs Guide-only draft, pending,
  open, and acknowledged examples through the pure domain. It must not emulate
  passive Explorer telemetry or import Explorer-private fixture observations.
- `ExplorerSuggestedWaypointInbox.tsx` owns authenticated read presentation.
  `ExplorerSuggestedWaypointDetail.tsx` also owns explicit Mark as read and
  Acknowledge receipt interaction and recovery over the separately owned
  command client and route. Opening the detail remains write-free. Their
  browser contracts admit exact delivered-current-version and Explorer-private
  engagement fields, then reject Guide-only or inferred data.
- `GuideSuggestedWaypointRelationshipEntry.tsx` and
  `GuideSuggestedWaypointRelationshipList.tsx` own authenticated Guide read
  presentation only. `GuideSuggestedWaypointDetail.tsx` remains relationship-
  scoped and additionally owns complete-draft edit/save/review/schedule and
  pending-version Pull Back interaction over the separately owned client and
  Route Handler.

The retained fixture UIs do not access a provider, database owner, Server
Action, Route Handler, cookie, browser storage, notification, or real Guide
record. The authenticated S03 components use thin same-origin routes over
server-derived request authority and exact role-safe projections. The Guide
detail invokes save draft and schedule send for an existing complete draft plus
Pull Back for a pending version through the separately owned Guide command
Route Handler. The Explorer detail invokes only explicit Mark as read and
Acknowledge receipt through its separately owned command Route Handler. No
current Suggested Waypoint UI invokes blank-draft compose, delete, correction,
withdrawal, Explorer comparison/adoption/response commands, a worker, provider,
deployment, or real-user activation.

`auth/trustedApplicationOrigin.ts` and
`auth/sameOriginJsonWriteRequest.ts` are server-only first-write predecessors
for both role lanes. The configuration owner accepts one absolute HTTP(S)
origin from `SOLMIND_TRUSTED_APP_ORIGIN`; it never derives trust from Host,
forwarded headers, Supabase, or a public environment variable. The request
guard requires POST, exact JSON media type, exact Origin equality, Fetch
Metadata `same-origin`, identity or absent content encoding, one canonical
optional content length, a bounded 16,384-byte stream, strict UTF-8 without a
BOM, and one deeply frozen plain JSON object. It performs no authentication,
role choice, command parsing, RPC, or response projection. The existing
server-only Suggested Waypoint request composition remains the command-shape
owner and now rejects isolated UTF-16 surrogates plus Unicode line and
paragraph separators so the byte cap and text validator describe one coherent
accepted-input set. The Guide command POST route calls this guard before auth
or executor IO and then uses the existing request-dependency and composition
owners; every later Explorer write edge must preserve the same order.

`suggestedWaypointDisplayDate.ts` is the shared browser-safe presentation owner
for those authenticated Explorer and Guide list/detail components. It renders
year-complete `en-US` dates and date-times in the viewer's local time zone. Its
optional explicit IANA time zone is a test seam only; production consumers do
not pass one or force UTC. The helper does not change exact timestamps, browser
contracts, persistence, locale preferences, or an application-wide date system.

`suggestedWaypointCommandBrowserContract.ts` and
`suggestedWaypointCommandOperation.ts` are shared browser-safe predecessors for
later role-specific command edges. The contract accepts only exact data-property
results and the expected-outcome subset supplied by the owning route, then
returns frozen success, expected non-success, or value-free denied/failed
results. The operation owner is pure state: it suppresses double activation,
retains one exact serialized request and UUIDv4 operation identity across a
transport-uncertain retry, ignores stale generations, supports authoritative-
read settlement, and emits semantic busy, retry, announcement, and focus
intents. Neither module imports server-only code, invokes a route or RPC, reads
authority, owns command validation, or creates a database, worker, provider,
deployment, or real-user effect. The role lane retains the parsed result so its
copy and recovery path still distinguish expected concurrency from a value-free
denial or operational failure; the pure operation owner carries only their
shared focus and retry semantics.

`suggestedWaypointGuideDraftContentBrowserContract.ts` is the browser-safe
content owner shared by Guide detail parsing and the server command-route body
contract. It snapshots plain data once, then validates normalized single-line
destination, intentionally multiline why, and one to eight unique bounded
arrival signals. It owns no request authority, persistence, or lifecycle rule.

`suggestedWaypointGuideCommandClient.ts` is the Guide role-lane command caller.
It owns exact save-draft, schedule-send, and Pull Back bodies, the relationship-
scoped route URL, closed action-specific outcomes, same-origin fetch, and
conclusive versus transport-uncertain classification. It creates no authority
and receives no actor, role, policy, deadline, lifecycle, or Explorer value
from the browser. The companion
`suggestedWaypointPullBackCountdown.ts` is display-only. The Guide detail owns
the role result and recovery copy, preserves exact request bytes and operation
identity on retry, checks the authoritative detail after uncertainty, and
retries only the read after a conclusive command. Neither client owner may
render, announce, log, or place the pending-version selector in a URL.

`suggestedWaypointExplorerCommandClient.ts` is the bounded Explorer role-lane
caller for explicit Mark as read and Acknowledge receipt. It constructs one
suggestion-scoped request from the already loaded current-version detail and
sends no actor, role, relationship, Guide policy, or private reaction. The
detail permits one operation at a time, retains byte-identical requests across
transport-uncertain retry, requires authoritative detail settlement before it
announces completion, and ignores late generations after unmount or route
change. Mark as read remains Explorer-private; only deliberate receipt
acknowledgement is Guide-visible. Opening the detail never invokes the route.

Dormant `PRJ01_V-WS05-WI022-S02` adds a database-only Suggested Waypoint
boundary under `supabase/migrations/` and `supabase/tests/`. Eight owners keep
Guide draft content, pending outbound content, immutable delivered versions,
Explorer-private read state, deliberately shared receipts, Guide preference,
and content-free operation replay proof separate. The public catalog is closed
to six commands and five role queries, owned by `postgres`, executable only by
`service_role`, and backed by deny-by-default RLS with zero policies and no
direct role grants. No `src/` caller, browser path, hosted delivery worker,
provider, or real-user activation is part of S02. Do not wire these functions
through a generic RPC executor or the shared Supabase barrel; the separately
gated S03 composition must introduce narrow human and worker allowlists.

The forward-only destination correction gives `destination` its own protected
single-line normalizer. Save-draft applies it before request-digest or write
work, and the shared content trigger applies it to Guide draft, pending, and
immutable version rows so a privileged or later internal caller cannot bypass
the invariant. The reusable text normalizer remains multiline for `why` and
arrival signals; its CRLF-to-LF canonicalization remains part of idempotent
replay. The correction adds no public function, caller, worker, provider,
deployment, hosted data, or real-user effect.

The first S03 increment adds those narrow allowlists in
`suggestedWaypointRpcContract.ts` and `suggestedWaypointRpcExecutor.ts`, with
co-located contract/executor tests. The human executor exposes exactly nine
functions; the separately constructed worker executor exposes only delivery.
The dormant Admin query stays excluded. Both files are server-only, stay off the
shared barrel, validate exact call/response shapes and lifecycle coherence, and
return frozen copies or value-free failure sentinels. Command validation keeps
all eight canonical database outcomes distinct from transport failure, applies
the exact per-function outcome subset and nullable row shape, and preserves
opaque relationship-unavailable results without weakening operation binding.
They do not derive auth, check relationships, protect routes, schedule delivery,
or activate a caller.

The banked S03 composition adds `suggestedWaypointRequestComposition.ts`. It wraps
only the human executor, snapshots and validates exact client-safe operation
shapes, derives the trusted actor and active role from injected request-auth and
record sources, authorizes Guide relationship selectors against server-loaded
records, and requires an active Explorer context on the Explorer path. The
actor account is always injected from that trusted context. Initial suggestion
and pending-version identifiers are supplied only by an injected server
resolver. The module returns executor-validated role-safe payload data or one
of two fixed browser-safe errors. It remains off the shared barrel and owns no
route, Server Action, UI, worker, scheduler, provider, deployment, or real-user
activation. Separately reviewed thin Route Handlers build its cookie adapter
and invoke only the closed Guide/Explorer read operations or their exact
role-lane command subsets.

The banked S03 read layer owns the Guide relationship selector, Guide
relationship-scoped list/detail, and Explorer list/detail. Route input is
limited to closed pagination or opaque identifiers; actor, role, and Guide
relationship authority come from server request state and records. A second
browser contract validates the already-minimized role projection before
rendering. These routes add no command, delivery worker, provider, deployment,
or real-user activation.

## Product Logic and Constants

SolMind product constants and product logic live under:

```text
src/lib/solmind/
```

Current examples:

- `conversation.ts`
- `dashboardPanels.ts`
- `explorerExperience.ts`
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

`onboarding.ts` owns the exact S01 structured-form field definitions and the
distinct required-form/optional-First-Compass states.

`explorerExperience.ts` owns pure deterministic Discovery, Compass, Route,
private Waypoint, summary selection, exact review, frozen Shared Snapshot, and
narrow non-live Guide-projection behavior. It has no React, provider,
database, browser-storage, or server-only dependency.

`suggestedWaypoints.ts` owns the separate pure Suggested Waypoint lifecycle,
timing, replay, immutable-version, and role-projection rules. Do not duplicate
those rules in the Explorer or Guide component trees.

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

This directory now holds the banked, deny-by-default request-auth boundary, role-context resolution, route-access decisions, relationship read guards, the real Admin auth-source port, the bounded Auth/RLS audit event model, and the audit event writer. As of AUD-3 the `/admin/access` composition (`adminAccessRequest.ts`) persists those audit events at runtime through the closed-allowlist writer chain. Server-only modules are kept off the shared client barrel. Extend it in small slices; the separate connected-role login owners below do not implement the remaining provisioning write paths.

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

S01 does not import or extend this boundary.

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

The S01 non-live Guide result is not `/guide` and is not an operational
dashboard. It is a local proof that only submitted onboarding answers and an
exact confirmed Shared Snapshot cross the visibility boundary. It never
receives raw Explorer state.

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

S01 displays honest draft/TBD agreement copy but records no consent and must
not imply that it does.

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

S01 uses a fixed local script and exact Explorer-entered text. It must not
claim semantic interpretation or a genuine model response. S03 owns the first
server-side provider conversation.

### Explorer conversation composition construction - 2026-10-24

This provider-held increment does not establish a genuine AI response or
complete the connected demo. Actual proof and checked publication status belong
to `solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`.

`src/app/explorer/conversation/page.tsx` composes only the client shell and
renders no protected account/message/session props. The private data boundary
is freshly authorized GET `/explorer/conversation/state` and guarded same-origin
JSON POST `/explorer/conversation/commands`. Keep both handlers thin, no-store,
without query-selected authority. Authentication preserves duplicate raw cookie
names/values and reuses fixed Explorer authorization through
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`.
Feature authority is separately rechecked in closed database operations.
`src/lib/solmind/supabase/explorerConversationRepository.ts` exposes only
read/prepare/complete/mutate service-role capabilities.

`src/lib/solmind/explorerConversationContract.ts` is browser-safe and owns
closed bounded command/result shapes, exact UUID selections, expected revision
and required `pendingTurn` boolean. Browser actor, account, application-session,
relationship, policy and provider fields grant no authority.
`src/components/solmind/ExplorerConversation.tsx` owns fetch, exact result
decoding, view invalidation, one operation/revision and byte-identical uncertain
retry. Unmount/clear private drafts when authority is lost. No browser storage.
A saved pending turn blocks fresh commands; read-only reload may check it
without claiming completion. A failed/uncertain send never invents a reply.
Exact replay is recognized before new context assembly and never redispatches;
changed-byte reuse is refused.

`src/lib/solmind/virtual-guide/explorerConversationComposition.ts` owns
server-scoped conversation/message/snapshot/invocation/reply identities,
command fingerprints, replay preflight, prepare-before-dispatch order and
closed terminal settlement. The injected provider is optional, and the
concrete dependency factory deliberately supplies none. With provider or
context builder absent, a new send returns provider unavailable before any
new turn write. No silent fake, automatic provider retry or runtime credential
selection exists in this source increment.

`src/lib/solmind/virtual-guide/explorerConversationContext.ts` requires explicit
trusted server configuration: methodology pack version ID, prompt/instruction/
role versions and versioned global policy, role behavior, crisis behavior and
methodology text. It imports the real S03A assembler and S03C composer.
The six existing submitted onboarding continuity fields use their actual intake
response-set ID, in banked form order. Required blanks reject; optional blanks
omit. Only onboarding identity may use (real UUID, approved field); duplicate
fields and cross-kind UUID reuse reject. The physical UUID appears once in source
evidence; selection revision `wi007-v0.1+onboarding-fields-v2` is fingerprinted in
the compact context. Guide-authored guardrails stay separate from Explorer
preferences. Prior conversations, Reflections, summaries and Guide-private records
remain omitted. The last 24
saved owned messages and immediate Explorer message bind to the current
Explorer/conversation. Final source revalidation rejects revoked or changed
authority/history. Fingerprint the exact compact assembled bytes and retain
sorted source IDs and exact version bindings.

`supabase/migrations/20261024000000_explorer_conversation_composition.sql`
proposes private conversation-state/operation/Compass and Waypoint storage over
existing interaction-session/message owners. Its four public RPCs are
`public.solmind_read_explorer_conversation`,
`public.solmind_prepare_explorer_conversation_turn`,
`public.solmind_complete_explorer_conversation_turn` and
`public.solmind_mutate_explorer_conversation`; only `service_role` may execute
them. Internal helpers and tables are not browser capabilities. Require current
Explorer application-session/account/role, active or paused relationship,
approved active Practice/Organization, intake/adult/consent and clear restricted
mode, bounded locks, revision protection and exact replay. AV2/
`virtual-guide-predispatch-evidence.v2` adds source/version/intake bindings and
atomic ordered message, snapshot, invocation and audit preparation before I/O.
Retain v1 record values without retrospective enrichment; no v1-only dispatch.
A completed reply requires fresh full authority. Internal failed/canceled
closure can settle the exact retained actor/session/operation/invocation after
logout or expiry, without a reply or private state projection. It cannot
authorize a browser read, new dispatch or downgrade of completed evidence.
Unknown settlement retains honest pending state. The first-turn prepare also
rechecks under the Explorer lock that another tab has not created an active
conversation since the earlier empty read. UI and server reserve two message
slots before sending; formation remains available at the message limit.

`src/components/solmind/ExplorerConversationFormation.tsx` is controlled by
authoritative state, busy and a command-intent callback; pure validation is in
`src/lib/solmind/explorerConversationFormation.ts`. The parent owns operation
identity/retry and persistence. Empty Discovery is valid. Points use an exact
saved owned source and Explorer-supplied label; Priority confirmation and
attention remain separate. A private Waypoint requires destination, meaning,
arrival signal and explicit choice; chosen displays In progress. Later Reached
requires new supporting evidence and explicit confirmation. No sharing, model
interpretation, clinical score, automatic lifecycle change, Guide-private
projection or broader Guide work is added. Existing prototypes, S03A-S03E
foundations and all login/session/logout owners retain their boundaries.

## Explorer Sharing Boundary

S01 implements only transient UI/domain behavior:

- exact item selection;
- a freshly derived final review;
- a deeply frozen in-memory Shared Snapshot;
- `Not ready to share`; and
- a narrow non-live Guide projection.

It does not implement storage, sendability timing, expiry, lineage,
notifications, audit, RLS, Guide Assistant context, or a real Guide view.
Those remain S02 or later owners.

## Safety Boundary

Safety and escalation code should be isolated and heavily reviewed.

Expected future home:

```text
src/lib/solmind/safety/
src/lib/solmind/escalation/
```

Safety code must not be scattered across UI components.

S01 includes only accurate boundary copy. It does not classify, escalate,
notify, or expose safety-level output.

## Supabase Boundary

Current home (banked):

```text
src/lib/solmind/supabase/
```

This directory now holds the banked server-side Supabase integration: the request-auth client (identity, who), the guarded service-role loader (record loads, what), principal mapping, session selection, and the audit write path (the closed-allowlist `auditEventWriteExecutor.ts` over the single enumerated `public.solmind_record_audit_event` function, assembled by `adminAuditEventWriter.ts` for the `/admin/access` composition). The request-auth client, the service-role factory, and the audit write modules are server-only and kept off the shared barrel.

The closed Suggested Waypoint S03 transport and authenticated human-request
composition also live here. Their contract, human/worker executors, and request
composition are direct-import server-only modules kept off the shared barrel.
The request composition wraps only the human executor and derives authority
from injected request-auth and server-loaded records. It accepts only
single-line Guide-authored destinations, while the executor classifies an
exact-function-bound zero-row Guide or Explorer detail result as denied and
keeps every other zero-row result failed. The forward-only Explorer-list
relationship-invariant migration makes a successful empty page mean exactly
one authorized active Guide relationship with no delivered suggestions. Zero
or multiple active Guide relationships and derived authorization failure raise
one fixed value-free exception. The direct-import server-only
`suggestedWaypointExplorerRelationshipRpcError.ts` maps only that exact
Explorer-list function/code/message tuple to the existing denied result; every
near match and every other function remains failed. The shared browser-safe
`suggestedWaypointPaginationSharedContract.ts` owns only the exact page sizes,
strict padded-Base64 cursor grammar, and closed query syntax. The server-only
`suggestedWaypointPaginationRpcError.ts` maps the exact database invalid-cursor
code/message only when it came from the corresponding Guide list, Explorer
list, or relationship-selector function; every near match remains a generic
value-free failure. Later command route/server-action, page/data-adapter, and
worker composition must wrap these boundaries rather than weakening or
bypassing their exact allowlists, validators, role separation, or result
binding.

The browser side of those later command edges must also wrap
`suggestedWaypointCommandBrowserContract.ts` and
`suggestedWaypointCommandOperation.ts`. Route owners keep their exact action and
expected-outcome allowlists; the shared parser must not infer those values. A
transport-uncertain retry reuses the retained operation ID and exact serialized
bytes, while deliberate changed bytes require a new operation ID and generation.

The concrete `suggestedWaypointRequestDependencies.ts` request factory now
wires the request-auth principal source, enumerated auth-record loader, closed
human executor, and `suggestedWaypointScopedIdentifiers.ts` UUIDv5 owner. Both
remain direct-import server-only modules off the shared barrel. This dependency
root remains the only concrete assembly owner. The relationship-selector route
uses its selector subset; the Guide command route invokes the human composition
without widening browser authority.

The Guide detail row has one deliberately narrower extension for the later Pull
Back interaction: `pending_version_id`. The service-role-only database function
projects the exact protected pending row identity only for the already
authorized Guide detail. Both the server RPC parser and browser-safe detail
parser require a canonical UUID exactly in pending mode and require null in
draft or delivered mode. Guide lists and every Explorer contract remain
structurally unchanged. The identifier is an opaque concurrency selector: no
current component renders, announces, logs, or places it in a URL, and all
denied or failed results remain value-free.

The first Guide command caller lives at:

```text
src/app/guide/waypoint-suggestions/[relationshipId]/commands/route.ts
```

It is a thin, dynamic, uncached POST Route Handler over the direct-import
server-only `suggestedWaypointGuideCommandRouteContract.ts`. Query and path
validation run before body, cookie, auth, or dependency IO. The route then
loads only `SOLMIND_TRUSTED_APP_ORIGIN`, applies the bounded same-origin JSON
guard once, validates the exact role body, and injects the path relationship
once. The existing request composition derives actor and role, rechecks the
active Guide relationship, and executes exactly one closed create/save draft,
schedule-send, or Pull-Back RPC. Final projection revalidates the exact
function-bound row and returns only `ok`, `outcome`, `suggestedWaypointId`, and
`error`, with expected failures value-free. The route does not expose policy,
deadline, lifecycle, version, relationship, profile, actor, audit, or private
Explorer values. The Guide detail calls save draft, schedule send, and Pull
Back. The Explorer detail separately calls only Mark as read and Acknowledge
receipt through:

```text
src/app/explorer/waypoints/[suggestedWaypointId]/commands/route.ts
```

That route preserves the same body-before-auth ordering, derives Explorer
identity and its single active Guide relationship on the server, injects the
path suggestion once, and projects only the shared value-free command result.
The server-only local delivery invoker in
`src/lib/solmind/supabase/suggestedWaypointDeliveryWorker.ts` is a separate
composition boundary. A trusted caller supplies one exact operation,
suggestion, and expected pending-version UUID envelope. The invoker snapshots
those values before client or transport work, executes only the closed delivery
RPC through the worker executor once, revalidates and binds the result, and
returns only `delivered`, `not_delivered`, or `failed`. It does not discover due
work, scan protected tables, generate or rotate retry identity, queue, claim,
lease, poll, schedule, run continuously, or activate a hosted runtime.
Together the two browser role lanes do not call that invoker and add no Guide
blank-draft compose, delete, correction, or withdrawal caller, delivery
scheduler, Explorer comparison/adoption/response command, provider, deployment,
or real-user activation.

The test-only Suggested Waypoint whole-path safety kernel in
`tests/whole-path/suggestedWaypointWholePathSafety.ts` is an effect-free gate
for the future `CARRY-001` / `RPR-011` local authenticated runner. Before any
later runner may inspect a credential or create a local fixture, the kernel
requires two exact local-effect interlocks and accepts only project `solmind-app`,
the literal loopback API on `54321`, database port `54322`, a separately owned
loopback application port, one bounded run identity, and five closed synthetic
role labels covering both unrelated-role directions plus one ended actor. It
derives reserved-domain addresses rather than accepting
free-form recipients. It does not construct a client, read a key, create an
Auth principal, write a cookie or file, start a process, touch a database, or
contact a provider. The code-visible interlock values grant no authority and
cannot replace the active workflow or current human authorization. Auth
fixture lifecycle, isolated role sessions, whole-path
execution, unconditional teardown, zero-residue proof, and final local reset
remain separate test-infrastructure owners.

The opt-in local proof driver under `tests/whole-path/` is the separate effect
owner for one synthetic lifecycle only. `runSuggestedWaypointWholePath.mjs`
validates the complete safety environment before reading local keys, invokes
the exact `supabase@2.115.0` CLI through Node, offline and without install
(`--offline --no`), uses webpack only for the
junction-backed isolated proof build, starts one loopback production server,
and launches the isolated Playwright owner. The normal live-repository
`npm run build` remains a separate mandatory Turbopack pre-banking gate. The
SQL fixture temporarily
selects the schema-owned 60-second grace value, while browser authority polling
must observe Pull Back become unavailable before the isolated Vitest delivery
bridge can invoke one exact job and replay. Five browser sessions stay in
memory; keys, cookies, traces, screenshots, videos, and raw failures are not
durable. The driver owns bounded child processes, reverse-order teardown,
result cleanup, and the mandatory final reset. It does not start Supabase,
discover or schedule due items, poll continuously, call a provider, deploy,
contact hosted data, or affect real users.

Since login step 6's sub-slice S6-4 the driver's Auth fixture builds the two
cookies the per-request check requires, because no sign-in route writes them
yet. `suggestedWaypointLocalAuthFixture.ts` takes both names from the app's
session-cookie policy for the trusted application origin, gives the auth
cookie name to the Supabase browser client that signs each synthetic role in,
and adds the session-binding cookie holding the UUID of the
`identity.user_session` row that `suggestedWaypointLocalSqlFixture.ts` inserts
for that role. The UUIDs stay with the fixture owner and never reach a
scenario, and a cookie set that the app's shared format check would refuse
fails with a fixed value-free error before any browser exists.
`suggestedWaypointRoleSessionCookies.test.ts` proves without a database or a
browser that the app's real request-auth adapter accepts each role's cookies
and is presented the UUID the SQL fixture inserts for that role. The driver's
own browser run needs the local database and is run only in a watched session.

The Playwright scenario is partitioned into fourteen closed, test-only steps.
Only the selected value-free step ID may cross the scenario boundary after a
failure; raw thrown values, messages, URLs, request bodies, fixture identifiers,
and other protected detail remain internal. The orchestrator preserves that
closed step only after successful teardown. Fixture or cleanup failure continues
to dominate the scenario result so diagnostic precision cannot weaken
containment. Playwright stops after the first failed viewport project and the
outer runner preserves the first exact finite-allowlist category, preventing a
later project or later string from masking the first durable failure. The
non-effectful contract executes the extracted runner regular expression against
all approved and representative rejected categories, pins the exact ordered
step alternation and real wrapper call sites, and directly proves combined
scenario-step and Auth-cleanup precedence.

Guide draft creation adds one narrower diagnostic owner at
`tests/whole-path/suggestedWaypointWholePathGuideDraftDiagnostics.ts`. It
classifies only request failure, non-success HTTP, response parsing, response
contract rejection, the two fixed browser error kinds, and the four permitted
create-draft outcomes. The Playwright scenario converts only that closed class
into a step subclass; arbitrary errors still collapse to the parent step, and
the outer runner independently allowlists the same ten fixed reasons. This
diagnostic layer changes no product route, request, database, or authorization
behavior.

The driver also adds one deliberately inert server-only seam at
`src/lib/solmind/supabase/suggestedWaypointWholePathGuideDraftDiagnostic.ts`
to localize a generic Guide draft denial during the separately governed local
proof. It is reachable only when every exact local proof environment gate,
loopback target, route and method, and the matching run-ID request header are
present. The route still returns the unchanged four-field browser-safe denial.
Only one of ten fixed stage names can reach the outer runner through in-memory
stderr scanning; arbitrary server output is discarded and never forwarded.
This seam adds no persistent telemetry, product capability, authorization,
database behavior, hosted behavior, or ordinary-runtime output.

Before draft creation, the Guide relationship-entry step now has its own narrow
diagnostic owner at
`tests/whole-path/suggestedWaypointWholePathGuideRelationshipEntryDiagnostics.ts`.
It waits for the exact authenticated first-page list response, validates the
existing browser-safe contract, requires the reset-owned fixture to contain no
suggestions, and then proves the corresponding empty Guide UI. Only nine fixed
value-free request, authority, fixture, and UI-projection reasons may cross the
step boundary; arbitrary values collapse to the parent step and cleanup still
dominates. The check adds no product route, response field, database read,
authorization rule, or persistent telemetry.

That step also owns one deliberately inert server-only seam at
`src/lib/solmind/supabase/suggestedWaypointWholePathGuideRelationshipEntryDiagnostic.ts`.
It is reachable only for the exact local proof GET after every environment,
loopback target, route, and run-ID header gate matches. The list route observes
the already-executed principal, auth-context, Guide-role, relationship-load,
relationship-access, and RPC boundaries without changing their decisions. If
the public result remains the unchanged generic denial, exactly one of nine
fixed stage names may reach the outer runner through in-memory stderr scanning.
No protected value, response field, persistent telemetry, product capability,
authorization change, or ordinary-runtime output is introduced.

The S03 Guide entry boundary also owns one feature-specific Suggested Waypoint
relationship selector. Its forward-only migration exposes only active
relationship ID, Explorer display name, relationship creation time, and
pagination through the closed service-role-only
`solmind_list_guide_suggested_waypoint_relationships` function. The direct-
import `suggestedWaypointRelationshipSelectorContract.ts`, executor, and
authenticated request seam validate and freeze that exact projection; the
concrete request factory wires the executor through the same request-scoped
service-role client. This selector is not the canonical Guide Explorer roster
and must never acquire onboarding, appointment, Shared Snapshot, Practice,
suggestion-count, contact, or private Explorer fields.

The first read-only caller lives at:

```text
src/app/guide/waypoint-suggestions/relationships/route.ts
```

It is a thin, dynamic, uncached Route Handler. It accepts validated pagination
only, builds the read-only request-cookie accessor, delegates trusted
actor/role derivation and the database relationship recheck, and serializes
only the fixed selector result. This route and the Guide/Explorer suggestion
list routes expose the same value-free `refresh_required` result for an exact
stale cursor. Their three client owners may retry only a non-first page, once,
with the same page size and no cursor, under the same request sequence,
controller, and timeout. A successful reset clears cursor history; malformed or
operational failure keeps the last safe page; and a current authority denial
clears it. None of those states loops. It does not protect the Guide page, replace
fixture UI, invoke human commands, mutate Suggested Waypoints, schedule
delivery, call a provider, deploy, or activate a real-user path.

Banked dormant `PRJ01_R-WS09-WI021-S02` adds
`applicationSettingReader.ts` as the narrow setting-read boundary. It accepts
no key from its caller, invokes only the fixed service-role RPC, validates the
exact 1-100/default-7/version shape, returns a frozen value, and maps failures
to one value-free sentinel. It is server-only, remains off the shared barrel,
has no browser export, and has no banked application caller.

Login step 6's sub-slice S6-2 adds the session-cookie policy and the
login-step cookie writer that
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
(contract 25, accepted by Paul on 2026-10-04 as AUTH-RLS-DEC-043) Sections 4,
5.2, 6 and 14 describe:

```text
src/lib/solmind/auth/sessionCookiePolicy.ts
src/lib/solmind/supabase/loginCookieWriter.ts
src/lib/solmind/auth/__tests__/sessionCookiePolicy.test.ts
src/lib/solmind/supabase/__tests__/loginCookieWriter.test.ts
```

`sessionCookiePolicy.ts` is pure: it imports nothing, reads no environment
variable and adds no setting. Given the trusted origin in the canonical form
that `loadTrustedApplicationOrigin()` returns, it gives one of two frozen
policies. `https` gives `Secure` and the `__Host-solmind-auth` and
`__Host-solmind-session` names; plain `http` is allowed only on `127.0.0.1`,
`::1` or `localhost`, with no `Secure` and the names `solmind-auth` and
`solmind-session`; any other origin is a configuration failure, so no cookie
is written and sign-in is denied. Every cookie gets `HttpOnly`,
`SameSite=Lax`, `Path=/` and no `Domain`; a session write gets the session's
remaining life, 1 to 3600 seconds, as Max-Age, and a removal gets an empty
value and Max-Age 0. The auth cookie N is split into `N.0`, `N.1`, ... as
the installed `@supabase/ssr` 0.12.0 names chunks, and its PKCE code verifier
is `N-code-verifier`, the key `@supabase/auth-js` 2.108.2 uses once
`cookieOptions.name` sets the storage key to N. The module also holds the
three no-store headers and the one shared Section 14 format check: every
chunk of the auth cookie may hold only A-Z, a-z, 0-9, `-` and `_`, the
value the library would join must start with `base64-`, and the part after
`base64-`, decoded as base64url exactly as the library decodes it, must be
strictly valid UTF-8 (Paul's 2026-10-05 correction of Section 14), or the
auth cookie counts as absent. Since sub-slice S6-4 the check ends with a
field check of the session inside the cookie, described below.

`loginCookieWriter.ts` is server-only and sits beside `requestAuthClient.ts`,
where contract 25 Section 6 places it. It imports neither `@supabase/ssr` nor
any Next.js module: the route's composition root hands it the response
(anything with `cookies.set` and `headers.set`, such as a Next.js response).
At login it takes the cookies the library handed over after sign-in, the
request's cookies, the database's session UUID and the session's remaining
life. It accepts only N and its chunks, and, for removals only, the code
verifier and its chunks. Any other name, a non-empty code verifier, a
repeated name, or writes that are not one complete value (N alone, or `N.0`
to `N.k` with no gap and no N) deny the login with nothing written.
Otherwise it sets the no-store headers first, clears every other auth chunk
and code verifier the request carries (fixation), writes the session chunks
and the binding cookie with the database's session UUID, and never reads the
request's binding cookie. At logout it writes removals only. It plans the
fixed clears of N, the code verifier and the binding cookie regardless of
earlier authentication or provider outcomes, and adds permitted names from
readable cookie lists. Invalid configuration or a malformed call denies
before writing. A response-setter exception can stop the clears partway and
returns `failed`. A removal is always a `set` with Max-Age 0, never the
framework's cookie delete, which drops `Secure`. Results are frozen and
value-free; nothing throws or logs. If the response throws mid-write, the
result is `failed` and the composition root must discard that response.

Since sub-slice S6-8 the Explorer sign-in routes' server composition
calls the login writer `writeLoginSessionCookies` in `loginCookieWriter.ts` only
after the SolMind session exists and the held cookies were released. Its
logout clear writer is called by the guarded logout composition (S6-12),
with the request, cookie-read and trusted-policy prerequisites below. `sessionCookiePolicy.ts` has had a
runtime reader since sub-slice S6-4, the per-request adapter
`requestAuthClient.ts`, which takes the cookie names, the format check and
the accepted cookie's sign-in token from it on every guarded request; since
S6-8 the sign-in routes' dependency factory resolves the policy from the
trusted origin, and their route contract takes the three no-store headers
from it. Both stay off every barrel, and the boundary tests check with
TypeScript's parser that exactly those references exist and that no other
application file references or names either module.
The guarded logout composition (S6-12) now reads the shared cleanup
candidate and uses the owned-cookie clear writer. The Explorer verify
route also uses the candidate reader for its cleanup-only backstop; the
boundary tests enumerate these explicit references. A later new caller
must amend those tests in its own reviewed slice.
The strict UTF-8 step
closes the limit that review #149a confirmed: a value that passed the
character and `base64-` checks could still decode to a code point above
U+10FFFF, and the installed library's decoder then threw an error naming
a number derived from the value, which the library passes to its
warning. The library's decoder throws on no well-formed UTF-8, so for an
auth cookie value the check returns, no decoder exception reaches that
warning; the module's tests show this against the library's own decoder.
That is all the step claims. It does not make the decoded value valid JSON
(the library's separate warning for invalid JSON carries no part of the
value) or the session authentic, and it says nothing about any other cookie
a reader hands to the library. The per-request check (S6-4) applies the
check before any Supabase client exists and hands the library only the
sign-in token of a cookie the check accepted, never the cookie; logout
(S6-12), whose client reads the cookie, is to put the check in front of
`@supabase/ssr` before it reads any auth cookie. The field check that S6-4
adds as the check's last step also refuses a decoded value that is not
JSON, so the library's warning for one is no longer reached for a cookie
the check returns.

Login step 6's sub-slice S6-7 adds the Supabase identity bridge of
contract 25 Section 6 (hold, then write) and
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Section 7.9 (AUTH-RLS-DEC-035):

```text
src/lib/solmind/supabase/loginIdentityBridge.ts
src/lib/solmind/supabase/__tests__/loginIdentityBridge.test.ts
```

`loginIdentityBridge.ts` is server-only, with the runtime browser guard, and
sits beside `requestAuthClient.ts` in the request-auth adapter layer where
contract 25 Sections 5.1 and 6 keep `@supabase/ssr` (AUTH-RLS-DEC-012,
DEC-013 and DEC-019). It imports `server-only`, `@supabase/ssr` and the
server-only `credentialPairProof.ts` owner, with no Next.js module or incoming
cookie accessor. The optional proof loader reads only its dedicated server
key; the route's composition root passes the Supabase URL and anon key, the auth
cookie name N from the same S6-2 policy it gives the writer, a provider
deadline (10 ms to 60 s), a fetch, the link seam (the service-role client's
Auth admin API) and a value-free cleanup-failure signal. The link seam's
client must reach Supabase Auth through a non-logging, non-rejecting fetch
boundary. That is a required precondition and an S6-8 composition gate: the
library logs a rejected fetch's error, whatever it carries, before the bridge
sees the answer, or after the bridge has answered when the rejection comes
after the deadline, and the bridge cannot prevent that. Each sign-in builds
one `@supabase/ssr` server client whose cookie reader returns no cookies and
whose cookie setter only holds, in memory, the cookies the library hands
over after its sign-in event; with no cookies to read, that is the
session's chunks under N and no removal, which S6-2's writer accepts.

For Guides and the Admin, `signInWithPassword` sends the typed email and
password; refused credentials give `credentials_refused` with nothing held.
After the route has redeemed the challenge, the hold's `assertProviderUser`
compares the bound provider user id. For Explorers, after the route's
redemption, `exchangeExplorerLink` asks the link seam for a `magiclink`
link, denies a link made for any other user before any exchange, and
exchanges the link's token hash at once with `verifyOtp` (type `email`).
The answer's user, the session's user, the access token's subject and the
held cookies' access token must agree, or the result is `failed`, and
equal the bound id, or the result is `denied`; either way the bridge
immediately attempts best-effort local revocation of a session that came
back. A link made for another user is `denied` before any exchange, so no
session exists to revoke. `release` hands over the held `{ name, value }`
cookies only after that assertion and when the caller states `created` or
`existing`, a precondition the trusted caller attests. A refused first
release while the hold is pending starts cleanup. Repeated release attempts
return `refused` without another provider operation. A hold is released at
most once.
`discard` drops the held cookies and immediately attempts best-effort local
revocation of that one transient session (`POST /logout` with scope `local`
and the session's own access token); only a successful answer is `cleaned`,
and anything else raises the signal once and still denies.

Each sign-in or exchange is one attempt with its own hold client, transport
and recovered access tokens, so concurrent attempts never share a token.
While the attempt is open, the access token in every answer to its request,
whatever the library then makes of that answer, and in every completed
hand-over is kept, for cleanup only. The attempt gives a hold only when the
library's answer is a well-formed session, the one hand-over carries that
session's token and no other token was recovered; otherwise every recovered
token immediately gets best-effort local revocation, and each failed
revocation raises the signal once. A successful answer read only after the
attempt ended, because it arrived or its body completed after the deadline,
never gives a hold and never reaches a release; its token immediately gets
best-effort local revocation. Cleanup requests are never read for tokens. A
timeout does not establish whether Supabase created a session; if no access
token is ever recovered, revocation cannot be attempted.

`accessTokenExpiresAt` is the access token's `exp` claim, as contract 25
Section 7 sizes the session from the access token's remaining life; the
session's stored `expires_at` must be well formed but does not redefine it.
Every hold-client request goes through its attempt's transport, which bounds
it by the deadline and turns every failure into one fixed 503 answer, so the
library's own logging of a rejected fetch is not reached on these
requests; the bridge waits for the link seam at most the same deadline,
though the seam has no abort. The configuration, dependencies and request
objects themselves are read through own data properties only, so no getter
on them runs; the link seam's `generateLink` and the library's answers are
read as ordinary properties.
Every result except a successful release carries no token, cookie value,
password, email, link token or provider id; a successful release carries
the held cookie values, which contain the tokens. The bridge throws nothing
once constructed, and its own code logs nothing; the installed library keeps
its own logging paths. The bridge makes no direct session-read call, though
the library's initial-session emission still reads the hold's empty storage.

The banked Explorer dependency factory builds the bridge with the link seam
behind its required non-logging, non-rejecting fetch boundary, and Explorer
composition calls `exchangeExplorerLink`. Separate Guide and Admin dependency
factories provide fixed-role password authentication. Keep the bridge
off every barrel and preserve only explicit server-only factory references.
Module-call ownership is not publication or banking evidence; SL-070 in the
execution ledger owns current Guide status.

Login step 6's sub-slice S6-8 adds the two Explorer sign-in routes, the first
application callers of the login modules above:

```text
src/app/login/explorer/send/route.ts
src/app/login/explorer/verify/route.ts
src/lib/solmind/supabase/explorerSignInComposition.ts
src/lib/solmind/supabase/explorerSignInDependencies.ts
src/lib/solmind/supabase/explorerSignInRouteContract.ts
src/lib/solmind/supabase/loginAccountLookupCallers.ts
src/lib/solmind/supabase/loginLinkAdminClient.ts
src/instrumentation.ts
src/instrumentation-node.ts
```

Decided by Paul on 2026-10-07: seven things this section describes. The
record is
`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The
2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)"; each
is option 1 of the item named, in Part 2 of
`solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Morning_Checkin_Packet_2026-10-07.md`.
They are, in each option's words: the two route paths,
"`/login/explorer/send` and `/login/explorer/verify`" (item 3); for the
Explorer home address, "name the new page's address now, `/explorer/home`,
and build the page with the screens" (item 4); for the wait, "a fixed wait
of about one and a half seconds, set from the first local run. Accept the
three limits for the local demo, and record them." (item 5); for a refused
code, "one "code not accepted" result for every refused code, its words
chosen with the screens" (item 6); for the link client, "a second, separate
module used only for that one link request, exposing nothing else" (item 7);
for a missing pepper when the server starts, "the app starts, sign-in is
unavailable, and one fixed line with no value says so" (item 9); and, after
a correct code, "keep the small message naming the fixed home" (item 18),
which is the verify route's JSON answer. Each is marked `DECIDED` in the
code. Paul approved the words shown for `code_not_accepted` on 2026-10-17
(S6-10). Still open: the wait's exact value, which the first local run sets
(the code uses 1,500 ms until then), and actual browser proof of the proposed
Explorer home and connected screens.

Both routes are thin, POST-only, dynamic Route Handlers. Each loads the
trusted origin, runs the same-origin JSON guard before any other work, denies
any query parameter, checks the body shape with an exact-key parser, and
makes one call into `explorerSignInComposition.ts`, which holds both step
orders and imports no Next.js module. Every answer is HTTP 200 with one of a
closed set of results in its JSON body and the same headers: the
session-cookie policy's three no-store headers and
`X-Content-Type-Options: nosniff`. Nothing is taken from the client but the
typed text, the opaque selector and the code: the identifier type `email`,
the role `explorer` and the purpose `login` are literals in the composition,
and a body that carries a role, an account id, a session id, a purpose or a
return address is refused whole.

Configuration first. `explorerSignInDependencies.ts` builds a request's
dependencies before the composition makes its first database call, so a
configuration fault spends no code, budget slot or attempt: the
session-cookie policy; the loopback rule; login step 5's configuration and
composition root; one more service-role client for the two lookup callers
and the session caller; and, for the verify route, the Supabase URL and anon
key, the link client, the identity bridge and the session caller. Any failure
is one fixed, value-free error, and the route answers its generic deny. The
loopback rule is on both routes: the step 5 root always composes the local
development mail transport, for the issuer and the redeemer together, so
both factories refuse a trusted origin whose policy is not the loopback one
before that root is called, and both routes deny on a hosted origin until a
provider adapter exists. A send request builds two clients with the
service-role key (the step 5 root's own and the factory's), both through
`serviceRoleClient.ts`; a verify request builds three, the third in
`loginLinkAdminClient.ts`.

Send a code. The composition fixes the answer time, normalizes the typed
text (not an email: `invalid_email`, with no lookup), builds the
dependencies, and takes a spare selector from the issuing caller with a
fixed, structurally invalid request (an empty object), which that caller
refuses with a fresh UUID, no slot, no database call and no mail. It then
calls `solmind_resolve_login_account` with the type and the Explorer role
fixed. Only for exactly one row does it issue, with both UUIDs and the email
from that row. It never issues with null binding UUIDs, which the banked
issuing caller and the issuance function accept for `login` with no contact
check. From the lookup on there is one exit: the banked acknowledgment with
a selector (the issuing caller's, or the spare one), after the wait. No
answer of the send route sets a cookie.

Verify the code and sign in, in the order of
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Sections 7.1.3 and 7.9: redeem the selected challenge; look the account up
from the typed email with the role fixed; confirm with
`solmind_confirm_redeemed_login_challenge` that the redeemed challenge is
that account's own; run the bridge's Explorer exchange with the looked-up
email and bound provider user id; create the SolMind session once; release
the held cookies, stating the outcome that session call returned; and only
then call the route's function that makes the success response and write
both cookies onto it with `writeLoginSessionCookies`. The route keeps only
the request's cookie names (every value is replaced by an empty string)
for the writer to clear old chunks. From the same guarded read, the route
separately captures a shared-format cleanup candidate containing the old
access token, refresh token and optional pair proof. Only the accepted-login
cleanup closure receives that candidate; it never authenticates the fresh
login or reaches a login account lookup. After independent fresh provider
verification and SolMind session acceptance, bounded cleanup may attempt
only a provably distinct older provider session. Once a hold exists, every exit that is not the success awaits the
hold's `discard` before it answers. A returned redemption `denied` or
`invalid_request` is `code_not_accepted`; every other failure is the generic
deny; the success names one server constant as its destination.

The wait and its limits. The composition takes a clock and a waiter as ports
and asks the waiter for one fixed floor (1,500 ms), measured from
composition entry and not from the request's arrival: on the send route for
every exit from the account lookup on, and on the verify route for every
exit from the redemption call on except the success. Earlier refusals do not
wait; waiter failure can return early. It is a floor, not equal timing. It
does not hide a send that runs longer than the floor, slowness someone
creates by flooding the send route, or the shared pool of four issuance
slots. The tests prove the answer time the code asks for, with a fake clock
and counted calls; they do not measure what an observer sees.

What a failure can leave. No cookie reaches the browser on any failure.
Cleanup of the transient Supabase session is attempted and can fail; a failed
cleanup writes one fixed, value-free line through the bridge's signal and
never changes the deny. A code is spent by any failure after it was
redeemed. After the session call answered, the new session row exists and
the account's earlier session has ended, also when the release or the writer
then fails; no application code ends that session; a later sign-in of the
same account supersedes it, and otherwise it ends by itself within the hour.
Paul decided on 2026-10-07 to "accept it for the local demo, and record it"
(the morning check-in packet's item 8, option 1; the record is
`solmind-sprints/PRJ01-SPR001/Decision_Queue/Current_Action_Queue.md`, "The
2026-10-07 check-in: answered (first seen by the 11:30:10 clock read)").

`loginAccountLookupCallers.ts` holds the two lookup callers: one fixed
function name each, a narrow RPC seam, a caller response deadline, frozen
results, no retry and no log. `loginLinkAdminClient.ts` builds the one client
the bridge's link seam uses: a service-role client whose fetch never rejects
and never logs (a failed request becomes one fixed 503), handing out only
`generateLink`. It is the composition gate the bridge's precondition names,
and it adds no deadline of its own. `explorerSignInRouteContract.ts` holds
the body parsers, the closed results, the fixed destination and the response
headers.

The startup check. `src/instrumentation.ts` exports `register`, which in the
Node.js runtime only imports `src/instrumentation-node.ts` and runs
`checkLoginVerificationConfigurationAtStartup` once. A failed check writes
one fixed, value-free line and the server keeps starting; with no usable
pepper the two routes then deny, because their configuration load fails. A
hook that could not load or run the check writes a different fixed line.

The five lib modules and the Node.js half of the start hook begin with the
`server-only` import; all nine files are direct-import only and stay off
every barrel. The banked connected Explorer layer below calls the two
routes (S6-10) and shared logout route. Separate connected Guide and Admin
owners below compose their fixed request routes and screens.
The five boundary tests that guarded the login modules as dormant now assert
the exact list of references these files add.

Supabase code should not expose service-role credentials through client-accessible variables.

Never put service-role keys or bootstrap tokens in `NEXT_PUBLIC_*`.

S01 does not import or call Supabase.

## Prepared Guide/Admin and Explorer browser boundaries (2026-10-16)

This dated section describes dormant, unbanked components under the accepted
[solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_S69_Design_Brief_2026-10-08/DESIGN_BRIEF_R04.md](../../solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Login_Step6_S69_Design_Brief_2026-10-08/DESIGN_BRIEF_R04.md). The old component reviews remain source-only history. Explorer/logout are now
banked as SL-069; combined Guide evidence/publication status is owned by SL-070.

The server-only `solmind-app/src/lib/solmind/supabase/passwordRoleSignInBodies.ts`
reads exact fixed-role raw-string bodies. The pure
`solmind-app/src/lib/solmind/auth/adminLoginIdentifierNormalizer.ts` owns Admin
email/username dispatch and the approved username allowlist; it changes no stored
name, schema or bootstrap. Guide email handling and raw passwords stay unchanged.
The server-only `solmind-app/src/lib/solmind/supabase/passwordRoleSignInCore.ts`
has four fixed Guide/Admin send/verify entrypoints and stays off shared barrels.
No request supplies role, purpose, account, session, duration or destination authority.

Send prepares the issuing caller's harmless spare acknowledgment before lookup,
then uses only the eligible lookup's stored sign-in email and paired account/contact
identities for at most one issuance. Later refusal, throw or floor-wait failure
retains the prepared acknowledgment rather than exposing the failing stage.
Verify follows eligible lookup, exact ownership, password authentication into a
private hold, code redemption, provider-user assertion, same-account redeemed
confirmation and session creation. Ownership is before password and wrong password
does not redeem. The separate fixed `solmind_check_login_challenge_owner` read in
`solmind-app/src/lib/solmind/supabase/loginAccountLookupCallers.ts` checks the
challenge/account/contact-account join; it does not duplicate eligibility,
redemption or freshness, mutate a row/audit, or widen the seven-function
`solmind-app/src/lib/solmind/supabase/serviceRoleRpcExecutor.ts` allowlist.

After an accepted `created` or `existing` SolMind result, the corrected core
targets the logout R03 bridge's five-field hold, including
`prepareAcceptedSession`. Preparation precedes release, preserves the actual
session outcome, and reduces cookie lifetime for measured elapsed time and the
remaining provider-token lifetime. Invalid clocks or nonpositive lifetime refuse
completion. Every held failure awaits discard and discards any partial success
response. Common pre-factor `not_matched` and the configured response floor
cover lookup through same-account factor confirmation; earlier boundary/configuration
and handled post-factor completion failures remain `denied`. The floor is a
mitigation, not constant-time authentication; waiter failure preserves the chosen
refusal. Fresh credentials stay private to the hold. Previous-cookie cleanup
capability belongs in the identity/dependency layer, never core authentication
input; no old-credential cleanup or production factory is added by this core.

The injected ports are trusted executable dependencies. The core does not bound
arbitrary hanging code, prove cancellation of remote effects, or roll back an
already committed session. Concrete deadlines, safe transport and bounded cleanup
come from the concrete production dependencies. Current combined assurance
and Guide publication/banking status are owned by SL-070 in the execution ledger.

`solmind-app/src/lib/solmind/supabase/passwordRoleSignInRouteContract.ts`
describes `/login/guide/send`, `/login/guide/verify`, `/login/admin/send` and
`/login/admin/verify`, with fixed `/guide/home` and `/admin/home` destinations.
The constants/types themselves implement no route, protected page or cookie
publication. Separate Guide and Admin connections compose their fixed subsets;
prototype-role route constants are unchanged. Handler outcomes
share the declared status/headers; only a complete accepted success may carry
the login writer's cookies. R04 actual Guide wire observations and their success-body capture limit are recorded in the execution test catalog.

The separate Explorer browser-safe owners are
`solmind-app/src/lib/solmind/signInBrowserContract.ts`,
`solmind-app/src/lib/solmind/explorerSignInBrowserTransport.ts` and
`solmind-app/src/lib/solmind/explorerSignInFlowController.ts`.
They preserve raw inputs, fixed paths and closed replies, bounded request/response
bodies, an explicitly supplied response budget, and a private selector with
generation invalidation before abort. Stale completions cannot publish current
state. Cancellation ends local waiting only; it proves no remote rollback or
absence of a session/cookie effect. They add no retry, DOM navigation, browser
storage, operational timeout default or connected preview. Additional UI source
authoring remains separate; combined Explorer refusal wording and usable expiry
behavior belong to their separate connected owners. Exact test ownership and
dated completed/remaining SQL/provider/wire/browser/timing evidence are in [solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md).

## Connected Explorer request and view boundaries (2026-10-16)

Explorer connection is banked as SL-069 on October 20; its dated actual proof
and limits remain in the execution ledger. Preserve password-role, ownership
and logout boundaries. Earlier components retain source-only historical scope.
Connected Guide below has its separate composition; /explorer stays independent.

`solmind-app/src/components/solmind/LoginExperience.tsx` owns A1 role selection.
`solmind-app/src/app/login/page.tsx` mounts it normally;
`solmind-app/src/app/login/explorer/page.tsx` supplies `initialExplorer` for fixed
re-entry. Connected Guide and Admin supply their own fixed entry pages and
separate SignIn components. Standalone `solmind-app/src/components/solmind/SignInPreview.tsx`
callers retain optional `initialRole`/departure props, in-memory behavior and
prohibitions. The Explorer branch supplies browser fetch,
an explicit 60000ms local wait, value-free status rendering and fixed
`location.replace('/explorer/home')` only after current accepted success. No
query return URL, role selector or credential enters navigation. The existing
`solmind-app/src/components/solmind/ExplorerSignIn.tsx` owns private drafts,
selector/generation invalidation and commit-time departure cleanup.

`solmind-app/src/app/explorer/home/page.tsx` is dynamic server-only request
composition, not a client redirect guard. It reads the raw Cookie header with
bounded framing (16384 characters, 128 pairs), preserves duplicate names and
exact values, and rejects malformed framing without URI decoding or merging.
The installed Next cookie collection normalizes through a Map and cannot supply
that ambiguity evidence. A read-only accessor feeds
`solmind-app/src/lib/solmind/auth/explorerHomeAccess.ts`; trusted server code fixes
`/explorer/home` in `solmind-app/src/lib/solmind/routeAccess.ts`.

The access owner constructs the actual direct-token principal source and narrow
record source, then calls the current composer. Cookie format, platform identity,
active account/role/session, selected-session binding and Explorer route access
must all pass. Final expiry must be strictly after a fresh finite server clock
observation. Only `{ allowed: true, expiresAt, observedAt }` or the opaque
`{ allowed: false, reason: 'route_access_denied' }` leaves this seam. The page
passes only the two times to the home, never account/provider/profile/session IDs
or credentials. Missing, expired, superseded, ambiguous, wrong-role or failed
checks render S2 without protected children. A missing profile alone introduces
no new authentication-shell eligibility gate. GET performs no refresh, cookie
clear, logout or audit write. Inherited direct-token network-deadline limitations
remain; the new seam does not bound an arbitrary never-settling dependency.

`solmind-app/src/components/solmind/ExplorerHome.tsx` consumes that time projection.
Its private view lifetime owns logout and timers. `solmind-app/src/lib/solmind/logoutBrowserRequest.ts`
issues only same-origin POST `/logout`, no query, JSON `{}`, no-store,
same-origin credentials, redirect refusal and one owned cancellation signal.
The explicit browser wait is 30000ms and the complete response is bounded to
1024 bytes. Only the closed current `signed_out` result shows S1; refusal,
malformed/missing/late answers and local failure show honest SM-OUT-01 uncertainty.
No retry, browser cookie deletion or claim of provider rollback/administrator
notification follows. Server outcome and safe clearing remain owned by the
logout composition; client cancellation establishes only local abandonment.

`solmind-app/src/lib/solmind/explorerLoginJourney.ts` owns value-free copy and
advisory expiry. The browser uses trusted expiry/observation plus a wall/monotonic
high-water elapsed clock, warns within five minutes and shows S2 at apparent
expiry. Invalid time fails closed; resumed/cached pages require a fresh request.
The timer neither grants authority nor extends/revokes a server session. S1/S2
offer only `/login/explorer`. Stay signed in remains a later accepted amendment,
not a button or renewal route in this component. Paul approved the sign-in and
finite-session reminder wording on 2026-10-17; the exact messages are recorded in
`solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`,
under Explorer screen copy approved - 2026-10-17.

All text rendering is value-free and ordinary React text. Credentials stay out
of URLs, logs, storage and home props. Static rendering, fake fetch and direct
binding tests do not exercise mounted React or a real browser. Exact planned
coverage and unperformed proof are in
[solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md](../../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md#connected-explorer-proof-plan-2026-10-16).

## Logout and credential-pair provenance boundary

`src/app/logout/route.ts` is a thin dynamic Node.js POST handler. Under
`src/lib/solmind/supabase/`, `logoutRouteContract.ts` owns the exact empty-JSON,
no-query request and closed outcomes; `logoutComposition.ts` owns ordering and
safe clearing; `logoutDependencies.ts` constructs independent database/provider
capabilities; `userSessionLogoutCaller.ts` calls only
`solmind_logout_user_session(account, presentedSession)` once; and
`logoutProviderSignOut.ts` owns bounded explicit-token local cleanup. These
server-only owners stay off shared/client barrels. No request body supplies
account, role, session or redirect authority. The Explorer and Guide homes call this route through their closed browser boundaries.

The same-origin JSON guard precedes the one cookie read. Only a readable
cookie list and trusted policy permit `writeLogoutSessionCookieClears` to clear
the auth and code-verifier families plus binding, preserving remembered-browser
cookies. Later malformed request shape or missing backend settings still reaches
safe clearing, with no unauthorized remote work. A fresh denied response replaces
any partially written response. Only a strict database `ended`/`already_ended`
answer plus successful clears yields `signed_out`; other completed clears yield
`sign_out_unconfirmed`. Provider failure cannot undo confirmed SolMind termination.
A suspended account or superseded session does not need application access to end
its identifiable presented session; the current-session access guard stays strict
on every protected read/write. Never substitute the account's current session.

`credentialPairProof.ts` owns optional HMAC-SHA256 pair provenance. Its server key
`SOLMIND_CREDENTIAL_PAIR_PROOF_KEY_BASE64` is documented without a value in
`.env.example`. Only the identity bridge can mint from a trusted fresh provider
response after account assertion and SolMind acceptance; logout receives only
verification capability. The proof binds the exact access/refresh bytes, issuer,
audience, account, provider-session UUID, expiry, trusted origin and auth-cookie
name. It is the `solmind_pair_proof` property inside the existing encoded auth
session, not a new cookie family or an authentication grant. The bridge rechunks
the augmented session before the cookie writer publishes it with the binding.
The 32,768-byte encoded-session cap and normal hold/release failure handling apply.
The pure `readSessionAuthCookieCleanupCandidate` uses the shared format check and
returns only a captured candidate; it does not verify a proof or grant authority.
Legacy/malformed/missing proofs do not invalidate ordinary independent auth checks.

Missing/invalid key configuration disables minting and proof-authorized renewal;
no key is created or substituted. Suitable existing-token cleanup remains possible.
A renewal requires a valid exact-pair proof before dispatch, then independent
verification of matching renewed identity. Explicit `scope=local`, no retries,
no global/others scope, bounded bodies/deadlines and a non-rejecting sanitized
transport prevent widening the operation. Timeout/abort does not prove cancellation.

The Explorer verify route captures prior credentials before fresh authentication.
After fresh identity assertion and SolMind acceptance,
`prepareAcceptedSession` invokes the optional cleanup backstop before release.
Only a verified same-account, distinct older provider session is eligible; the
backstop never renews, enumerates sessions, writes cookies or receives a fresh
credential/discard capability. Insufficient release budget skips it. The identity
hold owns at most one best-effort report attempt for failed prior-session cleanup,
including its own deadline; late completion cannot emit a second report. The
separate fixed line `solmind_login_prior_session_cleanup_failed` contains no values
and makes no administrator-notification claim. Reporting failure cannot change
fresh login. Release rechecks expiry and the composition reduces Max-Age for
elapsed time. Existing cleanup of a failed fresh login and its separate
`solmind_login_identity_cleanup_failed` signal remain unchanged. Server target isolation
does not solve competing Set-Cookie responses in one browser; future UI operation
coordination and watched browser/provider/database evidence remain required.

These are implementation controls for the accepted October12 behavior, not new
product decisions. The owning contract is
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
Section 9; test ownership and assurance limits are in
`../solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` Section 7.2.

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

S01 does not assemble AI context. Its non-live Guide projection is a pure
visibility-boundary function, not a prompt-context function.

`PRJ01_R-WS09-WI021-S03A` adds one provider-free Explorer-safe context kernel:

```text
src/lib/solmind/context/explorerSafeContext.ts
src/lib/solmind/context/__tests__/explorerSafeContext.test.ts
```

The module is server-only, is imported directly by later server composition,
and must remain off `src/lib/solmind/context/index.ts`. It accepts one unknown
runtime envelope, validates exact keys and Virtual Guide/Explorer bindings,
projects the canonical nine layers into a new fixed-key deeply immutable
object, and returns its compact deterministic JSON serialization. It may reuse
only the pure role-alignment and Explorer-eligibility owners in this directory.
Summary continuity is eligible only through the exact banked publication
projection: a published Summary container, a target-bound published
publication, an active or paused Guide-Explorer relationship, a
`published_to_explorer` revision, and an `explorer_facing` section whose
visibility is `published_to_explorer`. Container type or status alone never
authorizes inclusion. Co-located cross-contract tests pin the accepted Summary
and relationship vocabulary to the owning migrations.

This boundary is not a provider prompt or complete orchestration service. It
must not import React/client code, routes/actions, repositories, Supabase,
provider adapters, environment owners, browser state, Guide/Admin/safety
repositories, or the S01 Explorer browser-memory prototype. Source retrieval,
authorization/consent refresh, context snapshots, audit/fingerprint runtime
enforcement, context budgeting, provider dispatch, persistence, route/UI
integration, deployment, and real-user use remain separate gates.

`PRJ01_R-WS09-WI021-S03B` adds one provider-neutral conversation boundary:

```text
src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts
src/lib/solmind/virtual-guide/__tests__/virtualGuideConversationContract.test.ts
```

The module is server-only, is imported directly by later server composition,
and must remain off every shared/client barrel. It accepts only the exact compact
serialized context already authorized by S03A together with opaque invocation,
Explorer, session, context-snapshot, and fingerprint identifiers. It validates
exact request keys and byte limits, creates a frozen copy, invokes one injected
transport with bounded timeout and caller cancellation, then validates an exact
invocation-bound response and returns a deeply immutable copy. Its closed error
algebra carries no provider or request values. Co-located tests use an in-memory
fake transport and prove that malformed input never reaches that seam.

S03B neither selects nor calls a concrete provider by itself. It does not load
context sources, refresh authorization or consent, create or verify the context
fingerprint, read environment configuration, import a provider SDK, persist or
audit messages, expose a route/action, connect S01R2, deploy, or affect a real
user. Fake transport behavior is test-only and must never become a production
fallback. Those responsibilities remain separately gated later S03 increments.

`PRJ01_R-WS09-WI021-S03C` adds authorized context composition:

```text
src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts
src/lib/solmind/virtual-guide/__tests__/authorizedVirtualGuideContext.test.ts
```

This direct-import server-only owner accepts only server-issued invocation,
Explorer, session and context-snapshot identifiers. Its injected source exposes
exactly one authorization-snapshot load and one minimized version revalidation;
the functions are descriptor-checked and captured before the first await. The
composer independently proves self-Explorer actor/account binding, Explorer
role context, active onboarding, adult affirmation, an active or paused
relationship bound to the Explorer, and exact equality between non-empty active
required-consent IDs and accepted IDs. It then runs S03A, requires the resulting
Explorer/session binding, hashes the exact compact serialization with SHA-256,
revalidates the minimized authorization proof/version, and returns a frozen S03B
request. Ineligible continuity is omitted by S03A; prompt-injection text remains
data and cannot add context keys or source capabilities.

S03C's revalidation is not final dispatch authority. It has no concrete
repository or database loader, does not persist the context-snapshot ID, does
not create S03D pre-I/O evidence, and does not own provider/model selection,
credentials, provider I/O, logging/audit, route/action, browser/UI code,
deployment or real-user activation. Later server composition must derive its
request identifiers and supply the reviewed concrete source; S03D must recheck
and record the required evidence immediately before any provider effect.

`PRJ01_R-WS09-WI021-S03D` adds the protected pre-dispatch evidence boundary:

```text
supabase/migrations/20260924000000_virtual_guide_predispatch_evidence.sql
supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql
supabase/tests/virtual_guide_predispatch_evidence_contract_and_security_test.sql
supabase/tests/virtual_guide_predispatch_evidence_realpath_test.sql
supabase/tests/virtual_guide_predispatch_evidence_hardening_test.sql
supabase/tests/virtual_guide_predispatch_evidence_concurrency_test.sql
```

The service-role-only, security-definer function revalidates the current
Explorer account/role, one of the three Explorer session types, session status,
Explorer profile/onboarding, relationship/Practice binding, single-Guide
topology (no other current Guide relationship), restricted-mode state,
active/approved Practice and Organization, adult affirmation and complete
active required-consent set immediately before evidence creation. Every
authority and exact-retry comparison is null-safe. It locks the reviewed
authority rows and stabilizes the required-consent definition, recomputes an AV1
proof over those current facts,
then atomically creates one bounded context snapshot, one started invocation and
the exact two value-free Family E lifecycle rows. Advisory serialization,
unique operation/snapshot indexes and a 2-second lock timeout make the boundary
bounded and idempotent. Exact retry is retained evidence with an explicit
no-dispatch disposition; a changed payload under the same operation, or a
snapshot or invocation identifier already used by another operation, fails
closed, normally as `operation_conflict`; a racing reuse can instead end in
the 2-second lock timeout, and a check that runs earlier (for example stale
authorization) reports its own error first.

S03D does not load the S03A sources, call S03E, persist conversation messages,
select a credential, expose a route/action, own the safety response, deploy or
activate a real-user path. `exact_retry` must never trigger a second provider
call.

The database recomputes and verifies only the AV1 authority proof. It does not
verify the context fingerprint, the context source IDs, or their ownership;
the server caller attests them. The rule that derives the context source IDs
is still an open composition gate, because the S03C result exposes no
source-ID set. A `created` result is therefore necessary but not sufficient
for a provider attempt. An S03D v1 context snapshot is write-once by contract
(no update path or role grant exists; the database does not block an
owner-level update) and leaves
the Methodology Context Pack version, typed source IDs including
`related_reflection_ids`, and policy/behavior versions empty; the snapshot
fields required by `solmind-docs`
`execution/04_SolMind_AI_Orchestration_Spec_v1_0.md` Section 12, plus an S03E
instruction version, must be recorded at creation by a separately reviewed
successor evidence contract, and v1 evidence alone never authorizes an
Explorer-facing dispatch. Later composition must also bind the dispatched
bytes to the stored fingerprint. Any outcome other than `created`, including
`exact_retry` and every denial, authorizes no provider call.

`PRJ01_R-WS09-WI021-S03E` adds a dormant Luna-specific transport adapter:

```text
src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts
src/lib/solmind/virtual-guide/__tests__/openAiLunaVirtualGuideTransport.test.ts
```

The adapter is a direct-import server-only implementation of the single S03B
transport capability. It fixes one HTTPS Responses endpoint, model
`gpt-5.6-luna`, medium reasoning effort, `store: false`, fixed Virtual Guide
instructions and a bounded output request. It passes only the exact S03B
authorized-context string as input. The credential and `fetch` capability are
captured from later server composition; the module cannot read environment
state and accepts no endpoint/model/instruction/tool/storage override. Redirects
are denied. HTTP/provider failures, provider bodies and credentials collapse to
value-free transport failure at S03B. The response must be completed by the
selected model, contain exactly one assistant message and no tool output; one
provider refusal maps to fixed Explorer-facing text before S03B validates the
final local envelope.

This adapter is not runtime activation. It does not create S03D snapshot/
invocation/audit evidence, select an operational credential, expose a route,
persist conversation messages, own safety escalation, connect the UI, deploy or
affect a real user. Tests use fake HTTP and a deterministic message-ID function.
No real OpenAI request is made by this slice.

## Schema Foundation Boundary

Database schema foundations live under:

```text
supabase/migrations/
```

The MVP0 schemas and tables are banked through migrations, with Row Level Security enabled deny-by-default on application tables. Permissive or role-aware RLS policies, grants, and runtime access enforcement remain deferred. Do not add policies, grants, or schema changes without a Database/Supabase workflow slice and approval. The authoritative Auth/RLS banked-vs-deferred status is `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`.

The banked dormant S02 protected-setting foundation adds one deny-by-default
`core.application_setting` singleton and two purpose-built service-role-only
functions. The mutation serializes the singleton, checks expected version, and
embeds the exact
`../solmind-docs/execution/22_SolMind_MVP0_Auth_RLS_Audit_Persistence_Contract_v0_1.md`
Family F row in the same transaction as an actual change. The audit payload is
closed and typed: no free-form caller reference or reason can enter the
database. Same-value/current-version requests and exact already-applied retries
are writeless; any request-field mismatch, stale version, unknown token, lock
failure, or audit failure fails closed.

The banked dormant DEF5-S3 issuance foundation keeps the database boundary narrow: `public.solmind_issue_verification_challenge` is a service-role-only, purpose-built `SECURITY DEFINER` operation over `identity.verification_challenge`, `identity.contact_method`, and the exact Family B `audit.audit_event` row. Its partial unique index independently limits each normalized-contact/purpose pair to one structurally open challenge. It does not authorize a route, delivery provider, invitation acceptance, session creation, self-signup, Guide assignment, or rate-limit implementation. The outer app/route layer must establish invitation or self-signup eligibility before calling it. The resend and lockout controls (AUTH-RLS-DEC-037) are implemented inside the same function by `supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql` (login step 2, app `05884ed`); Explorer and connected Guide fixed send compositions reach it through login step 5's shared issuing caller, for a loopback trusted origin only; Admin remains inactive. Its stored comment still says no runtime caller or real-user path may use it until separately gated. Paul's go-ahead of 2026-10-04 for step 6's login writes, for local synthetic work only (no real users, no cloud; AUTH-RLS-DEF-011), is read as that gate; it is recorded in `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`, "Paul's Acceptance (2026-10-04)" and Section 1. The stored comment stays as written, because this slice changes no migration; a later database change can update it.

Login step 4 adds the server-only, provider-neutral verification-code
delivery boundary that
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
section 7.1.3 describes, and a local development transport for it:

```text
src/lib/solmind/auth/verificationCodeDelivery.ts
src/lib/solmind/auth/localSmtpVerificationCodeDelivery.ts
src/lib/solmind/auth/verificationCodeEmailWording.ts
src/lib/solmind/auth/__tests__/verificationCodeDelivery.test.ts
src/lib/solmind/auth/__tests__/localSmtpVerificationCodeDelivery.test.ts
```

The delivery boundary is direct-import only and stays off every barrel. It
accepts only an `issued` outcome from
`public.solmind_issue_verification_challenge`; `denied` or any other value is
refused with a fixed error. That check is a trusted-caller precondition, not
proof that a challenge committed. The boundary checks every field, rejects
unknown keys, and returns an opaque handle that serializes to `{}`. It calls
one injected transport's `send` at most once per prepared handle, within an
elapsed-time ceiling that the caller sets between 10 ms and 15 s, and has no
fallback transport. Its limits are a retry ceiling of 0 and one send per
prepared handle: a handle cannot be delivered twice, but two handles prepared
with the same challenge and code are two sends. A retry is never a resend of
the same code: under AUTH-RLS-DEC-033 it is supersede-and-reissue, a new
issuance that spends budget under AUTH-RLS-DEC-037. The outcomes form a
closed set: `accepted`, `delivered`, `bounced`, `throttled`, `ambiguous`,
`timeout`, `retryable_failure`, `terminal_failure` and `cleanup_failure`,
each returned as a frozen, value-free `{ outcome }`. The boundary meters no
spend and passes through whatever closed outcome the transport returns.
Before the ceiling, a transport that throws, rejects or returns anything
outside the set gives `ambiguous`. When the ceiling is reached, the boundary
aborts the transport and gives it one turn of the event loop to report. Only
the literal `ambiguous`, or a rejection, which counts as `ambiguous`, can win
in that turn; anything else, including a value outside the set, or no
answer, is `timeout`, so no success is ever reported after the deadline.
`timeout` is treated like `ambiguous`: either way the code may or may not
have been sent, and neither is retried.

The boundary does not generate a code and holds no verifier, pepper or
credential; the plaintext code stays only in memory until its one attempt. It
writes nothing to a database, audit table or log, reads no environment
variable, and does not reveal whether an account, invitation, contact or role
exists. Mapping outcomes to the outward response belongs to the future caller.

The development transport emails the code to the local test mailbox over plain
SMTP, using Node's built-in `node:net` and no new dependency. Its host, port,
sender, wording and timeout (10 ms to 15 s) are required settings with no
defaults, and it reads no environment variable. The host must be exactly
`127.0.0.1` or `::1`; `localhost` and every other name or address are refused.
It uses no AUTH or STARTTLS. The email's sender, subject and body live in
`src/lib/solmind/auth/verificationCodeEmailWording.ts`; the transport takes
them as required settings with no defaults. They must be printable ASCII, and
the code token must appear exactly once in the body and never in the subject.
The message is sent as 7bit `text/plain; charset=us-ascii`, and every body
line that starts with `.` is dot-stuffed. One overall deadline covers
connecting, every reply and the message. Before the message is written, a
4xx reply or a refused or dropped connection is `retryable_failure`, a 5xx,
unexpected or malformed reply is `terminal_failure`, and a timeout is
`timeout`. Once the message bytes start to be written, a 250 reply is
`accepted`, never `delivered`, because it shows only that the local mail
server took the message. Every other reply after that point, including 4xx
and 5xx, is `ambiguous`, because a failure reply does not prove that the
server did not queue the message; a lost, late or unreadable reply is
`ambiguous` too. When the boundary's ceiling aborts it, the transport reports
`ambiguous` if the message had started and `timeout` if not, and the
boundary keeps that result. The transport's spend ceiling is 0, because the
local mail catcher costs nothing. An SMS request returns a fixed
`terminal_failure` without touching the network, because SMS is disabled
locally. Results and errors never contain the code, the contact, the
challenge id or any server reply text.

Four obligations fall outside this step. The login step 5 caller must bind
each delivery to its own issuance answer, and its unit tests must prove that
ordering (the answer comes before the delivery); that the database commits
before it answers (commit before answer) remains for the separately gated
database proof. It must prepare exactly one delivery per issuance answer,
keep no copy of the code, and reach the transport only through
`deliverVerificationCode`, never by calling the transport's `send` directly,
because duplicate suppression here is per prepared handle only. The step 5
composition root must bound how many sends run at once. A future provider
adapter must state and prove its own spend ceiling and delivery proof, with
its own idempotency, retry and elapsed-time limits, before it is activated.

Only login step 5's callers and composition root, described next, import the
three modules. Since login step 6's sub-slice S6-8 the Explorer sign-in
routes call that root, for a loopback trusted origin only, with the settings
of sub-slice S6-1; nothing else composes them. The
boundary tests use injected fake transports and the transport tests use an
in-process loopback server; none of them touches the local Supabase stack or
its mail catcher.

Login step 5 adds the server-only code module, the issuing and
redeeming callers (a restricted core and a public module), and their
composition root:

```text
src/lib/solmind/auth/verificationCode.ts
src/lib/solmind/auth/verificationChallengeCallersCore.ts
src/lib/solmind/auth/verificationChallengeCallers.ts
src/lib/solmind/auth/verificationChallengeComposition.ts
src/lib/solmind/auth/__tests__/verificationCode.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeIssuance.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeRedemption.test.ts
src/lib/solmind/auth/__tests__/verificationChallengeComposition.test.ts
```

The four modules are direct-import only, stay off every barrel, start with
`import "server-only";`, and read no environment variable of their own.

`verificationCode.ts` generates the six-digit code with Node's `randomInt`,
uniformly from 000000 to 999999, and the challenge UUID with `randomUUID`.
It computes the AUTH-RLS-DEC-032 verifier exactly as the register fixes it:
`svf1:` followed by 64 lowercase hexadecimal characters of HMAC-SHA-256,
keyed by the pepper, over the ASCII fields
`solmind-verification-challenge-svf1`, the lowercase canonical challenge
UUID, the purpose and the code, joined by the byte 0x0A. Its tests reproduce
the register's known-answer verifier and the verifiers that the banked
redemption pgTAP fixtures store. Every input check is a whole-string match:
an uppercase UUID, or any value with a final line terminator (LF, CR, CRLF,
U+2028 or U+2029), is refused before any HMAC, and tests pin this, pairing
each refused value with its otherwise identical accepted request. The
pepper, at least 32 bytes, is held as a Node `KeyObject` behind an opaque
handle that serializes to `{}`. The module compares no verifiers: the banked
redemption function's byte-exact comparison is the only one, so the app adds
no second verification authority.

`verificationChallengeCallersCore.ts` holds the two callers. It is a
restricted module: its factories take the slot pool as a separate argument,
so only `verificationChallengeCallers.ts` and three named unit-test files may
import it, which a boundary test checks with TypeScript's own parser, as the
provider-probe harness does for its restricted modules. Each caller reaches
the database only through an injected RPC seam, which the service-role
client satisfies, and calls exactly one fixed function; neither accepts a
function name. The issuing caller picks a fresh challenge UUID for every
request (the one exception: if Node's `randomUUID` ever failed, the result
would carry the fixed nil UUID, which `randomUUID` never issues). It checks
the request against the issuance function's own rules, takes an issuance
slot, generates the code, computes the verifier, and calls
`public.solmind_issue_verification_challenge` once under a caller response
deadline: the time the caller waits for an answer, not a limit on the call
itself. Before the call it records that deadline on a monotonic clock
(`performance.now()` plus the configured limit) and arms a timer that aborts
the call's AbortSignal at that time, which requests cancellation through
`fetch`. The deadline is checked when the answer settles, so an answer whose
callback runs late, even before the timer could fire, is late; it is checked
again just before a delivery is prepared. Only a timely answer of exactly one
row `{ outcome: "issued" }` is treated as an issuance; then, and only then,
the caller prepares exactly one delivery for it and hands it to
`deliverVerificationCode`, never to the transport directly. The code is kept
only for that single local delivery attempt; this is not a claim that memory
is erased. A `denied` row is `denied`; the function's fixed
`solmind_issue_ineligible_contact` and `solmind_issue_invalid_binding` errors
are `ineligible`; anything else, including a late or lost answer, is `failed`
and delivers nothing. There is no retry. Every result carries the request's
UUID, which names a challenge only after `issued`, so every outcome maps to
one generic outward acknowledgment of one shape. The redeeming caller takes
the purpose the route fixes and the client's selector and code, refuses a
malformed one without a database call, takes a redemption slot (`busy` if
none is free), computes the verifier, calls
`public.solmind_redeem_verification_challenge` once under the same kind of
caller response deadline, and returns `redeemed` (only for a timely answer that is still
before the deadline when it is accepted), `denied`, `busy`, `invalid_request`
or `failed`. Results are frozen and value-free: they never hold a code,
verifier, pepper, contact or database error text, and nothing logs.

An `issued` or `redeemed` answer is the database function's own answer. It
shows committed database state only if four things hold, and they must be
proved before these callers are used against any database: PostgREST runs
the call at READ COMMITTED isolation; each call is its own transaction, begun
just before the function runs and not given a `transaction_timeout` above 60
seconds; that transaction commits before the answer is sent; and no layer
replays the POST. The composition tests prove the last point for the client
layers, for both callers: postgrest-js 2.108.2 sends one POST and does not
retry it after a network error or a 503 or 520 answer. Node's own `fetch` and
the first three points need a local database run, which needs Paul's
AUTH-RLS-DEF-011 approval.

`verificationChallengeCallers.ts` is the public module. It owns two slot
pools: four issuance slots shared by every issuer and four redemption slots
shared by every redeemer built through it, by any root. Its factories take
no pool, refuse a dependency object that carries one, and pass their own
pool as the separate argument. The parser-checked `src` references show that
this public module and three named unit tests are the only literal importers
of the core: the issuance and redemption tests, which pass test pools to the
core's caller factories, and the composition test, which exercises its slot
factory. So no caller built through these public factories can supply a pool,
and no parser-checked `src` reference outside the public module and those
tests reaches the core. Reflective loading (`createRequire`, `module.require`
or the `Function` constructor) is beyond those source checks and could still
reach the core's exported factories. A caller takes
a slot before its database call and gives it back only when that call has
settled (and, for issuance, when the delivery boundary has returned), even
when the deadline decided the outcome earlier. The bound proved is therefore:
per loaded copy of this module in one server process, at most four issuances
(each a database call followed by at most one delivery attempt through the
delivery boundary) and at most four redemption calls are in progress at the
client at any moment, for every caller built through the public factories,
whichever roots built them. This meets login
step 4's duty that the step 5 composition root bound how many sends run at
once: the root takes no pool, and every root's callers draw on these pools.
A call that never settles holds its slot indefinitely, so a pool fails closed
to `busy`. Nothing is bounded across processes or server instances, and
nothing is proved about what a transport does after the delivery boundary has
returned (the local SMTP transport may still close its socket within its
one-second QUIT grace).

`verificationChallengeComposition.ts` is the composition root. It
takes no slot pool and cannot be given one. It wires the public callers to
the service-role client from `createServiceRoleClient()`, which reads its two
existing environment variables only when the root is called, and to login
step 4's local SMTP transport with the approved email, through explicit
configuration with no defaults. The service-role client is postgrest-js
2.108.2, whose `abortSignal()` passes the caller's signal to `fetch`, so at
the caller response deadline the abort requests cancellation through
`fetch`. Whether the transport cancels, and whether and when the call then
settles, depend on the transport (postgrest-js turns `fetch`'s AbortError
into an error answer), and nothing proves that PostgreSQL stopped or rolled
back the call. Tests inject fake database
clients and transports, and drive the real postgrest-js client through a fake
`fetch`; no test touches a database, the local Supabase stack or its mail
catcher. The boundary tests use TypeScript's own parser to find every module
reference (static and side-effect imports, re-exports, `import x =
require()`, dynamic `import()` in any spacing or comment form, `require()`
calls and other value uses of `require`, `typeof import()`, and any use of
`import.meta`, through which Vite's `import.meta.glob` could load modules
without naming them). They parse every non-test file, the ten guarded
modules included (login step 4's three, these four, and, since login step
6's sub-slice S6-1, its three), and refuse any computed reference and any
`import.meta` use in it; only then do they exempt the guarded modules'
literal references to each other, and prove that no other application file
reaches these modules, login step 4's or S6-1's through any of those forms.
Reflective loading (`createRequire`, `module.require` or the `Function`
constructor) is beyond what a source parser can see.

Step 5 itself has no route, server action, cookie, session or UI; since login
step 6's sub-slice S6-8 the Explorer sign-in routes call the root. Three
duties are not provided by step 5: the pepper's source and the startup check
that AUTH-RLS-DEC-032 requires; the one shared, unit-tested contact
normalizer of AUTH-RLS-DEC-033 (the callers only check that a contact is
already canonical); and the route-owned purpose and eligibility (the route
must fix the purpose and prove invitation, first-Admin or account
eligibility before it calls). Sub-slice S6-1 supplies the first two, and
S6-8 supplies the third for the Explorer sign-in, with the timing of the
outward response.

Login step 6's sub-slice S6-1 adds the first two of those duties,
with the login route configuration that hands the step 5 root its settings:

```text
src/lib/solmind/auth/verificationPepperSource.ts
src/lib/solmind/auth/loginRouteConfiguration.ts
src/lib/solmind/auth/loginContactNormalizer.ts
src/lib/solmind/auth/__tests__/verificationPepperSource.test.ts
src/lib/solmind/auth/__tests__/loginRouteConfiguration.test.ts
src/lib/solmind/auth/__tests__/loginContactNormalizer.test.ts
```

Paul's 2026-10-05 evening decision 1 placed the settings that banked
decisions already require (the AUTH-RLS-DEC-032 pepper, the step 5 root's
delivery settings and the trusted origin) within login step 6, with no
change to `supabase/config.toml` or to any hosted configuration. The
contract 25 wording that records that meaning, and its register record,
belong to sub-slice S6-3.

`verificationPepperSource.ts` is server-only, refuses to load where a
browser window exists, and besides the server-only marker imports only
`node:buffer` and the code module.
It takes the pepper from one server-only environment variable,
`SOLMIND_VERIFICATION_PEPPER`, listed with an empty value in `.env.example`,
as base64url text with no padding, 32 to 64 bytes (43 to 86 characters).
More than 64 bytes would add
nothing, because HMAC-SHA-256 hashes a longer key down to 32 bytes first.
The text is accepted only in its one canonical form: exactly that character
set and length, with no padding, whitespace or line terminator, and decoding
it and encoding the bytes again must give the same text, so the platform's
lenient decoder cannot widen what is accepted. If
`NEXT_PUBLIC_SOLMIND_VERIFICATION_PEPPER` is also present, the pepper is
refused: a tripwire for that one name, not a guarantee that the value is
exposed nowhere else. Any failure throws one fixed, value-free
`VerificationPepperSourceError` (`verification_pepper_unavailable`); whatever
was thrown inside is dropped unread. A success returns the code module's
opaque handle, which serializes to `{}`, and the module then overwrites its
decoded copy of the bytes with zeros; the text stays in the environment, and
JavaScript strings cannot be wiped. Each call reads the environment again and
makes a new handle.

`loginRouteConfiguration.ts` is server-only and imports the pepper source
and, type-only, the step 5 root's configuration type, so loading it does not
load the root. `loadLoginVerificationConfiguration` returns exactly the
root's configuration as one frozen plain object: the pepper, and delivery
settings fixed in the code rather than read from the environment. The host
is `127.0.0.1`, which login step 4's transport accepts; the port is 54325,
the local mail catcher's SMTP port that `supabase/config.toml` publishes
(`[inbucket] smtp_port`), which a test checks; the delivery ceiling is
5,000 ms; and the caller response deadline is 6,000 ms, longer than the
issuance function's two advisory lock waits of up to 2,000 ms each
(`lock_timeout`), which a test reads from the current migration. The
6,000 ms caller response deadline leaves 2,000 ms beyond the two documented
advisory-lock waits. Other waiting, execution, transport and scheduling
delays can still cause a committed issuance to be reported as failed. A test
hands the loaded configuration to the real
root with fake dependencies and checks that both callers are keyed by the
loaded pepper. `checkLoginVerificationConfigurationAtStartup` is
AUTH-RLS-DEC-032's startup check: it loads the configuration once and returns
nothing, or throws the pepper source's fixed error. Since sub-slice S6-8 the
server start hook calls it when the server starts (Next.js 16's
`instrumentation.ts` `register`, in the Node.js runtime only, because the
pepper path uses `node:crypto`): a failed check writes one fixed, value-free
line and the server keeps starting, and a route composition that loads this
configuration still fails closed. These
settings point at the local mail catcher only: the route composition must
not compose the local transport unless the trusted origin is a loopback
origin, and a hosted environment needs a provider adapter that does not
exist yet.

`loginContactNormalizer.ts` is pure (no import, IO, environment read, clock
or logging) and is AUTH-RLS-DEC-033's one shared normalizer for login
emails. It refuses anything that is not a string or is longer than 512
characters before any other work, removes leading and trailing ASCII
whitespace (tab, line feed, form feed, carriage return and space), refuses
the rest unless every character is printable ASCII (nothing outside ASCII is
mapped or folded, so a look-alike such as the Kelvin sign is refused rather
than turned into `k`), lowercases A-Z only, and accepts the result only if it
passes the current issuance function's email check exactly: 3 to 254
characters, that function's pattern, and no `..`. Tests compare its pattern
with the migration's text and its behavior with the delivery boundary's
canonical check for every printable character. A refusal is `null`; a
success returns the canonical email, which is a contact value that callers
keep out of audit rows, errors, traces, alarms and logs. It decides no
eligibility. Phone sign-in is outside login step 6, so phone normalization
joins this module when phone sign-in is designed; the Admin username's
lookup belongs to the login lookups (S6-5 and S6-9).

Since sub-slice S6-8 the Explorer sign-in routes use all three: their server
composition calls the normalizer, their dependency factory loads the route
configuration, which loads the pepper, and the server start hook runs the
startup check. All three stay off every barrel. They stay in the login step
5 boundary test's guarded set (VCB-004), and their own boundary tests check,
with TypeScript's parser, their exact imports, that `process.env` appears
only as the default value of an `environment` parameter, and that exactly
the references S6-8 added exist and no other application file references or
names them. The next slice that imports any of them (S6-9) amends both
tests.

The banked dormant DEF5-S4 slice keeps session mutation separate from redemption and provisioning. `public.solmind_create_user_session` consumes committed account-bound `login` or `role_reentry` evidence, owns account-wide supersede-then-create serialization, and embeds its exact Family B audit rows. Its freshness policy and both uniqueness indexes are hidden database backstops, not client authorization. Corrective migration `20260716001000_user_session_creation_chronology_guard.sql`, banked in `d2fbb0e`, preserves the writeless exact-retry branch and requires never-sessionized evidence to be strictly newer by `(used_at, challenge UUID)` than every prior session-linked evidence tuple for the account; chronology denial is fixed and zero-write. The three DEF5-S4 plans contain 49/51/50 assertions, and clean reset passed 14 files / 502 assertions. The banked slice creates no caller, route, cookie, provider action, account/profile/role provisioning, invitation or Guide assignment dependency, cloud path, or real-user flow. Its only application caller is login step 6's session-creation caller (sub-slice S6-6), described next, which the Explorer sign-in routes call since sub-slice S6-8.

Login step 6's sub-slice S6-6 adds that caller and the duration rule it uses:

```text
src/lib/solmind/supabase/userSessionCreationCaller.ts
src/lib/solmind/auth/loginSessionDuration.ts
src/lib/solmind/supabase/__tests__/userSessionCreationCaller.test.ts
src/lib/solmind/auth/__tests__/loginSessionDuration.test.ts
```

Both modules are direct-import only, stay off every barrel, and read no
environment variable. `loginSessionDuration.ts` is pure, with no import and no
clock: every time is passed in. It holds the rule of
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`
Section 7: the requested duration is the provider access token's remaining life
in whole seconds, rounded down, minus 120, capped at 3600, and under 1 the
login is denied; the cookies' Max-Age is the session's remaining life in whole
seconds, rounded down, worked out from the `expires_at` the function returns,
with no cap. A session cookie may be given only 1 to 3600 seconds, the range
that S6-2's login-step cookie writer accepts, so under 1 second no cookie may
be written, and more than 3600 seconds, which only this server's clock running
behind the database's can show, is refused as an abnormal state; the caller
reports both as `failed`. `expires_at` is read only in the exact form
PostgreSQL prints a `timestamptz` in JSON, with a real calendar date and time.

`userSessionCreationCaller.ts` starts with `import "server-only";` and imports
only the duration rule and the role names. It reaches the database only through
an injected RPC seam that the service-role client satisfies, and calls only
`public.solmind_create_user_session`, whose current definition is in
`supabase/migrations/20260718000000_authorizing_evidence_consumption.sql`; it
accepts no function name. Its request is exactly the server-derived account
UUID, the role the route's login path fixes, the challenge UUID the route has
just redeemed, and the provider access token's expiry in epoch seconds. Any
other key (a purpose, a duration, a session id) or a malformed value, including
a final line terminator, is `invalid_request`, with no database call. It fixes
the purpose to `login`, the one flow step 6 builds, works out the duration with
the rule (`denied` under 1 second, with no call), and calls the function once
under a caller response deadline, as login step 5's callers do: a monotonic
deadline recorded before the call, a timer that aborts the call's signal, which
postgrest-js passes to `fetch`, and the deadline checked again just before an
answer is accepted. It accepts only exactly one row whose only keys are
`outcome` (`created` or `existing`), a lowercase canonical `user_session_id`
and an exactly printed `expires_at`, and returns that UUID and the Max-Age. The
function's seven fixed refusals of the evidence, account or role are `denied`;
everything else, its other fixed errors included, is `failed`. A test reads the
migration and checks both lists, the arguments, the duration bounds, the
outputs and the service-role-only grants (all privileges revoked from PUBLIC,
execute revoked from `anon` and `authenticated` and granted to `service_role`)
against the current definition. Results are frozen, and each refusal is one
shared object. Refusals contain only `outcome`; successful results contain
`outcome`, `sessionId` and `maxAgeSeconds`. The session UUID in `sessionId` is
what the binding cookie needs, so the route must never log a result. Once
constructed the caller never throws, and it never logs.

`existing` is accepted only for this exact flow. The function's exact-retry
branch returns the same live session for this challenge, account, role and
purpose, and it runs before the freshness check, so anything that could call it
twice with one redeemed challenge could recover a live session's UUID for up to
an hour. The caller therefore makes one call per `create`, never retries,
offers no lookup or recovery entry point, and checks `existing` exactly as
`created`; the tests show that postgrest-js 2.108.2 sends one POST per call and
does not replay it after a 503, a 520 or a network error. The route slices
(S6-8 for the Explorer, S6-9 for Guides and the Admin) must call it only after
their own redemption of that challenge returned `redeemed` in the same request,
after every other factor and check the role's login path requires, and at most
once per request. A `created` or `existing` answer shows committed state only
if the call is its own READ COMMITTED transaction (the runtime-caller
requirement of
`../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
Section 7.3), PostgREST commits before it answers, and nothing replays the
POST; only the last is shown here, and the rest belongs to the route slice's
database run. A lost or late answer may hide a session the database did make,
which has also ended the account's previous session; the caller reports
`failed`, no cookie is written, and that session ends by itself within the
hour.

Explorer, Guide and Admin compositions call the session creator through their
explicit server-only factories; Guide/Admin use the shared fixed-role
password-role core. Each accepted verify request calls `create` once after
its own factors and same-account confirmation. The session caller alone uses
the duration rule; neither module owns a route, cookie writer or UI.
Current TypeScript parser-covered boundary tests enumerate the exact factory/
composition references, preserving off-barrel and computed-reference guards.
Reflective loading remains beyond a source parser. The banked identity bridge
supplies the provider expiry; incoming browser values never supply that authority.

The dormant login step 6a logout writer keeps ending a session inside one database operation. `public.solmind_logout_user_session` takes only the server-derived account and the presented session UUID, takes the same shared account-domain advisory lock as session creation (and no evidence lock), then the presented row's lock, and only then reads its one database clock, so a session that expires during either wait is not ended. It changes that session to `logged_out` with `ended_at` only when it is the account's active, unexpired session, embedding the one Family B logout audit row in the same transaction. It reports `ended` or `already_ended`; an unknown or another account's session fails closed with one fixed identifier, and every other error raised in its body, an assertion failure included, leaves as one fixed `solmind_logout_*` identifier with no underlying message, detail, or hint. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available, as for session creation. It never ends any other session, reads no evidence, and does not require the account or role to be active, because ending a session only removes access. Its application caller is now `userSessionLogoutCaller.ts`, through the shared logout composition. The database function itself reads/writes no browser cookie and makes no provider call. Real provider/browser proof, hosting and real-user activation remain separate.

Login step 6's sub-slice S6-3 changes the banked active-session lookup `public.solmind_find_active_user_sessions(uuid)` (AUTH-RLS-DEC-026; function 3 of `../solmind-docs/execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md`) so that each returned row also carries its `user_session_id`, the UUID that the per-request session-binding check of `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25) Section 8, as Paul corrected it on 2026-10-05, compares with the binding cookie (sub-slice S6-4). `supabase/migrations/20261005000000_active_user_session_lookup_session_id.sql` drops and recreates the function in one transaction, because PostgreSQL cannot replace a function whose return columns change, and keeps everything else: the one `uuid` argument, `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER` owned by `postgres`, an empty search path, one schema-qualified SELECT of `identity.user_session` with only the account and `session_status = 'active'` predicates and no expiry pre-filter, `LIMIT`, `ORDER BY`, or exception handler, and the same grants (all privileges revoked from PUBLIC, EXECUTE revoked from `anon` and `authenticated` and granted to `service_role`). It raises nothing of its own: an absent or null account returns no rows. Unlike the dormant step 6 modules, it has runtime callers: the `/admin/access` composition (`adminAuthSource.ts`) and the Suggested Waypoint request dependencies (`suggestedWaypointRequestDependencies.ts`) reach it through `serviceRoleRpcExecutor.ts`, and until sub-slice S6-4 `supabaseAuthQueryClient.ts` read only the four columns it named from each row. Since S6-4, described below, it requires `user_session_id` in every row and carries the selected session's UUID and `expires_at` to the allow result. The UUID grants nothing on its own and stays out of logs, errors and evidence (contract 25 Sections 8 and 14). Two pgTAP suites, `supabase/tests/active_user_session_lookup_*_test.sql`, prove its shape, hygiene, grants and real path; the real-path suite compares session UUIDs only inside SQL, so a failing assertion prints none. The banked `admin_access_rpc_*` suites are unchanged.

The login step 6 sign-in lookups (sub-slice S6-5) keep a sign-in's account and evidence checks inside two read-only database functions. `public.solmind_resolve_login_account` takes only an identifier, its type (`email`, or `username` for the `admin` role only) and the role the route's login path fixes. Its stored-state predicates are ones the banked functions already use: the issuance function's sign-in contact check (an active, verified, sign-in-enabled email) and its canonical email check, applied to the contact's stored email, session creation's account and role checks (an active account and an active role assignment with no revocation time), and the one active `supabase` provider identity that the identity bridge asserts. It returns the account, the contact, that email and the bound provider user id only when exactly one candidate exists; every ineligible, unknown or ambiguous identifier gives the same zero rows, so the route can answer every identifier with one acknowledgment, and neither path returns an email the issuance function would refuse. A typed email must pass the issuance function's own check, so login step 6's contact normalizer (S6-1) and issuance accept the same set. A typed username is checked only for what the schema already requires of a username (not blank) and must already be lowercase, so that it compares with `lower(username)`, the expression of the unique username index; no other username form is imposed, and the Admin's sign-in route (S6-9) must pass it lowercased. `public.solmind_confirm_redeemed_login_challenge` takes the server-derived account, the exact selector the route has just redeemed and the expected purpose, and returns one row: `true` only when that challenge is bound to that account with a contact, has that purpose, is used and not invalidated, and is fresh under `identity.session_creation_freshness_policy` with the session function's comparison, measured from the start of the calling statement; `false` for every other state, with no reason. It is a check before the Explorer's Supabase exchange, not a consumption check: the Explorer route (S6-8) must have its own `redeemed` answer for that selector in the same request, and then `true`, before it asks Supabase for a session, so that a code one person redeemed cannot make a Supabase session for an account someone else typed; the session function still checks everything again. Both functions are STABLE, so they cannot write; a malformed argument raises one fixed identifier that carries no part of the input, and neither has an exception handler or takes a lock. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available. Since sub-slice S6-8 the Explorer sign-in routes call both, through the two server callers in `src/lib/solmind/supabase/loginAccountLookupCallers.ts`; the functions themselves add no route, cookie, provider action, cloud path, or real-user flow.

Login step 6's sub-slice S6-4 is the per-request check of contract 25 Sections
7, 8, 14 and 19: Sections 8 and 19 as Paul corrected them on 2026-10-05
(AUTH-RLS-DEC-044), and Section 14's field check and the token-only
verification of Sections 7 and 8 under the decision record that banks before
this code (the entry of
`../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md`
that records the field check and the token-only verification for sub-slice
S6-4, and the section of contract 25 that quotes the visitor-cookie question).
It runs on the guarded read path that all 8 route handlers share:
`/admin/access`, the three Explorer Suggested Waypoint routes and the four
Guide ones. It adds no module, route or caller, and it changes these files:

```text
src/lib/solmind/supabase/requestAuthClient.ts
src/lib/solmind/supabase/principalMapping.ts
src/lib/solmind/supabase/supabaseAuthQueryClient.ts
src/lib/solmind/supabase/serverAuthSourceAdapter.ts
src/lib/solmind/supabase/sessionSelection.ts
src/lib/solmind/auth/serverAuthContext.ts
src/lib/solmind/auth/authSource.ts
src/lib/solmind/auth/sessionCookiePolicy.ts
tests/whole-path/suggestedWaypointLocalAuthFixture.ts
tests/whole-path/suggestedWaypointLocalSqlFixture.ts
```

Four more files change in comments only. Five comment lines that called the
request-auth adapter `@supabase/ssr`-backed now call it Supabase-backed, in
`src/app/admin/access/route.ts`, `src/lib/solmind/auth/adminAccessRequest.ts`,
`src/lib/solmind/auth/adminRouteAccess.ts` and
`src/lib/solmind/auth/composeRequestAuthContext.ts`; no code line of those
files changes.

A request is allowed only when it presents, in the session-binding cookie, the
UUID of the very session the lookup selected for its account. The request's
cookies are read in one place and the comparison is made in one place, and
every guarded route passes through both.

The read is in `requestAuthClient.ts`, which both composition roots build
(`adminAccessRequest.ts` and `suggestedWaypointRequestDependencies.ts`). At
construction it resolves the one session-cookie policy from
`loadTrustedApplicationOrigin()`, as the Explorer sign-in routes' dependency
factory resolves it for the identity bridge and the login-step cookie writer
resolves it for itself (S6-8), so
that the writer, this adapter and logout read one name. A missing or malformed
trusted origin, or a plain-http one that is not a loopback address, throws one
fixed, value-free configuration error. `/admin/access` answers it with
`{ allowed: false }` and, when the audit writer is available, writes one
`auth_resolution_failure` audit row for every request in place of the opaque
deny decision row (the banked handling of a construction failure). Suggested
Waypoint requests fail closed: policy-construction failures use the fixed
failure response; command requests rejected earlier by the origin guard use
its fixed denial response. For each request the adapter reads the cookies once
into a frozen snapshot and then, in this order: applies the policy's one
shared Section 14 format check to the auth cookie, through the policy's second
pure helper `readSessionAuthCookieAccessToken`, which gives it the accepted
cookie's sign-in token and nothing else of the cookie, and resolves no
principal for an absent or malformed one; requires exactly one session-binding
cookie holding a lowercase canonical UUID, and resolves no principal for none,
a repeated one or any other value; and only then builds a Supabase client,
with `createClient` of `@supabase/supabase-js`, the public anon key, and
`persistSession` false, `autoRefreshToken` false, `detectSessionInUrl` false
and `skipAutoInitialize` true. That client is given no cookie reader, no
cookie setter and no storage, so nothing of the request reaches the library
but the token, and a Supabase session without the binding cookie is not even
sent to Supabase. On a route, Next's own cookie reader keeps one entry for
each name (the last whose value percent-decodes), so a repeated name does not
reach the adapter there; that refusal guards any other caller.
`getUser(token)` then asks Supabase Auth about that one token, and the UUID
from the binding cookie travels on the principal as `presentedSessionId`,
which `principalMapping.ts` passes through. The adapter never calls the
accessor's `setAll`: this slice writes, refreshes and clears no cookie.
`requestAuthClient.ts` no longer imports `@supabase/ssr`; the login
identity bridge beside it still does (AUTH-RLS-DEC-013).

The records carry the selected session's own values.
`supabaseAuthQueryClient.ts` requires `user_session_id` in every session row,
so a row without it fails closed, and returns the selected session's
`user_session_id` and `expires_at` unchanged; `serverAuthSourceAdapter.ts`
maps them to `userSessionId` and `expiresAt` and echoes the principal whole.
`serviceRoleRpcExecutor.ts` is unchanged, and `composeRequestAuthContext.ts`
changes only in a comment: the executor passes rows through, and the composer
hands the principal to the record load and the loaded input to the decision,
as before.

The comparison is in `deriveTrustedServerAuthContext`
(`serverAuthContext.ts`), which every guarded decision already calls:
`authorizeRouteAccess`, the two Suggested Waypoint request compositions and
the Guide list route's diagnostic. After the provider identity, the account
and the selected session have passed, it denies unless `presentedSessionId` is
a non-empty string exactly equal to the session's `userSessionId`, with no
trimming or case folding. Its two new internal reasons, like the others, never
leave the server. The UUID therefore grants nothing on its own, and a browser
left with a superseded session's UUID, in the same role or after a login in
another role, is denied instead of acting under the newer session. On an
allow, `TrustedServerAuthContext` gains `session: { userSessionId, expiresAt
}`, carried from the lookup for server use. The proposed home returns only
expiry and a fresh observation time for its advisory warning; the session UUID
stays server-private and neither value is logged. The in-memory auth
source (`authSource.ts`), a test double and the deny-all default of the
`/admin` helper, takes the presented UUID from the request and never from its
store.

Every outward result is unchanged and value-free: the routes answer a refused
request exactly as they answer an unauthenticated one. Since sub-slice S6-8
the Explorer verify route writes the two cookies after a successful sign-in;
Guide and Admin compose their separate fixed password/code routes;
the banked Explorer screen calls its fixed routes. A request without both cookies is still denied
by every guarded route, including one that still
carries a Supabase cookie under the library's default name. All 8 routes now
need `SOLMIND_TRUSTED_APP_ORIGIN`; before this slice only the two command
routes did. `src/app/__tests__/guardedRoutes.perRequestCheck.realpath.test.ts`
drives all 8 handlers through the real composition, and
`src/lib/solmind/supabase/__tests__/requestAuthClient.realLibrary.test.ts` and
`requestAuthClient.directToken.realLibrary.test.ts` run the adapter against
the real installed library with only `fetch` replaced.

The field check is the last step of the shared format check in
`sessionCookiePolicy.ts`. The earlier steps judge the cookie's encoding (the
allowed characters, the `base64-` start, strictly valid UTF-8); they cannot
see what is inside. The library builds its request to Supabase Auth from the
token text it is given, and when the platform refuses that request (a token
holding a line feed or a NUL, which reach it as JSON escapes, or a character
above U+00FF) the library prints the platform's error itself, which quotes the
text or gives a position and a character code taken from it, before the
adapter's fail-closed wrapper sees anything. So the check decodes the cookie
exactly as the library would (a leading byte-order mark kept), parses the text
once as JSON, drops the parser's error, and requires, each read as an own
property of the parsed object with no copy first: `access_token` a string of
three non-empty parts of A-Z, a-z, 0-9, `-` and `_` joined by dots (plain
ASCII classes and no pattern flags); `refresh_token` a non-empty string, with
no character rule; `expires_at` a positive safe integer; and `user` absent,
null or an object that is not an array. Anything else is the same fixed
`malformed` result as every other refusal, and nothing of a refused value is
kept, returned, logged or thrown. So no token text that the platform refuses
reaches the library, and neither does text that is not JSON or JSON that is
not a session. The module stays pure and imports nothing. No guard is put
around the library's requests: contract 25 Section 19 does not list one, and
with the field check the study found nothing left for one to catch for this
problem (text a visitor chooses); the line the library prints when Supabase
Auth cannot be reached stays, as said below. `sessionCookiePolicy.test.ts`
(`FCP-001` to `FCP-013`) and the real-library tests (`FCL-001` to `FCL-004`)
show each hostile shape refused with nothing requested, set or printed, and
cookies that the library's own writer produces accepted.

The token-only verification is how the adapter asks Supabase who the user is
(contract 25 Sections 7 and 8). A cookie-reading client can send the cookie's
renewal token when loading an expired or near-expiry session. In the
refused-renewal controls it printed the stand-in's error; with the unreachable
stand-in it retried for about 25 seconds. The adapter therefore gives the
library no cookie. `sessionCookiePolicy.ts` hands it the accepted cookie's
sign-in token through `readSessionAuthCookieAccessToken`, which judges the
cookies with the shared check itself and returns that one string; the renewal
token, the expiry and the profile stay behind. The client's only session store
is the empty in-memory one the library makes for itself; it cannot persist a
session, starts no renewal timer and has no cookie setter, and the one call
made on it is `getUser(token)`, which sends `GET /user` with that token as the
bearer. The library asks for a renewal only for a session it has loaded from
its store or has been handed; this client is given neither. The adapter reads
no clock, so the time that passes between the check and the call changes
nothing about what is sent. Whether the token is still good is Supabase Auth's
answer, not the adapter's: when Supabase Auth refuses a token, the library
returns that error without printing it, and the request is denied. An expiry
rule in the adapter is not used: a first draft refused tokens with under 95
seconds left, and review #161a showed that such a rule cannot exclude a
renewal, because time can pass between the adapter's test and the library's
own. `requestAuthClient.directToken.realLibrary.test.ts` (`TKL-001` to
`TKL-009`), with `PRL-008` and `PRL-009`, runs the adapter and the real
library on late, replayed and hand-made cookies (the expiries and renewal
tokens its rows list), moves the clock forward by between 5,001 milliseconds
and 30 days between the check and the call, and finds at most one request,
`GET /user`, none to the token endpoint, nothing handed to a cookie setter,
nothing printed except the library's one line when Supabase Auth cannot be
reached, and no unhandled rejection; one test also finds no timer left pending
after the call. Most of those tests are paired with a control in which a
cookie-reading client asks for the renewal. `requestAuthClient.test.ts`
(`TKA-001` to `TKA-007`) pins the client's options, the one call and its one
argument, and that the adapter's own code reads no clock;
`sessionCookiePolicy.accessToken.test.ts` (`TKP-001` to `TKP-006`) covers the
helper.

What stays open. When Supabase Auth cannot be reached, the library prints the
platform's error for its one request; that line is the platform's own error,
to which the library adds nothing (in the tests, with a stand-in for a refused
connection, it held no cookie text), the request is tried once and is denied,
and the library's request code sets no time limit on it. The tests ran the
library on its own, with `fetch` replaced by a stand-in: what the real
Supabase Auth answers (to a token past its end, to a forged one, or to one
whose session has ended), and behavior on a real connection and inside a
running Next.js server, were not tested. The construction rests on the
installed library (`@supabase/supabase-js` and `@supabase/auth-js` 2.108.2):
`TKL-009` pins that a client built this way holds no session and that
`getUser(token)` makes one request, so a library change that breaks either
fails a test. If Supabase ever issued sign-in tokens that are not three
dot-joined parts, the field check would refuse every session until it is
adjusted; it fails closed. SolMind's own code logs nothing.

Banked `PRJ01_F-WS06-WI008-S02D` - Guide-to-Explorer invitation issuance,
same-Guide replacement, and revocation - keeps invitation lifecycle mutation inside
two dormant service-role-only database entry functions in synchronized app commit
`a9944f1`. The issuance function
re-derives Guide, Practice, and active membership authority; serializes the
normalized-contact capacity domain; materializes expiry; replaces only the older
same-Guide/same-Practice/same-contact invitation; denies cross-Guide capacity
without displacement; snapshots protected lifetime policy; and writes exact
transactional audit. The revocation function changes only an owned live invitation
or returns a value-free terminal observation. The functions add no acceptance,
relationship, evidence, reservation, session, provider, route, delivery, consent,
RLS policy, table grant, cloud, deployment, or real-user path. Focused 203/203
and complete 1,547/1,547 database assertions, zero-residue proof, final clean
reset, lint, typecheck, 487 application tests, production build, and exact
Fable 5 implementation assurance passed before banking.

Banked `PRJ01_F-WS06-WI008-S02E` - dormant Explorer invitation acceptance -
keeps the acceptance boundary inside one service-role-only database entry
function. It verifies committed preparation and a server-verified provider
result; acquires evidence-first and sorted domain locks; supports only exact
writeless committed-response recovery; applies the protected current-Guide
capacity policy; reuses the shared invited-identity helper; consumes the
evidence; creates exactly one `intake_pending` relationship whose
`created_from_invite_id` names the accepted invitation; accepts that
invitation; revokes only open same-Guide, same-Practice, same-contact siblings;
and persists the exact Family B audit rows in the same transaction. The paired
preparation change is only a writeless, non-authoritative capacity pre-check
after banked identity checks and before reservation creation. Focused
validation passed 6 files / 436 assertions and complete validation passed 31
files / 1,777 assertions with zero synthetic residue and three clean
32-migration resets. The slice is banked in synchronized app commit
`5e98ebf`; it remains dormant and adds no provider IO, caller, route, cookie,
session, consent, RLS policy, table grant, capacity-policy writer, cloud
action, deployment, or real-user path.

`PRJ01_R-WS09-WI021-S02`, not S01, owns exact additive storage for submitted
onboarding, Compass, Route, private Waypoint, Private Summary Draft, selection
provenance, Shared Snapshot, and lineage. Its protected 1-100 day setting,
local synthetic relationship fixture, and forward-only Summary publication /
Shared Snapshot persistence realignment are banked dormant foundations.

The realignment owns immutable Guide-authored Summary revisions and sections,
the authoritative publication record, the fail-closed targeted Explorer
projection, Explorer-private exact-review drafts, immutable confirmed Shared
Snapshots, preserved original/addendum/replacement lineage, and bounded
service-role-only publication, unpublication, confirmation, and integrity
surfaces. It does not own Suggested Waypoint identity and adds no application
caller, permissive RLS policy, direct-table role grant, operational timer,
hosted data, provider behavior, deployment, or real-user path. Submitted
onboarding, Compass, Route, private Waypoint, conversation, notification, and
the remaining caller/runtime persistence still require separate slices. Do not
put the synthetic fixture in a production migration or universal seed.

The banked manually invoked local-development fixture boundary is:

```text
supabase/fixtures/
  PRJ01_R_WS09_WI021_S02_LOCAL_FIXTURE.md
  prj01_r_ws09_wi021_s02_local_fixture_setup.sql
  prj01_r_ws09_wi021_s02_local_fixture_validate.sql
  prj01_r_ws09_wi021_s02_local_fixture_cleanup.sql
```

It creates only one reserved synthetic Guide, one reserved synthetic Explorer,
their minimum organization/practice membership substrate, one active
relationship, and one bounded Explorer-safe Virtual Guide behavior string.
Setup rejects pre-existing deterministic IDs or ownership markers before
writes; validation is read-only and exact-cardinality; cleanup rejects
mismatched or expanded ownership and proves zero known residue. The fixture is
local-development support, not schema, universal seed, authentication state,
runtime product behavior, hosted data, or a real-user identity source.

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

## Connected Guide request and view boundaries - 2026-10-21

Connected Guide is a bounded integration over the banked Explorer/auth
foundation. Current publication/banking status is owned by SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and its linked checked receipt. Source/check results alone do not establish
banking. This description does not relabel component reviews, activate Admin
or expand the /guide dashboard.

Thin src/app/login/guide/page.tsx and its send/verify Route Handlers compose
Guide-only entrypoints. src/lib/solmind/supabase/guideSignInHttpPorts.ts supplies
explicit provisional timing to request-scoped dependencies and projects Next
mutable cookie records to plain name/value entries. Preserve the strict HTTP
reader; no auth/configuration IO at module load. LoginExperience mounts
GuideSignIn separately; Admin has its separate connection below and standalone
preview callers remain effect-free.

The password-role bodies/core/route/HTTP/dependencies retain raw password text
and fixed role/login/home. Send prepares its spare acknowledgment before lookup;
only eligible account lookup permits issuance. Send receives no password and
writes no cookie. Verify orders eligible lookup, non-consuming exact ownership,
password private hold, redemption, provider-user/redeemed-account confirmation,
session creation, accepted-session preparation and release. Wrong account never
reaches password; wrong password never redeems. Pre-factor refusals share the
accepted message/body/status/headers and attempted floor. Earlier guard/config
and handled post-factor completion failures remain generic denial. Await bounded
discard; preserve existing cookies, publish no new auth/binding cookie on refusal,
and discard partial success. Timeout/cleanup proves no remote rollback or
absence of a committed session/supersession.

The ownership migration
supabase/migrations/20261016000000_login_challenge_ownership_lookup.sql is a
service-role-only STABLE SECURITY DEFINER exact boolean read. Join contact back
to the same account; separate foreign keys are insufficient. No mutation/audit/
reservation or duplicate redemption policy. Banked loginAccountLookupCallers.ts
and its unit suite are context; the SQL suites passed 56 assertions in the
isolated October 21 run, included in the 680-assertion auth regression. See
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Keep later
redemption, provider/account confirmation and session checks.

Browser-safe passwordRoleSignInBrowserContract.ts, guideSignInBrowserTransport.ts
and guideSignInFlowController.ts own Guide requests/results and private attempt
state; src/components/solmind/GuideSignIn.tsx mounts it. Clear drafts on
cancellation/disposal; no secrets/selectors in URLs, logs or browser storage.
Only current accepted success permits fixed /guide/home navigation; stale
completions and request-selected destinations have no authority.

Dynamic src/app/guide/home/page.tsx preserves bounded raw-cookie framing,
duplicate names and exact values. src/lib/solmind/auth/guideHomeAccess.ts uses
current token-only principal and SolMind session/role/binding checks, with fresh
expiry recheck. Only expiry/observation times reach
src/components/solmind/GuideHome.tsx. Reuse finite clock/shared logout, Guide
re-entry, confirmed-only signed-out state, honest uncertainty and fresh server
check after cached-page restoration. No GET cleanup, retry, renewal or client
credential clearing.

src/components/solmind/ExplorerHomeNavigation.tsx is presentation only:
Conversation and Compass entry, authenticated inbox link and collapsed
fixed-script previews. Each destination retains its own authorization and data
boundary; the previews remain unconnected. Navigation grants no persistence,
AI/human Guide/provider or session authority. ExplorerHome retains its
session/logout lifecycle.

Four issuance/four redemption slots are per loaded module/process, not
distributed/per-account. October 21 R04 genuine functional/contention
observations and isolated app/SQL checks are recorded in
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. Paul's 20:17:31 CDT
approval in
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json
accepts disclosed small-sample timing/capacity risks and defers real exhaustion/
induced provider/session/cookie failure timing only for private synthetic local
use. The original full protocol is not claimed passed; deferred measurements
remain required before broader exposure or real users. Fake clocks/Explorer
proof cannot replace real timing or full assurance. This dated Guide-only
approval supplies no Admin residual-risk acceptance. Preserve accounts/private
passwords; no blind reset/recreation. Admin parsing alone implements no
first-Admin setup; later setup reuses its policy.


## Connected Admin request and view boundaries - 2026-10-23

This source connection adds the Admin chooser branch, fixed /login/admin,
POST /login/admin/send, POST /login/admin/verify and protected /admin/home.
src/components/solmind/LoginExperience.tsx mounts AdminSignIn separately from
Explorer/Guide. Standalone preview callers and prototype /admin stay separate.
The home is a finite-session confirmation/sign-out surface, not new dashboard,
private Guide/Explorer-data or provisioning authority.

src/lib/solmind/supabase/adminSignInHttpPorts.ts constructs request-scoped ports
for the existing fixed Admin HTTP handlers and password-role dependencies.
Keep imports direct/server-only/off barrels, configuration before remote work,
no module-load auth/configuration IO and plain name/value projection from Next's
mutable cookie store into the strict reader. The shared core fixes role, login
purpose and home. A browser chooses none of those authorities.

Admin accepts the approved username or unchanged email normalization: at most
512 typed characters before username trimming, outer U+0020 spaces only,
ASCII letters/digits/period/underscore/hyphen and lowercase ASCII folding.
Input containing @ uses the email normalizer with no username fallback; wider
existing usernames retain email sign-in. Lookup supplies the verified stored
sign-in email for delivery/password authentication; never construct an email
from a username or reveal its stored value. No first-Admin setup/name migration
is implemented.

Send carries no password. Verify preserves typed password text and orders
eligible fixed-role lookup, non-consuming exact challenge/account/contact
ownership, private password hold, atomic redemption, provider-user assertion,
redeemed-account confirmation, session creation, accepted-session preparation
and release. Wrong-account ownership must not reach password; wrong password
leaves redemption uncalled. Neither factor alone permits a session. Refusals
retain the shared message/body/status/headers in the accepted interval, publish
no new auth/binding cookie, preserve existing browser cookies and await bounded
discard. Cleanup/timeout cannot undo or disprove a committed remote effect.

src/lib/solmind/adminSignInBrowserTransport.ts uses the existing browser
builders/parsers with fixed Admin POST paths, same-origin credentials, no-store,
redirect rejection, bounded streamed JSON and explicit cancellation/budget.
src/lib/solmind/adminSignInFlowController.ts privately owns the current opaque
selector/generation and rejects stale, cancelled or disposed continuations.
src/components/solmind/AdminSignIn.tsx keeps password only in an uncontrolled
field/current verify request; send never reads it. Identifier changes/resend clear
password/code drafts; departure, disposal and pagehide retire the active attempt.
Only current accepted success allows fixed /admin/home navigation. No credential,
selector, token or private server detail enters logs, URLs, storage or home props;
password values are not serialized into React state/markup.

src/app/admin/home/page.tsx is dynamic and reads the wire cookie header before
Next can merge/decode it; preserve duplicate names and exact values for strict
validation. src/lib/solmind/auth/adminHomeAccess.ts delegates once to
resolveAdminHomeForRequest in src/lib/solmind/auth/adminAccessRequest.ts.
That trusted internal path uses resolveAdminHomeRouteAccess from
src/lib/solmind/auth/adminRouteAccess.ts against the fixed /admin/home rule in
src/lib/solmind/routeAccess.ts. It cannot borrow /admin policy or accept a
request-selected route. Verify the principal, current account/role/session
records and exact binding through the existing guarded read.

On a would-be home allow, require the post-resolution guarded_service_role_read
write FIRST and admin_route_access_decision/allow write SECOND; both must persist.
Preserve the existing fail-closed write ordering and accepted residual-read-row
behavior on second-write failure. After both awaited writes, recheck current
expiry/clock before projecting home times. Final projection/expiry denial does
not rerun the read or invent a third resolution-failure row; prior committed
audit rows may remain. Do not imply rollback or widen the audit vocabulary.
The public /admin/access probe retains exactly { allowed }; legacy server-only
resolveAdminActorForRequest callers retain exactly the existing allowed/actor
projection. No expiry field is added to either old contract.

Only expiresAt/observedAt reach src/components/solmind/AdminHome.tsx. Its reused
finite clock is advisory, refresh/cached-page restoration obtains fresh server
verification, and shared POST /logout preserves confirmed signed_out versus
honest uncertainty. Session denial/expiry uses fixed /login/admin re-entry.
GET never renews, clears cookies or signs out. Shared logout owns termination,
bounded provider cleanup and owned-cookie clearing; add no second logout route.

ADMIN_SIGN_IN_CONFIGURATION explicitly uses a provisional 1,500 ms floor;
3,000 ms each for account lookup, ownership and confirmation; 5,000 ms provider
and 18,000 ms session deadlines. LoginExperience supplies an explicit 60,000 ms
browser response budget. These values supply no measured adequacy, constant-time
proof, rollback guarantee or whole-flow wall-clock bound. Shared issuance and
redemption capacity is per loaded module/process, not distributed/per-account.

Source/component checks do not establish Admin genuine journey, actual audit/
failure effects, timing/capacity, residual-risk acceptance, complete assurance,
publication or banking. Guide's dated October 21 proof and private-synthetic-local
risk acceptance remain Guide-only history. Admin requires its own actual evidence
and risk disposition under the adopted protocol. Current complete-slice evidence
and status are owned by solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md
and solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md with its exact
checked receipt; no result is inferred from this source description.

Preserve existing accounts/private passwords and all separately gated first-Admin
setup, invitation/provisioning, password reset, SMS, remembered browser/activity
renewal, broader Admin workflow, new SQL/schema/grant/dependency, provider/
cloud/production/deployment/real-user and cleanup boundaries.

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

The effective source's single closed read capability is
public.solmind_resolve_explorer_methodology. It derives current Explorer,
account-bound session, relationship/topology, exact owning Guide scope and
trusted pack; requires the approved effective version, exact immutable digest,
completed nonfail screen, Admin review, Guide checklist and atomic audits; and
returns one exact row or a fixed value-free error. MV1 plus 64 uppercase hex
characters is SQL-derived evidence, not a caller permission token.

The additive governed builder resolves methodology for each new turn with
configuration version methodology: plus immutable version UUID. It retains
exact bytes/fingerprint and refuses final pointer/version/content/scope/MV1
drift. The additive governed repository changes prepare only; browser routes,
request dependencies, default factories and shared/client barrels stay unchanged.

For new operations the wrapper takes existing authority locks before methodology
locks, uses READ COMMITTED/bounded contention, rederives selected digest/MV1 and
calls v2 prepare in the same transaction. Append-only
methodology.explorer_methodology_binding links the new snapshot to exact
pack/version/SHA/MV1 under explorer-methodology-governance.v1 before dispatch
permission. No lock spans provider I/O. No immutable snapshot rewrite or old
invocation-CHECK widening manufactures governance evidence.

Browser-command replay settles before builder/source loading. Direct governed
prepare retry must match original full v2 fingerprint and stored governance
binding after a later version activates; missing/changed binding cannot upgrade
legacy evidence. Owner/superuser powers are outside RLS protection.

Screen citations/explanations belong on the protected version. Operation/audit
rows remain closed ID/hash/status or exact catalog metadata. Provenance shape
is Admin-attested metadata, not rights proof. Caller/policy approval, semantic
model safety and genuine human actions require actual independent evidence.


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
