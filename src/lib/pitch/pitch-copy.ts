import type { Locale } from "@/lib/i18n/locale";

/** Locked. Do not translate or rewrite. */
export const PITCH_TAGLINE_A = "Optimize Every Outlet.";
export const PITCH_TAGLINE_B = "Capture More Demand.";
export const PITCH_ONE_DESK = "One desk for every location.";

export type PitchPain = { title: string; pain: string; solve: string };

export type PitchCopy = {
  back: string;
  badge: string;
  keys: string;
  prev: string;
  next: string;
  productLine: string;
  coverLede: string;
  chips: { t: string; b: string }[];
  who: { kicker: string; title: string; lede: string; cards: { t: string; b: string }[] };
  pains: {
    kicker: string;
    title: string;
    lede: string;
    problem: string;
    hint: string;
    items: PitchPain[];
  };
  inbox: {
    kicker: string;
    eyebrow: string;
    title: string;
    bullets: string[];
    chatLabel: string;
    bubbles: { side: "left" | "right"; text: string }[];
  };
  join: {
    kicker: string;
    eyebrow: string;
    title: string;
    steps: { t: string; b: string }[];
    tillLabel: string;
    match: string;
  };
  loyalty: {
    kicker: string;
    eyebrow: string;
    title: string;
    programs: { t: string; b: string }[];
    note: string;
    stampLabel: string;
    stampFoot: string;
    topTitle: string;
    topBody: string;
    bdayTitle: string;
    bdayBody: string;
  };
  reviews: {
    kicker: string;
    eyebrow: string;
    title: string;
    bullets: string[];
    who: string;
    quote: string;
    botLabel: string;
    bot: string;
    humanLabel: string;
    human: string;
  };
  flow: {
    kicker: string;
    title: string;
    steps: { n: string; t: string; b: string }[];
    noteBefore: string;
    noteGroup: string;
    noteMid: string;
    noteStore: string;
    noteAfter: string;
  };
  honest: {
    kicker: string;
    title: string;
    live: string;
    later: string;
    liveItems: string[];
    laterItems: string[];
  };
  start: {
    kicker: string;
    title: string;
    lede: string;
    cards: { badge: string; t: string; b: string }[];
    foot: string;
  };
  closeLede: string;
  pricing: string;
};

const EN: PitchCopy = {
  back: "Desk",
  badge: "Client pitch",
  keys: "← → or space",
  prev: "Prev",
  next: "Next",
  productLine: "A P2P Labs product",
  coverLede:
    "Loyalty, the HQ inbox, the till, and reviews — for owners who already run more than one store.",
  chips: [
    { t: "HQ inbox", b: "A person replies" },
    { t: "Stamp", b: "After a receipt" },
    { t: "Reviews", b: "Not a bot" },
  ],
  who: {
    kicker: "Who this is for",
    title: "You already run more than one store. The chats shouldn’t live on three phones.",
    lede: "Coffee, clinic, gym, salon, workshop, hotel, school — doesn’t matter. More than one door does.",
    cards: [
      { t: "One brand", b: "As many outlets as you have. This is the usual start." },
      {
        t: "Several brands",
        b: "A group desk only if you actually run more than one brand. Many outlets of one brand is still one brand.",
      },
      { t: "Not this", b: "One stall. One door. No second location. That’s not us." },
    ],
  },
  pains: {
    kicker: "Sound familiar?",
    title: "You already feel this. AtlasNow is the desk that takes it.",
    lede: "Six problems we actually solve. We don’t invent visits, leads, or revenue.",
    problem: "The problem",
    hint: "Click a row, or let it cycle.",
    items: [
      {
        title: "The brand lives on a cashier’s phone",
        pain: "HQ WhatsApp sits on a personal handset. Staff quit — the chats quit with them. WA, IG, and FB live in different apps. Nobody at HQ sees who wrote.",
        solve: "The official brand number lives on AtlasNow. A person replies — not a bot. You can watch branch chats. We don’t send from the branch number.",
      },
      {
        title: "A table QR that stamps is a farm",
        pain: "Join gets treated like a gift. Paper cards live in a drawer. Anyone with the poster collects stamps they never paid for.",
        solve: "The table QR is sign-up only. A stamp waits for a real receipt photo. The cashier hands over the gift. A paid TikTok GO voucher is not a stamp.",
      },
      {
        title: "Chat and the stamp card are two people",
        pain: "WhatsApp has one name. The paper card has another. Excel has a third. HQ can’t tell if they already joined.",
        solve: "Same phone, one person. Chat, join QR, and stamps sit on one member. They become a member after the first real receipt — not after scanning a poster.",
      },
      {
        title: "Nobody knows who spent the most this month",
        pain: "The regulars live in the cashier’s head. Month-end is a guess. The gift goes to whoever is loudest.",
        solve: "Stamp, points, or top spender — pick one from the receipt. Birthday can stay on. HQ sees it. The cashier hands it over.",
      },
      {
        title: "A one-star has no owner",
        pain: "That’s a customer asking for help. It sits on Google. A bot replies “thanks for visiting.”",
        solve: "Draft the reply in AtlasNow. A person sends it. Name, pin, and hours sit on the same desk.",
      },
      {
        title: "Twelve doors. Still no picture.",
        pain: "Which branch is quiet. Which stamps are stuck. Maps taps get sold as visits.",
        solve: "One brand desk for every outlet. Reports are receipts, stamps, and gifts handed over — not made-up visits or revenue.",
      },
    ],
  },
  inbox: {
    kicker: "Inbox",
    eyebrow: "The brand phone",
    title: "Official brand WhatsApp. Not a cashier’s personal phone.",
    bullets: [
      "One official Cloud number per brand — HQ. Inbox, loyalty, later opt-in.",
      "A person replies. Not a bot that says thanks for visiting.",
      "You can watch branch chats. We don’t send from those numbers.",
      "Blasts only to people who already wrote or opted in. Not a spreadsheet. STOP still works.",
    ],
    chatLabel: "HQ WhatsApp · a person replies",
    bubbles: [
      { side: "left", text: "Still open?" },
      { side: "right", text: "Tomang until 10. Table for 2?" },
      { side: "left", text: "How many stamps do I have?" },
    ],
  },
  join: {
    kicker: "Join + till",
    eyebrow: "A scan is not a member",
    title: "The table QR is sign-up. A stamp waits for a real receipt.",
    steps: [
      { t: "1 · Sign up", b: "Name, phone, birthday. They’re a prospect — not a member, not a stamp." },
      { t: "2 · Photo at the till", b: "Receipt number, amount, photo. Match → Atlas can approve. Blurry → head office checks." },
      { t: "3 · Then stamp / points / rank", b: "One valid ticket. A paid TikTok GO voucher is not a stamp." },
    ],
    tillLabel: "Till · receipt photo",
    match: "Match · Atlas can approve",
  },
  loyalty: {
    kicker: "Loyalty",
    eyebrow: "HQ can see it. The till can run it.",
    title: "Four programs. Only one earns from a receipt.",
    programs: [
      { t: "Stamp", b: "One valid receipt, one stamp. Gift at the till." },
      { t: "Points", b: "Every Rp X → Y points. Leftover doesn’t round up." },
      { t: "Top spender", b: "This month’s rank. A gift per place. Then it clears." },
      { t: "Birthday", b: "Once a year at the till. Can stay on next to the others." },
    ],
    note: "Stamp, points, and top spender: pick one. Save fails if you tick two. The checkboxes stay. Birthday can stay on.",
    stampLabel: "Stamp card · pick one earn program",
    stampFoot: "4/10 · coffee at 5 · tumbler at 10. The table QR does not punch a stamp.",
    topTitle: "Top spender",
    topBody: "#1 voucher 200k. Monthly. Not a stamp.",
    bdayTitle: "Birthday",
    bdayBody: "Gift at the till. Once a year. Can stay on.",
  },
  reviews: {
    kicker: "Reviews + outlets",
    eyebrow: "Google finds the door",
    title: "Honest listings. A person answers the one-star.",
    bullets: [
      "Name, pin, hours, and phone should match the real store.",
      "A 1-star is a customer asking for help. Draft in AtlasNow. A person sends it.",
      "A Maps direction tap is intent — not a visit. We don’t invent leads or revenue.",
      "Loyalty reports: receipts, stamps, gifts handed over at the till.",
    ],
    who: "Andi · Tomang · 12 min",
    quote: "“Waited 40 minutes. Nobody replied on WhatsApp.”",
    botLabel: "A bot would send",
    bot: "Thanks for visiting! 😊",
    humanLabel: "Brand person · sends when you tap",
    human: "Sorry about the wait — Rina from Tomang will call you today.",
  },
  flow: {
    kicker: "How you run it",
    title: "Four steps. Same brand at the till and in the inbox.",
    steps: [
      { n: "01", t: "One brand, every outlet", b: "Login after we follow up. No public demo password." },
      { n: "02", t: "HQ WhatsApp", b: "Official number. Inbox + loyalty. Not a branch phone." },
      { n: "03", t: "Print the join QR", b: "Table = sign-up. Cashier photos the receipt." },
      { n: "04", t: "Run the desk", b: "Chats, members, stamps, reviews, which outlet is quiet." },
    ],
    noteBefore: "",
    noteGroup: "Group",
    noteMid: " connects Google and the brand number. ",
    noteStore: "The store",
    noteAfter: " prints the QR, photos the receipt, and hands over the gift.",
  },
  honest: {
    kicker: "Live vs later",
    title: "If it’s live, we sell it. If it isn’t, we say so.",
    live: "Live now",
    later: "Coming later — not sold as live",
    liveItems: [
      "HQ WhatsApp (once the Cloud number is connected)",
      "Join QR, receipt photo at the till, stamp / points / top spender / birthday",
      "Monthly loyalty report — not made-up visits",
      "Google reviews, drafted by a person",
      "Outlets from Maps, hours and pin on the same desk",
    ],
    laterItems: [
      "Self-serve checkout / a card on the site",
      "Moka / Majoo auto-approve",
      "Google posts, ads, weekly to-do",
      "TikTok inbox — waiting on app review",
      "Self-serve card checkout — invoice still, after follow-up",
    ],
  },
  start: {
    kicker: "Start",
    title: "Start free. Pay when WhatsApp and Google go on.",
    lede: "Free doesn’t call Meta, Google, or TikTok. QR, stamps, receipt photos, members.",
    cards: [
      {
        badge: "Start here",
        t: "Free",
        b: "One brand, two outlets. Loyalty, join QR, receipt photo, members. No inbox APIs.",
      },
      {
        badge: "WhatsApp + blast",
        t: "Silver",
        b: "One official WhatsApp Business number and our blast. Rp 500.000 / month.",
      },
      {
        badge: "Inbox + listings + GO",
        t: "Gold",
        b: "HQ WhatsApp, Google, TikTok GO till. Rp 2.000.000 / month · 5 included.",
      },
    ],
    foot: "atlasnow.co/pricing · no card to sign up · login after we follow up.",
  },
  closeLede: "One brand desk. Every location. The problems you already feel — on AtlasNow.",
  pricing: "Pricing",
};

const ID: PitchCopy = {
  back: "Meja",
  badge: "Pitch klien",
  keys: "← → atau spasi",
  prev: "Sebelum",
  next: "Lanjut",
  productLine: "Produk P2P Labs",
  coverLede:
    "Loyalty, inbox HQ, kasir, dan ulasan — untuk owner yang sudah pegang lebih dari satu toko.",
  chips: [
    { t: "Inbox HQ", b: "Orang yang balas" },
    { t: "Stamp", b: "Setelah struk" },
    { t: "Ulasan", b: "Bukan bot" },
  ],
  who: {
    kicker: "Untuk siapa",
    title: "Kamu sudah pegang lebih dari satu toko. Chatnya jangan tinggal di tiga HP.",
    lede: "Kopi, klinik, gym, salon, bengkel, hotel, sekolah — terserah. Yang penting lebih dari satu pintu.",
    cards: [
      { t: "Satu merek", b: "Cabang sebanyak yang kamu punya. Biasanya mulai di sini." },
      {
        t: "Beberapa merek",
        b: "Meja grup hanya kalau kamu benar-benar pegang lebih dari satu merek. Banyak cabang dari satu merek tetap satu merek.",
      },
      { t: "Bukan ini", b: "Satu gerobak. Satu pintu. Tidak ada cabang kedua. Bukan kita." },
    ],
  },
  pains: {
    kicker: "Kebanyakan gini, kan?",
    title: "Owner sudah merasakannya. AtlasNow meja yang mengambilnya.",
    lede: "Enam masalah yang benar-benar kami selesaikan. Kami tidak mengarang kunjungan, lead, atau omzet.",
    problem: "Masalahnya",
    hint: "Klik barisnya, atau biarkan jalan sendiri.",
    items: [
      {
        title: "Merek hidup di HP kasir",
        pain: "WhatsApp HQ di HP pribadi. Staff resign — chat ikut hilang. WA, IG, FB di aplikasi berbeda. Kantor tidak lihat siapa yang nulis.",
        solve: "Nomor resmi merek duduk di AtlasNow. Orang yang membalas, bukan bot. Chat cabang bisa dilihat. Kami tidak kirim dari nomor cabang.",
      },
      {
        title: "QR meja yang ngetuk stamp itu farm",
        pain: "Daftar dikira hadiah. Kartu kertas di laci. Siapa pun yang punya poster kumpul stamp tanpa belanja.",
        solve: "QR meja = daftar saja. Stamp nunggu foto struk sah. Kasir yang serahkan hadiah. Voucher TikTok GO berbayar bukan stamp.",
      },
      {
        title: "Chat dan kartu stamp orangnya beda",
        pain: "WhatsApp satu nama. Kartu kertas nama lain. Excel nama ketiga. Kantor tidak tahu dia sudah daftar atau belum.",
        solve: "Nomor HP yang sama = satu orang. Chat, QR daftar, dan stamp di satu member. Jadi member setelah struk sah pertama — bukan setelah scan poster.",
      },
      {
        title: "Tidak kelihatan siapa belanja paling banyak",
        pain: "Regular ada di kepala kasir. Akhir bulan tebak-tebakan. Hadiah ke yang paling ramai.",
        solve: "Stamp, poin, atau pelanggan teratas — pilih satu dari struk. Ultah boleh tetap nyala. HQ yang lihat, kasir yang serahkan.",
      },
      {
        title: "Ulasan bintang satu tidak ada yang pegang",
        pain: "Itu pelanggan minta dibantu. Pesannya di Google. Bot membalas “thanks for visiting.”",
        solve: "Tulis draf di AtlasNow. Orang yang mengirim. Nama, pin, jam toko di meja yang sama.",
      },
      {
        title: "Dua belas pintu. Tetap tidak kelihatan.",
        pain: "Cabang mana sepi. Stamp mana macet. Tap Maps dijual sebagai kunjungan.",
        solve: "Satu meja merek untuk semua cabang. Laporan = struk, stamp, hadiah yang diserahkan — bukan kunjungan atau omzet karangan.",
      },
    ],
  },
  inbox: {
    kicker: "Inbox",
    eyebrow: "HP merek",
    title: "WhatsApp resmi merek. Bukan HP pribadi kasir.",
    bullets: [
      "Satu nomor Cloud resmi per merek — HQ. Inbox, loyalty, nanti opt-in.",
      "Orang yang membalas. Bukan bot yang bilang thanks for visiting.",
      "Chat cabang bisa diawasi. Kami tidak kirim dari nomor itu.",
      "Blast hanya ke yang sudah nulis atau opt-in. Bukan spreadsheet. STOP tetap jalan.",
    ],
    chatLabel: "WhatsApp HQ · orang yang membalas",
    bubbles: [
      { side: "left", text: "Masih buka?" },
      { side: "right", text: "Tomang sampai jam 10. Meja untuk 2?" },
      { side: "left", text: "Stamp saya berapa?" },
    ],
  },
  join: {
    kicker: "Daftar + kasir",
    eyebrow: "Scan bukan member",
    title: "QR meja itu daftar. Stamp nunggu struk asli.",
    steps: [
      { t: "1 · Daftar", b: "Nama, HP, ultah. Mereka calon — belum member, belum stamp." },
      { t: "2 · Foto di kasir", b: "Nomor struk, Rp, foto. Cocok → Atlas bisa approve. Buram → kantor cek." },
      { t: "3 · Baru stamp / poin / ranking", b: "Satu tiket sah. Voucher TikTok GO berbayar bukan stamp." },
    ],
    tillLabel: "Kasir · foto struk",
    match: "Cocok · Atlas bisa approve",
  },
  loyalty: {
    kicker: "Loyalty",
    eyebrow: "HQ bisa lihat. Kasir bisa jalanin.",
    title: "Empat program. Cuma satu yang ngetuk dari struk.",
    programs: [
      { t: "Stamp", b: "Satu struk sah, satu stamp. Hadiah di kasir." },
      { t: "Poin", b: "Setiap Rp X → Y poin. Sisa tidak dibulatkan." },
      { t: "Pelanggan teratas", b: "Ranking bulan ini. Hadiah per tempat. Lalu kosong." },
      { t: "Ultah", b: "Sekali setahun di kasir. Boleh nyala bareng yang lain." },
    ],
    note: "Stamp, poin, dan pelanggan teratas: pilih satu. Save gagal kalau dua. Centangnya tetap. Ultah boleh nyala.",
    stampLabel: "Kartu stamp · pilih satu program dari struk",
    stampFoot: "4/10 · kopi di 5 · tumbler di 10. QR meja tidak ngetuk stamp.",
    topTitle: "Pelanggan teratas",
    topBody: "#1 voucher 200k. Bulanan. Bukan stamp.",
    bdayTitle: "Ultah",
    bdayBody: "Hadiah di kasir. Sekali setahun. Boleh nyala.",
  },
  reviews: {
    kicker: "Ulasan + cabang",
    eyebrow: "Google nemuin pintunya",
    title: "Listing jujur. Orang yang jawab bintang satu.",
    bullets: [
      "Nama, pin, jam, telepon harus sama dengan toko asli.",
      "Bintang 1 = pelanggan minta dibantu. Draf di AtlasNow. Orang yang kirim.",
      "Minta arah di Maps itu niat — bukan kunjungan. Kami tidak mengarang lead atau omzet.",
      "Laporan loyalty: struk, stamp, hadiah yang kasir serahkan.",
    ],
    who: "Andi · Tomang · 12 mnt",
    quote: "“Nunggu 40 menit. WhatsApp tidak ada yang balas.”",
    botLabel: "Bot biasanya kirim",
    bot: "Thanks for visiting! 😊",
    humanLabel: "Orang merek · kirim setelah tap",
    human: "Maaf menunggu — Rina dari Tomang akan telepon hari ini.",
  },
  flow: {
    kicker: "Cara jalanin",
    title: "Empat langkah. Merek yang sama di kasir dan di inbox.",
    steps: [
      { n: "01", t: "Satu merek, tiap cabang", b: "Login setelah kami follow up. Tidak ada password demo publik." },
      { n: "02", t: "WhatsApp HQ", b: "Nomor resmi. Inbox + loyalty. Bukan HP cabang." },
      { n: "03", t: "Cetak QR daftar", b: "Meja = daftar. Kasir foto struk." },
      { n: "04", t: "Jalankan mejanya", b: "Chat, member, stamp, ulasan, cabang mana yang sepi." },
    ],
    noteBefore: "",
    noteGroup: "Grup",
    noteMid: " menyambung Google dan nomor merek. ",
    noteStore: "Toko",
    noteAfter: " cetak QR, foto struk, serahkan hadiah.",
  },
  honest: {
    kicker: "Live vs nanti",
    title: "Yang live, kami jual. Yang belum, kami bilang.",
    live: "Sudah live",
    later: "Nanti — tidak dijual seolah sudah live",
    liveItems: [
      "WhatsApp HQ (setelah nomor Cloud tersambung)",
      "QR daftar, foto struk di kasir, stamp / poin / pelanggan teratas / ultah",
      "Laporan loyalty bulanan — bukan kunjungan karangan",
      "Ulasan Google, draf orang",
      "Cabang dari Maps, jam dan pin di meja yang sama",
    ],
    laterItems: [
      "Checkout sendiri / kartu di situs",
      "Approve otomatis dari Moka / Majoo",
      "Post Google, iklan, to-do mingguan",
      "Inbox TikTok — masih nunggu review app",
      "Checkout kartu sendiri — masih invoice, setelah follow-up",
    ],
  },
  start: {
    kicker: "Mulai",
    title: "Mulai gratis. Bayar saat WhatsApp dan Google nyala.",
    lede: "Gratis tidak nelpon Meta, Google, atau TikTok. QR, stamp, foto struk, member.",
    cards: [
      {
        badge: "Mulai di sini",
        t: "Gratis",
        b: "Satu merek, dua outlet. Loyalty, QR daftar, foto struk, member. Tanpa API inbox.",
      },
      {
        badge: "WhatsApp + blast",
        t: "Silver",
        b: "Satu nomor WhatsApp Business resmi dan blast kita. Rp 500.000 / bulan.",
      },
      {
        badge: "Inbox + listing + GO",
        t: "Gold",
        b: "WhatsApp HQ, Google, kasir TikTok GO. Rp 2.000.000 / bulan · 5 termasuk.",
      },
    ],
    foot: "atlasnow.co/pricing · daftar tanpa kartu · login setelah kami follow up.",
  },
  closeLede: "Satu meja merek. Setiap lokasi. Masalah yang sudah kamu rasakan — di AtlasNow.",
  pricing: "Harga",
};

export function pitchCopy(locale: Locale): PitchCopy {
  return locale === "id" ? ID : EN;
}
