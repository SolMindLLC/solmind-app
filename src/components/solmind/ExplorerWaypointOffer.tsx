import type { ExplorerConversationState } from "@/lib/solmind/explorerConversationContract";
import type { ExplorerConversationFormationIntent } from "@/lib/solmind/explorerConversationFormation";
import { COMPASS_SUGGESTION_REPLY_HOLDS } from "@/lib/solmind/explorerCompassSuggestionReplies";
import { WAYPOINT_DRAFT_WORDING as D } from "@/lib/solmind/explorerWaypointDraft";
import {
  WAYPOINT_OFFER_WORDING as W,
  waypointOfferButtons,
  waypointOfferDropLine,
  waypointOfferForMessage,
  waypointOfferLimitReason,
  waypointOfferParts,
  waypointOfferRefusalNotice,
  waypointOfferRightHeld,
  waypointOfferSavedLine,
  waypointOfferSnapshotLabel,
  waypointOfferStageLine,
  waypointOfferTargetChangedNotice,
} from "@/lib/solmind/explorerWaypointOffer";
import { focusByApp } from "./conversationAppFocus";
import { SECONDARY_BUTTON, joinClasses } from "./ExplorerConversationScreenNotYetImplemented";

const TAG_CLASS = "rounded-full border border-dashed border-amber-200/50 px-2.5 py-1 text-xs font-semibold text-amber-100";
const SMALL_TAG_CLASS = "text-xs font-semibold uppercase tracking-[0.14em] text-stone-400";
const WORDING_CLASS = "whitespace-pre-wrap [overflow-wrap:anywhere]";

// "Now" above "Proposed" on a narrow screen, side by side from the small breakpoint up. The first column reads
// "When offered" once it is no longer the Waypoint as it is now (decisions 2 and 3 of the 21:52:56 sheet).
function NowAndProposed({ now, proposed, nowLabel }: Readonly<{ now: string; proposed: string; nowLabel: string }>) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <span className={SMALL_TAG_CLASS}>{nowLabel}</span>
        <p className={WORDING_CLASS}>{now}</p>
      </div>
      <div>
        <span className={SMALL_TAG_CLASS}>{W.proposed}</span>
        <p className={WORDING_CLASS}>{proposed}</p>
      </div>
    </div>
  );
}

// A saved offer, within the list item of its latest carrying Virtual Guide reply, drawn from the state's
// waypointOffer alone: the offer's snapshot ("Now", or "When offered") and "Proposed" from its offered values, so a
// confirmed box still renders after a reload. The quiet line for an offer that could not be shown is drawn here too, under the
// latest reply. The parent owns every request: a button only hands over the respond_waypoint_offer intent.
export function ExplorerWaypointOffer({ state, messageId, held, followUpHeld, savingOfferId, onCommand }: Readonly<{
  state: ExplorerConversationState;
  messageId: string;
  held: boolean;
  followUpHeld: boolean;
  savingOfferId: string | null;
  onCommand: (intent: ExplorerConversationFormationIntent) => void;
}>) {
  const offer = waypointOfferForMessage(state, messageId);
  const dropLine = waypointOfferDropLine(state, messageId);
  if (offer === null) {
    return dropLine === null ? null
      : <p className="mt-3 text-sm leading-6 text-stone-300" data-waypoint-offer-drop="">{dropLine}</p>;
  }
  const availability = state.compassSuggestionReplies ?? "unavailable";
  const waiting = offer.status === "proposed";
  const reached = offer.kind === "reached";
  // While the offer waits the heading is the Waypoint's saved title (the sheet: "the Waypoint's title, with the
  // tag"); a proposed title shows only in the Now and Proposed pair below. Once confirmed it is the saved new title.
  const title = reached || waiting ? offer.targetBefore.title : offer.title;
  const titleId = `waypoint-offer-title-${offer.id}`;
  const headingId = `waypoint-offer-heading-${offer.id}`;
  const limitId = `waypoint-offer-limit-${offer.id}`;
  const refusalId = `waypoint-offer-refusal-${offer.id}`;
  const targetChangedId = `waypoint-offer-target-changed-${offer.id}`;
  const open = waiting && state.sessionStatus !== "ended" && availability === "available";
  const limitReason = open ? waypointOfferLimitReason(state, offer) : null;
  // The past-tense limit sentence invites a new choice, so it shows only while the buttons can be used.
  const refusalNotice = waypointOfferRefusalNotice(state, offer);
  const refusal = refusalNotice === W.typedLimitPassed && !open ? null : refusalNotice;
  const rightHeld = waypointOfferRightHeld(state, offer);
  const snapshotLabel = waypointOfferSnapshotLabel(offer);
  const stageLine = waypointOfferStageLine(offer, snapshotLabel);
  // Decisions 1 and 2 of the 21:52:56 sheet: once the Waypoint changed after the offer was shown, the reason takes
  // the place of the "why" sentence (or of nothing, when the refused-answer sentence S1 already says it), the "what a
  // yes does" sentence is hidden, and the invitation to write shows only while a message can be sent under the
  // composer's own checks (held, Virtual Guide unavailable, message capacity).
  const stale = waiting && !offer.targetCurrent;
  const targetChanged = waypointOfferTargetChangedNotice(state, offer);
  const discuss = stale && !held && !followUpHeld ? W.targetChangedDiscuss : null;
  const savedLine = waypointOfferSavedLine(offer);
  const saving = waiting && savingOfferId === offer.id;
  // Every sentence now shown that says why the yes button is off, in reading order. A further reason sentence is
  // added here with its id when it exists.
  const yesReasonIds = [
    limitReason === null ? null : limitId,
    refusal === W.typedTargetChanged ? refusalId : null,
    targetChanged === null ? null : targetChangedId,
  ].filter((reasonId): reasonId is string => reasonId !== null);
  const parts = waypointOfferParts(offer);
  // A revisit that changes no wording shows its three parts once; "No change" marks an unchanged part only beside
  // changed ones (always for a change offer, and for a revisit that also changes wording).
  const markUnchanged = offer.kind === "change" || parts.some(part => part.proposed !== null);
  return (
    <>
      <div aria-describedby={yesReasonIds.length === 0 ? undefined : yesReasonIds.join(" ")}
        aria-labelledby={reached && waiting ? `${headingId} ${titleId}` : titleId}
        className="mt-3 grid gap-3 rounded-2xl border border-dashed border-amber-200/50 bg-amber-300/[0.04] p-3"
        data-waypoint-offer={offer.kind} role="group">
        {reached ? (
          <>
            {waiting ? <h3 className="font-serif text-lg text-stone-50" id={headingId}>{W.reachedHeading}</h3> : null}
            {waiting ? <p className="text-sm leading-6 text-stone-300">{W.reachedWhy}</p> : null}
            {targetChanged === null ? null
              : <p className="text-sm leading-6 text-stone-300" data-waypoint-offer-target-changed="" id={targetChangedId}>{targetChanged}</p>}
            {discuss === null || targetChanged === null ? null : <p className="text-sm leading-6 text-stone-300">{discuss}</p>}
            <p className={joinClasses("font-serif text-lg text-stone-50", WORDING_CLASS)} id={titleId}>{title}</p>
            <dl className="grid gap-2 text-sm leading-6 text-stone-100">
              <div>
                <dt className="font-semibold text-amber-200">{D.arrivalSignal}</dt>
                <dd className={WORDING_CLASS}>{offer.targetBefore.arrivalSignal}</dd>
              </div>
              <div>
                <dt className="font-semibold text-amber-200">{W.reachedEvidence}</dt>
                <dd className={WORDING_CLASS}>{`"${offer.evidence}"`}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <h3 className={joinClasses("font-serif text-lg text-stone-50", WORDING_CLASS)} id={titleId}>{title}</h3>
              <span className={TAG_CLASS}>{offer.kind === "change" ? W.changeTag : W.revisitTag}</span>
            </div>
            {!waiting || stale ? null
              : <p className="text-sm leading-6 text-stone-300">{offer.kind === "change" ? W.changeWhy : W.revisitWhy}</p>}
            {targetChanged === null ? null
              : <p className="text-sm leading-6 text-stone-300" data-waypoint-offer-target-changed="" id={targetChangedId}>{targetChanged}</p>}
            {discuss === null || targetChanged === null ? null : <p className="text-sm leading-6 text-stone-300">{discuss}</p>}
            {offer.title === offer.targetBefore.title ? null : (
              <div className="grid gap-1 text-sm leading-6 text-stone-100" data-waypoint-offer-title-change="">
                <span className="font-semibold text-amber-200">{W.titleLabel}</span>
                <NowAndProposed now={offer.targetBefore.title} nowLabel={snapshotLabel} proposed={offer.title} />
              </div>
            )}
            {stageLine === null ? null : <p className="text-sm font-semibold leading-6 text-stone-100">{stageLine}</p>}
            <dl className="grid gap-2 text-sm leading-6 text-stone-100">
              {parts.map(part => (
                <div key={part.label}>
                  <dt className="font-semibold text-amber-200">{part.label}</dt>
                  <dd>
                    {part.proposed === null ? (
                      <>
                        <p className={WORDING_CLASS}>{part.now}</p>
                        {markUnchanged ? <span className={SMALL_TAG_CLASS}>{W.noChange}</span> : null}
                      </>
                    ) : <NowAndProposed now={part.now} nowLabel={snapshotLabel} proposed={part.proposed} />}
                  </dd>
                </div>
              ))}
            </dl>
            {waiting && !stale ? <p className="text-sm leading-6 text-stone-300">{offer.kind === "change" ? W.changeYes : W.revisitYes}</p> : null}
          </>
        )}
        {!waiting ? null : availability === "available" ? (
          <div className="flex flex-wrap gap-2">
            {waypointOfferButtons(offer).map(({ response, label }) => (
              <button
                aria-describedby={response === "right" && yesReasonIds.length > 0 ? yesReasonIds.join(" ") : undefined}
                className={joinClasses(SECONDARY_BUTTON, "disabled:cursor-not-allowed disabled:opacity-50")}
                disabled={held || state.pendingTurn || (response === "right" ? rightHeld : !reached && followUpHeld)}
                key={response}
                onClick={(event) => {
                  onCommand({ kind: "respond_waypoint_offer", offerId: offer.id, response });
                  // A confirmed or declined answer can remove this button, so focus goes to the reply. Without
                  // preventScroll the browser would move the page to bring a tall reply into view (step 4 item 9:
                  // the page must not move on a command).
                  focusByApp(event.currentTarget.closest("li"), { preventScroll: true });
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : state.sessionStatus === "ended" ? null : (
          <p className="text-sm leading-6 text-stone-300">{COMPASS_SUGGESTION_REPLY_HOLDS[availability]}</p>
        )}
        {limitReason === null ? null : (
          <p aria-live="polite" className="text-sm leading-6 text-stone-300" id={limitId} role="status" tabIndex={0}>
            {limitReason}
          </p>
        )}
        {refusal === null ? null : (
          <p className="text-sm leading-6 text-stone-300" data-waypoint-offer-refusal="" id={refusalId}>{refusal}</p>
        )}
        {discuss !== null && targetChanged === null && refusal === W.typedTargetChanged
          ? <p className="text-sm leading-6 text-stone-300">{discuss}</p> : null}
        <p aria-atomic="true" className="text-sm leading-6 text-stone-200" data-waypoint-offer-status="" role="status">
          {saving ? W.saving : savedLine ?? ""}
        </p>
      </div>
      {dropLine === null ? null
        : <p className="mt-3 text-sm leading-6 text-stone-300" data-waypoint-offer-drop="">{dropLine}</p>}
    </>
  );
}
