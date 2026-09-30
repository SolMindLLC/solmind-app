import Image from "next/image";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import { SOLMIND_LOGO_SRC } from "@/lib/solmind/explorerCompassComparison";
import type { SolMindRole } from "@/lib/solmind/roles";
import {
  CHOOSE_DIFFERENT_ROLE_LABEL,
  CHOOSE_ROLE_COPY,
  CODE_EXPIRED_COPY,
  CODE_LENGTH,
  CODE_SCREEN_PREVIEWS,
  CODE_WRONG_MESSAGE,
  EMAIL_PLACEHOLDER,
  ENTER_CODE_COPY,
  EXAMPLE_SCREEN_LABEL,
  EXPLORER_EMAIL_COPY,
  GUIDE_ADMIN_NEXT_COPY,
  NEED_HELP_LABEL,
  NOT_CONNECTED_NOTICES,
  PLEASE_WAIT_COPY,
  PREVIEW_CONTROLS_LABEL,
  PREVIEW_DISCLOSURE,
  PRIVACY_LINE,
  ROLE_CHOICES,
  type RoleChoiceIcon,
  SIGN_IN_HEADING_ID,
  SIGN_IN_SCREENS,
  type SignInNoticeKey,
  type SignInPreviewState,
  type SignInScreen,
  enterCodeIntroParts,
  isCodeScreen,
  signingInAsLine,
} from "@/lib/solmind/signInPreview";

// The stateless view of the /login sign-in preview. Each screen's structure
// and styles follow its approved mockup (the proposal's MOCKUPS_APPROVED
// sources); SignInPreview.tsx owns the one in-memory state object and passes
// it in. The preview's own additions sit in a separate "Preview controls" band.

// ---------------------------------------------------------------------------
// Styles from the approved mockups
// ---------------------------------------------------------------------------

const SANS = "Figtree, system-ui, sans-serif";
const SERIF = "Newsreader, Georgia, serif";
const AMBER = "#f0a64a";
const LINK = "#f3b566";
const INK = "#f4ede3";
const MUTED = "#bfb2a0";
const SOFT = "#d9c7ad";
const BORDER = "#4a3b2b";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "0 16px 32px",
  background: "#0c0a08",
  color: INK,
  fontFamily: SANS,
};
const columnStyle: CSSProperties = { width: "100%", maxWidth: 480 };
const headingStyle: CSSProperties = {
  margin: "20px 0 0",
  fontFamily: SERIF,
  fontWeight: 400,
  fontSize: 44,
  lineHeight: 1.15,
  textAlign: "center",
};
const linkButtonStyle: CSSProperties = {
  border: 0,
  padding: 0,
  background: "transparent",
  color: LINK,
  font: "inherit",
  cursor: "pointer",
};
const fieldLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: AMBER,
};
const textInputStyle: CSSProperties = {
  height: 54,
  boxSizing: "border-box",
  padding: "0 16px",
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  background: "#0f0c09",
  color: INK,
  fontFamily: SANS,
  fontSize: 17,
};
const codeInputStyle: CSSProperties = {
  ...textInputStyle,
  height: 62,
  padding: "0 18px",
  fontSize: 26,
  letterSpacing: "0.4em",
  textAlign: "center",
};
/** The mockups' input focus rule: a 2px amber outline with a 2px offset. */
const INPUT_FOCUS_CLASS = "focus:outline-2 focus:outline-offset-2 focus:outline-[#f0a64a]";
const primaryStyle: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  height: 58,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  border: 0,
  borderRadius: 12,
  background: AMBER,
  color: "#1a1208",
  fontFamily: SANS,
  fontSize: 18,
  fontWeight: 600,
  cursor: "pointer",
};
const panelStyle: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  boxSizing: "border-box",
  marginTop: 26,
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "16px 18px",
  borderRadius: 12,
  background: "#17120d",
  border: `1px solid ${BORDER}`,
  fontSize: 17,
  lineHeight: 1.5,
  color: SOFT,
};
const noticeStyle: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  boxSizing: "border-box",
  marginTop: 12,
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #3a3a52",
  background: "#12121c",
  color: "#d4d4e8",
  fontSize: 14,
  lineHeight: 1.45,
};

// ---------------------------------------------------------------------------
// Icons from the approved mockups
// ---------------------------------------------------------------------------

function ArrowRight({ stroke }: { stroke: string }) {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="20">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function RoleIcon({ icon }: { icon: RoleChoiceIcon }) {
  return (
    <svg aria-hidden="true" fill="none" height="28" stroke={AMBER} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="28">
      {icon === "person" ? (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.2-3.6 3.9-5.5 7-5.5s5.8 1.9 7 5.5" />
        </>
      ) : null}
      {icon === "people" ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c1-3 3.2-4.6 5.5-4.6s4.5 1.6 5.5 4.6" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 14.6c1.5.6 2.6 2 3 4.4" />
        </>
      ) : null}
      {icon === "shield" ? (
        <>
          <path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6l7-3z" />
          <path d="M9.5 12l1.8 1.8 3.2-3.6" />
        </>
      ) : null}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function Heading({ children }: { children: ReactNode }) {
  return (
    <h1 id={SIGN_IN_HEADING_ID} style={headingStyle} tabIndex={-1}>
      {children}
    </h1>
  );
}

function RoleLine({ role, onChooseDifferentRole }: { role: SolMindRole; onChooseDifferentRole: () => void }) {
  return (
    <p style={{ margin: "8px 0 0", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 12, fontSize: 16, color: SOFT }}>
      <span>{signingInAsLine(role)}</span>
      <span aria-hidden="true" style={{ color: "#6b5a47" }}>
        &middot;
      </span>
      <button onClick={onChooseDifferentRole} style={linkButtonStyle} type="button">
        {CHOOSE_DIFFERENT_ROLE_LABEL}
      </button>
    </p>
  );
}

function Notice({ notice, onDismiss }: { notice: SignInNoticeKey; onDismiss: () => void }) {
  return (
    <div role="status" style={noticeStyle}>
      <span style={{ flexGrow: 1 }}>{NOT_CONNECTED_NOTICES[notice]}</span>
      <button onClick={onDismiss} style={{ ...linkButtonStyle, color: "#b8b8f0", fontSize: 14 }} type="button">
        Close
      </button>
    </div>
  );
}

/** A preview addition, styled apart from the approved layout, beside the claims it qualifies. */
function ExampleCallout({ placement }: { placement: "below" | "above" }) {
  return (
    <p
      data-preview-addition="example-screen"
      style={{
        width: "100%",
        maxWidth: 480,
        boxSizing: "border-box",
        margin: placement === "below" ? "12px 0 0" : "20px 0 0",
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px dashed #6a6a9a",
        background: "#12121c",
        color: "#f0e6a8",
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: "center",
      }}
    >
      <span style={{ marginRight: 8, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#b8b8f0" }}>
        Preview
      </span>
      {EXAMPLE_SCREEN_LABEL}
    </p>
  );
}

function Footer({
  withPrivacy,
  notice,
  onHelp,
  onDismissNotice,
}: {
  withPrivacy: boolean;
  notice: SignInNoticeKey | null;
  onHelp: () => void;
  onDismissNotice: () => void;
}) {
  return (
    <div style={{ marginTop: "auto", paddingTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <button onClick={onHelp} style={{ ...linkButtonStyle, display: "flex", alignItems: "center", gap: 8, fontSize: 16 }} type="button">
        <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="20">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
          <path d="M12 17h.01" />
        </svg>
        {NEED_HELP_LABEL}
      </button>
      {notice === "help" ? <Notice notice="help" onDismiss={onDismissNotice} /> : null}
      {withPrivacy ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: MUTED }}>
          <svg aria-hidden="true" fill="none" height="18" stroke={MUTED} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="18">
            <rect height="9" rx="2" width="14" x="5" y="11" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {PRIVACY_LINE}
        </div>
      ) : null}
    </div>
  );
}

function PreviewControls({
  screen,
  onPreviewCodeScreen,
}: {
  screen: SignInScreen;
  onPreviewCodeScreen: (screen: SignInScreen) => void;
}) {
  return (
    <section
      aria-label={PREVIEW_CONTROLS_LABEL}
      style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px", borderBottom: "1px solid #2a2a3a", background: "#101018", color: "#d4d4e8", fontSize: 14, lineHeight: 1.45, textAlign: "center" }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>{PREVIEW_CONTROLS_LABEL}</p>
      <p style={{ margin: "4px 0 0" }}>{PREVIEW_DISCLOSURE}</p>
      {isCodeScreen(screen) ? (
        <>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {CODE_SCREEN_PREVIEWS.map((option) => (
              <li key={option.screen}>
                <button
                  aria-pressed={option.screen === screen}
                  onClick={() => onPreviewCodeScreen(option.screen)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: option.screen === screen ? "1px solid #b8b8f0" : "1px solid #3a3a52",
                    background: option.screen === screen ? "#23233a" : "transparent",
                    color: "#d4d4e8",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export type SignInPreviewViewProps = {
  state: SignInPreviewState;
  emailDraft: string;
  codeDraft: string;
  onChooseRole: (role: SolMindRole) => void;
  onChooseDifferentRole: () => void;
  onEmailDraftChange: (value: string) => void;
  onSubmitEmail: (event: FormEvent<HTMLFormElement>) => void;
  onCodeDraftChange: (value: string) => void;
  onSubmitCode: (event: FormEvent<HTMLFormElement>) => void;
  onRequestNewCode: () => void;
  onUseDifferentEmail: () => void;
  onPreviewCodeScreen: (screen: SignInScreen) => void;
  onExplain: (notice: SignInNoticeKey) => void;
  onDismissNotice: () => void;
};

export function SignInPreviewView(props: SignInPreviewViewProps) {
  const { state } = props;
  const role = state.role;
  const screen = state.screen;
  const onCodeScreens = screen === SIGN_IN_SCREENS.enterCode || screen === SIGN_IN_SCREENS.codeWrong;
  const withPrivacy =
    screen === SIGN_IN_SCREENS.chooseRole ||
    screen === SIGN_IN_SCREENS.explorerEmail ||
    screen === SIGN_IN_SCREENS.guideAdminNext ||
    screen === SIGN_IN_SCREENS.enterCode;

  return (
    <main style={pageStyle}>
      <PreviewControls onPreviewCodeScreen={props.onPreviewCodeScreen} screen={screen} />
      <Image
        alt="SolMind: Illuminate, Understand, Grow"
        height={159}
        loading="eager"
        src={SOLMIND_LOGO_SRC}
        style={{ marginTop: 40, width: 220, height: 159, objectFit: "contain" }}
        unoptimized
        width={220}
      />

      {screen === SIGN_IN_SCREENS.chooseRole ? (
        <>
          <Heading>{CHOOSE_ROLE_COPY.heading}</Heading>
          <p style={{ margin: "10px 0 0", fontSize: 18, color: SOFT, textAlign: "center" }}>{CHOOSE_ROLE_COPY.question}</p>
          <ul style={{ width: "100%", maxWidth: 560, margin: "32px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
            {ROLE_CHOICES.map((choice) => (
              <li key={choice.role}>
                <button
                  onClick={() => props.onChooseRole(choice.role)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 18, padding: "20px 24px", borderRadius: 14, border: `1px solid ${BORDER}`, background: "#15110d", color: INK, fontFamily: SANS, textAlign: "left", cursor: "pointer" }}
                  type="button"
                >
                  <RoleIcon icon={choice.icon} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1 }}>
                    <span style={{ fontSize: 19, fontWeight: 600 }}>{choice.title}</span>
                    <span style={{ fontSize: 15, color: MUTED }}>{choice.description}</span>
                  </span>
                  <ArrowRight stroke={AMBER} />
                </button>
              </li>
            ))}
          </ul>
          <p style={{ margin: "22px 0 0", width: "100%", maxWidth: 560, fontSize: 15, lineHeight: 1.5, color: MUTED, textAlign: "center" }}>
            {CHOOSE_ROLE_COPY.noteLines[0]}
            <br />
            {CHOOSE_ROLE_COPY.noteLines[1]}
          </p>
        </>
      ) : null}

      {screen === SIGN_IN_SCREENS.explorerEmail && role !== null ? (
        <>
          <Heading>{EXPLORER_EMAIL_COPY.heading}</Heading>
          <RoleLine onChooseDifferentRole={props.onChooseDifferentRole} role={role} />
          <p style={{ margin: "10px 0 0", fontSize: 18, lineHeight: 1.5, color: AMBER, textAlign: "center" }}>{EXPLORER_EMAIL_COPY.intro}</p>
          <form onSubmit={props.onSubmitEmail} style={{ ...columnStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ ...columnStyle, marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
              <label htmlFor="a2email" style={fieldLabelStyle}>
                {EXPLORER_EMAIL_COPY.emailLabel}
              </label>
              <input
                autoComplete="email"
                className={INPUT_FOCUS_CLASS}
                id="a2email"
                onChange={(event) => props.onEmailDraftChange(event.target.value)}
                placeholder={EMAIL_PLACEHOLDER}
                required
                style={textInputStyle}
                type="email"
                value={props.emailDraft}
              />
            </div>
            <button style={{ ...primaryStyle, marginTop: 24 }} type="submit">
              {EXPLORER_EMAIL_COPY.submitLabel}
              <ArrowRight stroke="#1a1208" />
            </button>
          </form>
          <div style={{ ...columnStyle, marginTop: 20, padding: "14px 16px", boxSizing: "border-box", borderRadius: 10, border: `1px dashed ${BORDER}`, display: "flex", alignItems: "center", gap: 12 }}>
            <svg aria-hidden="true" fill="none" height="22" stroke={MUTED} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="22">
              <rect height="19" rx="2" width="10" x="7" y="2.5" />
              <path d="M11 18h2" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <button onClick={() => props.onExplain("phone")} style={{ ...linkButtonStyle, fontSize: 16 }} type="button">
                {EXPLORER_EMAIL_COPY.phoneLabel}
              </button>
              <span style={{ fontSize: 14, color: MUTED }}>{EXPLORER_EMAIL_COPY.phoneNote}</span>
            </div>
          </div>
          {state.notice === "phone" ? <Notice notice="phone" onDismiss={props.onDismissNotice} /> : null}
        </>
      ) : null}

      {screen === SIGN_IN_SCREENS.guideAdminNext && role !== null ? (
        <>
          <Heading>{GUIDE_ADMIN_NEXT_COPY.heading}</Heading>
          <RoleLine onChooseDifferentRole={props.onChooseDifferentRole} role={role} />
          <p style={{ margin: "16px 0 0", ...columnStyle, fontSize: 18, lineHeight: 1.5, color: SOFT, textAlign: "center" }}>{GUIDE_ADMIN_NEXT_COPY.body}</p>
        </>
      ) : null}

      {onCodeScreens && role !== null ? (
        <>
          <Heading>{ENTER_CODE_COPY.heading}</Heading>
          <RoleLine onChooseDifferentRole={props.onChooseDifferentRole} role={role} />
          <CodeIntro email={state.email} />
          <ExampleCallout placement="below" />
          <form onSubmit={props.onSubmitCode} style={{ ...columnStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ ...columnStyle, marginTop: 30, display: "flex", flexDirection: "column", gap: 10 }}>
              <label htmlFor="sign-in-code" style={fieldLabelStyle}>
                {ENTER_CODE_COPY.codeLabel}
              </label>
              <input
                aria-describedby={screen === SIGN_IN_SCREENS.codeWrong ? "m1msg" : undefined}
                aria-invalid={screen === SIGN_IN_SCREENS.codeWrong ? true : undefined}
                autoComplete="one-time-code"
                className={INPUT_FOCUS_CLASS}
                id="sign-in-code"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                onChange={(event) => props.onCodeDraftChange(event.target.value)}
                placeholder={ENTER_CODE_COPY.codePlaceholder}
                style={screen === SIGN_IN_SCREENS.codeWrong ? { ...codeInputStyle, border: "1.5px solid #e08a74" } : codeInputStyle}
                type="text"
                value={props.codeDraft}
              />
              {screen === SIGN_IN_SCREENS.codeWrong ? (
                <div
                  id="m1msg"
                  role="alert"
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "#1d1310", border: "1px solid #5c352a", color: "#f2c2b4", fontSize: 16, lineHeight: 1.45 }}
                >
                  <svg aria-hidden="true" fill="none" height="20" stroke="#f2c2b4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" width="20">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7.5v5.5M12 16.5h.01" />
                  </svg>
                  <span>{CODE_WRONG_MESSAGE}</span>
                </div>
              ) : null}
            </div>
            <button style={{ ...primaryStyle, marginTop: 22 }} type="submit">
              {ENTER_CODE_COPY.verifyLabel}
            </button>
          </form>
          {state.notice === "verify" ? <Notice notice="verify" onDismiss={props.onDismissNotice} /> : null}
          <div style={{ ...columnStyle, marginTop: 22, display: "flex", justifyContent: "space-between", gap: 16, fontSize: 16 }}>
            <button onClick={props.onRequestNewCode} style={linkButtonStyle} type="button">
              {ENTER_CODE_COPY.resendLabel}
            </button>
            <button onClick={props.onUseDifferentEmail} style={linkButtonStyle} type="button">
              {ENTER_CODE_COPY.differentEmailLabel}
            </button>
          </div>
          {state.notice === "resend" ? <Notice notice="resend" onDismiss={props.onDismissNotice} /> : null}
          {screen === SIGN_IN_SCREENS.enterCode ? (
            <p style={{ margin: "18px 0 0", fontSize: 15, color: MUTED }}>{ENTER_CODE_COPY.spamHint}</p>
          ) : null}
        </>
      ) : null}

      {screen === SIGN_IN_SCREENS.codeExpired && role !== null ? (
        <>
          <Heading>{CODE_EXPIRED_COPY.heading}</Heading>
          <RoleLine onChooseDifferentRole={props.onChooseDifferentRole} role={role} />
          <ExampleCallout placement="above" />
          <div role="status" style={panelStyle}>
            <svg aria-hidden="true" fill="none" height="22" stroke={AMBER} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" style={{ flexShrink: 0, marginTop: 2 }} viewBox="0 0 24 24" width="22">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>{CODE_EXPIRED_COPY.body}</span>
          </div>
          <button onClick={props.onRequestNewCode} style={{ ...primaryStyle, marginTop: 24 }} type="button">
            {CODE_EXPIRED_COPY.resendLabel}
          </button>
          {state.notice === "resend" ? <Notice notice="resend" onDismiss={props.onDismissNotice} /> : null}
          <button onClick={props.onUseDifferentEmail} style={{ ...linkButtonStyle, marginTop: 22, fontSize: 16 }} type="button">
            {CODE_EXPIRED_COPY.differentEmailLabel}
          </button>
        </>
      ) : null}

      {screen === SIGN_IN_SCREENS.pleaseWait && role !== null ? (
        <>
          <Heading>{PLEASE_WAIT_COPY.heading}</Heading>
          <RoleLine onChooseDifferentRole={props.onChooseDifferentRole} role={role} />
          <ExampleCallout placement="above" />
          <div role="status" style={panelStyle}>
            <svg aria-hidden="true" fill="none" height="22" stroke={AMBER} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" style={{ flexShrink: 0, marginTop: 2 }} viewBox="0 0 24 24" width="22">
              <path d="M12 3l7 3v5c0 4.4-3 8.2-7 10-4-1.8-7-5.6-7-10V6l7-3z" />
            </svg>
            <span>{PLEASE_WAIT_COPY.body}</span>
          </div>
          <form onSubmit={props.onSubmitCode} style={{ ...columnStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ ...columnStyle, marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
              <label htmlFor="sign-in-code" style={fieldLabelStyle}>
                {ENTER_CODE_COPY.codeLabel}
              </label>
              <input
                autoComplete="one-time-code"
                className={INPUT_FOCUS_CLASS}
                id="sign-in-code"
                inputMode="numeric"
                maxLength={CODE_LENGTH}
                onChange={(event) => props.onCodeDraftChange(event.target.value)}
                placeholder={ENTER_CODE_COPY.codePlaceholder}
                style={codeInputStyle}
                type="text"
                value={props.codeDraft}
              />
            </div>
            <button style={{ ...primaryStyle, marginTop: 22 }} type="submit">
              {ENTER_CODE_COPY.verifyLabel}
            </button>
          </form>
          {state.notice === "verify" ? <Notice notice="verify" onDismiss={props.onDismissNotice} /> : null}
          <span style={{ marginTop: 20, fontSize: 16, color: "#8f836f" }}>
            {PLEASE_WAIT_COPY.resendUnavailableLabel}
          </span>
        </>
      ) : null}

      <Footer notice={state.notice} onDismissNotice={props.onDismissNotice} onHelp={() => props.onExplain("help")} withPrivacy={withPrivacy} />
    </main>
  );
}

function CodeIntro({ email }: { email: string }) {
  const parts = enterCodeIntroParts(email);
  return (
    <p style={{ margin: "12px 0 0", width: "100%", maxWidth: 520, fontSize: 18, lineHeight: 1.55, color: SOFT, textAlign: "center" }}>
      {parts.before}
      <span style={{ color: INK }}>{parts.shown}</span>
      {parts.after}
    </p>
  );
}
