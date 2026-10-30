import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessTenant } from "@/lib/locations/access";
import { ensureInboxMedia } from "@/lib/conversations/cloud-media";
import { ensureMetaInboxFile } from "@/lib/conversations/meta-media";
import { inboxMediaKind } from "@/lib/conversations/inbox-media";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const row = await prisma.waMessage.findUnique({
    where: { id },
    select: {
      id: true,
      mediaImage: true,
      mediaMime: true,
      mediaFilename: true,
      mediaCloudId: true,
      mediaPurgedAt: true,
      conversation: { select: { tenantId: true, provider: true, sessionId: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTenant(session, row.conversation.tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const query = {
    id: row.id,
    mediaImage: row.mediaImage,
    mediaMime: row.mediaMime,
    mediaFilename: row.mediaFilename,
    mediaCloudId: row.mediaCloudId,
    mediaPurgedAt: row.mediaPurgedAt,
    tenantId: row.conversation.tenantId,
  };
  const media =
    (await ensureInboxMedia(query)) ||
    (await ensureMetaInboxFile({
      ...query,
      provider: row.conversation.provider,
      sessionId: row.conversation.sessionId,
    }));
  if (!media) return NextResponse.json({ error: "No file" }, { status: 404 });
  const kind = inboxMediaKind(media.mime);
  const filename = media.filename.replace(/["\r\n]/g, "") || "file";
  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Content-Disposition": `${kind === "image" ? "inline" : "attachment"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
