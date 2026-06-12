export const SOLMIND_PAGES = {
    home: {
      title: "SolMind MVP0",
      description:
        "AI-assisted coaching support for Guides and Explorers.",
      href: "/",
    },
    login: {
      title: "MVP0 Login",
      description:
        "Passwordless login for Guides and Explorers; password plus code for Admin users.",
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
        "Guide Assistant dashboard for Explorer summaries, progress, flags, and suggested follow-ups.",
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