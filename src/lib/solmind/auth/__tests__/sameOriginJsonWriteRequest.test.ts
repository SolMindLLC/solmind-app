import { describe, expect, it, vi } from "vitest";

import {
  SOLMIND_JSON_WRITE_BODY_IDLE_MS,
  SOLMIND_JSON_WRITE_BODY_TOTAL_MS,
  SOLMIND_JSON_WRITE_BODY_MAX_BYTES,
  SOLMIND_JSON_WRITE_REQUEST_DENIED,
  readSameOriginJsonWriteRequest,
} from "../sameOriginJsonWriteRequest";

const ORIGIN = "https://solmind.example";
const encoder = new TextEncoder();

function request(args: {
  body?: BodyInit | null;
  method?: string;
  headers?: Record<string, string>;
} = {}): Request {
  const method = args.method ?? "POST";
  return new Request(`${ORIGIN}/guide/commands`, {
    method,
    body:
      method === "GET" || method === "HEAD"
        ? undefined
        : args.body === undefined
          ? '{"kind":"guide.save_draft"}'
          : args.body,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      ...args.headers,
    },
  });
}

async function guard(value: Request, trustedOrigin = ORIGIN) {
  return readSameOriginJsonWriteRequest({ request: value, trustedOrigin });
}

function expectDenied(result: Awaited<ReturnType<typeof guard>>) {
  expect(result).toEqual({
    ok: false,
    value: null,
    error: SOLMIND_JSON_WRITE_REQUEST_DENIED,
  });
}

function rawRequest(args: {
  body: ReadableStream<Uint8Array>;
  headers?: Record<string, string>;
}): Request {
  return {
    method: "POST",
    body: args.body,
    headers: new Headers({
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "Sec-Fetch-Site": "same-origin",
      ...args.headers,
    }),
  } as Request;
}

describe("readSameOriginJsonWriteRequest", () => {
  it("accepts one same-origin JSON object and deeply freezes it", async () => {
    const body = JSON.stringify({
      kind: "guide.save_draft",
      arrivalSignals: ["One evening remains unscheduled."],
    });
    const result = await guard(
      request({
        body,
        headers: { "Content-Length": String(encoder.encode(body).length) },
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(JSON.parse(body));
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.arrivalSignals)).toBe(true);
    }
  });

  it("accepts the one permitted charset parameter without requiring a declared length", async () => {
    const result = await guard(
      request({ headers: { "Content-Type": "Application/JSON; charset=UTF-8" } }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts exact identity content encoding", async () => {
    const result = await guard(
      request({ headers: { "Content-Encoding": "identity" } }),
    );
    expect(result.ok).toBe(true);
  });

  it.each(["GET", "PUT", "PATCH", "DELETE"])(
    "rejects method %s",
    async (method) => expectDenied(await guard(request({ method }))),
  );

  it.each([
    "",
    "text/plain",
    "application/problem+json",
    "application/json; profile=x",
    "application/json, application/json",
  ])("rejects media type %s", async (contentType) => {
    expectDenied(
      await guard(request({ headers: { "Content-Type": contentType } })),
    );
  });

  it.each([
    [{ Origin: "https://other.example" }],
    [{ Origin: "https://solmind.example.evil" }],
    [{ Origin: "https://solmind.example:443" }],
    [{ Origin: "null" }],
    [{ Origin: "" }],
    [{ "Sec-Fetch-Site": "same-site" }],
    [{ "Sec-Fetch-Site": "cross-site" }],
    [{ "Sec-Fetch-Site": "none" }],
    [{ "Sec-Fetch-Site": "" }],
    [{ "Sec-Fetch-Site": "same-origin, same-origin" }],
  ])("rejects an unsafe browser-origin signal %#", async (headers) => {
    expectDenied(await guard(request({ headers })));
  });

  it.each([
    ["Origin", { "Sec-Fetch-Site": "same-origin" }],
    ["Sec-Fetch-Site", { Origin: ORIGIN }],
  ])("rejects a request with an absent %s header", async (_header, headers) => {
    const value = new Request(`${ORIGIN}/guide/commands`, {
      method: "POST",
      body: '{"kind":"guide.save_draft"}',
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    expectDenied(await guard(value));
  });

  it.each(["gzip", "br", "deflate", "identity, gzip"])(
    "rejects content encoding %s",
    async (contentEncoding) => {
      expectDenied(
        await guard(
          request({ headers: { "Content-Encoding": contentEncoding } }),
        ),
      );
    },
  );

  it.each(["+1", " 1", "1 ", "01", "1, 1", "abc", "9007199254740992"])(
    "rejects noncanonical content length %s",
    async (contentLength) => {
      expectDenied(
        await guard(
          request({ headers: { "Content-Length": contentLength } }),
        ),
      );
    },
  );

  it("rejects declared and actual length mismatch", async () => {
    expectDenied(
      await guard(request({ headers: { "Content-Length": "1" } })),
    );
  });

  it("rejects an actual body shorter than its declared length", async () => {
    expectDenied(
      await guard(request({ headers: { "Content-Length": "100" } })),
    );
  });

  it("rejects a declared over-cap body before reading the stream", async () => {
    const getReader = vi.fn(() => {
      throw new Error("the body must not be read");
    });
    const guarded = rawRequest({
      body: { getReader } as unknown as ReadableStream<Uint8Array>,
      headers: {
        "Content-Length": String(SOLMIND_JSON_WRITE_BODY_MAX_BYTES + 1),
      },
    });

    expectDenied(await guard(guarded));
    expect(getReader).not.toHaveBeenCalled();
  });

  it("accepts the exact maximum current Guide save-draft request shape", async () => {
    const scalar = String.fromCodePoint(0x1f600);
    const body = JSON.stringify({
      kind: "guide.save_draft",
      relationshipId: "11111111-1111-4111-8111-111111111111",
      operationId: "22222222-2222-4222-8222-222222222222",
      suggestedWaypointId: "33333333-3333-4333-8333-333333333333",
      expectedRevision: Number.MAX_SAFE_INTEGER,
      destination: scalar.repeat(160),
      why: scalar.repeat(1000),
      arrivalSignals: Array.from({ length: 8 }, (_, index) =>
        `${scalar.repeat(239)}${String.fromCodePoint(0x1f601 + index)}`,
      ),
    });
    expect(encoder.encode(body)).toHaveLength(12_622);

    const result = await guard(
      request({
        body,
        headers: { "Content-Length": "12622" },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts an exact-cap valid JSON object", async () => {
    const empty = JSON.stringify({ value: "" });
    const body = JSON.stringify({
      value: "x".repeat(
        SOLMIND_JSON_WRITE_BODY_MAX_BYTES - encoder.encode(empty).length,
      ),
    });
    expect(encoder.encode(body)).toHaveLength(SOLMIND_JSON_WRITE_BODY_MAX_BYTES);
    const result = await guard(
      request({
        body,
        headers: {
          "Content-Length": String(SOLMIND_JSON_WRITE_BODY_MAX_BYTES),
        },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a valid JSON object one byte above the exact cap", async () => {
    const empty = JSON.stringify({ value: "" });
    const body = JSON.stringify({
      value: "x".repeat(
        SOLMIND_JSON_WRITE_BODY_MAX_BYTES - encoder.encode(empty).length + 1,
      ),
    });
    expect(encoder.encode(body)).toHaveLength(
      SOLMIND_JSON_WRITE_BODY_MAX_BYTES + 1,
    );
    expectDenied(
      await guard(request({ body })),
    );
  });

  it("cancels an undeclared stream as soon as the byte cap is exceeded", async () => {
    const cancel = vi.fn();
    const guarded = rawRequest({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new Uint8Array(SOLMIND_JSON_WRITE_BODY_MAX_BYTES + 1),
          );
        },
        cancel,
      }),
    });

    expectDenied(await guard(guarded));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  // REV341a finding 1 (correction D-5): the body read has an idle limit and a total limit, honours the request's cancellation, and
  // never waits on cleanup.
  it("denies and cancels a body that stops partway once the idle limit passes, not before", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const guarded = rawRequest({
        body: new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(encoder.encode('{"kind":')); },
          cancel,
        }),
      });
      let settled = false;
      const pending = guard(guarded).finally(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(SOLMIND_JSON_WRITE_BODY_IDLE_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expectDenied(await pending);
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("denies at once, without waiting for the limit, when the request is cancelled during a read", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const cancel = vi.fn();
      const guarded = {
        ...rawRequest({
          body: new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(encoder.encode("{")); }, cancel }),
        }),
        signal: controller.signal,
      } as Request;
      const pending = guard(guarded);
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();
      expectDenied(await pending);
      expect(cancel).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("accepts a slow body that keeps arriving in pieces, and leaves no timer behind", async () => {
    vi.useFakeTimers();
    try {
      let stream!: ReadableStreamDefaultController<Uint8Array>;
      const guarded = rawRequest({ body: new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } }) });
      const pending = guard(guarded);
      stream.enqueue(encoder.encode('{"kind":'));
      await vi.advanceTimersByTimeAsync(4_000);
      stream.enqueue(encoder.encode('"guide.save_draft"'));
      await vi.advanceTimersByTimeAsync(4_000);
      stream.enqueue(encoder.encode("}"));
      await vi.advanceTimersByTimeAsync(4_000);
      stream.close();
      const result = await pending;
      expect(result).toEqual({ ok: true, value: { kind: "guide.save_draft" }, error: null });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("denies an upload that keeps progressing past the total limit", async () => {
    vi.useFakeTimers();
    try {
      let stream!: ReadableStreamDefaultController<Uint8Array>;
      const cancel = vi.fn();
      const guarded = rawRequest({ body: new ReadableStream<Uint8Array>({ start(controller) { stream = controller; }, cancel }) });
      let settled = false;
      const pending = guard(guarded).finally(() => { settled = true; });
      // A piece every 4 seconds keeps the idle limit from firing; only the total limit can end the read.
      let elapsed = 0;
      while (elapsed + 4_000 < SOLMIND_JSON_WRITE_BODY_TOTAL_MS) {
        stream.enqueue(encoder.encode(" "));
        await vi.advanceTimersByTimeAsync(4_000);
        elapsed += 4_000;
        expect(settled).toBe(false);
      }
      stream.enqueue(encoder.encode(" "));
      await vi.advanceTimersByTimeAsync(SOLMIND_JSON_WRITE_BODY_TOTAL_MS - elapsed - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expectDenied(await pending);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("denies an already cancelled request without reading its body", async () => {
    const getReader = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const guarded = {
      ...rawRequest({ body: { getReader } as unknown as ReadableStream<Uint8Array> }),
      signal: controller.signal,
    } as Request;
    expectDenied(await guard(guarded));
    expect(getReader).not.toHaveBeenCalled();
  });

  it("returns the denial for an over-cap body even when the stream's cleanup never settles", async () => {
    vi.useFakeTimers();
    try {
      const guarded = rawRequest({
        body: new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new Uint8Array(SOLMIND_JSON_WRITE_BODY_MAX_BYTES + 1)); },
          cancel: () => new Promise<void>(() => undefined),
        }),
      });
      expectDenied(await guard(guarded));
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not allow hostile Host or forwarded headers to substitute for Origin", async () => {
    expectDenied(
      await guard(
        request({
          headers: {
            Origin: "https://other.example",
            Host: "solmind.example",
            "X-Forwarded-Host": "solmind.example",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    );
  });

  it.each(["", "[]", "null", "1", "true", "{", "{} trailing"])(
    "rejects non-object or malformed JSON %#",
    async (body) => expectDenied(await guard(request({ body }))),
  );

  it("rejects a UTF-8 BOM", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode("{}")]);
    expectDenied(await guard(request({ body: bytes })));
  });

  it("rejects malformed UTF-8", async () => {
    expectDenied(
      await guard(request({ body: new Uint8Array([0x7b, 0xff, 0x7d]) })),
    );
  });

  it("fails closed for an invalid trusted origin without reflecting it", async () => {
    expectDenied(await guard(request(), "https://secret.example/path"));
  });

  it("requires the trusted origin to be the canonical loader output", async () => {
    expectDenied(await guard(request(), `${ORIGIN}/`));
  });
});
