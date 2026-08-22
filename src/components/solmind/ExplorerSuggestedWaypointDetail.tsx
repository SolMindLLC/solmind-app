"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type SuggestedWaypointCommandBrowserResult } from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
import {
  beginSuggestedWaypointCommandOperation,
  createIdleSuggestedWaypointCommandOperation,
  markSuggestedWaypointCommandTransportUncertain,
  replaceSuggestedWaypointCommandOperation,
  resolveSuggestedWaypointCommandOperation,
  retrySuggestedWaypointCommandOperation,
  settleSuggestedWaypointCommandByAuthoritativeRead,
  type SuggestedWaypointCommandOperationState,
} from "@/lib/solmind/suggestedWaypointCommandOperation";
import {
  createSuggestedWaypointExplorerAcknowledgeCommand,
  createSuggestedWaypointExplorerMarkReadCommand,
  submitSuggestedWaypointExplorerCommand,
  type SuggestedWaypointExplorerCommand,
} from "@/lib/solmind/suggestedWaypointExplorerCommandClient";
import {
  SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED,
  parseSuggestedWaypointExplorerDetailBrowserResult,
  type SuggestedWaypointExplorerDetail as Detail,
} from "@/lib/solmind/suggestedWaypointExplorerDetailBrowserContract";
import { formatSuggestedWaypointDate } from "@/lib/solmind/suggestedWaypointDisplayDate";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type ViewState = "loading" | "ready" | "denied" | "failed";
type LoadOutcome = "loading" | "ready" | "denied" | "failed" | "aborted";

function StatusPills({ detail }: { detail: Detail }) {
  return (
    <>
      <SuggestedWaypointStatusPill tone={detail.read ? "neutral" : "positive"}>
        {detail.read ? "✓ Read" : "● Unread"}
      </SuggestedWaypointStatusPill>
      {detail.receipt_acknowledged && detail.acknowledged_at !== null && (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ You acknowledged receipt {formatSuggestedWaypointDate(detail.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

function commandResultNotice(
  command: SuggestedWaypointExplorerCommand,
  result: SuggestedWaypointCommandBrowserResult,
): string {
  const action = command.kind === "explorer.mark_read"
    ? "Mark as read"
    : "Acknowledge receipt";
  if (result.ok) {
    return `${action} was accepted. Checking the current suggestion status.`;
  }
  if (result.outcome === null) {
    return result.error === "command_denied"
      ? "This action is unavailable. Nothing was changed."
      : "This action could not be completed. Nothing was changed.";
  }
  switch (result.outcome) {
    case "stale":
      return "This suggestion was updated. Review the current version before acknowledging receipt.";
    case "operation_conflict":
      return "A different request already used this operation. Checking the current suggestion status.";
    case "invalid_transition":
      return "The current suggestion state no longer allows this action.";
    case "relationship_unavailable":
      return "This action is unavailable. Nothing was changed.";
    default:
      return "This action could not be completed. Nothing was changed.";
  }
}

function requestedStateObserved(
  command: SuggestedWaypointExplorerCommand,
  current: Detail | null,
): boolean {
  return (
    current !== null &&
    current.suggested_waypoint_id === command.suggestedWaypointId &&
    current.current_version_id === command.versionId &&
    (command.kind === "explorer.mark_read"
      ? current.read
      : current.receipt_acknowledged)
  );
}

function completedNotice(command: SuggestedWaypointExplorerCommand): string {
  return command.kind === "explorer.mark_read"
    ? "Marked as read privately. Your Guide does not receive your read state."
    : "Receipt acknowledged. Your Guide can see only that receipt acknowledgement, not your reading or reaction.";
}

export function ExplorerSuggestedWaypointDetail({
  suggestedWaypointId,
}: Readonly<{ suggestedWaypointId: string }>) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [notice, setNotice] = useState("Loading suggestion detail.");
  const [actionNotice, setActionNotice] = useState("");
  const [readRetryAvailable, setReadRetryAvailable] = useState(false);
  const [commandSettling, setCommandSettling] = useState(false);
  const [commandStatusChecking, setCommandStatusChecking] = useState(false);
  const [activeCommandKind, setActiveCommandKind] = useState<
    SuggestedWaypointExplorerCommand["kind"] | null
  >(null);
  const [operation, setOperation] = useState<SuggestedWaypointCommandOperationState>(
    createIdleSuggestedWaypointCommandOperation,
  );
  const detailRef = useRef<Detail | null>(null);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const commandController = useRef<AbortController | null>(null);
  const commandRef = useRef<SuggestedWaypointExplorerCommand | null>(null);
  const settlingGenerationRef = useRef<number | null>(null);
  const statusCheckGenerationRef = useRef<number | null>(null);
  const operationRef = useRef(operation);
  const lastLoadOutcomeRef = useRef<LoadOutcome>("loading");
  const mountedRef = useRef(true);
  const initiatorButtonRef = useRef<HTMLButtonElement | null>(null);
  const markReadButtonRef = useRef<HTMLButtonElement | null>(null);
  const acknowledgeButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionStatusRef = useRef<HTMLParagraphElement | null>(null);

  const updateDetail = useCallback((next: Detail | null) => {
    detailRef.current = next;
    setDetail(next);
  }, []);

  const updateOperation = useCallback((next: SuggestedWaypointCommandOperationState) => {
    operationRef.current = next;
    setOperation(next);
  }, []);

  const focusActionStatus = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (mountedRef.current) {
        actionStatusRef.current?.focus();
      }
    });
  }, []);

  const load = useCallback(async (
    preserveSafeDetail = false,
  ): Promise<Detail | null> => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++requestSequence.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    lastLoadOutcomeRef.current = "loading";
    if (!preserveSafeDetail || detailRef.current === null) {
      setViewState("loading");
    }
    setNotice(
      preserveSafeDetail
        ? "Refreshing the current suggestion status."
        : "Loading suggestion detail.",
    );

    const fail = () => {
      lastLoadOutcomeRef.current = "failed";
      if (preserveSafeDetail && detailRef.current !== null) {
        setViewState("ready");
        setNotice("Current status could not be refreshed. The last loaded detail remains visible.");
      } else {
        updateDetail(null);
        setViewState("failed");
        setNotice("Suggestion detail could not be loaded.");
      }
      return null;
    };

    try {
      const response = await fetch(
        `/explorer/waypoints/${encodeURIComponent(suggestedWaypointId)}/detail`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Unexpected Waypoint Suggestion detail response status.");
      }
      const result = parseSuggestedWaypointExplorerDetailBrowserResult(
        await response.json(),
      );
      if (controller.signal.aborted || sequence !== requestSequence.current) {
        if (sequence === requestSequence.current) {
          lastLoadOutcomeRef.current = "aborted";
        }
        return null;
      }
      if (result === null) {
        return fail();
      }
      if (!result.ok) {
        if (result.error === SUGGESTED_WAYPOINT_EXPLORER_DETAIL_DENIED) {
          lastLoadOutcomeRef.current = "denied";
          updateDetail(null);
          setViewState("denied");
          setNotice("Suggestion detail is unavailable.");
          return null;
        }
        return fail();
      }

      lastLoadOutcomeRef.current = "ready";
      updateDetail(result.data);
      setViewState("ready");
      setNotice("Suggestion detail loaded privately.");
      return result.data;
    } catch {
      if (
        sequence !== requestSequence.current ||
        (controller.signal.aborted && !timedOut)
      ) {
        if (sequence === requestSequence.current) {
          lastLoadOutcomeRef.current = "aborted";
        }
        return null;
      }
      return fail();
    } finally {
      window.clearTimeout(timeout);
    }
  }, [suggestedWaypointId, updateDetail]);

  useEffect(() => {
    mountedRef.current = true;
    commandRef.current = null;
    const timer = window.setTimeout(() => {
      updateDetail(null);
      setActionNotice("");
      setReadRetryAvailable(false);
      setCommandSettling(false);
      setCommandStatusChecking(false);
      setActiveCommandKind(null);
      settlingGenerationRef.current = null;
      statusCheckGenerationRef.current = null;
      updateOperation(createIdleSuggestedWaypointCommandOperation());
      void load();
    }, 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      activeController.current?.abort();
      commandController.current?.abort();
    };
  }, [load, updateDetail, updateOperation]);

  useEffect(() => {
    if (operation.focusIntent === "initiator") {
      if (initiatorButtonRef.current?.disabled === false) {
        initiatorButtonRef.current.focus();
      } else {
        actionStatusRef.current?.focus();
      }
    } else if (operation.focusIntent === "updated_status") {
      actionStatusRef.current?.focus();
    }
  }, [operation]);

  const runCommand = useCallback(async (
    command: SuggestedWaypointExplorerCommand,
    nextOperation: SuggestedWaypointCommandOperationState,
  ) => {
    commandController.current?.abort();
    const controller = new AbortController();
    commandController.current = controller;
    const generation = nextOperation.generation;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const submission = await submitSuggestedWaypointExplorerCommand(
      command,
      controller.signal,
    );
    window.clearTimeout(timeout);
    if (!mountedRef.current || operationRef.current.generation !== generation) {
      return;
    }

    if (submission.kind === "transport_uncertain") {
      const currentOperation = operationRef.current;
      const uncertainOperation = markSuggestedWaypointCommandTransportUncertain(
        currentOperation,
        generation,
      );
      if (uncertainOperation === currentOperation) {
        return;
      }
      updateOperation(uncertainOperation);
      setReadRetryAvailable(false);
      setActionNotice(
        "SolMind could not confirm whether this action completed. Check current status before trying the action again.",
      );
      return;
    }

    const result = submission.result;
    const currentOperation = operationRef.current;
    const resolvedOperation = resolveSuggestedWaypointCommandOperation(
      currentOperation,
      generation,
      result.ok ? "success" : "expected_non_success",
    );
    if (resolvedOperation === currentOperation) {
      return;
    }
    settlingGenerationRef.current = generation;
    setCommandSettling(true);
    updateOperation(resolvedOperation);
    setActionNotice(commandResultNotice(command, result));
    if (!result.ok) {
      focusActionStatus();
    }

    const current = await load(true);
    if (
      !mountedRef.current ||
      operationRef.current.generation !== generation ||
      settlingGenerationRef.current !== generation
    ) {
      return;
    }
    settlingGenerationRef.current = null;
    setCommandSettling(false);
    if (current === null) {
      if (lastLoadOutcomeRef.current !== "denied") {
        setReadRetryAvailable(true);
        setActionNotice(
          result.ok
            ? "The action was accepted, but current status could not be refreshed. Refresh the status; do not submit the action again."
            : `${commandResultNotice(command, result)} Refresh the current status before another action.`,
        );
      }
      return;
    }

    if (!result.ok) {
      if (
        result.outcome === null &&
        requestedStateObserved(command, current)
      ) {
        setReadRetryAvailable(false);
        setActionNotice(completedNotice(command));
      } else if (result.outcome === "stale") {
        if (current.current_version_id !== command.versionId) {
          setReadRetryAvailable(false);
          setActionNotice(
            "This suggestion was updated. Review the current version before choosing an action.",
          );
        } else {
          setReadRetryAvailable(true);
          setActionNotice(
            "The suggestion changed, but the current version has not appeared yet. Refresh current status before choosing another action.",
          );
        }
      } else if (result.outcome === "operation_conflict") {
        setActionNotice(
          "A different request already used this operation. Current suggestion status was refreshed; review it before trying again.",
        );
      }
      return;
    }

    if (requestedStateObserved(command, current)) {
      setReadRetryAvailable(false);
      setActionNotice(completedNotice(command));
    } else if (current.current_version_id !== command.versionId) {
      setReadRetryAvailable(false);
      setActionNotice(
        "This suggestion was updated. Review the current version before choosing an action.",
      );
    } else {
      setReadRetryAvailable(true);
      setActionNotice(
        "The action was accepted, but the current state has not appeared yet. Refresh current status; do not submit the action again.",
      );
    }
  }, [focusActionStatus, load, updateOperation]);

  const startCommand = useCallback((
    kind: SuggestedWaypointExplorerCommand["kind"],
    initiator: HTMLButtonElement | null,
  ) => {
    const currentDetail = detailRef.current;
    if (
      currentDetail === null ||
      operationRef.current.busy ||
      operationRef.current.phase === "transport_uncertain" ||
      settlingGenerationRef.current !== null ||
      statusCheckGenerationRef.current !== null ||
      readRetryAvailable ||
      (kind === "explorer.mark_read" && currentDetail.read) ||
      (kind === "explorer.acknowledge" && currentDetail.receipt_acknowledged)
    ) {
      return;
    }

    const operationId = crypto.randomUUID();
    const commandInput = {
      operationId,
      suggestedWaypointId,
      versionId: currentDetail.current_version_id,
    };
    const command = kind === "explorer.mark_read"
      ? createSuggestedWaypointExplorerMarkReadCommand(commandInput)
      : createSuggestedWaypointExplorerAcknowledgeCommand(commandInput);
    if (command === null) {
      setActionNotice("This action could not be prepared. Nothing was changed.");
      return;
    }

    const currentOperation = operationRef.current;
    const next = currentOperation.phase === "idle"
      ? beginSuggestedWaypointCommandOperation(
          currentOperation,
          command.snapshot,
          () => operationId,
        )
      : replaceSuggestedWaypointCommandOperation(
          currentOperation,
          command.snapshot,
          () => operationId,
        );
    if (next === currentOperation) {
      setActionNotice("This action could not be started. Nothing was changed.");
      return;
    }

    initiatorButtonRef.current = initiator;
    commandRef.current = command;
    setActiveCommandKind(kind);
    setReadRetryAvailable(false);
    updateOperation(next);
    setActionNotice(
      kind === "explorer.mark_read"
        ? "Marking this suggestion as read privately."
        : "Sending a receipt acknowledgement. Your Guide will not receive your private reading or reaction.",
    );
    void runCommand(command, next);
  }, [readRetryAvailable, runCommand, suggestedWaypointId, updateOperation]);

  const retryCommand = useCallback(() => {
    const command = commandRef.current;
    if (command === null || statusCheckGenerationRef.current !== null) {
      return;
    }
    const current = operationRef.current;
    const next = retrySuggestedWaypointCommandOperation(current);
    if (next === current) {
      return;
    }
    updateOperation(next);
    setActionNotice("Trying this action again safely.");
    void runCommand(command, next);
  }, [runCommand, updateOperation]);

  const checkCommandStatus = useCallback(async () => {
    const command = commandRef.current;
    const currentOperation = operationRef.current;
    if (
      command === null ||
      currentOperation.phase !== "transport_uncertain" ||
      statusCheckGenerationRef.current !== null
    ) {
      return;
    }
    statusCheckGenerationRef.current = currentOperation.generation;
    setCommandStatusChecking(true);
    setActionNotice("Checking the authoritative suggestion status.");
    const current = await load(true);
    if (
      !mountedRef.current ||
      operationRef.current.generation !== currentOperation.generation ||
      operationRef.current.phase !== "transport_uncertain" ||
      statusCheckGenerationRef.current !== currentOperation.generation
    ) {
      return;
    }
    statusCheckGenerationRef.current = null;
    setCommandStatusChecking(false);
    if (requestedStateObserved(command, current)) {
      updateOperation(
        settleSuggestedWaypointCommandByAuthoritativeRead(
          operationRef.current,
          currentOperation.generation,
          true,
        ),
      );
      setActionNotice(completedNotice(command));
    } else if (current !== null && current.current_version_id !== command.versionId) {
      updateOperation(
        resolveSuggestedWaypointCommandOperation(
          operationRef.current,
          currentOperation.generation,
          "expected_non_success",
        ),
      );
      setActionNotice(
        "This suggestion was updated. Review the current version before choosing an action.",
      );
    } else if (lastLoadOutcomeRef.current === "denied") {
      updateOperation(
        resolveSuggestedWaypointCommandOperation(
          operationRef.current,
          currentOperation.generation,
          "expected_non_success",
        ),
      );
      setActionNotice("This action is unavailable. Do not retry it.");
    } else if (current === null) {
      setActionNotice(
        "Current status could not be confirmed. You can safely try the action again.",
      );
      focusActionStatus();
    } else {
      setActionNotice(
        "The change is not confirmed yet. You can safely try the action again.",
      );
      focusActionStatus();
    }
  }, [focusActionStatus, load, updateOperation]);

  const refreshCurrentStatus = useCallback(async () => {
    const current = await load(true);
    if (!mountedRef.current || current === null) {
      return;
    }
    setReadRetryAvailable(false);
    const command = commandRef.current;
    setActionNotice(
      command !== null && requestedStateObserved(command, current)
        ? completedNotice(command)
        : "Current suggestion status refreshed. Review it before choosing another action.",
    );
  }, [load]);

  const commandBlocked =
    operation.busy ||
    commandSettling ||
    operation.phase === "transport_uncertain" ||
    readRetryAvailable;
  const commandBusy = operation.busy || commandSettling;

  return (
    <div className="mt-6">
      <p className="text-sm text-slate-600" role="status" aria-live="polite">
        {notice}
      </p>

      {actionNotice !== "" && (
        <p
          ref={actionStatusRef}
          className="mt-3 rounded-xl border border-teal-300 bg-teal-50 p-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#227a7c]"
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          {actionNotice}
        </p>
      )}

      {operation.phase === "transport_uncertain" && (
        <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold">Action status needs checking</h2>
          <p className="mt-2 text-sm text-slate-700">
            Check current status first. If the change is not there, you can
            safely try the action again without creating a duplicate.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50"
              disabled={commandStatusChecking}
              aria-busy={commandStatusChecking}
              onClick={() => void checkCommandStatus()}
            >
              Check current status
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-700 bg-white px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100"
              disabled={commandStatusChecking}
              onClick={retryCommand}
            >
              Try action again
            </button>
          </div>
        </section>
      )}

      {readRetryAvailable && operation.phase !== "transport_uncertain" && (
        <section className="mt-4 rounded-xl border border-cyan-300 bg-cyan-50 p-5">
          <h2 className="text-lg font-semibold">Refresh the current status</h2>
          <p className="mt-2 text-sm text-slate-700">
            The command must not be submitted again. Reload only the authoritative detail.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50"
            onClick={() => void refreshCurrentStatus()}
          >
            Refresh current status
          </button>
        </section>
      )}

      {viewState === "loading" && (
        <div className="mt-5 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          Loading suggestion detail...
        </div>
      )}

      {viewState === "denied" && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-xl font-semibold">Suggestion unavailable</h2>
          <p className="mt-2 text-slate-700">
            This Explorer workspace cannot open that suggestion. Return to your inbox.
          </p>
        </div>
      )}

      {viewState === "failed" && (
        <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-5">
          <h2 className="text-xl font-semibold">Could not load suggestion</h2>
          <p className="mt-2 text-slate-700">Nothing was changed. Try loading the detail again.</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {viewState === "ready" && detail !== null && (
        <div className="grid gap-5">
          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1d6768]">
                  Received {formatSuggestedWaypointDate(detail.received_at)} as a suggestion, not an assignment.
                </p>
                <h1 className="mt-3 text-3xl font-semibold">{detail.destination}</h1>
              </div>
              <div className="flex flex-wrap gap-2 sm:max-w-md sm:justify-end">
                <StatusPills detail={detail} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">Why your Guide suggested this</h2>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">{detail.why}</p>
            <h2 className="mt-6 text-xl font-semibold">Possible arrival signals</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              {detail.arrival_signals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </section>

          <aside className="rounded-xl border border-indigo-300 bg-indigo-50 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <SuggestedWaypointStatusPill tone="private">◆ Private Explorer view</SuggestedWaypointStatusPill>
              <h2 className="text-xl font-semibold">You stay in control</h2>
            </div>
            <p className="mt-3 text-slate-700">
              Opening this page and reviewing its content stays private. Your
              Guide sees only a receipt acknowledgement you deliberately send.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <section className="rounded-xl border border-indigo-200 bg-white p-4">
                <h3 className="font-semibold">Private read state</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Marking this as read changes only your private Explorer organization state.
                </p>
                <button
                  ref={markReadButtonRef}
                  type="button"
                  className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={detail.read || commandBlocked}
                  aria-busy={commandBusy && activeCommandKind === "explorer.mark_read"}
                  onClick={() => startCommand("explorer.mark_read", markReadButtonRef.current)}
                >
                  {detail.read
                    ? "Marked as read"
                    : commandBusy && activeCommandKind === "explorer.mark_read"
                      ? "Marking as read..."
                      : "Mark as read"}
                </button>
              </section>

              <section className="rounded-xl border border-indigo-200 bg-white p-4">
                <h3 className="font-semibold">Shared receipt acknowledgement</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Your Guide will see that you acknowledged receipt, not your private reading or reaction.
                </p>
                <button
                  ref={acknowledgeButtonRef}
                  type="button"
                  className="mt-4 rounded-lg border border-[#227a7c] bg-white px-4 py-2 font-semibold text-[#1d6768] hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={detail.receipt_acknowledged || commandBlocked}
                  aria-busy={commandBusy && activeCommandKind === "explorer.acknowledge"}
                  onClick={() => startCommand("explorer.acknowledge", acknowledgeButtonRef.current)}
                >
                  {detail.receipt_acknowledged
                    ? "Receipt acknowledged"
                    : commandBusy && activeCommandKind === "explorer.acknowledge"
                      ? "Acknowledging receipt..."
                      : "Acknowledge receipt"}
                </button>
              </section>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              Private reflection with ◉ Mary, comparison with your Waypoints,
              and questions or responses remain separately reviewed next steps.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
