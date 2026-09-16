export const SOCIAL_IDS = ["instagram", "facebook", "threads", "tiktok", "x"] as const;

export type SocialId = (typeof SOCIAL_IDS)[number];

export type SocialItem = {
  href: string;
  icon: string | null;
};

export type SocialLinks = Record<SocialId, SocialItem>;

export const SOCIAL_LABELS: Record<SocialId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  tiktok: "TikTok",
  x: "X",
};

export const SOCIAL_URL_HINT: Record<SocialId, string> = {
  instagram: "https://www.instagram.com/yourhandle/",
  facebook: "https://www.facebook.com/yourpage",
  threads: "https://www.threads.com/@yourhandle",
  tiktok: "https://www.tiktok.com/@yourhandle",
  x: "https://x.com/yourhandle",
};

export const SOCIAL_ICON_MAX_BYTES = 80_000;
export const SOCIAL_ICON_MAX_CHARS = 120_000;

export const DEFAULT_SOCIAL: SocialLinks = {
  instagram: { href: "https://www.instagram.com/atlasnow.co/", icon: null },
  facebook: { href: "https://www.facebook.com/atlasnow.co", icon: null },
  threads: { href: "https://www.threads.com/@atlasnow.co", icon: null },
  tiktok: { href: "https://www.tiktok.com/@atlasnow.co", icon: null },
  x: { href: "https://x.com/atlasnow.co", icon: null },
};

const HOST: Record<SocialId, RegExp> = {
  instagram: /^https:\/\/(www\.)?instagram\.com\/.+/i,
  facebook: /^https:\/\/(www\.)?(facebook|fb)\.com\/.+/i,
  threads: /^https:\/\/(www\.)?threads\.(net|com)\/.+/i,
  tiktok: /^https:\/\/(www\.)?tiktok\.com\/.+/i,
  x: /^https:\/\/(www\.)?(x|twitter)\.com\/.+/i,
};

const ICON_MIME = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i;

export function item(href = "", icon: string | null = null): SocialItem {
  return { href, icon };
}

export function sanitizeSocialUrl(id: SocialId, raw: unknown): string {
  if (typeof raw !== "string") return "";
  const url = raw.trim();
  if (!url) return "";
  if (!HOST[id].test(url)) return "";
  return url.slice(0, 300);
}

export function sanitizeSocialIcon(raw: unknown): string | null {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (!ICON_MIME.test(value)) return null;
  if (value.length > SOCIAL_ICON_MAX_CHARS) return null;
  return value;
}

function asItem(id: SocialId, value: unknown, fallback: SocialItem): SocialItem {
  if (value === "" || value === null) return item("", fallback.icon);
  if (typeof value === "string") {
    const href = sanitizeSocialUrl(id, value);
    return item(href || fallback.href, fallback.icon);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const hrefRaw = rec.href ?? rec.url;
    const href =
      hrefRaw === ""
        ? ""
        : sanitizeSocialUrl(id, hrefRaw) || fallback.href;
    const icon =
      rec.icon === undefined ? fallback.icon : sanitizeSocialIcon(rec.icon);
    return item(href, icon);
  }
  return { ...fallback };
}

export function parseSocialJson(
  json: string | null | undefined,
  fallback = DEFAULT_SOCIAL
): SocialLinks {
  const out: SocialLinks = {
    instagram: { ...fallback.instagram },
    facebook: { ...fallback.facebook },
    threads: { ...fallback.threads },
    tiktok: { ...fallback.tiktok },
    x: { ...fallback.x },
  };
  if (!json) return out;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
    const rec = parsed as Record<string, unknown>;
    for (const id of SOCIAL_IDS) {
      if (rec[id] === undefined) continue;
      out[id] = asItem(id, rec[id], fallback[id]);
    }
  } catch {
    /* keep fallback */
  }
  return out;
}

export function socialList(
  links: SocialLinks
): Array<{ id: SocialId; href: string; icon: string | null }> {
  return SOCIAL_IDS.filter((id) => links[id].href).map((id) => ({
    id,
    href: links[id].href,
    icon: links[id].icon,
  }));
}

export function mergeSocialItem(
  id: SocialId,
  incoming: Partial<SocialItem> | string | undefined,
  current: SocialItem
): SocialItem {
  if (incoming === undefined) return current;
  if (typeof incoming === "string") {
    return item(sanitizeSocialUrl(id, incoming), current.icon);
  }
  return item(
    incoming.href !== undefined ? sanitizeSocialUrl(id, incoming.href) : current.href,
    incoming.icon !== undefined ? sanitizeSocialIcon(incoming.icon) : current.icon
  );
}
