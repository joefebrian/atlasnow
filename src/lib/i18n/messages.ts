import type { Locale } from "@/lib/i18n/locale";

export type Messages = {
  nav: {
    groups: {
      admin: string;
      operate: string;
      google: string;
      demand: string;
      workspace: string;
    };
    items: Record<string, { label: string; description: string }>;
    logout: string;
    activeTenant: string;
    live: string;
  };
  shell: {
    searchPlaceholder: string;
    demoUi: string;
  };
  login: {
    signInTitle: string;
    signInHint: string;
    email: string;
    password: string;
    continue: string;
    signingIn: string;
    demoCredentials: string;
    loginFailed: string;
    networkError: string;
    phaseNote: string;
  };
  controlTower: {
    eyebrow: string;
    badge: string;
    title: string;
    reviews: string;
    posts: string;
    settings: string;
    connectData: string;
    brandPromise: string;
    growthFlow: string;
    demoBanner: string;
    performanceOverview: string;
    samplePeriod: string;
    storesNeedingAction: string;
    storesHint: string;
    teamMembers: string;
    teamHint: string;
    auditEvents: string;
    auditHint: string;
    connectors: string;
    connectorsHint: string;
    live: string;
  };
  settings: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    hubDescription: string;
    navOverview: string;
    navOverviewHint: string;
    navBranding: string;
    navBrandingHint: string;
    navApi: string;
    navApiHint: string;
    hubBrandingBody: string;
    hubApiBody: string;
    hubApiMeta: string;
    openSection: string;
    agencyOnly: string;
    apiBadge: string;
    apiDescription: string;
    panel: string;
    scope: string;
    storage: string;
    language: string;
    languageHint: string;
    branding: string;
    appIdentity: string;
    appIdentityHint: string;
    messagingEn: string;
    messagingEnHint: string;
    messagingId: string;
    messagingIdHint: string;
    appName: string;
    monogram: string;
    logoImage: string;
    uploadLogo: string;
    clearLogo: string;
    logoHint: string;
    primaryColor: string;
    supportEmail: string;
    tagline: string;
    hero: string;
    narrative: string;
    promise: string;
    flow: string;
    flowHint: string;
    save: string;
    saving: string;
    reset: string;
    saved: string;
    saveFailed: string;
    logoNotImage: string;
    logoTooLarge: string;
  };
  brandStory: {
    brandPromise: string;
    growthFlow: string;
  };
  clients: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    newClient: string;
    total: string;
    loginOn: string;
    loginOff: string;
    empty: string;
    emptyHint: string;
    colName: string;
    colIndustry: string;
    colContact: string;
    colLogin: string;
    colUsers: string;
    colStatus: string;
    view: string;
    agencyOnly: string;
  };
  conversations: {
    eyebrow: string;
    badge: string;
    title: string;
    description: string;
    unreplied: string;
    search: string;
    filterAll: string;
    filterUnreplied: string;
    allLocations: string;
    colLast: string;
    colContact: string;
    colPreview: string;
    colBranch: string;
    colDirection: string;
    view: string;
    emptyNoMap: string;
    emptyWait: string;
    accountResponder: string;
    agencyOnly: string;
    sourceHint: string;
  };
};

const en: Messages = {
  nav: {
    groups: {
      admin: "Admin",
      operate: "Operate",
      google: "Google surface",
      demand: "Demand & insight",
      workspace: "Workspace",
    },
    items: {
      "/clients": {
        label: "Clients",
        description: "Client database & login",
      },
      "/control-tower": {
        label: "Control Tower",
        description: "Stores needing action now",
      },
      "/leakage-queue": {
        label: "Leakage Queue",
        description: "Signals & triage",
      },
      "/locations": {
        label: "Locations",
        description: "Location Master & 360",
      },
      "/reputation": {
        label: "Reputation",
        description: "Reviews, themes, SLA",
      },
      "/posts": {
        label: "Posts & Offers",
        description: "Calendar, offers, moderation",
      },
      "/ads": {
        label: "Ads & Vouchers",
        description: "Assets, campaigns, redemptions",
      },
      "/conversations": {
        label: "Conversations",
        description: "WAHA prototype → Meta Cloud API",
      },
      "/action-center": {
        label: "Action Center",
        description: "Tasks, approvals, proof",
      },
      "/data-health": {
        label: "Data Health",
        description: "Connectors, mappings, freshness",
      },
      "/reports": {
        label: "Reports",
        description: "Weekly ops & executive",
      },
      "/settings": {
        label: "Settings",
        description: "Branding, language & APIs",
      },
    },
    logout: "Log out",
    activeTenant: "Active tenant",
    live: "Live",
  },
  shell: {
    searchPlaceholder: "Search locations, reviews, actions…",
    demoUi: "Demo UI",
  },
  login: {
    signInTitle: "Sign in to workspace",
    signInHint: "Agency staff: P2P Labs. Clients: use activated credentials.",
    email: "Email",
    password: "Password",
    continue: "Continue",
    signingIn: "Signing in…",
    demoCredentials: "Agency demo credentials",
    loginFailed: "Login failed",
    networkError: "Network error",
    phaseNote: "Agency admin · client login after activation",
  },
  controlTower: {
    eyebrow: "Google Business Profile",
    badge: "Demo metrics · honest labels",
    title: "Performance",
    reviews: "Reviews",
    posts: "Posts",
    settings: "Settings",
    connectData: "Connect data",
    brandPromise: "Brand promise",
    growthFlow: "Growth flow",
    demoBanner:
      "Control tower preview. KPI cards mix live tenant facts (team, audit) with Google Business Profile–shaped demo series. No fake visits, leads, or revenue — directions stay labeled as visit intent. Edit brand copy in Settings.",
    performanceOverview: "Google Business Profile performance overview",
    samplePeriod: "Sample period · last 28 days (demo)",
    storesNeedingAction: "Stores needing action",
    storesHint: "Populated after leakage engine (S6)",
    teamMembers: "Team members",
    teamHint: "Active memberships on this tenant",
    auditEvents: "Audit events",
    auditHint: "Login, seed, and system trail",
    connectors: "Connectors",
    connectorsHint: "Google OAuth + Google Business Profile in S3",
    live: "Live",
  },
  settings: {
    eyebrow: "Workspace",
    badge: "Configuration hub",
    title: "Settings",
    description:
      "Update app presentation — logo, bilingual brand copy, and growth flow. Changes apply to login, sidebar, and Control Tower.",
    hubDescription:
      "Workspace configuration in one place: branding, language, and API credentials for every integration AtlasNow uses.",
    navOverview: "Overview",
    navOverviewHint: "Hub & language",
    navBranding: "Branding",
    navBrandingHint: "Logo & product copy",
    navApi: "API Configuration",
    navApiHint: "Keys, OAuth, modes",
    hubBrandingBody:
      "Logo, monogram, primary color, and bilingual messaging used across login, sidebar, and Control Tower.",
    hubApiBody:
      "Google Business Profile, Maps, WhatsApp (WAHA / Meta), Ads, Search Console — credentials and mock/live mode.",
    hubApiMeta: "configured or mock-ready",
    openSection: "Open",
    agencyOnly: "Agency staff only. Client users manage brand experience on Branding.",
    apiBadge: "Integrations",
    apiDescription:
      "Central registry for every external API. Save credentials here, then run OAuth / sync from Data Health or the module that owns the workflow.",
    panel: "Panel",
    scope: "Scope",
    storage: "Storage",
    language: "Interface language",
    languageHint: "English is the default product language. Switch to Bahasa Indonesia anytime.",
    branding: "Branding",
    appIdentity: "App identity",
    appIdentityHint: "Logo and name shown in sidebar, login, and shell.",
    messagingEn: "Messaging · English (primary)",
    messagingEnHint: "Canonical product language. Use this for decks, PRD, and sales.",
    messagingId: "Messaging · Bahasa Indonesia",
    messagingIdHint: "Optional localization when the interface language is set to ID.",
    appName: "App name",
    monogram: "Monogram letter",
    logoImage: "Logo image",
    uploadLogo: "Upload logo",
    clearLogo: "Clear logo",
    logoHint: "PNG / JPG / WebP · max ~600KB",
    primaryColor: "Primary color",
    supportEmail: "Support email",
    tagline: "Tagline",
    hero: "Hero headline",
    narrative: "Supporting narrative",
    promise: "Core product promise",
    flow: "Growth flow (one step per line)",
    flowHint: "Default: Optimize location assets → … → Generate measurable outcomes",
    save: "Save branding",
    saving: "Saving…",
    reset: "Reset form",
    saved: "Branding saved. UI refreshed.",
    saveFailed: "Save failed",
    logoNotImage: "File must be an image (PNG, JPG, SVG, WebP).",
    logoTooLarge: "Logo max ~600KB. Compress first or use a monogram.",
  },
  brandStory: {
    brandPromise: "Brand promise",
    growthFlow: "Growth flow",
  },
  clients: {
    eyebrow: "Agency admin",
    badge: "Client database",
    title: "Clients",
    description:
      "Create brand clients, store contact data, and activate workspace login when ready.",
    newClient: "New client",
    total: "Total clients",
    loginOn: "Login active",
    loginOff: "Login inactive",
    empty: "No clients yet",
    emptyHint: "Add your first brand client to start managed-service onboarding.",
    colName: "Client",
    colIndustry: "Industry",
    colContact: "Contact",
    colLogin: "Login",
    colUsers: "Users",
    colStatus: "Status",
    view: "Open",
    agencyOnly: "This area is for agency staff only.",
  },
  conversations: {
    eyebrow: "Demand",
    badge: "WAHA live · monitor-only",
    title: "Conversations",
    description: "WhatsApp threads from mapped branch numbers. Monitor only — no send.",
    unreplied: "unreplied",
    search: "Search phone, lid, or text…",
    filterAll: "All",
    filterUnreplied: "Unreplied",
    allLocations: "All branches",
    colLast: "Last",
    colContact: "Contact",
    colPreview: "Preview",
    colBranch: "Branch",
    colDirection: "Dir",
    view: "View",
    emptyNoMap: "Map a WAHA session on Location 360 → Sources.",
    emptyWait: "Waiting for webhook messages.",
    accountResponder: "Account responder",
    agencyOnly: "Agency staff monitor WhatsApp conversations.",
    sourceHint: "Source: WAHA. Session must be mapped to a location. Phone shown when WhatsApp sent it; @lid is never turned into a fake number.",
  },
};

const id: Messages = {
  nav: {
    groups: {
      admin: "Admin",
      operate: "Operasi",
      google: "Permukaan Google",
      demand: "Demand & insight",
      workspace: "Workspace",
    },
    items: {
      "/clients": {
        label: "Klien",
        description: "Database klien & login",
      },
      "/control-tower": {
        label: "Control Tower",
        description: "Cabang yang perlu tindakan sekarang",
      },
      "/leakage-queue": {
        label: "Antrian Leakage",
        description: "Sinyal & triase",
      },
      "/locations": {
        label: "Lokasi",
        description: "Location Master & 360",
      },
      "/reputation": {
        label: "Reputasi",
        description: "Ulasan, tema, SLA",
      },
      "/posts": {
        label: "Post & Penawaran",
        description: "Kalender, penawaran, moderasi",
      },
      "/ads": {
        label: "Iklan & Voucher",
        description: "Aset, kampanye, redeem",
      },
      "/conversations": {
        label: "Percakapan",
        description: "Prototipe WAHA → Meta Cloud API",
      },
      "/action-center": {
        label: "Pusat Aksi",
        description: "Tugas, persetujuan, bukti",
      },
      "/data-health": {
        label: "Kesehatan Data",
        description: "Konektor, mapping, freshness",
      },
      "/reports": {
        label: "Laporan",
        description: "Ops mingguan & eksekutif",
      },
      "/settings": {
        label: "Pengaturan",
        description: "Branding, bahasa & API",
      },
    },
    logout: "Keluar",
    activeTenant: "Tenant aktif",
    live: "Live",
  },
  shell: {
    searchPlaceholder: "Cari lokasi, ulasan, aksi…",
    demoUi: "UI Demo",
  },
  login: {
    signInTitle: "Masuk ke workspace",
    signInHint: "Staf agen: P2P Labs. Klien: gunakan kredensial yang diaktifkan.",
    email: "Email",
    password: "Kata sandi",
    continue: "Lanjut",
    signingIn: "Sedang masuk…",
    demoCredentials: "Kredensial demo agen",
    loginFailed: "Login gagal",
    networkError: "Kesalahan jaringan",
    phaseNote: "Admin agen · login klien setelah aktivasi",
  },
  controlTower: {
    eyebrow: "Google Business Profile",
    badge: "Metrik demo · label jujur",
    title: "Performa",
    reviews: "Ulasan",
    posts: "Post",
    settings: "Pengaturan",
    connectData: "Hubungkan data",
    brandPromise: "Janji merek",
    growthFlow: "Alur pertumbuhan",
    demoBanner:
      "Pratinjau control tower. Kartu KPI menggabungkan fakta tenant live (tim, audit) dengan seri demo berbentuk Google Business Profile. Tidak ada kunjungan, lead, atau revenue palsu — directions tetap dilabeli sebagai niat kunjung. Edit copy merek di Pengaturan.",
    performanceOverview: "Ringkasan performa Google Business Profile",
    samplePeriod: "Periode contoh · 28 hari terakhir (demo)",
    storesNeedingAction: "Cabang yang perlu tindakan",
    storesHint: "Terisi setelah leakage engine (S6)",
    teamMembers: "Anggota tim",
    teamHint: "Membership aktif di tenant ini",
    auditEvents: "Event audit",
    auditHint: "Login, seed, dan jejak sistem",
    connectors: "Konektor",
    connectorsHint: "Google OAuth + Google Business Profile di S3",
    live: "Live",
  },
  settings: {
    eyebrow: "Workspace",
    badge: "Pusat konfigurasi",
    title: "Pengaturan",
    description:
      "Perbarui tampilan aplikasi — logo, copy merek bilingual, dan alur pertumbuhan. Perubahan berlaku di login, sidebar, dan Control Tower.",
    hubDescription:
      "Konfigurasi workspace di satu tempat: branding, bahasa, dan kredensial API untuk setiap integrasi AtlasNow.",
    navOverview: "Ringkasan",
    navOverviewHint: "Hub & bahasa",
    navBranding: "Branding",
    navBrandingHint: "Logo & copy produk",
    navApi: "Konfigurasi API",
    navApiHint: "Key, OAuth, mode",
    hubBrandingBody:
      "Logo, monogram, warna utama, dan pesan bilingual di login, sidebar, dan Control Tower.",
    hubApiBody:
      "Google Business Profile, Maps, WhatsApp (WAHA / Meta), Ads, Search Console — kredensial dan mode mock/live.",
    hubApiMeta: "siap atau mock-ready",
    openSection: "Buka",
    agencyOnly: "Hanya staf agen. Pengguna klien mengelola pengalaman merek di Branding.",
    apiBadge: "Integrasi",
    apiDescription:
      "Registry pusat untuk setiap API eksternal. Simpan kredensial di sini, lalu jalankan OAuth / sync dari Data Health atau modul terkait.",
    panel: "Panel",
    scope: "Cakupan",
    storage: "Penyimpanan",
    language: "Bahasa antarmuka",
    languageHint:
      "Bahasa Inggris adalah bahasa produk default. Beralih ke Bahasa Indonesia kapan saja.",
    branding: "Branding",
    appIdentity: "Identitas aplikasi",
    appIdentityHint: "Logo dan nama di sidebar, login, dan shell.",
    messagingEn: "Pesan · English (utama)",
    messagingEnHint: "Bahasa produk kanonik. Gunakan untuk deck, PRD, dan sales.",
    messagingId: "Pesan · Bahasa Indonesia",
    messagingIdHint: "Lokalisasi opsional saat bahasa antarmuka diset ke ID.",
    appName: "Nama aplikasi",
    monogram: "Huruf monogram",
    logoImage: "Gambar logo",
    uploadLogo: "Unggah logo",
    clearLogo: "Hapus logo",
    logoHint: "PNG / JPG / WebP · maks ~600KB",
    primaryColor: "Warna utama",
    supportEmail: "Email dukungan",
    tagline: "Tagline",
    hero: "Headline hero",
    narrative: "Narasi pendukung",
    promise: "Janji produk inti",
    flow: "Alur pertumbuhan (satu langkah per baris)",
    flowHint: "Default: Optimize location assets → … → Generate measurable outcomes",
    save: "Simpan branding",
    saving: "Menyimpan…",
    reset: "Reset form",
    saved: "Branding tersimpan. UI diperbarui.",
    saveFailed: "Gagal menyimpan",
    logoNotImage: "File harus gambar (PNG, JPG, SVG, WebP).",
    logoTooLarge: "Logo maks ~600KB. Kompres dulu atau pakai monogram.",
  },
  brandStory: {
    brandPromise: "Janji merek",
    growthFlow: "Alur pertumbuhan",
  },
  clients: {
    eyebrow: "Admin agen",
    badge: "Database klien",
    title: "Klien",
    description:
      "Buat klien brand, simpan data kontak, dan aktifkan login workspace saat siap.",
    newClient: "Klien baru",
    total: "Total klien",
    loginOn: "Login aktif",
    loginOff: "Login nonaktif",
    empty: "Belum ada klien",
    emptyHint: "Tambah klien brand pertama untuk onboarding managed service.",
    colName: "Klien",
    colIndustry: "Industri",
    colContact: "Kontak",
    colLogin: "Login",
    colUsers: "Pengguna",
    colStatus: "Status",
    view: "Buka",
    agencyOnly: "Area ini hanya untuk staf agen.",
  },
  conversations: {
    eyebrow: "Demand",
    badge: "WAHA live · hanya monitor",
    title: "Percakapan",
    description: "Thread WhatsApp dari nomor cabang yang sudah di-map. Hanya monitor — tidak ada kirim.",
    unreplied: "belum dibalas",
    search: "Cari telepon, lid, atau teks…",
    filterAll: "Semua",
    filterUnreplied: "Belum dibalas",
    allLocations: "Semua cabang",
    colLast: "Terakhir",
    colContact: "Kontak",
    colPreview: "Pratinjau",
    colBranch: "Cabang",
    colDirection: "Arah",
    view: "Lihat",
    emptyNoMap: "Map session WAHA di Location 360 → Sources.",
    emptyWait: "Menunggu webhook.",
    accountResponder: "Penanggap akun",
    agencyOnly: "Staf agen memonitor percakapan WhatsApp.",
    sourceHint: "Sumber: WAHA. Session harus di-map ke lokasi. Nomor tampil jika WhatsApp mengirimnya; @lid tidak pernah diubah jadi nomor palsu.",
  },
};

const catalogs: Record<Locale, Messages> = { en, id };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? catalogs.en;
}
