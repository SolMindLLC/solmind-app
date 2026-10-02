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
//   cleanup receipt.
// - (R7) After a failed or id-less answer (a thrown request, an error result or an
//   unusable success), the server may still have created the user, for example when the
//   response was lost. The reservation stays open, and the creation stays "in flight",
//   while the caller's locator lists the users at exactly the address minted for this
//   request:
//   - none there: the reservation is released and the creation failed
//     (`auth_admin_create_failed`);
//   - exactly one: its id is committed (the receipt), registered and returned as the
//     created user, at the minted address;
//   - the locator fails, returns something unusable, or finds more than one, or no locator
//     was given: attribution cannot be completed. Whatever was located is tracked if
//     capacity allows, the reservation is released (otherwise cleanup could never start)
//     and the creation is reported unresolved (`auth_admin_create_unresolved`), so the
//     caller stops every further effect and counts the unresolved users. (R9) Every located
//     user is committed before any id is registered, and a registration failure cannot
//     replace the unresolved report. (R10) The report carries the count the caller adds
//     (`unresolvedUsers`): every located user that could not get a receipt (capacity), and
//     at least one.
// - The caller receives the minted address (needed in memory by later probes; it is
//   registered), a value-free status and an opaque handle that can answer "is this the
//   same user id?". The id leaves this module only through `authUserRecordForHandle`,
//   to the restricted Auth probe core, which never returns it further.

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
  | "auth_admin_create_unresolved";

export class ProviderProbeAuthAdminError extends Error {
  readonly code: ProviderProbeAuthAdminErrorCode;
  // R10: for `auth_admin_create_unresolved`, how many users may exist untracked (value-free):
  // every located user that could not get a receipt, and at least one, since the creation
  // itself could not be attributed. Zero for every other code.
  readonly unresolvedUsers: number;

  constructor(code: ProviderProbeAuthAdminErrorCode, unresolvedUsers = 1) {
    super(code);
    this.name = "ProviderProbeAuthAdminError";
    this.code = code;
    this.unresolvedUsers = code === "auth_admin_create_unresolved" ? Math.max(1, unresolvedUsers) : 0;
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

// R7: lists the ids of the users whose address is exactly the given minted address.
export type ProviderProbeMintedAddressLocator = (address: string) => Promise<readonly string[]>;

export type ProviderProbeAuthAdmin = Readonly<{
  createRunTaggedUser(
    input?: Readonly<{ password?: string; locateMintedAddress?: ProviderProbeMintedAddressLocator }>,
  ): Promise<ProviderProbeAuthUserCreation>;
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

// Handle -> the created user's id and minted address, for the restricted probe core
// only (`authUserRecordForHandle`); a handle made anywhere else has no entry.
const handleRecords = new WeakMap<object, Readonly<{ id: string; email: string }>>();

function handleFor(id: string, email: string): ProviderProbeAuthUserHandle {
  const handle = Object.freeze({
    matchesUserId: (candidate: unknown) => typeof candidate === "string" && candidate === id,
  });
  handleRecords.set(handle, Object.freeze({ id, email }));
  return handle;
}

// RESTRICTED: the probe core (`providerProbeAuthProbeCore.ts`) needs the id behind a
// handle to read, sign in as or compare that user. It never returns the id further.
export function authUserRecordForHandle(handle: unknown): Readonly<{ id: string; email: string }> | null {
  return handle !== null && typeof handle === "object" ? (handleRecords.get(handle) ?? null) : null;
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
    async createRunTaggedUser(
      request?: Readonly<{ password?: string; locateMintedAddress?: ProviderProbeMintedAddressLocator }>,
    ) {
      // Every check below runs before the effect.
      const password = assertCredential(request?.password);
      const locate = request?.locateMintedAddress;
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
      try {
        let result: unknown = null;
        try {
          // The function captured at construction, called on its own admin object.
          result = await createUser.call(admin, {
            email,
            ...(password === undefined ? {} : { password }),
            email_confirm: true,
            user_metadata: { synthetic: true },
          });
        } catch {
          result = null;
        }

        const user = createdUser(result);
        if (user !== null) {
          // The user exists: track it before any further check, then register its id.
          reservation.commit(issueCleanupReceipt("auth-user", user.id, config.runId));
          registry.register(user.id);
          const emailMatched = typeof user.email === "string" && user.email.toLowerCase() === email;
          if (emailMatched) {
            // Only a server-confirmed, minted address can make a test message cleanable.
            addRunOwnedRecipient(ownedRecipients, config.runId, email);
          }
          return Object.freeze({ email, emailMatched, user: handleFor(user.id, email) });
        }

        // R7: a failed or id-less answer. The reservation stays open while the users at
        // exactly this minted address are located.
        let located: readonly string[] | null = null;
        if (typeof locate === "function") {
          try {
            const found: unknown = await locate(email);
            located =
              Array.isArray(found) &&
              found.every((id) => isValidCleanupId("auth-user", id)) &&
              new Set(found).size === found.length
                ? (found as string[])
                : null;
          } catch {
            located = null;
          }
        }
        if (located !== null && located.length === 0) {
          reservation.release();
          fail("auth_admin_create_failed");
        }
        if (located !== null && located.length === 1) {
          const id = located[0]!;
          reservation.commit(issueCleanupReceipt("auth-user", id, config.runId));
          registry.register(id);
          // Located at exactly the minted address.
          addRunOwnedRecipient(ownedRecipients, config.runId, email);
          return Object.freeze({ email, emailMatched: true, user: handleFor(id, email) });
        }
        // Attribution cannot be completed: track whatever was located (if capacity
        // allows), release the reservation, and report the creation unresolved.
        let untrackedLocated = 0;
        if (located !== null && located.length > 1) {
          // R9: every located user is committed first; registering the ids, which can
          // throw (a full registry), comes after and can never replace the unresolved
          // report below.
          reservation.commit(issueCleanupReceipt("auth-user", located[0]!, config.runId));
          const committed = [located[0]!];
          for (const extra of located.slice(1)) {
            try {
              ledger.reserve("auth-user").commit(issueCleanupReceipt("auth-user", extra, config.runId));
              committed.push(extra);
            } catch {
              // Left for the final listing to find; counted below, and the caller stops for it.
            }
          }
          untrackedLocated = located.length - committed.length;
          for (const id of committed) {
            try {
              registry.register(id);
            } catch {
              // The creation is reported unresolved below either way, which stops the run.
            }
          }
        } else {
          reservation.release();
        }
        // R10: the report carries how many users may exist untracked: every located user
        // that could not get a receipt, and at least one (the creation itself is ambiguous).
        throw new ProviderProbeAuthAdminError("auth_admin_create_unresolved", Math.max(1, untrackedLocated));
      } finally {
        busy = false;
      }
    },
  });
}
