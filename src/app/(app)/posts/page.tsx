import { PageHeader, SearchField, TableShell, Toolbar } from "@/components/ui";
import { MOCK_POSTS } from "@/lib/mock-gbp";
import Link from "next/link";

const statusClass: Record<string, string> = {
  Live: "an-badge-live",
  Processing: "an-badge-warn",
  Rejected: "an-badge-no",
  Expired: "an-badge-muted",
};

const typeTone: Record<string, string> = {
  "Offer Post": "bg-violet-50 text-violet-700 ring-violet-100",
  "Event Post": "bg-sky-50 text-sky-700 ring-sky-100",
  "Standard Post": "bg-slate-50 text-slate-600 ring-slate-100",
  "Alert Post": "bg-amber-50 text-amber-800 ring-amber-100",
};

export default function PostsPage() {
  const live = MOCK_POSTS.filter((p) => p.status === "Live").length;

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Content"
        badge="Coming later"
        title="Posts & offers"
        description="Coming later. Google posts and offers will live here. The table below is a shell so the idea is visible — not live publishing yet."
        actions={
          <>
            <span className="an-badge-live">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              {live} live
            </span>
            <Link href="/ads" className="an-btn-ghost">
              Ads & vouchers
            </Link>
            <button
              type="button"
              className="an-btn-primary"
              disabled
              title="Needs Google Business Profile write + approval workflow"
            >
              Create offer
            </button>
          </>
        }
      />

      <Toolbar>
        <SearchField placeholder="Search post summary…" />
        <div className="flex flex-wrap gap-1.5">
          {["All", "Offer", "Event", "Live", "Rejected"].map((f, i) => (
            <button key={f} type="button" className={i === 0 ? "an-chip-on" : "an-chip-off"}>
              {f}
            </button>
          ))}
        </div>
      </Toolbar>

      <TableShell
        metaLeft={
          <>
            Showing{" "}
            <span className="font-semibold text-slate-800">{MOCK_POSTS.length}</span> of{" "}
            {MOCK_POSTS.length} posts
          </>
        }
        metaRight="Publish requires approval gate"
      >
        <table className="an-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Summary</th>
              <th>Type</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_POSTS.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap text-xs font-medium tabular-nums text-slate-400">
                  {p.date}
                </td>
                <td>
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-xl shadow-inner ring-1 ring-slate-200/70 transition group-hover:scale-105">
                      {p.thumb}
                    </span>
                    <span className="max-w-md font-semibold leading-snug text-slate-800">
                      {p.summary}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      typeTone[p.postType] || typeTone["Standard Post"]
                    }`}
                  >
                    {p.postType}
                  </span>
                </td>
                <td>
                  <span className="an-badge-muted">{p.location}</span>
                </td>
                <td>
                  <span className={statusClass[p.status] || "an-badge-muted"}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </div>
  );
}
