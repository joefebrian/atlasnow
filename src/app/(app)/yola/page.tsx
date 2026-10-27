import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { canAccessTenant, listAccessibleClientTenants } from "@/lib/locations/access";
import { homePathForNav } from "@/lib/nav-access";
import { DEMO_TICKET_PHRASE } from "@/lib/yola/catalog";
import { YOLA_SETUP, flowSendEnabled, livePaymentsEnabled, ticketLiveIssuanceEnabled, yolaPhoneNumberId, yolaWabaId } from "@/lib/yola/config";
import { listYolaDesk } from "@/lib/yola/engine";
import { sessionCanReadYola, yolaRoleAllowed } from "@/lib/yola/access";

type Props = { searchParams: Promise<{ client?: string }> };

export default async function YolaPage({ searchParams }: Props) {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!yolaRoleAllowed(session.role)) {
    redirect(homePathForNav({ role: session.role, mode: session.mode, isAgencyStaff: session.isAgencyStaff, isPlatformAdmin: session.isPlatformAdmin }));
  }
  const { client } = await searchParams;
  const clients = session.isAgencyStaff ? await listAccessibleClientTenants(session) : [];
  const selected = session.isAgencyStaff ? clients.find((row) => row.id === client)?.id ?? null : session.tenantId;
  const allowed = selected ? await canAccessTenant(session, selected) && (await sessionCanReadYola(session, selected)) : false;
  const desk = allowed && selected ? await listYolaDesk(selected) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
        <h1 className="text-2xl font-semibold text-slate-900">YOLA FUN</h1>
        <p className="mt-1 text-sm text-slate-600">Kartu Presale 2× Masuk · Rp499.000 termasuk pajak. Sandbox only.</p>
      </header>
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
        <p>Flow send: {flowSendEnabled() ? "on" : "off"}</p>
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
      {!allowed ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          This workspace does not run YOLA FUN. Orders for another brand stay hidden.
        </p>
      ) : null}
      {desk ? (
        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
            Open invitations {desk.invites}. Held messages {desk.heldOutbound}. Held messages were not sent.
          </p>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Buyer</th>
                <th className="px-4 py-2">Visit</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {desk.orders.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={6}>No orders yet.</td>
                </tr>
              ) : (
                desk.orders.map((order) => (
                  <tr key={order.humanId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{order.humanId}<div className="text-xs text-slate-500">Rp{order.amountIdr.toLocaleString("id-ID")}</div></td>
                    <td className="px-4 py-3">{order.buyerName}{order.phoneMismatch ? <div className="text-xs text-amber-700">Phone differs from WhatsApp</div> : null}</td>
                    <td className="px-4 py-3">{order.visitDate} {order.visitTime}<div className="text-xs text-slate-500">{order.preferenceNote}</div></td>
                    <td className="px-4 py-3">{order.status}</td>
                    <td className="px-4 py-3">{order.payments[0]?.mode ?? "sandbox"} · {order.payments[0]?.status ?? "none"}</td>
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
