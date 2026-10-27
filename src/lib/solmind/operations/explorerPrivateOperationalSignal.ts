import "server-only";
import { appendFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { ExplorerPrivateConversationDependencies, ExplorerPrivateSignalMarker } from "../virtual-guide/explorerPrivateConversationComposition";

const FAILURE = "explorer_private_signal_unavailable";
const MARKERS: readonly ExplorerPrivateSignalMarker[] = ["preparation_unavailable", "trusted_render_unavailable", "settlement_unconfirmed"];

/**
 * Explicit private-local file sink. The operator selects an existing directory
 * and a dedicated file, with reviewed retention/ownership. No default, directory
 * creation, environment lookup, retry, private identifier or notification.
 * The receipt is an external proof binding, not proof supplied by this factory.
 */
export function createExplorerPrivateFileSignal(input: Readonly<{
  filePath: string;
  verificationReceiptSha256: string;
}>): NonNullable<ExplorerPrivateConversationDependencies["operationalSignal"]> {
  if (!input || typeof input.filePath !== "string" || !isAbsolute(input.filePath) ||
    input.filePath.startsWith("\\\\") || input.filePath.startsWith("//") ||
    /[\u0000-\u001f\u007f]/u.test(input.filePath) || !input.filePath.endsWith(".jsonl") ||
    typeof input.verificationReceiptSha256 !== "string" || !/^[0-9A-F]{64}$/.test(input.verificationReceiptSha256)) throw new Error(FAILURE);
  const filePath = input.filePath;
  const verificationReceiptSha256 = input.verificationReceiptSha256;
  return Object.freeze({ verificationReceiptSha256,
    async emit(marker: ExplorerPrivateSignalMarker, signal: AbortSignal): Promise<void> {
      try {
        if (!MARKERS.includes(marker) || signal.aborted) throw new Error(FAILURE);
        const line = JSON.stringify({ version: "explorer-private-signal.v1", at: new Date().toISOString(), marker }) + "\n";
        await appendFile(filePath, line, { encoding: "utf8", flag: "a", mode: 0o600 });
        // Cancellation requests do not prove that an in-flight filesystem write
        // stopped. Never retry an unknown completion or claim human notification.
        if (signal.aborted) throw new Error(FAILURE);
      } catch { throw new Error(FAILURE); }
    },
  });
}
