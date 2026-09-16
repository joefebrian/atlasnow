import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { LegalShell } from "@/components/legal/LegalShell";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  getLegalDoc,
  GOOGLE_COOKIE_POLICY,
  LEGAL_PRODUCT,
  META_COOKIE_POLICY,
} from "@/lib/legal/copy";

import { publicMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicMetadata({
  path: "/cookies",
  title: `Cookie Policy — ${LEGAL_PRODUCT}`,
  description:
    "Cookies AtlasNow sets (login, language) plus GA4 and Google Ads measurement on public pages after you accept the notice. No Meta Pixel.",
});

export default async function CookiesPage() {
  const locale = await getLocale();
  const doc = getLegalDoc("cookies", locale);
  const id = locale === "id";

  const rows = id
    ? [
        ["atlasnow_session", "AtlasNow", "Wajib — sesi login", "14 hari"],
        ["atlasnow_locale", "AtlasNow", "Fungsional — bahasa", "1 tahun"],
        ["_ga / _ga_*", "Google Analytics", "Setelah OK — halaman publik saja", "hingga 2 tahun"],
        ["_gcl_au", "Google Ads", "Setelah OK — pengukuran iklan AtlasNow", "90 hari"],
        ["Cookie Google (google.com)", "Google", "Saat Connect Google / OAuth", "Milik Google"],
        ["Cookie Meta (facebook.com)", "Meta", "Saat Facebook Login for Business", "Milik Meta"],
      ]
    : [
        ["atlasnow_session", "AtlasNow", "Strictly necessary — sign-in", "14 days"],
        ["atlasnow_locale", "AtlasNow", "Functional — language", "1 year"],
        ["_ga / _ga_*", "Google Analytics", "After OK — public pages only", "up to 2 years"],
        ["_gcl_au", "Google Ads", "After OK — AtlasNow ads measurement", "90 days"],
        ["Google cookies (google.com)", "Google", "When you Connect Google / OAuth", "Google’s"],
        ["Meta cookies (facebook.com)", "Meta", "When you use Facebook Login for Business", "Meta’s"],
      ];

  return (
    <LegalShell title={doc.title}>
      <LegalArticle doc={doc} />
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--ink)]">
          {id ? "Ringkasan tabel" : "Summary table"}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-black/[0.06] bg-white">
          <table className="w-full min-w-[32rem] text-left text-[13px] text-[var(--ink)]/70">
            <thead className="bg-[var(--warm)] text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]/45">
              <tr>
                <th className="px-4 py-3">{id ? "Nama" : "Name"}</th>
                <th className="px-4 py-3">{id ? "Pihak" : "Set by"}</th>
                <th className="px-4 py-3">{id ? "Tujuan" : "Purpose"}</th>
                <th className="px-4 py-3">{id ? "Masa" : "Duration"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r[0]} className="border-t border-black/[0.05]">
                  {r.map((c) => (
                    <td key={c} className="px-4 py-3 align-top">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink)]/45">
          {id ? "Kebijakan cookie Google: " : "Google cookie policy: "}
          <a
            href={GOOGLE_COOKIE_POLICY}
            className="text-[#2a9bb8] underline decoration-[#2a9bb8]/30 underline-offset-4 hover:text-[var(--ink)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            policies.google.com/technologies/cookies
          </a>
          {" · "}
          {id ? "Kebijakan cookie Meta: " : "Meta cookies policy: "}
          <a
            href={META_COOKIE_POLICY}
            className="text-[#2a9bb8] underline decoration-[#2a9bb8]/30 underline-offset-4 hover:text-[var(--ink)]"
            target="_blank"
            rel="noopener noreferrer"
          >
            facebook.com/privacy/policies/cookies
          </a>
        </p>
      </section>
    </LegalShell>
  );
}
