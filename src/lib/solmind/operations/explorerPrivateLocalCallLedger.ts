import "server-only";
import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, linkSync, lstatSync, openSync, readdirSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";

// The shared daily test allowance for private local Explorer conversation calls.
// Imports only `server-only` and Node built-ins, so the ledger can be exercised
// from separate processes (with the react-server condition).

const FAILURE = "explorer_private_local_call_ledger_unavailable";
/**
 * Paul's 2026-10-31 test allowance: at most 1,000 conversation calls a day on
 * the local demo, safety assessments included. A grant may set less, never more.
 */
export const EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING = 1000;
/**
 * The one shared daily ledger for every local run, setup, folder and app copy.
 * It never comes from a profile, environment selector or working directory, so
 * a new setup cannot add calls. The folder must already exist; it is never
 * created here, and a missing folder keeps every run held.
 */
export const EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT =
  "C:\\_Apollo\\Projects\\Solmind\\.validation\\private-local-explorer-call-ledger";
const LEDGER_DAY_ZONE = "America/Chicago";
const SLOT_VERSION = "explorer-private-local-call-slot.v1";
const RECORD_KEYS = ["version", "day", "slot", "reservedAt", "runId"] as const;
const RECORD_MAX_BYTES = 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ExplorerPrivateLocalCallUsage = Readonly<{ day: string; reserved: number; limit: number }>;
export type ExplorerPrivateLocalCallReservation = Readonly<{ day: string; slot: number; limit: number }>;

function fail(): never { throw new Error(FAILURE); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validLimit(limit: unknown): limit is number {
  return typeof limit === "number" && Number.isSafeInteger(limit) && limit >= 1 && limit <= EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING;
}

/** The America/Chicago calendar day (YYYY-MM-DD) that a ledger place counts against. */
export function explorerPrivateLocalLedgerDay(at: number): string {
  if (!Number.isFinite(at)) fail();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LEDGER_DAY_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(at));
  const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? "";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail();
  return day;
}

function usableRoot(root: string): boolean {
  try {
    const stat = lstatSync(root);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch { return false; }
}
function slotName(day: string, slot: number): string {
  return `${day}.slot-${String(slot).padStart(4, "0")}.json`;
}
function validRecord(value: unknown, day: string, slot: number): boolean {
  return object(value) && Object.keys(value).length === RECORD_KEYS.length && RECORD_KEYS.every(key => Object.hasOwn(value, key)) &&
    value.version === SLOT_VERSION && value.day === day && value.slot === slot &&
    typeof value.runId === "string" && UUID.test(value.runId) && typeof value.reservedAt === "string" &&
    Number.isFinite(Date.parse(value.reservedAt)) && new Date(value.reservedAt).toISOString() === value.reservedAt;
}

/**
 * Counts the day's places. Every entry named for the day must be a complete,
 * valid slot record; anything else (a damaged or partial record, a folder or
 * link in a slot's place, an unexpected name) makes the whole day unreadable,
 * which holds every run. An unfinished `pending` write is never a place.
 */
function countDay(root: string, day: string): number {
  const slotPattern = new RegExp(`^${day}\\.slot-(\\d{4})\\.json$`);
  const pendingPattern = new RegExp(`^${day}\\.pending-[0-9a-f]{32}\\.tmp$`);
  let reserved = 0;
  for (const name of readdirSync(root)) {
    if (!name.startsWith(day + ".") || pendingPattern.test(name)) continue;
    const match = slotPattern.exec(name);
    if (!match) fail();
    const slot = Number(match[1]);
    const file = join(root, name);
    const stat = lstatSync(file);
    if (slot < 1 || slot > EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING || !stat.isFile() || stat.isSymbolicLink() ||
      stat.size > RECORD_MAX_BYTES) fail();
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(file)));
    if (!validRecord(value, day, slot)) fail();
    reserved += 1;
  }
  return reserved;
}

function writeComplete(file: string, bytes: Buffer): void {
  const descriptor = openSync(file, "wx", 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (!Number.isSafeInteger(written) || written <= 0) fail();
      offset += written;
    }
    fsyncSync(descriptor);
  } finally { closeSync(descriptor); }
}
function removeQuietly(file: string): void {
  try { unlinkSync(file); } catch { /* an unfinished pending write never counts */ }
}

/** Today's shared count for one grant's limit, or null when the ledger cannot be read or validated. Never throws. */
export function readExplorerPrivateLocalCallUsage(root: string, limit: number): ExplorerPrivateLocalCallUsage | null {
  try {
    if (!validLimit(limit) || !usableRoot(root)) return null;
    const day = explorerPrivateLocalLedgerDay(Date.now());
    return Object.freeze({ day, reserved: countDay(root, day), limit });
  } catch { return null; }
}

/**
 * Reserves one place for today before an attempt. The record is written and
 * synced in full under a unique pending name, then hard-linked to its slot
 * name, which fails if the slot exists: each place has one winner across
 * requests, processes and restarts, and a slot is never visible half-written.
 * A reserved place is never deleted, reset or released. If midnight passes
 * during the reservation, the place stays counted on the old day and the
 * reservation is refused, so nothing is forwarded against yesterday.
 */
export function reserveExplorerPrivateLocalCall(root: string, limit: number, runId: string): ExplorerPrivateLocalCallReservation {
  try {
    if (!validLimit(limit) || typeof runId !== "string" || !UUID.test(runId) || !usableRoot(root)) fail();
    const day = explorerPrivateLocalLedgerDay(Date.now());
    const reserved = countDay(root, day);
    if (reserved >= limit) fail();
    for (let slot = reserved + 1; slot <= limit; slot += 1) {
      const pending = join(root, `${day}.pending-${randomBytes(16).toString("hex")}.tmp`);
      writeComplete(pending, Buffer.from(JSON.stringify({ version: SLOT_VERSION, day, slot,
        reservedAt: new Date().toISOString(), runId }) + "\n", "utf8"));
      let linked = false;
      try {
        linkSync(pending, join(root, slotName(day, slot)));
        linked = true;
      } catch (error) {
        if (!(object(error) && error.code === "EEXIST")) { removeQuietly(pending); fail(); }
      }
      removeQuietly(pending);
      if (!linked) continue;
      if (explorerPrivateLocalLedgerDay(Date.now()) !== day) fail();
      return Object.freeze({ day, slot, limit });
    }
    return fail();
  } catch { return fail(); }
}
