# Supabase Auth Provider-Probe Harness (R4)

This folder holds test-only infrastructure for login step 3: the local, synthetic
Supabase Auth provider probes that backlog item 70 in
`solmind-docs/execution/18_SolMind_Workflow_Tooling_Backlog_v0_1.md` owns. Section
7.9 of
`solmind-docs/execution/21_SolMind_MVP0_Auth_RLS_Login_Provisioning_Write_Path_Contract_v0_1.md`
and AUTH-RLS-DEC-035 and AUTH-RLS-DEC-039 require these probes. They must pass before
the session bridge and its callers bank. The folder sits next to `tests/whole-path/`,
outside `src/`, so nothing here can reach an application bundle.

It builds on the banked pure kernel (SL-034, app `e94ccf1`), which it does not change:

- `src/lib/solmind/supabase/__tests__/providerProbeConfig.ts`: the two exact
  interlocks, literal-loopback URLs, pinned profiles and ports, the run id, the
  run-tagged `synthetic.invalid` recipient and the 1-300 second lifetime margin.
- `src/lib/solmind/supabase/__tests__/providerProbeEvidence.ts`: the closed 13-field
  evidence record and its secret-pattern serializer.

## Modules

| Module | Kind | Role |
| --- | --- | --- |
| `providerProbeRun.ts` | production | The gated composition root. It takes only the environment and passes the run core the fixed production transports. |
| `providerProbeLoopbackFetch.ts` | production | The only network entry points: a gated, fixed-target Auth fetch and Mailpit fetch. |
| `providerProbeRunEnvelope.ts` | production | The closed output envelope, the known-value registry and the output scanner. |
| `providerProbeEnvironment.ts` | production | The environment comparison, the verified config digest and the impact display. |
| `providerProbeLocalRoot.ts` | production | The root-path syntax check (see point 9). |
| `providerProbeSuiteGate.ts` | production | The integration file's gate and its enabled-branch wiring. |
| `providerProbeRunCore.ts` | restricted | The run's composition and its two fixed deleters; it accepts transports. |
| `providerProbeCleanupLedger.ts` | restricted | Exact-ID cleanup from creation receipts; it accepts deleter callbacks. |
| `providerProbeLoopbackCore.ts` | restricted | The `node:http` transport; it accepts targets and a request seam. |
| `providerProbeMailpitClient.ts` | restricted | The mail inventory and capture; it accepts a fetch. |
| `providerProbeAuthAdminCore.ts` | restricted | The run-tagged user creation; it accepts a client. |
| `providerProbeCleanupReceipts.ts` | restricted | Receipts and the run-owned recipient record. |
| `providerProbeTestSupport.ts` | test-only | The only route to every seam. |

`providerProbeModuleBoundary.test.ts` enforces these rules with TypeScript's own parser:

- **Restricted modules** are imported only by their named owners, by
  `providerProbeTestSupport.ts`, and by the unit-test files it names.
- **Probe-body test files:** every other test file, including the integration file
  (where the probe bodies will go) and any new test file, is held to a stricter rule:
  - it may import only `providerProbeSuiteGate`, `providerProbeRun`,
    `providerProbeRunEnvelope` and `providerProbeEnvironment`, and the two kernel files;
  - from `vitest` it may import only these names, each as a named import: `afterAll`,
    `afterEach`, `beforeAll`, `beforeEach`, `describe`, `expect` and `it`. `vi` (whose
    `importActual` loads any module), a namespace, a default or a side-effect import
    and any re-export are refused;
  - it may load nothing dynamically, literal or not, and may not use `import.meta`
    (Vite turns `import.meta.glob` into imports), `vi`, `vitest` or any identifier
    starting with `__vite` (the module runner's injected loaders);
  - it may use `process` only as `process.env`, and the identifier rules below apply.

  So it cannot import or load a transport, a client library, the loopback fetch or
  test support, short of the reflective route named under "What this revision does not
  do". It reaches the network only through `createProviderProbeRun`, which is gated
  per request and per deletion.
- **Issuing names:** only three named unit-test files may import the names that issue
  receipts or add run-owned recipients.
- **Relative imports** name only a file of this folder (`./<name>`) or one of the two
  kernel files, and no test file loads a local module dynamically.
- **Capabilities are allowed only where its table lists them:** `node:http`,
  `@supabase/supabase-js`, `node:crypto` and `node:fs` (and only `readFileSync`).
- **Identifier rules for non-test modules:** they may not reference `console`,
  `globalThis`, `global`, `window`, `self`, `Reflect`, `require`, `eval`, `Function`,
  `WebSocket`, `EventSource`, `vi`, `vitest`, any identifier starting with `__vite` or
  a free `fetch`, and may use `process` only as `process.platform`. These are judged by
  identifier, so computed access (`process["stdout"]`), aliasing and destructuring are
  caught too.
- **No other app file** imports this folder. The scan skips installed packages and
  dot-directories.
- **Every script file is classified,** and the folder has no subfolder.

## Safety model (each claim names the test that proves it)

1. **Gated network entry.** The two production factories, `createProviderProbeAuthFetch`
   and `createProviderProbeMailpitFetch`, take nothing but the environment.
   - Each refuses to build unless the kernel returns a configuration, which needs both
     exact interlocks.
   - Every request checks the interlocks again first, and also that the run id,
     profile and URL are unchanged. It checks them once more after its connection
     opens and its peer is verified, immediately before writing its first byte.
   - A request refused at either check sends zero request bytes, including one whose
     socket was still connecting when an interlock was removed. A request that has
     already begun writing is not recalled: its bytes are on their way, and its
     response is still read. Removal stops every request that has not yet begun
     writing.
   - Proved in `providerProbeLoopbackFetch.test.ts`, with raw-server byte counts
     (including a delayed connection during which an interlock is removed) and with
     spies on `http.request` and `net.Socket.prototype.connect`, all with positive
     controls.
2. **Fixed targets.** The Auth fetch reaches only `/auth/v1/` on the kernel's API origin.
   The Mailpit fetch reaches only `/api/v1/` on port 54324 of the same loopback host;
   the locked-down profile has none.
   - Neither can be widened.
   - PostgREST, a table read and a `solmind_*` RPC are refused before any request,
     under every production construction.
   - Proved in `providerProbeLoopbackFetch.test.ts`.
3. **Cleanup re-checks the gates before every deletion, through fixed deleters only.**
   The production run exposes `cleanup()` and `retryCleanup()`, with no parameter. They
   use only the run core's own deleters:
   - Auth `admin.deleteUser(id)` on the run's admin client, over the Auth fetch;
   - one Mailpit `DELETE /api/v1/messages` per message, with the body
     `{"IDs":["<id>"]}`. The id is validated first, so an empty list is never sent.

   The ledger caches nothing; it re-reads both kernel interlocks and the run identity
   immediately before each deletion and at the start of each round.
   - A gate closed at the start refuses the round without consuming it.
   - A gate that closes mid-round stops it. The targets not yet attempted stay as
     residue, marked "not-attempted".
   - Proved in `providerProbeRun.test.ts` (the run core over test transports to a mini
     HTTP server that counts every byte), and in `providerProbeCleanupLedger.test.ts`.
     - Interlocks removed after construction: no connection and no new byte.
     - Interlocks removed while a deletion is in flight: that deletion, already
       written, completes; no later deletion sends a byte.

     The transports keep their own gated environment in that test, so the refusal is
     the ledger's own.
4. **Cleanup bound to run-owned creation.** An identifier can enter the cleanup plan
   only through an opaque, single-use, run-bound receipt. Only the two effect-owning
   operations issue receipts.
   - **`createRunTaggedUser`** mints its own address: the run tag plus 80 random bits
     at `synthetic.invalid`.
     - It takes a ledger reservation before its call. Cleanup cannot start while a
       reservation is outstanding.
     - It commits the receipt for any user whose id comes back.
     - Only when the server confirms the minted address does that address become a
       run-owned recipient.
   - **`captureNewRunOwnedMessages`** issues receipts only for messages addressed to a
     run-owned recipient.
     - A message that only carries the run tag, such as one inserted from outside, is
       counted but gets no receipt.
     - So does a same-run, well-formed but unrelated id.
   - **The production run** exposes no way to record, issue or forge anything.
   - Proved in:
     - `providerProbeCleanupLedger.test.ts`;
     - `providerProbeAuthAdmin.test.ts`;
     - `providerProbeMailpitClient.test.ts` ("receipts only for run-owned recipients");
     - `providerProbeRun.test.ts` (exact surface keys, end-to-end capture);
     - the module-boundary test.
   - The limit that remains: a message sent by someone else to the exact minted address
     would be indistinguishable. Such a sender would have to learn an 80-bit random
     address during the run.
5. **Failed cleanup is kept.** A failed or not-attempted target stays in private,
   bounded memory as residue.
   - `retryFailedCleanup` re-attempts exactly the residue, for at most three rounds in
     all.
   - Reports carry only categories, ordinals, outcomes and counts.
   - What happens to residue after the last round is Paul's decision.
6. **Retention.** Item 70 requires "bounded evidence retention; and proof that no secret,
   token, action link, email address, UUID, cookie value, or credential is retained."
   - **Where values live.** Identifiers, addresses, keys and generated credentials
     exist only in process memory during a run. They are held inside opaque receipts
     and handles, the ledger's, the mail inventory's and the run-owned record's
     private state, and the run's known-value registry, all bounded.
   - **When they leave memory.**
     - A deleted identifier leaves the ledger at once.
     - Cleanup residue stays in the ledger until it is deleted or the run process
       ends.
     - The registry keeps its copies until the run process ends.
   - **No logging or writing.** No non-test module here logs or writes a file; the
     boundary test enforces this.
   - **The one retained document** is the closed envelope plus kernel-validated
     evidence, scanned against the run's registry.
   - **Created users** leave the creation operation as an opaque handle plus the
     minted address. Later probes need the address in memory, and it is registered.
7. **Output boundary.** The closed envelope and the kernel evidence schema are the
   boundary. The scanner adds defence in depth on top of them; it is not proof that
   arbitrary text is safe.
   - It applies the kernel's rules, any-version UUID rules, the word `token`, and every
     registered value in plain and encoded forms.
   - It applies them to decoded variants of the text.
   - Proved in `providerProbeRunEnvelope.test.ts`.
8. **Mail inventory completeness.** Every page must report an integer `total`. Within a
   pass every page must report the same total, and each page must hold exactly
   min(page size, total - start) messages. `start`, `count` and `messages_count`, when
   present, must agree.
   - A total that changes between pages discards the pass.
   - A stable total that the pages contradict fails closed.
   - Counts are trusted only when two consecutive complete passes agree on ids,
     classification and total.
   - Proved in `providerProbeMailpitClient.test.ts`, "mailpit completeness".
   - The field names and meanings are unverified against the Mailpit that Supabase CLI
     2.115.0 starts.
9. **Root path syntax, not locality.** The production harness's two filesystem readers
   (`providerProbeEnvironment.ts` for `supabase/config.toml`, and
   `providerProbeRunEnvelope.ts` for installed packages' `package.json`) read only
   under the pinned app root, and check its path text before their own filesystem
   calls. The unit tests' own reads, such as the boundary test's folder scan, are not
   guarded by this check.
   - The check rejects:
     - Windows UNC paths (`\\server\share`, `//server/share`);
     - device and long-path prefixes (`\\?\`, `\\.\`);
     - drive-relative paths (`C:repo`);
     - relative paths;
     - POSIX `//` paths.
   - It does not prove the path is on a local disk. A mapped network drive letter, a
     junction or link to a share, and a mounted network filesystem all pass it.
   - The config digest is read only through a successful, branded environment
     comparison.
   - Proved in `providerProbeEnvironment.test.ts`, including one test showing that a
     mapped-drive-style path is accepted.

The interlocks are technical gates written in source. They never stand in for Paul's
approval.

## What this revision does not do

- It runs no probe and reads no key, and it starts neither Docker nor the local
  Supabase stack.
- It has no environment observer. `ProviderProbeEnvironmentObserver` is an interface
  only, because how Supabase CLI 2.115.0 reports its workdir, project id and API URL has
  not been verified.
- It has no locked-down workdir and no probe bodies. The integration file lists PP-00
  to PP-12 as to-do items.
- It does not make the boundary analyzer more than syntactic.
  - It judges names, not values. A probe-body file could still reach the `Function`
    constructor reflectively, through any function's `.constructor`, and generate code
    that loads a module. The rule refuses every direct route it names; this
    reflective one stays a known limit.
  - The run core's supabase-js client also carries a Realtime client, which would use
    the global `WebSocket`. It is unreachable, because the client never leaves the run
    core and the run never subscribes to a channel.
- It does not change the kernel.
  - Session-renewal and email-change probes would need new probe IDs, which the kernel's
    closed ID set rejects today.
  - The kernel's own UUID rule covers versions 1-5 only; this harness's scanner adds the
    stricter check.

  Both kernel points are open.
- The July probe matrix
  (`solmind-docs/archive/audits/SolMind_Supabase_Auth_Provider_Probe_Architecture_Review_2026-07-16.md`)
  is history, not authority.

## How a run would be approved

1. Paul decides the open points:
   - the locked-down workdir;
   - the PP-04 red team;
   - exact-ID deletion;
   - the lifetime margin;
   - the FBL-P28 comparison;
   - the DEC-031 follow-up;
   - the disposition of any cleanup residue.

   A later revision then adds the probe bodies and a verified environment observer, and
   is reviewed like any other slice.
2. Before any effect, the run shows Paul the observed environment comparison and the
   impact display. It then waits for his exact current approval of that run, cleanup
   included.
3. Only after that approval does the operator set the kernel's interlocks and settings
   for that one run. Removing an interlock at any point stops every request and
   deletion that has not yet begun writing; one already writing is not recalled.
4. The run ends with exact-ID cleanup, the final no-side-effect proof (PP-12) and one
   scanned, value-free output document.
