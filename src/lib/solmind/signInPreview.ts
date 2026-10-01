// Pure, deterministic state and copy for the /login sign-in preview.
//
// The preview shows the sign-in screens Paul approved for UAT (A1, A2, A4, M1,
// M2 and M3 on 2026-09-29; A3 for Guides and A3A for the Admin on 2026-09-30),
// laid out as in the approved mockups, with the meetings' decisions: a
// "Signing in as" role line on every sign-in step with "Choose a different
// role" beside it; "Use a different email" returning to that role's own
// sign-in screen; and on A3 and A3A, the remembered-browser tick box (30 days
// for Guides, 7 for the Admin) and a "Sign in" button that skips the code on a
// browser already remembered, where the tick box is hidden because the browser
// is already remembered and the box would do nothing.
//
// Everything here is fixed, local and in-memory. No code is issued or
// verified, no password is checked, accounts are never looked up, no browser
// is remembered, and no session is created; what a visitor types stays only in
// the page's memory until refresh. The preview's own additions sit apart from
// the approved layouts: the disclosure, the message switcher and the
// remembered-browser switch in a separate band, and a distinctly styled
// "example screen" callout and short explanations beside the claims and
// controls they qualify. Wiring these screens to real sign-in is login step 6,
// after steps 3 to 5 and the session security contract.

import { SOLMIND_ROLES, SOLMIND_ROLE_LABELS, type SolMindRole } from "./roles";

// ---------------------------------------------------------------------------
// Screens and state
// ---------------------------------------------------------------------------

export const SIGN_IN_SCREENS = {
  chooseRole: "A1",
  explorerEmail: "A2",
  guidePassword: "A3",
  adminPassword: "A3A",
  enterCode: "A4",
  codeWrong: "M1",
  codeExpired: "M2",
  pleaseWait: "M3",
} as const;

export type SignInScreen = (typeof SIGN_IN_SCREENS)[keyof typeof SIGN_IN_SCREENS];

/** The code-screen states the preview controls can switch between, with their labels. */
export const CODE_SCREEN_PREVIEWS: ReadonlyArray<{ screen: SignInScreen; label: string }> = [
  { screen: SIGN_IN_SCREENS.enterCode, label: "Enter your code (A4)" },
  { screen: SIGN_IN_SCREENS.codeWrong, label: "Wrong code (M1)" },
  { screen: SIGN_IN_SCREENS.codeExpired, label: "Expired or used code (M2)" },
  { screen: SIGN_IN_SCREENS.pleaseWait, label: "Please wait (M3)" },
];

const CODE_SCREENS: ReadonlySet<SignInScreen> = new Set(CODE_SCREEN_PREVIEWS.map((entry) => entry.screen));

/** The roles that sign in with a password before the code: Guides on A3, the Admin on A3A. */
export type PasswordSignInRole = typeof SOLMIND_ROLES.GUIDE | typeof SOLMIND_ROLES.ADMIN;

/** The controls whose real effect is explained instead of simulated. */
export type SignInNoticeKey = "forgot" | "help" | "phone" | "remember" | "resend" | "signIn" | "verify";

export type SignInPreviewState = {
  screen: SignInScreen;
  role: SolMindRole | null;
  /** The email (or, on A3A, the Admin username) typed on the role's sign-in screen, kept in page memory only for A4's wording. */
  email: string;
  /** Which control's explanation is showing, beside that control. */
  notice: SignInNoticeKey | null;
  /** A3 and A3A's remembered-browser tick box, held in page memory only. Hidden on a browser already remembered, where it plays no part. */
  rememberTicked: boolean;
  /** The preview controls' switch that shows A3 and A3A as on a browser already remembered. */
  previewRemembered: boolean;
  /** Whether A3 and A3A's password is shown as plain text (the mockups' eye button). */
  passwordShown: boolean;
};

export const INITIAL_SIGN_IN_PREVIEW_STATE: SignInPreviewState = {
  screen: SIGN_IN_SCREENS.chooseRole,
  role: null,
  email: "",
  notice: null,
  rememberTicked: false,
  previewRemembered: false,
  passwordShown: false,
};

// ---------------------------------------------------------------------------
// Copy from the approved mockups
// ---------------------------------------------------------------------------

export const PRIVACY_LINE = "Your privacy and security are always protected.";
export const NEED_HELP_LABEL = "Need help?";
export const CHOOSE_DIFFERENT_ROLE_LABEL = "Choose a different role";
export const EMAIL_PLACEHOLDER = "you@example.com";
export const CODE_LENGTH = 6;
/** The sample code the approved M1 mockup shows in its field. */
export const M1_SAMPLE_CODE = "482913";

export const CHOOSE_ROLE_COPY = {
  heading: "Welcome back",
  question: "How do you use SolMind?",
  noteLines: [
    "If you have more than one role, sign in separately for each one.",
    "New to SolMind? Open the link in your invitation email to get started.",
  ],
} as const;

export type RoleChoiceIcon = "person" | "people" | "shield";

export const ROLE_CHOICES: ReadonlyArray<{
  role: SolMindRole;
  title: string;
  description: string;
  icon: RoleChoiceIcon;
}> = [
  {
    role: SOLMIND_ROLES.EXPLORER,
    title: `I'm an ${SOLMIND_ROLE_LABELS.explorer}`,
    description: "Sign in with a one-time code sent to your email.",
    icon: "person",
  },
  {
    role: SOLMIND_ROLES.GUIDE,
    title: `I'm a ${SOLMIND_ROLE_LABELS.guide}`,
    description: "Sign in with your password, then a one-time code.",
    icon: "people",
  },
  {
    role: SOLMIND_ROLES.ADMIN,
    title: `I'm the ${SOLMIND_ROLE_LABELS.admin}`,
    description: "Sign in with your password, then a one-time code.",
    icon: "shield",
  },
];

export const EXPLORER_EMAIL_COPY = {
  heading: "Welcome back",
  intro: "Enter your email and we'll send you a one-time code.",
  emailLabel: "Email",
  submitLabel: "Send my code",
} as const;

/** The dashed phone option on A2, A3 and A3A. */
export const PHONE_OPTION_COPY = {
  label: "Use a verified phone number instead",
  note: "Only for a phone you have already verified. Not in the first demo.",
} as const;

/**
 * A3 (Guides) and A3A (the Admin), with Paul's two approved points: the tick
 * box's second line, and "Sign in" on a browser already remembered. On such a
 * browser the intro is the one from canvas version 10, which Paul approved on
 * 2026-09-30 (otherwise it is the approved intro), and the tick box is hidden,
 * as Paul also decided on 2026-09-30: the browser is already remembered, so the
 * box would do nothing. Canvas version 10 still shows the box there.
 */
export const PASSWORD_SIGN_IN_COPY = {
  heading: "Welcome back",
  intro: "Enter your email and password, and we'll send you a one-time code.",
  rememberedIntro: "Enter your email and password to sign in. This browser is remembered, so no code is needed.",
  passwordLabel: "Password",
  passwordPlaceholder: "Your password",
  showPasswordLabel: "Show password",
  hidePasswordLabel: "Hide password",
  forgotPasswordLabel: "Forgot your password?",
  rememberSafetyLine: "Only tick this on your own computer, to keep your account safe.",
  sendCodeLabel: "Send my code",
  rememberedSignInLabel: "Sign in",
} as const;

export const PASSWORD_SIGN_IN_IDENTIFIER_LABELS: Record<PasswordSignInRole, string> = {
  [SOLMIND_ROLES.GUIDE]: "Email",
  [SOLMIND_ROLES.ADMIN]: `Email, or the ${SOLMIND_ROLE_LABELS.admin} username`,
};

/** How long a remembered browser skips the code: 30 days for Guides, 7 for the Admin. */
export const REMEMBERED_BROWSER_DAYS: Record<PasswordSignInRole, number> = {
  [SOLMIND_ROLES.GUIDE]: 30,
  [SOLMIND_ROLES.ADMIN]: 7,
};

/** The tick box's first line, for example "Don't ask for a code on this browser for 30 days." */
export function rememberBrowserLine(role: PasswordSignInRole): string {
  return `Don't ask for a code on this browser for ${REMEMBERED_BROWSER_DAYS[role]} days.`;
}

export const ENTER_CODE_COPY = {
  heading: "Check your email",
  codeLabel: "Your code",
  codePlaceholder: "6-digit code",
  verifyLabel: "Verify and sign in",
  resendLabel: "Send a new code",
  differentEmailLabel: "Use a different email",
  spamHint: "Can't find it? Check your spam or junk folder.",
} as const;

export const CODE_WRONG_MESSAGE =
  "That code doesn't match. Check the latest email from SolMind and try again.";

export const CODE_EXPIRED_COPY = {
  heading: "This code can't be used",
  body: "It has expired or has already been used. Codes work once and last 10 minutes. We can send you a new one.",
  resendLabel: "Send a new code",
  differentEmailLabel: "Use a different email",
} as const;

export const PLEASE_WAIT_COPY = {
  heading: "Let's pause for a moment",
  body:
    "For your security, please wait a little while before asking for another code. The last code we sent still works until it expires.",
  resendUnavailableLabel: "Send a new code (available again later)",
} as const;

// ---------------------------------------------------------------------------
// The preview's own additions (not part of the approved layouts)
// ---------------------------------------------------------------------------

export const PREVIEW_DISCLOSURE =
  "Sign-in preview: not connected yet. No code is sent or checked, and what you type stays only in this page's memory until you refresh.";
export const PREVIEW_CONTROLS_LABEL = "Preview controls";
export const EXAMPLE_SCREEN_LABEL = "Example screen: no code was sent or checked.";
/** The preview controls' switch on A3 and A3A; the approved layouts stay unchanged. */
export const PREVIEW_REMEMBERED_BROWSER_LABEL = "Preview: this browser is already remembered";

/** What each not-yet-connected control will do, shown beside it instead of simulating it. */
export const NOT_CONNECTED_NOTICES: Record<SignInNoticeKey, string> = {
  forgot: "Password reset is not set up yet.",
  help: "Help is not set up yet.",
  phone: "Phone sign-in comes later. The first demo uses emailed codes only.",
  remember:
    "Once sign-in is connected, this browser is remembered only after your code is checked. Nothing is remembered in this preview; the preview controls at the top show a remembered browser.",
  resend:
    "Once sign-in is connected, this sends a new code and the older one stops working. Nothing is sent in this preview.",
  signIn:
    "Once sign-in is connected, this checks your password and, because this browser is remembered, signs you in without a code. Nothing is checked in this preview.",
  verify:
    "Once sign-in is connected, this checks the code and opens your home screen. Nothing is checked in this preview.",
};

const ROLE_ARTICLES: Record<SolMindRole, string> = {
  [SOLMIND_ROLES.EXPLORER]: "an",
  [SOLMIND_ROLES.GUIDE]: "a",
  [SOLMIND_ROLES.ADMIN]: "the",
};

/** The role line shown on every sign-in step, for example "Signing in as a Guide". */
export function signingInAsLine(role: SolMindRole): string {
  return `Signing in as ${ROLE_ARTICLES[role]} ${SOLMIND_ROLE_LABELS[role]}`;
}

/**
 * A4's wording never confirms that an account exists: the same sentence
 * appears whether or not the email belongs to anyone. An entry without "@"
 * (the Admin username that A3A accepts) is not an email address, so the
 * sentence says "your email" instead of showing it.
 */
export function enterCodeIntroParts(email: string): { before: string; shown: string; after: string } {
  const trimmed = email.trim();
  return {
    before: "If ",
    shown: trimmed.includes("@") ? trimmed : "your email",
    after: " can receive a code, we've sent one. It works once and expires in 10 minutes.",
  };
}

export function enterCodeIntro(email: string): string {
  const parts = enterCodeIntroParts(email);
  return `${parts.before}${parts.shown}${parts.after}`;
}

export function isCodeScreen(screen: SignInScreen): boolean {
  return CODE_SCREENS.has(screen);
}

/** A3 and A3A: the email-and-password screens. */
export function isPasswordSignInScreen(screen: SignInScreen): boolean {
  return screen === SIGN_IN_SCREENS.guidePassword || screen === SIGN_IN_SCREENS.adminPassword;
}

export function isPasswordSignInRole(role: SolMindRole): role is PasswordSignInRole {
  return role === SOLMIND_ROLES.GUIDE || role === SOLMIND_ROLES.ADMIN;
}

/** The id of each screen's heading, which receives focus when the screen changes. */
export const SIGN_IN_HEADING_ID = "sign-in-heading";

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type SignInPreviewAction =
  | { type: "chooseRole"; role: SolMindRole }
  | { type: "chooseDifferentRole" }
  | { type: "sendCode"; email: string }
  | { type: "submitPassword"; identifier: string }
  | { type: "setRememberTicked"; ticked: boolean }
  | { type: "setPasswordShown"; shown: boolean }
  | { type: "setPreviewRemembered"; remembered: boolean }
  | { type: "useDifferentEmail" }
  | { type: "requestNewCode" }
  | { type: "previewCodeScreen"; screen: SignInScreen }
  | { type: "explain"; notice: SignInNoticeKey }
  | { type: "dismissNotice" };

const ROLE_SIGN_IN_SCREENS: Record<SolMindRole, SignInScreen> = {
  [SOLMIND_ROLES.EXPLORER]: SIGN_IN_SCREENS.explorerEmail,
  [SOLMIND_ROLES.GUIDE]: SIGN_IN_SCREENS.guidePassword,
  [SOLMIND_ROLES.ADMIN]: SIGN_IN_SCREENS.adminPassword,
};

/** The sign-in screen a role starts from: A2 for Explorers, A3 for Guides, A3A for the Admin. */
export function roleSignInScreen(role: SolMindRole): SignInScreen {
  return ROLE_SIGN_IN_SCREENS[role];
}

export function signInPreviewReducer(
  state: SignInPreviewState,
  action: SignInPreviewAction,
): SignInPreviewState {
  switch (action.type) {
    case "chooseRole":
      return { ...INITIAL_SIGN_IN_PREVIEW_STATE, screen: roleSignInScreen(action.role), role: action.role };
    case "chooseDifferentRole":
      return INITIAL_SIGN_IN_PREVIEW_STATE;
    case "sendCode":
      if (state.screen !== SIGN_IN_SCREENS.explorerEmail) {
        return state;
      }
      return { ...state, screen: SIGN_IN_SCREENS.enterCode, email: action.email.trim(), notice: null };
    case "submitPassword":
      // The password itself never reaches this state. With the tick box in
      // either state, A3 and A3A go on to A4 for that role. On a browser
      // already remembered the tick box is hidden, since it would do nothing
      // there, and the button reads "Sign in" and skips the code, so the
      // preview explains that beside the button and stays on the screen.
      if (!isPasswordSignInScreen(state.screen)) {
        return state;
      }
      if (state.previewRemembered) {
        return { ...state, notice: "signIn" };
      }
      return {
        ...state,
        screen: SIGN_IN_SCREENS.enterCode,
        email: action.identifier.trim(),
        notice: null,
        passwordShown: false,
      };
    case "setRememberTicked":
      // On a browser already remembered the tick box is hidden, because the
      // browser is already remembered and the box would do nothing, so a tick
      // there changes nothing and never shows the box's explanation.
      if (!isPasswordSignInScreen(state.screen) || state.previewRemembered) {
        return state;
      }
      if (action.ticked) {
        return { ...state, rememberTicked: true, notice: "remember" };
      }
      return { ...state, rememberTicked: false, notice: state.notice === "remember" ? null : state.notice };
    case "setPasswordShown":
      if (!isPasswordSignInScreen(state.screen)) {
        return state;
      }
      return { ...state, passwordShown: action.shown };
    case "setPreviewRemembered":
      if (!isPasswordSignInScreen(state.screen)) {
        return state;
      }
      return { ...state, previewRemembered: action.remembered, notice: null };
    case "useDifferentEmail":
      // A new attempt for the same role: back to that role's own sign-in
      // screen with the earlier email (or username) and tick cleared.
      if (state.role === null || !isCodeScreen(state.screen) || state.screen === SIGN_IN_SCREENS.pleaseWait) {
        return state;
      }
      return { ...state, screen: roleSignInScreen(state.role), email: "", rememberTicked: false, notice: null };
    case "requestNewCode":
      // M3 shows the request as unavailable. On A4, M1 and M2 the screen stays
      // and the explanation appears beside the control that was used; only the
      // preview controls switch between the code screens.
      if (!isCodeScreen(state.screen) || state.screen === SIGN_IN_SCREENS.pleaseWait) {
        return state;
      }
      return { ...state, notice: "resend" };
    case "previewCodeScreen":
      if (!isCodeScreen(state.screen) || !isCodeScreen(action.screen)) {
        return state;
      }
      return { ...state, screen: action.screen, notice: null };
    case "explain":
      return { ...state, notice: action.notice };
    case "dismissNotice":
      return { ...state, notice: null };
  }
}
