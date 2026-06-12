\# SolMind App AI Maintenance Map



Version: 0.1.0  

Repo: solmind-app  

Purpose: Help AI coding assistants safely understand, maintain, and extend the SolMind MVP0 application.



\## Current Application Scope



This repository contains the SolMind MVP0 application shell.



Current routes:



\- `/` — public landing page

\- `/login` — login preview

\- `/admin` — Admin preview

\- `/guide` — Guide preview

\- `/explorer` — Explorer preview



The app currently uses static preview pages only. Authentication, Supabase persistence, invitations, role enforcement, intake workflows, conversation storage, safety flags, and Guide/Admin workflows are not yet implemented.



\## Canonical Role Names



Use these SolMind role names consistently:



\- Admin

\- Guide

\- Explorer



Do not rename these roles casually. Product terminology should remain aligned with the SolMind documentation repository.



\## Virtual Assistant Names



Use these names consistently:



\- SolMind Virtual Guide — Explorer-facing assistant

\- Guide Assistant — Guide-facing assistant



Custom names may be supported later, but the baseline product language should remain consistent.



\## Current Source Layout



```text

src/

&#x20; app/

&#x20;   page.tsx

&#x20;   login/page.tsx

&#x20;   admin/page.tsx

&#x20;   guide/page.tsx

&#x20;   explorer/page.tsx



&#x20; components/

&#x20;   solmind/

&#x20;     BackLink.tsx

&#x20;     DashboardCard.tsx

&#x20;     PageShell.tsx

&#x20;     Panel.tsx

&#x20;     SectionLabel.tsx



&#x20; lib/

&#x20;   solmind/

&#x20;     navigation.ts

&#x20;     pages.ts

&#x20;     roles.ts

&#x20;     terms.ts

