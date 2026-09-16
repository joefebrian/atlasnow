"use client";

import { useRouter } from "next/navigation";
import { BrandLogoField } from "@/components/brand/BrandLogoField";

export function BrandLogoSettings({
  isAgency,
  brands,
  clientId,
  hasLogo,
}: {
  isAgency: boolean;
  brands: { id: string; name: string }[];
  clientId: string | null;
  hasLogo: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {isAgency && (
        <label className="block max-w-sm text-[10px] font-bold uppercase text-slate-400">
          Brand
          <select
            className="an-input mt-1 w-full py-2 font-normal normal-case tracking-normal"
            value={clientId || ""}
            onChange={(e) => {
              const p = new URLSearchParams();
              if (e.target.value) p.set("client", e.target.value);
              router.replace(`/settings/brand${p.toString() ? `?${p}` : ""}`);
            }}
          >
            <option value="">Select brand…</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {clientId ? (
        <div className="an-card p-5 sm:p-6">
          <BrandLogoField key={clientId} tenantId={clientId} hasLogo={hasLogo} />
          <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
            This is the public membership form at <span className="font-medium">/join/…</span>. Copy
            (judul, field) is still Atlas template. Nama merek comes from the brand record.
          </p>
        </div>
      ) : (
        isAgency && <p className="text-sm text-slate-500">Pick a brand to upload its join-page logo.</p>
      )}
    </div>
  );
}
