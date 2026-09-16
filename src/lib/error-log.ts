import { prisma } from "@/lib/db";

const MAX_ROWS = 200;

export async function logAppError(input: {
  source: string;
  title: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.appErrorLog.create({
      data: {
        source: input.source.slice(0, 80),
        title: input.title.slice(0, 500),
        detail: input.detail ? input.detail.slice(0, 4000) : null,
      },
    });
    const extra = await prisma.appErrorLog.count();
    if (extra > MAX_ROWS) {
      const old = await prisma.appErrorLog.findMany({
        orderBy: { createdAt: "asc" },
        take: extra - MAX_ROWS,
        select: { id: true },
      });
      if (old.length) {
        await prisma.appErrorLog.deleteMany({
          where: { id: { in: old.map((r) => r.id) } },
        });
      }
    }
  } catch {
    /* never break the request */
  }
}

export function formatErrorLogLine(row: {
  createdAt: Date | string;
  source: string;
  title: string;
  detail: string | null;
}): string {
  const when =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : String(row.createdAt);
  return [
    `[${when}] ${row.source}`,
    row.title,
    row.detail ? row.detail : "",
  ]
    .filter(Boolean)
    .join("\n");
}
