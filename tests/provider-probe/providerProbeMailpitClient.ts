// RESTRICTED test-only mail-catcher (Mailpit) inventory core for the future local
// Supabase Auth provider probes. It accepts an injected fetch, so only the restricted
// run core (`providerProbeRunCore.ts`, which passes the gated, fixed-target production
// Mailpit fetch) and named unit tests may import it;
// `providerProbeModuleBoundary.test.ts` enforces that.
//
// What it returns: counts only. Message ids, subjects, snippets, bodies, senders and
// addresses never leave this module. Addresses are compared in memory, then dropped.
//
// Completeness. Each page must report an integer `total`. Within one pass every page
// must report the same total, and each page must hold exactly
// min(page size, total - start) messages; when present, `start`, `count` and
// `messages_count` must agree too. A pass is complete only when it has collected
// exactly `total` distinct ids. A total that changes between pages means the mailbox
// moved, so that pass is discarded and read again; a stable total that the pages
// contradict fails closed at once. Counts are trusted only when two consecutive
// complete passes agree on every id, its classification and the total, within
// MAILPIT_MAX_INVENTORY_PASSES passes. This assumes the run creates no message while
// it is reading.
//
// Created by this run. A message earns a cleanup receipt only when one of its To, Cc
// or Bcc addresses is exactly a run-owned recipient: an address the run's own
// user-creation operation minted and the server confirmed. A message that merely
// carries the run tag (for example one inserted from outside) earns no receipt; it is
// reported only as a count. `takeBaseline` must also find no run-tagged message.
//
// UNVERIFIED: the response shape (`GET /api/v1/messages?start=&limit=` returning
// `{ total, start?, count?, messages_count?, messages: [{ ID, To, Cc, Bcc }] }` with
// `{ Address }` recipients) and these field meanings are the documented Mailpit v1
// API. They have not been checked against the Mailpit build that the pinned Supabase
// CLI 2.115.0 starts; the parser fails closed on anything else.

import type { ProviderProbeSafetyConfig } from "../../src/lib/solmind/supabase/__tests__/providerProbeConfig";
import type { ProviderProbeCleanupLedger } from "./providerProbeCleanupLedger";
import {
  isRunOwnedRecipient,
  isRunOwnedRecipientsRecord,
  isValidCleanupId,
  issueCleanupReceipt,
  type ProviderProbeRunOwnedRecipients,
} from "./providerProbeCleanupReceipts";
import { isProviderProbeKnownValueRegistry, type ProviderProbeKnownValueRegistry } from "./providerProbeRunEnvelope";

export type MailpitProbeErrorCode =
  | "mailpit_request_failed"
  | "mailpit_response_malformed"
  | "mailpit_inventory_inconsistent"
  | "mailpit_inventory_too_large"
  | "mailpit_inventory_unstable"
  | "mailpit_baseline_not_clean"
  | "mailpit_baseline_missing"
  | "mailpit_baseline_already_taken"
  | "mailpit_ledger_closed"
  | "mailpit_capture_capacity_exceeded"
  | "mailpit_invalid_dependencies";

export class MailpitProbeError extends Error {
  readonly code: MailpitProbeErrorCode;

  constructor(code: MailpitProbeErrorCode) {
    super(code);
    this.name = "MailpitProbeError";
    this.code = code;
  }
}

export type MailpitFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type ProviderProbeMailpitInventory = Readonly<{
  takeBaseline(): Promise<Readonly<{ totalMessageCount: number }>>;
  captureNewRunOwnedMessages(): Promise<
    Readonly<{ captured: number; unownedRunTagged: number; totalMessageCount: number }>
  >;
  readCounts(): Promise<
    Readonly<{ totalMessageCount: number; runTaggedMessageCount: number; runOwnedMessageCount: number }>
  >;
}>;

export const MAILPIT_API_PATH_PREFIX = "/api/v1/";
export const MAILPIT_PAGE_SIZE = 50;
export const MAILPIT_MAX_PAGES = 20;
export const MAILPIT_MAX_INVENTORY_PASSES = 4;

const RESERVED_SYNTHETIC_DOMAIN = "synthetic.invalid";
const MAX_ADDRESS_LENGTH = 320;
const RECIPIENT_FIELDS = ["To", "Cc", "Bcc"] as const;

type Classification = Readonly<{ tagged: boolean; owned: boolean }>;
type Inventory = Readonly<{ total: number; entries: ReadonlyMap<string, Classification> }>;
type Page = Readonly<{ total: number; entries: ReadonlyArray<readonly [string, Classification]> }>;

function fail(code: MailpitProbeErrorCode): never {
  throw new MailpitProbeError(code);
}

export function isRunTaggedAddress(address: string, runTag: string): boolean {
  const lower = address.toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at <= 0 || runTag.length === 0) {
    return false;
  }
  return lower.slice(at + 1) === RESERVED_SYNTHETIC_DOMAIN && lower.slice(0, at).includes(runTag);
}

function recipientAddresses(message: Record<string, unknown>): string[] {
  const addresses: string[] = [];
  for (const field of RECIPIENT_FIELDS) {
    const value = message[field];
    if (value === undefined || value === null) {
      continue;
    }
    if (!Array.isArray(value) || value.length > 100) {
      fail("mailpit_response_malformed");
    }
    for (const recipient of value) {
      if (!recipient || typeof recipient !== "object" || Array.isArray(recipient)) {
        fail("mailpit_response_malformed");
      }
      const address = (recipient as Record<string, unknown>).Address;
      if (typeof address !== "string" || address.length > MAX_ADDRESS_LENGTH) {
        fail("mailpit_response_malformed");
      }
      addresses.push(address);
    }
  }
  return addresses;
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function readPageShape(
  payload: unknown,
  start: number,
  classify: (addresses: string[]) => Classification,
): Page {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("mailpit_response_malformed");
  }
  const record = payload as Record<string, unknown>;
  const messages = record.messages;
  if (!isCount(record.total) || !Array.isArray(messages) || messages.length > MAILPIT_PAGE_SIZE) {
    fail("mailpit_response_malformed");
  }
  if (
    (record.start !== undefined && record.start !== start) ||
    (record.count !== undefined && record.count !== messages.length) ||
    (record.messages_count !== undefined && record.messages_count !== record.total)
  ) {
    fail("mailpit_inventory_inconsistent");
  }
  const entries = messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      fail("mailpit_response_malformed");
    }
    const item = message as Record<string, unknown>;
    if (!isValidCleanupId("mailpit-message", item.ID)) {
      fail("mailpit_response_malformed");
    }
    return [item.ID as string, classify(recipientAddresses(item))] as const;
  });
  return { total: record.total, entries };
}

async function readPage(fetchPage: MailpitFetch, origin: string, start: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchPage(
      `${origin}${MAILPIT_API_PATH_PREFIX}messages?start=${start}&limit=${MAILPIT_PAGE_SIZE}`,
      { method: "GET", headers: { accept: "application/json" } },
    );
  } catch {
    // The transport's own error is dropped so nothing from it can travel further.
    fail("mailpit_request_failed");
  }
  if (!response.ok) {
    fail("mailpit_request_failed");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    fail("mailpit_response_malformed");
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    fail("mailpit_request_failed");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail("mailpit_response_malformed");
  }
}

// One complete paged pass, or null when the mailbox moved during it (a different
// total on a later page, or a repeated id).
async function readOnePass(
  fetchPage: MailpitFetch,
  origin: string,
  classify: (addresses: string[]) => Classification,
): Promise<Inventory | null> {
  const entries = new Map<string, Classification>();
  let total: number | null = null;
  for (let page = 0; page < MAILPIT_MAX_PAGES; page += 1) {
    const start = page * MAILPIT_PAGE_SIZE;
    const current = readPageShape(await readPage(fetchPage, origin, start), start, classify);
    if (total !== null && current.total !== total) {
      return null;
    }
    total = current.total;
    if (total > MAILPIT_MAX_PAGES * MAILPIT_PAGE_SIZE) {
      fail("mailpit_inventory_too_large");
    }
    if (current.entries.length !== Math.max(0, Math.min(MAILPIT_PAGE_SIZE, total - start))) {
      // The total held steady, yet this page contradicts it.
      fail("mailpit_inventory_inconsistent");
    }
    for (const [id, classification] of current.entries) {
      if (entries.has(id)) {
        return null;
      }
      entries.set(id, classification);
    }
    if (entries.size === total) {
      return { total, entries };
    }
  }
  fail("mailpit_inventory_too_large");
}

function sameInventory(left: Inventory, right: Inventory): boolean {
  if (left.total !== right.total || left.entries.size !== right.entries.size) {
    return false;
  }
  for (const [id, classification] of left.entries) {
    const other = right.entries.get(id);
    if (other === undefined || other.tagged !== classification.tagged || other.owned !== classification.owned) {
      return false;
    }
  }
  return true;
}

async function readStableInventory(
  fetchPage: MailpitFetch,
  origin: string,
  classify: (addresses: string[]) => Classification,
): Promise<Inventory> {
  let previous: Inventory | null = null;
  for (let pass = 0; pass < MAILPIT_MAX_INVENTORY_PASSES; pass += 1) {
    const current = await readOnePass(fetchPage, origin, classify);
    if (current !== null && previous !== null && sameInventory(previous, current)) {
      return current;
    }
    previous = current;
  }
  fail("mailpit_inventory_unstable");
}

export function createMailpitInventoryOperations(
  input: Readonly<{
    config: ProviderProbeSafetyConfig;
    origin: string;
    fetch: MailpitFetch;
    ledger: ProviderProbeCleanupLedger;
    registry: ProviderProbeKnownValueRegistry;
    ownedRecipients: ProviderProbeRunOwnedRecipients;
  }>,
): ProviderProbeMailpitInventory {
  const { config, origin, ledger, registry, ownedRecipients } = input;
  const fetchPage = input.fetch;
  if (
    typeof fetchPage !== "function" ||
    typeof origin !== "string" ||
    !isProviderProbeKnownValueRegistry(registry) ||
    !isRunOwnedRecipientsRecord(ownedRecipients) ||
    !ledger ||
    typeof ledger.recordCreated !== "function"
  ) {
    fail("mailpit_invalid_dependencies");
  }
  const runTag = config.runId.toLowerCase();
  const classify = (addresses: string[]): Classification =>
    Object.freeze({
      tagged: addresses.some((address) => isRunTaggedAddress(address, runTag)),
      owned: addresses.some((address) => isRunOwnedRecipient(ownedRecipients, config.runId, address)),
    });
  // Private, bounded memory: the baseline ids and the ids already captured.
  let baseline: ReadonlySet<string> | null = null;
  const captured = new Set<string>();

  return Object.freeze({
    async takeBaseline() {
      if (baseline !== null) {
        fail("mailpit_baseline_already_taken");
      }
      const inventory = await readStableInventory(fetchPage, origin, classify);
      if ([...inventory.entries.values()].some((entry) => entry.tagged || entry.owned)) {
        // The run id must be fresh: nothing addressed to it may exist before the run.
        fail("mailpit_baseline_not_clean");
      }
      baseline = new Set(inventory.entries.keys());
      return Object.freeze({ totalMessageCount: inventory.total });
    },

    async captureNewRunOwnedMessages() {
      if (baseline === null) {
        fail("mailpit_baseline_missing");
      }
      const known = baseline;
      const inventory = await readStableInventory(fetchPage, origin, classify);
      const fresh = [...inventory.entries].filter(([id]) => !known.has(id) && !captured.has(id));
      const owned = fresh.filter(([, entry]) => entry.owned).map(([id]) => id);
      const unownedRunTagged = fresh.filter(([, entry]) => entry.tagged && !entry.owned).length;
      if (owned.length > 0) {
        if (!ledger.isRecording()) {
          fail("mailpit_ledger_closed");
        }
        if (ledger.remainingCapacity("mailpit-message") < owned.length) {
          fail("mailpit_capture_capacity_exceeded");
        }
      }
      // No await between the checks above and the recording below.
      for (const id of owned) {
        registry.register(id);
        ledger.recordCreated(issueCleanupReceipt("mailpit-message", id, config.runId));
        captured.add(id);
      }
      return Object.freeze({ captured: owned.length, unownedRunTagged, totalMessageCount: inventory.total });
    },

    async readCounts() {
      const inventory = await readStableInventory(fetchPage, origin, classify);
      const values = [...inventory.entries.values()];
      return Object.freeze({
        totalMessageCount: inventory.total,
        runTaggedMessageCount: values.filter((entry) => entry.tagged).length,
        runOwnedMessageCount: values.filter((entry) => entry.owned).length,
      });
    },
  });
}
