import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, writeAudit } from "@/lib/auth";
import { sendSmtpTestMail } from "@/lib/contact/send";
import { isSelfSend, isValidEmail } from "@/lib/contact/smtp";
import { resolveIntegrationValues } from "@/lib/integrations/service";
import { isAgencyStaff } from "@/lib/roles";

const bodySchema = z.object({
  to: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAgencyStaff(session.role)) {
    return NextResponse.json({ error: "Agency staff only" }, { status: 403 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const to = (parsed.data.to || session.email || "").trim().toLowerCase();
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }

  const mail = await sendSmtpTestMail(to);
  const smtp = await resolveIntegrationValues("smtp");
  const smtpUser = (smtp.public.user || "").trim();
  const selfSend = isSelfSend(smtpUser || smtp.public.from || "", to);

  if (mail.sent) {
    await writeAudit({
      tenantId: session.tenantId,
      actorId: session.userId,
      action: "SMTP_TEST",
      objectType: "integration",
      objectId: "smtp",
      meta: { to, selfSend, messageId: mail.messageId || null },
    });
  }

  return NextResponse.json({
    ok: mail.sent,
    mailed: mail.sent,
    to,
    selfSend,
    error: mail.error,
    messageId: mail.messageId || null,
  });
}
