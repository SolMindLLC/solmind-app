// Pure, deterministic state and copy for the /login sign-in preview.
//
// The preview shows the sign-in screens Paul approved on 2026-09-29 (A1, A2,
// A4, M1, M2 and M3, for UAT), laid out as in the approved mockups, with the
// meeting's decisions: a "Signing in as" role line on every sign-in step with
// "Choose a different role" beside it, and "Use a different email" returning to
// that role's own sign-in screen. Guide and Admin sign-in (A3) is being
// revised, so choosing either role says so instead of simulating it.
//
// Everything here is fixed, local and in-memory. No code is issued or
// verified, accounts are never looked up, and no session is created; what a
// visitor types stays only in the page's memory until refresh. The preview's
// own additions sit apart from the approved layouts: the disclosure and the
// message switcher in a separate band, and a distinctly styled "example screen"
// callout and short explanations beside the claims and controls they qualify.
// Wiring
// these screens to real sign-in is login step 6, after steps 3 to 5 and the
// session security contract.

import { SOLMIND_ROLES, SOLMIND_ROLE_LABELS, type SolMindRole } from "./roles";

// ---------------------------------------------------------------------------
// Screens and state
// ---------------------------------------------------------------------------

export const SIGN_IN_SCREENS = {
  chooseRole: "A1",
  explorerEmail: "A2",
  guideAdminNext: "A3-pending",
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

/** The controls whose real effect is explained instead of simulated. */
export type SignInNoticeKey = "help" | "phone" | "resend" | "verify";

export type SignInPreviewState = {
  screen: SignInScreen;
  role: SolMindRole | null;
  /** The email typed on A2, kept in page memory only for A4's wording. */
  email: string;
  /** Which control's explanation is showing, beside that control. */
  notice: SignInNoticeKey | null;
};

export const INITIAL_SIGN_IN_PREVIEW_STATE: SignInPreviewState = {
  screen: SIGN_IN_SCREENS.chooseRole,
  role: null,
  email: "",
  notice: null,
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
  phoneLabel: "Use a verified phone number instead",
  phoneNote: "Only for a phone you have already verified. Not in the first demo.",
} as const;

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
export const GUIDE_ADMIN_NEXT_COPY = {
  heading: "Welcome back",
  body: "Guide and Admin sign-in is being revised after the 2026-09-29 review, so it is not in this preview yet.",
} as const;

/** What each not-yet-connected control will do, shown beside it instead of simulating it. */
export const NOT_CONNECTED_NOTICES: Record<SignInNoticeKey, string> = {
  help: "Help is not set up yet.",
  phone: "Phone sign-in comes later. The first demo uses emailed codes only.",
  resend:
    "Once sign-in is connected, this sends a new code and the older one stops working. Nothing is sent in this preview.",
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
 * appears whether or not the email belongs to anyone.
 */
export function enterCodeIntroParts(email: string): { before: string; shown: string; after: string } {
  const trimmed = email.trim();
  return {
    before: "If ",
    shown: trimmed === "" ? "your email" : trimmed,
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

/** The id of each screen's heading, which receives focus when the screen changes. */
export const SIGN_IN_HEADING_ID = "sign-in-heading";

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type SignInPreviewAction =
  | { type: "chooseRole"; role: SolMindRole }
  | { type: "chooseDifferentRole" }
  | { type: "sendCode"; email: string }
  | { type: "useDifferentEmail" }
  | { type: "requestNewCode" }
  | { type: "previewCodeScreen"; screen: SignInScreen }
  | { type: "explain"; notice: SignInNoticeKey }
  | { type: "dismissNotice" };

/** The sign-in screen a role starts from (A2 for Explorers). */
export function roleSignInScreen(role: SolMindRole): SignInScreen {
  return role === SOLMIND_ROLES.EXPLORER ? SIGN_IN_SCREENS.explorerEmail : SIGN_IN_SCREENS.guideAdminNext;
}

export function signInPreviewReducer(
  state: SignInPreviewState,
  action: SignInPreviewAction,
): SignInPreviewState {
  switch (action.type) {
    case "chooseRole":
      return { screen: roleSignInScreen(action.role), role: action.role, email: "", notice: null };
    case "chooseDifferentRole":
      return INITIAL_SIGN_IN_PREVIEW_STATE;
    case "sendCode":
      if (state.screen !== SIGN_IN_SCREENS.explorerEmail) {
        return state;
      }
      return { ...state, screen: SIGN_IN_SCREENS.enterCode, email: action.email.trim(), notice: null };
    case "useDifferentEmail":
      if (state.role === null || !isCodeScreen(state.screen) || state.screen === SIGN_IN_SCREENS.pleaseWait) {
        return state;
      }
      return { ...state, screen: roleSignInScreen(state.role), notice: null };
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
