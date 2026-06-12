\# SolMind App Agent Task Rules



Version: 0.1.0

Repo: solmind-app

Purpose: Define safe rules for AI coding agents and AI assistants working on the SolMind MVP0 application.



\## Core Rule



Agents must work in small, bounded, reversible tasks.



Do not ask an agent to broadly "build SolMind," "clean up the repo," "finish the MVP," or "make the app better." Those tasks are too vague and too risky.



\## Required Agent Scope Format



Every agent task should include:



1\. Objective

2\. Files or folders allowed to change

3\. Files or folders not allowed to change

4\. Expected output

5\. Verification commands

6\. Commit message suggestion, if applicable



\## Good Agent Task Example



```text

Objective:

Refactor the Explorer preview topic list into a reusable component.



Allowed files:

\- src/app/explorer/page.tsx

\- src/components/solmind/ExplorerTopicList.tsx



Do not modify:

\- package.json

\- next.config.ts

\- src/lib/solmind/roles.ts

\- any database or auth files



Expected output:

\- Explorer page still renders the same topics.

\- Topic list is moved into a reusable component.

\- No behavior change.



Verification:

\- npm.cmd run lint

\- npm.cmd run build

```



\## Bad Agent Task Examples



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



\## Repository Safety Rules



Agents must not:



1\. Delete files unless explicitly instructed.

2\. Rename SolMind product terms without approval.

3\. Change role names without approval.

4\. Weaken safety, consent, or escalation behavior.

5\. Mix Admin, Guide, and Explorer access rules.

6\. Add dependencies without approval.

7\. Modify `package.json` without approval.

8\. Modify database schema without updating the related documentation.

9\. Modify Row Level Security policies without review.

10\. Claim success without running verification commands.



\## SolMind Role Boundaries



Agents must preserve these baseline role boundaries:



\* Admin can manage MVP0 system setup, Guide invites, methodology, and QA.

\* Guide can view assigned Explorer summaries, progress, and flags.

\* Explorer can interact with the SolMind Virtual Guide and complete onboarding/check-ins.

\* A person may hold multiple roles, but MVP0 role switching is not automatic.



\## Safety-Critical Areas



These areas require explicit review:



\* self-harm triggers

\* relapse-risk triggers

\* major contradiction flags

\* Guide notification logic

\* severe escalation paths

\* Explorer consent and privacy

\* Admin visibility

\* role-based data access

\* transcript storage

\* Supabase Row Level Security policies



An agent may propose changes in these areas, but should not implement broad changes without human review.



\## Documentation Update Rule



When changing any of the following, update documentation in the same task:



\* routes

\* major components

\* role behavior

\* authentication behavior

\* database schema

\* safety behavior

\* onboarding workflow

\* Guide dashboard behavior

\* Admin dashboard behavior



Relevant documents may include:



\* `docs/AI\_MAINTENANCE\_MAP.md`

\* `docs/AGENT\_TASK\_RULES.md`

\* `docs/MODULE\_BOUNDARIES.md`

\* root `AGENTS.md`

\* root `README.md`



\## Verification Commands



Before reporting completion, run:



```powershell

npm.cmd run lint

npm.cmd run build

```



If a task adds tests, also run the relevant test command.



\## Preferred Commit Style



Use small commits with explicit names.



Good examples:



```text

Add AI maintenance map

Add agent task rules

Refactor Explorer topics into component

Add SolMind role type definitions

Add MVP0 route constants

```



Bad examples:



```text

Updates

Fix stuff

Big changes

WIP

SolMind work

```



\## Recovery Rule



If an agent gets uncertain, it should stop and report:



1\. What it changed

2\. What it intended to change

3\. What it is unsure about

4\. What command failed, if any

5\. What it recommends next



Do not continue guessing.



