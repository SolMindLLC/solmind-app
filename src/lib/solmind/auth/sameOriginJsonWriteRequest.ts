// PRJ01_V-WS05-WI022-S03 authenticated same-origin JSON write guard.
//
// This server-only boundary performs cheap request-shape and browser-origin
// rejection before request authentication or command execution. It reads the
// body through one bounded stream and returns only a frozen plain JSON object.

import "server-only";

import { parseTrustedApplicationOrigin } from "./trustedApplicationOrigin";

export const SOLMIND_JSON_WRITE_REQUEST_DENIED =
  "solmind_json_write_request_denied" as const;
export const SOLMIND_JSON_WRITE_BODY_MAX_BYTES = 16_384 as const;

export type SameOriginJsonWriteRequestResult =
  | Readonly<{
      ok: true;
      value: Readonly<Record<string, unknown>>;
      error: null;
    }>
  | Readonly<{
      ok: false;
      value: null;
      error: typeof SOLMIND_JSON_WRITE_REQUEST_DENIED;
    }>;

const JSON_MEDIA_TYPE =
  /^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/iu;
const CANONICAL_UNSIGNED_DECIMAL = /^(?:0|[1-9][0-9]*)$/u;

function denied(): SameOriginJsonWriteRequestResult {
  return Object.freeze({
    ok: false,
    value: null,
    error: SOLMIND_JSON_WRITE_REQUEST_DENIED,
  });
}

function parseDeclaredLength(value: string | null): number | null | false {
  if (value === null) {
    return null;
  }
  if (!CANONICAL_UNSIGNED_DECIMAL.test(value)) {
    return false;
  }
  try {
    const parsed = BigInt(value);
    if (
      parsed > BigInt(SOLMIND_JSON_WRITE_BODY_MAX_BYTES) ||
      parsed > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      return false;
    }
    return Number(parsed);
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function freezeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      freezeJson(item);
    }
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const item of Object.values(value)) {
      freezeJson(item);
    }
    return Object.freeze(value);
  }
  return value;
}

// Server-owned limits for reading the body (REV341a finding 1, correction D-5): a client that stops sending for the idle
// limit, an upload that passes the total limit, or a request cancelled mid-read, ends in the fixed denial instead of an
// open-ended wait. Each received chunk restarts the idle limit, so a slow upload that keeps progressing is accepted.
export const SOLMIND_JSON_WRITE_BODY_IDLE_MS = 5_000 as const;
export const SOLMIND_JSON_WRITE_BODY_TOTAL_MS = 15_000 as const;
const BODY_STOPPED = Symbol("solmind_json_write_body_stopped");

async function readBoundedBody(
  request: Request,
  declaredLength: number | null,
): Promise<Uint8Array | null> {
  if (request.body === null) {
    return null;
  }
  const signal = request.signal as AbortSignal | undefined;
  if (signal?.aborted) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let stop!: () => void;
  const stopped = new Promise<typeof BODY_STOPPED>((resolve) => {
    stop = () => resolve(BODY_STOPPED);
  });
  let idle = setTimeout(() => stop(), SOLMIND_JSON_WRITE_BODY_IDLE_MS);
  const whole = setTimeout(() => stop(), SOLMIND_JSON_WRITE_BODY_TOTAL_MS);
  const onAbort = (): void => stop();
  signal?.addEventListener("abort", onAbort, { once: true });
  // Cancellation is started, never awaited: a source whose cleanup never settles cannot hold the denial.
  const abandon = (): void => {
    try {
      reader.cancel().catch(() => undefined);
    } catch {
      // The fixed denied result remains the only outward effect.
    }
  };
  try {
    while (true) {
      const pending = reader.read();
      pending.catch(() => undefined);
      const next = await Promise.race([pending, stopped]);
      if (next === BODY_STOPPED) {
        abandon();
        return null;
      }
      if (next.done) {
        break;
      }
      total += next.value.byteLength;
      if (total > SOLMIND_JSON_WRITE_BODY_MAX_BYTES) {
        abandon();
        return null;
      }
      chunks.push(next.value);
      if (next.value.byteLength > 0) {
        clearTimeout(idle);
        idle = setTimeout(() => stop(), SOLMIND_JSON_WRITE_BODY_IDLE_MS);
      }
    }
  } catch {
    abandon();
    return null;
  } finally {
    clearTimeout(idle);
    clearTimeout(whole);
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // A read still pending after the limit; the stream is already being cancelled.
    }
  }

  if (total === 0 || (declaredLength !== null && declaredLength !== total)) {
    return null;
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readSameOriginJsonWriteRequest(args: {
  request: Request;
  trustedOrigin: string;
}): Promise<SameOriginJsonWriteRequestResult> {
  try {
    const trustedOrigin = parseTrustedApplicationOrigin(args.trustedOrigin);
    if (
      trustedOrigin === null ||
      trustedOrigin !== args.trustedOrigin ||
      args.request.method !== "POST" ||
      !JSON_MEDIA_TYPE.test(args.request.headers.get("content-type") ?? "") ||
      ![null, "identity"].includes(
        args.request.headers.get("content-encoding")?.toLowerCase() ?? null,
      ) ||
      args.request.headers.get("origin") !== trustedOrigin ||
      args.request.headers.get("sec-fetch-site") !== "same-origin"
    ) {
      return denied();
    }

    const declaredLength = parseDeclaredLength(
      args.request.headers.get("content-length"),
    );
    if (declaredLength === false) {
      return denied();
    }

    const body = await readBoundedBody(args.request, declaredLength);
    if (
      body === null ||
      (body.length >= 3 &&
        body[0] === 0xef &&
        body[1] === 0xbb &&
        body[2] === 0xbf)
    ) {
      return denied();
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const value: unknown = JSON.parse(text);
    if (!isPlainObject(value)) {
      return denied();
    }

    return Object.freeze({
      ok: true,
      value: freezeJson(value) as Readonly<Record<string, unknown>>,
      error: null,
    });
  } catch {
    return denied();
  }
}
