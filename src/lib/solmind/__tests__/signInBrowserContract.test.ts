// Pure synthetic fixtures. Test labels and assertions do not print input values.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildExplorerSignInSendRequest,
  buildExplorerSignInVerifyRequest,
  EXPLORER_BROWSER_SIGN_IN_HOME,
  EXPLORER_BROWSER_SIGN_IN_PATHS,
  parseExplorerSignInSendReply,
  parseExplorerSignInVerifyReply,
  SIGN_IN_BROWSER_CONTRACT_FAILED,
} from "../signInBrowserContract";

const SELECTOR = "abcdef01-2345-6789-abcd-ef0123456789";
const NIL = "00000000-0000-0000-0000-000000000000";
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
const send = () => ({ identifier: " Explorer@Synthetic.INVALID " });
const verify = () => ({ identifier: " Explorer@Synthetic.INVALID ", challengeId: SELECTOR, code: "012345" });
const acknowledgment = () => ({ acknowledgment: "verification_code_requested", challengeId: SELECTOR });
const signedIn = () => ({ outcome: "signed_in", destination: "/explorer/home" });
const OPERATIONS = [
  { name: "send-request", run: buildExplorerSignInSendRequest, valid: send },
  { name: "verify-request", run: buildExplorerSignInVerifyRequest, valid: verify },
  { name: "send-reply", run: (value: unknown) => parseExplorerSignInSendReply(200, value), valid: acknowledgment },
  { name: "verify-reply", run: (value: unknown) => parseExplorerSignInVerifyReply(200, value), valid: signedIn },
];

beforeEach(() => {
  for (const method of CONSOLE_METHODS) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => {
  const silent = CONSOLE_METHODS.every((method) => vi.mocked(console[method]).mock.calls.length === 0);
  vi.restoreAllMocks();
  expect(silent).toBe(true);
});

describe("Explorer browser contract", () => {
  it("SBC-001 uses only the accepted fixed paths and destination", () => {
    expect(EXPLORER_BROWSER_SIGN_IN_PATHS.send === "/login/explorer/send").toBe(true);
    expect(EXPLORER_BROWSER_SIGN_IN_PATHS.verify === "/login/explorer/verify").toBe(true);
    expect(EXPLORER_BROWSER_SIGN_IN_HOME === "/explorer/home").toBe(true);
    expect(Object.isFrozen(EXPLORER_BROWSER_SIGN_IN_PATHS)).toBe(true);
  });

  it("SBC-002 returns one frozen value-free failure with no input reference", () => {
    expect(Object.isFrozen(SIGN_IN_BROWSER_CONTRACT_FAILED)).toBe(true);
    expect(JSON.stringify(SIGN_IN_BROWSER_CONTRACT_FAILED) === '{"ok":false,"error":"sign_in_browser_contract_failed"}').toBe(true);
    for (const operation of OPERATIONS) expect(operation.run(null) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
  });

  it("SBC-003 builders preserve raw strings including server-invalid input", () => {
    const values = ["", "\t Explorer@Synthetic.INVALID \n", "not-an-email", "A".repeat(513), "\u212a", "\ud800"];
    for (const raw of values) {
      const sent = buildExplorerSignInSendRequest({ identifier: raw });
      expect(sent.ok && sent.body.identifier === raw && sent.path === "/login/explorer/send").toBe(true);
      const checked = buildExplorerSignInVerifyRequest({ identifier: raw, challengeId: raw, code: raw });
      expect(checked.ok && checked.body.identifier === raw && checked.body.challengeId === raw && checked.body.code === raw).toBe(true);
    }
  });

  it("SBC-004 builders return exact immutable copied bodies", () => {
    const input = verify();
    const result = buildExplorerSignInVerifyRequest(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("missing-synthetic-result");
    expect(Object.keys(result).sort().join(",") === "body,ok,path").toBe(true);
    expect(Object.keys(result.body).sort().join(",") === "challengeId,code,identifier").toBe(true);
    expect(Object.isFrozen(result) && Object.isFrozen(result.body)).toBe(true);
    input.identifier = "changed";
    input.challengeId = NIL;
    input.code = "654321";
    expect(result.body.identifier !== input.identifier && result.body.challengeId === SELECTOR && result.body.code === "012345").toBe(true);
    expect(Reflect.set(result.body, "role", "admin") === false).toBe(true);
    const sent = buildExplorerSignInSendRequest(send());
    expect(sent.ok && Object.keys(sent.body).join(",") === "identifier" && Object.isFrozen(sent.body) && Object.isFrozen(sent)).toBe(true);
  });

  for (const operation of OPERATIONS) {
    describe(operation.name, () => {
      it("SBC-010 accepts plain and null-prototype data records", () => {
        expect(operation.run(operation.valid()).ok).toBe(true);
        expect(operation.run(Object.assign(Object.create(null), operation.valid())).ok).toBe(true);
      });
      it("SBC-011 refuses primitives, arrays, boxed and custom-prototype objects", () => {
        let touched = false;
        const hostile = { toString() { touched = true; throw new Error("coercion"); } };
        const values = [null, undefined, true, 200, "{}", Symbol("synthetic"), BigInt(1), [], [operation.valid()], new String("synthetic"), new Date(0), Object.assign(Object.create({ inherited: true }), operation.valid()), hostile];
        for (const value of values) expect(operation.run(value) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        expect(touched).toBe(false);
      });
      it("SBC-012 refuses every missing required key", () => {
        for (const key of Object.keys(operation.valid())) {
          const value: Record<string, unknown> = { ...operation.valid() };
          delete value[key];
          expect(operation.run(value) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        }
      });
      it("SBC-013 refuses authority, destination, hidden and symbol extras", () => {
        for (const key of ["role", "accountId", "sessionId", "purpose", "duration", "returnURL", "extra"]) {
          expect(operation.run({ ...operation.valid(), [key]: "synthetic" }) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        }
        const hidden = Object.defineProperty(operation.valid(), "hidden", { value: "synthetic", enumerable: false });
        expect(operation.run(hidden) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        expect(operation.run({ ...operation.valid(), [Symbol("extra")]: "synthetic" }) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
      });
      it("SBC-014 refuses non-string field values without coercion", () => {
        for (const key of Object.keys(operation.valid())) {
          for (const invalid of [undefined, null, 0, false, {}, [], new String("synthetic")]) {
            expect(operation.run({ ...operation.valid(), [key]: invalid }) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
          }
        }
      });
      it("SBC-015 refuses accessors and non-enumerable required fields", () => {
        let invoked = false;
        for (const key of Object.keys(operation.valid())) {
          const getter = Object.defineProperty(operation.valid(), key, { enumerable: true, get() { invoked = true; throw new Error("getter"); } });
          const setter = Object.defineProperty(operation.valid(), key, { enumerable: true, set() { invoked = true; } });
          const hidden = Object.defineProperty(operation.valid(), key, { enumerable: false });
          for (const value of [getter, setter, hidden]) expect(operation.run(value) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        }
        expect(invoked).toBe(false);
      });
      it("SBC-016 drops thrown metadata values unread and refuses revoked proxies", () => {
        let inspected = false;
        const thrown = new Proxy({}, { get() { inspected = true; throw null; }, getPrototypeOf() { inspected = true; throw null; } });
        const trap = () => { throw thrown; };
        for (const handler of [{ getPrototypeOf: trap }, { ownKeys: trap }, { getOwnPropertyDescriptor: trap }]) {
          expect(operation.run(new Proxy(operation.valid(), handler)) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        }
        const revoked = Proxy.revocable(operation.valid(), {});
        revoked.revoke();
        expect(operation.run(revoked.proxy) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
        expect(inspected).toBe(false);
      });
      it("SBC-017 snapshots each field once without ordinary property access", () => {
        const reads = new Map<string | symbol, number>();
        let ordinaryGet = false;
        const value = new Proxy(operation.valid(), {
          get() { ordinaryGet = true; throw new Error("ordinary-get"); },
          getOwnPropertyDescriptor(target, key) {
            reads.set(key, (reads.get(key) ?? 0) + 1);
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        });
        expect(operation.run(value).ok).toBe(true);
        expect(!ordinaryGet && Array.from(reads.values()).every((count) => count === 1)).toBe(true);
      });
    });
  }

  it("SBC-020 admits all exact send response variants, including neutral nil acknowledgment", () => {
    for (const challengeId of [SELECTOR, NIL, "ffffffff-ffff-ffff-ffff-ffffffffffff"]) {
      const result = parseExplorerSignInSendReply(200, { acknowledgment: "verification_code_requested", challengeId });
      expect(result.ok && "challengeId" in result.value && result.value.challengeId === challengeId).toBe(true);
    }
    for (const outcome of ["invalid_email", "denied"]) {
      const result = parseExplorerSignInSendReply(200, { outcome });
      expect(result.ok && "outcome" in result.value && result.value.outcome === outcome).toBe(true);
    }
  });

  it("SBC-021 refuses malformed reply selectors without requiring a UUID version", () => {
    for (const challengeId of ["", SELECTOR.toUpperCase(), ` ${SELECTOR}`, `${SELECTOR}\n`, `${SELECTOR}\r`, `${SELECTOR}\u2028`, SELECTOR.replace(/-/g, ""), SELECTOR.slice(1), `${SELECTOR}0`, SELECTOR.replace("a", "g"), "a".repeat(10000)]) {
      expect(parseExplorerSignInSendReply(200, { acknowledgment: "verification_code_requested", challengeId }) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
    }
  });

  it("SBC-022 admits only the exact verify response variants", () => {
    for (const outcome of ["code_not_accepted", "denied"]) {
      const result = parseExplorerSignInVerifyReply(200, { outcome });
      expect(result.ok && result.value.outcome === outcome).toBe(true);
    }
    const result = parseExplorerSignInVerifyReply(200, signedIn());
    expect(result.ok && result.value.outcome === "signed_in" && result.value.destination === "/explorer/home").toBe(true);
  });

  it("SBC-023 refuses alternate, encoded, absolute and extended destinations", () => {
    for (const destination of ["/explorer", "/guide/home", "/admin/home", "//example.invalid", "https://example.invalid/explorer/home", "/explorer/home/", "/explorer/home?next=x", "/explorer/home#x", "/explorer/%68ome", "/EXPLORER/home", " /explorer/home", "/explorer/home\n", "javascript:alert(1)"]) {
      expect(parseExplorerSignInVerifyReply(200, { outcome: "signed_in", destination }) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
    }
  });

  it("SBC-024 refuses cross-route, unknown and embellished replies", () => {
    for (const value of [signedIn(), { outcome: "code_not_accepted" }, { outcome: "please_wait" }, { outcome: "invalid_email", extra: "x" }, { ...acknowledgment(), outcome: "denied" }, { acknowledgment: "sent", challengeId: SELECTOR }]) {
      expect(parseExplorerSignInSendReply(200, value) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
    }
    for (const value of [acknowledgment(), { outcome: "invalid_email" }, { outcome: "wrong_code" }, { outcome: "expired" }, { outcome: "signed_in" }, { outcome: "denied", destination: "/explorer/home" }, { ...signedIn(), retryAfter: "1" }]) {
      expect(parseExplorerSignInVerifyReply(200, value) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
    }
  });

  it("SBC-025 refuses every unexpected status before observing its body", () => {
    let inspected = false;
    const body = new Proxy({}, { getPrototypeOf() { inspected = true; throw new Error("body-observed"); } });
    for (const status of [0, 199, 201, 204, 302, 400, 401, 403, 405, 429, 500, NaN, Infinity, "200", new Number(200), null, undefined, {}]) {
      expect(parseExplorerSignInSendReply(status, body) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
      expect(parseExplorerSignInVerifyReply(status, body) === SIGN_IN_BROWSER_CONTRACT_FAILED).toBe(true);
    }
    expect(inspected).toBe(false);
  });

  it("SBC-026 replies are immutable copies with only contract fields", () => {
    const input = acknowledgment();
    const result = parseExplorerSignInSendReply(200, input);
    expect(result.ok).toBe(true);
    if (!result.ok || !("challengeId" in result.value)) throw new Error("missing-synthetic-result");
    input.challengeId = NIL;
    expect(result.value.challengeId === SELECTOR).toBe(true);
    expect(Object.isFrozen(result) && Object.isFrozen(result.value)).toBe(true);
    expect(Object.keys(result).sort().join(",") === "ok,value").toBe(true);
    expect(Object.keys(result.value).sort().join(",") === "acknowledgment,challengeId").toBe(true);
    const success = parseExplorerSignInVerifyReply(200, signedIn());
    expect(success.ok && Object.isFrozen(success) && Object.isFrozen(success.value)).toBe(true);
  });
});
