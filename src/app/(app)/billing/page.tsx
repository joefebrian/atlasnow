import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/auth";
import { isPlatformMode } from "@/lib/tenancy";
import { PageHeader } from "@/components/ui";
import { BillingForm } from "@/components/billing/BillingForm";
import { billingBankFromEnv, sellerLine } from "@/lib/billing/seller";

export default async function BillingPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/control-tower");
  if (!isPlatformMode(session)) redirect("/agencies");

  const bank = billingBankFromEnv();

  return (
    <div className="an-section">
      <PageHeader
        eyebrow="Platform"
        badge="Ops"
        title="Invoice & SOW"
        description={`${sellerLine()}. Satu PDF: invoice + SOW. Transfer BCA, tanpa PPN, tanpa payment gateway. Login dinyalakan setelah uang masuk. Spreadsheet tetap ledger-nya.`}
      />
      <BillingForm bank={bank} />
    </div>
  );
}
