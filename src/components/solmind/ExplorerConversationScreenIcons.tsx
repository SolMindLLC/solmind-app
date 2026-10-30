import type { ReactNode } from "react";

// Decorative line icons for the interim conversation screen, adapted from the
// S01R2 design. Every icon is hidden from assistive technology; each control
// that shows one also carries visible text or its own accessible name.

type IconProps = Readonly<{ className?: string }>;

function Svg({ children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={["h-4 w-4 shrink-0", className].filter(Boolean).join(" ")}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return <Svg {...props}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>;
}

export function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </Svg>
  );
}

export function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </Svg>
  );
}

export function IconBell(props: IconProps) {
  return <Svg {...props}><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></Svg>;
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.8 3 6" />
    </Svg>
  );
}

// Hiking boot for the Explorer (screen book, speaker badges).
export function IconBoot(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3h6v7l5 2.5a3 3 0 0 1 2 2.8V18H4V13l3-1V3Z" />
      <path d="M4 18v2h16v-2M9 7h4M9 10h4" />
    </Svg>
  );
}

// Helping hand for the Virtual Guide (screen book, speaker badges).
export function IconHand(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 14h3l4 3h5a2 2 0 0 0 0-4h-4" />
      <path d="M11 13h4l4.5-2.5a1.6 1.6 0 0 1 1.8 2.6L16 18H9l-3 2H3" />
      <path d="M12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    </Svg>
  );
}

export function IconPanelRight(props: IconProps) {
  return <Svg {...props}><rect height="16" rx="2" width="18" x="3" y="4" /><path d="M15 4v16" /></Svg>;
}

export function IconEye(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconEyeOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <path d="M4 4l16 16" />
    </Svg>
  );
}

export function IconCompass(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Svg>;
}

export function IconCheck(props: IconProps) {
  return <Svg {...props}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;
}

export function IconDashedCircle(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="8" strokeDasharray="3 3" /></Svg>;
}

export function IconLightbulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </Svg>
  );
}

export function IconPause(props: IconProps) {
  return <Svg {...props}><path d="M9 5v14M15 5v14" /></Svg>;
}

export function IconClipboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="17" rx="2" width="12" x="6" y="4" />
      <path d="M9 3.5h6V7H9z" />
      <path d="m9 13 2 2 4-4" />
    </Svg>
  );
}

export function IconArrowUp(props: IconProps) {
  return <Svg {...props}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
}

export function IconClose(props: IconProps) {
  return <Svg {...props}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
}

export function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </Svg>
  );
}

export function IconFlag(props: IconProps) {
  return <Svg {...props}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></Svg>;
}

export function IconHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </Svg>
  );
}
