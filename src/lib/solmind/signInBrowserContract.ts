// Dormant browser-safe Explorer sign-in boundary. Server authority remains
// supabase/explorerSignInRouteContract.ts and its send/verify Route Handlers.
// No transport, UI wording, authority, logging or authentication occurs here.
// Keep raw inputs and returned selectors private to the future in-memory flow.
// An acknowledgment does not prove issuance, delivery or an eligible account.

export const EXPLORER_BROWSER_SIGN_IN_PATHS = Object.freeze({
  send: "/login/explorer/send",
  verify: "/login/explorer/verify",
} as const);
export const EXPLORER_BROWSER_SIGN_IN_HOME = "/explorer/home" as const;

export const SIGN_IN_BROWSER_CONTRACT_FAILED = Object.freeze({
  ok: false,
  error: "sign_in_browser_contract_failed",
} as const);
type Failed = typeof SIGN_IN_BROWSER_CONTRACT_FAILED;

export type ExplorerBrowserSendBody = Readonly<{ identifier: string }>;
export type ExplorerBrowserVerifyBody = Readonly<{
  identifier: string;
  challengeId: string;
  code: string;
}>;
export type ExplorerBrowserSendReply =
  | Readonly<{ acknowledgment: "verification_code_requested"; challengeId: string }>
  | Readonly<{ outcome: "invalid_email" | "denied" }>;
export type ExplorerBrowserVerifyReply =
  | Readonly<{ outcome: "signed_in"; destination: typeof EXPLORER_BROWSER_SIGN_IN_HOME }>
  | Readonly<{ outcome: "code_not_accepted" | "denied" }>;
export type ExplorerBrowserSendRequest = Readonly<{
  ok: true;
  path: typeof EXPLORER_BROWSER_SIGN_IN_PATHS.send;
  body: ExplorerBrowserSendBody;
}>;
export type ExplorerBrowserVerifyRequest = Readonly<{
  ok: true;
  path: typeof EXPLORER_BROWSER_SIGN_IN_PATHS.verify;
  body: ExplorerBrowserVerifyBody;
}>;
export type ExplorerBrowserParsedReply<T> = Readonly<{ ok: true; value: T }> | Failed;

// Snapshot own enumerable data properties once. No caller getter is read.
// A thrown value is discarded without reading, coercing or reporting it.
function readFields(value: unknown, maximumKeys: number): ReadonlyMap<string, string> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length === 0 || keys.length > maximumKeys) return null;
    const fields = new Map<string, string>();
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        typeof descriptor.value !== "string"
      ) return null;
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

// Builders intentionally mirror only the server's exact body shape checks.
// Identifier normalization, code/selector validity and the transport byte bound
// remain with their existing owners. No raw text is trimmed or canonicalized.
export function buildExplorerSignInSendRequest(value: unknown): ExplorerBrowserSendRequest | Failed {
  const fields = readFields(value, 1);
  const identifier = fields?.get("identifier");
  if (fields?.size !== 1 || identifier === undefined) return SIGN_IN_BROWSER_CONTRACT_FAILED;
  return Object.freeze({
    ok: true,
    path: EXPLORER_BROWSER_SIGN_IN_PATHS.send,
    body: Object.freeze({ identifier }),
  });
}

export function buildExplorerSignInVerifyRequest(value: unknown): ExplorerBrowserVerifyRequest | Failed {
  const fields = readFields(value, 3);
  const identifier = fields?.get("identifier");
  const challengeId = fields?.get("challengeId");
  const code = fields?.get("code");
  if (fields?.size !== 3 || identifier === undefined || challengeId === undefined || code === undefined) {
    return SIGN_IN_BROWSER_CONTRACT_FAILED;
  }
  return Object.freeze({
    ok: true,
    path: EXPLORER_BROWSER_SIGN_IN_PATHS.verify,
    body: Object.freeze({ identifier, challengeId, code }),
  });
}

// The canonical selector grammar is lowercase 8-4-4-4-12 hexadecimal.
// It is not restricted to UUID v4: the server's neutral failure acknowledgment
// may contain the nil UUID. Exact length also rejects trailing line terminators.
function isChallengeSelector(value: string | undefined): value is string {
  return typeof value === "string" && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

export function parseExplorerSignInSendReply(
  status: unknown,
  value: unknown,
): ExplorerBrowserParsedReply<ExplorerBrowserSendReply> {
  if (status !== 200) return SIGN_IN_BROWSER_CONTRACT_FAILED;
  const fields = readFields(value, 2);
  if (fields === null) return SIGN_IN_BROWSER_CONTRACT_FAILED;
  const outcome = fields.get("outcome");
  if (fields.size === 1 && (outcome === "invalid_email" || outcome === "denied")) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome }) });
  }
  const challengeId = fields.get("challengeId");
  if (fields.size === 2 && fields.get("acknowledgment") === "verification_code_requested" && isChallengeSelector(challengeId)) {
    return Object.freeze({
      ok: true,
      value: Object.freeze({ acknowledgment: "verification_code_requested", challengeId }),
    });
  }
  return SIGN_IN_BROWSER_CONTRACT_FAILED;
}

export function parseExplorerSignInVerifyReply(
  status: unknown,
  value: unknown,
): ExplorerBrowserParsedReply<ExplorerBrowserVerifyReply> {
  if (status !== 200) return SIGN_IN_BROWSER_CONTRACT_FAILED;
  const fields = readFields(value, 2);
  if (fields === null) return SIGN_IN_BROWSER_CONTRACT_FAILED;
  const outcome = fields.get("outcome");
  if (fields.size === 1 && (outcome === "code_not_accepted" || outcome === "denied")) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome }) });
  }
  if (fields.size === 2 && outcome === "signed_in" && fields.get("destination") === EXPLORER_BROWSER_SIGN_IN_HOME) {
    return Object.freeze({
      ok: true,
      value: Object.freeze({ outcome: "signed_in", destination: EXPLORER_BROWSER_SIGN_IN_HOME }),
    });
  }
  return SIGN_IN_BROWSER_CONTRACT_FAILED;
}
