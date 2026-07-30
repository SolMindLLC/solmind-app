"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useMemo,
  useState,
} from "react";

import {
  buildDirectionsTakenSummary,
  buildExactSummaryReview,
  confirmInitialPriority,
  confirmWaypoint,
  createDefaultSummarySelection,
  createDiscoveryCompass,
  createEmptyStructuredFormAnswers,
  createNonLiveGuideProjection,
  createSharedSnapshot,
  createSummaryDraft,
  createWaypointProposal,
  moveCurrentAttention,
  proposePriorityChange,
  resolvePriorityChange,
  revealCompassPoints,
  setDetailIncluded,
  setMainPointIncluded,
  type DirectionsTakenSummary,
  type ExactSummaryReview,
  type ExplorerStructuredFormAnswers,
  type SessionCompassState,
  type SharedSnapshot,
  type SummaryDraft,
  type SummarySelection,
  type WaypointProposal,
} from "@/lib/solmind/explorerExperience";
import {
  SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS,
  type SolMindStructuredFormFieldKey,
} from "@/lib/solmind/onboarding";

import { SessionCompass } from "./SessionCompass";

type ExplorerExperienceStage =
  | "structuredForm"
  | "firstCompassOffer"
  | "compass"
  | "waypoint"
  | "summarySelection"
  | "finalReview"
  | "shared"
  | "privateDraft"
  | "skipped";

type PrototypeMessage = {
  id: string;
  role: "virtualGuide" | "explorer";
  body: string;
};

const STEP_LABELS: Record<ExplorerExperienceStage, string> = {
  structuredForm: "Structured onboarding",
  firstCompassOffer: "First Compass offer",
  compass: "Session Compass",
  waypoint: "Private Waypoint",
  summarySelection: "Summary choices",
  finalReview: "Exact final review",
  shared: "Shared Snapshot preview",
  privateDraft: "Private draft preview",
  skipped: "First Compass skipped",
};

const FIELD_LABELS = new Map(
  SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.map((field) => [
    field.key,
    field.label,
  ]),
);

function getStageProgress(stage: ExplorerExperienceStage): string {
  const order: ExplorerExperienceStage[] = [
    "structuredForm",
    "firstCompassOffer",
    "compass",
    "waypoint",
    "summarySelection",
    "finalReview",
  ];
  const index = order.indexOf(stage);

  if (index === -1) {
    return "Prototype outcome";
  }

  return `Step ${index + 1} of ${order.length}`;
}

function PrototypeDisclosure() {
  return (
    <div className="rounded-3xl border border-cyan-400/40 bg-cyan-400/10 p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">
        Early guided prototype
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-200">
        This experience uses a fixed local script. No live AI model or human
        Guide is responding. Nothing is sent or saved, and refreshing the page
        clears this prototype. SolMind is not a therapist or crisis service.
      </p>
    </div>
  );
}

type SubmittedAnswersProps = {
  answers: ExplorerStructuredFormAnswers;
  title?: string;
};

function SubmittedAnswers({
  answers,
  title = "Submitted onboarding answers",
}: SubmittedAnswersProps) {
  const visibleAnswers = (
    Object.entries(answers) as [SolMindStructuredFormFieldKey, string][]
  ).filter(([, value]) => value.trim().length > 0);

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/50 p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <dl className="mt-4 space-y-4">
        {visibleAnswers.map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm font-medium text-cyan-200">
              {FIELD_LABELS.get(key)}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type MockGuideResultProps = {
  answers: ExplorerStructuredFormAnswers;
  snapshot: SharedSnapshot | null;
};

function MockGuideResult({ answers, snapshot }: MockGuideResultProps) {
  const projection = useMemo(
    () => createNonLiveGuideProjection(answers, snapshot),
    [answers, snapshot],
  );

  return (
    <section
      aria-labelledby="mock-guide-result-title"
      className="rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
        Explicitly non-live Guide boundary preview
      </p>
      <h2 id="mock-guide-result-title" className="mt-2 text-2xl font-semibold">
        What a Guide-facing result may contain
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-200">
        This is a local proof of the visibility boundary, not a working Guide
        dashboard. It receives a narrow projection, never the conversation,
        Route, private Waypoint, draft, or excluded details.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-300/30 bg-slate-950/50 p-4">
          <h3 className="font-semibold">Submitted onboarding</h3>
          <ul className="mt-3 space-y-3 text-sm text-slate-200">
            {projection.onboardingAnswers.map((answer) => (
              <li key={answer.key}>
                <span className="font-medium text-emerald-200">
                  {FIELD_LABELS.get(answer.key)}
                </span>
                <span className="mt-1 block whitespace-pre-wrap">
                  {answer.value}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-emerald-300/30 bg-slate-950/50 p-4">
          <h3 className="font-semibold">Explorer-confirmed Shared Snapshot</h3>
          {projection.sharedSnapshot ? (
            <div className="mt-3 space-y-4">
              {projection.sharedSnapshot.mainPoints.map((mainPoint) => (
                <div key={mainPoint.id}>
                  <p className="font-medium text-emerald-200">
                    {mainPoint.title}
                  </p>
                  {mainPoint.details.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                      {mainPoint.details.map((detail) => (
                        <li key={detail.id}>{detail.text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">
                      No details were included.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              No conversation artifact is visible. The Explorer did not
              confirm a Shared Snapshot.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

export function ExplorerExperiencePrototype() {
  const [stage, setStage] =
    useState<ExplorerExperienceStage>("structuredForm");
  const [answers, setAnswers] = useState(createEmptyStructuredFormAnswers);
  const [submittedAnswers, setSubmittedAnswers] =
    useState<ExplorerStructuredFormAnswers | null>(null);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<SolMindStructuredFormFieldKey, string>>
  >({});
  const [compass, setCompass] = useState<SessionCompassState>(
    createDiscoveryCompass,
  );
  const [messages, setMessages] = useState<PrototypeMessage[]>([
    {
      id: "prototype-welcome",
      role: "virtualGuide",
      body: "Welcome. We can begin without deciding what matters most. Discovery is a valid direction.",
    },
  ]);
  const [composerValue, setComposerValue] = useState("");
  const [directions, setDirections] =
    useState<DirectionsTakenSummary | null>(null);
  const [waypoint, setWaypoint] = useState<WaypointProposal | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft | null>(null);
  const [summarySelection, setSummarySelection] =
    useState<SummarySelection>({});
  const [exactReview, setExactReview] = useState<ExactSummaryReview | null>(
    null,
  );
  const [sharedSnapshot, setSharedSnapshot] =
    useState<SharedSnapshot | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Structured onboarding form ready.",
  );

  const currentPriority = compass.points.find(
    (point) => point.id === compass.priorityPointId,
  );
  const pendingPriority = compass.points.find(
    (point) => point.id === compass.pendingPriorityPointId,
  );
  const selectedMainPointCount =
    exactReview?.mainPoints.length ??
    (summaryDraft
      ? summaryDraft.mainPoints.filter(
          (mainPoint) => summarySelection[mainPoint.id],
        ).length
      : 0);

  function updateAnswer(
    key: SolMindStructuredFormFieldKey,
    value: string,
  ) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  }

  function handleStructuredFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Partial<
      Record<SolMindStructuredFormFieldKey, string>
    > = {};

    for (const field of SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS) {
      if (field.required && !answers[field.key].trim()) {
        nextErrors[field.key] = "This required question needs an answer.";
      }
    }

    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      setAnnouncement("The structured form needs the required answers.");
      window.requestAnimationFrame(() => {
        document.getElementById("structured-form-errors")?.focus();
      });
      return;
    }

    setSubmittedAnswers({ ...answers });
    setStage("firstCompassOffer");
    setAnnouncement(
      "Structured onboarding submitted in memory. First Compass is optional.",
    );
  }

  function startFirstCompass() {
    setCompass(createDiscoveryCompass());
    setStage("compass");
    setAnnouncement(
      "First Compass started in Discovery mode with no confirmed Priority.",
    );
  }

  function skipFirstCompass() {
    setStage("skipped");
    setAnnouncement(
      "First Compass skipped. The submitted onboarding record remains separate.",
    );
  }

  function revealPaths() {
    if (!submittedAnswers) {
      return;
    }

    setCompass((current) => revealCompassPoints(current, submittedAnswers));
    setMessages((current) => [
      ...current,
      {
        id: `prototype-guide-${current.length + 1}`,
        role: "virtualGuide",
        body: "I placed three tentative paths from your submitted answers. This is a fixed local mapping, not an AI interpretation. No Priority changed automatically.",
      },
    ]);
    setAnnouncement(
      "Tentative Compass paths appeared. No Priority was confirmed.",
    );
  }

  function chooseStartingPriority() {
    if (!submittedAnswers) {
      return;
    }

    const withPoints =
      compass.points.length > 0
        ? compass
        : revealCompassPoints(compass, submittedAnswers);
    const firstPoint = withPoints.points[0];

    if (!firstPoint) {
      return;
    }

    const next = confirmInitialPriority(withPoints, firstPoint.id);
    setCompass(next);
    setAnnouncement(`${firstPoint.label} is now the confirmed Priority.`);
  }

  function handlePrototypeMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerValue.trim();

    if (!body) {
      setAnnouncement("Type a response before adding it to the local preview.");
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `prototype-explorer-${current.length + 1}`,
        role: "explorer",
        body,
      },
    ]);
    setComposerValue("");

    if (!submittedAnswers) {
      return;
    }

    if (compass.points.length === 0) {
      const next = revealCompassPoints(compass, submittedAnswers);
      setCompass(next);
      setMessages((current) => [
        ...current,
        {
          id: `prototype-guide-${current.length + 1}`,
          role: "virtualGuide",
          body: "The local script added tentative paths from your form. They are suggestions, not facts, and no Priority was selected.",
        },
      ]);
      setAnnouncement(
        "Current attention moved to a tentative path. Priority remains unconfirmed.",
      );
      return;
    }

    const attentionTarget =
      compass.attentionPointId === compass.points[0]?.id
        ? compass.points[1]
        : compass.points[2] ?? compass.points[0];

    if (!attentionTarget) {
      return;
    }

    const withAttention = moveCurrentAttention(compass, attentionTarget.id);
    setCompass(withAttention);
    setMessages((current) => [
      ...current,
      {
        id: `prototype-guide-${current.length + 1}`,
        role: "virtualGuide",
        body: `The fixed script moved current attention to "${attentionTarget.label}". That is not a judgment, and it did not change your Priority.`,
      },
    ]);
    setAnnouncement(
      `Current attention moved to ${attentionTarget.label}. Priority did not change.`,
    );
  }

  function requestPriorityChange() {
    const target =
      compass.points.find((point) => point.id !== compass.priorityPointId) ??
      compass.points[0];

    if (!target) {
      return;
    }

    setCompass((current) => proposePriorityChange(current, target.id));
    setAnnouncement(
      `A change to ${target.label} was proposed. It is not confirmed.`,
    );
  }

  function answerPriorityChange(accept: boolean) {
    const label = pendingPriority?.label ?? "the proposed path";
    setCompass((current) => resolvePriorityChange(current, accept));
    setAnnouncement(
      accept
        ? `${label} is now the Explorer-confirmed Priority.`
        : `The proposed Priority change to ${label} was declined.`,
    );
  }

  function endCompass() {
    const nextDirections = buildDirectionsTakenSummary(compass);
    const nextWaypoint = createWaypointProposal(compass);
    setDirections(nextDirections);
    setWaypoint(nextWaypoint);
    setStage("waypoint");
    setAnnouncement(
      "Session Compass ended. The proposed private Waypoint is not confirmed.",
    );
  }

  function proceedFromWaypoint(confirm: boolean) {
    if (!submittedAnswers || !directions || !waypoint) {
      return;
    }

    const nextWaypoint = confirm ? confirmWaypoint(waypoint) : waypoint;
    const draft = createSummaryDraft(
      submittedAnswers,
      compass,
      directions,
      nextWaypoint,
    );
    setWaypoint(nextWaypoint);
    setSummaryDraft(draft);
    setSummarySelection(createDefaultSummarySelection(draft));
    setExactReview(null);
    setStage("summarySelection");
    setAnnouncement(
      confirm
        ? "Private Waypoint confirmed in memory. Summary selection is ready."
        : "Waypoint left unconfirmed. Summary selection is ready.",
    );
  }

  function toggleMainPoint(mainPointId: string, included: boolean) {
    if (!summaryDraft) {
      return;
    }

    setSummarySelection((current) =>
      setMainPointIncluded(summaryDraft, current, mainPointId, included),
    );
    setExactReview(null);
    setAnnouncement(
      included
        ? "Main point included. Review its detail choices."
        : "Main point and its details excluded.",
    );
  }

  function toggleDetail(detailId: string, included: boolean) {
    setSummarySelection((current) =>
      setDetailIncluded(current, detailId, included),
    );
    setExactReview(null);
    setAnnouncement(included ? "Detail included." : "Detail excluded.");
  }

  function openExactFinalReview() {
    if (!summaryDraft) {
      return;
    }

    const review = buildExactSummaryReview(
      summaryDraft,
      summarySelection,
    );
    setExactReview(review);
    setStage("finalReview");
    setAnnouncement(
      "Fresh exact review created from the current selection. Nothing is shared yet.",
    );
  }

  function returnToSelection() {
    setExactReview(null);
    setStage("summarySelection");
    setAnnouncement(
      "Returned to summary choices. The prior final review is invalidated.",
    );
  }

  function confirmShare() {
    if (!exactReview || exactReview.mainPoints.length === 0) {
      return;
    }

    const snapshot = createSharedSnapshot(exactReview);
    setSharedSnapshot(snapshot);
    setStage("shared");
    setAnnouncement(
      "In-memory Shared Snapshot frozen for the non-live Guide boundary preview.",
    );
  }

  function chooseNotReadyToShare() {
    setSharedSnapshot(null);
    setStage("privateDraft");
    setAnnouncement(
      "Not ready to share selected. No conversation artifact is Guide-visible and no auto-send exists.",
    );
  }

  function resetPrototype() {
    setStage("structuredForm");
    setAnswers(createEmptyStructuredFormAnswers());
    setSubmittedAnswers(null);
    setFormErrors({});
    setCompass(createDiscoveryCompass());
    setMessages([
      {
        id: "prototype-welcome",
        role: "virtualGuide",
        body: "Welcome. We can begin without deciding what matters most. Discovery is a valid direction.",
      },
    ]);
    setComposerValue("");
    setDirections(null);
    setWaypoint(null);
    setSummaryDraft(null);
    setSummarySelection({});
    setExactReview(null);
    setSharedSnapshot(null);
    setAnnouncement("Prototype reset. No state was retained.");
  }

  return (
    <div className="space-y-6">
      <PrototypeDisclosure />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            {getStageProgress(stage)}
          </p>
          <p className="mt-1 font-semibold">{STEP_LABELS[stage]}</p>
        </div>
        <p className="text-sm text-slate-300">
          Preferred name on file:{" "}
          <span className="font-semibold text-slate-100">Explorer</span>
          <span className="block text-xs text-slate-400">
            Displayed only; this form does not ask for or store it again.
          </span>
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {stage === "structuredForm" ? (
        <form
          className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6"
          noValidate
          onSubmit={handleStructuredFormSubmit}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Structured onboarding
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            What would make this first experience useful?
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Every answer you submit below is visible to your Guide in the
            future live product. Optional answers can be left blank. This
            prototype keeps the answers only in browser memory and sends
            nothing.
          </p>

          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            <strong>Draft/TBD agreement copy:</strong> final legal wording is
            not part of this slice. The required AI, privacy, adult, Admin
            visibility, and crisis disclosures remain separate onboarding
            gates.
          </div>

          {Object.keys(formErrors).length ? (
            <div
              id="structured-form-errors"
              className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-400/10 p-4"
              role="alert"
              tabIndex={-1}
            >
              <p className="font-semibold text-rose-100">
                Please answer the required questions.
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-rose-100">
                {SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.filter(
                  (field) => formErrors[field.key],
                ).map((field) => (
                  <li key={field.key}>{field.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 space-y-6">
            {SOLMIND_EXPLORER_STRUCTURED_FORM_FIELDS.map((field) => {
              const inputId = `structured-form-${field.key}`;
              const errorId = `${inputId}-error`;
              const hintId = `${inputId}-hint`;
              const commonProps = {
                id: inputId,
                name: field.key,
                value: answers[field.key],
                onChange: (
                  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                ) => updateAnswer(field.key, event.target.value),
                "aria-describedby": `${hintId}${
                  formErrors[field.key] ? ` ${errorId}` : ""
                }`,
                "aria-invalid": Boolean(formErrors[field.key]),
                className:
                  "mt-2 w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-50 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30",
              };

              return (
                <div key={field.key}>
                  <label htmlFor={inputId} className="font-semibold">
                    {field.label}
                    <span className="ml-2 text-sm font-normal text-slate-400">
                      {field.required ? "Required" : "Optional"}
                    </span>
                  </label>
                  <p id={hintId} className="mt-1 text-sm text-slate-400">
                    {field.hint} If answered, this submitted field is
                    Guide-visible.
                  </p>
                  {field.inputKind === "textarea" ? (
                    <textarea {...commonProps} className={`${commonProps.className} min-h-28 resize-y`} />
                  ) : (
                    <input {...commonProps} type="text" />
                  )}
                  {formErrors[field.key] ? (
                    <p id={errorId} className="mt-2 text-sm text-rose-300">
                      {formErrors[field.key]}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            className="mt-7 rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
            type="submit"
          >
            Submit structured onboarding
          </button>
        </form>
      ) : null}

      {stage === "firstCompassOffer" && submittedAnswers ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <SubmittedAnswers answers={submittedAnswers} />
          <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Encouraged, never required
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Would you like to try a First Compass?
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              A First Compass is one bounded conversation. You can start in
              Discovery without choosing a Priority, or skip it now. Skipping
              does not undo your submitted onboarding form.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950"
                onClick={startFirstCompass}
                type="button"
              >
                Start First Compass
              </button>
              <button
                className="rounded-full border border-slate-600 px-6 py-3 font-semibold text-slate-100"
                onClick={skipFirstCompass}
                type="button"
              >
                Skip for now
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {stage === "compass" ? (
        <div className="space-y-6">
          <SessionCompass state={compass} />

          <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Fixed local conversation
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Conversation with SolMind Virtual Guide
                </h2>
              </div>
              <button
                className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold"
                onClick={endCompass}
                type="button"
              >
                End Session Compass
              </button>
            </div>

            <div className="mt-5 space-y-3" role="log">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={[
                    "max-w-3xl rounded-2xl p-4 text-sm leading-6",
                    message.role === "virtualGuide"
                      ? "bg-slate-800 text-slate-100"
                      : "ml-auto bg-cyan-300 text-slate-950",
                  ].join(" ")}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                    {message.role === "virtualGuide"
                      ? "Local prototype script"
                      : "Explorer"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>

            <form className="mt-5" onSubmit={handlePrototypeMessage}>
              <label htmlFor="prototype-response" className="font-semibold">
                Add a reflection to the local preview
              </label>
              <textarea
                id="prototype-response"
                className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-50 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                onChange={(event) => setComposerValue(event.target.value)}
                placeholder="Nothing entered here is saved or interpreted by a model."
                value={composerValue}
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950"
                  type="submit"
                >
                  Add to local conversation
                </button>
                {compass.points.length === 0 ? (
                  <button
                    className="rounded-full border border-slate-600 px-5 py-3 font-semibold"
                    onClick={revealPaths}
                    type="button"
                  >
                    Show tentative paths from my form
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
              <h3 className="font-semibold">Explorer-owned direction</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Current Priority:{" "}
                <span className="font-semibold text-slate-100">
                  {currentPriority?.label ?? "None - Discovery mode"}
                </span>
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {!currentPriority ? (
                  <button
                    className="rounded-full border border-amber-300/60 px-4 py-2 text-sm font-semibold text-amber-100"
                    onClick={chooseStartingPriority}
                    type="button"
                  >
                    Confirm my first answer as Priority
                  </button>
                ) : null}
                {compass.points.length > 1 &&
                !compass.pendingPriorityPointId ? (
                  <button
                    className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold"
                    onClick={requestPriorityChange}
                    type="button"
                  >
                    Explore a possible Priority change
                  </button>
                ) : null}
              </div>
            </div>

            {pendingPriority ? (
              <div className="mt-5 rounded-2xl border border-violet-400/50 bg-violet-400/10 p-4">
                <h3 className="font-semibold text-violet-100">
                  Proposed reorientation
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Would you like to make &ldquo;{pendingPriority.label}&rdquo;
                  the new Priority? Nothing changes until you confirm.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="rounded-full bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950"
                    onClick={() => answerPriorityChange(true)}
                    type="button"
                  >
                    Confirm new Priority
                  </button>
                  <button
                    className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold"
                    onClick={() => answerPriorityChange(false)}
                    type="button"
                  >
                    Keep current Priority
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {stage === "waypoint" && directions && waypoint ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Compass ending
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              {directions.heading}
            </h1>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-200">
              {directions.statements.map((statement) => (
                <li key={statement}>{statement}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-amber-300/40 bg-amber-300/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">
              Proposed private Waypoint
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              Does this feel worth keeping?
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-100">
              {waypoint.text}
            </p>
            <p className="mt-4 text-xs leading-5 text-amber-100">
              It is not confirmed or durable now. In this slice, confirmation
              changes browser-memory state only and remains Explorer-private.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-amber-300 px-5 py-3 font-semibold text-slate-950"
                onClick={() => proceedFromWaypoint(true)}
                type="button"
              >
                Confirm private Waypoint
              </button>
              <button
                className="rounded-full border border-slate-600 px-5 py-3 font-semibold"
                onClick={() => proceedFromWaypoint(false)}
                type="button"
              >
                Continue without confirming
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {stage === "summarySelection" && summaryDraft ? (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Explorer-controlled summary
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            Choose the exact items to review
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Each main point has one detail level. Excluding a main point also
            excludes its details. Nothing is shared from this screen.
          </p>

          <div className="mt-6 space-y-5">
            {summaryDraft.mainPoints.map((mainPoint) => {
              const mainIncluded = Boolean(summarySelection[mainPoint.id]);

              return (
                <fieldset
                  key={mainPoint.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5"
                >
                  <legend className="px-2 font-semibold">
                    {mainPoint.title}
                  </legend>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      checked={mainIncluded}
                      className="mt-1 h-5 w-5 rounded border-slate-500 bg-slate-950 text-cyan-300"
                      onChange={(event) =>
                        toggleMainPoint(mainPoint.id, event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      <span className="font-medium">
                        Include this main point
                      </span>
                      <span className="block text-sm text-slate-400">
                        Details can be included only when their main point is
                        included.
                      </span>
                    </span>
                  </label>

                  <div className="mt-4 space-y-3 border-l border-slate-700 pl-5">
                    {mainPoint.details.map((detail) => (
                      <label
                        key={detail.id}
                        className={[
                          "flex items-start gap-3",
                          mainIncluded
                            ? "cursor-pointer"
                            : "cursor-not-allowed opacity-50",
                        ].join(" ")}
                      >
                        <input
                          checked={
                            mainIncluded && Boolean(summarySelection[detail.id])
                          }
                          className="mt-1 h-5 w-5 rounded border-slate-500 bg-slate-950 text-cyan-300"
                          disabled={!mainIncluded}
                          onChange={(event) =>
                            toggleDetail(detail.id, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span className="text-sm leading-6">{detail.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950"
              onClick={openExactFinalReview}
              type="button"
            >
              Review exact selection
            </button>
            <button
              className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
              onClick={chooseNotReadyToShare}
              type="button"
            >
              Not ready to share
            </button>
          </div>
        </section>
      ) : null}

      {stage === "finalReview" && exactReview ? (
        <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Fresh exact final review
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            This is the complete selected snapshot
          </h1>
          <div className="mt-5 rounded-2xl border border-rose-300/40 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
            In the future live product, a confirmed Shared Snapshot cannot be
            pulled back or silently edited. In this prototype, confirmation
            freezes only the local preview and sends nothing.
          </div>

          {exactReview.mainPoints.length ? (
            <div className="mt-6 space-y-5">
              {exactReview.mainPoints.map((mainPoint) => (
                <section
                  key={mainPoint.id}
                  className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5"
                >
                  <h2 className="font-semibold">{mainPoint.title}</h2>
                  {mainPoint.details.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-200">
                      {mainPoint.details.map((detail) => (
                        <li key={detail.id}>{detail.text}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      No details included.
                    </p>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-700 p-5">
              <p className="font-semibold">Nothing selected</p>
              <p className="mt-2 text-sm text-slate-300">
                Sharing nothing is valid. Choose `Not ready to share` or return
                to the selection screen.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-emerald-300 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={selectedMainPointCount === 0}
              onClick={confirmShare}
              type="button"
            >
              Confirm Shared Snapshot preview
            </button>
            <button
              className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
              onClick={returnToSelection}
              type="button"
            >
              Change selections
            </button>
            <button
              className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
              onClick={chooseNotReadyToShare}
              type="button"
            >
              Not ready to share
            </button>
          </div>
        </section>
      ) : null}

      {stage === "shared" && submittedAnswers && sharedSnapshot ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
              In-memory outcome
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Shared Snapshot preview confirmed
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              The exact reviewed selection is frozen in browser memory for
              this preview. No person, provider, database, or service received
              it.
            </p>
          </section>
          <MockGuideResult
            answers={submittedAnswers}
            snapshot={sharedSnapshot}
          />
          <button
            className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
            onClick={resetPrototype}
            type="button"
          >
            Reset local prototype
          </button>
        </div>
      ) : null}

      {stage === "privateDraft" && submittedAnswers ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-violet-400/40 bg-violet-400/10 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
              Explorer-private in-memory outcome
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Not ready to share
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              The draft is not Guide-visible and never auto-sends. This S01
              prototype does not save it or implement the future configured
              sendability window; refreshing clears it.
            </p>
          </section>
          <MockGuideResult answers={submittedAnswers} snapshot={null} />
          <button
            className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
            onClick={resetPrototype}
            type="button"
          >
            Reset local prototype
          </button>
        </div>
      ) : null}

      {stage === "skipped" && submittedAnswers ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Valid onboarding outcome
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              First Compass skipped for now
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The submitted onboarding form remains distinct. No Starting
              Point, Priority, Waypoint, private draft, or Shared Snapshot was
              manufactured.
            </p>
          </section>
          <MockGuideResult answers={submittedAnswers} snapshot={null} />
          <button
            className="rounded-full border border-slate-600 px-6 py-3 font-semibold"
            onClick={resetPrototype}
            type="button"
          >
            Reset local prototype
          </button>
        </div>
      ) : null}
    </div>
  );
}
