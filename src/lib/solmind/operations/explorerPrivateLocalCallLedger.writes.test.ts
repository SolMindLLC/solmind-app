// Disposable synthetic ledgers only. Simulated short and failed writes; no retained path is touched.
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { explorerPrivateLocalLedgerDay, readExplorerPrivateLocalCallUsage, reserveExplorerPrivateLocalCall } from "./explorerPrivateLocalCallLedger";

vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeSync: vi.fn(actual.writeSync), fsyncSync: vi.fn(actual.fsyncSync), linkSync: vi.fn(actual.linkSync) };
});
const actual = await vi.importActual<typeof import("node:fs")>("node:fs");

const RUN = "00000000-0000-4000-8000-000000000001";
const FAILURE = "explorer_private_local_call_ledger_unavailable";
const PREFIX = join(tmpdir(), "solmind-private-ledger-");
const bases: string[] = [];
afterEach(() => {
  for (const base of bases.splice(0)) {
    if (!base.startsWith(PREFIX)) throw new Error("unsafe_test_root");
    actual.rmSync(base, { recursive: true, force: true });
  }
  vi.mocked(fs.writeSync).mockImplementation(actual.writeSync as typeof fs.writeSync);
  vi.mocked(fs.fsyncSync).mockImplementation(actual.fsyncSync);
  vi.mocked(fs.linkSync).mockImplementation(actual.linkSync);
});
function ledger() {
  const base = actual.mkdtempSync(PREFIX); bases.push(base);
  const root = join(base, "ledger"); actual.mkdirSync(root); return root;
}
const slots = (root: string) => actual.readdirSync(root).filter(name => name.includes(".slot-"));

describe("ledger writes are complete before a place exists", () => {
  it("finishes a record across short writes and saves it whole", () => {
    const root = ledger();
    vi.mocked(fs.writeSync).mockImplementation(((descriptor: number, buffer: Buffer, offset: number, length: number) =>
      actual.writeSync(descriptor, buffer, offset, Math.min(length, 7))) as typeof fs.writeSync);
    expect(reserveExplorerPrivateLocalCall(root, 2, RUN).slot).toBe(1);
    const saved = JSON.parse(actual.readFileSync(join(root, slots(root)[0]), "utf8"));
    expect(saved).toMatchObject({ slot: 1, runId: RUN, day: explorerPrivateLocalLedgerDay(Date.now()) });
    expect(readExplorerPrivateLocalCallUsage(root, 2)?.reserved).toBe(1);
  });
  it.each<[string, () => void]>([
    ["a write that makes no progress", () => vi.mocked(fs.writeSync).mockImplementation((() => 0) as unknown as typeof fs.writeSync)],
    ["a failed write", () => vi.mocked(fs.writeSync).mockImplementation(() => { throw new Error("synthetic_write_failure"); })],
    ["a failed sync", () => vi.mocked(fs.fsyncSync).mockImplementation(() => { throw new Error("synthetic_sync_failure"); })],
    ["a failed link", () => vi.mocked(fs.linkSync).mockImplementation(() => { throw Object.assign(new Error("synthetic_link_failure"), { code: "EIO" }); })],
  ])("refuses on %s and creates no place, so nothing can be forwarded", (_name, breakIt) => {
    const root = ledger(); breakIt();
    expect(() => reserveExplorerPrivateLocalCall(root, 2, RUN)).toThrow(FAILURE);
    expect(slots(root)).toHaveLength(0);
    // An unfinished pending file never counts, so the next working attempt still has every place.
    vi.mocked(fs.writeSync).mockImplementation(actual.writeSync as typeof fs.writeSync);
    vi.mocked(fs.fsyncSync).mockImplementation(actual.fsyncSync);
    vi.mocked(fs.linkSync).mockImplementation(actual.linkSync);
    expect(readExplorerPrivateLocalCallUsage(root, 2)?.reserved).toBe(0);
    expect(reserveExplorerPrivateLocalCall(root, 2, RUN).slot).toBe(1);
  });
});
