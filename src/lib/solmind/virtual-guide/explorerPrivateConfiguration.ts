import "server-only";
import { createHash } from "node:crypto";
import { types } from "node:util";
import { EXPLORER_PRIVATE_CONFIGURATION_CANDIDATE_DATA } from "./explorerPrivateConfigurationCandidate";

/**
 * One pinned, inert construction candidate. This type expresses exact content,
 * not methodology approval, resource suitability or operational authority.
 * Runtime helpers import this type only; the getter is never default wiring.
 */
export type ExplorerPrivateConfigurationCandidate =
  typeof EXPLORER_PRIVATE_CONFIGURATION_CANDIDATE_DATA;

const VERSION_LABEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256 = /^[0-9A-F]{64}$/;
const DATA = EXPLORER_PRIVATE_CONFIGURATION_CANDIDATE_DATA;

function pinnedIntegrity(): boolean {
  const versions = [DATA.protocolVersion, DATA.promptVersion, DATA.instructionVersion,
    DATA.roleVersion, DATA.globalPolicy.version, DATA.roleBehavior.version,
    DATA.crisisBehavior.version, DATA.fallback.version, DATA.fallback.normalizationVersion,
    DATA.trustedResponses.version, DATA.resourceCandidate.version];
  return versions.every(value => VERSION_LABEL.test(value)) &&
    SHA256.test(DATA.methodologySubjectSha256) &&
    [DATA.globalPolicy, DATA.roleBehavior, DATA.crisisBehavior].every(part =>
      SHA256.test(part.sha256) &&
      createHash("sha256").update(part.text, "utf8").digest("hex").toUpperCase() === part.sha256);
}

// The finite expected tree is trusted static data, not a caller-selected schema.
// Reject proxies before reflection, and examine data descriptors before values.
// Nothing stringifies, coerces or executes any property on the unknown input.
function copyPinned(input: unknown, expected: unknown): unknown {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(input, expected)) throw new Error("candidate_unavailable");
    return expected;
  }
  if (input === null || typeof input !== "object" || types.isProxy(input)) {
    throw new Error("candidate_unavailable");
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype ||
        Reflect.ownKeys(input).length !== expected.length + 1) throw new Error("candidate_unavailable");
    const length = Object.getOwnPropertyDescriptor(input, "length");
    if (!length || !("value" in length) || length.value !== expected.length) throw new Error("candidate_unavailable");
    const result: unknown[] = [];
    for (let index = 0; index < expected.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("candidate_unavailable");
      result.push(copyPinned(descriptor.value, expected[index]));
    }
    return Object.freeze(result);
  }
  if (Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new Error("candidate_unavailable");
  }
  const expectedRecord = expected as Record<string, unknown>;
  const keys = Object.keys(expectedRecord);
  const actualKeys = Reflect.ownKeys(input);
  if (actualKeys.length !== keys.length || actualKeys.some(key => typeof key !== "string" || !keys.includes(key))) {
    throw new Error("candidate_unavailable");
  }
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("candidate_unavailable");
    result[key] = copyPinned(descriptor.value, expectedRecord[key]);
  }
  return Object.freeze(result);
}

/**
 * Only this exact reviewed-language candidate is supported. In particular this
 * is not an arbitrary-regex configuration interpreter or an approval parser.
 * Every valid return is a new deeply frozen copy. Failure exposes no input.
 */
export function parseExplorerPrivateConfigurationCandidate(
  input: unknown,
): ExplorerPrivateConfigurationCandidate | null {
  try {
    if (!pinnedIntegrity()) return null;
    return copyPinned(input, DATA) as ExplorerPrivateConfigurationCandidate;
  } catch {
    return null;
  }
}

/** Inert candidate access only; no provider, resolver, environment or activation. */
export function getExplorerPrivateConfigurationCandidate(): ExplorerPrivateConfigurationCandidate | null {
  return parseExplorerPrivateConfigurationCandidate(DATA);
}
