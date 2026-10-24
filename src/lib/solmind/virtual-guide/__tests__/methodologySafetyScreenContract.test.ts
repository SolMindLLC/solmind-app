import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  METHODOLOGY_SAFETY_SCREEN_CRITERIA,
  METHODOLOGY_SAFETY_SCREEN_ERROR_CODES,
  METHODOLOGY_SAFETY_SCREEN_LIMITS,
  MethodologySafetyScreenError,
  bindMethodologySafetyScreenSubject,
  parseMethodologySafetyScreenResult,
} from "../methodologySafetyScreenContract";

const VERSION_ID = "00000000-0000-4000-8000-000000000021";
const CONTENT = "Reflect calmly.\nKeep the Explorer's agency and choices.";

function subject(content = CONTENT): Record<string, unknown> {
  return { methodologyContextPackVersionId: VERSION_ID, content };
}

function digest(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").toUpperCase();
}

function finding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    criterion: "boundary_override",
    severity: "review",
    excerpt: "Reflect calmly.",
    explanation: "This exact passage needs human review against the supplied rule.",
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    result: "pass",
    subject_sha256: digest(CONTENT),
    findings: [],
    ...overrides,
  };
}

function expectClosedError(action: () => unknown, code?: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(MethodologySafetyScreenError);
    const closed = error as MethodologySafetyScreenError;
    expect(METHODOLOGY_SAFETY_SCREEN_ERROR_CODES).toContain(closed.code);
    expect(closed.message).toBe(closed.code);
    expect(Object.hasOwn(closed, "cause")).toBe(false);
    if (code !== undefined) {
      expect(closed.code).toBe(code);
    }
    return;
  }
  throw new Error("Expected a closed contract error");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("immutable methodology safety-screen subject", () => {
  it("hashes the exact content UTF-8 bytes, without hashing the UUID or envelope", () => {
    const bound = bindMethodologySafetyScreenSubject(subject("abc"));
    expect(bound.subjectSha256).toBe(
      "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
    );
    expect(bound.subject).toEqual({
      methodologyContextPackVersionId: VERSION_ID,
      content: "abc",
    });
    expect(Object.isFrozen(bound)).toBe(true);
    expect(Object.isFrozen(bound.subject)).toBe(true);
  });

  it("severs caller references and preserves LF, valid surrogate pairs and Unicode form", () => {
    const content = "Reflect.\nCaf\u00e9 \ud83c\udf31";
    const original = subject(content);
    const bound = bindMethodologySafetyScreenSubject(original);
    original.content = "changed";
    original.methodologyContextPackVersionId = "changed";
    expect(bound.subject.content).toBe(content);
    expect(bound.subject.methodologyContextPackVersionId).toBe(VERSION_ID);
    expect(bound.subjectSha256).toBe(digest(content));
    expect(bound.subjectSha256).not.toBe(
      bindMethodologySafetyScreenSubject(subject(content.normalize("NFD"))).subjectSha256,
    );
  });

  it("accepts exactly the existing S03A 24,000-character cap and rejects the next character", () => {
    expect(METHODOLOGY_SAFETY_SCREEN_LIMITS.subjectCharacters).toBe(24_000);
    expect(bindMethodologySafetyScreenSubject(subject("a".repeat(24_000))).subject.content)
      .toHaveLength(24_000);
    expectClosedError(
      () => bindMethodologySafetyScreenSubject(subject("a".repeat(24_001))),
      "methodology_screen_limit_exceeded",
    );
  });

  it.each(["", " ", " content", "content ", "\ncontent", "content\n", "a\r\nb", "a\rb"])(
    "rejects empty, untrimmed or noncanonical LF subject %j instead of normalizing it",
    (content) => {
      expectClosedError(() => bindMethodologySafetyScreenSubject(subject(content)));
    },
  );

  it.each([
    "\u0000", "\u0009", "\u000b", "\u007f", "\u0085", "\u061c",
    "\u200b", "\u200e", "\u2028", "\u2029", "\u202e", "\u2060",
    "\u2066", "\ufeff", "\ud800", "\udfff", "\ud800x", "x\udfff",
  ])("rejects unsafe controls and isolated surrogates %j before hashing", (unsafe) => {
    expectClosedError(() => bindMethodologySafetyScreenSubject(subject(`a${unsafe}b`)));
  });

  it.each([null, [], new Date(), "content", 3, {}, { content: CONTENT }])(
    "rejects nonplain or incomplete subjects",
    (input) => {
      expectClosedError(() => bindMethodologySafetyScreenSubject(input));
    },
  );

  it.each(["not-a-uuid", VERSION_ID.toUpperCase().replace("000000000021", "00000000002A"), ` ${VERSION_ID}`, 21, null])(
    "requires a canonical UUID without coercion or normalization",
    (methodologyContextPackVersionId) => {
      expectClosedError(() => bindMethodologySafetyScreenSubject({
        ...subject(), methodologyContextPackVersionId,
      }));
    },
  );

  it("accepts null-prototype data records, but rejects inherited and widened authority", () => {
    const nullPrototype = Object.assign(Object.create(null), subject());
    expect(bindMethodologySafetyScreenSubject(nullPrototype).subject.content).toBe(CONTENT);
    expectClosedError(() => bindMethodologySafetyScreenSubject(Object.create(subject())));
    for (const extra of [
      { approved: true },
      { subjectSha256: digest(CONTENT) },
      { provider: "not-authority" },
    ]) {
      expectClosedError(() => bindMethodologySafetyScreenSubject({ ...subject(), ...extra }));
    }
  });
});

describe("methodology safety-screen result byte linkage", () => {
  it("binds pass to the server subject version and returns an immutable closed result", () => {
    const parsed = parseMethodologySafetyScreenResult(response(), subject());
    expect(parsed).toEqual({
      result: "pass",
      subject_sha256: digest(CONTENT),
      findings: [],
      methodologyContextPackVersionId: VERSION_ID,
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.findings)).toBe(true);
    expectClosedError(() => parseMethodologySafetyScreenResult({
      ...response(), methodologyContextPackVersionId: VERSION_ID,
    }, subject()));
  });

  it("recomputes the expected subject rather than accepting a stale or caller-forged digest", () => {
    const original = subject();
    const bound = bindMethodologySafetyScreenSubject(original);
    original.content = `${CONTENT} Changed.`;
    expectClosedError(
      () => parseMethodologySafetyScreenResult(response(), original),
      "methodology_screen_subject_mismatch",
    );
    expect(parseMethodologySafetyScreenResult(response(), bound.subject).result).toBe("pass");
    expectClosedError(() => parseMethodologySafetyScreenResult(response(), {
      ...original, subjectSha256: digest(CONTENT),
    }));
  });

  it.each(["0".repeat(64), digest(CONTENT).toLowerCase(), `${digest(CONTENT)} `, "", null, 42])(
    "rejects mismatched or noncanonical subject digest %j",
    (subject_sha256) => {
      expectClosedError(
        () => parseMethodologySafetyScreenResult(response({ subject_sha256 }), subject()),
        "methodology_screen_subject_mismatch",
      );
    },
  );

  it.each(METHODOLOGY_SAFETY_SCREEN_CRITERIA)("accepts the exact criterion %s", (criterion) => {
    const parsed = parseMethodologySafetyScreenResult(response({
      result: "review", findings: [finding({ criterion })],
    }), subject());
    expect(parsed.findings[0]?.criterion).toBe(criterion);
  });

  it("preserves exact citation bytes, including meaningful surrounding spaces", () => {
    const content = "Begin. Exact quoted passage. End.";
    const excerpt = " Exact quoted passage. ";
    const parsed = parseMethodologySafetyScreenResult(response({
      result: "review", subject_sha256: digest(content),
      findings: [finding({ excerpt })],
    }), subject(content));
    expect(parsed.findings[0]?.excerpt).toBe(excerpt);
  });

  it.each(["reflect calmly.", "Reflect calmly!", "Invented private material", "Reflect\r\ncalmly.", " ", "", "\ud800"])(
    "rejects absent, changed or malformed citation %j without inventing or repairing it",
    (excerpt) => {
      expectClosedError(() => parseMethodologySafetyScreenResult(response({
        result: "review", findings: [finding({ excerpt })],
      }), subject()));
    },
  );

  it.each(["", " ", " leading", "trailing ", "a\rb", "a\u0000b", "a\u2028b", "a\udfffb"])(
    "rejects malformed explanations %j",
    (explanation) => {
      expectClosedError(() => parseMethodologySafetyScreenResult(response({
        result: "review", findings: [finding({ explanation })],
      }), subject()));
    },
  );

  it("enforces exact excerpt and explanation caps without truncation", () => {
    const content = "a".repeat(513);
    const valid = finding({ excerpt: "a".repeat(512), explanation: "b".repeat(768) });
    expect(parseMethodologySafetyScreenResult(response({
      result: "review", subject_sha256: digest(content), findings: [valid],
    }), subject(content)).findings[0]?.explanation).toHaveLength(768);
    for (const oversized of [
      { ...valid, excerpt: "a".repeat(513) },
      { ...valid, explanation: "b".repeat(769) },
    ]) {
      expectClosedError(() => parseMethodologySafetyScreenResult(response({
        result: "review", subject_sha256: digest(content), findings: [oversized],
      }), subject(content)), "methodology_screen_limit_exceeded");
    }
  });

  it("accepts sixteen distinct findings and rejects a seventeenth", () => {
    const sixteen = METHODOLOGY_SAFETY_SCREEN_CRITERIA.slice(0, 16).map((criterion) => finding({ criterion }));
    expect(parseMethodologySafetyScreenResult(response({
      result: "review", findings: sixteen,
    }), subject()).findings).toHaveLength(16);
    expectClosedError(() => parseMethodologySafetyScreenResult(response({
      result: "review", findings: [...sixteen, finding({ criterion: "fear_dependency" })],
    }), subject()), "methodology_screen_limit_exceeded");
  });

  it("rejects duplicate criterion/excerpt pairs even if the severity changes", () => {
    expectClosedError(() => parseMethodologySafetyScreenResult(response({
      result: "fail", findings: [finding(), finding({ severity: "fail" })],
    }), subject()), "methodology_screen_invalid_finding");
    expect(parseMethodologySafetyScreenResult(response({
      result: "review", findings: [finding(), finding({ criterion: "false_identity" })],
    }), subject()).findings).toHaveLength(2);
  });

  it.each([
    { result: "pass", findings: [finding()] },
    { result: "review", findings: [] },
    { result: "review", findings: [finding({ severity: "fail" })] },
    { result: "fail", findings: [] },
    { result: "fail", findings: [finding()] },
    { result: "approved", findings: [] },
    { result: "review", findings: [finding({ severity: "warning" })] },
    { result: "review", findings: [finding({ criterion: "unknown_policy" })] },
  ])("rejects inconsistent outcomes or invented vocabulary", (overrides) => {
    expectClosedError(() => parseMethodologySafetyScreenResult(response(overrides), subject()));
  });

  it("allows fail only with at least one fail finding and severs all input references", () => {
    const first = finding();
    const second = finding({ criterion: "false_identity", severity: "fail" });
    const findings = [first, second];
    const raw = response({ result: "fail", findings });
    const parsed = parseMethodologySafetyScreenResult(raw, subject());
    first.excerpt = "Changed";
    second.severity = "review";
    findings.length = 0;
    raw.result = "pass";
    expect(parsed.result).toBe("fail");
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0]?.excerpt).toBe("Reflect calmly.");
    expect(parsed.findings[1]?.severity).toBe("fail");
    for (const parsedFinding of parsed.findings) {
      expect(Object.isFrozen(parsedFinding)).toBe(true);
    }
  });
});

describe("closed data-only records and effect-free validation", () => {
  it("rejects accessors in subject, expected subject, result and finding without invoking them", () => {
    const getter = vi.fn(() => { throw new Error("PRIVATE_GETTER_CANARY"); });
    const withGetter = (base: object, key: string): object =>
      Object.defineProperty(base, key, { enumerable: true, get: getter });
    const subjectGetter = withGetter(subject(), "content");
    const resultGetter = withGetter(response(), "findings");
    const findingGetter = withGetter(finding(), "excerpt");
    expectClosedError(() => bindMethodologySafetyScreenSubject(subjectGetter));
    expectClosedError(() => parseMethodologySafetyScreenResult(response(), subjectGetter));
    expectClosedError(() => parseMethodologySafetyScreenResult(resultGetter, subject()));
    expectClosedError(() => parseMethodologySafetyScreenResult(response({
      result: "review", findings: [findingGetter],
    }), subject()));
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects unknown, missing, symbolic and non-enumerable record properties", () => {
    for (const layer of ["subject", "result", "finding"] as const) {
      const base = (): Record<string, unknown> => layer === "subject"
        ? subject() : layer === "result" ? response() : finding();
      const parse = (input: unknown): unknown => layer === "subject"
        ? bindMethodologySafetyScreenSubject(input)
        : parseMethodologySafetyScreenResult(layer === "result" ? input : response({
          result: "review", findings: [input],
        }), subject());
      const unknownKey = { ...base(), extra: "PRIVATE_EXTRA_CANARY" };
      const symbolKey = Object.defineProperty(base(), Symbol("extra"), { value: 1, enumerable: true });
      const hiddenKey = Object.defineProperty(base(), "extra", { value: 1 });
      const missingKey = base();
      delete missingKey[Object.keys(missingKey)[0]!];
      const hiddenRequired = base();
      Object.defineProperty(hiddenRequired, Object.keys(hiddenRequired)[0]!, { enumerable: false });
      for (const invalid of [unknownKey, symbolKey, hiddenKey, missingKey, hiddenRequired]) {
        expectClosedError(() => parse(invalid));
      }
    }
  });

  it("rejects nonplain results and findings rather than invoking class or inherited behavior", () => {
    class Result {
      result = "pass";
      subject_sha256 = digest(CONTENT);
      findings = [];
    }
    for (const invalid of [null, [], new Date(), new Result(), Object.create(response())]) {
      expectClosedError(() => parseMethodologySafetyScreenResult(invalid, subject()));
    }
    for (const invalid of [null, [], new Date(), Object.create(finding())]) {
      expectClosedError(() => parseMethodologySafetyScreenResult(response({
        result: "review", findings: [invalid],
      }), subject()));
    }
  });

  it("rejects sparse, widened, non-enumerable and accessor-bearing findings arrays", () => {
    const getter = vi.fn(() => finding());
    const sparse = new Array(1);
    const extra = Object.assign([finding()], { extra: "PRIVATE_ARRAY_CANARY" });
    const symbol = Object.defineProperty([finding()], Symbol("extra"), { value: 1 });
    const hidden = Object.defineProperty([finding()], "0", { enumerable: false });
    const accessor = Object.defineProperty([finding()], "0", { enumerable: true, get: getter });
    const subclass = Object.setPrototypeOf([finding()], Object.create(Array.prototype));
    for (const findings of [null, {}, sparse, extra, symbol, hidden, accessor, subclass]) {
      expectClosedError(() => parseMethodologySafetyScreenResult(response({
        result: "review", findings,
      }), subject()));
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects proxies before any getter, prototype or descriptor trap can execute", () => {
    const trap = vi.fn(() => { throw new Error("PRIVATE_PROXY_CANARY"); });
    const handler = { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap };
    expectClosedError(() => bindMethodologySafetyScreenSubject(new Proxy(subject(), handler)));
    expectClosedError(() => parseMethodologySafetyScreenResult(new Proxy(response(), handler), subject()));
    expectClosedError(() => parseMethodologySafetyScreenResult(response({
      result: "review", findings: new Proxy([finding()], handler),
    }), subject()));
    expectClosedError(() => parseMethodologySafetyScreenResult(response({
      result: "review", findings: [new Proxy(finding(), handler)],
    }), subject()));
    const revoked = Proxy.revocable(subject(), {});
    revoked.revoke();
    expectClosedError(() => bindMethodologySafetyScreenSubject(revoked.proxy));
    expect(trap).not.toHaveBeenCalled();
  });

  it("makes no HTTP call, timer or log and accepts no effectful capability", () => {
    const fetch = vi.fn(() => { throw new Error("HTTP_MUST_NOT_RUN"); });
    vi.stubGlobal("fetch", fetch);
    const timer = vi.spyOn(globalThis, "setTimeout");
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    expect(parseMethodologySafetyScreenResult(response(), subject()).result).toBe("pass");
    expectClosedError(() => parseMethodologySafetyScreenResult({
      ...response(), activate: fetch,
    }, subject()));
    expect(fetch).not.toHaveBeenCalled();
    expect(timer).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
