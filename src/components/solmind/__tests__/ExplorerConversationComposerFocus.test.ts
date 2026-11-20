import { afterEach, describe, expect, it, vi } from "vitest";

import { focusByApp, isAppFocusMove } from "../conversationAppFocus";
import { useConversationComposerFocus } from "../useConversationComposerFocus";

// Render the hook with stable refs. After each commit the changed layout
// effects run first and the changed passive effects after them, as in React.
const hooks = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  const effects: { deps?: readonly unknown[]; cleanup?: void | (() => void) }[] = [];
  const pending = { layout: [] as (() => void)[], passive: [] as (() => void)[] };
  const cursor = { ref: 0, effect: 0 };
  const effect = (kind: "layout" | "passive") => (run: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = cursor.effect++;
    const previous = effects[index];
    if (deps && previous?.deps?.length === deps.length &&
        deps.every((value, i) => Object.is(value, previous.deps![i]))) return;
    pending[kind].push(() => {
      previous?.cleanup?.();
      effects[index] = { deps, cleanup: run() };
    });
  };
  return { refs, effects, pending, cursor, effect };
});
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => hooks.refs[hooks.cursor.ref++] ??= { current: initial },
  useEffect: hooks.effect("passive"),
  useLayoutEffect: hooks.effect("layout"),
}));

// What a focus() call on a test element does; each setup supplies its own.
let takeFocus: ((element: TestElement) => void) | null = null;
afterEach(() => {
  for (const entry of hooks.effects) entry.cleanup?.();
  hooks.refs.length = hooks.effects.length = hooks.pending.layout.length = hooks.pending.passive.length = 0;
  takeFocus = null;
  vi.unstubAllGlobals();
});

// Supply selector matches for each test element and walk its actual test ancestry.
class TestElement {
  constructor(
    readonly tag: string,
    readonly parentElement?: TestElement,
    readonly selectors: string[] = [],
  ) {}
  matches(query: string) {
    return query.toLowerCase().replace(/["']/g, "").split(/,\s*/)
      .some(selector => {
        const [include, exclude] = selector.replace(/\)$/, "").split(":not(");
        return (include === this.tag || this.selectors.includes(include)) &&
          (!exclude || !this.selectors.includes(exclude));
      });
  }
  closest(query: string): TestElement | null {
    return this.matches(query) ? this : this.parentElement?.closest(query) ?? null;
  }
  contains(other: TestElement | undefined): boolean {
    return other !== undefined && (other === this || this.contains(other.parentElement));
  }
  getClientRects() { return [{}]; }
  focus(options?: FocusOptions) {
    void options;
    takeFocus?.(this);
  }
}
const asHtml = (element: TestElement | null) => element as unknown as HTMLElement | null;

type FocusState = Pick<Parameters<typeof useConversationComposerFocus>[0],
  "sendSequence" | "busy" | "replyId" | "dialogOpen">;
type CommitSteps = Readonly<{ beforeLayout?: () => void; betweenEffects?: () => void }>;

function FocusProbe(props: Parameters<typeof useConversationComposerFocus>[0]) {
  useConversationComposerFocus(props);
  return null;
}

function setup(mediaQueries = ["(hover: hover) and (pointer: fine)"]) {
  const html = new TestElement("html");
  const body = new TestElement("body", html);
  const transcript = new TestElement("div", body, ["[role=log]", "[tabindex]"]);
  const dialogs: TestElement[] = [];
  const doc = Object.assign(new EventTarget(), {
    documentElement: html, body, activeElement: body,
    querySelectorAll: (query: string) => dialogs.filter(dialog => dialog.matches(query)),
  });
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  const requestAnimationFrame = (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  const cancelAnimationFrame = (id: number) => frames.delete(id);
  const matchMedia = (query: string) => ({
    matches: mediaQueries.includes(query),
  });
  const win = Object.assign(new EventTarget(), { document: doc, requestAnimationFrame, cancelAnimationFrame, matchMedia });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("Element", TestElement);
  vi.stubGlobal("getComputedStyle", () => ({ display: "block", visibility: "visible" }));

  function dispatch(target: TestElement, type: string, props = {}) {
    const event = Object.assign(new Event(type, { cancelable: true }), props);
    Object.defineProperty(event, "target", { value: target });
    doc.dispatchEvent(event);
    return event;
  }
  // Focus that arrives with no mark: a press, a key, a screen reader, a test.
  function focus(target: TestElement) {
    doc.activeElement = target;
    dispatch(target, "focusin");
  }
  takeFocus = focus;
  // Focus the app places through its shared helper.
  const appFocus = (target: TestElement) => focusByApp(asHtml(target), { preventScroll: true });
  // A real press: pointerdown, then the browser moves focus to the target.
  function press(target: TestElement, focusTarget = target) {
    dispatch(target, "pointerdown");
    if (doc.activeElement !== focusTarget) focus(focusTarget);
  }
  // The window or tab is left, then returned to: the browser sends focusin
  // again for the element that already held focus.
  function leaveAndReturn(returnTo = doc.activeElement) {
    win.dispatchEvent(new Event("blur"));
    doc.activeElement = returnTo;
    dispatch(returnTo, "focusin");
  }
  const field = Object.assign(new TestElement("textarea", body), {
    value: "", selectionStart: 0, selectionEnd: 0, disabled: false, maxLength: 600,
    focus: vi.fn(() => focus(field)),
    setRangeText(text: string, start: number, end: number) {
      field.value = field.value.slice(0, start) + text + field.value.slice(end);
      field.selectionStart = field.selectionEnd = start + text.length;
    },
  });
  const args = {
    composerRef: { current: field as unknown as HTMLTextAreaElement },
    transcriptRef: { current: transcript as unknown as HTMLDivElement },
    sendSequence: 0, busy: false, replyId: "saved" as string | null, dialogOpen: false,
    onDraftChange: vi.fn(),
  };
  function render(next: Partial<FocusState> = {}, steps: CommitSteps = {}) {
    Object.assign(args, next);
    hooks.cursor.ref = hooks.cursor.effect = 0;
    FocusProbe(args);
    steps.beforeLayout?.();
    for (const commit of hooks.pending.layout.splice(0)) commit();
    steps.betweenEffects?.();
    for (const commit of hooks.pending.passive.splice(0)) commit();
  }
  function paint() {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(0);
  }
  function settle() {
    paint();
    paint();
  }
  const send = (steps?: CommitSteps) => render({ sendSequence: args.sendSequence + 1, busy: true }, steps);
  const reply = (replyId: string) => render({ busy: false, replyId });
  const key = (key: string, props = {}) => dispatch(doc.activeElement, "keydown", { key, ...props });
  const row = () => new TestElement("li", transcript, ["[tabindex]", "[tabindex=-1]"]);
  const heading = () => new TestElement("h1", body, ["[tabindex]", "[tabindex=-1]"]);
  render();
  return { doc, win, body, transcript, dialogs, field, focus, appFocus, press, leaveAndReturn, key, row, heading,
    render, paint, settle, send, reply, args };
}

describe("message box focus on a Virtual Guide reply", () => {
  it("waits for the rendered reply and focuses once per successful send", () => {
    const f = setup();
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
    for (const reply of ["one", "two"]) {
      f.field.focus.mockClear();
      f.send();
      f.settle();
      expect(f.field.focus).not.toHaveBeenCalled();
      f.reply(reply);
      f.paint();
      expect(f.field.focus).not.toHaveBeenCalled();
      f.paint();
      expect(f.field.focus).toHaveBeenCalledOnce();
      expect(f.doc.activeElement).toBe(f.field);
      f.render();
      f.settle();
      expect(f.field.focus).toHaveBeenCalledOnce();
      f.focus(f.body);
    }
  });

  it("leaves focus alone after a failed send or a reload of saved replies", () => {
    const f = setup();
    f.send();
    f.render({ busy: false });
    f.settle();
    f.render({ busy: true });
    f.reply("reloaded");
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("remembers a reply rendered before the pending send clears", () => {
    const f = setup();
    f.send();
    f.render({ replyId: "new" });
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
    f.render({ busy: false });
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it.each([
    { device: "touch-only device", media: ["(any-pointer: coarse)"] },
    { device: "tablet with a trackpad", media: ["(hover: hover) and (pointer: fine)", "(any-pointer: coarse)"] },
  ])("keeps the keyboard closed on a $device after a reply", ({ media }) => {
    const f = setup(media);
    f.send();
    f.reply("new");
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("focuses the message box when the original Send control still has focus", () => {
    const f = setup();
    f.press(new TestElement("button", f.body));
    f.send();
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });
});

describe("who moved focus since the Send", () => {
  it.each(["before", "during"])("gives way when the app placed focus on a transcript row (%s the Send)", stage => {
    const f = setup();
    const row = f.row();
    if (stage === "before") f.appFocus(row);
    f.send();
    if (stage === "during") f.appFocus(row);
    expect(f.doc.activeElement).toBe(row);
    f.reply("new");
    f.settle();
    expect(f.field.focus).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("keeps focus a screen reader moved to the same row with no key or press", () => {
    const f = setup();
    const row = f.row();
    f.send();
    f.focus(row);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(row);
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("marks only the app's own call: the mark is gone when the call returns", () => {
    const f = setup();
    const row = f.row();
    const seen: boolean[] = [];
    f.doc.addEventListener("focusin", () => seen.push(isAppFocusMove()));
    expect(f.appFocus(row)).toBe(true);
    expect(isAppFocusMove()).toBe(false);
    f.focus(f.heading());
    expect(seen).toEqual([true, false]);
    expect(focusByApp(null)).toBe(false);
  });

  it("gives way to the box when a key came just before the Send and the app then placed focus", () => {
    const f = setup();
    const row = f.row();
    f.key("Enter");
    f.send();
    f.appFocus(row);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("does not take the app's focus as the person's when a key was pressed during the Send", () => {
    const f = setup();
    const row = f.row();
    f.send();
    f.key("Shift");
    f.appFocus(row);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("respects the person's click on the conversation heading during Send", () => {
    const f = setup();
    const heading = f.heading();
    f.send();
    f.press(heading);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(heading);
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("respects a press on the element that already holds focus", () => {
    const f = setup();
    const heading = f.heading();
    f.appFocus(heading);
    f.send();
    f.press(new TestElement("span", heading), heading);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(heading);
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("keeps focus moved directly to the transcript during Send", () => {
    const f = setup();
    f.send();
    f.focus(f.transcript);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.transcript);
  });

  it.each(["confirmation", "follow-up"])("honors a focus move during the Waypoint %s", stage => {
    const f = setup();
    const privacy = new TestElement("button", f.body);
    f.render({ busy: true, dialogOpen: true });
    if (stage === "confirmation") f.focus(privacy);
    f.render({ sendSequence: 1, dialogOpen: false });
    if (stage === "follow-up") f.focus(privacy);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(privacy);
  });

  it.each(["input", "button", "select"])("honors a focus move to a %s even after blur", tag => {
    const f = setup();
    f.send();
    f.focus(new TestElement(tag, f.body));
    f.focus(f.body);
    f.reply("new");
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("honors focus changes between showing the reply and the next frame", () => {
    const f = setup();
    f.send();
    f.reply("new");
    f.paint();
    const link = new TestElement("a", f.body, ["a[href]"]);
    f.focus(link);
    f.settle();
    expect(f.doc.activeElement).toBe(link);
  });

  it("treats a press on the page itself as no move", () => {
    const f = setup();
    f.send();
    f.press(f.body);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("does not count the browser's own focusin when the window is left and returned to", () => {
    const f = setup();
    const row = f.row();
    f.send();
    f.appFocus(row);
    f.leaveAndReturn();
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("skips only the first focusin after the return", () => {
    const f = setup();
    const row = f.row();
    f.send();
    f.appFocus(row);
    f.leaveAndReturn();
    f.focus(f.heading());
    f.focus(row);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(row);
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("counts a return that lands on another element than the one that held focus", () => {
    const f = setup();
    const heading = f.heading();
    f.send();
    f.appFocus(f.row());
    f.leaveAndReturn(heading);
    f.reply("new");
    f.settle();
    expect(f.doc.activeElement).toBe(heading);
    expect(f.field.focus).not.toHaveBeenCalled();
  });
});

describe("focus tracking is tied to its own Send", () => {
  it("lets a second Send before the first reply's second frame keep its own state", () => {
    const f = setup();
    f.send();
    f.reply("one");
    f.paint();
    f.send();
    f.settle();
    expect(f.field.focus).not.toHaveBeenCalled();
    f.reply("two");
    f.paint();
    expect(f.field.focus).not.toHaveBeenCalled();
    f.paint();
    expect(f.field.focus).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("keeps a move made during the second Send when the first reply's frames were still waiting", () => {
    const f = setup();
    const heading = f.heading();
    f.send();
    f.reply("one");
    f.paint();
    f.send();
    f.press(heading);
    f.settle();
    f.reply("two");
    f.settle();
    expect(f.doc.activeElement).toBe(heading);
    expect(f.field.focus).not.toHaveBeenCalled();
  });

  it("keeps an older reply's frame from using or closing a later Send's state", () => {
    const f = setup();
    f.send();
    f.reply("one");
    f.paint();
    // The first reply's second frame runs inside the second Send's commit,
    // after the layout effects and before the passive cleanup cancels it.
    f.send({ betweenEffects: () => f.paint() });
    expect(f.field.focus).not.toHaveBeenCalled();
    f.reply("two");
    f.settle();
    expect(f.field.focus).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("does not carry a move made while the first reply's frames waited into the second Send", () => {
    const f = setup();
    const heading = f.heading();
    f.send();
    f.reply("one");
    f.paint();
    f.press(heading);
    f.send();
    f.reply("two");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("forgets a move made during an earlier Send once a later Send is accepted", () => {
    const f = setup();
    const heading = f.heading();
    f.send();
    f.press(heading);
    f.reply("one");
    f.settle();
    expect(f.doc.activeElement).toBe(heading);
    f.send();
    f.reply("two");
    f.settle();
    expect(f.doc.activeElement).toBe(f.field);
  });

  it("hears a move made after the reply is shown and before its second frame", () => {
    const f = setup();
    const row = f.row();
    f.send();
    f.reply("new");
    f.paint();
    f.focus(row);
    f.paint();
    expect(f.doc.activeElement).toBe(row);
    expect(f.field.focus).not.toHaveBeenCalled();
  });
});

describe("the strip's stand-in for a control that left the screen", () => {
  it.each(["beforeLayout", "betweenEffects"] as const)(
    "gives way to the box when the strip moved focus in the busy commit (%s)", step => {
      const f = setup();
      const heading = f.heading();
      f.send({ [step]: () => f.appFocus(heading) });
      expect(f.doc.activeElement).toBe(heading);
      f.reply("new");
      f.settle();
      expect(f.doc.activeElement).toBe(f.field);
    },
  );
});

describe("dialog exclusions for both focus behaviors", () => {
  it.each(["screen dialog", "dialog[open]", "[role=dialog]", "[role=alertdialog]"])(
    "preserves focus and keys with an open %s", selector => {
      const f = setup();
      f.send();
      if (selector === "screen dialog") f.render({ dialogOpen: true });
      else f.dialogs.push(new TestElement(selector === "dialog[open]" ? "dialog" : "div", f.body, [selector]));
      f.reply("new");
      f.settle();
      expect(f.key("a").defaultPrevented).toBe(false);
      expect(f.field.focus).not.toHaveBeenCalled();
      expect(f.args.onDraftChange).not.toHaveBeenCalled();
    },
  );
});

describe("typing into the message box from the conversation", () => {
  it.each(["background", "transcript", "transcript paragraph", "transcript row"])(
    "inserts the first letter once at the selection and keeps focus from the %s", origin => {
      const f = setup();
      const paragraph = new TestElement("p", f.transcript);
      f.focus(origin === "background" ? f.body : origin === "transcript" ? f.transcript
        : origin === "transcript row" ? f.row() : paragraph);
      Object.assign(f.field, { value: "a?z", selectionStart: 1, selectionEnd: 2 });
      expect(f.key("B", { shiftKey: true }).defaultPrevented).toBe(true);
      expect(f.args.onDraftChange).toHaveBeenCalledExactlyOnceWith("aBz");
      expect(f.doc.activeElement).toBe(f.field);
      expect(f.key("c").defaultPrevented).toBe(false);
    },
  );

  it.each([
    ["the conversation heading", "h1", ["[tabindex]", "[tabindex=-1]"]],
    ["an alert outside the transcript", "div", ["[role=alert]", "[tabindex]", "[tabindex=-1]"]],
    ["plain text outside the transcript", "p", []],
  ] as [string, string, string[]][])("leaves a letter typed on %s alone", (_name, tag, selectors) => {
    const f = setup();
    f.focus(new TestElement(tag, f.body, selectors));
    expect(f.key("a").defaultPrevented).toBe(false);
    expect(f.field.focus).not.toHaveBeenCalled();
    expect(f.args.onDraftChange).not.toHaveBeenCalled();
  });

  it.each([
    { device: "phone with a keyboard", media: ["(any-pointer: coarse)"] },
    { device: "tablet with a keyboard and trackpad", media: ["(hover: hover) and (pointer: fine)", "(any-pointer: coarse)"] },
  ])("leaves a letter alone on a $device", ({ media }) => {
    const f = setup(media);
    for (const origin of [f.body, f.transcript]) {
      f.focus(origin);
      expect(f.key("a").defaultPrevented).toBe(false);
    }
    expect(f.field.focus).not.toHaveBeenCalled();
    expect(f.args.onDraftChange).not.toHaveBeenCalled();
  });

  it.each(["ctrlKey", "altKey", "metaKey"])("preserves a letter with %s", modifier => {
    const f = setup();
    expect(f.key("x", { [modifier]: true }).defaultPrevented).toBe(false);
    expect(f.field.focus).not.toHaveBeenCalled();
    expect(f.args.onDraftChange).not.toHaveBeenCalled();
  });

  it.each(["\u00e9", "\u{10400}"])("accepts the Unicode letter %s from the transcript", letter => {
    const f = setup();
    f.focus(f.transcript);
    expect(f.key(letter).defaultPrevented).toBe(true);
    expect(f.args.onDraftChange).toHaveBeenCalledExactlyOnceWith(letter);
    expect(f.doc.activeElement).toBe(f.field);
  });

  it.each(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
    "Home", "End", " ", "Enter", "Escape", "/", "1", "\u{1f642}", "ab"])("preserves the native action for %j", key => {
    const f = setup();
    f.focus(f.transcript);
    expect(f.key(key).defaultPrevented).toBe(false);
    expect(f.field.focus).not.toHaveBeenCalled();
    expect(f.args.onDraftChange).not.toHaveBeenCalled();
  });

  it.each([
    ["button", []], ["a", ["a[href]"]], ["input", []], ["textarea", []], ["select", []],
    ["div", ["[role=button]"]], ["div", ["[contenteditable]", "[contenteditable=true]"]],
  ] as [string, string[]][])("preserves typing inside a %s %j control in the transcript", (tag, selectors) => {
    const f = setup();
    const control = new TestElement(tag, f.transcript, selectors);
    f.focus(tag === "button" || tag === "a" ? new TestElement("span", control) : control);
    expect(f.key("a").defaultPrevented).toBe(false);
    expect(f.field.focus).not.toHaveBeenCalled();
    expect(f.args.onDraftChange).not.toHaveBeenCalled();
  });
});
