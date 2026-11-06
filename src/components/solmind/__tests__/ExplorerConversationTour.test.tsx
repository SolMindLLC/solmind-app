import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExplorerConversationTour } from "../ExplorerConversationTour";
import { EXPLORER_TOUR_STEPS } from "../../../lib/solmind/explorerConversationTour";

const hooks = vi.hoisted(() => ({ step: { index: 0, announce: false }, refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: () => [hooks.step, (value: typeof hooks.step) => { hooks.step = value; }],
  useRef: () => { const ref = { current: null }; hooks.refs.push(ref); return ref; },
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));

type ElementProps = { children?: ReactNode; onClick?: () => void; role?: string; id?: string;
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
beforeEach(() => { hooks.step = { index: 0, announce: false }; hooks.refs = []; hooks.effects = []; vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());

describe("Fixed conversation tour", () => {
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
    expect(hooks.effects).toHaveLength(1);
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
      expect(hooks.effects).toHaveLength(index + 1);
      for (const [otherIndex, other] of EXPLORER_TOUR_STEPS.entries()) {
        for (const paragraph of other.paragraphs) {
          const escaped = paragraph.replaceAll("'", "&#x27;").replaceAll('"', "&quot;");
          if (index === otherIndex) expect(html).toContain(escaped);
          else expect(html).not.toContain(escaped);
        }
      }
      button(tree, index === 2 ? "Finish tour" : "Next step").props.onClick?.();
      tree = ExplorerConversationTour({ opener: null, onClose });
    }
    expect(onClose).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lets each topic button select its step and both close controls stop the tour", () => {
    const onClose = vi.fn();
    let tree = ExplorerConversationTour({ opener: null, onClose });
    for (const index of [2, 0, 1]) {
      button(tree, EXPLORER_TOUR_STEPS[index].title).props.onClick?.();
      expect(hooks.step).toEqual({ index, announce: true });
      tree = ExplorerConversationTour({ opener: null, onClose });
    }
    button(tree, "Close tour").props.onClick?.();
    button(tree, "Back to the conversation").props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not announce the current topic again when it is selected again", () => {
    const tree = ExplorerConversationTour({ opener: null, onClose: vi.fn() });
    const before = hooks.step;
    button(tree, EXPLORER_TOUR_STEPS[0].title).props.onClick?.();
    expect(hooks.step).toBe(before);
  });
});
