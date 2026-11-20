import { expect, it } from "vitest";
import { getExplorerPrivateConfigurationCandidate } from "../explorerPrivateConfiguration";
import { explorerSafetyHttpInstructions } from "../openAiLunaExplorerSafetyTransport";

it("card 3 answers place each exact sentence once between its neighbors in both texts", () => {
  // Exact wording from the approval sheet for the product owner's 2026-11-19 card 3 answers; changing them needs his
  // approval of the new words.
  const placements = [
    {
      before: "Within the existing support, readiness, preference and safety rules, track every distinct topic the Explorer's responses support, not only the main one, and report up to three of them in compass.topics in each reply as their support grows.",
      sentence: "Treat two related concerns as distinct topics when the Explorer's words show they would want to come back to either one on its own.",
      after: "Use topicId from compassContext.topics for an existing topic, or null for a new one, and a plain-text label of 1 to 160 characters; keep an existing label unchanged.",
    },
    {
      before: "Before offering a Waypoint, gently ask what the Explorer wants to be different and hear the answer, unless that desired change is already clear from their earlier answer or unprompted words; offer up to three possible answers if helpful, without repeating an unanswered question or pressing after hesitation.",
      sentence: "When the Explorer describes a destination, or their words show they prefer an alternative as a direction to try, offer it as one Waypoint in their own terms and ask whether it fits, only after the desired change is clear and the Compass point was added in an earlier reply, or in the reply that adds the point if the Explorer has already said what they want to change, why it matters and what success looks like.",
      after: "Make the Waypoint offer in the first reply in which all the existing Waypoint requirements are met, even when the Explorer also asks for help with what to say or do; the clarification, unanswered-draft, five-Waypoint, one-question, confirmation and safety rules still apply.",
    },
    {
      before: "Use only the Explorer's expressed destination, reason and description of success; do not invent missing details, distinguish what the Explorer wants to try from outcomes another person controls, and if an essential detail is unclear, ask one useful question before drafting.",
      sentence: "Judge success by the Explorer's stated goal, so saying their chosen words is enough if they want to speak up and counts as one step if they want a two-way conversation.",
      after: "If several alternatives fit and their order or combination is unclear, ask which to take first or whether they belong together, then hear the answer; offer one Waypoint at a time.",
    },
  ];
  // The second answer replaces this sentence.
  const replaced = "When the Explorer describes a destination, or their words show they prefer an alternative as a direction to try, offer it as one Waypoint in their own terms and ask whether it fits, only after the desired change is clear and the Compass point was added in an earlier reply.";
  const candidate = getExplorerPrivateConfigurationCandidate();
  if (candidate === null) throw new Error("pinned_candidate_unavailable");
  const ordinary = explorerSafetyHttpInstructions("classification_and_reply");
  const classification = explorerSafetyHttpInstructions("classification_only");

  for (const text of [candidate.roleBehavior.text, ordinary]) {
    for (const { before, sentence, after } of placements) {
      expect(text.split(sentence)).toHaveLength(2);
      expect(text).toContain(before + " " + sentence + " " + after);
      expect(classification).not.toContain(sentence);
    }
    expect(text).not.toContain(replaced);
  }
});
