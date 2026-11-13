import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversationTour } from "../ExplorerConversationTour";
import { EXPLORER_TOUR_STEPS } from "../../../lib/solmind/explorerConversationTour";

const hooks = vi.hoisted(() => ({ step: { index: 0, announce: false }, refs: [] as { current: unknown }[], refIndex: 0,
  effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => { hooks.refIndex = 0; return [hooks.step, (value: typeof hooks.step) => { hooks.step = value; }]; },
  useRef: () => { const index = hooks.refIndex++; return hooks.refs[index] ?? (hooks.refs[index] = { current: null }); },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));

type ElementProps = { children?: ReactNode; onClick?: () => void; role?: string; id?: string; className?: string;
  "aria-describedby"?: string;
  onCancel?: (event: { preventDefault: () => void }) => void };
function elements(node: ReactNode): ReactElement<ElementProps>[] {
  return Children.toArray(node).flatMap(child => isValidElement<ElementProps>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function button(tree: ReactNode, label: string) {
  const found = elements(tree).find(element => element.type === "button" && element.props.children === label);
  expect(found).toBeDefined();
  return found!;
}
function controls(tree: ReactNode) {
  return elements(tree).filter(element => element.type === "button"
    && !EXPLORER_TOUR_STEPS.some(step => step.title === element.props.children));
}
beforeEach(() => { hooks.step = { index: 0, announce: false }; hooks.refs = []; hooks.refIndex = 0; hooks.effects = []; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

describe("Fixed conversation tour", () => {
  it("shows and announces the six approved automatic Compass paragraphs in their exact order", () => {
    const approvedParagraphs = [
      "A Compass point names something that may matter to you, so you can keep it in view while the conversation moves.",
      "Points appear by themselves: when a topic has clearly come up a few times, your Virtual Guide adds it to the Compass.",
      "When a reply changes your Compass, quiet text below that reply explains the change and stays for this visit.",
      "The order can change as your Virtual Guide learns what matters most to you. An early topic can also start at the top without being what matters most.",
      "If a point does not fit, tell your Virtual Guide what needs changing so it can correct the Compass. If your meaning is unclear, it asks.",
      "To turn the conversation to another point, choose it on the dial or in Compact view when the point controls are available.",
    ];
    let tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    button(tree, "How the Compass works").props.onClick?.();
    tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    const step = elements(tree).find(element => element.props.id === "conversation-tour-step");
    expect(step).toBeDefined();
    expect(elements(step!.props.children).filter(element => element.type === "li")
      .map(element => element.props.children)).toEqual(approvedParagraphs);
    const announcements = elements(tree).filter(element => element.props.role === "status");
    expect(announcements).toHaveLength(1);
    expect(announcements[0].props.children).toBe(["How the Compass works", ...approvedParagraphs].join(" "));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("opens a modal, focuses its title describing the first step once, and restores its opener on close", () => {
    const opener = { isConnected: true, focus: vi.fn() };
    const onClose = vi.fn();
    const tree = ExplorerConversationTour({ opener: opener as unknown as HTMLElement, onClose });
    const dialog = { showModal: vi.fn(), close: vi.fn() };
    const heading = { focus: vi.fn() };
    hooks.refs[0].current = dialog;
    hooks.refs[1].current = heading;
    const cleanup = hooks.effects[0]();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(heading.focus).toHaveBeenCalledOnce();
    expect(hooks.effects).toHaveLength(2);
    const title = elements(tree).find(element => element.props.id === "conversation-tour-title");
    expect(title?.props["aria-describedby"]).toBe("conversation-tour-step");
    expect(elements(tree).find(element => element.props.role === "status")?.props.children).toBe("");
    const preventDefault = vi.fn();
    tree.props.onCancel({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    if (cleanup) cleanup();
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(opener.focus).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers each topic and advances one announced step at a time, without a request", () => {
    const onClose = vi.fn();
    let tree = ExplorerConversationTour({ opener: null, onClose });
    for (const step of EXPLORER_TOUR_STEPS) expect(button(tree, step.title)).toBeDefined();
    for (const [index, step] of EXPLORER_TOUR_STEPS.entries()) {
      const html = renderToStaticMarkup(tree);
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('role="status"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain(step.title);
      const announcements = elements(tree).filter(element => element.props.role === "status");
      expect(announcements).toHaveLength(1);
      expect(announcements[0].props.children).toBe(index === 0 ? "" : [step.title, ...step.paragraphs].join(" "));
      // Navigation leaves focus on its button; no step effect moves it to a heading.
      expect(hooks.effects).toHaveLength((index + 1) * 2);
      for (const [otherIndex, other] of EXPLORER_TOUR_STEPS.entries()) {
        for (const paragraph of other.paragraphs) {
          const escaped = paragraph.replaceAll("'", "&#x27;").replaceAll('"', "&quot;");
          if (index === otherIndex) expect(html).toContain(escaped);
          else expect(html).not.toContain(escaped);
        }
      }
      button(tree, index === 2 ? "Back to the conversation" : "Next step").props.onClick?.();
      tree = ExplorerConversationTour({ opener: null, onClose });
    }
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets each topic button select its step and the back control stop the tour", () => {
    const onClose = vi.fn();
    let tree = ExplorerConversationTour({ opener: null, onClose });
    for (const index of [2, 0, 1]) {
      button(tree, EXPLORER_TOUR_STEPS[index].title).props.onClick?.();
      expect(hooks.step).toEqual({ index, announce: true });
      tree = ExplorerConversationTour({ opener: null, onClose });
    }
    button(tree, "Back to the conversation").props.onClick?.();
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers only Next step and Back on the first two steps, then only Back", () => {
    let tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    for (const index of [0, 1, 2]) {
      expect(controls(tree).map(control => control.props.children)).toEqual(index === 2
        ? ["Back to the conversation"] : ["Next step", "Back to the conversation"]);
      expect(elements(tree).filter(element => element.type === "nav"))
        .toHaveLength(1);
      if (index < 2) {
        button(tree, "Next step").props.onClick?.();
        tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
      }
    }
  });

  it("draws one ordered bullet list per step with the approved conversation and Waypoint endings", () => {
    let tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    for (const [index, step] of EXPLORER_TOUR_STEPS.entries()) {
      const section = elements(tree).find(element => element.props.id === "conversation-tour-step");
      const lists = elements(section!.props.children).filter(element => element.type === "ul");
      expect(lists).toHaveLength(1);
      expect(elements(lists[0].props.children).filter(element => element.type === "li")
        .map(element => element.props.children)).toEqual(step.paragraphs);
      expect(elements(lists[0].props.children).filter(element => element.type === "li")
        .every(element => element.props.className?.includes("[overflow-wrap:anywhere]"))).toBe(true);
      if (index < 2) {
        button(tree, step.title === EXPLORER_TOUR_STEPS[0].title
          ? EXPLORER_TOUR_STEPS[1].title : EXPLORER_TOUR_STEPS[2].title).props.onClick?.();
        tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
      }
    }
    expect(EXPLORER_TOUR_STEPS[0].paragraphs).toHaveLength(3);
    expect(EXPLORER_TOUR_STEPS[0].paragraphs[2]).toBe('"Show me around" opens this tour without sending a message.');
    expect(EXPLORER_TOUR_STEPS[2].paragraphs).toHaveLength(4);
    expect(EXPLORER_TOUR_STEPS[2].paragraphs[3]).toBe("Choosing an answer also sends it as your message, so your Virtual Guide can reply.");
    expect(renderToStaticMarkup(tree)).toContain('To return to your conversation, choose &quot;Back to the conversation&quot; whenever you are ready.');
  });

  it("returns to the conversation from every step", () => {
    const onClose = vi.fn();
    let tree = ExplorerConversationTour({ opener: null, onClose });
    for (const [index, step] of EXPLORER_TOUR_STEPS.entries()) {
      if (index > 0) {
        button(tree, step.title).props.onClick?.();
        tree = ExplorerConversationTour({ opener: null, onClose });
      }
      button(tree, "Back to the conversation").props.onClick?.();
    }
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("focuses Back after Next step reaches the last step", () => {
    let tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    button(tree, "Next step").props.onClick?.();
    tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    button(tree, "Next step").props.onClick?.();
    const back = { focus: vi.fn() };
    hooks.refs[2].current = back;
    tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    hooks.effects[5]();
    expect(controls(tree).map(control => control.props.children)).toEqual(["Back to the conversation"]);
    expect(back.focus).toHaveBeenCalledOnce();
    hooks.effects[5]();
    expect(back.focus).toHaveBeenCalledOnce();
  });

  it("does not announce the current topic again when it is selected again", () => {
    const tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    const before = hooks.step;
    button(tree, EXPLORER_TOUR_STEPS[0].title).props.onClick?.();
    expect(hooks.step).toBe(before);
  });
});
