// Browser-safe projection only. Policy, evidence, actor and configuration stay server-side.
import { parseExplorerConversationResult, type ExplorerConversationResult } from "./explorerConversationContract";

export const EXPLORER_PRIVATE_RESPONSE_VERSION = "explorer-private-conversation-response.v1" as const;
export type ExplorerPrivateAssistance = Readonly<{
  kind: "support" | "adult_policy" | "temporarily_unavailable";
  body: string;
  persisted: false;
}>;
export type ExplorerPrivateConversationResponse = Readonly<{
  version: typeof EXPLORER_PRIVATE_RESPONSE_VERSION;
  result: ExplorerConversationResult;
  assistance: ExplorerPrivateAssistance | null;
}>;
function object(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function body(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 8192 ||
    /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
export function parseExplorerPrivateConversationResponse(value: unknown): ExplorerPrivateConversationResponse | null {
  if (!object(value) || !exact(value, ["version", "result", "assistance"]) || value.version !== EXPLORER_PRIVATE_RESPONSE_VERSION) return null;
  const result = parseExplorerConversationResult(value.result);
  if (!result) return null;
  if (value.assistance === null) return Object.freeze({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result, assistance: null });
  // Static failure assistance can survive lost authority; no private state or
  // generated candidate is admitted by this separate transient projection.
  if (!object(value.assistance) ||
    !exact(value.assistance, ["kind", "body", "persisted"]) || value.assistance.persisted !== false ||
    !["support", "adult_policy", "temporarily_unavailable"].includes(value.assistance.kind as string) || !body(value.assistance.body)) return null;
  return Object.freeze({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result,
    assistance: Object.freeze({ kind: value.assistance.kind as ExplorerPrivateAssistance["kind"], body: value.assistance.body, persisted: false }) });
}
