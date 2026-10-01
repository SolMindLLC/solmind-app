// RESTRICTED test-only transport core for the future local Supabase Auth provider
// probes. Only `providerProbeLoopbackFetch.ts` (the gated, fixed-target production
// factories) and `providerProbeTestSupport.ts` (test-only factories) may import this
// module; `providerProbeModuleBoundary.test.ts` enforces that.
//
// This is a `fetch`-compatible transport on `node:http` (no `undici` package is
// installed). Before anything else on every request it calls its gate, and refuses
// with zero bytes sent when the gate is closed. It calls the gate again after the
// connection opens and the peer is checked, immediately before writing the first
// byte, so an interlock removed while the socket is still connecting also refuses
// with zero request bytes. A request that has already begun writing is not recalled:
// its bytes are on their way, and its response is still read. It then:
//
// - accepts only allowlisted literal-loopback origins (`127.0.0.1` or `[::1]`, plain
//   HTTP, explicit port) and only allowlisted path prefixes for that origin;
// - refuses DNS entirely and opens a fresh socket for every request (`agent: false`);
// - checks `socket.remoteAddress` and `socket.remotePort` on every connection, before
//   any request header or body byte is written;
// - never follows a redirect: any 3xx fails and the response, including its
//   `Location` header, is discarded unread;
// - bounds the whole exchange by one deadline and bounds request and response bytes;
// - throws only `LoopbackFetchError`, whose message is a fixed code. No URL, query,
//   header value, body, peer address or underlying error is attached, because
//   auth-js prints whatever its fetch throws.

import http from "node:http";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import type { LookupFunction, Socket } from "node:net";

export type LoopbackFetchErrorCode =
  | "loopback_fetch_invalid_options"
  | "loopback_fetch_ungated"
  | "loopback_fetch_unsupported_input"
  | "loopback_fetch_target_refused"
  | "loopback_fetch_method_refused"
  | "loopback_fetch_header_refused"
  | "loopback_fetch_body_refused"
  | "loopback_fetch_body_too_large"
  | "loopback_fetch_peer_mismatch"
  | "loopback_fetch_connection_failed"
  | "loopback_fetch_timeout"
  | "loopback_fetch_aborted"
  | "loopback_fetch_redirect_refused"
  | "loopback_fetch_invalid_status"
  | "loopback_fetch_encoding_refused"
  | "loopback_fetch_response_too_large"
  | "loopback_fetch_response_failed";

export class LoopbackFetchError extends Error {
  readonly code: LoopbackFetchErrorCode;

  constructor(code: LoopbackFetchErrorCode) {
    super(code);
    this.name = "LoopbackFetchError";
    this.code = code;
  }
}

export type LoopbackFetchTarget = Readonly<{
  // Canonical origin, for example "http://127.0.0.1:54321" or "http://[::1]:54321".
  origin: string;
  // Each prefix starts and ends with "/", for example "/auth/v1/".
  pathPrefixes: readonly string[];
}>;

export type LoopbackHttpRequestFunction = (options: RequestOptions) => ClientRequest;

export type LoopbackTransportOptions = Readonly<{
  targets: readonly LoopbackFetchTarget[];
  timeoutMilliseconds: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  // Called first on every request, and again immediately before the first byte is
  // written; false at either point refuses the request with zero request bytes.
  gate: () => boolean;
  // Test-only seam (reachable only through providerProbeTestSupport.ts).
  request?: LoopbackHttpRequestFunction;
}>;

export type LoopbackFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type ExpectedPeer = Readonly<{ address: "127.0.0.1" | "::1"; port: number }>;

type ValidatedTarget = Readonly<{
  origin: string;
  peer: ExpectedPeer;
  pathPrefixes: readonly string[];
}>;

export const LOOPBACK_FETCH_LIMITS = Object.freeze({
  minTimeoutMilliseconds: 50,
  maxTimeoutMilliseconds: 30_000,
  maxRequestBytes: 65_536,
  maxResponseBytes: 1_048_576,
  maxTargets: 4,
  maxPathPrefixesPerTarget: 8,
});

const OPTION_KEYS = ["gate", "maxRequestBytes", "maxResponseBytes", "request", "targets", "timeoutMilliseconds"];
const REQUIRED_OPTION_KEYS = ["gate", "maxRequestBytes", "maxResponseBytes", "targets", "timeoutMilliseconds"];
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "DELETE"]);
const FORBIDDEN_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "expect",
  "upgrade",
  "keep-alive",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-connection",
]);
// Response headers the transport never copies. `location` is skipped by name so its
// value is never read; `set-cookie` is never handed to any client.
const DROPPED_RESPONSE_HEADERS = new Set(["location", "set-cookie"]);
const PATH_PREFIX_PATTERN = /^\/(?:[a-z0-9_-]+\/)+$/;
const NULL_BODY_STATUSES = new Set([204, 205]);

function fail(code: LoopbackFetchErrorCode): never {
  throw new LoopbackFetchError(code);
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function peerForHostname(hostname: string): ExpectedPeer["address"] | null {
  if (hostname === "127.0.0.1") {
    return "127.0.0.1";
  }
  if (hostname === "[::1]") {
    return "::1";
  }
  return null;
}

function validateTarget(raw: unknown): ValidatedTarget {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("loopback_fetch_invalid_options");
  }
  const target = raw as Record<string, unknown>;
  const keys = Object.keys(target).sort();
  if (keys.length !== 2 || keys[0] !== "origin" || keys[1] !== "pathPrefixes") {
    fail("loopback_fetch_invalid_options");
  }
  if (typeof target.origin !== "string") {
    fail("loopback_fetch_invalid_options");
  }
  let url: URL;
  try {
    url = new URL(target.origin);
  } catch {
    fail("loopback_fetch_invalid_options");
  }
  const address = peerForHostname(url.hostname);
  const port = Number(url.port);
  if (
    url.protocol !== "http:" ||
    address === null ||
    url.username !== "" ||
    url.password !== "" ||
    url.port === "" ||
    !isBoundedInteger(port, 1, 65_535) ||
    url.origin !== target.origin
  ) {
    fail("loopback_fetch_invalid_options");
  }
  const prefixes = target.pathPrefixes;
  if (
    !Array.isArray(prefixes) ||
    prefixes.length < 1 ||
    prefixes.length > LOOPBACK_FETCH_LIMITS.maxPathPrefixesPerTarget ||
    !prefixes.every((prefix) => typeof prefix === "string" && PATH_PREFIX_PATTERN.test(prefix))
  ) {
    fail("loopback_fetch_invalid_options");
  }
  return Object.freeze({
    origin: url.origin,
    peer: Object.freeze({ address, port }),
    pathPrefixes: Object.freeze([...(prefixes as string[])]),
  });
}

function validateOptions(raw: unknown): Readonly<{
  targets: readonly ValidatedTarget[];
  timeoutMilliseconds: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
  gate: () => boolean;
  request: LoopbackHttpRequestFunction;
}> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("loopback_fetch_invalid_options");
  }
  const options = raw as Record<string, unknown>;
  const keys = Object.keys(options).filter((key) => options[key] !== undefined);
  if (
    keys.some((key) => !OPTION_KEYS.includes(key)) ||
    REQUIRED_OPTION_KEYS.some((key) => !keys.includes(key))
  ) {
    fail("loopback_fetch_invalid_options");
  }
  if (
    typeof options.gate !== "function" ||
    (options.request !== undefined && typeof options.request !== "function") ||
    !Array.isArray(options.targets) ||
    options.targets.length < 1 ||
    options.targets.length > LOOPBACK_FETCH_LIMITS.maxTargets ||
    !isBoundedInteger(
      options.timeoutMilliseconds,
      LOOPBACK_FETCH_LIMITS.minTimeoutMilliseconds,
      LOOPBACK_FETCH_LIMITS.maxTimeoutMilliseconds,
    ) ||
    !isBoundedInteger(options.maxRequestBytes, 0, LOOPBACK_FETCH_LIMITS.maxRequestBytes) ||
    !isBoundedInteger(options.maxResponseBytes, 1, LOOPBACK_FETCH_LIMITS.maxResponseBytes)
  ) {
    fail("loopback_fetch_invalid_options");
  }
  const targets = (options.targets as unknown[]).map(validateTarget);
  if (new Set(targets.map((target) => target.origin)).size !== targets.length) {
    fail("loopback_fetch_invalid_options");
  }
  return Object.freeze({
    targets: Object.freeze(targets),
    timeoutMilliseconds: options.timeoutMilliseconds as number,
    maxRequestBytes: options.maxRequestBytes as number,
    maxResponseBytes: options.maxResponseBytes as number,
    gate: options.gate as () => boolean,
    // Looked up at construction; production construction never supplies a seam.
    request: (options.request as LoopbackHttpRequestFunction | undefined) ?? http.request,
  });
}

export function isExpectedLoopbackPeer(
  remoteAddress: string | undefined,
  remotePort: number | undefined,
  expected: ExpectedPeer,
): boolean {
  // Exact match only: an IPv4-mapped form such as "::ffff:127.0.0.1" is refused.
  return remoteAddress === expected.address && remotePort === expected.port;
}

const refuseDnsLookup: LookupFunction = (_hostname, _options, callback) => {
  const error: NodeJS.ErrnoException = new Error("loopback_fetch_dns_refused");
  error.code = "ENOTFOUND";
  callback(error, "", 4);
};

function resolveTarget(
  input: unknown,
  targets: readonly ValidatedTarget[],
): Readonly<{ target: ValidatedTarget; path: string }> {
  if (typeof input !== "string" && !(input instanceof URL)) {
    // A `Request` object (or anything else) is refused rather than unpacked.
    fail("loopback_fetch_unsupported_input");
  }
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    fail("loopback_fetch_target_refused");
  }
  const target = targets.find((candidate) => candidate.origin === url.origin);
  if (
    target === undefined ||
    url.protocol !== "http:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.pathname.includes("%") ||
    url.pathname.includes("\\") ||
    !target.pathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    fail("loopback_fetch_target_refused");
  }
  return Object.freeze({ target, path: `${url.pathname}${url.search}` });
}

function readMethod(init: RequestInit | undefined): string {
  const raw = init?.method ?? "GET";
  if (typeof raw !== "string") {
    fail("loopback_fetch_method_refused");
  }
  const method = raw.toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    fail("loopback_fetch_method_refused");
  }
  return method;
}

function readHeaders(init: RequestInit | undefined): Record<string, string> {
  let headers: Headers;
  try {
    // Accepts a plain object (auth-js), a `Headers` instance or entry pairs.
    // The constructor's own error text can quote a value, so it is replaced.
    headers = new Headers(init?.headers ?? undefined);
  } catch {
    fail("loopback_fetch_header_refused");
  }
  const outgoing: Record<string, string> = {};
  for (const [name, value] of headers) {
    if (FORBIDDEN_REQUEST_HEADERS.has(name) || name.startsWith("proxy-")) {
      fail("loopback_fetch_header_refused");
    }
    outgoing[name] = value;
  }
  // Compressed bodies are never decoded here, so only identity is requested.
  outgoing["accept-encoding"] = "identity";
  return outgoing;
}

function readBody(
  init: RequestInit | undefined,
  method: string,
  maxRequestBytes: number,
): Uint8Array | undefined {
  const raw = init?.body;
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (method === "GET") {
    fail("loopback_fetch_body_refused");
  }
  let bytes: Uint8Array;
  if (typeof raw === "string") {
    bytes = new TextEncoder().encode(raw);
  } else if (raw instanceof Uint8Array) {
    bytes = new Uint8Array(raw);
  } else if (raw instanceof ArrayBuffer) {
    bytes = new Uint8Array(raw.slice(0));
  } else {
    // Streams, Blob, FormData and URLSearchParams are not needed by Auth or Mailpit.
    fail("loopback_fetch_body_refused");
  }
  if (bytes.byteLength > maxRequestBytes) {
    fail("loopback_fetch_body_too_large");
  }
  return bytes;
}

function readSignal(init: RequestInit | undefined): AbortSignal | undefined {
  const signal = init?.signal;
  if (signal === undefined || signal === null) {
    return undefined;
  }
  if (!(signal instanceof AbortSignal)) {
    fail("loopback_fetch_unsupported_input");
  }
  if (signal.aborted) {
    fail("loopback_fetch_aborted");
  }
  return signal;
}

function buildResponse(incoming: IncomingMessage, chunks: readonly Buffer[], total: number): Response {
  const status = incoming.statusCode as number;
  const headers = new Headers();
  for (let index = 0; index + 1 < incoming.rawHeaders.length; index += 2) {
    const name = incoming.rawHeaders[index] as string;
    if (DROPPED_RESPONSE_HEADERS.has(name.toLowerCase())) {
      continue;
    }
    headers.append(name, incoming.rawHeaders[index + 1] as string);
  }
  if (NULL_BODY_STATUSES.has(status)) {
    return new Response(null, { status, headers });
  }
  // A fresh ArrayBuffer-backed copy: lib.dom's BodyInit does not accept `Buffer`.
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Response(body, { status, headers });
}

function isGateOpen(gate: () => boolean): boolean {
  try {
    return gate() === true;
  } catch {
    return false;
  }
}

export function createLoopbackTransport(options: LoopbackTransportOptions): LoopbackFetch {
  const validated = validateOptions(options);

  return async function loopbackFetch(input, init) {
    // The gate comes first: a closed gate refuses before any parsing or socket.
    if (!isGateOpen(validated.gate)) {
      fail("loopback_fetch_ungated");
    }
    // Every refusal below also happens before any socket is opened.
    const { target, path } = resolveTarget(input, validated.targets);
    const method = readMethod(init);
    const headers = readHeaders(init);
    const body = readBody(init, method, validated.maxRequestBytes);
    const signal = readSignal(init);
    if (method !== "GET") {
      // An explicit length (0 when there is no body) avoids chunked framing.
      headers["content-length"] = String(body?.byteLength ?? 0);
    }

    const requestOptions: RequestOptions = Object.freeze({
      host: target.peer.address,
      family: target.peer.address === "::1" ? 6 : 4,
      port: target.peer.port,
      method,
      path,
      headers: Object.freeze({ ...headers }),
      agent: false,
      lookup: refuseDnsLookup,
      setHost: true,
    });

    return await new Promise<Response>((resolve, reject) => {
      let settled = false;
      let outgoing: ClientRequest | undefined;
      let incoming: IncomingMessage | undefined;

      const onAbort = () => settleFailure("loopback_fetch_aborted");
      const timer = setTimeout(
        () => settleFailure("loopback_fetch_timeout"),
        validated.timeoutMilliseconds,
      );
      signal?.addEventListener("abort", onAbort, { once: true });

      function release(): void {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }

      function settleFailure(code: LoopbackFetchErrorCode): void {
        if (settled) {
          return;
        }
        settled = true;
        release();
        incoming?.destroy();
        outgoing?.destroy();
        reject(new LoopbackFetchError(code));
      }

      function settleSuccess(response: Response): void {
        if (settled) {
          return;
        }
        settled = true;
        release();
        resolve(response);
      }

      try {
        outgoing = validated.request(requestOptions);
      } catch {
        settleFailure("loopback_fetch_connection_failed");
        return;
      }

      outgoing.on("error", () => settleFailure("loopback_fetch_connection_failed"));

      outgoing.on("socket", (socket: Socket) => {
        const verifyThenSend = () => {
          if (settled) {
            return;
          }
          if (!isExpectedLoopbackPeer(socket.remoteAddress, socket.remotePort, target.peer)) {
            settleFailure("loopback_fetch_peer_mismatch");
            return;
          }
          // The gate again, synchronously and immediately before the first byte: an
          // interlock removed while the socket was connecting refuses with zero bytes.
          const stillGated = isGateOpen(validated.gate);
          if (!stillGated) {
            settleFailure("loopback_fetch_ungated");
            return;
          }
          // Headers and body are written only now, after the peer and gate checks passed.
          outgoing?.end(body);
        };
        if (socket.connecting) {
          socket.once("connect", verifyThenSend);
        } else {
          verifyThenSend();
        }
      });

      outgoing.on("response", (response: IncomingMessage) => {
        incoming = response;
        const status = response.statusCode ?? 0;
        if (status >= 300 && status <= 399) {
          // Discarded unread: no header (including Location) and no body byte is used.
          settleFailure("loopback_fetch_redirect_refused");
          return;
        }
        if (status < 200 || status > 599) {
          settleFailure("loopback_fetch_invalid_status");
          return;
        }
        if (!isExpectedLoopbackPeer(response.socket?.remoteAddress, response.socket?.remotePort, target.peer)) {
          settleFailure("loopback_fetch_peer_mismatch");
          return;
        }
        const encoding = response.headers["content-encoding"];
        if (encoding !== undefined && encoding.trim().toLowerCase() !== "identity") {
          settleFailure("loopback_fetch_encoding_refused");
          return;
        }
        const declared = response.headers["content-length"];
        if (declared !== undefined && Number(declared) > validated.maxResponseBytes) {
          settleFailure("loopback_fetch_response_too_large");
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        let ended = false;
        response.on("data", (chunk: Buffer) => {
          if (settled) {
            return;
          }
          total += chunk.byteLength;
          if (total > validated.maxResponseBytes) {
            settleFailure("loopback_fetch_response_too_large");
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", () => settleFailure("loopback_fetch_response_failed"));
        response.on("end", () => {
          ended = true;
          if (settled) {
            return;
          }
          let built: Response;
          try {
            built = buildResponse(response, chunks, total);
          } catch {
            settleFailure("loopback_fetch_response_failed");
            return;
          }
          settleSuccess(built);
        });
        response.on("close", () => {
          if (!ended) {
            settleFailure("loopback_fetch_response_failed");
          }
        });
      });
    });
  };
}
