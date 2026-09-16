"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { CLIENT_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";

type Membership = {
  id: string;
  role: string;
  status: string;
  locationId?: string | null;
  location?: { id: string; name: string } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    isActive: boolean;
  };
};

export function ClientUsersPanel({
  clientId,
  memberships: initial,
  locations = [],
  onLoginEnabled,
}: {
  clientId: string;
  memberships: Membership[];
  locations?: { id: string; name: string }[];
  onLoginEnabled?: (enabled: boolean) => void;
}) {
  const router = useRouter();
  const [memberships, setMemberships] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("CLIENT_ADMIN");
  const [locationId, setLocationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );
  const [issued, setIssued] = useState<{
    email: string;
    temporaryPassword?: string;
    role: string;
    note?: string;
  } | null>(null);

  async function addUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setIssued(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || null,
          role,
          locationId: role === "BRANCH" ? locationId || null : null,
          resetPassword: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Failed to add user" });
        setBusy(false);
        return;
      }
      if (data.membership) {
        setMemberships((list) => {
          const rest = list.filter((m) => m.id !== data.membership.id);
          return [...rest, data.membership];
        });
      }
      if (data.login) {
        setIssued({
          email: data.login.email,
          temporaryPassword: data.login.temporaryPassword,
          role: data.login.roleLabel || data.login.role,
          note: data.login.note,
        });
      }
      onLoginEnabled?.(true);
      setEmail("");
      setName("");
      setRole("CLIENT_ADMIN");
      setLocationId("");
      setMessage({ type: "ok", text: "User added to this client." });
      setBusy(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Could not reach server" });
      setBusy(false);
    }
  }

  async function changeRole(membershipId: string, nextRole: string, nextLocationId?: string | null) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          role: nextRole,
          locationId: nextRole === "BRANCH" ? nextLocationId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Role update failed" });
        setBusy(false);
        return;
      }
      setMemberships((list) =>
        list.map((m) =>
          m.id === membershipId
            ? {
                ...m,
                role: nextRole,
                locationId: nextRole === "BRANCH" ? nextLocationId || m.locationId : null,
              }
            : m
        )
      );
      setBusy(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Could not reach server" });
      setBusy(false);
    }
  }

  async function resetPassword(membershipId: string) {
    if (!window.confirm("Reset password and show a new temporary password?")) return;
    setBusy(true);
    setMessage(null);
    setIssued(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Reset failed" });
        setBusy(false);
        return;
      }
      if (data.login) {
        setIssued({
          email: data.login.email,
          temporaryPassword: data.login.temporaryPassword,
          role: data.login.roleLabel || data.login.role,
        });
      }
      setMessage({ type: "ok", text: "Password reset." });
      setBusy(false);
    } catch {
      setMessage({ type: "err", text: "Could not reach server" });
      setBusy(false);
    }
  }

  async function removeUser(membershipId: string, userEmail: string) {
    if (
      !window.confirm(
        `Remove ${userEmail} from this client?\n\nThey lose access to this workspace only.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/users/${membershipId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Remove failed" });
        setBusy(false);
        return;
      }
      setMemberships((list) => list.filter((m) => m.id !== membershipId));
      if (typeof data.remainingUsers === "number" && data.remainingUsers === 0) {
        onLoginEnabled?.(false);
      }
      setMessage({ type: "ok", text: "User removed from client." });
      setBusy(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Could not reach server" });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="an-card p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Add login user</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          One client can have multiple logins. Each user gets a role (Client Admin, HQ,
          Regional, Branch, Viewer).
        </p>

        <form onSubmit={addUser} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Email *
            </label>
            <input
              type="email"
              className="an-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@brand.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Display name
            </label>
            <input
              className="an-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Role
            </label>
            <select
              className="an-input"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {CLIENT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {role === "BRANCH" ? (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Outlet *
              </label>
              <select
                className="an-input"
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">Pick the cabang</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-end">
            <button type="submit" className="an-btn-primary w-full sm:w-auto" disabled={busy}>
              {busy ? "Working…" : "Add user login"}
            </button>
          </div>
        </form>

        {issued && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3.5 text-sm text-emerald-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Credentials — copy now
            </p>
            <p className="mt-2">
              Email: <code className="font-semibold">{issued.email}</code>
            </p>
            {issued.temporaryPassword && (
              <p>
                Password:{" "}
                <code className="font-semibold">{issued.temporaryPassword}</code>
              </p>
            )}
            <p className="mt-1 text-xs">Role: {issued.role}</p>
            {issued.note && <p className="mt-1 text-xs text-emerald-800/80">{issued.note}</p>}
          </div>
        )}

        {message && (
          <p
            className={`mt-3 rounded-xl px-3.5 py-2.5 text-xs font-medium ${
              message.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      <div className="an-table-wrap">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">
            Users on this client ({memberships.length})
          </h2>
          <p className="text-[11px] text-slate-400">
            Multi-login: same client, many accounts · role controls access
          </p>
        </div>
        <table className="an-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {memberships.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                  No users yet — add a login above.
                </td>
              </tr>
            ) : (
              memberships.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold text-slate-800">{m.user.name || "—"}</td>
                  <td className="text-sm text-slate-600">{m.user.email}</td>
                  <td>
                    {isClientRoleOption(m.role) ? (
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => changeRole(m.id, e.target.value, m.locationId)}
                      >
                        {CLIENT_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="an-badge-muted" title="Agency staff membership">
                        {ROLE_LABELS[m.role as Role] || m.role}
                      </span>
                    )}
                    {m.role === "BRANCH" ? (
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                        value={m.locationId || ""}
                        disabled={busy}
                        onChange={(e) => changeRole(m.id, "BRANCH", e.target.value)}
                      >
                        <option value="">Pick cabang</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td>
                    {m.status === "ACTIVE" && m.user.isActive ? (
                      <span className="an-badge-yes">Active</span>
                    ) : (
                      <span className="an-badge-muted">{m.status}</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {isClientRoleOption(m.role) && (
                        <>
                          <button
                            type="button"
                            className="an-btn-ghost text-[11px] px-2 py-1"
                            disabled={busy}
                            onClick={() => resetPassword(m.id)}
                          >
                            Reset pwd
                          </button>
                          <button
                            type="button"
                            className="an-btn text-[11px] px-2 py-1 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            disabled={busy}
                            onClick={() => removeUser(m.id, m.user.email)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isClientRoleOption(role: string) {
  return CLIENT_ROLES.includes(role as Role);
}
