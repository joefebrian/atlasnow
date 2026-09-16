export type RemoteLocationInput = {
  externalId: string;
  title: string;
  storeCode?: string | null;
  addressLine?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  postalCode?: string | null;
  regionCode?: string | null;
  phone?: string | null;
  website?: string | null;
  raw?: unknown;
};

/** Fixture shaped like Business Information locations — aligned with demo-brand seed codes. */
export const MOCK_GBP_LOCATIONS: RemoteLocationInput[] = [
  { externalId: "accounts/mock-agency/locations/1001", title: "Menteng Flagship", storeCode: "MNT-01", addressLine: "Jl. HOS Cokroaminoto 12", locality: "Jakarta", administrativeArea: "DKI Jakarta", postalCode: "10310", regionCode: "ID", phone: "+62213921001" },
  { externalId: "accounts/mock-agency/locations/1002", title: "Senopati", storeCode: "SNP-01", addressLine: "Jl. Senopati 45", locality: "Jakarta", administrativeArea: "DKI Jakarta", regionCode: "ID", phone: "+62213921002" },
  { externalId: "accounts/mock-agency/locations/1003", title: "PIK Avenue", storeCode: "PIK-01", addressLine: "PIK Avenue L2", locality: "Jakarta", administrativeArea: "DKI Jakarta", regionCode: "ID", phone: "+62213921003" },
  { externalId: "accounts/mock-agency/locations/1004", title: "Kelapa Gading", storeCode: "KGD-01", addressLine: "Mall of Indonesia GF", locality: "Jakarta", administrativeArea: "DKI Jakarta", regionCode: "ID", phone: "+62213921004" },
  { externalId: "accounts/mock-agency/locations/1005", title: "TB Simatupang", storeCode: "TBS-01", addressLine: "Jl. TB Simatupang 18", locality: "Jakarta", administrativeArea: "DKI Jakarta", regionCode: "ID", phone: "+62213921005" },
  { externalId: "accounts/mock-agency/locations/1006", title: "BSD City", storeCode: "BSD-01", addressLine: "The Breeze BSD", locality: "Tangerang", administrativeArea: "Banten", regionCode: "ID", phone: "+62213921006" },
  { externalId: "accounts/mock-agency/locations/1007", title: "Alam Sutera", storeCode: "ALS-01", addressLine: "Ruko Alam Sutera A12", locality: "Tangerang", administrativeArea: "Banten", regionCode: "ID", phone: "+62213921007" },
  { externalId: "accounts/mock-agency/locations/1008", title: "Gading Serpong", storeCode: "GSP-01", addressLine: "Summarecon Mall GS", locality: "Tangerang", administrativeArea: "Banten", regionCode: "ID", phone: "+62213921008" },
  { externalId: "accounts/mock-agency/locations/1009", title: "Bintaro Jaya", storeCode: "BTR-01", addressLine: "Plaza Bintaro Xchange", locality: "Tangerang", administrativeArea: "Banten", regionCode: "ID", phone: "+62213921009" },
  { externalId: "accounts/mock-agency/locations/1010", title: "Depok Margonda", storeCode: "DPK-01", addressLine: "Jl. Margonda Raya 88", locality: "Depok", administrativeArea: "Jawa Barat", regionCode: "ID", phone: "+62213921010" },
  { externalId: "accounts/mock-agency/locations/1011", title: "Bekasi Grand", storeCode: "BKS-01", addressLine: "Summarecon Mall Bekasi", locality: "Bekasi", administrativeArea: "Jawa Barat", regionCode: "ID", phone: "+62213921011" },
  { externalId: "accounts/mock-agency/locations/1012", title: "Cikarang", storeCode: "CKR-01", addressLine: "AEON Mall Deltamas", locality: "Cikarang", administrativeArea: "Jawa Barat", regionCode: "ID", phone: "+62213921012" },
  { externalId: "accounts/mock-agency/locations/1013", title: "Bandung Dago", storeCode: "BDG-01", addressLine: "Jl. Ir. H. Juanda 90", locality: "Bandung", administrativeArea: "Jawa Barat", regionCode: "ID", phone: "+62213921013" },
  { externalId: "accounts/mock-agency/locations/1014", title: "Bandung Paris Van Java", storeCode: "BDG-02", addressLine: "PVJ L1", locality: "Bandung", administrativeArea: "Jawa Barat", regionCode: "ID", phone: "+62213921014" },
  { externalId: "accounts/mock-agency/locations/1015", title: "Surabaya Tunjungan", storeCode: "SBY-01", addressLine: "Tunjungan Plaza 3", locality: "Surabaya", administrativeArea: "Jawa Timur", regionCode: "ID", phone: "+62213921015" },
  { externalId: "accounts/mock-agency/locations/1016", title: "Surabaya Pakuwon", storeCode: "SBY-02", addressLine: "Pakuwon Mall L2", locality: "Surabaya", administrativeArea: "Jawa Timur", regionCode: "ID", phone: "+62213921016" },
  { externalId: "accounts/mock-agency/locations/1017", title: "Semarang Paragon", storeCode: "SMG-01", addressLine: "Paragon Mall GF", locality: "Semarang", administrativeArea: "Jawa Tengah", regionCode: "ID", phone: "+62213921017" },
  { externalId: "accounts/mock-agency/locations/1018", title: "Yogyakarta Malioboro", storeCode: "YGY-01", addressLine: "Jl. Malioboro 100", locality: "Yogyakarta", administrativeArea: "DI Yogyakarta", regionCode: "ID", phone: "+62213921018" },
  { externalId: "accounts/mock-agency/locations/1019", title: "Medan Sun Plaza", storeCode: "MDN-01", addressLine: "Sun Plaza L1", locality: "Medan", administrativeArea: "Sumatera Utara", regionCode: "ID", phone: "+62213921019" },
  { externalId: "accounts/mock-agency/locations/1020", title: "Bali Seminyak", storeCode: "DPS-01", addressLine: "Jl. Kayu Aya 22", locality: "Badung", administrativeArea: "Bali", regionCode: "ID", phone: "+62213921020" },
  // Unmapped extras for map UI practice
  { externalId: "accounts/mock-agency/locations/1099", title: "New Outlet Draft (unmapped)", storeCode: "NEW-99", addressLine: "Jl. Baru 1", locality: "Jakarta", administrativeArea: "DKI Jakarta", regionCode: "ID", phone: "+62213921999" },
];
