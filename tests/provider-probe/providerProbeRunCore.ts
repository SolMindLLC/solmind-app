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
  createProviderProbeCleanupLedger,
  type ProviderProbeCleanupReport,
} from "./providerProbeCleanupLedger";
import { createRunOwnedRecipients, isValidCleanupId } from "./providerProbeCleanupReceipts";
import {
  createMailpitInventoryOperations,
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
  createAuthAdmin(serviceRoleKey: string): ProviderProbeAuthAdmin;
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

export function createProviderProbeRunCore(
  input: Readonly<{
    environment: ProbeEnvironment;
    auth: ProviderProbeTransport;
    mailpit: ProviderProbeTransport | null;
    random?: ProviderProbeRandomSource;
  }>,
): ProviderProbeRun {
  const { environment, auth, mailpit } = input;
  // An enabled but malformed configuration throws the kernel's own value-free code.
  const config = readProviderProbeSafetyConfig(environment);
  if (config === null) {
    fail("provider_probe_run_ungated");
  }
  if (!auth || typeof auth.fetch !== "function" || typeof auth.origin !== "string") {
    fail("provider_probe_run_invalid_transport");
  }
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

  return Object.freeze({
    config,
    registerKnownValue: (value: string) => registry.register(value),
    knownValueCount: () => registry.size(),

    createAuthAdmin(serviceRoleKey: string): ProviderProbeAuthAdmin {
      if (typeof serviceRoleKey !== "string" || serviceRoleKey.length < 16 || /\s/.test(serviceRoleKey)) {
        fail("provider_probe_run_invalid_key");
      }
      registry.register(serviceRoleKey);
      const client = createClient(auth.origin, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
        global: { fetch: auth.fetch },
      });
      adminClient = client;
      return createAuthAdminOperations({
        config,
        client,
        ledger,
        registry,
        ownedRecipients,
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
