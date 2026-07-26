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

## Secrets Boundary

Never expose server secrets through `NEXT_PUBLIC_` variables.

Do not expose:

- Supabase service-role keys
- Admin bootstrap tokens
- provider secrets
- server-only credentials

Client-accessible variables must be intentionally public and safe to expose.

## Local AI Executor Boundary

When Codex, Claude Code, or another AI assistant is acting as a local repo executor:

- It may inspect files, edit explicitly approved files, and run approved local checks.
- It must stop before `git add`, `git commit`, and `git push` unless Paul explicitly approves those actions in the current task.
- It must not run production, cloud, install, dependency, Vercel, or Supabase cloud changes unless explicitly approved.
- It must never reset, drop, or destructively alter a pilot, cloud, production, linked remote, or other database that contains live user data.
- It may run `npx.cmd supabase db reset` against the existing local development database when needed for bounded development testing. This authorization covers rebuilding the local development database contents from the repository migrations and seed data; it does not authorize dropping the local development database itself, its persistent volume, or its local Supabase project/container resources. Those actions require Paul's explicit approval.
- The existing local development database is the default for ordinary development testing. Use an isolated temporary test database only when the test plan names a real isolation need, such as parallel or adversarial execution, intentional crash or cancellation testing, an unusual starting state, variant comparison, preservation of useful local development state, or a harness that requires exclusive database control.
- It may create, reset, and drop a clearly identified temporary test database, including exact test-created containers or disposable volumes, without separate approval. Temporary test resources may persist only until the required evidence is captured; then remove them immediately, verify that no test-created residue remains, and close any Docker window opened for that test.
- If temporary-resource cleanup fails, the test is incomplete. Preserve the evidence, report and quarantine the exact residue, do not touch unrelated Docker resources, and do not leave routine cleanup debt for Paul.
- Paul remains the default approval gate for staging, commits, pushes, merges, deploys, and production/cloud changes.

## Verification Commands

Run before reporting completion:

```powershell
npm.cmd run lint
npm.cmd run build
```

## If Uncertain

Stop and report:

1. What changed
2. What you intended to change
3. What you are unsure about
4. What command failed, if any
5. Recommended next step
