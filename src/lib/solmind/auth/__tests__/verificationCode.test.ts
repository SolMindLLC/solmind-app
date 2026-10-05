import * as nodeCrypto from "node:crypto";
import { inspect } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VERIFICATION_CODE_ERROR_CODES,
  VERIFICATION_CODE_LIMITS,
  VERIFICATION_CODE_VERIFIER_DOMAIN,
  VERIFICATION_CODE_VERIFIER_PREFIX,
  VERIFICATION_CODE_VERIFIER_VERSION,
  VerificationCodeError,
  computeVerificationCodeVerifier,
  createVerificationCodePepper,
  generateVerificationChallengeId,
  generateVerificationCode,
  isCanonicalVerificationChallengeId,
  isVerificationCodePepper,
  isVerificationCodeVerifier,
  type VerificationCodePepper,
} from "../verificationCode";
import * as verificationCodeModule from "../verificationCode";
import { isSixDigitVerificationCode } from "../verificationCodeDelivery";

// Partial mock: the real functions run unless a test overrides one call, so
// the module's use of randomInt and randomUUID can be observed.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomInt: vi.fn(actual.randomInt),
    randomUUID: vi.fn(actual.randomUUID),
    createHmac: vi.fn(actual.createHmac),
  };
});

// Every final line terminator JavaScript knows. Built from code points, so
// this file stays ASCII.
const LINE_TERMINATORS: ReadonlyArray<readonly [string, string]> = [
  ["LF", "\n"],
  ["CR", "\r"],
  ["CRLF", "\r\n"],
  ["U+2028", String.fromCharCode(0x2028)],
  ["U+2029", String.fromCharCode(0x2029)],
];

// The synthetic pepper of the register's AUTH-RLS-DEC-032 known-answer test
// (execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md,
// "DEF5-S2 register-first clarification (2026-07-12)"). It is published test
// material, not a secret.
const KAT_PEPPER_TEXT = "SOLMIND-SYNTHETIC-TEST-PEPPER-01";
const KAT_PEPPER_BYTES = Buffer.from(KAT_PEPPER_TEXT, "ascii");
const SEQUENTIAL_PEPPER_BYTES = Buffer.from(Array.from({ length: 48 }, (_, index) => index));

const KAT_CHALLENGE_ID = "00000000-0000-4000-8000-000000000001";
// A UUID with letters, so that its uppercase form differs.
const LETTERED_CHALLENGE_ID = "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const KAT_VERIFIER =
  "svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

function katPepper(): VerificationCodePepper {
  return createVerificationCodePepper(KAT_PEPPER_BYTES);
}

function textOf(value: unknown): string {
  return [
    (() => {
      try {
        return JSON.stringify(value) ?? "";
      } catch {
        return "";
      }
    })(),
    String(value),
    inspect(value, { showHidden: true, depth: 5 }),
    value instanceof Error
      ? `${value.name} ${value.message} ${value.stack ?? ""} ${String(value.cause ?? "")}`
      : "",
  ].join(" ");
}

function expectValueFree(value: unknown, secrets: ReadonlyArray<string>): void {
  const text = textOf(value);
  for (const secret of secrets) {
    expect(text).not.toContain(secret);
  }
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the action to throw");
}

function expectCodeError(action: () => unknown, code: string, secrets: ReadonlyArray<string>): void {
  const error = captureError(action);
  expect(error).toBeInstanceOf(VerificationCodeError);
  expect((error as VerificationCodeError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  expectValueFree(error, secrets);
}

describe("verificationCode - the svf1 verifier (AUTH-RLS-DEC-032)", () => {
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

  it("VC-001 reproduces the register's known-answer verifier", () => {
    expect(
      computeVerificationCodeVerifier(katPepper(), KAT_CHALLENGE_ID, "login", "000000"),
    ).toBe(KAT_VERIFIER);
  });

  it("VC-002 reproduces the authentic verifiers the banked redemption pgTAP fixtures store", () => {
    // supabase/tests/verification_challenge_redemption_realpath_test.sql
    // stores these verifiers for the synthetic pepper, purpose `login` and
    // code 000000. Matching them shows the app computes what the database
    // tests expect to redeem.
    const fixtures: ReadonlyArray<readonly [string, string]> = [
      [
        "def50002-0000-4000-8000-000000000002",
        "svf1:bb15436feb0032227097e230da2da8e2b7c38942d717251e49d33ed0fb2ee1ab",
      ],
      [
        "def50002-0000-4000-8000-000000000003",
        "svf1:b97b516093ca5525aeca549cf60dfd39af7e4e021e576a7e07735a25957a385c",
      ],
      [
        "def50002-0000-4000-8000-000000000006",
        "svf1:5995a5c5c5318bd0e4277b125dfd4b79562271dd3bb5adf399c5f909d9bccfc6",
      ],
    ];
    const pepper = katPepper();
    for (const [challengeId, verifier] of fixtures) {
      expect(computeVerificationCodeVerifier(pepper, challengeId, "login", "000000")).toBe(
        verifier,
      );
    }
  });

  it("VC-003 matches vectors computed independently with Python's hmac for other purposes, codes and peppers", () => {
    // Computed with Python 3 `hmac.new(pepper, message, hashlib.sha256)`,
    // where message is the four ASCII fields joined by 0x0A.
    const vectors: ReadonlyArray<
      readonly [Buffer, string, Parameters<typeof computeVerificationCodeVerifier>[2], string, string]
    > = [
      [
        KAT_PEPPER_BYTES,
        "6f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
        "password_reset",
        "048213",
        "svf1:cd282975ecb16cf6cc77ece8bfd146364b0f9f89ad9d8a8dbf14f24c8e2ae3f4",
      ],
      [
        SEQUENTIAL_PEPPER_BYTES,
        "def50005-0000-4000-8000-0000000000aa",
        "first_admin_setup",
        "999999",
        "svf1:67f81b2f179ebafb614035fccd31bddaf8fd18210a95f1e1f2004b8659d6132d",
      ],
      [
        KAT_PEPPER_BYTES,
        KAT_CHALLENGE_ID,
        "role_reentry",
        "123456",
        "svf1:5a0e59325062f8a598fee1e7fc325cf88dda8293516f989bbf1a83fdb5c5c0e9",
      ],
      [
        KAT_PEPPER_BYTES,
        KAT_CHALLENGE_ID,
        "contact_verify",
        "000001",
        "svf1:57a97eb4f01eafc68893f5f549ca30fbe5c5e5be2d4a0aeb6795113f6ffe2b7f",
      ],
    ];
    for (const [pepperBytes, challengeId, purpose, code, verifier] of vectors) {
      expect(
        computeVerificationCodeVerifier(
          createVerificationCodePepper(pepperBytes),
          challengeId,
          purpose,
          code,
        ),
      ).toBe(verifier);
    }
  });

  it("VC-004 produces the versioned 69-character format and recognises it", () => {
    expect(VERIFICATION_CODE_VERIFIER_VERSION).toBe("svf1");
    expect(VERIFICATION_CODE_VERIFIER_PREFIX).toBe("svf1:");
    expect(VERIFICATION_CODE_VERIFIER_DOMAIN).toBe("solmind-verification-challenge-svf1");
    expect(VERIFICATION_CODE_LIMITS.verifierCharacters).toBe(69);
    const verifier = computeVerificationCodeVerifier(
      katPepper(),
      generateVerificationChallengeId(),
      "login",
      generateVerificationCode(),
    );
    expect(verifier).toMatch(/^svf1:[0-9a-f]{64}$/);
    expect(verifier).toHaveLength(69);
    expect(isVerificationCodeVerifier(verifier)).toBe(true);
    for (const malformed of [
      verifier.toUpperCase(),
      `svf2:${verifier.slice(5)}`,
      `${verifier}0`,
      verifier.slice(0, 68),
      ` ${verifier}`,
      null,
      69,
    ]) {
      expect(isVerificationCodeVerifier(malformed)).toBe(false);
    }
  });

  it("VC-005 uses exactly the four fields joined by 0x0A, with nothing before or after", () => {
    const message = [VERIFICATION_CODE_VERIFIER_DOMAIN, KAT_CHALLENGE_ID, "login", "000000"].join(
      "\n",
    );
    const expected = `svf1:${nodeCrypto
      .createHmac("sha256", KAT_PEPPER_BYTES)
      .update(Buffer.from(message, "ascii"))
      .digest("hex")}`;
    expect(expected).toBe(KAT_VERIFIER);
    const trailing = `svf1:${nodeCrypto
      .createHmac("sha256", KAT_PEPPER_BYTES)
      .update(Buffer.from(`${message}\n`, "ascii"))
      .digest("hex")}`;
    expect(trailing).not.toBe(KAT_VERIFIER);

    // Each field is bound: changing any one of them changes the verifier.
    const pepper = katPepper();
    const variants = new Set([
      computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000"),
      computeVerificationCodeVerifier(
        pepper,
        "00000000-0000-4000-8000-000000000002",
        "login",
        "000000",
      ),
      computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "role_reentry", "000000"),
      computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000001"),
      computeVerificationCodeVerifier(
        createVerificationCodePepper(SEQUENTIAL_PEPPER_BYTES),
        KAT_CHALLENGE_ID,
        "login",
        "000000",
      ),
    ]);
    expect(variants.size).toBe(5);
  });

  it("VC-006 refuses any input outside the fixed format with one fixed, value-free error", () => {
    const pepper = katPepper();
    const secrets = [KAT_PEPPER_TEXT, KAT_PEPPER_BYTES.toString("hex"), "000000", "123456"];
    const badCalls: ReadonlyArray<() => unknown> = [
      // An uppercase UUID names the same database row but would give a
      // different verifier, so it is refused, never silently mismatched.
      () =>
        computeVerificationCodeVerifier(pepper, LETTERED_CHALLENGE_ID.toUpperCase(), "login", "000000"),
      () =>
        computeVerificationCodeVerifier(
          pepper,
          "6F1C2D3E-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
          "login",
          "000000",
        ),
      () => computeVerificationCodeVerifier(pepper, "00000000000040008000000000000001", "login", "000000"),
      () => computeVerificationCodeVerifier(pepper, `{${KAT_CHALLENGE_ID}}`, "login", "000000"),
      () => computeVerificationCodeVerifier(pepper, ` ${KAT_CHALLENGE_ID}`, "login", "000000"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "LOGIN" as never, "000000"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "signup" as never, "000000"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "12345"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "1234567"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "12345a"),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", " 123456"),
      // Arabic-Indic digits are not the ASCII digits the message requires.
      () =>
        computeVerificationCodeVerifier(
          pepper,
          KAT_CHALLENGE_ID,
          "login",
          "\u0661\u0662\u0663\u0664\u0665\u0666",
        ),
      () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", 123456 as never),
      () =>
        computeVerificationCodeVerifier(
          Object.freeze({}) as VerificationCodePepper,
          KAT_CHALLENGE_ID,
          "login",
          "123456",
        ),
      () =>
        computeVerificationCodeVerifier(
          KAT_PEPPER_BYTES as never,
          KAT_CHALLENGE_ID,
          "login",
          "123456",
        ),
      () => computeVerificationCodeVerifier(null as never, KAT_CHALLENGE_ID, "login", "123456"),
    ];
    for (const call of badCalls) {
      expectCodeError(call, "verification_code_invalid_verifier_input", secrets);
    }
  });

  it("VC-007 accepts only genuine byte views of at least 32 bytes and keeps them out of sight", () => {
    const secrets = [KAT_PEPPER_TEXT, KAT_PEPPER_BYTES.toString("hex"), KAT_PEPPER_BYTES.toString("base64")];
    // A view into a larger buffer: only its own 32-byte window is the pepper.
    const padded = new Uint8Array(36).fill(0x78);
    padded.set(KAT_PEPPER_BYTES, 2);
    for (const bytes of [
      KAT_PEPPER_BYTES,
      new Uint8Array(KAT_PEPPER_BYTES),
      new DataView(new Uint8Array(KAT_PEPPER_BYTES).buffer),
      new Uint8Array(padded.buffer, 2, 32),
      new DataView(padded.buffer, 2, 32),
    ]) {
      const pepper = createVerificationCodePepper(bytes);
      expect(isVerificationCodePepper(pepper)).toBe(true);
      expect(
        computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000"),
      ).toBe(KAT_VERIFIER);
      expect(Object.isFrozen(pepper)).toBe(true);
      expect(Reflect.ownKeys(pepper)).toEqual([]);
      expect(JSON.stringify(pepper)).toBe("{}");
      expectValueFree(pepper, secrets);
    }

    // The bytes are copied: changing the caller's buffer later changes nothing.
    const mutable = Buffer.from(KAT_PEPPER_BYTES);
    const copied = createVerificationCodePepper(mutable);
    mutable.fill(0);
    expect(computeVerificationCodeVerifier(copied, KAT_CHALLENGE_ID, "login", "000000")).toBe(
      KAT_VERIFIER,
    );

    for (const bad of [
      KAT_PEPPER_BYTES.subarray(0, 31),
      new Uint8Array(0),
      KAT_PEPPER_TEXT,
      Array.from(KAT_PEPPER_BYTES),
      KAT_PEPPER_BYTES.buffer,
      new Proxy(new Uint8Array(KAT_PEPPER_BYTES), {}),
      { byteLength: 32, buffer: KAT_PEPPER_BYTES.buffer, byteOffset: 0 },
      null,
      undefined,
    ]) {
      expectCodeError(
        () => createVerificationCodePepper(bad as never),
        "verification_code_invalid_pepper",
        secrets,
      );
    }
    for (const notPepper of [{}, Object.freeze({}), KAT_PEPPER_BYTES, null, "pepper"]) {
      expect(isVerificationCodePepper(notPepper)).toBe(false);
    }
  });

  it("VC-010 keeps every error fixed and value-free", () => {
    expect(VERIFICATION_CODE_ERROR_CODES).toEqual([
      "verification_code_invalid_pepper",
      "verification_code_invalid_verifier_input",
    ]);
    for (const code of VERIFICATION_CODE_ERROR_CODES) {
      const error = new VerificationCodeError(code);
      expect(error.message).toBe(code);
      expect(error.name).toBe("VerificationCodeError");
      expect(error.code).toBe(code);
    }
  });

  it("VC-013 refuses a final line terminator on the code or the UUID before any HMAC", () => {
    // JavaScript's `$` without the `m` flag matches only at the very end of
    // the text. These cases pin that, so a later pattern change cannot open a
    // gap unnoticed.
    const pepper = katPepper();
    const createHmac = vi.mocked(nodeCrypto.createHmac);
    for (const [name, terminator] of LINE_TERMINATORS) {
      createHmac.mockClear();
      expect(isSixDigitVerificationCode(`000000${terminator}`), name).toBe(false);
      expect(isCanonicalVerificationChallengeId(`${KAT_CHALLENGE_ID}${terminator}`), name).toBe(
        false,
      );
      expect(isVerificationCodeVerifier(`${KAT_VERIFIER}${terminator}`), name).toBe(false);
      for (const call of [
        () => computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", `000000${terminator}`),
        () =>
          computeVerificationCodeVerifier(pepper, `${KAT_CHALLENGE_ID}${terminator}`, "login", "000000"),
        () =>
          computeVerificationCodeVerifier(
            pepper,
            KAT_CHALLENGE_ID,
            `login${terminator}` as never,
            "000000",
          ),
      ]) {
        expectCodeError(call, "verification_code_invalid_verifier_input", ["000000"]);
      }
      expect(createHmac, name).not.toHaveBeenCalled();
    }
    // The same values without the terminator are accepted, so the refusal is
    // the terminator's.
    expect(computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
      KAT_VERIFIER,
    );
    expect(createHmac).toHaveBeenCalledTimes(1);
  });

  it("VC-011 compares nothing: PostgreSQL owns the comparison", () => {
    // The banked redemption function compares the stored verifier byte for
    // byte. This module exposes no comparison, so it cannot become a second
    // verification authority.
    for (const name of Object.keys(verificationCodeModule)) {
      expect(name).not.toMatch(/equal|compare|match|timingsafe|redeem|verifyCode/i);
    }
  });
});

describe("verificationCode - code and challenge UUID generation", () => {
  beforeEach(() => {
    for (const method of CONSOLE_METHODS) {
      vi.spyOn(console, method);
    }
  });

  afterEach(() => {
    for (const method of CONSOLE_METHODS) {
      expect(console[method]).not.toHaveBeenCalled();
    }
    vi.mocked(nodeCrypto.randomInt).mockClear();
    vi.mocked(nodeCrypto.randomUUID).mockClear();
  });

  it("VC-008 draws each code from randomInt over 0 to 999,999 and zero-pads it to six digits", () => {
    const randomInt = vi.mocked(nodeCrypto.randomInt as (min: number, max: number) => number);
    randomInt.mockClear();
    expect(VERIFICATION_CODE_LIMITS.codeUpperBoundExclusive).toBe(1_000_000);
    for (const [drawn, code] of [
      [0, "000000"],
      [7, "000007"],
      [42_195, "042195"],
      [100_000, "100000"],
      [999_999, "999999"],
    ] as const) {
      randomInt.mockReturnValueOnce(drawn);
      expect(generateVerificationCode()).toBe(code);
    }
    expect(randomInt).toHaveBeenCalledTimes(5);
    for (const call of randomInt.mock.calls) {
      expect(call).toEqual([0, 1_000_000]);
    }
  });

  it("VC-012 gives six ASCII digits spread across the whole range", () => {
    // With the real randomInt: 20,000 codes, 2,000 expected per leading
    // digit. The accepted band is about nine standard deviations wide on each
    // side, so a uniform generator does not fail it in practice, while a
    // generator that never gives a leading zero, or a narrow range, does.
    const counts = new Array<number>(10).fill(0);
    const lastDigits = new Array<number>(10).fill(0);
    const seen = new Set<string>();
    for (let index = 0; index < 20_000; index += 1) {
      const code = generateVerificationCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      counts[Number(code[0])] += 1;
      lastDigits[Number(code[5])] += 1;
      seen.add(code);
    }
    for (const count of [...counts, ...lastDigits]) {
      expect(count).toBeGreaterThan(1_600);
      expect(count).toBeLessThan(2_400);
    }
    // Repeats exist (birthday bound) but are rare in a million values.
    expect(seen.size).toBeGreaterThan(19_500);
  });

  it("VC-009 makes each challenge UUID with randomUUID, in lowercase canonical form", () => {
    const randomUUID = vi.mocked(nodeCrypto.randomUUID);
    randomUUID.mockClear();
    const ids = new Set<string>();
    for (let index = 0; index < 1_000; index += 1) {
      const id = generateVerificationChallengeId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(isCanonicalVerificationChallengeId(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(1_000);
    expect(randomUUID).toHaveBeenCalledTimes(1_000);
    expect(isCanonicalVerificationChallengeId(LETTERED_CHALLENGE_ID)).toBe(true);
    expect(isCanonicalVerificationChallengeId(LETTERED_CHALLENGE_ID.toUpperCase())).toBe(false);
  });
});
