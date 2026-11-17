import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CONNECTED_INTRO,
  CONVERSATION_START_MARKER,
  PRIVACY_CAN_SEE_TITLE,
  PRIVACY_SHARE_TITLE,
  PRIVACY_SHARING_BUTTON,
  RELOAD_BUTTON,
  RELOAD_CHECKING_TEXT,
  RELOAD_HELP_BUTTON_NAME,
  RELOAD_HELP_TEXT,
  RELOAD_REASON_TEXT,
  SAVED_STATUS_RELOAD_NEEDED,
  SAVED_STATUS_UP_TO_DATE,
  connectedSavedStatus,
  connectedStripFocusTarget,
  connectedWaitingFocusTarget,
  nextStripExplanation,
  type ConnectedSavedStatus,
  type ConnectedSavedStatusInput,
  type ConnectedStripExplanation,
} from "../explorerConversationConnectedScreen";
import type { ExplorerConversationError } from "../explorerConversationContract";

// The compact header strip (Paul's decisions, PRJ01-SPR002 decision record 2026-11-16 17:53:42 and 21:27:10 CST).
// The order of precedence of PROPOSAL_R3.md section 3 is the oracle: the first line that matches wins.

const LOADING = "Loading your saved conversation...";
const CHANGE = "Checking your change...";

// A settled, loaded conversation with nothing to report and no confirmed check.
function input(overrides: Partial<ConnectedSavedStatusInput> = {}): ConnectedSavedStatusInput {
  return { errorCode: null, uncertain: false, busy: false, awaitingReply: false, hasState: true, pendingTurn: false,
    lastCheckConfirmed: false, busySentence: "", ...overrides };
}
const outputs = (status: ConnectedSavedStatus) => ({ ...status });

describe("compact header: the approved wording, word for word", () => {
  it("holds the eleven approved entries exactly", () => {
    expect(PRIVACY_SHARING_BUTTON).toBe("Privacy and sharing");
    expect(SAVED_STATUS_UP_TO_DATE).toBe("Up to date at last check");
    expect(SAVED_STATUS_RELOAD_NEEDED).toBe("Reload needed");
    expect(RELOAD_HELP_BUTTON_NAME).toBe("About Reload saved conversation");
    expect(RELOAD_HELP_TEXT).toBe("This screen checks your saved conversation only when it opens, when you make a change and when you reload it. To see changes made in another tab or on another device, choose Reload saved conversation.");
    expect(RELOAD_REASON_TEXT.changed).toBe("To continue after your conversation has changed, choose Reload saved conversation.");
    expect(RELOAD_REASON_TEXT.pending).toBe("To check whether your last message has a confirmed result, choose Reload saved conversation.");
    expect(RELOAD_REASON_TEXT.load).toBe("To try loading your conversation again, choose Reload saved conversation.");
    expect(Object.keys(RELOAD_REASON_TEXT).sort()).toEqual(["changed", "load", "pending"]);
    expect(CONVERSATION_START_MARKER).toBe("Start of your conversation");
    expect(PRIVACY_CAN_SEE_TITLE).toBe("What the Virtual Guide can see");
    expect(PRIVACY_SHARE_TITLE).toBe("Share whole conversation");
    expect(RELOAD_CHECKING_TEXT).toBe("Checking your saved conversation...");
  });

  it("keeps the Reload button's full name and the assurance sentence unchanged", () => {
    expect(RELOAD_BUTTON).toBe("Reload saved conversation");
    expect(CONNECTED_INTRO).toBe("Explore with the SolMind Virtual Guide. Your conversation, Compass and Waypoints stay private; nothing is shared from this screen.");
    // Every instruction names the button by its full name, and each states its reason in the sentence.
    for (const sentence of [RELOAD_HELP_TEXT, ...Object.values(RELOAD_REASON_TEXT)]) {
      expect(sentence.endsWith(`choose ${RELOAD_BUTTON}.`), sentence).toBe(true);
      expect(/\bTo (see|continue|check|try)\b/.test(sentence), sentence).toBe(true);
    }
    // No screen sentence names a colour.
    for (const sentence of [SAVED_STATUS_UP_TO_DATE, SAVED_STATUS_RELOAD_NEEDED, RELOAD_HELP_TEXT, ...Object.values(RELOAD_REASON_TEXT)]) {
      expect(/green|yellow|amber|red\b/i.test(sentence), sentence).toBe(false);
    }
  });

  it("the wording file is plain ASCII and no longer holds the amber line above the title", () => {
    const source = readFileSync(path.resolve(__dirname, "../explorerConversationConnectedScreen.ts"), "utf8");
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source)).toBe(true);
    expect(source).not.toContain("connectedHeaderLabel");
    expect(source).not.toContain("MIDDLE_DOT");
    expect(source).not.toContain("const VG");
    expect(source).not.toContain("is up to date");
  });
});

describe("compact header: the light's order of precedence, every line and every output", () => {
  it("line 1: sign-in refused shows no light, no Reload, no ? and no reason line", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "denied", hasState: false })))).toEqual({
      line: 1, light: null, words: "", reloadShown: false, reloadEnabled: false, helpButtonShown: false, reasonLine: null });
  });

  it("line 2: an unconfirmed change shows no light, no Reload, no ? and no reason line", () => {
    expect(outputs(connectedSavedStatus(input({ uncertain: true })))).toEqual({
      line: 2, light: null, words: "", reloadShown: false, reloadEnabled: false, helpButtonShown: false, reasonLine: null });
  });

  it("line 3: busy with no saved conversation shows the busy sentence, Reload disabled, ? and help as the cause underneath gives", () => {
    expect(outputs(connectedSavedStatus(input({ busy: true, hasState: false, busySentence: LOADING })))).toEqual({
      line: 3, light: null, words: LOADING, reloadShown: true, reloadEnabled: false, helpButtonShown: true, reasonLine: null });
  });

  it("line 4: waiting for a reply shows no light and no words, Reload disabled, ? shown", () => {
    expect(outputs(connectedSavedStatus(input({ busy: true, awaitingReply: true, lastCheckConfirmed: true })))).toEqual({
      line: 4, light: null, words: "", reloadShown: true, reloadEnabled: false, helpButtonShown: true, reasonLine: null });
  });

  it.each([RELOAD_CHECKING_TEXT, CHANGE])("line 5: busy with a saved conversation shows the busy sentence %j, Reload disabled", busySentence => {
    expect(outputs(connectedSavedStatus(input({ busy: true, busySentence, lastCheckConfirmed: true })))).toEqual({
      line: 5, light: null, words: busySentence, reloadShown: true, reloadEnabled: false, helpButtonShown: true, reasonLine: null });
  });

  it("line 6: the conversation has changed is yellow with its reason line and no ?", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "refresh_required", hasState: false })))).toEqual({
      line: 6, light: "yellow", words: "Reload needed", reloadShown: true, reloadEnabled: true, helpButtonShown: false, reasonLine: "changed" });
  });

  it("line 7: a pending result is yellow with its reason line and no ?", () => {
    expect(outputs(connectedSavedStatus(input({ pendingTurn: true })))).toEqual({
      line: 7, light: "yellow", words: "Reload needed", reloadShown: true, reloadEnabled: true, helpButtonShown: false, reasonLine: "pending" });
  });

  it("line 8: could not be loaded (no conversation on screen) shows no light, the reason line and no ?", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "unavailable", hasState: false })))).toEqual({
      line: 8, light: null, words: "", reloadShown: true, reloadEnabled: true, helpButtonShown: false, reasonLine: "load" });
  });

  it("line 8: the Virtual Guide unavailable after a Send (conversation on screen) shows no light, ? and no reason line", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "provider_unavailable", lastCheckConfirmed: true })))).toEqual({
      line: 8, light: null, words: "", reloadShown: true, reloadEnabled: true, helpButtonShown: true, reasonLine: null });
  });

  it("line 9: a confirmed check with a saved conversation on screen is green", () => {
    expect(outputs(connectedSavedStatus(input({ lastCheckConfirmed: true })))).toEqual({
      line: 9, light: "green", words: "Up to date at last check", reloadShown: true, reloadEnabled: true, helpButtonShown: true, reasonLine: null });
  });

  it("line 10: anything else shows no light, Reload enabled and ?", () => {
    expect(outputs(connectedSavedStatus(input()))).toEqual({
      line: 10, light: null, words: "", reloadShown: true, reloadEnabled: true, helpButtonShown: true, reasonLine: null });
  });

  it("green needs the saved conversation as well as the confirmed fact (REV486 finding 5)", () => {
    const status = connectedSavedStatus(input({ lastCheckConfirmed: true, hasState: false }));
    expect(status.light).toBeNull();
    expect(status.line).toBe(10);
  });
});

describe("compact header: the overlaps named in the proposal", () => {
  it("a pending result wins over a confirmed check: yellow, never green beside the pending notice", () => {
    const status = connectedSavedStatus(input({ pendingTurn: true, lastCheckConfirmed: true }));
    expect(status).toMatchObject({ line: 7, light: "yellow", reasonLine: "pending", helpButtonShown: false });
  });

  it("a pending result is yellow whatever else is true, short of sign-in, an unconfirmed change or a request in flight", () => {
    // After a change with a support notice the fact is false; in an ended conversation nothing else changes.
    for (const lastCheckConfirmed of [true, false]) {
      expect(connectedSavedStatus(input({ pendingTurn: true, lastCheckConfirmed }))).toMatchObject({ line: 7, light: "yellow" });
    }
  });

  it("the conversation has changed wins over a pending result", () => {
    expect(connectedSavedStatus(input({ errorCode: "refresh_required", pendingTurn: true }))).toMatchObject({ line: 6, reasonLine: "changed" });
  });

  it("a Reload from the pending state hides only the light: the reason line stays and no ? appears", () => {
    expect(outputs(connectedSavedStatus(input({ pendingTurn: true, busy: true, busySentence: RELOAD_CHECKING_TEXT })))).toEqual({
      line: 5, light: null, words: RELOAD_CHECKING_TEXT, reloadShown: true, reloadEnabled: false, helpButtonShown: false, reasonLine: "pending" });
  });

  it("a Reload after the conversation has changed keeps its reason line and no ?", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "refresh_required", hasState: false, busy: true, busySentence: LOADING })))).toEqual({
      line: 3, light: null, words: LOADING, reloadShown: true, reloadEnabled: false, helpButtonShown: false, reasonLine: "changed" });
  });

  it("a Reload after could not be loaded keeps its reason line and no ?", () => {
    expect(outputs(connectedSavedStatus(input({ errorCode: "unavailable", hasState: false, busy: true, busySentence: LOADING })))).toEqual({
      line: 3, light: null, words: LOADING, reloadShown: true, reloadEnabled: false, helpButtonShown: false, reasonLine: "load" });
  });

  it("sign-in refused wins while busy, and an unconfirmed change wins over any other error code", () => {
    expect(connectedSavedStatus(input({ errorCode: "denied", busy: true, hasState: false, busySentence: LOADING })).line).toBe(1);
    for (const errorCode of ["refresh_required", "provider_unavailable", "unavailable"] as const) {
      expect(connectedSavedStatus(input({ errorCode, uncertain: true })).line).toBe(2);
    }
    expect(connectedSavedStatus(input({ errorCode: "denied", uncertain: true })).line).toBe(1);
  });

  it("the first loading and leaving the page show the loading sentence with ? and no reason line", () => {
    expect(connectedSavedStatus(input({ busy: true, hasState: false, busySentence: LOADING, lastCheckConfirmed: true })))
      .toMatchObject({ line: 3, light: null, words: LOADING, helpButtonShown: true, reasonLine: null });
  });
});

describe("compact header: properties that hold for every combination of the inputs", () => {
  const ERRORS: readonly (ExplorerConversationError | null)[] = [null, "denied", "refresh_required", "provider_unavailable", "unavailable"];
  const BOOLEANS = [false, true] as const;
  const all: ConnectedSavedStatusInput[] = [];
  for (const errorCode of ERRORS) for (const uncertain of BOOLEANS) for (const busy of BOOLEANS) for (const awaitingReply of BOOLEANS)
    for (const hasState of BOOLEANS) for (const pendingTurn of BOOLEANS) for (const lastCheckConfirmed of BOOLEANS) {
      all.push({ errorCode, uncertain, busy, awaitingReply, hasState, pendingTurn, lastCheckConfirmed, busySentence: busy ? CHANGE : "" });
    }

  it("covers 320 combinations", () => {
    expect(all).toHaveLength(320);
  });

  it("Reload is drawn exactly when today's rule permits it, and enabled only when nothing is in flight", () => {
    for (const each of all) {
      const status = connectedSavedStatus(each);
      expect(status.reloadShown, JSON.stringify(each)).toBe(!each.uncertain && each.errorCode !== "denied");
      if (status.reloadEnabled) {
        expect(status.reloadShown, JSON.stringify(each)).toBe(true);
        expect(each.busy || each.awaitingReply, JSON.stringify(each)).toBe(false);
      }
    }
  });

  it("green implies the confirmed fact, a saved conversation on screen, no error, no pending result and nothing in flight", () => {
    for (const each of all) {
      const status = connectedSavedStatus(each);
      if (status.light !== "green") continue;
      expect(each, JSON.stringify(each)).toMatchObject({ lastCheckConfirmed: true, hasState: true, errorCode: null, pendingTurn: false,
        uncertain: false, busy: false, awaitingReply: false });
      expect(status.words).toBe("Up to date at last check");
    }
    // And the converse: exactly those inputs are green.
    const green = all.filter(each => connectedSavedStatus(each).light === "green");
    expect(green).toHaveLength(1);
  });

  it("yellow only for a changed conversation or a pending result, and Reload needed never shows without its reason line", () => {
    for (const each of all) {
      const status = connectedSavedStatus(each);
      if (status.light === "yellow") {
        expect(each.errorCode === "refresh_required" || each.pendingTurn, JSON.stringify(each)).toBe(true);
        expect(status.words).toBe("Reload needed");
        expect(status.reasonLine === "changed" || status.reasonLine === "pending", JSON.stringify(each)).toBe(true);
        expect(status.reloadEnabled, JSON.stringify(each)).toBe(true);
      }
      if (status.words === "Reload needed") expect(status.light).toBe("yellow");
    }
  });

  it("the words are the light's words, the busy sentence or nothing; no light ever shows while a request is in flight", () => {
    for (const each of all) {
      const status = connectedSavedStatus(each);
      expect(["", "Up to date at last check", "Reload needed", CHANGE]).toContain(status.words);
      if (each.busy || each.awaitingReply) expect(status.light, JSON.stringify(each)).toBeNull();
      if (status.light === null && status.words !== "") expect(each.busy, JSON.stringify(each)).toBe(true);
    }
  });

  it("while Reload is drawn, either ? is drawn or a reason line is always shown, never both and never neither", () => {
    for (const each of all) {
      const status = connectedSavedStatus(each);
      if (!status.reloadShown) {
        expect(status.helpButtonShown || status.reasonLine !== null, JSON.stringify(each)).toBe(false);
        continue;
      }
      expect(status.helpButtonShown !== (status.reasonLine !== null), JSON.stringify(each)).toBe(true);
    }
  });

  it("the result does not depend on the confirmed fact unless line 9 or 10 decides", () => {
    for (const each of all) {
      const a = connectedSavedStatus({ ...each, lastCheckConfirmed: true });
      const b = connectedSavedStatus({ ...each, lastCheckConfirmed: false });
      if (a.line !== 9 && a.line !== 10) expect(outputs(a), JSON.stringify(each)).toEqual(outputs(b));
    }
  });
});

describe("compact header: one explanation at a time", () => {
  it("opening one closes the other; closing one shows none", () => {
    const cases: readonly [ConnectedStripExplanation, "privacy" | "help", ConnectedStripExplanation][] = [
      [null, "privacy", "privacy"],
      [null, "help", "help"],
      ["privacy", "privacy", null],
      ["help", "help", null],
      ["privacy", "help", "help"],
      ["help", "privacy", "privacy"],
    ];
    for (const [open, chosen, next] of cases) expect(nextStripExplanation(open, chosen), `${open} ${chosen}`).toBe(next);
  });

  it("Paul's six presses: Privacy, ?, ?, ?, Privacy, Privacy", () => {
    const presses = ["privacy", "help", "help", "help", "privacy", "privacy"] as const;
    const seen: ConnectedStripExplanation[] = [];
    let open: ConnectedStripExplanation = null;
    for (const press of presses) { open = nextStripExplanation(open, press); seen.push(open); }
    // Closing the ? text does not bring Privacy and sharing back, and the reverse.
    expect(seen).toEqual(["privacy", "help", null, "help", "privacy", null]);
  });
});

describe("compact header: where focus goes when the focused control leaves the screen", () => {
  it("Reload when enabled, then Retry, then Sign in, then the title", () => {
    const lost = "control" as const;
    expect(connectedStripFocusTarget({ lost, reloadEnabled: true, retryShown: true, signInShown: true })).toBe("reload");
    expect(connectedStripFocusTarget({ lost, reloadEnabled: true, retryShown: false, signInShown: false })).toBe("reload");
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: true, signInShown: true })).toBe("retry");
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: true, signInShown: false })).toBe("retry");
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: false, signInShown: true })).toBe("signIn");
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: false, signInShown: false })).toBe("title");
  });

  it("the rows of the focus table", () => {
    const lost = "control" as const;
    // "?" focused, a pending result or "has changed" or "could not be loaded" arrives: Reload.
    expect(connectedStripFocusTarget({ lost, reloadEnabled: true, retryShown: false, signInShown: false })).toBe("reload");
    // "?" or Reload focused, the change could not be confirmed: Retry (Reload is not drawn then).
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: true, signInShown: false })).toBe("retry");
    // "?" or Reload focused, sign-in refused: Sign in.
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: false, signInShown: true })).toBe("signIn");
    // Retry focused and chosen: it leaves at once while its request runs and Reload is disabled: the title.
    expect(connectedStripFocusTarget({ lost, reloadEnabled: false, retryShown: false, signInShown: false })).toBe("title");
  });

  it("a title that moved between the strip and the chat panel keeps focus on the title", () => {
    for (const reloadEnabled of [true, false]) for (const retryShown of [true, false]) for (const signInShown of [true, false]) {
      expect(connectedStripFocusTarget({ lost: "title", reloadEnabled, retryShown, signInShown })).toBe("title");
    }
  });

  it("focus that waited on the title during a Retry moves on when the answer arrives", () => {
    // Not confirmed again: back to Retry.
    expect(connectedWaitingFocusTarget({ retryShown: true, signInShown: false, reloadEnabled: false, reasonLineShown: false })).toBe("retry");
    // Sign-in refused: Sign in.
    expect(connectedWaitingFocusTarget({ retryShown: false, signInShown: true, reloadEnabled: false, reasonLineShown: false })).toBe("signIn");
    // The answer needs a Reload (a pending result, a changed conversation, could not be loaded): Reload.
    expect(connectedWaitingFocusTarget({ retryShown: false, signInShown: false, reloadEnabled: true, reasonLineShown: true })).toBe("reload");
    // Confirmed with nothing needed: focus stays on the title.
    expect(connectedWaitingFocusTarget({ retryShown: false, signInShown: false, reloadEnabled: true, reasonLineShown: false })).toBeNull();
    // A reason line with Reload still disabled never takes focus.
    expect(connectedWaitingFocusTarget({ retryShown: false, signInShown: false, reloadEnabled: false, reasonLineShown: true })).toBeNull();
  });
});
