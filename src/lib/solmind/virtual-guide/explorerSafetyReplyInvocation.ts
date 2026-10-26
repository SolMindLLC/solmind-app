import "server-only";
import { types } from "node:util";
import {
  EXPLORER_SAFETY_REPLY_LIMITS, ExplorerSafetyReplyError,
  parseExplorerSafetyReplyBody, parseExplorerSafetyReplyRequest,
  type ExplorerSafetyReplyObservation, type ExplorerSafetyReplyRequest,
} from "./explorerSafetyReplyContract";

export type ExplorerSafetyReplyTransport = Readonly<{
  generate: (request: ExplorerSafetyReplyRequest, signal: AbortSignal) => Promise<unknown>;
}>;
export type ExplorerSafetyInvocationResult = Readonly<{
  invocationId: string; contextFingerprint: string;
  status: "observed" | "unavailable" | "not_attempted";
  reason: null | "delivery_canceled_before_dispatch" | "deadline" | "transport_failed" | "invalid_response";
  observation: ExplorerSafetyReplyObservation | null;
  deliveryInterested: boolean;
}>;
const DEADLINE = Object.freeze({ kind: "explorer_safety_deadline" });

function generatePort(transport: ExplorerSafetyReplyTransport): ExplorerSafetyReplyTransport["generate"] {
  try {
    if (!transport || typeof transport !== "object" || Object.getPrototypeOf(transport) !== Object.prototype ||
      Reflect.ownKeys(transport).length !== 1 || Reflect.ownKeys(transport)[0] !== "generate") throw DEADLINE;
    const descriptor = Object.getOwnPropertyDescriptor(transport, "generate");
    if (!descriptor?.enumerable || !("value" in descriptor) || typeof descriptor.value !== "function") throw DEADLINE;
    return descriptor.value as ExplorerSafetyReplyTransport["generate"];
  } catch { throw new ExplorerSafetyReplyError("explorer_safety_invalid_transport"); }
}
function ordinaryPromise(value: unknown): value is Promise<unknown> {
  if (!types.isPromise(value) || Object.getPrototypeOf(value) !== Promise.prototype ||
    Object.getOwnPropertyDescriptor(value, "then") !== undefined) return false;
  const constructor = Object.getOwnPropertyDescriptor(value, "constructor");
  return constructor === undefined || ("value" in constructor && constructor.value === Promise);
}

// This owner observes an actual dispatched operation independently of browser
// delivery interest. It owns no SQL, recovery queue, retry or activation.
export async function invokeExplorerSafetyReply(input: {
  request: unknown; transport: ExplorerSafetyReplyTransport;
  timeoutMilliseconds: number; signal?: AbortSignal;
}): Promise<ExplorerSafetyInvocationResult> {
  const request = parseExplorerSafetyReplyRequest(input.request);
  if (!Number.isSafeInteger(input.timeoutMilliseconds) ||
    input.timeoutMilliseconds < EXPLORER_SAFETY_REPLY_LIMITS.minimumTimeoutMilliseconds ||
    input.timeoutMilliseconds > EXPLORER_SAFETY_REPLY_LIMITS.maximumTimeoutMilliseconds) {
    throw new ExplorerSafetyReplyError("explorer_safety_invalid_request");
  }
  const generate = generatePort(input.transport);
  let interested = !input.signal?.aborted;
  function result(status: ExplorerSafetyInvocationResult["status"], reason: ExplorerSafetyInvocationResult["reason"],
    observation: ExplorerSafetyReplyObservation | null = null): ExplorerSafetyInvocationResult {
    return Object.freeze({ invocationId: request.invocationId, contextFingerprint: request.contextFingerprint,
      status, reason, observation, deliveryInterested: interested });
  }
  if (!interested) return result("not_attempted", "delivery_canceled_before_dispatch");
  const deliveryCanceled = (): void => { interested = false; };
  input.signal?.addEventListener("abort", deliveryCanceled, { once: true });
  if (input.signal?.aborted) interested = false;
  if (!interested) {
    input.signal?.removeEventListener("abort", deliveryCanceled);
    return result("not_attempted", "delivery_canceled_before_dispatch");
  }

  const controller = new AbortController();
  let closed = false;
  const deadlineAt = performance.now() + input.timeoutMilliseconds;
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(DEADLINE), { once: true });
  });
  // Must be observed before the injected port can synchronously fail.
  void deadline.catch(() => undefined);
  const timer = setTimeout(() => { closed = true; controller.abort(); }, input.timeoutMilliseconds);
  try {
    const generated = generate(request, controller.signal);
    if (!ordinaryPromise(generated)) { controller.abort(); return result("unavailable", "transport_failed"); }
    // Promise.race attaches rejection observation to the actual owned promise;
    // deadline never means the port/remote effects have been proved stopped.
    const raw = await Promise.race([generated, deadline]);
    if (closed || performance.now() >= deadlineAt) {
      closed = true; controller.abort();
      return result("unavailable", "deadline");
    }
    try {
      const observation = parseExplorerSafetyReplyBody(raw, request.mode);
      return result("observed", null, observation);
    } catch { return result("unavailable", "invalid_response"); }
  } catch (error) {
    if (error === DEADLINE || closed || performance.now() >= deadlineAt) return result("unavailable", "deadline");
    controller.abort();
    return result("unavailable", "transport_failed");
  } finally {
    closed = true;
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", deliveryCanceled);
  }
}
