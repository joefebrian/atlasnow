import type { CommerceOrderView } from "@/lib/commerce/order-parse";

function formatWhen(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

function formatEstimate(order: CommerceOrderView) {
  if (order.estimatedTotal == null) return "—";
  if (order.currency === "IDR") {
    return `IDR ${order.estimatedTotal.toLocaleString("en-US")}`;
  }
  return `${order.estimatedTotal} ${order.currency || ""}`.trim();
}

function validationLabel(validation: string) {
  switch (validation) {
    case "MATCHED":
      return "Matches product master";
    case "UNKNOWN_SKU":
      return "Needs review — SKU is not in AtlasNow";
    case "PRICE_MISMATCH":
      return "Needs review — price does not match";
    default:
      return "Needs review";
  }
}

function paymentLabel(status: string) {
  return status === "NOT_INITIATED" ? "Not started" : status;
}

export function OrdersInbox({
  merchantName,
  orders,
  enabled,
}: {
  merchantName: string;
  orders: CommerceOrderView[];
  enabled: boolean;
}) {
  return (
    <section className="an-card mb-4 overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Catalog orders</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          WhatsApp catalog orders for {merchantName || "this brand"}. Payment is not started. The estimated total is not revenue.
        </p>
      </div>
      {!enabled ? (
        <p className="px-4 py-4 text-sm text-slate-600">Order capture is off. WhatsApp catalog orders are not stored.</p>
      ) : orders.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-600">No catalog orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-4 py-2 font-semibold">Merchant</th>
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Products</th>
                <th className="px-4 py-2 font-semibold">Estimated total</th>
                <th className="px-4 py-2 font-semibold">Validation</th>
                <th className="px-4 py-2 font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{order.reference}</p>
                    <p className="text-[12px] text-slate-500">{formatWhen(order.receivedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <p>{merchantName || "—"}</p>
                    <p className="text-[12px] text-slate-500">{order.outletName || "Outlet not set"}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.customerRef}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {order.lines.length === 0
                      ? "—"
                      : order.lines.map((line, index) => (
                          <p key={`${order.id}-${index}`}>
                            {line.sku} × {line.quantity}
                          </p>
                        ))}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatEstimate(order)}</td>
                  <td className="px-4 py-3 text-slate-700">{validationLabel(order.validation)}</td>
                  <td className="px-4 py-3 text-slate-700">{paymentLabel(order.paymentStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
