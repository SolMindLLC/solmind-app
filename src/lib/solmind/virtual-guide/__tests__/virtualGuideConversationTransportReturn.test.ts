import { describe, expect, it } from "vitest";

import {
  VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
  VirtualGuideConversationError,
  invokeVirtualGuideConversation,
  type VirtualGuideConversationErrorCode,
  type VirtualGuideConversationTransport,
} from "../virtualGuideConversationContract";

const IDS = Object.freeze({
  invocation: "10000000-0000-4000-8000-000000000001",
  explorer: "10000000-0000-4000-8000-000000000002",
  session: "10000000-0000-4000-8000-000000000003",
  snapshot: "10000000-0000-4000-8000-000000000004",
  message: "10000000-0000-4000-8000-000000000005",
});
const PRIVATE_CONTEXT = "SYNTHETIC_PRIVATE_AUTHORIZED_CONTEXT";
const PRIVATE_TRANSPORT = "SYNTHETIC_PRIVATE_TRANSPORT_DETAIL";

function request() {
  return {
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: IDS.invocation,
    explorerId: IDS.explorer,
    sessionId: IDS.session,
    contextSnapshotId: IDS.snapshot,
    contextFingerprint: "a".repeat(64),
    authorizedContext: JSON.stringify({ immediateExplorerMessage: { content: PRIVATE_CONTEXT } }),
  };
}

function response() {
  return {
    contractVersion: VIRTUAL_GUIDE_CONVERSATION_CONTRACT_VERSION,
    invocationId: IDS.invocation,
    assistantMessage: {
      messageId: IDS.message,
      role: "solmind_virtual_guide",
      content: "What would help you feel prepared?",
    },
    finishReason: "completed",
  };
}

async function expectFixedError(
  outcome: Promise<unknown>,
  code: VirtualGuideConversationErrorCode = "virtual_guide_conversation_transport_failed",
): Promise<void> {
  let caught: unknown;
  try {
    await outcome;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(VirtualGuideConversationError);
  const error = caught as VirtualGuideConversationError;
  expect(error.code).toBe(code);
  expect(error.message).toBe(code);
  expect(String(error)).toBe(`VirtualGuideConversationError: ${code}`);
  expect(Object.hasOwn(error, "cause")).toBe(false);
  expect(error.cause).toBeUndefined();
  const outward = JSON.stringify(error);
  expect(JSON.parse(outward)).toEqual({ name: "VirtualGuideConversationError", code });
  for (const privateValue of [PRIVATE_CONTEXT, PRIVATE_TRANSPORT, ...Object.values(IDS)]) {
    expect(outward).not.toContain(privateValue);
    expect(String(error)).not.toContain(privateValue);
  }
}

type Counters = {
  generate: number;
  thenBody: number;
  thenGetter: number;
  constructorGetter: number;
  proxyGet: number;
  proxyGetPrototypeOf: number;
  proxyGetOwnPropertyDescriptor: number;
  proxyOwnKeys: number;
};

function counters(): Counters {
  return {
    generate: 0,
    thenBody: 0,
    thenGetter: 0,
    constructorGetter: 0,
    proxyGet: 0,
    proxyGetPrototypeOf: 0,
    proxyGetOwnPropertyDescriptor: 0,
    proxyOwnKeys: 0,
  };
}

// Factories and generate functions are intentionally plain. An async wrapper or
// mocking library could inspect/assimilate the hostile return before the owner
// receives it, invalidating these immediate-boundary observations. All poisoned
// native promises are already harmlessly fulfilled; none creates an independent
// rejected promise whose observation would require consulting hostile accessors.
const unsupportedReturns: ReadonlyArray<{
  name: string;
  make: (count: Counters) => unknown;
}> = [
  { name: "a raw valid-looking response", make: () => response() },
  {
    name: "a callable thenable",
    make: count => ({ then(resolve: (value: unknown) => void) {
      count.thenBody += 1;
      resolve(response());
    } }),
  },
  {
    name: "a throwing then getter on an ordinary object",
    make: count => Object.defineProperty({}, "then", { get() {
      count.thenGetter += 1;
      throw new Error(PRIVATE_TRANSPORT);
    } }),
  },
  {
    name: "a native Promise subclass",
    make: () => {
      class SyntheticPromise extends Promise<unknown> {}
      return new SyntheticPromise(resolve => resolve(response()));
    },
  },
  {
    name: "a Promise proxy without consulting any trap",
    make: count => new Proxy(Promise.resolve(response()), {
      get() { count.proxyGet += 1; throw new Error(PRIVATE_TRANSPORT); },
      getPrototypeOf() { count.proxyGetPrototypeOf += 1; throw new Error(PRIVATE_TRANSPORT); },
      getOwnPropertyDescriptor() { count.proxyGetOwnPropertyDescriptor += 1; throw new Error(PRIVATE_TRANSPORT); },
      ownKeys() { count.proxyOwnKeys += 1; throw new Error(PRIVATE_TRANSPORT); },
    }),
  },
  {
    name: "an object spoofing Promise.prototype without a native brand",
    make: () => Object.create(Promise.prototype),
  },
  {
    name: "an own then data property on a fulfilled native Promise",
    make: count => Object.defineProperty(Promise.resolve(response()), "then", {
      value(resolve: (value: unknown) => void) {
        count.thenBody += 1;
        resolve(response());
      },
    }),
  },
  {
    name: "an own then getter on a fulfilled native Promise",
    make: count => Object.defineProperty(Promise.resolve(response()), "then", { get() {
      count.thenGetter += 1;
      throw new Error(PRIVATE_TRANSPORT);
    } }),
  },
  {
    name: "an own constructor getter on a fulfilled native Promise",
    make: count => Object.defineProperty(Promise.resolve(response()), "constructor", { get() {
      count.constructorGetter += 1;
      throw new Error(PRIVATE_TRANSPORT);
    } }),
  },
  {
    name: "an own foreign constructor value on a fulfilled native Promise",
    make: () => Object.defineProperty(Promise.resolve(response()), "constructor", { value: Object }),
  },
];

describe("Virtual Guide immediate transport-return boundary", () => {
  it.each(["ordinary async", "Promise.resolve", "frozen native", "own Promise constructor data"])(
    "preserves the exact invocation-bound parsed response for %s", async kind => {
      let calls = 0;
      const generate = kind === "ordinary async"
        ? async () => { calls += 1; return response(); }
        : () => {
          calls += 1;
          const value = Promise.resolve(response());
          if (kind === "frozen native") return Object.freeze(value);
          if (kind === "own Promise constructor data") {
            Object.defineProperty(value, "constructor", { value: Promise });
          }
          return value;
        };
      const result = await invokeVirtualGuideConversation({
        request: request(), transport: { generate }, timeoutMilliseconds: 1_000,
      });
      expect(result).toEqual(response());
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.assistantMessage)).toBe(true);
      expect(calls).toBe(1);
    },
  );

  it.each(unsupportedReturns)("refuses $name before accessor, trap or then-body work", async fixture => {
    const count = counters();
    const immediate = fixture.make(count);
    function generate(): Promise<unknown> {
      count.generate += 1;
      return immediate as Promise<unknown>;
    }
    await expectFixedError(invokeVirtualGuideConversation({
      request: request(), transport: { generate }, timeoutMilliseconds: 1_000,
    }));
    expect(count).toEqual({ ...counters(), generate: 1 });
  });

  it.each(["native rejection", "synchronous throw"])(
    "preserves one value-free failure for %s", async kind => {
      let calls = 0;
      function generate(): Promise<unknown> {
        calls += 1;
        const failure = new Error(PRIVATE_TRANSPORT, { cause: PRIVATE_CONTEXT });
        if (kind === "synchronous throw") throw failure;
        return Promise.reject(failure);
      }
      await expectFixedError(invokeVirtualGuideConversation({
        request: request(), transport: { generate }, timeoutMilliseconds: 1_000,
      }));
      expect(calls).toBe(1);
    },
  );

  it.each(["unsupported return", "ordinary throw"])(
    "keeps synchronous caller cancellation first with %s and observes the owned abort rejection", async kind => {
      const caller = new AbortController();
      let calls = 0;
      let observedSignal: AbortSignal | undefined;
      function generate(_request: unknown, signal: AbortSignal): Promise<unknown> {
        calls += 1;
        observedSignal = signal;
        caller.abort();
        if (kind === "ordinary throw") throw new Error(PRIVATE_TRANSPORT);
        return response() as unknown as Promise<unknown>;
      }
      const transport: VirtualGuideConversationTransport = { generate };
      await expectFixedError(invokeVirtualGuideConversation({
        request: request(), transport, timeoutMilliseconds: 1_000, signal: caller.signal,
      }), "virtual_guide_conversation_cancelled");
      expect(calls).toBe(1);
      expect(observedSignal?.aborted).toBe(true);
      // Let the actual runner observe the next job turn. It must report any
      // unhandled rejection; no process-global swallowing handler is installed.
      await new Promise<void>(resolve => setImmediate(resolve));
    },
  );
});
