import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerConversationState, ExplorerConversationWaypoint } from "../../../lib/solmind/explorerConversationContract";
import { ConnectedWaypointCard, useConnectedWaypointActions } from "../ExplorerConnectedWaypointCard";

// The existing node test environment has no DOM renderer. Keep the card's real
// handlers and intent builders, and advance its hooks through committed frames.
// The routed browser tests separately exercise the actual React DOM and page.
const hooks = vi.hoisted(() => ({ stateIndex: 0, refIndex: 0, effectIndex: 0,
  values: [] as unknown[], refs: [] as { current: unknown }[],
  dependencies: [] as (readonly unknown[] | undefined)[],
  effects: [] as (() => void)[], dirty: false }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.stateIndex++;
    if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[index], (update: unknown) => {
      const next = typeof update === "function" ? update(hooks.values[index]) : update;
      if (!Object.is(next, hooks.values[index])) { hooks.values[index] = next; hooks.dirty = true; }
    }];
  },
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++;
    return hooks.refs[index] ?? (hooks.refs[index] = { current: initial });
  },
  useEffect: (effect: () => void, dependencies?: readonly unknown[]) => {
    const index = hooks.effectIndex++;
    const previous = hooks.dependencies[index];
    if (dependencies === undefined || previous === undefined || dependencies.length !== previous.length ||
        dependencies.some((value, offset) => !Object.is(value, previous[offset]))) hooks.effects.push(effect);
    hooks.dependencies[index] = dependencies;
  },
}));

type Props = { children?: ReactNode; id?: string; htmlFor?: string; hidden?: boolean;
  disabled?: boolean; checked?: boolean; value?: string; type?: string; role?: string;
  onClick?: () => void; "aria-expanded"?: boolean; "aria-label"?: string; "aria-hidden"?: boolean | "true" | "false";
  onChange?: (event: { target: { value: string; checked: boolean }; currentTarget: { value: string; checked: boolean } }) => void };
type Inputs = Parameters<typeof useConnectedWaypointActions>[0];
type Actions = ReturnType<typeof useConnectedWaypointActions>;

function expand(node: ReactNode): ReactNode {
  return Children.toArray(node).map(child => {
    if (!isValidElement<Props>(child)) return child;
    if (typeof child.type === "function") return expand((child.type as (props: Props) => ReactNode)(child.props));
    return createElement(child.type, child.props, expand(child.props.children));
  });
}
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => !isValidElement<Props>(child) || child.props.hidden ? []
    : [child, ...elements(child.props.children)]);
}
function words(node: ReactNode): string {
  return Children.toArray(node).map(child => isValidElement<Props>(child)
    ? child.props.hidden || child.props["aria-hidden"] === true || child.props["aria-hidden"] === "true"
      ? "" : words(child.props.children) : String(child)).join("");
}
function current(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: "conversation-a", revision: 3,
    sessionStatus: "active", pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
    providerState: "available", messages: [], compassItems: [], priorityId: null, attentionId: null,
    waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 1 },
    waypoints: [waypoint("a")], ...overrides };
}
function waypoint(suffix: string, overrides: Partial<ExplorerConversationWaypoint> = {}): ExplorerConversationWaypoint {
  return { id: `waypoint-${suffix}`, isCurrent: true, createdAt: "2026-11-13T16:00:00Z",
    sourceMessageId: "message-a", title: `Waypoint ${suffix}`, destination: `Destination ${suffix}`,
    meaning: `Meaning ${suffix}`, arrivalSignal: `Arrival signal ${suffix}`, status: "chosen", ...overrides };
}
function completed(kind: "reached" | "released", overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return current({ revision: 4, waypoints: [waypoint("a", kind === "reached"
    ? { status: "reached", reachedEvidence: "I arrived.", reachedAt: "2026-11-13T16:05:00Z" }
    : { release: { operationId: "release-a", releasedAt: "2026-11-13T16:05:00Z" } })], ...overrides });
}
function mounted(overrides: Partial<Inputs> = {}) {
  let inputs: Inputs = { state: current(), held: false, busy: false, pendingTurn: false, uncertain: false,
    onCommand: vi.fn(() => { inputs = { ...inputs, busy: true }; }), ...overrides };
  let actions: Actions;
  let tree: ReactNode;
  function Frame() {
    actions = useConnectedWaypointActions(inputs);
    return ConnectedWaypointCard({ scope: "panel", state: inputs.state, actions });
  }
  const draw = () => {
    for (let pass = 0; pass < 20; pass += 1) {
      hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effectIndex = 0;
      hooks.effects = []; hooks.dirty = false;
      tree = expand(Frame());
      for (const effect of hooks.effects) effect();
      if (!hooks.dirty) return;
    }
    throw new Error("The card did not settle after 20 frames.");
  };
  const findButton = (name: string) => elements(tree).find(element => element.type === "button" && words(element.props.children) === name);
  const button = (name: string) => {
    const found = findButton(name);
    expect(found, `button ${name}`).toBeDefined();
    return found!;
  };
  draw();
  return {
    get actions() { return actions!; },
    get onCommand() { return inputs.onCommand; },
    get tree() { return tree; },
    get text() { return words(tree); },
    button, findButton,
    update(next: Partial<Inputs>) { inputs = { ...inputs, ...next }; draw(); },
    click(name: string) { const control = button(name); expect(control.props.disabled).not.toBe(true); control.props.onClick!(); draw(); },
    open(suffix = "a") {
      const control = elements(tree).find(element => element.props.id === `panel-waypoint-row-waypoint-${suffix}-button`);
      expect(control, `row ${suffix}`).toBeDefined();
      if (control!.props["aria-expanded"] !== true) { control!.props.onClick!(); draw(); }
    },
    evidence(value: string) {
      const control = elements(tree).find(element => element.type === "textarea")!;
      expect(control).toBeDefined();
      control.props.onChange!({ target: { value, checked: false }, currentTarget: { value, checked: false } }); draw();
    },
    check(checked = true) {
      const control = elements(tree).find(element => element.type === "input" && element.props.type === "checkbox")!;
      expect(control).toBeDefined();
      control.props.onChange!({ target: { value: "", checked }, currentTarget: { value: "", checked } }); draw();
    },
  };
}
type Card = ReturnType<typeof mounted>;
function submit(card: Card, kind: "reached" | "released") {
  card.open();
  card.click(kind === "reached" ? "Mark Reached" : "Release");
  if (kind === "reached") card.evidence("  I arrived.\n ");
  card.check();
  card.click(kind === "reached" ? "Confirm Reached" : "Release this Waypoint");
}

beforeEach(() => {
  hooks.values = []; hooks.refs = []; hooks.dependencies = []; hooks.effects = [];
  vi.stubGlobal("document", { getElementById: vi.fn(() => null) });
});
afterEach(() => vi.unstubAllGlobals());

describe("Connected Waypoint card Reached and Release", () => {
  it("offers actions only inside the open current Formed row, with earlier versions kept read-only", () => {
    const card = mounted({ state: current({ waypoints: [waypoint("older", { isCurrent: false }),
      waypoint("a", { lifecycle: { predecessorWaypointId: "waypoint-older", creationReason: "revision", clarifications: [] } })] }) });
    expect(card.findButton("Mark Reached")).toBeUndefined();
    expect(card.findButton("Release")).toBeUndefined();
    card.open();
    expect(card.button("Mark Reached").props.disabled).not.toBe(true);
    expect(card.button("Release").props.disabled).not.toBe(true);
    expect(card.text).toContain("Earlier version - Formed");
    expect(elements(card.tree).filter(element => element.type === "button" && words(element.props.children) === "Release")).toHaveLength(1);
  });

  it.each(["Reached", "Released", "earlier version", "forming draft", "ended conversation"])(
    "offers neither action for a %s", scenario => {
      const state = scenario === "Reached" ? completed("reached") : scenario === "Released" ? completed("released")
        : scenario === "earlier version" ? current({ waypoints: [waypoint("a", { isCurrent: false })] })
          : scenario === "forming draft" ? current({ waypoints: [], waypointDraft: { id: "draft-a", title: "Forming draft",
            destination: "Draft destination", whyItMatters: "Draft meaning", arrivalSignal: "Draft arrival", suggestionMessageId: "message-a" } })
            : current({ sessionStatus: "ended" });
      const card = mounted({ state });
      for (const element of elements(card.tree).filter(item => item.type === "button")) {
        if (element.props.onClick) element.props.onClick();
      }
      card.update({});
      if (scenario === "Reached" || scenario === "Released" || scenario === "ended conversation") card.open();
      expect(card.findButton("Mark Reached")).toBeUndefined();
      expect(card.findButton("Release")).toBeUndefined();
      expect(card.onCommand).not.toHaveBeenCalled();
    });

  it.each(["held", "busy", "pendingTurn", "uncertain"] as const)(
    "disables both row actions and an open review while %s", flag => {
      const card = mounted();
      card.open();
      card.update({ [flag]: true });
      expect(card.button("Mark Reached").props.disabled).toBe(true);
      expect(card.button("Release").props.disabled).toBe(true);
      card.update({ [flag]: false });
      card.click("Mark Reached"); card.evidence("I arrived."); card.check();
      card.update({ [flag]: true });
      expect(card.button("Confirm Reached").props.disabled).toBe(true);
      expect(card.onCommand).not.toHaveBeenCalled();
    });

  it("shows every Reached review sentence and labels its arrival signal, evidence and checkbox", () => {
    const card = mounted(); card.open(); card.click("Mark Reached");
    for (const sentence of ["Review before confirming Reached",
      "To make sure Reached reflects your progress, review your arrival signal, enter supporting evidence and tick the confirmation box.",
      "Reached looks like", "Arrival signal a", "What supporting evidence shows arrival?",
      "I have reviewed my arrival signal and supporting evidence, and I confirm meaningful progress to this Waypoint."])
      expect(card.text).toContain(sentence);
    const group = elements(card.tree).find(element => element.props["aria-label"] === "Review before confirming Reached");
    expect(group).toBeDefined();
    const evidence = elements(card.tree).find(element => element.type === "textarea")!;
    expect(elements(card.tree).some(element => element.type === "label" && element.props.htmlFor === evidence.props.id &&
      words(element.props.children) === "What supporting evidence shows arrival?")).toBe(true);
    expect(card.button("Keep in progress").props.disabled).not.toBe(true);
  });

  it("requires confirmation and builder-valid evidence before enabling Confirm Reached", () => {
    const card = mounted(); card.open(); card.click("Mark Reached");
    expect(card.button("Confirm Reached").props.disabled).toBe(true);
    card.check();
    expect(card.button("Confirm Reached").props.disabled).toBe(true);
    for (const invalid of [" \n ", "a".repeat(1001), "bad\u0000evidence", "\ud800"]) {
      card.evidence(invalid); card.check();
      expect(card.button("Confirm Reached").props.disabled).toBe(true);
    }
    card.evidence("I arrived."); card.check(false);
    expect(card.button("Confirm Reached").props.disabled).toBe(true);
    card.check();
    expect(card.button("Confirm Reached").props.disabled).not.toBe(true);
    expect(card.onCommand).not.toHaveBeenCalled();
  });

  it("sends the existing confirm_reached intent with exactly trimmed supporting evidence", () => {
    const card = mounted(); submit(card, "reached");
    expect(card.onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "confirm_reached", waypointId: "waypoint-a", evidence: "I arrived." });
  });

  it("shows every Release review sentence and sends release_waypoint only after confirmation", () => {
    const card = mounted(); card.open(); card.click("Release");
    for (const sentence of ["Review before releasing this Waypoint",
      "Releasing stops treating this Waypoint as in progress. Its definition and history stay saved and private. This does not mark it Reached or share anything.",
      "Review this Waypoint and tick the confirmation box so you can check that you want to stop pursuing it while keeping its private history.",
      "I reviewed this Waypoint, and I choose to release it while keeping its private history."])
      expect(card.text).toContain(sentence);
    expect(card.text).not.toContain("reopen its conversation");
    expect(card.button("Release this Waypoint").props.disabled).toBe(true);
    expect(elements(card.tree).filter(element => element.type === "textarea")).toHaveLength(0);
    card.check();
    expect(card.button("Release this Waypoint").props.disabled).not.toBe(true);
    card.check(false);
    expect(card.button("Release this Waypoint").props.disabled).toBe(true);
    card.check(); card.click("Release this Waypoint");
    expect(card.onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "release_waypoint", waypointId: "waypoint-a" });
  });

  it.each(["reached", "released"] as const)("Keep in progress discards the %s review without sending", kind => {
    const card = mounted(); card.open(); card.click(kind === "reached" ? "Mark Reached" : "Release");
    if (kind === "reached") card.evidence("Unsaved evidence");
    card.check(); card.click("Keep in progress");
    expect(card.actions.review).toBeNull();
    expect(card.text).not.toContain("Review before");
    card.click(kind === "reached" ? "Mark Reached" : "Release");
    expect(card.actions.review?.confirmed).toBe(false);
    expect(card.actions.review?.evidence).toBe("");
    expect(card.onCommand).not.toHaveBeenCalled();
  });

  it("keeps one review across rows and discards the previous row's evidence and confirmation", () => {
    const card = mounted({ state: current({ waypoints: [waypoint("a"), waypoint("b")] }) });
    card.open(); card.click("Mark Reached"); card.evidence("Only for a"); card.check();
    card.open("b"); card.click("Release");
    expect(card.text).toContain("Review before releasing this Waypoint");
    expect(card.text).not.toContain("Review before confirming Reached");
    expect(card.actions.review).toMatchObject({ waypointId: "waypoint-b", kind: "released", evidence: "", confirmed: false });
    expect(elements(card.tree).filter(element => element.type === "input" && element.props.type === "checkbox")).toHaveLength(1);
    card.open();
    expect(card.text).not.toContain("Only for a");
    expect(card.onCommand).not.toHaveBeenCalled();
  });

  it.each(["reached", "released"] as const)("silently closes a stale %s review before it can submit", kind => {
    const card = mounted(); card.open(); card.click(kind === "reached" ? "Mark Reached" : "Release");
    if (kind === "reached") card.evidence("I arrived.");
    card.check();
    card.update({ state: current({ revision: 4 }) });
    expect(card.actions.review).toBeNull();
    expect(card.text).not.toContain("Review before");
    expect(card.text).not.toContain("Saved.");
    expect(card.onCommand).not.toHaveBeenCalled();
  });

  it("shows Saving only for its own dispatched command, inside that Waypoint's row", () => {
    const card = mounted({ state: current({ waypoints: [waypoint("a"), waypoint("b")] }) });
    card.open(); card.update({ busy: true });
    expect(card.text).not.toContain("Saving...");
    card.update({ busy: false }); submit(card, "released");
    card.update({ busy: true });
    const row = elements(card.tree).find(element => element.props.id === "panel-waypoint-row-waypoint-a")!;
    expect(words(row.props.children)).toContain("Saving...");
    expect(card.text.match(/Saving\.\.\./g)).toHaveLength(1);
    expect(card.text).not.toContain("Saved.");
  });

  it.each(["reached", "released"] as const)("shows the exact Saved line and new history stage only after confirmed %s state", kind => {
    const card = mounted(); submit(card, kind); card.update({ busy: true });
    card.update({ busy: true, state: completed(kind) });
    expect(card.text).not.toContain("Saved.");
    card.update({ busy: false });
    const sentence = kind === "reached" ? "Saved. This Waypoint is marked Reached." : "Saved. This Waypoint is released.";
    expect(card.text).toContain(sentence);
    expect(card.button("Reached and released (1)").props["aria-expanded"]).toBe(true);
    expect(card.text).toContain(kind === "reached" ? "Reached" : "Released");
    expect(card.actions.review).toBeNull();
    expect(card.findButton("Mark Reached")).toBeUndefined();
    expect(card.findButton("Release")).toBeUndefined();
    expect(card.text).not.toContain("Saving...");
  });

  it.each(["unchanged", "wrong stage", "same revision", "different conversation", "missing state", "uncertain"])(
    "adds no Saved or refusal line after a command with %s outcome", scenario => {
      const card = mounted(); submit(card, "released"); card.update({ busy: true });
      const state = scenario === "unchanged" ? current({ revision: 4 }) : scenario === "wrong stage" ? completed("reached")
        : scenario === "same revision" ? completed("released", { revision: 3 })
          : scenario === "different conversation" ? completed("released", { conversationId: "conversation-b" })
            : scenario === "missing state" ? null : current();
      card.update({ busy: false, state, uncertain: scenario === "uncertain" });
      expect(card.actions.review).toBeNull();
      expect(card.text).not.toMatch(/Saving\.\.\.|Saved\.|could not|nothing was saved|Retry/);
    });

  it("closes an uncertain review and recognizes the page Retry result without a second card request", () => {
    const card = mounted(); submit(card, "reached"); card.update({ busy: true });
    card.update({ busy: false, uncertain: true });
    expect(card.actions.review).toBeNull();
    expect(card.text).not.toMatch(/Review before|Saving\.\.\.|Saved\.|Retry/);
    expect(card.button("Mark Reached").props.disabled).toBe(true);
    expect(card.button("Release").props.disabled).toBe(true);
    card.update({ busy: true, uncertain: false });
    expect(card.text).toContain("Saving...");
    card.update({ busy: false, state: completed("reached") });
    expect(card.text).toContain("Saved. This Waypoint is marked Reached.");
    expect(card.onCommand).toHaveBeenCalledExactlyOnceWith({ kind: "confirm_reached", waypointId: "waypoint-a", evidence: "I arrived." });
  });

  it("discards a refused command so a later reload cannot claim that this card saved its stage", () => {
    const card = mounted(); submit(card, "released");
    card.update({ busy: false, state: null });
    expect(card.actions.review).toBeNull();
    card.update({ state: completed("released") });
    card.click("Reached and released (1)"); card.open();
    expect(card.text).not.toMatch(/Saving\.\.\.|Saved\.|Retry/);
    expect(card.onCommand).toHaveBeenCalledTimes(1);
  });
});
