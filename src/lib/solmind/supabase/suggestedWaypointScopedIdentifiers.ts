// PRJ01_V-WS05-WI022-S03 deterministic Suggested Waypoint identifier source.
//
// This server-only owner derives UUIDv5 identifiers from an exact authority
// scope. Identical retries receive identical identifiers, while actor,
// relationship, operation, suggestion, and identifier-purpose changes produce
// a different namespace input. Browser code supplies none of these derived
// identifiers.

import "server-only";

import { createHash } from "node:crypto";

import { type SuggestedWaypointRequestCompositionDependencies } from "./suggestedWaypointRequestComposition";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointScopedIdentifiers must not be imported in browser code.",
  );
}

type SuggestedWaypointScopedIdentifiers = NonNullable<
  SuggestedWaypointRequestCompositionDependencies["identifiers"]
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Dedicated, immutable namespace for SolMind Suggested Waypoint identifiers.
// Changing it would break retry stability, so it is a persisted code contract.
export const SUGGESTED_WAYPOINT_IDENTIFIER_NAMESPACE =
  "7b47a4ae-2f86-4d57-8fa8-312f52ba58e4" as const;

function uuidBytes(value: string): Buffer {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("SolMind Suggested Waypoint identifier scope is invalid.");
  }
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

function canonicalUuid(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("SolMind Suggested Waypoint identifier scope is invalid.");
  }
  return value.toLowerCase();
}

function uuidV5(namespace: string, name: string): string {
  const digest = createHash("sha1")
    .update(Buffer.concat([uuidBytes(namespace), Buffer.from(name, "utf8")]))
    .digest()
    .subarray(0, 16);

  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;

  const hex = digest.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function scope(parts: readonly string[]): string {
  // JSON over a fixed-position tuple prevents delimiter ambiguity and preserves
  // exact scope separation across processes and retries.
  return JSON.stringify(parts);
}

export function createSuggestedWaypointScopedIdentifiers(): SuggestedWaypointScopedIdentifiers {
  return Object.freeze({
    suggestedWaypointIdForCreate(args) {
      return uuidV5(
        SUGGESTED_WAYPOINT_IDENTIFIER_NAMESPACE,
        scope([
          "solmind",
          "suggested-waypoint",
          "create",
          canonicalUuid(args.actorUserAccountId),
          canonicalUuid(args.relationshipId),
          canonicalUuid(args.operationId),
        ]),
      );
    },
    versionIdForSchedule(args) {
      return uuidV5(
        SUGGESTED_WAYPOINT_IDENTIFIER_NAMESPACE,
        scope([
          "solmind",
          "suggested-waypoint-version",
          "schedule",
          canonicalUuid(args.actorUserAccountId),
          canonicalUuid(args.relationshipId),
          canonicalUuid(args.operationId),
          canonicalUuid(args.suggestedWaypointId),
        ]),
      );
    },
  });
}
