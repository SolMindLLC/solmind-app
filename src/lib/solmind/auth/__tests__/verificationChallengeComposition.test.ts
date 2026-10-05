import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";

import { createClient } from "@supabase/supabase-js";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as authBarrel from "../index";
import * as supabaseBarrel from "../../supabase/index";
import * as contextBarrel from "../../context/index";
import {
  LOCAL_SMTP_VERIFICATION_CODE_LIMITS,
  createLocalSmtpVerificationCodeTransport,
  type LocalSmtpVerificationCodeTransportConfiguration,
} from "../localSmtpVerificationCodeDelivery";
import * as compositionModule from "../verificationChallengeComposition";
import {
  createVerificationChallengeServices,
  type VerificationChallengeCompositionConfiguration,
  type VerificationChallengeCompositionDependencies,
} from "../verificationChallengeComposition";
import * as publicCallersModule from "../verificationChallengeCallers";
import {
  VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES,
  VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS,
  VerificationChallengeError,
  createVerificationChallengeIssuer,
  createVerificationChallengeRedeemer,
  type VerificationChallengeIssuanceRequest,
  type VerificationChallengeRedemptionRequest,
  type VerificationChallengeRpcClient,
} from "../verificationChallengeCallers";
// The restricted core: this file is one of the named unit tests allowed to
// import it (VCB-006), here only for the slot factory's own tests.
import { createVerificationCallSlots } from "../verificationChallengeCallersCore";
import { createVerificationCodePepper } from "../verificationCode";
import { type VerificationCodeDeliveryRequest } from "../verificationCodeDelivery";
import {
  VERIFICATION_CODE_EMAIL_SENDER,
  VERIFICATION_CODE_EMAIL_WORDING,
} from "../verificationCodeEmailWording";

const PEPPER_TEXT = "SOLMIND-SYNTHETIC-TEST-PEPPER-01";
const PEPPER = createVerificationCodePepper(Buffer.from(PEPPER_TEXT, "ascii"));
const EMAIL = "explorer.p5c@synthetic.invalid";
const KAT_CHALLENGE_ID = "00000000-0000-4000-8000-000000000001";
const REDEMPTION: VerificationChallengeRedemptionRequest = Object.freeze({
  purpose: "login",
  challengeId: KAT_CHALLENGE_ID,
  code: "000000",
});
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

function configuration(
  overrides: Record<string, unknown> = {},
): VerificationChallengeCompositionConfiguration {
  return {
    pepper: PEPPER,
    localSmtpHost: "127.0.0.1",
    localSmtpPort: 54325,
    deliveryTimeoutMilliseconds: 5_000,
    rpcTimeoutMilliseconds: 10_000,
    ...overrides,
  } as VerificationChallengeCompositionConfiguration;
}

// A fake of the seam: rpc() returns a request whose abortSignal() returns the
// awaitable answer, as postgrest-js's builder does.
function fakeRpc(respond: (functionName: string) => unknown) {
  const rpc = vi.fn((functionName: string) => ({
    abortSignal: () => respond(functionName) as PromiseLike<unknown>,
  }));
  const client: VerificationChallengeRpcClient = { rpc };
  return { client, rpc };
}

function respondByFunction(functionName: string) {
  return Promise.resolve({
    data: [
      {
        outcome:
          functionName === "solmind_issue_verification_challenge" ? "issued" : "redeemed",
      },
    ],
    error: null,
  });
}

// A seam whose calls stay outstanding until the test releases them, each
// with a `denied` answer.
function holdingRpc() {
  const resolvers: Array<(value: unknown) => void> = [];
  const rpc = vi.fn(() => ({
    abortSignal: () =>
      new Promise((resolve) => {
        resolvers.push(resolve);
      }),
  }));
  const client: VerificationChallengeRpcClient = { rpc };
  return {
    client,
    rpc,
    pending: () => resolvers.length,
    releaseOne: () => {
      resolvers.shift()?.({ data: [{ outcome: "denied" }], error: null });
    },
    releaseAll: () => {
      for (const resolve of resolvers.splice(0)) {
        resolve({ data: [{ outcome: "denied" }], error: null });
      }
    },
  };
}

function fakeWiring(
  overrides: Partial<Record<keyof VerificationChallengeCompositionDependencies, unknown>> = {},
) {
  const rpc = fakeRpc(respondByFunction);
  const requests: VerificationCodeDeliveryRequest[] = [];
  const send = vi.fn(async (request: VerificationCodeDeliveryRequest) => {
    requests.push({ ...request });
    return "accepted";
  });
  const createRpcClient = vi.fn(() => rpc.client);
  const createDeliveryTransport = vi.fn(
    (configuration: LocalSmtpVerificationCodeTransportConfiguration) => {
      void configuration;
      return { send };
    },
  );
  const wiring = {
    createRpcClient,
    createDeliveryTransport,
    ...overrides,
  } as VerificationChallengeCompositionDependencies;
  return { wiring, rpc, send, requests, createRpcClient, createDeliveryTransport };
}

function issuanceRequest(): VerificationChallengeIssuanceRequest {
  return {
    purpose: "login",
    contactMethodType: "email",
    normalizedContact: EMAIL,
    userAccountId: null,
    userContactMethodId: null,
  };
}

function textOf(value: unknown): string {
  return [
    String(value),
    inspect(value, { showHidden: true, depth: 5 }),
    value instanceof Error ? `${value.name} ${value.message} ${value.stack ?? ""}` : "",
  ].join(" ");
}

function expectCompositionError(action: () => unknown, secrets: ReadonlyArray<string>): void {
  let error: unknown = null;
  try {
    action();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(VerificationChallengeError);
  expect((error as VerificationChallengeError).code).toBe(
    "verification_challenge_invalid_configuration",
  );
  expect((error as Error).message).toBe("verification_challenge_invalid_configuration");
  const text = textOf(error);
  for (const secret of secrets) {
    expect(text).not.toContain(secret);
  }
}

async function settle(turns = 5): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve();
  }
}

// Proves the runtime pools are whole: four issuances and four redemptions
// can all be outstanding at once, and a fifth of each is `busy`. It then
// releases everything, so the pools are whole again afterwards.
async function expectRuntimePoolsWhole(): Promise<void> {
  const holder = holdingRpc();
  const root = createVerificationChallengeServices(configuration(), {
    ...fakeWiring().wiring,
    createRpcClient: () => holder.client,
  });
  const held: Promise<unknown>[] = [];
  try {
    for (let index = 0; index < VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES; index += 1) {
      held.push(root.issuer.issue(issuanceRequest()));
    }
    for (let index = 0; index < VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS; index += 1) {
      held.push(root.redeemer.redeem(REDEMPTION));
    }
    expect(holder.pending()).toBe(
      VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES +
        VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS,
    );
    await expect(root.issuer.issue(issuanceRequest())).resolves.toMatchObject({ outcome: "busy" });
    await expect(root.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "busy" });
  } finally {
    holder.releaseAll();
    await Promise.all(held);
    await settle(10);
  }
}

// The app's source root, or, when this file runs from a proposal folder
// that holds only new files, the live app's.
function sourceRoot(): string {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "..", "..", "..", "..");
  const proposalRoot = path.resolve(root, "..", "..");
  if (
    !fs.existsSync(path.join(root, "lib", "solmind", "auth", "index.ts")) &&
    path.basename(proposalRoot).includes("_proposed_")
  ) {
    return path.resolve(proposalRoot, "..", "solmind-app", "src");
  }
  return root;
}

// This file's own source root, for attributing environment reads.
function ownSourceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
}

function normalizedPath(value: string): string {
  return value.replace(/^file:\/\/\/?/, "").replace(/\\/g, "/").toLowerCase();
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("verificationChallengeComposition - the dormant composition root", () => {
  // The runtime pools live in the public module for the whole file, so every
  // test must leave them whole; this proves it after each one.
  afterEach(async () => {
    await expectRuntimePoolsWhole();
  });

  it("VCC-001 wires the callers to the injected database client and transport with the approved email", async () => {
    const fake = fakeWiring();
    const services = createVerificationChallengeServices(configuration(), fake.wiring);
    expect(Object.isFrozen(services)).toBe(true);
    expect(Object.keys(services).sort()).toEqual(["issuer", "redeemer"]);
    expect(fake.createRpcClient).toHaveBeenCalledTimes(1);
    expect(fake.createDeliveryTransport).toHaveBeenCalledTimes(1);
    expect(fake.createDeliveryTransport.mock.calls[0][0]).toEqual({
      host: "127.0.0.1",
      port: 54325,
      sender: VERIFICATION_CODE_EMAIL_SENDER,
      wording: VERIFICATION_CODE_EMAIL_WORDING,
      timeoutMilliseconds: 5_000,
    });

    const issued = await services.issuer.issue(issuanceRequest());
    expect(issued).toMatchObject({ outcome: "issued", delivery: "accepted" });
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(fake.requests[0]).toMatchObject({ channel: "email", normalizedContact: EMAIL });

    const redeemed = await services.redeemer.redeem({
      purpose: "login",
      challengeId: issued.challengeId,
      code: fake.requests[0].code,
    });
    expect(redeemed).toEqual({ outcome: "redeemed" });
    expect(fake.rpc.rpc.mock.calls.map((call) => call[0])).toEqual([
      "solmind_issue_verification_challenge",
      "solmind_redeem_verification_challenge",
    ]);
  });

  it("VCC-002 composes with login step 4's real local SMTP transport, which opens nothing until a send", () => {
    const fake = fakeWiring({ createDeliveryTransport: createLocalSmtpVerificationCodeTransport });
    const services = createVerificationChallengeServices(
      configuration({ localSmtpHost: "::1" }),
      fake.wiring,
    );
    expect(Object.keys(services).sort()).toEqual(["issuer", "redeemer"]);
    // The transport refuses a non-loopback host; composition turns that into
    // its own fixed error, which does not repeat the host.
    for (const localSmtpHost of ["localhost", "192.0.2.10", "mail.synthetic.invalid"]) {
      expectCompositionError(
        () =>
          createVerificationChallengeServices(
            configuration({ localSmtpHost }),
            fakeWiring({ createDeliveryTransport: createLocalSmtpVerificationCodeTransport })
              .wiring,
          ),
        [localSmtpHost],
      );
    }
  });

  it("VCC-003 refuses malformed configuration or wiring, and hides every dependency failure", () => {
    const getter = configuration();
    Object.defineProperty(getter, "pepper", {
      enumerable: true,
      get: () => PEPPER,
    });
    const badConfigurations: ReadonlyArray<unknown> = [
      configuration({ pepper: Buffer.from(PEPPER_TEXT, "ascii") }),
      configuration({ pepper: Object.freeze({}) }),
      configuration({ localSmtpPort: 0 }),
      configuration({ localSmtpPort: "54325" }),
      configuration({ deliveryTimeoutMilliseconds: 9 }),
      configuration({
        deliveryTimeoutMilliseconds: LOCAL_SMTP_VERIFICATION_CODE_LIMITS.maximumTimeoutMilliseconds + 1,
      }),
      configuration({ rpcTimeoutMilliseconds: 60_001 }),
      { ...configuration(), extra: true },
      { pepper: PEPPER },
      getter,
      null,
    ];
    for (const settings of badConfigurations) {
      // With login step 4's real transport factory, which checks the host,
      // port and deadline itself; the callers check the rest.
      expectCompositionError(
        () =>
          createVerificationChallengeServices(
            settings as VerificationChallengeCompositionConfiguration,
            fakeWiring({ createDeliveryTransport: createLocalSmtpVerificationCodeTransport })
              .wiring,
          ),
        [PEPPER_TEXT],
      );
    }

    const failingRpcFactory = vi.fn(() => {
      throw new Error(
        "SolMind server configuration error: required server environment variable SUPABASE_SERVICE_ROLE_KEY is missing or blank.",
      );
    });
    const failingTransportFactory = vi.fn(() => {
      throw new Error(`transport refused ${EMAIL}`);
    });
    for (const wiring of [
      fakeWiring({ createRpcClient: failingRpcFactory }).wiring,
      fakeWiring({ createDeliveryTransport: failingTransportFactory }).wiring,
      fakeWiring({ createRpcClient: () => ({}) }).wiring,
      fakeWiring({ createDeliveryTransport: () => ({ send: "no" }) }).wiring,
      fakeWiring({ createRpcClient: "createServiceRoleClient" }).wiring,
      { ...fakeWiring().wiring, extra: true },
      (() => {
        const missing: Record<string, unknown> = { ...fakeWiring().wiring };
        delete missing.createDeliveryTransport;
        return missing;
      })(),
      null,
    ]) {
      expectCompositionError(
        () =>
          createVerificationChallengeServices(
            configuration(),
            wiring as VerificationChallengeCompositionDependencies,
          ),
        ["SUPABASE_SERVICE_ROLE_KEY", EMAIL, PEPPER_TEXT],
      );
    }
  });

  it("VCC-004 reads the database environment only when the root is called, and never leaks it", () => {
    // Calling the root with the real dependencies reads the two existing
    // variables through createServiceRoleClient(); blank values give the
    // root's own fixed error, not the variable names. VCC-007 proves that
    // loading the modules reads nothing.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expectCompositionError(
      () => createVerificationChallengeServices(configuration()),
      ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
    );

    // With values present, the real wiring composes without opening any
    // connection: no database call or email is made until issue or redeem.
    const syntheticKey = "synthetic-service-role-key-for-composition-test";
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", syntheticKey);
    const services = createVerificationChallengeServices(configuration());
    expect(Object.keys(services).sort()).toEqual(["issuer", "redeemer"]);
    expect(textOf(services)).not.toContain(syntheticKey);
    expect(textOf(services)).not.toContain(PEPPER_TEXT);
  });

  it("VCC-005 the slot pool factory counts each slot once", () => {
    expect(VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_ISSUANCES).toBe(4);
    expect(VERIFICATION_CHALLENGE_MAXIMUM_CONCURRENT_REDEMPTIONS).toBe(4);
    const slots = createVerificationCallSlots(2);
    const first = slots.tryAcquire();
    const second = slots.tryAcquire();
    expect(first).toBeTypeOf("function");
    expect(second).toBeTypeOf("function");
    expect(slots.tryAcquire()).toBeNull();
    first?.();
    // Releasing twice frees one slot, not two.
    first?.();
    const third = slots.tryAcquire();
    expect(third).toBeTypeOf("function");
    expect(slots.tryAcquire()).toBeNull();
    second?.();
    third?.();
    expect(slots.tryAcquire()).toBeTypeOf("function");

    for (const maximum of [0, -1, 1.5, Number.NaN, "4", null]) {
      expectCompositionError(() => createVerificationCallSlots(maximum as number), []);
    }
  });

  it("VCC-006 every runtime root, and every caller from the public factories, shares one pool of four issuance slots and one of four redemption slots", async () => {
    // Different roots with different clients and transports, plus callers
    // built straight from the public factories: all draw on the same pools.
    const holderA = holdingRpc();
    const holderB = holdingRpc();
    const holderC = holdingRpc();
    const rootA = createVerificationChallengeServices(configuration(), {
      ...fakeWiring().wiring,
      createRpcClient: () => holderA.client,
    });
    const rootB = createVerificationChallengeServices(configuration(), {
      createRpcClient: () => holderB.client,
      createDeliveryTransport: () => ({ send: async () => "accepted" }),
    });
    const directIssuer = createVerificationChallengeIssuer({
      rpcClient: holderC.client,
      rpcTimeoutMilliseconds: 10_000,
      pepper: PEPPER,
      deliveryTransport: { send: async () => "accepted" },
      deliveryTimeoutMilliseconds: 5_000,
    });
    const directRedeemer = createVerificationChallengeRedeemer({
      rpcClient: holderC.client,
      rpcTimeoutMilliseconds: 10_000,
      pepper: PEPPER,
    });
    const fresh = fakeWiring();
    const rootD = createVerificationChallengeServices(configuration(), fresh.wiring);
    const freshDirect = fakeRpc(respondByFunction);
    const directIssuerTwo = createVerificationChallengeIssuer({
      rpcClient: freshDirect.client,
      rpcTimeoutMilliseconds: 10_000,
      pepper: PEPPER,
      deliveryTransport: { send: async () => "accepted" },
      deliveryTimeoutMilliseconds: 5_000,
    });
    const directRedeemerTwo = createVerificationChallengeRedeemer({
      rpcClient: freshDirect.client,
      rpcTimeoutMilliseconds: 10_000,
      pepper: PEPPER,
    });

    const held: Promise<unknown>[] = [];
    try {
      // Issuance: four outstanding calls across three issuers fill the pool.
      held.push(
        rootA.issuer.issue(issuanceRequest()),
        rootA.issuer.issue(issuanceRequest()),
        rootB.issuer.issue(issuanceRequest()),
        directIssuer.issue(issuanceRequest()),
      );
      expect(holderA.pending() + holderB.pending() + holderC.pending()).toBe(4);
      await expect(rootD.issuer.issue(issuanceRequest())).resolves.toMatchObject({ outcome: "busy" });
      await expect(directIssuerTwo.issue(issuanceRequest())).resolves.toMatchObject({
        outcome: "busy",
      });
      expect(fresh.rpc.rpc).not.toHaveBeenCalled();
      expect(freshDirect.rpc).not.toHaveBeenCalled();
      // One call settles; only then is one slot free again.
      holderB.releaseOne();
      await settle(10);
      await expect(rootD.issuer.issue(issuanceRequest())).resolves.toMatchObject({
        outcome: "issued",
      });

      // Redemption: four outstanding calls across three redeemers fill it.
      held.push(
        rootA.redeemer.redeem(REDEMPTION),
        rootB.redeemer.redeem(REDEMPTION),
        rootB.redeemer.redeem(REDEMPTION),
        directRedeemer.redeem(REDEMPTION),
      );
      await expect(rootD.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "busy" });
      await expect(directRedeemerTwo.redeem(REDEMPTION)).resolves.toEqual({ outcome: "busy" });
      holderC.releaseAll();
      await settle(10);
      await expect(rootD.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "redeemed" });
    } finally {
      holderA.releaseAll();
      holderB.releaseAll();
      holderC.releaseAll();
      await Promise.all(held);
      await settle(10);
    }
  });

  it("VCC-007 reads no environment variable from application code while the modules load", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const appRoot = normalizedPath(ownSourceRoot());
    const originalEnvironment = process.env;
    const reads: Array<Readonly<{ key: string; frame: string }>> = [];
    // A read is attributed to the code that performed it: the first stack
    // frame below the trap. It is application code when that frame's file is
    // under this app's source root and not under node_modules.
    function record(key: string, trap: (...args: never[]) => unknown): void {
      const holder: { stack?: string } = {};
      Error.captureStackTrace(holder, trap);
      const frame = (holder.stack ?? "").split("\n").find((line) => line.trim().startsWith("at ")) ?? "";
      reads.push(Object.freeze({ key, frame }));
    }
    const handler: ProxyHandler<NodeJS.ProcessEnv> = {
      get(target, key, receiver) {
        record(String(key), handler.get as never);
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        record(String(key), handler.has as never);
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        record("(every key)", handler.ownKeys as never);
        return Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        record(String(key), handler.getOwnPropertyDescriptor as never);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    };
    const isApplicationRead = (read: Readonly<{ frame: string }>) => {
      const frame = normalizedPath(read.frame);
      return frame.includes(appRoot) && !frame.includes("/node_modules/");
    };
    let loaded: ReadonlyArray<Record<string, unknown>>;
    let controlReads: number;
    process.env = new Proxy(originalEnvironment, handler);
    try {
      // Positive control: a read from this file, which is application code,
      // must be attributed, or the check below could pass vacuously.
      void process.env.SOLMIND_VCC007_CONTROL;
      controlReads = reads.filter(isApplicationRead).length;
      reads.length = 0;
      // A fresh module graph, so the step 5 modules and the app modules they
      // import (the service-role client and its environment reader) load
      // again here, under the recording environment.
      vi.resetModules();
      loaded = await Promise.all([
        import("../verificationCode"),
        import("../verificationChallengeCallersCore"),
        import("../verificationChallengeCallers"),
        import("../verificationChallengeComposition"),
      ]);
    } finally {
      process.env = originalEnvironment;
    }
    expect(controlReads).toBe(1);
    expect(typeof loaded[3].createVerificationChallengeServices).toBe("function");
    expect(typeof loaded[2].createVerificationChallengeIssuer).toBe("function");
    expect(typeof loaded[1].createVerificationChallengeIssuerWithSlots).toBe("function");
    expect(typeof loaded[0].computeVerificationCodeVerifier).toBe("function");
    // Every application-attributable read, whatever its key.
    expect(reads.filter(isApplicationRead)).toEqual([]);
  });

  it("VCC-008 drives the real postgrest-js client: one POST per call, the abort signal reaches fetch, and, with this abort-reacting fake fetch, an aborted call settles, for issuance and redemption", async () => {
    type Seen = Readonly<{ url: string; method: string; body: unknown; signal: AbortSignal | null }>;
    const seen: Seen[] = [];
    let mode: "issued" | "redeemed" | "status-503" | "status-520" | "network" | "hang" = "issued";
    const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      seen.push(
        Object.freeze({
          url,
          method: init?.method ?? "GET",
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
          signal: init?.signal ?? null,
        }),
      );
      if (mode === "status-503" || mode === "status-520") {
        return new Response("", { status: mode === "status-503" ? 503 : 520 });
      }
      if (mode === "network") {
        throw new TypeError("fetch failed");
      }
      if (mode === "hang") {
        // This fake settles when its signal aborts; whether a real transport
        // does is the transport's own behaviour.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("This operation was aborted", "AbortError"));
          });
        });
      }
      return new Response(JSON.stringify([{ outcome: mode }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const client = createClient("http://127.0.0.1:54321", "synthetic-service-role-key", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fakeFetch as unknown as typeof fetch },
    });
    // A generous limit for the answered calls, and a short one for the calls
    // that never answer.
    const services = createVerificationChallengeServices(configuration({ rpcTimeoutMilliseconds: 5_000 }), {
      ...fakeWiring().wiring,
      createRpcClient: () => client,
    });
    const hangServices = createVerificationChallengeServices(
      configuration({ rpcTimeoutMilliseconds: 100 }),
      { ...fakeWiring().wiring, createRpcClient: () => client },
    );
    const rpcCalls = () => seen.filter((request) => request.url.includes("/rest/v1/rpc/"));
    const ISSUE_URL = "http://127.0.0.1:54321/rest/v1/rpc/solmind_issue_verification_challenge";
    const REDEEM_URL = "http://127.0.0.1:54321/rest/v1/rpc/solmind_redeem_verification_challenge";

    // Issuance: one POST, the exact argument keys, and a live signal.
    const issued = await services.issuer.issue(issuanceRequest());
    expect(issued).toMatchObject({ outcome: "issued", delivery: "accepted" });
    expect(rpcCalls()).toHaveLength(1);
    const [issueCall] = rpcCalls();
    expect(issueCall.method).toBe("POST");
    expect(issueCall.url).toBe(ISSUE_URL);
    expect(Object.keys(issueCall.body as object).sort()).toEqual([
      "p_contact_method_type",
      "p_delivery_channel",
      "p_normalized_contact_value",
      "p_purpose",
      "p_user_account_id",
      "p_user_contact_method_id",
      "p_verification_challenge_id",
      "p_verifier",
    ]);
    expect(issueCall.signal).toBeInstanceOf(AbortSignal);
    expect(issueCall.signal?.aborted).toBe(false);

    // Redemption: one POST, the exact argument keys, and a live signal.
    mode = "redeemed";
    await expect(services.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "redeemed" });
    expect(rpcCalls()).toHaveLength(2);
    const redeemCall = rpcCalls()[1];
    expect(redeemCall.method).toBe("POST");
    expect(redeemCall.url).toBe(REDEEM_URL);
    expect(Object.keys(redeemCall.body as object).sort()).toEqual([
      "p_purpose",
      "p_verification_challenge_id",
      "p_verifier",
    ]);
    expect(redeemCall.signal).toBeInstanceOf(AbortSignal);
    expect(redeemCall.signal?.aborted).toBe(false);

    // No automatic replay of the POST, for either caller: postgrest-js
    // retries only GET, HEAD and OPTIONS, for network errors and 503/520.
    for (const failing of ["status-503", "status-520", "network"] as const) {
      mode = failing;
      const beforeIssue = rpcCalls().length;
      await expect(services.issuer.issue(issuanceRequest())).resolves.toMatchObject({
        outcome: "failed",
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(rpcCalls().length, `issue ${failing}`).toBe(beforeIssue + 1);
      expect(rpcCalls()[beforeIssue].url).toBe(ISSUE_URL);

      const beforeRedeem = rpcCalls().length;
      await expect(services.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "failed" });
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(rpcCalls().length, `redeem ${failing}`).toBe(beforeRedeem + 1);
      expect(rpcCalls()[beforeRedeem].url).toBe(REDEEM_URL);
    }

    // Calls that never answer: each is aborted at its deadline. This fake
    // fetch then rejects, and postgrest-js settles the call with an error
    // answer, so the slots come back (the file's afterEach proves the pools
    // are whole).
    mode = "hang";
    const beforeHang = rpcCalls().length;
    await expect(hangServices.issuer.issue(issuanceRequest())).resolves.toMatchObject({
      outcome: "failed",
    });
    await expect(hangServices.redeemer.redeem(REDEMPTION)).resolves.toEqual({ outcome: "failed" });
    expect(rpcCalls()).toHaveLength(beforeHang + 2);
    expect(rpcCalls()[beforeHang]).toMatchObject({ url: ISSUE_URL });
    expect(rpcCalls()[beforeHang].signal?.aborted).toBe(true);
    expect(rpcCalls()[beforeHang + 1]).toMatchObject({ url: REDEEM_URL });
    expect(rpcCalls()[beforeHang + 1].signal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  it("VCC-009 the public factories and the composition root neither accept nor expose a slot pool", () => {
    // Neither runtime module exports a pool factory or a pool-taking factory.
    for (const [name, namespace] of [
      ["verificationChallengeCallers", publicCallersModule],
      ["verificationChallengeComposition", compositionModule],
    ] as const) {
      const exported = Object.keys(namespace);
      for (const forbidden of [
        "createVerificationCallSlots",
        "createVerificationChallengeIssuerWithSlots",
        "createVerificationChallengeRedeemerWithSlots",
      ]) {
        expect(exported, `${name} exports ${forbidden}`).not.toContain(forbidden);
      }
    }
    // The public factories and the root refuse a dependency object that
    // carries a pool: it is an extra key.
    const pool = { tryAcquire: () => () => undefined };
    expectCompositionError(
      () =>
        createVerificationChallengeIssuer({
          rpcClient: fakeRpc(respondByFunction).client,
          rpcTimeoutMilliseconds: 10_000,
          pepper: PEPPER,
          deliveryTransport: { send: async () => "accepted" },
          deliveryTimeoutMilliseconds: 5_000,
          issuanceSlots: pool,
        } as never),
      [],
    );
    expectCompositionError(
      () =>
        createVerificationChallengeRedeemer({
          rpcClient: fakeRpc(respondByFunction).client,
          rpcTimeoutMilliseconds: 10_000,
          pepper: PEPPER,
          redemptionSlots: pool,
        } as never),
      [],
    );
    for (const key of ["issuanceSlots", "redemptionSlots"]) {
      expectCompositionError(
        () =>
          createVerificationChallengeServices(configuration(), {
            ...fakeWiring().wiring,
            [key]: pool,
          } as never),
        [],
      );
    }
    // The public factories take exactly one argument, so a pool cannot be
    // passed beside the dependencies either.
    expect(createVerificationChallengeIssuer).toHaveLength(1);
    expect(createVerificationChallengeRedeemer).toHaveLength(1);
  });
});

describe("verificationChallenge - server-only, dormant and off every barrel", () => {
  const moduleNames = [
    "verificationCode",
    "verificationChallengeCallersCore",
    "verificationChallengeCallers",
    "verificationChallengeComposition",
  ] as const;
  const guardedNames = [
    ...moduleNames,
    "verificationCodeDelivery",
    "localSmtpVerificationCodeDelivery",
    "verificationCodeEmailWording",
  ] as const;
  // The only test files that may import the restricted core.
  const CORE_TEST_IMPORTERS = [
    "verificationChallengeComposition.test.ts",
    "verificationChallengeIssuance.test.ts",
    "verificationChallengeRedemption.test.ts",
  ];

  function moduleSource(name: string): string {
    return fs.readFileSync(fileURLToPath(new URL(`../${name}.ts`, import.meta.url)), "utf8");
  }

  type ModuleReference = Readonly<{ form: string; specifier: string | null }>;

  // Every module reference in a file, found with TypeScript's own parser (as
  // tests/provider-probe/providerProbeModuleBoundary.test.ts does): static
  // imports, side-effect imports, re-exports, `import x = require()`,
  // dynamic `import()` in any spacing or comment form, `require()` calls,
  // `typeof import()` types, any other value use of `require`, and any use
  // of `import.meta` (Vite's `import.meta.glob` loads modules without naming
  // one). A reference whose argument is not one string literal (or a
  // template literal without substitutions) has a null specifier, and an
  // `import.meta` use always has one.
  function moduleReferences(fileName: string, text: string): ModuleReference[] {
    const kind = /\.[jt]sx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
    const references: ModuleReference[] = [];
    const literal = (node: ts.Node | undefined): string | null =>
      node !== undefined && ts.isStringLiteralLike(node) ? node.text : null;
    function visit(node: ts.Node): void {
      if (ts.isImportDeclaration(node)) {
        references.push({ form: "import", specifier: literal(node.moduleSpecifier) });
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
        references.push({ form: "export-from", specifier: literal(node.moduleSpecifier) });
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      ) {
        references.push({ form: "import-equals", specifier: literal(node.moduleReference.expression) });
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        references.push({
          form: "dynamic-import",
          specifier: node.arguments.length === 1 ? literal(node.arguments[0]) : null,
        });
      } else if (ts.isImportTypeNode(node)) {
        const argument = node.argument;
        references.push({
          form: "import-type",
          specifier:
            ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)
              ? argument.literal.text
              : null,
        });
      } else if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        references.push({ form: "import-meta", specifier: null });
      } else if (ts.isIdentifier(node) && node.text === "require") {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          references.push({
            form: "require",
            specifier: parent.arguments.length === 1 ? literal(parent.arguments[0]) : null,
          });
        } else if (
          !(ts.isPropertyAccessExpression(parent) && parent.name === node) &&
          !(ts.isExternalModuleReference(parent))
        ) {
          // `const load = require`, `fn(require)` and the like.
          references.push({ form: "require-reference", specifier: null });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return references;
  }

  // Resolves a relative or `@/` specifier to a path without its extension,
  // lowercased for Windows. Package specifiers resolve to null.
  function resolveReference(fromFile: string, specifier: string, root: string): string | null {
    let target: string;
    if (specifier.startsWith("@/")) {
      target = path.join(root, specifier.slice(2));
    } else if (specifier.startsWith(".")) {
      target = path.resolve(path.dirname(fromFile), specifier);
    } else {
      return null;
    }
    return target.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase();
  }

  function authModulePath(root: string, name: string): string {
    return path.join(root, "lib", "solmind", "auth", name).toLowerCase();
  }

  // Every non-test file is parsed first: a computed reference or an
  // `import.meta` use is an offender in any of them, the seven guarded modules
  // included. Only after that are the guarded modules exempted, and only for
  // their permitted literal references to, and mentions of, each other.
  function dormancyOffenders(file: string, text: string, root: string): string[] {
    const guarded = new Set(guardedNames.map((name) => authModulePath(root, name)));
    const isGuardedModule = guarded.has(file.replace(/\.(?:[cm]?[jt]sx?)$/, "").toLowerCase());
    const offenders: string[] = [];
    for (const reference of moduleReferences(file, text)) {
      if (reference.specifier === null) {
        offenders.push(`${reference.form} without a literal module specifier`);
        continue;
      }
      if (isGuardedModule) {
        continue;
      }
      const resolved = resolveReference(file, reference.specifier, root);
      if (resolved !== null && guarded.has(resolved)) {
        offenders.push(`${reference.form} ${reference.specifier}`);
      }
    }
    if (isGuardedModule) {
      return offenders;
    }
    for (const name of guardedNames) {
      if (new RegExp(`\\b${name}\\b`).test(text)) {
        offenders.push(`mentions ${name}`);
      }
    }
    return offenders;
  }

  function sourceFiles(directory: string): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...sourceFiles(entryPath));
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
        found.push(entryPath);
      }
    }
    return found;
  }

  it("VCB-001 each module starts with the server-only import and imports only what it needs", () => {
    for (const name of moduleNames) {
      const source = moduleSource(name);
      expect(source.startsWith('import "server-only";')).toBe(true);
      expect(source.charCodeAt(0)).not.toBe(0xfeff);
    }
    const references = (name: string) =>
      moduleReferences(`${name}.ts`, moduleSource(name)).map(
        (reference) => `${reference.form} ${reference.specifier}`,
      );
    expect(references("verificationCode")).toEqual([
      "import server-only",
      "import node:crypto",
      "import ./verificationCodeDelivery",
    ]);
    expect(references("verificationChallengeCallersCore")).toEqual([
      "import server-only",
      "import ./verificationCode",
      "import ./verificationCodeDelivery",
    ]);
    expect(references("verificationChallengeCallers")).toEqual([
      "import server-only",
      "import ./verificationChallengeCallersCore",
      "export-from ./verificationChallengeCallersCore",
    ]);
    expect(references("verificationChallengeComposition")).toEqual([
      "import server-only",
      "import ../supabase/serviceRoleClient",
      "import ./localSmtpVerificationCodeDelivery",
      "import ./verificationChallengeCallers",
      "import ./verificationCode",
      "import ./verificationCodeDelivery",
      "import ./verificationCodeEmailWording",
    ]);
  });

  it("VCB-002 never reads the environment, logs, fetches or compares verifiers, and keeps each duty in one place", () => {
    for (const name of moduleNames) {
      const source = moduleSource(name);
      expect(source).not.toMatch(
        /process\.env|console\.|\bfetch\s*\(|Math\.random|localStorage|sessionStorage|\bimport\s*\(|\brequire\s*\(|timingSafeEqual|NEXT_PUBLIC_|@supabase|next\/|cookies\s*\(|["']use server["']|\.send\s*\(/,
      );
    }
    // Randomness and HMAC only in the code module.
    expect(moduleSource("verificationCode")).toContain('from "node:crypto"');
    for (const name of moduleNames.filter((name) => name !== "verificationCode")) {
      expect(moduleSource(name)).not.toContain("node:crypto");
    }
    // The two database functions, the RPC call with its abort signal, the
    // monotonic clock and the delivery call only in the restricted core,
    // which reaches the transport only through the boundary.
    for (const marker of [
      '"solmind_issue_verification_challenge"',
      '"solmind_redeem_verification_challenge"',
      ".rpc(",
      ".abortSignal(",
      "performance.now()",
      "deliverVerificationCode(",
      "prepareVerificationCodeDelivery(",
    ]) {
      expect(moduleSource("verificationChallengeCallersCore")).toContain(marker);
      for (const name of moduleNames.filter((name) => name !== "verificationChallengeCallersCore")) {
        expect(moduleSource(name), `${name} has ${marker}`).not.toContain(marker);
      }
    }
    // The runtime pools are created only in the public callers module.
    expect(moduleSource("verificationChallengeCallers")).toContain("createVerificationCallSlots(");
    expect(moduleSource("verificationChallengeComposition")).not.toContain("createVerificationCallSlots");
    expect(moduleSource("verificationChallengeComposition")).not.toContain("WithSlots");
  });

  it("VCB-003 is not exported from any barrel", () => {
    for (const exportedName of [
      "computeVerificationCodeVerifier",
      "createVerificationCodePepper",
      "generateVerificationCode",
      "createVerificationChallengeIssuer",
      "createVerificationChallengeRedeemer",
      "createVerificationChallengeIssuerWithSlots",
      "createVerificationChallengeRedeemerWithSlots",
      "toVerificationChallengeIssuanceAcknowledgment",
      "createVerificationChallengeServices",
      "createVerificationCallSlots",
    ]) {
      expect(exportedName in authBarrel).toBe(false);
      expect(exportedName in supabaseBarrel).toBe(false);
      expect(exportedName in contextBarrel).toBe(false);
    }

    const root = sourceRoot();
    const barrels = sourceFiles(root).filter((file) =>
      /^index\.(?:[cm]?[jt]sx?)$/.test(path.basename(file)),
    );
    // The three barrels that exist (backlog item 106: there is no
    // src/lib/solmind/index.ts).
    for (const expected of [
      path.join(root, "lib", "solmind", "auth", "index.ts"),
      path.join(root, "lib", "solmind", "context", "index.ts"),
      path.join(root, "lib", "solmind", "supabase", "index.ts"),
    ]) {
      expect(barrels).toContain(expected);
    }
    for (const barrel of barrels) {
      const source = fs.readFileSync(barrel, "utf8");
      for (const name of moduleNames) {
        expect(source).not.toContain(name);
      }
    }
  });

  it("VCB-004 is dormant: every non-test file, the guarded modules included, has no computed reference or import.meta, and no other application file reaches these modules or login step 4's", () => {
    const root = sourceRoot();
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      // Only test files are skipped, and a test file is known by its name, as
      // in the provider-probe boundary test. The seven guarded modules and the
      // test-support modules in `__tests__` folders are parsed too.
      if (/\.test\.[cm]?[jt]sx?$/.test(file)) {
        continue;
      }
      for (const offender of dormancyOffenders(file, fs.readFileSync(file, "utf8"), root)) {
        offenders.push(`${path.relative(root, file)}: ${offender}`);
      }
    }
    expect(offenders).toEqual([]);

    // Controls: each form, placed in each guarded login step 4 module, is an
    // offender, although those modules may still import each other literally.
    const forms: ReadonlyArray<readonly [string, string, string]> = [
      [
        "a computed dynamic import with a comment",
        "export const load = (name: string) => import /* deferred */ (name);",
        "dynamic-import without a literal module specifier",
      ],
      ["a computed require", "const loaded = require(moduleName);", "require without a literal module specifier"],
      ["require as a value", "const load = require;", "require-reference without a literal module specifier"],
      ["import.meta", 'const modules = import.meta.glob("./*.ts");', "import-meta without a literal module specifier"],
    ];
    for (const name of [
      "verificationCodeDelivery",
      "localSmtpVerificationCodeDelivery",
      "verificationCodeEmailWording",
    ]) {
      const file = `${path.join(root, "lib", "solmind", "auth", name)}.ts`;
      for (const [form, text, expected] of forms) {
        expect(dormancyOffenders(file, text, root), `${form} in ${name}`).toEqual([expected]);
      }
      // The permitted literal reference between guarded modules stays exempt.
      expect(
        dormancyOffenders(file, 'import { isSixDigitVerificationCode } from "./verificationCodeDelivery";', root),
        `literal import in ${name}`,
      ).toEqual([]);
    }
  });

  it("VCB-005 the parser records every reference form, in any spacing or comment form, and the resolver maps each to its module", () => {
    const root = sourceRoot();
    const file = path.join(root, "lib", "solmind", "other", "probe.ts");
    const recorded = (text: string) =>
      moduleReferences("probe.ts", text).map((reference) => [reference.form, reference.specifier]);
    // Each source must yield exactly these parser records; the name-mention
    // fallback is not consulted here.
    const cases: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string | null]>]> = [
      ['import { a } from "../auth/verificationCodeDelivery.ts";', [["import", "../auth/verificationCodeDelivery.ts"]]],
      ['import "../auth/verificationCodeDelivery.mjs";', [["import", "../auth/verificationCodeDelivery.mjs"]]],
      ['import type {\n  X,\n} from "../auth/verificationCode";', [["import", "../auth/verificationCode"]]],
      ['export * from "@/lib/solmind/auth/verificationChallengeCallers";', [["export-from", "@/lib/solmind/auth/verificationChallengeCallers"]]],
      ['export { a } from "../auth/verificationChallengeCallersCore";', [["export-from", "../auth/verificationChallengeCallersCore"]]],
      ['import x = require("../auth/verificationCodeEmailWording");', [["import-equals", "../auth/verificationCodeEmailWording"]]],
      ['const m = await import("../auth/verificationCode");', [["dynamic-import", "../auth/verificationCode"]]],
      ['const m = await import /* comment */ ("../auth/verificationCode");', [["dynamic-import", "../auth/verificationCode"]]],
      ['const m = await import\n(\n  "../auth/verificationCodeDelivery"\n);', [["dynamic-import", "../auth/verificationCodeDelivery"]]],
      ["const m = await import(`../auth/verificationChallengeComposition`);", [["dynamic-import", "../auth/verificationChallengeComposition"]]],
      ['const r = require("../auth/localSmtpVerificationCodeDelivery.js");', [["require", "../auth/localSmtpVerificationCodeDelivery.js"]]],
      ['const r = require /* comment */ ("../auth/verificationCodeEmailWording.cjs");', [["require", "../auth/verificationCodeEmailWording.cjs"]]],
      ['type T = typeof import("../auth/verificationChallengeCallersCore");', [["import-type", "../auth/verificationChallengeCallersCore"]]],
      // Computed references have no literal specifier.
      ["const m = await import /* deferred */ (moduleName);", [["dynamic-import", null]]],
      ["const m = await import(`../auth/${name}`);", [["dynamic-import", null]]],
      ["const r = require(moduleName);", [["require", null]]],
      ["const load = require;", [["require-reference", null]]],
      ["register(require);", [["require-reference", null]]],
      // `import.meta`, through which Vite's glob loads modules unnamed.
      ['const modules = import.meta.glob("../auth/*.ts");', [["import-meta", null]]],
      ["const here = import.meta.url;", [["import-meta", null]]],
      // Not references: a property named require, and plain text.
      ["const value = options.require;", []],
      ['const text = "import(x) and require(y)";', []],
    ];
    for (const [text, expected] of cases) {
      expect(recorded(text), text).toEqual(expected);
    }
    // Every literal case above resolves to a guarded module; a computed one
    // is an offender in itself.
    for (const [text, expected] of cases) {
      if (expected.length === 1) {
        const offenders = dormancyOffenders(file, text, root).filter(
          (offender) => !offender.startsWith("mentions"),
        );
        expect(offenders, text).toHaveLength(1);
      }
    }
    // Near names and packages are not the guarded modules.
    for (const text of [
      'import { x } from "../auth/verificationCodeDeliveryHelpers";',
      'import { x } from "verificationCode";',
      'import { y } from "./verificationCode";',
    ]) {
      expect(
        dormancyOffenders(file, text, root).filter((offender) => !offender.startsWith("mentions")),
        text,
      ).toEqual([]);
    }
  });

  it("VCB-006 the restricted core is reachable only from the public callers module and the named unit tests", () => {
    const root = sourceRoot();
    const core = authModulePath(root, "verificationChallengeCallersCore");
    const allowed = new Set([
      `${authModulePath(root, "verificationChallengeCallers")}.ts`,
      ...CORE_TEST_IMPORTERS.map((name) =>
        path.join(root, "lib", "solmind", "auth", "__tests__", name).toLowerCase(),
      ),
    ]);
    const importers = new Set<string>();
    for (const file of sourceFiles(root)) {
      for (const reference of moduleReferences(file, fs.readFileSync(file, "utf8"))) {
        if (
          reference.specifier !== null &&
          resolveReference(file, reference.specifier, root) === core
        ) {
          importers.add(file.toLowerCase());
        }
      }
    }
    const unexpected = [...importers].filter((file) => !allowed.has(file));
    expect(unexpected).toEqual([]);
    // When the full app is present, the public module is the core's only
    // literal importer outside the named unit tests, and the composition root
    // does not import it.
    if (fs.existsSync(`${core}.ts`) || [...importers].length > 0) {
      expect(importers.has(`${authModulePath(root, "verificationChallengeCallers")}.ts`)).toBe(true);
      expect(importers.has(`${authModulePath(root, "verificationChallengeComposition")}.ts`)).toBe(false);
    }
  });
});
