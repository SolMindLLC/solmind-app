// Speaker labels and icons for "You" and the Virtual Guide in the conversation
// transcripts of /explorer/compass-comparison (S01R2) and the interim
// /explorer/conversation-preview design review.
//
// TO REVERT: set SPEAKER_LABEL_STYLE to "original". Both screens then render
// exactly the earlier gold labels and their original badges again. The interim
// screen also has a layout-only "Speaker labels: New / Original" switch so the
// two styles can be compared there; it starts from this constant.
//
// The "logo" style (Paul's 2026-10-29 speaker-label trial, revised on
// 2026-10-30) colours the Virtual Guide label with the logo's "Mind" orange
// and "You" with a soft sky blue, the orange's complement. Its two small icons
// are drawn for 24 and 36 CSS pixels in
// src/components/solmind/ExplorerSpeakerIcon.tsx and take the same colours.
// Every icon is decorative (aria-hidden); the visible text label always names
// the speaker, so colour is never the only cue.

export type SpeakerLabelStyle = "logo" | "original";
export type Speaker = "virtualGuide" | "explorer";

export const SPEAKER_LABEL_STYLE: SpeakerLabelStyle = "logo";

// Mean of 4,223 solid "Mind" letter pixels in public/solmind-dark-logo.png
// (box x 293-552, y 313-392), measured with System.Drawing.Bitmap.GetPixel.
export const SPEAKER_LOGO_MIND_ORANGE = "#F57602";

// Label and icon colours in the "logo" style.
export const SPEAKER_LOGO_COLOURS = Object.freeze({
  virtualGuide: SPEAKER_LOGO_MIND_ORANGE,
  explorer: "#8BC6EE",
});

// The earlier label colour on both screens.
const ORIGINAL_LABEL_CLASS = "text-amber-200";

// Written out in full so Tailwind generates them; a test checks they match
// SPEAKER_LOGO_COLOURS.
export const SPEAKER_LOGO_TEXT_CLASS: Readonly<Record<Speaker, string>> = Object.freeze({
  virtualGuide: "text-[#F57602]",
  explorer: "text-[#8BC6EE]",
});

export function speakerLabelClass(style: SpeakerLabelStyle, speaker: Speaker): string {
  return style === "logo" ? SPEAKER_LOGO_TEXT_CLASS[speaker] : ORIGINAL_LABEL_CLASS;
}
