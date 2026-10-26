# SolMind App

SolMind is an AI-assisted reflective support platform for human Guides and Explorers.

This repository contains the SolMind MVP0 application shell built with Next.js, React, TypeScript, and Tailwind CSS.

## Audience and Stable Orientation Rule

This README is for developers, reviewers, and AI assistants who need a stable
orientation to the `solmind-app` repository.

Keep this file focused on durable repository purpose, architecture, routes,
local development, verification, and safety or security boundaries. It is not
an execution-status owner. Do not add:

- active weekly priorities or temporary operating status;
- project traceability IDs or other execution identifiers;
- commit hashes, proposal states, or banking evidence; or
- ordered work queues or instructions for the current slice.

Record exact implementation status and evidence in the MVP0 Slice Ledger,
current priorities and decisions in the active weekly execution workspace, and
implementation ordering in the MVP0 Implementation Task Breakdown. Update this
README only when durable repository capabilities, structure, boundaries, setup,
or validation expectations change.

## Repository Scope

The current app pairs an interactive deterministic Explorer prototype with
static MVP0 preview pages and several foundation-first backend modules. These
surfaces are development and review artifacts. Explorer email-code sign-in, a protected
minimal home and sign-out have explicit runtime owners; that home does not activate
Virtual Guide conversations or change the deterministic `/explorer` prototype.

User-facing routes:

```text
/
/login
/login/explorer
/explorer/home
/login/guide
/guide/home
/login/admin
/admin/home
/admin
/guide
/guide/explorers/avery/waypoint-suggestions
/guide/waypoint-suggestions
/guide/waypoint-suggestions/[relationshipId]
/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]
/explorer
/explorer/compass-comparison
/explorer/conversation
/explorer/waypoints
/explorer/waypoints/[suggestedWaypointId]
```

Server route handlers:

```text
/admin/access
/login/explorer/send
/login/explorer/verify
/login/guide/send
/login/guide/verify
/login/admin/send
/login/admin/verify
/logout
/explorer/conversation/state
/explorer/conversation/commands
/guide/waypoint-suggestions/relationships
/guide/waypoint-suggestions/[relationshipId]/suggestions
/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]/detail
/explorer/waypoints/suggestions
/explorer/waypoints/[suggestedWaypointId]/detail
```

Current route purpose:

| Route | Purpose |
|---|---|
| `/` | Public landing page (preview) |
| `/login` | Explorer email-code and Guide/Admin password/code sign-in |
| `/login/explorer` | Fixed Explorer sign-in and re-entry |
| `/explorer/home` | Server-authorized minimal Explorer home with finite-session reminder and sign-out |
| `/login/explorer/send` | Same-origin Explorer code request through the local email catcher |
| `/login/explorer/verify` | Same-origin verification, session creation and fixed-home result |
| `/logout` | Same-origin sign-out with explicit confirmed and uncertain outcomes |
| `/login/guide` | Guide email/password/code sign-in and fixed re-entry |
| `/login/guide/send` and `/login/guide/verify` | Same-origin Guide POSTs; local email only |
| `/guide/home` | Fixed-Guide guarded home with shared sign-out |
| `/login/admin` | Admin email-or-approved-username/password/code sign-in and fixed re-entry |
| `/login/admin/send` and `/login/admin/verify` | Same-origin fixed-Admin POSTs; local email only |
| `/admin/home` | Fixed-Admin audited home with finite-session reminder and shared sign-out |
| `/admin` | Admin dashboard preview |
| `/guide` | Guide dashboard preview |
| `/guide/explorers/avery/waypoint-suggestions` | Deterministic fixture-backed Human Guide Suggested Waypoint list, draft, Pull Back, sent-detail, and receipt review surface |
| `/explorer` | Deterministic Explorer onboarding, First Compass, Waypoint, exact-summary review, and non-live Guide-boundary prototype |
| `/explorer/compass-comparison` | Deterministic Explorer conversation-first review surface with a fixed local Virtual Guide script, Compass and Forming Waypoint, provenance-linked quotations, and three independent sharing explanations |
| `/explorer/conversation` | Public data-free conversation shell; private state and commands require separate server authorization |
| `/explorer/conversation/state` | Uncached authenticated Explorer conversation/history read |
| `/explorer/conversation/commands` | Same-origin bounded JSON command boundary; default AI/provider configuration remains held |
| `/explorer/waypoints` | Authenticated read-only Explorer Suggested Waypoint inbox over the banked `explorer.list` request composition |
| `/explorer/waypoints/[suggestedWaypointId]` | Authenticated read-only Explorer Suggested Waypoint detail over the banked `explorer.get` request composition |
| `/admin/access` | Opaque server-side Admin access probe returning only `{ allowed }` |
| `/guide/waypoint-suggestions/relationships` | Read-only authenticated Guide entry selector for Suggested Waypoints; returns only relationship ID, Explorer display name, relationship creation time, cursor, and count |
| `/guide/waypoint-suggestions` | Authenticated read-only Guide relationship entry page |
| `/guide/waypoint-suggestions/[relationshipId]` | Authenticated relationship-scoped Guide Suggested Waypoint list |
| `/guide/waypoint-suggestions/[relationshipId]/[suggestedWaypointId]` | Authenticated relationship-scoped Guide Suggested Waypoint detail with bounded pending-version Pull Back |
| `/guide/waypoint-suggestions/[relationshipId]/commands` | Authenticated same-origin Guide command route; the current detail UI calls only Pull Back |

The `/explorer` route hosts a browser-memory-only deterministic prototype. It:

- displays the preferred-name placeholder without collecting it again;
- submits the approved three required and three optional onboarding questions;
- offers a distinct, skippable First Compass;
- starts in valid zero-point Discovery mode;
- uses deterministic local responses and Explorer-confirmed Priority,
  reorientation, and private-Waypoint states;
- shows at most eight Compass points and preserves categorized overflow under
  `Other paths`;
- supports exact main-point and one-detail-level inclusion choices;
- requires a fresh exact final review before freezing an in-memory Shared
  Snapshot;
- supports `Not ready to share` with no Guide-visible conversation artifact
  and no auto-send; and
- projects only submitted onboarding answers and the exact confirmed Shared
  Snapshot into an explicitly non-live Guide result.

It makes no provider call and uses no database, route handler, cookie,
`localStorage`, `sessionStorage`, or other persistence. Refreshing clears the
experience. It does not create a real Guide session, send information, deploy a
feature, or affect a real user.

The bounded `/explorer/compass-comparison` refinement is also deterministic and
browser-memory-only. It demonstrates the conversation-first layout, a movable
current attention distinct from confirmed Priority, a conversation-mediated
Forming Waypoint, exact supporting-quotation provenance, and separately
explained whole-conversation, Reached-Waypoint, and exact-quotation sharing.
Unbuilt destinations say `Not connected yet`; no sharing action grants access.
Its typed message composer receives only fixed local replies. It makes no
provider, persistence, authentication, database, notification, or real-user
call, and refresh/reset clears its local state.

The separate `/explorer/conversation` shell contains no private server-rendered
props. Its uncached state read and same-origin JSON commands derive current
Explorer authority on the server. Browser operation IDs select exact retries;
they do not identify the actor or authorize a provider call. Private history,
Compass items and chosen Waypoints have protected persistence owners, while the
deterministic previews above retain their browser-memory-only behavior.

The default conversation request factory supplies authentication and the retained
repository, with no provider, context builder or private operational readiness.
Its deliberate formation method uses the atomic v3 mutation wrapper, which
requires current known-clear policy; the old write grant stays retired.
The separate private controller and safety transport require explicitly supplied
trusted capabilities. Their presence does not activate the browser, approve a
methodology pack or verify resource contacts. Saved pending work, unknown command
acknowledgment and transient assistance must not appear as a confirmed saved reply;
exact replay never authorizes another provider dispatch.

The separate `/explorer/waypoints` route now composes an authenticated,
read-only inbox and suggestion detail over the server-derived Explorer
request boundary. It validates exact browser-safe projections, exposes only
delivered/current-version content plus Explorer-private read state and a
deliberate dated receipt acknowledgement, and returns value-free denied or
failed states. It adds no command, worker, provider, deployment, or real-user
activation. The earlier deterministic Explorer fixture component remains
retained design evidence but no longer owns this route.

The paired `/guide/explorers/avery/waypoint-suggestions` route is deterministic
and browser-memory-only. It demonstrates a Guide's Explorer-context list,
Guide-only draft review, the five-minute Pull Back grace period, open sent
detail, and a deliberately supplied receipt acknowledgement. It reports no
passive Explorer opens, private comparison, private question, or use in an
Explorer-owned Waypoint, and it performs no real save, send, provider, database,
notification, or user action.

The authenticated Guide suggestion detail adds the first production command UI
caller: Pull Back for an exact pending version. The browser preserves one exact
serialized request and operation ID across a transport-uncertain retry, then
reloads the authoritative detail. Its visible countdown is orientation only;
the server and database deadline decide availability. A successful Pull Back
returns the suggestion to Guide-only draft state and does not delete it. The
pending version identifier is never rendered, announced, logged, or placed in a
URL, and Explorer projections remain unchanged. Save, schedule, correction,
withdrawal, delivery-worker, provider, deployment, and real-user activation
remain separately gated.

Backend foundations present in the repository (high level):

- Supabase schema foundations: MVP0 schemas and tables exist through migrations under `supabase/migrations`, with Row Level Security enabled deny-by-default on application tables.
- Provider-neutral Virtual Guide S03B conversation contract: a direct-import,
  server-only boundary validates the already-authorized compact S03A context
  serialization and opaque invocation/binding/snapshot/fingerprint identifiers,
  calls only an injected transport with bounded timeout and cancellation, and
  validates one exact, deeply immutable response with closed value-free errors.
  Tests use an in-memory fake transport. It does not retrieve context, refresh
  authorization or consent, verify fingerprints, select or call a provider,
  persist or audit messages, expose a route, connect the Explorer UI, deploy,
  or affect a real user.
- Authorized Virtual Guide S03C context composition: a second direct-import,
  server-only boundary obtains one current server-derived authorization
  snapshot, proves self-Explorer/account/session/relationship/adult/onboarding
  bindings and the complete active required-consent set, runs the S03A
  allowlisted projection, fingerprints its exact compact serialization, then
  revalidates the authorization version before returning an S03B request. Its
  source is injected and synthetic in tests. It does not load a concrete
  database, persist a snapshot, create pre-provider audit evidence, select/call
  a model, expose a route, connect the UI, deploy, or affect a real user.
- Protected pre-dispatch evidence: security-definer transactions bind current
  actor/session/role, consent, relationship, Practice/Organization, exact context
  bytes and immutable provenance before any separately authorized provider call.
  Historical evidence remains unchanged. The private successor uses AV3 authority
  with separately bound current conversation policy and governed methodology;
  AV2 remains a distinct legacy contract. No retained evidence or exact replay
  grants a second dispatch or operational approval.
- OpenAI Luna prose transport adapter: a direct-import, server-only implementation
  of the provider-neutral conversation seam for the Responses API. It fixes model
  `gpt-5.6-luna`, medium reasoning, `store: false`, one endpoint and one bounded
  plain-text response. Tests inject fake HTTP and a deterministic message ID.
  The adapter reads no environment variable, makes no call by itself, is not
  wired to a route or UI. Its legacy predispatch write capability is retired;
  retained historical receipts cannot authorize a new call. The private safety
  adapter is a separate boundary with its own protocol and activation gates.
- Private conversation safety/configuration: server-only literal candidate data
  is parsed into a copied frozen projection. The candidate contains no operational
  readiness, actual human approval or approved methodology identity. Pinned fallback
  helpers and the same-call safety result preserve valid classification separately
  from candidate prose. The private controller injects governed context, provider,
  verified rendering and bounded operational-signal capabilities; the default
  factory supplies none. Structural checks and fake transports cannot prove
  detection quality, clinical quality, resource suitability or genuine model safety.
- Closed private conversation repository: six scalar RPC capabilities own read,
  first-send ensure, fallback observation, governed preparation, terminal settlement
  and deliberate Compass/Waypoint mutation. The repository accepts an injected
  server client and exposes no generic select or RPC method. The old browser
  contract remains separate from the unactivated private result wrapper.
- Auth/RLS request-auth boundary, real Admin auth-source loading, server-only hardening, and enumerated RPC transport under `src/lib/solmind/auth` and `src/lib/solmind/supabase`.
- Suggested Waypoint first-write security predecessor: one server-only trusted
  application-origin configuration, one same-origin JSON request guard with a
  16,384-byte bounded stream, and Unicode-scalar integrity at the existing
  command-composition boundary. It adds no POST route or database caller.
- Auth/RLS audit persistence for `/admin/access`: the bounded audit event model, the `public.solmind_record_audit_event` database writer function, the closed-allowlist app writer chain, and the runtime wiring.
- Verification and session database primitives: the Explorer server composition calls verification-challenge issuance/redemption, account lookup, redeemed-challenge confirmation and account-bound session creation; logout ends the presented session through its separate writer. The all-history chronology correction and role/session checks remain database backstops. Guide and Admin use their separately composed fixed password/code paths.
- Dormant Explorer invitation foundations: the protected invitation-acceptance preparation helper, capacity and lock-key behavior, shared invited-identity provisioning, Guide-to-Explorer invitation issuance, replacement, revocation, and Explorer invitation acceptance with one `intake_pending` relationship.
- Dormant Explorer S02 foundations: a protected 1-100 day Shared Snapshot sendability setting (default 7), a server-only fixed-key reader, a service-role-only audited mutation, and a manually invoked local synthetic Guide/Explorer fixture.
- Dormant Summary and Shared Snapshot persistence foundation: immutable Guide-authored Summary revisions and sections, an authoritative publication record and fail-closed Explorer projection, Explorer-private exact-review drafts, immutable Explorer-confirmed Shared Snapshots with preserved lineage, and bounded service-role-only publication, unpublication, confirmation, and integrity surfaces. It has no application caller, permissive RLS policy, direct-table role grant, hosted data, provider action, deployment, or real-user path.
- Dormant Suggested Waypoint persistence and security foundation: distinct Guide draft, pending outbound, immutable delivered-version, Explorer-private read, shared receipt, protected preference, and replay-proof owners; a closed six-command/five-query service-role-only catalog; and the protected 60-3600 second send-grace policy (default 300). A forward-only Explorer-list correction now distinguishes a legitimate empty inbox under exactly one authorized active Guide relationship from one value-free unavailable result for zero, multiple, or unauthorized relationship derivation. Separately banked authenticated read callers reach minimized Guide and Explorer projections; commands, hosted scheduling, providers, deployment, and real-user activation remain absent.
- Closed Suggested Waypoint S03 RPC transport: server-only exact-call and
  exact-response validation over nine human functions and one separately
  constructed delivery-worker function. The dormant Admin operational query is
  excluded. The six command validators preserve the canonical closed outcome
  algebra, exact function-specific nullable fields, and call/result binding;
  transport failures remain value-free and the modules stay off the shared
  Supabase barrel. No authenticated composition, relationship enforcement,
  route, server action, hosted worker, or UI caller is included.
- Suggested Waypoint S03 authenticated composition primitive: exact
  client-safe Guide/Explorer request validation, request-auth actor/role
  derivation, Guide relationship enforcement, server-derived actor injection,
  server-resolved initial suggestion/version identifiers, single-line
  Guide-authored destinations, exact-function-bound zero-row detail denial,
  exact Explorer-list relationship-invariant denial, and fixed browser-safe
  results. It remains a direct-import server-only dependency;
  separately reviewed thin read routes call it without adding a Server Action,
  hosted worker, provider, deployment, or real-user activation.
- Suggested Waypoint S03 concrete request dependencies: one request-scoped,
  direct-import server-only factory wires verified request identity,
  enumerated auth-record reads, the closed human executor, and UUIDv5 scoped
  suggestion/version identifiers. The relationship-selector and human request
  composition now have bounded read-only route callers for Guide relationship
  selection, Guide list/detail, and Explorer list/detail. Human commands,
  worker, provider, deployment, and real-user activation remain dormant.
- Suggested Waypoint S03 Guide relationship-selector route: the thin dynamic
  `/guide/waypoint-suggestions/relationships` JSON boundary accepts only one
  closed page size plus one optional opaque cursor, derives Guide authority
  from request cookies and server records, and returns the already-minimized
  feature-specific projection. It is not the canonical Guide Explorer roster,
  does not replace either fixture UI, writes nothing, and is not deployed.

Important technical boundaries:

- `/admin/access` is an opaque JSON probe that returns only `{ allowed }`. It does not yet mean the `/admin`, `/guide`, or `/explorer` pages are fully protected runtime workflows.
- Direct application-table access stays deny-by-default. Feature authorization
  belongs to closed server/request and SQL capabilities; permissive RLS policies
  or broader table/schema grants require separately reviewed authority.
- Audit persistence is path-specific. The bounded `/admin/access` writer requires
  its guarded-read row before the decision row and outward allow. Protected
  conversation creation, positive-evidence enrichment and policy transitions use
  their own closed inline accountability tuples. A generic event grants no routine
  access to private source records; the `audit` schema stays off the Data API.
- Verification/session callers and local role-login routes are separate from the
  dormant provisioning, invitation, Summary and Shared Snapshot workflows. Private
  conversation storage and deterministic formation owners do not establish a
  genuine AI conversation, complete Route/Waypoint lifecycle, operational timing,
  safety responder, notification, deployment or real-user workflow.
- The Explorer prototype does not turn those foundations into a runtime path.
  The additional Explorer persistence owners, application callers, operational
  timing, and genuine server-side Virtual Guide conversation require separately
  reviewed implementation work.
- Suggested Waypoint S03 now has bounded browser-reachable read paths for the
  Guide relationship selector, Guide relationship-scoped list/detail, and
  Explorer list/detail. Those routes derive actor and role from authenticated
  request state, validate exact minimized results again at the browser edge,
  and stay read-only. The three paginated lists share one strict browser-safe
  page-size/cursor/query contract. Only the exact database invalid-cursor error
  from the function that received the cursor becomes the value-free
  `refresh_required` result; a later-page client retries page one once with the
  same page size, clears cursor history only after success, and keeps the last
  safe page after malformed or operationally failed resets. A current authority
  denial clears the previously displayed page. They do not activate human commands, delivery scheduling,
  worker authorization, providers, deployment, or real-user readiness. All
  server-only S03 owners stay off client/shared barrels.

Protected conversation storage uses `ai.ai_interaction_session`,
`ai.ai_interaction_message`, immutable `ai.ai_context_snapshot` records and bound
`ai.ai_model_invocation` provenance, `ai.explorer_conversation_state`,
`ai.explorer_conversation_operation`, `ai.explorer_conversation_compass_item` and
`content.waypoint`. The private successor adds nullable/no-backfill policy state
and `ai.explorer_safety_evidence`. An actually new first-Send container alone may
initialize clear policy after complete operational configuration and current
authority; a held configuration or read creates nothing. Existing unknown state
must not be repaired or replaced with a fresh clear conversation.

Minimum private evidence requires an actual numerical positive observation.
Level 0 creates no safety row; minor-only 0 uses the distinct monotonic adult-policy
stop. Private evidence stores no copied conversation text and grants no routine
Guide/Admin access. Prior private safety records never enter the model context.
Manual sensitive-content retention and
closed actor-authorized capabilities remain required. Terminal settlement may
preserve observed positives after login ends, while final current authority gates
outward content. One terminal intent is attempted once; unknown acknowledgment
does not authorize a retry, contradictory post or provider redispatch.

The six private RPC names are fixed:

```text
public.solmind_read_explorer_conversation_v3
public.solmind_ensure_explorer_conversation_v3
public.solmind_observe_explorer_conversation_fallback_v3
public.solmind_prepare_explorer_conversation_turn_v3
public.solmind_settle_explorer_conversation_turn_v3
public.solmind_mutate_explorer_conversation_v3
```

The private successor retires direct service-role execution of
`public.solmind_prepare_virtual_guide_predispatch`,
`public.solmind_prepare_explorer_conversation_turn`,
`public.solmind_prepare_governed_explorer_conversation_turn`,
`public.solmind_complete_explorer_conversation_turn` and
`public.solmind_mutate_explorer_conversation`. The first retirement covers every
formerly allowed session type. Definitions and historical evidence remain;
owner-only access and old receipts do not restore a dispatch/write capability.
The unchanged default factory does not silently switch to the private repository.

Final private preparation inspects the actual allowed onboarding/history/immediate
sources and excluded source fields under bounded locks. It keeps identity checks
separate from whole decoded-value matching, preserves actual Summary-section and
containing-revision provenance, and refuses busy, unknown or overflowing inspection.
A confirmed exclusion must commit its content-free audit without dispatch evidence.
Whole-field matching does not prove semantic origin or catch every private fragment
or paraphrase. Scheduled snapshot-integrity/Admin paging, genuine operational
configuration, human approval and provider activation remain separate prerequisites.

Authoritative implementation status and exact evidence are tracked in:

- `../solmind-docs/execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md` (Section 11);
- `../solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`; and
- `../solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`.

## Canonical SolMind Roles

Use these role names consistently:

- Admin
- Guide
- Explorer

Do not use deprecated generic terms such as "client" for Explorer-facing product language.

## Canonical Assistant Names

Use these assistant names consistently:

- SolMind Virtual Guide - Explorer-facing assistant
- SolMind Guide Assistant - Guide-facing assistant

Accepted shorthand is allowed in limited UI copy after the canonical name is established, but documentation and architecture references should use the full names.

## Authentication Model

The MVP0 authentication model is:

| Role | MVP0 auth model |
|---|---|
| Explorer | Passwordless email or SMS verification |
| Guide | Password plus email or SMS verification |
| Admin | Admin password plus verification code |

Do not describe Guide login as passwordless. Guide authentication copy must remain aligned with the SolMind documentation repository.

## Source Layout

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    login/page.tsx
    admin/page.tsx
    admin/access/route.ts
    guide/page.tsx
    explorer/page.tsx
    explorer/conversation/page.tsx
    explorer/conversation/state/route.ts
    explorer/conversation/commands/route.ts

  components/
    solmind/
      BackLink.tsx
      ConversationPreview.tsx
      DashboardCard.tsx
      ExplorerExperiencePrototype.tsx
      ExplorerConversation.tsx
      ExplorerConversationFormation.tsx
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
      explorerConversationContract.ts
      explorerConversationFormation.ts
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
        explorerPrivateConversationRepository.ts  six closed injected private RPC ports
      virtual-guide/
        explorerConversationContext.ts  strict legacy and explicit AV3 context entries
        explorerPrivateConfigurationCandidate.ts  inert server-only literal candidate
        explorerPrivateConfiguration.ts  copied/frozen candidate validation
        explorerSafetyReplyContract.ts  same-call classification and optional prose
        explorerSafetyReplyInvocation.ts  one bounded injected invocation
        openAiLunaExplorerSafetyTransport.ts  dormant injected HTTP adapter
        explorerConversationSafety.ts  pinned fallback and trusted selection
        explorerPrivateConversationComposition.ts  unactivated private controller

eslint-rules/
  explorer-source-isolation.mjs  exact production-source import profiles
eslint.config.mjs

supabase/
  config.toml
  migrations/    MVP0 schema foundations with Row Level Security enabled deny-by-default
    20261025010000_explorer_source_exclusion.sql  internal final-source inspection/audit
    20261025020000_explorer_private_safety_lifecycle.sql  private policy/evidence and scalar lifecycle
  seed.sql
```

The Explorer prototype boundary is intentionally narrow:

- `src/app/explorer/page.tsx` is a thin Server Component.
- `src/components/solmind/ExplorerExperiencePrototype.tsx` is the only new
  `"use client"` entry point and owns transient interaction state.
- `src/components/solmind/SessionCompass.tsx` is controlled and
  presentational.
- `src/lib/solmind/explorerExperience.ts` owns pure deterministic transitions,
  exact selection, snapshot freezing, and the narrow non-live Guide
  projection.
- `src/lib/solmind/onboarding.ts` owns the structured-field definitions and
  distinct required-form/optional-First-Compass states.

Server-only modules under `src/lib/solmind/auth` and `src/lib/solmind/supabase` are kept off the shared client barrels, and each module area has co-located `__tests__` unit tests.

Server-only `src/lib/solmind/virtual-guide/` owners also stay off shared/client
barrels. The explicit source-isolation graph covers 21 profiles with six erased
type-only edges. Preserve its exact runtime/type specifiers and restricted globals;
the private repository's SDK import remains type-only. This static boundary is
not a JavaScript sandbox or proof of injected capabilities or source currentness.
AV3 context entries coexist with strict AV2 entries; the compact input selection
remains `wi007-v0.1+onboarding-fields-v2`, separate from the private safety output
protocol and request mode. Candidate configuration getters never activate a factory.

## Module Boundary Pattern

Use this structure as the app grows:

```text
src/app/...                 = route files and page composition
src/components/solmind/...  = reusable UI components
src/lib/solmind/...         = product constants, workflow definitions, and product rules
```

Route files should stay small. Product rules and reusable constants should not be buried inside route files.

A mock Guide result must receive the narrow projection from
`createNonLiveGuideProjection`; never pass it the complete Explorer state.

## AI Maintenance Guidance

Before using an AI coding assistant or agent on this repo, read:

```text
AGENTS.md
docs/AI_MAINTENANCE_MAP.md
docs/AGENT_TASK_RULES.md
docs/MODULE_BOUNDARIES.md
```

The project is intentionally structured so that smaller AI coding assistants can safely work on one bounded task at a time.

The canonical product documentation lives in the sibling repository:

```text
../solmind-docs
```

Most binding references before auth/database work:

- `00_SolMind_Repository_Index_v1_0.md`
- `execution/01_SolMind_Phase0_Build_Spec_v1_0.md`
- `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md`
- `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md`
- `execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
- `execution/07_SolMind_MVP0_Implementation_Task_Breakdown_v1_0.md`
- `execution/08_SolMind_MVP0_Test_Plan_v1_0.md`
- `execution/20_SolMind_MVP0_UX_And_System_Architecture_Blueprint_v0_1.md`

## Secrets and Environment Rules

Never expose server secrets through `NEXT_PUBLIC_` variables.

In particular:

- Do not put Supabase service-role keys in `NEXT_PUBLIC_*`.
- Do not expose bootstrap tokens in client components.
- Keep Admin bootstrap credentials and server-only tokens on the server side only.
- `.env.example` exists at the repo root; keep it current as environment-dependent code grows, and never place real secrets in it.

## Local Development

Install dependencies:

```powershell
npm.cmd install
```

Run the local development server:

```powershell
npm.cmd run dev
```

Then open:

```text
http://127.0.0.1:3000
```

Both `npm.cmd run dev` and `npm.cmd run start` (which serves the build made by
`npm.cmd run build`) pass `-H 127.0.0.1`, so the server listens only on this
computer's loopback address, `127.0.0.1`, instead of the Next.js default
`0.0.0.0`. The reason is check 1 in Section 17 of
`../solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`:
other devices on the network must not be able to reach the app. Starting
Next.js any other way, such as `npx.cmd next dev` without `-H`, does not add
the flag. Open `http://127.0.0.1:3000`, not `http://localhost:3000`: they are
different origins, and the local Supabase `site_url` in `supabase/config.toml`
is `http://127.0.0.1:3000`.

## Verification Commands

Run these before committing code changes:

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

The shared Playwright harness first builds the app, then runs the deterministic
Explorer and Human Guide Suggested Waypoint review routes in desktop and
narrow Chromium viewports. It
checks keyboard operation, focus continuity, responsive navigation, polite
status announcements, and companion automated accessibility findings without
using Supabase, Docker, providers, hosted data, or real users. See
`tests/browser/README.md` for one-time browser installation, the bounded local
port, failure artifacts, and teardown expectations.

On Windows PowerShell, use `npm.cmd` instead of `npm` if PowerShell blocks `npm.ps1`.

## Git Workflow

Use small, focused commits. Prefer staging specific files over `git add .`.

Recommended pattern when Paul is personally running Git commands:

```powershell
git status
```

```powershell
git add [specific file/folder]
```

```powershell
git commit -m "Describe the focused change"
```

```powershell
git push
```

```powershell
git status
```

Claude Code local executor exception: Claude Code must stop before `git add`, `git commit`, and `git push` unless Paul explicitly approves those actions in the current task.

## Implementation Planning

The exact implementation order, active proposals, banking evidence, and
current priorities are controlled by the MVP0 Slice Ledger, MVP0
Implementation Task Breakdown, and active weekly execution workspace. Do not
duplicate that changing execution state here.

Durable implementation boundaries:

- Keep the Explorer prototype deterministic and non-live until protected
  persistence is separately designed, reviewed, and validated.
- Add genuine server-side Virtual Guide behavior only after provider, context,
  consent, storage, failure, and leakage-test boundaries pass.
- Keep local synthetic Guide and Explorer fixtures out of production migrations
  and universal seed data.
- Expand RLS, audit, consent, safety, and Guide runtime behavior only through
  separately reviewed changes.

Safety, consent, role access, and privacy behavior must be implemented carefully and verified before production use.

## Local Explorer sign-in boundary

The server composes the existing code-issuance/redemption services, account
lookup, provider identity bridge and SolMind session creation. A valid provider
token alone does not authorize the home: every request must also bind the
current active Explorer session and application records. The home receives only
expiry and server-observation timestamps. Sign-out is a POST; a missing or
uncertain response must not be presented as confirmed remote completion.

Local development uses the existing Next scripts and local Supabase stack.
Configure the public local Supabase URL/anon key, server-only service-role key,
trusted loopback application origin and independent verification pepper listed
in `.env.example`. Never commit actual values. Email goes to the local catcher;
no external delivery provider is activated. A database reset does not create
demo accounts; the separately approved local fixture/setup owns those records.
The optional credential-pair proof key is independent of the pepper. Leaving it
unconfigured disables proof-authorized renewal, not ordinary sign-in.

Use Next's standard `--webpack` development/build option when a long Windows
validation path exceeds Turbopack's filesystem path limit. This is a tooling
choice, not a change to authentication or a reason to adopt a custom launcher.

A compiled app or a passing signed-out check does not prove successful local
sign-in. Keep actual account/code delivery, successful session/home refresh,
sign-out and subsequent denial evidence in the existing execution/test owners.
For this Explorer integration Paul approved direct functional Chrome proof on
October 19 instead of the earlier custom-launcher/watched-session prerequisite.
Account setup remains Paul-run; necessary database and authorization checks,
complete review, and application/banking assurance remain required. Stay-signed-in renewal, connected Guide/Admin
logins and Virtual Guide conversations are separate increments.

## Connected Guide and Explorer home navigation

Guide connects only email/password/email-code login, protected /guide/home,
refresh and shared /logout. Admin has its separate connected boundary below;
/guide remains the separate
dashboard prototype. Current publication/banking status is owned by SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and any checked banking receipt linked there. Source/check results alone do not
establish banking. SL-069's banked Explorer evidence remains unchanged; R04's
isolated Explorer controls are regression evidence for the Guide slice.

October 21 R04 genuine functional/contention observations and earlier isolated
app/SQL checks are recorded in
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. At 20:17:31 CDT Paul
accepted disclosed timing/capacity risks and deferred real exhaustion/induced
provider/session/cookie failure timing only for private synthetic local use.
The exact approval is
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json.
The original full protocol is not claimed passed; deferred measurements remain
required before broader exposure or real users. Other assurance/effect gates
remain unchanged. This dated Guide-only decision supplies no Admin risk acceptance.

Guide send contains no password. Verify passes typed password unchanged and
checks non-consuming same-account/contact challenge ownership before password.
Neither factor alone permits a session. No remembered-browser/renewal path is
added. Provisional source timing is not constant-time proof or risk acceptance.

Additive Explorer home navigation opens the existing authenticated Waypoint
Suggestions inbox. Collapsed design previews remain explicitly fixed-script,
not connected to an AI or human Guide, not saved/shared, and reset by refresh.
The owning home retains its session/logout lifecycle. The inbox has its own
authentication guard; fixed-script previews retain their no-auth boundary.
Navigation activates no genuine Virtual Guide conversation.

Keep the three existing synthetic accounts and private passwords. An outage
does not authorize a blind shared reset or account recreation. Paul-run demo
setup remains separate. Future first-Admin setup must reuse the approved
username policy. This Guide increment supplied no Admin setup; the separate
Admin login boundary below implements no first-Admin setup.


## Connected Admin source boundary

The Admin chooser branch and fixed /login/admin entry compose email or the
approved Admin username, unchanged password and a SolMind email code. Fixed
POST /login/admin/send contains no password; POST /login/admin/verify uses the
latest typed password and code. Only accepted success permits fixed /admin/home
navigation. Stored account/contact facts never become a browser authority claim.

The dynamic home preserves raw-cookie ambiguity, verifies the current principal,
Admin role, active session and exact binding, and uses the server-only audited
Admin chain once. The post-resolution guarded-read audit write precedes the
Admin allow-decision write; both are required, then expiry is checked again.
Only expiresAt/observedAt reach AdminHome. Refresh re-enters this guard. Reuse the
finite reminder and shared /logout with honest uncertainty and fixed Admin
re-entry; GET does not renew, clear cookies or sign out. /admin remains the
separate prototype, and the home grants no new dashboard or provisioning power.

src/lib/solmind/supabase/adminSignInHttpPorts.ts explicitly selects a provisional
1,500 ms response floor; 3,000 ms lookup/ownership/confirmation deadlines;
5,000 ms provider and 18,000 ms session deadlines. These values and the 60,000 ms
browser response budget establish no adequacy, constant-time or whole-flow bound.
Guide's October 21 evidence and bounded private-local risk acceptance do not
supply Admin measurements or risk acceptance.

Source descriptions alone establish no Admin runtime, assurance, publication or
banking result. Record actual Admin evidence and residual-risk disposition in
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md and use the current slice
entry/checked receipt in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md for publication/banking.
Preserve the three existing accounts/private passwords. No first-Admin setup,
account recreation, password reset, SMS, remembered-browser/activity renewal,
new SQL function/schema, provider conversation or broader Admin workflow is added.
See docs/MODULE_BOUNDARIES.md for exact owner and audit-contract boundaries.

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
