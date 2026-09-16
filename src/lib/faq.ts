export type FaqItem = {
  id: string;
  qEn: string;
  aEn: string;
  qId: string;
  aId: string;
};

export type LocalizedFaq = { id: string; q: string; a: string };

export const MAX_FAQS = 30;

export const DEFAULT_FAQ: FaqItem[] = [
  {
    id: "what",
    qEn: "What is AtlasNow?",
    aEn: "A desk for multi-location operations. One brand, many outlets. Official HQ WhatsApp is the inbox and the member list. Kasir photos the struk — stamp only if it matches. Top spender and birthday sit on that same number. Reviews stay with the same team. Tagline: One desk for every location.",
    qId: "AtlasNow itu apa?",
    aId: "Meja untuk operasi multi-lokasi. Satu merek, banyak cabang. WhatsApp HQ resmi adalah inbox dan daftar member. Kasir foto struk — stamp hanya kalau cocok. Top spender dan ultah di nomor yang sama. Ulasan duduk di tim yang sama. Tagline: Satu meja untuk setiap lokasi.",
  },
  {
    id: "who",
    qEn: "Who is it for?",
    aEn: "Executive owners and operations leads who run more than one outlet — F&B, clinic, retail, gym, salon, workshop, hotel, education. Industry is not the filter. Many doors is. A group is optional if you run more than one brand.",
    qId: "Cocok untuk siapa?",
    aId: "Owner dan kepala operasional yang pegang lebih dari satu outlet — F&B, klinik, retail, gym, salon, bengkel, hotel, edukasi. Industri bukan filter. Banyak pintu itu filter. Grup opsional kalau kamu pegang lebih dari satu merek.",
  },
  {
    id: "group",
    qEn: "What is a Group?",
    aEn: "A parent over several brands — owner-run holding or an operator. Same screens. Each brand keeps its own HQ number and members. You do not need a Group to run many outlets of one brand.",
    qId: "Grup itu apa?",
    aId: "Induk di atas beberapa merek — holding milik owner atau operator. Layar yang sama. Tiap merek tetap punya nomor HQ dan member sendiri. Kamu tidak perlu Grup hanya untuk banyak cabang dari satu merek.",
  },
  {
    id: "join",
    qEn: "Does scanning the table QR give a stamp?",
    aEn: "No. Join QR is daftar only (name, phone, email, birthday, city). They are a prospect until a qualifying receipt — photo of the struk, number and Rp match. That ticket is one stamp. A paid TikTok GO voucher is not a stamp.",
    qId: "Scan QR meja dapat stamp?",
    aId: "Tidak. QR daftar = daftar saja (nama, HP, email, ultah, kota). Mereka calon sampai struk sah — foto, nomor dan Rp cocok. Tiket itu satu stamp. Voucher berbayar TikTok GO bukan stamp.",
  },
  {
    id: "visits",
    qEn: "Do you count store visits, leads, or sales?",
    aEn: "No. Directions on Maps is intent, not a foot in the door. We do not invent visits, leads, or revenue. Reports are receipts, stamps, and gifts handed over at the till.",
    qId: "Apakah kunjungan, lead, atau omzet dihitung?",
    aId: "Tidak. Minta arah di Maps itu niat, bukan kaki masuk toko. Kami tidak mengarang kunjungan, lead, atau omzet. Laporan = struk, stamp, dan hadiah yang kasir serahkan.",
  },
  {
    id: "reviews",
    qEn: "How do Google reviews work?",
    aEn: "Two modes. Maps link: public reviews. Google Business Profile: official list, and a person can reply so it goes live on Maps. A 1-star is still a customer if a person handles it fast. No bot.",
    qId: "Ulasan Google bagaimana?",
    aId: "Dua mode. Link Maps: ulasan publik. Google Business Profile: daftar resmi, orang yang membalas supaya tayang di Maps. Bintang 1 tetap pelanggan kalau orang yang handle, cepat. Bukan bot.",
  },
  {
    id: "bots",
    qEn: "Do you auto-reply with a bot?",
    aEn: "No canned “thanks for visiting.” HQ can send Status Stamp / menu copy the brand wrote, after the customer wrote first. A person still owns reviews and the rest of the inbox. From 1 October 2026 Meta bills those human replies as service messages after 1,000 free per HQ number per month — see help.atlasnow.co.",
    qId: "Ada bot auto-reply?",
    aId: "Tidak ada “thanks for visiting” kalengan. HQ bisa kirim Status Stamp / menu yang merek tulis, setelah pelanggan nulis dulu. Orang tetap pegang ulasan dan sisa inbox. Mulai 1 Oktober 2026 Meta menagih balasan orang itu sebagai service message setelah 1.000 gratis per nomor HQ per bulan — lihat help.atlasnow.co.",
  },
  {
    id: "whatsapp",
    qEn: "How does WhatsApp connect?",
    aEn: "One official Cloud API number per brand — HQ. That number is inbox, loyalty, and later opt-in templates. Branch phones can be watched. Atlas does not reply from the branch.",
    qId: "WhatsApp disambung bagaimana?",
    aId: "Satu nomor Cloud API resmi per merek — HQ. Nomor itu inbox, loyalty, dan nanti template opt-in. HP cabang bisa diawasi. Atlas tidak membalas dari cabang.",
  },
  {
    id: "messenger",
    qEn: "Does Facebook Messenger work today?",
    aEn: "The brand connects its own Page. Live DMs need the Meta app published. We don’t mix a WhatsApp number with a Facebook ID. Wave A is WhatsApp HQ first.",
    qId: "Facebook Messenger sudah jalan?",
    aId: "Merek menghubungkan Page-nya sendiri. DM live butuh aplikasi Meta terbit. Kami tidak mencampur nomor WhatsApp dengan ID Facebook. Wave A = WhatsApp HQ dulu.",
  },
  {
    id: "blast",
    qEn: "Can we blast a customer CSV?",
    aEn: "No. Blast only to people who already chatted or opted in on the HQ number. Export is not a blast list. STOP removes them.",
    qId: "Bisa blast CSV pelanggan?",
    aId: "Tidak. Blast hanya ke orang yang sudah chat atau opt-in di nomor HQ. Export bukan daftar blast. STOP menghapus mereka.",
  },
  {
    id: "pricing",
    qEn: "How does pricing work?",
    aEn: "Free first: one brand, two outlets, join QR, stamps, cashier photo, members — no WhatsApp or Google. Silver is Rp 500.000: one official WhatsApp Business number and our blast (Meta’s rate extra). Gold adds Google, the TikTok GO till, and branch chat watch. Platinum is the long chain. Diamond is your domain and server. atlasnow.co/pricing. We do not invent visits, leads, or revenue.",
    qId: "Harganya bagaimana?",
    aId: "Gratis dulu: satu merek, dua outlet, QR daftar, stamp, foto kasir, member — tanpa WhatsApp atau Google. Silver Rp 500.000: satu nomor WhatsApp Business resmi dan blast kita (tarif Meta terpisah). Gold nambah Google, kasir TikTok GO, dan watch chat cabang. Platinum = rantai panjang. Diamond = domain dan server sendiri. atlasnow.co/pricing. Kami tidak mengarang kunjungan, lead, atau omzet.",
  },
  {
    id: "start",
    qEn: "How do we start?",
    aEn: "Sign up as one brand (many outlets) or several brands. Login stays off until AtlasNow follows up. Start on Free (QR, stamps, members), then connect HQ WhatsApp when you pay.",
    qId: "Mulai dari mana?",
    aId: "Daftar sebagai satu merek (banyak cabang) atau beberapa merek. Login belum nyala sampai AtlasNow follow up. Mulai di Gratis (QR, stamp, member), baru sambung WhatsApp HQ saat bayar.",
  },
  {
    id: "later",
    qEn: "What is coming later?",
    aEn: "Google posts, ads, weekly ops to-do, and POS auto-approve are roadmap. We don’t sell them as live. HQ Cloud inbox, join QR, stamp / top spender / birthday settings, and the monthly loyalty report are live.",
    qId: "Apa yang masih coming later?",
    aId: "Post Google, iklan, to-do ops mingguan, dan Approve otomatis dari POS masih roadmap. Kami tidak menjualnya sebagai live. Inbox HQ Cloud, QR daftar, pengaturan stamp / top spender / ultah, dan laporan loyalty bulanan sudah live.",
  },
  {
    id: "cancel",
    qEn: "If we cancel, do we get a refund?",
    aEn: "No cash refund of a paid invoice, including unused days. You keep the workspace until that period ends. Email hello@atlasnow.co with 30 days’ notice so the next invoice does not go out. Unused WhatsApp credits are not paid out in cash. Full text: atlasnow.co/pricing#cancel and /terms#fees-cancellation-refunds.",
    qId: "Kalau batal, apakah uang dikembalikan?",
    aId: "Tidak. Invoice yang sudah lunas tidak di-refund, termasuk sisa hari. Workspace jalan sampai periode itu habis. Email hello@atlasnow.co, pemberitahuan 30 hari, supaya invoice berikutnya tidak terbit. Sisa kredit WhatsApp tidak diuangkan. Teks lengkap: atlasnow.co/pricing#cancel dan /terms#fees-cancellation-refunds.",
  },
  {
    id: "data",
    qEn: "Cookies, privacy, deleting data?",
    aEn: "Cookie policy, privacy, terms, and a data-deletion form are public: atlasnow.co/cookies, /privacy, /terms, /data-deletion. After you accept the cookie notice we run Google Analytics 4 and Google Ads measurement on public pages only. We do not run a Meta Pixel.",
    qId: "Cookie, privasi, hapus data?",
    aId: "Kebijakan cookie, privasi, syarat, dan form hapus data publik: atlasnow.co/cookies, /privacy, /terms, /data-deletion. Setelah OK pada pemberitahuan cookie kami menjalankan Google Analytics 4 dan pengukuran Google Ads di halaman publik saja. Kami tidak memasang Meta Pixel.",
  },
];

export function parseFaqJson(json: string | null | undefined, fallback = DEFAULT_FAQ): FaqItem[] {
  if (!json) return fallback.map((f) => ({ ...f }));
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return fallback.map((f) => ({ ...f }));
    const items: FaqItem[] = [];
    for (const raw of parsed.slice(0, MAX_FAQS)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const o = raw as Record<string, unknown>;
      const qEn = typeof o.qEn === "string" ? o.qEn.trim() : "";
      const aEn = typeof o.aEn === "string" ? o.aEn.trim() : "";
      if (!qEn || !aEn) continue;
      items.push({
        id: typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 40) : `faq-${items.length + 1}`,
        qEn: qEn.slice(0, 200),
        aEn: aEn.slice(0, 2000),
        qId: (typeof o.qId === "string" ? o.qId.trim() : "").slice(0, 200),
        aId: (typeof o.aId === "string" ? o.aId.trim() : "").slice(0, 2000),
      });
    }
    return items;
  } catch {
    return fallback.map((f) => ({ ...f }));
  }
}

export function localizeFaq(items: FaqItem[], locale: "en" | "id"): LocalizedFaq[] {
  return items.map((f) => ({
    id: f.id,
    q: locale === "id" ? f.qId || f.qEn : f.qEn,
    a: locale === "id" ? f.aId || f.aEn : f.aEn,
  }));
}

export function sanitizeFaqList(input: unknown): FaqItem[] {
  return parseFaqJson(JSON.stringify(input), []);
}
