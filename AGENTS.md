<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# SolMind App Agent Instructions

## Five Waypoints per conversation (lane 12) - 2026-11-06

Paul's rule (decision queue 2026-11-05 19:38:45 CST, Waypoint limits rule 2;
execution/07 item 32 (b)): at most five different Waypoints form in one
conversation, counting any later Reached or Released. A different Waypoint is
an original version (no predecessor) the Explorer chose in that conversation;
a separately formed one counts even with identical wording, drafts do not
count, and revisions and revisits continue an existing Waypoint and use no
place. Conversations already above five keep everything; only a further new
Waypoint is refused. Built on the recommended defaults of the decision card
(Validation_Workspaces/Five_Waypoints_Per_Conversation_Decisions_For_Paul_2026-11-06.md);
Paul approved them, the wording sheet and the fifth Guide sentence in the decision
queue on 2026-11-07 at 08:02:45 CST.

The forward migration
supabase/migrations/20261106060000_explorer_five_waypoints_per_conversation.sql
adds protected ai.solmind_waypoint_root_room_v1 and
ai.solmind_waypoint_insert_allowed_v2 (history, active and, for a new
Waypoint, the conversation's five), replaces ai.solmind_waypoint_insert_allowed_v1
in place to call v2 with creates_root equal to increases_active (its two
remaining callers, manual confirm_waypoint and the draft response helper for
"That's right" and a typed right, both form a new Waypoint), replaces
public.solmind_confirm_explorer_waypoint_revision_v1 in place to call v2 with
creates_root false (revisit and revision), and adds conversationRoom to
ai.solmind_waypoint_capacity_v1 (true before a first Send, when there is no
conversation yet; the guard still refuses an insert without one). Exact replay
still returns before any capacity check. No table, RLS policy or grant changes.

waypointCapacity is now {activeCount, activeLimit, historyRoom,
conversationRoom}; the closed parser requires all four. waypointHasCapacity and
waypointCapacityMessage take a purpose, "new", "revisit" or "revision". The
explanation order is the 200-version guard, then (new only) this
conversation's five, then (new or revisit) the 20 active Waypoints: releasing
an active Waypoint never makes room here. The current tools give revisits
their own explanation (history and active) instead of the new-Waypoint one.
The forming draft holds only "That's right", with its reason; the other replies
and typing stay available. The connected Waypoint card shows a quiet static
notice (no live region) while the conversation is open and full, also with no
forming draft. The draft row's polite status and the current tools' alert keep
their existing announcements, so both can speak when both are shown (as for the
lane 7 limits; the current tools are marked for removal).

Settlement drops new or refined waypointSuggestion wording when the
authenticated state has no conversationRoom; the reply, choices and other
proposals are kept. A same-reply suggestion still excludes a typed
waypointResponse when it is dropped (the exclusion uses the proposal as
received). SQL refuses a sixth Waypoint on every path regardless, and a refused
typed right keeps the saved reply.

The five Virtual Guide sentences (GPT-6 Astra's REV313 drafts, the third
replaced by Astra's REV316 wording, which also stops refining a forming draft
and gives the end-then-start route only at the limit, and a fifth for "Close,
not quite" at the limit, approved by Paul 2026-11-07 08:02:45) are in the role text and
only in the ordinary-reply HTTP instructions; the classification-only HTTP
instruction bytes are unchanged, while the role text (sent as context in both
modes) carries the sentences and the new labels. All five labels end in
-20261106-w5-r1; the role pin is 11717 bytes, the ordinary HTTP pin 9830.

Known limits: a tab that is behind (another tab formed the fifth Waypoint)
is refused as out of date before any capacity check and is told to reload; the
uncertain-save answer for a capacity refusal remains possible only when the
conversation's revision did not change, as for the 20-active limit across
conversations. Test fixtures: Waypoints that only fill the 20-active allowance
are stored in an ended earlier conversation, and 200-version cases are revision
chains, so each refusal is decided by the limit it names (a mutation check
removing each guard in turn fails exactly its own tests). The revision and
release suites now read the first history page, and the drafts suite's lineage
case shows two heads; the offset-20 page and the 20-head projection remain
covered by the lane 7 suite. The application and this migration must reach a
database together.

## Your Waypoints section - 2026-11-06

execution/07 item 43 (Paul's decisions, decision queue 2026-11-06 09:03:09 CST
items 1 and 3, and 15:13:41 CST item 2) adds the private "Your Waypoints"
section above Waypoint Suggestions on /explorer/waypoints. The page title is
now "Waypoints"; the Suggestions section keeps every read, command, live region
and text and becomes an h2 (its inner headings h3).
src/components/solmind/ExplorerYourWaypoints.tsx lists the signed-in
Explorer's current Waypoints from every conversation, 20 per page, in SQL's
order (active first, then Reached and Released, newest first), with one row
open at a time, the Reached and released group collapsed, earlier versions on
request, and Reached and Release reviews for Waypoints from ended
conversations. A Waypoint whose conversation has not ended reads "From a
conversation that has not ended" and links to the Explorer's conversation instead. Its live region is aria-live polite without the status
role, so the Suggestions section keeps the page's one status region.
src/lib/solmind/explorerYourWaypoints.ts owns the wording, all of it the
Executor's draft for Paul's wording read, including
YOUR_WAYPOINTS_EARLIER_VERSIONS_POINTER, which replaces the conversation
tools' "Earlier versions cannot currently be opened." The earlier-version link
on the conversation card stays hidden.

src/lib/solmind/explorerYourWaypointsContract.ts owns the closed browser
shapes (explorer-your-waypoints.v1): the list (current-head page items with
their conversationEnded display fact), the history (the current Waypoint, then its
predecessors, with complete), the close command (release_waypoint, or
reach_waypoint with trimmed 1 to 1,000 character evidence under the
conversation's existing text rule, isExplorerConversationText) and the close
result (one closed Waypoint from an ended conversation, with replay).
src/lib/solmind/supabase/explorerYourWaypointsComposition.ts is server-only:
it authenticates through createExplorerPrivateConversationRequestDependencies
with no capabilities (sign-in, early-test notice and 10-second port budgets;
no local run profile, configuration or provider), reads the current-head page,
walks one conversation's history pages (at most eleven reads; a row repeated
when a version saved during the walk shifts the pages is skipped) until the
lineage is complete, and closes with the existing closeEndedWaypoint port and
a server-computed SHA-256 fingerprint of the exact reviewed request. It reads
no transcript, active selector, configuration, context or provider, and gives
no Guide access. conversationEnded is display only; SQL alone allows a closure
(ended conversation, original owner, chosen head, Reached policy).

The three thin routes under src/app/explorer/waypoints/your-waypoints/ are
GET state (only an optional offset, a multiple of 20), GET history (exactly
conversationId and waypointId) and POST commands (no query, trusted origin,
readSameOriginJsonWriteRequest, exact-key body). All are no-store with
value-free failures, and they join the early-test notice real-path test.
An uncertain save (no answer, an unreadable answer or "unavailable") keeps the
review open and locked with the same operation and exact request, so pressing
the button again is an exact replay; conflict and denial close the review and
reload the list, and after an uncertain attempt they say the outcome could not
be confirmed. A closure moves a Waypoint from the active rows to the closed
rows and shifts later offsets, so after a save every shown page is read again
from offset 0 and the saved Waypoint stays in view; Show more waits while that
reload or a save runs, a reload that takes over clears a pending Show more, no
row opens or closes during a save, focus returns to the Waypoint's row after a
refusal (and is restored by a reload only if it was lost), and a failed reload
adds its sentence after the outcome sentence.

The forward migration supabase/migrations/20261106050000_explorer_your_waypoints_ended_fact.sql
replaces ai.solmind_waypoint_page_v1 in place (same signature, owner, settings
and privileges) so each current-head row carries conversationEnded: whether its
own source conversation has ended (status ended with an end time, the test the
post-End closure applies), in any Guide relationship. The ended-conversation
list covers only the current relationship, so it cannot tell a Waypoint from an
ended conversation with an earlier Guide apart from one in the open
conversation. History pages and closure results carry no such fact; the
portfolio parser requires it on current-head pages and refuses it elsewhere.
No table, RLS policy or grant changes. The application and this migration must
reach a database together.

## Second test-run review fixes - 2026-11-06 (REV306b)

This isolated fix round follows BUILD_SPEC.md and BUILD_SPEC_ROUND1.md in the
2026-11-06_1621_Pkg_TestRunFixesFix_Astra6Ultra_REV306b package. The builder
reads only this clone and the six named package files, writes only this clone,
uses apply_patch, and performs no Git write, network, provider or database action.

The typed Compass response exclusion is derived from raw valid rewording
proposals before the application pacing gate; a dropped refinement cannot
authorize a simultaneous right, close or not_it response. SQL collects its raw
valid refinement ids before applying suggestions. The application still sends
no Compass suggestions below three Explorer messages; other proposals survive.
The four listening/pacing/acknowledgment HTTP sentences belong only to
classification_and_reply. The Compass wording sentence now reads exactly:
"Suggest short Compass point wording in compass.suggestions only once the
concern is clear; when unsure, keep listening." The other three sentences are
unchanged. All five labels end in -20261106-tf-r2; byte counts and pins agree.

The same forward migration, 20261106030000_explorer_failed_reply_reason.sql,
narrows the canceled CHECK branch to exclude trusted_render_unavailable.
Its read-v3 replacement keeps the existing signature, authority, capacity,
owner lock, privileges and time limits. Only an exact terminal Send replay
with no saved reply and a closed recorded failure (including the known legacy
failed-Send summary provider_unavailable) gets the server-only
authority_context.replayFailedReply flag. The flag enters neither browser
state nor model context. It triggers the same fresh readiness, authenticated
state, safety and capacity checks as an immediate failed reply; no replay
dispatches again. Withheld prose is a policy/delivery decision, retains no
failure reason, and does not show the retry sentence.

Show me around opens its local tour whenever that choice is displayed,
independently of Send gates. The initial title receives focus; later step
changes use one live announcement and retain focus on the chosen topic or
Next/Finish control. Closing restores the opener. "Back to the conversation"
replaces the tour's "Let's begin" control; the related sentence is draft copy
for Paul's wording read. Only reply_failed omits the temporary-assistance
footer; critical assistance keeps its existing handling.

A deliberate retry remains a new counted Send and saves the Explorer's line
again. Prepare already saved the original line, and failure retains both it
and the typed composer. Uncertain retry keeps the exact operation identity.
No tour-taken state or daily-offer scheduler is added. All safety, consent,
capacity, cancellation, one-call and 30/10/60-second budgets remain.
TypeScript, ESLint and focused Vitest are the only builder execution checks;
SQL/pgTAP and browser execution, independent Executor review, Paul's wording
read, canonical documents and coordinated integration/publication remain
Executor work.

## Second test-run fixes - 2026-11-06 (REV306)

Paul's 15:13:41 decision, "All four as recommended", authorizes this isolated
source increment on top of the active-Waypoint and reply-choice changes.
The server counts the authenticated conversation's full Explorer message
history plus the immediate Send. EXPLORER_COMPASS_SUGGESTION_MIN_MESSAGES is
three: before then, new and refined Compass suggestions are dropped without
dropping the reply, choices or other proposals. Choice taps and suggestion
follow-ups count as messages. Role and HTTP instructions say to listen first,
reflect, ask one open question at a time and offer possible meanings when useful;
wording waits until the Explorer's concern and what matters most are clear.
All five instruction labels end in -20261106-tf-r1; bytes and pins move together.

After a confirmed "That's right" on either a forming Compass point or Waypoint,
ExplorerConversation starts the same separately identified ordinary follow-up
Send as the other suggestion answers, using the existing label/quoted-wording
format. It counts once and retains every gate and the Explorer's typed draft.
If Send is gated or fails, the confirmation remains saved. An uncertain
confirmation never starts the follow-up; exact retry never authorizes a second call.

The forward migration
supabase/migrations/20261106030000_explorer_failed_reply_reason.sql adds the
final nullable p_failure_reason argument to settle v4 and records only closed
reason codes in the existing invocation error_summary. Its existing CHECK is
narrowly extended for closed v3 completed/canceled reasons without a saved reply;
legacy failed-summary rules remain. No column or RLS policy is added or changed.
TypeScript and SQL validate the codes; a supplied code is bound into
terminal replay identity, while null preserves historical fingerprints.
A confirmed failed reply with freshly checked readiness, authority and capacity
can keep Send available and show the named draft retry sentence. Actual
unavailability, uncertain settlement and critical assistance retain their gates.
Prepare already saves the Explorer's message before the provider call; a failed
reply retains that saved line and the typed composer, before and after this change.

ExplorerConversationTour and explorerConversationTour own the fixed local tour.
Tapping "Show me around" opens it without a Send, request or AI call. It explains
the conversation, Compass formation/confirmation and Waypoint formation/
confirmation one step at a time, with topic buttons, Next, Finish, Close and
"Let's begin". Modal keyboard focus enters the step and returns to the opener;
a live region announces steps. Every tour sentence and the retry sentence is
named draft copy for Paul's wording read. No tour-taken state exists in this
clone; no database state or daily-offer scheduler is added in this round.

Existing safety, consent, authority, active/history capacity, partial Waypoint
projection, compass-v7 context, reply-choice verification, Send counting,
cancellation and 30/10/60-second context/RPC/provider budgets remain.
The application and forward migrations require coordinated integration.
Only clone-local TypeScript, ESLint and focused Vitest checks are builder work.
SQL/pgTAP and browser tests are authored but their execution, independent
Executor review, canonical sibling-document updates, integration and publication
remain Executor work. The builder reads only this clone and the three named
REV306 package documents, and performs no Git write or provider/database action.

## Lane 7: active Waypoint capacity and private history - 2026-11-06

Twenty active Waypoints are allowed per durable Explorer account across all
conversations and relationships. The canonical protected SQL count includes
chosen current heads that are neither Reached nor Released (a private post-End
closure counts as Reached or Released). Drafts, Guide suggestions and
predecessor versions do not count. Existing accounts above twenty retain all
work; only increases are blocked. Revision is net zero; revisit requires a free
active place.

The separate engineering guard is 200 saved Waypoint records per source
conversation, counting originals and revisions. Every insertion requires
history room; reading, Reached, Release and End remain available at the guard.
The protected SQL policy owns both numbers. Required waypointCapacity
{activeCount, activeLimit, historyRoom} comes from the authenticated v3 read,
which supplies it even without a current conversation; the base state builder
returns null capacity when there is no owner. A missing, null or malformed
capacity fails closed.

The conversation projection is explicitly partial: at most 20 authoritative
current heads, with identity, creation time, provenance and projection metadata.
Separate owner-private head and history RPCs return at most 20 records per
page. Currentness and account capacity must never be inferred from absence in
a partial array. SQL retains and validates the complete lineage.

Interim display gap: earlier versions of revised or revisited Waypoints are
no longer visible on the connected card, compact list or ended review. The
owner-private history RPC preserves read access; the Your Waypoints section
(above) is now its route and screen, and further current heads outside the
bounded projection are listed there too. Paul accepted the interim gap for
saving now for the demo (decision queue 2026-11-06 15:13:41 CST, item 2), with
the Your Waypoints section built next. Release now says history stays saved
and private; revised and revisited details point to earlier versions in Your
Waypoints (draft wording for Paul's read). The earlier-version link on the
conversation card stays hidden.
The compact list sorts each group newest first independently of projection
order. The legacy formation tools and ended review follow the same order
(active heads first, then closed heads, newest first within each group);
before this change they showed the oldest first. Paul approved active-first
ordering on every screen in the same decision.

Append-only private post-End closure is a narrow exception to frozen ended
history: an eligible Explorer may close an originally owned current head across
earlier Guide relationships after fresh current eligibility and consent checks.
Reached requires known-clear, adult-allowed policy and explicit evidence;
Release retains its existing policy allowance. Authenticated exact replay,
the account owner lock, one terminal fact and transactional audit are required.
The original conversation, ending revision/time, transcript, Route and source
provenance stay unchanged. No after-End revision, revisit, reactivation or
Guide access is authorized. The private Your Waypoints screen (above) is its route and page.

Ordinary model context is compass-v7 / explorer-compass-context.v7 and includes
at most 20 same-conversation heads: active heads first, then newest closed
heads, with deterministic matching SQL/TypeScript selection and source ids.
Compass-v5 and compass-v6 are refused for new turns; classification_only is unchanged.
The bounded-selection instruction and its five version labels, byte counts
and integrity pins move together. Paul approved that instruction as written
in the decision queue on 2026-11-06 at 15:13:41 CST. Classification-only context
stays unchanged; its shared HTTP instruction text also receives the
bounded-selection sentence. Existing request/provider budgets, cancellation,
one-call rules and Send counting stay unchanged.

The four limit sentences are Paul's approved wording (decision queue
2026-11-06 15:13:41 CST, item 2) and change only with his approval.
src/lib/solmind/explorerWaypointCapacity.ts owns their named constants and
waypointCapacityMessage selects the explanation from the server's
waypointCapacity, never a count of the visible list; activeCount and
activeLimit also come only from those server facts. A false historyRoom chooses
the 200-version explanation first, including when both limits apply. Otherwise,
an active count at or above the limit explains refusals to add, confirm a draft
or revisit.
The active limit never blocks or explains a revision. Missing, null or
malformed capacity fails closed with the existing calm unavailable wording,
never a limit sentence. Forming drafts use the approved "That's right"
variants. Each explanation stays beside its affected control, including a
disabled control, with keyboard access and the existing screen-reader
announcement behavior.

The application change and
supabase/migrations/20261106000000_explorer_waypoint_active_limits.sql
must reach the database together. Earlier migrations remain immutable;
reverting the application alone after longer history or closure facts exist
is unsafe. SQL/pgTAP and browser execution, canonical sibling-document updates,
independent review and integration remain Executor work.

## Reply choices in the Explorer's voice - 2026-11-06 (REV302b)

Paul's decision of 2026-11-06 11:58:16 CST ("Yes, both fixes") authorizes
Explorer-voice choice labels and a server-verified marker for a tapped choice.
Every offered choice is the Explorer's own reply, in their voice, as a
complete answer to the Virtual Guide's question or invitation; it must not
read as a question to the Virtual Guide or as the Virtual Guide's own words.

ExplorerConversation.tsx adds replyChoice: true only to the ordinary Send
started by onReplyChoice. The closed optional command field is replyChoice?:
true; other values are invalid, and typed Sends omit it. It is only a browser
claim. The server independently requires the latest saved message in this
conversation to be a Virtual Guide reply and the immediate message to equal
exactly one of that reply's choice labels, with exact bytes and no trimming,
normalization or case folding. Older replies, duplicate matching labels and
nonmatching messages do not qualify. A failed verification drops the marker
to false; it does not turn the claim into authority or cancel an ordinary Send.

Ordinary context is now wi007-v0.1+onboarding-fields-v2+compass-v7 with
explorer-compass-context.v7. Its required boolean
compassContext.immediateMessageIsReplyChoice is last in that section and is
true only for the verified selection. The Virtual Guide is told to respond
to that selected option instead of treating its words as a question to it.
TypeScript and SQL independently derive the same value and serialized section;
the inspector checks the same current facts. Compass-v5 and compass-v6 are refused for new
ordinary turns. Classification-only context stays on the section-free base
revision and receives no choice marker or additional source material.

The reply-choice forward migration follows the Waypoint-limits migration:

supabase/migrations/20261106010000_explorer_reply_choice_voice.sql.
It changes no table schema or Row Level Security policy. Prepare adds final
p_reply_choice boolean default false as argument 38; the inspector and audited
inspection entry add it as argument 8. The raw flag is bound into the request
fingerprint while the absent/false path preserves its existing fingerprint
and exact-replay behavior. Exact replay never authorizes a second provider call.
Both forward migrations and the application must reach a database together.
Waypoint-limits capacity gates, partial head projection, context selection,
owner locks and function settings are preserved.

All five prompt/role/instruction labels end in -20261106-cv-r2. The role and
reply-format instructions each add one Explorer-voice sentence, and the
ordinary reply-format context description adds one marker sentence. Byte
counts and SHA-256 pins move with the text. Paul must read the exact new
sentences before integration into the app or demo.

A choice remains one counted Send with the existing safety classification,
authority, restriction, adults-only, pending-turn, capacity and uncertain-retry
gates. Context/RPC/provider budgets remain 30/10/60 seconds; cancellation,
counting and the one-call rule are unchanged. This is isolated source work:
SQL/pgTAP and browser execution, independent review, integration and publication
remain Executor work. This builder may read only the clone and the named
REV302b package files outside it; sibling product documentation is untouched.

## Early-test notice - 2026-11-06

Paul approved Option A and the corrected notice on 2026-11-06 at 09:07:10 CST
(REV304). Only individually approved close relations using demo accounts and
invented situations may try the early test. This notice waives no pilot,
consent, privacy, crisis-response, provider, time-limit or counting check.
Real information still waits for the pilot checks.

src/lib/solmind/explorerEarlyTestNotice.ts owns the exact approved ASCII
notice and version early-test-notice-2026-11-06. Wording/version changes need
Paul's approval. Paul approved the Not now copy and the corrected unavailable
copy on 2026-11-06 at 15:13:41 CST (REV304b); the notice itself is unchanged.

REV304c adds the server-only capability SOLMIND_EARLY_TEST_NOTICE=enabled.
auth/explorerEarlyTestNoticeAccess.ts owns its named constant
EXPLORER_EARLY_TEST_NOTICE_CAPABILITY_ENV and isExplorerEarlyTestNoticeEnabled().
Only that exact value enables it; absent or any other value is off. The
variable never reaches the browser. With the capability off, the Explorer
layout returns its children unchanged, feature notice checks pass through,
status reports that the notice does not apply, and agreement is refused
without recording anything. No notice setting, agreement or repository is
read, no notice client boundary mounts, and no notice browser request or
feature-refusal recheck runs. Existing feature authority checks stay intact.
Operator rule: start a demo or UAT server with the capability enabled only
when Paul turns the notice on for a named person. The variable must be in the
server process environment when the server starts, after the migration is
applied; a running server ignores the setting until it is restarted with the
variable. The demo starts only through its relaunch script, which must pass
the variable through; .env.local is never edited for this.

With the capability enabled, src/app/explorer/layout.tsx reads the protected
database setting on the server. A valid off setting renders its children
unchanged, without a notice client boundary or browser status requests on
mount, pathname changes, feature refusals or back-forward restore. On mounts
ExplorerEarlyTestNotice.tsx, which hides the app's screens until a no-store
status read permits them. Only this server-enabled boundary rechecks after
pathname changes or feature refusals through explorerEarlyTestNoticeRecheck.ts,
and reloads a restored browser page. Unreadable settings show the unavailable
view. No browser storage is used. The notice heading receives focus; Not now
makes no request, hides the app, and offers the existing logout request and
outcome owner.
Operator note: with the capability enabled, each gated page request,
including an anonymous request, makes one service-role setting read whose
10-second limit can delay that page.

The data-free /explorer/conversation-preview and /explorer/compass-comparison
review pages live at src/app/explorer/conversation-preview/page.tsx and
src/app/explorer/compass-comparison/page.tsx, inside the Explorer layout like
every other Explorer page. With the capability enabled, that layout applies
the notice gate; with it off, they behave as before with no notice I/O. The
review components need no database, account data or AI and remain unchanged.
The notice boundary hides screens; it does
not prevent Server Component payload construction. Explorer pages must never
read account data on the server while the notice can apply. The existing home
authentication guard may return only its expiry/observation times.

With the capability enabled, auth/explorerEarlyTestNoticeAccess.ts reuses the
existing Explorer home actor check. The status and same-origin JSON agreement
handlers accept no actor/session identity; unauthenticated status calls return
signed out before reading the setting. Every Explorer feature route
independently checks the notice on the server before repository reads or
commands, through the conversation request dependency or the required Explorer
check in Suggested Waypoint composition. Both paths recheck session expiry
after notice access. Guide/Admin request branches remain unchanged. Notice
agreement never grants feature authority or replaces fresh existing route
checks.

When the capability is enabled, the protected database setting is still off
by default; on requires agreement for the current account/version.
Unreadable/malformed settings or an unsupported version fail closed even when
the database setting's enabled field is false. Operator rule: changing the
version while that setting is off still requires a readable, supported
setting; a syntactically valid but unsupported version makes the Explorer
area unavailable. A page loaded while the setting is off has no notice
recheck. Turning that setting on takes effect on the next full page load;
until then feature routes enforce it and the screens show their existing
"not available" messages. Client-side navigation can retain the shared layout
and does not replace that full page load.

The single forward migration is
supabase/migrations/20261106040000_explorer_early_test_notice.sql.
The protected typed singleton core.explorer_early_test_notice_setting follows
the application-setting pattern without changing integer-setting allowlists.
identity.explorer_early_test_notice_agreement is append-only, unique by
account/version, and stores database agreement time and true adult affirmation.
Only deletion of its account may remove an agreement, through the account
foreign-key cascade. Existing audit and other account foreign keys may still
prevent account deletion; this adds no purge workflow or authority to erase
retained audit evidence. Closed service-role RPCs bind the exact current Explorer
account and session as the existing Explorer helpers do; the notice helper adds
no account-wide active-session count. Existing session uniqueness and
authentication ambiguity checks remain unchanged. Recording is idempotent, with
one value-free audit event per new agreement. The new audit update/delete protection covers
only notice event rows and adds no shared audit-table truncate block.
No Guide, Admin or direct client agreement-table access is added.
Operator note: a DELETE-based reset of audit.audit_event fails once notice
rows exist, while TRUNCATE still drops those rows.

Focused unit tests cover wording, gate cases, real route refusals without
repository access, required request boundaries and repository arguments.
Existing browser suites retain their assertions and run with the capability
off without notice fixtures or a readable notice database setting. The off
browser case checks that no status request occurs. Dedicated notice-on cases
are skipped by default; the Executor starts the test server with
SOLMIND_EARLY_TEST_NOTICE=enabled, supplies the migrated database and service-role
configuration with the protected setting on, and selects
SOLMIND_BROWSER_NOTICE_SETTING=on in the test runner. That runner flag only
selects tests; it grants no application capability or setting authority.
New pgTAP and browser coverage is authored; their execution is Executor work.
This isolated builder cannot read sibling solmind-docs under the package
limits; canonical documentation review/updates, SQL/browser runs, independent
review, integration and publication remain Executor work.


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

## Build notes and the release-candidate check - 2026-11-03

Paul's rule (decision queue 2026-11-03 17:59:20, 18:00:59, 18:03:39, 18:30:50,
18:32:04 and 18:33:15 CST, and his go-ahead of 20:50:45; the section "Pages
under development: build notes" in
`solmind-docs/ai-assistant/02_SolMind_AI_Assistant_Implementation_Repository_Workflow_v1_0.md`).
Build notes are for the people reviewing the work, never messages to users,
and are for live screens under development, not generally for mockups. On the
signed-in screens (the connected `/explorer/conversation` screen and every page
in `WorkspaceFrame.tsx`: the Explorer Overview, conversations and Waypoints
inbox and detail, the Guide Dashboard and Waypoint Suggestions pages, and the
Admin pages), `src/components/solmind/ExplorerConversationScreenBuildNotes.tsx`
owns them:

- a control not built yet keeps its small "Not connected yet" label, in the
  reserved build-note blue `#4A86FF` (it was grey before; Paul: "Yes, blue too");
- a note for an area not built yet (the "Ways to begin" and earlier-Compass
  sentences, the latest-change line, Key Insights) is a blue dashed box,
  starting with the words "Not connected yet", with an X in its upper corner
  that hides that box;
- a part planned for removal gets a dashed violet `#D27BFF` outline and a small
  violet "Planned for removal" tag that shows one sentence on tap saying why;
  the part keeps working (today only the old form tools below the
  conversation, `ExplorerConversationFormation.tsx`, under Paul's chat-step
  decision 8);
- one "Build notes" toggle (`aria-pressed`) first in the top bar's right-hand
  group, on every page that has notes or markers (every signed-in page: the
  bell and the profile chip carry labels), hides every blue label, blue box and
  violet marker; the controls and tools stay, and a control's tap-to-explain
  sentence still opens. An X hides only its box, which stays hidden while the
  toggle is off; turning the toggle on shows every box again, including those
  closed with their X. Nothing is saved (no browser storage, no URL state); a
  reload shows them all, with the toggle on. Closing a box moves focus to the
  control before it in the same page or drawer.

The blue and violet are used nowhere else in the app; the blue is not the sky
blue `#8BC6EE` of the "You" speaker label, the current tools' cyan, or the
private Waypoint panels' indigo. Every build note, label, box, removal marker
and the toggle carries the fixed attribute `data-build-note` or
`data-removal-marker`. The review version `/explorer/conversation-preview` and
the fixture and prototype routes are mockups and stay unchanged.

Release-candidate check: `node scripts/checkReleaseCandidate.mjs` (core scan in
`scripts/releaseCandidateScan.mjs`, tested by
`scripts/__tests__/releaseCandidateScan.test.ts`; not a `package.json` script,
which would need Paul's approval under rule 7) fails, naming each place, while
either attribute is present in the app source under `src/` (only tests left
out; the mockup routes and files ship with every build, so they are scanned
too, amended 2026-11-03 after review REV224) or in the built pages of every
route (`.next/server` and `.next/static` after `next build`), and also when
there is no build or the build is older than the source. A Test version that
is a candidate for UAT or production must pass this check, and is not promoted
until it does (Paul's rule, decision queue 2026-11-03 18:32:04 and 18:33:15
CST). While the notes exist, as on 2026-11-03, it fails. The app has no
runtime Test-only switch (2026-11-03): following Paul's 18:33:15 CST
refinement of 18:32:04, a release candidate has no notes at all, and this
check is the guard.

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

The `/explorer` route held the deterministic in-memory S01 prototype (the
June onboarding and sharing mockup) until 2026-11-04, when it was removed
(Paul's decision, decision queue 2026-11-04 21:44:03 CST). `src/app/explorer/page.tsx` stays a
thin Server Component that only redirects to the Explorer Overview
(`EXPLORER_HOME_ROUTE`, `/explorer/home`), which keeps its own sign-in check;
`ExplorerExperiencePrototype.tsx` is deleted. Its two remaining helpers,
`src/components/solmind/SessionCompass.tsx` and
`src/lib/solmind/explorerExperience.ts` (with its test), were removed on
2026-11-05 (Paul's decision, decision queue 2026-11-05 11:07:58 CST, item 4).
The S01 file below remains:

- `src/lib/solmind/onboarding.ts` owns the exact structured-form definitions
  and distinct required-form/optional-First-Compass states.

These S01 rules still bind the retained review surfaces that inherit them
(below). S01 must not call an AI provider or imply a model or human Guide is live. It
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
conversation remains `PRJ01_R-WS09-WI021-S03`. The shared
`src/lib/solmind/explorerSpeakerStyle.ts` owns the speaker-label style used by
both this route and the interim screen (Paul's 2026-10-29 speaker-label trial,
revised 2026-10-30), and `src/components/solmind/ExplorerSpeakerIcon.tsx` draws
its two small icons; `SPEAKER_LABEL_STYLE = "original"` restores the earlier
labels.

The interim `/explorer/conversation-preview` route is a non-functional design
review of the full Explorer conversation screen: the S01R2 look, the
September 23 Explorer menu (option A, below), and wireframe v6 behaviour shown
only as placeholders. Keep its
route thin. `ExplorerConversationScreenPreview.tsx` is its only client boundary
and owns layout state only; the other `ExplorerConversationScreen*.tsx` parts
take no connected data. `explorerConversationScreen.ts` owns the "Not yet
implemented:" sentences and `explorerConversationScreenSample.ts` the sample
content tagged "Sample". Only `ExplorerConversationScreenPreview.tsx` imports
the sample; the parts take read-only display props typed in
`explorerConversationScreenDisplay.ts`. From existing code the route imports
only `SOLMIND_LOGO_SRC` and `SOLMIND_TERMS`, plus the shared
`explorerSpeakerStyle.ts` and `ExplorerSpeakerIcon.tsx` and the shared menu
labels leaf `workspaceNavigation.ts` (option A, below), and it has no
source-isolation profile. It inherits
every S01R2 no-provider, no-persistence, no-auth, no-browser-storage,
no-URL-state, no-timer, no-notification, and no-real-user boundary. Unwired
controls stay focusable with `aria-disabled` and a visible note linked by
`aria-describedby`; only controls marked "Layout only: works in this preview"
act. The placeholder sentences are unapproved AI drafts.
The S01R2 files change only in speaker labels and icons, which
`SPEAKER_LABEL_STYLE` reverts. Removing this route later is a deletion that
needs a named go-ahead.

Rebuild step 2 (Paul's 2026-10-29 20:24 rebuild approval with the interim
review first, and his 2026-10-31 01:01-01:03 go-ahead after that review) puts
the same designed layout on the connected `/explorer/conversation` screen.
`ExplorerConversation.tsx` keeps every fetch, decoding, authority-loss,
pending-turn, uncertain-retry, Send and End rule unchanged (one dated
exception: since 2026-11-03, chat step slice S2 fix round 2, a confirmed
command other than Send keeps the Virtual Guide state the screen last had
instead of the result's "unavailable", because that result never checks the
Virtual Guide and the server checks readiness again on every Send; and since
fix round 3, the same day, a Send refused as unavailable records "unavailable"
as that kept state, because the refusal is the server's latest word and a
later command must not enable Send again; and since the chat card redesign,
the same day, the decoding it uses, the closed state parser in
`explorerConversationContract.ts`, reads current attention on a point without
a position in an arranged Compass, because the server saves such a needle
since migration 20261103180000) and passes
read-only view props and callbacks to the presentation-only
`ExplorerConversationConnectedScreen.tsx`, which owns layout state only (panel,
drawer, since 2026-11-03 the Compass card's Full or Compact view in the panel
and in the drawer, the narrow-screen Menu and which "Not connected yet"
sentence is shown, and since 2026-11-03 which build notes show, through
`useBuildNotesState`). `explorerConversationConnectedScreen.ts`
owns its fixed wording and shell data and imports no sample. The screen
receives no Explorer or Guide name, so its Guide notes say "your Guide"
(`UNNAMED_GUIDE`). The shared shell, navigation and support panel take a
`connected` flag that drops the preview band and the "Sample" and "Layout only"
tags. The real screen shows the approved live sentences, not the unapproved
AI-companion draft. Parts not connected yet are marked "Not connected yet"
(option A, below), since 2026-11-03 as blue build notes (Build notes and the
release-candidate check, above); only the review version keeps their "Not yet
implemented:" notes. The existing `ExplorerConversationFormation.tsx` tools stay mounted below
the conversation, labelled as the current tools, until rebuild steps 4 and 5
form the Compass and Waypoints from the conversation; since 2026-11-03 they
carry the violet "Planned for removal" marker, whose sentence
(`CURRENT_TOOLS_REMOVAL_REASON`) reads "These tools will be removed once the
Compass & Waypoint card does everything they do.", and keep working. The ended
conversation review (`ExplorerConversationReview.tsx`) shows the same tools
read-only and is not marked.

Explorer menu option A (Paul's decisions, decision queue 2026-11-02 14:07:48
and 22:19:17 CST) puts the September 23 Explorer menu he accepted back on both
conversation screens, replacing the Jade rail list, the narrow icon strip and
its "Show/Hide conversation spaces" toggle. The rail (64rem and wider) and the
phone panel draw the same list with the September 23 classes: a "Workspace"
heading; Overview, Conversations, Waypoints and Settings; and under
Conversations "With your Virtual Guide", "With your Guide" and "Start a new
conversation". Below 64rem a labelled "Menu" button, first in the top bar,
opens the list in the page flow under the top bar; Escape inside it closes it
and returns focus to the button. Its open state is layout state owned by
`ExplorerConversationScreenPreview.tsx` and
`ExplorerConversationConnectedScreen.tsx`. No "This is your space" card,
Prototype or Reset control returns, and no route is created or renamed.
`src/lib/solmind/workspaceNavigation.ts` is the shared labels leaf: the
navigation names, list heading and conversation-spaces list name, the
"Not connected yet" label (grey until 2026-11-03, now drawn in the build-note
blue), the helper that drops the review prefix, and the
entry types. It imports only
`explorerConversationScreen.ts` and is the only menu file the
conversation-screen parts import (test SP07 scans it). The signed-in menu data
is frozen, ASCII presentation data in `src/lib/solmind/workspaceMenus.ts`: the
working destinations (Overview `EXPLORER_HOME_ROUTE` from `routeAccess.ts`,
Conversations `/explorer/conversations`, With your Virtual Guide
`/explorer/conversation`, Waypoints `/explorer/waypoints`) and, for Settings,
With your Guide and Start a new conversation, the sentence that says what each
will do. Only the signed-in lib files import it:
`explorerConversationConnectedScreen.ts`, which maps it with the conversation
screen's current section and page, (workspace frame, below)
`explorerWorkspaceFrame.ts` and `explorerOverviewHome.ts`, and (Connected
Guide boundary, below) `guideWorkspaceFrame.ts` and `guideDashboardHome.ts`.
So the review route never reaches `routeAccess.ts`; the review sample keeps
its own menu data.
On the signed-in `/explorer/conversation` screen built menu entries are plain
full-document links. The entry for the page the Explorer is on ("With your
Virtual Guide") stays a link with `aria-current="page"`, but a plain click on
it does not reload the page, which would lose a typed message: it closes the
phone menu and moves focus to the conversation heading; a click with a
modifier key or another mouse button behaves as a normal link. Every control
that is not built yet (menu entries, the bell, the profile button, the Guide
banner button, and the header, composer and end controls) is a button with
`aria-expanded` and `aria-controls`, shows the September 23 "Not connected
yet" line (grey until 2026-11-03; since then the same words in the build-note
blue, Paul's decision, decision queue 2026-11-03 18:00:59 CST) and, when
activated, shows one sentence directly under
it, hidden again on the next activation; the bell's and the profile's
sentences show in the row under the top bar. As on September 23, the profile
chip's name is its visible role and label with "profile" for screen
readers ("Explorer profile Not connected yet"). The bell shows its label
beside its icon, with "Notifications" for screen readers ("Notifications Not
connected yet"). With the build notes off the label goes and the name is the
role or "Notifications" alone. Paul chose this knowingly as an exception to the
rule that a control without a destination is a defect.
`ExplorerConversationScreenNotYetImplemented.tsx` implements it once through
`NotConnectedProvider`, which the connected screen places. Notes that describe
an area rather than a control (the key insight sentence, the "Ways to begin"
and earlier-Compass sentences and the latest-change line) are shown, until
2026-11-03 each in an area marked with the grey label, and since then (Paul's
decision, decision queue 2026-11-03 17:59:20 CST) each in its own blue
build-note box with an X, placed in the area (under the Key Insight heading,
inside "Ways to begin", under the composer). Since
chat step slices S1 and S2 (2026-11-03) the connected Compass & Waypoint card
(`ExplorerConnectedCompassCard.tsx`, `ExplorerConnectedWaypointCard.tsx`;
mapping and wording in `src/lib/solmind/explorerConnectedCard.ts`) replaces the
Compass and Waypoint card sentences. Dated exception, 2026-11-03 (Paul's
decision, decision queue 18:05:33 CST, the chat card redesign, "there is too
much text explaining things"): the Compass card shows neither the forming point
nor the needle sentence and has no "Not connected yet" area, although forming
points and the needle following the conversation are not built yet; this rule
still holds for every other area, and the Waypoint card and the Key Insight
area are unchanged.
Amendment 2026-11-04 (S5): the card now shows forming points and automatic needle moves are implemented; the Compass card still has no explanatory build-note area.
The same redesign lets the needle point at any current
point, placed or not (migration
`supabase/migrations/20261103180000_explorer_attention_any_point.sql`, with
the browser rule in `explorerConversationFormation.ts` and the closed state
parser in `explorerConversationContract.ts` matching it); the Full view shows
the points without a position in a bottom row, and a needle on one of them is
drawn dashed, which is the Compass design, not a review mark. The top bar breadcrumb is
plain text and the separate top-bar "Explorer home" link is gone (Overview is
the way home). The "Return to Explorer home" link is shown when no saved
conversation has been started; an ended conversation links to "Review ended
conversations", and confirming End goes home by itself. No review-version
"Not yet implemented:" note, Sample tag or `data-preview-*` attribute appears
on a signed-in screen; since 2026-11-03 the only blue notes, dashed review marks and
violet marks there are the build notes and removal markers, each carrying
`data-build-note` or `data-removal-marker` (amended 2026-11-03 for Paul's
build-note rule; until then no blue note or dashed review mark appeared).
All these sentences, for the controls and for the marked areas alike,
are the review drafts from `explorerConversationScreen.ts` without their
prefix, which Paul agreed to reuse pending his review of the wording; he may
reword any of them. The review version `/explorer/conversation-preview` keeps
its blue "Not yet implemented:" notes, Sample tags, preview band and unwired
`aria-disabled` controls; only its menu changed, and its Menu button is a
layout-only control.

Explorer workspace frame and Overview (Paul's decisions, decision queue
2026-11-02 14:07:48 and 22:19:17 CST) put the same dark and amber page and the
same menu on the other signed-in Explorer pages; no route is created or
renamed. `src/components/solmind/WorkspaceFrame.tsx` is the role-neutral,
presentation-only frame: the ambient glow, the wide-screen rail, the top bar
(the Menu button first on phones, the small phone logo, a plain-text breadcrumb
"<root> / <current entry>" on wide screens, and the bell and profile that
explain themselves), the phone menu panel and one `<main>`, reusing the
conversation screen's exported parts (`Rail`, `UtilityBar`, `AmbientGlow`,
`MenuPanel`). It owns layout state only (whether the phone menu is open,
which "Not connected yet" sentence shows and, since 2026-11-03, whether the
build notes show) and places `NotConnectedProvider` and `BuildNotesProvider`;
its top bar always has the "Build notes" toggle, because the bell and the
profile chip carry blue labels on every page in it.
It takes the menu entries, names, breadcrumb root and profile role as data
(`WorkspaceFrameData` in `explorerConversationScreenDisplay.ts`; menu icons by
entry id in `MENU_ICONS`), so the Guide menu reuses it (Connected Guide
boundary, below).
`ExplorerWorkspaceFrame.tsx` is the thin Explorer client wrapper: it picks the
frozen data in `src/lib/solmind/explorerWorkspaceFrame.ts` by page name, so a
server page passes only a string. Overview is current on `/explorer/home`,
Conversations on `/explorer/conversations` (the conversation spaces show under
it, none current), and Waypoints on `/explorer/waypoints` and
`/explorer/waypoints/[id]` (as the section there). The entry for the page
itself carries `aria-current="page"`, and a plain click on it focuses the page
heading (or `<main>`) instead of reloading. The conversation screens keep their
own shell; the shared list, rail and top bar take these names as props with
defaults that leave both conversation screens' markup unchanged.
Overview: `ExplorerHome.tsx` keeps every binding, timer, page-event, sign-out
and outcome rule and passes only the pending and warning flags and the sign-out
action to the presentation-only `ExplorerOverviewHome.tsx`, which draws the
Option A home mockup's header and two cards without names or counts ("Mockup
cards, no names"); the wording is in `src/lib/solmind/explorerOverviewHome.ts`.
"Talk with your Virtual Guide" links `/explorer/conversation` and "Open
suggestions" `/explorer/waypoints`; "Learn what your Virtual Guide can see" is
not connected yet and explains itself with its review sentence. Below the
cards come the session warning and Sign out; the earlier "Your Explorer
workspace" list is gone, and so, since 2026-11-04, is the collapsed "Design
previews" list (Paul's decision, decision queue 2026-11-04 21:44:03 CST); its two older design
reviews, `/explorer/compass-comparison` and `/explorer/conversation-preview`,
stay reachable by address. While a sign-out is pending every link on the page
(menu and cards) shows as a non-link `<span aria-disabled="true">`.
`ExplorerSessionOutcome` takes the dark look only, with no menu, and keeps its
text and re-entry link. The conversation list (`ExplorerConversationReview.tsx`)
and the Waypoint inbox and detail sit in the frame in the dark and amber look
with every read, command, state, live region, focus rule and text unchanged,
except that on 2026-11-03 the inbox's and detail's fixed sample name "Mary" was replaced by the
canonical unnamed form "SolMind Virtual Guide" with the mini mark
(`SOLMIND_TERMS.virtualGuide`;
`solmind-docs/canonical/06_SolMind_ScreenInventory_Phase0_v1_0.md`), because
these pages receive no chosen name; the
list's own "Explorer home" link is gone (Overview is the way home), and the
inbox's teal sidebar, its "Open menu"/"Close menu" button, its five August
entries and their notice are gone. `SuggestedWaypointStatusPill.tsx` has an
optional dark surface for these pages and the signed-in Guide Waypoint pages;
the fixture review surfaces keep the light pills.
`/explorer/home` cannot be opened in a browser test without a sign-in, so
`ExplorerWorkspaceFrame.test.tsx` and `ExplorerHome.test.tsx` prove the static
markup of its frame and Overview (`tests/browser/explorerAddress.pw.ts` checks
only that `/explorer` opens that address, signed out); interaction and contrast on the signed-in
Overview are checked on the local demo only by Paul.

The first provider-dispatch increment for the server-side Virtual Guide
conversation lane (`PRJ01_R-WS09-WI021-S03`) is the bounded S03B
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

The historical bounded S03D owner is
`public.solmind_prepare_virtual_guide_predispatch(...)` in
`supabase/migrations/20260924000000_virtual_guide_predispatch_evidence.sql`,
hardened by
`supabase/migrations/20260927000000_virtual_guide_predispatch_evidence_hardening.sql`.
Its retained definition is security-definer, empty-search-path, lock-bounded,
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
activation. The private successor below retires its direct service-role write
capability for all three formerly allowed session types. Preserve the definition
and stored evidence; neither owner access nor an old `created` receipt supplies
current dispatch authority.

The bounded S03E owner is
`src/lib/solmind/virtual-guide/openAiLunaVirtualGuideTransport.ts`. Keep the
Responses endpoint, `gpt-5.6-luna`, medium reasoning effort, `store: false`,
fixed Virtual Guide instructions, output cap and no-tools posture explicit.
Accept the credential and HTTP function only through the server composition
root; do not read environment state here. Send only the already-authorized S03B
context bytes as provider input, never separate Explorer/session/snapshot IDs or
metadata. Provider bodies and errors remain value-free at the S03B boundary.
S03E is a dormant prose transport adapter. Its historical S03D `created` premise
does not reopen the retired service capability or authorize the private successor
protocol. The private safety transport below is a separate owner; authenticated
composition, message persistence, safety handling, deployment and runtime
activation retain their own gates.

## Connected Explorer conversation construction - 2026-10-24

This provider-held construction increment does not complete the connected demo.
Current proof and checked publication status are owned by
`solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`. Preserve existing
S01/S01R2 previews, S03A-S03E contracts and login/session/logout owners.
This dated section describes the retained predecessor. Current private request
and browser ownership is specified below; it does not restore old write grants.

`src/app/explorer/conversation/page.tsx` renders a public shell with no private
props. Its private GET `/explorer/conversation/state` and same-origin JSON POST
`/explorer/conversation/commands` perform fresh server authorization; the shell
or a home link supplies no feature authority. Keep handlers thin and no-store.
`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts` preserves
raw duplicate cookies through src/lib/solmind/auth/readRawRequestCookies.ts, tolerating only malformed unrelated pairs, and reuses fixed Explorer request-auth authority;
`src/lib/solmind/supabase/explorerConversationRepository.ts` exposes only the
four closed feature RPC capabilities.

`src/lib/solmind/explorerConversationContract.ts` owns closed browser shapes
(since 2026-11-03 a saved arrangement still requires the Priority at the apex,
while current attention may be on any current point, placed or not, as the
server saves it since migration 20261103180000).
`src/components/solmind/ExplorerConversation.tsx` owns fetch, view lifetime,
bounded results and one operation identity/revision with exact uncertain retry
bytes. Browser IDs are selections, never actor/session/provider authority.
A server `pendingTurn` holds new commands; pending or failed transport must
never appear as a confirmed saved reply. Exact replay never redispatches.

`src/components/solmind/ExplorerConversationFormation.tsx` and
`src/lib/solmind/explorerConversationFormation.ts` keep empty Discovery valid,
take an exact owned saved message and Explorer label, confirm Priority
separately from attention, and require explicit destination/meaning/arrival
confirmation for a private chosen Waypoint. Show unreleased current chosen as In progress; Release keeps history and frees active capacity (lane 7, 2026-11-06), while application-question/Explorer-answer clarification plus full confirmation creates a linked revision/revisit without direct summary editing, model messages, inherited Reached success, sharing or after-End reactivation; local form and clarification draft loss on close/reload is disclosed. S7a conversation-derived Waypoint drafts are saved privately and survive reload.
Reached needs a later explicit evidence review and confirmation. No sharing,
automatic confirmation, clinical score or browser storage is introduced. S5 permits model-suggested forming Compass wording under the dated boundary below.
Amendment 2026-11-05 (S6b): Paul's 2026-11-03 decision that typed replies always count permits model interpretation of a clear answer to the immediately preceding saved Compass suggestion, under the S6b gates below. The residual risk is that the model, rather than an Explorer button press, judges the answer's meaning; ambiguity must lead to a question, never inferred confirmation.
Compass keeps 24 non-rejected stored originals/eight visible current category heads, plus at most 24 privately rejected rows under S5; reviewed confirmed wording/combine retains source links/captured old meaning and both selectors. One-way grouping releases no slot; rejecting a forming point removes it from the non-rejected count. Route/Reached/End/owned review preserve confirmed facts without reactivation.

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
serialize selection revision `wi007-v0.1+onboarding-fields-v2` (these AV2 entries; since
2026-11-03 the private AV3 entries serialize a later revision with the saved Compass and
Waypoint section, Private Explorer conversation construction boundary, below). Prior conversations,
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

## Private Explorer conversation construction boundary

The private successor is provider-held construction. Current technical evidence
and the complete-slice assurance/application state belong to
`solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md` and
`solmind-docs/execution/17_SolMind_MVP0_Slice_Ledger_v0_1.md`. Source presence,
synthetic fixtures and passing structural checks do not establish genuine model
behavior, operational configuration, resource suitability, clinical quality or
actual human approval. Preserve every unrelated role-login and prototype boundary.

Keep these owners direct-import, server-only and off shared/client barrels:

- `src/lib/solmind/virtual-guide/explorerPrivateConfigurationCandidate.ts` owns
  inert literal candidate data; `src/lib/solmind/virtual-guide/explorerPrivateConfiguration.ts`
  validates and returns a copied frozen projection. Neither its parser nor getter
  supplies operational readiness, an approved methodology pack or verified resources.
- `src/lib/solmind/virtual-guide/explorerSafetyReplyContract.ts` owns the closed
  `explorer-safety-request.v2` request and `explorer-safety-reply.v2` result.
  `src/lib/solmind/virtual-guide/explorerSafetyReplyInvocation.ts` admits one
  bounded injected invocation and retains valid classification independently of
  unusable candidate prose or canceled delivery. Missing observation is not zero.
- `src/lib/solmind/virtual-guide/openAiLunaExplorerSafetyTransport.ts` owns only
  the OpenAI Responses HTTP adapter with injected credential/model/HTTP capabilities; `src/lib/solmind/virtual-guide/openAiModelConfiguration.ts` validates the supplied server `SOLMIND_OPENAI_MODEL` setting (undefined alone defaults to Luna), while the pinned provider grant independently controls use.
  It reads no environment and is not supplied by the default request factory.
- `src/lib/solmind/virtual-guide/explorerConversationSafety.ts` owns pure pinned
  fallback, combination and trusted-response selection. It imports candidate
  types only; no arbitrary configured regex, contact rendering or activation.
- `src/lib/solmind/virtual-guide/explorerPrivateConversationComposition.ts` owns
  the private controller with explicitly injected readiness, governed
  context, provider, reviewed renderer and bounded operational-signal capabilities.
  Its server-only transient assistance is never a fabricated saved message or
  human-notification claim. A no-op signal or inert resource candidate cannot
  satisfy an operational prerequisite.
- `src/lib/solmind/supabase/explorerPrivateConversationRepository.ts` accepts an
  injected server client and exposes fourteen exact lifecycle methods (amendment
  2026-11-05, S6a; the original six are listed below), with closed scalar
  arguments/results and no generic table reader or public RPC executor:
  `public.solmind_read_explorer_conversation_v3`,
  `public.solmind_ensure_explorer_conversation_v3`,
  `public.solmind_observe_explorer_conversation_fallback_v3`,
  `public.solmind_prepare_explorer_conversation_turn_v3`,
  `public.solmind_settle_explorer_conversation_turn_v4` and
  `public.solmind_mutate_explorer_conversation_v3`.

The existing `src/lib/solmind/virtual-guide/explorerConversationContext.ts`
provides explicit `createPrivateExplorerConversationContextBuilder` and
`createPrivateGovernedExplorerConversationContextBuilder` entries for AV3 only.
Keep the older AV2 entries strict and unchanged. AV3 binds current owned/support
authority plus known/unknown policy, safety version, restricted floor and adult
stop; pre-anchor absence is not a clear classification. Keep `authority_context`
shape and server-only `policy_state` separate. The ordinary compact model input of the AV3
entries is `wi007-v0.1+onboarding-fields-v2+compass-v1` (amended 2026-11-03, chat step
slice S3, Paul's decision 4 of decision queue entry 2026-11-03 12:38:07 CST and his
go-ahead at 20:50:45 CST; it was `wi007-v0.1+onboarding-fields-v2`, which the AV2
entries keep): the same layers plus one section, `compassContext`, after
`approvedContinuity`, owned by `src/lib/solmind/context/explorerSafeContext.ts` (shape,
limits, and the rule that this revision requires the section and every other revision
forbids it) and filled from the read state by `explorerConversationContext.ts`:
Amendment 2026-11-04 (S5): the ordinary AV3 revision is now `wi007-v0.1+onboarding-fields-v2+compass-v2`, requiring `compassContext`; the section-free base revision remains for classification_only and AV2.
`{version:"explorer-compass-context.v1", points:[{id,label,order,formation:"saved",anchor,emphasis}],
priorityId, attentionId, recentRoute:[{kind,pointId,label,actor?,awaitingReply?}],
waypoints:[{id,title,destination,meaning,arrivalSignal,stage,reachedEvidence}], drafts:[]}`.
Amendment 2026-11-04 (S5): the section version is now `explorer-compass-context.v2`, and each point's formation is `saved` or `forming`.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.
Points are the current (not combined-away) points in saved display order; Priority and
attention are the saved values, and attention may be on an unplaced point; the Route gives
only the last five needle moves (`attention_changed`) on a current point, counted after
leaving out combined-away points, oldest first, each with that point's current label,
never the label the Route captured, which may be wording from before a rename (amended
2026-11-03, S3 fix round 2: Paul's go-ahead names "recent needle moves", so Priority
changes are not sent; arrangement and category events and their before-labels never enter
model context); Waypoints are
the current heads (no successor), staged formed, reached or released, with Reached
evidence only when reached, and the title is the saved title (every writer stores the
destination there; the state carries no title). `formation` stays "saved" and `drafts`
stays empty until later slices.
Amendment 2026-11-04 (S5): formation may now be `saved` or `forming`; `drafts` remains empty, and rejected points are omitted.
The current point and Waypoint ids join the snapshot
source ids. `explorerSafeGuardrail` stays null. Output protocol/mode/configuration bindings
are recorded separately on evidence; S4 (2026-11-04) changes new output to
`explorer-safety-reply.v2`, while existing v1 evidence remains valid. The transport
instructions name the section and treat its text as untrusted data. S4 narrowly amends
the approved global policy and role text; crisis text stays unchanged. See the S4
boundary below. Use actual governed methodology resolution
and immutable bindings, never a fabricated UUID, reviewer or candidate-ready flag.

`supabase/migrations/20261025010000_explorer_source_exclusion.sql` owns ungranted
source-inspection/audit helpers (its inspector is replaced in place, same signature,
by `supabase/migrations/20261103210000_explorer_context_compass.sql`, which also lets
`methodology.serialized_methodology_valid` accept exactly two key sets, each tied to its
version: the earlier twelve layers with `wi007-v0.1+onboarding-fields-v2`, or those plus
`compassContext` with the new revision).
Amendment 2026-11-04 (S5): `methodology.serialized_methodology_valid` now accepts only the base revision without `compassContext` or compass-v2 with it; compass-v1 is refused, and exact replay returns before this check.
Amendment 2026-11-05 (S6b): the current `methodology.serialized_methodology_valid` is in 20261105030000_explorer_typed_suggestion_replies.sql; it accepts only the base revision without `compassContext` or compass-v3 with it, refusing compass-v1 and compass-v2.
For ordinary turns the inspector accepts only the new
revision, rebuilds `compassContext` exactly from the saved rows with the same
normalization as the history, adds the point and Waypoint ids to the exact source set
and allows 3 to 103 source ids, as prepare does.
Amendment 2026-11-04 (S5): the current inspector in `20261105010000_explorer_forming_compass_points.sql` requires compass-v2 / explorer-compass-context.v2 for ordinary turns and the section-free base revision for classification_only.
Amendment 2026-11-05 (S6b): ordinary AV3 now uses compass-v3 / explorer-compass-context.v3 (forming points add suggestedInPreviousReply); the current inspector is in 20261105030000_explorer_typed_suggestion_replies.sql; compass-v2 is refused.
Final v3 preparation rederives the exact allowed
onboarding/history/Compass/immediate source set, checks field-qualified excluded identities
and normalized whole decoded values under finite source locks, and refuses unknown,
busy, malformed or overflowing inspection. Preserve independent section identity
and actual containing-revision provenance. Confirmed exclusion returns after its
content-free audit so the transaction can commit; raising afterward would erase
that evidence. Whole-field checks do not prove semantic origin, fragment/paraphrase
coverage or complete operational protection. Prior private safety rows never enter
the model context. Scheduled snapshot-integrity/Admin paging remains unfinished.

`supabase/migrations/20261028000000_explorer_private_deferred_guard_privilege.sql` runs the existing deferred coherence check as its postgres owner at commit; its body, empty search_path, deferred timing and API-role grants stay unchanged.
`supabase/migrations/20261025020000_explorer_private_safety_lifecycle.sql`
owns the additive private state/evidence and six-port lifecycle. Only a deliberate
first Send with complete operational configuration/current authority may create or
reuse one real visible empty conversation. Signing in, reading or held configuration
creates nothing. New-container creation and its closed audit are atomic and save
no attempted body, ordinary send row or false dispatch evidence. Initialize clear
policy only for an actually new container; existing missing policy stays unknown
without backfill, repair or a replacement-session escape.

`ai.explorer_safety_evidence` stores only the approved minimum actual numerical 1-4
observations and protected provenance. Level 0 creates no safety row; minor-only 0
uses the distinct monotonic adult-reflection stop and state audit. Keep private
evidence, restricted floor and adult stop separate from human-facing safety signals
or responders. Do not copy detector payloads into invocation safety_result, browser
results, logs or audit metadata. Admit accepted positives under lock before reply
selection; technical settlement after login ends may preserve positives but must
not return private state or save outward content without full current authority.
Use one exact terminal intent and one settlement attempt. Unknown acknowledgment
never authorizes another post, contradictory failure settlement or redispatch.

The successor retires direct service-role EXECUTE on these five legacy write
capabilities while preserving their definitions, old records, authorized history
and exact no-dispatch replay:

- `public.solmind_prepare_virtual_guide_predispatch` (all formerly allowed session types);
- `public.solmind_prepare_explorer_conversation_turn`;
- `public.solmind_prepare_governed_explorer_conversation_turn`;
- `public.solmind_complete_explorer_conversation_turn`;
- `public.solmind_mutate_explorer_conversation`.

Do not restore those grants or treat owner-only fixture execution as application
authority. The existing repository rebinds deliberate formation only to the atomic
v3 mutation wrapper and maps only its exact closed denial/conflict errors. New
formation requires known-clear current policy; UNKNOWN remains held. The old
private controller/provider/context-builder is not activated by this binding.
The earlier unchanged-browser/default-factory boundary describes the R12
predecessor. The separately released request/browser candidate below connects
the private controller and closed v3 repository, while operational ports remain
absent by default. Old write callers do not bypass retired capabilities. Candidate
validity supplies neither wiring approval nor operational/resource authority.

Keep `eslint-rules/explorer-source-isolation.mjs` and `eslint.config.mjs` closed to
27 exact source profiles and twelve erased type-only edges, preserving all older
constraints. The private controller's legacy composition fingerprint import is an
explicit runtime edge; the repository's SDK/controller imports remain type-only.
No wildcard, barrel, alternate spelling, dynamic import or unrestricted global
permission follows. Static source isolation is not a sandbox or runtime proof.

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
outcome. Since 2026-11-03 the minimal Admin screens (Connected Admin boundary,
below) also call the lift, on the Admin's Lift pause press, still recorded as
Paul's lift. The migration reaches the Card 3 demo database only after that step
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

### Held private request and browser integration candidate - 2026-10-26

`src/lib/solmind/explorerPrivateConversationResponse.ts` is browser-safe and owns
the strict `explorer-private-conversation-response.v1` envelope with exactly
`version`, `result` and `assistance`. It reuses the existing closed result parser;
assistance is null or a bounded support/adult_policy/temporarily_unavailable/paused
body with `persisted:false` (`paused` is the server-written hard-stop notice). Keep actor, private policy/evidence and configuration
server-side. The private controller imports only the erased assistance type.

`src/lib/solmind/supabase/explorerConversationRequestDependencies.ts` retains
`createExplorerConversationRequestDependencies` for scoped predecessor proof.
Its new `createExplorerPrivateConversationRequestDependencies` reuses the same
shared bounded raw-cookie reader and selects the fourteen-port private repository,
including the exact eight-argument respondCompassSuggestion port, category and
Waypoint confirmation, Release, pause, and separate owned End/review capabilities.
Default dependencies contain authentication and that repository only. Provider,
readiness resolver, governed context builder, reviewed renderer and operational
signal require explicit server injection; no new provider credential/environment
lookup, candidate-ready flag or synthetic operational default is added.

The state/commands route candidates call private read/command composition and
validate the versioned envelope before returning it. GET may report generation
available only through complete injected ports and a valid readiness binding;
it never ensures a container or writes evidence. With default dependencies,
Send stays held. Same-origin, fresh-authentication and no-store boundaries remain.
After awaited readiness resolution, GET authenticates again and rereads current
authority/state before returning any saved private projection.

`src/components/solmind/ExplorerConversation.tsx` validates the envelope again
and renders assistance separately from saved history. A confirmed state carrying
assistance retains the send draft and suppresses the saved-reply confirmation;
authority loss still clears private state. The retained 70-second browser abort
is a local response wait, not a whole-command deadline or remote-work drain proof.

The bounded scope permits preparing this held wiring, not provider activation,
operational acceptance or real-user effects. Initial candidate checks are UNRUN;
the first environment failure occurred before tests. This ownership note claims
no passing validation, formal assurance, application, banking or genuine-AI proof.

### Explicit private-local signal and dormant methodology screening owners

`src/lib/solmind/operations/explorerPrivateOperationalSignal.ts` owns an injected
dedicated local `.jsonl` file sink and external verification-receipt binding.
It appends only version/time/one closed marker. No default destination, path/env
lookup, directory creation, retry, private ID or notification is supplied. The
controller's one-second await/abort-request budget does not prove an in-flight
filesystem append stopped. No destination or operational adoption is configured.

`src/lib/solmind/virtual-guide/openAiLunaMethodologyScreeningTransport.ts` owns
the pure explicit-policy request builder and dormant injected HTTP transport.
It binds subject/policy/manifest/request bytes, omits account/pack UUIDs from model
input and uses the captured configured model, medium effort, store:false, no tools/background/
stream/retry, structured output and 128-KiB request/response limits. Its 60-second
local race includes fetch/body parsing; it proves neither remote stop nor zero
billing/retention. Standard provider abuse-monitoring retention remains a separate
disclosure. No credential lookup, default policy acceptance, human approval or
provider activation follows. Both owners stay direct-import/server-only; their
controller/screening-caller imports are erased types. New-module tests are UNRUN
at authorship; earlier bridge results cover only their prior bytes.

### Private request await-budget ownership

`src/lib/solmind/operations/explorerPrivateRequestBudgets.ts` owns the finite
local await wrappers used only by the new private request factory. Authentication
and each supplied one of the six v3 repository ports have 10-second waits;
operational readiness has 15 seconds and context construction 30 seconds. Context
combines caller cancellation with its owned deadline signal. Provider observation,
reviewed rendering and operational signal retain their existing 60/2/1-second
owners. The retained predecessor factory does not acquire these wrappers.

Default private dependencies still contain only wrapped auth/repository, with
no optional operational ports activated. The wrapper checks immediate native
Promise returns and supplies generic failures, without automatic retry/repost.
Local Promise.race/deadline completion does not prove underlying remote stop,
transaction rollback or work drain; synchronous trusted code is not sandboxed.
The browser's 70-second abort controls delivery interest/uncertainty, not these
server-phase owners or remote settlement. Await ownership is implemented;
finite joined-path timing and actual governance/integrity/activation proof remain
unproven. New fake-timer cases are initially UNRUN. Factory tests must verify
exact authority/argument behavior and held optional absence through the wrappers,
not equality with an unwrapped repository object. Root owns actual result capture.

### Explicit trusted rendering and governed-capability facade

`src/lib/solmind/operations/explorerPrivateReviewedRenderer.ts` owns
`createExplorerPrivateReviewedRenderer`. It binds injected renderer/resource
versions and reconstructs the pinned trusted acknowledgment/limits/resource/
human-connection order, selecting adult or age-appropriate resource text from the
explicit inputs. Adult-only and restricted-follow-up plans keep their distinct
allowed segments. Reject mismatched plan segments, generated candidates and
unsupported persistence/signal claims. Supplied resource/failure strings and
receipt labels are not proof that verification or human review occurred.

`src/lib/solmind/virtual-guide/explorerPrivateGovernedCapabilities.ts` owns
`createExplorerPrivateGovernedCapabilities`. It binds explicit copied candidate,
pack/Guide scope, receipt hashes, model/resource versions and supplied ports into
a deterministic configuration fingerprint. Every readiness call invokes the
injected effective-methodology source and requires the pinned subject digest;
operational injection must supply the genuine governed resolver. The
turn context uses the AV3 governed builder/adapter and its current revalidation.
It fabricates no pack, model result, human decision or effective authority.

Both mechanisms stay direct-import/server-only and dormant until explicit trusted
injection. They add no default configuration/adoption, credential lookup, provider
activation or real-user effect. Actual accepted resources/policy, Admin/Guide
governance, scheduled integrity, joined-path proof and genuine runtime evidence
remain required. New source presence is not passing proof or approval truth.

## PRJ01_V-WS05-WI022 Suggested Waypoint UI Boundaries

`ExplorerSuggestedWaypointWorkspace.tsx` remains deterministic fixture-backed
design evidence for private comparison, response, and acknowledgement flows.
It does not own `/explorer/waypoints`: that route now composes the separately
reviewed authenticated S03 inbox and detail reads. Since 2026-11-02 both are
drawn in the Explorer workspace frame with Waypoints current, in place of the
inbox's teal sidebar; their reads and commands are unchanged.

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
/login/guide and GuideSignIn wiring; connected Admin uses fixed /login/admin
and AdminSignIn wiring. Since 2026-11-02 both draw Paul's approved A3/A3A and
A4 through the shared SignInPreviewView by way of PasswordRoleSignInView, as
Explorer does; their bindings, controllers, transports, routes and homes are
unchanged. Standalone SignInPreview,
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
never logged or put in the URL. These restrictions apply to the preview, not to the separately named connected role owners below.
The connected A3/A3A (`connectedPasswordSignIn`) keep the same layout without
the remembered-browser box, its remembered wording and the preview band; the
Forgot password, phone and help controls show only their not-set-up notes.

The connected Explorer boundary uses `src/components/solmind/ExplorerSignIn.tsx`
and its browser contract/transport/controller for exactly the send and verify
POSTs. A current accepted result alone permits fixed `/explorer/home` navigation;
client navigation or cookie presence never authorizes that page. The server page
uses `src/lib/solmind/auth/explorerHomeAccess.ts` and the current binding-aware
direct-token composition. It preserves duplicate raw cookie names and exact
values before validation; `cookies().getAll()` cannot prove that preservation.
Only expiry and server observation times reach `src/components/solmind/ExplorerHome.tsx`;
its presentation `ExplorerOverviewHome.tsx` receives only the pending and
warning flags and the sign-out action.
No token, account/session ID, password, code or selector enters URLs, logs,
browser storage or home props. GET never refreshes, clears cookies or signs out.

`src/lib/solmind/logoutBrowserRequest.ts` owns the one guarded POST `/logout`;
only confirmed `signed_out` shows S1; closed no_current_sign_in reports local cookie absence, never remote revocation. Unconfirmed/refused/missing answers show
honest SM-OUT-01 uncertainty; never claim administrator notification. Cookie Max-Age alone allows exactly5s positive clock gap, clamped3600; public loopback warning links fixed role without redirect. Guard denial
or apparent expiry shows S2 with fixed `/login/explorer` re-entry. The five-minute
warning is advisory; Stay signed in remains a separate later amendment. Paul
approved the sign-in and session reminder text on 2026-10-17; the exact messages
are recorded in `solmind-docs/execution/25_SolMind_MVP0_Auth_RLS_Login_Session_Cookie_Security_Contract_v0_1.md`,
under Explorer screen copy approved - 2026-10-17.
`/explorer` opens this home (since 2026-11-04); this home grants no Virtual Guide feature authority.
See `docs/MODULE_BOUNDARIES.md` for ownership and source/runtime evidence limits.

## Connected Guide boundary

Guide workspace menu and Dashboard (Paul's decisions, decision queue
2026-11-02 14:07:48 and 22:19:17 CST): the signed-in Guide pages use the
role-neutral `WorkspaceFrame.tsx` (Explorer workspace frame, above) with the
August Guide menu in the dark and amber look: Dashboard (`GUIDE_HOME_ROUTE`,
`/guide/home`, the signed-in Guide home), then Explorers, "Chat with your
Guide Assistant", Appointments and Archive, which are not connected yet and
explain themselves with the "Not connected yet" line (in the build-note blue
since 2026-11-03) and one sentence
each. No route is created or renamed. The Guide menu, its names
("Guide workspace", "Guide workspace menu") and its sentences are frozen data
in `workspaceMenus.ts`; the sentences are new drafts adapted from Paul's
August simulation, for his wording review. "Chat with your Guide Assistant"
stays until assistant naming is built; no sample name such as "Steve" appears
on a signed-in screen, and the SolMind Guide Assistant always reads as AI.
`GuideWorkspaceFrame.tsx` is the thin Guide client wrapper over
`src/lib/solmind/guideWorkspaceFrame.ts` (the profile chip shows the role
with a person icon). `GuideHome.tsx` keeps every binding, timer, page-event,
sign-out and outcome rule and passes only the pending and warning flags and
the sign-out action to the presentation-only `GuideDashboardHome.tsx`, which
draws the Guide dashboard mockup's four cards without names, counts or times
("Mockup cards, no names"): Explorers, Guide Assistant (with the "AI" badge),
Next appointment, and Waypoint Suggestions, whose "View Waypoint Suggestions"
links `/guide/waypoint-suggestions`; the other three card buttons are not
connected yet and reuse their menu sentences. The wording is in
`src/lib/solmind/guideDashboardHome.ts`; the header, cards, session warning
and Sign out are shared with the Explorer Overview (`WorkspaceHomeParts.tsx`).
While a sign-out is pending every link shows as a non-link
`<span aria-disabled="true">`. `GuideSessionOutcome` takes the dark look only,
with no menu, and keeps its text and Guide re-entry link. The three Guide
Waypoint Suggestions pages sit in the same frame with no entry current (the
breadcrumb says "Guide workspace / Waypoint Suggestions") through
`GuideWaypointSuggestionsPage.tsx`, restyled with every read, command, focus
rule, live region and text unchanged; their "Back to Guide dashboard" link now
goes to `/guide/home` instead of the `/guide` prototype, as a full-document
link (`backFullDocument`, set only by the entry page), so the server checks
access again: a client-side move could restore the Dashboard from the router
cache after a sign-out (browser Back then Forward), and GuideHome's
pagehide/pageshow safeguard does not run on an in-app history move. The two
inner back links stay client-side. The fixture page
`/guide/explorers/avery/waypoint-suggestions`, `/guide` itself and
`/admin/home` are unchanged. The frame still uses the fixed ids
`explorer-menu-button` and `explorer-menu-panel` (from the conversation
screen's Menu button and panel) on the Guide pages too, a known limit.
`/guide/home` needs a sign-in, so `GuideHome.test.tsx` proves the Dashboard's
static markup and `GuideWorkspaceFrame.test.tsx` the Waypoint pages' frame;
interaction and contrast on the signed-in Dashboard are checked on the local
demo with the invented demo Guide.

Keep fixed Guide page/POST entrypoints thin; browser transport/controller belong
in src/lib/solmind and mounted UI in src/components/solmind/GuideSignIn.tsx.
New forms keep one private flow ID across denied/uncertain resends; the actual HMAC code UUID stays server-only. Guide uses email only, unchanged typed password and a SolMind code. Send contains
no password. The approved A4 has no password field, so PasswordRoleSignInView
reads the password once from the uncontrolled A3 field at Send my code, empties
the field, and holds it only in a private ref until verify (contract 25 Section
5.3 keeps it only in page memory until the A4 submit), never in React state,
props, markup, logs, URLs or storage; verify sends it only with a non-empty,
required code. Because the approved A4 has no password field, it is also kept
across Send a new code and an A4 refusal (Paul confirmed this on 2026-11-02,
decision queue 14:07:48), and cleared on a failed send, success, Use a
different email, Choose a different role, an identifier edit, navigation,
departure, unmount and pagehide. After every A4 refusal, whatever the cause,
the status region adds Paul's approved line "To re-enter your password, choose
'Use a different email'." for Guide and Admin alike; it never says which part
failed. Private drafts are cleared on cancellation/disposal; logs, URLs
and browser storage must contain no credentials, selectors or tokens.

Server order is fixed-role eligible lookup, non-consuming exact challenge/
account/contact ownership, password private hold, redemption, provider-user/
redeemed-account confirmation, session creation, accepted-session preparation
and release. Confirmed wrong password records one owned-code failure/audit without redemption; another account's
selector must not reach password. Refusals preserve existing cookies and publish
no new auth/binding cookie. Await bounded discard after held failure; timeout
does not prove remote rollback. Stale/terminal owned selectors can still reach password, but the recorder is writeless; revisit before Sharing.

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

The Explorer home's collapsed fixed-script "Design previews"
(`ExplorerHomeNavigation.tsx`) was removed on 2026-11-04 (Paul's decision, decision queue 2026-11-04 21:44:03 CST);
the Explorer workspace destinations are in the Explorer workspace menu and the
Overview cards (`WorkspaceFrame.tsx`, `ExplorerOverviewHome.tsx`). Each feature
keeps its own authorization; preserve Explorer session/logout and provider/privacy
boundaries.

## Connected Admin boundary

Keep src/app/login/admin/page.tsx and its two fixed POST Route Handlers thin.
LoginExperience owns chooser/direct-entry wiring; AdminSignIn, its separate
transport/controller and fixed /admin/home destination own the browser flow.
Use approved email/username normalization, unchanged typed password and the
same-account/contact ownership-before-password order. Send carries no password; it is read from the uncontrolled A3A field at Send my
code and held privately until verify, exactly as for Guide. Clear private drafts on
departure/disposal; credentials/selectors/tokens never enter logs, URLs, storage
or home props. Refusals preserve existing cookies; bounded discard is not rollback.

The fixed /admin/home rule uses adminHomeAccess and resolveAdminHomeForRequest,
not a bare Guide guard or the public access probe (since 2026-11-03 the home
page goes through adminWorkspaceAccess and resolveAdminWorkspaceForRequest with
the same fixed home resolver, below; adminHomeAccess keeps no page caller). The
server-only audited chain
runs once. On a would-be allow, guarded-read write first and allow-decision write
second must both persist, then a final expiry/clock check must pass. Do not add a duplicate read or third audit event.
Preserve resolveAdminAccessForRequest's exact { allowed } result and
resolveAdminActorForRequest's existing server-only actor projection. Only
expiresAt/observedAt reach AdminHome, and since 2026-11-03 the page's plain
display data (view, below); preserve raw duplicate cookie names/values.
Reuse shared /logout, finite reminders, honest uncertainty and /login/admin
re-entry. /admin stays a prototype; this home adds no provisioning power and,
since 2026-11-03, no dashboard power beyond the minimal Admin screens below.

Minimal functional Admin screens (PRJ01_R-WS03-WI014; Paul's decisions, decision
queue 2026-11-03 11:23:03, 11:52:57, 11:56:14 and 12:19:09): only what testing
needs, and they may be thrown away for a better design. The Admin menu
(`src/lib/solmind/adminWorkspaceFrame.ts`, the banked `WorkspaceFrame.tsx`) has
Dashboard (`/admin/home`), Guides and Explorers (`/admin/people`), AI use and
pauses (`/admin/ai-use`) and Settings (`/admin/settings`), all full-document
links, with no placeholders. The Admin pages also show the banked frame's bell
and profile chip ("Admin"), each with "Not connected yet" (Paul's decision,
decision queue 2026-11-02 22:19:17; a blue build note with the page's
"Build notes" toggle since 2026-11-03). Each page and each POST (`/admin/ai-use/lift`,
`/admin/settings/change`) has its own fixed Admin-only rule in `routeAccess.ts`
and its own fixed resolver in `adminRouteAccess.ts`.
`src/lib/solmind/auth/adminWorkspaceAccess.ts` runs
`resolveAdminWorkspaceForRequest` (the same audited chain once, then the shared
expiry check) and only then the closed reads in
`src/lib/solmind/supabase/adminWorkspaceRpcExecutor.ts` with the server-derived
actor, in the same request. The actor stays on the server; the pages receive the
session times and plain display data, with every time formatted on the server in
Chicago time. A read that fails after an allowed check shows the page saying the
information could not be loaded. The POSTs follow the Guide command order (no
query, trusted origin, `readSameOriginJsonWriteRequest`, exact-key body, raw
cookies, guard, one call, value-free outcome, no-store); the browser makes one
operation id per press, shows the outcome in plain words and reloads the page.
Every Admin page keeps AdminHome's binding (finite clock, sign-out, pagehide/
pageshow reload). Activity is by sign-ins only; apart from the recorded
hard-stop facts Paul approved as Admin review flags (2026-11-01 01:00:16: day,
time reached, that day's total calls, the limit; 2026-11-01 12:27:07: crisis or
urgent status at the stop), no Admin page shows conversation content, message
dates or message counts. The four reads in
`supabase/migrations/20261103120000_admin_minimal_reads.sql` recheck an active
Admin. Their "paused now" is the AI-use gate's own decision (amended 2026-11-03
after review REV219): they call `ai.solmind_explorer_ai_use_gate_v1` in read
mode, which writes nothing, for every account with a non-deleted Explorer
profile. The Dashboard count and the AI use and pauses list cover the Explorers
it pauses by their own limit, including a pause no stop row records (after a
limit is lowered), which the list shows as "Not recorded yet" with no Lift
pause: a Send is normally refused at the pause read before any stop is
recorded, so that pause ends at midnight, Chicago time, or when the limit is
raised above that Explorer's calls today, as the page says (corrected
2026-11-03 after review REV219b); Guides and Explorers shows
"Yes" (own limit), "Yes, shared pause" (only today's shared pause) or "No";
"Explorers active in the last 7 days" counts only accounts with a non-deleted
Explorer profile. The lift and the setting change reuse
`public.solmind_lift_explorer_ai_use_pause_v1` and
`public.solmind_set_application_setting_integer` unchanged, with one fixed
authority reference, `ADMIN_SCREENS_AUTHORITY_REFERENCE_ID` in the executor,
naming Paul's decision queue entry 2026-11-03 11:56:14 as amended at 12:19:09
(amended 2026-11-03 after review REV219: the Admin's account id is no longer
sent, since the audit contract's reference is a non-descriptive id of an
approved checkpoint); both still audit as a system change on Paul's word, which
Paul accepted for these throwaway screens. A Lift pause on a pause already
lifted another way answers "This pause had already been lifted. Nothing was
changed." (outcome `lifted_elsewhere`, amended 2026-11-03). Nothing about AI
costs is built (a future sprint).

Admin timing configuration is explicit and provisional; see
src/lib/solmind/supabase/adminSignInHttpPorts.ts and docs/MODULE_BOUNDARIES.md.
Guide's dated proof/private-local risk acceptance does not accept Admin risk.
Source checks alone establish no runtime/timing/assurance/publication/banking
result; current complete-slice evidence and its checked receipt remain required.
First-Admin setup, SMS, reset, remembered browser/renewal, broader Admin work,
new SQL/schema/grants/dependencies and provider activation stay separate
(2026-11-03: except the minimal Admin screens' four read functions above).

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
- Only the designated Executor integrates, applies, stages, commits or pushes after applicable checks and review. It self-reviews config/docs/test-only changes; login/database/AI-provider/security code also receive one Executor-launched independent read-only Claude review of copied changed files/direct callees against explicit product requirements. Plain yes approves the preceding disclosed external/provider action; standing Claude reviews need no new permission.
- New changes have fresh fix rounds. After a change fails review or tests twice, explain what remains and recommend; Paul may say continue. Mechanical and non-loosening additive/corrective test fixes do not count. Re-review a substantive fix alone; Beyond Compare is used only on request.
- Claude Code (except in the conversation designated as the Executor AI), an external-review model, and any other external AI remain proposal authors or reviewers only. They never receive automatic application, staging, commit, push, merge, deployment, or banking authority from this section.
- It must not run production, cloud, install, dependency, Vercel, or Supabase cloud changes unless explicitly approved.
- It must never reset, drop, or destructively alter a pilot, cloud, production, linked remote, or other database that contains live user data.
- The Executor may start Docker Desktop and start/stop/reset/seed isolated or temporary local databases after exact-target and idle checks. Never reset/drop/remove shared project solmind-app or its containers/volumes; keep the Card 3 demo database after the run.
- Use the approved isolated target for synthetic development; shared demo accounts and data are preserved. Cards 3 and 6 authorize their stated Docker services, database setup and real browser test.
- Temporary databases created by the Executor may be removed only when they hold nothing Paul needs. Retain the Card 3 demo database; stop only owned services when no longer needed and report actual Docker state.
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

Keep new governed selection/source owners direct-import and server-only:
src/lib/solmind/virtual-guide/effectiveMethodologyContext.ts and
src/lib/solmind/supabase/effectiveMethodologySource.ts. The separate
createGovernedExplorerConversationContextBuilder resolves exact immutable
methodology bytes and authority each new turn, then rechecks current
authorization/history and methodology before preparation. Selection binds pack,
Guide scope, version, exact SHA-256 and SQL-derived MV1 authorization version;
shape validation alone is never authority.

createGovernedExplorerConversationRepository changes only prepare to
public.solmind_prepare_governed_explorer_conversation_turn; read/complete/mutate
and the existing factory remain unchanged. The wrapper must atomically rederive
selection authority and durable governance linkage before new dispatch permission.
Exact replay retains original provenance without today's version or redispatch.
No legacy snapshot FK/backfill or synthetic-operation upgrade is permitted.
The proposed SQL owner is
supabase/migrations/20261024020000_methodology_governed_workflow.sql.


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

src/lib/solmind/virtual-guide/explorerContextExclusionGuard.ts is a direct-import
server-only pure matcher. Keep it off shared/client barrels and unconnected to
default builders or request factories. Its only input is the exact compact
S03A serialized context, source IDs, expected binding and supplied manifest.
It checks excluded UUIDs and exact normalized whole decoded string values;
normalization is CRLF/CR to LF plus outer trim, without Unicode normalization.

Only private_note, trigger_observation and summary_revision manifest families
exist here. Reject hostile/malformed/mismatched inputs with the single fixed
explorer_context_exclusion_unavailable error. Return a new frozen clear/blocked
result; references stay server-only and content/digests never enter errors.
No raw-content hashing helper, repository, source loader, timer, provider,
environment, logging, audit, persistence, classification or mutation capability.
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

This R08 candidate is provider-neutral construction, not validated, reviewed,
applied, published or banked. Detailed proof remains with
solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

Keep src/lib/solmind/virtual-guide/methodologyScreeningComposition.ts and
src/lib/solmind/supabase/methodologyScreeningRepository.ts direct-import,
server-only and off shared/client barrels. They use injected capabilities only.
The caller reads the exact own-Admin Guide-scoped draft, binds its subject and
exact trusted request bytes, awaits durable fresh preparation, executes at most
once and freezes one terminal intent. Replay never dispatches or settles again.

No real adapter, default prompt/schema/policy/configuration, credentials,
runtime wiring, actual screen, human review/approval or active pack exists here.
Timeout requests abort; owned asynchronous results must still settle/drain.
Uncooperative injected ports can outlive that request, so no bounded wall-time
or operational drain guarantee is implied. Unknown terminal persistence returns
unconfirmed and never authorizes retry or a replacement terminal intent.


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

R09 is an unvalidated proposal for the existing product privacy boundary in
solmind-docs/execution/04_SolMind_AI_Orchestration_Spec_v1_0.md Section 5.2.
It is not the deferred optional process-improvement work. Detailed prospective
checks are owned by solmind-docs/execution/08_SolMind_MVP0_Test_Plan_v1_0.md.

The R09 predecessor covered eleven explicit EXPLORER_SOURCE_PROFILES and two
erased composition type-only edges. Its dated evidence below retains that exact
scope. The private request/browser boundary above extends the current graph to 27
exact profiles and twelve erased type-only edges. Keep exact runtime/type specifiers and
profile-scoped restricted globals; no wildcard, value-import permission for an
erased edge or default/provider activation follows.

Static dependency lint is not a JavaScript sandbox or proof that injected data,
trusted ports or the complete current source index are safe. Typed assembly and
byte-absence tests remain required; full source/currency, runtime abort/audit,
scheduled integrity and genuine model controls remain unfinished.


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

R10 is current proposal authorship, not validated, assurance-passed, applied,
published or banked. Keep the server-only Virtual Guide contract's immediate
transport return limited to an ordinary same-realm native Promise before it
enters Promise.race. Observe the owned abort-sentinel rejection before calling
generate, while preserving existing cancellation priority and generic errors.

The contract's exact static profile gains only node:util after server-only.
There is no late-drain, timeout, replay, policy, restricted-state, SQL, provider,
default-factory or dependency change. The guard cannot undo trusted-port work,
internal assimilation or failures; an uncooperative port may outlive the outcome.
Source/currentness writer participation remains separate preparation, not an
implemented complete reader, race protocol or runtime exclusion/audit control.

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
Amendment 2026-11-05 (reply choices): the connected screen now shows the latest saved reply's choices as
buttons; see "Reply choices as buttons" below.
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
The migration and this app change must reach a database together: out of step in
either direction, every crisis-check Send fails closed to the temporary assistance.
Scope: ordinary classification_and_reply calls also classify, so a crisis first
detected by the model in an ordinary call has already received the section; this
change covers calls already known to be restricted, adult-stopped or flagged by the
fallback check (review REV249, 2026-11-04).

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

Amendment 2026-11-05 (turned-down limit): saved state includes the required
boolean turnedDownLimitReached, true at 24 rejected Compass rows in that
conversation under S5's counting rule, with no rejected details or count.
The browser contract and repository reject missing or non-boolean values.
Only "That's not it" is disabled; the named row gets Paul's approved reason
once beneath it. ExplorerConversation.tsx refuses not_it locally without a
request. The other replies and typing retain their existing gates. A server
refusal after a race still takes the definite-conflict path. S6b typed
rejections at the limit still leave the point unchanged and let Send complete.
The app change and its migration (20261105040000) must reach a database
together; out of step in either direction, every conversation state read
fails closed.

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

## Chat step S7a: private Waypoint drafts in the conversation - 2026-11-05

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-05 13:18:35 authorize
one private forming Waypoint draft with a short title, destination, why it
matters and arrival signal. The Virtual Guide may suggest or refine that
wording; only an Explorer reply button confirms or rejects it. Typed Waypoint
answers remain S7b. Existing local clarification/form drafts retain their
close/reload loss disclosure; these saved conversation drafts survive reload.

The single forward migration is
supabase/migrations/20261105050000_explorer_waypoint_drafts.sql.
The app change and its migration must reach a database together. State now
requires waypointDraft (the current proposed draft or null) and each saved
Waypoint's title. Old state projections and the old ordinary context version
fail closed; this is not a runtime compatibility switch.

content.waypoint_draft is Explorer-private, with RLS enabled, zero policies
and no direct anon, authenticated or service_role grants. It allows one
proposed draft per conversation, draft_kind new only, nullable forming fields,
and at most 24 rejected rows per conversation. Drafts do not consume the
account-wide active allowance (lane 7, 2026-11-06). Only settlement rewrites proposed wording.
Confirmed and rejected drafts are immutable; rejected details never enter
browser state or model context.

The service-role-only settle v4 replaces the 24-argument overload with 25
arguments, adding optional p_waypoint_suggestion. The additive optional
waypointSuggestion reply field keeps explorer-safety-reply.v2. Its four
required valid fields are accepted only with a saved ordinary reply below
level 2, delivery still wanted, classification_and_reply, clear restriction
and no adults-only stop. Invalid suggestions are dropped independently of
the reply. Refinement replaces wording and its latest suggestion-message
pointer, retaining the first source message; exact replay applies no change.

public.solmind_respond_explorer_waypoint_draft_v1 is the separate bounded
service-role-only command. It preserves fresh authority, policy, ownership,
revision, pending-turn and exact-operation-replay checks. Right copies the
exact stored four fields into a chosen Waypoint within the existing limit,
records Explorer choice and insert-only Virtual Guide/draft/source provenance,
and marks the draft confirmed. Close records only the answer; not_it rejects
within the separate bound. Neither response command calls a provider.
History, revision, Reached and sharing rules remain unchanged.

Ordinary context is wi007-v0.1+onboarding-fields-v2+compass-v4 with
explorer-compass-context.v4. Its drafts array contains zero or one proposed
draft with id and the four nullable fields. SQL and TypeScript derive the
same section and source set; compass-v3 is refused for new turns.
Classification-only calls retain the section-free base revision and exclude
Compass, Waypoint and draft sources. The 30/10/60-second context/RPC/provider
budgets, cancellation, one-call and counting rules remain unchanged.

The connected transcript shows the current draft under the Virtual Guide
message that supplied its latest wording, with Forming, Where you're heading:,
Why it matters: and Reached looks like:. The existing three-reply row and helper
retain their labels, operation identity and uncertain
retry behavior. Close and not_it start a separate ordinary follow-up Send
only after the response is confirmed, naming the draft title and preserving
the Explorer's typed message. Right starts no Send. Confirmed Waypoints use
their saved titles in the existing Waypoint display. Review mockups are unchanged.

Fix round 2, 2026-11-05 (Paul's answers at 17:04:49, 17:21:15 and 17:30:02
CST): the shared unavailability sentences now say "suggestion replies" for
both Compass and Waypoint rows. At the Waypoint limit only "That's right"
is disabled, with the approved reason once beneath the row and a local
command refusal before any request. Close, not_it and typing keep their
existing gates; a server refusal after a race keeps the definite-conflict path.
Amendment 2026-11-06 (lane 7): the browser's waypoints array is an
explicitly partial projection of at most 20 current heads. Required server
waypointCapacity supplies the account-wide active count, active limit and
conversation history room; screen and command gates never count local rows.
SQL coverage exercises Release, Reached, revision and separate active/history
guards on a draft-confirmed Waypoint. The SQL and TypeScript
context tests share one non-empty draft golden in the SQL test.

All five prompt/role/instruction labels end in -20261105-s7a-r2; wording,
byte counts and integrity pins move together. Paul approved the final
screen and instruction sentences in this round's PAUL_ANSWERS.md.
SQL/pgTAP and browser execution, independent review, canonical sibling-doc
updates and any integration or publication remain Executor work. This builder
is limited to the clone and the five named fix-package files; no sibling product
documentation, database or provider was accessed.

## Curious Virtual Guide instruction round - 2026-11-05

This instruction-only round adds easier optional choices, one gentle invitation
after hesitation, useful situation questions one at a time, and adaptation to
the Explorer's style within the conversation without assigning a type or
retaining a style profile. All five prompt/role/instruction labels end in
-20261105-cg-r1; changed text and integrity pins move together. There is no
database, context or screen change. Existing safety, crisis, pacing, Compass,
Waypoint and output-protocol rules remain. Paul must read the exact changed
instruction sentences before saving or integration into the app or demo.

## Chat step S7b: typed replies to the forming Waypoint - 2026-11-05

Paul's decisions of 2026-11-03 12:38:07 and 2026-11-05 17:21:15 extend
typed answers to the one forming Waypoint draft. The Virtual Guide may propose
right, close or not_it only when the latest Explorer message clearly answers
the exact wording from its immediately preceding saved reply. Residual risk:
the Virtual Guide judges the typed answer's meaning, whereas a button press
records the Explorer's explicit selection. Silence, topic changes and ambiguity
supply no answer; when unsure the Virtual Guide asks.

The additive optional waypointResponse keeps explorer-safety-reply.v2 and
contains only draftId and response. A malformed proposal is dropped without
losing the reply. Ordinary context becomes
wi007-v0.1+onboarding-fields-v2+compass-v5 with explorer-compass-context.v5.
Its proposed draft adds suggestedInPreviousReply, derived identically in
TypeScript and SQL from its latest wording source and the preceding saved
Virtual Guide reply. Compass-v4 is refused for new turns; classification-only
calls keep the section-free base revision and existing source exclusions.

The forward migration is
supabase/migrations/20261105060000_explorer_typed_waypoint_replies.sql.
Settle v4 replaces the 25-argument overload with 26 arguments, adding
p_waypoint_response. A response requires a saved ordinary reply below level 2,
delivery still wanted, unrestricted/adult-allowed state and
classification_and_reply. It must target this conversation's current proposed
draft from the immediately preceding saved Virtual Guide reply, with no answer
receipt completed at or after that reply. A valid rewording in the same reply
wins over its response. Right confirms exact stored wording within the existing
Waypoint limit; not_it rejects within the 24-draft bound; a limit silently
drops the response. Close records only the answer. Applied typed receipts keep
only the draft id and response, with no wording snapshot. Exact replay never
applies a response twice. The existing forming and Waypoint cards update from
saved state without new controls.

A Waypoint revision or revisit now carries a drafted title (one that differs
from the destination) forward unchanged; neither screen asks for a title. A
form-created Waypoint, whose title is its destination, keeps following its
destination. All five instruction labels
end in -20261105-s7b-r1, and changed wording, byte counts and integrity pins
move together. Every sentence added or changed in the held curious-Virtual-Guide
round remains unchanged. Paul must read all new instruction sentences and this
title behavior change before anything reaches the app or demo.

The app change and this migration must reach a database together. Grants,
existing authority checks, context/RPC/provider budgets, cancellation, one-call
and counting rules remain unchanged. SQL/pgTAP and browser execution,
independent review, canonical sibling-document updates, integration and any
publication remain Executor work. This builder is limited to the clone and
the three named external files; no sibling product documentation, database
or provider was accessed.

## Reply choices as buttons - 2026-11-05

Paul approved this screen behavior in the decision queue on 2026-11-05
16:37:16 CST. He approved the labels and calm lines in his wording read on
2026-11-06 at 08:56:47 CST. Since S4 a saved Virtual Guide reply may carry one to
three plain-text choices (1 to 40 Unicode scalar values each), returned as
the message's optional choices. src/lib/solmind/explorerReplyChoices.ts owns
the rule: only the latest saved message may offer choices, and only when it
is a Virtual Guide reply carrying them, in an active conversation with no
pending turn and compassSuggestionReplies "available". This uses the coarse
S6a display value; restricted, adults-only and unconfirmed conversations show
none. Saved choices are already empty at classification level 2 or above.
A choice tap or a sent message ends the current offer.
ExplorerReplyChoices.tsx is presentation only, inside that message's existing
list item after any Compass suggestion replies, as a group named "Suggested
replies" with the existing choice-button look. The class strings are exported
from ExplorerConversationScreenTranscript.tsx; the review mockup is unchanged.
These are connected controls, not build notes. Existing held-screen, Virtual
Guide availability and saved-message capacity gates remain in force.

ExplorerConversation.tsx owns the Send: the reply_choice intent sends exactly
the choice's label as an ordinary send command (kind, body, operationId,
expectedRevision). It is refused unless the latest reply still offers that
label, the Virtual Guide is available and capacity remains. It is the
Explorer's own message: one counted call, checked for crisis signs like any
typed message, with the same uncertain-retry bytes and operation identity.
Its own intent keeps the Explorer's typed draft. There is no server, database,
provider-instruction, reply-format or context change; the first-conversation
tour and its daily offer remain later work.

Amendment 2026-11-05 (reply choices r2): "Something else" appears after the
choice buttons with a distinct text-style appearance, only where those
choices show, and never on the Compass suggestion reply row. It is not
counted among the three choices. Pressing it focuses the message box, keeps
any typed draft, sends nothing and makes no request or provider call. The
choices stay visible until Send. One calm line appears just above the
message box and is associated with it for screen readers. The list of 20
exact lines lives in explorerReplyChoices.ts, as Paul approved them; change
them only with his approval. Screen state remembers the last selected line only for the
current conversation; each press selects randomly from the other lines.
The line clears on Send or a new Virtual Guide reply. Nothing is saved or
sent, no browser storage is used, and the line is not a Virtual Guide message.

## Compact Waypoint list - 2026-11-06

Paul's decision of 2026-11-05 19:38:45 (point 4, on GPT-6 Astra's research
REV276) and his design approval of 2026-11-06 08:59:55 (both additions:
newest first, and a forming Waypoint shown in the list as well as in the
conversation) turn the connected Waypoint card into a compact list.
ExplorerConnectedWaypointCard.tsx draws each Waypoint as one row (its title,
at most two lines while closed, and its stage) that opens to the earlier card
details, one row at a time (a disclosure button with aria-expanded and
aria-controls). Three rows show at first, then five ("Show N more"), then all
("Show all N"); "Show fewer" returns to three. Show more and Show all move
focus to the first row they reveal, and Show fewer to Show more. A forming
draft takes the first row with the dashed "Forming" marker (not in an ended
conversation); the other rows are the Formed Waypoints, newest first; Reached
and Released Waypoints sit in a closed "Reached and released (N)" group.
explorerConnectedCard.ts owns the list helpers (waypointListGroups,
waypointRowsShown, waypointListNextSize) and WAYPOINT_LIST_WORDING. Layout
state only (which row is open, how many show, whether the group is open):
nothing is saved and no command, request or AI call is added. Its screen-reader
operation is still to be checked with a real screen reader before the pilot
(Paul's rank, 2026-11-06 09:20:44: This Sprint Could, MVP0 Should).

## Opening greeting - 2026-11-06

Paul's decision of 2026-11-05 19:13:28 (wish 1 from his test: "there was no
initial offer ... Just a blank chat window") adds a fixed, short welcome to a
conversation that has no saved message and has not ended, so the window is
never blank. ExplorerConversationConnectedScreen.tsx draws it above "There
are no saved messages yet." like a Virtual Guide message, without a time,
named "Welcome from the SolMind Virtual Guide" for screen readers
(data-opening-greeting). Its wording is OPENING_GREETING_LABEL and
OPENING_GREETING_TEXT in explorerConversationConnectedScreen.ts, a draft for
Paul's wording read. It is not a saved message, makes no request or AI call,
is not sent to the Virtual Guide and goes away once a message is saved; an
ended conversation never shows it. The three starting choices ("Show me around",
"I have a question", "Let's begin") keep their rule: they may appear in the
Virtual Guide's first reply in the first conversation each day until the tour
is taken. No instruction sentence changes. Presentation
only: no database, context, provider or command change.
