import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { automaticId, automaticMultiChangeState, automaticState, AUTOMATIC_LABEL } from "../../../../tests/browser/automaticCompassFixture";
import { CompassChangeLines, useCompassChangeVisit } from "../ExplorerCompassChangeLines";
import { ConnectedCompassCard } from "../ExplorerConnectedCompassCard";
import { compassChangeText } from "../../../lib/solmind/explorerCompassChanges";
import { EXPLORER_TOUR_STEPS } from "../../../lib/solmind/explorerConversationTour";

const hooks = vi.hoisted(() => ({ index: 0, values: [] as unknown[], refIndex: 0,
  refs: [] as { current: unknown }[], effects: [] as (() => void)[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value; }];
  },
  useRef: (initial: unknown) => { const index = hooks.refIndex++; return hooks.refs[index] ?? (hooks.refs[index] = { current: initial }); },
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
const frame = () => { hooks.index = 0; hooks.refIndex = 0; hooks.effects = []; };
beforeEach(() => { hooks.values = []; hooks.refs = []; frame(); });

type Props = { children?: ReactNode; onPoint?: (id: string) => void; currentRef?: { current: unknown };
  onClick?: () => void; hidden?: boolean; id?: string; type?: string;
  "aria-controls"?: string; "aria-expanded"?: boolean; "aria-live"?: string; className?: string };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
function visibleParagraphs(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap(child => !isValidElement<Props>(child) || child.props.hidden ? []
    : child.type === "p" ? [child.props.children] : visibleParagraphs(child.props.children));
}

describe("automatic Compass components", () => {
  it("keeps new receipts for the mount, clears authority loss, and hides history on remount", () => {
    expect(useCompassChangeVisit(automaticState(3), false).visible).toEqual([]);
    frame();
    const added = useCompassChangeVisit(automaticState(4), false);
    expect(added.visible).toHaveLength(1);
    frame();
    expect(useCompassChangeVisit(structuredClone(automaticState(4)), false)).toBe(added);
    frame();
    expect(useCompassChangeVisit(automaticState(4), true).visible).toEqual([]);
    frame();
    expect(useCompassChangeVisit(automaticState(4), false).announcement).toBe("");
    hooks.values = []; frame();
    expect(useCompassChangeVisit(automaticState(4), false).visible).toEqual([]);
  });
  it("renders each receipt only under its reply, with muted wrapping plain text and no second live announcement", () => {
    const state = automaticState(4);
    const bundles = state.compassChanges!;
    const markup = renderToStaticMarkup(<ol>{state.messages.map(message => <li key={message.id}>
      <article>{message.body}</article><CompassChangeLines bundles={bundles} messageId={message.id} />
    </li>)}</ol>);
    const rows = markup.match(/<li>[\s\S]*?<\/li>/g)!;
    expect(rows).toHaveLength(8);
    for (const index of [0, 1, 2, 3, 4, 6]) expect(rows[index]).not.toContain("New on your Compass:");
    expect(rows[5]).toContain(AUTOMATIC_LABEL);
    expect(rows[7]).toContain("Ordinary topic 2");
    expect(rows[7]).not.toContain(AUTOMATIC_LABEL);
    expect(markup.match(/data-compass-change=/g)).toHaveLength(2);
    expect(markup).toContain('aria-live="off"');
    expect(markup).toContain("mt-2 text-left text-xs leading-5 text-stone-400 [overflow-wrap:anywhere]");
    const escaped = renderToStaticMarkup(<CompassChangeLines messageId={bundles[0].replyMessageId}
      bundles={[{ ...bundles[0], changes: [{ ...bundles[0].changes[0], label: '<script>"a" & b</script>' }] }]} />);
    expect(escaped).toContain("&lt;script&gt;&quot;a&quot; &amp; b&lt;/script&gt;");
    expect(escaped).not.toContain("<script>");
  });
  it.each([1, 2, 3])("previews at most two of %i changes, each with its full approved explanation", count => {
    const saved = automaticMultiChangeState().compassChanges![0];
    const bundle = { ...saved, changes: saved.changes.slice(0, count) };
    const tree = CompassChangeLines({ bundles: [bundle], messageId: bundle.replyMessageId });
    expect(visibleParagraphs(tree)).toEqual(bundle.changes.slice(0, 2).map(compassChangeText));
    const controls = elements(tree).filter(element => element.type === "button");
    expect(controls).toHaveLength(count > 2 ? 1 : 0);
    if (count > 2) {
      expect(controls[0].props.children).toBe("Show all Compass changes");
      expect(controls[0].props.type).toBe("button");
      expect(controls[0].props["aria-expanded"]).toBe(false);
      const rest = elements(tree).find(element => element.props.id === controls[0].props["aria-controls"]);
      expect(rest?.props.hidden).toBe(true);
      expect(elements(rest).filter(element => element.type === "p").map(element => element.props.children))
        .toEqual(bundle.changes.slice(2).map(compassChangeText));
    }
    const html = renderToStaticMarkup(<>{tree}</>);
    expect(html).not.toMatch(/If that is not right|just say so|Your Compass changed in other ways too|line-clamp|truncate/);
    for (const paragraph of elements(tree).filter(element => element.type === "p")) {
      expect(paragraph.props.className).toContain("[overflow-wrap:anywhere]");
    }
  });
  it("reveals only that reply's remaining changes, keeps its control and does not change or repeat announcements", () => {
    const state = automaticMultiChangeState(4);
    const bundles = state.compassChanges!;
    const first = bundles[0];
    const baseline = useCompassChangeVisit(automaticState(2), false);
    expect(baseline.announcement).toBe("");
    frame();
    const visit = useCompassChangeVisit(automaticMultiChangeState(), false);
    const before = CompassChangeLines({ bundles: visit.visible, messageId: first.replyMessageId });
    const control = elements(before).find(element => element.type === "button")!;
    expect(control.props["aria-expanded"]).toBe(false);
    control.props.onClick!();
    frame();
    expect(useCompassChangeVisit(structuredClone(automaticMultiChangeState()), false)).toBe(visit);
    const expanded = CompassChangeLines({ bundles: visit.visible, messageId: first.replyMessageId });
    expect(visibleParagraphs(expanded)).toEqual(first.changes.map(compassChangeText));
    const after = elements(expanded).find(element => element.type === "button")!;
    expect(after.props["aria-expanded"]).toBe(true);
    expect(after.props["aria-controls"]).toBe(control.props["aria-controls"]);
    expect(elements(expanded).find(element => element.props.id === after.props["aria-controls"])?.props.hidden).toBe(false);
    expect(elements(expanded).filter(element => element.props["aria-live"] !== undefined)
      .map(element => element.props["aria-live"])).toEqual(["off"]);
    frame();
    const later = useCompassChangeVisit(state, false);
    const retained = CompassChangeLines({ bundles: later.visible, messageId: first.replyMessageId });
    const second = CompassChangeLines({ bundles: later.visible, messageId: bundles[1].replyMessageId });
    expect(visibleParagraphs(retained)).toEqual(first.changes.map(compassChangeText));
    expect(visibleParagraphs(second)).toEqual(bundles[1].changes.slice(0, 2).map(compassChangeText));
    expect(later.announcement).toBe(bundles[1].changes.map(compassChangeText).join(" "));
    expect(later.announcement).not.toContain(first.changes[0].label);
    hooks.values = []; frame();
    const remounted = CompassChangeLines({ bundles, messageId: first.replyMessageId });
    expect(visibleParagraphs(remounted)).toEqual(first.changes.slice(0, 2).map(compassChangeText));
  });
  it.each(["full", "compact"] as const)("%s has no retired wording and one full, muted, focusable needle target", view => {
    const props = { scope: "panel", state: automaticState(4), hold: null, view, onToggleView: vi.fn(), onPoint: vi.fn() };
    const html = renderToStaticMarkup(createElement(ConnectedCompassCard, props));
    expect(html).not.toMatch(/Priority|Forming|Other paths|Not yet arranged|confirm/);
    expect(html.match(/Pointing to:/g)).toHaveLength(1);
    expect(html).toContain(`tabindex="-1">Pointing to: ${AUTOMATIC_LABEL}</div>`);
    expect(html).toContain("text-xs font-normal leading-5 text-stone-400 [overflow-wrap:anywhere]");
    frame();
    const absent = renderToStaticMarkup(createElement(ConnectedCompassCard, { ...props, state: { ...props.state, attentionId: null } }));
    expect(absent).not.toContain("Pointing to:");
    expect(absent).not.toContain('id="panel-connected-needle-current"');
  });
  it("keeps all six approved Compass paragraphs and the other two tour steps", () => {
    expect(EXPLORER_TOUR_STEPS).toHaveLength(3);
    expect(EXPLORER_TOUR_STEPS[1].paragraphs).toHaveLength(6);
    expect(EXPLORER_TOUR_STEPS[1].paragraphs.join(" ")).not.toMatch(/Priority|Forming|That's right/);
    expect(EXPLORER_TOUR_STEPS[2].paragraphs.join(" ")).toContain("That's right");
  });
  it("focuses the retained needle line after a successful choice and tolerates an absent line", () => {
    const props = { scope: "panel", state: automaticState(4), hold: null, view: "full" as const, onToggleView: vi.fn(), onPoint: vi.fn() };
    const tree = ConnectedCompassCard(props);
    const view = elements(tree).find(element => element.props.onPoint !== undefined)!;
    view.props.onPoint!(automaticId(501));
    expect(props.onPoint).toHaveBeenCalledExactlyOnceWith(automaticId(501));
    const focus = vi.fn();
    // The line ref is supplied to the view as a React element, outside its children.
    const line = (view.props as Props & { lines: ReactElement<Props> }).lines;
    line.props.currentRef!.current = { focus };
    frame();
    ConnectedCompassCard({ ...props, state: { ...props.state, attentionId: automaticId(501) } });
    for (const effect of hooks.effects) effect();
    expect(focus).toHaveBeenCalledOnce();
    frame();
    const next = ConnectedCompassCard(props);
    const nextView = elements(next).find(element => element.props.onPoint !== undefined)!;
    nextView.props.onPoint!(automaticId(501));
    line.props.currentRef!.current = null;
    frame();
    ConnectedCompassCard({ ...props, state: { ...props.state, attentionId: null } });
    expect(() => { for (const effect of hooks.effects) effect(); }).not.toThrow();
    expect(focus).toHaveBeenCalledOnce();
  });
});
