import { NextResponse } from "next/server";
import { guardCommerce } from "@/lib/commerce/guard";
import { compressProductImage, readProductImageFile } from "@/lib/commerce/image";
import { clearProductImage, readProductImage, saveProductImage } from "@/lib/commerce/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: false, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const image = await readProductImage(guard.tenantId, id);
  if (!image) return NextResponse.json({ error: "No image" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=30",
    },
  });
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const tenantField = form?.get("tenantId");
  const guard = await guardCommerce({
    write: true,
    tenantId: typeof tenantField === "string" ? tenantField : null,
  });
  if (!guard.ok) return guard.response;
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  const read = await readProductImageFile(file);
  if ("error" in read) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP under 4 MB" }, { status: 400 });
  let image: { buf: Buffer; mime: "image/webp" };
  try {
    image = await compressProductImage(read.buf);
  } catch {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP under 4 MB" }, { status: 400 });
  }
  const saved = await saveProductImage(guard.tenantId, id, image);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const guard = await guardCommerce({ write: true, tenantId: url.searchParams.get("tenantId") });
  if (!guard.ok) return guard.response;
  const cleared = await clearProductImage(guard.tenantId, id);
  if (!cleared.ok) return NextResponse.json({ error: cleared.error }, { status: cleared.status });
  return NextResponse.json({ ok: true });
}
