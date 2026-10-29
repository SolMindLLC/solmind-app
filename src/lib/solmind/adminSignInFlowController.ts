// Admin flow; the view owns its code draft and uncontrolled password field.
// Aborting suppresses local publication, not remote redemption/cookie effects.
import { ADMIN_BROWSER_SIGN_IN_HOME } from "./passwordRoleSignInBrowserContract";
import {
  createAdminSignInBrowserTransport,
  type AdminSignInBrowserFetch,
  type AdminSignInBrowserTransportFailure,
} from "./adminSignInBrowserTransport";

export type AdminSignInFlowStage = "identifier" | "code" | "complete" | "disposed";
export type AdminSignInFlowAction = "send" | "resend" | "verify";
export type AdminSignInFlowOutcome =
  | "verification_code_requested"
  | "invalid_identifier"
  | "denied"
  | "not_matched"
  | "signed_in"
  | AdminSignInBrowserTransportFailure["error"];
export type AdminSignInFlowCompletion = "settled" | "ignored";
export type AdminSignInFlowProjection = Readonly<{
  stage: AdminSignInFlowStage;
  identifier: string;
  pending: AdminSignInFlowAction | null;
  outcome: AdminSignInFlowOutcome | null;
  hasSelector: boolean;
  destination: typeof ADMIN_BROWSER_SIGN_IN_HOME | null;
}>;
export type AdminSignInFlowController = Readonly<{
  read(): AdminSignInFlowProjection;
  setIdentifier(rawIdentifier: unknown): AdminSignInFlowCompletion;
  send(): Promise<AdminSignInFlowCompletion>;
  resend(): Promise<AdminSignInFlowCompletion>;
  verify(rawPassword: unknown, rawCode: unknown): Promise<AdminSignInFlowCompletion>;
  useDifferentIdentifier(): AdminSignInFlowCompletion;
  dispose(): AdminSignInFlowCompletion;
}>;

type Operation = Readonly<{
  generation: object;
  action: AdminSignInFlowAction;
  controller: AbortController;
}>;

// No timeout default, normalization, UI policy, or ambient network function.
export function createAdminSignInFlowController(options: Readonly<{
  fetcher: AdminSignInBrowserFetch;
  responseBudgetMilliseconds: number;
  createFlowId: () => string;
}>): AdminSignInFlowController | null {
  const preparedTransport = createAdminSignInBrowserTransport(options);
  if (preparedTransport === null) return null;
  const transport = preparedTransport;
  let candidatePort: unknown;
  try { candidatePort = options.createFlowId; } catch { return null; }
  if (typeof candidatePort !== "function") return null;
  const createFlowId = candidatePort as () => string;

  let generation: object = {};
  let active: Operation | null = null;
  let stage: AdminSignInFlowStage = "identifier";
  let identifier = "";
  let flowId: string | null = null;
  let outcome: AdminSignInFlowOutcome | null = null;

  function read(): AdminSignInFlowProjection {
    return Object.freeze({
      stage, identifier, pending: active?.action ?? null, outcome,
      hasSelector: stage === "code" && flowId !== null,
      destination: stage === "complete" ? ADMIN_BROWSER_SIGN_IN_HOME : null,
    });
  }

  function current(operation: Operation): boolean {
    return stage !== "disposed" && generation === operation.generation && active === operation;
  }

  function reset(nextStage: "identifier" | "disposed", nextIdentifier: string): void {
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

  async function start(action: AdminSignInFlowAction, rawPassword?: string, rawCode?: string): Promise<AdminSignInFlowCompletion> {
    if (active !== null || stage === "disposed" || stage === "complete") return "ignored";
    if (action === "send" ? stage !== "identifier" : stage !== "code") return "ignored";
    if (action === "verify" && (flowId === null || rawPassword === undefined || rawCode === undefined)) return "ignored";

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
        ? await transport.verifyFlow({ identifier: requestIdentifier, password: rawPassword, flowId: requestFlowId, code: rawCode }, operation.controller.signal)
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
    setIdentifier(rawIdentifier: unknown): AdminSignInFlowCompletion {
      if (typeof rawIdentifier !== "string" || stage === "disposed" || stage === "complete" ||
          rawIdentifier === identifier) return "ignored";
      reset("identifier", rawIdentifier);
      return "settled";
    },
    send: () => start("send"),
    resend: () => start("resend"),
    verify: (rawPassword: unknown, rawCode: unknown): Promise<AdminSignInFlowCompletion> =>
      typeof rawPassword === "string" && typeof rawCode === "string" ? start("verify", rawPassword, rawCode) : Promise.resolve("ignored"),
    useDifferentIdentifier(): AdminSignInFlowCompletion {
      if (stage === "disposed" || stage === "complete") return "ignored";
      reset("identifier", "");
      return "settled";
    },
    dispose(): AdminSignInFlowCompletion {
      if (stage === "disposed") return "ignored";
      reset("disposed", "");
      return "settled";
    },
  });
}
