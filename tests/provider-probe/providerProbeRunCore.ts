// RESTRICTED test-only run core for the future local Supabase Auth provider probes.
// It accepts transports, so only the production composition root
// (`providerProbeRun.ts`, which passes the gated, fixed-target production fetches) and
// named unit tests (through `providerProbeTestSupport.ts`, over in-process test
// servers) may import it; `providerProbeModuleBoundary.test.ts` enforces that. Tests
// therefore exercise exactly the composition and deleter code production runs.
//
// The run owns one cleanup ledger, one known-value registry and one run-owned
// recipient record, none of which it exposes. Its public surface has no way to record
// an identifier, issue a receipt or supply a deleter:
//
// - `createAuthAdmin(serviceRoleKey)` registers the key and builds a supabase-js client
//   over the Auth transport; its one operation creates a run-tagged user with a minted
//   address, and records that user's receipt in this run's ledger.
// - `createMailpitInventory()` reads the mail catcher over the Mailpit transport; it
//   records receipts only for messages to run-owned recipients.
// - `cleanup()` and `retryCleanup()` delete only through the two fixed deleters below,
//   and the ledger re-checks both kernel interlocks immediately before each deletion:
//   - Auth: `auth.admin.deleteUser(id)` on the run's own admin client, which can only
//     reach the Auth transport;
//   - Mailpit: `DELETE /api/v1/messages` with the JSON body `{"IDs":["<id>"]}` for
//     exactly one validated id per call. An empty or invalid id is refused before any
//     byte is sent, because Mailpit deletes every message when the list is empty.
//     (UNVERIFIED against the Mailpit that Supabase CLI 2.115.0 starts.)
// - `assembleOutput` always uses this run's registry.
// - `createAuthProbe({ anonKey, serviceRoleKey })` (R5) registers both keys and builds
//   the probe operations of `providerProbeAuthProbeCore.ts` over the same Auth transport:
//   fresh non-persisting public clients, the run's admin client, the mail reader, and
//   three fixed GET requests (Auth health, the disabled-provider authorize path, and one
//   page of the local user list). No caller can supply a path.
// - `requestCount()` counts every request either transport was asked to make, so each
//   probe's evidence can carry its request count.
// - (R6) `limitRequests(maximum)` sets a request allowance: after `maximum` further
//   requests, every request either transport is asked to make is refused before the
//   transport sees it (zero bytes, not counted), until the allowance is set again;
//   `limitRequests(null)` removes it. The probe core gives each record the kernel's
//   100-request bound, so every step's request count, and with the transport's
//   per-request timeout its worst-case duration, is bounded; cleanup runs with none.

import { createClient } from "@supabase/supabase-js";

import {
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createAuthAdminOperations,
  type ProviderProbeAuthAdmin,
  type ProviderProbeRandomSource,
} from "./providerProbeAuthAdminCore";
import {
  createAuthProbeOperations,
  PROVIDER_PROBE_AUTH_LIMITS,
  type ProviderProbeAdminProbeClient,
  type ProviderProbeAuthProbe,
  type ProviderProbePublicClient,
  type ProviderProbeRawAuthAnswer,
  type ProviderProbeRawAuthRequest,
} from "./providerProbeAuthProbeCore";
import {
  createProviderProbeCleanupLedger,
  type ProviderProbeCleanupReport,
} from "./providerProbeCleanupLedger";
import { createRunOwnedRecipients, isValidCleanupId } from "./providerProbeCleanupReceipts";
import {
  createMailpitInventoryOperations,
  createMailpitMessageReader,
  MAILPIT_API_PATH_PREFIX,
  type MailpitFetch,
  type ProviderProbeMailpitInventory,
} from "./providerProbeMailpitClient";
import {
  assembleProviderProbeRunOutput,
  createProviderProbeKnownValueRegistry,
  type ProviderProbeRunEnvelope,
} from "./providerProbeRunEnvelope";

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;
type TransportFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ProviderProbeTransport = Readonly<{ origin: string; fetch: TransportFetch }>;

// The narrow slice of a supabase-js admin client the Auth deleter uses.
export type ProviderProbeAuthDeleteClient = Readonly<{
  auth: Readonly<{ admin: Readonly<{ deleteUser(id: string): Promise<unknown> }> }>;
}>;

export type ProviderProbeRun = Readonly<{
  config: ProviderProbeSafetyConfig;
  registerKnownValue(value: string): void;
  knownValueCount(): number;
  requestCount(): number;
  limitRequests(maximum: number | null): void;
  createAuthAdmin(serviceRoleKey: string): ProviderProbeAuthAdmin;
  createAuthProbe(keys: Readonly<{ anonKey: string; serviceRoleKey: string }>): ProviderProbeAuthProbe;
  createMailpitInventory(): ProviderProbeMailpitInventory;
  cleanup(): Promise<ProviderProbeCleanupReport>;
  retryCleanup(): Promise<ProviderProbeCleanupReport>;
  cleanupCounts(): Readonly<{ authUsers: number; mailpitMessages: number }>;
  residueCounts(): Readonly<{ authUsers: number; mailpitMessages: number }>;
  assembleOutput(input: Readonly<{ envelope: ProviderProbeRunEnvelope; evidence: readonly unknown[] }>): string;
}>;

function fail(code: string): never {
  throw new Error(code);
}

export function createAuthUserDeleter(client: ProviderProbeAuthDeleteClient): (id: string) => Promise<void> {
  const admin = client?.auth?.admin;
  const deleteUser = admin?.deleteUser;
  if (typeof deleteUser !== "function") {
    fail("cleanup_deleter_invalid_dependencies");
  }
  return async (id: string) => {
    if (!isValidCleanupId("auth-user", id)) {
      fail("cleanup_delete_invalid_id");
    }
    let result: unknown;
    try {
      result = await deleteUser.call(admin, id);
    } catch {
      fail("cleanup_delete_failed");
    }
    const error = result && typeof result === "object" ? (result as { error?: unknown }).error : "missing";
    if (error !== null && error !== undefined) {
      fail("cleanup_delete_failed");
    }
  };
}

export function createMailpitMessageDeleter(transport: Readonly<{ origin: string; fetch: MailpitFetch }>): (id: string) => Promise<void> {
  const deleteFetch = transport?.fetch;
  if (typeof deleteFetch !== "function" || typeof transport.origin !== "string") {
    fail("cleanup_deleter_invalid_dependencies");
  }
  const url = `${transport.origin}${MAILPIT_API_PATH_PREFIX}messages`;
  return async (id: string) => {
    // Validated before the body exists: never an empty or ambiguous list.
    if (!isValidCleanupId("mailpit-message", id)) {
      fail("cleanup_delete_invalid_id");
    }
    const body = JSON.stringify({ IDs: [id] });
    let response: Response;
    try {
      response = await deleteFetch(url, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body,
      });
    } catch {
      fail("cleanup_delete_failed");
    }
    if (!response.ok) {
      fail("cleanup_delete_failed");
    }
  };
}

function isWellFormedKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 16 && key.length <= 4_096 && !/\s/.test(key);
}

export function createProviderProbeRunCore(
  input: Readonly<{
    environment: ProbeEnvironment;
    auth: ProviderProbeTransport;
    mailpit: ProviderProbeTransport | null;
    random?: ProviderProbeRandomSource;
    // Test seam: milliseconds since the epoch. Production uses Date.now.
    clock?: () => number;
    // R7 test seam: wraps each fresh public client, so a unit test can give the probe core
    // an answer the real auth-js never returns (an error that also carries a session).
    // Production (`providerProbeRun.ts`) passes none, and the client is used as built.
    publicClientWrapper?: (client: ProviderProbePublicClient) => ProviderProbePublicClient;
  }>,
): ProviderProbeRun {
  const { environment } = input;
  // An enabled but malformed configuration throws the kernel's own value-free code.
  const config = readProviderProbeSafetyConfig(environment);
  if (config === null) {
    fail("provider_probe_run_ungated");
  }
  if (!input.auth || typeof input.auth.fetch !== "function" || typeof input.auth.origin !== "string") {
    fail("provider_probe_run_invalid_transport");
  }
  const clock = input.clock ?? (() => Date.now());
  const wrapPublic = input.publicClientWrapper ?? ((client: ProviderProbePublicClient) => client);
  // Every request either transport is asked to make is counted, before it is made. A
  // request beyond the current allowance is refused here, before the transport.
  let requests = 0;
  let allowance: number | null = null;
  const counted = (transport: ProviderProbeTransport): ProviderProbeTransport =>
    Object.freeze({
      origin: transport.origin,
      fetch: (resource: RequestInfo | URL, init?: RequestInit) => {
        if (allowance !== null && requests >= allowance) {
          return Promise.reject(new Error("provider_probe_request_allowance_exhausted"));
        }
        requests += 1;
        return transport.fetch(resource, init);
      },
    });
  const auth = counted(input.auth);
  const mailpit = input.mailpit === null ? null : counted(input.mailpit);
  const ledger = createProviderProbeCleanupLedger(environment);
  const registry = createProviderProbeKnownValueRegistry();
  const ownedRecipients = createRunOwnedRecipients(config.runId);
  registry.register(config.syntheticEmail);
  let adminClient: ProviderProbeAuthDeleteClient | null = null;
  const mailDelete = mailpit === null ? null : createMailpitMessageDeleter(mailpit);

  // The only deleters cleanup ever receives.
  const fixedDeleters = Object.freeze({
    async deleteAuthUser(id: string): Promise<void> {
      if (adminClient === null) {
        fail("cleanup_delete_failed");
      }
      await createAuthUserDeleter(adminClient)(id);
    },
    async deleteMailpitMessage(id: string): Promise<void> {
      if (mailDelete === null) {
        fail("cleanup_delete_failed");
      }
      await mailDelete(id);
    },
  });

  const clientFor = (key: string) =>
    createClient(auth.origin, key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: auth.fetch },
    });

  const adminOperationsFor = (serviceRoleKey: string) => {
    if (!isWellFormedKey(serviceRoleKey)) {
      fail("provider_probe_run_invalid_key");
    }
    registry.register(serviceRoleKey);
    const client = clientFor(serviceRoleKey);
    adminClient = client;
    return {
      client,
      operations: createAuthAdminOperations({
        config,
        client,
        ledger,
        registry,
        ownedRecipients,
        ...(input.random === undefined ? {} : { random: input.random }),
      }),
    };
  };

  return Object.freeze({
    config,
    registerKnownValue: (value: string) => registry.register(value),
    knownValueCount: () => registry.size(),
    requestCount: () => requests,

    limitRequests(maximum: number | null): void {
      if (maximum === null) {
        allowance = null;
        return;
      }
      if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > 1_000) {
        fail("provider_probe_run_invalid_allowance");
      }
      allowance = requests + maximum;
    },

    createAuthAdmin(serviceRoleKey: string): ProviderProbeAuthAdmin {
      return adminOperationsFor(serviceRoleKey).operations;
    },

    createAuthProbe(keys: Readonly<{ anonKey: string; serviceRoleKey: string }>): ProviderProbeAuthProbe {
      const anonKey = keys?.anonKey;
      if (!isWellFormedKey(anonKey)) {
        fail("provider_probe_run_invalid_key");
      }
      if (mailpit === null) {
        fail("mailpit_origin_undecided");
      }
      registry.register(anonKey);
      const admin = adminOperationsFor(keys.serviceRoleKey);
      const serviceRoleKey = keys.serviceRoleKey;
      const reader = createMailpitMessageReader({ config, origin: mailpit.origin, fetch: mailpit.fetch, registry, ownedRecipients });

      // The only raw Auth requests: three fixed GET paths, chosen by kind, never by caller text.
      async function rawRequest(request: ProviderProbeRawAuthRequest): Promise<ProviderProbeRawAuthAnswer> {
        let path: string;
        let key: string;
        if (request?.kind === "health") {
          path = "/auth/v1/health";
          key = anonKey as string;
        } else if (request?.kind === "authorize-disabled-provider") {
          path = `/auth/v1/authorize?provider=${PROVIDER_PROBE_AUTH_LIMITS.disabledProvider}`;
          key = anonKey as string;
        } else if (
          request?.kind === "list-users" &&
          Number.isSafeInteger(request.page) &&
          request.page >= 1 &&
          request.page <= PROVIDER_PROBE_AUTH_LIMITS.maxUserPages
        ) {
          path = `/auth/v1/admin/users?page=${request.page}&per_page=${PROVIDER_PROBE_AUTH_LIMITS.userPageSize}`;
          key = serviceRoleKey;
        } else {
          fail("provider_probe_run_raw_request_refused");
        }
        let response: Response;
        try {
          response = await auth.fetch(`${auth.origin}${path}`, {
            method: "GET",
            headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
          });
        } catch (error) {
          const redirectRefused = error instanceof Error && error.message === "loopback_fetch_redirect_refused";
          return Object.freeze({ status: 0, redirectRefused, transportFailed: !redirectRefused, totalCount: null, json: null });
        }
        const totalHeader = response.headers.get("x-total-count");
        const totalCount = totalHeader !== null && /^[0-9]{1,9}$/.test(totalHeader) ? Number(totalHeader) : null;
        let json: unknown = null;
        if (/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "")) {
          try {
            json = JSON.parse(await response.text()) as unknown;
          } catch {
            json = null;
          }
        }
        return Object.freeze({ status: response.status, redirectRefused: false, transportFailed: false, totalCount, json });
      }

      return createAuthProbeOperations({
        config,
        adminOps: admin.operations,
        adminClient: admin.client as unknown as ProviderProbeAdminProbeClient,
        createPublicClient: () => wrapPublic(clientFor(anonKey as string) as unknown as ProviderProbePublicClient),
        rawRequest,
        readMailCredentials: (address: string) => reader.readNewestUnread(address),
        markMailSeen: (address: string) => reader.markExisting(address),
        ledger,
        registry,
        ownedRecipients,
        nowSeconds: () => Math.floor(clock() / 1000),
        ...(input.random === undefined ? {} : { random: input.random }),
      });
    },

    createMailpitInventory(): ProviderProbeMailpitInventory {
      if (mailpit === null) {
        fail("mailpit_origin_undecided");
      }
      return createMailpitInventoryOperations({
        config,
        origin: mailpit.origin,
        fetch: mailpit.fetch,
        ledger,
        registry,
        ownedRecipients,
      });
    },

    cleanup: () => ledger.runCleanup(fixedDeleters),
    retryCleanup: () => ledger.retryFailedCleanup(fixedDeleters),
    cleanupCounts: () => ledger.recordedCounts(),
    residueCounts: () => ledger.residueCounts(),

    assembleOutput(output: Readonly<{ envelope: ProviderProbeRunEnvelope; evidence: readonly unknown[] }>): string {
      return assembleProviderProbeRunOutput({ envelope: output.envelope, evidence: output.evidence, registry });
    },
  });
}
