# Suggested Waypoint Whole-Path Test Infrastructure

This folder owns test-only infrastructure for the future local authenticated
Suggested Waypoint whole-path proof under `CARRY-001` / `RPR-011`.

The current safety kernel is intentionally effect-free. It returns `null`
unless two exact local-effect interlocks are present, and after those
interlocks it accepts only:

- project `solmind-app`;
- Supabase API `http://127.0.0.1:54321`;
- database port `54322`;
- one separately owned loopback application port in `4100..4999`;
- one bounded `S03G-*` run identity; and
- the five closed synthetic role labels needed by the proof, including both
  unrelated-role directions and one ended-relationship actor.

It creates no client, principal, cookie, database row, process, file, provider
call, hosted request, deployment, or real-user effect. It reads no credential.
A caller can see the fixed interlock strings in source, so satisfying them is
necessary but never grants authority or replaces the active SolMind workflow
and current human authorization for any later effect.
A future separately assured runner must consume this kernel before credential
access and must still own fixture creation, isolated sessions, exact teardown,
zero-residue proof, and a final local reset.

## Local Auth fixture foundation

The test-only local fixture foundation is intentionally callable only through
`runWithSuggestedWaypointLocalAuthFixture`. It checks the safety kernel before
calling the supplied secret loader, then owns one bounded lifecycle:

1. reset the exact local database;
2. reject synthetic-email collisions;
3. create exactly five local Auth users by the supported Admin API;
4. bind their returned UUIDs to one fixed SolMind graph through SQL passed only
   in memory;
5. sign in through five non-singleton Supabase browser clients with separate
   in-memory cookie stores;
6. yield the role-isolated fixture only to its callback; and
7. clear sessions, delete the exact returned Auth UUIDs in reverse order, and
   perform the mandatory final local reset even after failure.

The foundation does not read environment values by itself, run Docker or
`psql`, create a browser context, write storage state, start Next.js, invoke a
product route, deliver a Suggested Waypoint, or claim the Lane G whole-path
proof. The later outer runner must inject the local reset and stdin-only SQL
effects, keep all credentials and cookie values in process memory, and emit
only fixed value-free result categories.

## In-memory Playwright session seam

The test-only Playwright seam converts the five fixture-owned SSR cookie jars
into five distinct browser contexts without a storage-state file. It rechecks
the exact HTTP `127.0.0.1` application origin and accepts only exact-host,
non-secure loopback cookies. It preserves every active chunk name and value,
normalizes only browser-usable Lax and Strict SameSite values, derives expiry only from
a positive `maxAge`, and rejects Domain, Partitioned, malformed, expired, or
ambiguous cookie options before a context is created.

The returned bundle owns all five contexts and closes them in reverse order.
It bounds each fixture session to 16 cookie chunks, 256-character names, and
8,192-character values. It emits only fixed failure categories and never writes
cookies, tokens, Auth UUIDs, storage state, traces, screenshots, or other
protected values. Distinct role-session objects and distinct in-memory cookie-set
digests prevent two roles from silently sharing one authenticated identity.
Concurrent close calls share one attempt, and a failed close remains retryable. The later
outer runner still owns the read-only authenticated-role proof, scenario
navigation, production-server lifecycle, and unconditional fixture teardown.

## Whole-path lifecycle orchestrator

The test-only orchestrator composes the safety kernel, local Auth fixture, five
in-memory Playwright contexts, one scenario callback, and cleanup in one closed
lifecycle. It reconstructs one stable environment from the already-validated
safety configuration so the fixture and browser layers cannot observe different
gate or origin values.

Browser contexts close first, then the owned browser closes, and only after the
callback returns does the fixture owner clear sessions, delete the exact Auth
users, and perform the final database reset. Cleanup failure dominates scenario
failure, and callers receive only fixed value-free error categories. A direct
regression case combines one closed scenario-step failure with Auth-fixture
cleanup failure and requires the cleanup category to win.

The scenario boundary reports one of fourteen closed, test-only step IDs:
relationship entry; draft create; draft edit/save; schedule/Pull Back/reschedule;
pre-delivery denial; delivery wait; delivery bridge; delivered read; Mark as
read; acknowledgement; Guide acknowledgement refresh; projection shape;
unrelated-role denials; or layout/accessibility. Raw error text and protected
values are never retained. A successful cleanup preserves the closed failing
step; a cleanup failure still takes precedence over every scenario step.

The Guide draft-create step has one additional closed, value-free diagnostic
layer. It can distinguish request transport, non-success HTTP, response parsing,
response-contract rejection, fixed command denial, fixed command failure, and
the four already-approved expected outcomes. It never retains a response body,
identifier, database value, cookie, or raw error. Arbitrary thrown values still
collapse to the parent `guide_draft_create` step, and cleanup failure still wins.

The relationship-entry step now waits for the authenticated Guide list request,
validates its exact browser-safe result, requires the freshly reset fixture to
contain no pre-existing suggestions, and then confirms the corresponding empty
Guide UI. Its nine fixed subcategories distinguish request, HTTP, JSON,
response-contract, relationship-denial, relationship-failure, impossible
first-page refresh, unexpected pre-existing suggestions, and UI-projection
failures. This makes a later draft denial occur only after the Guide relationship
entry has conclusively passed, without exposing an identity, relationship,
cookie, response body, database value, or raw error.

The orchestrator still does not load secrets itself, start Supabase or Next.js,
launch a browser without an injected owner, write credentials or browser state,
implement product assertions, or authorize effects. A later effectful driver
must supply those dependencies after the exact safety gates and current workflow
authority are present.

`createBrowser` owns any partially allocated browser process until it resolves
with a complete browser handle. If that factory rejects, it must settle
everything it created first because the orchestrator has no handle to close.

## Isolated effectful runner and delivery bridge

`runSuggestedWaypointWholePath.mjs` is an opt-in, local-only
outer owner. It refuses missing interlocks, any non-loopback target, a linked
or unexpected Supabase project, a reused application port, and unexpected
Supabase status fields before it starts a product process. It captures command
output in memory and emits only fixed categories; Supabase keys, Auth cookies,
fixture identifiers, request bodies, and raw failures never become durable
runner output. Playwright stops after the first failed viewport project, while a
successful proof still exercises both desktop and narrow projects. A failed
child may add exactly one finite-allowlist category for
fixture initialization, fixture cleanup, browser creation, browser-session
setup, one of the same fourteen closed scenario steps, or the outer runner;
arbitrary child text is never forwarded. If multiple allowlisted strings are
ever present, the runner retains the first. The deterministic runner contract
extracts and executes the runner's exact finite regular expression against all
approved and representative rejected categories, pins the exact ordered
fourteen-step alternation, and requires every step at an actual Playwright
wrapper call site rather than accepting a comment or unrelated string.
The same executable contract pins all ten Guide draft-create subclasses in the
outer runner's finite allowlist and rejects representative arbitrary variants.
It also pins all nine Guide relationship-entry subclasses and rejects arbitrary
relationship-entry variants.

For an exact local proof only, the first Guide relationship-list request also
carries the approved run ID through one request-scoped Playwright interception.
The server route accepts that header as diagnostic binding only after every
exact local proof environment, loopback target, method, route, and run-ID gate
matches. If the unchanged public response remains the generic list denial, the
server may emit one of nine fixed value-free stages: query, relationship path,
request resolution, principal, auth context, Guide role, relationship load,
relationship access, or RPC. The outer runner replaces only the matching
generic relationship-entry denial with that fixed stage; arbitrary server
output is discarded and no protected value becomes durable.

For an exact local proof only, the Guide create-draft request also carries its
already-approved run ID in a dedicated test header. The server route accepts
that header as diagnostic binding only after every exact local proof
environment and loopback target matches. If the public response remains the
generic `command_denied`, the server may emit one of ten fixed value-free
internal stages: query, relationship path, request guard, route input, request
resolution, principal, auth context, Guide role, relationship, or RPC. The
outer runner scans server stderr in memory, discards all arbitrary text, and
replaces only the matching generic draft-denial category with the fixed stage.
The browser response is unchanged, no protected value is retained, and the
seam is inert outside the exact local proof.

The runner invokes the exact `supabase@2.115.0` CLI package through Node's npm
entry point so Windows never executes a `.cmd` child directly and the toolchain
cannot silently drift. It passes `--offline --no`, so npm uses only the already
cached package: a cache miss fails the run, and nothing is installed or fetched.
Before the sanctioned run, the operator must verify the
exact package is already available through that entry point and must confirm the
`db reset --local --yes --no-seed` flags with its effect-free help output; the
effectful proof is not a package-installation authority surface. The local
fixture temporarily selects the schema-owned minimum 60-second send-grace value;
authoritative Guide detail must report both that value and the end of Pull Back
availability before the delivery bridge may run. The final database reset
restores the ordinary 300-second default.

A validation workspace may reuse the live dependency installation
through a junction-backed `node_modules`. Because Next.js Turbopack correctly
rejects a dependency junction that resolves outside the isolated workspace
root, only this outer proof runner selects `next build --webpack`. The ordinary
repository `npm run build` remains `next build` and must pass separately on the
exact live repository before application and banking. The runner contract test
pins both sides of that boundary so the isolated workaround cannot silently
replace or weaken the normal Turbopack gate.

`playwright.whole-path.config.ts` is isolated from the ordinary mocked browser
suite and disables screenshots, video, and traces. The spec loads local keys
into JavaScript memory only, so the launched Chromium process does not inherit
the service-role key. The separately isolated Vitest delivery bridge is the
only child that receives the exact service key and one exact delivery job. It
imports the real banked server-only adapter through the existing test-only
`server-only` alias and proves one delivery plus one exact idempotent replay.

This runner requires the local Supabase stack to be already running. It owns a
reset before and after each scenario through the banked fixture lifecycle and
never owns `supabase start`, hosted scheduling, discovery, polling, provider,
deployment, cloud, production, or real-user behavior.

Do not invoke the Playwright or Vitest configurations directly. Only the outer
runner owns the complete safety environment, fixture lifecycle, product-server
process, result-directory cleanup, and final reset required for an effectful
whole-path proof.

Each local database reset has a 10-minute bound. Each responsive Playwright
project has a 30-minute bound, leaving ten minutes beyond both lifecycle-owned
resets for the scenario. The outer Playwright child has a 70-minute bound,
leaving ten minutes beyond both sequential projects. Deterministic
contract evidence pins those nested relationships so the fixture owner's
in-process teardown remains the first timeout response. The outer owner still
terminates a stuck child and then stops the product server and removes only its
own result directory.
