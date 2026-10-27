/** Minimal line icons for sidebar (plugins-style clarity). */

export function NavIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const c = className;
  switch (name) {
    case "clients":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74" strokeLinecap="round" />
        </svg>
      );
    case "tower":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 20h16M6 20V10l6-6 6 6v10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20v-5h4v5" strokeLinecap="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
        </svg>
      );
    case "pin":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "star":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="m12 3 2.4 6.5H21l-5.2 4 2 6.5L12 16.5 6.2 20l2-6.5L3 9.5h6.6L12 3z" strokeLinejoin="round" />
        </svg>
      );
    case "post":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9h10M7 13h6" strokeLinecap="round" />
        </svg>
      );
    case "ads":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 8h11l5 4-5 4H4V8z" strokeLinejoin="round" />
          <path d="M8 12h4" strokeLinecap="round" />
        </svg>
      );
    case "chat":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 3v-3H6a2 2 0 0 1-2-2V6z" strokeLinejoin="round" />
        </svg>
      );
    case "broadcast":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 10v4h3l5 4V6L7 10H4z" strokeLinejoin="round" />
          <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7.5a7 7 0 0 1 0 9" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "health":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M12 3v18M3 12h18M7 7l10 10M17 7 7 17" strokeLinecap="round" />
        </svg>
      );
    case "report":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M5 19V9M10 19V5M15 19v-7M20 19V8" strokeLinecap="round" />
        </svg>
      );
    case "deck":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="5" width="18" height="12" rx="2" />
          <path d="M8 21h8M12 17v4" strokeLinecap="round" />
        </svg>
      );
    case "bag":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M6 8h12l-1 12H7L6 8Z" strokeLinejoin="round" />
          <path d="M9 8V7a3 3 0 0 1 6 0v1" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

export const NAV_ICON_KEY: Record<string, string> = {
  "/agencies": "clients",
  "/agencies/follow-up": "bolt",
  "/clients": "clients",
  "/clients/follow-up": "bolt",
  "/deck_pitch": "deck",
  "/deck_train": "deck",
  "/activity": "bolt",
  "/support": "chat",
  "/billing": "report",
  "/control-tower": "tower",
  "/leakage-queue": "bolt",
  "/locations": "pin",
  "/reputation": "star",
  "/posts": "post",
  "/ads": "ads",
  "/channels": "chat",
  "/conversations": "chat",
  "/broadcast": "broadcast",
  "/commerce": "bag",
  "/yola": "bag",
  "/customers": "clients",
  "/loyalty": "star",
  "/action-center": "check",
  "/data-health": "health",
  "/reports": "report",
  "/settings": "settings",
};
