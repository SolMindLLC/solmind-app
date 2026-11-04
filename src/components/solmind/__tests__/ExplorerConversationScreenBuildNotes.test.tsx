import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_WORKSPACE_FRAMES } from "../../../lib/solmind/adminWorkspaceFrame";
import { BUILD_NOTE_WORDING } from "../../../lib/solmind/explorerConversationScreen";
import { CONNECTED_SHELL } from "../../../lib/solmind/explorerConversationConnectedScreen";
import { EXPLORER_WORKSPACE_FRAMES } from "../../../lib/solmind/explorerWorkspaceFrame";
import { GUIDE_WORKSPACE_FRAMES } from "../../../lib/solmind/guideWorkspaceFrame";
import { SPEAKER_LOGO_COLOURS } from "../../../lib/solmind/explorerSpeakerStyle";
import { WORKSPACE_NOT_CONNECTED_LABEL } from "../../../lib/solmind/workspaceNavigation";
import {
  BUILD_NOTES_START,
  BuildNoteBox,
  BuildNoteLabel,
  BuildNotesProvider,
  BuildNotesToggle,
  RemovalTag,
  buildNoteShown,
  closeBuildNote,
  toggleBuildNotes,
  type BuildNotesView,
} from "../ExplorerConversationScreenBuildNotes";
import { NotConnectedProvider, NotYetImplementedNote, UnwiredControl, noteId } from "../ExplorerConversationScreenNotYetImplemented";
import { ExplorerConversationScreenShell } from "../ExplorerConversationScreenShell";
import { WorkspaceFrame } from "../WorkspaceFrame";

// Build notes on the signed-in screens (Paul's rule, decision queue 2026-11-03 17:59:20, 18:00:59 and 18:03:39
// CST; build spec .validation/build-notes-20261103): the blue label, the blue box with its X, the violet removal
// tag and the one page toggle. The real clicks are proved in tests/browser/explorerConversationScreen.pw.ts.

// BN09 counts the useState calls a render makes while counting is on, to see that a hidden removal tag holds no
// open state; otherwise React is unchanged (the pass-through pattern of LoopbackSignInAddressWarning.test.tsx).
const stateHooks = vi.hoisted(() => ({ counting: false, calls: 0 }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      if (stateHooks.counting) stateHooks.calls += 1;
      return actual.useState(initial);
    }) as typeof actual.useState,
  };
});

const appRoot = path.resolve(__dirname, "..", "..", "..", "..");
const BUILD_NOTES_FILE = "src/components/solmind/ExplorerConversationScreenBuildNotes.tsx";
const BLUE_LABEL = `<span class="text-[11px] font-normal text-[#4A86FF]" data-build-note="label">${WORKSPACE_NOT_CONNECTED_LABEL}</span>`;
const SENTENCE = "Realizations you confirm will be kept here as Key Insights, because they are progress too.";

function provided(view: BuildNotesView, children: ReactNode): string {
  return renderToStaticMarkup(
    <BuildNotesProvider state={{ view, onToggle: () => {}, onClose: () => {} }}>
      <NotConnectedProvider onToggle={() => {}} openId={null}>
        {children}
      </NotConnectedProvider>
    </BuildNotesProvider>,
  );
}

const OFF: BuildNotesView = { shown: false, closed: [] };

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(appRoot, directory)).flatMap((name) => {
    const file = `${directory}/${name}`;
    if (name.startsWith(".env")) return [];
    if (statSync(path.join(appRoot, file)).isDirectory()) return name === "__tests__" ? [] : sourceFiles(file);
    return /\.(?:ts|tsx|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

beforeEach(() => { vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); }); });
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("build notes", () => {
  it("BN01 the toggle and the X follow Paul's rule: an X hides only its box; on shows every box again", () => {
    expect(BUILD_NOTES_START).toEqual({ shown: true, closed: [] });
    expect(Object.isFrozen(BUILD_NOTES_START)).toBe(true);
    // Close one box with its X: only that box hides.
    const closed = closeBuildNote(BUILD_NOTES_START, "nyi-panel-keyInsight");
    expect(buildNoteShown(closed, "nyi-panel-keyInsight")).toBe(false);
    expect(buildNoteShown(closed, "nyi-composer-latestChange")).toBe(true);
    expect(buildNoteShown(closed)).toBe(true);
    expect(closeBuildNote(closed, "nyi-panel-keyInsight")).toBe(closed);
    // Toggle the page off: everything hides, and the closed box stays closed.
    const off = toggleBuildNotes(closed);
    expect(off).toEqual({ shown: false, closed: ["nyi-panel-keyInsight"] });
    expect(buildNoteShown(off)).toBe(false);
    expect(buildNoteShown(off, "nyi-composer-latestChange")).toBe(false);
    expect(buildNoteShown(off, "nyi-panel-keyInsight")).toBe(false);
    // Toggle it on again: every box shows, including the one closed with its X.
    const on = toggleBuildNotes(off);
    expect(on).toEqual({ shown: true, closed: [] });
    expect(buildNoteShown(on, "nyi-panel-keyInsight")).toBe(true);
    expect(buildNoteShown(on, "nyi-composer-latestChange")).toBe(true);
  });

  it("BN02 the small label is the same words in the build-note blue; the toggle hides it", () => {
    expect(provided(BUILD_NOTES_START, <BuildNoteLabel />)).toBe(BLUE_LABEL);
    expect(provided(OFF, <BuildNoteLabel />)).toBe("");
    // Without the provider (no signed-in boundary) it shows.
    expect(renderToStaticMarkup(<BuildNoteLabel />)).toBe(BLUE_LABEL);
    // A control not built yet keeps its button and its sentence with the notes off; only the label goes.
    const control = (
      <UnwiredControl className="x" noteKey="pause" scope="composer">
        Pause
      </UnwiredControl>
    );
    const on = provided(BUILD_NOTES_START, control);
    const off = provided(OFF, control);
    expect(on).toContain(BLUE_LABEL);
    expect(off).not.toContain(WORKSPACE_NOT_CONNECTED_LABEL);
    expect(off).not.toContain("data-build-note");
    for (const html of [on, off]) {
      expect(html).toContain('<button aria-controls="nyi-composer-pause" aria-expanded="false" class="x" type="button">');
      expect(html).toContain('hidden="" id="nyi-composer-pause">Pause will keep this conversation');
    }
  });

  it("BN03 an area note is a blue dashed box with an X in its upper corner, described by its sentence", () => {
    const box = provided(BUILD_NOTES_START, <BuildNoteBox id="nyi-panel-keyInsight" text={SENTENCE} />);
    expect(box).toBe(
      '<div class="relative grid gap-0.5 rounded-lg border border-dashed border-[#4A86FF] bg-[#071433] py-1.5 pl-2.5 pr-9 text-left [overflow-wrap:anywhere]" data-build-note="box">' +
      `<p class="text-[11px] font-semibold leading-4 text-[#4A86FF]">${WORKSPACE_NOT_CONNECTED_LABEL}</p>` +
      `<p class="text-xs leading-5 text-[#D6E4FF]" id="nyi-panel-keyInsight">${SENTENCE}</p>` +
      `<button aria-describedby="nyi-panel-keyInsight" aria-label="${BUILD_NOTE_WORDING.hide}" class="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-[#4A86FF] hover:bg-[#4A86FF]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" type="button">` +
      '<svg aria-hidden="true" class="h-4 w-4 shrink-0" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" viewBox="0 0 24 24">' +
      '<path d="M6 6l12 12M18 6 6 18"></path></svg></button></div>',
    );
    // Closed with its X: only that box is gone; with the toggle off every box is gone.
    const closed = { shown: true, closed: ["nyi-panel-keyInsight"] };
    expect(provided(closed, <BuildNoteBox id="nyi-panel-keyInsight" text={SENTENCE} />)).toBe("");
    expect(provided(closed, <BuildNoteBox id="nyi-panel-other" text={SENTENCE} />)).toContain('data-build-note="box"');
    expect(provided(OFF, <BuildNoteBox id="nyi-panel-other" text={SENTENCE} />)).toBe("");
    // The screen's area notes come through NotYetImplementedNote (standalone), without the review prefix.
    const note = provided(BUILD_NOTES_START, <NotYetImplementedNote id={noteId("panel", "keyInsight")} noteKey="keyInsight" standalone />);
    expect(note).toBe(box);
    expect(provided(OFF, <NotYetImplementedNote id={noteId("panel", "keyInsight")} noteKey="keyInsight" standalone />)).toBe("");
    // Without the build-notes provider nothing can close it, so it has no X.
    const bare = renderToStaticMarkup(<BuildNoteBox id="nyi-panel-keyInsight" text={SENTENCE} />);
    expect(bare).toContain('data-build-note="box"');
    expect(bare).not.toContain("<button");
  });

  it("BN04 the page toggle is one aria-pressed button named Build notes, only where the provider is placed", () => {
    expect(renderToStaticMarkup(<BuildNotesToggle />)).toBe("");
    const on = provided(BUILD_NOTES_START, <BuildNotesToggle />);
    const off = provided(OFF, <BuildNotesToggle />);
    expect(on).toMatch(/^<button aria-pressed="true" class="flex h-10 items-center gap-2 rounded-full border border-\[#4A86FF\] px-3 text-xs font-semibold text-\[#4A86FF\] hover:bg-\[#071433\] bg-\[#071433\] [^"]*" data-build-note="toggle" id="build-notes-toggle" type="button"><svg [^>]*>[\s\S]*<\/svg>Build notes<\/button>$/);
    expect(off).toMatch(/^<button aria-pressed="false" class="flex h-10 [^"]*" data-build-note="toggle" id="build-notes-toggle" type="button"><svg [^>]*>[\s\S]*<\/svg>Build notes<\/button>$/);
    // Pressed, it is filled with the deep navy; unpressed, only on hover.
    const classes = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");
    expect(classes(on)).toContain("bg-[#071433]");
    expect(classes(off)).not.toContain("bg-[#071433]");
    expect(classes(off)).toContain("hover:bg-[#071433]");
    // The eye says on, the crossed eye says off: not colour alone.
    expect(on).not.toEqual(off.replace('aria-pressed="false"', 'aria-pressed="true"'));
    for (const html of [on, off]) expect(/aria-live|role="status"|aria-controls/.test(html)).toBe(false);
    expect(BUILD_NOTE_WORDING.toggle).toBe("Build notes");
  });

  it("BN05 the violet tag says Planned for removal and shows its sentence on tap; the toggle hides it", () => {
    const reason = "These tools will be removed once the Compass & Waypoint card does everything they do.";
    const tag = provided(BUILD_NOTES_START, <RemovalTag id="removal-current-tools" reason={reason} />);
    expect(tag).toBe(
      '<div class="grid min-w-0 justify-items-start gap-1" data-removal-marker="tag">' +
      '<button aria-controls="removal-current-tools" aria-expanded="false" class="rounded-full border border-dashed border-[#D27BFF] bg-[#1C0F2E] px-2.5 py-0.5 text-[11px] font-semibold text-[#D27BFF] hover:bg-[#D27BFF]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" type="button">' +
      `${BUILD_NOTE_WORDING.removalTag}</button>` +
      `<p class="text-xs leading-5 text-[#F0DDFF]" hidden="" id="removal-current-tools">${reason.replace("&", "&amp;")}</p></div>`,
    );
    expect(provided(OFF, <RemovalTag id="removal-current-tools" reason={reason} />)).toBe("");
    expect(BUILD_NOTE_WORDING.removalTag).toBe("Planned for removal");
  });

  it("BN09 the violet tag keeps no open state while the toggle hides it, so it comes back with its sentence closed", () => {
    const reason = "These tools will be removed once the Compass & Waypoint card does everything they do.";
    const rendered = (view: BuildNotesView) => {
      stateHooks.calls = 0;
      stateHooks.counting = true;
      try {
        const html = renderToStaticMarkup(
          <BuildNotesProvider state={{ view, onToggle: () => {}, onClose: () => {} }}>
            <RemovalTag id="removal-current-tools" reason={reason} />
          </BuildNotesProvider>,
        );
        return { html, calls: stateHooks.calls };
      } finally {
        stateHooks.counting = false;
      }
    };
    // Hidden: nothing is drawn and no state hook is held, so React drops an open sentence with the tag.
    expect(rendered(OFF)).toEqual({ html: "", calls: 0 });
    // Shown again: a fresh tag with its one open state, collapsed, and its sentence hidden.
    const shown = rendered(BUILD_NOTES_START);
    expect(shown.calls).toBe(1);
    expect(shown.html).toContain('<button aria-controls="removal-current-tools" aria-expanded="false"');
    expect(shown.html).toContain('hidden="" id="removal-current-tools">');
  });

  it("BN06 with the notes off the top bar, menu and banner keep every control and sentence, without a label", () => {
    const shell = (view: BuildNotesView) => provided(view, (
      <ExplorerConversationScreenShell connected drawer={null} menuOpen={false} onMenuOpenChange={() => {}} onSkip={() => {}} shell={CONNECTED_SHELL}>
        {null}
      </ExplorerConversationScreenShell>
    ));
    const on = shell(BUILD_NOTES_START);
    const off = shell(OFF);
    const controls = (html: string) => [...html.matchAll(/<button\b[^>]*\saria-controls="((?:nyi|not-connected)-[\w-]+)"/g)].map(([, id]) => id);
    // Menu: With your Guide, Start a new conversation, Settings. Top bar: Notifications, profile. Guide banner.
    expect(controls(on)).toHaveLength(6);
    expect(controls(off)).toEqual(controls(on));
    expect(on.split(BLUE_LABEL).length - 1).toBe(6);
    expect(off).not.toContain(WORKSPACE_NOT_CONNECTED_LABEL);
    expect(off).not.toContain("data-build-note=\"label\"");
    for (const id of controls(on)) expect(off).toMatch(new RegExp(`<p class="[^"]*" hidden="" id="${id}">[^<]+</p>`));
    // The toggle stays, first in the top bar's right-hand group, before the bell; it says the notes are off.
    for (const [html, pressed] of [[on, "true"], [off, "false"]] as const) {
      expect(html.split('data-build-note="toggle"').length - 1).toBe(1);
      expect(html).toContain(`<div class="ml-auto flex flex-wrap items-center justify-end gap-2"><button aria-pressed="${pressed}"`);
      expect(html.indexOf('id="build-notes-toggle"')).toBeLessThan(html.indexOf('aria-controls="nyi-top-notifications"'));
    }
  });

  it("BN07 the reserved colours: a blue apart from the product's sky blue, cyan and indigo, and a violet", () => {
    const source = readFileSync(path.join(appRoot, BUILD_NOTES_FILE), "utf8");
    const code = source.replace(/^\s*\/\/.*$/gm, "");
    expect(SPEAKER_LOGO_COLOURS.explorer).toBe("#8BC6EE");
    // No product colour family is used for a note: not the You label's sky blue, the current tools' cyan, the
    // private Waypoint panels' indigo, the design's amber surfaces or its stone greys (the amber focus ring stays).
    expect(code).not.toMatch(/#8BC6EE|\b(?:sky|cyan|indigo|blue|violet|purple|stone|slate)-|\bamber-[0-9]+\//i);
    expect(code.match(/#[0-9A-F]{6}/gi)?.map((hex) => hex.toUpperCase()).sort().filter((hex, at, all) => all.indexOf(hex) === at)).toEqual(
      ["#071433", "#1C0F2E", "#4A86FF", "#D27BFF", "#D6E4FF", "#F0DDFF"],
    );
    // The build-note colours appear in no other app source file, so they stay reserved.
    const reserved = /#4A86FF|#071433|#D6E4FF|#D27BFF|#1C0F2E|#F0DDFF/i;
    const others = sourceFiles("src").filter((file) => file !== BUILD_NOTES_FILE && reserved.test(readFileSync(path.join(appRoot, file), "utf8")));
    expect(others).toEqual([]);
    expect(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(source)).toBe(true);
    // Nothing is saved: no browser storage and no URL state.
    expect(/localStorage|sessionStorage|indexedDB|location\.|history\.|useSearchParams|useRouter/.test(source)).toBe(false);
  });

  it("BN08 every signed-in workspace frame page (Explorer, Guide and Admin) has the toggle and blue labels", () => {
    const frames = [
      ...Object.values(EXPLORER_WORKSPACE_FRAMES),
      ...Object.values(GUIDE_WORKSPACE_FRAMES),
      ...Object.values(ADMIN_WORKSPACE_FRAMES),
    ];
    expect(frames.length).toBe(4 + 2 + 4);
    for (const data of frames) {
      const html = renderToStaticMarkup(<WorkspaceFrame frame={data}>{null}</WorkspaceFrame>);
      const name = data.breadcrumbRoot;
      expect(html.match(/<button aria-pressed="true" [^>]*data-build-note="toggle" id="build-notes-toggle" type="button">/g), name).toHaveLength(1);
      // The bell and the profile chip at least; the Admin menu has only working entries.
      expect(html.split(BLUE_LABEL).length - 1, name).toBeGreaterThanOrEqual(2);
      expect(html, name).toMatch(/aria-controls="nyi-top-notifications"[^>]*>[\s\S]*?data-build-note="label"/);
      expect(html, name).not.toContain("text-stone-400\">Not connected yet");
    }
  });
});
