import { Children, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createInitialExplorerConversationState,
  toggleSupportPanel,
} from "@/lib/solmind/explorerCompassComparison";
import { ExplorerCompassComparison } from "../ExplorerCompassComparison";
import { PANEL_TOGGLE_ID, SUPPORT_DRAWER_ID } from "../ExplorerCompassComparisonParts";

const hooks = vi.hoisted(() => ({
  mounting: true,
  updateConversation: vi.fn(),
  requestFocus: vi.fn(),
  setLayout: vi.fn(),
}));

vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: (() => unknown) | "wide" | null) => {
    if (typeof initial === "function") return [initial(), hooks.updateConversation];
    if (initial === "wide") return [hooks.setLayout.mock.lastCall?.[0] ?? initial, hooks.setLayout];
    return [initial, hooks.requestFocus];
  },
  useEffect: (effect: () => void) => {
    if (hooks.mounting) effect();
  },
}));

afterEach(() => {
  hooks.mounting = true;
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("widening the Compass comparison screen", () => {
  it.each([
    { name: "a closed drawer and the focused composer", open: false, inside: false },
    { name: "an open drawer with focus in another dialog", open: true, inside: false },
    { name: "focus inside an open drawer", open: true, inside: true },
  ])("closes stale state and preserves or restores focus for $name", ({ open, inside }) => {
    const query = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal("window", { matchMedia: () => query });
    const drawerHeading = {};
    const drawer = {
      hasAttribute: (attribute: string) => attribute === "open" && open,
      contains: (element: unknown) => element === drawerHeading,
    };
    let mounted = true;
    hooks.setLayout.mockImplementation(layout => { mounted = layout === "narrow"; });
    vi.stubGlobal("document", {
      activeElement: inside ? drawerHeading : {},
      getElementById: (id: string) => mounted && id === SUPPORT_DRAWER_ID ? drawer : null,
    });

    ExplorerCompassComparison();
    hooks.mounting = false;
    query.matches = true;
    const screen = ExplorerCompassComparison();
    mounted = Children.toArray(screen.props.children).some(child =>
      isValidElement<{ id?: string }>(child) && child.props.id === SUPPORT_DRAWER_ID,
    );
    query.dispatchEvent(Object.assign(new Event("change"), { matches: true }));

    expect(hooks.setLayout.mock.calls).toEqual([["narrow"], ["wide"]]);
    const state = createInitialExplorerConversationState();
    const before = open ? toggleSupportPanel(state, "narrow") : state;
    const [closeDrawer] = hooks.updateConversation.mock.calls[0];
    expect(closeDrawer(before).supportPanel.narrowOpen).toBe(false);
    if (inside) {
      expect(hooks.requestFocus).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ focus: true, id: PANEL_TOGGLE_ID }),
      );
    } else {
      expect(hooks.requestFocus).not.toHaveBeenCalled();
    }
  });
});
