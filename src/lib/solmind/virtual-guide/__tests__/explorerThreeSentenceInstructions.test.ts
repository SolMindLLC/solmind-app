import { expect, it } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "../explorerPrivateConfiguration";
import { explorerSafetyHttpInstructions } from "../openAiLunaExplorerSafetyTransport";

it("REV432 places each exact instruction once directly after its anchor in both texts", () => {
  // The REV432 instruction units, word for word; changing them needs the product owner's approval of the new words.
  const insertions = [
    {
      anchor: "Track a topic in compass.topics only from distinct Explorer responses in this conversation that support it; mere mentions, unrelated answers and disputes do not count.",
      instruction: "Within the existing support, readiness, preference and safety rules, track every distinct topic the Explorer's responses support, not only the main one, and report up to three of them in compass.topics in each reply as their support grows.",
      following: "Use topicId from compassContext.topics for an existing topic, or null for a new one, and a plain-text label of 1 to 160 characters; keep an existing label unchanged.",
    },
    {
      anchor: "When the Explorer describes a destination, or their words show they prefer an alternative as a direction to try, offer it as one Waypoint in their own terms and ask whether it fits, only after the desired change is clear and the Compass point was added in an earlier reply.",
      instruction: "Make the Waypoint offer in the first reply in which all the existing Waypoint requirements are met, even when the Explorer also asks for help with what to say or do; the clarification, unanswered-draft, five-Waypoint, one-question, confirmation and safety rules still apply.",
      following: "Use only the Explorer's expressed destination, reason and description of success; do not invent missing details, distinguish what the Explorer wants to try from outcomes another person controls, and if an essential detail is unclear, ask one useful question before drafting.",
    },
    {
      anchor: "State the alternatives in the reply with at most one question, using optional choice buttons only when permitted and visible, each a short complete reply in the Explorer's voice.",
      instruction: "After giving new or changed direct wording or a single direct suggestion, use the reply's one question to ask whether it fits, unless the Explorer has already said it fits or a needed clarifying question must come first; never repeat a fit question the Explorer has already answered. If the same reply also offers a Waypoint, the question names both the wording and the Waypoint, and approval of the wording alone never confirms the Waypoint.",
      following: "Explain suggestions when asked, within the same advice limits, without treating a request for detail alone as a preference.",
    },
  ];
  const candidate = getExplorerPrivateConfigurationCandidate();
  if (candidate === null) throw new Error("pinned_candidate_unavailable");
  const ordinary = explorerSafetyHttpInstructions("classification_and_reply");
  const classification = explorerSafetyHttpInstructions("classification_only");

  for (const text of [candidate.roleBehavior.text, ordinary]) {
    for (const { anchor, instruction, following } of insertions) {
      expect(text.split(anchor)).toHaveLength(2);
      expect(text.split(instruction)).toHaveLength(2);
      expect(text).toContain(anchor + " " + instruction + " " + following);
      // The Fit unit has two sentences; neither may also occur separately elsewhere.
      for (const sentence of instruction.split(/(?<=\.) /)) {
        expect(text.split(sentence)).toHaveLength(2);
        expect(classification).not.toContain(sentence);
      }
    }
  }
});
