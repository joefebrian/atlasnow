import type { Locale } from "@/lib/i18n/locale";

export const LEGAL_OPERATOR = "P2P Labs";
export const LEGAL_ENTITY = "PT Sorak Digital Media";
/** Public credit: trade name first, PT in parens. Joe 2026-09-10. */
export const LEGAL_OPERATOR_LINE = `${LEGAL_OPERATOR} (${LEGAL_ENTITY})`;
export const LEGAL_PRODUCT = "AtlasNow";
export const LEGAL_SITE = "https://atlasnow.co";
export const LEGAL_CONTACT_EMAIL = "hello@atlasnow.co";

/** Footer line. Year follows the clock — do not hardcode. Joe 2026-09-11: PT in parens. */
export function atlasProductCopyright(now = new Date()): string {
  return `© ${now.getFullYear()} ${LEGAL_PRODUCT} · A ${LEGAL_OPERATOR_LINE} product`;
}
export const LEGAL_EFFECTIVE = "28 August 2026";
export const LEGAL_EFFECTIVE_ID = "28 Agustus 2026";

export const LEGAL_PATHS = {
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  deletion: "/data-deletion",
} as const;

export const GOOGLE_COOKIE_POLICY = "https://policies.google.com/technologies/cookies";
export const META_COOKIE_POLICY = "https://www.facebook.com/privacy/policies/cookies";

export type LegalSection = { id?: string; heading: string; paragraphs: string[] };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

function enPrivacy(): LegalDoc {
  return {
    title: "Privacy Policy",
    updated: `Effective ${LEGAL_EFFECTIVE}`,
    intro: `${LEGAL_PRODUCT} is a local-demand and conversations platform operated by ${LEGAL_OPERATOR}. This policy explains what we collect, why we collect it, and how you can ask us to delete it. It applies to agency staff, client staff, and people whose messages appear in a client inbox after they contact a connected Facebook Page, Instagram Professional account, WhatsApp number, TikTok Business account, or other linked channel.`,
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          `${LEGAL_OPERATOR} (“we”, “us”) operates ${LEGAL_PRODUCT} at ${LEGAL_SITE}. We act as a processor for business clients who use the product to manage their locations, reviews, and customer conversations. For our own website, login, and billing records we act as a controller.`,
          `Contact: ${LEGAL_CONTACT_EMAIL}`,
        ],
      },
      {
        heading: "Information we collect",
        paragraphs: [
          "Account data: name, email, password hash, role, and which clients or locations you may access. If you create an account with Google or Facebook we receive the name and email on that account so we can open your workspace. We do not post to your personal profile. WhatsApp is not used to create an AtlasNow login.",
          "Business data: client and location profiles (name, address, phone, maps or Google Business Profile IDs) that staff enter or import.",
          "Google Business Profile data, when a client connects Google: listing details, reviews, and related metadata needed to operate Reputation and Data Health.",
          "Meta / Facebook and Instagram data, when a client clicks Connect Meta: Facebook user ID of the person who authorized, the Pages they granted, Page access tokens, Page name and ID, and if the Page is linked to an Instagram Professional account, that account’s id and username. When Messenger is enabled we receive messaging webhooks: Page ID, the sender’s Page-scoped ID (PSID), message text, attachments metadata, and timestamps. When Instagram Messaging is enabled we receive the same kind of webhook for that Professional account: Instagram-scoped ID (IGSID), message text, attachments metadata, and timestamps. We do not receive the sender’s phone number from Messenger or Instagram Direct. We do not post to personal profiles, publish on the Page or Instagram grid, or read insights.",
          "WhatsApp data, when a location is connected through our WhatsApp bridge: phone number or WhatsApp LID, chat text, media references, and session status.",
          "TikTok data, when a client clicks Connect TikTok: TikTok user open_id of the person who authorized, the TikTok Business Account id and handle they granted, and access tokens for that account. When Business Messaging is enabled we receive webhooks: Business Account id, the customer’s open_id, message text, attachments metadata, and timestamps. We do not receive the sender’s phone number from TikTok Direct. We do not publish videos, run ads, or read TikTok insights.",
          "Technical logs: request metadata and error reports used to keep the service running.",
        ],
      },
      {
        heading: "How we use information",
        paragraphs: [
          "Provide the product: inboxes, location records, reviews, channel connections, and agency tools.",
          "Map a Facebook Page, Instagram Professional account, WhatsApp session, or TikTok Business handle to the correct client location so conversations land in the right inbox.",
          "Authenticate users, prevent abuse, and debug failures.",
          "We do not sell personal data. We do not use Facebook, Instagram, or TikTok platform data to build independent advertising profiles, and we do not transfer that data to other advertisers or data brokers.",
        ],
      },
      {
        heading: "Facebook and Instagram Platform data",
        paragraphs: [
          `${LEGAL_PRODUCT} uses Facebook Login for Business so a client (or an agency sitting with that client) can connect Facebook Pages they administer and, when linked, the Instagram Professional account on that Page. We request only these permissions: pages_show_list (list Pages they admin so they can map a Page to a branch); pages_messaging (receive and reply to Messenger conversations in the Conversations inbox); pages_manage_metadata (subscribe the Page to our webhook so new messages arrive); instagram_basic (read the linked Instagram Professional account id and username for mapping); instagram_manage_messages (receive and reply to Instagram Direct messages in the same inbox); business_management (required by Meta as a dependency of the Page and Instagram messaging permissions — we do not manage the client’s Business Manager, ad accounts, or Business users). We do not request permissions to publish posts, run ads, or read insights.`,
          "Page tokens and Messenger / Instagram events are stored so the client’s Conversations inbox can show incoming DMs and so a human agent can reply. That platform data is used only to operate that messaging feature and related support. We do not use it to build advertising profiles or to target ads. If a client disconnects Meta we stop ingesting new events and we can delete stored Page tokens and Messenger / Instagram threads on request.",
          "End customers who write to a Page or Instagram Professional account are not asked to create an AtlasNow account. Their PSID or IGSID and message content are visible to the Page owner’s authorized AtlasNow users (that client’s staff and, when the agency operates the workspace, P2P Labs operators working on that client).",
        ],
      },
      {
        heading: "TikTok Platform data",
        paragraphs: [
          `${LEGAL_PRODUCT} uses TikTok’s official Business Messaging so a client (or a group sitting with that client) can connect TikTok Business accounts they administer. We request only what is required to list those accounts, receive Direct messages, and send a human agent’s reply in the Conversations inbox. We do not request permissions to publish videos, run ads, or read insights.`,
          "Account tokens and TikTok Direct events are stored so the client’s Conversations inbox can show incoming DMs and so a human agent can reply. That platform data is used only to operate that messaging feature and related support. We do not use it to build advertising profiles or to target ads. If a client disconnects TikTok we stop ingesting new events and we can delete stored tokens and TikTok threads on request.",
          "End customers who write to a connected TikTok Business account are not asked to create an AtlasNow account. Their open_id and message content are visible to the brand’s authorized AtlasNow users (that client’s staff and, when the group operates the workspace, P2P Labs operators working on that client). We do not treat a TikTok open_id as a phone number.",
          "TikTok GO Dining (Local Service API) is separate: we store merchant id, shop mapping to outlets, and voucher query/redeem events at the till. WhatsApp deal notices about GO vouchers go only to Atlas customers who opted in on the HQ number — not to a TikTok phone book, and not as a CSV. We do not send the voucher QR payload on WhatsApp.",
        ],
      },
      {
        heading: "Who can see data",
        paragraphs: [
          "Authorized users of the same client workspace (and agency operators for that client).",
          "Infrastructure we use to host the app and, where a client has connected them, Google, Meta, TikTok, and the WhatsApp session provider. Those parties process data under their own terms.",
          "We may disclose information if required by law or to protect the service from abuse.",
        ],
      },
      {
        heading: "Retention",
        paragraphs: [
          "Account and business records are kept while the workspace is active.",
          "Conversation messages stay until the client deletes them, disconnects the channel and asks us to purge, or a valid deletion request is completed.",
          "Error logs are rotated and are not a customer archive.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You may ask for access, correction, or deletion of personal data we hold. Workspace users can also disconnect Google or Meta from Channels, and Page owners can remove the app from Facebook Page settings (that also drops the linked Instagram Professional account).",
          `People who only messaged a connected Page, Instagram Professional account, WhatsApp number, or TikTok Business account can request deletion at ${LEGAL_SITE}${LEGAL_PATHS.deletion} or by emailing ${LEGAL_CONTACT_EMAIL}. We aim to complete verified requests within 30 days. Deleting our copy does not delete the conversation on Facebook, Instagram, WhatsApp, or TikTok themselves.`,
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          `${LEGAL_PRODUCT} is a business tool. It is not directed at children under 13 (or the equivalent minimum age in your country).`,
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          `We use a small set of first-party cookies to sign you in and remember language. After you accept the cookie notice we load Google Analytics 4 (G-HY5V8HH3Z1) and Google Ads measurement on public marketing pages only. We may send a hashed email to Google for enhanced conversions when you submit sign-up or contact. We do not load these tags in the signed-in workspace, member cards, or receipt flows. We do not place a Meta Pixel. Details: ${LEGAL_SITE}${LEGAL_PATHS.cookies}.`,
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "We will update this page if our practices change and revise the effective date above.",
        ],
      },
    ],
  };
}

function idPrivacy(): LegalDoc {
  return {
    title: "Kebijakan Privasi",
    updated: `Berlaku ${LEGAL_EFFECTIVE_ID}`,
    intro: `${LEGAL_PRODUCT} adalah platform local-demand dan percakapan yang dioperasikan ${LEGAL_OPERATOR}. Kebijakan ini menjelaskan data yang kami kumpulkan, alasan pengumpulannya, dan cara Anda meminta penghapusan. Berlaku untuk staf agensi, staf klien, dan orang yang pesannya muncul di inbox klien setelah menghubungi Page Facebook, akun Instagram Professional, nomor WhatsApp, akun TikTok Business, atau kanal terhubung lainnya.`,
    sections: [
      {
        heading: "Siapa kami",
        paragraphs: [
          `${LEGAL_OPERATOR} (“kami”) mengoperasikan ${LEGAL_PRODUCT} di ${LEGAL_SITE}. Untuk data bisnis klien kami bertindak sebagai pemroses. Untuk situs, login, dan catatan operasional kami sendiri, kami bertindak sebagai pengendali.`,
          `Kontak: ${LEGAL_CONTACT_EMAIL}`,
        ],
      },
      {
        heading: "Data yang kami kumpulkan",
        paragraphs: [
          "Data akun: nama, email, hash kata sandi, peran, dan klien atau lokasi yang boleh diakses. Jika Anda membuat akun dengan Google atau Facebook, kami menerima nama dan email akun itu untuk membuka workspace. Kami tidak memposting ke profil pribadi Anda. WhatsApp tidak dipakai untuk membuat login AtlasNow.",
          "Data bisnis: profil klien dan lokasi (nama, alamat, telepon, ID peta atau Google Business Profile) yang diisi atau diimpor staf.",
          "Data Google Business Profile, jika klien menghubungkan Google: detail listing, ulasan, dan metadata untuk Reputation serta Data Health.",
          "Data Meta / Facebook dan Instagram, jika klien menekan Connect Meta: ID pengguna Facebook yang memberi izin, Page yang diberikan, token Page, nama dan ID Page, dan jika Page tertaut akun Instagram Professional, id serta username akun itu. Jika Messenger aktif kami menerima webhook: ID Page, Page-scoped ID pengirim (PSID), teks pesan, metadata lampiran, dan waktu. Jika Instagram Messaging aktif kami menerima webhook sejenis untuk akun Professional itu: Instagram-scoped ID (IGSID), teks pesan, metadata lampiran, dan waktu. Messenger dan Instagram Direct tidak memberi nomor telepon pengirim. Kami tidak memposting ke profil pribadi, tidak menerbitkan di grid Page atau Instagram, dan tidak membaca insights.",
          "Data WhatsApp, jika lokasi terhubung lewat jembatan WhatsApp kami: nomor atau LID, teks chat, referensi media, dan status sesi.",
          "Data TikTok, jika klien menekan Connect TikTok: open_id pengguna TikTok yang memberi izin, id dan handle akun TikTok Business yang diberikan, serta token akun itu. Jika Business Messaging aktif kami menerima webhook: id akun Business, open_id pelanggan, teks pesan, metadata lampiran, dan waktu. TikTok Direct tidak memberi nomor telepon pengirim. Kami tidak menerbitkan video, tidak menjalankan iklan, dan tidak membaca insights TikTok.",
          "Log teknis: metadata permintaan dan laporan error untuk menjaga layanan.",
        ],
      },
      {
        heading: "Cara kami memakai data",
        paragraphs: [
          "Menyediakan produk: inbox, data lokasi, ulasan, koneksi kanal, dan tools agensi.",
          "Memetakan Page Facebook, akun Instagram Professional, sesi WhatsApp, atau handle TikTok Business ke lokasi klien yang benar.",
          "Autentikasi, pencegahan penyalahgunaan, dan perbaikan gangguan.",
          "Kami tidak menjual data pribadi. Kami tidak memakai data platform Facebook, Instagram, atau TikTok untuk profil iklan mandiri, dan tidak menyerahkannya ke pengiklan lain atau data broker.",
        ],
      },
      {
        heading: "Data platform Facebook dan Instagram",
        paragraphs: [
          `${LEGAL_PRODUCT} memakai Facebook Login for Business agar klien (atau agensi yang mendampingi) dapat menghubungkan Page Facebook yang mereka kelola dan, jika tertaut, akun Instagram Professional di Page itu. Kami hanya meminta izin ini: pages_show_list (menampilkan Page yang mereka admin agar bisa dipetakan ke cabang); pages_messaging (menerima dan membalas percakapan Messenger di inbox Conversations); pages_manage_metadata (berlangganan webhook Page agar pesan baru masuk); instagram_basic (membaca id dan username akun Instagram Professional yang tertaut, untuk pemetaan); instagram_manage_messages (menerima dan membalas Instagram Direct di inbox yang sama); business_management (diwajibkan Meta sebagai ketergantungan izin pesan Page dan Instagram — kami tidak mengelola Business Manager, akun iklan, atau pengguna Business klien). Kami tidak meminta izin untuk menerbitkan post, menjalankan iklan, atau membaca insights.`,
          "Token Page dan event Messenger / Instagram disimpan agar inbox Conversations menampilkan DM masuk dan staf manusia dapat membalas. Data platform itu hanya dipakai untuk fitur pesan tersebut dan dukungan terkait. Kami tidak memakainya untuk profil iklan atau targeting iklan. Jika klien memutus Meta, kami berhenti menerima event baru dan dapat menghapus token serta thread Messenger / Instagram jika diminta.",
          "Pelanggan akhir yang menulis ke Page atau akun Instagram Professional tidak perlu membuat akun AtlasNow. PSID atau IGSID dan isi pesan terlihat oleh pengguna AtlasNow yang berwenang di workspace klien tersebut (staf klien dan, jika agensi mengoperasikan workspace, operator P2P Labs untuk klien itu).",
        ],
      },
      {
        heading: "Data platform TikTok",
        paragraphs: [
          `${LEGAL_PRODUCT} memakai TikTok Business Messaging resmi agar klien (atau grup yang mendampingi) dapat menghubungkan akun TikTok Business yang mereka kelola. Kami hanya meminta izin yang perlu untuk menampilkan akun itu, menerima Direct, dan mengirim balasan staf manusia di inbox Conversations. Kami tidak meminta izin untuk menerbitkan video, menjalankan iklan, atau membaca insights.`,
          "Token akun dan event TikTok Direct disimpan agar inbox Conversations menampilkan DM masuk dan staf manusia dapat membalas. Data platform itu hanya dipakai untuk fitur pesan tersebut dan dukungan terkait. Kami tidak memakainya untuk profil iklan atau targeting iklan. Jika klien memutus TikTok, kami berhenti menerima event baru dan dapat menghapus token serta thread TikTok jika diminta.",
          "Pelanggan akhir yang menulis ke akun TikTok Business terhubung tidak perlu membuat akun AtlasNow. open_id dan isi pesan terlihat oleh pengguna AtlasNow yang berwenang di merek itu (staf klien dan, jika grup mengoperasikan workspace, operator P2P Labs untuk klien itu). Kami tidak memperlakukan open_id TikTok sebagai nomor telepon.",
          "TikTok GO Dining (Local Service API) terpisah: kami menyimpan merchant id, peta shop ke gerai, dan event cek/tebus voucher di kasir. Pemberitahuan WA soal voucher GO hanya ke customer Atlas yang opt-in di nomor HQ — bukan buku telepon TikTok, bukan CSV. Kami tidak mengirim payload QR voucher di WhatsApp.",
        ],
      },
      {
        heading: "Siapa yang dapat melihat data",
        paragraphs: [
          "Pengguna berwenang di workspace klien yang sama (dan operator agensi untuk klien itu).",
          "Infrastruktur hosting, serta Google, Meta, TikTok, dan penyedia sesi WhatsApp jika klien menghubungkannya.",
          "Kami dapat mengungkapkan data jika diwajibkan hukum atau untuk melindungi layanan.",
        ],
      },
      {
        heading: "Retensi",
        paragraphs: [
          "Catatan akun dan bisnis disimpan selama workspace aktif.",
          "Pesan percakapan disimpan sampai klien menghapusnya, memutus kanal dan meminta pembersihan, atau permintaan penghapusan yang sah selesai.",
          "Log error dirotasi dan bukan arsip pelanggan.",
        ],
      },
      {
        heading: "Hak Anda",
        paragraphs: [
          "Anda dapat meminta akses, perbaikan, atau penghapusan data pribadi. Pengguna workspace juga dapat memutus Google atau Meta dari Channels, dan pemilik Page dapat mencabut aplikasi dari pengaturan Page Facebook (itu juga memutus akun Instagram Professional yang tertaut).",
          `Orang yang hanya mengirim pesan ke Page, akun Instagram Professional, WhatsApp, atau akun TikTok Business terhubung dapat meminta penghapusan di ${LEGAL_SITE}${LEGAL_PATHS.deletion} atau email ${LEGAL_CONTACT_EMAIL}. Kami menargetkan 30 hari untuk permintaan yang terverifikasi. Menghapus salinan kami tidak menghapus percakapan di Facebook, Instagram, WhatsApp, atau TikTok.`,
        ],
      },
      {
        heading: "Anak-anak",
        paragraphs: [
          `${LEGAL_PRODUCT} adalah tools bisnis. Tidak ditujukan untuk anak di bawah 13 tahun (atau usia minimum setara di negara Anda).`,
        ],
      },
      {
        heading: "Cookie",
        paragraphs: [
          `Kami memakai sedikit cookie first-party untuk login dan bahasa. Setelah Anda OK pada pemberitahuan cookie, kami memuat Google Analytics 4 (G-HY5V8HH3Z1) dan pengukuran Google Ads hanya di halaman pemasaran publik. Kami dapat mengirim email ter-hash ke Google untuk enhanced conversions saat daftar atau form kontak. Tidak di workspace yang sudah login, kartu member, atau alur struk. Kami tidak memasang Meta Pixel. Rincian: ${LEGAL_SITE}${LEGAL_PATHS.cookies}.`,
        ],
      },
      {
        heading: "Perubahan",
        paragraphs: [
          "Kami akan memperbarui halaman ini jika praktik kami berubah dan merevisi tanggal berlaku di atas.",
        ],
      },
    ],
  };
}

function enTerms(): LegalDoc {
  return {
    title: "Terms of Service",
    updated: `Effective ${LEGAL_EFFECTIVE}. Fees, cancellation, and refunds added 7 September 2026.`,
    intro: `These terms govern use of ${LEGAL_PRODUCT} (${LEGAL_SITE}), a B2B workspace operated by ${LEGAL_OPERATOR}. By creating an account, inviting users, or connecting a third-party channel you agree to them.`,
    sections: [
      {
        heading: "The service",
        paragraphs: [
          `${LEGAL_PRODUCT} helps agencies and multi-location businesses manage local listings, reviews, and customer conversations. Features depend on which integrations the workspace connects (Google, Meta Messenger and Instagram Direct, WhatsApp, and others as we add them).`,
          "We may change, suspend, or discontinue parts of the product. Third-party APIs (Google, Meta, WhatsApp) can change or fail without notice; we are not responsible for those platforms’ outages, policy decisions, or data they refuse to deliver.",
        ],
      },
      {
        heading: "Accounts and clients",
        paragraphs: [
          "You must provide accurate account details and keep credentials confidential. Creating an account (email, Google, or Facebook) means you accept these Terms and the Privacy Policy in effect on that date. We store the version and the time you accepted. Agency operators may access a client workspace to deliver the service. Client admins are responsible for who they invite.",
          "You represent that you have the right to connect any Google account, Facebook Page, Instagram account, or WhatsApp number you authorize, and that you will use messaging features in line with Meta, Google, and WhatsApp policies (including customer care and 24-hour messaging windows where they apply).",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Do not use the product to spam, harass, impersonate, break the law, or scrape other people’s data. Do not attempt to bypass authentication or abuse webhooks and APIs.",
          "Conversation data belongs to the business that received the message. Agency staff may only use it to serve that client.",
        ],
      },
      {
        heading: "Third-party platforms",
        paragraphs: [
          "Connecting Meta is optional. Facebook Login for Business, Page tokens, and Messenger / Instagram webhooks are subject to Meta’s Platform Terms, Developer Policies, and the Page’s own settings. Connecting Google is subject to Google’s terms. WhatsApp connectivity may use an unofficial session bridge; the client accepts that risk when they scan a QR or enter a pairing code.",
        ],
      },
      {
        heading: "Content and privacy",
        paragraphs: [
          `Our handling of personal data is described in the Privacy Policy (${LEGAL_SITE}${LEGAL_PATHS.privacy}). You are responsible for providing any notices your customers need when you reply from ${LEGAL_PRODUCT}.`,
        ],
      },
      {
        heading: "Disclaimer and liability",
        paragraphs: [
          "The service is provided “as is”. We do not warrant uninterrupted access or that inbox data is complete. To the maximum extent allowed by law, ${LEGAL_OPERATOR} is not liable for indirect, incidental, or lost-profit damages, or for data that a third-party platform never sent us.",
        ],
      },
      {
        id: "fees-cancellation-refunds",
        heading: "Fees, cancellation, and refunds",
        paragraphs: [
          `Paid plans are billed monthly in advance by IDR invoice (or as the SOW says). There is no card checkout on ${LEGAL_SITE}. The Free plan has no fee.`,
          `To cancel a paid plan, email ${LEGAL_CONTACT_EMAIL} with 30 days’ notice so we do not issue the next invoice. Outlet count on that last invoice is the list we had when you gave notice. Downgrade (archive locations) shrinks the next invoice; it does not refund the current one.`,
          "We do not refund a paid invoice in cash, including unused days of a paid period and the 90-day pilot invoice. You keep the workspace until that paid period ends. Unused WhatsApp credits are not paid out in cash; they survive a brand pause and die if the tenant is deleted after the data-deletion process. Meta and Google bills are charged on those accounts — we do not refund them.",
          "If an invoice is unpaid for 14 days after due, the workspace becomes read-only. We do not delete your data for non-payment.",
        ],
      },
      {
        heading: "Termination",
        paragraphs: [
          "Either party may stop using or providing the service. Cancellation of paid plans follows the fees section above. On request we will disconnect channels and delete personal data as described in the data deletion instructions, except records we must keep for security or law.",
        ],
      },
      {
        heading: "Law",
        paragraphs: [
          `These terms are governed by the laws of the Republic of Indonesia. Questions: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  };
}

function idTerms(): LegalDoc {
  return {
    title: "Syarat Layanan",
    updated: `Berlaku ${LEGAL_EFFECTIVE_ID}. Pasal biaya, pembatalan, dan refund ditambah 7 September 2026.`,
    intro: `Syarat ini mengatur pemakaian ${LEGAL_PRODUCT} (${LEGAL_SITE}), workspace B2B yang dioperasikan ${LEGAL_OPERATOR}. Dengan membuat akun, mengundang pengguna, atau menghubungkan kanal pihak ketiga, Anda menyetujuinya.`,
    sections: [
      {
        heading: "Layanan",
        paragraphs: [
          `${LEGAL_PRODUCT} membantu agensi dan bisnis multi-lokasi mengelola listing lokal, ulasan, dan percakapan pelanggan. Fitur bergantung pada integrasi yang dihubungkan workspace (Google, Meta Messenger dan Instagram Direct, WhatsApp, dan kanal lain yang kami tambahkan).`,
          "Kami dapat mengubah, menangguhkan, atau menghentikan sebagian produk. API pihak ketiga dapat berubah atau gagal tanpa pemberitahuan; kami tidak bertanggung jawab atas gangguan, keputusan kebijakan, atau data yang tidak mereka kirim.",
        ],
      },
      {
        heading: "Akun dan klien",
        paragraphs: [
          "Anda wajib memberi data akun yang akurat dan menjaga kredensial. Membuat akun (email, Google, atau Facebook) berarti Anda menyetujui Syarat ini dan Kebijakan Privasi yang berlaku pada tanggal itu. Kami menyimpan versi dan waktu persetujuan. Operator agensi dapat mengakses workspace klien untuk menjalankan layanan. Admin klien bertanggung jawab atas undangan pengguna.",
          "Anda menyatakan berhak menghubungkan akun Google, Page Facebook, akun Instagram, atau nomor WhatsApp yang Anda otorisasi, dan akan memakai fitur pesan sesuai kebijakan Meta, Google, dan WhatsApp.",
        ],
      },
      {
        heading: "Penggunaan yang diizinkan",
        paragraphs: [
          "Jangan memakai produk untuk spam, pelecehan, peniruan identitas, pelanggaran hukum, atau mengambil data orang lain. Jangan mencoba menembus autentikasi atau menyalahgunakan webhook dan API.",
          "Data percakapan milik bisnis yang menerima pesan. Staf agensi hanya boleh memakainya untuk melayani klien itu.",
        ],
      },
      {
        heading: "Platform pihak ketiga",
        paragraphs: [
          "Menghubungkan Meta bersifat opsional. Facebook Login for Business, token Page, dan webhook Messenger / Instagram tunduk pada Platform Terms Meta, Developer Policies, dan pengaturan Page. Menghubungkan Google tunduk pada syarat Google. Koneksi WhatsApp dapat memakai jembatan sesi tidak resmi; klien menerima risiko itu saat memindai QR atau memasukkan pairing code.",
        ],
      },
      {
        heading: "Konten dan privasi",
        paragraphs: [
          `Pengelolaan data pribadi dijelaskan di Kebijakan Privasi (${LEGAL_SITE}${LEGAL_PATHS.privacy}). Anda bertanggung jawab memberi pemberitahuan yang diperlukan pelanggan saat membalas dari ${LEGAL_PRODUCT}.`,
        ],
      },
      {
        heading: "Penafian dan tanggung jawab",
        paragraphs: [
          `Layanan disediakan “sebagaimana adanya”. Kami tidak menjamin akses tanpa gangguan atau kelengkapan data inbox. Sejauh diizinkan hukum, ${LEGAL_OPERATOR} tidak bertanggung jawab atas kerugian tidak langsung, insidental, kehilangan laba, atau data yang tidak pernah dikirim platform pihak ketiga.`,
        ],
      },
      {
        id: "fees-cancellation-refunds",
        heading: "Biaya, pembatalan, dan refund",
        paragraphs: [
          `Paket berbayar ditagih bulanan di muka lewat invoice IDR (atau sesuai SOW). Tidak ada checkout kartu di ${LEGAL_SITE}. Paket Gratis tidak berbayar.`,
          `Untuk membatalkan paket berbayar, email ${LEGAL_CONTACT_EMAIL} dengan pemberitahuan 30 hari supaya invoice berikutnya tidak terbit. Jumlah outlet di invoice terakhir = daftar saat pemberitahuan. Downgrade (arsip lokasi) mengecilkan invoice berikutnya; tidak mengembalikan invoice yang sedang jalan.`,
          "Kami tidak mengembalikan invoice yang sudah lunas secara tunai, termasuk sisa hari dalam periode yang sudah dibayar dan invoice uji 90 hari. Workspace tetap jalan sampai periode yang sudah dibayar habis. Sisa kredit WhatsApp tidak diuangkan; tetap ada jika merek dijeda, dan hangus jika tenant dihapus setelah proses hapus data. Tagihan Meta dan Google ke akun mereka — kami tidak refund itu.",
          "Jika invoice belum dibayar 14 hari setelah jatuh tempo, workspace menjadi baca saja. Kami tidak menghapus data karena tunggakan.",
        ],
      },
      {
        heading: "Penghentian",
        paragraphs: [
          "Salah satu pihak dapat berhenti memakai atau menyediakan layanan. Pembatalan paket berbayar mengikuti pasal biaya di atas. Atas permintaan kami akan memutus kanal dan menghapus data pribadi sesuai instruksi penghapusan, kecuali catatan yang wajib disimpan untuk keamanan atau hukum.",
        ],
      },
      {
        heading: "Hukum",
        paragraphs: [
          `Syarat ini diatur hukum Republik Indonesia. Pertanyaan: ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  };
}

function enDeletion(): LegalDoc {
  return {
    title: "User data deletion",
    updated: `Effective ${LEGAL_EFFECTIVE}`,
    intro: `Meta, Google, and good practice require a clear way to delete user data. This page is the data-deletion instructions URL for ${LEGAL_PRODUCT}. We honor verified requests for AtlasNow accounts and for people whose Facebook, Instagram, or WhatsApp messages were stored in a client inbox.`,
    sections: [
      {
        heading: "What you can ask us to delete",
        paragraphs: [
          "AtlasNow login: your user record, memberships, and session.",
          "Meta connection: Page access tokens we stored for Pages you authorized, and Messenger / Instagram threads mapped to those Pages if you are the Page owner or the person who wrote the DMs.",
          "WhatsApp: contacts and conversations tied to a number or LID you identify.",
          "We cannot erase copies that still live on Facebook, Instagram, WhatsApp, or Google — only the copy inside ${LEGAL_PRODUCT}. Disconnecting the app on Facebook also stops new tokens from being issued to us.",
        ],
      },
      {
        heading: "How workspace users delete data",
        paragraphs: [
          "Sign in → Channels → Disconnect Meta (or Data Health → disconnect Google). That drops stored tokens for that client.",
          "Ask an agency admin to deactivate your login or remove your membership.",
          `Email ${LEGAL_CONTACT_EMAIL} from the same address as your login if you want the account fully erased.`,
        ],
      },
      {
        heading: "How customers (people who DMed a Page) request deletion",
        paragraphs: [
          "You do not need an AtlasNow account. Use the form on this page or email us.",
          "Tell us which Page, Instagram handle, or brand you wrote to, the Facebook/Instagram name you used, approximate time, and if you have it the message text. We use that to find the PSID or IGSID thread. We may ask the Page owner to confirm.",
          "We aim to delete matching inbox threads and contact records within 30 days of a verifiable request, then email you when done.",
        ],
      },
      {
        heading: "Facebook Login callback",
        paragraphs: [
          `This URL (${LEGAL_SITE}${LEGAL_PATHS.deletion}) is our user-data deletion instructions page for Facebook Login for Business. If Meta later requires an automated callback endpoint, we will add it and keep this page as the human-readable instructions.`,
        ],
      },
    ],
  };
}

function idDeletion(): LegalDoc {
  return {
    title: "Penghapusan data pengguna",
    updated: `Berlaku ${LEGAL_EFFECTIVE_ID}`,
    intro: `Meta, Google, dan praktik yang baik mensyaratkan cara jelas untuk menghapus data pengguna. Halaman ini adalah instruksi penghapusan data ${LEGAL_PRODUCT}. Kami menindaklanjuti permintaan terverifikasi untuk akun AtlasNow dan untuk orang yang pesan Facebook, Instagram, atau WhatsApp-nya tersimpan di inbox klien.`,
    sections: [
      {
        heading: "Yang dapat Anda minta dihapus",
        paragraphs: [
          "Login AtlasNow: catatan pengguna, keanggotaan, dan sesi.",
          "Koneksi Meta: token Page yang kami simpan untuk Page yang Anda izinkan, serta thread Messenger / Instagram yang terpetakan ke Page itu jika Anda pemilik Page atau pengirim DM.",
          "WhatsApp: kontak dan percakapan yang terkait nomor atau LID yang Anda sebutkan.",
          `Kami tidak dapat menghapus salinan yang masih ada di Facebook, Instagram, WhatsApp, atau Google — hanya salinan di dalam ${LEGAL_PRODUCT}. Mencabut aplikasi di Facebook juga menghentikan token baru ke kami.`,
        ],
      },
      {
        heading: "Cara pengguna workspace menghapus data",
        paragraphs: [
          "Masuk → Channels → Disconnect Meta (atau Data Health → putuskan Google). Token klien itu dibuang.",
          "Minta admin agensi menonaktifkan login atau mencabut keanggotaan Anda.",
          `Email ${LEGAL_CONTACT_EMAIL} dari alamat yang sama dengan login jika ingin akun dihapus penuh.`,
        ],
      },
      {
        heading: "Cara pelanggan (yang DM ke Page) meminta penghapusan",
        paragraphs: [
          "Anda tidak perlu akun AtlasNow. Isi formulir di halaman ini atau email kami.",
          "Sebutkan Page, akun Instagram, atau merek yang Anda hubungi, nama Facebook/Instagram, perkiraan waktu, dan jika ada cuplikan pesan. Kami memakainya untuk menemukan thread PSID atau IGSID. Kami dapat meminta konfirmasi pemilik Page.",
          "Kami menargetkan 30 hari untuk menghapus thread inbox dan kontak yang cocok setelah permintaan dapat diverifikasi, lalu mengirim email saat selesai.",
        ],
      },
      {
        heading: "Callback Facebook Login",
        paragraphs: [
          `URL ini (${LEGAL_SITE}${LEGAL_PATHS.deletion}) adalah halaman instruksi penghapusan data untuk Facebook Login for Business. Jika Meta kemudian mewajibkan endpoint callback otomatis, kami akan menambahkannya dan tetap menampilkan halaman ini sebagai instruksi yang dapat dibaca manusia.`,
        ],
      },
    ],
  };
}

function enCookies(): LegalDoc {
  return {
    title: "Cookie Policy",
    updated: `Effective ${LEGAL_EFFECTIVE}. GA4 added 9 September 2026. Google Ads measurement after cookie OK, 9 September 2026.`,
    intro: `This policy explains how ${LEGAL_OPERATOR} uses cookies and similar storage on ${LEGAL_SITE} (${LEGAL_PRODUCT}). It is written for Google OAuth / Business Profile and Meta Facebook Login review: we describe only what this site actually sets. It sits next to our Privacy Policy (${LEGAL_SITE}${LEGAL_PATHS.privacy}).`,
    sections: [
      {
        heading: "What we mean by cookies",
        paragraphs: [
          "Cookies are small text files a site stores on your browser. Similar tools (local storage) can remember a choice without a cookie. We treat both as “cookies” here.",
        ],
      },
      {
        heading: "Cookies we set on atlasnow.co",
        paragraphs: [
          "atlasnow_session — strictly necessary. Keeps a signed-in workspace user logged in. HTTP-only, SameSite=Lax, Secure in production. Lasts 14 days or until you sign out. Without it, login does not work.",
          "atlasnow_locale — functional. Remembers English or Indonesian. Lasts one year. You set it when you switch language. The site still works if you block it (it falls back to English).",
          "We may remember in local storage that you accepted the cookie notice (atlasnow_cookie_ok_v3), so we do not show it on every visit. That choice allows GA4 and Google Ads measurement on public pages.",
        ],
      },
      {
        heading: "Google Analytics (GA4) and Google Ads",
        paragraphs: [
          "The Google tag (gtag.js, G-HY5V8HH3Z1) loads on public pages only: home, about, pricing, signup (including pending), login, contact, FAQ, help, and legal. Hosts: atlasnow.co and www.atlasnow.co. Not localhost. Not the signed-in workspace, member cards, or receipts.",
          "Until you tap OK, Consent Mode keeps analytics and ads storage denied (no Google cookies; cookieless pings may still fire). After OK we grant analytics_storage, ad_storage, ad_user_data, and ad_personalization so we can measure AtlasNow ads and import conversions. Google may then set _ga, _ga_*, and _gcl_au.",
          "Events we send: page_view, generate_lead (sign-up or contact), sign_up, click_to_whatsapp (HQ chat on the pending page), select_item (pricing CTA). For enhanced conversions we may send the email you typed, hashed by Google — not your phone, not chat text, not receipts.",
          "This is advertising for AtlasNow (P2P Labs), not ads we run inside a brand workspace. We still do not place a Meta Pixel.",
        ],
      },
      {
        heading: "What we do not set",
        paragraphs: [
          "We do not place the Meta Pixel. We do not set _fbp or _fbc on atlasnow.co. We do not use Facebook cookies to build ads audiences or measure ads on this website.",
          "We do not load Google Tag Manager as a separate ads container. We do not send workspace, inbox, or loyalty data to Google Ads.",
          "We do not sell cookie data. We do not use Google or Meta platform data from a connected brand (Pages, WhatsApp, Business Profile) to advertise AtlasNow.",
        ],
      },
      {
        heading: "Google (Business Profile and sign-in)",
        paragraphs: [
          `When you choose Continue with Google on Sign up or Sign in, or when a workspace connects Google Business Profile, we send you to Google’s OAuth screen. Google may then set cookies on google.com and accounts.google.com (sign-in, security, consent). Those cookies are Google’s, under Google’s Cookie Policy (${GOOGLE_COOKIE_POLICY}) and Google’s Privacy Policy. For Sign up we receive your email and name to create or open an AtlasNow login — we do not keep that Google token. For Business Profile we receive an OAuth token on our server so we can read and, when permitted, write listing and review data for the locations you mapped. We do not load the Google JavaScript Maps widget. Public-site Ads measurement is the GA4 / Google Ads section above — not this OAuth.`,
          "Server-side calls we make to Google (Business Profile, Geocoding, Places) happen from our servers. They do not plant extra cookies in your browser.",
          "You can disconnect Google in Settings. You can also revoke AtlasNow in your Google Account → third-party access. Fonts on this site are self-hosted; we do not load fonts from fonts.googleapis.com.",
        ],
      },
      {
        heading: "Meta (Facebook Login, Messenger, Instagram)",
        paragraphs: [
          `When you choose Continue with Facebook on Sign up or Sign in, we send you to Facebook Login and receive your email and name to create or open an AtlasNow login — we do not keep that Facebook token or post to your profile. When a brand connects a Facebook Page (and a linked Instagram Professional account), we send you to Facebook Login for Business. Meta may set cookies on facebook.com (session, security). Those cookies are Meta’s, under Meta’s Cookies Policy (${META_COOKIE_POLICY}) and Meta’s Privacy Policy. After you approve Pages, we store Page tokens on our server so Messenger and Instagram Direct events can land in the right AtlasNow inbox.`,
          "People who write to a connected Page or Instagram Professional account do not visit atlasnow.co and do not receive AtlasNow cookies. We store their Page-scoped ID (PSID) or Instagram-scoped ID (IGSID) and message text for the Page owner. We do not use that data for Meta ads targeting.",
          `You can disconnect Meta in Settings → Chat apps. Page admins can remove the app from Facebook Page settings. Data deletion instructions: ${LEGAL_SITE}${LEGAL_PATHS.deletion}.`,
        ],
      },
      {
        heading: "Choices",
        paragraphs: [
          "Strictly necessary cookies (login) cannot be switched off if you use the product. Block them in your browser and you will not stay signed in.",
          "Language: switch it in the header, or delete atlasnow_locale in your browser.",
          "Google / Meta cookies: manage them in your Google or Facebook account and browser settings, or do not click Connect / Continue with Google or Facebook. Blocking third-party cookies may break the OAuth popup or redirect.",
          "GA4 and Google Ads measurement use Consent Mode v2. Ignore the banner: ads/analytics storage stay denied. After OK they are granted. To stop later: clear site data for atlasnow.co, or use a tracker blocker. We do not add a Meta Pixel without updating this page first.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          `Questions: ${LEGAL_CONTACT_EMAIL}. Operator: ${LEGAL_OPERATOR}.`,
        ],
      },
    ],
  };
}

function idCookies(): LegalDoc {
  return {
    title: "Kebijakan Cookie",
    updated: `Berlaku ${LEGAL_EFFECTIVE_ID}. GA4 ditambah 9 September 2026. Pengukuran Google Ads setelah OK cookie, 9 September 2026.`,
    intro: `Kebijakan ini menjelaskan cookie dan penyimpanan serupa yang dipakai ${LEGAL_OPERATOR} di ${LEGAL_SITE} (${LEGAL_PRODUCT}). Ditulis agar sesuai tinjauan Google OAuth / Business Profile dan Meta Facebook Login: kami hanya menyebut yang benar-benar dipasang situs ini. Melengkapi Kebijakan Privasi (${LEGAL_SITE}${LEGAL_PATHS.privacy}).`,
    sections: [
      {
        heading: "Yang kami maksud cookie",
        paragraphs: [
          "Cookie adalah berkas teks kecil di browser. Alat serupa (local storage) bisa mengingat pilihan tanpa cookie. Keduanya kami sebut “cookie” di sini.",
        ],
      },
      {
        heading: "Cookie yang kami pasang di atlasnow.co",
        paragraphs: [
          "atlasnow_session — wajib. Menjaga pengguna workspace tetap masuk. HTTP-only, SameSite=Lax, Secure di produksi. Berlaku 14 hari atau sampai logout. Tanpa ini, login tidak jalan.",
          "atlasnow_locale — fungsional. Mengingat bahasa Inggris atau Indonesia. Berlaku satu tahun. Dipasang saat Anda mengganti bahasa. Situs tetap jalan jika diblokir (kembali ke Inggris).",
          "Kami dapat mengingat di local storage bahwa Anda OK pada pemberitahuan cookie (atlasnow_cookie_ok_v3), supaya tidak muncul setiap kunjungan. Pilihan itu mengizinkan GA4 dan pengukuran Google Ads di halaman publik.",
        ],
      },
      {
        heading: "Google Analytics (GA4) dan Google Ads",
        paragraphs: [
          "Tag Google (gtag.js, G-HY5V8HH3Z1) hanya di halaman publik: beranda, about, harga, daftar (termasuk pending), login, kontak, FAQ, bantuan, dan legal. Host: atlasnow.co dan www.atlasnow.co. Bukan localhost. Bukan workspace yang sudah login, kartu member, atau struk.",
          "Sampai Anda menekan OK, Consent Mode menahan analytics dan ads storage (denied). Setelah OK kami grant analytics_storage, ad_storage, ad_user_data, dan ad_personalization supaya iklan AtlasNow bisa diukur. Google dapat memasang _ga, _ga_*, dan _gcl_au.",
          "Event yang kami kirim: page_view, generate_lead (daftar atau kontak), sign_up, click_to_whatsapp (chat HQ di halaman pending), select_item (CTA harga). Untuk enhanced conversions kami dapat mengirim email yang Anda ketik, di-hash oleh Google — bukan nomor HP, bukan isi chat, bukan struk.",
          "Ini iklan untuk AtlasNow (P2P Labs), bukan iklan di dalam workspace merek. Kami tetap tidak memasang Meta Pixel.",
        ],
      },
      {
        heading: "Yang tidak kami pasang",
        paragraphs: [
          "Kami tidak memasang Meta Pixel. Kami tidak memasang _fbp atau _fbc di atlasnow.co. Kami tidak memakai cookie Facebook untuk audiens iklan atau mengukur iklan di situs ini.",
          "Kami tidak memuat Google Tag Manager sebagai wadah iklan terpisah. Kami tidak mengirim data workspace, inbox, atau loyalty ke Google Ads.",
          "Kami tidak menjual data cookie. Kami tidak memakai data platform Google atau Meta dari merek yang terhubung (Page, WhatsApp, Business Profile) untuk beriklan AtlasNow.",
        ],
      },
      {
        heading: "Google (Business Profile dan masuk)",
        paragraphs: [
          `Saat Anda memilih Lanjut dengan Google di Daftar atau Masuk, atau saat workspace menghubungkan Google Business Profile, kami mengarahkan Anda ke layar OAuth Google. Google dapat memasang cookie di google.com dan accounts.google.com (masuk, keamanan, persetujuan). Cookie itu milik Google, tunduk pada Kebijakan Cookie Google (${GOOGLE_COOKIE_POLICY}) dan Kebijakan Privasi Google. Untuk daftar, kami menerima email dan nama agar bisa membuka login AtlasNow — token Google itu tidak kami simpan. Untuk Business Profile kami menerima token OAuth di server agar dapat membaca dan, jika diizinkan, menulis data listing dan ulasan. Kami tidak memuat widget JavaScript Google Maps. Pengukuran iklan di situs publik ada di bagian GA4 / Google Ads di atas — bukan OAuth ini.`,
          "Panggilan server ke Google (Business Profile, Geocoding, Places) terjadi dari server kami. Itu tidak menanam cookie tambahan di browser Anda.",
          "Anda dapat memutus Google di Pengaturan. Anda juga dapat mencabut AtlasNow di Akun Google → akses pihak ketiga. Font situs ini di-host sendiri; kami tidak memuat font dari fonts.googleapis.com.",
        ],
      },
      {
        heading: "Meta (Facebook Login, Messenger, Instagram)",
        paragraphs: [
          `Saat Anda memilih Lanjut dengan Facebook di Daftar atau Masuk, kami mengarahkan Anda ke Facebook Login dan menerima email serta nama untuk membuka login AtlasNow — token itu tidak kami simpan dan kami tidak memposting ke profil Anda. Saat merek menghubungkan Page Facebook (dan akun Instagram Professional yang tertaut), kami mengarahkan Anda ke Facebook Login for Business. Meta dapat memasang cookie di facebook.com (sesi, keamanan). Cookie itu milik Meta, tunduk pada Kebijakan Cookie Meta (${META_COOKIE_POLICY}) dan Kebijakan Privasi Meta. Setelah Anda menyetujui Page, kami menyimpan token Page di server agar event Messenger dan Instagram Direct masuk ke inbox AtlasNow yang benar.`,
          "Orang yang menulis ke Page atau akun Instagram Professional terhubung tidak mengunjungi atlasnow.co dan tidak menerima cookie AtlasNow. Kami menyimpan Page-scoped ID (PSID) atau Instagram-scoped ID (IGSID) dan teks pesan untuk pemilik Page. Kami tidak memakai data itu untuk targeting iklan Meta.",
          `Anda dapat memutus Meta di Pengaturan → Aplikasi chat. Admin Page dapat mencabut aplikasi dari pengaturan Page. Instruksi hapus data: ${LEGAL_SITE}${LEGAL_PATHS.deletion}.`,
        ],
      },
      {
        heading: "Pilihan Anda",
        paragraphs: [
          "Cookie wajib (login) tidak bisa dimatikan jika Anda memakai produk. Blokir di browser, Anda tidak tetap masuk.",
          "Bahasa: ganti di header, atau hapus atlasnow_locale di browser.",
          "Cookie Google / Meta: kelola di akun Google atau Facebook dan pengaturan browser, atau jangan klik Hubungkan / Lanjut dengan Google atau Facebook. Memblokir cookie pihak ketiga dapat merusak OAuth.",
          "GA4 dan pengukuran Google Ads memakai Consent Mode v2. Abaikan banner: ads/analytics storage tetap denied. Setelah OK, granted. Untuk berhenti nanti: hapus data situs atlasnow.co, atau pakai pemblokir pelacak. Kami tidak menambah Meta Pixel tanpa memperbarui halaman ini dulu.",
        ],
      },
      {
        heading: "Kontak",
        paragraphs: [
          `Pertanyaan: ${LEGAL_CONTACT_EMAIL}. Operator: ${LEGAL_OPERATOR}.`,
        ],
      },
    ],
  };
}

export type LegalKind = "privacy" | "terms" | "deletion" | "cookies";

export function getLegalDoc(kind: LegalKind, locale: Locale): LegalDoc {
  if (kind === "privacy") return locale === "id" ? idPrivacy() : enPrivacy();
  if (kind === "terms") return locale === "id" ? idTerms() : enTerms();
  if (kind === "cookies") return locale === "id" ? idCookies() : enCookies();
  return locale === "id" ? idDeletion() : enDeletion();
}

export function legalNav(locale: Locale) {
  if (locale === "id") {
    return [
      { href: LEGAL_PATHS.privacy, label: "Privasi" },
      { href: LEGAL_PATHS.cookies, label: "Cookie" },
      { href: LEGAL_PATHS.terms, label: "Syarat" },
      { href: LEGAL_PATHS.deletion, label: "Hapus data" },
    ];
  }
  return [
    { href: LEGAL_PATHS.privacy, label: "Privacy" },
    { href: LEGAL_PATHS.cookies, label: "Cookies" },
    { href: LEGAL_PATHS.terms, label: "Terms" },
    { href: LEGAL_PATHS.deletion, label: "Data deletion" },
  ];
}

export function companyNav(locale: Locale) {
  if (locale === "id") {
    return [
      { href: "/about", label: "Tentang kami" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Kontak" },
    ];
  }
  return [
    { href: "/about", label: "About us" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];
}
