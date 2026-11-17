import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExplorerConversationState, ExplorerConversationWaypoint } from "../../../lib/solmind/explorerConversationContract";
import { CONNECTED_WAYPOINT_WORDING } from "../../../lib/solmind/explorerConnectedCard";
import { ConnectedWaypointCard, useConnectedWaypointActions } from "../ExplorerConnectedWaypointCard";

// Offers build, step 4, items 8 and 10: the Compass & Waypoint card after a confirmed change or revisit offer (no
// new control), and the approved sentence for a review that the conversation overtook. The frame harness is the
// one of ExplorerConnectedWaypointCard.test.tsx (the node test environment has no DOM renderer). Invented content only.
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

type Props = { children?: ReactNode; id?: string; hidden?: boolean; disabled?: boolean; type?: string;
  onClick?: () => void; "aria-expanded"?: boolean; "aria-hidden"?: boolean | "true" | "false";
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
function waypoint(suffix: string, overrides: Partial<ExplorerConversationWaypoint> = {}): ExplorerConversationWaypoint {
  return { id: `waypoint-${suffix}`, isCurrent: true, createdAt: "2026-11-16T09:00:00Z",
    sourceMessageId: "message-a", title: `Waypoint ${suffix}`, destination: `Destination ${suffix}`,
    meaning: `Meaning ${suffix}`, arrivalSignal: `Arrival signal ${suffix}`, status: "chosen", ...overrides };
}
function current(overrides: Partial<ExplorerConversationState> = {}): ExplorerConversationState {
  return { version: "explorer-conversation.v1", conversationId: "conversation-a", revision: 3,
    sessionStatus: "active", pendingTurn: false, turnedDownLimitReached: false, waypointDraft: null,
    providerState: "available", messages: [], compassItems: [], priorityId: null, attentionId: null,
    waypointCapacity: { activeCount: 1, activeLimit: 20, historyRoom: true, conversationRoom: true },
    waypointProjection: { kind: "current_heads", limit: 20, hasMore: false, totalHeads: 1 },
    waypoints: [waypoint("a")], ...overrides };
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
  const rowButton = (suffix: string) => elements(tree).find(element => element.props.id === `panel-waypoint-row-waypoint-${suffix}-button`);
  draw();
  return {
    get actions() { return actions!; },
    get onCommand() { return inputs.onCommand; },
    get tree() { return tree; },
    get text() { return words(tree); },
    button, findButton, rowButton,
    buttonNames() { return elements(tree).filter(element => element.type === "button").map(element => words(element.props.children)); },
    row(suffix: string) { return words(elements(tree).find(element => element.props.id === `panel-waypoint-row-waypoint-${suffix}`)?.props.children); },
    update(next: Partial<Inputs>) { inputs = { ...inputs, ...next }; draw(); },
    click(name: string) { const control = button(name); expect(control.props.disabled).not.toBe(true); control.props.onClick!(); draw(); },
    open(suffix = "a") {
      const control = rowButton(suffix);
      expect(control, `row ${suffix}`).toBeDefined();
      if (control!.props["aria-expanded"] !== true) { control!.props.onClick!(); draw(); }
    },
    evidence(value: string) {
      const control = elements(tree).find(element => element.type === "textarea")!;
      control.props.onChange!({ target: { value, checked: false }, currentTarget: { value, checked: false } }); draw();
    },
    check(checked = true) {
      const control = elements(tree).find(element => element.type === "input" && element.props.type === "checkbox")!;
      control.props.onChange!({ target: { value: "", checked }, currentTarget: { value: "", checked } }); draw();
    },
  };
}

beforeEach(() => {
  hooks.values = []; hooks.refs = []; hooks.dependencies = []; hooks.effects = [];
  vi.stubGlobal("document", { getElementById: vi.fn(() => null) });
});
afterEach(() => vi.unstubAllGlobals());

const GAP = "The conversation changed while this review was open. No change was sent from this review. Check this Waypoint's current status before trying again.";

describe("offers build step 4, item 10: the review that the conversation overtook", () => {
  it("keeps the approved sentence in the card's wording object, word for word", () => {
    expect(CONNECTED_WAYPOINT_WORDING.reviewChanged).toBe(GAP);
  });

  it.each(["Mark Reached", "Release"] as const)("closes an open %s review as before and says why in that Waypoint's row", opener => {
    const card = mounted({ state: current({ waypoints: [waypoint("a"), waypoint("b")] }) });
    card.open(); card.click(opener);
    if (opener === "Mark Reached") card.evidence("An invented observation.");
    card.check();
    expect(card.text).not.toContain(GAP);
    card.update({ state: current({ revision: 4, waypoints: [waypoint("a"), waypoint("b")] }) });
    expect(card.actions.review).toBeNull();
    expect(card.text).not.toContain("Review before");
    expect(card.row("a")).toContain(GAP);
    expect(card.text.split(GAP)).toHaveLength(2);
    expect(card.text).not.toContain("Saved.");
    expect(card.onCommand).not.toHaveBeenCalled();
    // The buttons are available again; opening a review clears the sentence.
    card.click("Mark Reached");
    expect(card.text).not.toContain(GAP);
    expect(card.text).toContain("Review before confirming Reached");
  });

  it("keeps the sentence through later saved states of the same conversation, in that row only", () => {
    const card = mounted({ state: current({ waypoints: [waypoint("a"), waypoint("b")] }) });
    card.open(); card.click("Release");
    card.update({ state: current({ revision: 4, waypoints: [waypoint("a"), waypoint("b")] }) });
    card.update({ state: current({ revision: 5, waypoints: [waypoint("a"), waypoint("b")] }) });
    expect(card.row("a")).toContain(GAP);
    card.open("b");
    expect(card.row("b")).not.toContain(GAP);
  });

  it("shows it in the next version's row when a confirmed change replaced the Waypoint under the review", () => {
    const card = mounted(); card.open(); card.click("Mark Reached");
    const changed = waypoint("a2", { title: "Waypoint a, reworded", lifecycle: { predecessorWaypointId: "waypoint-a", creationReason: "revision", clarifications: [] } });
    card.update({ state: current({ revision: 4, waypoints: [changed] }) });
    expect(card.actions.review).toBeNull();
    expect(card.rowButton("a2")!.props["aria-expanded"]).toBe(true);
    expect(card.row("a2")).toContain(GAP);
  });

  it("shows it in the Reached and released group when the Waypoint was marked Reached meanwhile", () => {
    const card = mounted(); card.open(); card.click("Release");
    card.update({ state: current({ revision: 4, waypoints: [waypoint("a", { status: "reached", reachedEvidence: "An invented observation.", reachedAt: "2026-11-16T09:05:00Z" })] }) });
    expect(card.button("Reached and released (1)").props["aria-expanded"]).toBe(true);
    expect(card.row("a")).toContain(GAP);
    expect(card.findButton("Mark Reached")).toBeUndefined();
  });

  it("says nothing after the review's own confirmed save, a refused or unknown outcome, an ended conversation or a lost state", () => {
    const saved = mounted(); saved.open(); saved.click("Release"); saved.check(); saved.click("Release this Waypoint");
    saved.update({ busy: true });
    saved.update({ busy: false, state: current({ revision: 4, waypoints: [waypoint("a", { release: { operationId: "release-a", releasedAt: "2026-11-16T09:05:00Z" } })] }) });
    expect(saved.text).toContain("Saved. This Waypoint is released.");
    expect(saved.text).not.toContain(GAP);

    hooks.values = []; hooks.refs = []; hooks.dependencies = [];
    const uncertain = mounted(); uncertain.open(); uncertain.click("Release"); uncertain.check(); uncertain.click("Release this Waypoint");
    uncertain.update({ busy: true }); uncertain.update({ busy: false, uncertain: true });
    expect(uncertain.text).not.toContain(GAP);

    hooks.values = []; hooks.refs = []; hooks.dependencies = [];
    const ended = mounted(); ended.open(); ended.click("Mark Reached");
    ended.update({ state: current({ revision: 4, sessionStatus: "ended" }) });
    expect(ended.actions.review).toBeNull();
    expect(ended.text).not.toContain(GAP);

    hooks.values = []; hooks.refs = []; hooks.dependencies = [];
    const lost = mounted(); lost.open(); lost.click("Mark Reached");
    lost.update({ state: null });
    expect(lost.text).not.toContain(GAP);
    lost.update({ state: current({ conversationId: "conversation-b", revision: 9 }) });
    expect(lost.text).not.toContain(GAP);
  });

  it("drops the sentence when the conversation ends or another conversation is shown", () => {
    const card = mounted(); card.open(); card.click("Release");
    card.update({ state: current({ revision: 4 }) });
    expect(card.row("a")).toContain(GAP);
    card.update({ state: current({ revision: 5, sessionStatus: "ended" }) });
    expect(card.text).not.toContain(GAP);
  });
});

describe("offers build step 4, item 8: the card after a confirmed offer, with no new control", () => {
  it("shows the new wording after a change, and only the existing controls", () => {
    const card = mounted(); card.open();
    const before = card.buttonNames();
    const changed = waypoint("a2", { title: "Waypoint a", destination: "Destination a, said more clearly",
      lifecycle: { predecessorWaypointId: "waypoint-a", creationReason: "revision", clarifications: [] } });
    card.update({ state: current({ revision: 4, waypoints: [changed] }) });
    expect(card.rowButton("a")).toBeUndefined();
    card.open("a2");
    expect(card.row("a2")).toContain("Destination a, said more clearly");
    expect(card.text).not.toMatch(/Destination a(?!,)/);
    expect(words(card.rowButton("a2")!.props.children)).toContain("Formed");
    expect(card.buttonNames().filter(name => !name.includes("Waypoint a"))).toEqual(before.filter(name => !name.includes("Waypoint a")));
    expect(card.buttonNames().filter(name => name === "Mark Reached" || name === "Release")).toEqual(["Mark Reached", "Release"]);
    for (const absent of ["That's right", "Proposed change", "Take up again", "Yes, mark it Reached"]) expect(card.text).not.toContain(absent);
  });

  it.each([
    ["Reached", { status: "reached" as const, reachedEvidence: "An invented observation.", reachedAt: "2026-11-16T09:05:00Z" }],
    ["Released", { release: { operationId: "release-a", releasedAt: "2026-11-16T09:05:00Z" } }],
  ])("after a revisit the %s row leaves the Reached and released group", (_stage, closed) => {
    const card = mounted({ state: current({ waypoints: [waypoint("a", closed)] }) });
    expect(card.findButton("Reached and released (1)")).toBeDefined();
    expect(card.rowButton("a")).toBeUndefined();
    const again = waypoint("a2", { title: "Waypoint a", lifecycle: { predecessorWaypointId: "waypoint-a", creationReason: "revisit", clarifications: [] } });
    card.update({ state: current({ revision: 4, waypoints: [again] }) });
    expect(card.text).not.toContain("Reached and released");
    expect(card.rowButton("a2")).toBeDefined();
    expect(words(card.rowButton("a2")!.props.children)).toContain("Formed");
    card.open("a2");
    expect(card.buttonNames().filter(name => name === "Mark Reached" || name === "Release")).toEqual(["Mark Reached", "Release"]);
  });
});
