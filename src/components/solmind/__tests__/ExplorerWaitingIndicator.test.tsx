import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CONNECTED_WAITING_REPLY_TEXT } from "../../../lib/solmind/explorerConversationConnectedScreen";
import { ExplorerWaitingIndicator } from "../ExplorerWaitingIndicator";

const css = readFileSync(path.resolve(__dirname, "../ExplorerWaitingIndicator.module.css"), "utf8");

function identifiers(html: string) {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
}

function paintReferences(html: string) {
  return [...html.matchAll(/url\(#([^)]+)\)/g)].map(match => match[1]);
}

describe("the approved waiting indicator", () => {
  it("renders the exact sentence beside a decorative SVG without a second live announcement", () => {
    const html = renderToStaticMarkup(createElement(ExplorerWaitingIndicator));
    expect(CONNECTED_WAITING_REPLY_TEXT).toBe("Waiting for your Virtual Guide's reply...");
    expect(html).toContain('<span>Waiting for your Virtual Guide&#x27;s reply...</span>');
    expect(html).toContain('data-waiting-indicator=""');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
    expect(html).toMatch(/^<div aria-live="off"/);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('aria-live="polite"');
    expect(html).not.toContain("<title");
  });

  it("retains the approved size, soft overflow and four-second brightness defaults", () => {
    expect(css).toContain("--size: 40px;");
    expect(css).toContain("--loop: 4s;");
    expect(css).toContain("--peak: 1;");
    expect(css).toContain("width: var(--size);");
    expect(css).toContain("height: var(--size);");
    expect(css).toContain("overflow: visible;");
    expect(css).toContain("animation-duration: var(--loop);");
    expect(css).toContain("animation-iteration-count: infinite;");
    expect(css).toContain("animation-timing-function: cubic-bezier(.42, 0, .22, 1);");
  });

  it("keeps the complete dark-background drawing and resolves every paint within its SVG", () => {
    const html = renderToStaticMarkup(createElement(ExplorerWaitingIndicator));
    const ids = identifiers(html);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of paintReferences(html)) expect(ids).toContain(reference);
    expect(html).toContain('viewBox="5 5 38 38"');
    expect([...html.matchAll(/<filter\b/g)]).toHaveLength(4);
    expect([...html.matchAll(/<radialGradient\b/g)]).toHaveLength(6);
    expect([...html.matchAll(/<linearGradient\b/g)]).toHaveLength(2);
    expect([...html.matchAll(/<path\b/g)]).toHaveLength(8);
    expect(html).toContain('transform="translate(24 24) scale(1.2195) translate(-9.6 -9.4) scale(.8)"');
    expect(html).toContain('transform="translate(34.6 13.4)"');
    expect(html).toContain('r="1.6" fill="#FFFFFF"');
  });

  it("gives two mounted instances disjoint gradient and filter identifiers", () => {
    const html = renderToStaticMarkup(createElement(Fragment, null,
      createElement(ExplorerWaitingIndicator), createElement(ExplorerWaitingIndicator),
    ));
    const copies = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(match => match[0]);
    expect(copies).toHaveLength(2);
    const first = identifiers(copies[0]);
    const second = identifiers(copies[1]);
    expect(first.filter(id => second.includes(id))).toEqual([]);
    for (const copy of copies) {
      const localIds = identifiers(copy);
      for (const reference of paintReferences(copy)) expect(localIds).toContain(reference);
    }
  });

  it("disables every animation and sets the same 64-percent diamond-ring frame for reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".eclipse * { animation: none !important; }");
    for (const rule of [
      ".eclipse .glow { opacity: 1; transform: scale(1.05); }",
      ".eclipse .plumes { opacity: .85; }",
      ".eclipse .streamers { opacity: 1; }",
      ".eclipse .ringglow { opacity: 1; }",
      ".eclipse .sun { opacity: 1; }",
      ".eclipse .moon { opacity: 1; transform: translate(-.46px, .46px); }",
      ".eclipse .limb, .eclipse .arc { opacity: 1; }",
      ".eclipse .face { opacity: .9; }",
      ".eclipse .bloom { opacity: 1; transform: scale(.9603890186481718); }",
      ".eclipse .rays { opacity: .9; transform: scale(1); }",
      ".eclipse .bead { opacity: 1; transform: scale(1.1); }",
    ]) expect(reduced).toContain(rule);
    expect(reduced).not.toContain("animation-play-state");
    expect(reduced).not.toContain("animation-delay");
  });
});
