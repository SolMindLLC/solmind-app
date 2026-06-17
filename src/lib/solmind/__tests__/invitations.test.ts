import { describe, expect, it } from "vitest";

import {
  SOLMIND_EXPLORER_INVITATION_LIFECYCLE,
  SOLMIND_GUIDE_INVITATION_LIFECYCLE,
  SOLMIND_INVITATION_ACTIVE_STATUSES,
  SOLMIND_INVITATION_TERMINAL_STATUSES,
} from "../invitations";

describe("invitation lifecycle constants", () => {
  it("uses the same lifecycle statuses for Guide and Explorer invitations", () => {
    const guideStatuses = SOLMIND_GUIDE_INVITATION_LIFECYCLE.map(
      (step) => step.status,
    );
    const explorerStatuses = SOLMIND_EXPLORER_INVITATION_LIFECYCLE.map(
      (step) => step.status,
    );

    expect(guideStatuses).toEqual([
      "created",
      "sent",
      "accepted",
      "expired",
      "revoked",
      "failed",
    ]);

    expect(explorerStatuses).toEqual(guideStatuses);
  });

  it("keeps active and terminal statuses separate", () => {
    expect(SOLMIND_INVITATION_ACTIVE_STATUSES).toEqual(["created", "sent"]);
    expect(SOLMIND_INVITATION_TERMINAL_STATUSES).toEqual([
      "accepted",
      "expired",
      "revoked",
      "failed",
    ]);

    for (const status of SOLMIND_INVITATION_ACTIVE_STATUSES) {
      expect(SOLMIND_INVITATION_TERMINAL_STATUSES).not.toContain(status);
    }
  });

  it("marks only terminal lifecycle steps as terminal", () => {
    const guideTerminalStatuses = SOLMIND_GUIDE_INVITATION_LIFECYCLE.filter(
      (step) => step.terminal,
    ).map((step) => step.status);

    expect(guideTerminalStatuses).toEqual(SOLMIND_INVITATION_TERMINAL_STATUSES);
  });
});
