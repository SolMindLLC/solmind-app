// Login step 6, sub-slice S6-1: the verification pepper's source
// (AUTH-RLS-DEC-032). Every value here is synthetic. The known-answer pepper
// is the register's published test material, not a secret, and no test in
// this file reads any environment file. The module boundary of the three S6-1
// modules is tested in `loginRouteConfiguration.test.ts`.

import { createHmac } from "node:crypto";
import { inspect } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeVerificationCodeVerifier,
  isVerificationCodePepper,
  type VerificationCodePepper,
} from "../verificationCode";
import {
  VERIFICATION_PEPPER_ENV,
  VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE,
  VERIFICATION_PEPPER_SOURCE_ERROR_CODE,
  VERIFICATION_PEPPER_SOURCE_LIMITS,
  VerificationPepperSourceError,
  loadVerificationPepper,
} from "../verificationPepperSource";

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// The synthetic pepper of the register's AUTH-RLS-DEC-032 known-answer test
// (execution/12_SolMind_MVP0_Auth_RLS_Decision_Deferral_Register_v0_1.md,
// "DEF5-S2 register-first clarification (2026-07-12)"), as the code module's
// own test uses it, and its base64url form without padding.
const KAT_PEPPER_BYTES = Buffer.from("SOLMIND-SYNTHETIC-TEST-PEPPER-01", "ascii");
const KAT_PEPPER_SETTING = "U09MTUlORC1TWU5USEVUSUMtVEVTVC1QRVBQRVItMDE";
const KAT_CHALLENGE_ID = "00000000-0000-4000-8000-000000000001";
const KAT_VERIFIER =
  "svf1:ecab5e52743c2befef754a1568a90e466dac2777d43c18162914acca44e8960d";

// A marker that must never appear in any error or log.
const SENTINEL = "SENTINEL-S61-PEPPER-SOURCE";

// Every final line terminator JavaScript knows, built from code points so
// this file stays ASCII.
const LINE_TERMINATORS: ReadonlyArray<readonly [string, string]> = [
  ["LF", "\n"],
  ["CR", "\r"],
  ["CRLF", "\r\n"],
  ["U+2028", String.fromCharCode(0x2028)],
  ["U+2029", String.fromCharCode(0x2029)],
];

function sequentialBytes(length: number): Buffer {
  return Buffer.from(Array.from({ length }, (_, index) => (index * 7 + 3) % 256));
}

function settingOf(bytes: Buffer): string {
  return bytes.toString("base64url");
}

// The svf1 verifier computed directly, as the register fixes it.
function expectedVerifier(bytes: Buffer, challengeId: string, code: string): string {
  const message = ["solmind-verification-challenge-svf1", challengeId, "login", code].join("\n");
  return `svf1:${createHmac("sha256", bytes).update(message, "ascii").digest("hex")}`;
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

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("expected the action to throw");
}

function expectRefused(environment: unknown, secrets: ReadonlyArray<string> = []): void {
  const error = captureError(() =>
    loadVerificationPepper(environment as Readonly<Record<string, string | undefined>>),
  );
  expect(error).toBeInstanceOf(VerificationPepperSourceError);
  const refusal = error as VerificationPepperSourceError;
  expect(refusal.code).toBe(VERIFICATION_PEPPER_SOURCE_ERROR_CODE);
  expect(refusal.message).toBe(VERIFICATION_PEPPER_SOURCE_ERROR_CODE);
  expect(refusal.name).toBe("VerificationPepperSourceError");
  expect(refusal.cause).toBeUndefined();
  const text = textOf(error);
  for (const secret of [SENTINEL, ...secrets]) {
    if (secret.length > 0) {
      expect(text).not.toContain(secret);
    }
  }
}

function load(setting: unknown): VerificationCodePepper {
  const environment: unknown = { [VERIFICATION_PEPPER_ENV]: setting };
  return loadVerificationPepper(environment as Readonly<Record<string, string | undefined>>);
}

// The base64url alphabet, and every other last character that decodes to the
// same bytes as the canonical text: they differ from it only in unused bits.
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function trailingBitAliases(bytes: Buffer): string[] {
  const setting = settingOf(bytes);
  const stem = setting.slice(0, -1);
  const last = setting.charAt(setting.length - 1);
  return BASE64URL_ALPHABET.split("")
    .filter(
      (candidate) =>
        candidate !== last && Buffer.from(`${stem}${candidate}`, "base64url").equals(bytes),
    )
    .map((candidate) => `${stem}${candidate}`);
}

// The browser guard's own fixed message, which is not the pepper source's error.
const BROWSER_GUARD_MESSAGE =
  "SolMind server configuration error: the verification pepper source must not be imported in browser code.";

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
  vi.unstubAllEnvs();
});

describe("verificationPepperSource - the pepper's source (AUTH-RLS-DEC-032)", () => {
  it("VPS-001 fixes one server-only name, its public-name tripwire, the limits and the one error code", () => {
    expect(VERIFICATION_PEPPER_ENV).toBe("SOLMIND_VERIFICATION_PEPPER");
    expect(VERIFICATION_PEPPER_ENV.startsWith("NEXT_PUBLIC_")).toBe(false);
    expect(VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE).toBe(`NEXT_PUBLIC_${VERIFICATION_PEPPER_ENV}`);
    expect(VERIFICATION_PEPPER_SOURCE_LIMITS).toEqual({
      minimumBytes: 32,
      maximumBytes: 64,
      minimumCharacters: 43,
      maximumCharacters: 86,
    });
    expect(Object.isFrozen(VERIFICATION_PEPPER_SOURCE_LIMITS)).toBe(true);
    // The character limits are the unpadded base64url lengths of the byte limits.
    expect(settingOf(sequentialBytes(32))).toHaveLength(43);
    expect(settingOf(sequentialBytes(64))).toHaveLength(86);
    expect(VERIFICATION_PEPPER_SOURCE_ERROR_CODE).toBe("verification_pepper_unavailable");
  });

  it("VPS-002 reproduces the register's known-answer verifier through the source", () => {
    expect(settingOf(KAT_PEPPER_BYTES)).toBe(KAT_PEPPER_SETTING);
    const pepper = load(KAT_PEPPER_SETTING);
    expect(isVerificationCodePepper(pepper)).toBe(true);
    expect(computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
      KAT_VERIFIER,
    );
  });

  it("VPS-003 accepts 32 to 64 bytes, keyed by exactly the decoded bytes, and refuses 31 and 65", () => {
    for (const length of [32, 33, 47, 48, 63, 64]) {
      const bytes = sequentialBytes(length);
      const pepper = load(settingOf(bytes));
      expect(
        computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "123456"),
        `${length} bytes`,
      ).toBe(expectedVerifier(bytes, KAT_CHALLENGE_ID, "123456"));
    }
    for (const length of [0, 1, 16, 31, 65, 96]) {
      const setting = settingOf(sequentialBytes(length));
      expectRefused({ [VERIFICATION_PEPPER_ENV]: setting }, [setting]);
    }
  });

  it("VPS-004 accepts only the one canonical text form, so the lenient decoder cannot widen it", () => {
    // Bytes whose encodings hold `-` and `_` (base64url) and `+` and `/`
    // (standard base64).
    const bytes = Buffer.from(Array.from({ length: 32 }, (_, index) => [0xfb, 0xff, 0xbf][index % 3]));
    const setting = settingOf(bytes);
    expect(setting).toMatch(/-/);
    expect(setting).toMatch(/_/);
    // The same bytes in other encodings or with stray characters, each of
    // which the platform's base64url decoder would still decode.
    const standard = bytes.toString("base64");
    expect(standard).toMatch(/\+/);
    expect(standard).toMatch(/\//);
    const variants: ReadonlyArray<readonly [string, string]> = [
      ["standard base64 with padding", standard],
      ["standard base64 without padding", standard.replace(/=+$/, "")],
      ["padding", `${setting}=`],
      ["a leading space", ` ${setting}`],
      ["a trailing space", `${setting} `],
      ["an inner space", `${setting.slice(0, 20)} ${setting.slice(20)}`],
      ["a tab", `${setting}\t`],
      ["a period", `${setting.slice(0, 20)}.${setting.slice(20)}`],
      ["a non-ASCII letter", `${setting.slice(0, 42)}${String.fromCharCode(0xe9)}`],
      ["quotes", `"${setting}"`],
      // 45 characters: one more than a whole number of bytes can encode.
      ["a dangling character", `${setting}AB`],
      ["an empty value", ""],
    ];
    for (const [label, text] of variants) {
      expect(text, label).not.toBe(setting);
      expectRefused({ [VERIFICATION_PEPPER_ENV]: text }, [setting]);
    }
    for (const [, terminator] of LINE_TERMINATORS) {
      expectRefused({ [VERIFICATION_PEPPER_ENV]: `${setting}${terminator}` }, [setting]);
      expectRefused({ [VERIFICATION_PEPPER_ENV]: `${terminator}${setting}` }, [setting]);
    }
    // Unused trailing bits: the last of 43 characters carries 4 bits of the
    // 32 bytes and 2 unused bits, so three other last characters decode to
    // the same bytes. None of them is the canonical text, and each is refused.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = setting.charAt(setting.length - 1);
    const sameBytes = alphabet
      .split("")
      .filter(
        (candidate) =>
          candidate !== last &&
          Buffer.from(`${setting.slice(0, -1)}${candidate}`, "base64url").equals(bytes),
      );
    expect(sameBytes).toHaveLength(3);
    for (const candidate of sameBytes) {
      expectRefused({ [VERIFICATION_PEPPER_ENV]: `${setting.slice(0, -1)}${candidate}` }, [setting]);
    }
    // Control: the canonical text itself loads, keyed by exactly those bytes.
    expect(computeVerificationCodeVerifier(load(setting), KAT_CHALLENGE_ID, "login", "000000")).toBe(
      expectedVerifier(bytes, KAT_CHALLENGE_ID, "000000"),
    );
  });

  it("VPS-005 fails closed when the setting is missing, empty or not text, or the environment is not an object", () => {
    expectRefused({});
    expectRefused({ [VERIFICATION_PEPPER_ENV]: undefined });
    expectRefused({ [VERIFICATION_PEPPER_ENV]: "" });
    for (const value of [null, 0, 43, true, KAT_PEPPER_BYTES, [KAT_PEPPER_SETTING], { value: KAT_PEPPER_SETTING }]) {
      expectRefused({ [VERIFICATION_PEPPER_ENV]: value }, [KAT_PEPPER_SETTING]);
    }
    // Another name holding the pepper is not read.
    expectRefused({ SOLMIND_VERIFICATION_PEPPER_TEXT: KAT_PEPPER_SETTING, solmind_verification_pepper: KAT_PEPPER_SETTING });
    for (const environment of [null, 0, "text", true, Symbol("environment")]) {
      expectRefused(environment);
    }
  });

  it("VPS-006 refuses a valid pepper when the public-name tripwire is present, whatever its value", () => {
    for (const tripwire of [KAT_PEPPER_SETTING, "", "anything", SENTINEL]) {
      expectRefused(
        {
          [VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING,
          [VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE]: tripwire,
        },
        [KAT_PEPPER_SETTING],
      );
    }
    // Present but undefined is absent, as an unset environment variable reads.
    const pepper = loadVerificationPepper({
      [VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING,
      [VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE]: undefined,
    });
    expect(computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
      KAT_VERIFIER,
    );
  });

  it("VPS-007 reads exactly the tripwire and then the setting, and drops any exception unread", () => {
    const reads: string[] = [];
    const recording = new Proxy(
      { [VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING } as Record<string, string>,
      {
        get(target, key, receiver) {
          reads.push(String(key));
          return Reflect.get(target, key, receiver);
        },
      },
    );
    const pepper = loadVerificationPepper(recording);
    expect(isVerificationCodePepper(pepper)).toBe(true);
    expect(reads).toEqual([VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, VERIFICATION_PEPPER_ENV]);

    // A getter or a Proxy trap that throws: the fixed error, without the
    // thrown text.
    const throwingGetter = Object.defineProperty({}, VERIFICATION_PEPPER_ENV, {
      enumerable: true,
      get() {
        throw new Error(SENTINEL);
      },
    });
    expectRefused(throwingGetter);
    const throwingTrap = new Proxy(
      {},
      {
        get() {
          throw new Error(SENTINEL);
        },
      },
    );
    expectRefused(throwingTrap);
  });

  it("VPS-008 gives a fresh opaque handle per call that serializes to {} and shows no value", () => {
    const first = load(KAT_PEPPER_SETTING);
    const second = load(KAT_PEPPER_SETTING);
    expect(first).not.toBe(second);
    for (const pepper of [first, second]) {
      expect(JSON.stringify(pepper)).toBe("{}");
      expect(Reflect.ownKeys(pepper)).toEqual([]);
      expect(textOf(pepper)).not.toContain(KAT_PEPPER_SETTING);
      expect(textOf(pepper)).not.toContain("SOLMIND-SYNTHETIC-TEST-PEPPER-01");
      expect(computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
        KAT_VERIFIER,
      );
    }
  });

  it("VPS-009 reads process.env by default", () => {
    vi.stubEnv(VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, undefined);
    vi.stubEnv(VERIFICATION_PEPPER_ENV, KAT_PEPPER_SETTING);
    const pepper = loadVerificationPepper();
    expect(computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
      KAT_VERIFIER,
    );
    vi.stubEnv(VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, "present");
    expect(captureError(() => loadVerificationPepper())).toBeInstanceOf(
      VerificationPepperSourceError,
    );
    vi.stubEnv(VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, undefined);
    vi.stubEnv(VERIFICATION_PEPPER_ENV, undefined);
    expect(captureError(() => loadVerificationPepper())).toBeInstanceOf(
      VerificationPepperSourceError,
    );
  });

  it("VPS-010 overwrites its decoded copy with zeros after the handle is made, and drops a refusal from the code module unread", async () => {
    const captured: Uint8Array[] = [];
    let refuse = false;
    vi.resetModules();
    vi.doMock("../verificationCode", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../verificationCode")>();
      return {
        ...actual,
        createVerificationCodePepper: (bytes: Uint8Array) => {
          captured.push(bytes);
          if (refuse) {
            throw new Error(SENTINEL);
          }
          return actual.createVerificationCodePepper(bytes);
        },
      };
    });
    try {
      const source = await import("../verificationPepperSource");
      const code = await import("../verificationCode");
      const pepper = source.loadVerificationPepper({ [source.VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING });
      expect(captured).toHaveLength(1);
      expect(captured[0].byteLength).toBe(32);
      expect(Array.from(captured[0]).every((byte) => byte === 0)).toBe(true);
      // The key object took its own copy first.
      expect(code.computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
        KAT_VERIFIER,
      );

      refuse = true;
      const error = captureError(() =>
        source.loadVerificationPepper({ [source.VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING }),
      );
      expect((error as Error).message).toBe(VERIFICATION_PEPPER_SOURCE_ERROR_CODE);
      expect(textOf(error)).not.toContain(SENTINEL);
      expect(captured).toHaveLength(2);
      expect(Array.from(captured[1]).every((byte) => byte === 0)).toBe(true);
    } finally {
      vi.doUnmock("../verificationCode");
      vi.resetModules();
    }
  });

  it("VPS-011 refuses a fresh import where a browser window exists, with the guard's fixed message", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    try {
      await expect(import("../verificationPepperSource")).rejects.toThrow(BROWSER_GUARD_MESSAGE);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
    // Control: with the window gone again, a fresh import loads and works.
    expect("window" in globalThis).toBe(false);
    try {
      const source = await import("../verificationPepperSource");
      const code = await import("../verificationCode");
      const pepper = source.loadVerificationPepper({ [source.VERIFICATION_PEPPER_ENV]: KAT_PEPPER_SETTING });
      expect(code.computeVerificationCodeVerifier(pepper, KAT_CHALLENGE_ID, "login", "000000")).toBe(
        KAT_VERIFIER,
      );
    } finally {
      vi.resetModules();
    }
  });

  it("VPS-012 turns a thrown object into the fixed error without reading its message, stack or cause", () => {
    const reads: string[] = [];
    // An error-like object whose message, stack and cause are getters that
    // record every read.
    const observedThrowable = (): Error => {
      const thrown = Object.create(Error.prototype) as Error;
      for (const key of ["message", "stack", "cause"] as const) {
        Object.defineProperty(thrown, key, {
          configurable: true,
          enumerable: true,
          get() {
            reads.push(key);
            return SENTINEL;
          },
        });
      }
      return thrown;
    };
    // Thrown while the tripwire is read, while the setting is read, and from
    // a Proxy trap.
    for (const name of [VERIFICATION_PEPPER_PUBLIC_NAME_TRIPWIRE, VERIFICATION_PEPPER_ENV]) {
      expectRefused(
        Object.defineProperty({}, name, {
          enumerable: true,
          get() {
            throw observedThrowable();
          },
        }),
      );
    }
    expectRefused(
      new Proxy(
        {},
        {
          get() {
            throw observedThrowable();
          },
        },
      ),
    );
    expect(reads).toEqual([]);
    // Control: the getters do record a read.
    expect(observedThrowable().message).toBe(SENTINEL);
    expect(reads).toEqual(["message"]);
  });

  it("VPS-013 overwrites its decoded copy with zeros when the round trip refuses the text", () => {
    const bytes = sequentialBytes(32);
    const setting = settingOf(bytes);
    const aliases = trailingBitAliases(bytes);
    expect(aliases).toHaveLength(3);
    // Text that passes the character-set and length check but not the round
    // trip: a last character that differs only in unused bits (32 bytes), and
    // a dangling character (45 characters decode to 33 bytes).
    const cases: ReadonlyArray<readonly [string, number]> = [
      [aliases[0], 32],
      [`${setting}AB`, 33],
    ];
    for (const [text, decodedLength] of cases) {
      // Control: decoding the same text gives bytes that are not all zero, so
      // all zeros below can only come from the module's own overwrite.
      expect(Buffer.from(text, "base64url").some((byte) => byte !== 0)).toBe(true);
      // The module decodes with `Buffer.from`; the spy keeps the buffer it
      // returned, so the module's decoded copy is inspected after the refusal.
      const decode = vi.spyOn(Buffer, "from");
      try {
        expectRefused({ [VERIFICATION_PEPPER_ENV]: text }, [setting]);
        const calls = decode.mock.calls as unknown as ReadonlyArray<ReadonlyArray<unknown>>;
        const results = decode.mock.results as unknown as ReadonlyArray<{ type: string; value: unknown }>;
        const decoded = calls.flatMap((args, index) =>
          args[0] === text && args[1] === "base64url" ? [results[index]] : [],
        );
        expect(decoded).toHaveLength(1);
        expect(decoded[0].type).toBe("return");
        const copy = decoded[0].value as Buffer;
        expect(copy.byteLength).toBe(decodedLength);
        expect(Array.from(copy).every((byte) => byte === 0)).toBe(true);
      } finally {
        decode.mockRestore();
      }
    }
  });

  it("VPS-014 refuses each of the 15 last characters that differ only in unused bits at 64 bytes", () => {
    // At 64 bytes the last of 86 characters carries 2 bits of the bytes and 4
    // unused bits, so 15 other last characters decode to the same bytes.
    const bytes = sequentialBytes(64);
    const setting = settingOf(bytes);
    expect(setting).toHaveLength(86);
    const aliases = trailingBitAliases(bytes);
    expect(aliases).toHaveLength(15);
    expect(new Set(aliases).size).toBe(15);
    for (const alias of aliases) {
      expect(alias).not.toBe(setting);
      expectRefused({ [VERIFICATION_PEPPER_ENV]: alias }, [setting]);
    }
    // Control: the canonical text itself loads, keyed by exactly those bytes.
    expect(computeVerificationCodeVerifier(load(setting), KAT_CHALLENGE_ID, "login", "000000")).toBe(
      expectedVerifier(bytes, KAT_CHALLENGE_ID, "000000"),
    );
  });
});
