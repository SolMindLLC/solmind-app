// Dormant Explorer flow; the future view owns its code draft and UI wording.
// Aborting suppresses local publication, not remote redemption/cookie effects.
import { EXPLORER_BROWSER_SIGN_IN_HOME } from "./signInBrowserContract";
import {
  createExplorerSignInBrowserTransport,
  type ExplorerSignInBrowserFetch,
  type ExplorerSignInBrowserTransportFailure,
} from "./explorerSignInBrowserTransport";

export type ExplorerSignInFlowStage = "email" | "code" | "complete" | "disposed";
export type ExplorerSignInFlowAction = "send" | "resend" | "verify";
export type ExplorerSignInFlowOutcome =
  | "verification_code_requested"
  | "invalid_email"
  | "denied"
  | "code_not_accepted"
  | "signed_in"
  | ExplorerSignInBrowserTransportFailure["error"];
export type ExplorerSignInFlowCompletion = "settled" | "ignored";
export type ExplorerSignInFlowProjection = Readonly<{
  stage: ExplorerSignInFlowStage;
  identifier: string;
  pending: ExplorerSignInFlowAction | null;
  outcome: ExplorerSignInFlowOutcome | null;
  hasSelector: boolean;
  destination: typeof EXPLORER_BROWSER_SIGN_IN_HOME | null;
}>;
export type ExplorerSignInFlowController = Readonly<{
  read(): ExplorerSignInFlowProjection;
  setIdentifier(rawIdentifier: unknown): ExplorerSignInFlowCompletion;
  send(): Promise<ExplorerSignInFlowCompletion>;
  resend(): Promise<ExplorerSignInFlowCompletion>;
  verify(rawCode: unknown): Promise<ExplorerSignInFlowCompletion>;
  useDifferentEmail(): ExplorerSignInFlowCompletion;
  dispose(): ExplorerSignInFlowCompletion;
}>;

type Operation = Readonly<{
  generation: object;
  action: ExplorerSignInFlowAction;
  controller: AbortController;
}>;

// No timeout default, normalization, UI policy, or ambient network function.
export function createExplorerSignInFlowController(options: Readonly<{
  fetcher: ExplorerSignInBrowserFetch;
  responseBudgetMilliseconds: number;
  createFlowId: () => string;
}>): ExplorerSignInFlowController | null {
  const preparedTransport = createExplorerSignInBrowserTransport(options);
  if (preparedTransport === null) return null;
  const transport = preparedTransport;
  let candidatePort: unknown;
  try { candidatePort = options.createFlowId; } catch { return null; }
  if (typeof candidatePort !== "function") return null;
  const createFlowId = candidatePort as () => string;

  let generation: object = {};
  let active: Operation | null = null;
  let stage: ExplorerSignInFlowStage = "email";
  let identifier = "";
  let flowId: string | null = null;
  let outcome: ExplorerSignInFlowOutcome | null = null;

  function read(): ExplorerSignInFlowProjection {
    return Object.freeze({
      stage, identifier, pending: active?.action ?? null, outcome,
      hasSelector: stage === "code" && flowId !== null,
      destination: stage === "complete" ? EXPLORER_BROWSER_SIGN_IN_HOME : null,
    });
  }

  function current(operation: Operation): boolean {
    return stage !== "disposed" && generation === operation.generation && active === operation;
  }

  function reset(nextStage: "email" | "disposed", nextIdentifier: string): void {
    const previous = active;
    // Invalidate and publish the new local state before synchronous abort hooks.
    generation = {};
    active = null;
    flowId = null;
    outcome = null;
    identifier = nextIdentifier;
    stage = nextStage;
    try { previous?.controller.abort(); } catch { /* No underlying value escapes. */ }
  }

  async function start(action: ExplorerSignInFlowAction, rawCode?: string): Promise<ExplorerSignInFlowCompletion> {
    if (active !== null || stage === "disposed" || stage === "complete") return "ignored";
    if (action === "send" ? stage !== "email" : stage !== "code") return "ignored";
    if (action === "verify" && (flowId === null || rawCode === undefined)) return "ignored";

    const requestIdentifier = identifier;
    let operation: Operation;
    try {
      operation = { generation, action, controller: new AbortController() };
    } catch {
      outcome = "sign_in_browser_transport_failed";
      return "settled";
    }
    active = operation;
    outcome = null;

    try {
      if (action !== "verify" && flowId === null) {
        const generated = createFlowId();
        if (typeof generated !== "string" || generated.length !== 36 ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(generated) ||
            generated === "00000000-0000-0000-0000-000000000000") throw null;
        if (!current(operation)) return "ignored";
        flowId = generated;
      }
      const requestFlowId = flowId;
      // One public flow survives every resend; no actual challenge ID is stored.
      const result = action === "verify"
        ? await transport.verifyFlow({ identifier: requestIdentifier, flowId: requestFlowId, code: rawCode }, operation.controller.signal)
        : await transport.sendFlow({ identifier: requestIdentifier, flowId: requestFlowId }, operation.controller.signal);
      if (!current(operation)) return "ignored";
      if (!result.ok) {
        outcome = result.error;
      } else if ("acknowledgment" in result.value) {
        if (result.value.flowId !== requestFlowId) {
          outcome = "sign_in_browser_transport_failed";
        } else {
          stage = "code";
          outcome = result.value.acknowledgment;
        }
      } else {
        outcome = result.value.outcome;
        if (result.value.outcome === "signed_in") {
          flowId = null;
          identifier = "";
          stage = "complete";
        }
      }
      return "settled";
    } catch {
      if (!current(operation)) return "ignored";
      outcome = "sign_in_browser_transport_failed";
      return "settled";
    } finally {
      // An old completion must never clear a replacement operation's pending flag.
      if (current(operation)) active = null;
    }
  }

  return Object.freeze({
    read,
    setIdentifier(rawIdentifier: unknown): ExplorerSignInFlowCompletion {
      if (typeof rawIdentifier !== "string" || stage === "disposed" || stage === "complete" ||
          rawIdentifier === identifier) return "ignored";
      reset("email", rawIdentifier);
      return "settled";
    },
    send: () => start("send"),
    resend: () => start("resend"),
    verify: (rawCode: unknown): Promise<ExplorerSignInFlowCompletion> =>
      typeof rawCode === "string" ? start("verify", rawCode) : Promise.resolve("ignored"),
    useDifferentEmail(): ExplorerSignInFlowCompletion {
      if (stage === "disposed" || stage === "complete") return "ignored";
      reset("email", "");
      return "settled";
    },
    dispose(): ExplorerSignInFlowCompletion {
      if (stage === "disposed") return "ignored";
      reset("disposed", "");
      return "settled";
    },
  });
}
