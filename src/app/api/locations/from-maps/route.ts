import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { draftFromMapsUrl } from "@/lib/locations/maps-url";

const bodySchema = z.object({
  url: z.string().min(8).max(8000),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid Maps URL" }, { status: 400 });
  }

  try {
    const draft = await draftFromMapsUrl(parsed.data.url);
    return NextResponse.json({ draft });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse Maps URL" },
      { status: 422 }
    );
  }
}
