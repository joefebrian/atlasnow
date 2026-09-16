import type { Locale } from "@/lib/i18n/locale";
import { LEGAL_OPERATOR_LINE } from "@/lib/legal/copy";

export type LandingCopy = {
  navProduct: string;
  navWho: string;
  navChannels: string;
  navPricing: string;
  navProblems: string;
  login: string;
  signup: string;
  eyebrow: string;
  h1a: string;
  h1b: string;
  lede: string;
  ctaPrimary: string;
  ctaSecondary: string;
  proof: string;
  problemEyebrow: string;
  problemTitle: string;
  problems: { title: string; pain: string; solve: string }[];
  productEyebrow: string;
  productTitle: string;
  products: { kicker: string; title: string; body: string }[];
  merchantsEyebrow: string;
  merchantsTitle: string;
  merchantsLede: string;
  merchants: { title: string; body: string }[];
  merchantsNote: string;
  flowEyebrow: string;
  flowTitle: string;
  steps: { n: string; title: string; body: string }[];
  honestTitle: string;
  honestBody: string;
  closeTitle: string;
  closeBody: string;
  closeCta: string;
  footerNote: string;
  pricingEyebrow: string;
  pricingTitle: string;
  pricingLede: string;
  pricing: { title: string; body: string; note: string }[];
  pricingCta: string;
  labTitle: string;
  labBody: string;
  gbpEyebrow: string;
  gbpTitle: string;
  gbpLede: string;
  gbp: { title: string; body: string }[];
  gbpNote: string;
  systemsEyebrow: string;
  systemsTitle: string;
  systemsLede: string;
  systems: { title: string; body: string }[];
  goEyebrow: string;
  goTitle: string;
  goLede: string;
  go: { title: string; body: string }[];
  goNote: string;
  goDemo: string;
};

const EN: LandingCopy = {
  navProduct: "What you get",
  navWho: "Who it is for",
  navChannels: "How it works",
  navPricing: "Pricing",
  navProblems: "The problems",
  login: "Sign in",
  signup: "Sign up",
  eyebrow: "Multi-location operations",
  h1a: "Optimize Every Outlet.",
  h1b: "Capture More Demand.",
  lede: "Managing multiple outlets shouldn’t mean drowning in notifications. AtlasNow is a WhatsApp CRM and outlet operations desk: Google Business Profile, Google Maps, HQ inbox, loyalty, and revenue attribution from approved till receipts — not invented Maps visits. One desk for every location.",
  ctaPrimary: "Open AtlasNow",
  ctaSecondary: "See if this is you",
  proof: "Loyalty management for one brand, as many outlets as you have. A group only if you run more than one brand.",
  problemEyebrow: "Sound familiar?",
  problemTitle: "Owners already feel this. AtlasNow is the desk that takes it.",
  problems: [
    {
      title: "The brand lives on a cashier’s phone",
      pain: "HQ WhatsApp on a personal handset is not a company. Staff quit — the chats quit with them. WA, IG, and FB sit in different apps. Nobody at HQ sees who wrote.",
      solve: "The brand WhatsApp lives on AtlasNow, not a personal phone. A person replies — not a bot. Facebook and Instagram land in the same inbox once the Page is connected. Branch chats can be watched; Atlas does not answer from the branch number.",
    },
    {
      title: "A table QR that punches stamps is a farm",
      pain: "Join is treated as a gift. Paper cards live in a drawer. Anyone with the poster collects stamps they never paid for.",
      solve: "The table QR is sign-up only — name, phone, birthday. A stamp comes after a real receipt photo. The same member card holds stamps, top spender, and birthday. The cashier hands over the gift. A paid TikTok GO voucher is not a stamp.",
    },
    {
      title: "Every receipt waits on HQ",
      pain: "A few dozen approvals a day is fine. Thousands, and head office is the bottleneck. Checkout gets slower than paper.",
      solve: "At the cashier: receipt number, amount, photo. If the paper matches, Atlas can approve. If it is blurry or different, head office reviews it. The brand can still require every ticket to be checked.",
    },
    {
      title: "Promo goes to a spreadsheet",
      pain: "A CSV is not consent. People who never wrote get blasted. They report you. The real regulars never hear about the gift.",
      solve: "Messages go only from the official brand number, only to people who already wrote or opted in (birthday / deals). Reply STOP and they are out. Not a spreadsheet. Not TikTok as a phone book.",
    },
    {
      title: "Twelve doors. Still no picture.",
      pain: "Which branch is quiet. Which stamps are stuck. Maps taps get sold as visits. None of it is auditable.",
      solve: "One brand desk for every outlet: loyalty, inbox, cashier. Reports are receipts, stamps, and gifts handed over — not invented visits, leads, or revenue.",
    },
    {
      title: "A one-star review has no owner",
      pain: "The note is a customer asking for help. It sits in Google. A bot replies “thanks for visiting.” Nobody at the brand actually owns it.",
      solve: "Draft the reply in AtlasNow. A person sends it. Name, pin, hours, and phone stay next to the same desk — so the listing and the reply are not someone else’s job.",
    },
    {
      title: "The birthday gift never reaches the cashier",
      pain: "HQ remembers in a spreadsheet. The outlet does not. The guest walks in on their birthday and leaves with nothing.",
      solve: "Birthday is a real program on the same member card. Once a year, at the cashier. The desk shows who is due in the next seven days. The cashier hands over the gift.",
    },
    {
      title: "Nobody knows who spent the most this month",
      pain: "The regulars live in the cashier’s head. Month-end is a guess. The gift goes to the loudest person, not the one who actually came.",
      solve: "Top spender is its own program. Monthly rank for the brand or for one branch. After the gift is handed over, the rank clears. Not mixed with stamps.",
    },
    {
      title: "The chat and the stamp card are two people",
      pain: "WhatsApp has a name. The paper card has another. Excel has a third. HQ cannot tell if they already joined.",
      solve: "Same phone is one person. Chat, join QR, and stamps sit on one member record. A prospect becomes a member after the first qualifying receipt — not after scanning a poster.",
    },
    {
      title: "The Google listing does not match the door",
      pain: "Wrong hours. Old phone. Pin on the neighbor. People write, then walk into a closed store.",
      solve: "Each outlet keeps name, pin, hours, and phone on the same desk as inbox and loyalty. Direction taps stay visit intent. We do not count them as visits.",
    },
  ],
  productEyebrow: "What you get",
  productTitle: "Loyalty management — on the same desk as HQ inbox.",
  products: [
    {
      kicker: "Loyalty management",
      title: "Stamp, top spender, birthday — you set the gift",
      body: "This is the program the owner pays for. One qualifying receipt = one stamp. Top spender is a monthly rank across the brand or a branch. Birthday is once a year at the cashier. The cashier hands over the gift. Not a paper card in a drawer, not points you cannot audit.",
    },
    {
      kicker: "Inbox",
      title: "One official HQ WhatsApp per brand",
      body: "One official brand WhatsApp to send and reply — service, membership, later opt-in messages. Facebook and Instagram land in the same inbox when the Page is connected. Branch chats can be watched. Atlas does not reply from the branch number.",
    },
    {
      kicker: "Membership",
      title: "Join QR, then a real receipt",
      body: "Name, phone, email, birthday, city. They are a prospect until the first qualifying ticket. Same phone as a chat is one person — not a second CRM.",
    },
    {
      kicker: "Cashier",
      title: "Photo the receipt. Stamp only if it matches.",
      body: "At the cashier: one receipt number, the amount, a photo. Match → Atlas can approve. Blurry or different → head office. A paid TikTok GO voucher is not a stamp.",
    },
    {
      kicker: "Outlets",
      title: "Every branch on one list",
      body: "Locations, hours, what still needs a person. Built for clinic, retail, gym, salon, dealer, education — not only F&B.",
    },
    {
      kicker: "Reviews",
      title: "Listings stay honest. Replies stay human.",
      body: "Name, pin, hours, and phone should match the real store. Maps direction taps are visit intent — never a fake visit count. Google is how they find the door. AtlasNow is how you keep them.",
    },
  ],
  merchantsEyebrow: "Who it is for",
  merchantsTitle: "Owners and ops leads with more than one outlet.",
  merchantsLede:
    "If people write before they walk in, leave a review, or collect a stamp — this is the desk. Industry is not the filter. Many doors is.",
  merchants: [
    {
      title: "F&B, cafe, bakery, QSR",
      body: "Join at the table. Stamp after the struk photo. HQ sees the card — not a paper punch in a drawer.",
    },
    {
      title: "Retail & grocery",
      body: "Many outlets, one brand. Members and chats should not live in a different app per store.",
    },
    {
      title: "Beauty, salon & spa",
      body: "Bookings land in chat. Membership and the next visit should share a phone number.",
    },
    {
      title: "Clinic, pharmacy & wellness",
      body: "Patients write first. The record should be a member, not a screenshot on a nurse’s phone.",
    },
    {
      title: "Gym & fitness",
      body: "Trial questions and class times sit next to the same HQ number that holds the member list.",
    },
    {
      title: "Automotive & service",
      body: "“Can you take the car today?” is inbound. It should open a customer, not a dead chat.",
    },
    {
      title: "Hotel & hospitality",
      body: "Guests chat the property. HQ keeps the thread. Branch phones stay on the floor.",
    },
    {
      title: "More than one brand",
      body: "A group sits above brands — owner-run holding or an operator. Same screens. Optional.",
    },
  ],
  merchantsNote:
    "Also a fit for education branches, pet care, and any local chain. Not built for a single stall with no second door.",
  flowEyebrow: "How it works",
  flowTitle: "Four steps. The cashier and the inbox are the same brand.",
  steps: [
    {
      n: "01",
      title: "One brand, every outlet",
      body: "Add the brand and each branch. Login stays off until we follow up. No public demo password.",
    },
    {
      n: "02",
      title: "Connect HQ WhatsApp",
      body: "One official Cloud API number per brand. That is inbox, loyalty, and later opt-in templates — not a branch handset.",
    },
    {
      n: "03",
      title: "Print the join QR. Use it at the cashier.",
      body: "Sign-up only. The cashier photos the receipt. The first qualifying ticket turns a prospect into a member and one stamp.",
    },
    {
      n: "04",
      title: "Run the desk",
      body: "Owner sees HQ chats, members, stamps, reviews, and which outlet is quiet — one brand workspace.",
    },
  ],
  honestTitle: "We only show numbers we can stand behind.",
  honestBody:
    "Join is not a stamp. A paid TikTok GO voucher is not a stamp. Directions is not a visit. A pairing code is not a customer. We do not invent leads or revenue. We do not blast a CSV.",
  closeTitle: "One desk. Every location.",
  closeBody: "Start free on two outlets of one brand. Gold is the desk the owner pays for. Platinum is the long chain. Diamond if you want your own domain and server.",
  closeCta: "Open AtlasNow",
  footerNote: "A P2P Labs (PT Sorak Digital Media) product",
  pricingEyebrow: "Pricing",
  pricingTitle: "Start free. Pay when inboxes go on.",
  pricingLede:
    "Free is join QR, stamps, cashier photo — two outlets, no WhatsApp or Google. Silver is one official WhatsApp Business number and our blast. Gold adds Google, the TikTok GO till, and branch chat watch. Platinum is the long chain. Diamond is your domain and server.",
  pricing: [
    {
      title: "Free",
      body: "One brand, two outlets. Loyalty, join QR, cashier receipt photo, members. No Meta, Google, or TikTok calls.",
      note: "Rp 0. Two outlets.",
    },
    {
      title: "Silver",
      body: "One official WhatsApp Business number and our blast. Extra outlets with − n +. Not Google, not GO, not a store QR.",
      note: "Rp 500.000 / month · 2 included, then +150 rb.",
    },
    {
      title: "Gold",
      body: "HQ WhatsApp, Google listings, TikTok GO till. This is the desk the owner pays for.",
      note: "Rp 2.000.000 / month · 5 included.",
    },
    {
      title: "Platinum",
      body: "Same product as Gold. More doors included. Recap across every outlet.",
      note: "Rp 8.000.000 / month · 15 included.",
    },
    {
      title: "Diamond",
      body: "Own domain and own server. Group desk if you run more than one brand.",
      note: "Talk to us.",
    },
  ],
  pricingCta: "See pricing",
  labTitle: `Made by ${LEGAL_OPERATOR_LINE}`,
  labBody:
    "A small product team in Indonesia. We build AtlasNow for owners who run many locations — membership, inbox, and the outlets underneath. Questions go through the contact form. A person reads it.",
  gbpEyebrow: "Listings still matter",
  gbpTitle: "Google is how they find the door. AtlasNow is how you keep them.",
  gbpLede:
    "Inbox, membership, and the cashier are the product. Listings and reviews stay on the same desk so the pin, the hours, and the reply are not someone else’s job — without pretending a Maps tap is a store visit.",
  gbp: [
    {
      title: "One listing per outlet",
      body: "Name, pin, hours, and phone should match the real store. A messy listing leaks people before they ever write HQ.",
    },
    {
      title: "Reviews with a person",
      body: "A one-star note is a customer asking for help. Draft in AtlasNow. A person sends it — not a bot “thanks for visiting.”",
    },
    {
      title: "Honest Maps numbers",
      body: "Impressions, calls, and direction requests. Direction requests stay visit intent. We do not invent footfall, leads, or revenue.",
    },
  ],
  gbpNote: "Google listings matter. They are not the hero of this site. Detail per outlet lives in Reports → Outlets.",
  systemsEyebrow: "What AtlasNow is",
  systemsTitle: "WhatsApp CRM, Google Business Profile, outlet operations — in the page, not only in a demo.",
  systemsLede:
    "Crawlers and people should read the same thing. These five systems sit in the HTML. Animations on this page are extra, not the copy.",
  systems: [
    {
      title: "Google Business Profile",
      body: "Connect the official Google Business Profile for each outlet. Name, hours, and phone live on the same desk as the HQ inbox. A person replies to reviews — not a bot.",
    },
    {
      title: "Google Maps",
      body: "Every door has a Google Maps pin. Direction requests stay visit intent. We do not count them as store visits, leads, or revenue.",
    },
    {
      title: "WhatsApp CRM",
      body: "Official HQ WhatsApp is the WhatsApp CRM: inbox and member list on one number. Same phone is one person. Not a cashier’s personal chat. Branch chats can be watched; Atlas does not send from the branch.",
    },
    {
      title: "Outlet operations",
      body: "Outlet operations on one list: hours, till receipts, stamps waiting, which door still needs a person today. Built for many locations of one brand.",
    },
    {
      title: "Revenue attribution",
      body: "Revenue attribution we can stand behind comes from approved receipts at the till. A QR scan is not a sale. A Maps tap is not revenue. We do not invent visits, leads, or sales.",
    },
  ],
  goEyebrow: "TikTok GO",
  goTitle: "They already paid on TikTok. AtlasNow captures the next demand.",
  goLede:
    "The customer buys the voucher in TikTok. The cashier checks it and uses it in AtlasNow, at the right store. Head office gets centralized TikTok GO voucher usage monitoring.",
  go: [
    {
      title: "Scan at the cashier",
      body: "Same camera as the stamp card. If it is a TikTok voucher, Atlas checks with TikTok: still valid? this store? The cashier confirms. TikTok marks it used. No second app.",
    },
    {
      title: "The right store only",
      body: "A voucher for one branch cannot be used at another. Each store is linked. A store that is not ready stays off.",
    },
    {
      title: "See it on one desk",
      body: "How many vouchers were handed over at each store. That is the till — not TikTok’s sales numbers. We do not invent revenue.",
    },
    {
      title: "Get a new member at the till",
      body: "They already paid on TikTok — they are standing at the cashier. Invite them to join the brand. After they join and a real receipt, they enter stamp, birthday, and the other programs. The TikTok voucher itself is not membership.",
    },
  ],
  goNote: "This is not TikTok chat. A paid TikTok GO voucher is not a stamp.",
  goDemo: "See the till demo",
};

const ID: LandingCopy = {
  navProduct: "Yang kamu dapat",
  navWho: "Cocok untuk siapa",
  navChannels: "Cara kerja",
  navPricing: "Harga",
  navProblems: "Masalahnya",
  login: "Masuk",
  signup: "Daftar",
  eyebrow: "Operasi multi-lokasi",
  h1a: "Optimize Every Outlet.",
  h1b: "Capture More Demand.",
  lede: "Kelola banyak outlet tidak harus tenggelam di notifikasi. AtlasNow adalah WhatsApp CRM dan meja outlet operations: Google Business Profile, Google Maps, inbox HQ, loyalty, dan revenue attribution dari struk kasir yang disetujui — bukan kunjungan Maps karangan. One desk for every location.",
  ctaPrimary: "Buka AtlasNow",
  ctaSecondary: "Cek, ini kamu bukan",
  proof: "Loyalty management untuk satu merek, sebanyak cabang yang kamu punya. Grup hanya kalau kamu pegang lebih dari satu merek.",
  problemEyebrow: "Kebanyakan gini, kan?",
  problemTitle: "Owner sudah merasakannya. AtlasNow meja yang mengambilnya.",
  problems: [
    {
      title: "Merek hidup di HP kasir",
      pain: "WhatsApp HQ di HP pribadi bukan perusahaan. Staff resign — chat ikut hilang. WA, IG, FB di aplikasi berbeda. HQ tidak lihat siapa yang nulis.",
      solve: "WhatsApp resmi merek duduk di AtlasNow, bukan HP pribadi. Staf yang membalas, bukan bot. Facebook dan Instagram masuk inbox yang sama setelah Page tersambung. Chat cabang bisa dilihat; Atlas tidak membalas dari nomor cabang.",
    },
    {
      title: "QR meja yang ngetuk stamp itu farm",
      pain: "Daftar dikira hadiah. Kartu kertas di laci. Siapa pun yang punya poster kumpul stamp tanpa belanja.",
      solve: "QR di meja hanya untuk daftar — nama, HP, ultah. Stamp setelah foto struk sah. Kartu member yang sama untuk stamp, pelanggan teratas, dan ultah. Kasir yang menyerahkan hadiah. Voucher berbayar TikTok GO bukan stamp.",
    },
    {
      title: "Setiap struk nunggu HQ",
      pain: "Puluhan persetujuan sehari masih kuat. Ribuan, kantor jadi antrian. Kasir lebih lambat dari kertas.",
      solve: "Di kasir: nomor struk, nominal, foto. Kertas cocok, Atlas bisa setujui. Buram atau beda, kantor yang cek. Merek tetap bisa minta kantor cek semua.",
    },
    {
      title: "Promo ke spreadsheet",
      pain: "CSV bukan izin. Orang yang tidak pernah nulis kena blast. Mereka adukan. Regular yang asli tidak dapat kabar hadiah.",
      solve: "Promo hanya dari nomor resmi merek, hanya ke orang yang sudah chat atau sudah izinkan (ultah / promo). Balas STOP, langsung berhenti. Bukan file Excel. Bukan nomor dari TikTok.",
    },
    {
      title: "Dua belas pintu. Tetap tidak kelihatan.",
      pain: "Cabang mana sepi. Stamp mana macet. Tap Maps dijual sebagai kunjungan. Tidak ada yang bisa dicek.",
      solve: "Satu meja merek untuk semua cabang: loyalty, inbox, kasir. Laporan = struk, stamp, dan hadiah yang diserahkan — bukan angka kunjungan atau omzet karangan.",
    },
    {
      title: "Ulasan bintang satu tidak ada yang pegang",
      pain: "Itu pelanggan minta dibantu. Pesannya di Google. Bot membalas “thanks for visiting.” Tidak ada orang merek yang bertanggung jawab.",
      solve: "Tulis draf di AtlasNow. Orang yang mengirim. Nama, pin, jam, dan telepon toko di meja yang sama dengan inbox dan loyalty.",
    },
    {
      title: "Hadiah ultah tidak sampai ke kasir",
      pain: "Kantor ingat di Excel. Cabang tidak. Tamu datang di hari ultah, pulang tanpa apa-apa.",
      solve: "Ultah program sungguhan di kartu member yang sama. Sekali setahun, di kasir. Meja menampilkan siapa yang jatah tujuh hari ke depan. Kasir yang menyerahkan hadiah.",
    },
    {
      title: "Tidak ada yang tahu siapa belanja paling banyak bulan ini",
      pain: "Pelanggan langganan ada di kepala kasir. Akhir bulan tebak-tebakan. Hadiah ke yang paling ramai, bukan yang paling datang.",
      solve: "Pelanggan teratas program terpisah. Peringkat bulanan untuk merek atau satu cabang. Setelah hadiah diserahkan, peringkat kosong. Tidak dicampur dengan stamp.",
    },
    {
      title: "Chat dan kartu stamp orangnya beda",
      pain: "WhatsApp satu nama. Kartu kertas nama lain. Excel nama ketiga. Kantor tidak tahu dia sudah daftar atau belum.",
      solve: "Nomor HP yang sama = satu orang. Chat, QR daftar, dan stamp di satu data member. Calon jadi member setelah struk sah pertama — bukan setelah scan poster.",
    },
    {
      title: "Listing Google tidak sama dengan toko aslinya",
      pain: "Jam salah. Telepon lama. Pin di tetangga. Orang chat dulu, lalu datang ke toko yang sudah tutup.",
      solve: "Tiap cabang pegang nama, pin, jam, dan telepon di meja yang sama dengan inbox dan loyalty. Minta arah tetap niat datang. Kami tidak menghitung itu sebagai kunjungan.",
    },
  ],
  productEyebrow: "Yang kamu dapat",
  productTitle: "Loyalty management — di meja yang sama dengan inbox HQ.",
  products: [
    {
      kicker: "Loyalty management",
      title: "Stamp, top spender, ultah — hadiah kamu yang tentukan",
      body: "Ini program yang owner bayar. Satu struk sah = satu stamp. Pelanggan teratas diurut tiap bulan, per merek atau per cabang. Ultah sekali setahun di kasir. Kasir yang menyerahkan hadiah. Bukan kartu kertas di laci, bukan poin yang tidak bisa dicek.",
    },
    {
      kicker: "Inbox",
      title: "Satu WhatsApp HQ resmi per merek",
      body: "Satu WhatsApp resmi merek untuk kirim dan balas — layanan, member, nanti pesan ke yang sudah izin. Facebook dan Instagram masuk inbox yang sama setelah Page tersambung. Chat cabang bisa dilihat. Atlas tidak membalas dari nomor cabang.",
    },
    {
      kicker: "Membership",
      title: "QR daftar, lalu struk yang sah",
      body: "Nama, HP, email, ultah, kota. Mereka calon sampai tiket sah pertama. Chat dengan HP yang sama = satu orang — bukan CRM kedua.",
    },
    {
      kicker: "Kasir",
      title: "Foto struk. Stamp hanya kalau cocok.",
      body: "Di kasir: satu nomor struk, nominal, foto. Cocok, Atlas bisa setujui. Buram atau beda, kantor yang cek. Voucher berbayar TikTok GO bukan stamp.",
    },
    {
      kicker: "Outlet",
      title: "Semua cabang di satu daftar",
      body: "Lokasi, jam, mana yang masih butuh orang. Untuk klinik, retail, gym, salon, bengkel, edukasi — bukan F&B saja.",
    },
    {
      kicker: "Ulasan",
      title: "Listing jujur. Balasan manusia.",
      body: "Nama, pin, jam, dan telepon harus sama dengan toko aslinya. Tap arah Maps itu niat datang — bukan hitungan kunjungan palsu. Google cara mereka nemu pintu. AtlasNow cara kamu menahan mereka.",
    },
  ],
  merchantsEyebrow: "Cocok untuk siapa",
  merchantsTitle: "Owner dan ops yang punya lebih dari satu outlet.",
  merchantsLede:
    "Kalau orang nulis sebelum masuk, kasih ulasan, atau kumpul stamp — ini mejanya. Industri bukan filter. Banyak pintu itu filter.",
  merchants: [
    {
      title: "F&B, kafe, bakery, QSR",
      body: "Daftar di meja. Stamp setelah foto struk. HQ lihat kartunya — bukan punch kertas di laci.",
    },
    {
      title: "Retail & grocery",
      body: "Banyak outlet, satu merek. Member dan chat tidak boleh tinggal di aplikasi berbeda per toko.",
    },
    {
      title: "Beauty, salon & spa",
      body: "Booking masuk chat. Membership dan kunjungan berikutnya harus satu nomor HP.",
    },
    {
      title: "Klinik, apotek & wellness",
      body: "Pasien nulis dulu. Catatannya harus jadi member, bukan screenshot di HP suster.",
    },
    {
      title: "Gym & fitness",
      body: "Tanya trial dan jadwal kelas duduk di nomor HQ yang sama dengan daftar member.",
    },
    {
      title: "Otomotif & bengkel",
      body: "“Bisa servis hari ini?” itu inbound. Harus buka pelanggan, bukan chat mati.",
    },
    {
      title: "Hotel & hospitality",
      body: "Tamu chat properti. HQ pegang thread. HP cabang tetap di lantai.",
    },
    {
      title: "Lebih dari satu merek",
      body: "Grup di atas merek — holding milik owner atau operator. Layar yang sama. Opsional.",
    },
  ],
  merchantsNote:
    "Cocok juga untuk cabang edukasi, pet care, dan rantai lokal. Kurang pas untuk satu gerobak tanpa pintu kedua.",
  flowEyebrow: "Cara kerja",
  flowTitle: "Empat langkah. Kasir dan inbox merek yang sama.",
  steps: [
    {
      n: "01",
      title: "Satu merek, semua cabang",
      body: "Tambah merek dan tiap outlet. Login belum nyala sampai kami follow up. Tidak ada password demo publik.",
    },
    {
      n: "02",
      title: "Sambung WhatsApp HQ",
      body: "Satu nomor Cloud API resmi per merek. Itu inbox, loyalty, dan nanti template opt-in — bukan HP cabang.",
    },
    {
      n: "03",
      title: "Cetak QR daftar. Jalankan kasir.",
      body: "Daftar saja. Kasir foto struk. Tiket sah pertama mengubah calon jadi member dan satu stamp.",
    },
    {
      n: "04",
      title: "Jalankan mejanya",
      body: "Owner lihat chat HQ, member, stamp, ulasan, dan cabang mana yang sepi — satu workspace merek.",
    },
  ],
  honestTitle: "Angka yang tampil, angka yang kami tanggung.",
  honestBody:
    "Daftar bukan stamp. Voucher berbayar TikTok GO bukan stamp. Minta arah bukan kunjungan. Kode pairing bukan pelanggan. Lead dan omzet tidak kami ada-adakan. Kami tidak blast CSV.",
  closeTitle: "Satu meja. Setiap lokasi.",
  closeBody: "Mulai gratis di dua outlet satu merek. Gold adalah meja yang owner bayar. Diamond kalau kamu mau domain dan server sendiri.",
  closeCta: "Buka AtlasNow",
  footerNote: "Produk P2P Labs (PT Sorak Digital Media)",
  pricingEyebrow: "Harga",
  pricingTitle: "Mulai gratis. Bayar saat inbox nyala.",
  pricingLede:
    "Gratis = QR daftar, stamp, foto kasir — dua outlet, tanpa WhatsApp atau Google. Silver = satu nomor WhatsApp Business resmi dan blast kita. Gold nambah Google, kasir TikTok GO, dan watch chat cabang. Platinum = rantai panjang. Diamond = domain dan server sendiri.",
  pricing: [
    {
      title: "Gratis",
      body: "Satu merek, dua outlet. Loyalty, QR daftar, foto struk kasir, member. Tanpa panggilan Meta, Google, atau TikTok.",
      note: "Rp 0. Dua outlet.",
    },
    {
      title: "Silver",
      body: "Satu nomor WhatsApp Business resmi dan blast kita. Outlet extra dengan − n +. Bukan Google, bukan GO, bukan QR toko.",
      note: "Rp 500.000 / bulan · 2 termasuk, lalu +150 rb.",
    },
    {
      title: "Gold",
      body: "WhatsApp HQ, listing Google, kasir TikTok GO. Ini meja yang owner bayar.",
      note: "Rp 2.000.000 / bulan · 5 termasuk.",
    },
    {
      title: "Platinum",
      body: "Produk yang sama dengan Gold. Lebih banyak pintu termasuk. Recap semua cabang.",
      note: "Rp 8.000.000 / bulan · 15 termasuk.",
    },
    {
      title: "Diamond",
      body: "Domain sendiri dan server sendiri. Meja Grup kalau kamu pegang lebih dari satu merek.",
      note: "Talk to us.",
    },
  ],
  pricingCta: "Lihat harga",
  labTitle: `Dibuat ${LEGAL_OPERATOR_LINE}`,
  labBody:
    "Tim produk kecil di Indonesia. Kami membuat AtlasNow untuk owner yang pegang banyak lokasi — membership, inbox, dan cabang di bawahnya. Pertanyaan lewat form kontak. Orang yang membaca.",
  gbpEyebrow: "Listing tetap penting",
  gbpTitle: "Google cara mereka nemu pintu. AtlasNow cara kamu menahan mereka.",
  gbpLede:
    "Inbox, membership, dan kasir itu produknya. Listing dan ulasan tetap di meja yang sama supaya pin, jam, dan balasan bukan kerja orang lain — tanpa pura-pura tap Maps itu kunjungan toko.",
  gbp: [
    {
      title: "Satu listing per cabang",
      body: "Nama, pin, jam, dan telepon harus sama dengan toko aslinya. Listing berantakan bocor orang sebelum ada yang nulis HQ.",
    },
    {
      title: "Ulasan dipegang orang",
      body: "Bintang satu itu pelanggan minta dibantu. Draft di AtlasNow. Orang yang kirim — bukan bot “thanks for visiting.”",
    },
    {
      title: "Angka Maps yang jujur",
      body: "Impression, telepon, dan minta arah. Minta arah tetap niat datang. Traffic, lead, omzet tidak kami ada-adakan.",
    },
  ],
  gbpNote: "Listing Google penting. Itu bukan hero situs ini. Detail per cabang ada di Reports → Outlets.",
  systemsEyebrow: "AtlasNow itu apa",
  systemsTitle: "WhatsApp CRM, Google Business Profile, outlet operations — di HTML, bukan cuma animasi.",
  systemsLede:
    "Crawler dan orang baca hal yang sama. Lima sistem ini ada di HTML. Animasi di halaman ini tambahan, bukan copy-nya.",
  systems: [
    {
      title: "Google Business Profile",
      body: "Sambungkan Google Business Profile resmi per cabang. Nama, jam, dan telepon di meja yang sama dengan inbox HQ. Orang yang membalas ulasan — bukan bot.",
    },
    {
      title: "Google Maps",
      body: "Tiap pintu punya pin Google Maps. Minta arah tetap niat datang. Kami tidak menghitung itu sebagai kunjungan toko, lead, atau omzet.",
    },
    {
      title: "WhatsApp CRM",
      body: "WhatsApp HQ resmi adalah WhatsApp CRM: inbox dan daftar member di satu nomor. HP yang sama = satu orang. Bukan chat pribadi kasir. Chat cabang bisa diawasi; Atlas tidak kirim dari nomor cabang.",
    },
    {
      title: "Outlet operations",
      body: "Outlet operations di satu daftar: jam, struk kasir, stamp yang nunggu, cabang mana yang masih butuh orang hari ini. Untuk banyak lokasi dari satu merek.",
    },
    {
      title: "Revenue attribution",
      body: "Revenue attribution yang kami tanggung datang dari struk kasir yang disetujui. Scan QR bukan penjualan. Tap Maps bukan omzet. Kami tidak mengarang kunjungan, lead, atau penjualan.",
    },
  ],
  goEyebrow: "TikTok GO",
  goTitle: "Mereka sudah bayar di TikTok. AtlasNow menangkap demand berikutnya.",
  goLede:
    "Pelanggan beli voucher di TikTok. Kasir cek dan pakai di AtlasNow, di toko yang benar. Kantor dapat monitoring pemakaian voucher TikTok GO terpusat.",
  go: [
    {
      title: "Scan di kasir",
      body: "Kamera yang sama dengan kartu stamp. Kalau itu voucher TikTok, Atlas cek ke TikTok: masih berlaku? toko ini? Kasir konfirmasi. TikTok tandai sudah dipakai. Tidak ganti aplikasi.",
    },
    {
      title: "Hanya toko yang benar",
      body: "Voucher cabang A tidak bisa dipakai di cabang B. Tiap toko dipasangkan. Yang belum siap, kasirnya tidak bisa tukar.",
    },
    {
      title: "Kelihatan di satu layar",
      body: "Berapa voucher yang sudah diserahkan di tiap toko. Itu kasir — bukan angka jualan TikTok. Kami tidak mengarang omzet.",
    },
    {
      title: "Dapat member baru di kasir",
      body: "Mereka sudah bayar di TikTok — sudah di depan kasir. Ajak daftar member merek. Setelah daftar dan ada struk sah, masuk stamp, ultah, dan program lain. Voucher TikTok itu bukan membership.",
    },
  ],
  goNote: "Ini bukan chat TikTok. Voucher berbayar TikTok GO bukan stamp.",
  goDemo: "Lihat demo kasir",
};

export function landingCopy(locale: Locale): LandingCopy {
  return locale === "id" ? ID : EN;
}
