import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import {
  ACTIVE_PRIMARY_DESTINATION,
  ASSIGNED_GUIDE_LABEL,
  ASSIGNED_GUIDE_NAME,
  COMPOSER_MESSAGE_MAX_LENGTH,
  CONVERSATION_SHARING_EXPLANATION,
  CONVERSATION_SPACES,
  EXPLORER_DISPLAY_NAME,
  FOLLOW_UP_CHOICES,
  FOLLOW_UP_SOMETHING_ELSE_CHOICE,
  JOURNEY_HEADING_ID,
  JOURNEY_KIND_LABEL,
  JOURNEY_STARTING_QUESTION,
  JOURNEY_TITLE,
  MIDDLE_DOT,
  NEW_CONVERSATION_CONFIRMATION_COPY,
  NOT_CONNECTED_DESTINATIONS,
  NOT_CONNECTED_LABEL,
  OPENING_SOMETHING_ELSE_CHOICE,
  OPENING_TOPIC_CHOICES,
  POSSIBLE_NEXT_WAYPOINT,
  POTENTIAL_ARRIVAL,
  PRIMARY_NAVIGATION,
  PROTOTYPE_DISCLOSURE,
  RESET_CONFIRMATION_COPY,
  SOLMIND_LOGO_SRC,
  VERIFICATION_ANSWER_LABELS,
  VIRTUAL_GUIDE_NAME_MAX_LENGTH,
  WAYPOINT_DETAILS,
  WAYPOINT_DETAIL_KIND_LABELS,
  WAYPOINT_SHARING_EXPLANATION,
  describeComposerError,
  formatWaypointCounts,
  getCompactOrientations,
  getCompassDescription,
  getCompassLayout,
  getCompassPath,
  getJourneyStatusLabel,
  getJourneySummary,
  getOpenVerificationTurn,
  getPriorityDisplay,
  getQuotationSharingExplanation,
  getQuotationsForDetail,
  getSpeakerLabel,
  getVirtualGuidePrimaryLabel,
  getVirtualGuideTurnLabel,
  getWaypointCounts,
  quotationElementId,
  turnElementId,
  type ComposerError,
  type ComposerPrompt,
  type CompassLayoutItem,
  type CompassPathId,
  type CompassZone,
  type ConversationChoice,
  type ConversationChoiceId,
  type ConversationSpaceId,
  type ConversationTurn,
  type ExplorerConversationState,
  type JourneyPhase,
  type PrimaryDestinationId,
  type PrototypeDialog,
  type QuotationId,
  type SupportingQuotation,
  type VerificationAnswer,
  type WaypointDetail,
  type WaypointDetailId,
  type WaypointDetailState,
  type WorkspaceView,
} from "@/lib/solmind/explorerCompassComparison";
import { SOLMIND_TERMS } from "@/lib/solmind/terms";

// ---------------------------------------------------------------------------
// Element identifiers and shared class names
// ---------------------------------------------------------------------------

export const COMPOSER_ID = "journey-composer";
export const COMPOSER_HINT_ID = "journey-composer-hint";
export const COMPOSER_ERROR_ID = "journey-composer-error";
export const PAUSE_HEADING_ID = "journey-paused-heading";
export const REVIEW_HEADING_ID = "journey-review-heading";
export const SUMMARY_HEADING_ID = "journey-summary-heading";
export const CONVERSATIONS_HEADING_ID = "conversations-heading";
export const MENU_BUTTON_ID = "explorer-menu-button";
export const MOBILE_NAVIGATION_ID = "explorer-mobile-navigation";
export const PANEL_TOGGLE_ID = "compass-waypoint-toggle";
export const SUPPORT_PANEL_ID = "compass-waypoint-panel";
export const SUPPORT_PANEL_HEADING_ID = "compass-waypoint-panel-heading";
export const SUPPORT_DRAWER_ID = "compass-waypoint-drawer";
export const SUPPORT_DRAWER_HEADING_ID = "compass-waypoint-drawer-heading";
export const RENAME_TOGGLE_ID = "virtual-guide-rename-toggle";
export const RENAME_FORM_ID = "virtual-guide-rename-form";
export const RENAME_INPUT_ID = "virtual-guide-name-input";
export const PRIORITY_STATUS_ID = "compass-priority-status";
export const PRIORITY_QUESTION_ID = "compass-priority-question";
export const DIALOG_TITLE_ID = "prototype-dialog-title";
export const DIALOG_BODY_ID = "prototype-dialog-body";
export const DIALOG_INITIAL_FOCUS_ID = "prototype-dialog-initial-focus";

const COMPASS_TITLE_ID = "compass-section-title";
const COMPASS_VIEW_ID = "compass-view-region";
const COMPASS_PATHS_LABEL_ID = "compass-paths-label";
const COMPASS_DIAL_TITLE_ID = "compass-dial-title";
const COMPASS_DIAL_DESC_ID = "compass-dial-description";
const WAYPOINT_TITLE_ID = "waypoint-section-title";
const GUIDE_BANNER_TITLE_ID = "guide-continuity-title";

export function joinClasses(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const PRIMARY_BUTTON = joinClasses(
  BUTTON_BASE,
  "bg-amber-400 px-5 py-2.5 text-stone-950 shadow-[0_0_22px_rgba(251,146,60,0.28)] hover:bg-amber-300 disabled:hover:bg-amber-400",
  FOCUS_RING,
);

export const SECONDARY_BUTTON = joinClasses(
  BUTTON_BASE,
  "border border-amber-200/25 bg-white/[0.03] px-4 py-2 text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10 disabled:hover:border-amber-200/25 disabled:hover:bg-white/[0.03]",
  FOCUS_RING,
);

export const QUIET_BUTTON = joinClasses(
  BUTTON_BASE,
  "px-3 py-1.5 font-medium text-amber-200 hover:bg-amber-300/10 disabled:hover:bg-transparent",
  FOCUS_RING,
);

const NOT_CONNECTED_TAG =
  "rounded-full border border-stone-600 px-2 py-0.5 text-[11px] font-medium text-stone-300";

export function getInactiveHint(phase: JourneyPhase): string | null {
  switch (phase) {
    case "active":
      return null;
    case "paused":
      return "The journey is paused. Resume it to make changes.";
    case "reviewing":
      return "Final review is open. Return to the conversation to make changes.";
    case "finished":
      return "This journey is finished on this screen.";
  }
}

// ---------------------------------------------------------------------------
// Icons (decorative; every control also carries text)
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function Svg({
  children,
  className,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={joinClasses("h-4 w-4 shrink-0", className)}
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

export function IconMenu(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Svg>
  );
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

export function IconPanelRight(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M15 4v16" />
    </Svg>
  );
}

function IconChat(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
    </Svg>
  );
}

function IconCompass(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </Svg>
  );
}

function IconFlag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </Svg>
  );
}

function IconGear(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </Svg>
  );
}

function IconOverview(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Svg>
  );
}

function IconMapPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </Svg>
  );
}

function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.8 3 6" />
    </Svg>
  );
}

function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}

function IconDashedCircle(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    </Svg>
  );
}

function IconLightbulb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </Svg>
  );
}

function IconPause(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5v14M15 5v14" />
    </Svg>
  );
}

function IconClipboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="17" rx="2" width="12" x="6" y="4" />
      <path d="M9 3.5h6V7H9z" />
      <path d="m9 13 2 2 4-4" />
    </Svg>
  );
}

function IconArrowUp(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

function IconClose(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

function IconQuote(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6" />
    </Svg>
  );
}

function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect height="10" rx="2" width="14" x="5" y="11" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </Svg>
  );
}

function IconHistory(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </Svg>
  );
}

function IconReset(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 12a8 8 0 1 0 2.3-5.7" />
      <path d="M4 4v4h4" />
    </Svg>
  );
}

function NavigationIcon({
  destinationId,
}: {
  destinationId: PrimaryDestinationId;
}) {
  const className = "mt-0.5 h-5 w-5";

  switch (destinationId) {
    case "overview":
      return <IconOverview className={className} />;
    case "conversations":
      return <IconChat className={className} />;
    case "waypoints":
      return <IconMapPin className={className} />;
    case "settings":
      return <IconGear className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Brand and shell
// ---------------------------------------------------------------------------

// The exact supplied dark logo asset, served unchanged from /public.
export function SolMindLogo({ className }: { className?: string }) {
  return (
    <Image
      alt="SolMind: Illuminate, Understand, Grow"
      className={joinClasses("h-auto", className)}
      height={520}
      loading="eager"
      src={SOLMIND_LOGO_SRC}
      unoptimized
      width={720}
    />
  );
}

export function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_0%,_rgba(245,158,11,0.12),_transparent_38%),radial-gradient(circle_at_6%_94%,_rgba(234,88,12,0.14),_transparent_28%),radial-gradient(circle_at_96%_40%,_rgba(180,83,9,0.07),_transparent_30%),linear-gradient(180deg,_#080605,_#030303)]"
    />
  );
}

type PrimaryNavigationProps = {
  id?: string;
  label: string;
  className?: string;
  view: WorkspaceView;
  onPrimary: (destinationId: PrimaryDestinationId) => void;
  onSpace: (spaceId: ConversationSpaceId) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

export function PrimaryNavigation({
  id,
  label,
  className,
  view,
  onPrimary,
  onSpace,
  onKeyDown,
}: PrimaryNavigationProps) {
  return (
    <nav aria-label={label} className={className} id={id} onKeyDown={onKeyDown}>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
        Workspace
      </p>
      <ul className="mt-2 grid gap-1">
        {PRIMARY_NAVIGATION.map((item) => {
          const isActive = item.id === ACTIVE_PRIMARY_DESTINATION;

          return (
            <li key={item.id}>
              <button
                aria-current={isActive && view === "conversations" ? "page" : undefined}
                className={joinClasses(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  isActive
                    ? "border-amber-300/25 bg-amber-300/10 font-semibold text-amber-200"
                    : "border-transparent text-stone-300 hover:border-amber-200/15 hover:bg-white/[0.03] hover:text-stone-100",
                  FOCUS_RING,
                )}
                onClick={() => onPrimary(item.id)}
                type="button"
              >
                <NavigationIcon destinationId={item.id} />
                <span className="flex min-w-0 flex-col">
                  <span>{item.label}</span>
                  {item.connection === "notConnected" ? (
                    <span className="text-[11px] font-normal text-stone-400">
                      {NOT_CONNECTED_LABEL}
                    </span>
                  ) : null}
                  {isActive && view === "journey" ? (
                    <span className="sr-only">(current section)</span>
                  ) : null}
                </span>
              </button>
              {isActive ? (
                <ul
                  aria-label="Conversation spaces"
                  className="ml-6 mt-1 grid gap-1 border-l border-amber-200/15 pl-3"
                >
                  {CONVERSATION_SPACES.map((space) => {
                    const isCurrent =
                      space.id === "virtualGuide" && view === "journey";

                    return (
                      <li key={space.id}>
                        <button
                          aria-current={isCurrent ? "page" : undefined}
                          className={joinClasses(
                            "flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm transition-colors",
                            isCurrent
                              ? "bg-amber-300/10 text-amber-100"
                              : "text-stone-300 hover:bg-white/[0.03] hover:text-stone-100",
                            FOCUS_RING,
                          )}
                          onClick={() => onSpace(space.id)}
                          type="button"
                        >
                          <span className="font-medium">{space.label}</span>
                          <span className="text-[11px] text-stone-400">
                            {space.connection === "notConnected"
                              ? NOT_CONNECTED_LABEL
                              : space.description}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function YourSpaceCard({ className }: { className?: string }) {
  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-2xl border border-amber-300/20 bg-[#0b0907] p-4",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(251,146,60,0.32),_transparent_70%)]"
      />
      <p className="relative flex items-center gap-2 text-sm font-semibold text-amber-300">
        <IconLock />
        This is your space.
      </p>
      <p className="relative mt-2 text-xs leading-5 text-stone-300">
        This conversation is private to you. {ASSIGNED_GUIDE_NAME} cannot see it,
        and nothing on this screen is saved.
      </p>
    </div>
  );
}

type UtilityBarProps = {
  view: WorkspaceView;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onAbout: () => void;
  onReset: () => void;
  onNotifications: () => void;
  onProfile: () => void;
};

export function UtilityBar({
  view,
  menuOpen,
  onToggleMenu,
  onAbout,
  onReset,
  onNotifications,
  onProfile,
}: UtilityBarProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200/10 bg-black/70 px-3 py-2.5 sm:px-6 lg:px-8">
      <button
        aria-controls={MOBILE_NAVIGATION_ID}
        aria-expanded={menuOpen}
        className={joinClasses(
          BUTTON_BASE,
          "border border-amber-200/25 bg-white/[0.03] px-3 py-2 text-stone-100 hover:border-amber-300/60 hover:bg-amber-300/10 lg:hidden",
          FOCUS_RING,
        )}
        id={MENU_BUTTON_ID}
        onClick={onToggleMenu}
        type="button"
      >
        {menuOpen ? <IconClose /> : <IconMenu />}
        Menu
      </button>
      <SolMindLogo className="w-20 lg:hidden" />
      <p className="hidden text-sm text-stone-400 lg:block">
        Conversations <span aria-hidden="true">/</span>{" "}
        <span className="text-stone-200">
          {view === "journey" ? "With your Virtual Guide" : "All conversations"}
        </span>
      </p>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <button className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} onClick={onAbout} type="button">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Prototype
          <span className="sr-only"> - about this fixed local prototype</span>
        </button>
        <button className={SECONDARY_BUTTON} onClick={onReset} type="button">
          <IconReset />
          Reset prototype
        </button>
        <button
          aria-label={`Notifications (${NOT_CONNECTED_LABEL.toLowerCase()})`}
          className={joinClasses(
            "grid h-10 w-10 place-items-center rounded-full border border-amber-200/20 text-amber-200 transition-colors hover:bg-amber-300/10",
            FOCUS_RING,
          )}
          onClick={onNotifications}
          type="button"
        >
          <IconBell className="h-5 w-5" />
        </button>
        <button
          className={joinClasses(
            "flex items-center gap-2 rounded-full border border-amber-200/20 py-1 pl-1 pr-1 text-left transition-colors hover:bg-amber-300/10 sm:pr-3",
            FOCUS_RING,
          )}
          onClick={onProfile}
          type="button"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 font-serif text-sm text-amber-100"
          >
            {EXPLORER_DISPLAY_NAME.charAt(0)}
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-medium text-stone-100">
              {EXPLORER_DISPLAY_NAME}
            </span>
            <span className="text-[11px] text-stone-400">
              {SOLMIND_TERMS.explorerRole}
            </span>
          </span>
          <span className="sr-only sm:hidden">
            {EXPLORER_DISPLAY_NAME}, {SOLMIND_TERMS.explorerRole}
          </span>
          <span className="sr-only">
            {" "}
            profile ({NOT_CONNECTED_LABEL.toLowerCase()})
          </span>
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Virtual Guide identity and conversation header
// ---------------------------------------------------------------------------

type VirtualGuideIdentityProps = {
  name: string;
  renameDraft: string | null;
  onToggleRename: () => void;
  onDraftChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export function VirtualGuideIdentity({
  name,
  renameDraft,
  onToggleRename,
  onDraftChange,
  onSave,
  onCancel,
}: VirtualGuideIdentityProps) {
  const isRenaming = renameDraft !== null;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <VirtualGuideAvatar large />
        <p className="font-serif text-lg text-stone-50 sm:text-xl">
          {getVirtualGuidePrimaryLabel(name)}
        </p>
        <button
          aria-controls={RENAME_FORM_ID}
          aria-expanded={isRenaming}
          className={QUIET_BUTTON}
          id={RENAME_TOGGLE_ID}
          onClick={onToggleRename}
          type="button"
        >
          Rename
        </button>
      </div>
      {renameDraft !== null ? (
        <form
          className="mt-3 grid max-w-md gap-2 rounded-2xl border border-amber-200/15 bg-black/40 p-3"
          id={RENAME_FORM_ID}
          noValidate
          onSubmit={onSave}
        >
          <label className="text-sm font-semibold text-stone-100" htmlFor={RENAME_INPUT_ID}>
            Virtual Guide name
          </label>
          <input
            aria-describedby={`${RENAME_INPUT_ID}-hint`}
            className={joinClasses(
              "rounded-xl border border-stone-600 bg-black/60 px-3 py-2 text-sm text-stone-50 placeholder:text-stone-400 focus:border-amber-300",
              FOCUS_RING,
            )}
            id={RENAME_INPUT_ID}
            maxLength={VIRTUAL_GUIDE_NAME_MAX_LENGTH}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder={SOLMIND_TERMS.virtualGuide}
            type="text"
            value={renameDraft}
          />
          <p className="text-xs text-stone-400" id={`${RENAME_INPUT_ID}-hint`}>
            Leave it blank to use {SOLMIND_TERMS.virtualGuide}. The name lasts
            only on this screen.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={PRIMARY_BUTTON} type="submit">
              Save name
            </button>
            <button className={SECONDARY_BUTTON} onClick={onCancel} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function VirtualGuideAvatar({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={joinClasses(
        "grid shrink-0 place-items-center rounded-full border border-amber-300/60 bg-amber-300/10 font-semibold tracking-wide text-amber-100 shadow-[0_0_14px_rgba(245,158,11,0.25)]",
        large ? "h-9 w-9 text-[11px]" : "h-6 w-6 text-[9px]",
      )}
    >
      VG
    </span>
  );
}

function ExplorerAvatar() {
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-500 bg-stone-800 font-serif text-[11px] text-stone-100"
    >
      {EXPLORER_DISPLAY_NAME.charAt(0)}
    </span>
  );
}

type ConversationHeaderProps = {
  state: ExplorerConversationState;
  onShareConversation: () => void;
};

export function ConversationHeader({
  state,
  onShareConversation,
}: ConversationHeaderProps) {
  return (
    <header className="border-b border-amber-200/10 px-4 py-3 sm:px-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
        {state.waypointStatus === "none"
          ? "Open conversation"
          : "Waypoint conversation"}{" "}
        &middot; with your Virtual Guide
      </p>
      <h1
        className={joinClasses(
          "mt-1 rounded-md font-serif text-2xl leading-tight text-stone-50 sm:text-3xl",
          FOCUS_RING,
        )}
        id={JOURNEY_HEADING_ID}
        tabIndex={-1}
      >
        {state.conversationKind === "openEnded" ? "New conversation" : JOURNEY_TITLE}
      </h1>
      <p className="mt-1 text-sm text-stone-400">
        {state.waypointStatus === "none"
          ? "No Waypoint chosen yet"
          : JOURNEY_KIND_LABEL}{" "}
        &middot; Started from: {JOURNEY_STARTING_QUESTION}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600 bg-black/30 px-3 py-1 text-xs font-semibold text-stone-200">
          <IconEyeOff className="h-3.5 w-3.5" />
          Private conversation
        </span>
        <button
          className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")}
          onClick={onShareConversation}
          type="button"
        >
          <IconEye />
          Share whole conversation
          <span className={NOT_CONNECTED_TAG}>{NOT_CONNECTED_LABEL}</span>
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-400">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
          {getJourneyStatusLabel(state)}
        </span>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Conversation turns
// ---------------------------------------------------------------------------

export function ActivityStatus({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      aria-live="polite"
      className={joinClasses("flex items-start gap-2 text-xs leading-5 text-stone-300", className)}
      role="status"
    >
      <IconSpark className="mt-0.5 h-3.5 w-3.5 text-amber-300" />
      <span>
        <span className="font-semibold text-amber-200">Latest change: </span>
        {message}
      </span>
    </p>
  );
}

function TurnBody({ body, excerpt }: { body: string; excerpt: string | null }) {
  const index = excerpt ? body.indexOf(excerpt) : -1;

  if (!excerpt || index < 0) {
    return <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{body}</p>;
  }

  return (
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
      {body.slice(0, index)}
      <mark className="rounded bg-amber-300/25 px-0.5 text-amber-50 underline decoration-amber-300 decoration-2 underline-offset-4">
        {excerpt}
      </mark>
      {body.slice(index + excerpt.length)}
    </p>
  );
}

type ChoiceButtonProps = {
  choice: ConversationChoice;
  selected: boolean;
  disabled: boolean;
  onSelect: (choiceId: ConversationChoiceId) => void;
};

function ChoiceButton({ choice, selected, disabled, onSelect }: ChoiceButtonProps) {
  const isSomethingElse = choice.group === "somethingElse";

  return (
    <button
      aria-pressed={selected}
      className={joinClasses(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-amber-300 bg-amber-300/15 text-amber-50"
          : isSomethingElse
            ? "border-amber-300/40 text-amber-100 hover:bg-amber-300/10"
            : "border-stone-700 bg-black/30 text-stone-100 hover:border-amber-300/40 hover:bg-amber-300/5",
        FOCUS_RING,
      )}
      disabled={disabled}
      onClick={() => onSelect(choice.id)}
      type="button"
    >
      <span className="flex items-center gap-2">
        {isSomethingElse ? <IconChat className="text-amber-300" /> : null}
        {choice.label}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {choice.tag ? (
          <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
            {choice.tag}
          </span>
        ) : null}
        {selected ? <IconCheck className="text-amber-300" /> : null}
      </span>
    </button>
  );
}

type ChoiceGroupProps = {
  selectedChoiceId: ConversationChoiceId | null;
  disabled: boolean;
  onSelect: (choiceId: ConversationChoiceId) => void;
};

function OpeningChoices({ turnDomId, selectedChoiceId, disabled, onSelect }: ChoiceGroupProps & { turnDomId: string }) {
  const labelId = `${turnDomId}-choices`;
  const continueChoices = OPENING_TOPIC_CHOICES.filter((choice) => choice.group === "continue");
  const newChoices = OPENING_TOPIC_CHOICES.filter((choice) => choice.group === "new");

  return (
    <div aria-labelledby={labelId} className="mt-4 grid gap-3" role="group">
      <p className="sr-only" id={labelId}>
        Suggested starting topics
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
            Continue or revisit
          </p>
          {continueChoices.map((choice) => (
            <ChoiceButton
              choice={choice}
              disabled={disabled}
              key={choice.id}
              onSelect={onSelect}
              selected={selectedChoiceId === choice.id}
            />
          ))}
        </div>
        <div className="grid content-start gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
            Start somewhere new
          </p>
          {newChoices.map((choice) => (
            <ChoiceButton
              choice={choice}
              disabled={disabled}
              key={choice.id}
              onSelect={onSelect}
              selected={selectedChoiceId === choice.id}
            />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-stone-400">
        <span className="h-px flex-1 bg-stone-700" />
        or
        <span className="h-px flex-1 bg-stone-700" />
      </div>
      <ChoiceButton
        choice={OPENING_SOMETHING_ELSE_CHOICE}
        disabled={disabled}
        onSelect={onSelect}
        selected={selectedChoiceId === OPENING_SOMETHING_ELSE_CHOICE.id}
      />
    </div>
  );
}

function FollowUpChoices({ turnDomId, selectedChoiceId, disabled, onSelect }: ChoiceGroupProps & { turnDomId: string }) {
  const labelId = `${turnDomId}-follow-up`;

  return (
    <div aria-labelledby={labelId} className="mt-3 grid gap-2" role="group">
      <p className="sr-only" id={labelId}>
        Where to go next
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FOLLOW_UP_CHOICES.map((choice) => (
          <ChoiceButton
            choice={choice}
            disabled={disabled}
            key={choice.id}
            onSelect={onSelect}
            selected={selectedChoiceId === choice.id}
          />
        ))}
        <ChoiceButton
          choice={FOLLOW_UP_SOMETHING_ELSE_CHOICE}
          disabled={disabled}
          onSelect={onSelect}
          selected={selectedChoiceId === FOLLOW_UP_SOMETHING_ELSE_CHOICE.id}
        />
      </div>
    </div>
  );
}

type ConversationTurnViewProps = {
  turn: ConversationTurn;
  virtualGuideName: string;
  isActive: boolean;
  inactiveHint: string | null;
  selectedChoiceId: ConversationChoiceId | null;
  highlight: SupportingQuotation | null;
  onSelectChoice: (choiceId: ConversationChoiceId) => void;
  onAnswer: (turnId: string, answer: VerificationAnswer) => void;
  onReturnToQuotation: () => void;
};

export function ConversationTurnView({
  turn,
  virtualGuideName,
  isActive,
  inactiveHint,
  selectedChoiceId,
  highlight,
  onSelectChoice,
  onAnswer,
  onReturnToQuotation,
}: ConversationTurnViewProps) {
  const isGuide = turn.speaker === "virtualGuide";
  const domId = turnElementId(turn.id);
  const speakerId = `${domId}-speaker`;
  const verification = turn.verification;

  return (
    <article
      aria-labelledby={speakerId}
      className={joinClasses(
        "scroll-mb-72 scroll-mt-6 rounded-2xl border px-4 py-3 lg:scroll-mb-6",
        isGuide
          ? "mr-auto max-w-[94%] border-amber-200/10 bg-[#15110d] text-stone-100"
          : "ml-auto max-w-[90%] border-amber-300/20 bg-[#22190f] text-stone-50",
        highlight ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-[#0c0a08]" : "",
        FOCUS_RING,
      )}
      id={domId}
      tabIndex={-1}
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-amber-200" id={speakerId}>
        {isGuide ? <VirtualGuideAvatar /> : <ExplorerAvatar />}
        {getSpeakerLabel(turn, virtualGuideName)}
      </p>
      {highlight ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-300/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-100">
          <IconQuote className="h-3.5 w-3.5" />
          {highlight.status === "superseded"
            ? "Source of a superseded quotation"
            : "Source of the selected supporting quotation"}
        </p>
      ) : null}
      <TurnBody body={turn.body} excerpt={highlight ? highlight.text : null} />
      {turn.offersOpeningChoices ? (
        <OpeningChoices
          disabled={!isActive}
          onSelect={onSelectChoice}
          selectedChoiceId={selectedChoiceId}
          turnDomId={domId}
        />
      ) : null}
      {verification ? (
        verification.answer === null ? (
          <div
            aria-label="Answer this question about your Waypoint"
            className="mt-3 flex flex-wrap items-center gap-2"
            role="group"
          >
            <button
              className={PRIMARY_BUTTON}
              disabled={!isActive}
              onClick={() => onAnswer(turn.id, "yes")}
              type="button"
            >
              <IconCheck />
              {VERIFICATION_ANSWER_LABELS[verification.mode].yes}
            </button>
            <button
              className={SECONDARY_BUTTON}
              disabled={!isActive}
              onClick={() => onAnswer(turn.id, "no")}
              type="button"
            >
              {VERIFICATION_ANSWER_LABELS[verification.mode].no}
            </button>
            {!isActive && inactiveHint ? (
              <p className="w-full text-xs text-stone-400">{inactiveHint}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-stone-300">
            <IconCheck className="h-3.5 w-3.5 text-amber-300" />
            You answered: {VERIFICATION_ANSWER_LABELS[verification.mode][verification.answer]}
          </p>
        )
      ) : null}
      {turn.offersFollowUpChoices ? (
        <FollowUpChoices
          disabled={!isActive}
          onSelect={onSelectChoice}
          selectedChoiceId={selectedChoiceId}
          turnDomId={domId}
        />
      ) : null}
      {highlight ? (
        <button
          className={joinClasses(QUIET_BUTTON, "-ml-3 mt-2")}
          onClick={onReturnToQuotation}
          type="button"
        >
          <IconQuote />
          Back to the supporting quotation
        </button>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Composer, Pause, Finish & review, and the journey summary
// ---------------------------------------------------------------------------

type ComposerFormProps = {
  draft: string;
  prompt: ComposerPrompt;
  error: ComposerError | null;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPause: () => void;
  onFinish: () => void;
};

export function ComposerForm({
  draft,
  prompt,
  error,
  onChange,
  onSubmit,
  onKeyDown,
  onPause,
  onFinish,
}: ComposerFormProps) {
  return (
    <form className="grid gap-2" noValidate onSubmit={onSubmit}>
      <label className="text-sm font-semibold text-stone-100" htmlFor={COMPOSER_ID}>
        Continue the conversation
      </label>
      <textarea
        aria-describedby={error ? `${COMPOSER_HINT_ID} ${COMPOSER_ERROR_ID}` : COMPOSER_HINT_ID}
        aria-invalid={error ? true : undefined}
        className={joinClasses(
          "min-h-[3.5rem] w-full resize-y rounded-2xl border bg-black/50 px-4 py-3 text-sm leading-6 text-stone-50 placeholder:text-stone-400 focus:border-amber-300",
          error ? "border-rose-400" : "border-stone-600",
          FOCUS_RING,
        )}
        id={COMPOSER_ID}
        maxLength={COMPOSER_MESSAGE_MAX_LENGTH}
        name="message"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          prompt === "somethingElse"
            ? "What would you like to explore?"
            : "Share what comes to mind..."
        }
        rows={2}
        value={draft}
      />
      <p className="text-xs text-stone-400" id={COMPOSER_HINT_ID}>
        Enter sends. Shift+Enter adds a new line.
      </p>
      {error ? (
        <p className="text-sm text-rose-300" id={COMPOSER_ERROR_ID} role="alert">
          {describeComposerError(error)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button className={SECONDARY_BUTTON} onClick={onPause} type="button">
            <IconPause />
            Pause
          </button>
          <button className={SECONDARY_BUTTON} onClick={onFinish} type="button">
            <IconClipboard />
            Finish &amp; review
          </button>
        </div>
        <button className={PRIMARY_BUTTON} type="submit">
          Send
          <IconArrowUp />
        </button>
      </div>
    </form>
  );
}

export function PauseCard({
  onResume,
  onFinish,
}: {
  onResume: () => void;
  onFinish: () => void;
}) {
  return (
    <section
      aria-labelledby={PAUSE_HEADING_ID}
      className="rounded-2xl border border-amber-200/15 bg-black/30 p-4"
    >
      <h2
        className={joinClasses("flex items-center gap-2 rounded-md font-serif text-xl text-stone-50", FOCUS_RING)}
        id={PAUSE_HEADING_ID}
        tabIndex={-1}
      >
        <IconPause className="text-amber-300" />
        Journey paused
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-300">
        Your conversation and Compass stay exactly as they are while this
        screen stays open. If a Waypoint is forming, its details and supporting
        quotations stay too. Refreshing or resetting clears this prototype.
        Nothing was finalized or shared.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={SECONDARY_BUTTON} onClick={onResume} type="button">
          Resume journey
        </button>
        <button className={SECONDARY_BUTTON} onClick={onFinish} type="button">
          <IconClipboard />
          Finish &amp; review
        </button>
      </div>
    </section>
  );
}

type ReviewCardProps = {
  state: ExplorerConversationState;
  onReturn: () => void;
  onKeepForming: () => void;
  onReached: () => void;
};

export function ReviewCard({ state, onReturn, onKeepForming, onReached }: ReviewCardProps) {
  const counts = getWaypointCounts(state);
  const hasWaypoint = state.waypointStatus !== "none";

  return (
    <section
      aria-labelledby={REVIEW_HEADING_ID}
      className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.04] p-4"
    >
      <h2
        className={joinClasses("flex items-center gap-2 rounded-md font-serif text-xl text-stone-50", FOCUS_RING)}
        id={REVIEW_HEADING_ID}
        tabIndex={-1}
      >
        <IconClipboard className="text-amber-300" />
        Finish &amp; review
      </h2>
      <p className="mt-1 text-sm leading-6 text-stone-300">
        Review what this conversation clarified. Nothing is finished or shared
        until you choose.
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        {hasWaypoint ? (
          <>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Potential arrival</dt>
              <dd className="font-serif text-stone-50">&ldquo;{POTENTIAL_ARRIVAL}&rdquo;</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Waypoint details</dt>
              <dd className="text-stone-200">{formatWaypointCounts(counts)}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Waypoint</dt>
            <dd className="text-stone-200">None chosen. This conversation can finish without one.</dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Priority you confirmed</dt>
          <dd className="text-stone-200">
            {state.priorityConfirmed
              ? getCompassPath(state.priorityPathId).label
              : "No Priority confirmed"}
          </dd>
        </div>
      </dl>
      {hasWaypoint && counts.formingDetails > 0 ? (
        <p className="mt-3 text-xs leading-5 text-amber-100/90">
          {counts.formingDetails === 1
            ? "1 detail is still Forming."
            : `${counts.formingDetails} details are still Forming.`}{" "}
          Confirm Reached only if the potential arrival already describes your
          progress.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={SECONDARY_BUTTON} onClick={onReturn} type="button">
          Return to conversation
        </button>
        <button className={SECONDARY_BUTTON} onClick={onKeepForming} type="button">
          {hasWaypoint ? "Finish; keep Waypoint forming" : "Finish without a Waypoint"}
        </button>
        {hasWaypoint ? (
          <button className={PRIMARY_BUTTON} onClick={onReached} type="button">
            <IconFlag />
            Confirm Waypoint Reached
          </button>
        ) : null}
      </div>
    </section>
  );
}

type SummaryCardProps = {
  state: ExplorerConversationState;
  onReturnToConversations: () => void;
  onStartAnother: () => void;
};

export function SummaryCard({ state, onReturnToConversations, onStartAnother }: SummaryCardProps) {
  const summary = getJourneySummary(state);

  if (!summary) {
    return null;
  }

  return (
    <section
      aria-labelledby={SUMMARY_HEADING_ID}
      className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.05] p-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
        Journey summary
      </p>
      <h2
        className={joinClasses("mt-1 rounded-md font-serif text-2xl text-stone-50", FOCUS_RING)}
        id={SUMMARY_HEADING_ID}
        tabIndex={-1}
      >
        {summary.heading}
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-200">{summary.outcome}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Priority</dt>
          <dd className="text-stone-100">{summary.priorityLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Attention ended on</dt>
          <dd className="text-stone-100">{summary.attentionLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-stone-400">Waypoint details</dt>
          <dd className="text-stone-100">{summary.countsLabel}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-stone-400">
        This summary exists only on this screen. Refreshing or resetting clears
        it. Nothing was saved or shared.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className={SECONDARY_BUTTON} onClick={onReturnToConversations} type="button">
          Return to conversations
        </button>
        <button className={SECONDARY_BUTTON} onClick={onStartAnother} type="button">
          Start a new conversation
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Compass
// ---------------------------------------------------------------------------

const COMPASS_CENTER = { x: 150, y: 128 };
const COMPASS_BUBBLE_RADIUS = 31;
const ZONE_POINTS: Record<CompassZone, { x: number; y: number }> = {
  priority: { x: 150, y: 62 },
  detourLeft: { x: 80, y: 128 },
  detourRight: { x: 220, y: 128 },
  excursion: { x: 150, y: 194 },
};

function needleEnd(zone: CompassZone) {
  const point = ZONE_POINTS[zone];
  const dx = point.x - COMPASS_CENTER.x;
  const dy = point.y - COMPASS_CENTER.y;
  const distance = Math.hypot(dx, dy);
  const scale = (distance - COMPASS_BUBBLE_RADIUS - 4) / distance;

  return {
    x: COMPASS_CENTER.x + dx * scale,
    y: COMPASS_CENTER.y + dy * scale,
  };
}

function CompassDial({
  items,
  description,
}: {
  items: readonly CompassLayoutItem[];
  description: string;
}) {
  const attention = items.find((item) => item.isAttention) ?? null;
  const end = attention ? needleEnd(attention.zone) : null;

  return (
    <svg
      aria-describedby={COMPASS_DIAL_DESC_ID}
      aria-labelledby={COMPASS_DIAL_TITLE_ID}
      className="mx-auto mt-3 block h-auto w-full max-w-[17rem]"
      role="img"
      viewBox="0 0 300 256"
    >
      <title id={COMPASS_DIAL_TITLE_ID}>Session Compass</title>
      <desc id={COMPASS_DIAL_DESC_ID}>{description}</desc>
      <defs>
        <radialGradient cx="50%" cy="50%" id="compass-dial-glow" r="50%">
          <stop offset="0%" stopColor="rgba(245,158,11,0.16)" />
          <stop offset="100%" stopColor="rgba(5,4,3,0.9)" />
        </radialGradient>
      </defs>
      <circle
        className="stroke-amber-200/30"
        cx={COMPASS_CENTER.x}
        cy={COMPASS_CENTER.y}
        fill="url(#compass-dial-glow)"
        r={96}
        strokeWidth={1.5}
      />
      <line className="stroke-stone-700" x1={150} x2={150} y1={36} y2={220} />
      <line className="stroke-stone-700" x1={58} x2={242} y1={128} y2={128} />
      <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={150} y={18}>
        PRIORITY
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={24} y={131}>
        DETOUR
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.12em]" textAnchor="middle" x={276} y={131}>
        DETOUR
      </text>
      <text className="fill-stone-400 text-[9px] tracking-[0.18em]" textAnchor="middle" x={150} y={248}>
        EXCURSION
      </text>
      {end ? (
        <line
          className="stroke-orange-300"
          strokeLinecap="round"
          strokeWidth={3}
          x1={COMPASS_CENTER.x}
          x2={end.x}
          y1={COMPASS_CENTER.y}
          y2={end.y}
        />
      ) : null}
      <circle className="fill-orange-200" cx={COMPASS_CENTER.x} cy={COMPASS_CENTER.y} r={4.5} />
      {items.map((item) => {
        const point = ZONE_POINTS[item.zone];

        return (
          <g key={item.path.id}>
            <circle
              className={joinClasses(
                item.isPriority ? "fill-amber-400/25" : "fill-stone-900/90",
                item.isAttention
                  ? "stroke-orange-300"
                  : item.isPriority
                    ? "stroke-amber-300"
                    : "stroke-stone-600",
              )}
              cx={point.x}
              cy={point.y}
              r={COMPASS_BUBBLE_RADIUS}
              strokeDasharray={item.isPendingPriority ? "4 3" : undefined}
              strokeWidth={item.isAttention || item.isPriority ? 2.5 : 1.2}
            />
            <text className="fill-stone-100 text-[9.5px] font-medium" textAnchor="middle" x={point.x} y={point.y - 3}>
              <tspan x={point.x}>{item.path.labelLines[0]}</tspan>
              <tspan dy={11} x={point.x}>
                {item.path.labelLines[1]}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type CompassSectionProps = {
  state: ExplorerConversationState;
  isActive: boolean;
  inactiveHint: string | null;
  onSelectPath: (pathId: CompassPathId) => void;
  onRequestPriority: () => void;
  onConfirmPriority: () => void;
  onDeclinePriority: () => void;
  onToggleView: () => void;
};

function CompassSection({
  state,
  isActive,
  inactiveHint,
  onSelectPath,
  onRequestPriority,
  onConfirmPriority,
  onDeclinePriority,
  onToggleView,
}: CompassSectionProps) {
  const layout = getCompassLayout(state);
  const attention = getCompassPath(state.attentionPathId);
  const priority = getCompassPath(state.priorityPathId);
  const pending = state.pendingPriorityPathId
    ? getCompassPath(state.pendingPriorityPathId)
    : null;
  const compact = getCompactOrientations(state);
  const priorityDisplay = getPriorityDisplay(state);
  const isFull = state.compassView === "full";

  return (
    <section aria-labelledby={COMPASS_TITLE_ID} className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            Priority-up frame
          </p>
          <h3 className="flex items-center gap-2 font-serif text-lg text-stone-50" id={COMPASS_TITLE_ID}>
            <IconCompass className="text-amber-300" />
            Current Compass
          </h3>
        </div>
        <button
          aria-controls={COMPASS_VIEW_ID}
          className={joinClasses(QUIET_BUTTON, "border border-stone-700")}
          onClick={onToggleView}
          type="button"
        >
          {isFull ? "Compact view" : "Full view"}
          <span className="sr-only"> of the Compass</span>
        </button>
      </div>
      <div id={COMPASS_VIEW_ID}>
        {isFull ? (
          <>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              {state.priorityConfirmed
                ? "Your Priority sits at the top. The sides hold Detours and the lower area holds an Excursion. The line points to your current attention."
                : "No Priority is confirmed yet. The line points to your current attention; choose a direction and confirm it only when it should become your Priority."}
            </p>
            <CompassDial description={getCompassDescription(state)} items={layout} />
            <dl className="mt-2 grid gap-1 text-sm">
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-stone-400">Priority:</dt>
                <dd className="font-medium text-amber-100">
                  {priorityDisplay.confirmed ? (
                    <>
                      {priorityDisplay.label}{" "}
                      <span className="text-xs text-stone-400">(confirmed by you)</span>
                    </>
                  ) : (
                    "No Priority confirmed"
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-stone-400">Current attention:</dt>
                <dd className="font-medium text-orange-100">{attention.label}</dd>
              </div>
            </dl>
            <div aria-labelledby={COMPASS_PATHS_LABEL_ID} className="mt-3" role="group">
              <p className="text-xs text-stone-300" id={COMPASS_PATHS_LABEL_ID}>
                Move your attention. This never changes your Priority.
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {layout.map((item) => (
                  <li key={item.path.id}>
                    <button
                      aria-pressed={item.isAttention}
                      className={joinClasses(
                        "flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        item.isAttention
                          ? "border-orange-300/70 bg-orange-300/10 text-orange-50"
                          : "border-stone-700 bg-black/25 text-stone-200 hover:border-amber-300/40",
                        FOCUS_RING,
                      )}
                      disabled={!isActive}
                      onClick={() => onSelectPath(item.path.id)}
                      type="button"
                    >
                      <span className="font-medium">{item.path.label}</span>
                      <span className="text-[11px] text-stone-400">
                        {item.isAttention ? "Current attention" : item.zoneLabel}
                        {item.isPriority ? ` ${MIDDLE_DOT} Priority` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {pending ? (
              <div
                aria-labelledby={PRIORITY_QUESTION_ID}
                className="mt-4 rounded-2xl border border-orange-300/40 bg-orange-300/5 p-3"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onDeclinePriority();
                  }
                }}
                role="group"
              >
                <p
                  className={joinClasses("rounded-md text-sm font-semibold text-orange-50", FOCUS_RING)}
                  id={PRIORITY_QUESTION_ID}
                  tabIndex={-1}
                >
                  Make &ldquo;{pending.label}&rdquo; your Priority?
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-300">
                   {state.priorityConfirmed
                     ? <>It would replace &ldquo;{priority.label}&rdquo;. </>
                     : "This would set your first Priority. "}
                   Nothing changes unless you confirm. Press Escape to keep the
                   current Compass as it is.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={PRIMARY_BUTTON} onClick={onConfirmPriority} type="button">
                    Yes, make it my Priority
                  </button>
                  <button className={SECONDARY_BUTTON} onClick={onDeclinePriority} type="button">
                     {state.priorityConfirmed ? `Keep “${priority.label}”` : "Do not set a Priority"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p
                  className={joinClasses("rounded-md text-xs text-stone-400", FOCUS_RING)}
                  id={PRIORITY_STATUS_ID}
                  tabIndex={-1}
                >
                   {state.priorityConfirmed
                     ? <>Your Priority is &ldquo;{priority.label}&rdquo;. It changes only when you confirm a change.</>
                     : "No Priority has been confirmed yet."}
                </p>
                 {!state.priorityConfirmed || attention.id !== priority.id ? (
                  <button
                    className={joinClasses(SECONDARY_BUTTON, "mt-2")}
                    disabled={!isActive}
                    onClick={onRequestPriority}
                    type="button"
                  >
                    Make &ldquo;{attention.label}&rdquo; my Priority
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-stone-400">
                     Your current attention is already your confirmed Priority.
                  </p>
                )}
              </div>
            )}
            {!isActive && inactiveHint ? (
              <p className="mt-3 text-xs text-stone-400">{inactiveHint}</p>
            ) : null}
          </>
        ) : (
          <div className="mt-3">
            <ol
              aria-label="Current and recent Compass orientations"
              className="divide-y divide-stone-800 rounded-2xl border border-stone-800 bg-black/25"
            >
              <li className="px-3 py-2">
                <p className="text-sm font-semibold text-orange-50">{compact.current.label}</p>
                <p className="text-[11px] text-orange-200/90">Current orientation</p>
              </li>
              {compact.recent.map((path, index) => (
                <li className="px-3 py-2" key={`${path.id}-${index}`}>
                  <p className="text-sm text-stone-200">{path.label}</p>
                  <p className="text-[11px] text-stone-400">
                    {index === 0 ? "Previous orientation" : "Earlier orientation"}
                  </p>
                </li>
              ))}
            </ol>
            {compact.moreCount > 0 ? (
              <p className="mt-2 text-xs text-stone-400">
                and {compact.moreCount} earlier orientation
                {compact.moreCount === 1 ? "" : "s"} not shown
              </p>
            ) : null}
            <p className="mt-2 text-xs text-stone-400">
              Priority:{" "}
              <span className="text-amber-100">{priorityDisplay.label}</span>
              {priorityDisplay.confirmed ? " (confirmed by you)" : ""}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Waypoint
// ---------------------------------------------------------------------------

function DetailStateBadge({ state }: { state: WaypointDetailState }) {
  const captured = state === "captured";

  return (
    <span
      className={joinClasses(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        captured
          ? "border-amber-300/50 text-amber-100"
          : "border-dashed border-stone-500 text-stone-300",
      )}
    >
      {captured ? <IconCheck className="h-3.5 w-3.5" /> : <IconDashedCircle className="h-3.5 w-3.5" />}
      {captured ? "Captured" : "Forming"}
    </span>
  );
}

type QuotationButtonProps = {
  quotation: SupportingQuotation;
  speakerLabel: string;
  isSelected: boolean;
  onSelect: (quotationId: QuotationId) => void;
  onShare: (quotationId: QuotationId) => void;
};

function QuotationButton({ quotation, speakerLabel, isSelected, onSelect, onShare }: QuotationButtonProps) {
  const superseded = quotation.status === "superseded";

  return (
    <li className="rounded-xl border border-transparent hover:border-amber-300/20 hover:bg-amber-300/5">
      <button
        className={joinClasses(
          "w-full rounded-xl border px-2.5 py-2 text-left text-sm transition-colors",
          superseded ? "text-stone-400" : "text-stone-200",
          isSelected
            ? "border-amber-300/60 bg-amber-300/10"
            : "border-transparent hover:border-amber-300/30 hover:bg-amber-300/5",
          FOCUS_RING,
        )}
        id={quotationElementId(quotation.id)}
        onClick={() => onSelect(quotation.id)}
        type="button"
      >
        <span className="block italic">&ldquo;{quotation.text}&rdquo;</span>
        <span className="mt-1 block text-[11px] not-italic text-amber-200/85">
          {speakerLabel} &middot;{" "}
          {superseded
            ? "Superseded earlier basis - show source"
            : "Show source in the conversation"}
        </span>
      </button>
      <button
        aria-label={`Review sharing this exact quotation: ${quotation.text}`}
        className={joinClasses(QUIET_BUTTON, "mx-2 mb-2")}
        onClick={() => onShare(quotation.id)}
        type="button"
      >
        <IconEye />
        Review sharing this quotation
      </button>
    </li>
  );
}

type WaypointDetailItemProps = {
  detail: WaypointDetail;
  state: ExplorerConversationState;
  isActive: boolean;
  openDetailId: WaypointDetailId | null;
  onDetailAction: (detailId: WaypointDetailId) => void;
  onQuotationListToggle: (detailId: WaypointDetailId, open: boolean) => void;
  onSelectQuotation: (quotationId: QuotationId) => void;
  onShareQuotation: (quotationId: QuotationId) => void;
};

function WaypointDetailItem({
  detail,
  state,
  isActive,
  openDetailId,
  onDetailAction,
  onQuotationListToggle,
  onSelectQuotation,
  onShareQuotation,
}: WaypointDetailItemProps) {
  const detailState = state.detailStates[detail.id];
  const quotations = getQuotationsForDetail(detail.id);
  const current = quotations.filter((quotation) => quotation.status === "current");
  const superseded = quotations.filter((quotation) => quotation.status === "superseded");
  const isOpenHere = openDetailId === detail.id;
  const isBlocked = openDetailId !== null && !isOpenHere;
  const textId = `waypoint-detail-${detail.id}`;
  const actionLabel = isOpenHere
    ? "Go to the open question"
    : detailState === "forming"
      ? "Verify in conversation"
      : "Revisit in conversation";

  function speakerFor(quotation: SupportingQuotation): string {
    const turn = state.turns.find((candidate) => candidate.id === quotation.turnId);
    return turn ? getSpeakerLabel(turn, state.virtualGuideName) : "Conversation";
  }

  return (
    <li>
      <article
        aria-labelledby={textId}
        className="rounded-2xl border border-stone-800 bg-black/25 p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            {detail.kind === "keyInsight" ? (
              <IconLightbulb className="h-3.5 w-3.5 text-amber-300" />
            ) : (
              <IconMapPin className="h-3.5 w-3.5 text-amber-300" />
            )}
            {WAYPOINT_DETAIL_KIND_LABELS[detail.kind]}
          </p>
          <DetailStateBadge state={detailState} />
        </div>
        <p className="mt-1.5 text-sm font-medium leading-6 text-stone-100" id={textId}>
          {detail.text}
        </p>
        <button
          className={joinClasses(QUIET_BUTTON, "-ml-3 mt-1")}
          disabled={!isOpenHere && (!isActive || isBlocked)}
          onClick={() => onDetailAction(detail.id)}
          type="button"
        >
          <IconChat />
          {actionLabel}
          <span className="sr-only">: {detail.text}</span>
        </button>
        {isBlocked && isActive ? (
          <p className="text-[11px] text-stone-400">
            Answer the open question in the conversation first.
          </p>
        ) : null}
        <details
          className="mt-2"
          onToggle={(event) => onQuotationListToggle(detail.id, event.currentTarget.open)}
          open={state.openQuotationDetailIds.includes(detail.id)}
        >
          <summary
            className={joinClasses(
              "cursor-pointer rounded-md text-xs font-medium text-amber-200/90",
              FOCUS_RING,
            )}
          >
            {current.length} supporting quotation{current.length === 1 ? "" : "s"}
            {superseded.length > 0 ? ` ${MIDDLE_DOT} ${superseded.length} superseded` : ""}
          </summary>
          <ul className="mt-2 grid gap-1">
            {current.map((quotation) => (
              <QuotationButton
                isSelected={state.sourceHighlight?.quotationId === quotation.id}
                key={quotation.id}
                onSelect={onSelectQuotation}
                onShare={onShareQuotation}
                quotation={quotation}
                speakerLabel={speakerFor(quotation)}
              />
            ))}
          </ul>
          {superseded.length > 0 ? (
            <div className="mt-2 border-t border-stone-800 pt-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                <IconHistory className="h-3.5 w-3.5" />
                Provenance history
              </p>
              <p className="mt-1 text-[11px] text-stone-400">
                Kept for history. It is no longer the current basis.
              </p>
              <ul className="mt-1 grid gap-1">
                {superseded.map((quotation) => (
                  <QuotationButton
                    isSelected={state.sourceHighlight?.quotationId === quotation.id}
                    key={quotation.id}
                    onSelect={onSelectQuotation}
                    onShare={onShareQuotation}
                    quotation={quotation}
                    speakerLabel={speakerFor(quotation)}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </details>
      </article>
    </li>
  );
}

type WaypointSectionProps = {
  state: ExplorerConversationState;
  isActive: boolean;
  onDetailAction: (detailId: WaypointDetailId) => void;
  onExploreNext: () => void;
  onQuotationListToggle: (detailId: WaypointDetailId, open: boolean) => void;
  onSelectQuotation: (quotationId: QuotationId) => void;
  onShareQuotation: (quotationId: QuotationId) => void;
  onShareWaypoint: () => void;
};

function WaypointSection({
  state,
  isActive,
  onDetailAction,
  onExploreNext,
  onQuotationListToggle,
  onSelectQuotation,
  onShareQuotation,
  onShareWaypoint,
}: WaypointSectionProps) {
  if (state.waypointStatus === "none") {
    return (
      <section aria-labelledby={WAYPOINT_TITLE_ID} className="border-t border-stone-800/80 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
          Open-ended by default
        </p>
        <h3 className="font-serif text-lg text-stone-50" id={WAYPOINT_TITLE_ID}>
          No Waypoint yet
        </h3>
        <p className="mt-2 text-xs leading-5 text-stone-300">
          This conversation can stay open-ended. A Waypoint may be onboarding,
          a journal or self-reflection, a quick check-in, a goal, or any other
          experience with a reachable arrival.
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-400">
          {getVirtualGuideTurnLabel(state.virtualGuideName)} can help notice when something reachable is taking shape, but
          only you decide whether it becomes a Waypoint.
        </p>
        <p className="mt-3 rounded-2xl border border-dashed border-stone-700 px-3 py-2.5 text-[11px] leading-4 text-stone-400">
          Waypoint formation from this new conversation is visibly incomplete
          in this prototype. The next connected step will happen inside the
          conversation: {getVirtualGuideTurnLabel(state.virtualGuideName)} reflects a possible arrival, then you accept it or
          keep talking without a Waypoint.
        </p>
      </section>
    );
  }

  const reached = state.waypointStatus === "reached";
  const openTurn = getOpenVerificationTurn(state);
  const openDetailId = openTurn?.verification?.detailId ?? null;

  return (
    <section aria-labelledby={WAYPOINT_TITLE_ID} className="border-t border-stone-800/80 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            {reached ? "Private progress you confirmed" : "Private progress taking shape"}
          </p>
          <h3 className="font-serif text-lg text-stone-50" id={WAYPOINT_TITLE_ID}>
            {reached ? "Reached Waypoint" : "Forming Waypoint"}
          </h3>
        </div>
        <span
          className={joinClasses(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            reached
              ? "border-amber-300/70 bg-amber-300/15 text-amber-50"
              : "border-dashed border-amber-200/40 text-amber-100",
          )}
        >
          {reached ? <IconFlag className="h-3.5 w-3.5" /> : <IconDashedCircle className="h-3.5 w-3.5" />}
          {reached ? "Reached" : "Forming"}
        </span>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        A progress marker you confirm, not just a conversation topic.
      </p>
      <div className="mt-3 rounded-2xl border-l-2 border-amber-300/60 bg-amber-300/[0.05] px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
          Potential arrival
        </p>
        <p className="mt-1 font-serif text-base leading-6 text-stone-50">{POTENTIAL_ARRIVAL}</p>
        <p className="mt-1 text-xs text-stone-400">
          {reached
            ? "You confirmed this outcome as Reached on this screen."
            : "Reached only when you confirm that this outcome describes your progress."}
        </p>
      </div>
      <p className="mt-2 text-xs text-stone-300">{formatWaypointCounts(getWaypointCounts(state))}</p>
      <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-50">
          <IconFlag />
          {reached ? "Reached, confirmed by you" : "Sharing unlocks when Reached"}
        </p>
        <p className="mt-1 text-xs leading-5 text-stone-300" id="waypoint-sharing-availability">
          {reached
            ? "The Waypoint, supporting quotations, and whole conversation remain private unless you select each one separately."
            : "This Waypoint remains private while it is Forming. Sharing becomes available after you confirm it as Reached."}
        </p>
        <button
          aria-disabled={!reached}
          aria-describedby="waypoint-sharing-availability"
          className={joinClasses(
            SECONDARY_BUTTON,
            "mt-3",
            !reached && "cursor-not-allowed opacity-50",
          )}
          onClick={() => {
            if (reached) {
              onShareWaypoint();
            }
          }}
          type="button"
        >
          <IconEye />
          Share this Waypoint with {ASSIGNED_GUIDE_NAME}
          <span className={NOT_CONNECTED_TAG}>{NOT_CONNECTED_LABEL}</span>
        </button>
      </div>
      <p className="mt-4 text-xs text-stone-400">
        Details change only through your answers in the conversation.
      </p>
      <ul className="mt-2 grid gap-3">
        {WAYPOINT_DETAILS.map((detail) => (
          <WaypointDetailItem
            detail={detail}
            isActive={isActive}
            key={detail.id}
            onDetailAction={onDetailAction}
            onQuotationListToggle={onQuotationListToggle}
            onSelectQuotation={onSelectQuotation}
            onShareQuotation={onShareQuotation}
            openDetailId={openDetailId}
            state={state}
          />
        ))}
      </ul>
      <div className="mt-4 rounded-2xl border border-dashed border-stone-700 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
          Possible next direction &middot; not part of this Waypoint
        </p>
        <p className="mt-1 text-sm font-medium text-stone-200">{POSSIBLE_NEXT_WAYPOINT}</p>
        <p className="mt-1 text-xs text-stone-400">
          Explore the timing in conversation without creating, capturing, or
          completing another Waypoint.
        </p>
        <button
          className={joinClasses(SECONDARY_BUTTON, "mt-3")}
          disabled={!isActive}
          onClick={onExploreNext}
          type="button"
        >
          Explore this next
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Compass & Waypoint panel content (wide panel and narrow drawer)
// ---------------------------------------------------------------------------

type SupportPanelContentProps = {
  state: ExplorerConversationState;
  variant: "panel" | "drawer";
  headingId: string;
  showActivity: boolean;
  isActive: boolean;
  inactiveHint: string | null;
  onClose?: () => void;
  onSelectPath: (pathId: CompassPathId) => void;
  onRequestPriority: () => void;
  onConfirmPriority: () => void;
  onDeclinePriority: () => void;
  onToggleCompassView: () => void;
  onDetailAction: (detailId: WaypointDetailId) => void;
  onExploreNext: () => void;
  onQuotationListToggle: (detailId: WaypointDetailId, open: boolean) => void;
  onSelectQuotation: (quotationId: QuotationId) => void;
  onShareQuotation: (quotationId: QuotationId) => void;
  onShareWaypoint: () => void;
};

export function SupportPanelContent({
  state,
  variant,
  headingId,
  showActivity,
  isActive,
  inactiveHint,
  onClose,
  onSelectPath,
  onRequestPriority,
  onConfirmPriority,
  onDeclinePriority,
  onToggleCompassView,
  onDetailAction,
  onExploreNext,
  onQuotationListToggle,
  onSelectQuotation,
  onShareQuotation,
  onShareWaypoint,
}: SupportPanelContentProps) {
  const isDrawer = variant === "drawer";

  return (
    <div className={isDrawer ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className="flex items-start justify-between gap-3 border-b border-stone-800/80 px-4 py-4">
        <div>
          <h2
            className={joinClasses("rounded-md font-serif text-xl text-stone-50", FOCUS_RING)}
            id={headingId}
            tabIndex={-1}
          >
            Compass &amp; Waypoint
          </h2>
          <p className="mt-0.5 text-xs text-stone-400">
            Supports this conversation. Private to you.
          </p>
        </div>
        {isDrawer && onClose ? (
          <button className={joinClasses(QUIET_BUTTON, "border border-stone-700")} onClick={onClose} type="button">
            <IconClose />
            Close
            <span className="sr-only"> Compass &amp; Waypoint</span>
          </button>
        ) : null}
      </div>
      {showActivity ? (
        <ActivityStatus className="border-b border-stone-800/80 px-4 py-3" message={state.activity} />
      ) : null}
      <div className={isDrawer ? "min-h-0 flex-1 overflow-y-auto" : undefined}>
        <CompassSection
          inactiveHint={inactiveHint}
          isActive={isActive}
          onConfirmPriority={onConfirmPriority}
          onDeclinePriority={onDeclinePriority}
          onRequestPriority={onRequestPriority}
          onSelectPath={onSelectPath}
          onToggleView={onToggleCompassView}
          state={state}
        />
        <WaypointSection
          isActive={isActive}
          onDetailAction={onDetailAction}
          onExploreNext={onExploreNext}
          onQuotationListToggle={onQuotationListToggle}
          onSelectQuotation={onSelectQuotation}
          onShareQuotation={onShareQuotation}
          onShareWaypoint={onShareWaypoint}
          state={state}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversations list, Guide continuity banner
// ---------------------------------------------------------------------------

type ConversationsHubProps = {
  state: ExplorerConversationState;
  showActivity: boolean;
  onOpenJourney: () => void;
  onOpenEarlier: () => void;
  onStartAnother: () => void;
  onOpenGuide: () => void;
};

export function ConversationsHub({
  state,
  showActivity,
  onOpenJourney,
  onOpenEarlier,
  onStartAnother,
  onOpenGuide,
}: ConversationsHubProps) {
  const rowClass = joinClasses(
    "flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-700 bg-black/30 px-4 py-3 text-left transition-colors hover:border-amber-300/40 hover:bg-amber-300/5",
    FOCUS_RING,
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/90">
          {SOLMIND_TERMS.explorerRole} &middot; Conversations
        </p>
        <h1
          className={joinClasses("mt-2 rounded-md font-serif text-4xl text-stone-50", FOCUS_RING)}
          id={CONVERSATIONS_HEADING_ID}
          tabIndex={-1}
        >
          Conversations
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
          Continue a current conversation or start a new one without deciding
          on a Waypoint first. Virtual Guide conversations are separate from
          direct conversations with {ASSIGNED_GUIDE_LABEL}.
        </p>
        {showActivity ? <ActivityStatus className="mt-4" message={state.activity} /> : null}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section
            aria-labelledby="conversations-virtual-guide-title"
            className="rounded-3xl border border-amber-200/15 bg-[#0c0a08]/90 p-5"
          >
            <h2 className="font-serif text-2xl text-stone-50" id="conversations-virtual-guide-title">
              With {getVirtualGuidePrimaryLabel(state.virtualGuideName)}
            </h2>
            <p className="mt-1 text-sm text-stone-400">
              Private conversations in different stages. A Waypoint is optional.
            </p>
            <ul className="mt-4 grid gap-2">
              <li>
                <button className={rowClass} onClick={onOpenJourney} type="button">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-stone-50">
                      {state.conversationKind === "openEnded" ? "New conversation" : JOURNEY_TITLE}
                    </span>
                    <span className="text-xs text-stone-400">{getJourneyStatusLabel(state)}</span>
                  </span>
                  <span className="text-sm font-semibold text-amber-200">Open</span>
                </button>
              </li>
              <li>
                <button className={rowClass} onClick={onOpenEarlier} type="button">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium text-stone-100">What I need others to understand</span>
                    <span className="text-xs text-stone-400">Reached Waypoint &middot; From earlier &middot; {NOT_CONNECTED_LABEL}</span>
                  </span>
                  <span className="text-sm font-semibold text-stone-300">Open</span>
                </button>
              </li>
            </ul>
            <button className={joinClasses(SECONDARY_BUTTON, "mt-4")} onClick={onStartAnother} type="button">
              Start a new conversation
            </button>
          </section>
          <section
            aria-labelledby="conversations-guide-title"
            className="rounded-3xl border border-stone-700 bg-black/40 p-5"
          >
            <h2 className="font-serif text-2xl text-stone-50" id="conversations-guide-title">
              With {ASSIGNED_GUIDE_LABEL}
            </h2>
            <p className="mt-1 text-sm leading-6 text-stone-400">
              Direct conversations with {ASSIGNED_GUIDE_NAME} happen in their
              own space. No Waypoint forms there, and {ASSIGNED_GUIDE_NAME} does
              not see your Virtual Guide conversations unless you deliberately
              share one.
            </p>
            <button className={joinClasses(SECONDARY_BUTTON, "mt-4")} onClick={onOpenGuide} type="button">
              <IconUsers />
              Open conversations with {ASSIGNED_GUIDE_NAME}
              <span className={NOT_CONNECTED_TAG}>{NOT_CONNECTED_LABEL}</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

export function GuideContinuityBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <aside
      aria-labelledby={GUIDE_BANNER_TITLE_ID}
      className="shrink-0 border-t border-amber-200/10 bg-black/70 px-4 py-3 sm:px-6 lg:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/40 text-amber-300"
          >
            <IconUsers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-100" id={GUIDE_BANNER_TITLE_ID}>
              {ASSIGNED_GUIDE_LABEL}, is part of your journey.
            </p>
            <p className="text-xs leading-5 text-stone-400">
              {ASSIGNED_GUIDE_NAME} is not in this conversation and is not
              reading it. Conversations with {ASSIGNED_GUIDE_NAME} happen in a
              separate space.
            </p>
          </div>
        </div>
        <button className={joinClasses(QUIET_BUTTON, "border border-amber-300/25")} onClick={onOpen} type="button">
          Conversations with {ASSIGNED_GUIDE_NAME}
          <span className={NOT_CONNECTED_TAG}>{NOT_CONNECTED_LABEL}</span>
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Modal dialogs (native dialog element with focus return)
// ---------------------------------------------------------------------------

type ModalDialogProps = {
  open: boolean;
  id?: string;
  labelledBy: string;
  describedBy?: string;
  initialFocusId: string;
  className: string;
  onDismiss: () => void;
  children: ReactNode;
};

export function ModalDialog({
  open,
  id,
  labelledBy,
  describedBy,
  initialFocusId,
  className,
  onDismiss,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement ? active : null;
      dialog.showModal();
      document.getElementById(initialFocusId)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const target = returnFocusRef.current;
      returnFocusRef.current = null;

      if (target && target.isConnected) {
        target.focus();
      }
    }
  }, [open, initialFocusId]);

  return (
    <dialog
      aria-describedby={describedBy}
      aria-labelledby={labelledBy}
      className={className}
      id={id}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClose={onDismiss}
      ref={dialogRef}
    >
      {children}
    </dialog>
  );
}

export const INFO_DIALOG_CLASS =
  "fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-3xl border border-amber-300/25 bg-[#0d0b09] p-0 text-stone-100 shadow-[0_30px_90px_rgba(0,0,0,0.7)] backdrop:bg-black/75";

export const DRAWER_DIALOG_CLASS =
  "fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-md overflow-hidden border-0 border-l border-amber-200/15 bg-[#080706] p-0 text-stone-100 backdrop:bg-black/70 open:flex open:flex-col";

function getDialogCopy(dialog: PrototypeDialog): {
  tag: string | null;
  title: string;
  statements: readonly string[];
} {
  switch (dialog.kind) {
    case "conversationSharing":
      return {
        tag: NOT_CONNECTED_LABEL,
        title: CONVERSATION_SHARING_EXPLANATION.title,
        statements: CONVERSATION_SHARING_EXPLANATION.statements.map((statement) => statement.text),
      };
    case "waypointSharing":
      return {
        tag: NOT_CONNECTED_LABEL,
        title: WAYPOINT_SHARING_EXPLANATION.title,
        statements: WAYPOINT_SHARING_EXPLANATION.statements.map((statement) => statement.text),
      };
    case "quotationSharing": {
      const explanation = getQuotationSharingExplanation(dialog.quotationId);

      return {
        tag: NOT_CONNECTED_LABEL,
        title: explanation.title,
        statements: explanation.statements.map((statement) => statement.text),
      };
    }
    case "notConnected":
      return {
        tag: NOT_CONNECTED_LABEL,
        title: NOT_CONNECTED_DESTINATIONS[dialog.destination].title,
        statements: NOT_CONNECTED_DESTINATIONS[dialog.destination].statements,
      };
    case "newConversationConfirmation":
      return {
        tag: "Prototype limitation",
        title: NEW_CONVERSATION_CONFIRMATION_COPY.title,
        statements: NEW_CONVERSATION_CONFIRMATION_COPY.statements.map(
          (statement) => statement.text,
        ),
      };
    case "resetConfirmation":
      return {
        tag: null,
        title: RESET_CONFIRMATION_COPY.title,
        statements: RESET_CONFIRMATION_COPY.statements,
      };
    case "aboutPrototype":
      return {
        tag: "Prototype",
        title: PROTOTYPE_DISCLOSURE.title,
        statements: PROTOTYPE_DISCLOSURE.statements,
      };
  }
}

type PrototypeDialogContentProps = {
  dialog: PrototypeDialog;
  onClose: () => void;
  onConfirmNewConversation: () => void;
  onConfirmReset: () => void;
};

export function PrototypeDialogContent({
  dialog,
  onClose,
  onConfirmNewConversation,
  onConfirmReset,
}: PrototypeDialogContentProps) {
  const copy = getDialogCopy(dialog);
  const isReset = dialog.kind === "resetConfirmation";
  const isNewConversation = dialog.kind === "newConversationConfirmation";

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        {copy.tag ? <span className={NOT_CONNECTED_TAG}>{copy.tag}</span> : null}
        {dialog.kind === "conversationSharing" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600 px-2 py-0.5 text-[11px] font-semibold text-stone-200">
            <IconEyeOff className="h-3.5 w-3.5" />
            Still a private conversation
          </span>
        ) : null}
      </div>
      <h2 className="mt-3 font-serif text-2xl leading-tight text-stone-50" id={DIALOG_TITLE_ID}>
        {copy.title}
      </h2>
      <div className="mt-4 grid gap-3 text-sm leading-6 text-stone-300" id={DIALOG_BODY_ID}>
        {copy.statements.map((statement) => (
          <p key={statement}>{statement}</p>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        {isReset ? (
          <>
            <button className={SECONDARY_BUTTON} id={DIALOG_INITIAL_FOCUS_ID} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={PRIMARY_BUTTON} onClick={onConfirmReset} type="button">
              <IconReset />
              Reset prototype
            </button>
          </>
        ) : isNewConversation ? (
          <>
            <button className={SECONDARY_BUTTON} id={DIALOG_INITIAL_FOCUS_ID} onClick={onClose} type="button">
              Keep current conversation
            </button>
            <button className={PRIMARY_BUTTON} onClick={onConfirmNewConversation} type="button">
              Start new conversation
            </button>
          </>
        ) : (
          <button className={PRIMARY_BUTTON} id={DIALOG_INITIAL_FOCUS_ID} onClick={onClose} type="button">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
