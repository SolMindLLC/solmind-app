import "server-only";

import { createServiceRoleClient } from "../supabase/serviceRoleClient";
import {
  createLocalSmtpVerificationCodeTransport,
  type LocalSmtpVerificationCodeTransportConfiguration,
} from "./localSmtpVerificationCodeDelivery";
import {
  VerificationChallengeError,
  createVerificationChallengeIssuer,
  createVerificationChallengeRedeemer,
  type VerificationChallengeIssuer,
  type VerificationChallengeRedeemer,
  type VerificationChallengeRpcClient,
} from "./verificationChallengeCallers";
import { type VerificationCodePepper } from "./verificationCode";
import { type VerificationCodeDeliveryTransport } from "./verificationCodeDelivery";
import {
  VERIFICATION_CODE_EMAIL_SENDER,
  VERIFICATION_CODE_EMAIL_WORDING,
} from "./verificationCodeEmailWording";

// Login step 5: the dormant server composition root for verification
// challenges. It wires the public issuing and redeeming callers to the real
// transports:
//   - the database: the server-only service-role Supabase client from
//     `createServiceRoleClient()`, used only through the callers' two fixed
//     functions. That factory reads its two existing server environment
//     variables when this root is called, never when a module loads. Each
//     call passes an AbortSignal through postgrest-js's `abortSignal()`,
//     which hands it to `fetch`, so at the caller response deadline the
//     abort requests cancellation through `fetch`. Whether the transport
//     cancels, and whether and when the call then settles, depend on the
//     transport (postgrest-js turns `fetch`'s AbortError into an error
//     answer); nothing proves that PostgreSQL stops work it has already
//     started;
//   - delivery: login step 4's loopback-only local development SMTP
//     transport, with the approved email sender and wording. Only the issuing
//     caller reaches it, and only through the delivery boundary.
//
// Everything else is explicit configuration with no defaults: the pepper
// handle, the local SMTP host and port, the delivery time ceiling (10 ms to
// 15 s, used for both the boundary's ceiling and the transport's deadline),
// and the caller response deadline for database calls (10 ms to 60 s). This
// root reads no environment variable of its own.
//
// The bound: this root takes no slot pool and cannot be given one. Its
// callers come from `verificationChallengeCallers.ts`, whose two module-level
// pools every root shares, so the bound stated there (per loaded copy of that
// module in one process, at most four issuances, each with at most one
// delivery attempt through the delivery boundary, and four redemption calls
// in progress at the client) holds for every root, whatever client or
// transport it was given. That is how login step 4's duty for this root, to
// bound how many sends run at once, is met.
//
// Dormant: nothing calls this root, and no route, server action, cookie,
// session or UI uses it. Tests inject the RPC client and the transport. Any
// failure while composing becomes one fixed, value-free error, so no
// environment value, key or dependency message escapes.
//
// Not provided here, and owed before activation: the pepper's source and the
// startup check that AUTH-RLS-DEC-032 requires; the shared contact
// normalizer of AUTH-RLS-DEC-033; and the route-owned purpose and
// eligibility. Keep this module direct-import only and off every barrel.

export type VerificationChallengeCompositionConfiguration = Readonly<{
  pepper: VerificationCodePepper;
  localSmtpHost: string;
  localSmtpPort: number;
  deliveryTimeoutMilliseconds: number;
  rpcTimeoutMilliseconds: number;
}>;

export type VerificationChallengeCompositionDependencies = Readonly<{
  createRpcClient: () => VerificationChallengeRpcClient;
  createDeliveryTransport: (
    configuration: LocalSmtpVerificationCodeTransportConfiguration,
  ) => VerificationCodeDeliveryTransport;
}>;

export type VerificationChallengeServices = Readonly<{
  issuer: VerificationChallengeIssuer;
  redeemer: VerificationChallengeRedeemer;
}>;

const CONFIGURATION_KEYS = Object.freeze([
  "pepper",
  "localSmtpHost",
  "localSmtpPort",
  "deliveryTimeoutMilliseconds",
  "rpcTimeoutMilliseconds",
] as const);
const DEPENDENCY_KEYS = Object.freeze(["createRpcClient", "createDeliveryTransport"] as const);

const REAL_DEPENDENCIES: VerificationChallengeCompositionDependencies = Object.freeze({
  createRpcClient: createServiceRoleClient,
  createDeliveryTransport: createLocalSmtpVerificationCodeTransport,
});

// Reads exactly the listed keys of a plain object through own data property
// descriptors only, so no getter, setter or Proxy `get` trap runs. Returns
// null for anything else; an exception is dropped unread.
function readExactDataProperties(
  value: unknown,
  keys: ReadonlyArray<string>,
): ReadonlyMap<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      !ownKeys.every(
        (key) =>
          typeof key === "string" &&
          keys.includes(key) &&
          Object.prototype.propertyIsEnumerable.call(value, key),
      )
    ) {
      return null;
    }
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value")
      ) {
        return null;
      }
      fields.set(key, descriptor.value);
    }
    return fields;
  } catch {
    return null;
  }
}

function compose(
  configuration: unknown,
  dependencies: unknown,
): VerificationChallengeServices | null {
  const settings = readExactDataProperties(configuration, CONFIGURATION_KEYS);
  const wiring = readExactDataProperties(dependencies, DEPENDENCY_KEYS);
  if (settings === null || wiring === null) {
    return null;
  }
  const createRpcClient = wiring.get("createRpcClient");
  const createDeliveryTransport = wiring.get("createDeliveryTransport");
  if (typeof createRpcClient !== "function" || typeof createDeliveryTransport !== "function") {
    return null;
  }
  const deliveryTimeoutMilliseconds = settings.get("deliveryTimeoutMilliseconds");
  const rpcClient: unknown = createRpcClient();
  const deliveryTransport: unknown = createDeliveryTransport(
    Object.freeze({
      host: settings.get("localSmtpHost"),
      port: settings.get("localSmtpPort"),
      sender: VERIFICATION_CODE_EMAIL_SENDER,
      wording: VERIFICATION_CODE_EMAIL_WORDING,
      timeoutMilliseconds: deliveryTimeoutMilliseconds,
    }),
  );
  // The callers check every remaining value and refuse anything malformed.
  const issuer = createVerificationChallengeIssuer({
    rpcClient: rpcClient as VerificationChallengeRpcClient,
    rpcTimeoutMilliseconds: settings.get("rpcTimeoutMilliseconds") as number,
    pepper: settings.get("pepper") as VerificationCodePepper,
    deliveryTransport: deliveryTransport as VerificationCodeDeliveryTransport,
    deliveryTimeoutMilliseconds: deliveryTimeoutMilliseconds as number,
  });
  const redeemer = createVerificationChallengeRedeemer({
    rpcClient: rpcClient as VerificationChallengeRpcClient,
    rpcTimeoutMilliseconds: settings.get("rpcTimeoutMilliseconds") as number,
    pepper: settings.get("pepper") as VerificationCodePepper,
  });
  return Object.freeze({ issuer, redeemer });
}

export function createVerificationChallengeServices(
  configuration: VerificationChallengeCompositionConfiguration,
  dependencies: VerificationChallengeCompositionDependencies = REAL_DEPENDENCIES,
): VerificationChallengeServices {
  let services: VerificationChallengeServices | null;
  try {
    services = compose(configuration, dependencies);
  } catch {
    // Dropped unread: an environment, client or transport error must not
    // reach a later route.
    services = null;
  }
  if (services === null) {
    throw new VerificationChallengeError("verification_challenge_invalid_configuration");
  }
  return services;
}
