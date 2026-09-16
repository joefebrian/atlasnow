"use client";

import { useEffect, useRef, useState } from "react";
import { decodeQrFromFile, decodeQrFromVideo, openRearCamera } from "@/lib/loyalty/decode-qr-browser";

export function StampQrScan({
  busy,
  onDecoded,
}: {
  busy: boolean;
  onDecoded: (raw: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const foundRef = useRef(false);
  const onDecodedRef = useRef(onDecoded);
  onDecodedRef.current = onDecoded;
  const [live, setLive] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  function stop() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setLive(false);
    setScanning(false);
  }

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (!live) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    void video.play().catch(() => {
      setHint("Kamera tidak mau nyala. Izinkan kamera di Chrome, atau pilih foto QR.");
    });
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const raw = await decodeQrFromVideo(video);
        if (cancelled || foundRef.current) return;
        if (raw) {
          foundRef.current = true;
          stop();
          onDecodedRef.current(raw);
          return;
        }
      } catch {
        /* keep looking */
      }
      if (!cancelled) window.setTimeout(() => void tick(), 160);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [live]);

  async function startLive() {
    if (live || streamRef.current) return;
    setHint(null);
    foundRef.current = false;
    try {
      const stream = await openRearCamera();
      streamRef.current = stream;
      setLive(true);
    } catch {
      setHint("Kamera ditolak atau tidak ada. Izinkan kamera, atau pilih foto QR.");
    }
  }

  async function onFile(file: File) {
    setHint(null);
    setScanning(true);
    try {
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        setHint("QR tidak kebaca dari foto. Pakai kamera hidup, atau ketik HP.");
        return;
      }
      onDecodedRef.current(raw);
    } catch {
      setHint("Gagal baca foto QR. Ketik HP saja.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="space-y-3">
      {live ? (
        <>
          <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-black/10">
            <video ref={videoRef} className="mx-auto max-h-[min(62vh,520px)] w-full object-cover" autoPlay playsInline muted />
            <p className="px-3 py-2 text-center text-[12px] text-white/80">Arahkan ke QR di HP pelanggan. Bukan stiker daftar di meja.</p>
          </div>
          <button type="button" className="an-btn-ghost w-full text-sm" onClick={stop}>
            Tutup kamera
          </button>
        </>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="an-btn-primary py-3 text-sm" disabled={busy || scanning} onClick={() => void startLive()}>
            Buka kamera
          </button>
          <label className={`an-btn-ghost cursor-pointer py-3 text-center text-sm ${busy || scanning ? "pointer-events-none opacity-50" : ""}`}>
            Dari foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy || scanning}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
          </label>
        </div>
      )}
      {hint ? <p className="text-[12px] text-amber-800">{hint}</p> : null}
    </div>
  );
}
