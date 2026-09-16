/** Catalog of APIs AtlasNow will use — configured in Settings → API Configuration. */

export type IntegrationField = {
  key: string;
  label: string;
  kind: "text" | "password" | "url" | "select";
  secret?: boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  envFallback?: string;
};

export type IntegrationDefinition = {
  provider: string;
  name: string;
  category: "google" | "maps" | "messaging" | "ads" | "other";
  description: string;
  phase: string;
  /** Where runtime OAuth / sync happens after credentials are set */
  opsHref?: string;
  opsLabel?: string;
  fields: IntegrationField[];
  modes: Array<"AUTO" | "LIVE" | "MOCK" | "OFF">;
};

export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  {
    provider: "google_business_profile",
    name: "Google Business Profile",
    category: "google",
    description:
      "Agency OAuth for listing, mapping, and pushing store profile data (Business Information API).",
    phase: "S3 · live",
    opsHref: "/settings/google",
    opsLabel: "Open Data Health",
    modes: ["AUTO", "LIVE", "OFF"],
    fields: [
      {
        key: "clientId",
        label: "OAuth Client ID",
        kind: "text",
        secret: false,
        envFallback: "GOOGLE_CLIENT_ID",
        placeholder: "….apps.googleusercontent.com",
      },
      {
        key: "clientSecret",
        label: "OAuth Client Secret",
        kind: "password",
        secret: true,
        envFallback: "GOOGLE_CLIENT_SECRET",
      },
      {
        key: "redirectUri",
        label: "Redirect URI (optional override)",
        kind: "url",
        secret: false,
        envFallback: "GOOGLE_REDIRECT_URI",
        help: "Leave blank to use APP_BASE_URL. This field is the Business Profile callback only. Also register https://atlasnow.co/api/auth/google/callback (and localhost) for Sign up with Google — that path is identity, not listings.",
        placeholder: "https://atlasnow.co/api/google/oauth/callback",
      },
    ],
  },
  {
    provider: "google_maps",
    name: "Google Maps / Geocoding",
    category: "maps",
    description:
      "Geocoding + Places for “Fetch from Maps URL” (address, coordinates, phone, website). Without a key, AtlasNow falls back to OpenStreetMap Nominatim (rarely has phone).",
    phase: "S2 · live",
    modes: ["AUTO", "LIVE", "OFF"],
    fields: [
      {
        key: "apiKey",
        label: "Maps / Places API key",
        kind: "password",
        secret: true,
        envFallback: "GOOGLE_MAPS_API_KEY",
        help: "Enable Geocoding API + Places API on this key. Env fallbacks: GOOGLE_MAPS_API_KEY, GOOGLE_PLACES_API_KEY.",
      },
    ],
  },
  {
    provider: "nominatim",
    name: "OpenStreetMap Nominatim",
    category: "maps",
    description: "Default free reverse-geocode for Maps URL import. No key required.",
    phase: "S2 · live",
    modes: ["AUTO", "LIVE", "OFF"],
    fields: [
      {
        key: "userAgent",
        label: "User-Agent (optional)",
        kind: "text",
        secret: false,
        placeholder: "AtlasNow/1.0 (P2P Labs)",
        help: "Nominatim policy: identify your app. Leave blank for default.",
      },
      {
        key: "baseUrl",
        label: "Base URL (optional)",
        kind: "url",
        secret: false,
        placeholder: "https://nominatim.openstreetmap.org",
      },
    ],
  },
  {
    provider: "google_search_console",
    name: "Google Search Console",
    category: "google",
    description: "Local search / query demand signals per location (planned).",
    phase: "S5 · planned",
    modes: ["OFF", "AUTO", "LIVE", "MOCK"],
    fields: [
      {
        key: "clientId",
        label: "OAuth Client ID",
        kind: "text",
        secret: false,
        help: "Can reuse Google Cloud OAuth client with GSC scopes later.",
      },
      {
        key: "clientSecret",
        label: "OAuth Client Secret",
        kind: "password",
        secret: true,
      },
    ],
  },
  {
    provider: "google_ads",
    name: "Google Ads",
    category: "ads",
    description: "Local ads assets, campaigns, and voucher performance (planned).",
    phase: "E2 · planned",
    modes: ["OFF", "AUTO", "LIVE", "MOCK"],
    fields: [
      {
        key: "developerToken",
        label: "Developer token",
        kind: "password",
        secret: true,
      },
      {
        key: "clientId",
        label: "OAuth Client ID",
        kind: "text",
        secret: false,
      },
      {
        key: "clientSecret",
        label: "OAuth Client Secret",
        kind: "password",
        secret: true,
      },
      {
        key: "loginCustomerId",
        label: "Login customer ID (MCC)",
        kind: "text",
        secret: false,
        placeholder: "123-456-7890",
      },
    ],
  },
  {
    provider: "waha",
    name: "WAHA (WhatsApp bridge)",
    category: "messaging",
    description:
      "Temporary WhatsApp HTTP bridge until Meta Cloud API is approved. Conversations module.",
    phase: "E3 · temp",
    modes: ["OFF", "LIVE", "MOCK"],
    fields: [
      {
        key: "baseUrl",
        label: "WAHA base URL",
        kind: "url",
        secret: false,
        placeholder: "http://localhost:3001",
        envFallback: "WAHA_BASE_URL",
      },
      {
        key: "apiKey",
        label: "API key",
        kind: "password",
        secret: true,
        envFallback: "WAHA_API_KEY",
      },
      {
        key: "session",
        label: "Session name",
        kind: "text",
        secret: false,
        placeholder: "default",
        envFallback: "WAHA_SESSION",
      },
    ],
  },
  {
    provider: "meta",
    name: "Meta (Messenger + Instagram)",
    category: "messaging",
    description:
      "Facebook Login for Business so each client connects their Page and Instagram. DMs land in Conversations.",
    phase: "E3.2 · live",
    opsHref: "/settings/chat-apps",
    opsLabel: "Open Chat apps",
    modes: ["OFF", "LIVE"],
    fields: [
      {
        key: "appId",
        label: "Meta App ID",
        kind: "text",
        secret: false,
        envFallback: "META_APP_ID",
        placeholder: "1234567890",
      },
      {
        key: "appSecret",
        label: "Meta App Secret",
        kind: "password",
        secret: true,
        envFallback: "META_APP_SECRET",
      },
      {
        key: "verifyToken",
        label: "Webhook verify token",
        kind: "password",
        secret: true,
        envFallback: "META_VERIFY_TOKEN",
        help: "Same string you paste in Meta App → Webhooks. Default atlasnow-meta if empty.",
      },
      {
        key: "redirectUri",
        label: "OAuth redirect (optional)",
        kind: "url",
        secret: false,
        envFallback: "META_REDIRECT_URI",
        help: "This field is the Page-connect callback. Production: https://atlasnow.co/api/meta/oauth/callback. Also register https://atlasnow.co/api/auth/facebook/callback (and localhost) for Sign up with Facebook — email + name only, not Pages.",
        placeholder: "https://atlasnow.co/api/meta/oauth/callback",
      },
      {
        key: "loginConfigId",
        label: "Facebook Login for Business config ID",
        kind: "text",
        secret: false,
        envFallback: "META_LOGIN_CONFIG_ID",
        help: "From App Dashboard → Facebook Login for Business → Configurations. Used only for Channels → Connect Meta (Pages + IG inbox). Sign up with Facebook stays email/name only.",
        placeholder: "2295500691270291",
      },
      {
        key: "whatsappEsConfigId",
        label: "WhatsApp Embedded Signup config ID (v4)",
        kind: "text",
        secret: false,
        envFallback: "META_WHATSAPP_ES_CONFIG_ID",
        help: "Separate configuration: Login variation WhatsApp Embedded Signup, Cloud API only. Not the Pages+IG config. Chat apps → Connect WhatsApp.",
        placeholder: "1401943948578182",
      },
    ],
  },
  {
    provider: "meta_whatsapp",
    name: "Meta WhatsApp Cloud API",
    category: "messaging",
    description:
      "Platform webhook (verify token + app secret). Each brand connects its HQ WABA number in Chat apps.",
    phase: "E3 · live",
    opsHref: "/settings/chat-apps",
    opsLabel: "Open Chat apps",
    modes: ["OFF", "LIVE", "MOCK"],
    fields: [
      {
        key: "phoneNumberId",
        label: "Phone number ID",
        kind: "text",
        secret: false,
      },
      {
        key: "wabaId",
        label: "WhatsApp Business Account ID",
        kind: "text",
        secret: false,
      },
      {
        key: "accessToken",
        label: "System user access token",
        kind: "password",
        secret: true,
      },
      {
        key: "appSecret",
        label: "App secret (webhooks)",
        kind: "password",
        secret: true,
        envFallback: "META_APP_SECRET",
        help: "Same Meta app as Messenger. Webhook URL: https://atlasnow.co/api/webhooks/whatsapp",
      },
      {
        key: "verifyToken",
        label: "Webhook verify token",
        kind: "password",
        secret: true,
        envFallback: "META_VERIFY_TOKEN",
        help: "Paste the same string in Meta App → WhatsApp → Configuration → Webhook.",
      },
    ],
  },
  {
    provider: "tiktok",
    name: "TikTok Business Messaging",
    category: "messaging",
    description:
      "Official TikTok Business Direct inbox. Each brand connects 1..N Business accounts in Chat apps. Webhook: https://atlasnow.co/api/webhooks/tiktok",
    phase: "Wave A · inbox",
    opsHref: "/settings/chat-apps",
    opsLabel: "Open Chat apps",
    modes: ["OFF", "LIVE"],
    fields: [
      {
        key: "clientKey",
        label: "TikTok client key",
        kind: "text",
        secret: false,
        envFallback: "TIKTOK_CLIENT_KEY",
        help: "From developers.tiktok.com → AtlasNow app. Not a Meta or Sorak key.",
      },
      {
        key: "clientSecret",
        label: "TikTok client secret",
        kind: "password",
        secret: true,
        envFallback: "TIKTOK_CLIENT_SECRET",
      },
      {
        key: "webhookSecret",
        label: "Webhook secret",
        kind: "password",
        secret: true,
        envFallback: "TIKTOK_WEBHOOK_SECRET",
        help: "Same string TikTok signs DIRECT_MESSAGE webhooks with. Callback: https://atlasnow.co/api/webhooks/tiktok",
      },
      {
        key: "redirectUri",
        label: "OAuth redirect URI (optional override)",
        kind: "url",
        secret: false,
        envFallback: "TIKTOK_REDIRECT_URI",
        placeholder: "https://atlasnow.co/api/tiktok/oauth/callback",
        help: "Leave blank to use APP_BASE_URL + /api/tiktok/oauth/callback.",
      },
    ],
  },
  {
    provider: "tiktok_go",
    name: "TikTok GO Dining",
    category: "messaging",
    description:
      "Platform fallback only. Brands connect per tenant in Chat apps → TikTok GO till (merchant ID + token). Not inbox DMs. Not a stamp.",
    phase: "Wave A · GO till",
    opsHref: "/loyalty",
    opsLabel: "Open Loyalty till",
    modes: ["OFF", "LIVE"],
    fields: [
      {
        key: "merchantId",
        label: "TikTok GO merchant ID",
        kind: "text",
        secret: false,
        envFallback: "TIKTOK_GO_MERCHANT_ID",
        help: "From TikTok GO Merchant Portal. Same AtlasNow client key as Local Service API.",
      },
      {
        key: "accessToken",
        label: "Merchant access token",
        kind: "password",
        secret: true,
        envFallback: "TIKTOK_GO_ACCESS_TOKEN",
        help: "From POST open.tiktokapis.com/merchant/oauth/token/ — not the Login Kit secret.",
      },
    ],
  },
  {
    provider: "app_base",
    name: "App base URL",
    category: "other",
    description: "Public URL used for OAuth callbacks and absolute links.",
    phase: "E0 · live",
    modes: ["AUTO", "LIVE"],
    fields: [
      {
        key: "baseUrl",
        label: "APP_BASE_URL",
        kind: "url",
        secret: false,
        envFallback: "APP_BASE_URL",
        placeholder: "https://atlasnow.co",
        help: "Production: https://atlasnow.co · Local: http://localhost:3000",
      },
    ],
  },
  {
    provider: "smtp",
    name: "Outbound email (Contact us)",
    category: "other",
    description:
      "Sends the public Contact form via Google Workspace (smtp.gmail.com:587). Save does not send mail — use Kirim tes. If From and Deliver to are both hello@, Gmail only shows it in Sent, not Inbox.",
    phase: "E0 · live",
    opsHref: "/settings/pages",
    opsLabel: "Open Pages",
    modes: ["AUTO", "LIVE", "OFF"],
    fields: [
      {
        key: "host",
        label: "SMTP host",
        kind: "text",
        secret: false,
        envFallback: "SMTP_HOST",
        placeholder: "smtp.gmail.com",
      },
      {
        key: "port",
        label: "Port",
        kind: "text",
        secret: false,
        envFallback: "SMTP_PORT",
        placeholder: "587",
        help: "Google Workspace: 587 STARTTLS. 465 SSL also works.",
      },
      {
        key: "user",
        label: "Username",
        kind: "text",
        secret: false,
        envFallback: "SMTP_USER",
        placeholder: "hello@atlasnow.co",
      },
      {
        key: "password",
        label: "App Password",
        kind: "password",
        secret: true,
        envFallback: "SMTP_PASS",
        help: "Google Admin / account → 2-Step Verification → App passwords. Not the Workspace login password.",
      },
      {
        key: "from",
        label: "From (optional)",
        kind: "text",
        secret: false,
        envFallback: "SMTP_FROM",
        placeholder: "AtlasNow <hello@atlasnow.co>",
        help: "Must be the Workspace mailbox that owns the App Password (hello@atlasnow.co).",
      },
      {
        key: "to",
        label: "Deliver to",
        kind: "text",
        secret: false,
        envFallback: "SMTP_TO",
        placeholder: "dennies@p2plabs.asia",
        help: "Where Contact form mail lands. Empty = hello@atlasnow.co. Put a different mailbox than Username so Gmail shows it in Inbox (not only Sent).",
      },
      {
        key: "secure",
        label: "Secure (true/false)",
        kind: "text",
        secret: false,
        envFallback: "SMTP_SECURE",
        placeholder: "false",
        help: "Google Workspace on 587: false. Port 465: true.",
      },
    ],
  },
];

export function getIntegrationDef(provider: string): IntegrationDefinition | undefined {
  return INTEGRATION_CATALOG.find((d) => d.provider === provider);
}

export function categoryLabel(category: IntegrationDefinition["category"]): string {
  switch (category) {
    case "google":
      return "Google";
    case "maps":
      return "Maps & geocode";
    case "messaging":
      return "Messaging";
    case "ads":
      return "Ads";
    default:
      return "Platform";
  }
}
