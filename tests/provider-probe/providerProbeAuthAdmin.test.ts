import { describe, expect, it, vi } from "vitest";

import {
  mintRunRecipient,
  ProviderProbeAuthAdminError,
  type ProviderProbeAuthAdminClient,
  type ProviderProbeAuthAdminErrorCode,
} from "./providerProbeAuthAdminCore";
import { createProviderProbeCleanupLedger } from "./providerProbeCleanupLedger";
import { isRunOwnedRecipient } from "./providerProbeCleanupReceipts";
import { createProviderProbeKnownValueRegistry, scanProviderProbeOutput } from "./providerProbeRunEnvelope";
import {
  createAuthAdminForTests,
  createOwnedRecipientsForTests,
  gatedTestEnvironment,
  issueReceiptForTests,
  sequentialRandomForTests,
  testConfig,
} from "./providerProbeTestSupport";

// Fake clients only; every id and credential here is plainly fake. The real supabase-js
// client over a test transport is exercised in providerProbeRun.test.ts.
const ENV = gatedTestEnvironment("authadmin");
const CONFIG = testConfig(ENV);
const RUN_TAG = "p28-20261001-authadmin";
const CREDENTIAL = "fake-generated-credential-for-tests";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const V7_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const MINTED = /^p28-20261001-authadmin-[a-z2-7]{16}@synthetic\.invalid$/;

type CreateUser = ProviderProbeAuthAdminClient["auth"]["admin"]["createUser"];
type Attributes = Parameters<CreateUser>[0];

function fakeClient(createUser: CreateUser): ProviderProbeAuthAdminClient {
  return { auth: { admin: { createUser } } };
}

// A fake Auth admin that creates the user with the address it was given.
function echoCreate(id: string = USER_ID) {
  return vi.fn<CreateUser>(async (attributes: Attributes) => ({
    data: { user: { id, email: attributes.email, aud: "authenticated" } },
    error: null,
  }));
}

function setup(createUser: CreateUser) {
  const ledger = createProviderProbeCleanupLedger(ENV);
  const registry = createProviderProbeKnownValueRegistry();
  const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
  const admin = createAuthAdminForTests({
    config: CONFIG,
    client: fakeClient(createUser),
    ledger,
    registry,
    ownedRecipients,
    random: sequentialRandomForTests(),
  });
  return { ledger, registry, ownedRecipients, admin };
}

async function expectCode(
  promise: Promise<unknown>,
  code: ProviderProbeAuthAdminErrorCode,
): Promise<ProviderProbeAuthAdminError> {
  const error = await promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ProviderProbeAuthAdminError);
  expect((error as ProviderProbeAuthAdminError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  expect((error as Error).cause).toBeUndefined();
  return error as ProviderProbeAuthAdminError;
}

function fillUsers(ledger: ReturnType<typeof createProviderProbeCleanupLedger>, count: number, marker: string): void {
  for (let index = 1; index <= count; index += 1) {
    ledger.recordCreated(
      issueReceiptForTests("auth-user", `${String(index).padStart(8, "0")}-${marker}-4333-8333-333333333333`, CONFIG.runId),
    );
  }
}

describe("minted run recipients", () => {
  it("mints the run tag, a hyphen and 16 base-32 characters at the reserved domain", () => {
    const minted = mintRunRecipient(CONFIG.runId, sequentialRandomForTests());

    expect(minted).toMatch(MINTED);
    expect(minted.split("@")[0]!.length).toBeLessThanOrEqual(64);
    expect(mintRunRecipient(CONFIG.runId, sequentialRandomForTests(200))).not.toBe(minted);
  });

  it("stays within the 64-character local part for the longest run id the kernel allows", () => {
    const longest = testConfig(gatedTestEnvironment("a".repeat(32))).runId;

    expect(mintRunRecipient(longest, sequentialRandomForTests()).split("@")[0]!.length).toBe(62);
  });

  it("refuses a random source that does not return exactly ten bytes", () => {
    expect(() => mintRunRecipient(CONFIG.runId, () => new Uint8Array(9))).toThrow("auth_admin_invalid_dependencies");
  });
});

describe("run-tagged user creation (the receipt-issuing operation)", () => {
  it("creates one user at a minted address, records its receipt and makes the address run-owned", async () => {
    const createUser = echoCreate();
    const { ledger, registry, ownedRecipients, admin } = setup(createUser);

    const result = await admin.createRunTaggedUser({ password: CREDENTIAL });

    expect(result.email).toMatch(MINTED);
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(createUser).toHaveBeenCalledWith({
      email: result.email,
      password: CREDENTIAL,
      email_confirm: true,
      user_metadata: { synthetic: true },
    });
    expect(ledger.recordedCounts()).toEqual({ authUsers: 1, mailpitMessages: 0 });
    expect(result.emailMatched).toBe(true);
    expect(isRunOwnedRecipient(ownedRecipients, CONFIG.runId, result.email)).toBe(true);
    expect(isRunOwnedRecipient(ownedRecipients, CONFIG.runId, `${RUN_TAG}-other@synthetic.invalid`)).toBe(false);
    expect(result.user.matchesUserId(USER_ID)).toBe(true);
    expect(result.user.matchesUserId(V7_ID)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual({ email: result.email, emailMatched: true, user: {} });
    for (const value of [result.email, CREDENTIAL, USER_ID]) {
      expect(scanProviderProbeOutput(`copy ${value}`, registry).knownValueMatches).toBe(1);
    }
  });

  it("accepts any UUID version the server returns, and omits the credential when none is given", async () => {
    const createUser = echoCreate(V7_ID);
    const { ledger, admin } = setup(createUser);

    const result = await admin.createRunTaggedUser();

    expect(createUser.mock.calls[0]![0]).toEqual({ email: result.email, email_confirm: true, user_metadata: { synthetic: true } });
    expect(result.user.matchesUserId(V7_ID)).toBe(true);
    expect(ledger.recordedCounts().authUsers).toBe(1);
  });

  it("still records a created user whose returned address differs, but does not make any address run-owned", async () => {
    const { ledger, ownedRecipients, admin } = setup(async () => ({
      data: { user: { id: USER_ID, email: `${RUN_TAG}-someone-else@synthetic.invalid` } },
      error: null,
    }));

    const result = await admin.createRunTaggedUser();

    expect(result.emailMatched).toBe(false);
    expect(ledger.recordedCounts().authUsers).toBe(1);
    expect(isRunOwnedRecipient(ownedRecipients, CONFIG.runId, result.email)).toBe(false);
    expect(isRunOwnedRecipient(ownedRecipients, CONFIG.runId, `${RUN_TAG}-someone-else@synthetic.invalid`)).toBe(false);
  });

  it("binds run-owned addresses to this run only", async () => {
    const { ownedRecipients, admin } = setup(echoCreate());

    const result = await admin.createRunTaggedUser();

    expect(isRunOwnedRecipient(ownedRecipients, testConfig(gatedTestEnvironment("other-run")).runId, result.email)).toBe(false);
    expect(isRunOwnedRecipient(createOwnedRecipientsForTests(CONFIG.runId), CONFIG.runId, result.email)).toBe(false);
  });
});

describe("checks made before the creation call", () => {
  it.each(["short-value", "x".repeat(257), "fake-credential-with\nline-break"])(
    "refuses credential %j without calling Auth",
    async (password) => {
      const createUser = echoCreate();
      const { admin } = setup(createUser);

      await expectCode(admin.createRunTaggedUser({ password }), "auth_admin_invalid_credential");
      expect(createUser).not.toHaveBeenCalled();
    },
  );

  it("refuses when the ledger has stopped recording", async () => {
    const createUser = echoCreate();
    const { ledger, admin } = setup(createUser);
    await ledger.runCleanup({ deleteAuthUser: async () => undefined, deleteMailpitMessage: async () => undefined });

    await expectCode(admin.createRunTaggedUser(), "auth_admin_ledger_closed");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses when the kernel interlocks were removed, before calling Auth", async () => {
    const environment: Record<string, string | undefined> = { ...ENV };
    const ledger = createProviderProbeCleanupLedger(environment);
    const createUser = echoCreate();
    const admin = createAuthAdminForTests({
      config: CONFIG,
      client: fakeClient(createUser),
      ledger,
      registry: createProviderProbeKnownValueRegistry(),
      ownedRecipients: createOwnedRecipientsForTests(CONFIG.runId),
    });

    delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    await expectCode(admin.createRunTaggedUser(), "auth_admin_ledger_closed");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses when the ledger has no capacity left", async () => {
    const createUser = echoCreate();
    const { ledger, admin } = setup(createUser);
    fillUsers(ledger, 10, "2222");

    await expectCode(admin.createRunTaggedUser(), "auth_admin_capacity_exceeded");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("refuses a second creation while one is in flight", async () => {
    let release: () => void = () => undefined;
    const createUser = vi.fn<CreateUser>(
      (attributes: Attributes) =>
        new Promise((resolve) => {
          release = () => resolve({ data: { user: { id: USER_ID, email: attributes.email } }, error: null });
        }),
    );
    const { ledger, admin } = setup(createUser);

    const first = admin.createRunTaggedUser();
    await expectCode(admin.createRunTaggedUser(), "auth_admin_busy");
    release();
    await first;

    expect(createUser).toHaveBeenCalledTimes(1);
    expect(ledger.recordedCounts().authUsers).toBe(1);
  });

  it("refuses a second admin's creation at the last unit of capacity, before its call", async () => {
    const ledger = createProviderProbeCleanupLedger(ENV);
    fillUsers(ledger, 9, "3333");
    let release: () => void = () => undefined;
    const firstCreate = vi.fn<CreateUser>(
      (attributes: Attributes) =>
        new Promise((resolve) => {
          release = () => resolve({ data: { user: { id: USER_ID, email: attributes.email } }, error: null });
        }),
    );
    const secondCreate = echoCreate(V7_ID);
    const registry = createProviderProbeKnownValueRegistry();
    const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
    const first = createAuthAdminForTests({ config: CONFIG, client: fakeClient(firstCreate), ledger, registry, ownedRecipients });
    const second = createAuthAdminForTests({ config: CONFIG, client: fakeClient(secondCreate), ledger, registry, ownedRecipients });

    const pending = first.createRunTaggedUser();
    await expectCode(second.createRunTaggedUser(), "auth_admin_capacity_exceeded");
    release();
    await pending;

    expect(secondCreate).not.toHaveBeenCalled();
    expect(ledger.recordedCounts().authUsers).toBe(10);
  });

  it("keeps cleanup from starting mid-creation, so the created user is still tracked and deleted", async () => {
    let release: () => void = () => undefined;
    const { ledger, admin } = setup(
      (attributes: Attributes) =>
        new Promise((resolve) => {
          release = () => resolve({ data: { user: { id: USER_ID, email: attributes.email } }, error: null });
        }),
    );
    const deleted: string[] = [];
    const deleters = {
      deleteAuthUser: async (id: string) => {
        deleted.push(id);
      },
      deleteMailpitMessage: async () => undefined,
    };

    const pending = admin.createRunTaggedUser();
    await expect(ledger.runCleanup(deleters)).rejects.toThrow("cleanup_ledger_creation_in_flight");
    release();
    await pending;
    const report = await ledger.runCleanup(deleters);

    expect(deleted).toEqual([USER_ID]);
    expect(report.outcome).toBe("complete");
  });

  it("releases its unit when the creation fails, so a later creation can use it", async () => {
    const ledger = createProviderProbeCleanupLedger(ENV);
    fillUsers(ledger, 9, "4444");
    const registry = createProviderProbeKnownValueRegistry();
    const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
    const failing = createAuthAdminForTests({
      config: CONFIG,
      client: fakeClient(async () => {
        throw new Error("transport failed");
      }),
      ledger,
      registry,
      ownedRecipients,
    });
    const working = createAuthAdminForTests({ config: CONFIG, client: fakeClient(echoCreate()), ledger, registry, ownedRecipients });

    await expectCode(failing.createRunTaggedUser(), "auth_admin_create_failed");
    expect(ledger.remainingCapacity("auth-user")).toBe(1);
    await working.createRunTaggedUser();

    expect(ledger.recordedCounts().authUsers).toBe(10);
    expect(ledger.remainingCapacity("auth-user")).toBe(0);
  });

  it("refuses wiring without a genuine registry, owned-recipient record or creation function", () => {
    const ledger = createProviderProbeCleanupLedger(ENV);
    const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
    expect(() =>
      createAuthAdminForTests({
        config: CONFIG,
        client: fakeClient(echoCreate()),
        ledger,
        registry: { register: () => undefined, size: () => 0 },
        ownedRecipients,
      }),
    ).toThrow("auth_admin_invalid_dependencies");
    expect(() =>
      createAuthAdminForTests({
        config: CONFIG,
        client: fakeClient(echoCreate()),
        ledger,
        registry: createProviderProbeKnownValueRegistry(),
        ownedRecipients: Object.freeze({}) as typeof ownedRecipients,
      }),
    ).toThrow("auth_admin_invalid_dependencies");
    expect(() =>
      createAuthAdminForTests({
        config: CONFIG,
        client: { auth: { admin: {} } } as unknown as ProviderProbeAuthAdminClient,
        ledger,
        registry: createProviderProbeKnownValueRegistry(),
        ownedRecipients,
      }),
    ).toThrow("auth_admin_invalid_dependencies");
  });
});

describe("failed creation results record nothing", () => {
  it("maps a thrown client error to one value-free code", async () => {
    const { ledger, admin } = setup(async () => {
      throw new Error(`CLIENTCANARY ${USER_ID}`);
    });

    const error = await expectCode(admin.createRunTaggedUser(), "auth_admin_create_failed");
    expect(String(error) + (error.stack ?? "") + JSON.stringify(error)).not.toContain("CLIENTCANARY");
    expect(ledger.recordedCounts().authUsers).toBe(0);
  });

  it("maps an error result to the same code", async () => {
    const { ledger, admin } = setup(async () => ({ data: { user: null }, error: { message: "ERRORCANARY" } }));

    await expectCode(admin.createRunTaggedUser(), "auth_admin_create_failed");
    expect(ledger.recordedCounts().authUsers).toBe(0);
  });

  it.each([
    { data: { user: { id: "11111111-1111-4111-8111-11111111111A" } }, error: null },
    { data: { user: { id: "00000000-0000-0000-0000-000000000000" } }, error: null },
    { data: { user: { id: "not-a-uuid" } }, error: null },
    { data: { user: null }, error: null },
    { data: null, error: null },
    null,
  ])("refuses an unusable success result %#", async (result) => {
    const { ledger, admin } = setup(async () => result);

    await expectCode(admin.createRunTaggedUser(), "auth_admin_create_unexpected_result");
    expect(ledger.recordedCounts().authUsers).toBe(0);
    expect(ledger.remainingCapacity("auth-user")).toBe(10);
  });
});
