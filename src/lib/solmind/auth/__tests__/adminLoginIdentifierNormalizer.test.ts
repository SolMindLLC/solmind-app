// Synthetic pure tests only. Assertions expose fixed labels/booleans, not input.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeAdminLoginIdentifier,
  type NormalizedAdminLoginIdentifier,
} from "../adminLoginIdentifierNormalizer";
import * as emailNormalizer from "../loginContactNormalizer";

const ALLOWED_USERNAME_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

function matches(
  actual: NormalizedAdminLoginIdentifier | null,
  type: "email" | "username",
  value: string,
): boolean {
  return actual !== null && actual.identifierType === type && actual.normalizedIdentifier === value;
}

beforeEach(() => {
  for (const method of CONSOLE_METHODS) vi.spyOn(console, method).mockImplementation(() => {});
});

afterEach(() => {
  const silent = CONSOLE_METHODS.every((method) => vi.mocked(console[method]).mock.calls.length === 0);
  vi.restoreAllMocks();
  expect(silent).toBe(true);
});

describe("Admin identifier normalization", () => {
  it.each(Array.from({ length: 128 }, (_, code) => code))(
    "ANI-ASCII-%i validates every embedded ASCII character against the approved set",
    (code) => {
      const character = String.fromCharCode(code);
      const result = normalizeAdminLoginIdentifier(`A${character}Z`);
      if (ALLOWED_USERNAME_CHARACTERS.includes(character)) {
        expect(matches(result, "username", `a${character.toLowerCase()}z`)).toBe(true);
      } else if (character === "@") {
        expect(matches(result, "email", "a@z")).toBe(true);
      } else {
        expect(result === null).toBe(true);
      }
    },
  );

  it("ANI-001 folds ASCII letters and trims only outer ordinary spaces", () => {
    expect(matches(normalizeAdminLoginIdentifier("  ADMIN.09_Name-  "), "username", "admin.09_name-")).toBe(true);
  });

  it("ANI-002 permits exactly the approved punctuation without an invented prefix rule", () => {
    for (const value of [".", "_", "-", ".-_", "A..B", "__A--", "9"]) {
      expect(matches(normalizeAdminLoginIdentifier(value), "username", value.toLowerCase())).toBe(true);
    }
  });

  it("ANI-003 refuses empty and ordinary-space-only values", () => {
    for (const value of ["", " ", " ".repeat(512)]) {
      expect(normalizeAdminLoginIdentifier(value) === null).toBe(true);
    }
  });

  it("ANI-004 accepts the exact typed length bound", () => {
    expect(matches(normalizeAdminLoginIdentifier("A".repeat(512)), "username", "a".repeat(512))).toBe(true);
    expect(matches(normalizeAdminLoginIdentifier(` ${"A".repeat(510)} `), "username", "a".repeat(510))).toBe(true);
  });

  it("ANI-005 enforces the bound before trimming", () => {
    for (const value of ["A".repeat(513), ` ${"A".repeat(511)} `, `${" ".repeat(512)}A`]) {
      expect(normalizeAdminLoginIdentifier(value) === null).toBe(true);
    }
  });

  it("ANI-006 refuses other outer whitespace and line terminators", () => {
    for (const character of ["\t", "\n", "\r", "\f", "\v", "\u0085", "\u00a0", "\u2028", "\u2029", "\ufeff"]) {
      for (const value of [`${character}ADMIN`, `ADMIN${character}`, ` ${character}ADMIN `]) {
        expect(normalizeAdminLoginIdentifier(value) === null).toBe(true);
      }
    }
  });

  it("ANI-007 refuses non-ASCII, confusables, invisible text and isolated surrogates", () => {
    for (const character of ["\u212a", "\u0130", "\u00df", "\u0430", "\uff21", "\u0301", "\u200b", "\u200d", "\u202e", "\ud800", "\udfff", "\ud83d\ude00"]) {
      expect(normalizeAdminLoginIdentifier(`A${character}Z`) === null).toBe(true);
    }
  });

  it("ANI-008 never coerces non-string inputs", () => {
    let coerced = false;
    const trap = () => { coerced = true; throw new Error("unexpected-coercion"); };
    const hostile = { toString: trap, valueOf: trap, [Symbol.toPrimitive]: trap };
    const proxy = new Proxy({}, { get: trap, getPrototypeOf: trap, ownKeys: trap });
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();
    for (const value of [undefined, null, true, 123, BigInt(1), Symbol("synthetic"), {}, [], ["ADMIN"], new String("ADMIN"), hostile, proxy, revocable.proxy, () => "ADMIN"]) {
      expect(normalizeAdminLoginIdentifier(value) === null).toBe(true);
    }
    expect(coerced).toBe(false);
  });

  it("ANI-009 preserves the established email whitespace and punctuation policy", () => {
    const cases = [
      ["\tAdmin@Synthetic.INVALID\n", "admin@synthetic.invalid"],
      ["\r\n\f O'BRIEN+tag@Synthetic.INVALID \r\n", "o'brien+tag@synthetic.invalid"],
      ["A!#$%&'*+/=?^_`{|}~-Z@SUB-1.Synthetic.INVALID", "a!#$%&'*+/=?^_`{|}~-z@sub-1.synthetic.invalid"],
      ["A@B", "a@b"],
    ];
    for (const [typed, expected] of cases) {
      expect(matches(normalizeAdminLoginIdentifier(typed), "email", expected)).toBe(true);
      expect(emailNormalizer.normalizeLoginEmail(typed) === expected).toBe(true);
    }
  });

  it("ANI-010 delegates the original email text exactly once", () => {
    const original = "\tAdmin@Synthetic.INVALID\n";
    const spy = vi.spyOn(emailNormalizer, "normalizeLoginEmail");
    expect(matches(normalizeAdminLoginIdentifier(original), "email", "admin@synthetic.invalid")).toBe(true);
    expect(spy.mock.calls.length === 1 && spy.mock.calls[0][0] === original).toBe(true);
  });

  it("ANI-011 never falls back when the email owner refuses", () => {
    const spy = vi.spyOn(emailNormalizer, "normalizeLoginEmail").mockReturnValue(null);
    expect(normalizeAdminLoginIdentifier("admin@synthetic.invalid") === null).toBe(true);
    expect(spy.mock.calls.length === 1).toBe(true);
  });

  it("ANI-012 rejects malformed email rather than reinterpreting text", () => {
    for (const value of ["@", "ADMIN@", "@synthetic.invalid", "A@@B", "A..B@synthetic.invalid", "A B@synthetic.invalid", "<A>@synthetic.invalid", "A@B\u00a0"]) {
      expect(normalizeAdminLoginIdentifier(value) === null).toBe(true);
    }
  });

  it("ANI-013 preserves the separate canonical email length bound", () => {
    const accepted = `${"a".repeat(252)}@b`;
    const rejected = `${"a".repeat(253)}@b`;
    expect(matches(normalizeAdminLoginIdentifier(accepted), "email", accepted)).toBe(true);
    expect(normalizeAdminLoginIdentifier(rejected) === null).toBe(true);
  });

  it("ANI-014 enforces the typed email bound before calling its owner", () => {
    const spy = vi.spyOn(emailNormalizer, "normalizeLoginEmail");
    const accepted = `${" ".repeat(509)}a@b`;
    expect(matches(normalizeAdminLoginIdentifier(accepted), "email", "a@b")).toBe(true);
    spy.mockClear();
    expect(normalizeAdminLoginIdentifier(` ${accepted}`) === null).toBe(true);
    expect(spy.mock.calls.length === 0).toBe(true);
  });

  it("ANI-015 does not send usernames to the email owner", () => {
    const spy = vi.spyOn(emailNormalizer, "normalizeLoginEmail");
    expect(matches(normalizeAdminLoginIdentifier("ADMIN"), "username", "admin")).toBe(true);
    expect(spy.mock.calls.length === 0).toBe(true);
  });

  it("ANI-016 returns frozen exact two-field records and is idempotent", () => {
    for (const value of [" ADMIN.09_ ", " Admin@Synthetic.INVALID "]) {
      const result = normalizeAdminLoginIdentifier(value);
      expect(result !== null).toBe(true);
      if (result === null) throw new Error("missing-synthetic-result");
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.keys(result).sort().join(",") === "identifierType,normalizedIdentifier").toBe(true);
      expect(matches(normalizeAdminLoginIdentifier(result.normalizedIdentifier), result.identifierType, result.normalizedIdentifier)).toBe(true);
      expect(Reflect.set(result, "normalizedIdentifier", "other") === false).toBe(true);
    }
  });
});
