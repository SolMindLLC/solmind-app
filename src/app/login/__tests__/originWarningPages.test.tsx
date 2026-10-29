import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExplorerPage, { dynamic as explorerDynamic, metadata as explorerMetadata } from "../explorer/page";
import GuidePage, { dynamic as guideDynamic, metadata as guideMetadata } from "../guide/page";
import AdminPage, { dynamic as adminDynamic, metadata as adminMetadata } from "../admin/page";

const origin = vi.hoisted(() => ({ load: vi.fn<() => string>() }));
vi.mock("@/lib/solmind/auth/trustedApplicationOrigin", () => ({ loadTrustedApplicationOrigin: origin.load }));
vi.mock("@/components/solmind/LoopbackSignInAddressWarning", () => ({
  LoopbackSignInAddressWarning: ({ configuredOrigin, role }: { configuredOrigin: string | null; role: string }) =>
    createElement("div", { "data-configured-origin": configuredOrigin ?? "withheld", "data-role": role }),
}));
vi.mock("@/components/solmind/LoginExperience", () => ({
  LoginExperience: (props: { initialExplorer?: boolean; initialGuide?: boolean; initialAdmin?: boolean }) =>
    createElement("div", { "data-login": props.initialExplorer ? "explorer" : props.initialGuide ? "guide" : props.initialAdmin ? "admin" : "missing" }),
}));
const pages = [
  ["explorer", ExplorerPage, explorerDynamic, explorerMetadata],
  ["guide", GuidePage, guideDynamic, guideMetadata],
  ["admin", AdminPage, adminDynamic, adminMetadata],
] as const;
beforeEach(() => { origin.load.mockReset(); });

describe("role login pages public origin configuration", () => {
  it.each(pages)("keeps %s runtime configuration, original metadata and role experience", (role, Page, dynamic, metadata) => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe(`${role[0].toUpperCase()}${role.slice(1)} sign-in - SolMind MVP0`);
    for (const configured of ["http://127.0.0.1:4311", "https://localhost:4311"]) {
      origin.load.mockReturnValue(configured);
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain(`data-configured-origin="${configured}"`);
      expect(html).toContain(`data-role="${role}"`);
      expect(html).toContain(`data-login="${role}"`);
    }
  });
  it.each(pages)("withholds production, IPv6 and unavailable configuration from %s client props", (_role, Page) => {
    for (const configured of ["https://private.example.test", "http://[::1]:4311", "not an origin"]) {
      origin.load.mockReturnValue(configured);
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain('data-configured-origin="withheld"');
      expect(html).not.toContain(configured);
    }
    origin.load.mockImplementation(() => { throw new Error("unavailable public configuration"); });
    expect(renderToStaticMarkup(createElement(Page))).toContain('data-configured-origin="withheld"');
  });
});
