"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED,
  parseSuggestedWaypointGuideDetailBrowserResult,
  type SuggestedWaypointGuideDetail as Detail,
} from "@/lib/solmind/suggestedWaypointGuideDetailBrowserContract";
import {
  SUGGESTED_WAYPOINT_COMMAND_DENIED,
  SUGGESTED_WAYPOINT_COMMAND_FAILED,
  type SuggestedWaypointCommandBrowserResult,
} from "@/lib/solmind/suggestedWaypointCommandBrowserContract";
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
import { formatSuggestedWaypointDateTime } from "@/lib/solmind/suggestedWaypointDisplayDate";
import {
  createSuggestedWaypointGuidePullBackCommand,
  submitSuggestedWaypointGuidePullBackCommand,
  type SuggestedWaypointGuidePullBackCommand,
} from "@/lib/solmind/suggestedWaypointGuideCommandClient";
import {
  getSuggestedWaypointPullBackCountdown,
  type SuggestedWaypointPullBackCountdown,
} from "@/lib/solmind/suggestedWaypointPullBackCountdown";
import { SuggestedWaypointStatusPill } from "./SuggestedWaypointStatusPill";

type ViewState = "loading" | "ready" | "denied" | "failed";
type LoadOutcome = ViewState | "aborted";

function commandResultNotice(result: SuggestedWaypointCommandBrowserResult): string {
  if (result.ok) {
    return "Pull Back was accepted. Refreshing the authoritative suggestion detail.";
  }
  if (result.error === SUGGESTED_WAYPOINT_COMMAND_DENIED) {
    return "Pull Back is unavailable in the current Guide workspace.";
  }
  if (result.error === SUGGESTED_WAYPOINT_COMMAND_FAILED) {
    return "Pull Back could not be completed. Checking the current suggestion detail.";
  }
  switch (result.outcome) {
    case "too_late":
      return "The Pull Back period ended before the command reached the server.";
    case "stale":
      return "The suggestion changed before Pull Back completed. Checking the current detail.";
    case "invalid_transition":
      return "Pull Back no longer applies to the current suggestion state.";
    case "relationship_unavailable":
      return "Pull Back is unavailable in the current Guide workspace.";
    case "operation_conflict":
      return "A different request already used this operation. Checking the current detail.";
    case "policy_unavailable":
      return "Pull Back could not be evaluated under the current policy.";
  }
  return "Pull Back could not be confirmed. Checking the current suggestion detail.";
}

function StatusPills({ detail }: { detail: Detail }) {
  if (detail.authoring_mode === "draft") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="private">✎ Draft</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone="private">🔒 Guide-only</SuggestedWaypointStatusPill>
      </>
    );
  }
  if (detail.authoring_mode === "pending") {
    return (
      <>
        <SuggestedWaypointStatusPill tone="attention">⌛ Pending send</SuggestedWaypointStatusPill>
        <SuggestedWaypointStatusPill tone={detail.pull_back_available ? "attention" : "neutral"}>
          {detail.pull_back_available ? "↩ Pull Back available" : "○ Pull Back period ended"}
        </SuggestedWaypointStatusPill>
      </>
    );
  }
  return (
    <>
      <SuggestedWaypointStatusPill tone="positive">✉ Open suggestion</SuggestedWaypointStatusPill>
      {detail.acknowledged_at === null ? (
        <SuggestedWaypointStatusPill tone="neutral">○ No response</SuggestedWaypointStatusPill>
      ) : (
        <SuggestedWaypointStatusPill tone="positive">
          ☑ Receipt acknowledged {formatSuggestedWaypointDateTime(detail.acknowledged_at)}
        </SuggestedWaypointStatusPill>
      )}
    </>
  );
}

function ContentCard({
  title,
  destination,
  why,
  arrivalSignals,
  tone,
}: Readonly<{
  title: string;
  destination: string;
  why: string;
  arrivalSignals: readonly string[];
  tone: "private" | "delivered";
}>) {
  return (
    <section
      className={`rounded-2xl border p-6 ${
        tone === "private"
          ? "border-violet-700/70 bg-violet-950/25"
          : "border-cyan-700/70 bg-cyan-950/25"
      }`}
      aria-labelledby={`${tone}-content-title`}
    >
      <h2 id={`${tone}-content-title`} className="text-xl font-semibold">{title}</h2>
      <dl className="mt-5 grid gap-5">
        <div>
          <dt className="text-sm font-semibold text-slate-400">Possible Waypoint destination</dt>
          <dd className="mt-1 text-lg text-slate-100">{destination}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Why this may help</dt>
          <dd className="mt-1 whitespace-pre-wrap text-slate-200">{why}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Possible arrival signals</dt>
          <dd className="mt-2">
            <ul className="list-disc space-y-1 pl-5 text-slate-200">
              {arrivalSignals.map((signal) => <li key={signal}>{signal}</li>)}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function GuideSuggestedWaypointDetail({
  relationshipId,
  suggestedWaypointId,
}: Readonly<{ relationshipId: string; suggestedWaypointId: string }>) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [notice, setNotice] = useState("Loading suggestion detail.");
  const [actionNotice, setActionNotice] = useState("");
  const [countdown, setCountdown] = useState<SuggestedWaypointPullBackCountdown | null>(null);
  const [operation, setOperation] = useState<SuggestedWaypointCommandOperationState>(
    createIdleSuggestedWaypointCommandOperation,
  );
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const commandController = useRef<AbortController | null>(null);
  const commandRef = useRef<SuggestedWaypointGuidePullBackCommand | null>(null);
  const operationRef = useRef(operation);
  const lastLoadOutcomeRef = useRef<LoadOutcome>("loading");
  const mountedRef = useRef(true);
  const pullBackButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionStatusRef = useRef<HTMLParagraphElement | null>(null);

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

  const load = useCallback(async (): Promise<Detail | null> => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++requestSequence.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15_000);
    setViewState("loading");
    lastLoadOutcomeRef.current = "loading";
    setNotice("Loading suggestion detail.");

    try {
      const response = await fetch(
        `/guide/waypoint-suggestions/${encodeURIComponent(relationshipId)}/${encodeURIComponent(suggestedWaypointId)}/detail`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error("Unexpected Suggested Waypoint detail response status.");
      }
      const result = parseSuggestedWaypointGuideDetailBrowserResult(
        await response.json(),
      );
      if (controller.signal.aborted || sequence !== requestSequence.current) {
        if (sequence === requestSequence.current) {
          lastLoadOutcomeRef.current = "aborted";
        }
        return null;
      }
      if (result === null) {
        lastLoadOutcomeRef.current = "failed";
        setDetail(null);
        setViewState("failed");
        setNotice("Suggestion detail could not be loaded.");
        return null;
      } else if (!result.ok) {
        lastLoadOutcomeRef.current =
          result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
            ? "denied"
            : "failed";
        setDetail(null);
        setViewState(
          result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
            ? "denied"
            : "failed",
        );
        setNotice(
          result.error === SUGGESTED_WAYPOINT_GUIDE_DETAIL_DENIED
            ? "Suggestion detail is unavailable."
            : "Suggestion detail could not be loaded.",
        );
        return null;
      } else {
        lastLoadOutcomeRef.current = "ready";
        setDetail(result.data);
        setViewState("ready");
        setNotice("Suggestion detail loaded.");
        return result.data;
      }
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
      lastLoadOutcomeRef.current = "failed";
      setDetail(null);
      setViewState("failed");
      setNotice("Suggestion detail could not be loaded.");
      return null;
    } finally {
      window.clearTimeout(timeout);
    }
  }, [relationshipId, suggestedWaypointId]);

  useEffect(() => {
    mountedRef.current = true;
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      activeController.current?.abort();
      commandController.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (detail?.authoring_mode !== "pending" || detail.pending_deadline_at === null) {
      const timer = window.setTimeout(() => setCountdown(null), 0);
      return () => window.clearTimeout(timer);
    }
    const update = () => {
      setCountdown(
        getSuggestedWaypointPullBackCountdown(
          detail.pending_deadline_at as string,
          Date.now(),
        ),
      );
    };
    const initialTimer = window.setTimeout(update, 0);
    const intervalTimer = window.setInterval(update, 1_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [detail]);

  useEffect(() => {
    if (operation.focusIntent === "initiator") {
      if (pullBackButtonRef.current?.disabled === false) {
        pullBackButtonRef.current.focus();
      } else {
        actionStatusRef.current?.focus();
      }
    } else if (operation.focusIntent === "updated_status") {
      actionStatusRef.current?.focus();
    }
  }, [operation]);

  const runCommand = useCallback(async (
    command: SuggestedWaypointGuidePullBackCommand,
    nextOperation: SuggestedWaypointCommandOperationState,
  ) => {
    commandController.current?.abort();
    const controller = new AbortController();
    commandController.current = controller;
    const generation = nextOperation.generation;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    const submission = await submitSuggestedWaypointGuidePullBackCommand(
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
      setActionNotice(
        "SolMind could not confirm whether Pull Back completed. Check current status before retrying the exact same request.",
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
    updateOperation(resolvedOperation);
    setActionNotice(commandResultNotice(result));
    if (!result.ok) {
      focusActionStatus();
    }

    const current = await load();
    if (!mountedRef.current) {
      return;
    }
    if (result.ok) {
      setActionNotice(
        current?.authoring_mode === "draft"
          ? "Pull Back completed. The Guide-only draft is ready to review and edit."
          : current === null
            ? "Pull Back was accepted, but current detail could not be refreshed. Load the detail again; do not submit Pull Back again."
            : "Pull Back was accepted. Refresh the detail again if the current state has not appeared yet.",
      );
    }
  }, [focusActionStatus, load, updateOperation]);

  const startPullBack = useCallback(() => {
    if (
      detail?.authoring_mode !== "pending" ||
      detail.pending_version_id === null ||
      !detail.pull_back_available ||
      operationRef.current.busy ||
      operationRef.current.phase === "transport_uncertain"
    ) {
      return;
    }
    const operationId = crypto.randomUUID();
    const command = createSuggestedWaypointGuidePullBackCommand({
      expectedPendingVersionId: detail.pending_version_id,
      expectedRevision: detail.authoring_revision,
      operationId,
      relationshipId,
      suggestedWaypointId,
    });
    if (command === null) {
      setActionNotice("Pull Back could not be prepared. Nothing was changed.");
      return;
    }

    const current = operationRef.current;
    const next = current.phase === "idle"
      ? beginSuggestedWaypointCommandOperation(current, command.snapshot, () => operationId)
      : replaceSuggestedWaypointCommandOperation(current, command.snapshot, () => operationId);
    if (next === current) {
      setActionNotice("Pull Back could not be started. Nothing was changed.");
      return;
    }
    commandRef.current = command;
    updateOperation(next);
    setActionNotice("Submitting Pull Back. Explorer visibility remains controlled by the server.");
    void runCommand(command, next);
  }, [detail, relationshipId, runCommand, suggestedWaypointId, updateOperation]);

  const retryPullBack = useCallback(() => {
    const command = commandRef.current;
    if (command === null) {
      return;
    }
    const current = operationRef.current;
    const next = retrySuggestedWaypointCommandOperation(current);
    if (next === current) {
      return;
    }
    updateOperation(next);
    setActionNotice("Retrying the exact same Pull Back request.");
    focusActionStatus();
    void runCommand(command, next);
  }, [focusActionStatus, runCommand, updateOperation]);

  const checkPullBackStatus = useCallback(async () => {
    const currentOperation = operationRef.current;
    if (currentOperation.phase !== "transport_uncertain") {
      return;
    }
    setActionNotice("Checking the authoritative suggestion detail.");
    const current = await load();
    if (!mountedRef.current) {
      return;
    }
    if (current?.authoring_mode === "draft") {
      updateOperation(
        settleSuggestedWaypointCommandByAuthoritativeRead(
          operationRef.current,
          currentOperation.generation,
          true,
        ),
      );
      setActionNotice(
        "Pull Back completed. The Guide-only draft is ready to review and edit.",
      );
    } else if (current?.authoring_mode === "pending") {
      setActionNotice(
        "The suggestion is still pending. You may retry the exact same Pull Back request.",
      );
    } else if (lastLoadOutcomeRef.current === "denied") {
      updateOperation(
        resolveSuggestedWaypointCommandOperation(
          operationRef.current,
          currentOperation.generation,
          "expected_non_success",
        ),
      );
      setActionNotice(
        "The current Guide workspace cannot confirm this suggestion. Do not retry Pull Back.",
      );
    } else if (current === null) {
      setActionNotice(
        "Current status could not be confirmed. Retry only the exact same Pull Back request.",
      );
    } else {
      updateOperation(
        resolveSuggestedWaypointCommandOperation(
          operationRef.current,
          currentOperation.generation,
          "expected_non_success",
        ),
      );
      setActionNotice("Pull Back no longer applies to the current suggestion state.");
    }
  }, [load, updateOperation]);

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-300" role="status" aria-live="polite">
        {notice}
      </p>

      {actionNotice !== "" && (
        <p
          ref={actionStatusRef}
          className="mt-3 rounded-xl border border-cyan-800/70 bg-cyan-950/25 p-3 text-sm text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          {actionNotice}
        </p>
      )}

      {operation.phase === "transport_uncertain" && (
        <section
          className="mt-4 rounded-2xl border border-cyan-700/70 bg-cyan-950/25 p-5"
          aria-labelledby="pull-back-recovery-title"
        >
          <h2 id="pull-back-recovery-title" className="text-lg font-semibold">
            Pull Back status needs confirmation
          </h2>
          <p className="mt-2 text-sm text-cyan-100">
            Check the authoritative suggestion first. If it is still pending,
            retry only the exact same request; SolMind retains its original
            operation identity and request bytes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-100 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              onClick={() => void checkPullBackStatus()}
            >
              Check current status
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-500 px-4 py-2 font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              onClick={retryPullBack}
            >
              Retry same request
            </button>
          </div>
        </section>
      )}

      {viewState === "loading" && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950 p-6">
          Loading suggestion detail...
        </div>
      )}

      {viewState === "denied" && (
        <div className="mt-6 rounded-2xl border border-amber-700/70 bg-amber-950/30 p-6">
          <h2 className="text-xl font-semibold">Suggestion unavailable</h2>
          <p className="mt-2 text-slate-300">
            This Guide workspace cannot open that suggestion through the active
            Explorer relationship. Return to the suggestion list.
          </p>
        </div>
      )}

      {viewState === "failed" && (
        <div className="mt-6 rounded-2xl border border-rose-700/70 bg-rose-950/30 p-6">
          <h2 className="text-xl font-semibold">Could not load suggestion</h2>
          <p className="mt-2 text-slate-300">Nothing was changed. Try loading the detail again.</p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-cyan-400 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {viewState === "ready" && detail !== null && (
        <div className="grid gap-5">
          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-slate-400">Suggestion overview</p>
                <h2 className="mt-2 text-2xl font-semibold">{detail.destination_preview}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Authoring revision {detail.authoring_revision}
                  {detail.delivered_at === null
                    ? ""
                    : ` · Sent ${formatSuggestedWaypointDateTime(detail.delivered_at)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                <StatusPills detail={detail} />
              </div>
            </div>
          </section>

          {detail.draft_or_pending_destination !== null &&
            detail.draft_or_pending_why !== null &&
            detail.draft_or_pending_arrival_signals !== null && (
              <ContentCard
                title={detail.authoring_mode === "pending" ? "Pending version" : "Guide-only draft"}
                destination={detail.draft_or_pending_destination}
                why={detail.draft_or_pending_why}
                arrivalSignals={detail.draft_or_pending_arrival_signals}
                tone="private"
              />
            )}

          {detail.delivered_destination !== null &&
            detail.delivered_why !== null &&
            detail.delivered_arrival_signals !== null && (
              <ContentCard
                title={detail.authoring_mode === "delivered" ? "Version sent to Explorer" : "Last version sent to Explorer"}
                destination={detail.delivered_destination}
                why={detail.delivered_why}
                arrivalSignals={detail.delivered_arrival_signals}
                tone="delivered"
              />
            )}

          {detail.authoring_mode === "pending" &&
            detail.pending_deadline_at !== null &&
            detail.effective_seconds !== null && (
              <section className="rounded-2xl border border-amber-700/70 bg-amber-950/25 p-6">
                <h2 className="text-xl font-semibold">Pending-send window</h2>
                <p className="mt-2 text-slate-200">
                  Explorer visibility is scheduled after {formatSuggestedWaypointDateTime(detail.pending_deadline_at)}.
                  The applied grace setting is {detail.effective_seconds} seconds.
                </p>
                {countdown !== null && (
                  <p className="mt-2 text-sm font-semibold text-amber-100" role="timer" aria-live="off">
                    {countdown.label}
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-400">
                  The countdown is a browser estimate only. The server decides whether Pull Back is still available.
                </p>

                {detail.pull_back_available ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      ref={pullBackButtonRef}
                      type="button"
                      className="rounded-xl border border-amber-400 bg-amber-950 px-4 py-2 font-semibold text-amber-100 hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                      disabled={operation.busy || operation.phase === "transport_uncertain"}
                      aria-describedby="pull-back-explanation"
                      onClick={startPullBack}
                    >
                      {operation.busy ? "Pulling Back..." : "Pull Back"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-5 font-semibold text-amber-100">
                    Pull Back is not available for the current authoritative detail.
                  </p>
                )}
                <p id="pull-back-explanation" className="mt-3 text-sm text-slate-300">
                  Pull Back returns the pending version to the Guide-only draft state. It does not delete the suggestion.
                </p>
              </section>
            )}

          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-6">
            <h2 className="text-xl font-semibold">Privacy boundary</h2>
            <p className="mt-2 text-slate-300">
              Explorer-private open and read activity is not shown here. The
              Guide sees only an explicit receipt acknowledgement and its date,
              when the Explorer chooses to send one.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
