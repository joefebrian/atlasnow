import type { SocialId, SocialLinks } from "@/lib/social";
import { SOCIAL_LABELS, socialList } from "@/lib/social";

function Icon({ id }: { id: SocialId }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-[18px] w-[18px]",
    fill: "currentColor",
    "aria-hidden": true as const,
  };
  switch (id) {
    case "instagram":
      return (
        <svg {...common}>
          <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.8A4.2 4.2 0 1 0 16.2 12 4.2 4.2 0 0 0 12 7.8zm0 6.9A2.7 2.7 0 1 1 14.7 12 2.7 2.7 0 0 1 12 14.7zM17.6 6.4a1 1 0 1 0 1 1 1 1 0 0 0-1-1z" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
        </svg>
      );
    case "threads":
      return (
        <svg {...common}>
          <path d="M16.7 9.3a6.7 6.7 0 0 0-1.2-.4 4.5 4.5 0 0 0-3.2-4.4V3h-2.1v1.4A6.6 6.6 0 0 0 6 10.3c0 3.4 2.6 5.5 6.3 5.5 1.2 0 2.3-.2 3.2-.6.2 1.1.2 2.1-.2 2.9-.5 1.1-1.6 1.7-3.4 1.7-2.4 0-3.7-1.1-4.1-2.2l-1.9.8c.7 1.9 2.7 3.4 6 3.4 2.6 0 4.5-1 5.4-2.8.8-1.6.7-3.6.4-5.2 1-.8 1.7-1.9 1.7-3.4 0-1.4-.6-2.6-1.7-3.1zm-4.4 4.7c-2.1 0-4.1-1.2-4.1-3.7A4.5 4.5 0 0 1 11.3 6v.8a3.3 3.3 0 0 0-1.7 2.9c0 1.3.9 2.2 2.7 2.2.6 0 1.2-.1 1.7-.3-.2.8-.7 1.4-1.7 1.4zm4.2-3.4c0 .8-.4 1.5-1 2 .3-.7.4-1.4.4-2.1 0-.5 0-1-.2-1.4.3.4.8 1 .8 1.5z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14.2 3h2.4a5.7 5.7 0 0 0 5.4 5.1v2.4a8 8 0 0 1-4.6-1.5v7.3A7.3 7.3 0 1 1 10 8.9v2.5a4.8 4.8 0 1 0 4.2 4.7V3z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M14.7 10.3 22 2h-2.2l-6.3 7.1L8.4 2H2.5l7.7 11.1L2.5 22h2.2l6.8-7.6L15.7 22h5.9L14.7 10.3zM12 13.3l-.8-1.1L5.3 3.5h2.7l4.9 7 0.8 1.1 6.5 9h-2.7L12 13.3z" />
        </svg>
      );
  }
}

export function PublicSocialLinks({
  links,
  tone = "dark",
}: {
  links: SocialLinks;
  tone?: "dark" | "light";
}) {
  const items = socialList(links);
  if (!items.length) return null;
  const hover = tone === "light" ? "hover:text-slate-900" : "hover:text-white";

  return (
    <nav className="flex items-center gap-1" aria-label="Social">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={SOCIAL_LABELS[item.id]}
          title={SOCIAL_LABELS[item.id]}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-current transition-colors ${hover}`}
        >
          {item.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.icon} alt="" className="h-[18px] w-[18px] object-contain" />
          ) : (
            <Icon id={item.id} />
          )}
        </a>
      ))}
    </nav>
  );
}
