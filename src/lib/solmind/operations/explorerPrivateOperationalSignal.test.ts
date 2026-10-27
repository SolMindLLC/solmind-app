import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createExplorerPrivateFileSignal } from "./explorerPrivateOperationalSignal";

// Actual filesystem capture, isolated in the runner's explicit workspace TEMP.
// This is not a live operational adoption, human notification or durable audit.
const SHA = "A".repeat(64);
describe("private-local content-free operational file signal", () => {
  it("actually captures all three closed markers without private payload fields", async () => {
    const directory = await mkdtemp(join(tmpdir(), "solmind-signal-"));
    const filePath = join(directory, "signal.jsonl");
    const sink = createExplorerPrivateFileSignal({ filePath, verificationReceiptSha256: SHA });
    const markers = ["preparation_unavailable", "trusted_render_unavailable", "settlement_unconfirmed"] as const;
    for (const marker of markers) await sink.emit(marker, new AbortController().signal);
    const rows = (await readFile(filePath, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(rows.map(row => row.marker)).toEqual(markers);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(["at", "marker", "version"]);
      expect(row.version).toBe("explorer-private-signal.v1");
      expect(new Date(row.at).toISOString()).toBe(row.at);
    }
    const canceled = new AbortController(); canceled.abort();
    await expect(sink.emit(markers[0], canceled.signal)).rejects.toThrow("explorer_private_signal_unavailable");
    await expect(sink.emit("private message or actor" as never, new AbortController().signal)).rejects.toThrow("explorer_private_signal_unavailable");
    expect((await readFile(filePath, "utf8")).trim().split("\n")).toHaveLength(3);
  });
  it("exposes no path or filesystem details on failed capture", async () => {
    const directory = await mkdtemp(join(tmpdir(), "solmind-signal-failure-"));
    const sink = createExplorerPrivateFileSignal({ filePath: join(directory, "missing", "signal.jsonl"), verificationReceiptSha256: SHA });
    await expect(sink.emit("settlement_unconfirmed", new AbortController().signal)).rejects.toThrow(/^explorer_private_signal_unavailable$/);
  });
  it("has no implicit destination or receipt", () => {
    expect(() => createExplorerPrivateFileSignal({ filePath: "relative.jsonl", verificationReceiptSha256: SHA })).toThrow("explorer_private_signal_unavailable");
    expect(() => createExplorerPrivateFileSignal({ filePath: join(tmpdir(), "signal.txt"), verificationReceiptSha256: SHA })).toThrow("explorer_private_signal_unavailable");
    expect(() => createExplorerPrivateFileSignal({ filePath: join(tmpdir(), "signal.jsonl"), verificationReceiptSha256: "unverified" })).toThrow("explorer_private_signal_unavailable");
  });
});
