// Injected browser boundary used by ExplorerHome for one explicit Sign out action.
// Cancellation ends local confirmation only; remote effects may still complete.
// The UI must invalidate its own lifetime before cancel/dispose and before
// handling an already-settled result. No cookie/token inspection or logging.
const MAX_TIMER_MILLISECONDS = 2_147_483_647;
const MAX_RESPONSE_BYTES = 1_024;
const JSON_MEDIA_TYPE = /^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/iu;

export type LogoutBrowserFetch = (path: string, init: RequestInit) => Promise<Response>;
export type LogoutBrowserResult = Readonly<{
  outcome: "signed_out" | "sign_out_unconfirmed" | "denied" | "unavailable" | "cancelled" | "busy";
}>;
export type LogoutBrowserRequest = Readonly<{
  request(): Promise<LogoutBrowserResult>;
  cancel(): void;
  dispose(): void;
}>;

const UNAVAILABLE = Object.freeze({ outcome: "unavailable" } as const);
const CANCELLED = Object.freeze({ outcome: "cancelled" } as const);
const BUSY = Object.freeze({ outcome: "busy" } as const);
type Operation = { cancel: () => void };
type Boundary<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false }>;
const FAILED = Object.freeze({ ok: false } as const);

function discardBody(response: Response): void {
  try {
    const body = response.body;
    if (body !== null) void Promise.resolve(body.cancel()).catch(() => undefined);
  } catch { /* No underlying value escapes. */ }
}

function parseReply(value: unknown): LogoutBrowserResult {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) {
    return UNAVAILABLE;
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "outcome") return UNAVAILABLE;
  const field = Object.getOwnPropertyDescriptor(value, "outcome");
  if (!field || !field.enumerable || !("value" in field)) return UNAVAILABLE;
  const outcome: unknown = field.value;
  return outcome === "signed_out" || outcome === "sign_out_unconfirmed" || outcome === "denied"
    ? Object.freeze({ outcome }) : UNAVAILABLE;
}

// Platform primitives and injected fetch are trusted executable seams. Timers
// cannot preempt synchronous code or a blocked browser event loop.
async function submit(
  fetcher: LogoutBrowserFetch, budget: number, operation: Operation,
): Promise<LogoutBrowserResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let stopped: LogoutBrowserResult | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let controller: AbortController | null = null;
  let releaseStop: () => void = () => undefined;
  const stopPromise = new Promise<Readonly<{ ok: false }>>(resolve => {
    releaseStop = () => resolve(FAILED);
  });

  function disposeReader(): void {
    const owned = reader;
    reader = null;
    if (owned === null) return;
    try { void Promise.resolve(owned.cancel()).catch(() => undefined); } catch { /* value-free */ }
    try { owned.releaseLock(); } catch { /* value-free */ }
  }
  function stop(result: LogoutBrowserResult): void {
    if (stopped !== null || finished) return;
    stopped = result;
    releaseStop();
    try { controller?.abort(); } catch { /* value-free */ }
    disposeReader();
  }
  operation.cancel = () => stop(CANCELLED);

  try {
    const started = performance.now();
    if (!Number.isFinite(started)) return UNAVAILABLE;
    const deadline = started + budget;
    if (!Number.isFinite(deadline)) return UNAVAILABLE;
    let observed = started;
    controller = new AbortController();

    function check(): LogoutBrowserResult | null {
      if (stopped !== null) return stopped;
      const now = performance.now();
      if (!Number.isFinite(now) || now < observed || now >= deadline) stop(UNAVAILABLE);
      observed = now;
      return stopped;
    }
    async function boundary<V>(promise: Promise<V>, late?: (value: V) => void): Promise<Boundary<V>> {
      // Handlers remain attached after a lost race. Late failures are consumed,
      // and a late fetch response has its body cancelled without publication.
      const settled: Promise<Boundary<V>> = Promise.resolve(promise).then(value => {
        if (stopped !== null || finished) {
          try { late?.(value); } catch { /* value-free */ }
          return FAILED;
        }
        return { ok: true, value };
      }, () => FAILED);
      const result = await Promise.race([settled, stopPromise]);
      if (check() === null) return result;
      if (result.ok) {
        try { late?.(result.value); } catch { /* value-free */ }
      }
      return FAILED;
    }

    if (check() !== null) return stopped ?? UNAVAILABLE;
    // Ceil fractional clocks, then clamp: never overflow the platform timer.
    timer = setTimeout(() => stop(UNAVAILABLE), Math.min(MAX_TIMER_MILLISECONDS, Math.ceil(deadline - observed)));
    if (check() !== null) return stopped ?? UNAVAILABLE;
    const fetched = await boundary(fetcher("/logout", {
      method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}", signal: controller.signal,
    }), discardBody);
    if (!fetched.ok) return stopped ?? UNAVAILABLE;
    const response = fetched.value;
    try {
      if (response.status !== 200 || response.redirected !== false ||
          !JSON_MEDIA_TYPE.test(response.headers.get("content-type") ?? "") || response.body === null) {
        discardBody(response);
        return UNAVAILABLE;
      }
      reader = response.body.getReader();
    } catch {
      discardBody(response);
      return UNAVAILABLE;
    }
    if (check() !== null) return stopped ?? UNAVAILABLE;
    const bytes = new Uint8Array(MAX_RESPONSE_BYTES);
    let total = 0;
    for (;;) {
      const chunk = await boundary(reader.read());
      if (!chunk.ok) return stopped ?? UNAVAILABLE;
      if (chunk.value.done === true) break;
      if (chunk.value.done !== false) return UNAVAILABLE;
      const value = chunk.value.value;
      if (!(value instanceof Uint8Array) || value.byteLength > bytes.byteLength - total) return UNAVAILABLE;
      bytes.set(value, total);
      total += value.byteLength;
    }
    reader.releaseLock();
    reader = null;
    if (total === 0 || (total >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) return UNAVAILABLE;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, total));
    const parsed = parseReply(JSON.parse(text));
    if (check() !== null) return stopped ?? UNAVAILABLE;
    return parsed;
  } catch {
    return stopped ?? UNAVAILABLE;
  } finally {
    finished = true;
    if (timer !== undefined) clearTimeout(timer);
    disposeReader();
  }
}

// No hidden/default budget. The separately reviewed UI supplies 30,000 ms.
export function createLogoutBrowserRequest(options: Readonly<{
  fetch: LogoutBrowserFetch; responseBudgetMs: number;
}>): LogoutBrowserRequest | null {
  try {
    const fetcher = options.fetch;
    const budget = options.responseBudgetMs;
    if (typeof fetcher !== "function" || !Number.isSafeInteger(budget) || budget <= 0 || budget > MAX_TIMER_MILLISECONDS) {
      return null;
    }
    let active: Operation | null = null;
    let disposed = false;
    function cancel(): void {
      const previous = active;
      active = null; // Invalidate before abort can synchronously notify observers.
      previous?.cancel();
    }
    return Object.freeze({
      async request(): Promise<LogoutBrowserResult> {
        if (disposed) return CANCELLED;
        if (active !== null) return BUSY;
        const operation: Operation = { cancel: () => undefined };
        active = operation;
        try {
          const result = await submit(fetcher, budget, operation);
          return active === operation && !disposed ? result : CANCELLED;
        } catch {
          return active === operation && !disposed ? UNAVAILABLE : CANCELLED;
        } finally {
          if (active === operation) active = null;
        }
      },
      cancel,
      dispose() { disposed = true; cancel(); },
    });
  } catch { return null; }
}
