import "server-only";

import type { VerificationChallengeCompositionConfiguration } from "./verificationChallengeComposition";
import { loadVerificationPepper } from "./verificationPepperSource";

// Login step 6, sub-slice S6-1: the login route configuration.
//
// What it supplies. Login step 5's dormant composition root takes "explicit
// configuration with no defaults": the pepper handle, the local SMTP host and
// port, the delivery time ceiling (10 ms to 15 s) and the caller response
// deadline for database calls (10 ms to 60 s). This module supplies exactly
// that object, in exactly the shape the root reads (a plain frozen object
// with those five keys as own data properties), so the future route
// composition (S6-8) can hand it to the root unchanged. Paul's 2026-10-05
// evening decision 1 accepted that the settings banked decisions already
// require (the AUTH-RLS-DEC-032 pepper, the step 5 root's delivery settings
// and the trusted origin) are within login step 6, with no change to
// `supabase/config.toml` or to any hosted configuration; the contract 25
// wording that records that meaning, and its register record, belong to
// sub-slice S6-3.
//
// The delivery settings are fixed here, reviewed with the code, not read from
// the environment:
//   - host `127.0.0.1`: login step 4's local transport accepts only the
//     literal `127.0.0.1` or `::1`; this is the IPv4 one, as the local
//     setup names `127.0.0.1` elsewhere too (Supabase's `site_url` is
//     `http://127.0.0.1:3000`). No send to the local mail catcher has run
//     yet; the route slice's database-backed run (S6-8) is the first;
//   - port 54325: the local mail catcher's SMTP port, which
//     `supabase/config.toml` (`[inbucket] smtp_port`) publishes for this
//     step. A test reads that file, so the two cannot drift apart unseen;
//   - delivery ceiling 5,000 ms: the local mail catcher normally answers in
//     milliseconds, and the ceiling only bounds a stuck send. Like every
//     local delivery outcome, a send cut off by it may or may not have
//     reached the catcher;
//   - caller response deadline 6,000 ms: the issuance function takes two
//     advisory locks in turn, and each may wait up to its `lock_timeout` of
//     2,000 ms, so the deadline must be longer than 4,000 ms, or contention
//     alone could turn issuances that commit into `failed` answers that still
//     spend the person's budget. The 6,000 ms caller response deadline leaves
//     2,000 ms beyond the two documented advisory-lock waits. Other waiting,
//     execution, transport and scheduling delays can still cause a committed
//     issuance to be reported as failed. A test reads the current issuance
//     migration's `lock_timeout`.
// The pepper is the only secret, and the only value read from the
// environment, through the pepper source beside this module.
//
// Local only. These settings point at the local mail catcher. A hosted
// environment needs a provider adapter, which does not exist yet; the route
// composition (S6-8) must not compose the local transport unless the trusted
// origin is a loopback origin.
//
// The startup check. AUTH-RLS-DEC-032 requires the pepper at startup.
// `checkLoginVerificationConfigurationAtStartup` loads the whole
// configuration once and returns nothing; on any failure it throws the pepper
// source's one fixed, value-free error. Calling it when the server starts
// (Next.js 16's `instrumentation.ts` `register`, in the Node.js runtime only,
// since the pepper path uses `node:crypto`) is the first activating slice's
// duty (S6-8), not this slice's: until then the requirement is met only in
// that a route composition that loads this configuration fails closed.
//
// What it never does: log, write anything, read any other setting, or cache
// a pepper; each call makes a new handle. Its type-only import of the step 5
// root is erased at runtime, so loading this module does not load the root.
//
// Dormant: no application runtime caller is introduced; no application file
// imports this module, and the unit tests do. Keep it server-only,
// direct-import only and off every barrel.

export const LOGIN_VERIFICATION_DELIVERY_SETTINGS = Object.freeze({
  localSmtpHost: "127.0.0.1",
  localSmtpPort: 54325,
  deliveryTimeoutMilliseconds: 5_000,
  rpcTimeoutMilliseconds: 6_000,
} as const);

// The step 5 root's configuration: the pepper from the pepper source and the
// fixed delivery settings, as one frozen plain object with exactly the five
// keys the root reads. Throws the pepper source's one fixed error.
export function loadLoginVerificationConfiguration(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): VerificationChallengeCompositionConfiguration {
  const pepper = loadVerificationPepper(environment);
  const configuration: VerificationChallengeCompositionConfiguration = {
    pepper,
    localSmtpHost: LOGIN_VERIFICATION_DELIVERY_SETTINGS.localSmtpHost,
    localSmtpPort: LOGIN_VERIFICATION_DELIVERY_SETTINGS.localSmtpPort,
    deliveryTimeoutMilliseconds: LOGIN_VERIFICATION_DELIVERY_SETTINGS.deliveryTimeoutMilliseconds,
    rpcTimeoutMilliseconds: LOGIN_VERIFICATION_DELIVERY_SETTINGS.rpcTimeoutMilliseconds,
  };
  return Object.freeze(configuration);
}

// The startup check of AUTH-RLS-DEC-032: loads the configuration once and
// discards it. Returns nothing; throws the pepper source's one fixed error.
export function checkLoginVerificationConfigurationAtStartup(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void {
  loadLoginVerificationConfiguration(environment);
}
