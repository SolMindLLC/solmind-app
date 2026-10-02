# Supabase Auth Provider-Probe Harness (R12: the probe bodies after re-check #128g)

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
| `providerProbeEnvironment.ts` | production | The environment comparison, the verified config digest and session length, and the impact display. |
| `providerProbeLocalRoot.ts` | production | The root-path syntax check (see point 9). |
| `providerProbeSuiteGate.ts` | production | The integration file's gate, and the probe session it runs (R5). |
| `providerProbeOutputFile.ts` | production | The only file writer: the impact display and the evidence document, outside the app root (R5); (R6) it re-reads the live gate and compares real locations immediately before each create. |
| `providerProbeStackObserver.ts` | production | (R6) The only process starter: two fixed, read-only `docker` commands that observe the running stack's workdir, project id and API port. (R7) Both are pinned to the local Docker engine with `--host`, after an environment check that runs nothing. Only the suite gate may import it. |
| `providerProbeRunCore.ts` | restricted | The run's composition and its two fixed deleters; it accepts transports. |
| `providerProbeProbeCore.ts` | restricted | The probe bodies PP-00 to PP-12 and their evidence records; it accepts a run and test seams (R5). |
| `providerProbeAuthProbeCore.ts` | restricted | The Auth operations the probes use, returning only facts and opaque handles; it accepts clients (R5). |
| `providerProbeCleanupLedger.ts` | restricted | Exact-ID cleanup from creation receipts; it accepts deleter callbacks. |
| `providerProbeLoopbackCore.ts` | restricted | The `node:http` transport; it accepts targets and a request seam. |
| `providerProbeMailpitClient.ts` | restricted | The mail inventory, capture and (R5) message reader; it accepts a fetch. |
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
  `@supabase/supabase-js`, `node:crypto`, `node:fs` (only `readFileSync`, and
  `writeFileSync` and `realpathSync` in `providerProbeOutputFile.ts` alone) and (R6)
  `node:child_process` (only `execFile`, in `providerProbeStackObserver.ts` alone).
- **(R6) Process starts are confined:** only the stack observer imports
  `node:child_process`, with `execFile` alone; among non-test modules only the suite gate
  imports the observer, and no probe-body test file may. Fixture tests show `exec`,
  `spawn`, a namespace or default import, and `execFile` in any other module refused.
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
   only through an opaque, single-use, run-bound receipt, and receipts are issued only
   inside the restricted effect-owning modules: the admin core, the mail client, and
   (R5) the Auth probe core.
   - **The Auth probe core (R5)** takes a ledger reservation before every request that
     might create a user, then commits a receipt only for the id the server returned to
     that request, or, while the reservation is still open, for a user found by listing
     at exactly the address this run minted for that request. No other listed user ever
     receives a receipt. (R6) Every request that might create a user now has its own
     minted address: the anonymous and phone sign-up attempts, which had none, are
     removed. Every reservation that was not committed is released in a `finally` on
     every path, including a listing failure, while committed receipts are kept, so
     cleanup can always start. Proved in `providerProbeProbes.test.ts` (a PP-08 listing
     failure after one create, a sign-up that creates a user without returning its id
     followed by a listing failure, and a hung missing-user link followed by one).
   - **(R7, R8) No untracked user after a failed creation.** When a creating request
     returned no usable id and the listing after it fails, a user may exist that cannot be
     attributed, whatever the answer said. (R8) That includes a refusal confirmed by its
     status and code: a server can refuse and still create a user. Only when every
     attempt returned its id is a listing failure a failed check. Otherwise the attempt is
     counted as one unresolved user, every further effect stops at once, cleanup still
     deletes everything tracked, and the run stops for Paul (PP-11 fails, and so does
     PP-12, which fails whenever an unresolved user was counted; R11: it reports no
     number). The unresolved user is never deleted by a guess. Proved in
     `providerProbeProbes.test.ts` (the id-less sign-up and the hung link above; a lost
     admin creation answer followed by a listing failure, after which PP-04 and PP-06 do
     not run and no further effect request is made; and (R8) a closed sign-up's confirmed
     refusal, PP-09's confirmed `user_not_found` and PP-08's confirmed duplicate refusal,
     each of which still created a user, followed by a failed listing).
   - **(R9) The count is delivered at settlement, before the answer is processed.** Every
     creating path (`settleCreation` for the sign-up surfaces and PP-09, PP-08's own
     settlement, and the admin fixtures) first commits every user it can attribute and
     adds every unresolved user to the run's creation count, and only then registers ids,
     holds a session, or registers the link's properties, any of which can throw (a
     malformed or excess session, an oversized value, a full registry). The probe core
     reads that count after every creating operation and every step, also when the step
     threw, so such an exception fails its record without losing the unresolved user:
     effects stop as "untracked-effect", PP-11 stops for Paul, and nothing is deleted by
     a guess. Proved in `providerProbeProbes.test.ts` (a closed sign-up refused yet
     created, with a failed listing and a malformed session in the answer; PP-09's link
     created without an id, with a failed listing and an oversized token hash; PP-08 with
     a failed listing and a full registry; and settlement with two users found and a full
     registry, which strands neither) and `providerProbeAuthAdmin.test.ts` (two users
     located with a full registry: both tracked, still reported unresolved).
   - **(R10) The admin core carries its unresolved count, not a fixed one.** When it
     locates more than one user at a failed creation's minted address, its unresolved
     report carries how many of them could not get a receipt (the ledger's capacity), and
     at least one; the run adds that count, not a fixed one. Where a count is unknown (a
     failed listing after an id-less answer, one per such attempt), the minimum, one, is
     counted, which stops every effect. (R11) The count is conservative, not exact: it
     can be one too high, and PP-12 checks only whether anything run-tagged is left,
     without reporting a number ("Reading the evidence", under the run procedure, says
     what Paul can and cannot read from it). Proved in
     `providerProbeProbes.test.ts` (a lost admin creation answer with three users at its
     address and one ledger place left: the record's user delta is exactly three, effects
     stop, PP-11 stops for Paul, and the two users without receipts are never deleted) and
     `providerProbeAuthAdmin.test.ts` (the reported count for three located and one place
     left, at least one otherwise, none for every other code).
   - **(R11) A count above the evidence maximum is never silently written as the
     maximum.** The banked kernel's record holds each count only up to a fixed maximum
     (users and sessions 10, messages and requests 100) and never below zero, and the
     kernel stays unchanged. A count outside those bounds is written as the bound and
     named in the envelope (version 3, `countsBeyondEvidenceBounds`): for example
     `{"record":1,"probeId":"PP-01","field":"userDelta","relation":"more-than","limit":10}`
     says that PP-01 counted more than 10 users, the most the banked evidence format
     holds; the number is not recorded, and like every user count it is conservative (see
     "Reading the evidence"). That record never passes, the evidence step stops for Paul with the code
     `count-beyond-evidence-bounds`, every later effect stays blocked as before, and
     nothing is deleted by a guessed id. Assembly refuses a marker that does not match its
     record. Proved in `providerProbeProbes.test.ts` (eleven users at a lost admin
     creation's address with one ledger place left: the record holds 10, the envelope
     says more than 10, PP-11 stops for Paul and the ten untracked users are never
     deleted; ten users: recorded as 10, with no marker; the bounds checked against the
     kernel itself) and `providerProbeRunEnvelope.test.ts` (each refused marker).
   - **`createRunTaggedUser`** mints its own address: the run tag plus 80 random bits
     at `synthetic.invalid`.
     - It takes a ledger reservation before its call. Cleanup cannot start while a
       reservation is outstanding.
     - It commits the receipt for any user whose id comes back.
     - Only when the server confirms the minted address does that address become a
       run-owned recipient.
     - (R7) After a failed or id-less answer (a thrown request, for example a lost
       response, an error result or an unusable success), it keeps the reservation open,
       and the creation in flight, while the caller's locator lists the users at exactly
       the address it minted for that request. None there: the reservation is released
       and the creation failed. Exactly one: that id is committed and returned as the
       created user. Anything else (no locator, a failed or malformed listing, or more
       than one user): whatever was located is tracked if capacity allows, the
       reservation is released and the creation is reported unresolved, which the probe
       core counts as one untracked user. A creation reconciled this way fails its record
       (PP-01 or PP-06) and is never used as a fixture, but is deleted by its exact id.
       Proved in `providerProbeAuthAdmin.test.ts` (each locator result, the reservation and
       the in-flight state held during the locate, exact-id cleanup) and
       `providerProbeProbes.test.ts` (a lost creation answer for the Explorer fixture).
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
   - **No logging, one writer, one process starter.** No non-test module here logs.
     Only `providerProbeOutputFile.ts` may write a file, and only
     `providerProbeStackObserver.ts` may start a process (the boundary test enforces all
     three). The writer writes only fixed-name files, outside the app root, after a scan;
     the observer's two `docker` commands print only container ids, names, labels, ports
     and running states, never a container's environment.
   - **The retained documents** are two: the impact display (counts, categories,
     versions, the settings digest and its approval digest; no secret) and the evidence
     document (the closed envelope plus kernel-validated records, scanned against the
     run's registry).
   - **Created users** leave the creation operation as an opaque handle plus the
     minted address. Later probes need the address in memory, and it is registered.
     The id behind a handle reaches only the restricted Auth probe core, which never
     returns it.
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
10. **(R6) The running stack is observed before any effect (item 70).** PP-00 first runs
    `providerProbeStackObserver.ts`, before any request to the stack:
    - `docker --host <fixed local endpoint> ps --no-trunc --quiet --filter label=com.supabase.cli.project`,
      then `docker --host <fixed local endpoint> container inspect` with a fixed template
      that prints only each container's id, name, labels, published ports and running
      state (the endpoint is chosen as the R7 points below say). Fixed arguments,
      no shell, a 10-second timeout, a 1 MiB output cap, and only an allowlisted set of
      environment variables (never a `SOLMIND_*` one).
    - Supabase CLI 2.115.0's bundled start code (read as source from the installed npm
      package, never run) labels every container it starts with
      `com.supabase.cli.project` and `com.supabase.cli.workdir`, and names its API
      gateway `supabase_kong_<project id>` and its Auth server
      `supabase_auth_<project id>`. The observation is the API port's one publisher (that
      gateway, on 8000/tcp, reachable over loopback), its project label, and its workdir
      label, which the running Auth container and every other container of the project
      must share.
    - Every read is parsed fail-closed. PP-00 stops with no effect and the code
      "environment-unobserved" (R8: every cause listed) when, before docker runs, the
      environment names a DOCKER_HOST that is not a fixed local endpoint or a
      DOCKER_CONTEXT other than `default`; or when docker cannot be read (not installed,
      not running, a timeout); or when its output does not have exactly the expected
      shape, no labelled stack is found, or the observation is refused (for example, an
      API port published only on an empty or unreachable host IP). If the workdir,
      project id or API URL differs from this checkout and the kernel, it stops with
      "environment-mismatch". Either way no request reaches the stack and no display is
      written.
    - **(R7) A local Docker engine only.** Both commands are pinned with
      `docker --host <engine>`, which the docker CLI uses instead of any context, so a
      saved current context or a DOCKER_CONFIG cannot redirect them. The engine is a fixed
      local endpoint: on Windows the named pipe `npipe:////./pipe/dockerDesktopLinuxEngine`
      (Docker Desktop's Linux engine, the endpoint of its `desktop-linux` context) by
      default, or `npipe:////./pipe/docker_engine`; elsewhere `unix:///var/run/docker.sock`.
      A `\\.\pipe\` name is on this machine by construction. DOCKER_HOST, DOCKER_CONTEXT,
      DOCKER_CONFIG, DOCKER_CERT_PATH and DOCKER_TLS_VERIFY never reach the child.
    - **(R7) Checked before docker runs, from the environment alone.** A DOCKER_HOST that
      is not one of those fixed local endpoints (a `tcp://` or `ssh://` address, another
      machine's pipe, another socket), or a DOCKER_CONTEXT other than `default`, is
      refused before any process starts, and so before any Auth request: a named context
      could point anywhere, and deciding where would mean reading its metadata. PP-00
      then stops with "environment-unobserved". A DOCKER_HOST equal to a fixed local
      endpoint is used as the pinned engine.
    - **(R7) The same loopback target.** The publisher's binding must be one a request to
      the kernel's own loopback origin reaches, per address family: for `127.0.0.1`, a
      host IP of `0.0.0.0` or `127.0.0.1`; for `[::1]`, `::` or `::1`. (R8) An empty host
      IP is refused as undecidable: the two reads cannot establish which address, or
      address family, it binds, and establishing it would need another read of Docker's
      settings that this observer does not make. The published bindings
      (`NetworkSettings.Ports`) are expected to carry the resolved address; an empty one is
      how a requested binding is written. UNVERIFIED until the preview: if Docker reports
      an empty host IP there, PP-00 stops with no effect. The
      engine is local, so that binding is on this machine and the observed API URL is the
      kernel's origin. Two things stay outside this proof: that the stack was started on
      the pinned engine (if it was not, no labelled container is found and PP-00 stops),
      and that no other local process also listens on the port (PP-00 separately checks
      that an Auth API answers there).
    - UNVERIFIED until the preview runs: Docker was not running while R6 and R7 were
      written, so no real output was captured (nothing was started to capture it). Unit
      tests use fixture outputs in Docker's documented formats.
    - Proved in `providerProbeStackObserver.test.ts` (parsing, each refusal, the exact
      commands with `--host`, options and child variables, the engine decision for each
      environment, each address family, with `execFile` replaced by a spy in every test),
      `providerProbeProbes.test.ts` (each stop, with no request at all) and
      `providerProbeSuiteGate.test.ts` (PP-00 on a real preview session, the production
      wiring, stops as unobserved or mismatched with `execFile` replaced by a spy and the
      network blocked; (R7) a remote DOCKER_HOST, another machine's pipe, an `ssh://` host
      or a non-default DOCKER_CONTEXT stops it with no process started and no request;
      (R8) an API port published only on an empty host IP stops it with no request, while
      the same stack on `0.0.0.0` passes the observation).
11. **(R6) The output writer re-checks the live gate immediately before each create.**
    The environment, the run id and the phase are required inputs. Immediately before
    the exclusive create, with nothing asynchronous in between, the writer re-reads both
    kernel interlocks from the live environment, requires the run's own id and the
    file's own phase (the display in "preview", the evidence in "run"), and compares the
    real (canonical) locations of the directory and the app root, links and junctions
    followed, so a linked directory into the app root is refused. Proved in
    `providerProbeOutputFile.test.ts` (each gate removed before the write and during the
    last step before it, for both files; a linked directory emulated by a spy on
    `realpathSync`, because a real link into the app root would be created and deleted on
    every test run), `providerProbeProbes.test.ts` (an interlock removed during the
    preview's last read, and during PP-12's last read, refuses the write) and
    `providerProbeSuiteGate.test.ts` (the production session's writer re-reads the very
    environment object it was given).
12. **(R6) Request allowances and deadlines.** Each evidence record may make at most 100
    requests (the kernel's own bound): the run refuses the 101st before the transport, so
    it sends nothing. Cleanup (PP-11) has no allowance; its request count is bounded by
    the ledger instead. Every step's test timeout is derived from its worst case: its
    waits, plus its request bound times the transport's 10-second whole-exchange timeout,
    plus (PP-00) the observer's two 10-second commands, plus 10 seconds. The afterAll
    safety net's timeout is the longest step plus PP-11, PP-12 and the evidence. These
    are ceilings for a stack that answers every request at the last moment (hours, for
    the safety net); a normal run takes about a minute. Proved in
    `providerProbeProbes.test.ts` (the formula, a record that exhausts its allowance
    followed by a complete cleanup through the safety net, and a request that hangs
    past the transport's timeout followed by a complete cleanup) and
    `providerProbeRun.test.ts` (refused requests send nothing).

The interlocks are technical gates written in source. They never stand in for Paul's
approval.

## The probe bodies (R5)

`providerProbeProbeCore.ts` holds PP-00 to PP-12 as the July matrix and item 70 define
them, adjusted by Paul's decision D (2026-10-01): exact-ID cleanup of only what the run
created; a 60-second lifetime margin; no separate locked-down settings copy, but the
checks of Supabase's own magic-link and email-code sign-in for existing accounts kept,
with the public sign-up surface; a stop for Paul when any test user cannot be cleaned up
after three tries; test users at run-minted addresses.

| Step | What it does | Pass means |
| --- | --- | --- |
| PP-00 | (R6) First observes the running stack (point 10), before any request to it. Then checks the CLI version (2.115.0, as the operator states it), the profile (current settings), the margin (60), Auth health at the kernel's URL, the checkout's project id, the settings digest and `jwt_expiry`, what the settings file configures for anonymous and phone sign-up (configured, not observed), the SDK versions, and that no user or message carries the run id yet. Writes the impact display (preview), or requires its approval digest (run). | The stack's workdir, project id and API URL match, and every check held. A refusal makes no effect at all. |
| PP-01 | Creates the Explorer fixture at a minted address (admin API, confirmed, no credential). | One user, that exact address, not anonymous, no phone, found once in the user list. (R7) A creation whose answer was lost, failed or carried no id, then located at its minted address, fails, is deleted by its exact id and is not used as the fixture; one that cannot be located stops every further effect. |
| PP-02 | `admin.generateLink({ type: "magiclink" })` for the fixture. | Same user id, exactly the five expected property names, type `magiclink`, a token hash present, and no message. |
| PP-03 | `verifyOtp({ token_hash, type: "email" })`, then `getUser` with the new session, then the same hash again. | The exchange succeeds without an error (R7), the session and `getUser` belong to the fixture, and the second use is refused as expired or invalid: (R7) a confirmed refusal, a 400 or 403 with `otp_expired`, and no session in the answer. A transport or other failure is not a refusal. |
| PP-04 | PP-05 merged: the public surface under the current settings (six records, below). | (R7) Each sign-up attempt confirmed as refused for that surface: a refusal status and a code from that surface's own set (table below), with no session in the answer and no new user, session or message; the email code for a missing address confirmed as refused, or accepted without an error, with no user, session or message; the disabled provider refused by GoTrue's own answer, a 400 `validation_failed` whose message says the provider is not enabled (matched in memory; only a boolean leaves), without a redirect; each existing-account email sign-in (code, then link) answered by exactly one message whose credential signs that same account in, without an error. A refused existing-account sign-in is a failure (`provider-denied` only when the refusal is confirmed), never a pass. |
| PP-06 | A credential fixture signs in; a wrong credential and an unknown address are then tried. | The sign-in succeeds without an error (R7) and the session is the fixture's; both failures look the same (`invalid_credentials`). (R7) The creation is reconciled as in PP-01. |
| PP-07 | (R6) A pre-bridge provider-id rule check: the credential fixture signs in while the bound id is the Explorer's, and the bridge's rule is applied locally. It does not call the bridge, a later slice. | The sign-in succeeds without an error (R7), and the rule denies: the session is not the bound user's. A deny test through the real bridge seam is still owed before any bridge assurance is claimed. |
| PP-08 | Two concurrent admin creates for one minted address, then a listing. | (R6) Exactly one success and one duplicate refusal, (R7) confirmed: a 400, 409 or 422 with `email_exists` or `user_already_exists`; and exactly one user exists and is tracked. |
| PP-09 | `generateLink` for a minted address that has no user. | Recorded either way GoTrue answers, (R7) and only on one of two exclusive answers: a success with exactly one created user, tracked (and deleted; its link is never used), or a confirmed refusal (404 `user_not_found`) with no user created or unresolved. A refusal that created a user, a success that created none or two, a transport or any other failure fails. |
| PP-10 | Lifetime from the PP-03 and PP-06 sessions. | Fields agree within 2 s (5 s against receipt time), the server still recognizes the newest session, and usable = min(measured, configured) - 60 is 1 to 3600 seconds. |
| PP-06 rate | Up to 40 wrong-credential sign-ins, after every other sign-in. | A 429 arrives within the bound, and every earlier failure was `invalid_credentials`. |
| PP-11 | Signs out every held session, tracks any late message, then deletes by exact id: one round and at most two retries. | Nothing is left. Otherwise the run stops for Paul. |
| PP-12 | Lists users and messages again (reads only). | No user and no message carries the run id, and nothing untracked was ever seen. (R11) It records whether anything is left, not how many. |

Deferred, because the kernel's closed probe-id set has no id for them: session renewal
(refresh rotation and reuse) and email change. The integration file lists both as to-do.

(R7) What counts as a confirmed refusal, per attempted surface (`PROVIDER_PROBE_REFUSALS`
in `providerProbeAuthProbeCore.ts`). The status decides first: no answer (status 0) is a
transport failure and a server error is unexpected, whatever code comes with it. A code
that only another surface refuses with, an unrelated `validation_failed`, a gateway
answer without a GoTrue code, or any answer that carries a session is never a confirmed
refusal. The whole table is UNVERIFIED against the GoTrue that Supabase CLI 2.115.0
starts; a wrong guess fails the record, never passes it.

| Surface | Refusal statuses | Codes |
| --- | --- | --- |
| Email and credential sign-up | 400, 403, 422 | `signup_disabled`, `email_provider_disabled` |
| Email-code sign-up allowing creation | 400, 403, 422 | `signup_disabled`, `otp_disabled`, `email_provider_disabled` |
| Email code for a missing address | 400, 403, 422 | `otp_disabled`, `signup_disabled`, `email_provider_disabled` |
| Existing-account email send | 400, 403, 422 | `email_provider_disabled`, `otp_disabled` |
| PP-03 replay | 400, 403 | `otp_expired` |
| PP-08 duplicate create | 400, 409, 422 | `email_exists`, `user_already_exists` |
| PP-09 missing-user link | 404 | `user_not_found` |
| Disabled provider (authorize) | 400 | `validation_failed`, with a message matching "provider is not enabled" |

Proved in `providerProbeProbes.test.ts` ("R7: confirms a refusal only with a refusal status
and a code of the surface attempted", and the closed sign-up surface failing on a code
from another surface, a policy code with a server-error status, an unrelated
`validation_failed`, and status zero with a policy code; the disabled provider failing on
an unrelated `validation_failed`).

What is held where:

- **Secrets.** Every token, token hash, action link, mail link, generated credential,
  key, created user id and message id is registered in the run's known-value registry
  the moment it arrives, and stays inside the restricted cores. Sessions and links are
  opaque handles. (R6) A session whose access or refresh token cannot be registered
  (shorter than the registry's 8-character minimum, or longer than its maximum) is
  refused as malformed and never held. The 6-digit email code is shorter than the
  registry's minimum, so the closed evidence schema is its only protection; it is the
  one value read that is not registered.
- **(R7) Sessions in error answers.** An answer that carries a session is held whatever
  its error: its credentials are registered at once and it is signed out in PP-11. An
  error answer that also carries a session is contradictory and never passes (a closed
  surface, PP-03's exchange and replay, the existing-account exchanges, PP-06 and PP-07
  all need a clean success or a confirmed refusal). (R8) The existing-account email send
  is inspected the same way: a session in its answer is registered, held and signed out,
  and a send that carries one fails its record, refused or not. The real auth-js drops
  the body of an error answer, so the run core has a test seam that wraps the public
  client; production passes none. Proved in `providerProbeProbes.test.ts` (a closed
  sign-up refusal with a session, PP-03's replay refusal with a session, PP-03's exchange
  answered with an error and a session, and (R8) the existing-account send answered with
  an error and a session, or cleanly with a session: each record fails, and each such
  session is registered and signed out exactly once).
- **Not tried (R6).** Anonymous sign-in and phone sign-up are no longer attempted: neither
  request has a minted address, so a user it created could not be attributed or cleaned
  up. The run records only what this checkout's `supabase/config.toml` configures for
  them (`[auth] enable_anonymous_sign_ins` and `[auth.sms] enable_signup`), as
  "configured, not observed", in the impact display and in the evidence envelope's
  `configuredNotObserved` field. Item 70's anon-key attack-surface check of those two
  surfaces therefore stays owed. Whether a later run should try them, with an
  attribution and cleanup design, is a decision for Paul.
- **Cookies.** None reach probe code: the transport drops every Set-Cookie header, and
  no client has a cookie jar. `cookieWriteCount` is therefore always 0.
- **Other users.** A user listing returns other local users too. Their ids and addresses
  are compared in memory and dropped; only a user at an address this run minted for the
  creating request is ever adopted for deletion.

## The evidence records

One document, `provider-probe-evidence-<run id>.json`: the closed envelope (R6:
`configuredNotObserved`; R11: version 3, with `countsBeyondEvidenceBounds`, see "Reading
the evidence" under the run procedure) plus up to 32 kernel-validated records, scanned
against the run's registry before it is written. Each record is finalized after cleanup, so its
cleanup field is a fact. The records always appear in this order (a step that cannot run
is recorded as `blocked`; when the safety net finishes a run, each unreached step is one
`blocked` record):

| # | Probe id | Record |
| --- | --- | --- |
| 1 | PP-00 | preflight, after the observed stack matched |
| 2 | PP-01 | Explorer fixture |
| 3 | PP-02 | generate-only link |
| 4 | PP-03 | exchange, getUser, replay |
| 5 | PP-04 | email and credential sign-up (minted address) |
| 6 | PP-04 | email-code sign-up allowing creation (minted address) |
| 7 | PP-04 | email code for a missing address without creation |
| 8 | PP-04 | disabled provider (Apple) authorize |
| 9 | PP-04 | existing account: email code sign-in |
| 10 | PP-04 | existing account: magic link sign-in |
| 11 | PP-06 | credential sign-in |
| 12 | PP-06 | failure opacity |
| 13 | PP-07 | pre-bridge provider-id rule check (a local comparison; not the bridge) |
| 14 | PP-08 | duplicate create |
| 15 | PP-09 | generateLink for a missing user |
| 16 | PP-10 | usable session length (`providerLifetimeSeconds`) |
| 17 | PP-06 | rate behaviour |
| 18 | PP-11 | cleanup |
| 19 | PP-12 | final proof |

(R6: the R5 records for anonymous sign-in and phone sign-up are gone; what the settings
file configures for them is in the envelope, labelled configured, not observed.)

## The run procedure (for Paul's approval)

The run is Paul's to approve and watch. Nothing below runs as part of any ordinary test
or build: without both interlocks the integration file only shows its gate test.

**What a run creates and deletes.** (R6) Each count is shown three ways, separately: what
is expected, the most the plan allows, and the capacity the run enforces.

- **Local Auth users:** expected 3 to 4: the Explorer fixture, the credential fixture
  and one duplicate-create user, plus the missing-address link user only if the server
  creates it. At most 8 planned, if every check found an unexpected result (a second
  duplicate create, and a user at each of the three sign-up attempts' minted
  addresses). The run tracks at most 10 (the ledger's capacity, enforced); a user it
  finds but cannot track stops every further effect. Every user is created at an address
  this run minted for it (PP-08's two concurrent creates share one, by design); none is
  created without one.
- **In-memory sessions:** expected 3 to 5: PP-03, PP-06 and PP-07, plus the two
  existing-account sign-ins if they work. At most 10 planned (PP-03's replay, the
  credential sign-up, the wrong and unknown sign-ins and the rate check too). At most 10
  can be held (enforced).
- **Local test messages:** expected 0 to 2: the existing-account code and link, if those
  sign-ins work. At most 7 planned (PP-02's and PP-09's links and the three sign-up
  attempts too). The run tracks at most 100 (the ledger's capacity, enforced); that is a
  capacity, not a plan. A run-tagged message it cannot attribute stops every further
  effect.
- **Not tried:** anonymous sign-in and phone sign-up (configured, not observed; see
  "What is held where").
- **What is deleted:** only what the run created and tracked, by exact id, after signing
  out every held session (local scope; sign-out does not revoke an access JWT already
  issued, which stays in memory only).
- **One-time sign-in links and codes:** the server issues them only for addresses this
  run minted (PP-02, PP-09 and the two existing-account messages); each is used at most
  once, and the rest expire.
- **What the rate check costs:** up to 40 wrong-credential sign-ins. Local sign-ins from
  this machine may then be throttled for about 5 minutes.
- **Requests:** at most 100 per evidence record (enforced); cleanup is not limited.

**How it stops.**

- **Before any effect:** a running stack that cannot be observed or does not match
  ("environment-unobserved" or "environment-mismatch", before any request to it), any
  other refused PP-00 check, or a display whose digest is not the approved one. (R6b) A
  run id the output scanner would refuse (a word such as `token` or `secret`, or 32
  hexadecimal digits in a row) is refused before any request, as "preflight-refused";
  the run id the procedure generates (`P28-<date>-pp-run-<6 digits>`) always passes.
- **During the run:** a user or message the run cannot attribute stops every further
  effect; cleanup still runs. (R7) This includes a creation whose answer was lost, failed
  or carried no id when the listing that would locate it then fails: the run counts one
  unresolved user, value-free, and stops for Paul after cleanup.
- **After cleanup:** residue after the third try stops the run for Paul. Nothing more is
  attempted; the evidence still records it (`cleanup-failed`), and Paul decides what
  happens next.
- **At the evidence (R11):** a count above the evidence maximum stops the run for Paul
  (`count-beyond-evidence-bounds`); the evidence is still written, with the marker.
- **At any point:** removing an interlock refuses every request and deletion that has
  not begun writing.

**The commands.** These run in PowerShell in `C:\_Apollo\Projects\Solmind\solmind-app`,
on the approved commit, with Docker Desktop and the local stack already started from that
folder (PP-00 reads the stack's container labels with `docker`, pinned to the local
engine; it starts nothing). (R7) DOCKER_HOST must be unset (or name a local engine
endpoint, point 10) and DOCKER_CONTEXT unset or `default`; otherwise PP-00 stops with
"environment-unobserved" before running docker. Set `$outDir` first to an existing
evidence folder outside `solmind-app`.

```powershell
cls
$outDir = "<an existing evidence folder outside solmind-app>"
Set-Location C:\_Apollo\Projects\Solmind\solmind-app
git status --short --untracked-files=no   # the operator's tracked-file check: must print nothing
npx supabase --version                     # must print 2.115.0

# The keys, read without printing them (never copy this output anywhere). The field
# names are UNVERIFIED for CLI 2.115.0: stop if either key is missing or API_URL is not
# http://127.0.0.1:54321.
$status = npx supabase status -o env
$apiUrl = ($status | Select-String '^API_URL="(.+)"$').Matches.Groups[1].Value
$anon = ($status | Select-String '^ANON_KEY="(.+)"$').Matches.Groups[1].Value
$service = ($status | Select-String '^SERVICE_ROLE_KEY="(.+)"$').Matches.Groups[1].Value
if ($apiUrl -ne "http://127.0.0.1:54321" -or -not $anon -or -not $service) { throw "stop: unexpected status output" }

$runId = "P28-$(Get-Date -Format yyyyMMdd)-pp-run-$(Get-Random -Minimum 100000 -Maximum 999999)"
$env:SOLMIND_PROVIDER_PROBE_APPROVAL = "approved-local-synthetic-auth-probe"
$env:SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS = "approved-exact-id-local-auth-cleanup"
$env:SOLMIND_PROVIDER_PROBE_RUN_ID = $runId
$env:SOLMIND_PROVIDER_PROBE_PROFILE = "current-config"
$env:SOLMIND_LOCAL_SUPABASE_URL = "http://127.0.0.1:54321"
$env:SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL = "probe+$($runId.ToLower())@synthetic.invalid"
$env:SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS = "60"
$env:SOLMIND_PROVIDER_PROBE_CLI_VERSION = "2.115.0"
$env:SOLMIND_PROVIDER_PROBE_OUTPUT_DIR = $outDir
$env:SOLMIND_PROVIDER_PROBE_ANON_KEY = $anon
$env:SOLMIND_PROVIDER_PROBE_SERVICE_ROLE_KEY = $service
Remove-Variable status, anon, service

# Phase 1, preview: PP-00 only. It reads, makes no effect, and writes the display.
# Both interlocks are set because the transport checks them on every request, reads too.
# If PP-00 fails with code environment-unobserved, nothing was sent to the stack; stop and
# report. Its causes (R8: all of them; safety model point 10): before docker runs, a
# DOCKER_HOST that is not a fixed local endpoint or a DOCKER_CONTEXT other than default
# in this shell; then docker not readable (not installed, not running, a timeout); or its
# output not in the expected form (UNVERIFIED until now), no labelled stack found, or the
# observation refused (for example, the API port published only on an empty host IP).
$env:SOLMIND_PROVIDER_PROBE_PHASE = "preview"
npm run test -- tests/provider-probe/supabaseAuthProviderProbe.local.integration.test.ts --reporter=verbose
# The display was scanned before it was written, so it is safe to copy.
Get-Content (Join-Path $outDir "provider-probe-impact-$runId.txt") | Tee-Object -Variable display
$display | Set-Clipboard

```

Paul reads the display: the observed stack (workdir, project and API URL), what is
configured but not observed, the versions, the counts (expected, planned and enforced),
and the last line, `Approval digest: sha256:...`. (R6b) The workdir is shown as "this
checkout's pinned app root", never as a path: a folder name can look like a value the
output scanner refuses, and the display and its digest must not depend on where the
checkout lives. The path itself was compared with the stack's label. He approves in chat,
naming the run id and that digest. Only then:

```powershell
cls
# Phase 2, run: PP-00 again (refused unless the display is unchanged), then every step.
$env:SOLMIND_PROVIDER_PROBE_PHASE = "run"
$env:SOLMIND_PROVIDER_PROBE_APPROVED_IMPACT = "sha256:<the digest Paul approved>"
npm run test -- tests/provider-probe/supabaseAuthProviderProbe.local.integration.test.ts --reporter=verbose

# Afterwards, whatever the outcome:
Get-ChildItem Env:SOLMIND_PROVIDER_PROBE_* | ForEach-Object { Remove-Item "Env:$($_.Name)" }
Remove-Item Env:SOLMIND_LOCAL_SUPABASE_URL
# The operator's tracked-file check (not part of PP-12, which checks only the local Auth
# users and the Mailpit messages for residue). It does not look at untracked files.
git status --short --untracked-files=no   # must print nothing
# The evidence was scanned against the run's registry before it was written.
Get-Content (Join-Path $outDir "provider-probe-evidence-$runId.json") | Tee-Object -Variable evidence
$evidence | Set-Clipboard

```

**Reading the evidence (R11, re-check #128f).** Three things decide what the counts in
the evidence can tell Paul.

- **The user counts are conservative, not exact.** A record's `userDelta` is the users
  the run tracked during it plus every unresolved user: a creation the run could not
  attribute. Each unresolved creation counts at least one. When the listing after an
  id-less answer fails, it counts one per attempt, and the true number may be higher, or
  none. When an admin creation's answer was lost or failed and its minted address shows
  more than one user, it counts the users that could not be tracked, and at least one:
  so when every located user was tracked (and will be deleted by its id), the count is
  one more than can exist untracked (a possible one-user overcount).
- **The over-maximum marker.** A record holds at most 10 users, 10 sessions, 100
  messages and 100 requests. A higher count is written as that maximum, and the
  envelope's `countsBeyondEvidenceBounds` names it: `"relation": "more-than"` with
  `"limit": 10` means the run counted more than 10, the most the banked evidence format
  holds; the number itself is not recorded. Like every user count, it is conservative:
  ten users after a lost admin creation, all of them tracked, count as eleven (by the
  at-least-one rule above) and are marked. (`"less-than"` with `"limit": 0` marks a count
  that came out below zero, written as 0.) A marked record never passes, and the evidence step's
  summary shows `count-beyond-evidence-bounds` and stops for Paul. Every other step's code
  is the run's first stop; the evidence step's names this marker even when an earlier stop
  (such as `untracked-effect`) had already halted every effect. An empty list means no
  count was outside the bounds.
- **What PP-11 and PP-12 show.** Any unresolved user counted, including the possible
  overcount when no such user exists, makes PP-11 stop for Paul and PP-12 fail
  (`cleanup-failed`). Their `userDelta`, `sessionDelta` and `messageDelta` are zero by
  design: they describe cleanup, not effects; their `requestCount` still counts the
  requests they made. PP-12 checks for residue, whether the run-tagged user and message
  counts are zero and no unresolved user was counted, without reporting the number: a
  failed PP-12 does not say how many are left, or whether a counted unresolved user
  exists at all.
  A creation that completed but was omitted by both listings (the one after it and
  PP-12's) stays undetectable: neither the counts nor PP-12 can show it.

Each step shows as one test, with a timeout derived from that step's own worst case
(safety model point 12), and the steps run one at a time inside the session: a step
that is still working when its test gives up delays the next step instead of
overlapping it, and the safety net's timeout covers that step, cleanup, the final proof
and the evidence. A failing step is a finding, not a crash: the next steps still run,
cleanup always runs, and once the run has started the evidence is written unless its
own scan or the writer's live gate refuses it (then nothing is written and the step
fails). If PP-11 reports a
stop, Paul decides what happens to the residue; nothing in this folder deletes anything
else.

## What cannot be checked without a live stack

The unit tests prove the decision logic, the evidence shapes, the failure paths and the
cleanup stop against an in-process fake. These are assumptions that only a supervised
run can confirm; each is parsed fail-closed, so a wrong assumption shows as a failed or
blocked step, never as a pass:

- (R6) The observer's formats: the container labels and names Supabase CLI 2.115.0's
  bundled source applies (`com.supabase.cli.project`, `com.supabase.cli.workdir`,
  `supabase_kong_<project id>`, `supabase_auth_<project id>`), the form in which it
  labels the workdir (a resolved Windows path is expected), and the output of the two
  `docker` commands. Docker was not running while R6 and R7 were written, so none of
  these was captured; a preview that cannot parse them stops with
  "environment-unobserved", with no effect and no request to the stack. (R7) The observer
  reads only the pinned local engine, by default Docker Desktop's Linux engine pipe; on
  this machine the docker CLI's saved current context is `desktop-linux`, whose endpoint
  is that pipe (read on 2026-10-01 from the saved context's metadata, endpoint only; no
  docker command was run). That the stack runs on that engine is confirmed only by the
  preview finding its containers; that no other local process listens on the API port
  is not proved, and PP-00's Auth health answer is checked separately.
- The key names in `supabase status -o env` for CLI 2.115.0, and whether it issues JWT
  keys or newer `sb_` keys (which may not be accepted as a Bearer value).
- Kong's handling of `/auth/v1/health` and `/auth/v1/authorize` (the requests carry the
  public key either way).
- Mailpit's list, message and delete endpoints and their field names, and GoTrue's local
  magic-link template (a `/auth/v1/verify?token=...` link and a 6-digit code).
- Mail timing. A message is counted once a 1.5-second settle wait has passed (or after up
  to 10 polls of 0.5 seconds when one is expected). A message that arrives later is
  counted in a later record's deltas; PP-11 still tracks it for cleanup and PP-12 still
  checks for it.
- GoTrue's refusal statuses and codes for each surface (R7: the per-surface table under
  "The probe bodies"), the disabled provider's message ("Unsupported provider: provider
  is not enabled" is expected), whether `email_sent = 2` applies without custom SMTP, and
  the exact local rate limits. A surface that answers with any other status, code or
  message fails, so a wrong guess is a failed record, never a pass.
- (R7) Whether the real auth-js ever returns a session with an error: it drops the body
  of an error answer, so the contradictory-answer tests reach the probe core through the
  run core's public-client test seam, not over the wire.
- PP-07 against the real bridge seam (the bridge is a later slice): R6 labels PP-07 a
  pre-bridge provider-id rule check, and a deny test through the real seam is owed
  before any bridge assurance is claimed. Also PP-11's check that SolMind still denies
  without a cookie (the harness never calls a `solmind_*` function), a live cleanup
  transport failure, and git status from inside the process (the procedure checks it).
- (R6) Item 70's anon-key attack-surface check of anonymous sign-in and phone sign-up:
  not run, because neither attempt can be attributed or cleaned up. Only the configured
  settings are recorded; whether to design and run that check is Paul's decision.

## What this revision does not do

- It does not run the probes. The run stays gated, skipped by default, and Paul's.
- (R6) It does not start Docker or the stack, and runs no Supabase CLI command; the
  observer only reads, and only inside PP-00 of a gated session.
- It does not change the kernel.
  - Session-renewal and email-change probes would need new probe IDs, which the kernel's
    closed ID set rejects today.
  - The kernel's own UUID rule covers versions 1-5 only; this harness's scanner adds the
    stricter check.

  Both kernel points are open.
- It does not make the boundary analyzer more than syntactic.
  - It judges names, not values. A probe-body file could still reach the `Function`
    constructor reflectively, through any function's `.constructor`, and generate code
    that loads a module. The rule refuses every direct route it names; this
    reflective one stays a known limit.
  - The run core's supabase-js clients also carry a Realtime client, which would use the
    global `WebSocket`. It is unreachable, because no client leaves the run core and the
    run never subscribes to a channel.
- The July probe matrix
  (`solmind-docs/archive/audits/SolMind_Supabase_Auth_Provider_Probe_Architecture_Review_2026-07-16.md`)
  is history, not authority; item 70, contract 21 section 7.9 and decision D govern.
