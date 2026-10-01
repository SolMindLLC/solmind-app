import http from "node:http";
import type { ClientRequestArgs, IncomingHttpHeaders, IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import net from "node:net";
import type { AddressInfo, Socket } from "node:net";
import type { Duplex } from "node:stream";
import { inspect } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isExpectedLoopbackPeer,
  LoopbackFetchError,
  type LoopbackFetch,
  type LoopbackFetchErrorCode,
  type LoopbackFetchTarget,
  type LoopbackHttpRequestFunction,
} from "./providerProbeLoopbackCore";
import {
  createProviderProbeAuthFetch,
  createProviderProbeMailpitFetch,
} from "./providerProbeLoopbackFetch";
import { createLoopbackFetchForTests, gatedTestEnvironment, testConfig } from "./providerProbeTestSupport";

// Every server in this file is started by the test itself on 127.0.0.1 (or ::1)
// with an operating-system-chosen port, and is closed again after each test. The
// production factories are never given an allowed-path request: their tests block
// `http.request` and `net.Socket.prototype.connect` and use refused paths only.

type RecordedRequest = Readonly<{
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}>;

type TestHttpServer = Readonly<{
  origin: string;
  port: number;
  connections(): number;
  requests: RecordedRequest[];
}>;

type TestRawServer = Readonly<{
  origin: string;
  connections(): number;
  bytesReceived(): number;
}>;

const GATED = gatedTestEnvironment("transport");
const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (closers.length > 0) {
    await closers.pop()!();
  }
});

async function listen(server: net.Server, host: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

function originFor(host: "127.0.0.1" | "::1", port: number): string {
  return host === "::1" ? `http://[::1]:${port}` : `http://127.0.0.1:${port}`;
}

async function startHttpServer(
  handler: (request: IncomingMessage, response: ServerResponse, body: string) => void,
  host: "127.0.0.1" | "::1" = "127.0.0.1",
): Promise<TestHttpServer> {
  let connections = 0;
  const requests: RecordedRequest[] = [];
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: request.method ?? "", url: request.url ?? "", headers: request.headers, body });
      handler(request, response, body);
    });
  });
  server.on("connection", () => {
    connections += 1;
  });
  const port = await listen(server, host);
  closers.push(
    () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  return { origin: originFor(host, port), port, connections: () => connections, requests };
}

// A raw TCP server counts every byte that reaches it; an http.Server would hide them.
async function startRawServer(): Promise<TestRawServer> {
  let connections = 0;
  let bytes = 0;
  const sockets = new Set<Socket>();
  const server = net.createServer((socket) => {
    connections += 1;
    sockets.add(socket);
    socket.on("data", (chunk: Buffer) => {
      bytes += chunk.byteLength;
    });
    socket.on("error", () => undefined);
    socket.on("close", () => sockets.delete(socket));
  });
  const port = await listen(server, "127.0.0.1");
  closers.push(
    () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  );
  return { origin: originFor("127.0.0.1", port), connections: () => connections, bytesReceived: () => bytes };
}

async function closedPortOrigin(): Promise<string> {
  const server = net.createServer();
  const port = await listen(server, "127.0.0.1");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return originFor("127.0.0.1", port);
}

function testFetch(
  origin: string,
  overrides: Partial<{
    environment: Readonly<Record<string, string | undefined>>;
    targets: readonly LoopbackFetchTarget[];
    timeoutMilliseconds: number;
    maxRequestBytes: number;
    maxResponseBytes: number;
    request: LoopbackHttpRequestFunction;
  }> = {},
): LoopbackFetch {
  return createLoopbackFetchForTests({
    environment: GATED,
    targets: [{ origin, pathPrefixes: ["/auth/v1/"] }],
    ...overrides,
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    ...headers,
  });
  response.end(body);
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return await promise.then(
    () => {
      throw new Error("expected the loopback fetch to reject");
    },
    (error: unknown) => error,
  );
}

async function expectCode(promise: Promise<unknown>, code: LoopbackFetchErrorCode): Promise<LoopbackFetchError> {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(LoopbackFetchError);
  expect((error as LoopbackFetchError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  return error as LoopbackFetchError;
}

function expectValueFree(error: unknown, canaries: readonly string[]): void {
  const rendered = [
    inspect(error, { showHidden: true, depth: 8 }),
    JSON.stringify(error),
    String(error),
    (error as Error).stack ?? "",
  ].join("\n");
  for (const canary of canaries) {
    expect(rendered).not.toContain(canary);
  }
  expect((error as Error).cause).toBeUndefined();
  expect(Object.keys(error as object).sort()).toEqual(["code", "name"]);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function spoofingRequest(
  spoof: Readonly<{ remoteAddress?: string; remotePort?: number }>,
  onlyCallNumber?: number,
): LoopbackHttpRequestFunction {
  let calls = 0;
  return (options: RequestOptions) => {
    calls += 1;
    const request = http.request(options);
    if (onlyCallNumber === undefined || onlyCallNumber === calls) {
      request.on("socket", (socket: Socket) => {
        if (spoof.remoteAddress !== undefined) {
          Object.defineProperty(socket, "remoteAddress", { configurable: true, get: () => spoof.remoteAddress });
        }
        if (spoof.remotePort !== undefined) {
          Object.defineProperty(socket, "remotePort", { configurable: true, get: () => spoof.remotePort });
        }
      });
    }
    return request;
  };
}

// A request function whose connection starts only after a delay, through a test-only
// agent. `atConnect` runs when the delay ends, after the transport's entry check has
// passed and just after the socket starts connecting, before it has connected.
function delayedConnectionRequest(
  delayMilliseconds: number,
  atConnect: (socket: Socket) => void,
): LoopbackHttpRequestFunction {
  class DelayedConnectionAgent extends http.Agent {
    override createConnection(
      options: ClientRequestArgs,
      callback?: (error: Error | null, stream: Duplex) => void,
    ): Duplex | null | undefined {
      setTimeout(() => {
        const socket = net.createConnection(options as net.NetConnectOpts);
        atConnect(socket);
        callback?.(null, socket);
      }, delayMilliseconds);
      return undefined;
    }
  }
  return (options: RequestOptions) => http.request({ ...options, agent: new DelayedConnectionAgent() });
}

// Throwing guards: if any production path tried to reach the network, the attempt
// fails here instead of reaching a real local stack.
function blockNetwork() {
  const requestSpy = vi.spyOn(http, "request").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  const connectSpy = vi.spyOn(net.Socket.prototype, "connect").mockImplementation(() => {
    throw new Error("network blocked in this test");
  });
  return { requestSpy, connectSpy };
}

const FAKE_KEY = "fake-key-for-loopback-tests-only";

describe("the gate on every request (shared core, counted at a raw server)", () => {
  it("sends zero bytes when the kernel interlocks are absent", async () => {
    const raw = await startRawServer();
    const fetch = testFetch(raw.origin, { environment: {} });

    await expectCode(
      fetch(`${raw.origin}/auth/v1/admin/users`, { method: "POST", headers: { authorization: "Bearer x" }, body: "{}" }),
      "loopback_fetch_ungated",
    );
    await wait(100);

    expect(raw.connections()).toBe(0);
    expect(raw.bytesReceived()).toBe(0);
  });

  it("sends zero bytes when an interlock is removed after construction", async () => {
    const raw = await startRawServer();
    const environment: Record<string, string | undefined> = { ...GATED };
    const fetch = testFetch(raw.origin, { environment });
    delete environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;

    await expectCode(fetch(`${raw.origin}/auth/v1/user`, { method: "DELETE" }), "loopback_fetch_ungated");
    await wait(100);

    expect(raw.connections()).toBe(0);
    expect(raw.bytesReceived()).toBe(0);
  });

  it("positive control: with the interlocks present the same raw server does receive bytes", async () => {
    const raw = await startRawServer();
    const fetch = testFetch(raw.origin, { timeoutMilliseconds: 200 });

    await expectCode(fetch(`${raw.origin}/auth/v1/user`, { method: "POST", body: "{}" }), "loopback_fetch_timeout");

    expect(raw.connections()).toBe(1);
    expect(raw.bytesReceived()).toBeGreaterThan(0);
  });

  it("positive control: a spy installed before construction sees the core's request function", async () => {
    const requestSpy = vi.spyOn(http, "request");
    const server = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const fetch = testFetch(server.origin);

    await fetch(`${server.origin}/auth/v1/user`);

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it("sends zero request bytes when an interlock is removed while a delayed connection is still connecting", async () => {
    const raw = await startRawServer();
    const environment: Record<string, string | undefined> = { ...GATED };
    const connectingAtRemoval: boolean[] = [];
    const fetch = testFetch(raw.origin, {
      environment,
      request: delayedConnectionRequest(50, (socket) => {
        connectingAtRemoval.push(socket.connecting);
        delete environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS;
      }),
    });

    const pending = fetch(`${raw.origin}/auth/v1/admin/users`, {
      method: "POST",
      headers: { authorization: "Bearer x" },
      body: "{}",
    });
    // The entry check ran inside that call, with both interlocks present.
    expect(connectingAtRemoval).toEqual([]);
    expect(environment.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS).toBe(GATED.SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS);

    await expectCode(pending, "loopback_fetch_ungated");
    await wait(100);

    expect(connectingAtRemoval).toEqual([true]);
    // The connection itself was made, so the refusal came from the check before the
    // first write, not from the entry check.
    expect(raw.connections()).toBe(1);
    expect(raw.bytesReceived()).toBe(0);
  });

  it("positive control: the same delayed connection with the interlocks kept does receive bytes", async () => {
    const raw = await startRawServer();
    const connectingAtDelayEnd: boolean[] = [];
    const fetch = testFetch(raw.origin, {
      timeoutMilliseconds: 300,
      request: delayedConnectionRequest(50, (socket) => connectingAtDelayEnd.push(socket.connecting)),
    });

    await expectCode(fetch(`${raw.origin}/auth/v1/admin/users`, { method: "POST", body: "{}" }), "loopback_fetch_timeout");

    expect(connectingAtDelayEnd).toEqual([true]);
    expect(raw.connections()).toBe(1);
    expect(raw.bytesReceived()).toBeGreaterThan(0);
  });
});

describe("production factories: gated construction", () => {
  it.each([
    ["no interlocks", {}],
    ["only the approval interlock", { SOLMIND_PROVIDER_PROBE_APPROVAL: GATED.SOLMIND_PROVIDER_PROBE_APPROVAL }],
    ["a near-miss effect interlock", { ...GATED, SOLMIND_PROVIDER_PROBE_ALLOW_LOCAL_EFFECTS: "approved" }],
  ])("refuses to build either fetch with %s, touching no network", (_label, environment) => {
    const { requestSpy, connectSpy } = blockNetwork();

    expect(() => createProviderProbeAuthFetch(environment)).toThrow("loopback_fetch_ungated");
    expect(() => createProviderProbeMailpitFetch(environment)).toThrow("loopback_fetch_ungated");
    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("refuses enabled but unsafe settings with the kernel's own code", () => {
    blockNetwork();
    const unsafe = { ...GATED, SOLMIND_LOCAL_SUPABASE_URL: "http://localhost:54321" };

    expect(() => createProviderProbeAuthFetch(unsafe)).toThrow("provider_probe_non_loopback_or_ambiguous_url");
    expect(() => createProviderProbeMailpitFetch(unsafe)).toThrow("provider_probe_non_loopback_or_ambiguous_url");
  });

  it("refuses the locked-down mail catcher, whose origin is undecided", () => {
    blockNetwork();
    const lockedDown = gatedTestEnvironment("transport", {
      SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
      SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
    });

    expect(() => createProviderProbeMailpitFetch(lockedDown)).toThrow("mailpit_origin_undecided");
  });

  it("checks the interlocks first on every request, before even the target", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const environment: Record<string, string | undefined> = { ...GATED };
    const fetch = createProviderProbeAuthFetch(environment);

    delete environment.SOLMIND_PROVIDER_PROBE_APPROVAL;
    await expectCode(fetch("http://127.0.0.1:54321/rest/v1/probe"), "loopback_fetch_ungated");
    environment.SOLMIND_PROVIDER_PROBE_APPROVAL = GATED.SOLMIND_PROVIDER_PROBE_APPROVAL;
    environment.SOLMIND_PROVIDER_PROBE_RUN_ID = "P28-20261001-another-run";
    environment.SOLMIND_PROVIDER_PROBE_SYNTHETIC_EMAIL = "probe+p28-20261001-another-run@synthetic.invalid";
    await expectCode(fetch("http://127.0.0.1:54321/rest/v1/probe"), "loopback_fetch_ungated");

    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});

describe("production factories: fixed targets under every construction", () => {
  const authConstructions = [
    ["current-config, IPv4", GATED],
    ["current-config, IPv6", gatedTestEnvironment("transport", { SOLMIND_LOCAL_SUPABASE_URL: "http://[::1]:54321" })],
    [
      "locked-down, IPv4",
      gatedTestEnvironment("transport", {
        SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
        SOLMIND_LOCAL_SUPABASE_URL: "http://127.0.0.1:55421",
      }),
    ],
    [
      "locked-down, IPv6",
      gatedTestEnvironment("transport", {
        SOLMIND_PROVIDER_PROBE_PROFILE: "locked-down",
        SOLMIND_LOCAL_SUPABASE_URL: "http://[::1]:55421",
      }),
    ],
  ] as const;
  const mailConstructions = [
    ["current-config, IPv4", GATED],
    ["current-config, IPv6", gatedTestEnvironment("transport", { SOLMIND_LOCAL_SUPABASE_URL: "http://[::1]:54321" })],
  ] as const;

  async function expectRefusedEverywhere(
    fetch: LoopbackFetch,
    apiOrigin: string,
    otherOrigins: readonly string[],
  ): Promise<void> {
    for (const url of [
      `${apiOrigin}/rest/v1/probe_never_read`,
      `${apiOrigin}/rest/v1/rpc/solmind_probe_never_called`,
      `${apiOrigin}/auth/v1/../rest/v1/rpc/solmind_probe_never_called`,
      `${apiOrigin}/storage/v1/object`,
      ...otherOrigins.map((origin) => `${origin}/auth/v1/user`),
      ...otherOrigins.map((origin) => `${origin}/api/v1/messages`),
    ]) {
      await expectCode(fetch(url, { method: "POST", body: "{}" }), "loopback_fetch_target_refused");
    }
    const client = createClient(apiOrigin, FAKE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch },
    });
    const rpc = await client.rpc("solmind_probe_never_called");
    // postgrest-js retries a failed GET with back-off by default; one attempt is enough here.
    const table = await client.from("probe_never_read").select("*").retry(false);
    expect(rpc.error).not.toBeNull();
    expect(table.error).not.toBeNull();
  }

  it.each(authConstructions)(
    "the Auth fetch (%s) refuses PostgREST, a table read, a solmind_* RPC and every other origin",
    async (_label, environment) => {
      const { requestSpy, connectSpy } = blockNetwork();
      const fetch = createProviderProbeAuthFetch(environment);
      const apiOrigin = testConfig(environment).localSupabaseUrl;
      const host = new URL(apiOrigin).hostname;

      await expectRefusedEverywhere(fetch, apiOrigin, [`http://${host}:54324`, "http://127.0.0.1:54322"]);
      await expectCode(fetch(`${apiOrigin}/api/v1/messages`), "loopback_fetch_target_refused");

      expect(requestSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
    },
  );

  it.each(mailConstructions)(
    "the Mailpit fetch (%s) refuses PostgREST, a table read, a solmind_* RPC and the Auth API",
    async (_label, environment) => {
      const { requestSpy, connectSpy } = blockNetwork();
      const fetch = createProviderProbeMailpitFetch(environment);
      const apiOrigin = testConfig(environment).localSupabaseUrl;
      const mailOrigin = `http://${new URL(apiOrigin).hostname}:54324`;

      await expectRefusedEverywhere(fetch, apiOrigin, [mailOrigin.replace("54324", "54325")]);
      await expectCode(fetch(`${apiOrigin}/auth/v1/user`), "loopback_fetch_target_refused");
      await expectCode(fetch(`${mailOrigin}/rest/v1/probe_never_read`), "loopback_fetch_target_refused");
      await expectCode(fetch(`${mailOrigin}/auth/v1/user`), "loopback_fetch_target_refused");

      expect(requestSpy).not.toHaveBeenCalled();
      expect(connectSpy).not.toHaveBeenCalled();
    },
  );

  it("ignores any attempt to pass wider targets or a request function to a production factory", async () => {
    const { requestSpy, connectSpy } = blockNetwork();
    const widen = { targets: [{ origin: "http://127.0.0.1:54321", pathPrefixes: ["/rest/v1/"] }], request: http.request };
    const authFetch = (createProviderProbeAuthFetch as (...args: unknown[]) => LoopbackFetch)(GATED, widen);
    const mailFetch = (createProviderProbeMailpitFetch as (...args: unknown[]) => LoopbackFetch)(GATED, widen);

    await expectCode(authFetch("http://127.0.0.1:54321/rest/v1/probe_never_read"), "loopback_fetch_target_refused");
    await expectCode(mailFetch("http://127.0.0.1:54321/rest/v1/probe_never_read"), "loopback_fetch_target_refused");

    expect(requestSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});

describe("core transport options (through the test-only factory)", () => {
  it.each([
    "http://localhost:54321",
    "https://127.0.0.1:54321",
    "http://127.0.0.2:54321",
    "http://0.0.0.0:54321",
    "http://[::ffff:127.0.0.1]:54321",
    "http://example.com:54321",
    "http://127.0.0.1",
    "http://127.0.0.1:54321/",
    "http://user:pw@127.0.0.1:54321",
    "not a url",
  ])("refuses target origin %s", (origin) => {
    expect(() => testFetch(origin)).toThrow("loopback_fetch_invalid_options");
  });

  it.each([
    [[]],
    [["/"]],
    [["/auth/v1"]],
    [["auth/v1/"]],
    [["/auth/../v1/"]],
    [["/auth//v1/"]],
    [["/Auth/v1/"]],
    [["/a/", "/b/", "/c/", "/d/", "/e/", "/f/", "/g/", "/h/", "/i/"]],
  ])("refuses path prefixes %j", (pathPrefixes) => {
    expect(() => testFetch("http://127.0.0.1:54321", { targets: [{ origin: "http://127.0.0.1:54321", pathPrefixes }] })).toThrow(
      "loopback_fetch_invalid_options",
    );
  });

  it.each([
    { timeoutMilliseconds: 49 },
    { timeoutMilliseconds: 30_001 },
    { timeoutMilliseconds: 100.5 },
    { maxRequestBytes: -1 },
    { maxRequestBytes: 65_537 },
    { maxResponseBytes: 0 },
    { maxResponseBytes: 1_048_577 },
    { targets: [] },
    {
      targets: [
        { origin: "http://127.0.0.1:54321", pathPrefixes: ["/auth/v1/"] },
        { origin: "http://127.0.0.1:54321", pathPrefixes: ["/api/v1/"] },
      ],
    },
  ])("refuses bounds or targets %j", (change) => {
    expect(() => testFetch("http://127.0.0.1:54321", change)).toThrow("loopback_fetch_invalid_options");
  });
});

describe("core refusals happen before any connection", () => {
  it("refuses every non-allowlisted target, method, header and body without connecting", async () => {
    const server = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const fetch = testFetch(server.origin);
    const auth = `${server.origin}/auth/v1`;

    await expectCode(fetch(`http://localhost:${server.port}/auth/v1/user`), "loopback_fetch_target_refused");
    await expectCode(fetch(`http://127.0.0.2:${server.port}/auth/v1/user`), "loopback_fetch_target_refused");
    await expectCode(fetch(`https://127.0.0.1:${server.port}/auth/v1/user`), "loopback_fetch_target_refused");
    await expectCode(fetch(`http://127.0.0.1:${server.port + 1}/auth/v1/user`), "loopback_fetch_target_refused");
    await expectCode(fetch(`http://user:pw@127.0.0.1:${server.port}/auth/v1/user`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${auth}/user#fragment`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${server.origin}/rest/v1/rpc/solmind_probe`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${auth}/../../rest/v1/rpc/solmind_probe`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${auth}/%2e%2e/%2e%2e/rest/v1/rpc/solmind_probe`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${auth}/..%2F..%2Frest/v1/rpc`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${auth}\\..\\..\\rest\\v1`), "loopback_fetch_target_refused");
    await expectCode(fetch(`${server.origin}/auth/v1`), "loopback_fetch_target_refused");
    await expectCode(fetch("not a url"), "loopback_fetch_target_refused");
    await expectCode(fetch(new Request(`${auth}/user`)), "loopback_fetch_unsupported_input");

    for (const method of ["PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"]) {
      await expectCode(fetch(`${auth}/user`, { method }), "loopback_fetch_method_refused");
    }
    for (const name of ["host", "transfer-encoding", "connection", "proxy-authorization", "content-length"]) {
      await expectCode(fetch(`${auth}/user`, { method: "POST", headers: { [name]: "x" } }), "loopback_fetch_header_refused");
    }
    const headerError = await expectCode(
      fetch(`${auth}/user`, { headers: { "x-probe": "HEADERCANARY\r\nInjected: yes" } }),
      "loopback_fetch_header_refused",
    );
    expectValueFree(headerError, ["HEADERCANARY", "Injected"]);

    await expectCode(fetch(`${auth}/user`, { method: "GET", body: "x" }), "loopback_fetch_body_refused");
    await expectCode(fetch(`${auth}/user`, { method: "POST", body: new Blob(["x"]) }), "loopback_fetch_body_refused");
    await expectCode(
      fetch(`${auth}/user`, { method: "POST", body: new URLSearchParams({ a: "b" }) }),
      "loopback_fetch_body_refused",
    );
    await expectCode(fetch(`${auth}/user`, { method: "POST", body: "x".repeat(4_097) }), "loopback_fetch_body_too_large");
    const aborted = new AbortController();
    aborted.abort();
    await expectCode(fetch(`${auth}/user`, { signal: aborted.signal }), "loopback_fetch_aborted");

    expect(server.connections()).toBe(0);
    expect(server.requests).toHaveLength(0);
  });
});

describe("core round trips", () => {
  it("returns status, headers and body, forwarding only what the caller sent", async () => {
    const server = await startHttpServer((_request, response) =>
      sendJson(response, 201, { ok: true }, {
        location: "http://127.0.0.1:1/LOCATIONCANARY",
        "set-cookie": "sb=COOKIECANARY",
        "x-total-count": "0",
      }),
    );
    const fetch = testFetch(server.origin);

    const response = await fetch(`${server.origin}/auth/v1/admin/users?page=1&per_page=5`, {
      headers: { apikey: FAKE_KEY, "x-probe": "1" },
    });

    expect(response.status).toBe(201);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("x-total-count")).toBe("0");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]).toMatchObject({ method: "GET", url: "/auth/v1/admin/users?page=1&per_page=5", body: "" });
    expect(server.requests[0]!.headers).toMatchObject({
      host: `127.0.0.1:${server.port}`,
      "accept-encoding": "identity",
      apikey: FAKE_KEY,
      "x-probe": "1",
    });
    expect(server.requests[0]!.headers["content-length"]).toBeUndefined();
  });

  it("sends an exact string body with its byte length and accepts Headers and entry forms", async () => {
    const server = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const fetch = testFetch(server.origin);
    // One two-byte UTF-8 character proves the length is counted in bytes, not characters.
    const body = JSON.stringify({ email: "probe@synthetic.invalid", note: String.fromCodePoint(0xe9) });

    await fetch(`${server.origin}/auth/v1/otp`, { method: "post", headers: new Headers({ "content-type": "application/json" }), body });
    await fetch(`${server.origin}/auth/v1/logout?scope=local`, { method: "POST", headers: [["x-probe", "2"]] });
    await fetch(`${server.origin}/auth/v1/user`, { method: "PUT", body: new TextEncoder().encode("bytes") });

    expect(server.requests.map((request) => request.method)).toEqual(["POST", "POST", "PUT"]);
    expect(server.requests[0]!.body).toBe(body);
    expect(server.requests[0]!.headers["content-length"]).toBe(String(Buffer.byteLength(body)));
    expect(server.requests[0]!.headers["content-type"]).toBe("application/json");
    expect(server.requests[1]!.headers["content-length"]).toBe("0");
    expect(server.requests[1]!.headers["x-probe"]).toBe("2");
    expect(server.requests[2]!.body).toBe("bytes");
  });

  it("returns non-2xx responses for the caller to classify, and null bodies for 204", async () => {
    let next = 404;
    const server = await startHttpServer((_request, response) => {
      if (next === 204) {
        response.writeHead(204);
        response.end();
        return;
      }
      sendJson(response, next, { code: "not_found" });
    });
    const fetch = testFetch(server.origin);

    const missing = await fetch(`${server.origin}/auth/v1/user`);
    expect(missing.ok).toBe(false);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: "not_found" });

    next = 204;
    const empty = await fetch(`${server.origin}/auth/v1/logout`, { method: "POST" });
    expect(empty.status).toBe(204);
    expect(empty.body).toBeNull();
  });

  it("opens a fresh connection for every request", async () => {
    const server = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const fetch = testFetch(server.origin);

    for (let index = 0; index < 3; index += 1) {
      await fetch(`${server.origin}/auth/v1/user`);
    }

    expect(server.requests).toHaveLength(3);
    expect(server.connections()).toBe(3);
  });

  it("reaches an IPv6 loopback server when the host has one", async (context) => {
    let server: TestHttpServer;
    try {
      server = await startHttpServer((_request, response) => sendJson(response, 200, { v6: true }), "::1");
    } catch {
      context.skip();
      return;
    }
    const fetch = testFetch(server.origin);

    const response = await fetch(`${server.origin}/auth/v1/user`);

    expect(await response.json()).toEqual({ v6: true });
    expect(server.requests[0]!.headers.host).toBe(`[::1]:${server.port}`);
  });
});

describe("core peer verification", () => {
  const expected = { address: "127.0.0.1", port: 54321 } as const;

  it.each([
    ["127.0.0.1", 54321, true],
    ["::ffff:127.0.0.1", 54321, false],
    ["127.0.0.2", 54321, false],
    ["10.0.0.1", 54321, false],
    ["::1", 54321, false],
    ["127.0.0.1", 54322, false],
    [undefined, 54321, false],
    ["127.0.0.1", undefined, false],
  ])("peer %s:%s matches=%s", (address, port, matches) => {
    expect(isExpectedLoopbackPeer(address, port, expected)).toBe(matches);
  });

  it.each([[{ remoteAddress: "10.0.0.1" }], [{ remoteAddress: "::ffff:127.0.0.1" }], [{ remotePort: 1 }]])(
    "refuses a connection whose peer is %j and sends it no byte",
    async (spoof) => {
      const raw = await startRawServer();
      const fetch = testFetch(raw.origin, { request: spoofingRequest(spoof) });

      const error = await expectCode(
        fetch(`${raw.origin}/auth/v1/user?q=QUERYCANARY`, {
          method: "POST",
          headers: { "x-probe": "HEADERCANARY" },
          body: "BODYCANARY",
        }),
        "loopback_fetch_peer_mismatch",
      );
      await wait(100);

      expect(raw.connections()).toBe(1);
      expect(raw.bytesReceived()).toBe(0);
      expectValueFree(error, ["QUERYCANARY", "HEADERCANARY", "BODYCANARY", "10.0.0.1", "::ffff"]);
    },
  );

  it("checks the peer again on each new connection", async () => {
    const server = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const fetch = testFetch(server.origin, { request: spoofingRequest({ remoteAddress: "10.0.0.1" }, 2) });

    await fetch(`${server.origin}/auth/v1/user`);
    await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_peer_mismatch");
    await fetch(`${server.origin}/auth/v1/user`);

    expect(server.requests).toHaveLength(2);
    expect(server.connections()).toBe(3);
  });
});

describe("core redirects", () => {
  it.each([300, 301, 302, 303, 304, 307, 308])("fails status %i without following or reading Location", async (status) => {
    const elsewhere = await startHttpServer((_request, response) => sendJson(response, 200, {}));
    const server = await startHttpServer((_request, response) => {
      response.writeHead(status, {
        location: `${elsewhere.origin}/auth/v1/landed?token=LOCATIONCANARY`,
        "content-type": "text/plain",
      });
      response.end(status === 304 ? undefined : "REDIRECTBODYCANARY");
    });
    const fetch = testFetch(server.origin, {
      targets: [
        { origin: server.origin, pathPrefixes: ["/auth/v1/"] },
        { origin: elsewhere.origin, pathPrefixes: ["/auth/v1/"] },
      ],
    });

    const error = await expectCode(
      fetch(`${server.origin}/auth/v1/verify`, { method: "POST", body: "{}", redirect: "follow" }),
      "loopback_fetch_redirect_refused",
    );

    expect(server.requests).toHaveLength(1);
    expect(elsewhere.connections()).toBe(0);
    expectValueFree(error, ["LOCATIONCANARY", "REDIRECTBODYCANARY", "landed"]);
  });
});

describe("core bounds and failures", () => {
  it("fails at the deadline when the server never answers", async () => {
    const server = await startHttpServer(() => undefined);
    const fetch = testFetch(server.origin, { timeoutMilliseconds: 200 });
    const started = Date.now();

    await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_timeout");

    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("fails when the caller aborts in flight", async () => {
    const server = await startHttpServer(() => undefined);
    const fetch = testFetch(server.origin);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    await expectCode(fetch(`${server.origin}/auth/v1/user`, { signal: controller.signal }), "loopback_fetch_aborted");
  });

  it("fails an over-long declared body before reading it", async () => {
    const server = await startHttpServer((_request, response) => {
      response.writeHead(200, { "content-length": "5000" });
      response.end("y".repeat(5_000));
    });
    const fetch = testFetch(server.origin);

    await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_response_too_large");
  });

  it("fails an over-long streamed body while reading it", async () => {
    const server = await startHttpServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.write("z".repeat(2_000));
      response.write("z".repeat(2_000));
      response.end("z".repeat(2_000));
    });
    const fetch = testFetch(server.origin);

    await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_response_too_large");
  });

  it("refuses a compressed response body", async () => {
    const server = await startHttpServer((_request, response) => {
      response.writeHead(200, { "content-encoding": "gzip", "content-length": "2" });
      response.end("xx");
    });
    const fetch = testFetch(server.origin);

    await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_encoding_refused");
  });

  it("reports a refused connection without the URL, header values, body or peer", async () => {
    const origin = await closedPortOrigin();
    const fetch = testFetch(origin);

    const error = await expectCode(
      fetch(`${origin}/auth/v1/token?grant_type=QUERYCANARY`, {
        method: "POST",
        headers: { authorization: "Bearer HEADERCANARY" },
        body: "BODYCANARY",
      }),
      "loopback_fetch_connection_failed",
    );

    expectValueFree(error, ["QUERYCANARY", "HEADERCANARY", "BODYCANARY", "ECONNREFUSED", "127.0.0.1", origin]);
  });

  it("reports a response cut off mid-body without its content", async () => {
    const server = await startHttpServer((_request, response) => {
      response.writeHead(200, { "content-length": "100" });
      response.write("PARTIALCANARY");
      setTimeout(() => response.socket?.destroy(), 20);
    });
    const fetch = testFetch(server.origin);

    const error = await expectCode(fetch(`${server.origin}/auth/v1/user`), "loopback_fetch_response_failed");

    expectValueFree(error, ["PARTIALCANARY"]);
  });
});

describe("supabase-js through the test transport", () => {
  it("carries an Auth admin call through the custom fetch", async () => {
    const server = await startHttpServer((_request, response) =>
      sendJson(response, 200, { users: [], aud: "authenticated" }, { "x-total-count": "0" }),
    );
    const client = createClient(server.origin, FAKE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { fetch: testFetch(server.origin) },
    });

    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 5 });

    expect(error).toBeNull();
    expect(data.users).toEqual([]);
    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]).toMatchObject({ method: "GET", url: "/auth/v1/admin/users?page=1&per_page=5" });
    expect(server.requests[0]!.headers.apikey).toBe(FAKE_KEY);
  });
});
