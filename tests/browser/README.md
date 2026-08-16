# Browser interaction test harness

This directory owns the shared Playwright harness for real-browser interaction
and companion accessibility checks. The initial smoke tests exercise only the
deterministic local Explorer and Human Guide Suggested Waypoint review routes.
They do not use authentication, Supabase, Docker, providers, hosted data, or
real users.

## One-time local setup

Install the repository dependencies and the pinned Chromium browser used by
the local Playwright version:

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

## Run

```powershell
npm.cmd run test:browser
```

The bounded Node runner first rejects an occupied port, runs a production
build, starts that exact owned build on `127.0.0.1:4173`, runs serially at
desktop and 390-pixel narrow viewports, stops only its captured server process,
and proves the port is clear afterward. Set
`SOLMIND_BROWSER_TEST_PORT` to another unused port from 1024 through 65535 when
the default is unavailable.

Failure-only screenshots and traces are written under
`test-results/browser`. A passing run should leave neither that evidence nor a
listener on the configured port.

Browser checks supplement rather than replace Vitest, typecheck, lint,
production build, manual usability review, and privacy review. Automated axe
scanning is a companion to explicit landmark, accessible-name, keyboard,
focus, responsive-navigation, and live-region assertions; it is not complete
accessibility proof.
