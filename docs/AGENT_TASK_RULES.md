# SolMind App Agent Task Rules

Version: 0.2.2
Last Updated: 2026-10-27
Repo: solmind-app  
Purpose: Define safe rules for AI coding agents and AI assistants working on the SolMind MVP0 application.

## Core Rule



Agents must work in small, bounded, reversible tasks.



Do not ask an agent to broadly "build SolMind," "clean up the repo," "finish the MVP," or "make the app better." Those tasks are too vague and too risky.

## Required Agent Scope Format



Every agent task should include:

1. Objective
2. Files or folders allowed to change
3. Files or folders not allowed to change
4. Expected output
5. Verification commands
6. Commit message suggestion, if applicable

## Good Agent Task Example



```text

Objective:

Refactor the Explorer preview topic list into a reusable component.



Allowed files:
- src/app/explorer/page.tsx
- src/components/solmind/ExplorerTopicList.tsx



Do not modify:
- package.json
- next.config.ts
- src/lib/solmind/roles.ts
- any database or auth files



Expected output:
- Explorer page still renders the same topics.
- Topic list is moved into a reusable component.
- No behavior change.



Verification:
- npm.cmd run lint
- npm.cmd run build
```

## Bad Agent Task Examples



Do not use prompts like these:



```text

Build MVP0.

```



```text

Clean up the codebase.

```



```text

Implement authentication, database, dashboards, onboarding, and safety.

```



```text

Make the app production-ready.

```



```text

Refactor everything.

```

## Repository Safety Rules



Agents must not:

1. Delete files unless explicitly instructed.
2. Rename SolMind product terms without approval.
3. Change role names without approval.
4. Weaken safety, consent, or escalation behavior.
5. Mix Admin, Guide, and Explorer access rules.
6. Describe Guide login as passwordless.
7. Label the human Guide dashboard as the SolMind Guide Assistant dashboard.
8. Add dependencies without approval.
9. Modify `package.json` without approval.
10. Modify database schema without updating the related documentation.
11. Modify Row Level Security policies without review.
12. Expose server secrets through `NEXT_PUBLIC_` variables.
13. Claim success without running verification commands.
14. Run production, cloud, install, dependency, Vercel, or Supabase cloud changes without explicit approval.
15. Run `npx.cmd --offline --no --package supabase@2.115.0 -- supabase db reset` against the existing local development database without first affirmatively verifying immediately before the reset that no other test is currently using it, or while another test is using it. When the preflight verifies that no test is using it, or after the active test completes and a fresh check confirms that no other test is then using it, the agent may run that reset without separate approval for bounded development testing. If database use cannot be determined or the active test does not complete, do not reset; stop and report to Paul. Do not interrupt or invalidate the active test.
16. Drop the existing local development database, its persistent volume, or its local Supabase project/container resources without explicit approval; reset authority does not cover those actions.

## SolMind Role Boundaries



Agents must preserve these baseline role boundaries:

- Admin can manage MVP0 system setup, Guide invites, methodology, and QA.
- Guide can view assigned Explorer summaries, progress, and flags.
- Explorer can interact with the SolMind Virtual Guide and complete onboarding/check-ins.
- A person may hold multiple roles, but MVP0 role switching is not automatic.

## MVP0 Authentication Boundary

Use this model unless the canonical docs are explicitly updated:

- Explorer: passwordless email or SMS verification.
- Guide: password plus email or SMS verification.
- Admin: Admin password plus verification code.

## Safety-Critical Areas

These areas require explicit review:

- self-harm triggers
- relapse-risk triggers
- major contradiction flags
- Guide notification logic
- severe escalation paths
- Explorer consent and privacy
- Admin visibility
- role-based data access
- transcript storage
- Supabase Row Level Security policies
- environment variables and server-only secrets

An agent may propose changes in these areas, but should not implement broad changes without human review.

## Explorer S01 Task Contract

`PRJ01_R-WS09-WI021-S01` is a deterministic, browser-memory-only Explorer
experience. Work in this slice must:

- keep required structured-form completion distinct from the optional,
  skippable First Compass;
- allow Discovery to begin or end with zero Compass points and no invented
  Priority;
- keep the Priority-up frame fixed while current attention moves separately;
- require Explorer confirmation before a proposed Priority reorientation or
  Waypoint is confirmed;
- show no more than eight visible Compass points and preserve categorized
  overflow under `Other paths`;
- keep conversation, Compass, Route, Waypoint, selection, and Private Summary
  Draft state Explorer-private;
- derive the final review from the latest selection and create a Shared
  Snapshot only after separate confirmation;
- keep `Not ready to share` private and never auto-send; and
- pass only submitted onboarding answers plus the exact confirmed Shared
  Snapshot to the explicitly non-live Guide projection.

S01 must not use a provider, database, route handler, cookie, `fetch`,
`localStorage`, `sessionStorage`, URL state, timer, notification, or another
persistence mechanism. It must not imply that the mock Guide result is the
operational `/guide` dashboard. Persistence belongs to
`PRJ01_R-WS09-WI021-S02`; genuine provider conversation belongs to
`PRJ01_R-WS09-WI021-S03`.

The bounded S01R2 `/explorer/compass-comparison` review route inherits those
same prohibitions. Keep its route thin; keep browser orchestration,
presentational parts, and pure deterministic domain transitions separated in
their named owners. Typed Explorer messages receive fixed local replies only.
Compass attention, Priority confirmation, conversation-mediated Waypoint
details, quotation provenance, and the three independent sharing explanations
remain transient and honest about every unconnected destination. Do not add a
provider adapter, route handler, persistence, auth, safety classification, or
real sharing behavior to this S01R2 surface. Those require a separately gated
S03 design and implementation.

The interim `/explorer/conversation-preview` design review inherits the same
prohibitions and is stricter: it has no scripted replies and no working
conversation, Compass, Waypoint, or sharing behaviour. Every functional control
stays focusable with `aria-disabled` and a visible "Not yet implemented:" note
linked by `aria-describedby`; only controls tagged "Layout only: works in this
preview" act, in component memory. Keep each new file at or under 300 lines;
from existing code import only `SOLMIND_LOGO_SRC` and `SOLMIND_TERMS`, plus the
shared `explorerSpeakerStyle.ts` and `ExplorerSpeakerIcon.tsx` and the shared
menu labels leaf `workspaceNavigation.ts` (never `workspaceMenus.ts`); and add
no source-isolation profile. Only
`ExplorerConversationScreenPreview.tsx` imports the sample; the parts take
read-only display props typed in `explorerConversationScreenDisplay.ts`.
The S01R2 files change only in speaker labels and icons, which
`SPEAKER_LABEL_STYLE` reverts.

Explorer menu option A (Paul's decisions, decision queue 2026-11-02 14:07:48
and 22:19:17 CST): both conversation screens draw the September 23 menu, in
the wide rail and in the panel a labelled "Menu" button opens below 64rem; the
icon strip and its spaces toggle are gone. The labels leaf
`src/lib/solmind/workspaceNavigation.ts` imports only
`explorerConversationScreen.ts`; the signed-in menu data and destinations are
in `src/lib/solmind/workspaceMenus.ts`, imported only by the signed-in lib
files (`explorerConversationConnectedScreen.ts`, `explorerWorkspaceFrame.ts`,
`explorerOverviewHome.ts`, `guideWorkspaceFrame.ts` and
`guideDashboardHome.ts`), so the review route never reaches
`routeAccess.ts`. On the signed-in `/explorer/conversation` screen, built
entries are plain full-document links (a plain click on the entry for the
current page keeps the page and a typed message, closes the phone menu and
focuses the conversation heading), and every control not built yet shows a
"Not connected yet" line (the bell beside its icon, named
"Notifications Not connected yet"; grey until 2026-11-03, since then a blue
build note, see Build notes below) and, when activated, one sentence directly
under it, through `NotConnectedProvider`. Notes that describe an area (the
Key Insight, "Ways to begin", earlier-Compass and latest-change sentences) are
shown, since 2026-11-03 each in a blue build-note box with an X instead of an
area marked with the grey label (dated exception, 2026-11-03, Paul's
decision, decision queue 18:05:33 CST: the connected Compass card shows no
forming-point or needle sentence and no "Not connected yet" area; the Waypoint
card and the Key Insight area are unchanged; see AGENTS.md).
Amendment 2026-11-04 (S5): the card now shows forming points and automatic needle moves are implemented; the Compass card still has no explanatory build-note area.
All these sentences are the review drafts
without their prefix, reused pending Paul's wording review; he may reword any
of them. No review-version "Not yet implemented:" note or `data-preview-*`
attribute appears there; only the review version keeps those notes. Since
2026-11-03 the only blue notes, dashed review marks and violet marks on the signed-in
screens are the build notes and removal markers (Build notes, below; amended
2026-11-03, until then no blue note or dashed review mark appeared). The "Return to
Explorer home" link shows when no saved conversation has been started; an
ended conversation links to "Review ended conversations", and confirming End
goes home by itself.

Explorer workspace frame and Overview (same decisions): the other signed-in
Explorer pages (`/explorer/home`, `/explorer/conversations`,
`/explorer/waypoints` and `/explorer/waypoints/[id]`) sit in the role-neutral,
presentation-only `WorkspaceFrame.tsx`, through the thin Explorer wrapper
`ExplorerWorkspaceFrame.tsx` and its data in `explorerWorkspaceFrame.ts`. The
frame reuses the conversation screen's rail, top bar, Menu button, panel and
"Not connected yet" parts and owns layout state only (since 2026-11-03 also
whether the build notes show; its top bar always has the "Build notes"
toggle, Build notes below); keep it at or under 300
lines, ASCII, and free of Explorer and Guide data (the menu entries, names,
breadcrumb root and profile role come in as data), so the Guide menu reuses
it (below). Any change to the shared conversation-screen parts must leave both
conversation screens' markup unchanged. Overview (`ExplorerOverviewHome.tsx`, wording in
`explorerOverviewHome.ts`) shows the Option A home mockup's cards without
names or counts; `ExplorerHome.tsx` keeps every binding, timer, page-event,
sign-out and outcome rule and passes only the pending and warning flags and
the sign-out action. While a sign-out is pending every link on the page shows
in its non-link form. The conversation list and the Waypoint inbox and detail
change only in look and navigation: keep every read, command, state, live
region, focus rule and text (except that on 2026-11-03 the inbox's and
detail's fixed sample name "Mary" became the canonical unnamed "SolMind
Virtual Guide" with the mini mark, `SOLMIND_TERMS.virtualGuide`;
`solmind-docs/canonical/06_SolMind_ScreenInventory_Phase0_v1_0.md`, and an
open review on the conversation list no longer widens the page on phones),
and use the dark pills
(`SuggestedWaypointStatusPill` takes an optional dark surface; the fixture
review surfaces keep the light pills).

Guide workspace menu and Dashboard (same decisions): the signed-in Guide pages
(`/guide/home` and the three `/guide/waypoint-suggestions` pages) sit in the
same `WorkspaceFrame.tsx` with the August Guide menu (Dashboard to
`GUIDE_HOME_ROUTE`; Explorers, "Chat with your Guide Assistant", Appointments
and Archive not connected yet), through `GuideWorkspaceFrame.tsx` and its data
in `guideWorkspaceFrame.ts`; the menu and its draft sentences are in
`workspaceMenus.ts`. Create or rename no route. Never show a sample name such
as "Steve" on a signed-in Guide screen; the SolMind Guide Assistant always
reads as AI (the Dashboard card carries the "AI" badge), and never label
anything the "Guide Assistant dashboard". `GuideHome.tsx` keeps every
session and sign-out rule and passes only the pending and warning flags and
the sign-out action to `GuideDashboardHome.tsx` (wording in
`guideDashboardHome.ts`; shared home parts in `WorkspaceHomeParts.tsx`), which
shows the four mockup cards without names, counts or times. The Guide Waypoint
pages change only in look and navigation (`GuideWaypointSuggestionsPage.tsx`,
no entry current) and keep every read, command, focus rule, live region and
text; only the "Back to Guide dashboard" target moved to `/guide/home`, as a
full-document link (`backFullDocument` on the entry page only), so the server
checks access again instead of a client-side move restoring the Dashboard from
the router cache after a sign-out. Leave
the fixture page `/guide/explorers/avery/waypoint-suggestions`, `/guide` and
`/admin/home` alone.

### Virtual Guide S03B conversation contract

Keep `src/lib/solmind/virtual-guide/virtualGuideConversationContract.ts`
server-only, provider-neutral, directly imported, and absent from shared/client
barrels. It may accept only opaque invocation, Explorer, session, context-
snapshot, and fingerprint bindings plus the exact compact serialized context
already authorized by the S03A kernel. It must validate exact keys and bounded
bytes, sever caller references, pass a frozen request to one injected transport,
enforce caller cancellation and a bounded timeout, bind the exact response to
the invocation, and return only a deeply immutable response or a closed,
value-free error.

Do not add source loading, authorization/consent refresh, fingerprint creation
or verification, context selection, a provider SDK or adapter, environment
access, persistence, audit writing, a route/action, browser code, UI wiring,
deployment, or real-user use to S03B. Fake transports belong only in tests and
must never be a production fallback. Those capabilities require later,
separately reviewed S03 increments.

### Virtual Guide S03C authorized context composition

Keep `src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts`
server-only, direct-import, and off shared/client barrels. Request identifiers
must be produced by trusted server composition, never accepted as proof of
authority. The injected source has exactly two data-function capabilities: load
one authorization snapshot for the requested Explorer/session and revalidate
the minimized authorization proof/version after S03A assembly. Capture those
capabilities before the first await.

Fail closed unless the request actor is the same Explorer account, role context
is Explorer, onboarding is active, adult affirmation is true, the relationship
is active or paused and bound to that Explorer, at least one current required
consent exists, and the accepted set exactly equals the current required set.
The S03A projection must independently validate the same Explorer/session. Hash
the exact compact S03A serialization, not caller material. Prompt-injection text
remains bounded data and cannot widen context authority. Return only a frozen
S03B request and minimized frozen proof; all errors remain closed and value-free.

S03C final revalidation is composition-time assurance, not the S03D pre-I/O
transaction. Do not add a concrete database source, snapshot persistence,
audit/log writing, provider/model selection, credentials, provider I/O,
route/action, browser/UI code, deployment, or real-user use in this increment.

### Virtual Guide S03D pre-dispatch evidence

Keep `public.solmind_prepare_virtual_guide_predispatch(...)` as the only
service-role entry point for its protected writes. The function must remain
security-definer with an empty search path and 2-second lock timeout. It accepts
caller-supplied operation, snapshot and invocation IDs (the server caller must
generate them) plus the exact S03C
bindings, canonical sorted unique consent/source IDs, and a 64-character
uppercase hexadecimal context fingerprint.

Before writing, re-read and lock the current session, Explorer profile and
relationship; require an active Explorer account/role/profile/onboarding state,
one of the three Explorer session types, an active session, an active or paused
relationship with matching Practice, no other current Guide relationship for
the Explorer (any status other than `ended` or `transferred`), clear
restricted mode, current adult affirmation, an active/approved Practice with an
active/approved Organization, and the exact complete active required-consent
set. Lock the reviewed authority rows, including every relationship of the
Explorer profile, and stabilize the required-consent definition for the
transaction. Recompute the AV1 proof from those current facts; the
Organization and single-Guide checks are enforced directly and are not part of
the v1 proof string. The single-Guide check assumes the Explorer
current-relationship capacity policy stays at 1
(`core.explorer_engagement_capacity_policy`); raising it would let invitation
acceptance create a second current relationship that this gate then denies, so
change both together. In one transaction create exactly one context snapshot,
one started invocation and the two closed Family E rows. `exact_retry` means
evidence already exists and the caller must not dispatch again; changed
payload under the same operation, or a snapshot or invocation ID already used
by another operation, must fail closed, normally as `operation_conflict`; a
racing reuse can instead end in the 2000 ms lock timeout. Call the gate only
under READ COMMITTED: under REPEATABLE READ or SERIALIZABLE the transaction
snapshot can predate the Explorer lock and miss a relationship or consent
change committed in between. The composition caller must enforce this
before any activation.

Every authority guard and every exact-retry comparison against retained
snapshot and invocation evidence is null-safe (`is distinct from`, an
explicit null test before `not in`, or a `NOT FOUND` or `NOT EXISTS` check), and the invocation evidence shape check
requires a non-null `dispatch_contract_version` whenever the pre-dispatch
columns are populated. Both come from
`supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql`.
Keep them that way: do not reintroduce `<>`, `=` or `not in` guards against a
nullable column, and treat any new writer or table grant on the evidence
tables as a separately reviewed change. Lock order is the operation advisory
lock, session, account and role, Explorer profile, bound relationship, the Explorer's other
relationships, Practice, Organization, the consent-document table, consent
records, then any retained invocation and snapshot. A new writer that takes
these locks in another order, such as a top-down cascade that updates an
Organization and then its Practices, risks a deadlock; the database aborts one
transaction, and the caller must treat that as the unavailable result below.

The database recomputes and verifies only the AV1 authority proof. It does not
verify the context fingerprint, the context source IDs, or their ownership;
the server caller attests them. The rule that derives the context source IDs
is still an open composition gate, because the S03C result exposes no
source-ID set. The logical operation ID must be bound to the immediate
Explorer message identity; its exact derivation, including whether a
deliberate new attempt after a terminal failure receives a new ID, is also an
open composition gate. Authenticating
the actor (an authenticated Explorer-role session) also remains a server
composition duty: S03D does not verify an authenticated
`identity.user_session`; it checks that the attested actor is an active
Explorer account with an active Explorer role, consistent across the rows it
reads.

A `created` result is therefore necessary but not sufficient for a provider
attempt. An S03D v1 context snapshot is write-once by contract (no update path
or role grant exists, but the database does not block an owner-level update):
it leaves the Methodology Context Pack version, typed source IDs including
`related_reflection_ids`, and policy/behavior versions empty, and its stored
`prompt_version` is the S03B contract token, not an S03E instruction version.
The snapshot fields required
by `solmind-docs` `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md`
Section 12 must be recorded at snapshot creation by a separately reviewed
successor evidence contract (a new contract version); they cannot be added to
a v1 snapshot later, and v1 evidence alone never authorizes an
Explorer-facing dispatch. Later composition must also bind the dispatched
bytes to the stored fingerprint. The provider and model are fixed per
evidence contract version; changing either requires a new contract version.
Any outcome other than `created`, including `exact_retry` and every denial,
authorizes no provider call.

Do not add a provider call, credential lookup, route/action, conversation-message
write, safety workflow, browser/UI code, deployment, hosted data or real-user
activation to S03D. Keep fingerprint, authorization proof, source IDs and
content bytes out of audit metadata and outward errors. The closed
`solmind_virtual_guide_predispatch_*` identifiers are exception message text
under the default SQLSTATE, not distinct SQLSTATE codes; match on the message.
Every one of them, and any other database error (for example a unique
violation, lock timeout or deadlock), maps to the same calm, value-free
unavailable result, with no provider call.

### Virtual Guide S03E Luna transport

Keep `src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts`
server-only, direct-import and off shared/client barrels. It implements only the
S03B `generate` capability. The Responses URL, `gpt-5.6-luna`, medium reasoning,
non-storage request, fixed instructions and output-token cap are constants. Do
not accept a caller-provided endpoint, model, effort, instruction, metadata,
tool, previous-response ID or storage flag.

The factory may accept a server-supplied credential, injected `fetch` and an
injected message-ID function for tests. It must not read process/environment
state, log or serialize credentials, follow redirects, transmit binding IDs as
separate metadata, or expose provider bodies/errors. Send only the exact S03B
authorized-context string as provider input. Require a completed response from
the selected model, reject tool output and malformed/mixed content, map one
provider refusal to fixed Explorer-facing text, and let S03B perform the final
response-envelope validation.

Fake HTTP belongs only in tests. S03E does not select a runtime credential,
persist a snapshot/invocation/message, create S03D evidence, expose a route,
connect the screen, deploy or activate a provider call. Those effects require
their separately reviewed owners and gates.

### Connected Explorer conversation construction - 2026-10-24

These source boundaries describe a provider-held construction increment.
This dated section retains the predecessor scope; current held private
request/browser ownership is specified in the private successor section below.
Use `solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md` for actual proof
and checked publication status; source guidance alone supplies no assurance.

- Keep `src/app/explorer/conversation/page.tsx` a public data-free shell.
  Fresh authentication and feature authority belong to its state/commands
  handlers and server-only owners, not to navigation or browser input.
- Keep raw duplicate cookies intact in
  `src/lib/solmind/supabase/explorerConversationRequestDependencies.ts`.
  Reuse fixed Explorer request-auth; never renew or write a cookie here.
  The feature repository exposes only read, prepare, complete and mutate RPCs.
- `src/lib/solmind/explorerConversationContract.ts` owns exact command/result
  keys, opaque UUID selections, revision and required boolean `pendingTurn`.
  Reject actor, session, relationship, policy and provider input fields.
- `src/components/solmind/ExplorerConversation.tsx` owns private view lifetime,
  bounded reads/writes and exact uncertain retry bytes. Hold new commands
  while pending or uncertain. Replay settles the existing operation;
  it is never permission for another provider dispatch.
- Formation stays in
  `src/lib/solmind/explorerConversationFormation.ts` and
  `src/components/solmind/ExplorerConversationFormation.tsx`.
  Discovery can remain empty. Require exact owned saved source and Explorer
  label; confirm Priority separately from attention. Only explicit
  destination/meaning/arrival confirmation chooses a private Waypoint.
  Chosen displays In progress; Reached needs later explicit supporting
  evidence and confirmation. Never auto-share or infer model interpretation.
- Keep `src/lib/solmind/virtual-guide/explorerConversationContext.ts`
  server-only and off client barrels. Require injected trusted versioned
  policy/behavior/crisis/methodology configuration with no fake defaults.
  Reuse S03A and S03C for the six existing submitted continuity fields in banked
  form order, the last24 owned messages and immediate message. Required blanks
  reject; optional blanks omit. Only onboarding identity is qualified by real
  response-set UUID plus approved field; duplicate fields and cross-kind reuse
  reject. Keep the physical source UUID once and serialize selection revision
  `wi007-v0.1+onboarding-fields-v2`. Preserve Guide-private, prior-conversation and
  Reflection/summary exclusions; Explorer preferences are not Guide guardrails.
- `src/lib/solmind/virtual-guide/explorerConversationComposition.ts` binds
  exact compact serialization/fingerprint, canonical source IDs and required
  versions to new AV2/v2 preparation before a single authorized dispatch.
  Revalidate authority/history first. Preserve v1 evidence; never enrich it
  later or treat it alone as Explorer-facing dispatch authority.
- Keep `supabase/migrations/20261024000000_explorer_conversation_composition.sql`
  service-role-only, deny-by-default, lock-bounded and atomic for ordered
  message/evidence/audit persistence. Preserve wrong-account/non-Explorer,
  stale/expired session, revoked consent, restricted mode and changed-byte
  operation refusal. No browser grants, seed or provider I/O.
- The concrete dependency factory omits provider/context activation.
  A new send is unavailable without new turn writes. No scripted fallback,
  invented saved reply, sharing, activation, deploy or real-user effect.
  Test fakes stay explicit and separate from genuine database/provider/browser
  evidence and final source assurance.
- Preserve S01/S01R2 previews, original S03A-S03E modules and existing
  Explorer/Guide/Admin login/session/logout behavior.

### Explorer Suggested Waypoint deterministic UI

For `PRJ01_V-WS05-WI022-S01`, keep the retained
`ExplorerSuggestedWaypointWorkspace.tsx` fixture separate from the frozen S01
Explorer prototype. Fixture-local UI may demonstrate unread/read, receipt
acknowledgement, exact response, and private comparison, but it must not call
persistence, providers, server actions, `fetch`, cookies, browser storage,
notifications, or real Guide records. The `/explorer/waypoints` route now
belongs to the separately reviewed authenticated S03 inbox/detail read layer,
drawn since 2026-11-02 in the Explorer workspace frame (Waypoints current).

Every visible prototype control must navigate, mutate only fixture-local state,
or display the intended production destination. Test structural omission of
Guide-only state from Explorer projections. Treat canonical Suggested Waypoint
documents as already controlling; this route does not change their product
scope.

### Guide Suggested Waypoint deterministic UI

Keep `/guide/explorers/avery/waypoint-suggestions` in its dedicated Guide
workspace component and synthetic fixture builder. Guide rows may show Draft,
Autosaved, Pending send, Pull Back available, Open suggestion, No response,
Receipt acknowledged, Corrected, Withdrawn, and Guide-only Archive states using
symbol-plus-text pills. Never derive or display passive Explorer read state,
private comparison, private response drafts, possible connections, or use in a
Waypoint.

Pending send must remain absent from the Explorer projection until delivery.
Pull Back must return to the ordinary editable detail. Controls that depend on
later persistence or transport must explain their destination and produce no
outward effect in this deterministic review surface.

### Suggested Waypoint S03 server transport

The first `PRJ01_V-WS05-WI022-S03` increment is limited to direct-import,
server-only transport. Keep the exact nine human RPCs separate from the one
delivery-worker RPC, exclude the dormant Admin operational query, validate
exact call and response shapes, freeze accepted responses, and map errors to
value-free sentinels. Treat zero rows from the two role-specific detail gets as
an exact-function-bound denial; zero rows from commands and lists remain
failures. Keep the transport off shared barrels.

Use `suggestedWaypointRequestComposition.ts` only as the direct-import
server-only human-request boundary around that transport. It must accept no
client actor, role, profile, database function name, initial suggestion id, or
new pending-version id. It derives actor/role from injected request-auth and
record sources, authorizes Guide relationship selectors against server-loaded
records, requires an active Explorer context for Explorer operations, rejects
multiline Guide-authored destinations, and returns only fixed browser-safe
result shapes. A bound zero-row detail denial must remain DENIED rather than a
retryable failure. Do not infer route protection,
concrete cookie wiring, worker authorization, UI integration, or real-user
readiness from this composition primitive.

Use `suggestedWaypointRequestDependencies.ts` as the only concrete,
request-scoped dependency factory for that primitive and
`suggestedWaypointScopedIdentifiers.ts` as its stable UUIDv5 identifier owner.
Keep both direct-import, server-only, and off shared barrels. The identifier
scope must bind purpose, server-derived actor, authorized relationship,
operation, and when applicable the target suggestion. This factory does not
itself authorize a route, Server Action, browser caller, delivery worker, or
real-user path.

Use `suggestedWaypointRelationshipSelectorContract.ts`, its closed executor,
and `suggestedWaypointRelationshipSelectorRequest.ts` only for the Suggested
Waypoint Guide-entry selector. Client input may control validated pagination
only; actor and Guide authority come from request auth and the database
rechecks active relationship ownership. The exact projection is relationship
ID, Explorer display name, relationship creation time, next cursor, and total
count. Do not present this owner as the canonical Guide Explorer roster or add
onboarding, appointment, Shared Snapshot, Practice, suggestion-count, contact,
or private Explorer data. Keep every selector owner direct-import, server-only,
and off shared barrels.

The first separately reviewed read-only caller is
`src/app/guide/waypoint-suggestions/relationships/route.ts`. Keep it dynamic,
uncached, and thin. It may accept only one closed page size and one optional
opaque cursor, build only the read-only request-cookie accessor, and serialize
only the fixed selector result. Malformed or authority-bearing query input must
deny before cookie, auth, or selector IO. The route does not protect a page,
replace fixture UI, invoke a human command, mutate product data, authorize the
delivery worker, call a provider, deploy, or make the feature real-user ready.

The separately reviewed S03 read layer also includes relationship-scoped Guide
list/detail routes and Explorer list/detail routes. Keep every route dynamic,
uncached, and thin. Guide reads admit only an authorized relationship selector
plus closed pagination or one opaque suggestion identifier. Explorer reads
admit only closed pagination or one opaque suggestion identifier and derive the
Explorer actor from request auth. Browser contracts must validate exact
minimized projections and fail closed on widened authoring, pending, policy,
Assistant, relationship, private Waypoint, conversation, evidence, or inference
data. These routes remain read-only and authorize no command, delivery worker,
provider, deployment, or real-user activation.

The authenticated Guide detail may call only the separately banked
`guide.save_draft` and `guide.schedule_send` commands for an existing complete
Guide-only draft and `guide.pull_back` for the exact protected pending version.
Build the Pull Back body from the exact pending detail row,
keep the pending-version selector opaque, and preserve one serialized body and
operation ID across transport-uncertain retry. A positive browser countdown is
never command authority; the server decides the deadline. After a conclusive
command result, refresh the authoritative detail and never retry the command
merely because that read failed. Value-free denial and failure copy must not
reveal relationship, lifecycle, deadline, version, or Explorer data. Correction,
withdrawal, delivery, provider, deployment, and real-user UI callers remain
separate slices.

All three Suggested Waypoint paginated list routes and clients reuse
`suggestedWaypointPaginationSharedContract.ts`; do not recreate page-size,
cursor, query, or `refresh_required` syntax locally. Preserve the exact
function-bound database error classification in the server-only RPC layer.
Only a non-null cursor may trigger one automatic page-one retry, with the same
page size and the same request controller, timeout, and sequence. Clear cursor
history only after that retry succeeds. Page one, a second refresh result,
denial, malformed data, timeout, abort, and failed reset must not loop.
Malformed or operationally failed resets retain the last safe page; a current
authority denial clears it.

## Documentation Update Rule

When changing any of the following, update documentation in the same task:

- routes
- major components
- role behavior
- authentication behavior
- database schema
- safety behavior
- onboarding workflow
- Guide dashboard behavior
- Admin dashboard behavior
- environment and secrets behavior


Relevant documents may include:

- `docs/AI_MAINTENANCE_MAP.md`
- `docs/AGENT_TASK_RULES.md`
- `docs/MODULE_BOUNDARIES.md`
- root `AGENTS.md`
- root `README.md`
- canonical docs in `../solmind-docs`

## Build notes and the release-candidate check - 2026-11-03

Paul's rule (decision queue 2026-11-03 17:59:20, 18:00:59, 18:03:39, 18:30:50,
18:32:04 and 18:33:15 CST, go-ahead 20:50:45; `solmind-docs` ai-assistant/02,
"Pages under development: build notes"). On the signed-in screens (the
connected conversation screen and every `WorkspaceFrame.tsx` page) a part not
built yet is marked with a build note for the reviewer, never a message to
users, through `ExplorerConversationScreenBuildNotes.tsx` only:

- a control not built yet: its small "Not connected yet" label in the reserved
  blue `#4A86FF` (`NotConnectedLine`), with its tap-to-explain sentence
  unchanged;
- an area not built yet: a blue dashed box with an X in its upper corner that
  hides that box (`NotYetImplementedNote` with `standalone`, drawn by
  `BuildNoteBox`);
- a part planned for removal: a dashed violet `#D27BFF` outline
  (`REMOVAL_OUTLINE`) and the violet "Planned for removal" tag with one
  sentence on tap (`RemovalTag`); the part keeps working until Paul confirms
  its removal. When asked to remove something, mark it violet and show Paul
  first.
- one "Build notes" toggle in the top bar (`BuildNotesToggle`, `aria-pressed`)
  hides or shows every blue label, blue box and violet marker on the page; the
  controls stay. An X hides only its box, which stays hidden while the toggle is
  off; turning the toggle on shows every box again. Nothing is saved.

Use no other colour for a build note and never these colours for the design.
Every note, label, box, marker and the toggle carries `data-build-note` or
`data-removal-marker`; the check below looks for these attribute names as text
in the source and in the built pages. Mockups (`/explorer/conversation-preview`, the fixture and prototype
routes) do not get build notes unless a change to them needs one.

A release candidate for UAT or production must pass
`node scripts/checkReleaseCandidate.mjs` after its own `next build` (Paul's
rule, 2026-11-03): it fails, naming each place, while any build note or removal
marker remains in `src/` (only tests left out; the mockup routes and files ship
with every build, so they are scanned too, amended 2026-11-03 after review
REV224) or in the built pages of every route, or when there is no current
build. Do not promote a
candidate that fails. Do not add the check to `package.json` without Paul's
approval (AGENTS.md rule 7).

## Verification Commands

Before reporting completion, run:

```powershell
npm.cmd run lint
npm.cmd run build
```

If a task adds tests, also run the relevant test command.

## Git and Commit Boundary

Routine proposal application and Git banking follow the current canonical SolMind assurance chain: source-current freeze, mode-appropriate adversarial review, finding reconciliation, complete applicable validation, and no more than two bounded substantive correction cycles. Claude or another external reviewer or proposal author remains review-only and never self-applies. When that chain passes, the operating Codex executor may apply the exact frozen payload RIGHT to LEFT, stage the disclosed scope, commit, push, and prove synchronization without a routine Paul checkpoint. If two substantive correction cycles do not pass, stop and open the live-LEFT/proposal-RIGHT Beyond Compare folder review for Paul before continuing.

Paul still retains every external-AI transmission/run, product-decision, cleanup/deletion, hosted-database, merge outside the approved repository flow, deployment, cloud/production, provider-activation, and real-user gate. Never infer those effects from automatic application or Git-banking authority.

## Preferred Commit Style

Use small commits with explicit names.

Good examples:

```text
Add AI maintenance map
Add agent task rules
Refactor Explorer topics into component
Add SolMind role type definitions
Fix app terminology alignment
```

Bad examples:

```text
Updates
Fix stuff
Big changes
WIP
SolMind work
```

## Recovery Rule

If an agent gets uncertain, it should stop and report:

1. What it changed
2. What it intended to change
3. What it is unsure about
4. What command failed, if any
5. What it recommends next

Do not continue guessing.

## Connected Explorer login tasks

Keep the login pages thin and browser wiring in `LoginExperience` and
`ExplorerSignIn`. Use the existing fixed send/verify contracts, guarded server
composition, binding-aware `explorerHomeAccess` and logout browser boundary.
Only the accepted current verify result permits fixed `/explorer/home`
navigation; navigation and cookie presence are never authorization. Preserve
server-only secrets, same-origin writes, generic identifier/code refusals and
honest uncertain sign-out behavior. Do not connect the deterministic `/explorer`
prototype or a Virtual Guide provider as an incidental login change. Guide
uses its separately approved bounded connected scope; Admin has its separate
connected source boundary below.

Use direct functional checks of observable behavior with established test tools.
Do not make a general custom launcher or tests of that launcher a prerequisite
unless an actual dependency requires it. For the October 19 Explorer integration, Paul retained personal account setup
and approved direct functional Chrome proof in place of the earlier watched
custom-launcher prerequisite. Necessary database/authorization checks and the
complete review/application/banking assurance remain in force. This task-specific
direction grants no provider, deployment, cleanup or real-user authority.

## Bounded connected Guide login tasks

The bounded connected Guide path covers email/password/email-code login,
protected /guide/home, refresh and shared /logout. Current publication/banking
status is owned by SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and its linked checked receipt; source/check results alone do not establish
banking. Admin has its separate connected source boundary; /guide remains a
prototype. The Guide increment adds no SMS, reset,
provisioning, renewal or provider conversation. The signed-in Guide pages'
workspace menu and the Dashboard on /guide/home follow "Guide workspace menu
and Dashboard" under the Explorer S01 Task Contract above.

Use fixed server role/purpose/home, no password on send, unchanged password and
non-consuming same-account/contact challenge ownership before password. Wrong
password must not redeem; neither factor alone permits a session. Keep provider
credentials private through factor/account confirmation and accepted session,
then release. Await bounded discard; timeout never proves remote rollback.

Only current principal/session/role/binding checks authorize home. Pass only
expiry/observation times; reuse shared logout, finite reminders, Guide re-entry
and honest uncertainty. October 21 isolated app/SQL checks and R04 genuine
functional/contention observations are recorded in
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md. At 20:17:31 CDT Paul
accepted disclosed timing/capacity risks and deferred real exhaustion/induced
provider/session/cookie failure timing only for private synthetic local use;
exact authority is
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json.
The original full protocol is not claimed passed; deferred measurements remain
required before broader exposure or real users. This dated Guide-only decision
accepts no Admin residual risk. Fakes/Explorer proof do not
supply missing real timing or full assurance.

Preserve existing accounts/private passwords after outage; no blind reset/setup
rerun. Admin parsing alone does not implement first-Admin setup; later setup
reuses its rule. Additive Explorer navigation may link the authenticated inbox
and collapsed explicitly fixed-script previews; preserve session/logout,
provider and privacy boundaries.


## Bounded connected Admin login tasks

Keep chooser/fixed /login/admin, its two same-origin POSTs and protected
/admin/home within the explicit Admin scope. Reuse existing password-role
bodies/core/handlers/dependencies, exact ownership and cookie/session/logout
owners. Use approved email/username normalization, stored verified email for
provider authentication and unchanged typed password. Send carries no password;
wrong-account ownership must not reach password, and wrong password must not
redeem. Neither factor alone permits a session; awaited cleanup is not rollback.

Home must use the fixed /admin/home server-only audited chain once, not a bare
Guide guard. Require guarded-read persistence first, allow-decision persistence
second, then final expiry/clock validation. Preserve the public /admin/access
{ allowed } shape and existing server actor contract; pass only expiry/observation
times to AdminHome (amended 2026-11-03: and the minimal Admin screens' plain
display data, below). Keep duplicate raw cookies visible to validation, shared
logout uncertainty honest and re-entry fixed to Admin. GET does not renew, clear
cookies or sign out; the Admin home allow still requires its audit writes.
The /admin prototype grants no new dashboard, private-data or provisioning power.

Minimal functional Admin screens (amended 2026-11-03; decision queue 2026-11-03
11:52:57, 11:56:14 and 12:19:09): Dashboard, Guides and Explorers, AI use and
pauses, and Settings, plus the Lift pause and setting-change POSTs, are allowed
as docs/MODULE_BOUNDARIES.md describes them. Each path keeps its own fixed
Admin-only rule and resolver; guard and read run in the same request through
adminWorkspaceAccess.ts; the actor stays on the server; activity is by sign-ins
only, and apart from the recorded hard-stop facts Paul approved as Admin review
flags (2026-11-01 01:00:16: day, time reached, that day's total calls, the
limit; 2026-11-01 12:27:07: crisis or urgent status at the stop), no Admin page
shows conversation content, message dates or message counts; the two writes
reuse the existing lift and setting writer unchanged, with one fixed authority
reference and no account id (amended 2026-11-03 after review REV219), and
"paused now" is the AI-use gate's own read-mode decision.

Admin configuration is explicit/provisional; see docs/MODULE_BOUNDARIES.md.
Obtain Admin's own genuine positive journey, audit/failure/role/session evidence
and adopted timing/shared-capacity measurements with an Admin-specific residual-
risk disposition. Guide's October 21 proof/private-local approval is historical
Guide evidence only. A source check, fake clock or mock browser is not that proof;
source descriptions establish no assurance/publication/banking result. Use the
current complete-slice execution ledger and its checked receipt as status owner.

Preserve original accounts/private passwords. First-Admin setup, password reset,
SMS, remembered browser/activity renewal, broader Admin workflows, new SQL/schema/
grants/dependencies, provider activation, cloud/production/deployment, real users
and cleanup movement retain their separate scope/authority (amended 2026-11-03:
except the minimal Admin screens above and their four read functions).

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

A bounded task must name exact Guide scope/trusted pack, current account/role/
application-session authority, complete operation identity and prospective
screen/Admin/Guide/audit evidence. No browser actor/role/scope/result/approval
or audit summary supplies authority. Use closed service-role capabilities, not
direct DML or a generic content/event writer.

Policy-manifest/request hashes are trusted-server assertions, not database proof
of actual HTTP or policy approval. Fixed task methodology_safety_screen and
protocol methodology-safety-screen.v1 bind the intended openai/gpt-5.6-luna
invocation; no actual screen caller exists. Historical authorization is checked
at event time; every new human transition/retry checks current access. Later
ordinary logout/expiry does not rewrite a valid earlier approval.

Changed-operation retries conflict; exact authorized replay adds no audit,
binding or provider call. Preserve legacy synthetic v2 writers/provenance.
Root alone integrates, runs isolated runtime/SQL proof, performs formal local
assurance/substantive corrections and executes the separately gated exact
application/publication/checked-banking chain.


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

Keep this task limited to the pure matcher, adjacent artificial-data tests and
Root-owned real assembly/builder canaries. A test-injected wrapper is not default
runtime wiring. Match identifiers before content, with manifest order deciding
the first blocked result. Identifier text matching is case-insensitive; content
hashing performs no case folding, Unicode normalization or whitespace collapse.
Malformed input and a stale/absent authoritative source must never be promoted
to operational permission by a shaped clear result.

Do not add an audit writer/register change or invent a confirmed incident for
uncertain input. A later writer needs the exact closed tuple/posture/register
contract first; do not widen AUD-1. No scheduled scan, page, notification,
classification, provider or shared-database effect follows from this task.
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

The held screening caller remains initial unvalidated construction; current
counts/results belong to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
Keep work within the explicit caller/repository capabilities and their tests.

Copy validated actor/selectors/configuration and capture port functions before
the first await. Reject hostile factory/input/response shapes with fixed
value-free outcomes. The trusted synchronous request builder supplies exact
bytes; the caller neither invents nor defaults a prompt, schema or policy.
A hash binds accepted bytes and does not prove policy approval or HTTP behavior.

Only fresh ok/dispatch_permitted=true with the exact planned invocation permits
one execute. Prepare uncertainty never grants takeover; exact replay means no
execute and no settle. Freeze completed/failed/canceled intent once, project
the exact SQL result shape and await one independent cleanup settlement.
Unconfirmed persistence never becomes success, automatic retry or another call.
No invocation telemetry stamping, new audit class, register change, review/
approval, provider activation or default runtime wiring belongs in this task.


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

This proposal adds product privacy lint for eleven explicitly named Explorer
assembly modules. It creates no generic assistant-workflow rule, dependency,
installation or optional process-repair task. Current execution evidence remains
unrun in solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

Preserve the exact reviewed graph and both type-only exceptions. Alternate
specifier spellings, mixed/empty/default/namespace/side-effect value edges and
static reexports require their actual permitted runtime edge. Dynamic imports,
import-equals and import-type expressions are refused. No autofix mutates source.
Tests may parse hostile fixture text with ESLint; never execute that text.

A lint pass does not authorize ports, source retrieval, SQL access, provider
dispatch or data safety. Do not promote preparation-only coverage/currency maps
to complete or fresh source evidence, or treat lint as runtime abort/audit proof.


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

This narrow R10 proposal hardens the existing Virtual Guide transport contract;
it creates no new assistant-workflow rule or broader product policy. Accept only
an ordinary same-realm native Promise before racing the immediate return. The
owned abort sentinel needs a handled observer before generate is invoked, so
synchronous cancellation plus malformed return or throw does not strand it.
Preserve the existing cancellation priority, fixed generic error and cleanup.

Do not normalize an unsupported immediate value with await/Promise.resolve or
add transport drain, retry, timeout, replay, restricted-state, SQL, provider,
default or dependency behavior. The guard cannot undo internal assimilation or
independent port failures; an uncooperative transport may outlive the outcome.
Source/currentness writer maps remain preparation only.

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

The current private construction and its six lifecycle ports (settle v4, others v3) are owned by
solmind-app/AGENTS.md and solmind-app/README.md. The older v1/v2/AV2 descriptions
and dated eleven-profile proof above retain their predecessor scope. The current
source graph has27 exact profiles and twelve erased type-only edges; do not infer
new imports or activation from the older counts.

Keep explorerPrivateConfigurationCandidate.ts and explorerPrivateConfiguration.ts,
explorerSafetyReplyContract.ts, explorerSafetyReplyInvocation.ts,
openAiLunaExplorerSafetyTransport.ts, explorerConversationSafety.ts and
explorerPrivateConversationComposition.ts direct-import server-only under
src/lib/solmind/virtual-guide/. The six-port closed repository is
src/lib/solmind/supabase/explorerPrivateConversationRepository.ts. AV3 entries in
src/lib/solmind/virtual-guide/explorerConversationContext.ts are separate from
strict AV2 entries; the AV2 compact input remains wi007-v0.1+onboarding-fields-v2 (since
2026-11-03, chat step slice S3, the ordinary AV3 input is wi007-v0.1+onboarding-fields-v2+compass-v1
with the saved Compass and Waypoint section; see docs/AI_MAINTENANCE_MAP.md).
Amendment 2026-11-04 (S5): ordinary AV3 now uses `wi007-v0.1+onboarding-fields-v2+compass-v2` and `explorer-compass-context.v2` with saved or forming points; classification_only and AV2 keep the section-free base revision, and SQL validation refuses compass-v1.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

supabase/migrations/20261025010000_explorer_source_exclusion.sql owns bounded
current-source inspection and committed content-free exclusion accountability;
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
JSON/receipt loading and uses the shared daily test-allowance ledger described
below. Absent, invalid or expired server-selected data stays held. The browser selects neither profile
nor actor/target/authority. Receipt hashes and shaped approval fields bind trusted
operator evidence; they do not independently establish actual target isolation,
resource/source verification, screening or authenticated Admin/Guide decisions.
The two profile environment selectors are data locations, never enable flags or
approval. No OpenAI credential is read by this loader.

`src/lib/solmind/operations/explorerPrivateLocalDispatch.ts` owns request-scoped
prepared identity, fresh authenticated v3/conversation/policy checks, current
governed-methodology verification and a final authenticated reread after that
await. Changed/unknown authority, cancellation or session/run expiry refuses
forwarding. Check the key's format, then reserve one daily-ledger place, then
forward; never delete, reset or release a place after uncertain results. A
fresh profile shares the same ledger, so it adds no calls beyond the day's
count, and nothing is retried automatically.
Actual provider/credential and isolated-target grants remain separate.

The approved policy record supplies the exact private US English/plain-text
resource/failure strings. Keep the operator audit at the start and end of each
test session, with the daily ledger report, distinct from mandatory dispatch
authority/exclusion.
This is not scheduled integrity/Admin paging, an independent preHTTP snapshot
scanner or an atomic database-to-HTTP lock. Genuine joined proof remains separate;
dated synthetic/source proof retains its original scope. Actual results belong
to solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

### Daily private local test allowance - 2026-10-31

Paul chose option A for rebuild step 3 on 2026-10-31 (decision queue 14:20:03,
with the defaults recorded at 14:48:04): one test setup allows many sends,
counted against his standing test allowance of up to 1,000 conversation calls a
day on the local demo, safety assessments included (sprint handoff 2026-10-29
22:08:10 and 2026-10-31 11:46:00, 11:50:02, 14:15:38). The profile is
`explorer-private-local-run.v2`, without `explorerMessageSha256`. The grant is
`solmind-private-explorer-provider-grant.v2` with `dailyConversationCallLimit`, a
safe integer from 1 to `EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING` (1,000). A v1
profile or grant, or a grant still carrying `maximumExplorerCalls` or
`explorerMessageSha256`, is refused. Every other grant, target, policy, model,
expiry, sign-in, identity and methodology check is unchanged, and the operator
keeps the human grant. No v1 setup may be made or used again, and no app copy
from before this change may serve a run, because its calls would bypass the
ledger.

`src/lib/solmind/operations/explorerPrivateLocalCallLedger.ts` owns the single
ledger `EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT`, a fixed local folder that never
comes from a profile, environment selector, run folder or working directory, so
a new setup, folder or run shares the day's count. It imports only `server-only`
and Node built-ins.
A place is one file `<day>.slot-NNNN.json` for the America/Chicago calendar day,
holding only version, day, slot, time and run. Its record is written and synced
in full under a unique `pending` name, then hard-linked to the slot name, which
fails if the slot exists: each place has one winner across requests, processes
and restarts, and a slot is never visible half-written. A place is reserved
before the attempt, stays counted if the outcome is unknown, and is never
deleted, reset or released; one bound request reserves at most once, and a
later call on it is refused before any further read. Any entry
named for the day that is not a complete valid slot record (damaged, partial, a
folder or link, or an unexpected name) holds every run until it is resolved; an
unfinished `pending` file never counts, and one whose write fails is removed
where possible.
If midnight passes during a reservation,
that place stays counted on the old day and nothing is forwarded against it. The
folder must already exist; the app never creates it, and a missing or unreadable
ledger, or a ledger folder that is itself a link, keeps every run held.

The day's total is the number of valid slot files for that America/Chicago day.
`readExplorerPrivateLocalCallUsage` reports the current day only; for a finished
day the operator's report helper counts that day's valid slot files. The
operator reports the total to Paul with the passive dispatch observer's count of
actual requests. Only the current day's
names count, so earlier days' files may be archived; the folder itself must be
left out of any `.validation` cleanup. Deleting today's files or moving the clock
forward would give fresh places; nothing local prevents that, and the observer
count is the cross-check. A reached count shows the existing unavailable state
on the next readiness check, and the reply to the last allowed send already
reports unavailable. The private controller's optional `sendCapacityAvailable`
check is made where a Send would otherwise report available after the readiness
check: on a saved reply, and on an exact replay found by the fallback
observation, the second read or preparation. Failure paths, and a replay found
by the first read, still report unavailable, as before. It can only turn
available into unavailable,
never the reverse; a check that
fails or answers anything but true reports unavailable. Only the local factory
wires it, to the run's own availability (profile expiry and today's count); the
budget wrapper passes it through unwrapped, and the explicit factory neither
accepts nor passes it. Message
text is no longer bound by code: the rule that test messages are invented, never
a real person's words, rests on the operator. The product hard stops are in the
database (next section); the ordinary allowance, the screen notices, Admin
alerts and token recording are later steps and are not built here.

### Product hard stops in the database - 2026-11-01

Product-limits slice 2a puts Paul's two hard stops in the database (decision
queue 2026-10-31 12:45:13 to 14:17:30 and 2026-11-01 00:32:35 to 01:07:27,
12:00:53, 12:27:07 and 13:20:16 to 13:26:32): 500 AI calls per Explorer per
America/Chicago day, and for everyone together 300 per active Explorer. The
per-Explorer value is kept when the day first needs it; before the audited
writer changes that setting, it keeps the current day's old value, so a change
takes effect at the next midnight. The active Explorers are counted once, at
the day's first counted Send, so the sending Explorer always counts. Change the
limit settings one per transaction.
`supabase/migrations/20261101010000_explorer_ai_use_hard_stops.sql` adds four
keys to the closed `core.application_setting` family
(`explorer_ai_use_individual_daily_call_limit`, 500 within 1 to 2,000;
`explorer_ai_use_shared_daily_calls_per_active_explorer`, 300 within 1 to
2,000; `explorer_ai_use_automatic_lifts_per_week`, 1 within 0 to 7; and
`explorer_ai_use_automatic_lifts_per_month`, 2 within 0 to 30; only the audited
writer's allowlist grows, the reader keeps its two keys), the protected
`ai.explorer_ai_use_shared_day` and `ai.explorer_ai_use_stop`
tables (RLS on, zero policies, no API role access, immutable except a stop's
one-time lift and a day's one-time count) and the internal gate
`ai.solmind_explorer_ai_use_gate_v1`.

A Send counts once, when the 37-argument
`public.solmind_prepare_explorer_conversation_turn_v3` commits its started
operation; failed, unknown-outcome and stopped Sends stay counted, and exact
replays never count. The observe step and an early check in prepare refuse a
paused Send with the closed outcome `paused` before any observation, message
or count is stored (a refusal may record the stop it reaches). One exception:
when the only pause is a first stop of its day and the phrase check finds
crisis or urgent signs (level 3 or 4) in the message, observe stores its
observation first, which gives the account crisis status, and the automatic
lift then applies. Observe and both checks in prepare take the four hard-stop
settings, in key order, before they read the clock; the final check then takes
one blocking transaction lock, reads the clock, counts the Send and records a
stop it reaches. When a stop is reached, or a limit setting is lowered, between
a Send's observe and prepare, prepare refuses at its early or final check after
observe has stored the message's safety observation, as for a Send that turns
stale; the message itself is never saved. Both steps were replaced in place
with the same signatures, return shapes and grants.

The individual stop pauses that Explorer until Paul's lift; a same-day lift
gives a fresh individual allowance. An account is in crisis or urgent handling
when any of its conversations is at restricted level 3 or 4. Such an account's
first stop of a day is lifted automatically, once: it is recorded already
lifted when the account is in crisis as it is reached, or lifted at the next
Send when the crisis begins later. An account not in crisis has its first stop of
a day lifted automatically while it has had fewer such lifts than the per-week
setting in the last 7 Chicago days and than the per-month setting in the last
30; Paul's lifts and crisis lifts do not count toward them, and a setting of 0
turns them off. A second stop that day is treated as likely misuse and waits for
Paul, across midnight. The shared stop pauses everyone and lifts at midnight.

Four new service-role-only functions:
`public.solmind_read_explorer_ai_use_pause_v1` (the notice kind for the
signed-in Explorer: NULL, individual, shared or individual_and_shared; whether
the current conversation is in crisis or urgent handling, for the crisis pause
notice; and the adults-only flag; writes nothing; those flags are private facts
for that Explorer's own screen),
`public.solmind_lift_explorer_ai_use_pause_v1`
(the Executor's lift, only on Paul's recorded word: role `system`, authority
`paul_approved`, one content-free `explorer_ai_use_pause_lifted` audit row; a
stop already lifted automatically returns `lifted_automatically`),
`public.solmind_report_explorer_ai_use_v1` (the Question 8 facts plus the
stop's number that day, whether the account was in crisis or urgent handling
when it was reached, and when and how it was lifted: Paul's, a crisis lift or a
weekly and monthly lift) and
`public.solmind_report_explorer_ai_use_days_v1` (daily
counts, so an unusual number of automatic lifts stands out). Paul decided that
crisis status is not private, only what caused it, so Admins may see it at a
limit;
`solmind-docs/execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
Section 11.4 records that exception, and the Explorer privacy disclosure must
say so before real Explorers. Stop records never hold conversation words, a
conversation reference, or safety or crisis counts. The screen step (slice 2b,
next section) is the app's only caller, of the pause read and of the `paused`
outcome. The migration reaches the Card 3 demo database only after that step
is banked.

### Hard-stop pause notices on the screen - 2026-11-01

Product-limits slice 2b shows Paul's pause notices on the connected
conversation screen (decision queue 2026-11-01 00:39:51, 01:07:27, 12:27:07,
13:24:41 and 13:26:32). The repository's thirteenth port, `pause`, calls
`public.solmind_read_explorer_ai_use_pause_v1` with only the actor pair and
accepts only `ok` with a closed `notice_kind` and two booleans that can be true
only with a pause; observe and prepare accept the closed outcome `paused`. The
port is required in the repository type, and the budget wrapper bounds it at
10 seconds like the other required ports.

On Send the controller runs the phrase check and reads the pause after
readiness and before ensure. A pause that read reports is refused there, so
that refusal creates no conversation, except for an individual-only pause
with a level 3 or 4 message, which goes on to observe: observe stores the
observation and the automatic lift applies, or refuses at a second stop. A
denied pause read denies. The read is advisory: if it fails, the Send goes on
to ensure, observe and prepare, which enforce the stops, as before (so a first
Send can then leave an empty conversation when observe or prepare refuses it).
Against a
database without the slice 2a migration the read always fails and Sends run
without the stops, as before that migration; apply the migration together
with this step. When observe or prepare refuses with `paused`, the controller
keeps the policy it returned and reads the pause again; a failed, denied or
other re-read, or a pause that has ended by then, gets the existing temporary
assistance and, when the facts are critical, its marker (Send then shows
unavailable until a reload).

A refusal emits the marker when the conversation policy or the message is
critical, then makes a fresh authenticated read with this operation's
selector, so a duplicate of the Send that committed meanwhile shows as its
exact replay without a refusal notice (in that rare race a critical duplicate
can raise the marker for an operation returned as its replay; accepted, so
that a read stays the last wait). If that read first shows critical facts,
the marker is sent then and the read is repeated with the same selector (an
exact replay there is returned as the replay). When the last read is not an
exact replay, the result carries `paused` assistance, so the browser keeps the
typed message and Send stays usable (the crisis unlock stays reachable), with
the provider state following the test allowance checked after the last read. A lost or failed fresh read, or a notice
the renderer cannot write, keeps the existing static assistance, chosen from
every policy fact any read has shown and the phrase check, never the pause
read's flags. A screen-open read reads the pause before its final fresh
read and writes the notice afterward, without the refused-message line; a
failed pause read there shows no notice. The notice's crisis and adults-only
parts follow the final read's own known policy; when that policy is unknown,
the policy known before it together with the pause read's flags (both kept
even if the conversation may have changed, since the pause read returns no
conversation reference: this errs toward the supportive wording); and the
refused message's phrase check.

`createExplorerPrivateReviewedRenderer` writes the notice with
`pauseNotice`, bound to the same resource policy and receipt as `render`, and
readiness is held when a renderer lacks it. The ordinary notice is the pause
sentence with its true restart condition (the individual stop: an Admin's
lift; the shared stop: midnight, Chicago time; both: both pauses ended), the
refused-message line on a refused Send, the adults-only paragraph where the
Explorer may be under 18 (the stored conversation state, or a refused message
whose phrase check suggests it), then the help text. A crisis notice, for a
conversation in crisis or urgent handling or a refused level 3 or 4 message,
leads with the trusted acknowledgment, limits, help text and human-contact
parts in reply order (level 4 the crisis parts, level 3 the urgent parts),
then the adults-only paragraph where it applies, then the pause. The marker
is the existing value-free one, never chosen from the pause read's flags, which
are never logged or passed to signals. The crisis parts are the
app's draft text and the help text is the demo's approved record: before real
Explorers, the crisis wording needs Paul's approval and the help resources
must be verified. A Compass or Waypoint command clears the notice from the
screen while the pause continues; a reload or the next Send shows it again.

### Held private request/browser ownership

src/lib/solmind/explorerPrivateConversationResponse.ts is the browser-safe strict
versioned result/assistance envelope owner. Its assistance is transient and
persisted:false, never saved history. Private composition imports its assistance
type only; keep private evidence/policy/configuration out of browser projections.
The new createExplorerPrivateConversationRequestDependencies export in
src/lib/solmind/supabase/explorerConversationRequestDependencies.ts reuses the
existing raw-cookie authentication source and fourteen-port private repository,
including the separate respondCompassSuggestion command port. Keep
the legacy export for its historical proof. No default operational ports,
provider credential/environment lookup or candidate-driven activation is added.

State/commands route candidates call private read/command and validate the
envelope; src/components/solmind/ExplorerConversation.tsx validates it again.
GET can report readiness only through complete injected ports/valid binding and
never ensures or writes. Show assistance separately, retain the send draft on
an assistance-bearing confirmed state and preserve authority-loss clearing.
The retained 70-second browser abort is not a whole-command budget. This is held
integration construction, not operational activation, passing checks, formal
assurance, application, banking or genuine-AI proof.

### Explicit signal and dormant screening additions

src/lib/solmind/operations/explorerPrivateOperationalSignal.ts owns the injected
dedicated local .jsonl path/receipt and version/time/closed-marker append only.
No destination is adopted; no path/env lookup, directory creation, retry, private
ID or notification. A one-second controller await/abort request does not prove
filesystem write cancellation. src/lib/solmind/virtual-guide/openAiLunaMethodologyScreeningTransport.ts
owns the explicit-policy/subject/request-bound pure builder and dormant injected
HTTP adapter. Preserve pinned model/medium/store:false, no tools/background/stream/
retry, 128-KiB limits and the 60-second local fetch/body-parse race. Local timeout
does not prove remote stop, zero billing or zero retention; provider abuse-monitoring
retention remains separately disclosed. No key lookup, default policy acceptance,
real screen, human approval or activation. New-module proof is initially UNRUN;
earlier bridge results do not cover these bytes. After awaited GET readiness,
reauthenticate and reread current authority/state before releasing private data.

### Private request await budgets

src/lib/solmind/operations/explorerPrivateRequestBudgets.ts wraps only the new
private factory: auth and each supplied repository method 10s, readiness 15s,
context 30s with caller/owned signal combination. Provider/render/signal retain
60/2/1s ownership. The legacy factory remains unchanged; default private wiring
has only wrapped auth/repository and no activated optional ports. Local race
bounds are implemented, but do not prove remote stop, rollback or drain and do not
sandbox synchronous trusted code. No automatic retry/repost follows timeout.
The 70-second browser abort expresses delivery interest/uncertainty, not a server
whole-command limit. Joined-path proof and actual governance/integrity/activation
remain required. New fake-timer cases are initially UNRUN; factory tests must
check exact authority/argument behavior and optional absence, not unwrapped
object identity. Earlier bridge results do not validate the new wrapper.

### Explicit rendering and governed-capability owners

src/lib/solmind/operations/explorerPrivateReviewedRenderer.ts reconstructs pinned
trusted segments and adult/age resource order, rejecting mismatched plans rather
than trusting supplied plan prose. Distinct adult-only/restricted paths remain.
Injected resource/failure strings and renderer receipts require genuine review;
shape validation is not suitability or human approval.

src/lib/solmind/virtual-guide/explorerPrivateGovernedCapabilities.ts binds explicit
copied configuration, pack/Guide scope, receipt hashes, versions and ports. Use
its real effective-methodology source per readiness call, exact pinned subject
digest and AV3 governed context builder/adapter; no fake identity or approval.
Both modules stay direct-import/server-only and dormant until trusted injection.
They do not configure default adoption, credentials or provider activation.
Actual Admin/Guide governance, operational policy/resources, integrity and genuine
joined-path proof remain gates; source construction asserts no passing proof.

## Chat slice S4: reply v2 construction - 2026-11-04

Paul approved the corrected S4 scope on 2026-11-04 (decision queue 09:57:20 and
10:22:18 CST). New provider replies use the closed explorer-safety-reply.v2 body:
protocol, classification, candidateReply, optional compass {attention: saved point
UUID or null}, and optional choices [{label}] (one to three, 1 to 40 Unicode scalar
characters per plain-text label). Malformed optional groups are absent independently;
they never discard valid classification or candidate prose. Classification-only mode
requests neither optional group nor candidate prose. The request remains
explorer-safety-request.v2. Existing v1 evidence and saved messages remain valid.
Amendment 2026-11-04 (S5): optional compass attention may also name a current forming head below level 2; its Route capture waits for confirmation.

explorerSafetyReplyContract.ts owns parsing; explorerPrivateConversationComposition.ts
passes proposals only for ordinary replies with delivery still wanted. Attention must
name a current saved head; unplaced heads remain eligible. Choices require level 0 or
1. SQL rechecks current authority, ownership, unrestricted state and successful reply
persistence. A null, missing, foreign or merged attention is ignored, never a request
to clear attention or fail the reply. The pending-turn guard keeps formation stable.
The closed repository now calls public.solmind_settle_explorer_conversation_turn_v4
with the previous 20 arguments plus p_attention_item_id and p_choices. Service-role
execute on settle v3 is revoked; its definition and old evidence are retained.
Prepare keeps its exact 37 arguments and one-count-per-Send hard-stop behavior.
The forward migration is
`supabase/migrations/20261104000000_explorer_reply_protocol_v2.sql`.
Amendment 2026-11-04 (S5): a current forming head is also eligible for automatic attention below level 2, and settle v4 adds p_compass_suggestions as its 23rd argument in the S5 migration.

Choices are an insert-time nullable column on the saved Virtual Guide message,
protected by the message guard for both v1 and v2, and returned as optional choices
in the closed browser state. S4 renders no choice controls. A real automatic move
adds one completed follow_attention operation, with an immutable origin_operation_id
link to its Send and an attention_changed Route event. The optional Route actor is
explorer or virtual_guide; no origin identifier enters browser or model context.
The existing AV3 compass-v1 section keeps its revision and adds an optional actor /
awaitingReply pair to recentRoute. New assembly and SQL exact rederivation supply
both; only the latest Explorer needle move after the last saved Virtual Guide reply
has awaitingReply true. This prevents repeated acknowledgments without a persistent
marker. Priority changes remain excluded. AV2 stays unchanged.
Amendment 2026-11-04 (S5): ordinary AV3 uses compass-v2 / explorer-compass-context.v2; the latest Explorer move onto a forming point also supplies the transient awaitingReply signal without a Route row.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

The global policy and role text change only for the v2 proposals and approved shift,
acknowledgment and choice guidance; prompt/instruction labels and integrity pins
change together. Never claim a proposed move was saved. Mention only substantial,
unannounced shifts, once, below level 2 and outside restricted conversations; offer
a return to the earlier topic at most once without pressure. Acknowledge an Explorer
move awaiting a reply briefly once, then follow their lead. Offer choices only when
helpful; a first reply without a named topic may offer Show me around, I have a
question and Let's begin. Always answer questions about how the screen works.

This is source construction, not demo approval or provider evidence. Paul must read
the exact changed wording before demo use. His later crisis-context decision is
implemented separately below; S4 itself leaves those calls unchanged.
The independent AI-provider/database review and two-round rule remain Executor
work. SQL/pgTAP, browser validation and any approved demo migration are Executor
work; no database, provider or server was run by the builder. Daily repeated tour
offers, remembered feature-use evidence, the Admin duration setting, forming points
and Waypoints, S6 buttons, and Key Insights remain later slices.
Amendment 2026-11-04 (S5): forming Compass points are implemented below; forming Waypoints, S6 controls and the other named later work remain outside S5.
## AV3 crisis-check context - 2026-11-04

Paul's decision 2026-11-04 17:14:51 CST, point (d): classification_only uses
wi007-v0.1+onboarding-fields-v2 without compassContext or its point/Waypoint source
ids. The controller selects the mode before assembly; its adapter forwards it to
both private builders, which omit the section before serialization and hashing.
The controller pins mode, revision and section presence together. Ordinary
classification_and_reply keeps the existing compass-v1 bytes; AV2 is unchanged.
Amendment 2026-11-04 (S5): ordinary classification_and_reply now uses compass-v2 / explorer-compass-context.v2; classification_only and AV2 keep the section-free base revision.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.

The inspector replacement in
supabase/migrations/20261105000000_explorer_crisis_context_without_compass.sql
requires the exact matching envelope and source set, deriving mode from known
restricted/adult-stop state after prepare applies fallback under lock. Unknown
policy fails closed. Its existing SECURITY INVOKER setting, owner and grants,
prepare's 37 arguments, immutable snapshots and historical replay are unchanged.
Keep context/RPC/provider limits at 30/10/60 seconds and preserve cancellation,
one-call and counting rules. SQL and browser execution remain Executor work.

## Chat step S5: forming Compass points - 2026-11-04

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-04 21:44:03 allow
conversation-derived Compass wording to appear immediately as Forming. Only the
Explorer confirms a point, Priority or arrangement. S5 adds no reply buttons or
typed-confirmation interpretation; those remain S6. Existing tools stay mounted.

The single forward migration is
`supabase/migrations/20261105010000_explorer_forming_compass_points.sql`.
The app change and this migration must reach a database together; out of step in either direction every ordinary Send fails closed before the provider is called.
`ai.explorer_conversation_compass_item.formation_status` is NULL for existing
Explorer-saved rows (no backfill), or proposed, confirmed or rejected.
`wording_message_id` points to the saved Virtual Guide reply that last supplied
forming wording. Only settlement may overwrite a proposed label. Refining a
proposal overwrites that label and pointer without a Compass wording snapshot;
confirmed category/wording history remains immutable. Existing immutable context
evidence retains fingerprints, source ids and version bindings, not serialized
context text. S5 adds no hidden snapshot of forming wording.

The existing 24-row limit counts every non-rejected row, including merged
originals and forming points. Rejected rows have a separate fixed limit of 24
per conversation; reaching it refuses another rejection without deleting earlier
rows or silently freeing a slot. Rejected rows never appear in state or model
context and cannot be heads, selectors, arrangement entries or category targets.
Total storage is therefore at most 48 rows; display order can be 1 through 48.
One-way combination still releases no slot. The eight visible positions and
explicit Explorer control of Priority and arrangement remain unchanged.

The service-role-only `public.solmind_settle_explorer_conversation_turn_v4`
adds `p_compass_suggestions` to its previous 22 arguments. Each optional entry
has a label and optionally pointId naming an owned current forming point. Only
the first three submitted entries are considered; invalid entries are dropped
independently, preserving valid siblings and the reply. A label with leading or
trailing spaces is dropped, not trimmed. Labels must be single-line text within
the existing 160-unit browser/context and SQL label bounds. Suggestions require
a successfully saved ordinary reply, delivery still wanted,
unrestricted/adult-allowed state and classification below level 2.
They cannot rewrite a confirmed or Explorer-saved point, choose Priority or
arrange points. An unchanged label does not create a new history entry.

An Explorer or automatic Virtual Guide move onto a forming point changes
attention but creates no Route entry or captured label. Immutable set_attention
or Send facts keep only the target id. Confirming the point records every
deferred move once as attention_changed, in operation order, with the confirmed
wording, the revision and time the move would have had, and actor explorer or
virtual_guide, even if attention has since moved elsewhere. Rejection never
creates those Route entries. No later move captures an unconfirmed prior label.
The latest Explorer needle move after the last saved Virtual Guide reply still
supplies recentRoute's awaitingReply signal, including a move onto a forming
point, with its current label and actor explorer. TypeScript and SQL build the
same transient signal without writing a Route event; a later Explorer move
supersedes it and the next saved Virtual Guide reply clears it.
Amendment 2026-11-04 (S5): the read uses `ai.solmind_forming_attention_move_v1` to supply optional, server-only, label-free `authority_context.formingAttentionMove` as `{pointId,revision,recordedAt}`; a rejected latest move uses `pointId:null` and chronology only to suppress an older acknowledgment, with no browser field or Route event added.
The private confirmation/rejection helper is groundwork
for S6, with no new public execute grant or browser command; it requires current
Explorer authority, exact wording/revision, unrestricted active state and no
pending turn. Proposed points must be confirmed before Priority, arrangement or
category operations can capture their wording.

The additive optional `compass.suggestions` field keeps explorer-safety-reply.v2.
The private ordinary context revision becomes
wi007-v0.1+onboarding-fields-v2+compass-v2, with
explorer-compass-context.v2 and formation saved or forming. SQL rederives the
same section exactly. methodology.serialized_methodology_valid accepts v2 with
its section and the base revision without a section, and refuses compass-v1;
exact replay returns before this check. Classification-only context still has no
Compass section or its exclusive source ids, using wi007-v0.1+onboarding-fields-v2. AV2 and
historical evidence remain unchanged. Prepare still has 37 arguments; context,
RPC and provider await limits remain 30/10/60 seconds, with the same cancellation,
one-call, exact replay and one-count-per-Send rules.

The browser contract accepts optional formation saved or forming so old fixtures
remain valid. The connected Compass card marks forming points with a dashed
outline and the word Forming, in Full and Compact views. Existing tool reviews
exclude forming points from Priority, arrangement and category captures while
keeping attention available. Ending on a forming point uses the label-free
sentence "Current attention was still forming." Global policy,
role text and output instructions permit bounded tentative suggestions without
claims of saving or confirmation; their version labels and integrity pins move
together. Paul must read the exact changed sentences before demo use.

This is isolated source construction, not integration or demo approval. Builder
checks are limited to TypeScript, ESLint and Vitest. SQL/pgTAP and browser suites,
the standing Executor-launched independent Claude review, integration and any
database/demo update remain Executor work. The builder may not access the
sibling solmind-docs repository: its Data Model 03, Orchestration 04 section 12.6
and Blueprint section 7.6 updates are an explicit outstanding handoff, not a
claim that canonical documentation was updated.

## Chat step S6a: replies on forming Compass suggestions - 2026-11-05

The connected screen now offers one row per current forming Compass point,
inside the list item of the Virtual Guide message that last supplied its wording.
S6a projects wording_message_id as optional forming-only wordingMessageId,
while sourceMessageId retains the original source. The closed browser parser
requires a present wordingMessageId to name a saved Virtual Guide message;
older projections without it show no reply row. This display pointer is absent
from provider context, whose source IDs and bytes are unchanged. The row offers
"That's right", "Close, not quite" and "That's not it"; these labels and the
reason sentences remain drafts for Paul's wording read. Confirmed, rejected,
combined-away and ended points have no reply row. The review mockup is unchanged.

The closed browser command respond_compass_suggestion carries only itemId,
response (right, close or not_it), operationId and expectedRevision. Its separate
eight-argument service-role-only RPC is
public.solmind_respond_explorer_compass_suggestion_v1, introduced only by
supabase/migrations/20261105020000_explorer_compass_suggestion_replies.sql.
The existing generic mutate whitelist is unchanged. SQL reads the stored wording
under current-authority, active-session, ownership, known-clear-policy,
pending-turn and revision checks. Right confirms using S5's transition rules,
including recording each deferred needle move once with confirmed wording;
not_it privately rejects with the separate 24-row rejection limit; close records
the answer and leaves the point unchanged. Exact operation/fingerprint replay
changes nothing; a stale revision conflicts. No response command calls a provider
or counts as a Send. The private immutable operation receipt adds only
compass_suggestion_item_id and compass_suggestion_response; it retains no
snapshot of forming wording.

A pending turn, the turned-down limit and invalid forming-point selections use
the existing definite-conflict path: the browser requires a refresh and starts
no follow-up Send.

explorerConversationContract.ts owns the closed command and optional UI-only
compassSuggestionReplies availability (available, support, adult_policy or
unavailable). explorerPrivateConversationComposition.ts derives that value from
server policy, routes the command and refuses restricted/adult-stopped changes.
This is a deliberate, coarse display value derived from private policy for
only the Explorer's own screen; it includes no level, version or evidence.
explorerConversationComposition.ts owns its fingerprint.
explorerPrivateConversationRepository.ts owns the exact
respondCompassSuggestion port, wrapped by explorerPrivateRequestBudgets.ts with
the same 10-second budget as the other ports.

ExplorerCompassSuggestionReplies.tsx is presentation only; its labels and
current-source filtering live in explorerCompassSuggestionReplies.ts.
ExplorerConversationConnectedScreen.tsx places it in the existing transcript
list item. Busy, pending, uncertain and End-review states hold replies; close
and not_it also require ordinary Send availability and message capacity.
Restricted/adults-only states hide the controls and show one reason sentence;
an absent or unknown availability also fails closed. These are connected
controls, not build notes; existing build-note behavior is unchanged.

ExplorerConversation.tsx owns the sequence: after a confirmed close or not_it,
a separate suggestion_follow_up intent prepares one ordinary Send with the
button label followed by a colon, a space and the point's current wording in
straight double quotes, at the returned revision. Right makes no Send. The follow-up
retains the Explorer's typed draft, including across identical-byte uncertain
retry. Each phase has its own operation identity; no failure or uncertain
response command starts a follow-up. Existing authority-loss clearing, Send
counting, hard stops, cancellation and context/RPC/provider limits remain.
Typed confirmation interpretation remains S6b.

This is isolated source construction. SQL/pgTAP and browser execution,
independent review, canonical solmind-docs updates and any integration or demo
publication remain Executor work. The builder was limited to the clone and
the three named package files; no sibling product documentation was read or
written. Paul must read the new wording before anything reaches the app or demo.

## Chat step S6b: typed replies to Compass suggestions - 2026-11-05

Paul's decision of 2026-11-03 12:38:07 says typed replies always count.
The Virtual Guide may propose right, close or not_it only when the latest
Explorer message clearly answers its immediately preceding saved suggestion.
Residual risk: the model judges the typed answer's meaning; a button press
records the Explorer's explicit selection. Silence, topic changes and ambiguous
messages supply no answer; when unsure the Virtual Guide asks.

The additive optional compass.responses keeps explorer-safety-reply.v2.
The first three submitted entries are considered independently; malformed
entries are dropped and the first valid response per point wins. Ordinary
context becomes wi007-v0.1+onboarding-fields-v2+compass-v3 with
explorer-compass-context.v3. Each forming point adds only the boolean
suggestedInPreviousReply, derived identically in TypeScript and SQL from its
wording source and the last saved Virtual Guide message. Saved points add no
field. The prior context version is refused for new turns. Classification-only
calls keep the section-free base version and existing source exclusions.

The only forward migration is
supabase/migrations/20261105030000_explorer_typed_suggestion_replies.sql.
Settle v4 adds p_compass_responses as its 24th argument. It independently
requires an ordinary saved reply, delivery still wanted, unrestricted and
adult-allowed state, classification below level 2 and classification_and_reply.
A response must target a current forming head whose stored wording came from
the immediately preceding saved Virtual Guide reply. A response is also
dropped when that point already has an answer receipt (button or typed)
completed at or after that reply was saved, so a button Close followed by its
automatic Send never adds a typed receipt; typed answers to that same wording
then no longer count, and new wording from a refinement makes them count again.
A valid refinement in the same reply wins over its response, even when the
wording is unchanged.
The shared S6a transition confirms exact stored wording for right and records
deferred needle moves once; not_it rejects privately, silently dropping the
response at the separate 24-row limit; close records only the answer.
Applied responses use immutable point-id/answer receipts marked typed, with
no wording snapshot. Response proposals bind exact replay; no duplicate
transition or provider call is authorized.

explorerPrivateConversationComposition.ts filters proposals defensively;
explorerPrivateConversationRepository.ts closes and freezes the 24-argument
payload. The saved state updates the existing card and S6a reply row without
new controls. Prepare remains 37 arguments; grants, current authority checks,
30/10/60-second context/RPC/provider budgets, cancellation and Send counting
remain unchanged. App and migration must reach the database together.

Global policy, role text, output instructions, version labels, byte counts and
integrity pins move together. Paul must read the exact changed sentences before
anything reaches the app or demo. This isolated build grants no publication or
deployment authority. SQL/pgTAP and browser execution, independent review and
canonical sibling-document updates remain Executor work; the builder cannot
read or write the sibling documentation under this package's access limits.
