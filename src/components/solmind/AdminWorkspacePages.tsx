import type { ReactNode } from "react";

import type {
  AdminAiUseView,
  AdminPeopleGuideView,
  AdminSettingView,
  AdminWorkspaceView,
} from "@/lib/solmind/adminWorkspaceContract";
import { ADMIN_WORKSPACE_FRAMES } from "@/lib/solmind/adminWorkspaceFrame";
import {
  ADMIN_PEOPLE_PAUSE_LABELS,
  ADMIN_RELATIONSHIP_LABELS,
  ADMIN_SETTING_LABELS,
  ADMIN_WORKSPACE_WORDING,
  formatAdminCount,
} from "@/lib/solmind/adminWorkspaceWording";

import { AdminDashboardCounts } from "./AdminDashboardHome";
import { AdminLiftPauseButton, AdminSettingChangeForm } from "./AdminWorkspaceActions";
import { HomeCard, HomeHeader, HomeSessionWarning, HomeSignOut } from "./WorkspaceHomeParts";
import { WorkspaceFrame } from "./WorkspaceFrame";

// The minimal functional Admin screens (PRJ01_R-WS03-WI014; decision queue
// 2026-11-03 11:52:57, 11:56:14 and 12:19:09) in the Admin workspace frame:
// Dashboard, Guides and Explorers, AI use and pauses, and Settings, as plain
// dark-and-amber cards and tables in the existing look. No charts, filters,
// paging or search. Presentation only: AdminHome.tsx keeps every session,
// timer, page-event, sign-out and outcome rule and passes the server's display
// data, the pending and warning flags and the sign-out action. While a sign-out
// is pending every menu link shows in its non-link form and the write controls
// are disabled. Activity is by sign-ins only; apart from the recorded hard-stop
// facts Paul approved as Admin review flags (2026-11-01 01:00:16: day, time
// reached, that day's total calls, the limit; 2026-11-01 12:27:07: crisis or
// urgent status at the stop), no Admin page shows conversation content, message
// dates or message counts. Paul may throw them away.

const W = ADMIN_WORKSPACE_WORDING;
const HEADINGS = {
  dashboard: W.dashboard,
  people: W.people,
  aiUse: W.aiUse,
  settings: W.settings,
} as const;

const TABLE = "w-full min-w-[36rem] border-collapse text-left text-sm";
const TH = "pb-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300";
const TD = "border-t border-amber-200/10 py-2.5 pr-4 align-top text-stone-200";
const NOTE = "text-sm leading-6 text-stone-300";

function LoadFailed() {
  return <p className="max-w-3xl rounded-2xl border border-amber-400/70 bg-amber-950/60 p-4 text-sm leading-6 text-amber-50" role="status">{W.loadFailed}</p>;
}

// A table that scrolls sideways inside its card on a phone, never the page.
function Table({ head, children }: Readonly<{ head: readonly string[]; children: ReactNode }>) {
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>{head.map((label) => <th className={TH} key={label} scope="col">{label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function People({ guides }: Readonly<{ guides: readonly AdminPeopleGuideView[] }>) {
  if (guides.length === 0) return <p className={NOTE}>{W.people.none}</p>;
  return (
    <div className="grid gap-5">
      <p className={NOTE}>{W.chicagoTime}</p>
      <p className={NOTE}>{W.people.pausedNote}</p>
      {guides.map((guide, index) => (
        <HomeCard id={`admin-people-guide-${index}`} key={index} title={guide.name}>
          {guide.explorers.length === 0 ? <p className={NOTE}>{W.people.noExplorers}</p> : (
            <Table head={[W.people.explorer, W.people.relationship, W.people.lastSignIn, W.people.pausedNow]}>
              {guide.explorers.map((explorer, row) => (
                <tr key={row}>
                  <td className={TD}>{explorer.name}</td>
                  <td className={TD}>{ADMIN_RELATIONSHIP_LABELS[explorer.relationshipStatus]}</td>
                  <td className={TD}>{explorer.lastSignIn ?? W.people.never}</td>
                  <td className={TD}>{ADMIN_PEOPLE_PAUSE_LABELS[explorer.pausedNow]}</td>
                </tr>
              ))}
            </Table>
          )}
        </HomeCard>
      ))}
    </div>
  );
}

function AiUse({ aiUse, pending }: Readonly<{ aiUse: AdminAiUseView; pending: boolean }>) {
  const shared = aiUse.sharedStop;
  return (
    <div className="grid gap-5">
      <p className={NOTE}>{W.chicagoTime}</p>
      <HomeCard id="admin-ai-use-pauses" title={W.aiUse.pausedNow}>
        {aiUse.pauses.length === 0 ? <p className={NOTE}>{W.aiUse.none}</p> : (
          <Table head={[W.aiUse.explorer, W.aiUse.day, W.aiUse.reached, W.aiUse.dayTotal, W.aiUse.limit, W.aiUse.crisis, W.aiUse.action]}>
            {aiUse.pauses.map((pause, index) => pause.kind === "recorded" ? (
              <tr key={pause.stopId}>
                <td className={TD}>{pause.explorerName}</td>
                <td className={TD}>{pause.stopDay}</td>
                <td className={TD}>{pause.reachedAt}</td>
                <td className={TD}>{formatAdminCount(pause.dayTotal)}</td>
                <td className={TD}>{formatAdminCount(pause.limit)}</td>
                <td className={TD}>{pause.inCrisisAtStop ? W.yes : W.no}</td>
                <td className={TD}><AdminLiftPauseButton disabled={pending} stopId={pause.stopId} /></td>
              </tr>
            ) : (
              // A pause by the Explorer's own limit that no stop records: no
              // stop to lift, no time reached and no crisis status.
              <tr key={`not-recorded-${index}`}>
                <td className={TD}>{pause.explorerName}</td>
                <td className={TD}>{pause.stopDay}</td>
                <td className={TD}>{W.aiUse.notRecorded}</td>
                <td className={TD}>{formatAdminCount(pause.dayTotal)}</td>
                <td className={TD}>{formatAdminCount(pause.limit)}</td>
                <td className={TD}>{W.aiUse.notRecorded}</td>
                <td className={TD}>{W.aiUse.notRecordedAction}</td>
              </tr>
            ))}
          </Table>
        )}
        <p className={NOTE}>
          {shared === null ? W.aiUse.noShared
            : W.aiUse.shared(shared.reachedAt, formatAdminCount(shared.dayTotal), formatAdminCount(shared.limit))}
        </p>
      </HomeCard>
    </div>
  );
}

function Settings({ settings, pending }: Readonly<{ settings: readonly AdminSettingView[]; pending: boolean }>) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {settings.map((setting) => (
        <HomeCard id={`admin-setting-card-${setting.key}`} key={setting.key} title={ADMIN_SETTING_LABELS[setting.key].label}>
          <p className="text-[11px] text-stone-400">{setting.key}</p>
          <p className="text-sm text-stone-200">
            {`${W.settings.current}: `}<span className="font-semibold text-amber-200">{formatAdminCount(setting.value)}</span>
          </p>
          <p className={NOTE}>
            {`${W.settings.range(formatAdminCount(setting.minimum), formatAdminCount(setting.maximum))}. `}
            {`${W.settings.defaultValue(formatAdminCount(setting.defaultValue))}.`}
          </p>
          <p className={NOTE}>{ADMIN_SETTING_LABELS[setting.key].note}</p>
          <AdminSettingChangeForm disabled={pending} setting={setting} />
        </HomeCard>
      ))}
    </div>
  );
}

function Content({ view, pending }: Readonly<{ view: AdminWorkspaceView; pending: boolean }>) {
  switch (view.page) {
    case "dashboard":
      return view.overview === null ? <LoadFailed /> : <AdminDashboardCounts overview={view.overview} />;
    case "people":
      return view.guides === null ? <LoadFailed /> : <People guides={view.guides} />;
    case "aiUse":
      return view.aiUse === null ? <LoadFailed /> : <AiUse aiUse={view.aiUse} pending={pending} />;
    case "settings":
      return view.settings === null ? <LoadFailed /> : <Settings pending={pending} settings={view.settings} />;
  }
}

type PageProps = Readonly<{ view: AdminWorkspaceView; pending: boolean; warning: boolean; onSignOut: () => void }>;

export function AdminWorkspacePage({ view, pending, warning, onSignOut }: PageProps) {
  const heading = HEADINGS[view.page];
  return (
    <WorkspaceFrame frame={ADMIN_WORKSPACE_FRAMES[view.page]} linksDisabled={pending} skipTargetId={heading.headingId}>
      <div className="grid gap-6 px-3 pb-10 pt-5 sm:px-6 lg:px-8">
        <HomeHeader eyebrow={W.eyebrow} headingId={heading.headingId} subtitle={heading.subtitle} title={heading.title} />
        <Content pending={pending} view={view} />
        <HomeSessionWarning shown={warning} />
        <HomeSignOut label={W.signOut} onSignOut={onSignOut} pending={pending} pendingLabel={W.signingOut} />
      </div>
    </WorkspaceFrame>
  );
}
