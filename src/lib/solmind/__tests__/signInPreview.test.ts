import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { SignInPreviewView, type SignInPreviewViewProps } from "../../../components/solmind/SignInPreviewParts";
import { SOLMIND_ROLES, SOLMIND_ROLE_LABELS } from "../roles";
import {
  CODE_EXPIRED_COPY,
  CODE_SCREEN_PREVIEWS,
  CODE_WRONG_MESSAGE,
  ENTER_CODE_COPY,
  EXAMPLE_SCREEN_LABEL,
  INITIAL_SIGN_IN_PREVIEW_STATE,
  M1_SAMPLE_CODE,
  NOT_CONNECTED_NOTICES,
  PASSWORD_SIGN_IN_COPY,
  PASSWORD_SIGN_IN_IDENTIFIER_LABELS,
  PHONE_OPTION_COPY,
  PLEASE_WAIT_COPY,
  PREVIEW_DISCLOSURE,
  PREVIEW_REMEMBERED_BROWSER_LABEL,
  PRIVACY_LINE,
  REMEMBERED_BROWSER_DAYS,
  ROLE_CHOICES,
  SIGN_IN_HEADING_ID,
  SIGN_IN_SCREENS,
  type PasswordSignInRole,
  type SignInPreviewAction,
  type SignInPreviewState,
  type SignInScreen,
  enterCodeIntro,
  isCodeScreen,
  isPasswordSignInScreen,
  rememberBrowserLine,
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

/** A3 for Guides and A3A for the Admin, with what each screen and its role line should show. */
const PASSWORD_ROLES: ReadonlyArray<{
  role: PasswordSignInRole;
  screen: SignInScreen;
  roleLine: string;
  identifierLabel: string;
  days: number;
}> = [
  {
    role: SOLMIND_ROLES.GUIDE,
    screen: SIGN_IN_SCREENS.guidePassword,
    roleLine: "Signing in as a Guide",
    identifierLabel: "Email",
    days: 30,
  },
  {
    role: SOLMIND_ROLES.ADMIN,
    screen: SIGN_IN_SCREENS.adminPassword,
    roleLine: "Signing in as the Admin",
    identifierLabel: "Email, or the Admin username",
    days: 7,
  },
];

const onPasswordScreen = (role: PasswordSignInRole): SignInPreviewState => run({ type: "chooseRole", role });

const passwordRoleOnCode = (role: PasswordSignInRole, screen: SignInScreen = SIGN_IN_SCREENS.enterCode): SignInPreviewState =>
  run(
    { type: "chooseRole", role },
    { type: "submitPassword", identifier: " riley@example.com " },
    { type: "previewCodeScreen", screen },
  );

/** renderToStaticMarkup escapes apostrophes. */
const escaped = (text: string): string => text.split("'").join("&#x27;");

const INPUT_FOCUS_CLASS_ATTRIBUTE = 'class="focus:outline-2 focus:outline-offset-2 focus:outline-[#f0a64a]"';

const noop = () => undefined;

function render(state: SignInPreviewState, codeDraft = "", emailDraft = ""): string {
  const props: SignInPreviewViewProps = {
    state,
    emailDraft,
    codeDraft,
    onChooseRole: noop,
    onChooseDifferentRole: noop,
    onEmailDraftChange: noop,
    onSubmitEmail: noop,
    onSubmitPassword: noop,
    onPasswordShownChange: noop,
    onRememberTickedChange: noop,
    onCodeDraftChange: noop,
    onSubmitCode: noop,
    onRequestNewCode: noop,
    onUseDifferentEmail: noop,
    onPreviewCodeScreen: noop,
    onPreviewRememberedChange: noop,
    onExplain: noop,
    onDismissNotice: noop,
  };
  return renderToStaticMarkup(createElement(SignInPreviewView, props));
}

/** The text between two positions in rendered markup, without its tags. */
const textBetween = (html: string, from: number, to: number): string =>
  html.slice(from, to).replace(/<[^>]*>/g, " ").trim();

const sources = [
  "../signInPreview.ts",
  "../../../components/solmind/SignInPreview.tsx",
  "../../../components/solmind/SignInPreviewParts.tsx",
  "../../../app/login/page.tsx",
].map((relativePath) => ({
  relativePath,
  source: readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"),
}));

/** Recorded in place of a module path that is not a plain string, which the scan cannot follow, so it fails closed. */
const NON_LITERAL_MODULE_PATH = "(a module path that is not a plain string)";

/**
 * The module paths a source names, read from TypeScript's own syntax tree (`.tsx` files parsed as TSX), so a
 * comment or an ordinary string never counts. Paths come only from import declarations (`import ... from "x"`,
 * `import type`, side-effect `import "x"`), `export ... from "x"`, `import x = require("x")`, `import("x")` calls
 * (with or without an options argument), type-position `import("x")`, and `require("x")` calls.
 */
function moduleSpecifiers(fileName: string, source: string): string[] {
  const scriptKind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, false, scriptKind);
  const specifiers: string[] = [];
  const record = (node: ts.Node | undefined): void => {
    specifiers.push(node !== undefined && ts.isStringLiteralLike(node) ? node.text : NON_LITERAL_MODULE_PATH);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      record(node.moduleSpecifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      record(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      record(node.moduleReference.expression);
    } else if (ts.isImportTypeNode(node)) {
      record(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      record(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
}

/**
 * The auth-module paths among them, however spelled: any path segment that is `auth`, or `auth` followed by an
 * extension or query ("@/lib/solmind/auth", "./auth.ts", "./auth.json", "../auth/index", "src/lib/solmind/auth"
 * and so on), plus any module path that is not a plain string, since the scan cannot tell where it leads.
 */
function authModuleImports(fileName: string, source: string): string[] {
  return moduleSpecifiers(fileName, source).filter(
    (specifier) =>
      specifier === NON_LITERAL_MODULE_PATH ||
      specifier.split(/[\\/]/).some((segment) => /^auth(?:[.?#].*)?$/i.test(segment)),
  );
}

describe("sign-in preview (approved screens A1, A2, A3, A3A, A4, M1, M2, M3)", () => {
  describe("A1: choose your role", () => {
    it("starts on A1 with no role, email or notice, nothing ticked and no browser remembered", () => {
      expect(INITIAL_SIGN_IN_PREVIEW_STATE).toEqual({
        screen: SIGN_IN_SCREENS.chooseRole,
        role: null,
        email: "",
        notice: null,
        rememberTicked: false,
        previewRemembered: false,
        passwordShown: false,
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

    it("sends Explorers to A2, Guides to A3 and the Admin to A3A", () => {
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }).screen).toBe(SIGN_IN_SCREENS.explorerEmail);
      expect(SIGN_IN_SCREENS.guidePassword).toBe("A3");
      expect(SIGN_IN_SCREENS.adminPassword).toBe("A3A");
      for (const entry of PASSWORD_ROLES) {
        const state = onPasswordScreen(entry.role);
        expect(state, entry.role).toEqual({ ...INITIAL_SIGN_IN_PREVIEW_STATE, screen: entry.screen, role: entry.role });
        expect(roleSignInScreen(entry.role), entry.role).toBe(entry.screen);
        expect(render(state), entry.role).toContain(`>${PASSWORD_SIGN_IN_COPY.heading}</h1>`);
      }
      // The placeholder that stood in for A3 while it was revised is gone.
      for (const { relativePath, source } of sources) {
        expect(/being revised|not in this preview yet/.test(source), relativePath).toBe(false);
      }
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

    it("shows the Guide's and the Admin's role line on A3, A3A and their A4 and M1 to M3", () => {
      for (const entry of PASSWORD_ROLES) {
        const screens = [
          onPasswordScreen(entry.role),
          ...CODE_SCREEN_PREVIEWS.map(({ screen }) => passwordRoleOnCode(entry.role, screen)),
        ];
        for (const state of screens) {
          const html = render(state);
          expect(html, `${entry.role} ${state.screen}`).toContain(entry.roleLine);
          expect(html, `${entry.role} ${state.screen}`).toContain("Choose a different role");
        }
      }
    });

    it("returns to A1 and forgets the role, email, tick and preview switch when choosing a different role", () => {
      expect(run({ type: "chooseRole", role: SOLMIND_ROLES.GUIDE }, { type: "chooseDifferentRole" })).toEqual(
        INITIAL_SIGN_IN_PREVIEW_STATE,
      );
      expect(signInPreviewReducer(explorerOnCode(), { type: "chooseDifferentRole" })).toEqual(
        INITIAL_SIGN_IN_PREVIEW_STATE,
      );
      const used = run(
        { type: "chooseRole", role: SOLMIND_ROLES.ADMIN },
        { type: "setRememberTicked", ticked: true },
        { type: "setPasswordShown", shown: true },
        { type: "setPreviewRemembered", remembered: true },
      );
      expect(used.rememberTicked && used.passwordShown && used.previewRemembered).toBe(true);
      expect(signInPreviewReducer(used, { type: "chooseDifferentRole" })).toEqual(INITIAL_SIGN_IN_PREVIEW_STATE);
    });
  });

  describe("A3 and A3A: Guide and Admin sign-in", () => {
    it("uses the approved wording, with the decided tick-box line and 30 or 7 days", () => {
      expect(PASSWORD_SIGN_IN_COPY.rememberSafetyLine).toBe("Only tick this on your own computer, to keep your account safe.");
      expect(REMEMBERED_BROWSER_DAYS).toEqual({ [SOLMIND_ROLES.GUIDE]: 30, [SOLMIND_ROLES.ADMIN]: 7 });
      expect(rememberBrowserLine(SOLMIND_ROLES.GUIDE)).toBe("Don't ask for a code on this browser for 30 days.");
      expect(rememberBrowserLine(SOLMIND_ROLES.ADMIN)).toBe("Don't ask for a code on this browser for 7 days.");
      expect(PASSWORD_SIGN_IN_COPY.intro).toBe("Enter your email and password, and we'll send you a one-time code.");
      expect(PASSWORD_SIGN_IN_COPY.rememberedIntro).toBe(
        "Enter your email and password to sign in. This browser is remembered, so no code is needed.",
      );
      for (const entry of PASSWORD_ROLES) {
        const html = render(onPasswordScreen(entry.role));
        expect(PASSWORD_SIGN_IN_IDENTIFIER_LABELS[entry.role], entry.role).toBe(entry.identifierLabel);
        expect(html, entry.role).toContain(escaped(PASSWORD_SIGN_IN_COPY.intro));
        expect(html, entry.role).not.toContain(escaped(PASSWORD_SIGN_IN_COPY.rememberedIntro));
        expect(html, entry.role).toMatch(new RegExp(`<label for="a3user"[^>]*>${entry.identifierLabel}</label>`));
        expect(html, entry.role).toMatch(/<label for="a3pass"[^>]*>Password<\/label>/);
        expect(html, entry.role).toContain('placeholder="Your password"');
        expect(html, entry.role).toContain(">Forgot your password?</button>");
        expect(html, entry.role).toContain(escaped(`Don't ask for a code on this browser for ${entry.days} days.`));
        expect(html, entry.role).toContain(">Only tick this on your own computer, to keep your account safe.<");
        expect(html, entry.role).not.toContain("a computer that");
        expect(html, entry.role).toMatch(/<button[^>]*type="submit"[^>]*>Send my code<svg/);
        expect(html, entry.role).toContain("1px dashed");
        expect(html, entry.role).toContain(PHONE_OPTION_COPY.label);
        expect(html, entry.role).toContain(PHONE_OPTION_COPY.note);
        expect(html, entry.role).toContain(PRIVACY_LINE);
      }
    });

    it("keeps the password out of the markup: a password field with current-password autocomplete and no value", () => {
      for (const entry of PASSWORD_ROLES) {
        const html = render(onPasswordScreen(entry.role), "", "riley@example.com");
        const passwordInput = html.match(/<input[^>]*id="a3pass"[^>]*>/)?.[0] ?? "";
        expect(passwordInput, entry.role).toContain('type="password"');
        expect(passwordInput, entry.role).toMatch(/autocomplete="current-password"/i);
        expect(passwordInput, entry.role).toContain('required=""');
        expect(passwordInput, entry.role).not.toMatch(/\svalue=/);
        const userInput = html.match(/<input[^>]*id="a3user"[^>]*>/)?.[0] ?? "";
        expect(userInput, entry.role).toMatch(/autocomplete="username"/i);
        expect(userInput, entry.role).toContain('value="riley@example.com"');
        // The mockups' eye button shows the password as text and hides it again.
        expect(html, entry.role).toContain('aria-label="Show password"');
        const shown = render(signInPreviewReducer(onPasswordScreen(entry.role), { type: "setPasswordShown", shown: true }));
        expect(shown.match(/<input[^>]*id="a3pass"[^>]*>/)?.[0], entry.role).toContain('type="text"');
        expect(shown, entry.role).toContain('aria-label="Hide password"');
      }
      // The view's password field is uncontrolled (no value and no change handler), and the client keeps only the
      // email and code drafts, so the password never reaches React props, the preview state or the markup.
      const parts = sources.find(({ relativePath }) => relativePath.endsWith("/SignInPreviewParts.tsx"))?.source ?? "";
      const at = parts.indexOf('id="a3pass"');
      const passwordJsx = parts.slice(parts.lastIndexOf("<input", at), parts.indexOf("/>", at));
      expect(passwordJsx).toContain('autoComplete="current-password"');
      expect(passwordJsx).not.toMatch(/value|onChange|onInput/);
      const client = sources.find(({ relativePath }) => relativePath.endsWith("/SignInPreview.tsx"))?.source ?? "";
      expect(client.match(/useState\(/g)?.length).toBe(2);
      expect(Object.keys(INITIAL_SIGN_IN_PREVIEW_STATE).some((key) => /^password$|passwordValue|passwordDraft/i.test(key))).toBe(false);
    });

    it("goes to A4 for that role when submitted, with the tick box in either state", () => {
      for (const entry of PASSWORD_ROLES) {
        for (const ticked of [false, true]) {
          const state = run(
            { type: "chooseRole", role: entry.role },
            { type: "setRememberTicked", ticked },
            { type: "submitPassword", identifier: " riley@example.com " },
          );
          expect(state.screen, `${entry.role} ${ticked}`).toBe(SIGN_IN_SCREENS.enterCode);
          expect(state.role, `${entry.role} ${ticked}`).toBe(entry.role);
          expect(state.email, `${entry.role} ${ticked}`).toBe("riley@example.com");
          expect(state.notice, `${entry.role} ${ticked}`).toBeNull();
          const html = render(state);
          expect(html, `${entry.role} ${ticked}`).toContain(entry.roleLine);
          expect(html.replace(/<[^>]*>/g, ""), `${entry.role} ${ticked}`).toContain(
            escaped(enterCodeIntro("riley@example.com")),
          );
        }
      }
      // A3's form is the only way there: a password submit elsewhere, or A2's send on A3, changes nothing.
      expect(run({ type: "submitPassword", identifier: "riley@example.com" })).toEqual(INITIAL_SIGN_IN_PREVIEW_STATE);
      const onA2 = run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER });
      expect(signInPreviewReducer(onA2, { type: "submitPassword", identifier: "riley@example.com" })).toBe(onA2);
      const onA3 = onPasswordScreen(SOLMIND_ROLES.GUIDE);
      expect(signInPreviewReducer(onA3, { type: "sendCode", email: "riley@example.com" })).toBe(onA3);
    });

    it("says 'your email' on A4 when A3A was given the Admin username instead of an email", () => {
      const state = run(
        { type: "chooseRole", role: SOLMIND_ROLES.ADMIN },
        { type: "submitPassword", identifier: " solmind-admin " },
      );
      expect(state.screen).toBe(SIGN_IN_SCREENS.enterCode);
      expect(enterCodeIntro(state.email)).toBe(
        "If your email can receive a code, we've sent one. It works once and expires in 10 minutes.",
      );
      expect(render(state)).not.toContain("solmind-admin");
    });

    it("sends 'Use a different email' back to A3 or A3A, not to A1", () => {
      for (const entry of PASSWORD_ROLES) {
        for (const screen of [SIGN_IN_SCREENS.enterCode, SIGN_IN_SCREENS.codeWrong, SIGN_IN_SCREENS.codeExpired]) {
          const back = signInPreviewReducer(passwordRoleOnCode(entry.role, screen), { type: "useDifferentEmail" });
          expect(back.screen, `${entry.role} ${screen}`).toBe(entry.screen);
          expect(back.role, `${entry.role} ${screen}`).toBe(entry.role);
          expect(back.notice, `${entry.role} ${screen}`).toBeNull();
        }
      }
    });

    it("starts a fresh attempt after 'Use a different email': empty field, box unticked, same role (A2 too)", () => {
      const checkbox = (html: string) => html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? "";
      for (const entry of PASSWORD_ROLES) {
        for (const screen of [SIGN_IN_SCREENS.enterCode, SIGN_IN_SCREENS.codeWrong, SIGN_IN_SCREENS.codeExpired]) {
          const label = `${entry.role} ${screen}`;
          const onCode = run(
            { type: "chooseRole", role: entry.role },
            { type: "setRememberTicked", ticked: true },
            { type: "submitPassword", identifier: "riley@example.com" },
            { type: "previewCodeScreen", screen },
          );
          expect(onCode.email, label).toBe("riley@example.com");
          expect(onCode.rememberTicked, label).toBe(true);
          const back = signInPreviewReducer(onCode, { type: "useDifferentEmail" });
          expect(back, label).toEqual({ ...INITIAL_SIGN_IN_PREVIEW_STATE, screen: entry.screen, role: entry.role });
          // The client clears the typed identifier as well (checked in its source below), so A3/A3A render empty.
          const html = render(back);
          expect(html.match(/<input[^>]*id="a3user"[^>]*>/)?.[0], label).toContain('value=""');
          expect(checkbox(html), label).not.toContain("checked");
          expect(html, label).toContain(entry.roleLine);
        }
      }
      const explorerBack = signInPreviewReducer(onScreen(SIGN_IN_SCREENS.codeWrong), { type: "useDifferentEmail" });
      expect(explorerBack).toEqual({
        ...INITIAL_SIGN_IN_PREVIEW_STATE,
        screen: SIGN_IN_SCREENS.explorerEmail,
        role: SOLMIND_ROLES.EXPLORER,
      });
      const explorerHtml = render(explorerBack);
      expect(explorerHtml.match(/<input[^>]*id="a2email"[^>]*>/)?.[0]).toContain('value=""');
      expect(explorerHtml).toContain("Signing in as an Explorer");
      // A true click needs a browser, so the client handler is checked in its source: it empties both drafts.
      const client = sources.find(({ relativePath }) => relativePath.endsWith("/SignInPreview.tsx"))?.source ?? "";
      const handler = client.slice(client.indexOf("onUseDifferentEmail="), client.indexOf("state={state}"));
      expect(handler).toContain('setEmailDraft("")');
      expect(handler).toContain('setCodeDraft("")');
      expect(handler).toContain('dispatch({ type: "useDifferentEmail" })');
    });

    it("keeps the tick box a real checkbox in page memory, and explains it beside itself", () => {
      for (const entry of PASSWORD_ROLES) {
        const onScreenState = onPasswordScreen(entry.role);
        const checkbox = (html: string) => html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? "";
        expect(checkbox(render(onScreenState)), entry.role).not.toContain("checked");
        const ticked = signInPreviewReducer(onScreenState, { type: "setRememberTicked", ticked: true });
        expect(ticked.rememberTicked, entry.role).toBe(true);
        expect(ticked.notice, entry.role).toBe("remember");
        const html = render(ticked);
        expect(checkbox(html), entry.role).toContain('checked=""');
        const lineEnd = html.indexOf(PASSWORD_SIGN_IN_COPY.rememberSafetyLine) + PASSWORD_SIGN_IN_COPY.rememberSafetyLine.length;
        const notice = html.indexOf(NOT_CONNECTED_NOTICES.remember);
        expect(notice, entry.role).toBeGreaterThan(lineEnd);
        expect(textBetween(html, lineEnd, notice), entry.role).toBe("");
        expect(notice, entry.role).toBeLessThan(html.indexOf('type="submit"'));
        const unticked = signInPreviewReducer(ticked, { type: "setRememberTicked", ticked: false });
        expect(unticked.rememberTicked, entry.role).toBe(false);
        expect(unticked.notice, entry.role).toBeNull();
        expect(render(unticked), entry.role).not.toContain(NOT_CONNECTED_NOTICES.remember);
      }
      expect(NOT_CONNECTED_NOTICES.remember).toMatch(/Nothing is remembered in this preview/);
      const onA2 = run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER });
      expect(signInPreviewReducer(onA2, { type: "setRememberTicked", ticked: true })).toBe(onA2);
      expect(signInPreviewReducer(onA2, { type: "setPasswordShown", shown: true })).toBe(onA2);
    });

    it("explains 'Forgot your password?' and the phone option beside themselves, without leaving the screen", () => {
      for (const entry of PASSWORD_ROLES) {
        const forgotState = signInPreviewReducer(onPasswordScreen(entry.role), { type: "explain", notice: "forgot" });
        expect(forgotState.screen, entry.role).toBe(entry.screen);
        const forgot = render(forgotState);
        const marker = `>${PASSWORD_SIGN_IN_COPY.forgotPasswordLabel}</button>`;
        const link = forgot.indexOf(marker);
        const note = forgot.indexOf(NOT_CONNECTED_NOTICES.forgot);
        expect(link, entry.role).toBeGreaterThan(-1);
        expect(note, entry.role).toBeGreaterThan(link);
        expect(textBetween(forgot, link + marker.length, note), entry.role).toBe("");
        const phoneState = signInPreviewReducer(onPasswordScreen(entry.role), { type: "explain", notice: "phone" });
        expect(phoneState.screen, entry.role).toBe(entry.screen);
        const phone = render(phoneState);
        const panelEnd = phone.indexOf(PHONE_OPTION_COPY.note) + PHONE_OPTION_COPY.note.length;
        const phoneNote = phone.indexOf(NOT_CONNECTED_NOTICES.phone);
        expect(phoneNote, entry.role).toBeGreaterThan(panelEnd);
        expect(textBetween(phone, panelEnd, phoneNote), entry.role).toBe("");
      }
    });
  });

  describe("the remembered-browser preview on A3 and A3A", () => {
    it("offers its switch only on A3 and A3A, inside the preview controls band", () => {
      for (const entry of PASSWORD_ROLES) {
        const html = render(onPasswordScreen(entry.role));
        const band = html.slice(0, html.indexOf("</section>"));
        expect(band, entry.role).toMatch(
          new RegExp(`<button aria-pressed="false"[^>]*>${PREVIEW_REMEMBERED_BROWSER_LABEL}</button>`),
        );
        expect(html.split(PREVIEW_REMEMBERED_BROWSER_LABEL).length - 1, entry.role).toBe(1);
      }
      for (const state of [
        INITIAL_SIGN_IN_PREVIEW_STATE,
        run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }),
        explorerOnCode(),
        passwordRoleOnCode(SOLMIND_ROLES.GUIDE),
      ]) {
        expect(render(state), state.screen).not.toContain(PREVIEW_REMEMBERED_BROWSER_LABEL);
      }
      const onCode = passwordRoleOnCode(SOLMIND_ROLES.ADMIN);
      expect(signInPreviewReducer(onCode, { type: "setPreviewRemembered", remembered: true })).toBe(onCode);
    });

    it("reads 'Sign in', and explains beside the button that the code is skipped, without leaving the screen", () => {
      for (const entry of PASSWORD_ROLES) {
        const remembered = signInPreviewReducer(onPasswordScreen(entry.role), { type: "setPreviewRemembered", remembered: true });
        expect(remembered.screen, entry.role).toBe(entry.screen);
        const html = render(remembered);
        expect(html, entry.role).toMatch(new RegExp(`<button aria-pressed="true"[^>]*>${PREVIEW_REMEMBERED_BROWSER_LABEL}</button>`));
        expect(html, entry.role).toMatch(/<button[^>]*type="submit"[^>]*>Sign in<svg/);
        expect(html, entry.role).not.toContain(PASSWORD_SIGN_IN_COPY.sendCodeLabel);
        // The tick box is hidden, since the browser is already remembered. Apart from it and the intro (both checked
        // in the tests below), the rest of the layout stays as it is.
        expect(html, entry.role).not.toContain(escaped(rememberBrowserLine(entry.role)));
        expect(html, entry.role).not.toContain(PASSWORD_SIGN_IN_COPY.rememberSafetyLine);
        expect(html, entry.role).toContain(`>${PASSWORD_SIGN_IN_COPY.forgotPasswordLabel}</button>`);
        expect(html, entry.role).toContain(PHONE_OPTION_COPY.label);
        for (const ticked of [false, true]) {
          // The box is ticked or not before the switch, since it is hidden once the browser is remembered.
          const pressed = run(
            { type: "chooseRole", role: entry.role },
            { type: "setRememberTicked", ticked },
            { type: "setPreviewRemembered", remembered: true },
            { type: "submitPassword", identifier: "riley@example.com" },
          );
          expect(pressed.screen, `${entry.role} ${ticked}`).toBe(entry.screen);
          expect(pressed.notice, `${entry.role} ${ticked}`).toBe("signIn");
          expect(pressed.email, `${entry.role} ${ticked}`).toBe("");
          const pressedHtml = render(pressed);
          const marker = `>${PASSWORD_SIGN_IN_COPY.rememberedSignInLabel}`;
          const button = pressedHtml.indexOf(`${marker}<svg`);
          const notice = pressedHtml.indexOf(NOT_CONNECTED_NOTICES.signIn);
          expect(button, `${entry.role} ${ticked}`).toBeGreaterThan(-1);
          expect(notice, `${entry.role} ${ticked}`).toBeGreaterThan(button);
          // Only the button's arrow icon and closing tags sit between the label and its explanation.
          expect(textBetween(pressedHtml, button + marker.length, notice), `${entry.role} ${ticked}`).toBe("");
          // Switching the preview back clears the explanation and restores "Send my code", which goes on to A4.
          const off = signInPreviewReducer(pressed, { type: "setPreviewRemembered", remembered: false });
          expect(off.notice, `${entry.role} ${ticked}`).toBeNull();
          expect(render(off), `${entry.role} ${ticked}`).toMatch(/<button[^>]*type="submit"[^>]*>Send my code<svg/);
          expect(
            signInPreviewReducer(off, { type: "submitPassword", identifier: "riley@example.com" }).screen,
            `${entry.role} ${ticked}`,
          ).toBe(SIGN_IN_SCREENS.enterCode);
        }
      }
      expect(NOT_CONNECTED_NOTICES.signIn).toMatch(/without a code/);
      expect(NOT_CONNECTED_NOTICES.signIn).toMatch(/Nothing is checked in this preview/);
    });

    it("shows canvas version 10's intro on a remembered browser, and the approved intro otherwise", () => {
      const normal = escaped(PASSWORD_SIGN_IN_COPY.intro);
      const remembered = escaped(PASSWORD_SIGN_IN_COPY.rememberedIntro);
      /** The shown intro appears once, between the role line and the first field's label; the other is absent. */
      const expectIntro = (html: string, shown: string, absent: string, label: string): void => {
        const at = html.indexOf(shown);
        expect(at, label).toBeGreaterThan(html.indexOf("Choose a different role"));
        expect(at, label).toBeLessThan(html.indexOf('<label for="a3user"'));
        expect(html.split(shown).length - 1, label).toBe(1);
        expect(html, label).not.toContain(absent);
      };
      for (const entry of PASSWORD_ROLES) {
        expectIntro(render(onPasswordScreen(entry.role)), normal, remembered, `${entry.role} not remembered`);
        for (const ticked of [false, true]) {
          const label = `${entry.role} remembered, ticked ${ticked}`;
          const on = run(
            { type: "chooseRole", role: entry.role },
            { type: "setRememberTicked", ticked },
            { type: "setPreviewRemembered", remembered: true },
          );
          expectIntro(render(on), remembered, normal, label);
          // Pressing "Sign in" keeps the remembered intro; switching the preview back restores the approved one.
          const pressed = signInPreviewReducer(on, { type: "submitPassword", identifier: "riley@example.com" });
          expect(pressed.notice, label).toBe("signIn");
          expectIntro(render(pressed), remembered, normal, `${label}, pressed`);
          const off = signInPreviewReducer(pressed, { type: "setPreviewRemembered", remembered: false });
          expectIntro(render(off), normal, remembered, `${label}, switched back`);
        }
      }
    });

    it("hides the tick box on a remembered browser, where it would do nothing, and shows it again when switched back", () => {
      const checkboxes = (html: string): string[] => html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
      for (const entry of PASSWORD_ROLES) {
        const boxLine = escaped(rememberBrowserLine(entry.role));
        // On a browser that is not remembered, the tick box shows with both its lines.
        const normal = render(onPasswordScreen(entry.role));
        expect(checkboxes(normal), entry.role).toHaveLength(1);
        expect(normal, entry.role).toContain(boxLine);
        expect(normal, entry.role).toContain(PASSWORD_SIGN_IN_COPY.rememberSafetyLine);
        for (const ticked of [false, true]) {
          const label = `${entry.role} ticked ${ticked} before the switch`;
          const on = run(
            { type: "chooseRole", role: entry.role },
            { type: "setRememberTicked", ticked },
            { type: "setPreviewRemembered", remembered: true },
          );
          // The box's explanation goes with it: the switch clears it, and a tick on a remembered browser changes nothing.
          expect(on.notice, label).toBeNull();
          expect(signInPreviewReducer(on, { type: "setRememberTicked", ticked: !ticked }), label).toBe(on);
          const pressed = signInPreviewReducer(on, { type: "submitPassword", identifier: "riley@example.com" });
          expect(pressed.notice, label).toBe("signIn");
          for (const { state, when } of [
            { state: on, when: "remembered" },
            { state: pressed, when: "remembered, after pressing Sign in" },
          ]) {
            const html = render(state);
            expect(checkboxes(html), `${label}, ${when}`).toEqual([]);
            expect(html, `${label}, ${when}`).not.toContain(boxLine);
            expect(html, `${label}, ${when}`).not.toContain(PASSWORD_SIGN_IN_COPY.rememberSafetyLine);
            expect(html, `${label}, ${when}`).not.toContain(NOT_CONNECTED_NOTICES.remember);
            // Only the two fields remain, and both stay required.
            const inputs = html.match(/<input[^>]*>/g) ?? [];
            expect(inputs.length, `${label}, ${when}`).toBe(2);
            for (const id of ["a3user", "a3pass"]) {
              expect(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0], `${label}, ${when}, ${id}`).toContain(
                'required=""',
              );
            }
          }
          // Switching back shows the box again, ticked or not as it was before.
          const back = render(signInPreviewReducer(pressed, { type: "setPreviewRemembered", remembered: false }));
          expect(checkboxes(back), `${label}, switched back`).toHaveLength(1);
          expect(checkboxes(back)[0].includes('checked=""'), `${label}, switched back`).toBe(ticked);
          expect(back, `${label}, switched back`).toContain(boxLine);
          expect(back, `${label}, switched back`).toContain(PASSWORD_SIGN_IN_COPY.rememberSafetyLine);
        }
      }
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
      expect(isCodeScreen(SIGN_IN_SCREENS.guidePassword)).toBe(false);
      expect(isCodeScreen(SIGN_IN_SCREENS.adminPassword)).toBe(false);
      expect(CODE_SCREEN_PREVIEWS.some(({ screen }) => isPasswordSignInScreen(screen))).toBe(false);
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
      // A3 and A3A's mockups also outline their button (the eye) and the tick box.
      for (const entry of PASSWORD_ROLES) {
        const html = render(onPasswordScreen(entry.role));
        const inputs = html.match(/<input[^>]*>/g) ?? [];
        expect(inputs.length, entry.role).toBe(3);
        for (const input of inputs) {
          expect(input, entry.role).toContain(INPUT_FOCUS_CLASS_ATTRIBUTE);
        }
        expect(html, entry.role).toContain(`<button aria-label="Show password" ${INPUT_FOCUS_CLASS_ATTRIBUTE}`);
      }
    });

    it("gives the controls ported from the mockups' links their link colour, hover colour and amber focus outline", () => {
      const linkClass =
        'class="text-[#f3b566] hover:text-[#ffd08f] focus:outline-2 focus:outline-offset-2 focus:outline-[#f0a64a]"';
      const linkButton = (label: string) =>
        new RegExp(`<button ${linkClass.replace(/[[\]#]/g, "\\$&")}[^>]*>(?:<svg[\\s\\S]*?</svg>)?${label}</button>`);
      const cases: ReadonlyArray<{ state: SignInPreviewState; labels: string[] }> = [
        {
          state: onPasswordScreen(SOLMIND_ROLES.GUIDE),
          labels: ["Choose a different role", "Forgot your password\\?", PHONE_OPTION_COPY.label, "Need help\\?"],
        },
        {
          state: onPasswordScreen(SOLMIND_ROLES.ADMIN),
          labels: ["Choose a different role", "Forgot your password\\?", PHONE_OPTION_COPY.label, "Need help\\?"],
        },
        { state: run({ type: "chooseRole", role: SOLMIND_ROLES.EXPLORER }), labels: ["Choose a different role", PHONE_OPTION_COPY.label] },
        { state: onScreen(SIGN_IN_SCREENS.enterCode), labels: [ENTER_CODE_COPY.resendLabel, ENTER_CODE_COPY.differentEmailLabel] },
        { state: onScreen(SIGN_IN_SCREENS.codeExpired), labels: [CODE_EXPIRED_COPY.differentEmailLabel] },
      ];
      for (const { state, labels } of cases) {
        const html = render(state);
        for (const label of labels) {
          expect(html, `${state.screen} ${label}`).toMatch(linkButton(label));
        }
        // The link colour comes only from the class, so the hover colour is not overridden by an inline colour.
        expect(html, state.screen).not.toContain("color:#f3b566");
      }
    });

    it("gives every screen one focusable heading for focus to move to", () => {
      for (const state of [
        INITIAL_SIGN_IN_PREVIEW_STATE,
        ...PASSWORD_ROLES.map((entry) => onPasswordScreen(entry.role)),
        ...CODE_SCREEN_PREVIEWS.map((entry) => onScreen(entry.screen)),
      ]) {
        const html = render(state);
        expect(html.match(new RegExp(`<h1 id="${SIGN_IN_HEADING_ID}"[^>]*tabindex="-1"`, "g"))?.length, state.screen).toBe(1);
      }
    });
  });

  describe("local-only boundary", () => {
    it("uses no provider, network, persistence, server, cookie, URL-state, timer or logging integration", () => {
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
        /\bconsole\./,
      ];
      for (const { relativePath, source } of sources) {
        for (const pattern of forbidden) {
          expect(pattern.test(source), `${relativePath} matches ${pattern}`).toBe(false);
        }
        expect(authModuleImports(relativePath, source), `${relativePath} imports an auth module`).toEqual([]);
      }
    });

    it("reads every source's real imports, and catches every spelling of an auth-module import", () => {
      // The scan sees the four sources' actual imports, so an auth import there would not slip past it.
      const [domainImports, componentImports, partsImports, pageImports] = sources.map(({ relativePath, source }) =>
        moduleSpecifiers(relativePath, source),
      );
      expect(domainImports).toContain("./roles");
      expect(componentImports).toEqual(
        expect.arrayContaining(["react", "@/lib/solmind/signInPreview", "@/components/solmind/SignInPreviewParts"]),
      );
      expect(partsImports).toEqual(
        expect.arrayContaining(["next/image", "react", "@/lib/solmind/roles", "@/lib/solmind/signInPreview"]),
      );
      expect(pageImports).toEqual(expect.arrayContaining(["next", "@/components/solmind/SignInPreview"]));
      for (const spelling of [
        'import { x } from "./auth.ts";',
        'export { y } from "../auth/index";',
        'import {\n  a,\n  b,\n} from "@/lib/solmind/auth";',
        'import { x } from "@/lib/solmind/auth/roleContext";',
        "import type { T } from '../auth';",
        'import "./auth.tsx";',
        'export * from "src/lib/solmind/auth";',
        'import { x } from "../../lib/solmind/auth/index.ts";',
        'const x = require("../auth.js");',
        'const m = import("./auth");',
        'import x = require("../auth");',
        'type T = typeof import("./auth");',
        "const m = import(`./auth`);",
      ]) {
        expect(authModuleImports("example.ts", spelling).length, spelling).toBe(1);
      }
      for (const unrelated of [
        'const label = "auth";',
        'import { x } from "./oauthNote";',
        'import { x } from "./authors";',
        'autoComplete="current-password"',
      ]) {
        expect(authModuleImports("example.ts", unrelated), unrelated).toEqual([]);
      }
    });

    it("counts only real module syntax: require() of JSON and import() with options, never comments or strings", () => {
      // The three cases from review #116c: require() of a JSON file and import() with an options argument are
      // caught, and an auth path in a comment or an ordinary string is not.
      expect(authModuleImports("example.ts", 'const data = require("./auth.json");')).toEqual(["./auth.json"]);
      expect(authModuleImports("example.ts", 'const m = import("./auth", { with: {} });')).toEqual(["./auth"]);
      for (const { fileName, text } of [
        { fileName: "example.ts", text: '// import "./auth.ts";' },
        { fileName: "example.ts", text: '/* import { x } from "@/lib/solmind/auth"; */' },
        { fileName: "example.ts", text: '/** See require("./auth.ts") and import("./auth"). */' },
        { fileName: "example.ts", text: "const note = 'import { x } from \"./auth\"';" },
        { fileName: "example.ts", text: 'const note = `require("./auth")`;' },
        { fileName: "example.tsx", text: 'const view = <p>import "./auth.ts";</p>;' },
      ]) {
        expect(moduleSpecifiers(fileName, text), text).toEqual([]);
      }
      // Real imports beside a comment are still read, each once, and a module path that is not a plain string
      // fails closed.
      expect(
        moduleSpecifiers(
          "example.ts",
          '// import "./auth";\nimport { a } from "./roles";\nconst j = import("./auth.json", { with: { type: "json" } });',
        ),
      ).toEqual(["./roles", "./auth.json"]);
      expect(authModuleImports("example.ts", "const m = require(modulePath);")).toEqual([NON_LITERAL_MODULE_PATH]);
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
