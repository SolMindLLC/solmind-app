import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import ExplorerPage from "../page";

// Paul's decision (decision queue 2026-11-04 21:44:03 CST): the June onboarding
// mockup is removed and the address /explorer opens the Explorer Overview,
// which keeps its own sign-in check.
describe("/explorer", () => {
  it("EX01 opens the Explorer Overview and renders nothing of its own", () => {
    expect(() => ExplorerPage()).toThrow("redirect:/explorer/home");
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/explorer/home");
  });
});
