import { describe, expect, it } from "vitest";

import {
  createInMemoryRequestCookieAccessor,
  findRequestCookieValue,
  noopCookieSetAll,
  type RequestCookie,
  type RequestCookieToSet,
} from "../requestCookieAccessor";

// A representative incoming request cookie set, in the { name, value } read
// shape an @supabase/ssr getAll() yields. Values are opaque here; this contract
// neither decodes nor verifies them.
function sampleCookies(): RequestCookie[] {
  return [
    { name: "sb-access-token", value: "access-token-value" },
    { name: "sb-refresh-token", value: "refresh-token-value" },
  ];
}

describe("createInMemoryRequestCookieAccessor - getAll read contract", () => {
  it("returns the configured cookies in the { name, value } shape", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    expect(accessor.getAll()).toEqual(sampleCookies());
  });

  it("returns an empty array when constructed with no cookies", () => {
    const accessor = createInMemoryRequestCookieAccessor();

    expect(accessor.getAll()).toEqual([]);
  });

  it("is deterministic across repeated reads", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    expect(accessor.getAll()).toEqual(accessor.getAll());
  });

  it("returns a defensive copy so the fixture cannot be mutated through reads", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    const first = accessor.getAll();
    first.push({ name: "injected", value: "x" });
    first[0].value = "tampered";

    // A second read is unaffected by mutation of the first read's result.
    expect(accessor.getAll()).toEqual(sampleCookies());
  });

  it("snapshots its input so later mutation of the source array does not leak in", () => {
    const source = sampleCookies();
    const accessor = createInMemoryRequestCookieAccessor(source);

    source.push({ name: "added-after", value: "y" });
    source[0].value = "changed-after";

    expect(accessor.getAll()).toEqual(sampleCookies());
  });
});

describe("MVP0 cookie writes are an explicit no-op", () => {
  const writes: RequestCookieToSet[] = [
    {
      name: "sb-access-token",
      value: "rotated-token",
      options: { path: "/", httpOnly: true },
    },
  ];

  it("noopCookieSetAll persists nothing, returns undefined, and does not throw", () => {
    expect(() => noopCookieSetAll()).not.toThrow();
    expect(noopCookieSetAll()).toBeUndefined();
  });

  it("accessor.setAll is a no-op: reads are unchanged after a write attempt", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    accessor.setAll(writes);

    // The verification-only boundary never persists or rotates cookies, so
    // getAll still reflects only the original incoming cookies.
    expect(accessor.getAll()).toEqual(sampleCookies());
  });
});

describe("findRequestCookieValue - pure read helper", () => {
  it("returns the value for a present cookie name", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    expect(findRequestCookieValue(accessor, "sb-access-token")).toBe(
      "access-token-value",
    );
  });

  it("returns null for an absent cookie name (no normalization, exact match)", () => {
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    expect(findRequestCookieValue(accessor, "SB-ACCESS-TOKEN")).toBeNull();
    expect(findRequestCookieValue(accessor, "missing")).toBeNull();
  });

  it("returns null when there are no cookies at all", () => {
    const accessor = createInMemoryRequestCookieAccessor();

    expect(findRequestCookieValue(accessor, "sb-access-token")).toBeNull();
  });
});

describe("accessor shape is compatible with a getAll-style consumer", () => {
  it("supports the read pattern a future @supabase/ssr adapter needs, dependency-free", () => {
    // Mimic, without importing @supabase/ssr, how the future server-only adapter
    // would hand cookies to a request-scoped Supabase auth client: read every
    // cookie via getAll, then map by name. No write path is exercised.
    const accessor = createInMemoryRequestCookieAccessor(sampleCookies());

    const byName = new Map(
      accessor.getAll().map((cookie) => [cookie.name, cookie.value]),
    );

    expect(byName.get("sb-access-token")).toBe("access-token-value");
    expect(byName.get("sb-refresh-token")).toBe("refresh-token-value");
    expect(byName.has("nonexistent")).toBe(false);
  });
});
