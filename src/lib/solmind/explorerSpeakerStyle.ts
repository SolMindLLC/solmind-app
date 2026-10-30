// Speaker labels and icons for "You" and the Virtual Guide in the conversation
// transcripts of /explorer/compass-comparison (S01R2) and the interim
// /explorer/conversation-preview design review.
//
// TO REVERT: set SPEAKER_LABEL_STYLE to "original". Both screens then render
// exactly today's gold labels and their original badges again. The interim
// screen also has a layout-only "Speaker labels: New / Original" switch so the
// two styles can be compared there; it starts from this constant.
//
// The "logo" style draws both icons from the unchanged supplied logo
// (public/solmind-dark-logo.png, 720 x 520) with CSS only: the Virtual Guide
// icon is the eclipse ring with its centre masked away, and the "You" icon is
// the face inside the ring with the ring cropped away. Every icon is decorative
// (aria-hidden); the visible text label always names the speaker, so colour is
// never the only cue.

export type SpeakerLabelStyle = "logo" | "original";
export type Speaker = "virtualGuide" | "explorer";

export const SPEAKER_LABEL_STYLE: SpeakerLabelStyle = "logo";

// Pixel measurements of public/solmind-dark-logo.png, taken with
// System.Drawing.Bitmap.GetPixel. Kept here so the crop classes below can be
// checked against them.
export const SPEAKER_LOGO_MEASUREMENTS = Object.freeze({
  image: Object.freeze({ width: 720, height: 520 }),
  // Mean of 4,223 solid "Mind" letter pixels (box x 293-552, y 313-392).
  mindColour: "#F57602",
  // Mean of 2,583 solid "Sol" letter pixels (box x 115-269, y 312-392).
  solColour: "#F7F7F7",
  // Bright eclipse ring line: centre (330, 162), radius about 120.
  ringCentre: Object.freeze({ x: 330, y: 162 }),
  ringRadius: 120,
  // Face outline inside the ring (pixels brighter than 80): x 279-377, y 100-263.
  faceBox: Object.freeze({ left: 279, top: 100, right: 377, bottom: 263 }),
  // Square crops, as left, top and side in image pixels.
  ringCrop: Object.freeze({ left: 185, top: 17, size: 290 }),
  faceCrop: Object.freeze({ left: 236, top: 83, size: 184 }),
});

// Label text colours in the "logo" style. The Virtual Guide uses the measured
// "Mind" orange. "You" is the "Sol" white tinted 20% toward that orange: a
// bright warm ivory that is not white and is distinct from the amber gold.
export const SPEAKER_LOGO_COLOURS = Object.freeze({
  virtualGuide: "#F57602",
  explorer: "#F7DDC6",
});

// Today's label colour on both screens.
const ORIGINAL_LABEL_CLASS = "text-amber-200";

const LOGO_LABEL_CLASS: Readonly<Record<Speaker, string>> = Object.freeze({
  virtualGuide: "text-[#F57602]",
  explorer: "text-[#F7DDC6]",
});

// Background crop: size = image / crop, position = crop offset / (image - crop).
// Ring: 720/290, 520/290, 185/430, 17/230. Face: 720/184, 520/184, 236/536, 83/336.
const LOGO_ICON_BASE =
  "inline-block shrink-0 rounded-full bg-black bg-no-repeat [background-image:url(/solmind-dark-logo.png)]";

export const SPEAKER_LOGO_ICON_CLASS: Readonly<Record<Speaker, string>> = Object.freeze({
  // The eclipse ring only: the centre (and the face in it) is masked away.
  virtualGuide: `${LOGO_ICON_BASE} [background-size:248.2759%_179.3103%] [background-position:43.0233%_7.3913%] [mask-image:radial-gradient(circle_closest-side,transparent_70%,#000_77%,#000_90%,transparent_100%)]`,
  // The face only: a circular crop inside the ring, softened at its edge.
  explorer: `${LOGO_ICON_BASE} [background-size:391.3043%_282.6087%] [background-position:44.0299%_24.7024%] [mask-image:radial-gradient(circle_closest-side,#000_84%,transparent_100%)]`,
});

export function speakerLabelClass(style: SpeakerLabelStyle, speaker: Speaker): string {
  return style === "logo" ? LOGO_LABEL_CLASS[speaker] : ORIGINAL_LABEL_CLASS;
}
