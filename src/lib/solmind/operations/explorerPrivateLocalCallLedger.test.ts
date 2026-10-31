// Disposable synthetic ledgers only; no retained ledger, account, provider or DB is touched.
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING, explorerPrivateLocalLedgerDay,
  readExplorerPrivateLocalCallUsage, reserveExplorerPrivateLocalCall,
} from "./explorerPrivateLocalCallLedger";

const RUN = "00000000-0000-4000-8000-000000000001";
const OTHER_RUN = "00000000-0000-4000-8000-000000000002";
const FAILURE = "explorer_private_local_call_ledger_unavailable";
const PREFIX = join(tmpdir(), "solmind-private-ledger-");
const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) {
    if (!base.startsWith(PREFIX)) throw new Error("unsafe_test_root");
    rmSync(base, { recursive: true, force: true });
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function ledger() {
  const base = mkdtempSync(PREFIX); bases.push(base);
  const root = join(base, "ledger"); mkdirSync(root);
  return { base, root };
}
const today = () => explorerPrivateLocalLedgerDay(Date.now());
const slotName = (day: string, slot: number) => `${day}.slot-${String(slot).padStart(4, "0")}.json`;
function record(day: string, slot: number, runId = RUN) {
  return JSON.stringify({ version: "explorer-private-local-call-slot.v1", day, slot, reservedAt: new Date().toISOString(), runId }) + "\n";
}

describe("shared daily ledger for private local Explorer calls", () => {
  it("fixes the ledger at one absolute local folder and the ceiling at Paul's 1,000 a day", () => {
    expect(EXPLORER_PRIVATE_LOCAL_CALL_LEDGER_ROOT).toBe("C:\\_Apollo\\Projects\\Solmind\\.validation\\private-local-explorer-call-ledger");
    expect(EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING).toBe(1000);
  });
  it("reserves numbered places up to the limit, leaving only complete records behind", () => {
    const { root } = ledger();
    expect([1, 2, 3].map(() => reserveExplorerPrivateLocalCall(root, 3, RUN).slot)).toEqual([1, 2, 3]);
    expect(() => reserveExplorerPrivateLocalCall(root, 3, RUN)).toThrow(FAILURE);
    expect(readExplorerPrivateLocalCallUsage(root, 3)).toEqual({ day: today(), reserved: 3, limit: 3 });
    expect(readdirSync(root).sort()).toEqual([1, 2, 3].map(n => slotName(today(), n)));
    const saved = JSON.parse(readFileSync(join(root, slotName(today(), 2)), "utf8"));
    expect(Object.keys(saved).sort()).toEqual(["day", "reservedAt", "runId", "slot", "version"]);
    expect(saved).toMatchObject({ version: "explorer-private-local-call-slot.v1", day: today(), slot: 2, runId: RUN });
  });
  it("skips a place another writer already holds and never overwrites it", () => {
    const { root } = ledger(); const held = record(today(), 2, OTHER_RUN);
    writeFileSync(join(root, slotName(today(), 2)), held);
    expect(reserveExplorerPrivateLocalCall(root, 3, RUN).slot).toBe(3);
    expect(readFileSync(join(root, slotName(today(), 2)), "utf8")).toBe(held);
    // Two places are used; the count cannot reuse the gap below them.
    expect(() => reserveExplorerPrivateLocalCall(root, 3, RUN)).toThrow(FAILURE);
    expect(readdirSync(root)).toHaveLength(2);
  });
  it("refuses a reservation that midnight interrupts and keeps that place counted on the old day", () => {
    const { root } = ledger();
    const beforeMidnight = Date.parse("2026-11-01T04:59:59.999Z"); // 23:59:59.999 CDT on 31 October
    const afterMidnight = Date.parse("2026-11-01T05:00:00.000Z"); // 00:00 CDT on 1 November
    vi.spyOn(Date, "now").mockReturnValueOnce(beforeMidnight).mockReturnValue(afterMidnight);
    expect(() => reserveExplorerPrivateLocalCall(root, 1, RUN)).toThrow(FAILURE);
    expect(readdirSync(root)).toEqual([slotName("2026-10-31", 1)]);
    expect(readExplorerPrivateLocalCallUsage(root, 1)).toEqual({ day: "2026-11-01", reserved: 0, limit: 1 });
  });
  it("counts each America/Chicago day separately, including the 25-hour 1 November", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { root } = ledger();
    vi.setSystemTime(new Date("2026-11-01T04:59:00.000Z"));
    expect(reserveExplorerPrivateLocalCall(root, 1, RUN).day).toBe("2026-10-31");
    vi.setSystemTime(new Date("2026-11-01T05:00:00.000Z"));
    expect(reserveExplorerPrivateLocalCall(root, 1, RUN).day).toBe("2026-11-01");
    vi.setSystemTime(new Date("2026-11-02T05:59:00.000Z")); // 23:59 CST, still 1 November
    expect(() => reserveExplorerPrivateLocalCall(root, 1, RUN)).toThrow(FAILURE);
    vi.setSystemTime(new Date("2026-11-02T06:00:00.000Z"));
    expect(reserveExplorerPrivateLocalCall(root, 1, RUN).day).toBe("2026-11-02");
  });
  it.each<[string, (root: string, day: string) => void]>([
    ["damaged JSON", (root, day) => writeFileSync(join(root, slotName(day, 2)), "{")],
    ["an empty, partial record", (root, day) => writeFileSync(join(root, slotName(day, 2)), "")],
    ["a record for another day", (root, day) => writeFileSync(join(root, slotName(day, 2)), record("2000-01-01", 2))],
    ["a record for another slot", (root, day) => writeFileSync(join(root, slotName(day, 2)), record(day, 5))],
    ["a record with an extra field", (root, day) => writeFileSync(join(root, slotName(day, 2)),
      JSON.stringify({ ...JSON.parse(record(day, 2)), explorerId: RUN }))],
    ["a record without a valid run", (root, day) => writeFileSync(join(root, slotName(day, 2)), record(day, 2, "not-a-run"))],
    ["a folder in a slot's place", (root, day) => mkdirSync(join(root, slotName(day, 2)))],
    ["a link in a slot's place", (root, day) => { const target = join(root, "..", "elsewhere"); mkdirSync(target);
      symlinkSync(target, join(root, slotName(day, 2)), "junction"); }],
    ["a slot number above the ceiling", (root, day) => writeFileSync(join(root, slotName(day, 1001)), record(day, 1001))],
    ["an unexpected name for the day", (root, day) => writeFileSync(join(root, `${day}.unexpected.json`), "{}")],
  ])("holds the whole day on %s, without adding a place", (_name, damage) => {
    const { root } = ledger(); const day = today();
    reserveExplorerPrivateLocalCall(root, 5, RUN); damage(root, day);
    const before = readdirSync(root).sort();
    expect(readExplorerPrivateLocalCallUsage(root, 5)).toBeNull();
    expect(() => reserveExplorerPrivateLocalCall(root, 5, RUN)).toThrow(FAILURE);
    expect(readdirSync(root).sort()).toEqual(before);
  });
  it("ignores an unfinished pending write and other days' entries", () => {
    const { root } = ledger(); const day = today();
    writeFileSync(join(root, `${day}.pending-${"a".repeat(32)}.tmp`), "{");
    writeFileSync(join(root, slotName("2000-01-01", 1)), "not checked");
    expect(readExplorerPrivateLocalCallUsage(root, 2)?.reserved).toBe(0);
    expect(reserveExplorerPrivateLocalCall(root, 2, RUN).slot).toBe(1);
  });
  it("refuses a missing or linked ledger folder, an invalid limit and an invalid run", () => {
    const { base, root } = ledger();
    const missing = join(base, "absent");
    expect(readExplorerPrivateLocalCallUsage(missing, 3)).toBeNull();
    expect(() => reserveExplorerPrivateLocalCall(missing, 3, RUN)).toThrow(FAILURE);
    expect(() => readdirSync(missing)).toThrow();
    const linked = join(base, "linked-ledger"); symlinkSync(root, linked, "junction");
    expect(readExplorerPrivateLocalCallUsage(linked, 3)).toBeNull();
    expect(() => reserveExplorerPrivateLocalCall(linked, 3, RUN)).toThrow(FAILURE);
    for (const limit of [0, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING + 1, 1.5, Number.NaN]) {
      expect(readExplorerPrivateLocalCallUsage(root, limit)).toBeNull();
      expect(() => reserveExplorerPrivateLocalCall(root, limit, RUN)).toThrow(FAILURE);
    }
    expect(() => reserveExplorerPrivateLocalCall(root, 3, "not-a-run")).toThrow(FAILURE);
    expect(readdirSync(root)).toHaveLength(0);
  });
  it("stops at the 1,000 ceiling", () => {
    const { root } = ledger(); const day = today();
    for (let n = 1; n <= 999; n += 1) writeFileSync(join(root, slotName(day, n)), record(day, n));
    expect(reserveExplorerPrivateLocalCall(root, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING, RUN).slot).toBe(1000);
    expect(() => reserveExplorerPrivateLocalCall(root, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING, RUN)).toThrow(FAILURE);
    expect(readExplorerPrivateLocalCallUsage(root, EXPLORER_PRIVATE_LOCAL_DAILY_CALL_CEILING)?.reserved).toBe(1000);
  }, 30_000);
  it("gives each place exactly one winner when separate processes race for the same ledger", async () => {
    const { base, root } = ledger();
    const modulePath = fileURLToPath(new URL("./explorerPrivateLocalCallLedger.ts", import.meta.url));
    const go = join(base, "go");
    const child = join(base, "race-child.mjs");
    writeFileSync(child, [
      'import { existsSync } from "node:fs";',
      'import { pathToFileURL } from "node:url";',
      "const [modulePath, root, limit, attempts, runId, go] = process.argv.slice(2);",
      "const ledger = await import(pathToFileURL(modulePath).href);",
      "const pause = new Int32Array(new SharedArrayBuffer(4));",
      "while (!existsSync(go)) Atomics.wait(pause, 0, 0, 2);",
      "const slots = []; let refused = 0;",
      "for (let i = 0; i < Number(attempts); i += 1) {",
      "  try { slots.push(ledger.reserveExplorerPrivateLocalCall(root, Number(limit), runId).slot); } catch { refused += 1; }",
      "}",
      "process.stdout.write(JSON.stringify({ slots, refused }));",
    ].join("\n"));
    const limit = 40, attempts = 20, processes = 6;
    const runs = Array.from({ length: processes }, (_, n) => new Promise<{ slots: number[]; refused: number }>((resolve, reject) => {
      const runId = `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`;
      const proc = spawn(process.execPath, ["--conditions=react-server", child, modulePath, root, String(limit), String(attempts), runId, go],
        { stdio: ["ignore", "pipe", "pipe"] });
      let out = "", err = "";
      proc.stdout.on("data", chunk => { out += chunk; });
      proc.stderr.on("data", chunk => { err += chunk; });
      proc.on("error", reject);
      proc.on("close", code => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`child_failed_${code}: ${err.slice(0, 400)}`)));
    }));
    writeFileSync(go, "go");
    const results = await Promise.all(runs);
    const slots = results.flatMap(result => result.slots).sort((a, b) => a - b);
    expect(slots).toEqual(Array.from({ length: limit }, (_, n) => n + 1));
    expect(results.reduce((total, result) => total + result.refused, 0)).toBe(processes * attempts - limit);
    expect(readdirSync(root).filter(name => name.includes(".slot-"))).toHaveLength(limit);
    expect(readExplorerPrivateLocalCallUsage(root, limit)?.reserved).toBe(limit);
  }, 60_000);
});
