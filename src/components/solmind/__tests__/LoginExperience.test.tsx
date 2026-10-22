import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginExperience } from "../LoginExperience";
import { SignInPreview } from "../SignInPreview";
import LoginPage, { metadata } from "../../../app/login/page";
import ExplorerLoginPage from "../../../app/login/explorer/page";
import GuideLoginPage from "../../../app/login/guide/page";
import { SOLMIND_ROLES } from "../../../lib/solmind/roles";
import { PREVIEW_DISCLOSURE } from "../../../lib/solmind/signInPreview";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  for (const level of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("connected Explorer and Guide composition without mounted claims", () => {
  it("L01 chooser retains all three approved role choices with honest availability", () => {
    const html = renderToStaticMarkup(createElement(LoginExperience));
    expect(html.includes("How do you use SolMind?") && html.includes("Explorer and Guide sign-in are connected.") && html.includes("Admin sign-in is a preview.")).toBe(true);
    expect(html.includes("I'm an Explorer") || html.includes("I&#x27;m an Explorer")).toBe(true);
    expect(html.includes(PREVIEW_DISCLOSURE)).toBe(false);
  });
  it("L02 fixed Explorer entry renders the connected email view without preview controls", () => {
    const html = renderToStaticMarkup(createElement(LoginExperience, { initialExplorer: true }));
    expect(html.includes("Signing in as an Explorer") && html.includes("Send my code")).toBe(true);
    expect(html.includes("Preview controls") || html.includes("Example screen")).toBe(false);
  });
  it("L06 fixed Guide entry shows password-plus-code without preview controls", () => {
    const html = renderToStaticMarkup(createElement(LoginExperience, { initialGuide: true }));
    expect(html.includes("Guide") && html.includes("type=\"password\"") && html.includes("Send my code")).toBe(true);
    expect(html.includes("Preview controls") || html.includes("Example screen")).toBe(false);
  });
  it("L03 retained direct preview callers remain effect-free", () => {
    for (const role of [SOLMIND_ROLES.GUIDE, SOLMIND_ROLES.ADMIN] as const) {
      const html = renderToStaticMarkup(createElement(SignInPreview, { initialRole: role, onChooseDifferentRole: () => undefined }));
      expect(html.includes("Preview controls") && html.includes("not connected yet") && html.includes("type=\"password\"")).toBe(true);
      expect(html.includes("Send my code")).toBe(true);
    }
  });
  it("L04 default preview callers retain A1 and no connected behavior", () => {
    const html = renderToStaticMarkup(createElement(SignInPreview));
    expect(html.includes("How do you use SolMind?") && html.includes("not connected yet")).toBe(true);
  });
  it("L05 thin pages pass only fixed serializable presentation props", () => {
    const start = LoginPage();
    const role = ExplorerLoginPage();
    const guide = GuideLoginPage();
    expect(guide.type === LoginExperience && guide.props.initialGuide === true && Object.keys(guide.props).length === 1).toBe(true);
    expect(start.type === LoginExperience && Object.keys(start.props).length === 0).toBe(true);
    expect(role.type === LoginExperience && role.props.initialExplorer === true && Object.keys(role.props).length === 1).toBe(true);
    expect(metadata.description?.includes("Admin sign-in remains a preview.")).toBe(true);
  });
});
