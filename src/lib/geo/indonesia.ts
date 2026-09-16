/** Indonesia domicile for join QR. Country is implied by phone +62 / 08. */
export type IdProvince = { name: string; cities: string[] };

export const ID_PROVINCES: IdProvince[] = [
  {
    name: "Aceh",
    cities: [
      "Kota Banda Aceh", "Kota Langsa", "Kota Lhokseumawe", "Kota Sabang", "Kota Subulussalam",
      "Kab. Aceh Barat", "Kab. Aceh Barat Daya", "Kab. Aceh Besar", "Kab. Aceh Jaya", "Kab. Aceh Selatan",
      "Kab. Aceh Singkil", "Kab. Aceh Tamiang", "Kab. Aceh Tengah", "Kab. Aceh Tenggara", "Kab. Aceh Timur",
      "Kab. Aceh Utara", "Kab. Bener Meriah", "Kab. Bireuen", "Kab. Gayo Lues", "Kab. Nagan Raya",
      "Kab. Pidie", "Kab. Pidie Jaya", "Kab. Simeulue",
    ],
  },
  {
    name: "Sumatera Utara",
    cities: [
      "Kota Medan", "Kota Binjai", "Kota Gunungsitoli", "Kota Padangsidimpuan", "Kota Pematangsiantar",
      "Kota Sibolga", "Kota Tanjungbalai", "Kota Tebing Tinggi",
      "Kab. Asahan", "Kab. Batu Bara", "Kab. Dairi", "Kab. Deli Serdang", "Kab. Humbang Hasundutan",
      "Kab. Karo", "Kab. Labuhanbatu", "Kab. Labuhanbatu Selatan", "Kab. Labuhanbatu Utara",
      "Kab. Langkat", "Kab. Mandailing Natal", "Kab. Nias", "Kab. Nias Barat", "Kab. Nias Selatan",
      "Kab. Nias Utara", "Kab. Padang Lawas", "Kab. Padang Lawas Utara", "Kab. Pakpak Bharat",
      "Kab. Samosir", "Kab. Serdang Bedagai", "Kab. Simalungun", "Kab. Tapanuli Selatan",
      "Kab. Tapanuli Tengah", "Kab. Tapanuli Utara", "Kab. Toba",
    ],
  },
  {
    name: "Sumatera Barat",
    cities: [
      "Kota Padang", "Kota Bukittinggi", "Kota Padang Panjang", "Kota Pariaman", "Kota Payakumbuh",
      "Kota Sawahlunto", "Kota Solok",
      "Kab. Agam", "Kab. Dharmasraya", "Kab. Kepulauan Mentawai", "Kab. Lima Puluh Kota",
      "Kab. Padang Pariaman", "Kab. Pasaman", "Kab. Pasaman Barat", "Kab. Pesisir Selatan",
      "Kab. Sijunjung", "Kab. Solok", "Kab. Solok Selatan", "Kab. Tanah Datar",
    ],
  },
  {
    name: "Riau",
    cities: [
      "Kota Pekanbaru", "Kota Dumai",
      "Kab. Bengkalis", "Kab. Indragiri Hilir", "Kab. Indragiri Hulu", "Kab. Kampar",
      "Kab. Kepulauan Meranti", "Kab. Kuantan Singingi", "Kab. Pelalawan", "Kab. Rokan Hilir",
      "Kab. Rokan Hulu", "Kab. Siak",
    ],
  },
  {
    name: "Kepulauan Riau",
    cities: [
      "Kota Batam", "Kota Tanjung Pinang",
      "Kab. Bintan", "Kab. Karimun", "Kab. Kepulauan Anambas", "Kab. Lingga", "Kab. Natuna",
    ],
  },
  {
    name: "Jambi",
    cities: [
      "Kota Jambi", "Kota Sungai Penuh",
      "Kab. Batanghari", "Kab. Bungo", "Kab. Kerinci", "Kab. Merangin", "Kab. Muaro Jambi",
      "Kab. Sarolangun", "Kab. Tanjung Jabung Barat", "Kab. Tanjung Jabung Timur", "Kab. Tebo",
    ],
  },
  {
    name: "Sumatera Selatan",
    cities: [
      "Kota Palembang", "Kota Lubuklinggau", "Kota Pagar Alam", "Kota Prabumulih",
      "Kab. Banyuasin", "Kab. Empat Lawang", "Kab. Lahat", "Kab. Muara Enim", "Kab. Musi Banyuasin",
      "Kab. Musi Rawas", "Kab. Musi Rawas Utara", "Kab. Ogan Ilir", "Kab. Ogan Komering Ilir",
      "Kab. Ogan Komering Ulu", "Kab. Ogan Komering Ulu Selatan", "Kab. Ogan Komering Ulu Timur",
      "Kab. Penukal Abab Lematang Ilir",
    ],
  },
  {
    name: "Kepulauan Bangka Belitung",
    cities: [
      "Kota Pangkalpinang",
      "Kab. Bangka", "Kab. Bangka Barat", "Kab. Bangka Selatan", "Kab. Bangka Tengah", "Kab. Belitung", "Kab. Belitung Timur",
    ],
  },
  {
    name: "Bengkulu",
    cities: [
      "Kota Bengkulu",
      "Kab. Bengkulu Selatan", "Kab. Bengkulu Tengah", "Kab. Bengkulu Utara", "Kab. Kaur",
      "Kab. Kepahiang", "Kab. Lebong", "Kab. Mukomuko", "Kab. Rejang Lebong", "Kab. Seluma",
    ],
  },
  {
    name: "Lampung",
    cities: [
      "Kota Bandar Lampung", "Kota Metro",
      "Kab. Lampung Barat", "Kab. Lampung Selatan", "Kab. Lampung Tengah", "Kab. Lampung Timur",
      "Kab. Lampung Utara", "Kab. Mesuji", "Kab. Pesawaran", "Kab. Pesisir Barat", "Kab. Pringsewu",
      "Kab. Tanggamus", "Kab. Tulang Bawang", "Kab. Tulang Bawang Barat", "Kab. Way Kanan",
    ],
  },
  {
    name: "DKI Jakarta",
    cities: [
      "Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur", "Kepulauan Seribu",
    ],
  },
  {
    name: "Banten",
    cities: [
      "Kota Serang", "Kota Cilegon", "Kota Tangerang", "Kota Tangerang Selatan",
      "Kab. Lebak", "Kab. Pandeglang", "Kab. Serang", "Kab. Tangerang",
    ],
  },
  {
    name: "Jawa Barat",
    cities: [
      "Kota Bandung", "Kota Banjar", "Kota Bekasi", "Kota Bogor", "Kota Cimahi", "Kota Cirebon",
      "Kota Depok", "Kota Sukabumi", "Kota Tasikmalaya",
      "Kab. Bandung", "Kab. Bandung Barat", "Kab. Bekasi", "Kab. Bogor", "Kab. Ciamis", "Kab. Cianjur",
      "Kab. Cirebon", "Kab. Garut", "Kab. Indramayu", "Kab. Karawang", "Kab. Kuningan", "Kab. Majalengka",
      "Kab. Pangandaran", "Kab. Purwakarta", "Kab. Subang", "Kab. Sukabumi", "Kab. Sumedang", "Kab. Tasikmalaya",
    ],
  },
  {
    name: "Jawa Tengah",
    cities: [
      "Kota Semarang", "Kota Magelang", "Kota Pekalongan", "Kota Salatiga", "Kota Surakarta", "Kota Tegal",
      "Kab. Banjarnegara", "Kab. Banyumas", "Kab. Batang", "Kab. Blora", "Kab. Boyolali", "Kab. Brebes",
      "Kab. Cilacap", "Kab. Demak", "Kab. Grobogan", "Kab. Jepara", "Kab. Karanganyar", "Kab. Kebumen",
      "Kab. Kendal", "Kab. Klaten", "Kab. Kudus", "Kab. Magelang", "Kab. Pati", "Kab. Pekalongan",
      "Kab. Pemalang", "Kab. Purbalingga", "Kab. Purworejo", "Kab. Rembang", "Kab. Semarang",
      "Kab. Sragen", "Kab. Sukoharjo", "Kab. Tegal", "Kab. Temanggung", "Kab. Wonogiri", "Kab. Wonosobo",
    ],
  },
  {
    name: "DI Yogyakarta",
    cities: ["Kota Yogyakarta", "Kab. Bantul", "Kab. Gunungkidul", "Kab. Kulon Progo", "Kab. Sleman"],
  },
  {
    name: "Jawa Timur",
    cities: [
      "Kota Surabaya", "Kota Batu", "Kota Blitar", "Kota Kediri", "Kota Madiun", "Kota Malang",
      "Kota Mojokerto", "Kota Pasuruan", "Kota Probolinggo",
      "Kab. Bangkalan", "Kab. Banyuwangi", "Kab. Blitar", "Kab. Bojonegoro", "Kab. Bondowoso",
      "Kab. Gresik", "Kab. Jember", "Kab. Jombang", "Kab. Kediri", "Kab. Lamongan", "Kab. Lumajang",
      "Kab. Madiun", "Kab. Magetan", "Kab. Malang", "Kab. Mojokerto", "Kab. Nganjuk", "Kab. Ngawi",
      "Kab. Pacitan", "Kab. Pamekasan", "Kab. Pasuruan", "Kab. Ponorogo", "Kab. Probolinggo",
      "Kab. Sampang", "Kab. Sidoarjo", "Kab. Situbondo", "Kab. Sumenep", "Kab. Trenggalek",
      "Kab. Tuban", "Kab. Tulungagung",
    ],
  },
  {
    name: "Bali",
    cities: [
      "Kota Denpasar",
      "Kab. Badung", "Kab. Bangli", "Kab. Buleleng", "Kab. Gianyar", "Kab. Jembrana", "Kab. Karangasem", "Kab. Klungkung", "Kab. Tabanan",
    ],
  },
  {
    name: "Nusa Tenggara Barat",
    cities: [
      "Kota Mataram", "Kota Bima",
      "Kab. Bima", "Kab. Dompu", "Kab. Lombok Barat", "Kab. Lombok Tengah", "Kab. Lombok Timur",
      "Kab. Lombok Utara", "Kab. Sumbawa", "Kab. Sumbawa Barat",
    ],
  },
  {
    name: "Nusa Tenggara Timur",
    cities: [
      "Kota Kupang",
      "Kab. Alor", "Kab. Belu", "Kab. Ende", "Kab. Flores Timur", "Kab. Kupang", "Kab. Lembata",
      "Kab. Malaka", "Kab. Manggarai", "Kab. Manggarai Barat", "Kab. Manggarai Timur", "Kab. Nagekeo",
      "Kab. Ngada", "Kab. Rote Ndao", "Kab. Sabu Raijua", "Kab. Sikka", "Kab. Sumba Barat",
      "Kab. Sumba Barat Daya", "Kab. Sumba Tengah", "Kab. Sumba Timur", "Kab. Timor Tengah Selatan",
      "Kab. Timor Tengah Utara",
    ],
  },
  {
    name: "Kalimantan Barat",
    cities: [
      "Kota Pontianak", "Kota Singkawang",
      "Kab. Bengkayang", "Kab. Kapuas Hulu", "Kab. Kayong Utara", "Kab. Ketapang", "Kab. Kubu Raya",
      "Kab. Landak", "Kab. Melawi", "Kab. Mempawah", "Kab. Sambas", "Kab. Sanggau", "Kab. Sekadau", "Kab. Sintang",
    ],
  },
  {
    name: "Kalimantan Tengah",
    cities: [
      "Kota Palangka Raya",
      "Kab. Barito Selatan", "Kab. Barito Timur", "Kab. Barito Utara", "Kab. Gunung Mas", "Kab. Kapuas",
      "Kab. Katingan", "Kab. Kotawaringin Barat", "Kab. Kotawaringin Timur", "Kab. Lamandau",
      "Kab. Murung Raya", "Kab. Pulang Pisau", "Kab. Seruyan", "Kab. Sukamara",
    ],
  },
  {
    name: "Kalimantan Selatan",
    cities: [
      "Kota Banjarmasin", "Kota Banjarbaru",
      "Kab. Balangan", "Kab. Banjar", "Kab. Barito Kuala", "Kab. Hulu Sungai Selatan", "Kab. Hulu Sungai Tengah",
      "Kab. Hulu Sungai Utara", "Kab. Kotabaru", "Kab. Tabalong", "Kab. Tanah Bumbu", "Kab. Tanah Laut", "Kab. Tapin",
    ],
  },
  {
    name: "Kalimantan Timur",
    cities: [
      "Kota Samarinda", "Kota Balikpapan", "Kota Bontang",
      "Kab. Berau", "Kab. Kutai Barat", "Kab. Kutai Kartanegara", "Kab. Kutai Timur", "Kab. Mahakam Ulu",
      "Kab. Paser", "Kab. Penajam Paser Utara",
    ],
  },
  {
    name: "Kalimantan Utara",
    cities: [
      "Kota Tarakan",
      "Kab. Bulungan", "Kab. Malinau", "Kab. Nunukan", "Kab. Tana Tidung",
    ],
  },
  {
    name: "Sulawesi Utara",
    cities: [
      "Kota Manado", "Kota Bitung", "Kota Kotamobagu", "Kota Tomohon",
      "Kab. Bolaang Mongondow", "Kab. Bolaang Mongondow Selatan", "Kab. Bolaang Mongondow Timur",
      "Kab. Bolaang Mongondow Utara", "Kab. Kepulauan Sangihe", "Kab. Kepulauan Siau Tagulandang Biaro",
      "Kab. Kepulauan Talaud", "Kab. Minahasa", "Kab. Minahasa Selatan", "Kab. Minahasa Tenggara", "Kab. Minahasa Utara",
    ],
  },
  {
    name: "Gorontalo",
    cities: [
      "Kota Gorontalo",
      "Kab. Boalemo", "Kab. Bone Bolango", "Kab. Gorontalo", "Kab. Gorontalo Utara", "Kab. Pohuwato",
    ],
  },
  {
    name: "Sulawesi Tengah",
    cities: [
      "Kota Palu",
      "Kab. Banggai", "Kab. Banggai Kepulauan", "Kab. Banggai Laut", "Kab. Buol", "Kab. Donggala",
      "Kab. Morowali", "Kab. Morowali Utara", "Kab. Parigi Moutong", "Kab. Poso", "Kab. Sigi",
      "Kab. Tojo Una-Una", "Kab. Toli-Toli",
    ],
  },
  {
    name: "Sulawesi Barat",
    cities: [
      "Kab. Majene", "Kab. Mamasa", "Kab. Mamuju", "Kab. Mamuju Tengah", "Kab. Pasangkayu", "Kab. Polewali Mandar",
    ],
  },
  {
    name: "Sulawesi Selatan",
    cities: [
      "Kota Makassar", "Kota Palopo", "Kota Parepare",
      "Kab. Bantaeng", "Kab. Barru", "Kab. Bone", "Kab. Bulukumba", "Kab. Enrekang", "Kab. Gowa",
      "Kab. Jeneponto", "Kab. Kepulauan Selayar", "Kab. Luwu", "Kab. Luwu Timur", "Kab. Luwu Utara",
      "Kab. Maros", "Kab. Pangkajene dan Kepulauan", "Kab. Pinrang", "Kab. Sidenreng Rappang",
      "Kab. Sinjai", "Kab. Soppeng", "Kab. Takalar", "Kab. Tana Toraja", "Kab. Toraja Utara", "Kab. Wajo",
    ],
  },
  {
    name: "Sulawesi Tenggara",
    cities: [
      "Kota Kendari", "Kota Baubau",
      "Kab. Bombana", "Kab. Buton", "Kab. Buton Selatan", "Kab. Buton Tengah", "Kab. Buton Utara",
      "Kab. Kolaka", "Kab. Kolaka Timur", "Kab. Kolaka Utara", "Kab. Konawe", "Kab. Konawe Kepulauan",
      "Kab. Konawe Selatan", "Kab. Konawe Utara", "Kab. Muna", "Kab. Muna Barat", "Kab. Wakatobi",
    ],
  },
  {
    name: "Maluku",
    cities: [
      "Kota Ambon", "Kota Tual",
      "Kab. Buru", "Kab. Buru Selatan", "Kab. Kepulauan Aru", "Kab. Kepulauan Tanimbar",
      "Kab. Maluku Barat Daya", "Kab. Maluku Tengah", "Kab. Maluku Tenggara", "Kab. Seram Bagian Barat",
      "Kab. Seram Bagian Timur",
    ],
  },
  {
    name: "Maluku Utara",
    cities: [
      "Kota Ternate", "Kota Tidore Kepulauan",
      "Kab. Halmahera Barat", "Kab. Halmahera Tengah", "Kab. Halmahera Timur", "Kab. Halmahera Selatan",
      "Kab. Halmahera Utara", "Kab. Kepulauan Sula", "Kab. Pulau Morotai", "Kab. Pulau Taliabu",
    ],
  },
  {
    name: "Papua",
    cities: [
      "Kota Jayapura",
      "Kab. Biak Numfor", "Kab. Jayapura", "Kab. Keerom", "Kab. Kepulauan Yapen", "Kab. Mamberamo Raya",
      "Kab. Sarmi", "Kab. Supiori", "Kab. Waropen",
    ],
  },
  {
    name: "Papua Barat",
    cities: [
      "Kab. Fakfak", "Kab. Kaimana", "Kab. Manokwari", "Kab. Manokwari Selatan", "Kab. Pegunungan Arfak",
      "Kab. Teluk Bintuni", "Kab. Teluk Wondama",
    ],
  },
  {
    name: "Papua Barat Daya",
    cities: [
      "Kota Sorong",
      "Kab. Maybrat", "Kab. Raja Ampat", "Kab. Sorong", "Kab. Sorong Selatan", "Kab. Tambrauw",
    ],
  },
  {
    name: "Papua Selatan",
    cities: ["Kab. Asmat", "Kab. Boven Digoel", "Kab. Mappi", "Kab. Merauke"],
  },
  {
    name: "Papua Tengah",
    cities: [
      "Kab. Deiyai", "Kab. Dogiyai", "Kab. Intan Jaya", "Kab. Mimika", "Kab. Nabire", "Kab. Paniai",
      "Kab. Puncak", "Kab. Puncak Jaya",
    ],
  },
  {
    name: "Papua Pegunungan",
    cities: [
      "Kab. Jayawijaya", "Kab. Lanny Jaya", "Kab. Mamberamo Tengah", "Kab. Nduga", "Kab. Pegunungan Bintang",
      "Kab. Tolikara", "Kab. Yahukimo", "Kab. Yalimo",
    ],
  },
];

export function phoneLooksIndonesia(raw: string): boolean {
  const d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("62")) return true;
  if (d.startsWith("0") && d.length >= 9) return true;
  return false;
}

export function citiesForProvince(province: string): string[] {
  return ID_PROVINCES.find((p) => p.name === province)?.cities ?? [];
}

export function isValidIdDomicile(province: string, city: string): boolean {
  const p = province.trim();
  const c = city.trim();
  if (!p || !c) return false;
  return citiesForProvince(p).includes(c);
}
