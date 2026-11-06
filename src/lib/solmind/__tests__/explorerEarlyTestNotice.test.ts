import { describe, expect, it } from "vitest";
import {
  EARLY_TEST_NOTICE_HEADING, EARLY_TEST_NOTICE_OPENING, EARLY_TEST_NOTICE_BULLETS,
  EARLY_TEST_NOTICE_AGREE, EARLY_TEST_NOTICE_NOT_NOW, EXPLORER_EARLY_TEST_NOTICE_VERSION,
  EARLY_TEST_NOTICE_DECLINED_HEADING, EARLY_TEST_NOTICE_DECLINED_BODY,
  EARLY_TEST_NOTICE_UNAVAILABLE_HEADING, EARLY_TEST_NOTICE_UNAVAILABLE,
  EARLY_TEST_NOTICE_SIGN_OUT, EARLY_TEST_NOTICE_SIGNING_OUT,
  parseExplorerEarlyTestNoticeResult,
} from "../explorerEarlyTestNotice";

describe("Paul's approved early-test notice", () => {
  it("pins the complete approved ASCII wording and version", () => {
    expect(EXPLORER_EARLY_TEST_NOTICE_VERSION).toBe("early-test-notice-2026-11-06");
    expect(EARLY_TEST_NOTICE_HEADING).toBe("Early test version");
    expect(EARLY_TEST_NOTICE_OPENING).toBe("SolMind is still being built, and you're trying an early version to give feedback.");
    expect(EARLY_TEST_NOTICE_BULLETS).toEqual([
      "Information saved in this test is kept for testing and review, and Paul may review it. To ask for removal, ask Paul; some records may need to be kept.",
      "When AI replies are on, your messages and some saved information are sent to OpenAI to write replies.",
      "The Virtual Guide is AI and can be wrong. SolMind is not therapy or medical care.",
      "Privacy protections are not complete yet, so share only what you'd be comfortable with others possibly seeing.",
      "SolMind can't provide emergency help or guarantee a human response time. In the U.S., call or text 988 for crisis support, or call 911 if you're in immediate danger.",
      "At a usage limit, an Admin can see whether your account is in crisis or urgent support, but not your words or what caused it.",
    ]);
    expect(EARLY_TEST_NOTICE_AGREE).toBe("I'm 18 or older and agree");
    expect(EARLY_TEST_NOTICE_NOT_NOW).toBe("Not now");
  });
  it("accepts only closed status shapes and the wording version actually displayed", () => {
    expect(parseExplorerEarlyTestNoticeResult({ status: "required", noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION })?.status).toBe("required");
    for (const status of ["allowed", "denied", "unavailable"]) {
      expect(parseExplorerEarlyTestNoticeResult({ status, noticeVersion: null })?.status).toBe(status);
    }
    for (const value of [null, [], {}, { status: "allowed" }, { status: "allowed", noticeVersion: null, accountId: "private" },
      { status: "required", noticeVersion: "another-version" }, { status: "allowed", noticeVersion: EXPLORER_EARLY_TEST_NOTICE_VERSION }]) {
      expect(parseExplorerEarlyTestNoticeResult(value)).toBeNull();
    }
  });
  it("pins Paul's supporting-copy decision of 2026-11-06 15:13:41 CST", () => {
    expect(EARLY_TEST_NOTICE_DECLINED_HEADING).toBe("You can come back later");
    expect(EARLY_TEST_NOTICE_DECLINED_BODY).toBe("Nothing was saved by choosing Not now. Sign out to leave this test. When you sign in again, you'll see the notice so you can decide whether to agree.");
    expect(EARLY_TEST_NOTICE_UNAVAILABLE_HEADING).toBe("Please try again later");
    expect(EARLY_TEST_NOTICE_UNAVAILABLE).toBe("SolMind can't be opened right now because it couldn't check whether you need to see the early test notice. Please try again later.");
    expect(EARLY_TEST_NOTICE_SIGN_OUT).toBe("Sign out");
    expect(EARLY_TEST_NOTICE_SIGNING_OUT).toBe("Signing out...");
  });
});
