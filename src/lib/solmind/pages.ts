export const SOLMIND_PAGES = {
    home: {
      title: "SolMind MVP0",
      description:
        "AI-assisted reflective support for Guides and Explorers.",
      href: "/",
    },
    login: {
      title: "MVP0 Login",
      description:
        "Explorer passwordless login; Guide and Admin password plus email/SMS verification.",
      href: "/login",
    },
    explorer: {
      title: "Explorer",
      description:
        "Explorer-facing conversation, intake, reflection, check-ins, and onboarding preview.",
      href: "/explorer",
    },
    guide: {
      title: "Guide",
      description:
        "Guide dashboard for Explorer summaries, progress, flags, and suggested follow-ups.",
      href: "/guide",
    },
    admin: {
      title: "Admin",
      description:
        "MVP0 administration console for Guide invites, methodology management, and system QA.",
      href: "/admin",
    },
  } as const;
  
  export type SolMindPageKey = keyof typeof SOLMIND_PAGES;