import type { ReactNode } from "react";
import { BILLING_SELLER, sellerLine } from "@/lib/billing/seller";

export function PrintDoc({
  kind,
  title,
  metaRight,
  foot,
  children,
}: {
  kind: "SOW" | "Invoice";
  title: string;
  metaRight?: ReactNode;
  foot?: string;
  children: ReactNode;
}) {
  return (
    <article className="an-print-doc">
      <header className="an-print-head">
        <div className="an-print-rule" />
        <div className="an-print-head-row">
          <div>
            <p className="an-print-brand">{BILLING_SELLER.product}</p>
            <p className="an-print-legal">{sellerLine()}</p>
            <p className="an-print-contact">
              {BILLING_SELLER.email}
              <span aria-hidden> · </span>
              atlasnow.co
            </p>
          </div>
          <div className="an-print-head-right">
            <p className="an-print-kind">{kind === "SOW" ? "Statement of Work" : "Invoice"}</p>
            {metaRight}
          </div>
        </div>
        <h1 className="an-print-title">{title}</h1>
      </header>
      {children}
      <footer className="an-print-foot">
        {foot || `${sellerLine()} · ${BILLING_SELLER.product} · Pajak per klien (checklist). Setoran manual.`}
      </footer>
    </article>
  );
}

export function PrintSection({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="an-print-sec">
      <h2>
        <span className="an-print-n">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PrintDl({ rows }: { rows: { k: string; v: ReactNode }[] }) {
  return (
    <dl className="an-print-dl">
      {rows.map((r) => (
        <div key={r.k} className="an-print-dl-row">
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
