// SolMind MVP0 server-side authorization helpers.
//
// Deterministic, deny-by-default helpers that resolve a trusted SolMind actor
// from already-fetched DB records and gate Guide/Explorer relationship access.
// Browser-supplied role, user IDs, and relationship IDs are selectors only;
// these helpers treat server-fetched records as the source of truth.
//
// These helpers make no Supabase, network, filesystem, or environment calls.

export * from "./roleContext";
export * from "./relationshipAccess";
export * from "./accessBoundary";
export * from "./serverAuthContext";
