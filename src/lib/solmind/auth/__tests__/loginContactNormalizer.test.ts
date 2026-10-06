// Login step 6, sub-slice S6-1: the shared login contact normalizer
// (AUTH-RLS-DEC-033). Every address here is synthetic, under the reserved
// `.invalid` name. The module boundary of the three S6-1 modules is tested
// in `loginRouteConfiguration.test.ts`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOGIN_CONTACT_NORMALIZER_LIMITS, normalizeLoginEmail } from "../loginContactNormalizer";
import { isCanonicalVerificationEmail } from "../verificationCodeDelivery";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// The migration that holds the current definition of the issuance function.
const ISSUANCE_MIGRATION = "20260929010000_verification_issuance_abuse_limits.sql";
const ISSUANCE_DEFINITION = "create or replace function public.solmind_issue_verification_challenge(";

// Every printable ASCII character, 0x21 to 0x7E, and the space.
const PRINTABLE_ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, index) =>
  String.fromCharCode(0x20 + index),
);

beforeEach(() => {
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method);
  }
});

afterEach(() => {
  for (const method of CONSOLE_METHODS) {
    expect(console[method]).not.toHaveBeenCalled();
  }
  vi.restoreAllMocks();
});

// The app root, or, when this file runs from a proposal folder that holds
// only new files, the live app's.
function appRoot(): string {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "..", "..", "..", "..", "..");
  const proposalRoot = path.resolve(root, "..");
  if (
    !fs.existsSync(path.join(root, "supabase", "migrations")) &&
    path.basename(proposalRoot).includes("_proposed_")
  ) {
    return path.resolve(proposalRoot, "..", "solmind-app");
  }
  return root;
}

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

describe("loginContactNormalizer - the shared login email normalizer (AUTH-RLS-DEC-033)", () => {
  it("LCN-001 fixes the input bound and the database's email length bounds", () => {
    expect(LOGIN_CONTACT_NORMALIZER_LIMITS).toEqual({
      maximumInputCharacters: 512,
      minimumEmailCharacters: 3,
      maximumEmailCharacters: 254,
    });
    expect(Object.isFrozen(LOGIN_CONTACT_NORMALIZER_LIMITS)).toBe(true);
  });

  it("LCN-002 returns the canonical email: ASCII letters lowercased, surrounding ASCII whitespace removed, and the result unchanged when normalized again", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["explorer.s61@synthetic.invalid", "explorer.s61@synthetic.invalid"],
      ["Explorer.S61@Synthetic.INVALID", "explorer.s61@synthetic.invalid"],
      ["GUIDE@SYNTHETIC.INVALID", "guide@synthetic.invalid"],
      ["  guide.s61@synthetic.invalid  ", "guide.s61@synthetic.invalid"],
      ["\tadmin.s61@synthetic.invalid\n", "admin.s61@synthetic.invalid"],
      ["\r\n\f admin.s61@synthetic.invalid \r\n", "admin.s61@synthetic.invalid"],
      ["o'brien+tag@synthetic.invalid", "o'brien+tag@synthetic.invalid"],
      ["a!#$%&'*+/=?^_`{|}~-z@sub-1.synthetic.invalid", "a!#$%&'*+/=?^_`{|}~-z@sub-1.synthetic.invalid"],
      ["a@b", "a@b"],
    ];
    for (const [typed, canonical] of cases) {
      expect(normalizeLoginEmail(typed), JSON.stringify(typed)).toBe(canonical);
      expect(normalizeLoginEmail(canonical)).toBe(canonical);
      expect(isCanonicalVerificationEmail(canonical)).toBe(true);
    }
  });

  it("LCN-003 refuses anything that is not text, and empty or whitespace-only text", () => {
    for (const value of [
      undefined,
      null,
      0,
      1,
      true,
      {},
      ["explorer.s61@synthetic.invalid"],
      Object("explorer.s61@synthetic.invalid"),
      Symbol("explorer"),
      () => "explorer.s61@synthetic.invalid",
    ]) {
      expect(normalizeLoginEmail(value)).toBeNull();
    }
    for (const value of ["", " ", "\t\n\f\r ", "@", "a@", "@b"]) {
      expect(normalizeLoginEmail(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("LCN-004 bounds the input at 512 characters before any other work, and the email at 3 to 254", () => {
    const email = "explorer.s61@synthetic.invalid";
    const padding = " ".repeat(512 - email.length);
    expect(normalizeLoginEmail(`${padding}${email}`)).toBe(email);
    expect(normalizeLoginEmail(` ${padding}${email}`)).toBeNull();
    const at254 = `a@${"b".repeat(252)}`;
    expect(at254).toHaveLength(254);
    expect(normalizeLoginEmail(at254)).toBe(at254);
    expect(normalizeLoginEmail(`${at254}b`)).toBeNull();
    expect(normalizeLoginEmail("a@b")).toBe("a@b");
    expect(normalizeLoginEmail("ab")).toBeNull();
    expect(normalizeLoginEmail("x".repeat(100_000))).toBeNull();
  });

  it("LCN-005 maps or folds nothing outside ASCII: every non-ASCII character, look-alikes included, is refused", () => {
    // U+212A KELVIN SIGN lowercases to an ASCII `k` under Unicode rules, and
    // U+0130 to `i` plus a combining dot; neither is mapped here.
    expect(String.fromCharCode(0x212a).toLowerCase()).toBe("k");
    const nonAscii = [
      0x00a0, // no-break space
      0x00e9, // e with acute
      0x0130, // capital I with dot above
      0x200b, // zero-width space
      0x2028, // line separator
      0x2029, // paragraph separator
      0x212a, // Kelvin sign
      0xfeff, // byte-order mark
      0xff20, // fullwidth commercial at
      0x0080, // a C1 control
    ];
    for (const code of nonAscii) {
      const character = String.fromCharCode(code);
      for (const typed of [
        `${character}ate@synthetic.invalid`,
        `kate${character}@synthetic.invalid`,
        `kate@synthetic.invalid${character}`,
        `${character}kate@synthetic.invalid`,
        `kate@synthetic${character}invalid`,
      ]) {
        expect(normalizeLoginEmail(typed), code.toString(16)).toBeNull();
      }
    }
    // A surrogate pair, and a lone surrogate.
    expect(normalizeLoginEmail(`kate${String.fromCharCode(0xd83d, 0xde00)}@synthetic.invalid`)).toBeNull();
    expect(normalizeLoginEmail(`kate${String.fromCharCode(0xd83d)}@synthetic.invalid`)).toBeNull();
  });

  it("LCN-006 refuses inner whitespace, control characters and every structure the database refuses", () => {
    const refused = [
      "kate @synthetic.invalid",
      "kate@ synthetic.invalid",
      "ka\tte@synthetic.invalid",
      "kate@synthetic.invalid\nx",
      "kate\r\n@synthetic.invalid",
      `kate${String.fromCharCode(0)}@synthetic.invalid`,
      `kate${String.fromCharCode(0x0b)}@synthetic.invalid`,
      `kate${String.fromCharCode(0x7f)}@synthetic.invalid`,
      `${String.fromCharCode(0x0b)}kate@synthetic.invalid`,
      "kate.synthetic.invalid",
      "kate@@synthetic.invalid",
      "kate@synthetic@invalid",
      "ka..te@synthetic.invalid",
      "kate@synthetic..invalid",
      "kate(x)@synthetic.invalid",
      "kate,x@synthetic.invalid",
      "kate:x@synthetic.invalid",
      "kate;x@synthetic.invalid",
      "<kate@synthetic.invalid>",
      "kate[x]@synthetic.invalid",
      "kate\\x@synthetic.invalid",
      '"kate"@synthetic.invalid',
      "kate@synthetic_invalid",
      "kate@synthetic+invalid",
      "kate@[192.0.2.1]",
    ];
    for (const typed of refused) {
      expect(normalizeLoginEmail(typed), JSON.stringify(typed)).toBeNull();
    }
  });

  it("LCN-007 agrees with the delivery boundary's canonical check for every printable ASCII character in every position", () => {
    let accepted = 0;
    for (const character of PRINTABLE_ASCII) {
      for (const typed of [
        `a${character}b@synthetic.invalid`,
        `${character}@x.invalid`,
        `ab${character}@x.invalid`,
        `ab@syn${character}thetic.invalid`,
        `ab@${character}`,
        `AB${character}CD@X.INVALID`,
      ]) {
        const lowered = asciiLower(typed);
        const expected = isCanonicalVerificationEmail(lowered) ? lowered : null;
        const actual = normalizeLoginEmail(typed);
        expect(actual, JSON.stringify(typed)).toBe(expected);
        if (actual !== null) {
          accepted += 1;
          expect(isCanonicalVerificationEmail(actual)).toBe(true);
          expect(normalizeLoginEmail(actual)).toBe(actual);
        }
      }
    }
    // Controls: both outcomes occur in the sweep.
    expect(accepted).toBeGreaterThan(50);
    expect(accepted).toBeLessThan(PRINTABLE_ASCII.length * 6);
  });

  it("LCN-008 mirrors the current issuance function's email check exactly: its pattern text, its length bounds, its lowercase rule and its no-'..' rule", () => {
    const migrations = path.join(appRoot(), "supabase", "migrations");
    // The current definition is the last migration that creates the function.
    const definers = fs
      .readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => fs.readFileSync(path.join(migrations, name), "utf8").includes(ISSUANCE_DEFINITION));
    expect(definers[definers.length - 1]).toBe(ISSUANCE_MIGRATION);
    const sql = fs.readFileSync(path.join(migrations, ISSUANCE_MIGRATION), "utf8");
    const block = /if p_contact_method_type = 'email' and not \(([\s\S]*?)\) then/.exec(sql);
    expect(block).not.toBeNull();
    const check = (block as RegExpExecArray)[1];
    expect(check).toMatch(/pg_catalog\.char_length\(p_normalized_contact_value\) between 3 and 254/);
    expect(check).toContain("p_normalized_contact_value = pg_catalog.lower(p_normalized_contact_value)");
    expect(check).toContain("p_normalized_contact_value !~ '\\.\\.'");
    const literal = /p_normalized_contact_value ~ '((?:[^']|'')*)'/.exec(check);
    expect(literal).not.toBeNull();
    const databasePattern = (literal as RegExpExecArray)[1].replace(/''/g, "'");
    expect(databasePattern).toBe("^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$");

    // The module's own pattern literal, unescaped, is the same text.
    const moduleText = fs.readFileSync(
      fileURLToPath(new URL("../loginContactNormalizer.ts", import.meta.url)),
      "utf8",
    );
    const moduleLiteral = /const CANONICAL_EMAIL_PATTERN = \/(.*)\/;/.exec(moduleText);
    expect(moduleLiteral).not.toBeNull();
    expect((moduleLiteral as RegExpExecArray)[1].replace(/\\\//g, "/")).toBe(databasePattern);

    // And the behavior matches, character by character, with the database
    // pattern read as a JavaScript pattern (its bracket expression means the
    // same in both).
    const database = new RegExp(databasePattern);
    for (const character of PRINTABLE_ASCII) {
      for (const typed of [`a${character}b@x.invalid`, `ab@x${character}y.invalid`]) {
        const lowered = asciiLower(typed);
        const databaseAccepts =
          lowered.length >= 3 && lowered.length <= 254 && database.test(lowered) && !lowered.includes("..");
        expect(normalizeLoginEmail(typed) !== null, JSON.stringify(typed)).toBe(databaseAccepts);
      }
    }
  });
});
