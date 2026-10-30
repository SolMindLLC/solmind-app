import { SPEAKER_LOGO_TEXT_CLASS, type Speaker } from "@/lib/solmind/explorerSpeakerStyle";

// The two small speaker icons of the "logo" speaker-label style, shared by
// /explorer/compass-comparison and /explorer/conversation-preview. They are
// drawn for 24 and 36 CSS pixels (Paul, 2026-10-30): crops of the logo picture
// did not look good when shrunken, and the first redrawn face read as a turkey.
// Both take the speaker's colour from currentColor (SPEAKER_LOGO_TEXT_CLASS).
// Soft glows and fades are stacked low-opacity shapes, so the SVG needs no ids
// and many copies can share a page. Decorative: the visible label beside each
// icon names the speaker.

const ICON_SIZE = { small: "h-6 w-6", large: "h-9 w-9" } as const;
const BODY = "#0A0705";

type SpeakerIconProps = Readonly<{ speaker: Speaker; size?: keyof typeof ICON_SIZE }>;

export function SpeakerIcon({ speaker, size = "small" }: SpeakerIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`${ICON_SIZE[size]} shrink-0 ${SPEAKER_LOGO_TEXT_CLASS[speaker]}`}
      data-speaker-icon={speaker}
      focusable="false"
      viewBox="0 0 24 24"
    >
      {speaker === "virtualGuide" ? <VirtualGuideShapes /> : <ExplorerShapes />}
    </svg>
  );
}

// Virtual Guide: the logo's eclipse. A dark disc in an orange ring whose inner
// edge is gold, brighter beside the flare. The flare at the upper right is a
// white-hot point in a soft glow, with fine rays that fade from white through
// gold to orange toward their tips.
function VirtualGuideShapes() {
  return (
    <>
      <circle cx="12" cy="12" fill="none" opacity=".2" r="9" stroke="currentColor" strokeWidth="3" />
      <circle cx="12" cy="12" fill={BODY} r="7" stroke="none" />
      <circle cx="12" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" fill="none" r="7.5" stroke="#FDB64A" strokeWidth="1" />
      <path d="M14.57 4.95A7.5 7.5 0 0 1 19.05 9.43" fill="none" opacity=".7" stroke="#FFE7B0" strokeLinecap="round" strokeWidth="1" />
      <g fill="none" stroke="none">
        <circle cx="17.5" cy="6.5" fill="currentColor" opacity=".08" r="5" />
        <circle cx="17.5" cy="6.5" fill="#FFB347" opacity=".12" r="3.4" />
        <circle cx="17.5" cy="6.5" fill="#FFC861" opacity=".16" r="2.7" />
        <circle cx="17.5" cy="6.5" fill="#FFD98A" opacity=".24" r="2.1" />
        <circle cx="17.5" cy="6.5" fill="#FFE9B0" opacity=".38" r="1.75" />
        <path d="M12.7 6.5L17.5 5.85L23.9 6.5L17.5 7.15ZM17.5 .1L18.15 6.5L17.5 11.3L16.85 6.5Z" fill="currentColor" opacity=".75" />
        <path d="M13.7 6.5L17.5 5.78L23.4 6.5L17.5 7.22ZM17.5 .6L18.22 6.5L17.5 10.3L16.78 6.5Z" fill="#FFC861" opacity=".85" />
        <path d="M13.7 6.5L17.5 5.7L22.2 6.5L17.5 7.3ZM17.5 1.8L18.3 6.5L17.5 10.3L16.7 6.5Z" fill="#FFF3D0" />
        <g fill="none" transform="rotate(45 17.5 6.5)">
          <path d="M13.7 6.5L17.5 6.1L21.3 6.5L17.5 6.9ZM17.5 2.7L17.9 6.5L17.5 10.3L17.1 6.5Z" fill="currentColor" opacity=".6" />
          <path d="M14.7 6.5L17.5 6.02L20.3 6.5L17.5 6.98ZM17.5 3.7L17.98 6.5L17.5 9.3L17.02 6.5Z" fill="#FFD27A" opacity=".85" />
        </g>
        <circle cx="17.5" cy="6.5" fill="#FFF8E6" opacity=".7" r="1.65" />
        <circle cx="17.5" cy="6.5" fill="#FFFFFF" r="1.25" />
      </g>
    </>
  );
}

// You: a person in profile looking up and to the right, like the face in the
// logo: a raised chin, a calm mouth and a long throat. The back of the head
// fades into the dark in stacked steps.
function ExplorerShapes() {
  return (
    <>
      <g fill="currentColor" opacity=".9" transform="translate(2 0)">
        <path d="M9.4 1.3C6.4 1.3 3.6 4.6 3.7 11C3.8 17.4 5.6 16.8 5 19.2C4.4 21.6 2.4 22.2 1.6 23.8L11 23.8Z" fill="currentColor" opacity=".14" />
        <path d="M9.4 1.3C6.71 1.31 4.18 4.67 4.28 10.92C4.38 17.16 6.14 16.75 5.63 19.11C5.11 21.48 3.23 22.22 2.52 23.8L11 23.8Z" fill="currentColor" opacity=".17" />
        <path d="M9.4 1.3C6.99 1.32 4.72 4.73 4.82 10.84C4.92 16.94 6.66 16.7 6.22 19.04C5.79 21.37 4.02 22.23 3.38 23.8L11 23.8Z" fill="currentColor" opacity=".2" />
        <path d="M9.4 1.3C7.3 1.33 5.3 4.8 5.4 10.75C5.5 16.7 7.2 16.65 6.85 18.95C6.5 21.25 4.85 22.25 4.3 23.8L11 23.8Z" fill="currentColor" opacity=".25" />
        <path d="M9.4 1.3C7.61 1.33 5.88 4.87 5.98 10.67C6.08 16.46 7.74 16.6 7.48 18.86C7.21 21.13 5.68 22.27 5.22 23.8L11 23.8Z" fill="currentColor" opacity=".33" />
        <path d="M9.4 1.3C7.89 1.34 6.42 4.93 6.52 10.59C6.62 16.24 8.26 16.55 8.07 18.79C7.89 21.02 6.47 22.28 6.08 23.8L11 23.8Z" fill="currentColor" opacity=".5" />
        <path d="M9.4 1.3C10.7 1.2 11.7 1.9 12.4 2.9C12.8 3.5 13 4 13.25 4.4C13.45 4.75 13.65 5.05 14 5.25C14.8 5.65 16 5.95 16.8 6.55C17.05 6.9 16.7 7.35 16.3 7.65C16.6 8.1 16.95 8.8 16.95 9.5C16.95 10.1 16.85 10.5 17.05 11C17.4 11.7 17.8 12.3 17.75 13C17.7 13.7 17 14.2 16 14.8C14.6 15.7 13.4 17.6 13.25 20.8C14.5 21.5 16.6 22 17.2 23.8L7 23.8C7.3 22.3 8.6 20.9 8.7 18.7C8.8 16.5 7.2 16 7.1 10.5C7 5 8.2 1.35 9.4 1.3Z" fill="currentColor" />
      </g>
    </>
  );
}
