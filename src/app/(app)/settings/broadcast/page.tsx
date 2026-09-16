import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { getAtlasFees } from "@/lib/broadcast/fees";
import { BroadcastFeeForm } from "@/components/settings/BroadcastFeeForm";

export const metadata = { title: "Broadcast pricing · AtlasNow" };

export default async function BroadcastFeesPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.isPlatformAdmin) redirect("/settings");
  const fees = await getAtlasFees();

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Pay as you go"
        title="Broadcast pricing"
        description="Super Admin only. AtlasNow’s fee on top of Meta. Estimates use the official 1 Oct 2026 IDR card (Indonesia marketing Rp 586.33, utility/service Rp 356.65). Human replies are service, not a free 24-hour session. Change the Rp and the % here when you want more margin."
      />
      <div className="an-card p-5 sm:p-6">
        <BroadcastFeeForm initial={fees} />
      </div>
    </div>
  );
}
