/** Primary navigation from AtlasNow PRD §5.1 */

export type NavItem = {
  href: string;
  label: string;
  description: string;
  fase: string;
  comingLater?: boolean;
  agencyOnly?: boolean;
  platformOnly?: boolean;
};

export const APP_NAV: NavItem[] = [
  {
    href: "/agencies",
    label: "Groups",
    description: "Every group on AtlasNow",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/agencies/follow-up",
    label: "Follow-up",
    description: "Agencies, standalone brands, upgrades waiting",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/support",
    label: "Help desk",
    description: "AtlasNow support — Radit",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/billing",
    label: "Invoice",
    description: "Print invoice and SOW — transfer, no PPN, no gateway",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/clients",
    label: "Brands",
    description: "The restaurants and shops you manage",
    fase: "E0",
    agencyOnly: true,
  },
  {
    href: "/clients/follow-up",
    label: "Follow-up",
    description: "Sign-ups waiting for login",
    fase: "E0",
    agencyOnly: true,
  },
  {
    href: "/deck_pitch",
    label: "Pitch deck",
    description: "Client pitch — problems AtlasNow solves",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/deck_train",
    label: "Training",
    description: "Set up loyalty first, then how the till stamps",
    fase: "E0",
    platformOnly: true,
  },
  {
    href: "/activity",
    label: "Change log",
    description: "Who changed what, and WhatsApp disconnects",
    fase: "E0",
  },
  {
    href: "/control-tower",
    label: "Home",
    description: "Inbox, members, stamps, and what needs a person today",
    fase: "E1",
  },
  {
    href: "/leakage-queue",
    label: "Needs a look",
    description: "Things that might lose a customer",
    fase: "E1",
  },
  {
    href: "/locations",
    label: "Outlets",
    description: "Every branch, name, and map pin",
    fase: "E0 · S2",
  },
  {
    href: "/reputation",
    label: "Reviews",
    description: "Read and reply to Google reviews",
    fase: "E1",
  },
  {
    href: "/posts",
    label: "Posts",
    description: "Google posts and offers",
    fase: "E1–E2",
    comingLater: true,
  },
  {
    href: "/ads",
    label: "Ads",
    description: "Promo and vouchers",
    fase: "E2",
    comingLater: true,
  },
  {
    href: "/conversations",
    label: "Inbox",
    description: "WhatsApp and Messenger chats",
    fase: "E3 temp",
  },
  {
    href: "/broadcast",
    label: "WhatsApp broadcast",
    description: "Write once to people who already messaged HQ",
    fase: "E3",
  },
  {
    href: "/commerce",
    label: "Commerce",
    description: "Products for this brand. Catalog sync is off.",
    fase: "E3",
  },
  {
    href: "/yola",
    label: "YOLA FUN",
    description: "Presale orders for this workspace. Sends and live payments stay off.",
    fase: "E3",
  },
  {
    href: "/customers",
    label: "Customers",
    description: "Join QR and WhatsApp people",
    fase: "E3",
  },
  {
    href: "/loyalty",
    label: "Loyalty",
    description: "Stamp cards and top spender",
    fase: "E3",
  },
  {
    href: "/action-center",
    label: "To-do",
    description: "Tasks for the team",
    fase: "E1",
    comingLater: true,
  },
  {
    href: "/reports",
    label: "Reports",
    description: "Loyalty this month",
    fase: "E1",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Connections, name, language, and logins",
    fase: "E0",
  },
];
