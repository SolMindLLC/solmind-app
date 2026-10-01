import "server-only";

// Login step 4: the wording of the email that carries a verification code.
//
// Paul approved this wording on 2026-09-30, so these values are no longer
// placeholders. It is one email for every purpose, in plain ASCII, with the
// code kept out of the subject. The future server composition root injects
// the sender and wording into the delivery transport explicitly; the
// transport has no default and never falls back to these.
//
// Rules any change to this wording must keep:
//   - the code appears in the body only, never in the subject, because
//     subjects show in inbox lists and notification previews. A preview may
//     still show the start of the body, where the code is, so this narrows
//     where the code shows but does not keep it out of every preview;
//   - it stays neutral about purpose (sign-in, contact check, password reset,
//     first Admin setup, invitation before an account exists), so it never
//     implies that an account exists;
//   - every instruction states its reason;
//   - printable ASCII only (sent as 7bit), so curly quotes or other
//     non-ASCII characters need an encoding change first.

// Replaced by the six-digit code. It must appear exactly once, in the body.
export const VERIFICATION_CODE_EMAIL_CODE_TOKEN = "{{code}}" as const;

export type VerificationCodeEmailWording = Readonly<{
  subject: string;
  bodyLines: ReadonlyArray<string>;
}>;

// The sender for now; a real sender comes with a real email provider later.
// The reserved `.invalid` domain is only the From address and does not
// decide where mail goes. The transport's loopback-only host setting does: it
// connects only to 127.0.0.1 or ::1.
export const VERIFICATION_CODE_EMAIL_SENDER =
  "no-reply@solmind.invalid" as const;

// The subject and body, the same for every purpose. The 10-minute lifetime
// matches the challenge expiry in contract section 7.1
// (expires_at = issuance + 10 minutes).
export const VERIFICATION_CODE_EMAIL_WORDING: VerificationCodeEmailWording =
  Object.freeze({
    subject: "Your SolMind code",
    bodyLines: Object.freeze([
      `Your SolMind code is: ${VERIFICATION_CODE_EMAIL_CODE_TOKEN}`,
      "",
      "Enter it on the SolMind screen that asked for it within 10 minutes.",
      "It works only once and then expires, so that an old or copied code",
      "cannot be used later.",
      "",
      "You are getting this email because someone asked SolMind to send a",
      "code to this email address.",
      "",
      "If you did not ask for a code, you can ignore this email. Do not share",
      "the code with anyone, so that nobody else can use it.",
    ]),
  });
