import { prisma } from "@/lib/db";
import { joinUrl, memberState } from "./members";
import { submitIntake } from "./service";
import { jpegFromInboundPhoto, resolveWaReceiptActor, typedFieldsFromPhoto } from "./wa-receipt";

export async function processHqReceiptImage(opts: {
  tenantId: string;
  senderPhone: string;
  caption: string;
  photo: { bytes: Buffer; mime: string };
}): Promise<{ reply: string }> {
  const stores = await prisma.location.findMany({
    where: { tenantId: opts.tenantId, status: { not: "ARCHIVED" }, kind: { not: "HQ" } },
    select: { id: true, phone: true, waOutletPhone: true },
  });
  const memRow = await prisma.loyaltyMember.findUnique({
    where: { tenantId_phone: { tenantId: opts.tenantId, phone: opts.senderPhone } },
    select: { phone: true, signupLocationId: true },
  });
  const actor = resolveWaReceiptActor({
    senderPhone: opts.senderPhone,
    caption: opts.caption,
    stores,
    member: memRow,
  });

  if (actor.kind === "unknown") {
    const program = await prisma.loyaltyProgram.findUnique({
      where: { tenantId: opts.tenantId },
      select: { joinKey: true },
    });
    const link = program?.joinKey ? joinUrl(program.joinKey) : "Settings → Loyalty";
    return { reply: `Belum member. Daftar dulu: ${link}` };
  }

  if (actor.kind === "staff" && !actor.memberPhone) {
    return { reply: "Kasir: ketik HP pelanggan di caption foto, contoh 0812xxxx lalu nomor struk dan Rp." };
  }

  const jpeg = await jpegFromInboundPhoto(opts.photo.bytes, opts.photo.mime);
  if (!jpeg.ok) return { reply: jpeg.error };

  const fields = await typedFieldsFromPhoto({ caption: opts.caption, jpeg: jpeg.jpeg });
  if (!fields.trxId || fields.amount == null) {
    return { reply: "Foto tidak kebaca. Ketik nomor struk dan Rp di caption, kirim foto lagi." };
  }

  const phone = actor.kind === "staff" ? actor.memberPhone! : actor.phone;
  const locationId = actor.locationId;
  const loc = await prisma.location.findFirst({
    where: { id: locationId, tenantId: opts.tenantId },
    select: { phone: true, waOutletPhone: true },
  });
  const staff = [loc?.phone, loc?.waOutletPhone].filter(Boolean) as string[];
  const r = await submitIntake({
    tenantId: opts.tenantId,
    locationId,
    phone,
    trxId: fields.trxId,
    amount: fields.amount,
    source: actor.kind === "staff" ? "WA_HQ_STAFF" : "GUEST_WA",
    staffPhones: staff,
    photo: { bytes: jpeg.jpeg, mime: "image/jpeg" },
    ocrText: fields.ocrText,
  });
  if (!r.ok) return { reply: r.error };
  if (r.autoApproved) return { reply: "Stamp tercatat. Struk cocok." };
  if (r.warn) return { reply: String(r.warn) };
  if (r.matchStatus === "MATCH") return { reply: "Foto cocok. Kantor sedang cek (mode audit). Belum stamp." };
  if (r.matchStatus === "MISMATCH") return { reply: "Foto dan angka beda. Masuk antrian kantor. Belum stamp." };
  return { reply: "Foto tidak kebaca. Struk di antrian kantor. Belum stamp." };
}
