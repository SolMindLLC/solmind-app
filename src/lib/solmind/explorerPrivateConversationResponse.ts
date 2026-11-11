// Browser-safe projection only. Policy, evidence, actor and configuration stay server-side.
import { parseExplorerConversationResult, type ExplorerConversationResult } from "./explorerConversationContract";

export const EXPLORER_PRIVATE_RESPONSE_VERSION = "explorer-private-conversation-response.v1" as const;
// "paused" is the hard-stop pause notice: the server writes the whole body, so no pause or safety fact
// reaches the browser except as the Explorer's own notice text.
export const EXPLORER_PRIVATE_ASSISTANCE_KINDS = Object.freeze(["support", "adult_policy", "temporarily_unavailable", "paused", "reply_failed"] as const);
// The screen shows this in place of the server's failed-reply sentence when the Send was started by a button (a reply
// choice or a suggestion answer): those words were never typed, so "Your words are still in the message box" would be
// untrue. It is the 2026-11-06 draft wording, unchanged; what this case should say or do waits for Paul (2026-11-10).
export const EXPLORER_FAILED_REPLY_BUTTON_NOTE = "The reply did not come through. You can try again.";
export type ExplorerPrivateAssistance = Readonly<{
  kind: typeof EXPLORER_PRIVATE_ASSISTANCE_KINDS[number];
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
    !(EXPLORER_PRIVATE_ASSISTANCE_KINDS as readonly unknown[]).includes(value.assistance.kind) || !body(value.assistance.body)) return null;
  if (value.assistance.kind === "reply_failed" && (!result.ok || result.state.providerState !== "available" || result.state.pendingTurn)) return null;
  return Object.freeze({ version: EXPLORER_PRIVATE_RESPONSE_VERSION, result,
    assistance: Object.freeze({ kind: value.assistance.kind as ExplorerPrivateAssistance["kind"], body: value.assistance.body, persisted: false }) });
}
