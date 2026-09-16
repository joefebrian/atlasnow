// AtlasNow — pelatihan kerja (partnership + merchant)
// node docs/atlasnow-pelatihan.js
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");

const C = {
  warm: "FAF8FC",
  white: "FFFFFF",
  ink: "1F1B1D",
  text: "3A3438",
  mute: "6B6568",
  cyan: "6FD6F6",
  aqua: "7EE5D6",
  mint: "C5F0C1",
  sky: "B7E1FF",
  line: "ECE8EE",
  rose: "BE123C",
  emerald: "047857",
  amber: "B45309",
};

const FONT = "Calibri";
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "AtlasNow — pelatihan kerja";
pres.author = "P2P Labs";
pres.subject = "Tutorial untuk employee partnership dan partner merchant";

const W = 13.333;
const H = 7.5;
const PAGES = 15;

function header(slide, section, dark) {
  slide.addText("ATLASNOW", {
    x: 0.55, y: 0.28, w: 3.2, h: 0.32,
    fontFace: FONT, fontSize: 12, bold: true,
    color: dark ? C.aqua : "2A9BB8", charSpacing: 3, margin: 0,
  });
  slide.addText(section, {
    x: W - 7.2, y: 0.28, w: 6.65, h: 0.32,
    fontFace: FONT, fontSize: 11,
    color: dark ? "A8A4A6" : C.mute, charSpacing: 1.2, align: "right", margin: 0,
  });
}
function footer(slide, n, dark) {
  slide.addText("P2P Labs  ·  atlasnow.co  ·  hello@atlasnow.co", {
    x: 0.55, y: H - 0.48, w: 8.8, h: 0.28,
    fontFace: FONT, fontSize: 11, color: dark ? "8A8588" : "94A3B8", margin: 0,
  });
  slide.addText(`${String(n).padStart(2, "0")}  /  ${String(PAGES).padStart(2, "0")}`, {
    x: W - 2.4, y: H - 0.48, w: 1.85, h: 0.28,
    fontFace: FONT, fontSize: 11, color: dark ? "8A8588" : "94A3B8", align: "right", margin: 0,
  });
}
function card(slide, x, y, w, h) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: C.white },
    line: { color: C.line, width: 1 },
    rectRadius: 0.12,
  });
}

// 01 cover
{
  const s = pres.addSlide();
  s.background = { color: C.ink };
  header(s, "PELATIHAN KERJA", true);
  s.addText("Cara kerja di toko.\nBukan pitch. Ini job sheet.", {
    x: 0.55, y: 1.8, w: 12.2, h: 2.2,
    fontFace: FONT, fontSize: 36, bold: true, color: C.white, margin: 0,
  });
  s.addText(
    "Untuk staf partnership (agency) dan staf merchant (admin merek + kasir).\nSatu alur: daftar dulu, struk sah, baru stamp, baru hadiah.",
    { x: 0.55, y: 4.2, w: 11, h: 0.9, fontFace: FONT, fontSize: 16, color: "CBD5E1", margin: 0 }
  );
  s.addText("20–25 menit  ·  atlasnow.co", {
    x: 0.55, y: 5.4, w: 8, h: 0.35, fontFace: FONT, fontSize: 13, color: C.aqua, margin: 0,
  });
  footer(s, 1, true);
}

// 02 who
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "UNTUK SIAPA");
  s.addText("Dua ruangan, satu sistem.", {
    x: 0.55, y: 0.85, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const cols = [
    ["Partnership / agency", "Employee partnership", ["Tambah merek, nyalakan login toko", "Cabang dari Google Maps", "Sambungkan Google + nomor WA HQ", "Cetak QR, isi hadiah, latih kasir"]],
    ["Partner merchant", "Admin merek + kasir", ["Admin: Approve, Redeem, Reports", "Kasir: scan QR, ketik HP, serahkan hadiah", "Jangan tunggu app di HP pelanggan", "Kartu stamp v1 = chat HQ atau ketik HP"]],
  ];
  cols.forEach((c, i) => {
    const x = 0.55 + i * 6.35;
    card(s, x, 1.7, 6.1, 4.7);
    s.addText(c[0], { x: x + 0.35, y: 1.9, w: 5.4, h: 0.3, fontFace: FONT, fontSize: 12, color: "2A9BB8", margin: 0 });
    s.addText(c[1], { x: x + 0.35, y: 2.25, w: 5.4, h: 0.45, fontFace: FONT, fontSize: 20, bold: true, color: C.ink, margin: 0 });
    s.addText(c[2].map((t) => "•  " + t).join("\n"), {
      x: x + 0.35, y: 2.9, w: 5.4, h: 3.1, fontFace: FONT, fontSize: 15, color: C.text, margin: 0,
    });
  });
  footer(s, 2);
}

// 03 chairs
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "TIGA KURSI");
  s.addText("Siapa klik tombol apa.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const chairs = [
    ["Partnership", "Brands · Outlets · Chat apps · Settings → Loyalty", "Setup sekali. Kalau toko bingung, ini orang yang dipanggil dulu."],
    ["Admin merek", "Loyalty · Customers · Reports", "Antrian Approve. Cek member. Redeem yang kasir tidak yakin. Baca bulan ini."],
    ["Kasir", "Loyalty → Submit struk · Cek member", "15 detik. HP + no. transaksi. Hadiah hanya setelah Redeem."],
  ];
  chairs.forEach((c, i) => {
    const x = 0.55 + i * 4.2;
    card(s, x, 1.7, 4.0, 4.5);
    s.addText(c[0], { x: x + 0.28, y: 1.95, w: 3.45, h: 0.35, fontFace: FONT, fontSize: 12, color: "2A9BB8", margin: 0 });
    s.addText(c[1], { x: x + 0.28, y: 2.45, w: 3.45, h: 1.2, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0 });
    s.addText(c[2], { x: x + 0.28, y: 3.85, w: 3.45, h: 1.9, fontFace: FONT, fontSize: 14, color: C.text, margin: 0 });
  });
  footer(s, 3);
}

// 04 live vs later
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "YANG BOLEH DIAJARKAN");
  s.addText("Ajarkan yang live. Jangan jual yang belum.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });
  card(s, 0.55, 1.65, 6.1, 4.85);
  s.addText("Live — latih ini", { x: 0.85, y: 1.85, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.emerald, margin: 0 });
  s.addText(
    ["Outlets dari Maps, ulasan Google", "QR daftar (HP, nama, DOB, email)", "Calon → aktif setelah struk sah", "Stamp, top spender, ultah di kasir", "Reports loyalty bulan ini", "Inbox HQ jika Cloud API nyambung"]
      .map((t) => "•  " + t)
      .join("\n"),
    { x: 0.85, y: 2.4, w: 5.5, h: 3.7, fontFace: FONT, fontSize: 15, color: C.text, margin: 0 }
  );
  card(s, 6.9, 1.65, 6.1, 4.85);
  s.addText("Belum — jangan janji", { x: 7.2, y: 1.85, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.amber, margin: 0 });
  s.addText(
    ["QR stamp di HP (kasir scan kartu)", "POS Moka / Majoo auto-stamp", "Ucapan ultah WA H-2 (centang tersimpan)", "Post, iklan, laporan ops mingguan", "Bot auto-reply", "Aplikasi HP merek (jauh)"]
      .map((t) => "•  " + t)
      .join("\n"),
    { x: 7.2, y: 2.4, w: 5.5, h: 3.7, fontFace: FONT, fontSize: 15, color: C.text, margin: 0 }
  );
  footer(s, 4);
}

// 05 flow
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "ALUR YANG DIKUNCI");
  s.addText("Lima langkah. Jangan loncat.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const steps = [
    ["1", "Scan QR", "Isi HP, nama, DOB, email. Masih calon."],
    ["2", "Bayar", "Struk pakai nomor member yang valid."],
    ["3", "Submit", "Kasir ketik HP + no. trx di Loyalty."],
    ["4", "Approve", "Admin merek. Baru ini stamp."],
    ["5", "Redeem", "Kasir tekan Redeem. Chat bukan bukti."],
  ];
  steps.forEach((st, i) => {
    const x = 0.45 + i * 2.55;
    card(s, x, 1.7, 2.42, 3.7);
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.2, y: 1.95, w: 0.45, h: 0.45, fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText(st[0], {
      x: x + 0.2, y: 1.95, w: 0.45, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
    s.addText(st[1], { x: x + 0.18, y: 2.6, w: 2.05, h: 0.55, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0 });
    s.addText(st[2], { x: x + 0.18, y: 3.25, w: 2.05, h: 1.8, fontFace: FONT, fontSize: 13, color: C.text, margin: 0 });
  });
  s.addText("Scan poster bukan stamp. Calon bukan member aktif. Visit tidak kita hitung — yang dihitung struk sah.", {
    x: 0.55, y: 5.65, w: 12.2, h: 0.5, fontFace: FONT, fontSize: 14, color: C.mute, margin: 0,
  });
  footer(s, 5);
}

// 06 partnership setup
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "PARTNERSHIP · SETUP");
  s.addText("Kerja partnership sebelum toko buka.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });
  const jobs = [
    ["1  Brands", "Buat merek. Login toko off sampai follow-up selesai, lalu nyalakan."],
    ["2  Outlets", "Tiap cabang dari Maps. Nama = papan toko. Pin benar."],
    ["3  Google", "Settings → Google. Cocokkan listing ke cabang."],
    ["4  Chat apps", "Nomor WA resmi HQ (Cloud API). WA cabang hanya ditonton."],
    ["5  Loyalty", "QR JOIN, min belanja, hadiah stamp, juara spender, ultah."],
    ["6  Latih kasir", "15 menit + lembar saku. Jangan lepas toko tanpa skrip."],
  ];
  jobs.forEach((j, i) => {
    const y = 1.55 + i * 0.8;
    card(s, 0.55, y, 12.2, 0.72);
    s.addText(j[0], { x: 0.75, y: y + 0.08, w: 2.6, h: 0.55, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, valign: "middle", margin: 0 });
    s.addText(j[1], { x: 3.4, y: y + 0.08, w: 9.1, h: 0.55, fontFace: FONT, fontSize: 14, color: C.text, valign: "middle", margin: 0 });
  });
  footer(s, 6);
}

// 07 QR
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "QR DAFTAR");
  s.addText("Poster QR = daftar. Bukan cap stamp.", {
    x: 0.55, y: 0.85, w: 12, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });
  s.addText(
    "Settings → Loyalty. Satu QR merek atau satu per cabang. Cetak di kasir, meja, atau pintu.\nWajib HP + nama. Setelah submit = calon. Aktif hanya setelah struk Approve tembus min merek. HP = nomor member.",
    { x: 0.55, y: 1.55, w: 12.2, h: 1.15, fontFace: FONT, fontSize: 16, color: C.text, margin: 0 }
  );
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.55, y: 2.95, w: 7.4, h: 2.9, fill: { color: C.ink }, line: { type: "none" }, rectRadius: 0.12,
  });
  s.addText("UCAPAN KASIR", {
    x: 0.85, y: 3.2, w: 6.8, h: 0.3, fontFace: FONT, fontSize: 11, color: C.aqua, margin: 0,
  });
  s.addText("“Scan QR ini ya, isi nama dan HP. Baru belanja, stamp-nya nyangkut.”", {
    x: 0.85, y: 3.6, w: 6.8, h: 1.8, fontFace: FONT, fontSize: 22, bold: true, color: C.white, margin: 0,
  });
  card(s, 8.15, 2.95, 4.6, 2.9);
  s.addText("SALAH", { x: 8.45, y: 3.2, w: 4.1, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.rose, margin: 0 });
  s.addText("“Scan di meja, langsung dapat stamp.” Siapa pun bisa farm stamp. Jangan.", {
    x: 8.45, y: 3.65, w: 4.1, h: 1.8, fontFace: FONT, fontSize: 16, color: C.text, margin: 0,
  });
  footer(s, 7);
}

// 08 settings
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "SETTINGS → LOYALTY");
  s.addText("Hadiah ditulis merek. Bukan donat default.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });
  const boxes = [
    ["Kartu stamp", "Contoh: 5 → es kopi, 10 → tumbler. 1 struk sah = 1 stamp. Kartu baru hanya setelah hadiah tertinggi di-Redeem."],
    ["Min belanja", "Rp 0 = kopi kecil pun dapat stamp. Min yang sama yang mengaktifkan membership."],
    ["Top spender", "Juara 1 / 2 / 3 tiap bulan. Hadiah juara 1 hanya untuk juara 1."],
    ["Ultah", "Hadiah di kasir, sekali setahun, setelah aktif. WA H-2 hanya jika mereka centang izin."],
  ];
  boxes.forEach((b, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 1.65 + Math.floor(i / 2) * 2.35;
    card(s, x, y, 6.1, 2.15);
    s.addText(b[0], { x: x + 0.35, y: y + 0.25, w: 5.4, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0 });
    s.addText(b[1], { x: x + 0.35, y: y + 0.75, w: 5.4, h: 1.15, fontFace: FONT, fontSize: 14, color: C.text, margin: 0 });
  });
  footer(s, 8);
}

// 09 kasir script
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "KASIR · 15 DETIK");
  s.addText("Skrip kasir. Hafalkan ini.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const script = [
    "Belum member? “Scan QR, isi HP dan nama.” Jangan proses stamp dulu.",
    "Sudah bayar. Loyalty → Submit struk. Ketik HP, no. transaksi, nominal (buat top spender).",
    "Kirim. Admin merek yang Approve. Kalau kamu admin juga, Approve sekarang.",
    "Mau tukar? Cek member → ketik HP. Atau pelanggan tunjuk chat HQ “Status Stamp”.",
    "Hadiah hanya setelah tombol Redeem. Chat bukan bukti. Struk kertas bukan bukti tukar.",
  ];
  script.forEach((t, i) => {
    const y = 1.55 + i * 0.9;
    card(s, 0.55, y, 12.2, 0.8);
    s.addShape(pres.shapes.OVAL, {
      x: 0.75, y: y + 0.18, w: 0.44, h: 0.44, fill: { color: C.ink }, line: { type: "none" },
    });
    s.addText(String(i + 1), {
      x: 0.75, y: y + 0.18, w: 0.44, h: 0.44, fontFace: FONT, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle", margin: 0,
    });
    s.addText(t, { x: 1.4, y: y + 0.12, w: 11.1, h: 0.56, fontFace: FONT, fontSize: 15, color: C.text, valign: "middle", margin: 0 });
  });
  footer(s, 9);
}

// 10 approve + card v1
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "APPROVE + KARTU V1");
  s.addText("Stamp hidup di Approve. Kartu ditunjuk dua cara.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55, fontFace: FONT, fontSize: 24, bold: true, color: C.ink, margin: 0,
  });
  card(s, 0.55, 1.6, 6.1, 4.9);
  s.addText("Admin merek", { x: 0.85, y: 1.8, w: 5.5, h: 0.35, fontFace: FONT, fontSize: 12, color: "2A9BB8", margin: 0 });
  s.addText("Antrian Loyalty", { x: 0.85, y: 2.2, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0 });
  s.addText(
    ["HP belum daftar → tolak, minta scan QR", "Trx sama dua kali → sistem menolak", "Di bawah min merek → tidak stamp", "Kartu penuh → Redeem dulu", "Customers: calon vs aktif. Export bukan blast."]
      .map((t) => "•  " + t)
      .join("\n"),
    { x: 0.85, y: 2.8, w: 5.5, h: 3.3, fontFace: FONT, fontSize: 14, color: C.text, margin: 0 }
  );
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 6.9, y: 1.6, w: 6.1, h: 2.3, fill: { color: C.ink }, line: { type: "none" }, rectRadius: 0.12,
  });
  s.addText("JALUR 1 · PELANGGAN", { x: 7.2, y: 1.8, w: 5.5, h: 0.28, fontFace: FONT, fontSize: 11, color: C.aqua, margin: 0 });
  s.addText("Chat nomor HQ: Status Stamp / Cek Stamp. Tunjukkan chat ke kasir. Customer-initiated = jendela 24 jam, bukan template marketing.", {
    x: 7.2, y: 2.2, w: 5.5, h: 1.4, fontFace: FONT, fontSize: 14, color: C.white, margin: 0,
  });
  card(s, 6.9, 4.1, 6.1, 2.4);
  s.addText("JALUR 2 · KASIR", { x: 7.2, y: 4.3, w: 5.5, h: 0.28, fontFace: FONT, fontSize: 11, color: "2A9BB8", margin: 0 });
  s.addText("Loyalty → Cek member, ketik HP. Jalan tanpa Cloud API. QR di HP belakangan.", {
    x: 7.2, y: 4.7, w: 5.5, h: 1.4, fontFace: FONT, fontSize: 14, color: C.text, margin: 0,
  });
  footer(s, 10);
}

// 11 redeem
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "REDEEM");
  s.addText("Hadiah cair di kasir, sekali.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const r = [
    ["Stamp", "Tukar yang kecil dulu kalau dua hadiah sudah sampai. Kartu kosong hanya setelah hadiah tertinggi."],
    ["Top spender", "Akhir bulan, juara 1/2/3. Redeem hadiah peringkat itu. Bulan depan hitung baru."],
    ["Ultah", "Jendela H-2 sampai H+7. Sekali setahun. Membership harus aktif."],
  ];
  r.forEach((row, i) => {
    const x = 0.55 + i * 4.2;
    card(s, x, 1.7, 4.0, 3.5);
    s.addText(row[0], { x: x + 0.3, y: 1.95, w: 3.4, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0 });
    s.addText(row[1], { x: x + 0.3, y: 2.6, w: 3.4, h: 2.2, fontFace: FONT, fontSize: 15, color: C.text, margin: 0 });
  });
  s.addText("Tidak ada void. Struk keluar = sah. Salah cap? Jangan tarik stamp. Cegah di Approve.", {
    x: 0.55, y: 5.5, w: 12.2, h: 0.5, fontFace: FONT, fontSize: 14, color: C.mute, margin: 0,
  });
  footer(s, 11);
}

// 12 donts
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "JANGAN");
  s.addText("Enam larangan. Ini yang bikin program rusak.", {
    x: 0.55, y: 0.85, w: 12.2, h: 0.55, fontFace: FONT, fontSize: 24, bold: true, color: C.ink, margin: 0,
  });
  const donts = [
    ["Jangan hitung scan sebagai datang", "Calon ≠ kunjungan. Reports bukan “visits”."],
    ["Jangan stamp dari stiker meja", "Stiker = daftar. Stamp hanya struk sah."],
    ["Jangan kasih struk tanpa nomor member", "HP harus terdaftar dulu."],
    ["Jangan Redeem dari chat saja", "Tombol Redeem di Atlas yang mengunci hadiah."],
    ["Jangan blast dari centang ultah", "Centang itu ucapan H-2, bukan promo."],
    ["Jangan kirim dari WA HP kasir", "Balasan resmi hanya nomor HQ Cloud."],
  ];
  donts.forEach((d, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 1.6 + Math.floor(i / 2) * 1.6;
    card(s, x, y, 6.1, 1.45);
    s.addText(d[0], { x: x + 0.3, y: y + 0.22, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.ink, margin: 0 });
    s.addText(d[1], { x: x + 0.3, y: y + 0.7, w: 5.5, h: 0.5, fontFace: FONT, fontSize: 13, color: C.text, margin: 0 });
  });
  footer(s, 12);
}

// 13 pocket card
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "LEMBAR SAKU");
  s.addText("Print ini. Tempel di kasir.", {
    x: 0.55, y: 0.85, w: 12, h: 0.5, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
  const rows = [
    [
      { text: "Situasi", options: { bold: true, color: "6B6568" } },
      { text: "Yang dilakukan", options: { bold: true, color: "6B6568" } },
      { text: "Menu", options: { bold: true, color: "6B6568" } },
    ],
    ["Baru datang, belum member", "Minta scan QR", "QR tercetak"],
    ["Sudah bayar", "Ketik HP + no. trx", "Loyalty → Submit"],
    ["Cek sisa stamp", "Ketik HP, atau minta chat HQ", "Cek member / Status Stamp"],
    ["Mau tukar hadiah", "Cek layar, tekan Redeem, serahkan", "Cek member"],
    ["Struk mencurigakan", "Jangan Approve", "Antrian → Tolak"],
    ["Ultah", "Cek jendela + Redeem birthday", "Cek member"],
  ];
  s.addTable(rows, {
    x: 0.55, y: 1.55, w: 12.2, h: 4.7,
    colW: [3.6, 5.0, 3.6],
    border: [{ pt: 0.5, color: C.line }, { pt: 0.5, color: C.line }, { pt: 0.5, color: C.line }, { pt: 0.5, color: C.line }],
    fontFace: FONT,
    fontSize: 13,
    color: C.text,
    align: "left",
    valign: "middle",
    fill: { color: C.white },
  });
  footer(s, 13);
}

// 14 reports
{
  const s = pres.addSlide();
  s.background = { color: C.warm };
  header(s, "REPORTS");
  s.addText("Bulan ini. AtlasNow, bukan Cirqle.", {
    x: 0.55, y: 0.85, w: 12, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, margin: 0,
  });
  const mets = [
    ["Member kembali", "Punya struk sah bulan ini, dan sudah pernah belanja sebelumnya."],
    ["Stamp bulan ini", "1 struk sah = 1 stamp. Bukan visit counter."],
    ["Hadiah ditebus", "Kasir tekan Redeem. Bukan janji di chat."],
    ["Paling rajin", "Stamp terbanyak bulan ini, atau top spender kalau stamp mati."],
  ];
  mets.forEach((m, i) => {
    const x = 0.55 + (i % 2) * 6.35;
    const y = 1.65 + Math.floor(i / 2) * 2.2;
    card(s, x, y, 6.1, 2.0);
    s.addText(m[0], { x: x + 0.35, y: y + 0.3, w: 5.4, h: 0.4, fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0 });
    s.addText(m[1], { x: x + 0.35, y: y + 0.85, w: 5.4, h: 0.8, fontFace: FONT, fontSize: 14, color: C.text, margin: 0 });
  });
  footer(s, 14);
}

// 15 close
{
  const s = pres.addSlide();
  s.background = { color: C.ink };
  header(s, "SELESAI", true);
  s.addText("Daftar. Struk. Approve.\nBaru stamp. Baru hadiah.", {
    x: 0.55, y: 1.7, w: 12.2, h: 2.0, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0,
  });
  s.addText("Partnership: jangan lepas toko sebelum kasir hafal 15 detik.\nMerchant: ragu? ketik HP, jangan tebak.", {
    x: 0.55, y: 4.0, w: 11, h: 0.9, fontFace: FONT, fontSize: 16, color: "CBD5E1", margin: 0,
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.55, y: 5.15, w: 3.4, h: 0.65, fill: { color: C.white }, line: { type: "none" }, rectRadius: 0.08,
  });
  s.addText("atlasnow.co", {
    x: 0.55, y: 5.15, w: 3.4, h: 0.65, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, align: "center", valign: "middle", margin: 0,
  });
  s.addText("hello@atlasnow.co", {
    x: 4.2, y: 5.25, w: 5, h: 0.45, fontFace: FONT, fontSize: 16, color: C.aqua, valign: "middle", margin: 0,
  });
  footer(s, 15, true);
}

const outDir = path.join(__dirname, "..", "public", "docs");
fs.mkdirSync(outDir, { recursive: true });
const fileName = path.join(outDir, "AtlasNow-pelatihan.pptx");
pres.writeFile({ fileName }).then(() => console.log("wrote", fileName));
