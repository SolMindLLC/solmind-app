export type SolMindInvitationRecipientRole = "guide" | "explorer";

export type SolMindInvitationStatus =
  | "created"
  | "sent"
  | "accepted"
  | "expired"
  | "revoked"
  | "failed";

export type SolMindInvitationLifecycleStep = {
  status: SolMindInvitationStatus;
  title: string;
  description: string;
  terminal: boolean;
};

export const SOLMIND_GUIDE_INVITATION_LIFECYCLE: SolMindInvitationLifecycleStep[] =
  [
    {
      status: "created",
      title: "Created",
      description:
        "Admin has created a Guide invitation, but it has not been sent.",
      terminal: false,
    },
    {
      status: "sent",
      title: "Sent",
      description:
        "Admin has sent the Guide invitation and the invite is awaiting response.",
      terminal: false,
    },
    {
      status: "accepted",
      title: "Accepted",
      description:
        "Guide has accepted the invitation and may continue setup or await Admin approval.",
      terminal: true,
    },
    {
      status: "expired",
      title: "Expired",
      description:
        "Guide invitation was not accepted before the configured expiration window.",
      terminal: true,
    },
    {
      status: "revoked",
      title: "Revoked",
      description:
        "Admin revoked the Guide invitation before acceptance.",
      terminal: true,
    },
    {
      status: "failed",
      title: "Failed",
      description:
        "Guide invitation could not be sent or processed (for example a send, delivery, provider, or validation failure). This is a system failure, not an invitee decision.",
      terminal: true,
    },
  ];

export const SOLMIND_EXPLORER_INVITATION_LIFECYCLE: SolMindInvitationLifecycleStep[] =
  [
    {
      status: "created",
      title: "Created",
      description:
        "Guide has created an Explorer invitation, but it has not been sent.",
      terminal: false,
    },
    {
      status: "sent",
      title: "Sent",
      description:
        "Guide has sent the Explorer invitation and the invite is awaiting response.",
      terminal: false,
    },
    {
      status: "accepted",
      title: "Accepted",
      description:
        "Explorer has accepted the invitation and may continue onboarding.",
      terminal: true,
    },
    {
      status: "expired",
      title: "Expired",
      description:
        "Explorer invitation was not accepted before the configured expiration window.",
      terminal: true,
    },
    {
      status: "revoked",
      title: "Revoked",
      description:
        "Guide or Admin revoked the Explorer invitation before acceptance.",
      terminal: true,
    },
    {
      status: "failed",
      title: "Failed",
      description:
        "Explorer invitation could not be sent or processed (for example a send, delivery, provider, or validation failure). This is a system failure, not an invitee decision.",
      terminal: true,
    },
  ];

export const SOLMIND_INVITATION_ACTIVE_STATUSES: SolMindInvitationStatus[] = [
  "created",
  "sent",
];

export const SOLMIND_INVITATION_TERMINAL_STATUSES: SolMindInvitationStatus[] = [
  "accepted",
  "expired",
  "revoked",
  "failed",
];
