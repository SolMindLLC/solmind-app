// TEST-ONLY factories for the provider-probe unit tests. Only the unit-test files
// named in `providerProbeModuleBoundary.test.ts` may import this module; the
// integration file and any other test file may not. It is the only route to the
// injectable seams: arbitrary loopback test targets, a replaceable request function,
// injected Mailpit and Auth transports or clients, injected randomness, run-owned
// recipients added by hand, and receipts issued for arbitrary well-formed ids (the
// last two only for the test files that the boundary test names for them).
// Production code reaches none of them.
//
// The test transport keeps the production gate: every request still needs the
// kernel's two interlocks in the environment passed here (tests pass plainly fake,
// in-memory environments; nothing reads process.env).

import {
  PROVIDER_PROBE_APPROVAL_GATE,
  PROVIDER_PROBE_EFFECT_GATE,
  readProviderProbeSafetyConfig,
  type ProviderProbeSafetyConfig,
} from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import {
  createAuthAdminOperations,
  type ProviderProbeAuthAdmin,
  type ProviderProbeAuthAdminClient,
  type ProviderProbeRandomSource,
} from "./providerProbeAuthAdminCore";
import type { ProviderProbeCleanupLedger } from "./providerProbeCleanupLedger";
import {
  addRunOwnedRecipient,
  createRunOwnedRecipients,
  issueCleanupReceipt,
  type ProviderProbeCleanupKind,
  type ProviderProbeCleanupReceipt,
  type ProviderProbeRunOwnedRecipients,
} from "./providerProbeCleanupReceipts";
import {
  createLoopbackTransport,
  type LoopbackFetch,
  type LoopbackFetchTarget,
  type LoopbackHttpRequestFunction,
} from "./providerProbeLoopbackCore";
import {
  createMailpitInventoryOperations,
  type MailpitFetch,
  type ProviderProbeMailpitInventory,
} from "./providerProbeMailpitClient";
import {
  createProviderProbeSuiteCore,
  type ProviderProbeSuite,
  type ProviderProbeSuiteSeams,
  type ProviderProbeSuiteSettings,
} from "./providerProbeProbeCore";
import { createProviderProbeRunCore, type ProviderProbeRun, type ProviderProbeTransport } from "./providerProbeRunCore";
import type { ProviderProbeKnownValueRegistry } from "./providerProbeRunEnvelope";

type ProbeEnvironment = Readonly<Record<string, string | undefined>>;

// A plainly fake, gated, in-memory environment. The gate strings are the kernel's
// public interlock values, not credentials.
export function gatedTestEnvironment(
  runSuffix: string,
  overrides: Readonly<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  const runId = `P28-20261001-${runSuffix}`;
  return {
    SOLMIND_PROVIDER_PROBE_APPROVAL: PROVIDER_PROBE_APPROVAL_GATE,
    SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: PROVIDER_PROBE_EFFECT_GATE,
    SOLMIND_PROVIDER_PROBE_RUN_ID: runId,
    SOLMIND_PROVIDER_PROBE_PROFILE: "current-config",
    SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:54321",
    SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL: `probe+${runId.toLowerCase()}@synthetic.invalid`,
    SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: "60",
    ...overrides,
  };
}

export function testConfig(environment: ProbeEnvironment): ProviderProbeSafetyConfig {
  const config = readProviderProbeSafetyConfig(environment);
  if (config === null) {
    throw new Error("test environment is not gated");
  }
  return config;
}

// Deterministic "randomness" for tests: the byte sequence start, start+1, ...
export function sequentialRandomForTests(start = 1): ProviderProbeRandomSource {
  let next = start;
  return (size: number) => Uint8Array.from({ length: size }, () => next++ & 0xff);
}

export function createLoopbackFetchForTests(
  input: Readonly<{
    environment: ProbeEnvironment;
    targets: readonly LoopbackFetchTarget[];
    timeoutMilliseconds?: number;
    maxRequestBytes?: number;
    maxResponseBytes?: number;
    request?: LoopbackHttpRequestFunction;
  }>,
): LoopbackFetch {
  return createLoopbackTransport({
    targets: input.targets,
    timeoutMilliseconds: input.timeoutMilliseconds ?? 3_000,
    maxRequestBytes: input.maxRequestBytes ?? 4_096,
    maxResponseBytes: input.maxResponseBytes ?? 4_096,
    // Same rule as production: the kernel must return a configuration, now.
    gate: () => readProviderProbeSafetyConfig(input.environment) !== null,
    ...(input.request === undefined ? {} : { request: input.request }),
  });
}

export function createOwnedRecipientsForTests(runId: string): ProviderProbeRunOwnedRecipients {
  return createRunOwnedRecipients(runId);
}

export function addOwnedRecipientForTests(record: ProviderProbeRunOwnedRecipients, runId: string, address: string): void {
  addRunOwnedRecipient(record, runId, address);
}

export function createMailpitInventoryForTests(
  input: Readonly<{
    config: ProviderProbeSafetyConfig;
    origin?: string;
    fetch: MailpitFetch;
    ledger: ProviderProbeCleanupLedger;
    registry: ProviderProbeKnownValueRegistry;
    ownedRecipients: ProviderProbeRunOwnedRecipients;
  }>,
): ProviderProbeMailpitInventory {
  return createMailpitInventoryOperations({
    config: input.config,
    origin: input.origin ?? "http://127.0.0.1:54324",
    fetch: input.fetch,
    ledger: input.ledger,
    registry: input.registry,
    ownedRecipients: input.ownedRecipients,
  });
}

export function createAuthAdminForTests(
  input: Readonly<{
    config: ProviderProbeSafetyConfig;
    client: ProviderProbeAuthAdminClient;
    ledger: ProviderProbeCleanupLedger;
    registry: ProviderProbeKnownValueRegistry;
    ownedRecipients: ProviderProbeRunOwnedRecipients;
    random?: ProviderProbeRandomSource;
  }>,
): ProviderProbeAuthAdmin {
  return createAuthAdminOperations(input);
}

// The production run's own composition and deleters, over test transports. (R7) The
// optional public-client wrapper is the run core's test seam for answers the real
// auth-js never returns.
export function createRunForTests(
  input: Readonly<{
    environment: ProbeEnvironment;
    auth: ProviderProbeTransport;
    mailpit: ProviderProbeTransport | null;
    random?: ProviderProbeRandomSource;
    clock?: () => number;
    publicClientWrapper?: Parameters<typeof createProviderProbeRunCore>[0]["publicClientWrapper"];
  }>,
): ProviderProbeRun {
  return createProviderProbeRunCore(input);
}

// The production probe bodies over a test run, with test seams (clock, wait, writer).
export function createSuiteCoreForTests(
  input: Readonly<{ run: ProviderProbeRun; settings: ProviderProbeSuiteSettings; seams: ProviderProbeSuiteSeams }>,
): ProviderProbeSuite {
  return createProviderProbeSuiteCore(input);
}

export function issueReceiptForTests(
  kind: ProviderProbeCleanupKind,
  id: string,
  runId: string,
): ProviderProbeCleanupReceipt {
  return issueCleanupReceipt(kind, id, runId);
}
