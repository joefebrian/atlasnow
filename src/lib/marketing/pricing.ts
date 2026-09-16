import type { Locale } from "@/lib/i18n/locale";

/**
 * Public list price in rupiah. Joe gassed Silver 500 rb + 1 Cloud HQ + blast 2026-09-06.
 * Diamond has no list price. WhatsApp credits are not these numbers.
 * Do not invent visits, leads, or revenue.
 */
export const ATLAS_PRICE_IDR = {
  silverMonthly: 500_000,
  goldMonthly: 2_000_000,
  platinumMonthly: 8_000_000,
  extraOutletMonthly: 150_000,
  freeIncluded: 2,
  silverIncluded: 2,
  goldIncluded: 5,
  platinumIncluded: 15,
} as const;

export const EXTRA_OUTLET_UI_MAX = 99;

export function formatIdr(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function extraIncrementIdr(extraCount: number): number {
  const n = Math.max(0, Math.min(EXTRA_OUTLET_UI_MAX, Math.floor(extraCount)));
  return n * ATLAS_PRICE_IDR.extraOutletMonthly;
}

export type PricingPlanId = "free" | "silver" | "gold" | "platinum" | "diamond";

export function planBaseIdr(id: PricingPlanId): number | null {
  switch (id) {
    case "free":
      return 0;
    case "silver":
      return ATLAS_PRICE_IDR.silverMonthly;
    case "gold":
      return ATLAS_PRICE_IDR.goldMonthly;
    case "platinum":
      return ATLAS_PRICE_IDR.platinumMonthly;
    case "diamond":
      return null;
  }
}

/** Extra doors only bill on Silver / Gold / Platinum. Free hard-stops. Diamond is quoted. */
export function planTotalIdr(id: PricingPlanId, extraCount: number): number | null {
  const base = planBaseIdr(id);
  if (base == null) return null;
  if (id === "free") return 0;
  return base + extraIncrementIdr(extraCount);
}

export type PricingPlan = {
  id: PricingPlanId;
  badge: string;
  title: string;
  sub: string;
  hook: string;
  price: string;
  priceNote: string;
  signupHref: string;
  cta: string;
  featured: boolean;
  usesStepper: boolean;
  includedOutlets: number | null;
  points: string[];
  without: string[];
};

export type CompareCell = "yes" | "no" | "credit" | "quoted" | string;

export type CompareRow = {
  feature: string;
  free: CompareCell;
  silver: CompareCell;
  gold: CompareCell;
  platinum: CompareCell;
  diamond: CompareCell;
};

export type PricingCopy = {
  eyebrow: string;
  title: string;
  lede: string;
  extraTitle: string;
  extra: { title: string; body: string }[];
  cancelTitle: string;
  cancelLede: string;
  cancel: { title: string; body: string }[];
  cancelTerms: string;
  cancelTermsHref: string;
  honest: string;
  contact: string;
  contactHref: string;
  withoutLabel: string;
  extraOutletsLabel: string;
  incrementLabel: string;
  totalLabel: string;
  includedLabel: string;
  stepperHint: string;
  compareTitle: string;
  compareFeature: string;
  compare: CompareRow[];
  cellYes: string;
  cellNo: string;
  cellCredit: string;
  cellQuoted: string;
  plans: PricingPlan[];
};

const COMPARE_EN: CompareRow[] = [
  { feature: "Join QR + member card", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Stamp / points / top spender + birthday", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Cashier receipt photo + HQ Approve", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Members + monthly report (receipts, not visits)", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Outlet list (hours, who needs a person)", free: "2 doors", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Extra outlet + Rp 150.000", free: "no", silver: "− n +", gold: "− n +", platinum: "− n +", diamond: "quoted" },
  { feature: "HQ WhatsApp inbox (a person, not a bot)", free: "no", silver: "1 number", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Branch chat watch (no send from the branch)", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Google listings + human review replies", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "TikTok GO till (scan, redeem, recap, invite join)", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Opt-in WhatsApp blast", free: "no", silver: "credit", gold: "credit", platinum: "credit", diamond: "credit" },
  { feature: "Training on the desk", free: "no", silver: "no", gold: "no", platinum: "yes", diamond: "yes" },
  { feature: "Group desk (several brands)", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "quoted" },
  { feature: "Own domain", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "yes" },
  { feature: "Own / dedicated server", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "yes" },
];

const COMPARE_ID: CompareRow[] = [
  { feature: "QR daftar + kartu member", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Stamp / poin / pelanggan teratas + ultah", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Foto struk kasir + Approve HQ", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Member + laporan bulanan (struk, bukan kunjungan)", free: "yes", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Daftar outlet (jam, mana yang masih butuh orang)", free: "2 pintu", silver: "yes", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Outlet extra + Rp 150.000", free: "no", silver: "− n +", gold: "− n +", platinum: "− n +", diamond: "quoted" },
  { feature: "Inbox WhatsApp HQ (orang, bukan bot)", free: "no", silver: "1 nomor", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Watch chat cabang (tidak kirim dari cabang)", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Listing Google + balasan ulasan oleh orang", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Kasir TikTok GO (cek, tukar, recap, ajak daftar)", free: "no", silver: "no", gold: "yes", platinum: "yes", diamond: "yes" },
  { feature: "Blast WhatsApp opt-in", free: "no", silver: "credit", gold: "credit", platinum: "credit", diamond: "credit" },
  { feature: "Training di meja", free: "no", silver: "no", gold: "no", platinum: "yes", diamond: "yes" },
  { feature: "Meja Grup (beberapa merek)", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "quoted" },
  { feature: "Domain sendiri", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "yes" },
  { feature: "Server sendiri / dedicated", free: "no", silver: "no", gold: "no", platinum: "no", diamond: "yes" },
];

const EN: PricingCopy = {
  eyebrow: "Pricing",
  title: "Start free. Pay when the inbox and listings go on.",
  lede:
    "Free is the membership desk — join QR, stamps, cashier photo. Silver is one official WhatsApp Business number and our blast. Gold adds Google, the TikTok GO till, and branch chat watch. Platinum is the long chain on the shared box. Diamond is your domain and your server. Login stays off until we follow up. No card on sign-up.",
  extraTitle: "Billed separately — not AtlasNow SaaS",
  extra: [
    {
      title: "WhatsApp templates",
      body: "Opt-in blasts from the official HQ number. Meta’s rate, on Silver, Gold, Platinum, and Diamond after login is on. Not a CSV. STOP still works. From 1 Oct 2026 Meta gives 1,000 free service messages per WABA phone per month — that gift is Meta’s, not this table.",
    },
    {
      title: "Not live, not sold",
      body: "Google posts, ads, weekly to-do, POS auto-approve, native TikTok / Instagram / Messenger inbox, and a white-label mobile app are roadmap. We don’t put them on this page as if they ship today.",
    },
  ],
  cancelTitle: "Cancel and refunds",
  cancelLede:
    "Paid monthly in advance by invoice. No card on this page. Same shape as other monthly software: you finish the time you already paid — we do not pay that money back.",
  cancel: [
    {
      title: "How to cancel",
      body: "Email hello@atlasnow.co. Give 30 days’ notice so we do not issue the next invoice. Outlet count on that last invoice is the list we had when you wrote.",
    },
    {
      title: "No cash refund",
      body: "A paid invoice is not refunded, including unused days and the 90-day pilot. You keep the workspace until that paid period ends.",
    },
    {
      title: "Credits and other bills",
      body: "Unused WhatsApp credits are not paid out in cash. Meta and Google bill their own accounts — Atlas does not refund those. Free has nothing to refund. Downgrade (fewer outlets) shrinks the next invoice, not the one already paid.",
    },
  ],
  cancelTerms: "Full text in Terms",
  cancelTermsHref: "/terms#fees-cancellation-refunds",
  honest:
    "Reports are receipts, stamps, and gifts handed over. We do not invent visits, leads, or revenue. A paid TikTok GO voucher is not a stamp.",
  contact: "Write to us",
  contactHref: "/contact",
  withoutLabel: "Not on this plan",
  extraOutletsLabel: "Extra outlets",
  incrementLabel: "Add-on",
  totalLabel: "Total / month",
  includedLabel: "included",
  stepperHint: "Applies to Silver, Gold, and Platinum. Free stops at 2. Diamond is quoted with the box.",
  compareTitle: "What’s on each plan",
  compareFeature: "Feature",
  compare: COMPARE_EN,
  cellYes: "Yes",
  cellNo: "—",
  cellCredit: "Credits",
  cellQuoted: "Quoted",
  plans: [
    {
      id: "free",
      badge: "Start here",
      title: "Free",
      sub: "One brand. Two outlets. No APIs connected.",
      hook: "QR, stamps, receipt photos.",
      price: "Free",
      priceNote: "No card. Login after follow-up.",
      signupHref: "/signup",
      cta: "Start free",
      featured: false,
      usesStepper: false,
      includedOutlets: ATLAS_PRICE_IDR.freeIncluded,
      points: [
        "2 outlets on one brand. Stop at 2.",
        "Join QR is sign-up only — name, phone, birthday. Member card after.",
        "Loyalty: stamp, points, or top spender — pick one. Birthday can stay on.",
        "Cashier photos the receipt. A stamp only if number and Rp match.",
        "Members and the monthly report from approved tickets — not invented visits.",
      ],
      without: [
        "HQ WhatsApp inbox",
        "Google listings",
        "TikTok GO live till",
        "WhatsApp blast",
        "Outlet #3",
      ],
    },
    {
      id: "silver",
      badge: "WhatsApp + blast",
      title: "Silver",
      sub: "One official WhatsApp Business number and our blast. Extra doors. Not Google, not GO, not branch QR.",
      hook: "One HQ number. They write. You reply.",
      price: formatIdr(ATLAS_PRICE_IDR.silverMonthly),
      priceNote: "/ month · 2 outlets included",
      signupHref: "/signup",
      cta: "Start Silver",
      featured: false,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.silverIncluded,
      points: [
        "Everything in Free. Extra outlets with − n +. Free stops at 2.",
        "One official WhatsApp Business number (Cloud HQ). A person replies — not a bot. Not a store QR.",
        "Our blast from that number, to people who opted in. Meta’s rate extra. STOP still works.",
        "Every branch on one list: hours, till, which door still needs a person.",
        "Report = receipts, stamps, gifts handed over. We do not invent visits, leads, or revenue.",
      ],
      without: ["Google listings", "TikTok GO live till", "Branch chat watch (WAHA)", "Second HQ WhatsApp number"],
    },
    {
      id: "gold",
      badge: "Inbox + GO",
      title: "Gold",
      sub: "The official brand number, Google, and the TikTok GO till. This is what the owner pays for.",
      hook: "They write HQ. You keep them.",
      price: formatIdr(ATLAS_PRICE_IDR.goldMonthly),
      priceNote: "/ month · 5 outlets included",
      signupHref: "/signup",
      cta: "Start Gold",
      featured: true,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.goldIncluded,
      points: [
        "Everything in Silver. 5 outlets included, then − n +.",
        "Branch chats can be watched. Atlas does not reply from the branch number. Live QR sessions on this shared box stay capped.",
        "Google listings: name, pin, hours, phone. Review replies by a person.",
        "TikTok GO till: check, redeem, recap per outlet, invite them to join. A paid GO voucher is not a stamp.",
        "Same HQ blast as Silver. Meta’s rate extra. STOP still works.",
      ],
      without: ["Own domain", "Own server", "Native TikTok / IG / Messenger"],
    },
    {
      id: "platinum",
      badge: "Long chain",
      title: "Platinum",
      sub: "Same product as Gold. More doors included. Covers a quiet month of AtlasNow.",
      hook: "The long chain on one desk.",
      price: formatIdr(ATLAS_PRICE_IDR.platinumMonthly),
      priceNote: "/ month · 15 outlets included",
      signupHref: "/signup",
      cta: "Start Platinum",
      featured: false,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.platinumIncluded,
      points: [
        "Everything in Gold. 15 outlets included, then − n +.",
        "One recap across every door: stamps, GO vouchers handed over, receipts, which outlet is quiet.",
        "Shared AtlasNow server — you do not need Diamond yet.",
        "Training on the desk. Login after follow-up, same as Gold.",
      ],
      without: ["Own domain", "Own server"],
    },
    {
      id: "diamond",
      badge: "Own domain + server",
      title: "Diamond",
      sub: "We build AtlasNow on your domain and your server. Isolation from the shared box.",
      hook: "Your domain. Your server.",
      price: "Talk to us",
      priceNote: "Quoted with the box. No card on this page.",
      signupHref: "/contact",
      cta: "Talk to us",
      featured: false,
      usesStepper: false,
      includedOutlets: null,
      points: [
        "Everything in Platinum, on a stack that is yours.",
        "Your domain. Your (or a dedicated) server. Quoted with the box.",
        "Group desk if you run more than one brand. Each brand keeps its own HQ number and members.",
        "WAHA live-session cap sized to your box — not the shared 6.",
        "A person quotes. No card on this page.",
      ],
      without: ["White-label mobile app as live", "Meta Business Agent"],
    },
  ],
};

const ID: PricingCopy = {
  eyebrow: "Harga",
  title: "Mulai gratis. Bayar saat inbox dan listing nyala.",
  lede:
    "Gratis = meja membership — QR daftar, stamp, foto kasir. Silver = satu nomor WhatsApp Business resmi dan blast kita. Gold nambah Google, kasir TikTok GO, dan watch chat cabang. Platinum = rantai panjang di server bersama. Diamond = domain dan server sendiri. Login belum nyala sampai kami follow up. Daftar tanpa kartu.",
  extraTitle: "Ditagih terpisah — bukan langganan AtlasNow",
  extra: [
    {
      title: "Template WhatsApp",
      body: "Blast opt-in dari nomor HQ resmi. Tarif Meta, di Silver, Gold, Platinum, dan Diamond setelah login nyala. Bukan CSV. STOP tetap jalan. Mulai 1 Okt 2026 Meta kasih 1.000 service message gratis per nomor WABA per bulan — itu pemberian Meta, bukan tabel ini.",
    },
    {
      title: "Belum live, tidak dijual",
      body: "Post Google, iklan, to-do mingguan, Approve otomatis dari POS, inbox native TikTok / Instagram / Messenger, dan aplikasi mobile white-label masih roadmap. Tidak kami taruh di halaman ini seolah sudah kirim.",
    },
  ],
  cancelTitle: "Batal dan refund",
  cancelLede:
    "Ditagih bulanan di muka lewat invoice. Tidak ada kartu di halaman ini. Model langganan biasa: waktu yang sudah dibayar dipakai sampai habis — uang itu tidak dikembalikan.",
  cancel: [
    {
      title: "Cara batal",
      body: "Email hello@atlasnow.co. Pemberitahuan 30 hari supaya invoice berikutnya tidak terbit. Jumlah outlet di invoice terakhir = daftar saat kamu menulis.",
    },
    {
      title: "Tidak refund tunai",
      body: "Invoice yang sudah lunas tidak dikembalikan, termasuk sisa hari dan invoice uji 90 hari. Workspace tetap jalan sampai periode yang sudah dibayar habis.",
    },
    {
      title: "Kredit dan tagihan lain",
      body: "Sisa kredit WhatsApp tidak diuangkan. Tagihan Meta dan Google ke akun mereka — Atlas tidak refund itu. Gratis tidak ada yang di-refund. Downgrade (lebih sedikit outlet) mengecilkan invoice berikutnya, bukan yang sudah dibayar.",
    },
  ],
  cancelTerms: "Teks lengkap di Syarat",
  cancelTermsHref: "/terms#fees-cancellation-refunds",
  honest:
    "Laporan = struk, stamp, dan hadiah yang diserahkan. Kami tidak mengarang kunjungan, lead, atau omzet. Voucher berbayar TikTok GO bukan stamp.",
  contact: "Tulis ke kami",
  contactHref: "/contact",
  withoutLabel: "Tidak di paket ini",
  extraOutletsLabel: "Outlet extra",
  incrementLabel: "Pertambahan",
  totalLabel: "Total / bulan",
  includedLabel: "termasuk",
  stepperHint: "Berlaku di Silver, Gold, dan Platinum. Gratis berhenti di 2. Diamond dipasang bersama box-nya.",
  compareTitle: "Apa yang ada di tiap paket",
  compareFeature: "Fitur",
  compare: COMPARE_ID,
  cellYes: "Ya",
  cellNo: "—",
  cellCredit: "Kredit",
  cellQuoted: "Kami pasang",
  plans: [
    {
      id: "free",
      badge: "Mulai di sini",
      title: "Gratis",
      sub: "Satu merek. Dua outlet. Tanpa API.",
      hook: "QR daftar, stamp, foto struk.",
      price: "Gratis",
      priceNote: "Tanpa kartu. Login setelah follow-up.",
      signupHref: "/signup",
      cta: "Mulai gratis",
      featured: false,
      usesStepper: false,
      includedOutlets: ATLAS_PRICE_IDR.freeIncluded,
      points: [
        "2 outlet di satu merek. Berhenti di 2.",
        "QR daftar hanya daftar — nama, HP, ultah. Kartu member setelah itu.",
        "Loyalty: stamp, poin, atau pelanggan teratas — pilih satu. Ultah boleh tetap nyala.",
        "Kasir foto struk. Stamp hanya kalau nomor dan Rp cocok.",
        "Member dan laporan bulanan dari tiket yang disetujui — bukan kunjungan karangan.",
      ],
      without: [
        "Inbox WhatsApp HQ",
        "Listing Google",
        "Kasir TikTok GO live",
        "Blast WhatsApp",
        "Outlet ke-3",
      ],
    },
    {
      id: "silver",
      badge: "WhatsApp + blast",
      title: "Silver",
      sub: "Satu nomor WhatsApp Business resmi dan blast kita. Pintu extra. Bukan Google, bukan GO, bukan QR cabang.",
      hook: "Satu nomor HQ. Mereka nulis. Kamu balas.",
      price: formatIdr(ATLAS_PRICE_IDR.silverMonthly),
      priceNote: "/ bulan · 2 outlet termasuk",
      signupHref: "/signup",
      cta: "Mulai Silver",
      featured: false,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.silverIncluded,
      points: [
        "Semua yang ada di Gratis. Tambah outlet dengan − n +. Gratis berhenti di 2.",
        "Satu nomor WhatsApp Business resmi (Cloud HQ). Orang yang membalas — bukan bot. Bukan QR toko.",
        "Blast kita dari nomor itu, ke yang opt-in. Tarif Meta terpisah. STOP tetap jalan.",
        "Semua cabang di satu daftar: jam, kasir, mana yang masih butuh orang.",
        "Laporan = struk, stamp, hadiah yang diserahkan. Kami tidak mengarang kunjungan, lead, atau omzet.",
      ],
      without: ["Listing Google", "Kasir TikTok GO live", "Watch chat cabang (WAHA)", "Nomor HQ WhatsApp kedua"],
    },
    {
      id: "gold",
      badge: "Inbox + GO",
      title: "Gold",
      sub: "Nomor resmi merek, Google, dan kasir TikTok GO. Ini yang owner bayar.",
      hook: "Mereka nulis HQ. Kamu yang menahan.",
      price: formatIdr(ATLAS_PRICE_IDR.goldMonthly),
      priceNote: "/ bulan · 5 outlet termasuk",
      signupHref: "/signup",
      cta: "Mulai Gold",
      featured: true,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.goldIncluded,
      points: [
        "Semua yang ada di Silver. 5 outlet termasuk, lalu − n +.",
        "Chat cabang bisa dilihat. Atlas tidak membalas dari nomor cabang. Sesi QR hidup di box bersama tetap dibatasi.",
        "Listing Google: nama, pin, jam, telepon. Balasan ulasan oleh orang.",
        "Kasir TikTok GO: cek, tukar, recap per cabang, ajak daftar. Voucher GO berbayar bukan stamp.",
        "Blast HQ sama seperti Silver. Tarif Meta terpisah. STOP tetap jalan.",
      ],
      without: ["Domain sendiri", "Server sendiri", "Inbox native TikTok / IG / Messenger"],
    },
    {
      id: "platinum",
      badge: "Rantai panjang",
      title: "Platinum",
      sub: "Produk yang sama dengan Gold. Lebih banyak pintu termasuk. Setara sebulan operate AtlasNow.",
      hook: "Rantai panjang di satu meja.",
      price: formatIdr(ATLAS_PRICE_IDR.platinumMonthly),
      priceNote: "/ bulan · 15 outlet termasuk",
      signupHref: "/signup",
      cta: "Mulai Platinum",
      featured: false,
      usesStepper: true,
      includedOutlets: ATLAS_PRICE_IDR.platinumIncluded,
      points: [
        "Semua yang ada di Gold. 15 outlet termasuk, lalu − n +.",
        "Satu recap semua pintu: stamp, voucher GO yang diserahkan, struk, cabang mana yang sepi.",
        "Server bersama AtlasNow — belum perlu Diamond.",
        "Training di meja. Login setelah follow-up, sama seperti Gold.",
      ],
      without: ["Domain sendiri", "Server sendiri"],
    },
    {
      id: "diamond",
      badge: "Domain + server",
      title: "Diamond",
      sub: "Kami pasang AtlasNow di domain dan server kamu. Isolasi dari box bersama.",
      hook: "Domain kamu. Server kamu.",
      price: "Talk to us",
      priceNote: "Dipasang bersama box-nya. Tidak ada kartu di halaman ini.",
      signupHref: "/contact",
      cta: "Talk to us",
      featured: false,
      usesStepper: false,
      includedOutlets: null,
      points: [
        "Semua yang ada di Platinum, di stack yang milik kamu.",
        "Domain kamu. Server kamu (atau dedicated). Harga ikut box.",
        "Meja Grup kalau kamu pegang lebih dari satu merek. Tiap merek tetap punya nomor HQ dan member sendiri.",
        "Cap sesi live WAHA mengikuti box kamu — bukan 6 di server bersama.",
        "Orang yang pasang. Tidak ada kartu di halaman ini.",
      ],
      without: ["Aplikasi mobile white-label sebagai live", "Meta Business Agent"],
    },
  ],
};

export function pricingCopy(locale: Locale): PricingCopy {
  return locale === "id" ? ID : EN;
}

export function formatCompareCell(cell: CompareCell, t: PricingCopy): string {
  if (cell === "yes") return t.cellYes;
  if (cell === "no") return t.cellNo;
  if (cell === "credit") return t.cellCredit;
  if (cell === "quoted") return t.cellQuoted;
  return cell;
}
