import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { BackLink, PageHeader } from "@/components/ui";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

/**
 * S4 honest GSC mode (T-024…T-026 foundation):
 * No fake store-level GSC ranking when property is portfolio-only.
 */
export default async function GscHonestModePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  if (!session.isAgencyStaff) {
    return (
      <ModulePlaceholder
        title="Search Console"
        description="GSC connectors are managed by agency staff."
        fase="S4"
      />
    );
  }

  return (
    <div className="an-section mx-auto w-full max-w-3xl">
      <PageHeader
        back={<BackLink href="/settings/google">Back to Google</BackLink>}
        eyebrow="Google"
        badge="Search"
        title="Google Search Console"
        description="Property-level connect and page→location mapping come after GBP Performance (S5). Until then, AtlasNow refuses fake branch rankings from a shared /outlets URL."
      />

      <div className="an-card space-y-3 p-5 text-sm text-slate-600">
        <h2 className="text-sm font-semibold text-slate-900">Rules (PRD §8.4)</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
          <li>
            GSC has <strong>no city dimension</strong> — country ≠ branch mapping.
          </li>
          <li>
            Branch mapping requires <strong>exact page URL</strong> or controlled regex per
            location.
          </li>
          <li>
            Shared portfolio URLs (e.g. <code className="font-mono">/outlets</code>) stay{" "}
            <strong>portfolio-only</strong> — no store leaderboard from that page.
          </li>
          <li>
            Filtered / anonymized Search Analytics rows are disclosed, never invented.
          </li>
        </ul>
        <p className="text-xs text-slate-500">
          Status: <strong className="text-amber-800">Planned connector</strong> — credentials
          slot exists under{" "}
          <Link href="/settings/api" className="font-semibold text-indigo-600 hover:underline">
            Settings → API
          </Link>
          ; sync not enabled yet.
        </p>
        <BackLink href="/settings/google">Back to Google</BackLink>
      </div>
    </div>
  );
}
