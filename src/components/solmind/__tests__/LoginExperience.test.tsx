import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginExperience } from "../LoginExperience";
import { SignInPreview } from "../SignInPreview";
import LoginPage, { metadata } from "../../../app/login/page";
import ExplorerLoginPage from "../../../app/login/explorer/page";
import { SOLMIND_ROLES } from "../../../lib/solmind/roles";
import { PREVIEW_DISCLOSURE } from "../../../lib/solmind/signInPreview";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("unexpected_effect"); });
  for (const level of ["log", "warn", "error", "info", "debug"] as const) vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => { expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(0); vi.restoreAllMocks(); });

describe("connected Explorer composition without mounted claims", () => {
  it("L01 chooser retains all three approved role choices with honest availability", () => {
    const html = renderToStaticMarkup(createElement(LoginExperience));
    expect(html.includes("How do you use SolMind?") && html.includes("Explorer sign-in is connected.") && html.includes("Guide and Admin sign-in are previews.")).toBe(true);
    expect(html.includes("I'm an Explorer") || html.includes("I&#x27;m an Explorer")).toBe(true);
    expect(html.includes(PREVIEW_DISCLOSURE)).toBe(false);
  });
  it("L02 fixed Explorer entry renders the connected email view without preview controls", () => {
    const html = renderToStaticMarkup(createElement(LoginExperience, { initialExplorer: true }));
    expect(html.includes("Signing in as an Explorer") && html.includes("Send my code")).toBe(true);
    expect(html.includes("Preview controls") || html.includes("Example screen")).toBe(false);
  });
  it("L03 each password role remains a disclosed effect-free preview", () => {
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
    expect(start.type === LoginExperience && Object.keys(start.props).length === 0).toBe(true);
    expect(role.type === LoginExperience && role.props.initialExplorer === true && Object.keys(role.props).length === 1).toBe(true);
    expect(metadata.description?.includes("Guide and Admin sign-in screens remain previews.")).toBe(true);
  });
});
