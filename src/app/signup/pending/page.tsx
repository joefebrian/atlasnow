import type { Metadata } from "next";
import Link from "next/link";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";
import { getLocale } from "@/lib/i18n/get-locale";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";
import { ChatHqPing } from "@/components/legal/ChatHqPing";
import { SignupLeadPing } from "@/components/legal/SignupLeadPing";
import { atlasHqClickToWaHref } from "@/lib/signup/hq-whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "We’ll follow up",
  description:
    "Your AtlasNow sign-up is in. Login stays off until we follow up. Chat AtlasNow on WhatsApp so we can reply.",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ brand?: string }> };

export default async function SignupPendingPage({ searchParams }: Props) {
  const locale = await getLocale();
  const id = locale === "id";
  const { brand } = await searchParams;
  const waHref = atlasHqClickToWaHref({
    brand,
    locale: id ? "id" : "en",
  });

  return (
    <PublicSiteShell>
      <SignupLeadPing />
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2a9bb8]">
        {id ? "Pendaftaran diterima" : "Sign-up received"}
      </p>
      <h1 className="mt-3 max-w-xl text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
        {id ? "Belum bisa masuk. Chat kami dulu." : "Login is not on yet. Chat us first."}
      </h1>
      <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--ink)]/55">
        {id
          ? "Akun sudah tercatat. Workspace belum dinyalakan. Tombol di bawah buka WhatsApp HQ AtlasNow dengan teks siap kirim — harus tekan Send, bukan cuma buka chat. Kalau pesan itu masuk, jendela 24 jam terbuka: kami bisa Activate dengan balasan biasa, tanpa template. Email tetap dikirim."
          : "We have your account. The workspace is not on yet. The button opens WhatsApp to AtlasNow HQ with a draft — you must tap Send, not just open the chat. That message opens a 24-hour window so we can Activate with a normal reply, no template. Email still goes out."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ChatHqPing href={waHref} label="Chat HQ AtlasNow" />
        <Link
          href="/login"
          className="an-btn rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm text-[var(--ink)] hover:bg-[#eef8ff]"
        >
          {id ? "Halaman masuk" : "Sign-in page"}
        </Link>
      </div>
      <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-[var(--ink)]/45">
        {id
          ? `Atau tulis ke ${LEGAL_CONTACT_EMAIL} dengan email yang sama saat daftar.`
          : `Or write to ${LEGAL_CONTACT_EMAIL} with the same email you signed up with.`}
      </p>
    </PublicSiteShell>
  );
}
