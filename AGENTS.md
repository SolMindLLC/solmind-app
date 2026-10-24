<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# SolMind App Agent Instructions

Repo: solmind-app
Product: SolMind MVP0
Primary framework: Next.js 16 / React 19 / TypeScript

## Required Reading Before Code Changes

Before making code changes, read:

- `docs/AI_MAINTENANCE_MAP.md`
- `docs/AGENT_TASK_RULES.md`
- `docs/MODULE_BOUNDARIES.md`

Also check the canonical product documentation in the sibling repository:

```text
../solmind-docs
```

Most binding product references before auth/database work:

- `execution/01_SolMind_Phase0_Build_Spec_v1_0.md`
- `execution/03_SolMind_Phase0_Data_Model_Spec_v1_1.md`
- `execution/04_SolMind_AI_Orchestration_Spec_v1_0.md`
- `execution/05_SolMind_Privacy_And_Security_Baseline_v1_0.md`
- `execution/07_SolMind_MVP0_Implementation_Task_Breakdown_v1_0.md`
- `execution/08_SolMind_MVP0_Test_Plan_v1_0.md`

## Core Rules

1. Keep changes small, explicit, and reversible.
2. Keep route files under `src/app` small.
3. Put reusable UI in `src/components/solmind`.
4. Put SolMind product rules, constants, and workflow definitions in `src/lib/solmind`.
5. Do not duplicate role string literals.
6. Do not weaken safety, consent, escalation, role, or privacy behavior.
7. Do not add dependencies or modify `package.json` without explicit approval.
8. Do not modify database schema or Row Level Security policies without updating relevant documentation.
9. Run verification commands before claiming success.

## Canonical SolMind Terms

Use these role names consistently:

- Admin
- Guide
- Explorer

Avoid deprecated generic terms such as "client" in product UI and documentation. Use "Explorer" when referring to the person receiving reflective support.

Use these assistant names consistently:

- SolMind Virtual Guide
- SolMind Guide Assistant

The `/guide` route is the human Guide dashboard. Do not label it as the SolMind Guide Assistant dashboard.

## MVP0 Authentication Boundary

The MVP0 authentication model is:

- Explorer: passwordless email or SMS verification.
- Guide: password plus email or SMS verification.
- Admin: Admin password plus verification code.

Do not describe Guide authentication as passwordless.

## PRJ01_R-WS09-WI021-S01 Explorer Prototype Boundary

The `/explorer` route contains the deterministic in-memory S01 prototype.

- `src/app/explorer/page.tsx` stays a thin Server Component.
- `src/components/solmind/ExplorerExperiencePrototype.tsx` is the interactive
  client boundary.
- `src/components/solmind/SessionCompass.tsx` is controlled and
  presentational.
- `src/lib/solmind/explorerExperience.ts` owns pure deterministic transitions,
  Compass grouping, Route history, exact selection, snapshot freezing, and
  the narrow non-live Guide projection.
- `src/lib/solmind/onboarding.ts` owns the exact structured-form definitions
  and distinct required-form/optional-First-Compass states.

S01 must not call an AI provider or imply a model or human Guide is live. It
must not use a database, route handler, cookie, `localStorage`,
`sessionStorage`, URL state, or another persistence mechanism. It must not
hard-code or simulate the future 1-100 day sendability setting, describe an
in-memory Waypoint as durably stored, rotate the whole Compass, add literal
direction letters, or introduce clinical scoring.

Never pass the complete Explorer experience state to a mock Guide result. The
narrow Guide projection may contain only submitted onboarding answers and the
exact in-memory Shared Snapshot the Explorer confirmed. It must exclude the
conversation, Route, private Waypoint, Private Summary Draft, excluded detail,
selection state, and unconfirmed material.

The bounded S01R2 `/explorer/compass-comparison` route is a separate
conversation-first review surface. Keep its route thin, its client
orchestration in `ExplorerCompassComparison.tsx`, presentation in
`ExplorerCompassComparisonParts.tsx`, and deterministic state transitions in
`explorerCompassComparison.ts`. It inherits every S01 no-provider,
no-persistence, no-auth, no-browser-storage, no-notification, and no-real-user
boundary. Its message replies remain a fixed local script; its conversation,
Waypoint, quotation, and sharing controls must not imply that a model, human
Guide, or sharing service is connected. Genuine server-side Virtual Guide
conversation remains `PRJ01_R-WS09-WI021-S03`.

The first provider-dispatch increment for that later lane is the bounded S03B
conversation contract under `src/lib/solmind/virtual-guide/`. Keep it
server-only, provider-neutral, and off shared/client barrels. It accepts only
the already-authorized compact S03A context serialization plus opaque binding,
snapshot, invocation, and fingerprint identifiers; calls only an injected
transport; enforces a bounded timeout and caller cancellation; validates the
exact response; and exposes only closed, value-free errors. S03B does not own
source retrieval, authorization or consent refresh, fingerprint creation or
verification, a provider adapter, persistence, audit writing, a route, the UI,
deployment, or real-user activation. Tests may use an in-memory fake transport;
production code must not silently fall back to it.

The bounded S03C owner is
`src/lib/solmind/virtual-guide/authorizedVirtualGuideContext.ts`. Keep its
request identifiers server-derived and its source interface limited to one
authorization snapshot read plus one final version revalidation. It must prove
the self-Explorer actor/account binding, active onboarding, adult affirmation,
an active or paused relationship, the complete current required-consent set,
and matching S03A Explorer/session context before returning an S03B request.
Its SHA-256 fingerprint covers the exact compact S03A serialization. S03C does
not persist the supplied context-snapshot ID, make final pre-provider evidence,
select/call a provider, log or audit, expose a route, or activate a user path;
S03D and later owners retain those duties.

The bounded S03D owner is
`public.solmind_prepare_virtual_guide_predispatch(...)` in
`supabase/migrations/20260924000000_virtual_guide_predispatch_evidence.sql`,
hardened by
`supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql`.
Keep it service-role-only, security-definer, empty-search-path, lock-bounded,
atomic and null-safe in every authority and exact-retry comparison. It
revalidates current Explorer authority, one of the three allowed Explorer
session types, active session/account/profile/onboarding, active or paused
relationship, no other current Guide relationship for the Explorer, Practice
binding, clear restricted mode, adult affirmation and the exact current
required-consent set. The Practice and its Organization must remain active and
approved. Lock the reviewed authority rows and the required-consent definition
while the transaction establishes evidence. It must persist exactly one bounded snapshot, one started
invocation and the two closed value-free Family E audit events before provider
I/O. The AV1 proof binds the current authority facts; source IDs and consent IDs
are canonical sorted unique arrays. `exact_retry` is a no-dispatch disposition,
never authority to call a provider again. The database verifies only the AV1
authority proof; the context fingerprint and source IDs are caller-attested, so
`created` is necessary but not sufficient for a provider attempt, and v1
evidence alone never authorizes an Explorer-facing dispatch (see
`docs/AGENT_TASK_RULES.md`). S03D owns no context loading, provider
call, route, message persistence, safety response, deployment or real-user
activation.

The bounded S03E owner is
`src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts`. Keep the
Responses endpoint, `gpt-5.6-luna`, medium reasoning effort, `store: false`,
fixed Virtual Guide instructions, output cap and no-tools posture explicit.
Accept the credential and HTTP function only through the server composition
root; do not read environment state here. Send only the already-authorized S03B
context bytes as provider input, never separate Explorer/session/snapshot IDs or
metadata. Provider bodies and errors remain value-free at the S03B boundary.
S03E is a dormant transport adapter: the pre-dispatch gate (an S03D `created`
outcome plus server composition), the authenticated route, message persistence,
safety handling, deployment and runtime activation remain separate gates.

## Connected Explorer conversation construction - 2026-10-24

This provider-held construction increment does not complete the connected demo.
Current proof and checked publication status are owned by
`solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`. Preserve existing
S01/S01R2 previews, S03A-S03E contracts and login/session/logout owners.

`src/app/explorer/conversation/page.tsx` renders a public shell with no private
props. Its private GET `/explorer/conversation/state` and same-origin JSON POST
`/explorer/conversation/commands` perform fresh server authorization; the shell
or a home link supplies no feature authority. Keep handlers thin and no-store.
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts` preserves
raw duplicate cookies and reuses the fixed Explorer request-auth boundary;
`src/lib/solmind/supabase/explorerConversationRepository.ts` exposes only the
four closed feature RPC capabilities.

`src/lib/solmind/explorerConversationContract.ts` owns closed browser shapes.
`src/components/solmind/ExplorerConversation.tsx` owns fetch, view lifetime,
bounded results and one operation identity/revision with exact uncertain retry
bytes. Browser IDs are selections, never actor/session/provider authority.
A server `pendingTurn` holds new commands; pending or failed transport must
never appear as a confirmed saved reply. Exact replay never redispatches.

`src/components/solmind/ExplorerConversationFormation.tsx` and
`src/lib/solmind/explorerConversationFormation.ts` keep empty Discovery valid,
take an exact owned saved message and Explorer label, confirm Priority
separately from attention, and require explicit destination/meaning/arrival
confirmation for a private chosen Waypoint. Show chosen as In progress.
Reached needs a later explicit evidence review and confirmation. No sharing,
automatic interpretation, clinical score or browser storage is introduced.

The server-only owners
`src/lib/solmind/virtual-guide/explorerConversationComposition.ts` and
`src/lib/solmind/virtual-guide/explorerConversationContext.ts` compose the
existing S03A/S03C/S03B contracts. Context requires injected trusted versioned
policy/behavior/crisis/methodology configuration; no fabricated default pack.
Include the six existing submitted onboarding continuity fields in banked form
order, with required blanks rejected and optional blanks absent, plus the last
24 saved owned messages and immediate message. Qualify onboarding identity by
actual response-set UUID and approved field; reject duplicate fields and
cross-kind UUID reuse. Keep one physical intake UUID in source evidence and
serialize selection revision `wi007-v0.1+onboarding-fields-v2`. Prior conversations,
summaries, Reflections and Guide-private data remain omitted. Explorer preferences
must never masquerade as the Guide-authored `explorerSafeGuardrail`.
Bind exact compact bytes, fingerprint, source IDs and configuration versions
to successor evidence before any separately authorized provider attempt.

`supabase/migrations/20261024000000_explorer_conversation_composition.sql`
proposes service-role-only read/prepare/complete/mutate RPCs, private
Compass/Waypoint persistence, pending/revision/replay controls and AV2/v2
snapshot evidence. Preserve v1 records without retrospective enrichment;
v1 evidence alone supplies no Explorer dispatch authority. No direct browser
table grant, permissive policy, seed or provider call belongs in this migration.
The concrete request factory deliberately omits provider and context builder:
send stays unavailable and writes no new turn while activation is held.
No fake production fallback, provider activation, deployment, sharing,
real-user effect or assurance/banking result is granted by these source files.

## PRJ01_V-WS05-WI022 Suggested Waypoint UI Boundaries

`ExplorerSuggestedWaypointWorkspace.tsx` remains deterministic fixture-backed
design evidence for private comparison, response, and acknowledgement flows.
It does not own `/explorer/waypoints`: that route now composes the separately
reviewed authenticated S03 inbox and detail reads. Do not add cross-role
lifecycle state to `ExplorerExperiencePrototype.tsx`.

`/guide/explorers/avery/waypoint-suggestions` is the paired deterministic Human
Guide review surface. Keep its route thin, its client UI in
`GuideSuggestedWaypointWorkspace.tsx`, and its synthetic lifecycle construction
in `guideSuggestedWaypointFixtures.ts`. It may demonstrate Guide-only drafts,
pending sends, Pull Back, open suggestions, deliberate receipt
acknowledgements, corrections, withdrawal, and Guide-only archive language,
but it must not infer passive Explorer activity or expose Explorer-private
comparison, drafts, questions, Waypoints, or Virtual Guide observations.

The retained fixture surfaces must not use a provider, database, route handler,
server action, cookie, `fetch`, browser storage, notification, or real Guide
data. Every visible fixture control must navigate, change only fixture-local
state, or explain its intended production behavior. Authenticated Explorer
read projections must exclude Guide-only draft, pending-send, Pull Back,
archive, appointment, relationship, and Guide Assistant state.

The visible disclosure must say the flow is an early fixed-script prototype,
not a therapist or crisis service, and that refresh clears it. Protected
persistence belongs to `PRJ01_R-WS09-WI021-S02`. Genuine server-side Virtual
Guide conversation belongs to `PRJ01_R-WS09-WI021-S03`.

## PRJ01_V-WS05-WI022-S03 Suggested Waypoint Transport Boundary

The first S03 increment is a closed server-only RPC transport under
`src/lib/solmind/supabase/`. It allows exactly nine human calls and one
delivery-worker call. Keep those capabilities in separate executors, keep both
modules off the shared Supabase barrel, and omit the dormant Admin operational
query. Validate exact call and response keys, UUIDs, page sizes, cursors,
bounded text, lifecycle coherence, and the protected 60-3600 second send-grace
shape before returning a frozen copy. A zero-row Guide or Explorer detail read
is a value-free denied outcome bound to the exact get function; zero rows for
every other function remain failures. Map all failures to value-free sentinels.

The banked `suggestedWaypointRequestComposition.ts` is the direct-import
server-only human-request boundary. It validates exact
client-safe Guide/Explorer shapes, derives actor identity and role from the
injected request-auth and record sources, rechecks Guide relationship access,
injects only the server-derived actor, and maps transport detail to fixed
browser-safe results. Guide-authored destinations are single-line at this
boundary, and every bounded command text field rejects isolated UTF-16
surrogates plus Unicode line and paragraph separators, so accepted writes
remain valid for both list projections and the first-write byte cap. Initial
suggestion/version identifiers come only from an
injected server resolver, never a browser form. Keep the module and test off
shared barrels. It does not itself own a route, Server Action, worker, UI,
hosted scheduler, provider integration, deployment, or real-user activation;
separately reviewed thin read routes call it.

The server-only first-write security predecessors are
`auth/trustedApplicationOrigin.ts` and
`auth/sameOriginJsonWriteRequest.ts`. Keep them direct-import and off the auth
barrel. Future Guide and Explorer command routes must use the exact trusted
server origin, same-origin Fetch Metadata, strict JSON media/framing checks,
and the bounded 16,384-byte stream before auth or executor IO. Never derive
write authority from Host, forwarded headers, Supabase URL, or a
`NEXT_PUBLIC_*` value. These helpers do not themselves authorize a POST route,
choose a role action, authenticate a principal, or invoke the database.

The banked concrete request-dependency owners are
`suggestedWaypointRequestDependencies.ts` and
`suggestedWaypointScopedIdentifiers.ts`. Keep both direct-import and
server-only. The request-scoped factory must construct verified request
identity, enumerated auth-record reads, the closed human executor, and required
stable scoped identifiers. The factory does not itself own a route or browser
caller, although the separately reviewed read routes use it. UUIDv5
inputs must bind purpose, actor, relationship, operation, and when applicable
the target suggestion so identical retries are stable and authority scopes do
not collide. Do not export either owner from a shared barrel.

`src/app/guide/waypoint-suggestions/relationships/route.ts` is the first
read-only S03 browser-reachable boundary. Keep it a thin dynamic Route Handler:
the query may control only one closed page size and one optional opaque cursor;
request cookies and server records derive and recheck Guide authority; and the
outward JSON may contain only the fixed relationship-selector result. It is
not the canonical Guide Explorer roster, does not protect a page, and must not
add onboarding, appointment, Shared Snapshot, Practice, suggestion-count,
contact, or private Explorer fields. It may not invoke human commands, mutate
Suggested Waypoints, replace fixture UI, schedule delivery, call a provider,
or imply deployment or real-user readiness.

The separately reviewed Guide list/detail and Explorer list/detail routes are
also thin, dynamic, uncached, and read-only. Guide reads accept only an
authorized relationship selector plus closed pagination or one suggestion
identifier. Explorer reads accept only closed pagination or one opaque
suggestion identifier and derive the Explorer actor from request auth. Every
browser contract must reject widened role, relationship, authoring, pending,
policy, Assistant, private Waypoint, conversation, evidence, or inference data.
These read paths do not authorize command routes, delivery, providers,
deployment, or real-user activation.

The authenticated Guide detail is the first browser command caller and may
invoke only `guide.save_draft` and `guide.schedule_send` for an existing
complete Guide-only draft and `guide.pull_back` for the exact protected pending
version, through the existing relationship-scoped command route. Each command
must construct one exact request (Pull Back from the protected pending-version
selector), retain identical bytes and the same UUIDv4 operation identity across
a transport-uncertain retry, and reload the authoritative detail after every
conclusive response. A browser countdown is display-only and never authorizes
Pull Back. If a conclusive command is followed by a failed detail read, retry
the read, not the command. Never render, announce, log, or put the pending
version identifier in a URL, and never widen Explorer projections. Guide
correction, withdrawal, worker, provider, deployment, and real-user edges
remain separately gated.

## Sign-in Preview and Connected Role Boundaries

The approved sign-in mockups remain the presentation baseline: A1, A2, A4,
M1, M2 and M3 (2026-09-29), and Guide A3/Admin A3A (2026-09-30).
The banked Explorer layer keeps src/app/login/page.tsx and
src/app/login/explorer/page.tsx thin. LoginExperience owns A1 and explicit
Explorer wiring, with fixed Explorer re-entry. Connected Guide uses fixed
/login/guide and separate GuideSignIn wiring. Connected Admin uses fixed
/login/admin and separate AdminSignIn wiring. Standalone SignInPreview,
SignInPreviewParts and signInPreview callers retain their in-memory behavior. Source/check results alone do not establish banking; SL-070 in
solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md
and its linked checked receipt own current Guide publication/banking status.

Each screen follows its approved mockup's layout and wording. The preview is
not connected. It must not use a route handler, server action, cookie,
`fetch`, browser storage, URL state, Supabase, or the `src/lib/solmind/auth/`
modules, and it must not issue, check or store a code, look up an account or
create a session; what a visitor types stays only in page memory until
refresh. Its wording never confirms whether an account exists.

The preview's own additions are styled apart from the approved layouts. A
separate "Preview controls" band holds the not-connected disclosure, a
switcher between A4 and M1 to M3, and on A3 and A3A a "Preview: this browser
is already remembered" switch; a distinctly styled "Example screen: no
code was sent or checked" callout sits beside each code screen's claims; and
controls that are not connected explain, beside themselves, what they will do,
without leaving the screen. Within that preview, Guide opens A3 and Admin opens
A3A. Submitting either goes to A4 for that role, whether or not the
remembered-browser box is ticked. With the switch on, the tick box is hidden,
because the browser is already remembered and the box would do nothing; the
button reads "Sign in" and explains beside itself that it will sign in
without a code; and the screen stays. The tick box and the switch keep their
state only in page
memory, and nothing is remembered. The password field is uncontrolled, so
what is typed in it never reaches the preview's state or markup, and it is
never logged or put in the URL. `LoginOptionList.tsx` and `loginOptions.ts`
are retained but no longer used by `/login`. These restrictions apply to the
preview, not to the separately named connected role owners below.

The connected Explorer boundary uses `src/components/solmind/ExplorerSignIn.tsx`
and its browser contract/transport/controller for exactly the send and verify
POSTs. A current accepted result alone permits fixed `/explorer/home` navigation;
client navigation or cookie presence never authorizes that page. The server page
uses `src/lib/solmind/auth/explorerHomeAccess.ts` and the current binding-aware
direct-token composition. It preserves duplicate raw cookie names and exact
values before validation; `cookies().getAll()` cannot prove that preservation.
Only expiry and server observation times reach `src/components/solmind/ExplorerHome.tsx`.
No token, account/session ID, password, code or selector enters URLs, logs,
browser storage or home props. GET never refreshes, clears cookies or signs out.

`src/lib/solmind/logoutBrowserRequest.ts` owns the one guarded POST `/logout`;
only confirmed `signed_out` shows S1. Unconfirmed/refused/missing answers show
honest SM-OUT-01 uncertainty; never claim administrator notification. Guard denial
or apparent expiry shows S2 with fixed `/login/explorer` re-entry. The five-minute
warning is advisory; Stay signed in remains a separate later amendment. Paul
approved the sign-in and session reminder text on 2026-10-17; the exact messages
are recorded in `solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`,
under Explorer screen copy approved - 2026-10-17.
`/explorer` stays a prototype; this home grants no Virtual Guide feature authority.
See `docs/MODULE_BOUNDARIES.md` for ownership and source/runtime evidence limits.

## Connected Guide boundary

Keep fixed Guide page/POST entrypoints thin; browser transport/controller belong
in src/lib/solmind and mounted UI in src/components/solmind/GuideSignIn.tsx.
Guide uses email only, unchanged typed password and a SolMind code. Send contains
no password. Private drafts are cleared on cancellation/disposal; logs, URLs
and browser storage must contain no credentials, selectors or tokens.

Server order is fixed-role eligible lookup, non-consuming exact challenge/
account/contact ownership, password private hold, redemption, provider-user/
redeemed-account confirmation, session creation, accepted-session preparation
and release. Wrong password leaves redemption uncalled; another account's
selector must not reach password. Refusals preserve existing cookies and publish
no new auth/binding cookie. Await bounded discard after held failure; timeout
does not prove remote rollback.

src/lib/solmind/auth/guideHomeAccess.ts owns fixed-Guide access. Preserve
raw-cookie ambiguity and current principal/session/role/binding checks; only
expiry/observation times reach GuideHome. Reuse shared /logout, honest uncertainty,
finite reminders and Guide re-entry; no GET renewal/cleanup. Admin has its
separate connected boundary below; the broader /guide dashboard remains separate.

October 21 R04 real functional/contention observations and separate app/SQL
checks are recorded in solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.
Paul's 20:17:31 CDT approval in
solmind-sprints/PRJ01-SPR001/Validation_Workspaces/Guide_Local_Risk_Approval_2026-10-21.json
accepts disclosed small-sample timing/capacity risks and defers real exhaustion/
induced provider/session/cookie failure timing only for private synthetic local
use. The original full protocol is not claimed passed; deferred measurements
remain required before broader exposure or real users. This dated Guide-only
approval supplies no Admin risk acceptance. Unit fakes and Explorer
proof do not replace real timing evidence or full assurance. Preserve accounts/
private passwords; no blind reset or automatic setup. Future first-Admin setup
must reuse the approved username rule.

ExplorerHomeNavigation.tsx is presentation only: Conversation and Compass entry,
authenticated Waypoint inbox link and collapsed fixed-script previews. Each
feature keeps its own authorization; preserve Explorer session/logout and
provider/privacy boundaries.

## Connected Admin boundary

Keep src/app/login/admin/page.tsx and its two fixed POST Route Handlers thin.
LoginExperience owns chooser/direct-entry wiring; AdminSignIn, its separate
transport/controller and fixed /admin/home destination own the browser flow.
Use approved email/username normalization, unchanged typed password and the
same-account/contact ownership-before-password order. Send carries no password;
read it only from the uncontrolled field for verify. Clear private drafts on
departure/disposal; credentials/selectors/tokens never enter logs, URLs, storage
or home props. Refusals preserve existing cookies; bounded discard is not rollback.

The fixed /admin/home rule uses adminHomeAccess and resolveAdminHomeForRequest,
not a bare Guide guard or the public access probe. The server-only audited chain
runs once. On a would-be allow, guarded-read write first and allow-decision write
second must both persist, then a final expiry/clock check must pass. Do not add a duplicate read or third audit event.
Preserve resolveAdminAccessForRequest's exact { allowed } result and
resolveAdminActorForRequest's existing server-only actor projection. Only
expiresAt/observedAt reach AdminHome; preserve raw duplicate cookie names/values.
Reuse shared /logout, finite reminders, honest uncertainty and /login/admin
re-entry. /admin stays a prototype; this home adds no dashboard/provisioning power.

Admin timing configuration is explicit and provisional; see
src/lib/solmind/supabase/adminSignInHttpPorts.ts and docs/MODULE_BOUNDARIES.md.
Guide's dated proof/private-local risk acceptance does not accept Admin risk.
Source checks alone establish no runtime/timing/assurance/publication/banking
result; current complete-slice evidence and its checked receipt remain required.
First-Admin setup, SMS, reset, remembered browser/renewal, broader Admin work,
new SQL/schema/grants/dependencies and provider activation stay separate.

## Secrets Boundary

Never expose server secrets through `NEXT_PUBLIC_` variables.

Do not expose:

- Supabase service-role keys
- Admin bootstrap tokens
- provider secrets
- server-only credentials

Client-accessible variables must be intentionally public and safe to expose.

## Local AI Executor Boundary

When an AI assistant is operating locally in this repository:

- Read "the operating Codex executor", "the operating Codex assistant", and "Codex" where it performs a duty that the reading table in `solmind-docs/ai-assistant/12_SolMind_AI_Assistant_Role_Assignments_v0_1.md` maps to the Executor AI, as the Executor AI that document identifies: the one conversation Paul designates. In Paul's approved wording: "You are the Executor AI only if Paul has explicitly said so in this conversation, or you are the same conversation the sprint handoff records as the current holder. If neither is true, or anything is unclear, you are not the executor. Do not apply, stage, commit, push, bank or clean up. Ask Paul. If he is away, queue the question for his next meeting and continue the work that is not exclusive to the executor." Only the current designation counts: words Paul gave before naming another conversation, or that a fork or branch copied from its origin, do not make a conversation the holder. A subagent or helper that a conversation starts is never the executor, even inside the holder's session; it stops before those steps and reports to the conversation that started it instead of asking Paul.
- Any locally operating assistant may inspect files, edit files within its explicit authority, and run authorized local checks.
- Only the operating Codex executor may automatically apply a frozen proposal, stage all-and-only the disclosed paths, commit, and push. It may do so without a routine Paul checkpoint only after the mode-appropriate adversarial review passes, every finding is reconciled, and all applicable checks/tests pass under `solmind-docs/ai-assistant/02_SolMind_AI_Assistant_Implementation_Repository_Workflow_v1_0.md`. During Unattended mode the operating Codex executor performs the local adversarial review; during Attended mode the best available external AI performs it after Paul's exact transmission/run approval under `solmind-docs/ai-assistant/05_SolMind_AI_Assistant_External_AI_Review_Workflow_v1_0.md`, or, for an independent read-only review the Executor AI launches, within Paul's standing independent-review direction in that workflow.
- Only the operating Codex executor may use the two substantive correction cycles defined by Workflow 02. Directly related mechanical fixes stay inside the active cycle. Re-review and rerun affected/full applicable validation after every substantive correction. After two unsuccessful cycles, stop, open the live-LEFT/proposal-RIGHT BC5 folder comparison, explain the remaining failures, and ask Paul whether to continue.
- Claude Code (except in the conversation designated as the Executor AI), an external-review model, and any other external AI remain proposal authors or reviewers only. They never receive automatic application, staging, commit, push, merge, deployment, or banking authority from this section.
- It must not run production, cloud, install, dependency, Vercel, or Supabase cloud changes unless explicitly approved.
- It must never reset, drop, or destructively alter a pilot, cloud, production, linked remote, or other database that contains live user data.
- It may start the bounded local Docker development environment and run `npx.cmd --offline --no --package supabase@2.115.0 -- supabase db reset` against the existing local development database without separate approval when needed for testing. Before every reset, it must affirmatively verify immediately before starting that no other test is using that database. If another test is using it, wait until that test completes, perform a fresh idle check, and only then proceed. If use cannot be determined or the active test does not complete, do not reset; stop and report to Paul. Do not interrupt or invalidate the active test. This authorization covers rebuilding local development contents from repository migrations and seed data; it does not authorize dropping the database, its persistent volume, or its local Supabase project/container resources.
- The existing local development database is the default for ordinary development testing. Use an isolated temporary test database only when the test plan names a real isolation need, such as parallel or adversarial execution, intentional crash or cancellation testing, an unusual starting state, variant comparison, preservation of useful local development state, or a harness that requires exclusive database control.
- It may create, reset, and drop a clearly identified temporary test database, including exact test-created containers or disposable volumes, without separate approval. Temporary test resources may persist only until the required evidence is captured; then remove them immediately, verify that no test-created residue remains, and close any Docker window opened for that test.
- If temporary-resource cleanup fails, the test is incomplete. Preserve the evidence, report and quarantine the exact residue, do not touch unrelated Docker resources, and do not leave routine cleanup debt for Paul.
- Merge outside the approved repository flow, deploy, production/cloud change, provider activation, and real-user effects retain their separate approval gates.
- After every successful push, immediately report in plain English the repository and commit, what changed and why, user/product/project effect, material assurance completed, and anything unfinished or separately gated, with a link to the detailed evidence.

## Verification Commands

Run before reporting completion:

```powershell
npm.cmd run lint
npm.cmd run build
```

For `PRJ01_R-WS09-WI021-S01`, also run focused and full tests, typecheck, and
a targeted source scan confirming no provider, Supabase, cookie, route
handler, server action, `fetch`, `localStorage`, or `sessionStorage`
integration in the new S01 files.

## If Uncertain

Stop and report:

1. What changed
2. What you intended to change
3. What you are unsure about
4. What command failed, if any
5. Recommended next step

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
