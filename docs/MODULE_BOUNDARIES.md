# SolMind App Module Boundaries

Version: 0.2.3
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

The `/login` sign-in preview keeps the same split: `SignInPreview.tsx` owns
the one client boundary, `SignInPreviewParts.tsx` owns presentation, and
`signInPreview.ts` owns the approved copy and pure screen transitions.
`src/app/login/page.tsx` only composes it. Screens follow their approved
mockups; the preview's own additions are styled apart (a "Preview controls"
band, with a remembered-browser switch on A3 and A3A, an example-screen
callout beside each code screen's claims, and explanations beside
unconnected controls). Choosing Guide opens A3 and choosing Admin opens A3A;
both go on to A4 for that role, or, with the remembered-browser switch on,
explain beside the "Sign in" button that the code is skipped and stay. The
password field is uncontrolled, so its value never reaches state or markup.
A new-code request keeps A4, M1 or M2 on screen with what was typed; only the
preview switcher moves between the code screens.
It must not import the `auth/` or `supabase/` modules, persist entries, or
send or check credentials or codes; drafts remain in page memory. Wiring it is
login step 6. `LoginOptionList.tsx` and
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

Login step 6's sub-slice S6-2 adds the dormant session-cookie policy and the
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
auth cookie counts as absent.

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

Both modules are dormant: no route, page, middleware or caller uses them,
they write nothing at runtime, and they stay off every barrel, which the
boundary tests check with TypeScript's parser. The per-request check (S6-4)
and logout (S6-12) are their readers to come, and the first slice that
imports either module must amend that dormancy test. The strict UTF-8 step
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
a reader hands to the library. What remains is the wiring: the per-request
check (S6-4) and logout (S6-12) put the check in front of `@supabase/ssr`
before it reads any auth cookie, and until then nothing calls it.

Login step 6's sub-slice S6-7 adds the dormant Supabase identity bridge of
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
DEC-013 and DEC-019). It imports only `server-only` and `@supabase/ssr`, no
Next.js module, and reads no cookie, environment variable or setting: the
route's composition root passes the Supabase URL and anon key, the auth
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

The bridge is dormant: no application runtime caller is introduced (no route,
page or middleware uses it), and only its unit tests invoke it; it writes
nothing at runtime, and it stays off every barrel, which the boundary tests
check with TypeScript's parser. The Explorer route (S6-8) and the Guide and
Admin route (S6-9) are its callers to come, and the first of them to import
it must amend that dormancy test.

Supabase code should not expose service-role credentials through client-accessible variables.

Never put service-role keys or bootstrap tokens in `NEXT_PUBLIC_*`.

S01 does not import or call Supabase.

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

The banked dormant DEF5-S3 issuance foundation keeps the database boundary narrow: `public.solmind_issue_verification_challenge` is a service-role-only, purpose-built `SECURITY DEFINER` operation over `identity.verification_challenge`, `identity.contact_method`, and the exact Family B `audit.audit_event` row. Its partial unique index independently limits each normalized-contact/purpose pair to one structurally open challenge. It does not authorize a route, delivery provider, invitation acceptance, session creation, self-signup, Guide assignment, or rate-limit implementation. The outer app/route layer must establish invitation or self-signup eligibility before calling it. The resend and lockout controls (AUTH-RLS-DEC-037) are implemented inside the same function by `supabase/migrations/20260929010000_verification_issuance_abuse_limits.sql` (login step 2, app `05884ed`); the function still has no runtime caller, and its comment says no runtime caller or real-user path may use it until separately gated.

Login step 4 adds the dormant, server-only, provider-neutral verification-code
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

The three modules are dormant. Only login step 5's dormant callers and
composition root, described next, import them; there is no runtime caller,
route or environment wiring, and the routes belong to login step 6. The
boundary tests use injected fake transports and the transport tests use an
in-process loopback server; none of them touches the local Supabase stack or
its mail catcher.

Login step 5 adds the dormant, server-only code module, the issuing and
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

`verificationChallengeComposition.ts` is the dormant composition root. It
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

Nothing calls the callers or the root: there is no route, server action,
cookie, session or UI. Three duties are not provided by step 5 and are owed
before activation: the pepper's source and the startup check that
AUTH-RLS-DEC-032 requires; the one shared, unit-tested contact normalizer of
AUTH-RLS-DEC-033 (the callers only check that a contact is already
canonical); and the route-owned purpose and eligibility (the route must fix
the purpose and prove invitation, first-Admin or account eligibility before
it calls). The timing of the outward response and the login routes belong to
login step 6.

Login step 6's sub-slice S6-1 adds the first two of those duties, dormant,
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
nothing, or throws the pepper source's fixed error. Calling it when the
server starts (Next.js 16's `instrumentation.ts` `register`, in the Node.js
runtime only, because the pepper path uses `node:crypto`) is the first
activating slice's duty (S6-8), so until then the requirement is met only in
that a route composition that loads this configuration fails closed. These
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

All three are dormant: no application runtime caller is introduced, and they
stay off every barrel. They join the login step 5 boundary test's guarded
set (VCB-004), and their own boundary tests check, with TypeScript's parser,
their exact imports, that `process.env` appears only as the default value of
an `environment` parameter, and that no other application file references or
names them. The route slice that first imports any of them (S6-8) amends
both tests.

The banked dormant DEF5-S4 slice keeps session mutation separate from redemption and provisioning. `public.solmind_create_user_session` consumes committed account-bound `login` or `role_reentry` evidence, owns account-wide supersede-then-create serialization, and embeds its exact Family B audit rows. Its freshness policy and both uniqueness indexes are hidden database backstops, not client authorization. Corrective migration `20260716001000_user_session_creation_chronology_guard.sql`, banked in `d2fbb0e`, preserves the writeless exact-retry branch and requires never-sessionized evidence to be strictly newer by `(used_at, challenge UUID)` than every prior session-linked evidence tuple for the account; chronology denial is fixed and zero-write. The three DEF5-S4 plans contain 49/51/50 assertions, and clean reset passed 14 files / 502 assertions. The banked slice creates no caller, route, cookie, provider action, account/profile/role provisioning, invitation or Guide assignment dependency, cloud path, or real-user flow. Its only application caller is login step 6's dormant session-creation caller (sub-slice S6-6), described next, which nothing calls.

Login step 6's sub-slice S6-6 adds that caller and the duration rule it uses,
both dormant:

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

No runtime caller uses the pair; the dormant session caller uses the duration
rule. There is no composition root, route, server action, cookie or UI here.
The boundary tests' parser-covered source-reference checks, with TypeScript's
parser, find no other application file that references or names either module
(login step 5's boundary test refuses computed references in every non-test
file, and reflective loading is beyond a source parser); the first slice to
import one amends them. Which provider expiry feeds the rule belongs to the
identity bridge slice (S6-7).

The dormant login step 6a logout writer keeps ending a session inside one database operation. `public.solmind_logout_user_session` takes only the server-derived account and the presented session UUID, takes the same shared account-domain advisory lock as session creation (and no evidence lock), then the presented row's lock, and only then reads its one database clock, so a session that expires during either wait is not ended. It changes that session to `logged_out` with `ended_at` only when it is the account's active, unexpired session, embedding the one Family B logout audit row in the same transaction. It reports `ended` or `already_ended`; an unknown or another account's session fails closed with one fixed identifier, and every other error raised in its body, an assertion failure included, leaves as one fixed `solmind_logout_*` identifier with no underlying message, detail, or hint. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available, as for session creation. It never ends any other session, reads no evidence, and does not require the account or role to be active, because ending a session only removes access. It has no caller, route, cookie, Supabase sign-out, provider action, cloud path, or real-user flow; login step 6's logout route depends on it and remains separately gated.

Login step 6's sub-slice S6-3 changes the banked active-session lookup `public.solmind_find_active_user_sessions(uuid)` (AUTH-RLS-DEC-026; function 3 of `../solmind-docs/execution/19_SolMind_MVP0_Auth_RLS_RPC_Function_Contract_v0_1.md`) so that each returned row also carries its `user_session_id`, the UUID that the per-request session-binding check of `../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md` (contract 25) Section 8, as Paul corrected it on 2026-10-05, compares with the binding cookie (sub-slice S6-4). `supabase/migrations/20261005000000_active_user_session_lookup_session_id.sql` drops and recreates the function in one transaction, because PostgreSQL cannot replace a function whose return columns change, and keeps everything else: the one `uuid` argument, `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER` owned by `postgres`, an empty search path, one schema-qualified SELECT of `identity.user_session` with only the account and `session_status = 'active'` predicates and no expiry pre-filter, `LIMIT`, `ORDER BY`, or exception handler, and the same grants (all privileges revoked from PUBLIC, EXECUTE revoked from `anon` and `authenticated` and granted to `service_role`). It raises nothing of its own: an absent or null account returns no rows. Unlike the dormant step 6 modules, it has runtime callers: the `/admin/access` composition (`adminAuthSource.ts`) and the Suggested Waypoint request dependencies (`suggestedWaypointRequestDependencies.ts`) reach it through `serviceRoleRpcExecutor.ts`, and `supabaseAuthQueryClient.ts` reads only the four columns it names from each row, so the added column changes nothing there until S6-4 carries the UUID and `expires_at` to the allow result. The UUID grants nothing on its own and stays out of logs, errors and evidence (contract 25 Sections 8 and 14). Two pgTAP suites, `supabase/tests/active_user_session_lookup_*_test.sql`, prove its shape, hygiene, grants and real path; the real-path suite compares session UUIDs only inside SQL, so a failing assertion prints none. The banked `admin_access_rpc_*` suites are unchanged.

The dormant login step 6 sign-in lookups (sub-slice S6-5) keep a sign-in's account and evidence checks inside two read-only database functions. `public.solmind_resolve_login_account` takes only an identifier, its type (`email`, or `username` for the `admin` role only) and the role the route's login path fixes. Its stored-state predicates are ones the banked functions already use: the issuance function's sign-in contact check (an active, verified, sign-in-enabled email) and its canonical email check, applied to the contact's stored email, session creation's account and role checks (an active account and an active role assignment with no revocation time), and the one active `supabase` provider identity that the identity bridge asserts. It returns the account, the contact, that email and the bound provider user id only when exactly one candidate exists; every ineligible, unknown or ambiguous identifier gives the same zero rows, so the route can answer every identifier with one acknowledgment, and neither path returns an email the issuance function would refuse. A typed email must pass the issuance function's own check, so login step 6's contact normalizer (S6-1) and issuance accept the same set. A typed username is checked only for what the schema already requires of a username (not blank) and must already be lowercase, so that it compares with `lower(username)`, the expression of the unique username index; no other username form is imposed, and the Admin's sign-in route (S6-9) must pass it lowercased. `public.solmind_confirm_redeemed_login_challenge` takes the server-derived account, the exact selector the route has just redeemed and the expected purpose, and returns one row: `true` only when that challenge is bound to that account with a contact, has that purpose, is used and not invalidated, and is fresh under `identity.session_creation_freshness_policy` with the session function's comparison, measured from the start of the calling statement; `false` for every other state, with no reason. It is a check before the Explorer's Supabase exchange, not a consumption check: the Explorer route (S6-8) must have its own `redeemed` answer for that selector in the same request, and then `true`, before it asks Supabase for a session, so that a code one person redeemed cannot make a Supabase session for an account someone else typed; the session function still checks everything again. Both functions are STABLE, so they cannot write; a malformed argument raises one fixed identifier that carries no part of the input, and neither has an exception handler or takes a lock. EXECUTE is granted to `service_role` only: `anon` and `authenticated` execution is denied, and service-role RPC execution through the Data API stays available. They have no caller, route, cookie, provider action, cloud path, or real-user flow, and the sign-in routes remain separately gated.

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
