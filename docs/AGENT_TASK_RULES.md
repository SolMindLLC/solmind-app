# SolMind App Agent Task Rules

Version: 0.2.2
Last Updated: 2026-10-24
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
belongs to the separately reviewed authenticated S03 inbox/detail read layer.

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
provisioning, renewal or provider conversation.

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
times to AdminHome. Keep duplicate raw cookies visible to validation, shared
logout uncertainty honest and re-entry fixed to Admin. GET does not renew, clear
cookies or sign out; the Admin home allow still requires its audit writes.
The /admin prototype grants no new dashboard, private-data or provisioning power.

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
and cleanup movement retain their separate scope/authority.

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
