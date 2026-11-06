// Paul's approved wording, 2026-11-06 09:07:10 CST (REV304).
// Change the notice wording or its version only with Paul's approval.
export const EXPLORER_EARLY_TEST_NOTICE_VERSION = "early-test-notice-2026-11-06";
export const EARLY_TEST_NOTICE_HEADING = "Early test version";
export const EARLY_TEST_NOTICE_OPENING = "SolMind is still being built, and you're trying an early version to give feedback.";
export const EARLY_TEST_NOTICE_BULLETS = Object.freeze([
  "Information saved in this test is kept for testing and review, and Paul may review it. To ask for removal, ask Paul; some records may need to be kept.",
  "When AI replies are on, your messages and some saved information are sent to OpenAI to write replies.",
  "The Virtual Guide is AI and can be wrong. SolMind is not therapy or medical care.",
  "Privacy protections are not complete yet, so share only what you'd be comfortable with others possibly seeing.",
  "SolMind can't provide emergency help or guarantee a human response time. In the U.S., call or text 988 for crisis support, or call 911 if you're in immediate danger.",
  "At a usage limit, an Admin can see whether your account is in crisis or urgent support, but not your words or what caused it.",
] as const);
export const EARLY_TEST_NOTICE_AGREE = "I'm 18 or older and agree";
export const EARLY_TEST_NOTICE_NOT_NOW = "Not now";

// Supporting copy approved by Paul, 2026-11-06 15:13:41 CST (REV304b).
export const EARLY_TEST_NOTICE_DECLINED_HEADING = "You can come back later";
export const EARLY_TEST_NOTICE_DECLINED_BODY = "Nothing was saved by choosing Not now. Sign out to leave this test. When you sign in again, you'll see the notice so you can decide whether to agree.";
export const EARLY_TEST_NOTICE_UNAVAILABLE_HEADING = "Please try again later";
export const EARLY_TEST_NOTICE_UNAVAILABLE = "SolMind can't be opened right now because it couldn't check whether you need to see the early test notice. Please try again later.";
export const EARLY_TEST_NOTICE_SIGN_OUT = "Sign out";
export const EARLY_TEST_NOTICE_SIGNING_OUT = "Signing out...";
export const EARLY_TEST_NOTICE_CHECKING = "Checking access...";
export const EARLY_TEST_NOTICE_SAVING = "Saving your agreement...";

export type ExplorerEarlyTestNoticeStatus = "allowed" | "required" | "unavailable" | "denied";
export type ExplorerEarlyTestNoticeResult = Readonly<{
  status: ExplorerEarlyTestNoticeStatus;
  noticeVersion: string | null;
}>;

export function parseExplorerEarlyTestNoticeResult(value: unknown): ExplorerEarlyTestNoticeResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const fields = Object.keys(value);
  if (fields.length !== 2 || !fields.includes("status") || !fields.includes("noticeVersion")) return null;
  const row = value as Record<string, unknown>;
  if (row.status === "required" && row.noticeVersion === EXPLORER_EARLY_TEST_NOTICE_VERSION) {
    return Object.freeze({ status: row.status, noticeVersion: row.noticeVersion });
  }
  if ((row.status === "allowed" || row.status === "unavailable" || row.status === "denied") && row.noticeVersion === null) {
    return Object.freeze({ status: row.status, noticeVersion: null });
  }
  return null;
}
