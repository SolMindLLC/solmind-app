import { useLayoutEffect, useRef, type ReactNode } from "react";

import type { ScreenSupportData } from "@/lib/solmind/explorerConversationScreenDisplay";

import { CompassSection, type CompassView } from "./ExplorerConversationScreenCompassPanel";
import { FutureActionsSection } from "./ExplorerConversationScreenFutureActions";
import { CONVERSATION_HEADING_ID, PANEL_TOGGLE_ID } from "./ExplorerConversationScreenHeader";
import { IconClose } from "./ExplorerConversationScreenIcons";
import {
  FOCUS_RING,
  LayoutOnlyTag,
  QUIET_BUTTON,
  joinClasses,
} from "./ExplorerConversationScreenNotYetImplemented";
import { KeyInsightSection, WaypointSection } from "./ExplorerConversationScreenWaypointCard";

export const SUPPORT_PANEL_ID = "conversation-preview-panel";
export const SUPPORT_DRAWER_ID = "conversation-preview-drawer";
const PANEL_HEADING_ID = "conversation-preview-panel-heading";
const DRAWER_HEADING_ID = "conversation-preview-drawer-heading";

// Copied from the S01R2 drawer class and kept unchanged.
const DRAWER_DIALOG_CLASS =
  "fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-md overflow-hidden border-0 border-l border-amber-200/15 bg-[#080706] p-0 text-stone-100 backdrop:bg-black/70 open:flex open:flex-col";

export type SupportScope = "panel" | "drawer";

type LayoutProps = Readonly<{
  support: ScreenSupportData;
  compassView: CompassView;
  onToggleCompassView: () => void;
  quotesOpen: boolean;
  onQuotesToggle: (open: boolean) => void;
}>;

type FrameProps = Readonly<{
  scope: SupportScope;
  headingId: string;
  onClose?: () => void;
  // The connected screen's Close button is a real control, so it carries no
  // "Layout only" tag or preview marker.
  connected: boolean;
  children: ReactNode;
}>;

// The panel heading, the drawer's Close button and the scrolling body.
function SupportPanelFrame({ scope, headingId, onClose, connected, children }: FrameProps) {
  const isDrawer = scope === "drawer";

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
          <p className="mt-0.5 text-xs text-stone-400">Supports this conversation. Private to you.</p>
        </div>
        {onClose ? (
          <div className="flex flex-col items-end gap-1.5">
            <button
              className={joinClasses(QUIET_BUTTON, "border border-stone-700")}
              data-preview-control={connected ? undefined : "layout"}
              onClick={onClose}
              type="button"
            >
              <IconClose />
              Close
              <span className="sr-only"> Compass &amp; Waypoint</span>
            </button>
            {connected ? null : <LayoutOnlyTag />}
          </div>
        ) : null}
      </div>
      <div className={isDrawer ? "min-h-0 flex-1 overflow-y-auto" : undefined}>{children}</div>
    </div>
  );
}

// The preview's written sample sections.
function PreviewSupportBody({
  support,
  scope,
  compassView,
  onToggleCompassView,
  quotesOpen,
  onQuotesToggle,
}: LayoutProps & Readonly<{ scope: SupportScope }>) {
  return (
    <>
      <CompassSection compass={support.compass} onToggleView={onToggleCompassView} scope={scope} view={compassView} />
      <WaypointSection
        explorerSpeakerLabel={support.explorerSpeakerLabel}
        onQuotesToggle={onQuotesToggle}
        quotesOpen={quotesOpen}
        scope={scope}
        waypoint={support.waypoint}
      />
      <FutureActionsSection compass={support.compass} guideName={support.guideName} scope={scope} />
      <KeyInsightSection keyInsight={support.keyInsight} nextDirection={support.nextDirection} scope={scope} />
    </>
  );
}

type PanelShellProps = Readonly<{ visible: boolean; connected: boolean; children: ReactNode }>;

// The sticky panel on wide screens (64rem and wider). It stays in the page
// when hidden so the toggle's aria-controls always points at it.
function SupportPanelAside({ visible, connected, children }: PanelShellProps) {
  return (
    <aside
      aria-labelledby={PANEL_HEADING_ID}
      className={joinClasses(
        "hidden min-h-0 w-[23rem] shrink-0 flex-col overflow-y-auto rounded-3xl border border-stone-800 bg-[#090807]/85 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-2.5rem)] xl:w-[25rem]",
        visible ? "lg:flex" : "",
      )}
      id={SUPPORT_PANEL_ID}
    >
      <SupportPanelFrame connected={connected} headingId={PANEL_HEADING_ID} scope="panel">
        {children}
      </SupportPanelFrame>
    </aside>
  );
}

export function SupportPanel({ visible, ...layout }: LayoutProps & Readonly<{ visible: boolean }>) {
  return (
    <SupportPanelAside connected={false} visible={visible}>
      <PreviewSupportBody {...layout} scope="panel" />
    </SupportPanelAside>
  );
}

// The connected screen's panel: the caller supplies the body for each scope.
export function ConnectedSupportPanel({
  visible,
  renderBody,
}: Readonly<{ visible: boolean; renderBody: (scope: SupportScope) => ReactNode }>) {
  return (
    <SupportPanelAside connected visible={visible}>
      {renderBody("panel")}
    </SupportPanelAside>
  );
}

// True only when the element is in the page and actually drawn (a display:none
// element, such as the drawer opener on a wide screen, has no client rects).
function isRendered(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element && element.isConnected && element.getClientRects().length > 0);
}

// Where focus goes when the drawer closes: the saved opener if it is still
// drawn; otherwise (for example after widening the window while the drawer
// was open) the visible wide-screen panel toggle; otherwise the conversation
// heading.
function focusAfterClose(saved: HTMLElement | null) {
  const candidates = [saved, document.getElementById(PANEL_TOGGLE_ID), document.getElementById(CONVERSATION_HEADING_ID)];
  candidates.find(isRendered)?.focus();
}

type DrawerDialogProps = Readonly<{ open: boolean; onClose: () => void; connected: boolean; children: ReactNode }>;

// The same content in a native modal drawer on narrow screens. Its content
// renders only while open.
function SupportDrawerDialog({ open, onClose, connected, children }: DrawerDialogProps) {
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
      document.getElementById(DRAWER_HEADING_ID)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      const saved = returnFocusRef.current;
      returnFocusRef.current = null;
      focusAfterClose(saved);
    }
  }, [open]);

  return (
    <dialog
      aria-label="Compass & Waypoint"
      className={DRAWER_DIALOG_CLASS}
      id={SUPPORT_DRAWER_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      {open ? (
        <SupportPanelFrame connected={connected} headingId={DRAWER_HEADING_ID} onClose={onClose} scope="drawer">
          {children}
        </SupportPanelFrame>
      ) : null}
    </dialog>
  );
}

export function SupportDrawer({
  open,
  onClose,
  ...layout
}: LayoutProps & Readonly<{ open: boolean; onClose: () => void }>) {
  return (
    <SupportDrawerDialog connected={false} onClose={onClose} open={open}>
      <PreviewSupportBody {...layout} scope="drawer" />
    </SupportDrawerDialog>
  );
}

// The connected screen's drawer: the caller supplies the body for each scope.
export function ConnectedSupportDrawer({
  open,
  onClose,
  renderBody,
}: Readonly<{ open: boolean; onClose: () => void; renderBody: (scope: SupportScope) => ReactNode }>) {
  return (
    <SupportDrawerDialog connected onClose={onClose} open={open}>
      {renderBody("drawer")}
    </SupportDrawerDialog>
  );
}
