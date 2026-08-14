// PRJ01_V-WS05-WI022-S03 concrete server-only request dependencies.
//
// This request-scoped factory is the single concrete assembly owner for the
// banked Suggested Waypoint human-request composition. It wires verified
// request identity, enumerated auth-record reads, the closed human RPC
// executor, and deterministic scoped identifiers. It adds no route, Server
// Action, browser caller, worker, provider, or deployment behavior.

import "server-only";

import { type RequestCookieAccessor } from "../auth/requestCookieAccessor";
import { createSupabaseRequestAuthPrincipalSource } from "./requestAuthClient";
import { createServiceRoleClient } from "./serviceRoleClient";
import { createServiceRoleRpcExecutor } from "./serviceRoleRpcExecutor";
import { createSupabaseAuthQueryClient } from "./supabaseAuthQueryClient";
import { createSupabaseAuthSource } from "./serverAuthSourceAdapter";
import {
  type SuggestedWaypointRequestCompositionDependencies,
} from "./suggestedWaypointRequestComposition";
import { createSuggestedWaypointHumanRpcExecutor } from "./suggestedWaypointRpcExecutor";
import { createSuggestedWaypointScopedIdentifiers } from "./suggestedWaypointScopedIdentifiers";

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: suggestedWaypointRequestDependencies must not be imported in browser code.",
  );
}

export type ConcreteSuggestedWaypointRequestDependencies = Readonly<
  Omit<SuggestedWaypointRequestCompositionDependencies, "identifiers"> & {
    identifiers: NonNullable<
      SuggestedWaypointRequestCompositionDependencies["identifiers"]
    >;
  }
>;

export const SUGGESTED_WAYPOINT_REQUEST_DEPENDENCY_CONFIGURATION_FAILED =
  "SolMind Suggested Waypoint request dependencies are unavailable." as const;

export function createSuggestedWaypointRequestDependencies(args: {
  cookies: RequestCookieAccessor;
  now?: () => Date;
}): ConcreteSuggestedWaypointRequestDependencies {
  try {
    const principalSource = createSupabaseRequestAuthPrincipalSource({
      cookies: args.cookies,
    });
    const serviceRoleClient = createServiceRoleClient();
    const authQueryExecutor = createServiceRoleRpcExecutor(serviceRoleClient);
    const authSource = createSupabaseAuthSource(
      createSupabaseAuthQueryClient({
        client: authQueryExecutor,
        now: args.now ?? (() => new Date()),
      }),
    );
    const executor = createSuggestedWaypointHumanRpcExecutor(serviceRoleClient);
    const identifiers = createSuggestedWaypointScopedIdentifiers();

    return Object.freeze({
      principalSource,
      authSource,
      executor,
      identifiers,
    });
  } catch {
    // Never expose environment values, client details, or dependency errors to
    // a later route/action composition root.
    throw new Error(
      SUGGESTED_WAYPOINT_REQUEST_DEPENDENCY_CONFIGURATION_FAILED,
    );
  }
}
