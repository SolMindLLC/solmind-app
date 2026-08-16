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
shape before returning a frozen copy. Map all failures to value-free sentinels.

The banked `suggestedWaypointRequestComposition.ts` is the direct-import
server-only human-request boundary. It validates exact
client-safe Guide/Explorer shapes, derives actor identity and role from the
injected request-auth and record sources, rechecks Guide relationship access,
injects only the server-derived actor, and maps transport detail to fixed
browser-safe results. Initial suggestion/version identifiers come only from an
injected server resolver, never a browser form. Keep the module and test off
shared barrels. It does not itself own a route, Server Action, worker, UI,
hosted scheduler, provider integration, deployment, or real-user activation;
separately reviewed thin read routes call it.

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

- Any locally operating assistant may inspect files, edit files within its explicit authority, and run authorized local checks.
- Only the operating Codex executor may automatically apply a frozen proposal, stage all-and-only the disclosed paths, commit, and push. It may do so without a routine Paul checkpoint only after the mode-appropriate adversarial review passes, every finding is reconciled, and all applicable checks/tests pass under Workflow 02. During Unattended mode the operating Codex executor performs the local adversarial review; during Attended mode the best available external AI performs it after Paul's exact Workflow 05 transmission/run approval.
- Only the operating Codex executor may use the two substantive correction cycles defined by Workflow 02. Directly related mechanical fixes stay inside the active cycle. Re-review and rerun affected/full applicable validation after every substantive correction. After two unsuccessful cycles, stop, open the live-LEFT/proposal-RIGHT BC5 folder comparison, explain the remaining failures, and ask Paul whether to continue.
- Claude Code, an external-review model, and any other external AI remain proposal authors or reviewers only. They never receive automatic application, staging, commit, push, merge, deployment, or banking authority from this section.
- It must not run production, cloud, install, dependency, Vercel, or Supabase cloud changes unless explicitly approved.
- It must never reset, drop, or destructively alter a pilot, cloud, production, linked remote, or other database that contains live user data.
- It may start the bounded local Docker development environment and run `npx.cmd supabase db reset` against the existing local development database without separate approval when needed for testing. Before every reset, it must affirmatively verify immediately before starting that no other test is using that database. If another test is using it, wait until that test completes, perform a fresh idle check, and only then proceed. If use cannot be determined or the active test does not complete, do not reset; stop and report to Paul. Do not interrupt or invalidate the active test. This authorization covers rebuilding local development contents from repository migrations and seed data; it does not authorize dropping the database, its persistent volume, or its local Supabase project/container resources.
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
