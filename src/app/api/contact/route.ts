import { NextResponse } from "next/server";
import { parseContactRequest } from "@/lib/contact/parse";
import {
  clientIp,
  collectContactMeta,
  hashClientIp,
  recordContactMessage,
  sendContactMail,
  tooManyContactFrom,
} from "@/lib/contact/send";
import { logAppError } from "@/lib/error-log";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseContactRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.spam) {
    return NextResponse.json({ ok: true });
  }

  const ipHash = hashClientIp(clientIp(request));
  if (await tooManyContactFrom(ipHash)) {
    return NextResponse.json({ error: "too_many" }, { status: 429 });
  }

  const meta = collectContactMeta(request, body);
  const mail = await sendContactMail(parsed.value, meta);
  await recordContactMessage({
    req: parsed.value,
    ipHash,
    mailSent: mail.sent,
    mailError: mail.error,
  });

  if (!mail.sent) {
    await logAppError({
      source: "Contact form",
      title: `Contact from ${parsed.value.email}${mail.error ? ` · ${mail.error}` : ""}`,
      detail: `${parsed.value.name}\n${parsed.value.company || "—"}\n\n${parsed.value.message}`,
    });
  }

  return NextResponse.json({ ok: true, mailed: mail.sent });
}
