// RESTRICTED test-only cleanup receipts and run-owned recipients for the future local
// Supabase Auth provider probes. `providerProbeModuleBoundary.test.ts` names every
// module and unit-test file that may import this one; the integration file may not.
//
// Receipts. A receipt is the only way an identifier can enter the cleanup ledger. Only
// the two effect-owning operations issue them, from their own successful results:
// `providerProbeAuthAdminCore.ts` (a local Auth user it created) and
// `providerProbeMailpitClient.ts` (a test message addressed to a run-owned recipient).
// Only `providerProbeCleanupLedger.ts` redeems them. A receipt is an opaque frozen
// object carrying only its kind; the identifier and the run it belongs to live in a
// module-private WeakMap, so a receipt-shaped object built anywhere else is not a
// receipt. Each receipt is bound to one run id and can be redeemed once.
//
// Run-owned recipients. A branded, run-bound record of the exact addresses the run
// itself produced: only the user-creation operation adds to it, with the address it
// minted, after the server confirmed a user with that address. The mail capture
// issues a receipt only for a message addressed to one of these exact addresses.

export type ProviderProbeCleanupKind = "auth-user" | "mailpit-message";

declare const receiptBrand: unique symbol;
declare const ownedBrand: unique symbol;

export type ProviderProbeCleanupReceipt = Readonly<{
  kind: ProviderProbeCleanupKind;
  readonly [receiptBrand]: true;
}>;

export type ProviderProbeRunOwnedRecipients = Readonly<{ readonly [ownedBrand]: true }>;

type ReceiptEntry = { kind: ProviderProbeCleanupKind; id: string; runId: string; redeemed: boolean };

// Any UUID version, lowercase canonical form, nil excluded.
const AUTH_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
// Mailpit message ids: 8 to 64 characters, matching the known-value registry minimum.
const MAILPIT_MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;
// One owned recipient per created user, so the bound matches the user bound.
export const MAX_RUN_OWNED_RECIPIENTS = 10;

const issued = new WeakMap<object, ReceiptEntry>();
const owned = new WeakMap<object, { runId: string; addresses: Set<string> }>();

export function isValidCleanupId(kind: ProviderProbeCleanupKind, id: unknown): id is string {
  if (typeof id !== "string") {
    return false;
  }
  return kind === "auth-user"
    ? AUTH_USER_ID_PATTERN.test(id) && id !== NIL_UUID
    : MAILPIT_MESSAGE_ID_PATTERN.test(id);
}

export function issueCleanupReceipt(
  kind: ProviderProbeCleanupKind,
  id: string,
  runId: string,
): ProviderProbeCleanupReceipt {
  if ((kind !== "auth-user" && kind !== "mailpit-message") || !isValidCleanupId(kind, id) || typeof runId !== "string") {
    throw new Error("cleanup_receipt_invalid");
  }
  const receipt = Object.freeze({ kind });
  issued.set(receipt, { kind, id, runId, redeemed: false });
  return receipt as unknown as ProviderProbeCleanupReceipt;
}

// Returns the receipt's kind and identifier once, for the run it was issued to;
// anything else (a forged object, another run's receipt, a second redemption) is null.
export function redeemCleanupReceipt(
  receipt: unknown,
  runId: string,
): Readonly<{ kind: ProviderProbeCleanupKind; id: string }> | null {
  if (!receipt || typeof receipt !== "object") {
    return null;
  }
  const entry = issued.get(receipt);
  if (entry === undefined || entry.redeemed || entry.runId !== runId) {
    return null;
  }
  entry.redeemed = true;
  return Object.freeze({ kind: entry.kind, id: entry.id });
}

export function createRunOwnedRecipients(runId: string): ProviderProbeRunOwnedRecipients {
  const record = Object.freeze({});
  owned.set(record, { runId, addresses: new Set() });
  return record as unknown as ProviderProbeRunOwnedRecipients;
}

export function addRunOwnedRecipient(record: unknown, runId: string, address: string): void {
  const entry = record && typeof record === "object" ? owned.get(record) : undefined;
  if (entry === undefined || entry.runId !== runId || typeof address !== "string") {
    throw new Error("run_owned_recipients_invalid");
  }
  if (!entry.addresses.has(address.toLowerCase()) && entry.addresses.size >= MAX_RUN_OWNED_RECIPIENTS) {
    throw new Error("run_owned_recipients_capacity_exceeded");
  }
  entry.addresses.add(address.toLowerCase());
}

export function isRunOwnedRecipient(record: unknown, runId: string, address: string): boolean {
  const entry = record && typeof record === "object" ? owned.get(record) : undefined;
  return entry !== undefined && entry.runId === runId && entry.addresses.has(address.toLowerCase());
}

export function isRunOwnedRecipientsRecord(record: unknown): record is ProviderProbeRunOwnedRecipients {
  return !!record && typeof record === "object" && owned.has(record);
}
