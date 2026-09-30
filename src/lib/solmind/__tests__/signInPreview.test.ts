import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SignInPreviewView, type SignInPreviewViewProps } from "../../../components/solmind/SignInPreviewParts";
import { SOLMIND_ROLES, SOLMIND_ROLE_LABELS } from "../roles";
import {
  CODE_EXPIRED_COPY,
  CODE_SCREEN_PREVIEWS,
  CODE_WRONG_MESSAGE,
  ENTER_CODE_COPY,
  EXAMPLE_SCREEN_LABEL,
  GUIDE_ADMIN_NEXT_COPY,
  INITIAL_SIGN_IN_PREVIEW_STATE,
  M1_SAMPLE_CODE,
  NOT_CONNECTED_NOTICES,
  PLEASE_WAIT_COPY,
  PREVIEW_DISCLOSURE,
  PRIVACY_LINE,
  ROLE_CHOICES,
  SIGN_IN_HEADING_ID,
  SIGN_IN_SCREENS,
  type SignInPreviewAction,
  type SignInPreviewState,
  type SignInScreen,
  enterCodeIntro,
  isCodeScreen,
  roleSignInScreen,
  signInPreviewReducer,
  signingInAsLine,
} from "../signInPreview";

function run(...actions: SignInPreviewAction[]): SignInPreviewState {
  return actions.reduce(signInPreviewReducer, INITIAL_SIGN_IN_PREVIEW_STATE);
}

const explorerOnCode = (): SignInPreviewState =>
  run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }, { type: "sendCode", email: " avery@example.com " });

const onScreen = (screen: SignInScreen): SignInPreviewState =>
  signInPreviewReducer(explorerOnCode(), { type: "previewCodeScreen", screen });

const noop = () => undefined;

function render(state: SignInPreviewState, codeDraft = ""): string {
  const props: SignInPreviewViewProps = {
    state,
    emailDraft: "",
    codeDraft,
    onChooseRole: noop,
    onChooseDifferentRole: noop,
    onEmailDraftChange: noop,
    onSubmitEmail: noop,
    onCodeDraftChange: noop,
    onSubmitCode: noop,
    onRequestNewCode: noop,
    onUseDifferentEmail: noop,
    onPreviewCodeScreen: noop,
    onExplain: noop,
    onDismissNotice: noop,
  };
  return renderToStaticMarkup(createElement(SignInPreviewView, props));
}

const sources = [
  "../signInPreview.ts",
  "../../../components/solmind/SignInPreview.tsx",
  "../../../components/solmind/SignInPreviewParts.tsx",
  "../../../app/login/page.tsx",
].map((relativePath) => ({
  relativePath,
  source: readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
}));

describe("sign-in preview (approved screens A1, A2, A4, M1, M2, M3)", () => {
  describe("A1: choose your role", () => {
    it("starts on A1 with no role, email or notice", () => {
      expect(INITIAL_SIGN_IN_PREVIEW_STATE).toEqual({
        screen: SIGN_IN_SCREENS.chooseRole,
        role: null,
        email: "",
        notice: null,
      });
    });

    it("offers Explorer, Guide and Admin in that order, with the approved wording and icons", () => {
      expect(ROLE_CHOICES.map((choice) => choice.role)).toEqual([
        SOLMIND_ROLES.EXPLORER,
        SOLMIND_ROLES.GUIDE,
        SOLMIND_ROLES.ADMIN,
      ]);
      expect(ROLE_CHOICES.map((choice) => choice.title)).toEqual(["I'm an Explorer", "I'm a Guide", "I'm the Admin"]);
      expect(ROLE_CHOICES.map((choice) => choice.icon)).toEqual(["person", "people", "shield"]);
      const html = render(INITIAL_SIGN_IN_PREVIEW_STATE);
      expect(html.match(/<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*I&#x27;m (an|a|the) /g)?.length).toBe(3);
      expect(html).toContain(PRIVACY_LINE);
    });

    it("sends Explorers to A2, and Guides and Admins to the honest not-yet-approved screen", () => {
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }).screen).toBe(SIGN_IN_SCREENS.explorerEmail);
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.GUIDE }).screen).toBe(SIGN_IN_SCREENS.guideAdminNext);
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.ADMIN }).screen).toBe(SIGN_IN_SCREENS.guideAdminNext);
      expect(GUIDE_ADMIN_NEXT_COPY.body).not.toMatch(/\(/);
    });
  });

  describe("the role line on every sign-in step", () => {
    it("names the chosen role with its article", () => {
      expect(signingInAsLine(SOLMIND_ROLES.EXPLORER)).toBe(`Signing in as an ${SOLMIND_ROLE_LABELS.explorer}`);
      expect(signingInAsLine(SOLMIND_ROLES.GUIDE)).toBe(`Signing in as a ${SOLMIND_ROLE_LABELS.guide}`);
      expect(signingInAsLine(SOLMIND_ROLES.ADMIN)).toBe(`Signing in as the ${SOLMIND_ROLE_LABELS.admin}`);
    });

    it("shows the role line with 'Choose a different role' on A2, A4 and M1 to M3", () => {
      const screens = [
        run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }),
        ...CODE_SCREEN_PREVIEWS.map((entry) => onScreen(entry.screen)),
      ];
      for (const state of screens) {
        const html = render(state);
        expect(html, state.screen).toContain("Signing in as an Explorer");
        expect(html, state.screen).toContain("Choose a different role");
      }
      expect(render(INITIAL_SIGN_IN_PREVIEW_STATE)).not.toContain("Signing in as");
    });

    it("returns to A1 and forgets the role and email when choosing a different role", () => {
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.GUIDE }, { type: "chooseDifferentRole" })).toEqual(
        INITIAL_SIGN_IN_PREVIEW_STATE,
      );
      expect(signInPreviewReducer(explorerOnCode(), { type: "chooseDifferentRole" })).toEqual(
        INITIAL_SIGN_IN_PREVIEW_STATE,
      );
    });
  });

  describe("A2 to A4", () => {
    it("moves to A4 and keeps the trimmed email only in memory for A4's wording", () => {
      const state = explorerOnCode();
      expect(state.screen).toBe(SIGN_IN_SCREENS.enterCode);
      expect(state.email).toBe("avery@example.com");
      expect(enterCodeIntro(state.email)).toBe(
        "If avery@example.com can receive a code, we've sent one. It works once and expires in 10 minutes.",
      );
    });

    it("never confirms that an account exists", () => {
      expect(enterCodeIntro("")).toBe(
        "If your email can receive a code, we've sent one. It works once and expires in 10 minutes.",
      );
      for (const { relativePath, source } of sources) {
        expect(/no account|not found|doesn't exist|does not exist|isn't registered/i.test(source), relativePath).toBe(
          false,
        );
      }
    });

    it("keeps A2's dashed phone option and explains it instead of simulating it", () => {
      const html = render(run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }));
      expect(html).toContain("1px dashed");
      expect(html).toContain("Use a verified phone number instead");
      const explained = render(
        signInPreviewReducer(run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }), { type: "explain", notice: "phone" }),
      );
      expect(explained).toContain(NOT_CONNECTED_NOTICES.phone);
    });

    it("ignores a send from any screen other than A2", () => {
      expect(run({ type: "sendCode", email: "x@example.com" })).toEqual(INITIAL_SIGN_IN_PREVIEW_STATE);
    });
  });

  describe("A4 and the messages M1, M2, M3", () => {
    it("switches only between the four code screens", () => {
      expect(CODE_SCREEN_PREVIEWS.map((entry) => entry.screen)).toEqual([
        SIGN_IN_SCREENS.enterCode,
        SIGN_IN_SCREENS.codeWrong,
        SIGN_IN_SCREENS.codeExpired,
        SIGN_IN_SCREENS.pleaseWait,
      ]);
      for (const { screen } of CODE_SCREEN_PREVIEWS) {
        expect(onScreen(screen).screen).toBe(screen);
      }
      expect(
        signInPreviewReducer(explorerOnCode(), { type: "previewCodeScreen", screen: SIGN_IN_SCREENS.chooseRole }).screen,
      ).toBe(SIGN_IN_SCREENS.enterCode);
      const onA1 = INITIAL_SIGN_IN_PREVIEW_STATE;
      expect(signInPreviewReducer(onA1, { type: "previewCodeScreen", screen: SIGN_IN_SCREENS.codeWrong })).toBe(onA1);
      expect(isCodeScreen(SIGN_IN_SCREENS.explorerEmail)).toBe(false);
    });

    it("uses the approved message wording", () => {
      expect(CODE_WRONG_MESSAGE).toBe("That code doesn't match. Check the latest email from SolMind and try again.");
      expect(CODE_EXPIRED_COPY.heading).toBe("This code can't be used");
      expect(CODE_EXPIRED_COPY.body).toBe(
        "It has expired or has already been used. Codes work once and last 10 minutes. We can send you a new one.",
      );
      expect(PLEASE_WAIT_COPY.heading).toBe("Let's pause for a moment");
      expect(PLEASE_WAIT_COPY.body).toBe(
        "For your security, please wait a little while before asking for another code. The last code we sent still works until it expires.",
      );
      expect(ENTER_CODE_COPY.heading).toBe("Check your email");
    });

    it("attaches M1's alert to its input, with the approved sample code and error border", () => {
      const html = render(onScreen(SIGN_IN_SCREENS.codeWrong), M1_SAMPLE_CODE);
      expect(html).toMatch(/<input[^>]*aria-describedby="m1msg"[^>]*aria-invalid="true"/);
      expect(html).toContain(`value="${M1_SAMPLE_CODE}"`);
      expect(html).toContain("1.5px solid #e08a74");
      expect(html).toMatch(/<div id="m1msg" role="alert"/);
      expect(html).toContain(CODE_WRONG_MESSAGE.replace("'", "&#x27;"));
      expect(render(onScreen(SIGN_IN_SCREENS.enterCode))).not.toContain("aria-invalid");
    });

    it("announces M2 and M3's messages as a polite status, as the approved mockups do", () => {
      for (const screen of [SIGN_IN_SCREENS.codeExpired, SIGN_IN_SCREENS.pleaseWait]) {
        const html = render(onScreen(screen));
        expect(html, screen).toMatch(/<div role="status"/);
        expect(html, screen).not.toContain('role="alert"');
      }
    });

    it("shows M3's new-code request as unavailable text, not a control", () => {
      const html = render(onScreen(SIGN_IN_SCREENS.pleaseWait));
      expect(html).toContain(PLEASE_WAIT_COPY.resendUnavailableLabel);
      expect(html).not.toMatch(/<button[^>]*>Send a new code/);
    });

    it("keeps the privacy line off M1 to M3, as in the approved mockups", () => {
      expect(render(onScreen(SIGN_IN_SCREENS.enterCode))).toContain(PRIVACY_LINE);
      for (const screen of [SIGN_IN_SCREENS.codeWrong, SIGN_IN_SCREENS.codeExpired, SIGN_IN_SCREENS.pleaseWait]) {
        expect(render(onScreen(screen)), screen).not.toContain(PRIVACY_LINE);
      }
    });

    it("sends 'Use a different email' back to that role's own sign-in screen, not to A1", () => {
      const back = signInPreviewReducer(onScreen(SIGN_IN_SCREENS.codeExpired), { type: "useDifferentEmail" });
      expect(back.screen).toBe(roleSignInScreen(SOLMIND_ROLES.EXPLORER));
      expect(back.screen).toBe(SIGN_IN_SCREENS.explorerEmail);
      expect(back.role).toBe(SOLMIND_ROLES.EXPLORER);
    });

    it("keeps the screen on a new-code request and explains it beside that screen's control, and ignores it on M3", () => {
      for (const screen of [SIGN_IN_SCREENS.enterCode, SIGN_IN_SCREENS.codeWrong, SIGN_IN_SCREENS.codeExpired]) {
        const state = signInPreviewReducer(onScreen(screen), { type: "requestNewCode" });
        expect(state.screen, screen).toBe(screen);
        expect(state.notice, screen).toBe("resend");
        const html = render(state);
        const marker = `>${ENTER_CODE_COPY.resendLabel}</button>`;
        const control = html.indexOf(marker);
        const notice = html.indexOf(NOT_CONNECTED_NOTICES.resend);
        expect(control, screen).toBeGreaterThan(-1);
        expect(notice, screen).toBeGreaterThan(control);
        // Nothing else of the screen's own content sits between the control and its explanation, apart from
        // A4/M1's neighbouring "Use a different email" link in the same row.
        const between = html.slice(control + marker.length, notice).replace(/<[^>]*>/g, " ");
        expect(between.replace(ENTER_CODE_COPY.differentEmailLabel, "").trim(), screen).toBe("");
      }
      const onM3 = onScreen(SIGN_IN_SCREENS.pleaseWait);
      expect(signInPreviewReducer(onM3, { type: "requestNewCode" })).toBe(onM3);
    });

    it("keeps M1's sample code, error state and alert after a new-code request, with the explanation beside the link", () => {
      const state = signInPreviewReducer(onScreen(SIGN_IN_SCREENS.codeWrong), { type: "requestNewCode" });
      expect(state.screen).toBe(SIGN_IN_SCREENS.codeWrong);
      const html = render(state, M1_SAMPLE_CODE);
      expect(html).toContain(`value="${M1_SAMPLE_CODE}"`);
      expect(html).toMatch(/<input[^>]*aria-describedby="m1msg"[^>]*aria-invalid="true"/);
      expect(html).toMatch(/<div id="m1msg" role="alert"/);
      const control = html.indexOf(`>${ENTER_CODE_COPY.resendLabel}</button>`);
      expect(control).toBeGreaterThan(-1);
      expect(html.indexOf(NOT_CONNECTED_NOTICES.resend)).toBeGreaterThan(control);
      // A true click needs a browser, so the client handler is checked in its source: it only dispatches the
      // request and leaves the code draft, and so M1's sample code, alone.
      const client = sources.find(({ relativePath }) => relativePath.endsWith("/SignInPreview.tsx"))?.source ?? "";
      const handler = client.slice(client.indexOf("onRequestNewCode="), client.indexOf("onSubmitCode="));
      expect(handler).toContain('dispatch({ type: "requestNewCode" })');
      expect(handler).not.toContain("setCodeDraft");
    });

    it("explains verification beside its button instead of checking a code", () => {
      const state = signInPreviewReducer(explorerOnCode(), { type: "explain", notice: "verify" });
      expect(state.screen).toBe(SIGN_IN_SCREENS.enterCode);
      const html = render(state);
      expect(html).toContain(NOT_CONNECTED_NOTICES.verify);
      expect(html.indexOf(NOT_CONNECTED_NOTICES.verify)).toBeGreaterThan(html.indexOf(ENTER_CODE_COPY.verifyLabel));
      expect(signInPreviewReducer(state, { type: "dismissNotice" }).notice).toBeNull();
    });
  });

  describe("the preview's own additions", () => {
    it("shows the disclosure in a separate band, and the example callout beside each code screen's claims", () => {
      const a1 = render(INITIAL_SIGN_IN_PREVIEW_STATE);
      expect(a1).toContain('aria-label="Preview controls"');
      expect(a1).toContain(PREVIEW_DISCLOSURE.replace("'", "&#x27;"));
      expect(a1).not.toContain(EXAMPLE_SCREEN_LABEL);
      expect(PREVIEW_DISCLOSURE).toMatch(/not connected yet/i);
      expect(PREVIEW_DISCLOSURE).toMatch(/memory until you refresh/);
      for (const { screen } of CODE_SCREEN_PREVIEWS) {
        const html = render(onScreen(screen));
        const band = html.slice(0, html.indexOf("</section>"));
        expect(band, screen).not.toContain(EXAMPLE_SCREEN_LABEL);
        expect(html.split(EXAMPLE_SCREEN_LABEL).length - 1, screen).toBe(1);
        const callout = html.indexOf(EXAMPLE_SCREEN_LABEL);
        if (screen === SIGN_IN_SCREENS.enterCode || screen === SIGN_IN_SCREENS.codeWrong) {
          expect(callout, screen).toBeGreaterThan(html.indexOf("can receive a code"));
          expect(callout, screen).toBeLessThan(html.indexOf(ENTER_CODE_COPY.codeLabel));
        } else {
          expect(callout, screen).toBeLessThan(html.indexOf('<div role="status"'));
          expect(callout, screen).toBeGreaterThan(html.indexOf("Signing in as"));
        }
      }
    });

    it("gives the inputs the mockups' amber focus outline", () => {
      for (const state of [run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }), onScreen(SIGN_IN_SCREENS.enterCode), onScreen(SIGN_IN_SCREENS.pleaseWait)]) {
        expect(render(state), state.screen).toMatch(/<input[^>]*class="focus:outline-2 focus:outline-offset-2 focus:outline-\[#f0a64a\]"/);
      }
    });

    it("gives every screen one focusable heading for focus to move to", () => {
      for (const state of [INITIAL_SIGN_IN_PREVIEW_STATE, ...CODE_SCREEN_PREVIEWS.map((entry) => onScreen(entry.screen))]) {
        const html = render(state);
        expect(html.match(new RegExp(`<h1 id="${SIGN_IN_HEADING_ID}"[^>]*tabindex="-1"`, "g"))?.length, state.screen).toBe(1);
      }
    });
  });

  describe("local-only boundary", () => {
    it("uses no provider, network, persistence, server, cookie, URL-state or timer integration", () => {
      const forbidden = [
        /\bfetch\s*\(/,
        /localStorage|sessionStorage|indexedDB/,
        /cookie/i,
        /supabase/i,
        /["']use server["']/,
        /next\/headers/,
        /process\.env/,
        /sendBeacon/,
        /setTimeout|setInterval|requestAnimationFrame|requestIdleCallback/,
        /XMLHttpRequest|WebSocket|EventSource/,
        /\bpostMessage\s*\(|\bBroadcastChannel\b|\bimport\s*\(/,
        /useSearchParams|useRouter|usePathname|next\/navigation/,
        /history\.(pushState|replaceState)|location\.(hash|search|href|assign)/,
        /\baction=/,
        /@\/lib\/solmind\/auth/,
      ];
      for (const { relativePath, source } of sources) {
        for (const pattern of forbidden) {
          expect(pattern.test(source), `${relativePath} matches ${pattern}`).toBe(false);
        }
      }
    });

    it("keeps the route thin and the client boundary in one component", () => {
      const [domainSource, componentSource, partsSource, pageSource] = sources.map((entry) => entry.source);
      expect(componentSource.startsWith('"use client";')).toBe(true);
      expect(/["']use client["']/.test(domainSource)).toBe(false);
      expect(/["']use client["']/.test(partsSource)).toBe(false);
      expect(/["']use client["']/.test(pageSource)).toBe(false);
      expect(pageSource).toContain("<SignInPreview />");
    });
  });
});
