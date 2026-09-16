const GO_QUERY = "https://open.tiktokapis.com/v2/localservice/saas/fulfill/get_code_item_list/";
const GO_REDEEM = "https://open.tiktokapis.com/v2/localservice/saas/fulfill/redeem_code/";

export type GoQueryResult = {
  shopOrderId: string;
  codes: string[];
  title: string;
  detail: string;
};

export function merchantGoError(code: string | number | undefined, fallback: string): string {
  const c = String(code || "");
  if (c.includes("3000111")) return "This voucher is not for this outlet.";
  if (c.includes("3000108")) return "This voucher is outside its valid time.";
  if (c.includes("3000100") || c.includes("9990402")) return "This voucher was already used or refunded.";
  if (c.includes("3000110")) return "Cannot read this TikTok QR.";
  return fallback;
}

async function goPost(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; json: Record<string, unknown>; status: number }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, json, status: res.status };
}

export async function queryGoVoucher(opts: {
  token: string;
  merchantId: string;
  thirdShopId: string;
  qrInfo: string;
}): Promise<GoQueryResult> {
  const { ok, json } = await goPost(GO_QUERY, opts.token, {
    merchant_id: opts.merchantId,
    third_shop_id: opts.thirdShopId,
    qr_info: opts.qrInfo,
    locale: "id-ID",
  });
  const err = json.error as { code?: string | number; message?: string } | undefined;
  if (!ok || err) {
    throw new Error(merchantGoError(err?.code, err?.message || "TikTok GO could not read this voucher."));
  }
  const data = (json.data || json) as Record<string, unknown>;
  const shopOrderId = String(data.shop_order_id || data.shopOrderId || "");
  const codes = Array.isArray(data.code_list)
    ? (data.code_list as unknown[]).map((x) => String(x))
    : [];
  const title = String(data.product_name || data.title || "TikTok GO voucher");
  const detail = String(data.status_desc || data.detail || "Show this to the cashier, then confirm redeem.");
  if (!shopOrderId && !codes.length) {
    throw new Error("TikTok GO returned no voucher for this QR.");
  }
  return { shopOrderId, codes, title, detail };
}

export async function redeemGoVoucher(opts: {
  token: string;
  merchantId: string;
  thirdShopId: string;
  shopOrderId: string;
  codes: string[];
}): Promise<void> {
  const { ok, json } = await goPost(GO_REDEEM, opts.token, {
    merchant_id: opts.merchantId,
    third_shop_id: opts.thirdShopId,
    shop_order_id: opts.shopOrderId,
    code_list: opts.codes,
    locale: "id-ID",
  });
  const err = json.error as { code?: string | number; message?: string } | undefined;
  if (!ok || err) {
    throw new Error(merchantGoError(err?.code, err?.message || "Could not redeem this TikTok GO voucher."));
  }
}
