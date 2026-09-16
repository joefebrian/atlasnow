"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n/locale";

type ManagedUser = {
  id: string;
  email: string;
  name: string | null;
  roles: { role: string; roleLabel: string; tenant: string; tenantType: string }[];
};

const copy = {
  en: {
    mine: "Your login",
    mineHint: "Change the email and/or password you use to sign in. Current password is required.",
    email: "Email",
    current: "Current password",
    next: "New password (optional)",
    confirm: "Type new password again",
    save: "Save login",
    saving: "Saving…",
    ok: "Saved.",
    emailOk: "Email updated. Use the new email next time you sign in.",
    passwordOk: "Password updated.",
    mismatch: "The two new passwords do not match.",
    short: "New password must be at least 8 characters.",
    nothing: "Enter a new email and/or a new password.",
    team: "Other people’s logins",
    teamHint: "Change email or set a password for a teammate or outlet login.",
    empty: "No other users you can manage yet.",
    edit: "Edit login",
    newEmail: "New email",
    newPassword: "New password",
    saveEmail: "Save email",
    savePassword: "Save password",
    generate: "Make a password",
    copied: "Copied",
    copy: "Copy",
    issued: "Give this password once, then ask them to change it.",
  },
  id: {
    mine: "Login kamu",
    mineHint: "Ganti email dan/atau password masuk. Password sekarang wajib diisi.",
    email: "Email",
    current: "Password sekarang",
    next: "Password baru (opsional)",
    confirm: "Ketik password baru lagi",
    save: "Simpan login",
    saving: "Menyimpan…",
    ok: "Tersimpan.",
    emailOk: "Email sudah diganti. Pakai email baru saat masuk berikutnya.",
    passwordOk: "Password sudah diganti.",
    mismatch: "Password baru tidak sama.",
    short: "Password baru minimal 8 karakter.",
    nothing: "Isi email baru dan/atau password baru.",
    team: "Login orang lain",
    teamHint: "Ganti email atau password untuk tim atau login cabang.",
    empty: "Belum ada user lain yang bisa kamu atur.",
    edit: "Ubah login",
    newEmail: "Email baru",
    newPassword: "Password baru",
    saveEmail: "Simpan email",
    savePassword: "Simpan password",
    generate: "Buatkan password",
    copied: "Tersalin",
    copy: "Salin",
    issued: "Kasih password ini sekali, lalu minta mereka ganti.",
  },
};

export function PasswordSettings({
  locale,
  currentEmail,
}: {
  locale: Locale;
  currentEmail: string;
}) {
  const t = copy[locale];
  const router = useRouter();
  const [email, setEmail] = useState(currentEmail);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [canManage, setCanManage] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetValue, setResetValue] = useState("");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamErr, setTeamErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadUsers() {
    fetch("/api/settings/users", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        setCanManage(Boolean(data.canManage));
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        /* self-service still works */
      });
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function saveMine(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const nextEmail = email.trim().toLowerCase();
    const emailChanged = nextEmail !== currentEmail.toLowerCase();
    const passwordFilled = Boolean(next || confirm);

    if (!emailChanged && !passwordFilled) {
      setMsg({ type: "err", text: t.nothing });
      return;
    }
    if (passwordFilled && next.length < 8) {
      setMsg({ type: "err", text: t.short });
      return;
    }
    if (passwordFilled && next !== confirm) {
      setMsg({ type: "err", text: t.mismatch });
      return;
    }

    setBusy(true);
    try {
      const notes: string[] = [];
      if (emailChanged) {
        const res = await fetch("/api/auth/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ currentPassword: current, newEmail: nextEmail }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMsg({ type: "err", text: data.error || "Could not save email" });
          setBusy(false);
          return;
        }
        notes.push(t.emailOk);
      }
      if (passwordFilled) {
        const res = await fetch("/api/auth/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMsg({ type: "err", text: data.error || "Could not save password" });
          setBusy(false);
          return;
        }
        notes.push(t.passwordOk);
        setNext("");
        setConfirm("");
      }
      setCurrent("");
      setMsg({ type: "ok", text: notes.join(" ") || t.ok });
      router.refresh();
    } catch {
      setMsg({ type: "err", text: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveTeamEmail(userId: string) {
    setTeamBusy(true);
    setTeamErr(null);
    setIssued(null);
    try {
      const res = await fetch(`/api/settings/users/${userId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = (await res.json()) as { error?: string; email?: string };
      if (!res.ok) {
        setTeamErr(data.error || "Could not save email");
        setTeamBusy(false);
        return;
      }
      setUsers((list) =>
        list.map((u) => (u.id === userId ? { ...u, email: data.email || resetEmail } : u))
      );
      setOpenId(null);
    } catch {
      setTeamErr("Network error");
    } finally {
      setTeamBusy(false);
    }
  }

  async function applyReset(userId: string, generate: boolean) {
    setTeamBusy(true);
    setTeamErr(null);
    setIssued(null);
    try {
      const res = await fetch(`/api/settings/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(generate ? { generate: true } : { password: resetValue }),
      });
      const data = (await res.json()) as {
        error?: string;
        email?: string;
        temporaryPassword?: string;
      };
      if (!res.ok) {
        setTeamErr(data.error || "Could not set password");
        setTeamBusy(false);
        return;
      }
      setIssued({
        email: data.email || "",
        password: data.temporaryPassword || "",
      });
      setResetValue("");
      setOpenId(null);
    } catch {
      setTeamErr("Network error");
    } finally {
      setTeamBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={saveMine} className="an-card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">{t.mine}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t.mineHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            {t.email}
            <input
              type="email"
              className="an-input mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            {t.current}
            <input
              type="password"
              className="an-input mt-1.5"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            {t.next}
            <input
              type="password"
              className="an-input mt-1.5"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            {t.confirm}
            <input
              type="password"
              className="an-input mt-1.5"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </label>
        </div>
        {msg ? (
          <p
            className={`rounded-xl px-3 py-2 text-xs font-medium ${
              msg.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {msg.text}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="an-btn-primary disabled:opacity-60">
          {busy ? t.saving : t.save}
        </button>
      </form>

      {canManage ? (
        <div className="an-card p-4 sm:p-5">
          <h2 className="text-[15px] font-semibold text-slate-900">{t.team}</h2>
          <p className="mt-1 text-[13px] text-slate-500">{t.teamHint}</p>

          {issued ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {issued.email}
              </p>
              <p className="mt-1 font-mono text-[15px] font-semibold">{issued.password}</p>
              <p className="mt-1 text-xs text-amber-800/80">{t.issued}</p>
              <button
                type="button"
                className="an-btn-ghost mt-2 text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.password);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? t.copied : t.copy}
              </button>
            </div>
          ) : null}

          {teamErr ? (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {teamErr}
            </p>
          ) : null}

          {users.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {users.map((u) => (
                <li key={u.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {u.name || u.email}
                      </div>
                      <div className="truncate text-xs text-slate-500">{u.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={`${r.tenant}-${r.role}`} className="an-badge-muted">
                            {r.roleLabel} · {r.tenant}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="an-btn-ghost text-xs"
                      onClick={() => {
                        setOpenId(openId === u.id ? null : u.id);
                        setResetEmail(u.email);
                        setResetValue("");
                        setTeamErr(null);
                      }}
                    >
                      {t.edit}
                    </button>
                  </div>
                  {openId === u.id ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="email"
                          className="an-input"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder={t.newEmail}
                        />
                        <button
                          type="button"
                          disabled={teamBusy || !resetEmail.trim()}
                          className="an-btn-primary shrink-0 text-xs disabled:opacity-50"
                          onClick={() => saveTeamEmail(u.id)}
                        >
                          {t.saveEmail}
                        </button>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          className="an-input"
                          placeholder={t.newPassword}
                          value={resetValue}
                          onChange={(e) => setResetValue(e.target.value)}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          disabled={teamBusy || resetValue.length < 8}
                          className="an-btn-primary shrink-0 text-xs disabled:opacity-50"
                          onClick={() => applyReset(u.id, false)}
                        >
                          {t.savePassword}
                        </button>
                        <button
                          type="button"
                          disabled={teamBusy}
                          className="an-btn-ghost shrink-0 text-xs"
                          onClick={() => applyReset(u.id, true)}
                        >
                          {t.generate}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
