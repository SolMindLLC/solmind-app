// SolMind MVP0 Supabase server integration.
//
// Dependency-free mapping layer that implements the SolMindAuthSource port
// against an injected query client. The real Supabase-backed query client (env,
// service-role, network) is a later, separately-approved slice that implements
// SolMindAuthQueryClient. Nothing here imports a Supabase client, reads env, or
// performs IO of its own.

export * from "./serverAuthSourceAdapter";
export * from "./principalMapping";
export * from "./sessionSelection";
