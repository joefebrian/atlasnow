"use client";

import { trackClickToWhatsApp } from "@/lib/analytics/ga";

export function ChatHqPing({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="an-btn-primary px-5 py-2.5"
      onClick={() => trackClickToWhatsApp()}
    >
      {label}
    </a>
  );
}
