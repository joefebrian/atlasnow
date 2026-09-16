type BarcodeHit = { rawValue?: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<BarcodeHit[]> };

type JsQr = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
) => { data: string } | null;

let jsQrMod: JsQr | null = null;
let canvas: HTMLCanvasElement | null = null;
let detector: BarcodeDetectorLike | null | undefined;

async function loadJsQr(): Promise<JsQr> {
  if (!jsQrMod) jsQrMod = (await import("jsqr")).default;
  return jsQrMod;
}

function getCanvas(): HTMLCanvasElement {
  if (!canvas) canvas = document.createElement("canvas");
  return canvas;
}

function barcodeDetector(): BarcodeDetectorLike | null {
  if (detector !== undefined) return detector;
  const Ctor = (globalThis as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (!Ctor) {
    detector = null;
    return null;
  }
  try {
    detector = new Ctor({ formats: ["qr_code"] });
    return detector;
  } catch {
    detector = null;
    return null;
  }
}

function drawScaled(source: CanvasImageSource, sw: number, sh: number, max: number): ImageData | null {
  const scale = Math.min(1, max / Math.max(sw, sh, 1));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const el = getCanvas();
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

async function decodeImageData(image: ImageData): Promise<string | null> {
  const jsQR = await loadJsQr();
  return jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data || null;
}

export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("no-camera");
  }
  const tries: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const c of tries) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("no-camera");
}

export async function decodeQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const det = barcodeDetector();
  if (det) {
    try {
      const hits = await det.detect(video);
      const raw = hits[0]?.rawValue?.trim();
      if (raw) return raw;
    } catch {
      /* Chrome Android has no BarcodeDetector — jsQR next */
    }
  }
  const frame = drawScaled(video, video.videoWidth, video.videoHeight, 640);
  if (!frame) return null;
  return decodeImageData(frame);
}

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bmp = await bitmapFromFile(file);
  try {
    const det = barcodeDetector();
    if (det) {
      try {
        const hits = await det.detect(bmp);
        const raw = hits[0]?.rawValue?.trim();
        if (raw) return raw;
      } catch {
        /* fall through */
      }
    }
    for (const max of [800, 1400, 480]) {
      const frame = drawScaled(bmp, bmp.width, bmp.height, max);
      if (!frame) continue;
      const raw = await decodeImageData(frame);
      if (raw) return raw;
    }
    return null;
  } finally {
    bmp.close();
  }
}

async function bitmapFromFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = document.createElement("img");
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
