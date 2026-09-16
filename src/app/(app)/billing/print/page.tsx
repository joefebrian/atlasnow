import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requirePlatformSession } from "@/lib/auth";
import { isPlatformMode } from "@/lib/tenancy";
import { BillingPrintClient } from "@/components/billing/BillingPrintClient";

export const metadata: Metadata = {
  title: "SOW / Invoice",
  robots: { index: false, follow: false },
};

export default async function BillingPrintPage() {
  const session = await requirePlatformSession();
  if (!session) redirect("/control-tower");
  if (!isPlatformMode(session)) redirect("/agencies");

  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Memuat…</p>}>
      <BillingPrintClient />
    </Suspense>
  );
}
