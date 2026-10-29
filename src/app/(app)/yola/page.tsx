import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { homePathForNav } from "@/lib/nav-access";
import { sessionCanConfigureYolaPayment, sessionCanReadYola, yolaRoleAllowed } from "@/lib/yola/access";
import { DEMO_TICKET_PHRASE } from "@/lib/yola/catalog";
import { YOLA_SETUP, flowSendEnabled, livePaymentsEnabled, pilotAllowlist, pilotLinkSendEnabled, ticketLiveIssuanceEnabled, yolaPhoneNumberId, yolaWabaId } from "@/lib/yola/config";
import { listYolaDesk } from "@/lib/yola/engine";
import { loadYolaPaymentConfig, saveYolaPaymentConfig } from "@/lib/yola/payment-config";

type Props = { searchParams: Promise<{ client?: string; payment?: string }> };

async function savePaymentAction(formData: FormData) {
  "use server";
  const session = await readSession();
  if (!session) redirect("/login");
  const tenantId = String(formData.get("tenantId") || "");
  const client = String(formData.get("client") || "");
  const back = client ? `/yola?client=${encodeURIComponent(client)}` : "/yola";
  const saved = await saveYolaPaymentConfig({
    session,
    tenantId,
    mode: String(formData.get("mode") || ""),
    merchantUrl: String(formData.get("merchantUrl") || ""),
  });
  const joiner = back.includes("?") ? "&" : "?";
  redirect(`${back}${joiner}payment=${saved.ok ? "saved" : saved.reason}`);
}

export default async function YolaPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!yolaRoleAllowed(session.role)) {
    redirect(homePathForNav({ role: session.role, mode: session.mode, isAgencyStaff: session.isAgencyStaff, isPlatformAdmin: session.isPlatformAdmin }));
  }
  const { client, payment } = await searchParams;
  const clients = session.isAgencyStaff ? await listAccessibleClientTenants(session) : [];
  const selected = session.isAgencyStaff ? clients.find((row) => row.id === client)?.id ?? null : session.tenantId;
  const allowed = selected ? await canAccessTenant(session, selected) && (await sessionCanReadYola(session, selected)) : false;
  const canConfigure = selected ? await sessionCanConfigureYolaPayment(session, selected) : false;
  const desk = allowed && selected ? await listYolaDesk(selected) : null;
  const paymentConfig = allowed && selected ? await loadYolaPaymentConfig(selected) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
        <h1 className="text-2xl font-semibold text-slate-900">YOLA FUN</h1>
        <p className="mt-1 text-sm text-slate-600">Kartu Presale 2× Masuk · Rp499.000 termasuk pajak. Sandbox only.</p>
      </header>
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
        <p>Flow send: {flowSendEnabled() ? "on" : "off"}</p>
        <p>Pilot payment link: {pilotLinkSendEnabled() ? "on" : "off"}</p>
        <p>Pilot allowlist: {pilotAllowlist().length ? "configured" : "empty"}</p>
        <p>Bulk marketing: off</p>
        <p>Live payments: {livePaymentsEnabled() ? "on" : "off"}</p>
        <p>Ticket issuance: {ticketLiveIssuanceEnabled() ? "LIVE" : "TEST"}</p>
        <p>Phone number id: {yolaPhoneNumberId() ? "configured" : "missing"}</p>
        <p>WABA id: {yolaWabaId() ? "configured" : "missing"}</p>
        <p>Template: {desk?.templateStatus ?? "UNVERIFIED"}</p>
        <p>Flow id: {desk?.flowId ? "matched" : "not verified"}</p>
      </section>
      {!yolaPhoneNumberId() ? <p className="text-sm text-amber-800">{YOLA_SETUP.phone}</p> : null}
      {!yolaWabaId() ? <p className="text-sm text-amber-800">{YOLA_SETUP.waba}</p> : null}
      {desk?.templateStatus !== "APPROVED" ? <p className="text-sm text-amber-800">{YOLA_SETUP.token}</p> : null}
      {paymentConfig ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-900">Payment link</h2>
          <p className="text-slate-600">
            Current mode: {paymentConfig.plan.kind === "merchant" ? "Merchant payment page" : "Demo checkout"}.
            WhatsApp still sends the AtlasNow order link. A merchant page does not settle the order or issue a ticket.
          </p>
          <p className="text-slate-500">Gateway webhook and AtlasNow gateway stay off until a provider account is connected.</p>
          {payment === "saved" ? <p className="text-emerald-800">Payment setting saved.</p> : null}
          {payment && payment !== "saved" ? <p className="text-amber-800">Payment setting was not saved.</p> : null}
          {canConfigure ? (
            <form action={savePaymentAction} className="flex flex-col gap-3">
              <input type="hidden" name="tenantId" value={selected || ""} />
              <input type="hidden" name="client" value={client || ""} />
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" value="DEMO_CHECKOUT" defaultChecked={paymentConfig.mode !== "MERCHANT_EXTERNAL_LINK"} />
                Demo checkout
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" value="MERCHANT_EXTERNAL_LINK" defaultChecked={paymentConfig.mode === "MERCHANT_EXTERNAL_LINK"} />
                Merchant HTTPS payment page
              </label>
              <label className="flex flex-col gap-1">
                <span>Merchant payment URL</span>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  name="merchantUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://pay.example.com/yola"
                  defaultValue={paymentConfig.merchantUrl}
                />
              </label>
              <button className="w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
                Save payment setting
              </button>
            </form>
          ) : (
            <p className="text-slate-500">A workspace admin can change this setting.</p>
          )}
        </section>
      ) : null}
      {!allowed ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          This workspace does not run YOLA FUN. Orders for another brand stay hidden.
        </p>
      ) : null}
      {desk ? (
        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            Open invitations {desk.invites}. Held messages {desk.heldOutbound}. Quarantined {desk.quarantinedOutbound}. Held and quarantined messages were not sent.
          </p>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Buyer</th>
                <th className="px-4 py-2">Visit</th>
                <th className="px-4 py-2">Record</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {desk.orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={7}>No orders yet.</td>
                </tr>
              ) : (
                desk.orders.map((order) => (
                  <tr key={order.humanId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{order.humanId}<div className="text-xs text-slate-500">Rp{order.amountIdr.toLocaleString("id-ID")}</div></td>
                    <td className="px-4 py-3">{order.buyerName}{order.phoneMismatch ? <div className="text-xs text-amber-700">Phone differs from WhatsApp</div> : null}</td>
                    <td className="px-4 py-3">{order.visitDate} {order.visitTime}<div className="text-xs text-slate-500">{order.preferenceNote}</div></td>
                    <td className="px-4 py-3">{order.origin === "synthetic" ? "Synthetic test" : order.origin === "pilot" ? "Pilot" : order.origin}</td>
                    <td className="px-4 py-3">{order.status}</td>
                    <td className="px-4 py-3">{order.payments[0]?.status === "SIMULATED_PAID" ? "Simulated · not revenue" : `${order.payments[0]?.mode ?? "sandbox"} · ${order.payments[0]?.status ?? "none"}`}</td>
                    <td className="px-4 py-3">
                      {order.tickets[0] ? `${order.tickets[0].issuanceMode} · ${order.tickets[0].remaining} left` : "none"}
                      {order.tickets[0]?.issuanceMode === "TEST" ? <div className="text-xs text-slate-500">{DEMO_TICKET_PHRASE}</div> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
