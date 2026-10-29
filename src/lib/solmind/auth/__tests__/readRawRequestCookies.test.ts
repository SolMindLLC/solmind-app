import { describe, expect, it } from "vitest";
import { readRawRequestCookies } from "../readRawRequestCookies";

// Synthetic framing only; identity, token format and session authority stay
// with the existing request-auth boundary. No real cookies or IO are used.
describe("Shared raw request cookie reader", () => {
  it("keeps exact values and every duplicate in wire order without decoding or unquoting", () => {
    expect(readRawRequestCookies(null)).toEqual([]);
    expect(readRawRequestCookies("")).toEqual([]);
    expect(readRawRequestCookies("__Host-solmind-auth=v; __Host-solmind-session=w")).toEqual([{ name: "__Host-solmind-auth", value: "v" }, { name: "__Host-solmind-session", value: "w" }]);
    expect(readRawRequestCookies("solmind-auth=opaque%2Fvalue%3D==;\tsolmind-session=first; solmind-session=second; theme=; theme=dark"))
      .toEqual([{ name: "solmind-auth", value: "opaque%2Fvalue%3D==" },
        { name: "solmind-session", value: "first" }, { name: "solmind-session", value: "second" },
        { name: "theme", value: "" }, { name: "theme", value: "dark" }]);
  });

  it("skips malformed unrelated pairs and empty segments without dropping valid target occurrences", () => {
    expect(readRawRequestCookies("; missing-equals; bad name=value; quoted=\"bad\"; tabs=bad\tvalue; spaced=bad value; solmind-auth=first; solmind-auth=second;"))
      .toEqual([{ name: "solmind-auth", value: "first" }, { name: "solmind-auth", value: "second" }]);
    expect(readRawRequestCookies("; unrelated; bad name=value;")).toEqual([]);
  });

  it("refuses malformed owned-looking material, including a bad duplicate beside a valid one", () => {
    for (const prefix of ["", "__Host-"]) {
      for (const malformed of [
        `${prefix}solmind-auth`, `${prefix}solmind-auth =value`, `${prefix}solmind-auth=has space`,
        `${prefix}solmind-session`, `${prefix}solmind-session=bad,merged`, `${prefix}solmind-session=\"quoted\"`,
        `${prefix}solmind-auth.0=bad\tvalue`, `${prefix}solmind-auth-code-verifier=has space`,
        `${prefix}solmind-auth-suspicious=has space`, `${prefix}solmind-session-suspicious=has space`,
      ]) {
        expect(readRawRequestCookies(malformed)).toBeNull();
        expect(readRawRequestCookies(`${prefix}solmind-auth=synthetic; ${malformed}`)).toBeNull();
        expect(readRawRequestCookies(`${malformed}; ${prefix}solmind-auth=synthetic`)).toBeNull();
      }
    }
  });

  it("does not reinterpret case, encoded names or otherwise valid suffixes as a different target", () => {
    expect(readRawRequestCookies("Solmind-auth=has space; __host-solmind-session=has space; solmind%2Dauth=raw%2F==; solmind-auth-suffix=valid"))
      .toEqual([{ name: "solmind%2Dauth", value: "raw%2F==" }, { name: "solmind-auth-suffix", value: "valid" }]);
  });

  it("keeps the original code-unit and raw-segment budgets even for skipped fragments", () => {
    expect(readRawRequestCookies("x=" + "a".repeat(16_382))).toEqual([{ name: "x", value: "a".repeat(16_382) }]);
    expect(readRawRequestCookies("x=" + "a".repeat(16_383))).toBeNull();
    expect(readRawRequestCookies("bad=" + "🧭".repeat(8_190))).toEqual([]);
    expect(readRawRequestCookies("bad=" + "🧭".repeat(8_191))).toBeNull();
    expect(readRawRequestCookies(";".repeat(127))).toEqual([]);
    expect(readRawRequestCookies(";".repeat(128))).toBeNull();
    for (const forbidden of ["\r", "\n", "\u0000"]) {
      expect(readRawRequestCookies(`unrelated=bad${forbidden}value; solmind-auth=synthetic`)).toBeNull();
    }
  });
});
