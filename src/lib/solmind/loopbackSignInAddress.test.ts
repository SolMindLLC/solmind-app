import { describe, expect, it } from "vitest";
import { loopbackSignInAddress } from "./loopbackSignInAddress";

describe("public loopback sign-in address hint", () => {
  it.each(["explorer", "guide", "admin"])("offers only a fixed %s path for the exact opposite loopback host", role => {
    expect(loopbackSignInAddress("http://localhost:4311", "http://127.0.0.1:4311", role)).toBe(`http://127.0.0.1:4311/login/${role}`);
    expect(loopbackSignInAddress("https://127.0.0.1:4311", "https://localhost:4311", role)).toBe(`https://localhost:4311/login/${role}`);
    expect(loopbackSignInAddress("http://localhost", "http://127.0.0.1", role)).toBe(`http://127.0.0.1/login/${role}`);
  });
  it("does not warn for matching addresses, unrelated hosts, other loopback aliases or changed protocol/port", () => {
    for (const [current, configured] of [
      ["http://localhost:4311", "http://localhost:4311"], ["http://127.0.0.1:4311", "http://127.0.0.1:4311"],
      ["http://example.test:4311", "http://127.0.0.1:4311"], ["http://localhost:4311", "http://example.test:4311"],
      ["http://[::1]:4311", "http://localhost:4311"], ["http://localhost.:4311", "http://127.0.0.1:4311"],
      ["http://localhost:4311", "https://127.0.0.1:4311"], ["http://localhost:4311", "http://127.0.0.1:4312"],
    ]) expect(loopbackSignInAddress(current, configured, "explorer")).toBeNull();
  });
  it("rejects noncanonical or malformed origins rather than repairing or disclosing them", () => {
    for (const value of [null, undefined, "", 3, " http://localhost:4311", "http://localhost:4311/", "http://localhost:4311/path",
      "http://localhost:4311?x=1", "http://localhost:4311#fragment", "http://user:password@localhost:4311", "HTTP://LOCALHOST:4311",
      "http://localhost:80", "http://127.1:4311", "http://localhost:4311\n", "javascript:alert(1)", "not an origin"]) {
      expect(loopbackSignInAddress(value, "http://127.0.0.1:4311", "guide")).toBeNull();
      expect(loopbackSignInAddress("http://127.0.0.1:4311", value, "guide")).toBeNull();
    }
  });
  it("accepts only fixed roles, never an arbitrary path or authority selector", () => {
    for (const role of [null, undefined, "", "Explorer", "admin/other", "../admin", "//example.test", {}, 1]) {
      expect(loopbackSignInAddress("http://localhost:4311", "http://127.0.0.1:4311", role)).toBeNull();
    }
  });
});
