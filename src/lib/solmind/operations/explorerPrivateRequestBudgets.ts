import "server-only";
import { types } from "node:util";
import type { ExplorerPrivateConversationDependencies } from "../virtual-guide/explorerPrivateConversationComposition";

const FAILURE = "explorer_private_request_unavailable";
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController(); const deadlineAt = performance.now() + milliseconds;
  let rejectDeadline!: (reason: unknown) => void;
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  void deadline.catch(() => undefined);
  const timer = setTimeout(() => { controller.abort(); rejectDeadline(new Error(FAILURE)); }, milliseconds);
  try {
    const pending = operation(controller.signal);
    if (!types.isPromise(pending) || Object.getPrototypeOf(pending) !== Promise.prototype ||
      Object.getOwnPropertyDescriptor(pending, "then") !== undefined) throw new Error(FAILURE);
    const constructor = Object.getOwnPropertyDescriptor(pending, "constructor");
    if (constructor !== undefined && (!("value" in constructor) || constructor.value !== Promise)) throw new Error(FAILURE);
    const value = await Promise.race([pending, deadline]);
    if (performance.now() >= deadlineAt) throw new Error(FAILURE);
    return value;
  } catch { controller.abort(); throw new Error(FAILURE); }
  finally { clearTimeout(timer); }
}

/**
 * Finite local awaits for each request port. Underlying abort/rollback/drain is
 * not proven; unknown acknowledgments retain the controller's no-repost rule.
 * Real provider observation, rendering and failure signal retain their separate
 * existing60s/2s/1s owners. This does not sandbox synchronous injected code.
 */
export function withExplorerPrivateRequestBudgets(dependencies: ExplorerPrivateConversationDependencies): ExplorerPrivateConversationDependencies {
  const source = dependencies.repository;
  const repository = Object.freeze({
    read: (...args: Parameters<typeof source.read>) => bounded(() => source.read(...args), 10_000),
    ensure: (...args: Parameters<typeof source.ensure>) => bounded(() => source.ensure(...args), 10_000),
    observe: (...args: Parameters<typeof source.observe>) => bounded(() => source.observe(...args), 10_000),
    prepare: (...args: Parameters<typeof source.prepare>) => bounded(() => source.prepare(...args), 10_000),
    settle: (...args: Parameters<typeof source.settle>) => bounded(() => source.settle(...args), 10_000),
    ...(source.mutate === undefined ? {} : { mutate: (input: Parameters<NonNullable<typeof source.mutate>>[0]) => bounded(() => source.mutate!(input), 10_000) }),
    ...(source.arrange === undefined ? {} : { arrange: (input: Parameters<NonNullable<typeof source.arrange>>[0]) => bounded(() => source.arrange!(input), 10_000) }),
  });
  return Object.freeze({ authenticate: () => bounded(() => dependencies.authenticate(), 10_000), repository,
    ...(dependencies.resolveOperationalReadiness === undefined ? {} : {
      resolveOperationalReadiness: (...args: Parameters<NonNullable<typeof dependencies.resolveOperationalReadiness>>) =>
        bounded(() => dependencies.resolveOperationalReadiness!(...args), 15_000),
    }),
    ...(dependencies.buildContext === undefined ? {} : {
      buildContext: (input: Parameters<NonNullable<typeof dependencies.buildContext>>[0]) => bounded(signal =>
        dependencies.buildContext!({ ...input, signal: input.signal === undefined ? signal : AbortSignal.any([input.signal, signal]) }), 30_000),
    }),
    ...(dependencies.provider === undefined ? {} : { provider: dependencies.provider }),
    ...(dependencies.renderer === undefined ? {} : { renderer: dependencies.renderer }),
    ...(dependencies.operationalSignal === undefined ? {} : { operationalSignal: dependencies.operationalSignal }),
  });
}
