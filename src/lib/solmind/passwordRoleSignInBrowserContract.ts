// Browser-safe Guide/Admin boundary under the accepted S69 R04.
// Connected Guide uses this contract; Admin remains a dormant contract only.
// No server imports, HTTP status/media handling, transport, UI or ambient effects.
// Raw inputs and selectors belong only to the private in-memory flow.
// An acknowledgment proves neither account eligibility nor issuance/delivery.
export const GUIDE_BROWSER_SIGN_IN_PATHS = Object.freeze({
  send: "/login/guide/send", verify: "/login/guide/verify",
} as const);
export const ADMIN_BROWSER_SIGN_IN_PATHS = Object.freeze({
  send: "/login/admin/send", verify: "/login/admin/verify",
} as const);
export const GUIDE_BROWSER_SIGN_IN_HOME = "/guide/home" as const;
export const ADMIN_BROWSER_SIGN_IN_HOME = "/admin/home" as const;
export const PASSWORD_ROLE_BROWSER_NOT_MATCHED_MESSAGE =
  "Couldn't sign you in. Check your password and latest code. You can request a new code or try again later.";
export const PASSWORD_ROLE_BROWSER_CONTRACT_FAILED = Object.freeze({
  ok: false, error: "password_role_browser_contract_failed",
} as const);
type Failed = typeof PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
export type PasswordRoleBrowserSendBody = Readonly<{ identifier: string }>;
export type PasswordRoleBrowserVerifyBody = Readonly<{
  identifier: string; password: string; challengeId: string; code: string;
}>;
export type PasswordRoleBrowserAcknowledgment = Readonly<{
  acknowledgment: "verification_code_requested"; challengeId: string;
}>;
export type PasswordRoleBrowserFlowSendBody = Readonly<{ identifier: string; flowId: string }>;
export type PasswordRoleBrowserFlowVerifyBody = Readonly<{
  identifier: string; password: string; flowId: string; code: string;
}>;
export type PasswordRoleBrowserFlowAcknowledgment = Readonly<{
  acknowledgment: "verification_code_requested"; flowId: string;
}>;
export type GuideBrowserFlowSendReply = PasswordRoleBrowserFlowAcknowledgment |
  Readonly<{ outcome: "invalid_email" | "denied" }>;
export type AdminBrowserFlowSendReply = PasswordRoleBrowserFlowAcknowledgment |
  Readonly<{ outcome: "invalid_identifier" | "denied" }>;
export type GuideBrowserSendReply = PasswordRoleBrowserAcknowledgment |
  Readonly<{ outcome: "invalid_email" | "denied" }>;
export type AdminBrowserSendReply = PasswordRoleBrowserAcknowledgment |
  Readonly<{ outcome: "invalid_identifier" | "denied" }>;
export type GuideBrowserVerifyReply = Readonly<{ outcome: "not_matched" | "denied" }> |
  Readonly<{ outcome: "signed_in"; destination: typeof GUIDE_BROWSER_SIGN_IN_HOME }>;
export type AdminBrowserVerifyReply = Readonly<{ outcome: "not_matched" | "denied" }> |
  Readonly<{ outcome: "signed_in"; destination: typeof ADMIN_BROWSER_SIGN_IN_HOME }>;
export type PasswordRoleBrowserRequest<T> = Readonly<{ ok: true; body: T }> | Failed;
export type PasswordRoleBrowserParsedReply<T> = Readonly<{ ok: true; value: T }> | Failed;

// Snapshot own enumerable string data properties once, without evaluating getters.
// Reflection on a hostile proxy may throw; discard that thrown value untouched.
function fieldsOf(value: unknown, maximum: number): ReadonlyMap<string, string> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length === 0 || keys.length > maximum) return null;
    const fields = new Map<string, string>();
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "string") return null;
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch { return null; }
}

// Exact structure only. Server normalization and transport byte limits stay with
// their owners; do not trim, coerce or reject raw strings for semantic reasons.
export function buildPasswordRoleSignInSendRequest(value: unknown): PasswordRoleBrowserRequest<PasswordRoleBrowserSendBody> {
  const fields = fieldsOf(value, 1);
  const identifier = fields?.get("identifier");
  if (fields?.size !== 1 || identifier === undefined) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  return Object.freeze({ ok: true, body: Object.freeze({ identifier }) });
}
export function buildPasswordRoleSignInVerifyRequest(value: unknown): PasswordRoleBrowserRequest<PasswordRoleBrowserVerifyBody> {
  const fields = fieldsOf(value, 4);
  const identifier = fields?.get("identifier");
  const password = fields?.get("password");
  const challengeId = fields?.get("challengeId");
  const code = fields?.get("code");
  if (fields?.size !== 4 || identifier === undefined || password === undefined ||
      challengeId === undefined || code === undefined) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  return Object.freeze({ ok: true, body: Object.freeze({ identifier, password, challengeId, code }) });
}
// Preserve the legacy exact branches above; these never reinterpret a flowId
// as a challengeId or accept both selectors. Raw string semantics stay server-owned.
export function buildPasswordRoleSignInFlowSendRequest(value: unknown): PasswordRoleBrowserRequest<PasswordRoleBrowserFlowSendBody> {
  const fields = fieldsOf(value, 2);
  const identifier = fields?.get("identifier");
  const flowId = fields?.get("flowId");
  if (fields?.size !== 2 || identifier === undefined || flowId === undefined) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  return Object.freeze({ ok: true, body: Object.freeze({ identifier, flowId }) });
}
export function buildPasswordRoleSignInFlowVerifyRequest(value: unknown): PasswordRoleBrowserRequest<PasswordRoleBrowserFlowVerifyBody> {
  const fields = fieldsOf(value, 4);
  const identifier = fields?.get("identifier");
  const password = fields?.get("password");
  const flowId = fields?.get("flowId");
  const code = fields?.get("code");
  if (fields?.size !== 4 || identifier === undefined || password === undefined || flowId === undefined || code === undefined) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  return Object.freeze({ ok: true, body: Object.freeze({ identifier, password, flowId, code }) });
}
function isSelector(value: string | undefined): value is string {
  // Exact lowercase UUID grammar, including nil and non-v4 versions.
  return typeof value === "string" && value.length === 36 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}
function parseSend<T extends "invalid_email" | "invalid_identifier">(
  value: unknown, invalid: T,
): PasswordRoleBrowserParsedReply<PasswordRoleBrowserAcknowledgment | Readonly<{ outcome: T | "denied" }>> {
  const fields = fieldsOf(value, 2);
  if (fields === null) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  const outcome = fields.get("outcome");
  if (fields.size === 1 && (outcome === invalid || outcome === "denied")) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome: outcome === invalid ? invalid : "denied" }) });
  }
  const challengeId = fields.get("challengeId");
  if (fields.size === 2 && fields.get("acknowledgment") === "verification_code_requested" && isSelector(challengeId)) {
    return Object.freeze({ ok: true, value: Object.freeze({ acknowledgment: "verification_code_requested", challengeId }) });
  }
  return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
}
function parseVerify<T extends typeof GUIDE_BROWSER_SIGN_IN_HOME | typeof ADMIN_BROWSER_SIGN_IN_HOME>(
  value: unknown, destination: T,
): PasswordRoleBrowserParsedReply<Readonly<{ outcome: "not_matched" | "denied" }> | Readonly<{ outcome: "signed_in"; destination: T }>> {
  const fields = fieldsOf(value, 2);
  if (fields === null) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  const outcome = fields.get("outcome");
  if (fields.size === 1 && (outcome === "not_matched" || outcome === "denied")) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome }) });
  }
  if (fields.size === 2 && outcome === "signed_in" && fields.get("destination") === destination) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome: "signed_in", destination }) });
  }
  return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
}
function parseFlowSend<T extends "invalid_email" | "invalid_identifier">(
  value: unknown, invalid: T,
): PasswordRoleBrowserParsedReply<PasswordRoleBrowserFlowAcknowledgment | Readonly<{ outcome: T | "denied" }>> {
  const fields = fieldsOf(value, 2);
  if (fields === null) return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
  const outcome = fields.get("outcome");
  if (fields.size === 1 && (outcome === invalid || outcome === "denied")) {
    return Object.freeze({ ok: true, value: Object.freeze({ outcome: outcome === invalid ? invalid : "denied" }) });
  }
  const flowId = fields.get("flowId");
  if (fields.size === 2 && fields.get("acknowledgment") === "verification_code_requested" && isSelector(flowId)) {
    return Object.freeze({ ok: true, value: Object.freeze({ acknowledgment: "verification_code_requested", flowId }) });
  }
  return PASSWORD_ROLE_BROWSER_CONTRACT_FAILED;
}
export function parseGuideSignInSendReply(value: unknown): PasswordRoleBrowserParsedReply<GuideBrowserSendReply> {
  return parseSend(value, "invalid_email");
}
export function parseAdminSignInSendReply(value: unknown): PasswordRoleBrowserParsedReply<AdminBrowserSendReply> {
  return parseSend(value, "invalid_identifier");
}
export function parseGuideSignInFlowSendReply(value: unknown): PasswordRoleBrowserParsedReply<GuideBrowserFlowSendReply> {
  return parseFlowSend(value, "invalid_email");
}
export function parseAdminSignInFlowSendReply(value: unknown): PasswordRoleBrowserParsedReply<AdminBrowserFlowSendReply> {
  return parseFlowSend(value, "invalid_identifier");
}
export function parseGuideSignInVerifyReply(value: unknown): PasswordRoleBrowserParsedReply<GuideBrowserVerifyReply> {
  return parseVerify(value, GUIDE_BROWSER_SIGN_IN_HOME);
}
export function parseAdminSignInVerifyReply(value: unknown): PasswordRoleBrowserParsedReply<AdminBrowserVerifyReply> {
  return parseVerify(value, ADMIN_BROWSER_SIGN_IN_HOME);
}
