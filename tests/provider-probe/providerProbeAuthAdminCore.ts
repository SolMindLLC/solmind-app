// RESTRICTED test-only Auth admin core for the future local Supabase Auth provider
// probes. It accepts an injected client, so only the restricted run core
// (`providerProbeRunCore.ts`, which builds the client over the gated, fixed-target
// production Auth fetch) and named unit tests may import it;
// `providerProbeModuleBoundary.test.ts` enforces that.
//
// It owns exactly one effect: creating one run-tagged synthetic local Auth user. This
// is the effect-owning creation operation whose successful result issues the cleanup
// receipt; there is no other probe operation here.
//
// - The address is minted here, never supplied by a caller: the lowercase run tag, a
//   hyphen and 16 random base-32 characters (80 bits from `node:crypto`), at the
//   reserved `synthetic.invalid` domain. Nobody outside the run can know it in advance.
// - Before the call: any generated credential must be 16-256 characters with no line
//   break; no other creation by this admin may be in flight; and a ledger reservation
//   is taken, which needs the live gate, a recording ledger and a unit of capacity,
//   and keeps cleanup from starting until the creation settles.
// - The address, the credential and the created id are registered in the run's
//   known-value registry, so the output scanner refuses any copy of them.
// - After a successful result with a valid id, the reservation is committed with the
//   receipt at once, before any further check, so a user whose id came back is always
//   tracked. Only if the server confirms the minted address exactly does that address
//   become a run-owned recipient, the one thing that lets a test message earn a
//   cleanup receipt. A failed creation releases the reservation. If the transport
//   fails after the server has created a user, no id comes back and no receipt can
//   exist; the later final no-side-effect proof must look for it by run tag.
// - The caller receives the minted address (needed in memory by later probes; it is
//   registered), a value-free status and an opaque handle that can answer "is this the
//   same user id?". The id itself never leaves this module.

import { randomBytes } from "node:crypto";

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import type { ProviderProbeCleanupLedger, ProviderProbeCleanupReservation } from "./providerProbeCleanupLedger";
import {
  addRunOwnedRecipient,
  isRunOwnedRecipientsRecord,
  isValidCleanupId,
  issueCleanupReceipt,
  type ProviderProbeRunOwnedRecipients,
} from "./providerProbeCleanupReceipts";
import { isProviderProbeKnownValueRegistry, type ProviderProbeKnownValueRegistry } from "./providerProbeRunEnvelope";

export type ProviderProbeAuthAdminErrorCode =
  | "auth_admin_invalid_dependencies"
  | "auth_admin_invalid_credential"
  | "auth_admin_busy"
  | "auth_admin_ledger_closed"
  | "auth_admin_capacity_exceeded"
  | "auth_admin_create_failed"
  | "auth_admin_create_unexpected_result";

export class ProviderProbeAuthAdminError extends Error {
  readonly code: ProviderProbeAuthAdminErrorCode;

  constructor(code: ProviderProbeAuthAdminErrorCode) {
    super(code);
    this.name = "ProviderProbeAuthAdminError";
    this.code = code;
  }
}

// The narrow structural slice of a supabase-js client that this core uses.
export type ProviderProbeAuthAdminClient = Readonly<{
  auth: Readonly<{
    admin: Readonly<{
      createUser(attributes: Readonly<{
        email: string;
        password?: string;
        email_confirm: boolean;
        user_metadata: Readonly<Record<string, unknown>>;
      }>): Promise<unknown>;
    }>;
  }>;
}>;

export type ProviderProbeAuthUserHandle = Readonly<{
  matchesUserId(candidate: unknown): boolean;
}>;

export type ProviderProbeAuthUserCreation = Readonly<{
  email: string;
  emailMatched: boolean;
  user: ProviderProbeAuthUserHandle;
}>;

export type ProviderProbeAuthAdmin = Readonly<{
  createRunTaggedUser(input?: Readonly<{ password?: string }>): Promise<ProviderProbeAuthUserCreation>;
}>;

export type ProviderProbeRandomSource = (size: number) => Uint8Array;

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const MAX_LOCAL_PART = 64;

function fail(code: ProviderProbeAuthAdminErrorCode): never {
  throw new ProviderProbeAuthAdminError(code);
}

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? output + BASE32[(value << (5 - bits)) & 31] : output;
}

export function mintRunRecipient(runId: string, random: ProviderProbeRandomSource): string {
  const bytes = random(10);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 10) {
    fail("auth_admin_invalid_dependencies");
  }
  const localPart = `${runId.toLowerCase()}-${base32(bytes)}`;
  if (localPart.length > MAX_LOCAL_PART) {
    fail("auth_admin_invalid_dependencies");
  }
  return `${localPart}@synthetic.invalid`;
}

function assertCredential(password: unknown): string | undefined {
  if (password === undefined) {
    return undefined;
  }
  if (typeof password !== "string" || password.length < 16 || password.length > 256 || /[\r\n]/.test(password)) {
    fail("auth_admin_invalid_credential");
  }
  return password;
}

function createdUser(result: unknown): Readonly<{ id: string; email: unknown }> | null {
  if (!result || typeof result !== "object") {
    return null;
  }
  const { data, error } = result as { data?: unknown; error?: unknown };
  if (error !== null && error !== undefined) {
    return null;
  }
  const user = (data as { user?: unknown } | null | undefined)?.user;
  if (!user || typeof user !== "object") {
    return null;
  }
  const { id, email } = user as { id?: unknown; email?: unknown };
  return isValidCleanupId("auth-user", id) ? Object.freeze({ id, email }) : null;
}

function handleFor(id: string): ProviderProbeAuthUserHandle {
  return Object.freeze({
    matchesUserId: (candidate: unknown) => typeof candidate === "string" && candidate === id,
  });
}

export function createAuthAdminOperations(
  input: Readonly<{
    config: ProviderProbeSafetyConfig;
    client: ProviderProbeAuthAdminClient;
    ledger: ProviderProbeCleanupLedger;
    registry: ProviderProbeKnownValueRegistry;
    ownedRecipients: ProviderProbeRunOwnedRecipients;
    random?: ProviderProbeRandomSource;
  }>,
): ProviderProbeAuthAdmin {
  const { config, client, ledger, registry, ownedRecipients } = input;
  const random: ProviderProbeRandomSource = input.random ?? ((size) => randomBytes(size));
  const createUser = client?.auth?.admin?.createUser;
  if (
    typeof createUser !== "function" ||
    typeof random !== "function" ||
    !isProviderProbeKnownValueRegistry(registry) ||
    !isRunOwnedRecipientsRecord(ownedRecipients) ||
    !ledger ||
    typeof ledger.reserve !== "function"
  ) {
    fail("auth_admin_invalid_dependencies");
  }
  const admin = client.auth.admin;
  let busy = false;

  return Object.freeze({
    async createRunTaggedUser(request?: Readonly<{ password?: string }>) {
      // Every check below runs before the effect.
      const password = assertCredential(request?.password);
      if (busy) {
        fail("auth_admin_busy");
      }
      const email = mintRunRecipient(config.runId, random);
      // Registered before the reservation, so a full registry cannot leave one open.
      registry.register(email);
      if (password !== undefined) {
        registry.register(password);
      }
      let reservation: ProviderProbeCleanupReservation;
      try {
        reservation = ledger.reserve("auth-user");
      } catch (error) {
        fail(
          error instanceof Error && error.message === "cleanup_ledger_capacity_exceeded"
            ? "auth_admin_capacity_exceeded"
            : "auth_admin_ledger_closed",
        );
      }

      busy = true;
      let result: unknown;
      try {
        // The function captured at construction, called on its own admin object.
        result = await createUser.call(admin, {
          email,
          ...(password === undefined ? {} : { password }),
          email_confirm: true,
          user_metadata: { synthetic: true },
        });
      } catch {
        reservation.release();
        fail("auth_admin_create_failed");
      } finally {
        busy = false;
      }

      const user = createdUser(result);
      if (user === null) {
        reservation.release();
        const failed = !!result && typeof result === "object" && (result as { error?: unknown }).error;
        fail(failed ? "auth_admin_create_failed" : "auth_admin_create_unexpected_result");
      }
      // The user exists: track it before any further check, then register its id.
      reservation.commit(issueCleanupReceipt("auth-user", user.id, config.runId));
      registry.register(user.id);
      const emailMatched = typeof user.email === "string" && user.email.toLowerCase() === email;
      if (emailMatched) {
        // Only a server-confirmed, minted address can make a test message cleanable.
        addRunOwnedRecipient(ownedRecipients, config.runId, email);
      }
      return Object.freeze({ email, emailMatched, user: handleFor(user.id) });
    },
  });
}
