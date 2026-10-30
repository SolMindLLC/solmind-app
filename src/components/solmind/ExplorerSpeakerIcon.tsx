import { SPEAKER_LOGO_TEXT_CLASS, type Speaker } from "@/lib/solmind/explorerSpeakerStyle";

// The two small speaker icons of the "logo" speaker-label style, shared by
// /explorer/compass-comparison and /explorer/conversation-preview. They are
// drawn for 24 and 36 CSS pixels, because crops of the logo picture did not
// look good when shrunken (Paul, 2026-10-30). Both are built the same way as
// the logo: a warm-black body lit by a bright 2-unit edge in the speaker's
// colour (currentColor, set from SPEAKER_LOGO_TEXT_CLASS) with a faint halo.
// Edges sit on whole pixels at 24 px. Inline SVG with no ids, so many copies
// can share a page. Decorative: the visible label beside each icon names the
// speaker.

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
// edge is gold (the logo's corona), with a bright four-point flare at the
// upper right.
function VirtualGuideShapes() {
  return (
    <>
      <circle cx="12" cy="12" fill="none" opacity={0.2} r="9" stroke="currentColor" strokeWidth={3} />
      <circle cx="12" cy="12" fill={BODY} r="7" stroke="none" />
      <circle cx="12" cy="12" fill="none" r="8" stroke="currentColor" strokeWidth={2} />
      <circle cx="12" cy="12" fill="none" r="7.5" stroke="#FDB64A" strokeWidth={1} />
      <g stroke="none">
        <circle cx="17.5" cy="6.5" fill="#FFD27A" opacity={0.3} r="3.4" />
        <path d="M17.5 .7L19 5L23.3 6.5L19 8L17.5 12.3L16 8L11.7 6.5L16 5Z" fill="#FFF1C4" />
        <circle cx="17.5" cy="6.5" fill="#FFFDF5" r="1.6" />
      </g>
    </>
  );
}

// You: a right-facing profile, like the face inside the logo: forehead, nose,
// one mouth notch and a chin curving into the neck.
const PROFILE =
  "M8 21.8C8 20.3 7.6 19.1 6.7 18C5.1 16.1 4 14 4 11.3C4 6.5 7.6 3 12.2 3C15.9 3 18 5.2 18 8.3L17.8 9.3" +
  "L21 12.9C21.3 13.3 21 13.9 20.4 13.9L17.4 15.4L19.4 16.8C19.9 17.5 19.5 19 18.4 19.3C16.2 19.8 15 20.2 15 21.8";

function ExplorerShapes() {
  return (
    <>
      <path
        d={PROFILE}
        fill="none"
        opacity={0.2}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3.8}
      />
      <path d={PROFILE} fill={BODY} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </>
  );
}
