import { SPEAKER_STYLE_SWITCH_LABEL } from "@/lib/solmind/explorerConversationScreen";
import type { ScreenSpeaker } from "@/lib/solmind/explorerConversationScreenDisplay";
import type { SpeakerLabelStyle } from "@/lib/solmind/explorerSpeakerStyle";

import { IconBoot, IconHand } from "./ExplorerConversationScreenIcons";
import { FOCUS_RING, LayoutOnlyTag, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";
import { SpeakerIcon } from "./ExplorerSpeakerIcon";

// Speaker badges for the interim screen. "logo" shows the shared small icons
// drawn in ExplorerSpeakerIcon.tsx; "original" keeps the hand and boot badges
// exactly as before. Badges are decorative: the visible label beside each one
// names the speaker.

const BADGE_SIZE = { small: "h-6 w-6", large: "h-9 w-9" } as const;
const GLYPH_SIZE = { small: "h-3.5 w-3.5", large: "h-5 w-5" } as const;

type SpeakerBadgeProps = Readonly<{
  speaker: ScreenSpeaker;
  speakerStyle: SpeakerLabelStyle;
  size?: keyof typeof BADGE_SIZE;
}>;

export function SpeakerBadge({ speaker, speakerStyle, size = "small" }: SpeakerBadgeProps) {
  if (speakerStyle === "logo") return <SpeakerIcon size={size} speaker={speaker} />;

  return (
    <span
      aria-hidden="true"
      className={joinClasses(
        "grid",
        BADGE_SIZE[size],
        "shrink-0 place-items-center rounded-full border",
        speaker === "virtualGuide"
          ? "border-amber-300/60 bg-amber-300/10 text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)]"
          : "border-stone-500 bg-stone-800 text-stone-100",
      )}
    >
      {speaker === "virtualGuide" ? <IconHand className={GLYPH_SIZE[size]} /> : <IconBoot className={GLYPH_SIZE[size]} />}
    </span>
  );
}

const SWITCH_LABEL_ID = "conversation-preview-speaker-style-label";
const OPTIONS: readonly { value: SpeakerLabelStyle; label: string }[] = [
  { value: "logo", label: "New" },
  { value: "original", label: "Original" },
];

type SwitchProps = Readonly<{
  speakerStyle: SpeakerLabelStyle;
  onChange: (style: SpeakerLabelStyle) => void;
}>;

// Layout only: compares the new speaker labels with the original ones here.
export function SpeakerStyleSwitch({ speakerStyle, onChange }: SwitchProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div aria-labelledby={SWITCH_LABEL_ID} className="flex flex-wrap items-center gap-1.5" role="group">
        <span className="text-xs font-semibold text-stone-200" id={SWITCH_LABEL_ID}>
          {SPEAKER_STYLE_SWITCH_LABEL}
        </span>
        {OPTIONS.map((option) => (
          <button
            aria-pressed={speakerStyle === option.value}
            className={joinClasses(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              speakerStyle === option.value
                ? "border-amber-300/70 bg-amber-300/15 text-amber-100"
                : "border-stone-600 text-stone-300 hover:border-amber-300/50",
              FOCUS_RING,
            )}
            data-preview-control="layout"
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <LayoutOnlyTag />
    </div>
  );
}
