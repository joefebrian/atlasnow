import { loadDemoCheckout, simulateDemoPayment } from "@/lib/yola/checkout";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "YOLA FUN — Presale Checkout",
  description: "YOLA FUN presale demo checkout. Test mode. No real payment and no ticket.",
  robots: { index: false, follow: false },
};

async function simulateAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "");
  await simulateDemoPayment(token);
  redirect(`/pay/yola/${encodeURIComponent(token)}`);
}

type Props = { params: Promise<{ token: string }> };

export default async function YolaDemoPayPage({ params }: Props) {
  const { token } = await params;
  const checkout = await loadDemoCheckout(decodeURIComponent(token));
  const price = new Intl.NumberFormat("id-ID").format(checkout.amountIdr || 499000);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col gap-4 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Demo / test mode</p>
      <h1 className="text-2xl font-semibold text-slate-900">YOLA FUN — Presale Checkout</h1>
      {checkout.state === "invalid" ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">Link ini tidak berlaku.</p>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
          <p>Order: {checkout.orderId}</p>
          <p>Presale Card — 2x Entry</p>
          <p>Dua kunjungan, satu orang, tiga jam setiap kunjungan.</p>
          <p>Total: Rp{price}</p>
          <p>Termasuk pajak.</p>
          <p>Preferensi kunjungan: {checkout.visitDate} {checkout.visitTime}</p>
          <p>Status pesanan: {checkout.financialStatus === "PENDING_PAYMENT" ? "Menunggu pembayaran" : checkout.financialStatus}</p>
          <p>Simulasi: {checkout.simulation === "SIMULATED_PAID" ? "SIMULATED_PAID" : "belum"}</p>
          <p className="rounded-xl bg-amber-50 p-3 text-amber-950">TEST MODE — NO REAL PAYMENT. Tidak ada uang yang ditagihkan dan belum ada tiket yang diterbitkan.</p>
          {checkout.state === "expired" ? <p>Link pembayaran sudah kedaluwarsa.</p> : null}
          {checkout.state === "simulated" ? <p>Simulasi pembayaran tercatat. Status keuangan pesanan tidak berubah menjadi lunas.</p> : null}
          {checkout.state === "ready" ? (
            <form action={simulateAction}>
              <input type="hidden" name="token" value={token} />
              <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
                Simulate Payment (TEST)
              </button>
            </form>
          ) : null}
        </section>
      )}
    </main>
  );
}
