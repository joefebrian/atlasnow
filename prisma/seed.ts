import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FLOW_EN = [
  "One brand, every outlet",
  "HQ WhatsApp lives here, not on a phone",
  "Members join by QR · stamps from a real receipt",
  "Reviews land with the same team",
  "See which outlet needs a person",
];

const FLOW_ID = [
  "Satu merek, semua cabang",
  "WhatsApp HQ di sini, bukan di HP kasir",
  "Member daftar lewat QR · stamp dari struk sah",
  "Ulasan masuk ke tim yang sama",
  "Lihat cabang mana yang butuh orang",
];

const BRANDING = {
  appName: "AtlasNow",
  logoLetter: "A",
  tagline: "One desk for every location.",
  heroHeadline: "Optimize Every Outlet. Capture More Demand.",
  supportingNarrative:
    "AtlasNow is the brand desk: HQ WhatsApp inbox, membership stamps from real receipts, and reviews — every outlet on one login. A person replies, not a bot.",
  productPromise: "One brand. As many outlets as you have.",
  flowStepsJson: JSON.stringify(FLOW_EN),
  taglineId: "Satu meja untuk setiap lokasi.",
  heroHeadlineId: "Optimize Every Outlet. Capture More Demand.",
  supportingNarrativeId:
    "AtlasNow adalah meja merek: inbox WhatsApp HQ, stamp membership dari struk sah, dan ulasan — semua cabang di satu login. Orang yang balas, bukan bot.",
  productPromiseId: "Satu merek. Sebanyak cabang yang Anda punya.",
  flowStepsJsonId: JSON.stringify(FLOW_ID),
  supportEmail: "hello@atlasnow.co",
  primaryColor: "#4f46e5",
};

async function main() {
  const passwordHash = await bcrypt.hash("AtlasNow@2026", 10);

  await prisma.brandingConfig.upsert({
    where: { id: "default" },
    update: BRANDING,
    create: { id: "default", ...BRANDING },
  });

  // Platform operator workspace
  const agency = await prisma.tenant.upsert({
    where: { slug: "p2p-labs" },
    update: {
      name: "P2P Labs",
      type: "AGENCY",
      status: "ACTIVE",
      loginEnabled: true,
      industry: "Technology / Agency",
      contactName: "P2P Ops",
      contactEmail: "admin@p2plabs.local",
      notes: "AtlasNow platform operator. Agency staff manage all clients from here.",
    },
    create: {
      name: "P2P Labs",
      slug: "p2p-labs",
      type: "AGENCY",
      timezone: "Asia/Jakarta",
      status: "ACTIVE",
      loginEnabled: true,
      industry: "Technology / Agency",
      contactName: "P2P Ops",
      contactEmail: "admin@p2plabs.local",
      notes: "AtlasNow platform operator. Agency staff manage all clients from here.",
    },
  });

  // Sample client brand (login not activated by default)
  const client = await prisma.tenant.upsert({
    where: { slug: "demo-brand" },
    update: {
      name: "Demo Brand (Multi-Location)",
      type: "CLIENT",
      status: "ACTIVE",
      industry: "F&B / Gelato",
      contactName: "Demo Brand Owner",
      contactEmail: "owner@demo-brand.local",
      contactPhone: "+62 812 0000 0000",
      website: "https://example.com",
      notes: "Sample multi-location client for Control Tower demos.",
    },
    create: {
      name: "Demo Brand (Multi-Location)",
      slug: "demo-brand",
      type: "CLIENT",
      timezone: "Asia/Jakarta",
      status: "ACTIVE",
      loginEnabled: false,
      industry: "F&B / Gelato",
      contactName: "Demo Brand Owner",
      contactEmail: "owner@demo-brand.local",
      contactPhone: "+62 812 0000 0000",
      website: "https://example.com",
      notes: "Sample multi-location client for Control Tower demos.",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@p2plabs.local" },
    update: { passwordHash, name: "P2P Admin", isActive: true },
    create: {
      email: "admin@p2plabs.local",
      name: "P2P Admin",
      passwordHash,
      isActive: true,
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: "analyst@p2plabs.local" },
    update: { passwordHash, name: "P2P Analyst", isActive: true },
    create: {
      email: "analyst@p2plabs.local",
      name: "P2P Analyst",
      passwordHash,
      isActive: true,
    },
  });

  // Agency memberships (primary home for staff)
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: agency.id } },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      userId: admin.id,
      tenantId: agency.id,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: analyst.id, tenantId: agency.id } },
    update: { role: "ANALYST", status: "ACTIVE" },
    create: {
      userId: analyst.id,
      tenantId: agency.id,
      role: "ANALYST",
      status: "ACTIVE",
    },
  });

  // Staff can also operate on demo client workspace when needed
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: client.id } },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      userId: admin.id,
      tenantId: client.id,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  // Pilot: 20 sample locations for demo-brand (S2 Location Master)
  const sampleStores = [
    { name: "Menteng Flagship", code: "MNT-01", city: "Jakarta", region: "DKI Jakarta", address: "Jl. HOS Cokroaminoto 12", phone: "+62213921001" },
    { name: "Senopati", code: "SNP-01", city: "Jakarta", region: "DKI Jakarta", address: "Jl. Senopati 45", phone: "+62213921002" },
    { name: "PIK Avenue", code: "PIK-01", city: "Jakarta", region: "DKI Jakarta", address: "PIK Avenue L2", phone: "+62213921003" },
    { name: "Kelapa Gading", code: "KGD-01", city: "Jakarta", region: "DKI Jakarta", address: "Mall of Indonesia GF", phone: "+62213921004" },
    { name: "TB Simatupang", code: "TBS-01", city: "Jakarta", region: "DKI Jakarta", address: "Jl. TB Simatupang 18", phone: "+62213921005" },
    { name: "BSD City", code: "BSD-01", city: "Tangerang", region: "Banten", address: "The Breeze BSD", phone: "+62213921006" },
    { name: "Alam Sutera", code: "ALS-01", city: "Tangerang", region: "Banten", address: "Ruko Alam Sutera A12", phone: "+62213921007" },
    { name: "Gading Serpong", code: "GSP-01", city: "Tangerang", region: "Banten", address: "Summarecon Mall GS", phone: "+62213921008" },
    { name: "Bintaro Jaya", code: "BTR-01", city: "Tangerang", region: "Banten", address: "Plaza Bintaro Xchange", phone: "+62213921009" },
    { name: "Depok Margonda", code: "DPK-01", city: "Depok", region: "Jawa Barat", address: "Jl. Margonda Raya 88", phone: "+62213921010" },
    { name: "Bekasi Grand", code: "BKS-01", city: "Bekasi", region: "Jawa Barat", address: "Summarecon Mall Bekasi", phone: "+62213921011" },
    { name: "Cikarang", code: "CKR-01", city: "Cikarang", region: "Jawa Barat", address: "AEON Mall Deltamas", phone: "+62213921012" },
    { name: "Bandung Dago", code: "BDG-01", city: "Bandung", region: "Jawa Barat", address: "Jl. Ir. H. Juanda 90", phone: "+62213921013" },
    { name: "Bandung Paris Van Java", code: "BDG-02", city: "Bandung", region: "Jawa Barat", address: "PVJ L1", phone: "+62213921014" },
    { name: "Surabaya Tunjungan", code: "SBY-01", city: "Surabaya", region: "Jawa Timur", address: "Tunjungan Plaza 3", phone: "+62213921015" },
    { name: "Surabaya Pakuwon", code: "SBY-02", city: "Surabaya", region: "Jawa Timur", address: "Pakuwon Mall L2", phone: "+62213921016" },
    { name: "Semarang Paragon", code: "SMG-01", city: "Semarang", region: "Jawa Tengah", address: "Paragon Mall GF", phone: "+62213921017" },
    { name: "Yogyakarta Malioboro", code: "YGY-01", city: "Yogyakarta", region: "DI Yogyakarta", address: "Jl. Malioboro 100", phone: "+62213921018" },
    { name: "Medan Sun Plaza", code: "MDN-01", city: "Medan", region: "Sumatera Utara", address: "Sun Plaza L1", phone: "+62213921019" },
    { name: "Bali Seminyak", code: "DPS-01", city: "Badung", region: "Bali", address: "Jl. Kayu Aya 22", phone: "+62213921020" },
  ];

  const { generateAtlasLocationId } = await import("../src/lib/locations/ids");
  const { computeReadiness } = await import("../src/lib/locations/readiness");

  let locCount = 0;
  for (const s of sampleStores) {
    const existing = await prisma.location.findFirst({
      where: { tenantId: client.id, code: s.code },
    });
    if (existing) {
      locCount++;
      continue;
    }
    const { readiness, reasons } = computeReadiness({
      status: "ACTIVE",
      name: s.name,
      city: s.city,
      addressLine1: s.address,
      phone: s.phone,
      hasActiveGoogleMapping: false,
    });
    await prisma.location.create({
      data: {
        atlasLocationId: generateAtlasLocationId(),
        tenantId: client.id,
        name: s.name,
        code: s.code,
        addressLine1: s.address,
        city: s.city,
        region: s.region,
        country: "ID",
        phone: s.phone,
        timezone: "Asia/Jakarta",
        status: "ACTIVE",
        readiness,
        readinessJson: JSON.stringify(reasons),
      },
    });
    locCount++;
  }

  // S4: sample MetricObservations for first 3 demo locations (honest demo grain)
  const metricKeys = [
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_DIRECTION_REQUESTS",
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_CONVERSATIONS",
  ];
  const pilotLocs = await prisma.location.findMany({
    where: { tenantId: client.id, status: "ACTIVE" },
    orderBy: { code: "asc" },
    take: 3,
  });
  let metricRows = 0;
  const today = new Date();
  for (const loc of pilotLocs) {
    for (let d = 0; d < 14; d++) {
      const day = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d)
      );
      for (const key of metricKeys) {
        const base =
          key.includes("IMPRESSIONS") ? 80 + (d % 5) * 12 : key.includes("DIRECTION") ? 6 + (d % 4) : 3 + (d % 3);
        const value = base + (loc.code?.charCodeAt(0) || 0) % 7;
        await prisma.metricObservation.upsert({
          where: {
            locationId_metricKey_sourceSystem_observedOn: {
              locationId: loc.id,
              metricKey: key,
              sourceSystem: "GBP_PERFORMANCE",
              observedOn: day,
            },
          },
          update: { valueJson: JSON.stringify({ value }) },
          create: {
            locationId: loc.id,
            metricKey: key,
            sourceSystem: "GBP_PERFORMANCE",
            observedOn: day,
            valueJson: JSON.stringify({ value }),
            timezone: "Asia/Jakarta",
          },
        });
        metricRows++;
      }
    }
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: agency.id,
      actorId: admin.id,
      action: "SEED_S4_METRICS",
      objectType: "tenant",
      objectId: client.id,
      metaJson: JSON.stringify({
        note: "Agency + client + locations + sample metric observations",
        locations: locCount,
        metricRows,
      }),
    },
  });

  console.log("Seed OK");
  console.log("  Agency:  p2p-labs (P2P Labs) — admin home");
  console.log("  Client:  demo-brand");
  console.log("  Locations:", locCount, "(pilot ~20)");
  console.log("  Metrics: ", metricRows, "daily observations (3 stores × 14d)");
  console.log("  Admin:   admin@p2plabs.local / AtlasNow@2026");
  console.log("  Analyst: analyst@p2plabs.local / AtlasNow@2026");
  console.log("  UI: /locations · Location 360 → Visibility · /control-tower");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
