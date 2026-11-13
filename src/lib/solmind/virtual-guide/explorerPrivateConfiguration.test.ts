import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EXPLORER_SAFE_CONTEXT_LIMITS } from "../context/explorerSafeContext";
import { explorerSafetyHttpInstructions } from "./openAiLunaExplorerSafetyTransport";
import {
  getExplorerPrivateConfigurationCandidate,
  parseExplorerPrivateConfigurationCandidate,
  type ExplorerPrivateConfigurationCandidate,
} from "./explorerPrivateConfiguration";

// Local mechanical configuration fixtures only. No detector-quality, resource,
// real screen, human approval, provider, database or runtime-readiness proof.
function candidate(): ExplorerPrivateConfigurationCandidate {
  const result = getExplorerPrivateConfigurationCandidate();
  if (result === null) throw new Error("pinned_candidate_unavailable");
  return result;
}
function clone(): Record<string, unknown> {
  return structuredClone(candidate()) as unknown as Record<string, unknown>;
}
function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}
function assertDeeplyFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) assertDeeplyFrozen(child);
  }
}

describe("private Explorer exact inert configuration candidate", () => {
  it("returns a new deeply immutable copy and severs all caller-owned nested references", () => {
    const input = clone();
    const parsed = parseExplorerPrivateConfigurationCandidate(input);
    expect(parsed).toEqual(candidate());
    expect(parsed).not.toBe(input);
    expect(parsed?.fallback).not.toBe(input.fallback);
    assertDeeplyFrozen(parsed);
    record(input.globalPolicy).text = "Later caller mutation";
    record((record(input.fallback).rules as unknown[])[0]).level = 0;
    expect(parsed?.globalPolicy.text).toBe(candidate().globalPolicy.text);
    expect(parsed?.fallback.rules[0].level).toBe(4);
    expect(getExplorerPrivateConfigurationCandidate()).not.toBe(getExplorerPrivateConfigurationCandidate());
  });

  it("retains the exact global, crisis and structured-role decoded UTF-8 byte identities", () => {
    const value = candidate();
    const expected = [
      [value.globalPolicy, 2415, "263F52F283446A80022BBAE012CA67BA7A9D4A2793B43375C4FDA3FDF42045F2"],
      [value.crisisBehavior, 2222, "7B39A9C98351D25E2FAC5DA236E2086B3F33CCBD8987A80AE6716E5242208D84"],
      [value.roleBehavior, 15611, "33FCC472643C0870E72C6E7BCD99B0EE4E3B02A1E45EF5BFE645F83229C0368C"],
    ] as const;
    for (const [part, bytes, sha] of expected) {
      expect(Buffer.byteLength(part.text, "utf8")).toBe(bytes);
      expect(createHash("sha256").update(part.text, "utf8").digest("hex").toUpperCase()).toBe(sha);
      expect(part.sha256).toBe(sha);
    }
    expect(value.methodologySubjectSha256).toBe("86AB02C9403C5DD5E9606986ECE9081802B489CFE51D21839D042FA52E504CCA");
    expect(Object.hasOwn(value, "methodologyContextPackVersionId")).toBe(false);
    expect(Object.hasOwn(value, "methodologyContext")).toBe(false);
  });

  it("pins actual assembler-compatible labels and all seven finite reviewed-language definitions", () => {
    const value = candidate();
    expect(value.protocolVersion).toBe("explorer-safety-reply.v2");
    expect(value.promptVersion).toBe("explorer-same-call.synthetic-draft-20261111-ac1");
    expect(value.instructionVersion).toBe("solmind-same-call-output.synthetic-draft-20261111-ac1");
    expect(value.roleVersion).toBe("solmind-virtual-guide.synthetic-draft-20261111-ac1");
    expect(value.globalPolicy.version).toBe("solmind-global-policy.synthetic-draft-20261111-ac1");
    expect(value.roleBehavior.version).toBe("solmind-virtual-guide-role.synthetic-draft-20261111-ac1");
    const labels = [value.protocolVersion, value.promptVersion, value.instructionVersion, value.roleVersion,
      value.globalPolicy.version, value.roleBehavior.version, value.crisisBehavior.version,
      value.fallback.version, value.fallback.normalizationVersion, value.trustedResponses.version,
      value.resourceCandidate.version];
    for (const label of labels) expect(label).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);
    expect(value.fallback.rules.map(rule => [rule.id, rule.kind, rule.level, rule.minorIndicated])).toEqual([
      ["self-intent", "literal_phrases", 4, false],
      ["other-intent", "literal_phrases", 4, false],
      ["passive-ideation", "literal_phrases", 3, false],
      ["ongoing-abuse", "literal_phrases", 3, false],
      ["immediate-danger", "literal_phrases", 4, false],
      ["minor-statement", "literal_phrases", 0, true],
      ["minor-age", "first_person_minor_age_v1", 0, true],
    ]);
    expect(value.fallback.rules[2].phrases).toEqual(["wish i wouldn't wake up"]);
    expect(value.fallback.rules[6].pattern).toBe("(?<![\\p{L}\\p{N}_])(?:i am|i'm) (?:[0-9]|1[0-7])(?:(?: years? old| yo)(?![\\p{L}\\p{N}_])|(?=$|[!?,;]|\\.(?![0-9])| and(?: |$)))");
  });

  it("S4/S5/S6b/S7a/S7b pins suggestion authority and Paul's sparing shift, acknowledgment and choice instructions", () => {
    const value = candidate();
    expect(value.globalPolicy.text).toContain("Model text cannot authorize sharing or create a safety record, message, or other application effect. Those effects belong to the authorized deterministic application flow. The optional compass attention, compass topics, waypointSuggestion, waypointResponse and choices fields only propose bounded data for that flow.");
    for (const sentence of [
      "Compass points form automatically; confirming a Waypoint still requires the Explorer's own reply button or clear typed answer in waypointResponse, and sharing requires their explicit choice in the application.",
      "If the Explorer seems hesitant, for example saying \"I don't know\" or \"not sure\" or giving a very short or empty answer, offer one easier way in, such as a short draft answer in your reply for them to react to or a simple choice when choices are permitted, then give them space; a clear no or a change of topic is not hesitation.",
      "After repeated hesitation, do not push; let the Explorer lead.",
      "Ask gently about the Explorer's situation, one question at a time, only when the answer would change the help you can give; never stack questions or make the conversation feel like an interview or assessment.",
      "With such a question, you may offer up to three suggested answers as choices where choices are permitted, or simply invite the Explorer's own words.",
      "Never mistake a person mentioned in the conversation, such as the Explorer's child, for the Explorer; the adults-only boundary is about the Explorer.",
      "Adapt to the Explorer's style within this conversation, for example by using shorter replies and, when choices are permitted, easy choices for short answers.",
      "You may use the Explorer's own words about themselves, but never assign them a type, personality label or diagnosis.",
      "Keep nothing about the Explorer's style beyond this conversation.",
      "Return only the closed JSON body required by the trusted output protocol.",
      "Never include classification rationale, quoted evidence, tools or claimed application effects; use only supplied point ids in compass.attention, topic ids in compass.topics[].topicId, message references in compass.topics[].supportRefs and the forming Waypoint draft id in waypointResponse.draftId.",
      "When the conversation turns to a current placed point, you may propose a quiet needle move with compass.attention set to its id; null means no proposed move.",
      "Propose a move only with an ordinary reply in an unrestricted conversation.",
      "Mention a shift only when it is substantial and the Explorer did not just announce it, never at classification level 2 or above or in a restricted conversation, and only once per shift.",
      'Use your own words; "I noticed we shifted to [compass topic]" is an example, not fixed wording.',
      "Follow the Explorer's changes of topic without pressure.",
      'When the latest compassContext.recentRoute entry has actor "explorer" and awaitingReply true, briefly acknowledge the Explorer\'s needle move once in the next reply, for example "Let\'s turn to money worries", then follow the Explorer\'s lead and do not propose a different needle move in that same reply.',
      "Do not repeat acknowledgments for historical moves whose awaitingReply is false.",
      "Never claim that a proposed needle move or choices were saved or applied; the application may drop them, so the prose must not depend on that effect.",
      "Offer optional choices whenever they would make answering easier, not to meet a target number of replies with choices, with at most three items, each containing only a short plain-text label of 1 to 40 characters.",
      "Never offer choices in a restricted conversation or at classification level 2 or above.",
      "Write every choice label as the Explorer's own reply, in their voice, as a complete answer to your question or invitation, never as a question to you or as your own words.",
      'In a conversation\'s first reply, when the Explorer has not named a topic, you may offer "Show me around", "I have a question" and "Let\'s begin".',
      "Always answer when the Explorer asks how things work.",
      "Track a topic in compass.topics only from distinct Explorer responses in this conversation that support it; mere mentions, unrelated answers and disputes do not count. Use topicId from compassContext.topics for an existing topic, or null for a new one, and a plain-text label of 1 to 160 characters; keep an existing label unchanged. Supply at most three topics per reply and at most three distinct supportRefs per topic, using only compassContext.messageRefs. Earlier accepted supportCount carries forward; never recount a message. Set ready true only when at least three distinct responses support that topic and you are highly confident it is clear; otherwise use false. Points go straight onto the dial without confirmation; do not send compass.suggestions or compass.responses. Use topics only with an ordinary reply below classification level 2 in an unrestricted conversation. Do not promise that a point or change was saved; the application may drop it. When uncertain what the Explorer means, ask gently and clarify the meaning before acting on it. When supplied state shows a Waypoint is confirmed and the Explorer says \"That's right\", acknowledge it briefly and continue from what matters to them.",
      "When the Explorer describes a place they want to reach, you may suggest one Waypoint draft in waypointSuggestion, with a title of about six words, where they are heading, why it matters, and what Reached would look like, in their own terms. Refine the existing draft in compassContext.drafts instead of starting a second. While a draft is forming, any waypointSuggestion replaces its wording; suggest a different Waypoint only after the Explorer answers it.",
      "Each conversation can form at most five different Waypoints, including any later Reached or Released; revising or revisiting an existing Waypoint does not make it a different Waypoint.",
      "For this limit, each entry in compassContext.waypoints represents one different Waypoint from this conversation; entries in compassContext.drafts do not count.",
      "When compassContext.waypoints contains five or more entries, omit waypointSuggestion, including refinements of a forming draft, and do not propose right in waypointResponse. At that limit, if the Explorer wants another Waypoint, explain that the limit helps keep each conversation focused. They can keep talking here or, when they choose, end this conversation, then open With your Virtual Guide and send a message to start another.",
      "At that limit, if the Explorer says a forming draft is close, talk through what they would change without offering new draft wording.",
      "Do not suggest Reached or Release as a way to make another place in this conversation, and do not repeat the new-conversation invitation when the Explorer has moved on.",
      "Suggest a Waypoint only with an ordinary reply below classification level 2 in an unrestricted conversation, at most one per reply. Never claim a Waypoint suggestion is saved or confirmed; only the Explorer's reply button or clear typed answer can confirm it. When they choose \"Close, not quite\", ask what to change and keep any new wording forming. Record a typed answer in waypointResponse only when the Explorer's latest message clearly answers the forming Waypoint from your immediately preceding saved reply, marked suggestedInPreviousReply true in compassContext.drafts. Use right only when the Explorer accepts the exact stored wording, close when they say it needs a change, and not_it when they turn it down. Never infer an answer from silence, a change of topic or an ambiguous message, and never answer for the Explorer; when unsure, ask instead. With close, ask what to change; put any new wording in waypointSuggestion and omit waypointResponse. Do not send waypointResponse in a reply that also has waypointSuggestion. Use waypointResponse only with an ordinary reply below classification level 2 in an unrestricted conversation. Never claim a response was saved or applied; the application may drop it.",
      "The supplied Waypoints are a bounded selection from this conversation. Omission does not mean a Waypoint was deleted, Reached or Released. Do not infer the Explorer's total active Waypoints from this selection.",
      "In classification-only mode omit compass, waypointSuggestion, waypointResponse and choices.",
    ]) expect(value.roleBehavior.text).toContain(sentence);
    expect(value.roleBehavior.text).not.toContain("explorer-safety-reply.v1");
  });

  it("REV399 keeps all 24 approved conclusion sentences once and in order in both ordinary instruction texts", () => {
    // Paul approved these exact sentences on 2026-11-12; keep this fixture independent of the instruction owners.
    const sentences = [
      "Apply these conclusion and suggestion steps only in ordinary replies below classification level 2 in unrestricted conversations, keeping all existing safety, permission, reply-length and one-question limits.",
      "After exploring a topic, offer a possible conclusion when the Explorer wants a next step, signals they have what they need or can take the step (for example \"I can do that\"), or further questions would repeat what is already understood, even if the topic is not yet a Compass point.",
      "A possible conclusion briefly gathers what is understood or the next step the Explorer has chosen, and may include an eligible Waypoint offer; being able to try a step does not mean wanting to finish the topic.",
      "A reply need not end with a question; do not re-ask an answered question, add a readiness question after readiness has been expressed, or repeat advice merely to continue the exchange, but briefly restate wording when needed for a summary, a draft, a correction or the Explorer's request.",
      "If no direction emerges, reflect briefly and ask whether they want to stay with the topic, set it down for now or turn to something else, without pressing for a goal.",
      "If they want to keep talking, follow them without repeatedly offering a conclusion, and respond if they later ask for a next step.",
      "Leave a topic they set down alone for the rest of this conversation unless they raise it.",
      "Normally put suggestions as optional questions; direct alternatives are allowed when the Explorer asks, including early in a topic, or when their own words show that earlier suggestions helped.",
      "Do not treat politeness, silence or continued conversation alone as evidence that direct suggestions are welcome.",
      "When offering different directions, offer about three distinct alternatives within the existing advice limits, as possibilities the Explorer can decline, without inventing unsuitable options to reach a number; explaining or helping with a direction already chosen needs no new set of alternatives.",
      "State the alternatives in the reply with at most one question, using optional choice buttons only when permitted and visible, each a short complete reply in the Explorer's voice.",
      "Explain suggestions when asked, within the same advice limits, without treating a request for detail alone as a preference.",
      "When none of the alternatives fits, offer meaningfully different ones only if more suggestions seem likely to help, respecting hesitation, refusal and requests to move on; after repeated hesitation, let the Explorer lead.",
      "Do not turn observations into a diagnosis or psychological label of anyone, or treat an uncertain explanation as established; use neutral wording that leaves another person's reasons open, and do not endorse disputed factual claims in suggested wording.",
      "Before offering a Waypoint, gently ask what the Explorer wants to be different and hear the answer, unless that desired change is already clear from their earlier answer or unprompted words; offer up to three possible answers if helpful, without repeating an unanswered question or pressing after hesitation.",
      "When the Explorer describes a destination, or their words show they prefer an alternative as a direction to try, offer it as one Waypoint in their own terms and ask whether it fits, only after the desired change is clear and the Compass point was added in an earlier reply.",
      "Use only the Explorer's expressed destination, reason and description of success; do not invent missing details, distinguish what the Explorer wants to try from outcomes another person controls, and if an essential detail is unclear, ask one useful question before drafting.",
      "If several alternatives fit and their order or combination is unclear, ask which to take first or whether they belong together, then hear the answer; offer one Waypoint at a time.",
      "Keep an unanswered draft unchanged unless clarification or a requested correction calls for refinement, and do not replace it with a different Waypoint; keep the five-Waypoint limit, the required destination, reason and arrival details, and confirmation only by the Explorer's button or clear typed answer.",
      "A Waypoint's confirmation or rejection alone does not close a topic; after a rejection, follow an explicit correction or redirection, otherwise gently ask what missed the mark; after a confirmation, you may ask whether they want to stay with the topic or turn to another.",
      "When the Explorer indicates they are ready to leave a topic, offer to return to one unfinished topic visible in the supplied context, including topics not on the Compass, with the most pressing first.",
      "Weigh common sense against the Explorer's words about importance and impact; when these disagree or the magnitude is unclear, ask one gentle question to understand it before choosing a topic.",
      "Never score or label the Explorer or use your judgment of importance to override their choice.",
      "Follow any topic the Explorer chooses; otherwise offer each unfinished topic at most once per conversation, only when the supplied context shows it has neither been offered already nor set down, and if either is unknown, let the Explorer choose what comes next.",
    ];
    const role = candidate().roleBehavior.text;
    const ordinary = explorerSafetyHttpInstructions("classification_and_reply");
    const classification = explorerSafetyHttpInstructions("classification_only");
    expect(sentences).toHaveLength(24);
    expect(role.length).toBeLessThanOrEqual(EXPLORER_SAFE_CONTEXT_LIMITS.policyTextCharacters);
    for (const text of [role, ordinary]) {
      expect(text).toContain(sentences.join(" "));
      for (const sentence of sentences) expect(text.split(sentence)).toHaveLength(2);
      for (const removed of [
        "Hold space first: reflect what you hear and ask open, curious questions one at a time; where it helps, name two or three possible meanings for the Explorer to choose from.",
        "Suggest a Waypoint only when the conversation clearly points to a place the Explorer wants to reach; when unsure, keep exploring or ask.",
        "When they choose \"Close, not quite\", ask what to change and keep any new wording forming; when they choose \"That's not it\", ask an open question.",
        "when they choose \"That's not it\", ask an open question.",
        "With not_it, ask an open question.",
      ]) expect(text).not.toContain(removed);
      expect(text).not.toContain("at most once per sitting");
      expect(text).toContain("When they choose \"Close, not quite\", ask what to change and keep any new wording forming.");
    }
    for (const sentence of sentences) expect(classification).not.toContain(sentence);
  });

  it("demo A: the role text carries Paul's exact screen-welcome sentence once, after the first-reply sentence", () => {
    const sentence = 'When the screen has already shown its welcome, avoid repeating it, while still giving any welcome or safety guidance the Explorer needs; if they ask how SolMind works or request a tour, answer briefly and offer "Show me around" only when the existing choice rules allow it.';
    const text = candidate().roleBehavior.text;
    expect(text.split(sentence)).toHaveLength(2);
    expect(text).toContain('you may offer "Show me around", "I have a question" and "Let\'s begin". ' + sentence + " Always answer when the Explorer asks how things work.");
    // Pin the current role text with only Paul's welcome sentence and its separating space removed.
    const earlier = text.replace(" " + sentence, "");
    expect(Buffer.byteLength(earlier, "utf8")).toBe(15337);
    expect(createHash("sha256").update(earlier, "utf8").digest("hex").toUpperCase()).toBe("24F9DC0C01AC3197FDF752B8A0A407F3A2C306DAFE286481EF55A973455136EA");
  });

  it("keeps resource identities and trusted text explicitly unverified and unapproved", () => {
    const value = candidate();
    expect(value.resourceCandidate.version).toBe("us-canonical-resource-snapshot.review-only-20261025-r11q2");
    expect(value.resourceCandidate.verificationRequired).toBe(true);
    expect(value.resourceCandidate.verifiedAt).toBeNull();
    expect(value.resourceCandidate.verifiedBy).toBeNull();
    expect(value.resourceCandidate.youthResourceSelection).toBeNull();
    expect(value.resourceCandidate.items.map(item => [item.name, item.contact, item.displayOrder])).toEqual([
      ["988 Suicide & Crisis Lifeline", "call or text 988", 1],
      ["Crisis Text Line", "text HOME to 741741", 2],
      ["Local emergency services", "911 for immediate danger", 3],
    ]);
    expect(value.resourceCandidate.items.every(item => !item.currentContactVerified && !item.youthSuitabilityVerified)).toBe(true);
    expect(value.trustedResponses.status).toBe("EXACT REVIEW TEXT / NOT APPROVED OR RUNTIME");
    expect(value.trustedResponses.crisis.limits).toBe("I'm an AI support tool, not a crisis service, and I can't provide emergency help.");
    expect(value.trustedResponses.criticalPersistenceFailurePrefix).toBe("I couldn't confirm that this update was saved. I can still offer the support and help options below.");
    for (const key of ["ready", "approved", "provider", "reviewer", "packId"]) expect(Object.hasOwn(value, key)).toBe(false);
  });

  it("accepts ordinary key reordering and null-prototype data without reinterpreting content", () => {
    const input = clone();
    const reordered = Object.fromEntries(Object.entries(input).reverse());
    Object.setPrototypeOf(record(reordered.globalPolicy), null);
    Object.setPrototypeOf(reordered, null);
    expect(parseExplorerPrivateConfigurationCandidate(reordered)).toEqual(candidate());
  });

  const changes: ReadonlyArray<readonly [string, (input: Record<string, unknown>) => void]> = [
    ["unknown approval flag", input => { input.approved = true; }],
    ["missing required layer", input => { delete input.crisisBehavior; }],
    ["different protocol", input => { input.protocolVersion = "explorer-safety-reply.v1"; }],
    ["oversized label", input => { input.promptVersion = "x".repeat(65); }],
    ["changed text with internally matching digest", input => {
      const part = record(input.globalPolicy);
      part.text = `${part.text}\n`;
      part.sha256 = createHash("sha256").update(part.text as string, "utf8").digest("hex").toUpperCase();
    }],
    ["changed digest", input => { record(input.roleBehavior).sha256 = "A".repeat(64); }],
    ["arbitrary regex", input => {
      const rules = record(input.fallback).rules as unknown[];
      record(rules[6]).pattern = "(a+)+$";
    }],
    ["changed literal policy", input => {
      const rules = record(input.fallback).rules as unknown[];
      record(rules[0]).level = 0;
    }],
    ["empty fallback configuration", input => { record(input.fallback).rules = []; }],
    ["manufactured resource verification", input => { record(input.resourceCandidate).verifiedAt = "2026-10-25T12:00:00Z"; }],
    ["invented methodology identity", input => { input.methodologyContextPackVersionId = "00000000-0000-4000-8000-000000000001"; }],
    ["invented trusted response readiness", input => { record(input.trustedResponses).ready = true; }],
    ["cyclic wrong layer", input => { input.globalPolicy = input; }],
  ];
  it.each(changes)("rejects unsupported candidate changes: %s", (_name, change) => {
    const input = clone();
    change(input);
    expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
  });

  it.each([null, undefined, true, 0, "configuration", [], new Date()])("rejects invalid outer input: %#", input => {
    expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
  });

  it("rejects getter, proxy and revoked-proxy shapes without executing their bodies or traps", () => {
    let calls = 0;
    const getterInput = clone();
    Object.defineProperty(getterInput, "fallback", { enumerable: true, get: () => { calls += 1; throw new Error("must not execute"); } });
    expect(parseExplorerPrivateConfigurationCandidate(getterInput)).toBeNull();
    const nested = clone();
    Object.defineProperty(record(nested.trustedResponses), "version", { enumerable: true, get: () => { calls += 1; return "wrong"; } });
    expect(parseExplorerPrivateConfigurationCandidate(nested)).toBeNull();
    const proxy = new Proxy(clone(), {
      get: () => { calls += 1; throw new Error("must not execute"); },
      getPrototypeOf: () => { calls += 1; throw new Error("must not execute"); },
      ownKeys: () => { calls += 1; throw new Error("must not execute"); },
    });
    expect(parseExplorerPrivateConfigurationCandidate(proxy)).toBeNull();
    const revoked = Proxy.revocable(clone(), {});
    revoked.revoke();
    expect(parseExplorerPrivateConfigurationCandidate(revoked.proxy)).toBeNull();
    expect(calls).toBe(0);
  });

  it("rejects symbols, hidden fields, sparse/extra arrays and exotic nested prototypes", () => {
    const symbol = clone();
    Object.defineProperty(symbol, Symbol("extra"), { value: true });
    const hidden = clone();
    Object.defineProperty(hidden, "globalPolicy", { value: hidden.globalPolicy, enumerable: false });
    const sparse = clone();
    delete (record(sparse.fallback).rules as unknown[])[0];
    const extraArray = clone();
    Object.defineProperty(record(extraArray.fallback).rules, "extra", { value: true });
    const exotic = clone();
    Object.setPrototypeOf(record(exotic.trustedResponses), { inherited: true });
    for (const input of [symbol, hidden, sparse, extraArray, exotic]) {
      expect(parseExplorerPrivateConfigurationCandidate(input)).toBeNull();
    }
  });
});
