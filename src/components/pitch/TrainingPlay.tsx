"use client";

import { useState, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { trainingCopy, type TrainingCopy } from "@/lib/pitch/training-copy";

const SAMPLE = {
  name: "Sari",
  phone: "0812-3456-7890",
  trx: "TRX-8821",
  amount: "45.000",
  outlet: "Kemang",
};

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[min(100%,280px)]">
      <div className="rounded-[2rem] bg-[#1f1b1d] p-[10px] shadow-[0_18px_40px_rgba(31,27,29,0.22)]">
        <div className="relative overflow-hidden rounded-[1.45rem] bg-[#faf8fc]">
          <div className="flex justify-center bg-[#faf8fc] pt-2">
            <span className="h-4 w-20 rounded-full bg-[#1f1b1d]/90" />
          </div>
          <div className="min-h-[300px] px-4 pb-5 pt-3 sm:min-h-[390px]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Desk({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#1f1b1d] p-2 shadow-[0_18px_40px_rgba(31,27,29,0.18)]">
      <div className="mb-2 flex items-center gap-1.5 px-2 py-1">
        <span className="h-2 w-2 rounded-full bg-[#ffc1d6]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd6b3]" />
        <span className="h-2 w-2 rounded-full bg-[#c5f0c1]" />
        <span className="ml-2 text-[10px] font-medium text-white/50">{title}</span>
      </div>
      <div className="min-h-[260px] rounded-xl bg-[#faf8fc] p-4 sm:min-h-[360px]">{children}</div>
    </div>
  );
}

function Dots({ n, goal = 10 }: { n: number; goal?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: goal }).map((_, i) => (
        <span
          key={i}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
            i < n ? "bg-[var(--ink)] text-white" : "bg-white text-slate-300 ring-1 ring-slate-200"
          }`}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="an-btn-primary w-full text-sm" onClick={onClick} data-demo>
      {children}
    </button>
  );
}

export function TrainingPlay({ locale }: { locale: Locale }) {
  const t = trainingCopy(locale).play;
  const [step, setStep] = useState(0);
  const go = (n: number) => setStep(Math.max(0, Math.min(t.steps.length - 1, n)));
  const meta = t.steps[step];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-6" data-demo>
      <div className="order-2 lg:order-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2a9bb8]">{t.demoKicker}</p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">{t.demoTitle}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{t.demoLede}</p>
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.nowYou}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{meta.role}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{meta.hint}</p>
          <div className="mt-4 flex gap-1">
            {t.steps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 flex-1 rounded-full ${i === step ? "bg-[var(--ink)]" : i < step ? "bg-[#7ee5d6]" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] tabular-nums text-slate-400">
            {t.stepOf.replace("{n}", String(step + 1)).replace("{t}", String(t.steps.length))}
          </p>
        </div>
      </div>

      <div className="order-1 lg:order-2">
        {step === 0 && (
          <Desk title={meta.role}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.askBefore}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{t.askTitle}</p>
            <p className="mt-2 text-[13px] text-slate-500">{t.askLede}</p>
            <div className="mt-6 grid gap-2">
              <Primary onClick={() => go(1)}>{t.notYet}</Primary>
              <button type="button" className="an-btn-ghost w-full text-sm" data-demo onClick={() => go(4)}>
                {t.already}
              </button>
            </div>
          </Desk>
        )}

        {step === 1 && (
          <Phone>
            <p className="text-center text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">Kopi Sari · Kemang</p>
            <div className="mx-auto mt-6 flex h-36 w-36 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
              <svg viewBox="0 0 80 80" className="h-28 w-28 text-[var(--ink)]">
                <rect x="4" y="4" width="28" height="28" fill="currentColor" />
                <rect x="48" y="4" width="28" height="28" fill="currentColor" />
                <rect x="4" y="48" width="28" height="28" fill="currentColor" />
                <rect x="40" y="40" width="12" height="12" fill="currentColor" />
                <rect x="56" y="56" width="20" height="20" fill="currentColor" />
                <rect x="12" y="12" width="12" height="12" fill="#faf8fc" />
                <rect x="56" y="12" width="12" height="12" fill="#faf8fc" />
                <rect x="12" y="56" width="12" height="12" fill="#faf8fc" />
              </svg>
            </div>
            <p className="mt-4 text-center text-[15px] font-semibold text-slate-900">{t.scanJoin}</p>
            <p className="mt-1 text-center text-[12px] text-slate-500">{t.scanJoinHint}</p>
            <div className="mt-6">
              <Primary onClick={() => go(2)}>{t.scanCta}</Primary>
            </div>
          </Phone>
        )}

        {step === 2 && (
          <Phone>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">Kopi Sari</p>
            <h4 className="mt-1 text-lg font-semibold text-slate-900">{t.formTitle}</h4>
            <p className="text-[12px] text-slate-500">{t.formLede}</p>
            <div className="mt-3 space-y-2">
              {[
                [t.formName, SAMPLE.name],
                [t.formPhone, SAMPLE.phone],
                [t.formDob, "12 Sep 1996"],
                [t.formEmail, "sari@email.com"],
              ].map(([l, v]) => (
                <label key={l} className="block text-[10px] font-bold uppercase text-slate-400">
                  {l}
                  <input readOnly value={v} className="an-input mt-0.5 w-full py-1.5 text-[13px] font-normal normal-case text-slate-800" />
                </label>
              ))}
              <label className="flex items-start gap-2 text-[12px] font-normal normal-case text-slate-600">
                <input type="checkbox" defaultChecked readOnly />
                {t.formOpt}
              </label>
            </div>
            <div className="mt-3">
              <Primary onClick={() => go(3)}>{t.formJoin}</Primary>
            </div>
          </Phone>
        )}

        {step === 3 && (
          <Phone>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">Kopi Sari</p>
            <h4 className="mt-3 text-xl font-semibold text-slate-900">{t.joinedTitle}</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              {t.joinedHello.replace("{name}", SAMPLE.name).replace("{phone}", SAMPLE.phone)}
            </p>
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800 ring-1 ring-amber-100">
              {t.joinedWarn}
            </p>
            <div className="mt-6">
              <Primary onClick={() => go(4)}>{t.toTill}</Primary>
            </div>
          </Phone>
        )}

        {step === 4 && (
          <Desk title={t.tillKicker}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.tillKicker}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{t.tillTitle}</p>
            <div className="mt-3 space-y-2">
              {[
                [t.tillOutlet, SAMPLE.outlet],
                [t.tillPhone, SAMPLE.phone],
                [t.tillTrx, SAMPLE.trx],
                [t.tillAmount, SAMPLE.amount],
              ].map(([l, v]) => (
                <label key={l} className="block text-[10px] font-bold uppercase text-slate-400">
                  {l}
                  <input readOnly value={v} className="an-input mt-0.5 w-full py-1.5 text-[13px] font-normal normal-case" />
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{t.tillHint}</p>
            <div className="mt-3">
              <Primary onClick={() => go(5)}>{t.tillSend}</Primary>
            </div>
          </Desk>
        )}

        {step === 5 && (
          <Desk title={t.queueKicker}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.queueKicker}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{t.queueTitle}</p>
            <div className="mt-4 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold">{SAMPLE.name}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {SAMPLE.phone} · {SAMPLE.trx} · Rp {SAMPLE.amount}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="an-btn-ghost text-xs" onClick={() => undefined} data-demo>
                    {t.reject}
                  </button>
                  <button type="button" className="an-btn-primary text-xs" onClick={() => go(6)} data-demo>
                    {t.approve}
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-slate-500">{t.queueHint}</p>
          </Desk>
        )}

        {step === 6 && (
          <Phone>
            <p className="text-center text-[11px] font-bold text-emerald-700">{t.waHq}</p>
            <div className="mt-4 space-y-2">
              <div className="ml-8 rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-[12px] text-slate-800">
                {t.waStamp1}
              </div>
              <button
                type="button"
                className="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-left text-[12px] text-slate-800 ring-1 ring-slate-200"
                onClick={() => go(7)}
                data-demo
              >
                Status Stamp
              </button>
              <div className="ml-8 rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-[12px] text-slate-800">
                {t.waCard1}
              </div>
            </div>
            <div className="mt-5">
              <Dots n={1} />
              <p className="mt-2 text-[11px] text-slate-400">{t.sariCardNow}</p>
            </div>
            <div className="mt-4">
              <Primary onClick={() => go(7)}>{t.skip4}</Primary>
            </div>
          </Phone>
        )}

        {step === 7 && (
          <Phone>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.cardLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">5 / 10</p>
            <p className="text-[12px] text-slate-500">{t.cardCan}</p>
            <div className="mt-4">
              <Dots n={5} />
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800 ring-1 ring-emerald-100">
              {t.cardChat}
            </div>
            <div className="mt-5">
              <Primary onClick={() => go(8)}>{t.tillCheck}</Primary>
            </div>
          </Phone>
        )}

        {step === 8 && (
          <Desk title={t.tillCheck}>
            <p className="text-sm font-semibold text-slate-900">
              {SAMPLE.name} · {SAMPLE.phone}
            </p>
            <p className="text-[12px] text-slate-500">{t.checkStatus}</p>
            <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold">Stamp 5/10</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[13px]">
                <span>{t.giftCoffee}</span>
                <button type="button" className="an-btn-primary text-xs" onClick={() => go(9)} data-demo>
                  Redeem
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-slate-400">
                <span>{t.giftTumbler}</span>
                <span className="text-[11px]">{t.giftSoon}</span>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-slate-500">{t.redeemHint}</p>
          </Desk>
        )}

        {step === 9 && (
          <Phone>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t.doneKicker}</p>
            <h4 className="mt-2 text-xl font-semibold text-slate-900">{t.doneTitle}</h4>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{t.doneBody}</p>
            <div className="mt-4">
              <Dots n={5} />
            </div>
            <ul className="mt-4 space-y-1 text-[12px] text-slate-600">
              {t.recap.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-5">
              <Primary onClick={() => go(0)}>{t.again}</Primary>
            </div>
          </Phone>
        )}
      </div>
    </div>
  );
}

function samplers(locale: Locale): TrainingCopy["sampler"] {
  return trainingCopy(locale).sampler;
}

export function JoinSampler({ locale }: { locale: Locale }) {
  const t = samplers(locale);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("Budi");
  const [phone, setPhone] = useState("0813-0000-1111");
  if (done) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80" data-demo>
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t.joinDoneK}</p>
        <h4 className="mt-2 text-lg font-semibold text-slate-900">{t.joinDoneT}</h4>
        <p className="mt-2 text-[13px] text-slate-600">{t.joinDoneB.replace("{name}", name).replace("{phone}", phone)}</p>
        <button type="button" className="an-btn-ghost mt-4 text-sm" onClick={() => setDone(false)}>
          {t.joinAgain}
        </button>
      </div>
    );
  }
  return (
    <form
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"
      data-demo
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.joinKicker}</p>
      <label className="mt-3 block text-[10px] font-bold uppercase text-slate-400">
        {t.joinName}
        <input className="an-input mt-1 w-full py-2 normal-case" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mt-2 block text-[10px] font-bold uppercase text-slate-400">
        {t.joinPhone}
        <input className="an-input mt-1 w-full py-2 normal-case" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="mt-3 flex items-start gap-2 text-[13px] font-normal normal-case text-slate-600">
        <input type="checkbox" defaultChecked />
        {t.joinOpt}
      </label>
      <button type="submit" className="an-btn-primary mt-4 w-full text-sm">
        {t.joinCta}
      </button>
      <p className="mt-2 text-[11px] text-slate-400">{t.joinGhost}</p>
    </form>
  );
}

export function KasirSampler({ locale }: { locale: Locale }) {
  const t = samplers(locale);
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState("0812-3456-7890");
  const [trx, setTrx] = useState("TRX-9901");
  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80" data-demo>
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{t.kasirDoneK}</p>
        <p className="mt-2 text-[14px] text-slate-700">{t.kasirDoneB.replace("{phone}", phone).replace("{trx}", trx)}</p>
        <button type="button" className="an-btn-ghost mt-4 text-sm" onClick={() => setSent(false)}>
          {t.kasirAgain}
        </button>
      </div>
    );
  }
  return (
    <form
      className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80"
      data-demo
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.kasirKicker}</p>
      <label className="mt-3 block text-[10px] font-bold uppercase text-slate-400">
        {t.kasirPhone}
        <input className="an-input mt-1 w-full py-2 normal-case" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="mt-2 block text-[10px] font-bold uppercase text-slate-400">
        {t.kasirTrx}
        <input className="an-input mt-1 w-full py-2 normal-case" value={trx} onChange={(e) => setTrx(e.target.value)} />
      </label>
      <button type="submit" className="an-btn-primary mt-4 w-full text-sm">
        {t.kasirSend}
      </button>
    </form>
  );
}

export function ApproveSampler({ locale }: { locale: Locale }) {
  const t = samplers(locale);
  const [state, setState] = useState<"wait" | "ok" | "no">("wait");
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80" data-demo>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.apprKicker}</p>
      {state === "wait" && (
        <>
          <p className="mt-3 text-sm font-semibold text-slate-900">{t.apprRow}</p>
          <p className="mt-1 text-[12px] text-slate-500">{t.apprAsk}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="an-btn-primary text-sm" onClick={() => setState("ok")}>
              Approve
            </button>
            <button type="button" className="an-btn-ghost text-sm" onClick={() => setState("no")}>
              {trainingCopy(locale).play.reject}
            </button>
          </div>
        </>
      )}
      {state === "ok" && (
        <>
          <p className="mt-3 text-sm font-semibold text-emerald-700">{t.apprOk}</p>
          <p className="mt-1 text-[12px] text-slate-500">{t.apprOkH}</p>
          <button type="button" className="an-btn-ghost mt-4 text-sm" onClick={() => setState("wait")}>
            {t.apprAgain}
          </button>
        </>
      )}
      {state === "no" && (
        <>
          <p className="mt-3 text-sm font-semibold text-rose-700">{t.apprNo}</p>
          <p className="mt-1 text-[12px] text-slate-500">{t.apprNoH}</p>
          <button type="button" className="an-btn-ghost mt-4 text-sm" onClick={() => setState("wait")}>
            {t.apprAgain}
          </button>
        </>
      )}
    </div>
  );
}

export function CardSampler({ locale }: { locale: Locale }) {
  const t = samplers(locale);
  const [mode, setMode] = useState<"ask" | "card">("ask");
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80" data-demo>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#2a9bb8]">{t.cardKicker}</p>
      {mode === "ask" ? (
        <>
          <p className="mt-3 text-[13px] text-slate-600">{t.cardAsk}</p>
          <button
            type="button"
            className="mt-3 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800"
            onClick={() => setMode("card")}
          >
            Status Stamp
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3 py-2 text-[13px] text-slate-800">{t.cardReply}</div>
          <div className="mt-3">
            <Dots n={5} />
          </div>
          <button type="button" className="an-btn-ghost mt-4 text-sm" onClick={() => setMode("ask")}>
            {t.cardRetype}
          </button>
        </>
      )}
    </div>
  );
}
