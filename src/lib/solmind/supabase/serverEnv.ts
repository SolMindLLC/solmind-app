// SolMind MVP0 server-only Supabase env reader.
//
// Purpose:
//   - read and validate the server-side configuration the service-role client
//     needs, without exposing secrets to the browser or logging them.
//
// Server-only boundary:
//   - The `server-only` package is not a dependency in this slice (only
//     @supabase/supabase-js was approved), so this module enforces the boundary
//     with a runtime guard and by staying OFF the shared src/lib/solmind/supabase
//     index barrel. Import it only from explicit server paths.
//   - The service-role key must come ONLY from SUPABASE_SERVICE_ROLE_KEY and must
//     never be read from a NEXT_PUBLIC_ variable or sent to the client.
//   - Never log the values read here.

if (typeof window !== "undefined") {
  throw new Error(
    "SolMind server configuration error: serverEnv must not be imported in browser code.",
  );
}

export type SupabaseServiceRoleEnv = {
  // Public Supabase URL (also browser-safe); reused on the server.
  supabaseUrl: string;
  // Server-only service-role key. Never browser-exposed.
  serviceRoleKey: string;
};

// Read a required server environment variable. Throws a clear configuration
// error (naming the variable, never its value) when missing or blank.
function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `SolMind server configuration error: required server environment variable ${name} is missing or blank.`,
    );
  }
  return value;
}

// Read the service-role configuration. The URL comes from
// NEXT_PUBLIC_SUPABASE_URL (public, not a secret); the service-role key comes
// ONLY from SUPABASE_SERVICE_ROLE_KEY (server-only secret).
export function readSupabaseServiceRoleEnv(): SupabaseServiceRoleEnv {
  const supabaseUrl = requireServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { supabaseUrl, serviceRoleKey };
}
