import type { Locale } from "@/lib/i18n/locale";

export const HELP_ORIGIN = "https://help.atlasnow.co";

export type HelpCatId =
  | "start"
  | "faces"
  | "loyalty"
  | "inbox"
  | "google"
  | "tiktok"
  | "later"
  | "account";

export type HelpCopy = { en: string; id: string };

export type HelpArticle = {
  slug: string;
  category: HelpCatId;
  title: HelpCopy;
  summary: HelpCopy;
  body: HelpCopy[];
};

export const HELP_CATEGORIES: {
  id: HelpCatId;
  title: HelpCopy;
  lede: HelpCopy;
}[] = [
  {
    id: "start",
    title: { en: "Getting started", id: "Mulai" },
    lede: { en: "What AtlasNow is, who it is for, and how you open a desk.", id: "AtlasNow itu apa, untuk siapa, dan cara buka meja." },
  },
  {
    id: "faces",
    title: { en: "What it faces", id: "Yang dihadapi" },
    lede: { en: "The real mess at multi-outlet brands — and what AtlasNow takes.", id: "Kekacauan nyata di merek banyak cabang — dan yang AtlasNow ambil." },
  },
  {
    id: "loyalty",
    title: { en: "Loyalty & cashier", id: "Loyalty & kasir" },
    lede: { en: "Join, stamp, receipt photo, birthday, top spender.", id: "Daftar, stamp, foto struk, ultah, pelanggan teratas." },
  },
  {
    id: "inbox",
    title: { en: "WhatsApp & inbox", id: "WhatsApp & inbox" },
    lede: { en: "One official HQ number. A person replies. No CSV blast.", id: "Satu nomor HQ resmi. Orang yang membalas. Tidak blast CSV." },
  },
  {
    id: "google",
    title: { en: "Google", id: "Google" },
    lede: { en: "Listings and reviews on the same desk. Maps taps are not visits.", id: "Listing dan ulasan di meja yang sama. Tap Maps bukan kunjungan." },
  },
  {
    id: "tiktok",
    title: { en: "TikTok GO", id: "TikTok GO" },
    lede: { en: "They already paid. AtlasNow is the till and the next demand.", id: "Mereka sudah bayar. AtlasNow kasirnya dan demand berikutnya." },
  },
  {
    id: "later",
    title: { en: "Live vs later", id: "Live vs belakangan" },
    lede: { en: "What you can use today. What we do not sell as live.", id: "Yang bisa dipakai hari ini. Yang tidak kami jual sebagai live." },
  },
  {
    id: "account",
    title: { en: "Privacy & contact", id: "Privasi & kontak" },
    lede: { en: "A person reads what you write. How to delete data.", id: "Orang yang membaca. Cara hapus data." },
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "what-is-atlasnow",
    category: "start",
    title: { en: "What is AtlasNow?", id: "AtlasNow itu apa?" },
    summary: {
      en: "One desk for every location of a brand: HQ WhatsApp, members, cashier, listings.",
      id: "Satu meja untuk setiap cabang merek: WhatsApp HQ, member, kasir, listing.",
    },
    body: [
      {
        en: "AtlasNow is a desk for brands that run more than one outlet. Tagline: Optimize Every Outlet. Capture More Demand. Promise: one desk for every location.",
        id: "AtlasNow adalah meja untuk merek yang pegang lebih dari satu outlet. Tagline: Optimize Every Outlet. Capture More Demand. Janji: satu meja untuk setiap lokasi.",
      },
      {
        en: "On that desk: official HQ WhatsApp (inbox and member list), join QR, cashier receipt photo, stamp / top spender / birthday, Google listings and human review replies, and TikTok GO voucher use at the till.",
        id: "Di meja itu: WhatsApp HQ resmi (inbox dan daftar member), QR daftar, foto struk kasir, stamp / pelanggan teratas / ultah, listing Google dan balasan ulasan oleh orang, plus pemakaian voucher TikTok GO di kasir.",
      },
      {
        en: "It is a WhatsApp CRM and an outlet-operations desk. It is not a visit counter, not a lead factory, and not a bot.",
        id: "Ini WhatsApp CRM dan meja operasi outlet. Bukan penghitung kunjungan, bukan pabrik lead, bukan bot.",
      },
    ],
  },
  {
    slug: "who-it-is-for",
    category: "start",
    title: { en: "Who it is for", id: "Cocok untuk siapa" },
    summary: {
      en: "Owners and ops with many doors. Industry is not the filter.",
      id: "Owner dan ops dengan banyak pintu. Industri bukan filter.",
    },
    body: [
      {
        en: "Executive owners and operations leads who run more than one outlet — F&B, clinic, retail, gym, salon, workshop, hotel, education. Many doors is the filter.",
        id: "Owner dan kepala operasional yang pegang lebih dari satu outlet — F&B, klinik, retail, gym, salon, bengkel, hotel, edukasi. Banyak pintu itu filter.",
      },
      {
        en: "A Group (Grup) sits above several brands if you run more than one brand. You do not need a Group to run many outlets of one brand. We say Group, not Agency.",
        id: "Grup duduk di atas beberapa merek kalau kamu pegang lebih dari satu merek. Tidak perlu Grup hanya untuk banyak cabang dari satu merek. Kami bilang Grup, bukan Agency.",
      },
    ],
  },
  {
    slug: "how-to-start",
    category: "start",
    title: { en: "How to start", id: "Cara mulai" },
    summary: {
      en: "Sign up as one brand. Login stays off until we follow up. Free first.",
      id: "Daftar satu merek. Login belum nyala sampai kami follow up. Gratis dulu.",
    },
    body: [
      {
        en: "Sign up at atlasnow.co as one brand (many outlets) or several brands. There is no public demo password.",
        id: "Daftar di atlasnow.co sebagai satu merek (banyak cabang) atau beberapa merek. Tidak ada password demo publik.",
      },
      {
        en: "Login stays off until AtlasNow follows up. Start on Free: join QR, stamps, cashier photo, members — no WhatsApp or Google calls. Silver (Rp 500.000) is one official WhatsApp Business number and our blast. Gold adds Google, GO, and branch watch.",
        id: "Login belum nyala sampai AtlasNow follow up. Mulai Gratis: QR daftar, stamp, foto kasir, member — tanpa WhatsApp atau Google. Silver (Rp 500.000) = satu nomor WhatsApp Business resmi dan blast kita. Gold nambah Google, GO, dan watch cabang.",
      },
      {
        en: "Pricing: atlasnow.co/pricing. Free first (2 outlets). Silver, Gold, and Platinum are monthly. Diamond is talk to us — own domain and server. WhatsApp templates are Meta’s rate, billed separately.",
        id: "Harga: atlasnow.co/pricing. Gratis dulu (2 outlet). Silver, Gold, dan Platinum bulanan. Diamond = talk to us — domain dan server sendiri. Template WhatsApp tarif Meta, ditagih terpisah.",
      },
    ],
  },
  {
    slug: "many-outlets",
    category: "faces",
    title: { en: "Many outlets, still no picture", id: "Banyak cabang, tetap tidak kelihatan" },
    summary: {
      en: "Which branch is quiet. Which stamps are stuck. Maps taps sold as visits.",
      id: "Cabang mana sepi. Stamp mana macet. Tap Maps dijual sebagai kunjungan.",
    },
    body: [
      {
        en: "AtlasNow faces brands that already have twelve doors and still cannot see the week. Chat in one app, stamps in a drawer, Google in another tab, TikTok GO on a third phone.",
        id: "AtlasNow menghadapi merek yang sudah punya belasan pintu tapi tidak lihat minggunya. Chat di satu aplikasi, stamp di laci, Google di tab lain, TikTok GO di HP ketiga.",
      },
      {
        en: "The desk shows HQ chats waiting, receipts waiting for Approve, members, stamps, gifts handed over, and which outlet is quiet — from numbers we can stand behind. We do not invent visits, leads, or revenue.",
        id: "Meja menampilkan chat HQ yang nunggu, struk nunggu Approve, member, stamp, hadiah yang diserahkan, dan cabang mana yang sepi — dari angka yang kami tanggung. Kami tidak mengarang kunjungan, lead, atau omzet.",
      },
    ],
  },
  {
    slug: "brand-on-a-phone",
    category: "faces",
    title: { en: "The brand lives on a cashier’s phone", id: "Merek hidup di HP kasir" },
    summary: {
      en: "Staff quit — the chats quit with them. HQ never sees who wrote.",
      id: "Staff resign — chat ikut hilang. HQ tidak lihat siapa yang nulis.",
    },
    body: [
      {
        en: "HQ WhatsApp on a personal handset is not a company. AtlasNow puts the official brand number on the desk. A person replies — not a bot. Branch chats can be watched; Atlas does not answer from the branch number.",
        id: "WhatsApp HQ di HP pribadi bukan perusahaan. AtlasNow menaruh nomor resmi merek di meja. Orang yang membalas — bukan bot. Chat cabang bisa dilihat; Atlas tidak membalas dari nomor cabang.",
      },
    ],
  },
  {
    slug: "stamp-farm",
    category: "faces",
    title: { en: "A table QR that punches stamps is a farm", id: "QR meja yang ngetuk stamp itu farm" },
    summary: {
      en: "Join is not a gift. A paid TikTok GO voucher is not a stamp.",
      id: "Daftar bukan hadiah. Voucher berbayar TikTok GO bukan stamp.",
    },
    body: [
      {
        en: "If the poster stamps, anyone with a phone farms the card. AtlasNow: table QR is sign-up only (name, phone, birthday, city). They are a prospect until a qualifying receipt — photo, number and Rp match. That ticket is one stamp.",
        id: "Kalau poster bisa nge-stamp, siapa pun dengan HP mengfarm kartu. AtlasNow: QR meja hanya daftar (nama, HP, ultah, kota). Mereka calon sampai struk sah — foto, nomor dan Rp cocok. Tiket itu satu stamp.",
      },
    ],
  },
  {
    slug: "csv-blast",
    category: "faces",
    title: { en: "Promo to a spreadsheet", id: "Promo ke spreadsheet" },
    summary: {
      en: "A CSV is not consent. STOP must work.",
      id: "CSV bukan izin. STOP harus jalan.",
    },
    body: [
      {
        en: "AtlasNow will not blast a customer CSV. Messages go only from the official HQ number, only to people who already wrote or opted in (birthday / deals). Reply STOP and they are out. Export is not a blast list. TikTok is not a phone book.",
        id: "AtlasNow tidak blast CSV pelanggan. Pesan hanya dari nomor HQ resmi, hanya ke orang yang sudah nulis atau sudah izinkan (ultah / promo). Balas STOP, langsung berhenti. Export bukan daftar blast. TikTok bukan buku telepon.",
      },
    ],
  },
  {
    slug: "paid-before-they-walk-in",
    category: "faces",
    title: { en: "They already paid before they walk in", id: "Sudah bayar sebelum masuk" },
    summary: {
      en: "TikTok GO creates demand on the phone. The mess is at the cashier.",
      id: "TikTok GO bikin demand di HP. Kacauannya di kasir.",
    },
    body: [
      {
        en: "A new kind of demand: the customer bought a voucher in TikTok, then shows a QR at the outlet. Without AtlasNow, the cashier opens a second app, the wrong branch can redeem, and head office is blind.",
        id: "Demand jenis baru: pelanggan beli voucher di TikTok, lalu tunjukkan QR di gerai. Tanpa AtlasNow, kasir buka aplikasi kedua, cabang salah bisa tukar, kantor buta.",
      },
      {
        en: "AtlasNow is the till for that voucher and captures the next demand: invite them to join the brand. The voucher itself is not membership and not a stamp.",
        id: "AtlasNow kasir untuk voucher itu, dan menangkap demand berikutnya: ajak daftar member merek. Voucher itu sendiri bukan membership dan bukan stamp.",
      },
    ],
  },
  {
    slug: "join-qr",
    category: "loyalty",
    title: { en: "Join QR", id: "QR daftar" },
    summary: {
      en: "Sign-up only. Prospect until the first qualifying receipt.",
      id: "Daftar saja. Calon sampai struk sah pertama.",
    },
    body: [
      {
        en: "Print the join QR for the table or the counter. They enter name, phone, email, birthday, city, and whether WhatsApp birthday notes are ok.",
        id: "Cetak QR daftar untuk meja atau kasir. Mereka isi nama, HP, email, ultah, kota, dan apakah boleh dikirimi WhatsApp ultah.",
      },
      {
        en: "Same phone as a chat is one person. Scanning join again does not stamp. The cashier asks “already a member?”, checks the phone, then takes the receipt.",
        id: "HP yang sama dengan chat = satu orang. Scan daftar lagi tidak menambah stamp. Kasir tanya “sudah member?”, cek HP, baru ambil struk.",
      },
    ],
  },
  {
    slug: "stamps-and-receipt",
    category: "loyalty",
    title: { en: "Stamps and the receipt photo", id: "Stamp dan foto struk" },
    summary: {
      en: "One qualifying receipt = one stamp. Photo required. Match can auto-approve; mismatch goes to HQ.",
      id: "Satu struk sah = satu stamp. Foto wajib. Cocok bisa Approve otomatis; beda masuk antrian HQ.",
    },
    body: [
      {
        en: "At the cashier: receipt number, amount in Rp, photo of the paper. If number and Rp on the photo match, Atlas can approve. If it is blurry or different, head office reviews. The brand can still require every ticket to be checked.",
        id: "Di kasir: nomor struk, nominal Rp, foto kertas. Kalau nomor dan Rp di foto cocok, Atlas bisa setujui. Buram atau beda, kantor yang cek. Merek tetap bisa minta semua tiket dicek.",
      },
      {
        en: "You set the gift in Settings → Loyalty (for example 5 stamps → one gift, 10 → another). The cashier hands it over. Not a paper card in a drawer.",
        id: "Hadiah kamu set di Settings → Loyalty (misalnya 5 stamp → satu hadiah, 10 → yang lain). Kasir yang menyerahkan. Bukan kartu kertas di laci.",
      },
    ],
  },
  {
    slug: "birthday-top-spender",
    category: "loyalty",
    title: { en: "Birthday and top spender", id: "Ultah dan pelanggan teratas" },
    summary: {
      en: "Two other programs on the same member card. Not mixed with stamps.",
      id: "Dua program lain di kartu member yang sama. Tidak dicampur stamp.",
    },
    body: [
      {
        en: "Birthday: once a year at the cashier. HQ can send a WhatsApp greeting (H-2) with a code if HQ Cloud and an approved template are on. The cashier types that code — they do not invent it.",
        id: "Ultah: sekali setahun di kasir. HQ bisa kirim ucapan WhatsApp (H-2) plus kode kalau Cloud HQ dan template sudah disetujui. Kasir ketik kode itu — tidak mengarang.",
      },
      {
        en: "Top spender: monthly rank for the brand or one branch. After the gift is handed over, that rank clears. Not mixed with stamps.",
        id: "Pelanggan teratas: peringkat bulanan untuk merek atau satu cabang. Setelah hadiah diserahkan, peringkat kosong. Tidak dicampur stamp.",
      },
    ],
  },
  {
    slug: "hq-whatsapp",
    category: "inbox",
    title: { en: "HQ WhatsApp", id: "WhatsApp HQ" },
    summary: {
      en: "One official Cloud API number per brand. Branch is watch-only.",
      id: "Satu nomor Cloud API resmi per merek. Cabang hanya pantau.",
    },
    body: [
      {
        en: "Usual path: send us the brand HQ number. P2P Labs registers it on WhatsApp Cloud and pastes it in Chat apps. You do not need a Meta developer login.",
        id: "Jalur biasa: kirim nomor HQ merek ke kami. P2P Labs daftarkan di WhatsApp Cloud dan tempel di Chat apps. Kamu tidak perlu akun developer Meta.",
      },
      {
        en: "That number is inbox, loyalty notices, and later opt-in templates. Branch WhatsApp can be watched. Atlas does not send from the branch. No canned “thanks for visiting.”",
        id: "Nomor itu inbox, kabar loyalty, dan nanti template opt-in. WhatsApp cabang bisa diawasi. Atlas tidak kirim dari cabang. Tidak ada “thanks for visiting” kalengan.",
      },
      {
        en: "Facebook Messenger and Instagram can land in the same inbox when the Page is connected. Live public DMs need the Meta app published. Wave A is WhatsApp HQ first. Native TikTok chat is not live.",
        id: "Facebook Messenger dan Instagram bisa masuk inbox yang sama setelah Page tersambung. DM publik butuh aplikasi Meta terbit. Wave A = WhatsApp HQ dulu. Chat native TikTok belum live.",
      },
    ],
  },
  {
    slug: "listings-reviews",
    category: "google",
    title: { en: "Google listings and reviews", id: "Listing dan ulasan Google" },
    summary: {
      en: "Name, pin, hours, phone. A person replies to reviews. Maps direction is intent, not a visit.",
      id: "Nama, pin, jam, telepon. Orang yang membalas ulasan. Minta arah Maps itu niat, bukan kunjungan.",
    },
    body: [
      {
        en: "Each outlet should match the real store on Google. A messy listing leaks people before they ever write HQ.",
        id: "Tiap cabang harus sama dengan toko aslinya di Google. Listing berantakan bocor orang sebelum ada yang nulis HQ.",
      },
      {
        en: "Reviews: Maps link shows public notes. Official Google Business Profile lets a person reply so it goes live on Maps. A one-star is still a customer if a person handles it fast. No bot.",
        id: "Ulasan: tautan Maps menampilkan catatan publik. Google Business Profile resmi: orang yang membalas supaya tayang di Maps. Bintang 1 tetap pelanggan kalau orang yang handle, cepat. Bukan bot.",
      },
      {
        en: "We do not count Maps direction requests as store visits, leads, or sales.",
        id: "Kami tidak menghitung minta arah Maps sebagai kunjungan toko, lead, atau omzet.",
      },
    ],
  },
  {
    slug: "tiktok-go",
    category: "tiktok",
    title: { en: "TikTok GO voucher at the till", id: "Voucher TikTok GO di kasir" },
    summary: {
      en: "Scan, check, redeem. TikTok marks it used. Head office sees usage per branch.",
      id: "Scan, cek, tukar. TikTok tandai terpakai. Kantor lihat pemakaian per cabang.",
    },
    body: [
      {
        en: "They already paid on TikTok. AtlasNow captures the next demand. Same camera as the stamp card. If it is a TikTok voucher, Atlas checks with TikTok: still valid? this store? The cashier confirms. TikTok marks it used. No second app.",
        id: "Mereka sudah bayar di TikTok. AtlasNow menangkap demand berikutnya. Kamera yang sama dengan kartu stamp. Kalau voucher TikTok, Atlas cek ke TikTok: masih berlaku? toko ini? Kasir konfirmasi. TikTok tandai sudah dipakai. Tidak ganti aplikasi.",
      },
      {
        en: "A voucher for one branch cannot be used at another. Head office gets centralized TikTok GO voucher usage monitoring — how many were handed over at each store, not TikTok sales numbers.",
        id: "Voucher cabang A tidak bisa dipakai di cabang B. Kantor dapat monitoring pemakaian voucher TikTok GO terpusat — berapa yang diserahkan di tiap toko, bukan angka jualan TikTok.",
      },
      {
        en: "TikTok does not give you their phone number. Redeeming the voucher does not make them a member. They are standing at the cashier: invite them to join. After they join and a real receipt, they enter stamp, birthday, and the other programs.",
        id: "TikTok tidak kasih nomor HP. Tukar voucher tidak membuat mereka member. Mereka sudah di depan kasir: ajak daftar. Setelah daftar dan ada struk sah, masuk stamp, ultah, dan program lain.",
      },
      {
        en: "Connect: Chat apps → TikTok GO till. Paste Merchant ID, they Accept AtlasNow in TikTok Merchant Portal, fetch token, map each store. Sample QR on Loyalty → Scan does not call TikTok. Native TikTok DMs are not this product.",
        id: "Konek: Chat apps → TikTok GO till. Tempel Merchant ID, mereka Accept AtlasNow di Merchant Portal TikTok, ambil token, pasangkan tiap toko. QR contoh di Loyalty → Scan tidak nembak TikTok. DM native TikTok bukan produk ini.",
      },
    ],
  },
  {
    slug: "live-vs-later",
    category: "later",
    title: { en: "What is live vs later", id: "Yang live vs belakangan" },
    summary: {
      en: "We do not sell the roadmap as if it is on.",
      id: "Kami tidak menjual roadmap seolah sudah nyala.",
    },
    body: [
      {
        en: "Live today: HQ Cloud WhatsApp inbox (once connected), join QR, stamp / top spender / birthday, cashier receipt photo, monthly loyalty report, location list, Google listings/reviews when APIs allow, TikTok GO till (demo always; live redeem after merchant token).",
        id: "Live hari ini: inbox WhatsApp Cloud HQ (setelah tersambung), QR daftar, stamp / pelanggan teratas / ultah, foto struk kasir, laporan loyalty bulanan, daftar lokasi, listing/ulasan Google saat API mengizinkan, kasir TikTok GO (demo selalu; tukar live setelah token merchant).",
      },
      {
        en: "Not sold as live: Google posts, ads, weekly ops to-do, POS auto-approve, native TikTok / Instagram / Messenger as the main Wave A inbox, blasting people who never wrote.",
        id: "Tidak dijual sebagai live: post Google, iklan, to-do ops mingguan, Approve otomatis dari POS, inbox utama Wave A dari TikTok / Instagram / Messenger native, blast orang yang tidak pernah nulis.",
      },
      {
        en: "Some Google and Meta doors still wait on their reviews (quota, unpublished app). We say so in the desk instead of pretending.",
        id: "Sebagian pintu Google dan Meta masih nunggu review mereka (kuota, aplikasi belum terbit). Kami bilang di meja, bukan pura-pura.",
      },
    ],
  },
  {
    slug: "whatsapp-cost-october-2026",
    category: "inbox",
    title: {
      en: "WhatsApp usage and billing",
      id: "Penggunaan dan tagihan WhatsApp",
    },
    summary: {
      en: "Inbound stays free. Meta bills service replies after 1,000 per number per month. AtlasNow shows an estimate, not the invoice.",
      id: "Chat masuk tetap gratis. Meta menagih balasan service setelah 1.000 per nomor per bulan. AtlasNow menampilkan perkiraan, bukan faktur.",
    },
    body: [
      {
        en: "Meta sets Cloud API prices. AtlasNow fees are separate. Inbound customer messages stay free. Since 1 October 2026, a non-template reply inside the customer service window is a service message. Each business phone number includes 1,000 delivered service messages per calendar month. Unused messages do not roll over. Meta’s rate depends on the recipient’s country, so AtlasNow does not show one hardcoded price as the bill.",
        id: "Meta yang memasang tarif Cloud API. Biaya AtlasNow terpisah. Pesan masuk pelanggan tetap gratis. Sejak 1 Oktober 2026, balasan tanpa template di dalam jendela layanan adalah service message. Setiap nomor bisnis mencakup 1.000 service message terkirim per bulan kalender. Sisa tidak menumpuk. Tarif Meta tergantung negara penerima, jadi AtlasNow tidak menampilkan satu harga tetap sebagai tagihan.",
      },
      {
        en: "Chat apps and Conversations show recorded delivered service replies from status webhooks stored by AtlasNow, plus an estimated billable count after 1,000. That is a usage estimate. Confirm the final charge in Meta WhatsApp Manager. A local count is not an official balance.",
        id: "Chat apps dan Conversations menampilkan balasan service terkirim dari webhook status yang disimpan AtlasNow, plus perkiraan yang bisa ditagih setelah 1.000. Itu perkiraan pemakaian. Konfirmasi tagihan akhir di Meta WhatsApp Manager. Hitungan lokal bukan saldo resmi.",
      },
      {
        en: "Still outside that service count: the customer writing in, and messages Meta marks as a click-to-WhatsApp free entry point. Marketing templates stay on Meta’s marketing rate. Utility templates follow Meta’s utility rules for that recipient.",
        id: "Di luar hitungan service itu: pelanggan yang menulis, dan pesan yang Meta tandai sebagai pintu gratis click-to-WhatsApp. Template marketing tetap di tarif marketing Meta. Template utility mengikuti aturan utility Meta untuk penerima itu.",
      },
      {
        en: "AtlasNow does not turn the inbox into Meta Business Agent. A person replies. We do not add an AtlasNow fee on those service replies until the founder locks one.",
        id: "AtlasNow tidak mengubah inbox jadi Meta Business Agent. Orang yang membalas. Kami tidak menambah biaya AtlasNow pada balasan service itu sampai founder menguncinya.",
      },
    ],
  },
  {
    slug: "privacy-contact",
    category: "account",
    title: { en: "Privacy and how to reach us", id: "Privasi dan cara menghubungi" },
    summary: {
      en: "A person reads it. Public policies on atlasnow.co.",
      id: "Orang yang membaca. Kebijakan publik di atlasnow.co.",
    },
    body: [
      {
        en: "Write at atlasnow.co/contact. A person at P2P Labs reads it. There is no bot auto-reply.",
        id: "Tulis di atlasnow.co/contact. Orang di P2P Labs yang membaca. Tidak ada bot auto-reply.",
      },
      {
        en: "Public pages: atlasnow.co/privacy, /terms, /cookies, /data-deletion. Cancel and refunds: atlasnow.co/pricing#cancel — no cash refund of a paid invoice; 30-day notice. After the cookie notice, GA4 and Google Ads measurement run on public pages only. No Meta Pixel.",
        id: "Halaman publik: atlasnow.co/privacy, /terms, /cookies, /data-deletion. Batal dan refund: atlasnow.co/pricing#cancel — invoice lunas tidak di-refund; pemberitahuan 30 hari. Setelah pemberitahuan cookie, GA4 dan pengukuran Google Ads jalan di halaman publik saja. Tidak ada Meta Pixel.",
      },
    ],
  },
];

export function tHelp(copy: HelpCopy, locale: Locale): string {
  return locale === "id" ? copy.id : copy.en;
}

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function helpInCategory(id: HelpCatId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === id);
}

export function searchHelp(q: string, locale: Locale): HelpArticle[] {
  const n = q.trim().toLowerCase();
  if (!n) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((a) => {
    const hay = [tHelp(a.title, locale), tHelp(a.summary, locale), ...a.body.map((p) => tHelp(p, locale))]
      .join(" ")
      .toLowerCase();
    return hay.includes(n);
  });
}
