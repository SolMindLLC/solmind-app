// Fixed wording for the minimal functional Admin screens (PRJ01_R-WS03-WI014;
// decision queue 2026-11-03 11:52:57, 11:56:14 and 12:19:09). Plain words for
// testing; Paul may reword or replace any of it with the better Admin design of
// a later sprint. ASCII only. Activity is by sign-ins only; apart from the
// recorded hard-stop facts Paul approved as Admin review flags (2026-11-01
// 01:00:16: day, time reached, that day's total calls, the limit; 2026-11-01
// 12:27:07: crisis or urgent status at the stop), no Admin page shows
// conversation content, message dates or message counts.

import type {
  AdminChangeSettingOutcome,
  AdminLiftPauseOutcome,
  AdminPeoplePause,
  AdminRelationshipStatus,
  AdminSettingKey,
} from "./adminWorkspaceContract";
import { ADMIN_MENU_LABELS } from "./adminWorkspaceFrame";
import { SOLMIND_TERMS } from "./terms";

function freeze<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const GUIDE = SOLMIND_TERMS.guideRole;
const EXPLORER = SOLMIND_TERMS.explorerRole;

// Whole numbers with thousands commas, the same on the server and in the browser.
export function formatAdminCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const NOT_CONFIRMED = "Your Admin sign-in could not be confirmed. Nothing was changed.";
const UNKNOWN = "The result could not be confirmed.";

export const ADMIN_LIFT_OUTCOME_SENTENCES: Readonly<Record<AdminLiftPauseOutcome, string>> = freeze({
  lifted: "The pause was lifted.",
  already_lifted: "This pause was already lifted.",
  lifted_automatically: "This pause had already been lifted automatically.",
  lifted_elsewhere: "This pause had already been lifted. Nothing was changed.",
  not_found: "This pause was not found. Nothing was changed.",
  conflict: "The pause could not be lifted just now. Nothing was changed.",
  denied: NOT_CONFIRMED,
  failed: UNKNOWN,
});

export const ADMIN_SETTING_OUTCOME_SENTENCES: Readonly<Record<AdminChangeSettingOutcome, string>> = freeze({
  applied: "The new value was saved.",
  unchanged: "The setting already had that value. Nothing changed.",
  already_applied: "This change was already saved.",
  version_conflict: "The setting changed after this page was loaded. Nothing was saved.",
  out_of_range: "That value is outside the allowed range. Nothing was saved.",
  conflict: "The setting could not be saved just now. Nothing was saved.",
  denied: NOT_CONFIRMED,
  failed: UNKNOWN,
});

export const ADMIN_RELATIONSHIP_LABELS: Readonly<Record<AdminRelationshipStatus, string>> = freeze({
  invited: "Invited",
  intake_pending: "Intake pending",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
  transferred: "Transferred",
});

// The Guides and Explorers page's "Paused now" values.
export const ADMIN_PEOPLE_PAUSE_LABELS: Readonly<Record<AdminPeoplePause, string>> = freeze({
  own_limit: "Yes",
  shared: "Yes, shared pause",
  none: "No",
});

export const ADMIN_SETTING_LABELS: Readonly<Record<AdminSettingKey, Readonly<{ label: string; note: string }>>> = freeze({
  explorer_ai_use_individual_daily_call_limit: freeze({
    label: `AI calls per ${EXPLORER} per day`,
    note: `Reaching it pauses that ${EXPLORER} until the pause is lifted. A change takes effect at once.`,
  }),
  explorer_ai_use_shared_daily_calls_per_active_explorer: freeze({
    label: `Shared AI calls per active ${EXPLORER} per day`,
    note: "Reaching the shared total pauses everyone until midnight. A change takes effect at the next midnight, Chicago time.",
  }),
  explorer_ai_use_automatic_lifts_per_week: freeze({
    label: "Automatic lifts per week",
    note: "First pauses of a day lifted automatically for an account not in crisis. 0 turns them off.",
  }),
  explorer_ai_use_automatic_lifts_per_month: freeze({
    label: "Automatic lifts per month",
    note: "First pauses of a day lifted automatically for an account not in crisis. 0 turns them off.",
  }),
  explorer_shared_snapshot_sendability_days: freeze({
    label: "Days a Shared Snapshot can be sent",
    note: `How long an ${EXPLORER}'s Shared Snapshot stays sendable.`,
  }),
  suggested_waypoint_send_grace_seconds: freeze({
    label: "Seconds to pull back a Suggested Waypoint",
    note: `How long a ${GUIDE} can pull back a Suggested Waypoint before it is sent.`,
  }),
});

export const ADMIN_WORKSPACE_WORDING = freeze({
  eyebrow: ADMIN_MENU_LABELS.rail,
  signOut: "Sign out",
  signingOut: "Signing out...",
  loadFailed: "This information could not be loaded. Reload the page to try again.",
  chicagoTime: "Times are Chicago time.",
  reloading: "Reloading the page to show the current values...",
  yes: "Yes",
  no: "No",
  dashboard: freeze({
    headingId: "admin-dashboard-heading",
    title: "Dashboard",
    subtitle: "Counts for testing. Activity is counted by sign-ins only.",
    guides: `${GUIDE}s`,
    explorers: `${EXPLORER}s`,
    active: `${EXPLORER}s active in the last 7 days`,
    activeNote: "Counted by sign-ins.",
    paused: "Accounts paused now",
    pausedNote: "Paused by their own daily AI-use limit. A shared pause for everyone shows under AI use and pauses.",
  }),
  people: freeze({
    headingId: "admin-people-heading",
    title: `${GUIDE}s and ${EXPLORER}s`,
    subtitle: `Each ${GUIDE} and their ${EXPLORER}s. Sign-ins only: no conversation content, message dates or message counts.`,
    none: `No ${GUIDE}s yet.`,
    noExplorers: `No ${EXPLORER}s yet.`,
    explorer: EXPLORER,
    relationship: "Relationship",
    lastSignIn: "Last sign-in",
    pausedNow: "Paused now",
    pausedNote: `Paused now: "Yes" means paused by the ${EXPLORER}'s own daily AI-use limit. "Yes, shared pause" means only today's shared pause for everyone applies; it lifts at midnight, Chicago time. "No" means not paused.`,
    never: "Never",
  }),
  aiUse: freeze({
    headingId: "admin-ai-use-heading",
    title: "AI use and pauses",
    subtitle: "Who is paused now by the AI-use limits. Lifting a pause is recorded as Paul's lift.",
    pausedNow: "Paused now",
    none: "No one is paused now by their own daily limit.",
    explorer: EXPLORER,
    day: "Day",
    reached: "Reached",
    notRecorded: "Not recorded yet",
    notRecordedAction: `No stop is recorded for this pause, so it cannot be lifted here. To end it now, raise the limit on the Settings page above this ${EXPLORER}'s calls today; otherwise it ends at midnight, Chicago time.`,
    dayTotal: "Calls that day",
    limit: "Limit",
    crisis: "Crisis or urgent at the limit",
    action: "Action",
    lift: "Lift pause",
    lifting: "Lifting...",
    noShared: "No shared pause today.",
    shared: (reachedAt: string, dayTotal: string, limit: string) =>
      `Shared pause today: reached at ${reachedAt} with ${dayTotal} calls of ${limit}. It lifts at midnight, Chicago time.`,
  }),
  settings: freeze({
    headingId: "admin-settings-heading",
    title: "Settings",
    subtitle: "The six protected settings. Each change is saved one setting at a time and recorded as approved by Paul.",
    current: "Current value",
    range: (minimum: string, maximum: string) => `Allowed range: ${minimum} to ${maximum}`,
    defaultValue: (value: string) => `Default: ${value}`,
    newValue: "New value",
    save: "Save",
    saving: "Saving...",
    wholeNumber: "To save it, enter a whole number: each setting holds whole numbers only.",
  }),
});
