export type PublicLinkIcon =
  | "x"
  | "instagram"
  | "email"
  | "linkedin"
  | "github"
  | "discord"
  | "tiktok"
  | "youtube"
  | "patreon"
  | "pinterest"
  | "telegram"
  | "paypal"
  | "linktree";

export type PublicLink = {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly description: string;
  readonly category: "social" | "resources" | "meta";
  readonly icon: PublicLinkIcon;
  readonly theme: string;
  readonly accent: string;
  readonly verified: boolean;
};

export const PUBLIC_LINKS = {
  social: [
    {
      id: "x",
      label: "X",
      href: "https://x.com/Parsaetak",
      description: "Public thoughts, updates, and signals.",
      category: "social",
      icon: "x",
      theme: "x",
      accent: "#f5f7fb",
      verified: true
    },
    {
      id: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/Parsaetak/",
      description: "Visual work, experiments, and creative output.",
      category: "social",
      icon: "instagram",
      theme: "instagram",
      accent: "#E1306C",
      verified: true
    },
    {
      id: "email",
      label: "Email",
      href: "mailto:Parsaetak@gmail.com",
      description: "Direct professional contact.",
      category: "social",
      icon: "email",
      theme: "email",
      accent: "#FF2020",
      verified: true
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/parsaetak",
      description: "Professional profile and network.",
      category: "social",
      icon: "linkedin",
      theme: "linkedin",
      accent: "#0A66C2",
      verified: true
    },
    {
      id: "github",
      label: "GitHub",
      href: "https://github.com/Parsaetak",
      description: "Code, systems, experiments, and public archive.",
      category: "social",
      icon: "github",
      theme: "github",
      accent: "#F0F6FC",
      verified: true
    },
    {
      id: "discord",
      label: "Discord",
      href: "https://discord.com/invite/BXNNcGFPTp",
      description: "Community, discussion, and collaboration.",
      category: "social",
      icon: "discord",
      theme: "discord",
      accent: "#5865F2",
      verified: true
    },
    {
      id: "tiktok",
      label: "TikTok",
      href: "https://www.tiktok.com/@Parsaetak",
      description: "Short-form creative and experimental media.",
      category: "social",
      icon: "tiktok",
      theme: "tiktok",
      accent: "#00F2EA",
      verified: true
    }
  ] satisfies readonly PublicLink[],

  resources: [
    {
      id: "youtube",
      label: "YouTube",
      href: "https://www.youtube.com/@parsaetak",
      description: "Videos, ideas, experiments, and published work.",
      category: "resources",
      icon: "youtube",
      theme: "youtube",
      accent: "#FF0000",
      verified: true
    },
    {
      id: "patreon",
      label: "Patreon",
      href: "https://patreon.com/Parsaetak",
      description: "Creator support and exclusive work.",
      category: "resources",
      icon: "patreon",
      theme: "patreon",
      accent: "#FF424D",
      verified: true
    },
    {
      id: "pinterest",
      label: "Pinterest",
      href: "https://www.pinterest.com/parsaetak/",
      description: "Visual references, ideas, and image collections.",
      category: "resources",
      icon: "pinterest",
      theme: "pinterest",
      accent: "#E60023",
      verified: true
    },
    {
      id: "telegram-channel",
      label: "Telegram Channel",
      href: "https://t.me/ParsaxTak",
      description: "Public channel for updates and broadcasts.",
      category: "resources",
      icon: "telegram",
      theme: "telegram-channel",
      accent: "#229ED9",
      verified: true
    },
    {
      id: "telegram-account",
      label: "Telegram",
      href: "https://t.me/Parsaetak",
      description: "Direct Telegram contact.",
      category: "resources",
      icon: "telegram",
      theme: "telegram",
      accent: "#229ED9",
      verified: true
    },
    {
      id: "support",
      label: "Support & Donation",
      href: "https://www.paypal.me/ParsaTak",
      description: "Support the independent work and research.",
      category: "resources",
      icon: "paypal",
      theme: "paypal",
      accent: "#0070BA",
      verified: true
    }
  ] satisfies readonly PublicLink[],

  meta: [
    {
      id: "linktree",
      label: "Linktree",
      href: "https://linktr.ee/Parsaetak",
      description: "Original public link hub and fallback reference.",
      category: "meta",
      icon: "linktree",
      theme: "linktree",
      accent: "#43E660",
      verified: true
    }
  ] satisfies readonly PublicLink[]
} as const;

export const ALL_PUBLIC_LINKS = [
  ...PUBLIC_LINKS.social,
  ...PUBLIC_LINKS.resources,
  ...PUBLIC_LINKS.meta
] as const;

/*
 * Resolved once at module load instead of a .find() on every render
 * in LivingShell, HomeScene, and WorkScene.
 */
export const GITHUB_LINK =
  PUBLIC_LINKS.social.find(
    (link) =>
      link.id ===
      "github"
  ) ?? null;

/*
 * Primary contact channel (v3.2) — resolved from the same verified
 * source of truth (no duplicated contact constants): the mailto
 * link used by the /contact/ route, the home contact CTA, and the
 * About contact section.
 */
export const EMAIL_LINK =
  PUBLIC_LINKS.social.find(
    (link) =>
      link.id ===
      "email"
  ) ?? null;

export const LINKEDIN_LINK =
  PUBLIC_LINKS.social.find(
    (link) =>
      link.id ===
      "linkedin"
  ) ?? null;
