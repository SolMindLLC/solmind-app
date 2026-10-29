import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoopbackSignInAddressWarning } from "../LoopbackSignInAddressWarning";

const store = vi.hoisted(() => ({ server: true, current: null as string | null }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useSyncExternalStore: (_subscribe: unknown, _read: unknown, serverSnapshot: () => null) =>
    store.server ? serverSnapshot() : store.current };
});
afterEach(() => { store.server = true; store.current = null; });

// Injected snapshot rendering only; no real hydration, navigation or authentication proof.
describe("loopback sign-in address presentation", () => {
  it("publishes no warning or configured address in the initial server snapshot", () => {
    const html = renderToStaticMarkup(createElement(LoopbackSignInAddressWarning,
      { configuredOrigin: "http://127.0.0.1:4311", role: "explorer" }));
    expect(html).toBe("");
  });
  it("renders the exact informational copy and deliberate fixed-role link for the post-hydration snapshot", () => {
    store.server = false; store.current = "http://localhost:4311";
    const html = renderToStaticMarkup(createElement(LoopbackSignInAddressWarning,
      { configuredOrigin: "http://127.0.0.1:4311", role: "admin" }));
    expect(html).toContain("localhost and 127.0.0.1 keep separate sign-ins. Use the configured SolMind address.");
    expect(html).toContain('href="http://127.0.0.1:4311/login/admin"');
    expect(html).toContain("Use the configured sign-in address");
  });
  it("renders nothing for matching, withheld or unrelated configured addresses", () => {
    store.server = false; store.current = "http://localhost:4311";
    for (const configuredOrigin of [null, "http://localhost:4311", "https://private.example.test"]) {
      expect(renderToStaticMarkup(createElement(LoopbackSignInAddressWarning, { configuredOrigin, role: "guide" }))).toBe("");
    }
  });
});
