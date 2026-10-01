import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createProviderProbeCleanupLedger } from "./providerProbeCleanupLedger";
import {
  isRunTaggedAddress,
  MAILPIT_MAX_INVENTORY_PASSES,
  MAILPIT_MAX_PAGES,
  MAILPIT_PAGE_SIZE,
  MailpitProbeError,
  type MailpitFetch,
  type MailpitProbeErrorCode,
} from "./providerProbeMailpitClient";
import { createProviderProbeKnownValueRegistry, scanProviderProbeOutput } from "./providerProbeRunEnvelope";
import {
  addOwnedRecipientForTests,
  createLoopbackFetchForTests,
  createMailpitInventoryForTests,
  createOwnedRecipientsForTests,
  gatedTestEnvironment,
  issueReceiptForTests,
  testConfig,
} from "./providerProbeTestSupport";

// Plainly fake, in-memory mailboxes and one in-process server on a random 127.0.0.1
// port. Nothing here contacts a real mail catcher or reads process.env.
const ENV = gatedTestEnvironment("mailpit");
const CONFIG = testConfig(ENV);
const RUN_TAG = "p28-20261001-mailpit";
// What the run's user-creation operation would have minted and confirmed.
const OWNED = `${RUN_TAG}-abcdefghijklmnop@synthetic.invalid`;
// Carries the run tag, but no run operation produced it.
const TAGGED_NOT_OWNED = `probe+${RUN_TAG}@synthetic.invalid`;

type FakeMessage = Record<string, unknown>;

function message(id: string, to: string[], extra: FakeMessage = {}): FakeMessage {
  return {
    ID: id,
    MessageID: `MESSAGEIDCANARY-${id}`,
    From: { Name: "FROMNAMECANARY", Address: "fromcanary@synthetic.invalid" },
    To: to.map((Address) => ({ Name: "TONAMECANARY", Address })),
    Cc: [],
    Bcc: null,
    Subject: "SUBJECTCANARY",
    Snippet: "SNIPPETCANARY",
    Created: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

function untagged(prefix: string, count: number): FakeMessage[] {
  return Array.from({ length: count }, (_unused, index) =>
    message(`${prefix}${String(index).padStart(6, "0")}`, ["other@synthetic.invalid"]),
  );
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

// A fake mailbox, newest first, paged like Mailpit, whose `total` is computed from the
// live mailbox each time a page is served. `shape` can override the page fields to
// build contradictions. Hooks run after a page is served.
function fakeMailbox(initial: FakeMessage[]) {
  const messages = [...initial];
  const urls: string[] = [];
  let afterServe: (requestNumber: number) => void = () => undefined;
  let shape: (page: Record<string, unknown>) => Record<string, unknown> = (page) => page;
  const fetch: MailpitFetch = async (input, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const url = new URL(input);
    const start = Number(url.searchParams.get("start"));
    const limit = Number(url.searchParams.get("limit"));
    urls.push(input);
    const page = messages.slice(start, start + limit);
    const response = jsonResponse(
      shape({ total: messages.length, messages_count: messages.length, start, count: page.length, messages: page }),
    );
    afterServe(urls.length);
    return response;
  };
  return {
    messages,
    urls,
    fetch,
    onAfterServe(hook: (requestNumber: number) => void) {
      afterServe = hook;
    },
    reshape(next: (page: Record<string, unknown>) => Record<string, unknown>) {
      shape = next;
    },
  };
}

function setup(initial: FakeMessage[]) {
  const box = fakeMailbox(initial);
  const ledger = createProviderProbeCleanupLedger(ENV);
  const registry = createProviderProbeKnownValueRegistry();
  const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
  addOwnedRecipientForTests(ownedRecipients, CONFIG.runId, OWNED);
  const inventory = createMailpitInventoryForTests({ config: CONFIG, fetch: box.fetch, ledger, registry, ownedRecipients });
  return { box, ledger, registry, inventory };
}

async function expectCode(promise: Promise<unknown>, code: MailpitProbeErrorCode): Promise<MailpitProbeError> {
  const error = await promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(MailpitProbeError);
  expect((error as MailpitProbeError).code).toBe(code);
  expect((error as Error).message).toBe(code);
  expect((error as Error).cause).toBeUndefined();
  return error as MailpitProbeError;
}

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length > 0) {
    await closers.pop()!();
  }
});

describe("mailpit run tag", () => {
  it.each([
    [`probe+${RUN_TAG}@synthetic.invalid`, true],
    [`PROBE+${RUN_TAG.toUpperCase()}@SYNTHETIC.INVALID`, true],
    [`${RUN_TAG}-extra@synthetic.invalid`, true],
    ["probe+p28-20261001-other@synthetic.invalid", false],
    [`probe+${RUN_TAG}@example.com`, false],
    [`probe+${RUN_TAG}@synthetic.invalid.example.com`, false],
    [`probe+${RUN_TAG}@sub.synthetic.invalid`, false],
    [`synthetic.invalid@${RUN_TAG}.example`, false],
    ["@synthetic.invalid", false],
    [RUN_TAG, false],
  ])("address %s run-tagged=%s", (address, tagged) => {
    expect(isRunTaggedAddress(address, RUN_TAG)).toBe(tagged);
  });
});

describe("mailpit capture: receipts only for run-owned recipients", () => {
  it("captures a message to a run-owned address, returning counts only", async () => {
    const { box, ledger, registry, inventory } = setup(untagged("seed", 3));

    expect(await inventory.takeBaseline()).toEqual({ totalMessageCount: 3 });
    box.messages.unshift(
      message("ownedTo00001", [OWNED]),
      message("ownedCc00002", ["other@synthetic.invalid"], { Cc: [{ Name: "", Address: OWNED.toUpperCase() }] }),
    );
    const capture = await inventory.captureNewRunOwnedMessages();
    const again = await inventory.captureNewRunOwnedMessages();
    const counts = await inventory.readCounts();

    expect(capture).toEqual({ captured: 2, unownedRunTagged: 0, totalMessageCount: 5 });
    expect(again).toEqual({ captured: 0, unownedRunTagged: 0, totalMessageCount: 5 });
    expect(counts).toEqual({ totalMessageCount: 5, runTaggedMessageCount: 2, runOwnedMessageCount: 2 });
    expect(ledger.recordedCounts()).toEqual({ authUsers: 0, mailpitMessages: 2 });
    for (const result of [capture, again, counts]) {
      expect(Object.isFrozen(result)).toBe(true);
      const rendered = JSON.stringify(result);
      for (const canary of ["ownedTo00001", "ownedCc00002", "SUBJECTCANARY", "CANARY", "@"]) {
        expect(rendered).not.toContain(canary);
      }
    }
    expect(scanProviderProbeOutput("id ownedTo00001", registry).knownValueMatches).toBe(1);
  });

  it("refuses a receipt for an externally inserted message that carries the run tag", async () => {
    const { box, ledger, registry, inventory } = setup(untagged("seed", 2));
    await inventory.takeBaseline();
    box.messages.unshift(
      message("external001", [TAGGED_NOT_OWNED]),
      message("external002", [`${RUN_TAG}-abcdefghijklmnoq@synthetic.invalid`]),
    );

    const capture = await inventory.captureNewRunOwnedMessages();

    expect(capture).toEqual({ captured: 0, unownedRunTagged: 2, totalMessageCount: 4 });
    expect(ledger.recordedCounts().mailpitMessages).toBe(0);
    expect(scanProviderProbeOutput("id external001", registry).knownValueMatches).toBe(0);
  });

  it("gives no receipt to a same-run, well-formed but unrelated message id", async () => {
    const { box, ledger, inventory } = setup([]);
    await inventory.takeBaseline();
    box.messages.unshift(message("unrelated01", ["someone@synthetic.invalid"]));

    expect(await inventory.captureNewRunOwnedMessages()).toEqual({ captured: 0, unownedRunTagged: 0, totalMessageCount: 1 });
    expect(ledger.recordedCounts().mailpitMessages).toBe(0);
  });

  it("refuses a baseline that already holds a message for this run", async () => {
    const { ledger, inventory } = setup([...untagged("seed", 2), message("already01", [TAGGED_NOT_OWNED])]);

    await expectCode(inventory.takeBaseline(), "mailpit_baseline_not_clean");
    expect(ledger.recordedCounts().mailpitMessages).toBe(0);
  });

  it("requires exactly one baseline before any capture", async () => {
    const { inventory } = setup(untagged("seed", 1));

    await expectCode(inventory.captureNewRunOwnedMessages(), "mailpit_baseline_missing");
    await inventory.takeBaseline();
    await expectCode(inventory.takeBaseline(), "mailpit_baseline_already_taken");
  });

  it("refuses to capture into a ledger that has stopped recording", async () => {
    const { box, ledger, inventory } = setup(untagged("seed", 1));
    await inventory.takeBaseline();
    await ledger.runCleanup({ deleteAuthUser: async () => undefined, deleteMailpitMessage: async () => undefined });
    box.messages.unshift(message("lateMsg01", [OWNED]));

    await expectCode(inventory.captureNewRunOwnedMessages(), "mailpit_ledger_closed");
  });

  it("refuses a capture larger than the ledger's remaining capacity, recording none of it", async () => {
    const { box, ledger, inventory } = setup(untagged("seed", 1));
    await inventory.takeBaseline();
    for (let index = 0; index < 99; index += 1) {
      ledger.recordCreated(issueReceiptForTests("mailpit-message", `filler${String(index).padStart(4, "0")}`, CONFIG.runId));
    }
    box.messages.unshift(message("newMsg0001", [OWNED]), message("newMsg0002", [OWNED]));

    await expectCode(inventory.captureNewRunOwnedMessages(), "mailpit_capture_capacity_exceeded");
    expect(ledger.recordedCounts().mailpitMessages).toBe(99);
  });
});

describe("mailpit completeness: the reported total and the pages must agree", () => {
  it("reads every count twice and trusts it only when two complete inventories agree", async () => {
    const { box, inventory } = setup(untagged("seed", MAILPIT_PAGE_SIZE + 10));

    expect(await inventory.readCounts()).toEqual({ totalMessageCount: 60, runTaggedMessageCount: 0, runOwnedMessageCount: 0 });
    expect(box.urls.map((url) => new URL(url).search)).toEqual([
      "?start=0&limit=50",
      "?start=50&limit=50",
      "?start=0&limit=50",
      "?start=50&limit=50",
    ]);
  });

  it("reads an empty mailbox whose total is zero", async () => {
    const { box, inventory } = setup([]);

    expect(await inventory.readCounts()).toEqual({ totalMessageCount: 0, runTaggedMessageCount: 0, runOwnedMessageCount: 0 });
    expect(box.urls).toHaveLength(2);
  });

  it.each([
    ["a total higher than the pages hold", (page: Record<string, unknown>) => ({ ...page, total: 999, messages_count: 999 })],
    ["a total lower than the pages hold", (page: Record<string, unknown>) => ({ ...page, total: 1, messages_count: 1 })],
    [
      "a short page under a stable total",
      (page: Record<string, unknown>) => {
        // Drops one message but keeps every other field self-consistent, so only the
        // total-and-page agreement can catch it.
        const messages = (page.messages as unknown[]).slice(1);
        return { ...page, messages, count: messages.length };
      },
    ],
    ["a count that disagrees with the page", (page: Record<string, unknown>) => ({ ...page, count: 7 })],
    ["a start that disagrees with the request", (page: Record<string, unknown>) => ({ ...page, start: 5 })],
    ["a messages_count that disagrees with the total", (page: Record<string, unknown>) => ({ ...page, messages_count: 2 })],
  ])("fails closed on %s", async (_label, reshape) => {
    const { box, inventory } = setup(untagged("seed", 3));
    box.reshape(reshape);

    await expectCode(inventory.readCounts(), "mailpit_inventory_inconsistent");
  });

  it.each([
    ["a missing total", (page: Record<string, unknown>) => ({ ...page, total: undefined })],
    ["a fractional total", (page: Record<string, unknown>) => ({ ...page, total: 2.5 })],
    ["a negative total", (page: Record<string, unknown>) => ({ ...page, total: -1 })],
    ["a total given as text", (page: Record<string, unknown>) => ({ ...page, total: "3" })],
  ])("fails closed on %s", async (_label, reshape) => {
    const { box, inventory } = setup(untagged("seed", 3));
    box.reshape(reshape);

    await expectCode(inventory.readCounts(), "mailpit_response_malformed");
  });

  it("refuses a total larger than its page bound before paging further", async () => {
    const { box, inventory } = setup(untagged("seed", 3));
    const tooMany = MAILPIT_MAX_PAGES * MAILPIT_PAGE_SIZE + 1;
    box.reshape((page) => ({ ...page, total: tooMany, messages_count: tooMany }));

    await expectCode(inventory.readCounts(), "mailpit_inventory_too_large");
    expect(box.urls).toHaveLength(1);
  });

  it("discards a pass in which a deletion between pages changed the total, then settles", async () => {
    const initial = untagged("seed", MAILPIT_PAGE_SIZE + 10);
    // The first message of page two is this run's; a shifted read would skip it.
    initial[MAILPIT_PAGE_SIZE] = message("ownedAt050", [OWNED]);
    const { box, inventory } = setup(initial);
    box.onAfterServe((requestNumber) => {
      if (requestNumber === 1) {
        box.messages.splice(10, 1);
      }
    });

    expect(await inventory.readCounts()).toEqual({ totalMessageCount: 59, runTaggedMessageCount: 1, runOwnedMessageCount: 1 });
    expect(box.urls).toHaveLength(6);
  });

  it("discards a pass in which an insertion between pages changed the total, then settles", async () => {
    const { box, inventory } = setup(untagged("seed", MAILPIT_PAGE_SIZE + 10));
    box.onAfterServe((requestNumber) => {
      if (requestNumber === 1) {
        box.messages.unshift(message("inserted01", ["other@synthetic.invalid"]));
      }
    });

    expect(await inventory.readCounts()).toEqual({ totalMessageCount: 61, runTaggedMessageCount: 0, runOwnedMessageCount: 0 });
  });

  it("fails closed when the mailbox keeps changing", async () => {
    const { box, inventory } = setup(untagged("seed", 5));
    box.onAfterServe((requestNumber) => {
      box.messages.unshift(message(`churn${String(requestNumber).padStart(5, "0")}`, ["other@synthetic.invalid"]));
    });

    await expectCode(inventory.readCounts(), "mailpit_inventory_unstable");
    expect(box.urls).toHaveLength(MAILPIT_MAX_INVENTORY_PASSES);
  });

  it("does not trust two passes that differ only in a message's classification", async () => {
    const { box, inventory } = setup([message("flipping1", ["other@synthetic.invalid"])]);
    box.onAfterServe((requestNumber) => {
      box.messages[0] = message("flipping1", requestNumber % 2 === 1 ? [OWNED] : ["other@synthetic.invalid"]);
    });

    await expectCode(inventory.readCounts(), "mailpit_inventory_unstable");
  });
});

describe("mailpit response validation", () => {
  function inventoryReturning(make: () => Response | Promise<Response>) {
    return createMailpitInventoryForTests({
      config: CONFIG,
      fetch: async () => await make(),
      ledger: createProviderProbeCleanupLedger(ENV),
      registry: createProviderProbeKnownValueRegistry(),
      ownedRecipients: createOwnedRecipientsForTests(CONFIG.runId),
    });
  }

  function page(messages: unknown[]) {
    return { total: messages.length, messages };
  }

  it.each([
    ["a non-object payload", []],
    ["a missing message list", { total: 0 }],
    ["an over-long page", page(untagged("long", MAILPIT_PAGE_SIZE + 1))],
    ["a non-object message", page(["x"])],
    ["a missing ID", page([{ To: [] }])],
    ["an ID with a space", page([message("bad id 0001", [])])],
    ["an ID shorter than eight characters", page([message("short", [])])],
    ["an over-long ID", page([message("a".repeat(65), [])])],
    ["a non-array recipient field", page([message("message01", [], { To: "x@synthetic.invalid" })])],
    ["a recipient without an address", page([message("message01", [], { To: [{ Name: "x" }] })])],
    ["an over-long address", page([message("message01", ["x".repeat(321)])])],
  ])("fails closed on %s", async (_label, payload) => {
    await expectCode(inventoryReturning(() => jsonResponse(payload)).readCounts(), "mailpit_response_malformed");
  });

  it("fails closed on a non-JSON media type or body", async () => {
    await expectCode(
      inventoryReturning(() => new Response("{}", { headers: { "content-type": "text/html" } })).readCounts(),
      "mailpit_response_malformed",
    );
    await expectCode(
      inventoryReturning(() => new Response("not json", { headers: { "content-type": "application/json" } })).readCounts(),
      "mailpit_response_malformed",
    );
  });

  it("maps transport and status failures to one value-free error", async () => {
    await expectCode(inventoryReturning(() => jsonResponse(page([]), { status: 500 })).readCounts(), "mailpit_request_failed");
    const error = await expectCode(
      inventoryReturning(() => {
        throw new Error("TRANSPORTCANARY http://127.0.0.1:54324/api/v1/messages");
      }).readCounts(),
      "mailpit_request_failed",
    );
    expect(JSON.stringify(error) + String(error) + (error.stack ?? "")).not.toContain("TRANSPORTCANARY");
  });
});

describe("mailpit inventory over the gated test transport", () => {
  it("reads an in-process fake mail catcher through the allowlisted transport", async () => {
    const requests: string[] = [];
    let messages = [message("e2eOther01", ["x@synthetic.invalid"])];
    const server = http.createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      const body = JSON.stringify({ total: messages.length, messages });
      response.writeHead(200, { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    closers.push(
      () =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    );
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const ledger = createProviderProbeCleanupLedger(ENV);
    const ownedRecipients = createOwnedRecipientsForTests(CONFIG.runId);
    addOwnedRecipientForTests(ownedRecipients, CONFIG.runId, OWNED);
    const inventory = createMailpitInventoryForTests({
      config: CONFIG,
      origin,
      fetch: createLoopbackFetchForTests({
        environment: ENV,
        targets: [{ origin, pathPrefixes: ["/api/v1/"] }],
        maxRequestBytes: 0,
        maxResponseBytes: 65_536,
      }),
      ledger,
      registry: createProviderProbeKnownValueRegistry(),
      ownedRecipients,
    });

    await inventory.takeBaseline();
    messages = [message("e2eOwned01", [OWNED]), ...messages];
    const capture = await inventory.captureNewRunOwnedMessages();

    expect(capture).toEqual({ captured: 1, unownedRunTagged: 0, totalMessageCount: 2 });
    expect(ledger.recordedCounts().mailpitMessages).toBe(1);
    expect(new Set(requests)).toEqual(new Set(["GET /api/v1/messages?start=0&limit=50"]));
    expect(requests).toHaveLength(4);
  });
});
