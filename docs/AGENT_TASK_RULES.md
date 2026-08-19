# SolMind App Agent Task Rules

Version: 0.2.1
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
15. Run `npx.cmd supabase db reset` against the existing local development database without first affirmatively verifying immediately before the reset that no other test is currently using it, or while another test is using it. When the preflight verifies that no test is using it, or after the active test completes and a fresh check confirms that no other test is then using it, the agent may run that reset without separate approval for bounded development testing. If database use cannot be determined or the active test does not complete, do not reset; stop and report to Paul. Do not interrupt or invalidate the active test.
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
