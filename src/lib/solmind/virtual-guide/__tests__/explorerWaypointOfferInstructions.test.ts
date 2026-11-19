import { describe, expect, it } from "vitest";
import { EXPLORER_SAFE_CONTEXT_LIMITS } from "../../context/explorerSafeContext";
import { getExplorerPrivateConfigurationCandidate } from "../explorerPrivateConfiguration";
import { explorerSafetyHttpInstructions } from "../openAiLunaExplorerSafetyTransport";

// Paul's approved PLAN_R03 section (b), Option A, 2026-11-16. These independent
// expectations quote the approved wording; do not import production wording as proof.
const APPROVED = {
  R1: "When the Explorer describes something that matches the arrival signal of a formed Waypoint in this conversation, first respond to what happened and how it felt, and only once they have finished telling it, and only after any event the arrival signal depends on could plausibly have happened, offer once to mark that Waypoint Reached through a waypointOffer of kind reached alone, quoting there the Explorer's own words that show it, and do not ask the offer in the reply text.",
  R2: "Make that offer only when the Explorer describes what happened as progress, with the Reached box as the reply's only question and no Waypoint draft or other confirmation request in the same reply; never during distress or a safety concern, never after a setback they describe, never more than once for the same Waypoint in a conversation, never bring up another Waypoint in that conversation unless the Explorer asks, and never as a way to make room under the five-Waypoint limit.",
  R3: "Only the Explorer's \"Yes, mark it Reached\" or a typed yes clearly answering this specific, still-pending Reached offer authorizes marking that Waypoint Reached; a yes to another question or a Waypoint draft does not count, and declining, choosing \"Not yet\" or moving on does not confirm Reached or permit another offer for that Waypoint in this conversation.",
  C1: "When the Explorer asks to change the wording of a formed Waypoint in this conversation that is still in progress, first make sure you understand what they want changed, asking one question if it is unclear, then offer the changed Waypoint once through a waypointOffer of kind change alone, keeping every part they did not ask to change exactly as saved, and do not ask the offer in the reply text or say there that the change is shown, saved or made.",
  C2: "Offer a change only when the Explorer asks for it and never suggest changing a Waypoint yourself; never during distress or a safety concern; make the change box the reply's only question, with no Waypoint draft, Reached offer or other confirmation request in the same reply; and if what they describe is a different destination rather than a clearer wording of the same one, treat it as a new Waypoint instead.",
  C3: "Only the Explorer's \"That's right\" or a typed yes clearly answering this specific, still-pending change offer authorizes the change; a yes to another question, to a Waypoint draft or to a Reached offer does not count; after \"Close, not quite\", ask what to change and wait for the answer before offering corrected wording, unless the Explorer has already supplied the correction; after \"That's not it\" or moving on, leave the Waypoint as it is and do not offer that change again unless the Explorer asks.",
  V1: "When the Explorer asks to take up again a Waypoint in this conversation that is Reached or released, offer it once through a waypointOffer of kind revisit alone, keeping every part they did not ask to change exactly as saved, and do not ask the offer in the reply text or say there that the Waypoint is in progress again.",
  V2: "Offer a revisit only when the Explorer asks for it and never suggest it yourself; never during distress or a safety concern; make the revisit box the reply's only question, with no Waypoint draft, Reached offer or other confirmation request in the same reply; if their request describes a different destination, treat it as a new Waypoint under the existing formation and five-Waypoint rules, not as a revisit; and do not treat the earlier Reached evidence as showing arrival this time.",
  V3: "Only the Explorer's \"That's right\" or a typed yes clearly answering this specific, still-pending revisit offer authorizes taking the Waypoint up again; a yes to another question, to a Waypoint draft or to a Reached offer does not count; after \"Close, not quite\", ask what to change and wait for the answer before offering corrected wording, unless the Explorer has already supplied the correction; after \"That's not it\" or moving on, leave the Waypoint as it is and do not offer the revisit again unless the Explorer asks.",
  N1: "waypointOffer is one object with exactly kind (reached, change or revisit) and waypointId, a Waypoint id from compassContext.waypoints, plus, for reached, exactly evidence, the Explorer's own words copied exactly from one of their messages in 1 to 1000 characters, and, for change or revisit, exactly title, destination, whyItMatters and arrivalSignal, each a nonempty plain-text string, the title about six words and the others 1 to 1000 characters. waypointOfferResponse is one object with exactly offerId naming the pending offer in compassContext.offers and response equal to right, close or not_it.",
  N2: "the only optional keys are compass, waypointSuggestion, waypointResponse, waypointOffer, waypointOfferResponse and choices.",
  N3: "No other identifiers, rationale or extra keys, and no quoted source text except the Explorer's own words in the evidence of a waypointOffer of kind reached.",
  N4: "Never include classification rationale, tools or claimed application effects, and never quoted evidence except the Explorer's own words in the evidence of a waypointOffer of kind reached in an ordinary reply; use only supplied point ids in compass.attention, topic ids in compass.topics[].topicId, message references in compass.topics[].supportRefs, the forming Waypoint draft id in waypointResponse.draftId, Waypoint ids from compassContext.waypoints in waypointOffer.waypointId and the pending offer id from compassContext.offers in waypointOfferResponse.offerId.",
  N5: "In an ordinary reply send at most one of waypointSuggestion and waypointOffer. A change or revisit the Explorer asked for comes before anything you would raise yourself, a Reached offer or a new Waypoint. If the Explorer asks for two such things in one message, or it is unclear which comes first, ask which to take first and send neither. Use waypointOffer only with an ordinary reply below classification level 2 in an unrestricted conversation. Never claim an offer was shown, saved or applied; the application may drop it.",
  N6: "Record a typed answer in waypointOfferResponse only when the Explorer's latest message clearly answers the pending offer from your immediately preceding saved reply, marked suggestedInPreviousReply true in compassContext.offers. Use right only when the Explorer accepts exactly what was offered, close when they say it needs a change, never for a Reached offer, and not_it when they turn it down. Never infer an answer from silence, a change of topic or an ambiguous message, and never answer for the Explorer; when unsure, ask instead. With close, ask what to change; when the Explorer has already supplied the correction, put the corrected wording in waypointOffer and omit waypointOfferResponse. Do not send waypointOfferResponse in a reply that also has waypointResponse, waypointSuggestion or waypointOffer. Use waypointOfferResponse only with an ordinary reply below classification level 2 in an unrestricted conversation. Never claim the answer was saved or applied; the application may drop it.",
  N7: "compassContext.offers holds the pending offer, if any, with exactly what the Explorer was shown. compassContext.reachedOfferedWaypointIds lists the Waypoints that already had a Reached offer in this conversation; never offer Reached for them again.",
  N8Request: "candidateReply MUST be null; omit compass, waypointSuggestion, waypointResponse, waypointOffer, waypointOfferResponse and choices.",
  N8Role: "In classification-only mode omit compass, waypointSuggestion, waypointResponse, waypointOffer, waypointOfferResponse and choices.",
  N9Request: "compass, waypointSuggestion, waypointResponse, waypointOffer, waypointOfferResponse and choices are only proposals for the authorized application flow.",
  N9Policy: "The optional compass attention, compass topics, waypointSuggestion, waypointResponse, waypointOffer, waypointOfferResponse and choices fields only propose bounded data for that flow.",
  N10: "confirming a Waypoint still requires the Explorer's own reply button or clear typed answer in waypointResponse; in an ordinary reply, marking a Waypoint Reached, changing it or taking it up again through an offer likewise requires the Explorer's own button or clear typed answer in waypointOfferResponse; and sharing requires their explicit choice in the application.",
  N11: "When supplied state shows a Waypoint was changed or taken up again and the Explorer says \"That's right\", acknowledge it briefly and continue from what matters to them.",
  N12: "When the Explorer wants to change or take up again a Waypoint that is not in compassContext.waypoints, such as one from an earlier conversation, send no waypointOffer; you may instead offer a separate new Waypoint through waypointSuggestion under the existing formation and five-Waypoint rules, saying in the reply that it would be a new Waypoint in this conversation and that the earlier one stays as it was.",
  N13: "In an ordinary reply below classification level 2 in an unrestricted conversation, you may propose one waypointOffer to mark a Waypoint of this conversation Reached, to change its wording or to take it up again, only as the offer rules in the instructions sent with this request allow; never ask the offer in the reply text, never send it together with waypointSuggestion, and never claim that an offer was shown, saved or applied; the application may drop it.",
} as const;

const OFFER_ORDER = ["R1", "R2", "R3", "C1", "C2", "C3", "V1", "V2", "V3", "N5", "N12", "N6", "N7"] as const;
const DETAILED_LABELS = [...OFFER_ORDER, "N11"] as const;
const EXISTING_TYPED_ANSWER_SAFEGUARD = "Never infer an answer from silence, a change of topic or an ambiguous message, and never answer for the Explorer; when unsure, ask instead.";
const CLASSIFICATION_KEY_LIST = 'The required outer keys are protocol, classification, candidateReply; the only optional keys are compass, waypointSuggestion, waypointResponse and choices. protocol is "explorer-safety-reply.v2". classification has exactly level (integer0 through4) and minorIndicated (boolean). compass may contain only two fields, attention and topics. attention is the id of a placed point from compassContext that the conversation is now about, or null. topics is an array of zero to three objects with exactly topicId (a supplied topic id or null), label (plain text, single-line, 1 to 160 characters), supportRefs (zero to three distinct supplied message references) and ready (boolean). A new topic needs at least one supportRef; an existing label stays unchanged. choices is an array of one to three objects, each with exactly label, a plain-text single-line label of 1 to 40 characters. waypointSuggestion is one object with exactly title, destination, whyItMatters and arrivalSignal, each a nonempty plain-text string; the title is about six words and the other fields have 1 to 1000 characters. waypointResponse is one object with exactly draftId naming the forming Waypoint in compassContext.drafts and response equal to right, close or not_it. No other identifiers, rationale, quoted source text or extra keys.';

function texts() {
  const candidate = getExplorerPrivateConfigurationCandidate();
  if (candidate === null) throw new Error("pinned_candidate_unavailable");
  return {
    role: candidate.roleBehavior.text,
    policy: candidate.globalPolicy.text,
    crisis: candidate.crisisBehavior.text,
    ordinary: explorerSafetyHttpInstructions("classification_and_reply"),
    classification: explorerSafetyHttpInstructions("classification_only"),
  };
}

function expectOnce(text: string, instruction: string): void {
  expect(text.split(instruction)).toHaveLength(2);
}

describe("approved Waypoint offer instructions, Option A", () => {
  it.each(DETAILED_LABELS)("places %s exactly once in ordinary instructions and excludes it from the other texts", label => {
    const { ordinary, classification, role, policy, crisis } = texts();
    const instruction = APPROVED[label];
    expectOnce(ordinary, instruction);
    for (const text of [classification, role, policy, crisis]) expect(text).not.toContain(instruction);
    for (const sentence of instruction.split(/(?<=\.) /)) {
      // N6 repeats this already-approved draft safeguard. Both full instruction units
      // must remain intact, so this one sentence deliberately occurs twice in ordinary.
      if (sentence === EXISTING_TYPED_ANSWER_SAFEGUARD) {
        expect(ordinary.split(sentence)).toHaveLength(3);
        expectOnce(classification, sentence);
        expectOnce(role, sentence);
        for (const text of [policy, crisis]) expect(text).not.toContain(sentence);
      } else {
        expectOnce(ordinary, sentence);
        for (const text of [classification, role, policy, crisis]) expect(text).not.toContain(sentence);
      }
    }
  });

  it("places R1 through V3 then N5, N12, N6 and N7 directly after the five-Waypoint rules", () => {
    const before = "Do not suggest Reached or Release as a way to make another place in this conversation, and do not repeat the new-conversation invitation when the Explorer has moved on.";
    const after = "Only propose a needle move with an ordinary reply in an unrestricted conversation; the application validates it and may ignore it.";
    expect(texts().ordinary).toContain([before, ...OFFER_ORDER.map(label => APPROVED[label]), after].join(" "));
  });

  it("places N11 directly after the existing confirmation acknowledgment", () => {
    const before = "When supplied state shows a Waypoint is confirmed and the Explorer says \"That's right\", acknowledge it briefly and continue from what matters to them.";
    const after = "When the Explorer describes a place they want to reach, you may suggest one Waypoint draft in waypointSuggestion, with a title of about six words, where they are heading, why it matters, and what Reached would look like, in their own terms.";
    expect(texts().ordinary).toContain([before, APPROVED.N11, after].join(" "));
  });

  it("places N1 to N3 only in the ordinary key list and preserves the classification key list byte for byte", () => {
    const { ordinary, classification, role, policy, crisis } = texts();
    const ordinaryKeyList = CLASSIFICATION_KEY_LIST
      .replace("the only optional keys are compass, waypointSuggestion, waypointResponse and choices.", APPROVED.N2)
      .replace("No other identifiers, rationale, quoted source text or extra keys.", APPROVED.N1 + " " + APPROVED.N3);
    const keyList = (text: string) => text.match(/The required outer keys are .*?(?= Write every choice label)/)?.[0];
    expect(keyList(classification)).toBe(CLASSIFICATION_KEY_LIST);
    expect(keyList(ordinary)).toBe(ordinaryKeyList);
    for (const label of ["N1", "N2", "N3"] as const) {
      expectOnce(ordinary, APPROVED[label]);
      for (const text of [classification, role, policy, crisis]) expect(text).not.toContain(APPROVED[label]);
    }
    for (const sentence of APPROVED.N1.split(/(?<=\.) /)) expectOnce(ordinary, sentence);
  });

  it("places N4 in the role protocol rules and retains all four identifiers beside the two new permissions", () => {
    const { role, ordinary, classification, policy, crisis } = texts();
    const before = "In classification-only mode return candidateReply:null; otherwise provide only an optional plain-text reflective candidate inside candidateReply.content.";
    const after = "For candidateReply.content ONLY, use at most one question, aim for 40 to 150 words, and never exceed 300 words.";
    expectOnce(role, APPROVED.N4);
    expect(role).toContain([before, APPROVED.N4, after].join(" "));
    for (const text of [ordinary, classification, policy, crisis]) expect(text).not.toContain(APPROVED.N4);
    for (const permission of [
      "supplied point ids in compass.attention",
      "topic ids in compass.topics[].topicId",
      "message references in compass.topics[].supportRefs",
      "the forming Waypoint draft id in waypointResponse.draftId",
      "Waypoint ids from compassContext.waypoints in waypointOffer.waypointId",
      "the pending offer id from compassContext.offers in waypointOfferResponse.offerId",
    ]) {
      expectOnce(role, permission);
      expectOnce(APPROVED.N4, permission);
    }
  });

  it("places N8 in the classification omit lists and N9 in both request proposal lists and the policy", () => {
    const { role, ordinary, classification, policy, crisis } = texts();
    expectOnce(classification, APPROVED.N8Request);
    expect(classification).toContain("Trusted request mode is classification_only. " + APPROVED.N8Request + " Produce no ordinary reflective or support prose.");
    expectOnce(role, APPROVED.N8Role);
    expect(role.endsWith("Do not infer the Explorer's total active Waypoints from this selection. " + APPROVED.N8Role)).toBe(true);
    for (const text of [ordinary, policy, crisis]) {
      expect(text).not.toContain(APPROVED.N8Request);
      expect(text).not.toContain(APPROVED.N8Role);
    }
    expect(role).not.toContain(APPROVED.N8Request);
    expect(classification).not.toContain(APPROVED.N8Role);
    for (const text of [ordinary, classification]) {
      expectOnce(text, APPROVED.N9Request);
      expect(text.endsWith("No tools, function calls, other application effects or claims of human notification; " + APPROVED.N9Request)).toBe(true);
      expect(text).not.toContain(APPROVED.N9Policy);
    }
    expectOnce(policy, APPROVED.N9Policy);
    expect(policy).toContain("Those effects belong to the authorized deterministic application flow. " + APPROVED.N9Policy);
    for (const text of [role, policy, crisis]) expect(text).not.toContain(APPROVED.N9Request);
    for (const text of [role, crisis]) expect(text).not.toContain(APPROVED.N9Policy);
  });

  it("places N10 and the N13 enabling safeguard only at their approved role anchors within the role limit", () => {
    const { role, ordinary, classification, policy, crisis } = texts();
    expectOnce(role, APPROVED.N10);
    expect(role).toContain("Do not describe a reflection as accepted, saved, shared, or durable unless supplied application state explicitly establishes that fact. Compass points form automatically; " + APPROVED.N10 + "\n\nAsk permission before increasing emotional depth.");
    expectOnce(role, APPROVED.N13);
    expect(role).toContain("Never claim a response was saved or applied; the application may drop it. " + APPROVED.N13 + " The supplied Waypoints are a bounded selection from this conversation.");
    for (const text of [ordinary, classification, policy, crisis]) {
      expect(text).not.toContain(APPROVED.N10);
      expect(text).not.toContain(APPROVED.N13);
    }
    expect(EXPLORER_SAFE_CONTEXT_LIMITS.roleBehaviorTextCharacters).toBe(25_000);
    expect(role.length).toBeLessThanOrEqual(EXPLORER_SAFE_CONTEXT_LIMITS.roleBehaviorTextCharacters);
  });

  it("removes all three replaced classification instructions from every text and preserves the shared close sentence", () => {
    const all = texts();
    const removed = [
      "Suggest a Waypoint only when the conversation clearly points to a place the Explorer wants to reach; when unsure, keep exploring or ask.",
      "; when they choose \"That's not it\", ask an open question.",
      "With not_it, ask an open question.",
    ];
    for (const text of Object.values(all)) {
      for (const instruction of removed) expect(text).not.toContain(instruction);
      expect(text).not.toContain("waypointReached");
      expect(text).not.toContain("waypointChange");
    }
    for (const text of [all.ordinary, all.classification, all.role]) {
      expectOnce(text, "When they choose \"Close, not quite\", ask what to change and keep any new wording forming.");
    }
  });
});
