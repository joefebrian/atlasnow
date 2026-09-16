import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/locale";

const bodySchema = z.object({
  locale: z.string(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || !isLocale(parsed.data.locale)) {
    return NextResponse.json(
      { error: "locale must be en or id" },
      { status: 400 }
    );
  }

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, parsed.data.locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  return NextResponse.json({ locale: parsed.data.locale });
}

export async function GET() {
  const jar = await cookies();
  const locale = jar.get(LOCALE_COOKIE)?.value;
  return NextResponse.json({
    locale: isLocale(locale) ? locale : "en",
  });
}
