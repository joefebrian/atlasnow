// AtlasNow — ringkasan layanan untuk brand / merchant
// Run from this folder: node atlasnow-layanan-merchant.js
const pptxgen = require("pptxgenjs");

const C = {
  cream: "F7F8FC",
  white: "FFFFFF",
  ink: "0F172A",
  text: "334155",
  mute: "64748B",
  soft: "94A3B8",
  indigo: "4F46E5",
  indigoDk: "3730A3",
  navy: "1E1B4B",
  pale: "EEF2FF",
  line: "E2E8F0",
  emerald: "047857",
  amber: "B45309",
  rose: "BE123C",
};

const FONT = "Calibri";
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "AtlasNow — layanan untuk brand multi-cabang";
pres.author = "P2P Labs";
pres.subject = "Ringkasan fitur AtlasNow dalam bahasa merchant";

const W = 13.333;
const H = 7.5;
const PAGES = 12;

function addHeader(slide, section, opts = {}) {
  const onDark = !!opts.onDark;
  slide.addText("ATLASNOW", {
    x: 0.55, y: 0.28, w: 3.2, h: 0.32,
    fontFace: FONT, fontSize: 12, bold: true,
    color: onDark ? "C7D2FE" : C.indigo, charSpacing: 3, margin: 0,
  });
  slide.addText(section, {
    x: W - 7.2, y: 0.28, w: 6.65, h: 0.32,
    fontFace: FONT, fontSize: 11,
    color: onDark ? "A5B4FC" : C.mute, charSpacing: 1.5, align: "right", margin: 0,
  });
}

function addFooter(slide, n, opts = {}) {
  const onDark = !!opts.onDark;
  const muted = onDark ? "94A3B8" : C.soft;
  slide.addText("P2P Labs  ·  atlasnow.co  ·  hello@atlasnow.co", {
    x: 0.55, y: H - 0.48, w: 8.5, h: 0.28,
    fontFace: FONT, fontSize: 11, color: muted, margin: 0,
  });
  slide.addText(`${String(n).padStart(2, "0")}  /  ${String(PAGES).padStart(2, "0")}`, {
    x: W - 2.4, y: H - 0.48, w: 1.85, h: 0.28,
    fontFace: FONT, fontSize: 11, color: muted, align: "right", margin: 0,
  });
}

function card(slide, x, y, w, h, fill) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: C.line, width: 1 },
    shadow: { type: "outer", color: "0F172A", blur: 10, offset: 3, angle: 135, opacity: 0.06 },
  });
}

function accentBar(slide, x, y, h) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w: 0.08, h,
    fill: { color: C.indigo }, line: { type: "none" },
  });
}

// =============================================================================
// 01 COVER
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  addHeader(s, "LAYANAN UNTUK BRAND  ·  2026", { onDark: true });

  s.addText("Cabang sudah ada di Google Maps.", {
    x: 0.55, y: 1.55, w: 12.2, h: 0.7,
    fontFace: FONT, fontSize: 22, color: "A5B4FC", margin: 0,
  });
  s.addText("Kami bantu yang setelahnya:\nditemukan, di-chat, dibalas.", {
    x: 0.55, y: 2.3, w: 12.2, h: 2.1,
    fontFace: FONT, fontSize: 40, bold: true, color: C.white, margin: 0,
  });
  s.addText(
    "AtlasNow adalah ruang kerja untuk restoran, ritel, dan brand multi-cabang.\nListing, ulasan Google, WhatsApp, dan Facebook Messenger — satu tempat, tiap cabang jelas.",
    {
      x: 0.55, y: 4.7, w: 10.5, h: 0.95,
      fontFace: FONT, fontSize: 16, color: "CBD5E1", margin: 0,
    }
  );
  s.addText("Produk P2P Labs", {
    x: 0.55, y: 5.85, w: 4, h: 0.3,
    fontFace: FONT, fontSize: 13, color: "A5B4FC", margin: 0,
  });
  addFooter(s, 1, { onDark: true });
}

// =============================================================================
// 02 UNTUK SIAPA
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "UNTUK SIAPA");
  s.addText("Cocok kalau orang cari kamu di Maps,\nlalu chat atau kasih ulasan sebelum datang.", {
    x: 0.55, y: 0.85, w: 12.2, h: 1.15,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const who = [
    ["F&B, kafe, bakery, QSR", "Jam buka dan pin sering berubah. Chat “masih buka?” masuk sepanjang hari."],
    ["Ritel & grocery", "Banyak cabang, satu merek. Tiap toko butuh nama, nomor, dan pin yang benar."],
    ["Salon, klinik, gym", "Janji temu lewat chat. Listing yang usang atau balasan lambat = appointment hilang."],
    ["Bengkel, hotel, franchise", "Pertanyaan masuk ke cabang yang tepat — bukan satu inbox campur."],
  ];
  who.forEach((row, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 2.25 + Math.floor(i / 2) * 2.05;
    card(s, x, y, 6.1, 1.85, C.white);
    accentBar(s, x, y, 1.85);
    s.addText(row[0], {
      x: x + 0.35, y: y + 0.28, w: 5.5, h: 0.4,
      fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0,
    });
    s.addText(row[1], {
      x: x + 0.35, y: y + 0.78, w: 5.5, h: 0.8,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 2);
}

// =============================================================================
// 03 MASALAH
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "YANG SERING TERJADI");
  s.addText("Pelanggan sudah cari kamu.\nYang ribet: menindaklanjuti.", {
    x: 0.55, y: 0.85, w: 12.2, h: 1.2,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const probs = [
    ["01", "Cabang yang muncul salah", "Jam buka lama, pin di jalan sebelah, nama tidak sama dengan papan toko. Orang tetap search — cuma masuk ke tempat yang salah."],
    ["02", "Chat tercecer di HP berbeda", "WhatsApp di satu handset. Facebook di tab lain. Pesan nganggur sampai pelanggan sudah ke tempat lain."],
    ["03", "Ulasan nunggu dibalas", "Bintang satu itu pelanggan minta dibantu. Banyak tools cuma pamer bintangnya, tidak bantu membalas."],
  ];
  probs.forEach((p, i) => {
    const x = 0.55 + i * 4.2;
    card(s, x, 2.35, 4.0, 4.15, C.white);
    s.addText(p[0], {
      x: x + 0.3, y: 2.55, w: 3.4, h: 0.45,
      fontFace: FONT, fontSize: 20, bold: true, color: C.indigo, margin: 0,
    });
    s.addText(p[1], {
      x: x + 0.3, y: 3.15, w: 3.4, h: 1.05,
      fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0,
    });
    s.addText(p[2], {
      x: x + 0.3, y: 4.3, w: 3.4, h: 1.85,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 3);
}

// =============================================================================
// 04 YANG KALIAN DAPAT
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "YANG SUDAH BISA DIPAKAI");
  s.addText("Empat layanan yang sudah jalan hari ini.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  s.addText("Bukan janji iklan. Ini yang tim kalian buka di atlasnow.co.", {
    x: 0.55, y: 1.42, w: 12.2, h: 0.35,
    fontFace: FONT, fontSize: 14, color: C.mute, margin: 0,
  });

  const svc = [
    ["Cabang", "Semua outlet satu daftar. Tambah dari link Google Maps. Nama, nomor, alamat, pin."],
    ["Ulasan", "Baca ulasan Google per cabang. Tulis draf balasan. Kirim ke Maps setelah Google tersambung."],
    ["Inbox", "WhatsApp dan Facebook Messenger masuk ke cabang yang benar — bukan tumpukan campur."],
    ["Pelanggan", "Orang yang pernah chat tersimpan. Nomor WhatsApp tidak dicampur dengan ID Facebook."],
  ];
  svc.forEach((row, i) => {
    const y = 1.95 + i * 1.1;
    card(s, 0.55, y, 12.25, 1.0, C.white);
    accentBar(s, 0.55, y, 1.0);
    s.addText(row[0], {
      x: 0.9, y: y + 0.18, w: 2.4, h: 0.64,
      fontFace: FONT, fontSize: 18, bold: true, color: C.ink, valign: "middle", margin: 0,
    });
    s.addText(row[1], {
      x: 3.5, y: y + 0.18, w: 9.0, h: 0.64,
      fontFace: FONT, fontSize: 15, color: C.text, valign: "middle", margin: 0,
    });
  });
  addFooter(s, 4);
}

// =============================================================================
// 05 CABANG
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "CABANG");
  s.addText("Setiap pintu toko punya kartu sendiri.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const items = [
    ["Dari Maps", "Tempel link Google Maps. Nama, alamat, telepon, dan pin terisi — bukan diketik ulang dari nol."],
    ["Siap atau belum", "Kelihatan cabang mana datanya lengkap, mana yang masih bolong (nama, kota, nomor)."],
    ["ID yang tidak berubah", "Tiap cabang punya kode tetap. Tidak tertukar kalau nama toko diganti."],
    ["Banyak merek", "Agency pegang beberapa brand. Tiap brand punya daftar cabangnya sendiri."],
  ];
  items.forEach((row, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 1.65 + Math.floor(i / 2) * 2.35;
    card(s, x, y, 6.1, 2.15, C.white);
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.3, y: y + 0.35, w: 0.28, h: 0.28,
      fill: { color: C.indigo }, line: { type: "none" },
    });
    s.addText(row[0], {
      x: x + 0.75, y: y + 0.28, w: 5.0, h: 0.4,
      fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0,
    });
    s.addText(row[1], {
      x: x + 0.3, y: y + 0.9, w: 5.5, h: 0.95,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 5);
}

// =============================================================================
// 06 ULASAN
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "ULASAN GOOGLE");
  s.addText("Baca. Draf. Kirim — dari satu layar.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const left = [
    ["Yang kalian lihat", "Ulasan per cabang: bintang, teks, kapan, sudah dibalas atau belum."],
    ["Yang tim kerjakan", "Tulis draf di AtlasNow. Agency yang kirim ke Google, supaya tidak asal tayang."],
    ["Jendela waktu", "Ambil ulasan 1 bulan terakhir. Kalau sepi, mundur 2 bulan sebelumnya, dan seterusnya."],
  ];
  left.forEach((row, i) => {
    const y = 1.6 + i * 1.45;
    card(s, 0.55, y, 7.4, 1.3, C.white);
    s.addText(row[0], {
      x: 0.85, y: y + 0.18, w: 6.9, h: 0.35,
      fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0,
    });
    s.addText(row[1], {
      x: 0.85, y: y + 0.58, w: 6.9, h: 0.55,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });

  card(s, 8.2, 1.6, 4.6, 4.35, C.navy);
  s.addText("Jujur soal reply", {
    x: 8.5, y: 1.9, w: 4.05, h: 0.4,
    fontFace: FONT, fontSize: 16, bold: true, color: "C7D2FE", margin: 0,
  });
  s.addText(
    "Balasan yang tampil di Google Maps butuh Google Business Profile tersambung.\n\nTanpa itu, tim tetap bisa baca dan menulis draf di AtlasNow — belum ke Maps.\n\nIni bukan kunjungan toko. Ini sinyal pengalaman pelanggan.",
    {
      x: 8.5, y: 2.5, w: 4.05, h: 3.1,
      fontFace: FONT, fontSize: 14, color: C.white, margin: 0,
    }
  );
  addFooter(s, 6);
}

// =============================================================================
// 07 CHAT
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "INBOX  ·  PELANGGAN");
  s.addText("Satu inbox. Cabang yang benar.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const chats = [
    ["WhatsApp", "Scan QR atau kode pairing di cabang. Chat masuk ke outlet itu, bukan ke HP pribadi kasir."],
    ["Facebook Messenger", "Brand login Page-nya sendiri. Pesan ke halaman Facebook masuk ke Inbox yang sama."],
    ["Daftar pelanggan", "Siapa yang pernah chat tersimpan. Nomor WhatsApp tidak dianggap sama dengan ID Facebook."],
    ["Jendela 24 jam", "Balasan mengikuti aturan platform. Kami tidak janji kirim pesan di luar aturan itu."],
  ];
  chats.forEach((row, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 1.65 + Math.floor(i / 2) * 2.35;
    card(s, x, y, 6.1, 2.15, C.white);
    accentBar(s, x, y, 2.15);
    s.addText(row[0], {
      x: x + 0.35, y: y + 0.3, w: 5.5, h: 0.4,
      fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0,
    });
    s.addText(row[1], {
      x: x + 0.35, y: y + 0.85, w: 5.5, h: 1.0,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 7);
}

// =============================================================================
// 08 KONEKSI
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "CARA NYAMBUNG");
  s.addText("Login milik brand. Bukan pinjaman akun agency.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });

  const cols = [
    ["Google", "Settings → Google", "Sambungkan Google Business Profile, lalu pasangkan listing Maps ke cabang yang benar. Ini pintu untuk ulasan resmi dan update listing."],
    ["Aplikasi chat", "Settings → Chat apps", "WhatsApp (scan QR) dan Facebook / Instagram (login Page). Setelah nyambung, kerjaannya di Inbox — bukan di halaman setting."],
    ["Tim & bahasa", "Settings", "Ganti password, undang user cabang, pilih bahasa Indonesia atau Inggris. Super admin bisa reset login tim."],
  ];
  cols.forEach((c, i) => {
    const x = 0.55 + i * 4.2;
    card(s, x, 1.65, 4.0, 4.55, C.white);
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.65, w: 4.0, h: 0.12, fill: { color: C.indigo }, line: { type: "none" },
    });
    s.addText(c[0], {
      x: x + 0.28, y: 2.0, w: 3.45, h: 0.45,
      fontFace: FONT, fontSize: 20, bold: true, color: C.ink, margin: 0,
    });
    s.addText(c[1], {
      x: x + 0.28, y: 2.5, w: 3.45, h: 0.35,
      fontFace: FONT, fontSize: 13, color: C.indigo, margin: 0,
    });
    s.addText(c[2], {
      x: x + 0.28, y: 3.05, w: 3.45, h: 2.7,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 8);
}

// =============================================================================
// 09 CARA KERJA
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "ALUR");
  s.addText("Empat langkah. Tidak ribet.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });

  const steps = [
    ["01", "Masuk", "Tim buka AtlasNow. Brand diundang kalau sudah siap login sendiri."],
    ["02", "Daftar cabang", "Setiap outlet dari Maps. Satu daftar per merek."],
    ["03", "Sambungkan", "Google, WhatsApp, dan Facebook Page milik brand itu."],
    ["04", "Balas & perbaiki", "Ulasan, chat, dan data listing yang masih salah — dikerjakan dari satu tempat."],
  ];
  steps.forEach((st, i) => {
    const x = 0.55 + i * 3.2;
    s.addText(st[0], {
      x, y: 1.7, w: 3.0, h: 0.55,
      fontFace: FONT, fontSize: 28, bold: true, color: C.indigo, margin: 0,
    });
    s.addText(st[1], {
      x, y: 2.35, w: 3.0, h: 0.45,
      fontFace: FONT, fontSize: 20, bold: true, color: C.ink, margin: 0,
    });
    s.addText(st[2], {
      x, y: 2.95, w: 3.0, h: 1.4,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
    if (i < 3) {
      s.addShape(pres.shapes.RIGHT_ARROW, {
        x: x + 2.55, y: 1.85, w: 0.4, h: 0.28,
        fill: { color: "C7D2FE" }, line: { type: "none" },
      });
    }
  });

  card(s, 0.55, 4.7, 12.25, 1.7, C.pale);
  s.addText("Siapa yang mengerjakan apa", {
    x: 0.85, y: 4.9, w: 11.6, h: 0.35,
    fontFace: FONT, fontSize: 15, bold: true, color: C.ink, margin: 0,
  });
  s.addText(
    "Agency: sambungkan Google, pasangkan listing, kirim balasan ulasan ke Maps.\nBrand / cabang: lihat outlet, baca inbox, tulis draf, jaga data toko tetap benar.",
    {
      x: 0.85, y: 5.35, w: 11.6, h: 0.8,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    }
  );
  addFooter(s, 9);
}

// =============================================================================
// 10 LIVE VS NANTI
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "SUDAH JALAN  ·  COMING LATER");
  s.addText("Kami tidak jual fitur yang belum ada.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.5,
    fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });

  card(s, 0.55, 1.55, 6.1, 4.85, C.white);
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 1.55, w: 6.1, h: 0.12, fill: { color: C.emerald }, line: { type: "none" },
  });
  s.addText("Sudah bisa dipakai", {
    x: 0.85, y: 1.9, w: 5.5, h: 0.4,
    fontFace: FONT, fontSize: 18, bold: true, color: C.emerald, margin: 0,
  });
  s.addText(
    [
      { text: "Daftar cabang dari Google Maps", options: { bullet: true, breakLine: true } },
      { text: "Ulasan Google — baca & draf balasan", options: { bullet: true, breakLine: true } },
      { text: "Inbox WhatsApp (scan QR di cabang)", options: { bullet: true, breakLine: true } },
      { text: "Facebook Messenger (login Page brand)", options: { bullet: true, breakLine: true } },
      { text: "Daftar pelanggan yang pernah chat", options: { bullet: true, breakLine: true } },
      { text: "Password, bahasa, undangan tim", options: { bullet: true } },
    ],
    {
      x: 0.85, y: 2.45, w: 5.5, h: 3.6,
      fontFace: FONT, fontSize: 15, color: C.text, paraSpaceAfter: 8, margin: 0,
    }
  );

  card(s, 6.9, 1.55, 5.9, 4.85, C.white);
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.9, y: 1.55, w: 5.9, h: 0.12, fill: { color: C.amber }, line: { type: "none" },
  });
  s.addText("Ada di menu · coming later", {
    x: 7.2, y: 1.9, w: 5.3, h: 0.4,
    fontFace: FONT, fontSize: 18, bold: true, color: C.amber, margin: 0,
  });
  s.addText(
    [
      { text: "To-do — tugas harian tim", options: { bullet: true, breakLine: true } },
      { text: "Posts — postingan & promo Google", options: { bullet: true, breakLine: true } },
      { text: "Ads — iklan & voucher", options: { bullet: true, breakLine: true } },
      { text: "Reports — ringkasan mingguan", options: { bullet: true, breakLine: true } },
      { text: "Needs a look — antrian risiko", options: { bullet: true } },
    ],
    {
      x: 7.2, y: 2.45, w: 5.3, h: 3.5,
      fontFace: FONT, fontSize: 15, color: C.text, paraSpaceAfter: 8, margin: 0,
    }
  );
  addFooter(s, 10);
}

// =============================================================================
// 11 JUJUR
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.cream };
  addHeader(s, "YANG TIDAK KAMI KLAIM");
  s.addText("Angka yang tidak bisa kami bela, tidak kami tampilkan.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55,
    fontFace: FONT, fontSize: 24, bold: true, color: C.ink, margin: 0,
  });

  const honest = [
    ["Bukan kunjungan toko", "Kalau orang minta arah di Maps, itu niat datang — bukan kaki yang sudah masuk pintu."],
    ["Bukan lead atau omzet", "Kami tidak mengarang jumlah prospek atau penjualan di layar Home."],
    ["Google punya aturannya", "Balasan ulasan yang publik butuh akun Business Profile. Kuota Google bisa menahan sync sementara."],
    ["Chat mengikuti platform", "WhatsApp pakai sesi HP cabang. Messenger hidup setelah aplikasi Meta disetujui. Kami tidak janji di luar itu."],
  ];
  honest.forEach((row, i) => {
    const y = 1.6 + i * 1.15;
    card(s, 0.55, y, 12.25, 1.05, C.white);
    s.addText(row[0], {
      x: 0.9, y: y + 0.16, w: 11.6, h: 0.32,
      fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0,
    });
    s.addText(row[1], {
      x: 0.9, y: y + 0.52, w: 11.6, h: 0.38,
      fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
    });
  });
  addFooter(s, 11);
}

// =============================================================================
// 12 CLOSE
// =============================================================================
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  addHeader(s, "MULAI", { onDark: true });

  s.addText("Peta sudah bekerja.\nPakai itu.", {
    x: 0.55, y: 1.6, w: 12.2, h: 1.8,
    fontFace: FONT, fontSize: 40, bold: true, color: C.white, margin: 0,
  });
  s.addText(
    "Mulai dari agency. Nyalakan login brand ketika tim toko siap.\nCabang, ulasan, WhatsApp, Messenger — satu alamat.",
    {
      x: 0.55, y: 3.6, w: 11, h: 0.9,
      fontFace: FONT, fontSize: 18, color: "CBD5E1", margin: 0,
    }
  );

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.55, y: 4.85, w: 3.6, h: 0.7,
    fill: { color: C.indigo }, line: { type: "none" },
  });
  s.addText("atlasnow.co", {
    x: 0.55, y: 4.85, w: 3.6, h: 0.7,
    fontFace: FONT, fontSize: 18, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
  });
  s.addText("hello@atlasnow.co", {
    x: 4.4, y: 4.95, w: 5, h: 0.5,
    fontFace: FONT, fontSize: 16, color: "A5B4FC", valign: "middle", margin: 0,
  });
  addFooter(s, 12, { onDark: true });
}

pres.writeFile({
  fileName: "/Users/joefebrian/Downloads/Working Desk/Atlas Technology/atlasnow/docs/AtlasNow-layanan-merchant.pptx",
}).then(() => console.log("wrote AtlasNow-layanan-merchant.pptx"));
