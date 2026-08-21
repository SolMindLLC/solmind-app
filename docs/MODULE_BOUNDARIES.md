# SolMind App Module Boundaries

Version: 0.2.2
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
thin Server Components for the authenticated read-only S03 Explorer inbox and
detail. They must not import or extend `ExplorerExperiencePrototype.tsx`.

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
- `ExplorerSuggestedWaypointInbox.tsx` and
  `ExplorerSuggestedWaypointDetail.tsx` own authenticated read presentation
  only. Their browser contracts admit exact delivered-current-version and
  Explorer-private engagement fields, then reject Guide-only or inferred data.
- `GuideSuggestedWaypointRelationshipEntry.tsx`,
  `GuideSuggestedWaypointRelationshipList.tsx`, and
  `GuideSuggestedWaypointDetail.tsx` own authenticated Guide read presentation
  only and remain relationship-scoped.

The retained fixture UIs do not access a provider, database owner, Server
Action, Route Handler, cookie, browser storage, notification, or real Guide
record. The authenticated S03 read components use thin same-origin routes over
server-derived request authority and exact role-safe projections. No current
Suggested Waypoint UI invokes a human command, worker, provider, deployment, or
real-user activation.

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
accepted-input set. A later Guide or Explorer POST route must call this guard
before auth or executor IO and must still use the existing request-dependency
and composition owners.

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
activation. Separately reviewed thin Route Handlers build its read-only cookie
adapter and invoke only the closed Guide or Explorer read operations.

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
uses its selector subset; the human command composition remains dormant until a
later route or Server Action invokes it without widening browser authority.

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

The banked dormant DEF5-S3 issuance foundation keeps the database boundary narrow: `public.solmind_issue_verification_challenge` is a service-role-only, purpose-built `SECURITY DEFINER` operation over `identity.verification_challenge`, `identity.contact_method`, and the exact Family B `audit.audit_event` row. Its partial unique index independently limits each normalized-contact/purpose pair to one structurally open challenge. It does not authorize a route, delivery provider, invitation acceptance, session creation, self-signup, Guide assignment, or rate-limit implementation. The outer app/route layer must establish invitation or self-signup eligibility before calling it, and no runtime caller may be added until the separately mandatory resend and lockout controls are implemented.

The banked dormant DEF5-S4 slice keeps session mutation separate from redemption and provisioning. `public.solmind_create_user_session` consumes committed account-bound `login` or `role_reentry` evidence, owns account-wide supersede-then-create serialization, and embeds its exact Family B audit rows. Its freshness policy and both uniqueness indexes are hidden database backstops, not client authorization. Corrective migration `20260716001000_user_session_creation_chronology_guard.sql`, banked in `d2fbb0e`, preserves the writeless exact-retry branch and requires never-sessionized evidence to be strictly newer by `(used_at, challenge UUID)` than every prior session-linked evidence tuple for the account; chronology denial is fixed and zero-write. The three DEF5-S4 plans contain 49/51/50 assertions, and clean reset passed 14 files / 502 assertions. The banked slice creates no caller, route, cookie, provider action, account/profile/role provisioning, invitation or Guide assignment dependency, cloud path, or real-user flow.

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
