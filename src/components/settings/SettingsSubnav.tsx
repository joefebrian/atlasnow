"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export type SettingsNavItem = {
  href: string;
  label: string;
  description: string;
  agencyOnly?: boolean;
  platformOnly?: boolean;
};

type Props = {
  items: SettingsNavItem[];
  isAgencyStaff: boolean;
  isPlatformAdmin?: boolean;
};

export function SettingsSubnav({ items, isAgencyStaff, isPlatformAdmin }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const visible = items.filter((i) => {
    if (i.platformOnly) return Boolean(isPlatformAdmin);
    if (i.agencyOnly) return isAgencyStaff;
    return true;
  });
  const current =
    visible.find((item) => pathname === item.href || (item.href !== "/settings" && pathname.startsWith(item.href)))
      ?.href || "/settings";

  return (
    <>
      <label className="block sm:hidden">
        <span className="sr-only">Settings</span>
        <select
          className="an-input w-full py-2.5 text-sm font-semibold"
          value={current}
          onChange={(e) => router.push(e.target.value)}
        >
          {visible.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <nav className="hidden flex-wrap gap-2 sm:flex">
        {visible.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/settings" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.description}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                active
                  ? "bg-[var(--ink)] text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-[#eef8ff] hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
