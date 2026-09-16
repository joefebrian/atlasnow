import { ClientRowActions } from "@/components/clients/ClientRowActions";
import { isSelfServeSignup } from "@/lib/clients";

export type ClientRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  loginEnabled: boolean;
  status: string;
  notes: string | null;
  createdAt: Date;
  _count: { memberships: number };
};

export function ClientTable({
  clients,
  labels,
  activatePending = false,
}: {
  clients: ClientRow[];
  labels: {
    colName: string;
    colIndustry: string;
    colContact: string;
    colLogin: string;
    colUsers: string;
    colStatus: string;
    loginOn: string;
    loginOff: string;
    view: string;
    selfServe: string;
    turnOnLogin: string;
  };
  activatePending?: boolean;
}) {
  return (
    <>
    <div className="space-y-2 md:hidden">
      {clients.map((c) => {
        const selfServe = isSelfServeSignup(c.notes);
        return (
          <div key={c.id} className="an-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{c.name}</p>
                <p className="font-mono text-[11px] text-slate-400">{c.slug}</p>
              </div>
              {c.loginEnabled ? (
                <span className="an-badge-yes shrink-0">{labels.loginOn}</span>
              ) : (
                <span className="an-badge-warn shrink-0">{labels.loginOff}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {c.industry || "—"}
              {c.contactName ? ` · ${c.contactName}` : ""}
            </p>
            {c.contactPhone ? (
              <p className="mt-1 font-mono text-[12px] text-slate-500">{c.contactPhone}</p>
            ) : null}
            {selfServe ? (
              <p className="mt-1">
                <span className="an-badge-warn">{labels.selfServe}</span>
              </p>
            ) : null}
            <div className="mt-3">
              <ClientRowActions
                clientId={c.id}
                clientName={c.name}
                openLabel={labels.view}
                contactEmail={c.contactEmail}
                canActivate={activatePending && !c.loginEnabled}
                activateLabel={labels.turnOnLogin}
              />
            </div>
          </div>
        );
      })}
    </div>
    <div className="an-table-wrap hidden md:block">
      <table className="an-table">
        <thead>
          <tr>
            <th>{labels.colName}</th>
            <th>{labels.colIndustry}</th>
            <th>{labels.colContact}</th>
            <th>{labels.colLogin}</th>
            <th>{labels.colUsers}</th>
            <th>{labels.colStatus}</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const selfServe = isSelfServeSignup(c.notes);
            return (
              <tr key={c.id}>
                <td>
                  <div className="font-semibold text-slate-900">{c.name}</div>
                  <div className="font-mono text-[11px] text-slate-400">{c.slug}</div>
                  {selfServe ? (
                    <div className="mt-1">
                      <span className="an-badge-warn">{labels.selfServe}</span>
                    </div>
                  ) : null}
                </td>
                <td className="text-sm text-slate-600">{c.industry || "—"}</td>
                <td>
                  <div className="text-sm text-slate-700">{c.contactName || "—"}</div>
                  <div className="text-[11px] text-slate-400">{c.contactEmail || "—"}</div>
                  {c.contactPhone ? (
                    <div className="font-mono text-[11px] text-slate-500">{c.contactPhone}</div>
                  ) : null}
                </td>
                <td>
                  {c.loginEnabled ? (
                    <span className="an-badge-yes">{labels.loginOn}</span>
                  ) : (
                    <span className="an-badge-warn">{labels.loginOff}</span>
                  )}
                </td>
                <td className="tabular-nums font-medium text-slate-700">{c._count.memberships}</td>
                <td>
                  <span className="an-badge-muted">{c.status}</span>
                </td>
                <td className="text-right">
                  <ClientRowActions
                    clientId={c.id}
                    clientName={c.name}
                    openLabel={labels.view}
                    contactEmail={c.contactEmail}
                    canActivate={activatePending && !c.loginEnabled}
                    activateLabel={labels.turnOnLogin}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}
