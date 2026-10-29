import "server-only";

// Guide/Admin R04 request-body shape only. The existing request guard owns
// framing and byte limits; identifier normalization and factor validation remain
// later stages. Preserve every raw string, especially password text, unchanged.
// This module supplies no role, response, destination, timing or auth authority.
// Keep it pure, direct-import only and absent from every shared/browser barrel.

export type PasswordRoleSignInLegacySendBody = Readonly<{ identifier: string }>;
export type PasswordRoleSignInFlowSendBody = Readonly<{ identifier: string; flowId: string }>;
export type PasswordRoleSignInSendBody = PasswordRoleSignInLegacySendBody | PasswordRoleSignInFlowSendBody;
export type PasswordRoleSignInLegacyVerifyBody = Readonly<{
  identifier: string;
  password: string;
  challengeId: string;
  code: string;
}>;
export type PasswordRoleSignInFlowVerifyBody = Readonly<{
  identifier: string;
  password: string;
  flowId: string;
  code: string;
}>;
export type PasswordRoleSignInVerifyBody = PasswordRoleSignInLegacyVerifyBody | PasswordRoleSignInFlowVerifyBody;

const SEND_KEYS = Object.freeze(["identifier"]);
const VERIFY_KEYS = Object.freeze(["identifier", "password", "challengeId", "code"]);
const FLOW_SEND_KEYS = Object.freeze(["identifier", "flowId"]);
const FLOW_VERIFY_KEYS = Object.freeze(["identifier", "password", "flowId", "code"]);

// One descriptor pass selects an exact legacy or flow variant; never combine
// selectors or fall back from flow interpretation to direct challenge authority.
// Inspect each field descriptor once. Never evaluate field getters, coerce a
// value, or inspect an exception. Reflection traps may execute; a synchronous
// parser cannot bound a hostile trap that never returns. Inputs are data records.
function readStrings(value: unknown, keys: ReadonlyArray<string>, alternateKeys: ReadonlyArray<string>): ReadonlyMap<string, string> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    const selected = [keys, alternateKeys].find(candidate => ownKeys.length === candidate.length &&
      ownKeys.every(key => typeof key === "string" && candidate.includes(key)));
    if (selected === undefined) return null;
    const fields = new Map<string, string>();
    for (const key of selected) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "string") return null;
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

export function parsePasswordRoleSignInSendBody(value: unknown): PasswordRoleSignInSendBody | null {
  const fields = readStrings(value, SEND_KEYS, FLOW_SEND_KEYS);
  if (fields === null) return null;
  return fields.has("flowId")
    ? Object.freeze({ identifier: fields.get("identifier") as string, flowId: fields.get("flowId") as string })
    : Object.freeze({ identifier: fields.get("identifier") as string });
}

export function parsePasswordRoleSignInVerifyBody(value: unknown): PasswordRoleSignInVerifyBody | null {
  const fields = readStrings(value, VERIFY_KEYS, FLOW_VERIFY_KEYS);
  if (fields === null) return null;
  if (fields.has("flowId")) return Object.freeze({
    identifier: fields.get("identifier") as string,
    password: fields.get("password") as string,
    flowId: fields.get("flowId") as string,
    code: fields.get("code") as string,
  });
  return Object.freeze({
    identifier: fields.get("identifier") as string,
    password: fields.get("password") as string,
    challengeId: fields.get("challengeId") as string,
    code: fields.get("code") as string,
  });
}
