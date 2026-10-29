// Admin transport: injected fetch only, no UI or auth authority.
// Cancellation ends local waiting; it does not prove rollback of remote effects.
// The caller must invalidate its own UI generation before aborting an old request.
import {
  ADMIN_BROWSER_SIGN_IN_PATHS,
  buildPasswordRoleSignInSendRequest,
  buildPasswordRoleSignInFlowSendRequest,
  buildPasswordRoleSignInFlowVerifyRequest,
  parseAdminSignInFlowSendReply,
  type AdminBrowserFlowSendReply,
  type PasswordRoleBrowserFlowSendBody,
  type PasswordRoleBrowserFlowVerifyBody,
  buildPasswordRoleSignInVerifyRequest,
  parseAdminSignInSendReply,
  parseAdminSignInVerifyReply,
  type PasswordRoleBrowserParsedReply,
  type AdminBrowserSendReply,
  type PasswordRoleBrowserSendBody,
  type AdminBrowserVerifyReply,
  type PasswordRoleBrowserVerifyBody,
} from "./passwordRoleSignInBrowserContract";

export const ADMIN_SIGN_IN_REQUEST_MAX_BYTES = 16_384;
// A local engineering ceiling, not a server-advertised response-size contract.
export const ADMIN_SIGN_IN_RESPONSE_MAX_BYTES = 16_384;
const MAX_TIMER_MILLISECONDS = 2_147_483_647;
const JSON_MEDIA_TYPE = /^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/iu;

const FAILED = Object.freeze({ ok: false, error: "sign_in_browser_transport_failed" } as const);
const CANCELLED = Object.freeze({ ok: false, error: "sign_in_browser_transport_cancelled" } as const);
const TIMED_OUT = Object.freeze({ ok: false, error: "sign_in_browser_transport_timed_out" } as const);
export type AdminSignInBrowserTransportFailure = typeof FAILED | typeof CANCELLED | typeof TIMED_OUT;
export type AdminSignInBrowserTransportResult<T> =
  | Readonly<{ ok: true; value: T }>
  | AdminSignInBrowserTransportFailure;
export type AdminSignInBrowserFetch = (path: string, init: RequestInit) => Promise<Response>;
export type AdminSignInBrowserTransport = Readonly<{
  send(input: unknown, signal: AbortSignal): Promise<AdminSignInBrowserTransportResult<AdminBrowserSendReply>>;
  verify(input: unknown, signal: AbortSignal): Promise<AdminSignInBrowserTransportResult<AdminBrowserVerifyReply>>;
  sendFlow(input: unknown, signal: AbortSignal): Promise<AdminSignInBrowserTransportResult<AdminBrowserFlowSendReply>>;
  verifyFlow(input: unknown, signal: AbortSignal): Promise<AdminSignInBrowserTransportResult<AdminBrowserVerifyReply>>;
}>;

type RequestSnapshot = Readonly<{
  path: typeof ADMIN_BROWSER_SIGN_IN_PATHS[keyof typeof ADMIN_BROWSER_SIGN_IN_PATHS];
  body: PasswordRoleBrowserSendBody | PasswordRoleBrowserVerifyBody | PasswordRoleBrowserFlowSendBody | PasswordRoleBrowserFlowVerifyBody;
}>;
type Boundary<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>;
const BOUNDARY_FAILED = Object.freeze({ ok: false } as const);

// Dispose without awaiting untrusted cleanup. A late rejection is consumed.
function discardBody(response: Response): void {
  try {
    const body = response.body;
    if (body !== null) void Promise.resolve(body.cancel()).catch(() => undefined);
  } catch { /* The outward result contains no underlying value. */ }
}

function serialize(request: RequestSnapshot): string | null {
  // Raw strings are already detached by the contract. Reject a proven oversize
  // before stringify/encoding can allocate copies proportional to a huge input.
  const rawLength = Object.values(request.body).reduce((sum, value) => sum + value.length, 0);
  if (rawLength > ADMIN_SIGN_IN_REQUEST_MAX_BYTES) return null;
  const text = JSON.stringify(request.body);
  if (text.length > ADMIN_SIGN_IN_REQUEST_MAX_BYTES) return null;
  return new TextEncoder().encode(text).byteLength <= ADMIN_SIGN_IN_REQUEST_MAX_BYTES ? text : null;
}

// The injected function and platform primitives are trusted executable seams.
// Deadlines cannot preempt synchronous code or a blocked browser event loop.
async function submit<T>(
  request: RequestSnapshot,
  parser: (value: unknown) => PasswordRoleBrowserParsedReply<T>,
  callerSignal: AbortSignal,
  fetcher: AdminSignInBrowserFetch,
  budget: number,
): Promise<AdminSignInBrowserTransportResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listening = false;
  let finished = false;
  let stopped: AdminSignInBrowserTransportFailure | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let controller: AbortController | null = null;
  let releaseStop: () => void = () => undefined;
  const stopPromise = new Promise<Readonly<{ ok: false }>>(resolve => {
    releaseStop = () => resolve(BOUNDARY_FAILED);
  });

  function disposeReader(): void {
    const owned = reader;
    reader = null;
    if (owned === null) return;
    try { void Promise.resolve(owned.cancel()).catch(() => undefined); } catch { /* value-free */ }
    try { owned.releaseLock(); } catch { /* value-free */ }
  }

  function stop(reason: AdminSignInBrowserTransportFailure): void {
    if (stopped !== null || finished) return;
    stopped = reason;
    releaseStop();
    try { controller?.abort(); } catch { /* value-free */ }
    disposeReader();
  }
  const onAbort = () => stop(CANCELLED);

  try {
    if (callerSignal.aborted) return CANCELLED;
    const body = serialize(request);
    if (body === null) return FAILED;
    if (callerSignal.aborted) return CANCELLED;
    const started = performance.now();
    if (!Number.isFinite(started)) return FAILED;
    const deadline = started + budget;
    if (!Number.isFinite(deadline)) return FAILED;
    let observed = started;
    controller = new AbortController();

    function check(): AdminSignInBrowserTransportFailure | null {
      if (stopped !== null) return stopped;
      if (callerSignal.aborted) { stop(CANCELLED); return stopped; }
      const now = performance.now();
      if (!Number.isFinite(now) || now < observed) stop(FAILED);
      else if (now >= deadline) stop(TIMED_OUT);
      observed = now;
      return stopped;
    }

    async function boundary<V>(promise: Promise<V>, late?: (value: V) => void): Promise<Boundary<V>> {
      // The fulfillment/rejection handlers remain attached after a race is lost.
      // A late response body is cancelled without retaining or publishing it.
      const settled: Promise<Boundary<V>> = Promise.resolve(promise).then(value => {
        if (stopped !== null || finished) {
          try { late?.(value); } catch { /* value-free */ }
          return BOUNDARY_FAILED;
        }
        return { ok: true, value };
      }, () => BOUNDARY_FAILED);
      const result = await Promise.race([settled, stopPromise]);
      if (check() === null) return result;
      if (result.ok) {
        try { late?.(result.value); } catch { /* value-free */ }
      }
      return BOUNDARY_FAILED;
    }

    callerSignal.addEventListener("abort", onAbort, { once: true });
    listening = true;
    if (check() !== null) return stopped ?? FAILED;
    const remaining = Math.min(MAX_TIMER_MILLISECONDS, Math.ceil(deadline - observed));
    timer = setTimeout(() => stop(TIMED_OUT), remaining);
    if (check() !== null) return stopped ?? FAILED;

    const fetched = await boundary(fetcher(request.path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json; charset=utf-8" },
      body,
      signal: controller.signal,
    }), discardBody);
    if (!fetched.ok) return stopped ?? FAILED;
    const response = fetched.value;
    try {
      if (response.status !== 200 || response.redirected !== false ||
          !JSON_MEDIA_TYPE.test(response.headers.get("content-type") ?? "") || response.body === null) {
        discardBody(response);
        return FAILED;
      }
      reader = response.body.getReader();
    } catch {
      discardBody(response);
      return FAILED;
    }
    if (check() !== null) return stopped ?? FAILED;

    const bytes = new Uint8Array(ADMIN_SIGN_IN_RESPONSE_MAX_BYTES);
    let total = 0;
    for (;;) {
      const chunk = await boundary(reader.read());
      if (!chunk.ok) return stopped ?? FAILED;
      if (chunk.value.done) break;
      const value = chunk.value.value;
      if (!(value instanceof Uint8Array) || value.byteLength > bytes.byteLength - total) return FAILED;
      bytes.set(value, total);
      total += value.byteLength;
    }
    reader.releaseLock();
    reader = null;
    if (total === 0 || (total >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) return FAILED;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, total));
    const value: unknown = JSON.parse(text);
    const parsed = parser(value);
    if (check() !== null) return stopped ?? FAILED;
    return parsed.ok ? parsed : FAILED;
  } catch {
    return stopped ?? FAILED;
  } finally {
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    if (listening) {
      try { callerSignal.removeEventListener("abort", onAbort); } catch { /* value-free */ }
    }
    disposeReader();
  }
}

// No default timeout is selected. The connected owner supplies its explicit
// operational budget; configured server budgets are not a wall-clock ceiling.
export function createAdminSignInBrowserTransport(options: Readonly<{
  fetcher: AdminSignInBrowserFetch;
  responseBudgetMilliseconds: number;
}>): AdminSignInBrowserTransport | null {
  try {
    const fetcher = options.fetcher;
    const budget = options.responseBudgetMilliseconds;
    if (typeof fetcher !== "function" || !Number.isSafeInteger(budget) ||
        budget <= 0 || budget > MAX_TIMER_MILLISECONDS) return null;
    return Object.freeze({
      async sendFlow(input: unknown, signal: AbortSignal) {
        const request = buildPasswordRoleSignInFlowSendRequest(input);
        return request.ok ? submit({ path: ADMIN_BROWSER_SIGN_IN_PATHS.send, body: request.body }, parseAdminSignInFlowSendReply, signal, fetcher, budget) : FAILED;
      },
      async verifyFlow(input: unknown, signal: AbortSignal) {
        const request = buildPasswordRoleSignInFlowVerifyRequest(input);
        return request.ok ? submit({ path: ADMIN_BROWSER_SIGN_IN_PATHS.verify, body: request.body }, parseAdminSignInVerifyReply, signal, fetcher, budget) : FAILED;
      },
      async send(input: unknown, signal: AbortSignal) {
        const request = buildPasswordRoleSignInSendRequest(input);
        return request.ok ? submit({ path: ADMIN_BROWSER_SIGN_IN_PATHS.send, body: request.body }, parseAdminSignInSendReply, signal, fetcher, budget) : FAILED;
      },
      async verify(input: unknown, signal: AbortSignal) {
        const request = buildPasswordRoleSignInVerifyRequest(input);
        return request.ok ? submit({ path: ADMIN_BROWSER_SIGN_IN_PATHS.verify, body: request.body }, parseAdminSignInVerifyReply, signal, fetcher, budget) : FAILED;
      },
    });
  } catch { return null; }
}
