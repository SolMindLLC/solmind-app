import http from "node:http";
import net from "node:net";
import type { AddressInfo, Socket } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderProbeAuthAdminError } from "./providerProbeAuthAdminCore";
import { createProviderProbeRun } from "./providerProbeRun";
import { createAuthUserDeleter, createMailpitMessageDeleter } from "./providerProbeRunCore";
import { createProviderProbeRunEnvelope } from "./providerProbeRunEnvelope";
import {
  createLoopbackFetchForTests,
  createRunForTests,
  gatedTestEnvironment,
  sequentialRandomForTests,
} from "./providerProbeTestSupport";

// The production composition root is exercised with plainly fake, in-memory
// environments and a fake key, and the network blocked by throwing spies. The run
// core (the same composition and deleter code) is exercised end to end over test
// transports to a mini HTTP server, written on a raw TCP server so that every request
// byte is counted, started here on a random 127.0.0.1 port and closed after each test.

const GATED = gatedTestEnvironment("composition");
const FAKE_KEY = "fake-service-role-key-for-tests-only";

type Exchange = { bytes: number; method: string; path: string; body: string };
type Reply = Readonly<{ status: number; body: string; contentType?: string }>;

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (closers.length > 0) {
    await closers.pop()!();
  }
});

function blockNetwork() {
  const requestSpy = vi.spyOn(http, "request").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  const connectSpy = vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  return { requestSpy, connectSpy };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// A minimal HTTP/1.1 responder on a raw TCP server: one request per connection, every
// received byte counted per connection.
async function startMiniServer(handler: (exchange: Exchange) => Reply) {
  const exchanges: Exchange[] = [];
  const sockets = new Set<Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    const exchange: Exchange = { bytes: 0, method: "", path: "", body: "" };
    exchanges.push(exchange);
    let buffer = Buffer.alloc(0);
    let answered = false;
    socket.on("data", (chunk: Buffer) => {
      exchange.bytes += chunk.byteLength;
      if (answered) {
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        return;
      }
      const [requestLine = "", ...headerLines] = buffer.subarray(0, headerEnd).toString("latin1").split("\r\n");
      const lengthLine = headerLines.find((line) => line.toLowerCase().startsWith("content-length:"));
      const length = lengthLine === undefined ? 0 : Number(lengthLine.slice(lengthLine.indexOf(":") + 1).trim());
      if (buffer.byteLength < headerEnd + 4 + length) {
        return;
      }
      const [method = "", path = ""] = requestLine.split(" ");
      exchange.method = method;
      exchange.path = path;
      exchange.body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString("utf8");
      answered = true;
      const reply = handler(exchange);
      const body = Buffer.from(reply.body, "utf8");
      socket.end(
        `HTTP/1.1 ${reply.status} OK\r\ncontent-type: ${reply.contentType ?? "application/json"}\r\n` +
          `content-length: ${body.byteLength}\r\nconnection: close\r\n\r\n${reply.body}`,
      );
    });
    socket.on("error", () => undefined);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  closers.push(
    () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  );
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, exchanges };
}

// A fake Auth admin plus mail catcher behind one origin.
async function startFakeServices() {
  const mailbox: Array<Record<string, unknown>> = [];
  let nextUser = 1;
  let onDelete: (exchange: Exchange) => void = () => undefined;
  const server = await startMiniServer((exchange) => {
    if (exchange.method === "POST" && exchange.path === "/auth/v1/admin/users") {
      const { email } = JSON.parse(exchange.body) as { email: string };
      const id = `${String(nextUser++).padStart(8, "0")}-6666-4666-8666-666666666666`;
      return { status: 200, body: JSON.stringify({ id, email, aud: "authenticated" }) };
    }
    if (exchange.method === "GET" && exchange.path.startsWith("/api/v1/messages?")) {
      const query = new URLSearchParams(exchange.path.slice(exchange.path.indexOf("?") + 1));
      const start = Number(query.get("start"));
      const limit = Number(query.get("limit"));
      return { status: 200, body: JSON.stringify({ total: mailbox.length, messages: mailbox.slice(start, start + limit) }) };
    }
    if (exchange.method === "DELETE") {
      onDelete(exchange);
      return exchange.path === "/api/v1/messages"
        ? { status: 200, body: "ok", contentType: "text/plain" }
        : { status: 200, body: "{}" };
    }
    return { status: 404, body: "{}" };
  });
  return {
    ...server,
    mailbox,
    onDelete(hook: (exchange: Exchange) => void) {
      onDelete = hook;
    },
  };
}

// The run core over test transports. `runEnvironment` drives the run and its ledger;
// the transports keep their own, separately gated environment, so a refusal below
// can only come from the ledger's own gate.
async function runOverTestTransports(runEnvironment: Record<string, string | undefined>) {
  const services = await startFakeServices();
  const transportEnvironment = { ...GATED };
  const run = createRunForTests({
    environment: runEnvironment,
    auth: {
      origin: services.origin,
      fetch: createLoopbackFetchForTests({
        environment: transportEnvironment,
        targets: [{ origin: services.origin, pathPrefixes: ["/auth/v1/"] }],
        maxResponseBytes: 65_536,
      }),
    },
    mailpit: {
      origin: services.origin,
      fetch: createLoopbackFetchForTests({
        environment: transportEnvironment,
        targets: [{ origin: services.origin, pathPrefixes: ["/api/v1/"] }],
        maxResponseBytes: 65_536,
      }),
    },
    random: sequentialRandomForTests(),
  });
  return { services, run };
}

// Two created users, one captured run-owned message and one external tagged message.
async function populate(run: Awaited<ReturnType<typeof runOverTestTransports>>["run"], services: Awaited<ReturnType<typeof startFakeServices>>) {
  const admin = run.createAuthAdmin(FAKE_KEY);
  const first = await admin.createRunTaggedUser();
  const second = await admin.createRunTaggedUser();
  const inventory = run.createMailpitInventory();
  await inventory.takeBaseline();
  services.mailbox.unshift(
    { ID: "ownedMessage01", To: [{ Address: first.email }] },
    { ID: "externalMsg001", To: [{ Address: "probe+p28-20261001-composition@synthetic.invalid" }] },
  );
  const capture = await inventory.captureNewRunOwnedMessages();
  return { first, second, capture };
}

function deletes(exchanges: readonly Exchange[], from: number): Exchange[] {
  return exchanges.slice(from).filter((exchange) => exchange.method === "DELETE");
}

describe("production run surface", () => {
  it.each([
    ["no interlocks", {}],
    ["only one interlock", { SOLMIND_PROVIDER_PROBE_APPROVAL: GATED.SOLMIND_PROVIDER_PROBE_APPROVAL }],
  ])("refuses to start with %s, touching no network", (_label, environment) => {
    const { requestSpy, connectSpy } = blockNetwork();

    expect(() => createProviderProbeRun(environment)).toThrow("provider_probe_run_ungated");
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("refuses enabled but unsafe settings with the kernel's own code", () => {
    expect(() => createProviderProbeRun({ ...GATED, SOLMIND_PROVIDER_PROBE_LIFETIME_MARGIN_SECONDS: "0" })).toThrow(
      "provider_probe_invalid_lifetime_margin",
    );
  });

  it("exposes no way to record, issue a receipt or supply a deleter", () => {
    const { requestSpy, connectSpy } = blockNetwork();

    const run = createProviderProbeRun(GATED);
    const admin = run.createAuthAdmin(FAKE_KEY);
    const inventory = run.createMailpitInventory();

    expect(Object.keys(run).sort()).toEqual([
      "assembleOutput",
      "cleanup",
      "cleanupCounts",
      "config",
      "createAuthAdmin",
      "createMailpitInventory",
      "knownValueCount",
      "registerKnownValue",
      "residueCounts",
      "retryCleanup",
    ]);
    expect(Object.keys(admin)).toEqual(["createRunTaggedUser"]);
    expect(Object.keys(inventory).sort()).toEqual(["captureNewRunOwnedMessages", "readCounts", "takeBaseline"]);
    expect(run.cleanup.length).toBe(0);
    expect(run.retryCleanup.length).toBe(0);
    expect(Object.isFrozen(run)).toBe(true);
    // The run's synthetic address and the key are registered automatically.
    expect(run.knownValueCount()).toBe(2);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("cleans up nothing it did not create, and re-checks the interlocks before cleaning", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const environment: Record<string, string | undefined> = { ...GATED };
    const run = createProviderProbeRun(environment);

    delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    await expect(run.cleanup()).rejects.toThrow("cleanup_ledger_gate_closed");
    environment.SOLMIND_PROVIDER_PROBE_APPROVAL = GATED.SOLMIND_PROVIDER_PROBE_APPROVAL;
    expect(await run.cleanup()).toMatchObject({ outcome: "not-needed", round: 1 });
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("refuses a malformed key and the undecided locked-down mail catcher", () => {
    blockNetwork();
    const run = createProviderProbeRun(GATED);
    const lockedDown = createProviderProbeRun(
      gatedTestEnvironment("composition", {
        SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
        SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
      }),
    );

    for (const key of ["", "short-key", "fake key with spaces in it"]) {
      expect(() => run.createAuthAdmin(key)).toThrow("provider_probe_run_invalid_key");
    }
    expect(() => lockedDown.createMailpitInventory()).toThrow("mailpit_origin_undecided");
  });

  it("refuses a creation without the interlocks, before any request", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const environment: Record<string, string | undefined> = { ...GATED };
    const admin = createProviderProbeRun(environment).createAuthAdmin(FAKE_KEY);

    delete environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
    const refused = await admin.createRunTaggedUser().catch((error: unknown) => error);

    expect((refused as ProviderProbeAuthAdminError).code).toBe("auth_admin_ledger_closed");
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("assembles output only against its own registry", () => {
    const run = createProviderProbeRun(GATED);
    const envelope = createProviderProbeRunEnvelope(run.config, {
      supabaseCliVersion: "2.115.0",
      supabaseJsVersion: "2.108.2",
      authJsVersion: "2.108.2",
      configDigest: `sha256:${"cd".repeat(32)}`,
    });

    expect(() => run.assembleOutput({ envelope, evidence: [] })).not.toThrow();
    run.registerKnownValue(run.config.runId);
    expect(() => run.assembleOutput({ envelope, evidence: [] })).toThrow("provider_probe_output_secret_pattern");
    expect(() => run.registerKnownValue("short")).toThrow("provider_probe_known_value_invalid");
  });
});

describe("run core over test transports (the production composition and deleters)", () => {
  it("creates users, captures only run-owned mail and cleans up through its fixed deleters", async () => {
    const { services, run } = await runOverTestTransports({ ...GATED });
    const { capture } = await populate(run, services);
    const before = services.exchanges.length;

    expect(capture).toEqual({ captured: 1, unownedRunTagged: 1, totalMessageCount: 2 });
    expect(run.cleanupCounts()).toEqual({ authUsers: 2, mailpitMessages: 1 });
    const report = await run.cleanup();

    expect(report).toMatchObject({ outcome: "complete", round: 1, gateClosedDuringRound: false });
    expect(deletes(services.exchanges, before).map((exchange) => [exchange.path, exchange.body])).toEqual([
      ["/auth/v1/admin/users/00000002-6666-4666-8666-666666666666", JSON.stringify({ should_soft_delete: false })],
      ["/auth/v1/admin/users/00000001-6666-4666-8666-666666666666", JSON.stringify({ should_soft_delete: false })],
      ["/api/v1/messages", '{"IDs":["ownedMessage01"]}'],
    ]);
    expect(services.exchanges.slice(before).every((exchange) => exchange.method === "DELETE")).toBe(true);
  });

  it("sends no byte when an interlock was removed after construction", async () => {
    const runEnvironment: Record<string, string | undefined> = { ...GATED };
    const { services, run } = await runOverTestTransports(runEnvironment);
    await populate(run, services);
    const connections = services.exchanges.length;
    const bytes = services.exchanges.reduce((sum, exchange) => sum + exchange.bytes, 0);

    delete runEnvironment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
    await expect(run.cleanup()).rejects.toThrow("cleanup_ledger_gate_closed");
    await wait(100);

    expect(services.exchanges.length).toBe(connections);
    expect(services.exchanges.reduce((sum, exchange) => sum + exchange.bytes, 0)).toBe(bytes);
    expect(run.cleanupCounts()).toEqual({ authUsers: 2, mailpitMessages: 1 });
  });

  it("lets the deletion in flight finish but sends no byte for a later one when an interlock is removed during it", async () => {
    const runEnvironment: Record<string, string | undefined> = { ...GATED };
    const { services, run } = await runOverTestTransports(runEnvironment);
    await populate(run, services);
    const before = services.exchanges.length;
    services.onDelete(() => {
      delete runEnvironment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    });

    const report = await run.cleanup();
    await wait(100);
    const afterRound = services.exchanges.slice(before);

    expect(afterRound).toHaveLength(1);
    expect(afterRound[0]!.method).toBe("DELETE");
    expect(afterRound[0]!.bytes).toBeGreaterThan(0);
    expect(report).toMatchObject({
      outcome: "failed",
      gateClosedDuringRound: true,
      residue: { authUsers: 1, mailpitMessages: 1 },
      retryAllowed: true,
    });
    expect(report.items.map((item) => item.outcome)).toEqual(["deleted", "not-attempted", "not-attempted"]);

    await expect(run.retryCleanup()).rejects.toThrow("cleanup_ledger_gate_closed");
    await wait(50);
    expect(services.exchanges.slice(before)).toHaveLength(1);

    services.onDelete(() => undefined);
    runEnvironment.SOLMIND_PROVIDER_PROBE_APPROVAL = GATED.SOLMIND_PROVIDER_PROBE_APPROVAL;
    const retry = await run.retryCleanup();
    expect(retry).toMatchObject({ outcome: "complete", round: 2 });
    expect(deletes(services.exchanges, before).map((exchange) => exchange.path)).toEqual([
      "/auth/v1/admin/users/00000002-6666-4666-8666-666666666666",
      "/auth/v1/admin/users/00000001-6666-4666-8666-666666666666",
      "/api/v1/messages",
    ]);
  });
});

describe("the fixed deleters", () => {
  async function mailDeleter(status = 200) {
    const server = await startMiniServer(() => ({ status, body: "ok", contentType: "text/plain" }));
    const deleter = createMailpitMessageDeleter({
      origin: server.origin,
      fetch: createLoopbackFetchForTests({ environment: GATED, targets: [{ origin: server.origin, pathPrefixes: ["/api/v1/"] }] }),
    });
    return { server, deleter };
  }

  it.each(["", "short", "has space1", "a".repeat(65), "../x/abcdefg"])(
    "refuses Mailpit id %j before any byte is sent",
    async (id) => {
      const { server, deleter } = await mailDeleter();

      await expect(deleter(id)).rejects.toThrow("cleanup_delete_invalid_id");
      await wait(50);
      expect(server.exchanges).toHaveLength(0);
    },
  );

  it("deletes exactly one Mailpit message per call, never an empty list", async () => {
    const { server, deleter } = await mailDeleter();

    await deleter("validMessage01");

    expect(server.exchanges).toHaveLength(1);
    expect(server.exchanges[0]).toMatchObject({ method: "DELETE", path: "/api/v1/messages", body: '{"IDs":["validMessage01"]}' });
  });

  it("reports a refused Mailpit delete as one value-free failure", async () => {
    const { deleter } = await mailDeleter(500);

    await expect(deleter("validMessage01")).rejects.toThrow("cleanup_delete_failed");
  });

  it("deletes one Auth user by exact id, refusing anything else before the call", async () => {
    const deleteUser = vi.fn<(id: string) => Promise<unknown>>(async () => ({ data: { user: null }, error: null }));
    const deleter = createAuthUserDeleter({ auth: { admin: { deleteUser } } });

    await deleter("11111111-1111-4111-8111-111111111111");
    for (const id of ["", "not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
      await expect(deleter(id)).rejects.toThrow("cleanup_delete_invalid_id");
    }

    expect(deleteUser.mock.calls).toEqual([["11111111-1111-4111-8111-111111111111"]]);
  });

  it("reports a failed Auth delete as one value-free failure", async () => {
    const failing = createAuthUserDeleter({
      auth: { admin: { deleteUser: async () => ({ data: { user: null }, error: { message: "ERRORCANARY" } }) } },
    });
    const throwing = createAuthUserDeleter({
      auth: {
        admin: {
          deleteUser: async () => {
            throw new Error("THROWCANARY");
          },
        },
      },
    });

    for (const deleter of [failing, throwing]) {
      const error = await deleter("11111111-1111-4111-8111-111111111111").catch((caught: unknown) => caught);
      expect((error as Error).message).toBe("cleanup_delete_failed");
    }
  });
});
