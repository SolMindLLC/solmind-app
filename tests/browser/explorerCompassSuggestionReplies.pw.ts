// Synthetic HTTP responses only. Compass answers are retired; Waypoint retry and
// follow-up coverage remains in explorerWaypointDraft.pw.ts.
import { expect, test } from "@playwright/test";
import { cardState } from "./connectedCardFixture";
import type { ExplorerConversationState } from "../../src/lib/solmind/explorerConversationContract";

test.use({ trace: "off", screenshot: "off", video: "off" });
for (const availability of ["available", "support", "adult_policy", "unavailable", undefined] as const) {
  for (const turnedDownLimitReached of [false, true]) {
    test(`legacy Compass replies stay retired at availability ${availability}, limit ${turnedDownLimitReached}`, async ({ page }) => {
      const base = cardState({ providerState: "available", compassSuggestionReplies: availability, turnedDownLimitReached });
      const sourceMessageId = base.messages.at(-1)!.id;
      const state: ExplorerConversationState = { ...base, compassItems: [
        { id: "40000000-0000-4000-8000-000000000091", sourceMessageId, wordingMessageId: sourceMessageId,
          label: "An ordinary topic", formation: "forming" },
        { id: "40000000-0000-4000-8000-000000000092", sourceMessageId, wordingMessageId: sourceMessageId,
          label: "Another ordinary topic", formation: "forming" },
      ], priorityId: null, attentionId: null };
      const commands: string[] = [];
      await page.route("**/explorer/conversation/state", route => route.fulfill({ json: {
        version: "explorer-private-conversation-response.v1", result: { ok: true, state, error: null }, assistance: null,
      } }));
      await page.route("**/explorer/conversation/commands", route => { commands.push(route.request().postData()!); return route.abort(); });
      await page.goto("/explorer/conversation");
      const transcript = page.getByRole("list", { name: "Saved conversation", exact: true });
      await expect(transcript.getByRole("listitem")).toHaveCount(base.messages.length);
      await expect(transcript.getByRole("group", { name: /^Reply to Compass suggestion:/ })).toHaveCount(0);
      await expect(transcript.getByRole("button", { name: /That's right|Close, not quite|That's not it/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Save Compass point|Review Priority|Review Compass arrangement|Review wording or combine/ })).toHaveCount(0);
      const composer = page.getByLabel("Continue the conversation", { exact: true });
      await composer.fill("An unfinished invented thought.");
      await page.getByRole("button", { name: "Reload saved conversation", exact: true }).click();
      await expect(composer).toHaveValue("An unfinished invented thought.");
      await expect(transcript.getByRole("group", { name: /^Reply to Compass suggestion:/ })).toHaveCount(0);
      await page.reload();
      await expect(transcript.getByRole("listitem")).toHaveCount(base.messages.length);
      await expect(transcript.getByRole("button", { name: /That's right|Close, not quite|That's not it/ })).toHaveCount(0);
      expect(commands).toEqual([]);
    });
  }
}
