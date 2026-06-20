// SolMind MVP0 auth source record-loading seam.
//
// Purpose:
//   - define HOW future server code obtains the trusted record projections that
//     deriveTrustedServerAuthContext and the relationship read guard consume,
//     WITHOUT implementing any real Supabase/session/database IO yet;
//   - give route/server-action integration (and its tests) a typed contract to
//     depend on, plus a deterministic in-memory adapter to test against.
//
// Architecture notes (MVP0):
//   - This seam LOADS source records; it does NOT authorize. It never calls
//     deriveTrustedServerAuthContext, authorizeRouteAccess, or
//     authorizeGuideRelationshipRead. Authorization stays in the guard layer,
//     which consumes what this seam returns.
//   - The methods are async (Promise-returning) on purpose: the real adapter
//     will perform IO, so modeling the contract as async now avoids a breaking
//     signature change later. The in-memory adapter below performs NO IO; it
//     resolves immediately and deterministically.
//   - Request values are LOOKUP SELECTORS only, never authority. The
//     authenticatedUser on a load request is the server-verified Supabase Auth
//     principal (established server-side from a verified session, never a
//     browser claim) and is used only as a lookup key. A relationship id is a
//     browser-supplied selector used only to choose which record to load; the
//     guard re-binds and authorizes it. This seam returns whatever the source
//     holds and lets the guards decide.
//   - This module makes NO Supabase, network, filesystem, cookie, header,
//     session, route-param, or environment calls, and adds NO new role strings
//     or product terms.

import {
  type DeriveTrustedServerAuthContextInput,
  type SupabaseAuthenticatedUser,
} from "./serverAuthContext";
import { type SolMindRelationshipRecord } from "./relationshipAccess";

// --- Load request shapes (lookup selectors only, NOT authority) ---

// Lookup key for the trusted auth context records: the server-verified Supabase
// Auth principal. It is server-established, not a browser claim, and is used
// only to find the stored records.
export type LoadServerAuthContextInputRequest = {
  authenticatedUser: SupabaseAuthenticatedUser;
};

// Lookup criteria for a single Guide relationship record. relationshipId is a
// browser-supplied selector; it only selects which record to load. The real
// adapter should additionally scope the query server-side as defense in depth,
// but authority is always decided later by the relationship read guard.
export type LoadGuideRelationshipRequest = {
  relationshipId: string;
};

// --- The port future server code implements ---
//
// A concrete Supabase-backed adapter (a later, separately-approved slice) will
// implement this same interface; routes/server actions depend on the interface,
// not on any concrete client.
export interface SolMindAuthSource {
  // Load the trusted record projections consumed by
  // deriveTrustedServerAuthContext. Returns the existing input shape directly so
  // it slots into the guard layer with zero adaptation. Records that the source
  // does not hold are returned as null, which the guard layer denies by default.
  loadServerAuthContextInput(
    request: LoadServerAuthContextInputRequest,
  ): Promise<DeriveTrustedServerAuthContextInput>;

  // Load a single Guide relationship record by id, or null when the source has
  // no such record. This is a record load, never an authorization decision.
  loadGuideRelationship(
    request: LoadGuideRelationshipRequest,
  ): Promise<SolMindRelationshipRecord | null>;
}

// --- In-memory adapter (deterministic, IO-free; for tests and integration) ---
//
// NOTE: in-memory records are a test/integration fixture, NOT production
// storage. This adapter implies nothing about real persistence and holds no
// real pilot data. The real source is a future Supabase-backed adapter.

// One stored account: the server-verified principal used as the lookup key, and
// the exact trusted records to return for it. The records are returned verbatim;
// the request never injects or overrides them.
export type InMemoryAuthAccountFixture = {
  principal: SupabaseAuthenticatedUser;
  serverAuthContextInput: DeriveTrustedServerAuthContextInput;
};

export type InMemoryAuthSourceFixture = {
  accounts?: InMemoryAuthAccountFixture[];
  relationships?: SolMindRelationshipRecord[];
};

// The trusted input returned when no account matches the requested principal:
// every record is null, so the guard layer denies by default. The verified
// principal is intentionally NOT echoed here as a record, so an unmatched
// request value can never masquerade as a loaded record.
const EMPTY_SERVER_AUTH_CONTEXT_INPUT: DeriveTrustedServerAuthContextInput = {
  authenticatedUser: null,
  authProviderIdentity: null,
  userAccount: null,
  session: null,
  activeRoleAssignment: null,
  guideProfile: null,
  explorerProfile: null,
};

function principalMatches(
  a: SupabaseAuthenticatedUser,
  b: SupabaseAuthenticatedUser,
): boolean {
  return (
    a.providerName === b.providerName && a.providerUserId === b.providerUserId
  );
}

// Create a deterministic, side-effect-free in-memory SolMindAuthSource from
// explicitly provided server-trusted records. It never mutates the fixture and
// never treats a request selector as authority.
export function createInMemoryAuthSource(
  fixture: InMemoryAuthSourceFixture = {},
): SolMindAuthSource {
  const accounts = fixture.accounts ?? [];
  const relationships = fixture.relationships ?? [];

  return {
    loadServerAuthContextInput(request) {
      const match = accounts.find((account) =>
        principalMatches(account.principal, request.authenticatedUser),
      );
      // Records come only from the store. On a miss, return the all-null input
      // so the guard layer denies by default.
      return Promise.resolve(
        match ? match.serverAuthContextInput : EMPTY_SERVER_AUTH_CONTEXT_INPUT,
      );
    },

    loadGuideRelationship(request) {
      const match = relationships.find(
        (relationship) =>
          relationship.guideExplorerRelationshipId === request.relationshipId,
      );
      // A missing record returns null; this is a load, not an authorization.
      return Promise.resolve(match ?? null);
    },
  };
}
