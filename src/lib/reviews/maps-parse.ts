/**
 * Parse public Google Maps review payloads (listugcposts + Places Details).
 * Index paths follow the live Maps RPC shape used by open-source fetchers (2025–26).
 */

export const REVIEW_WINDOWS = [
  { days: 30 as const, label: "1 month" },
  { days: 60 as const, label: "2 months" },
  { days: 90 as const, label: "3 months" },
];

export type ReviewWindowDays = 30 | 60 | 90;

/** First month, then 2-month slices further back if that slice is empty. */
export const MAPS_LOOKBACK_STEP_COUNT = 6;
export const MAPS_LOOKBACK_FIRST_DAYS = 30;
export const MAPS_LOOKBACK_NEXT_DAYS = 60;

export type LookbackStep = {
  startDays: number;
  endDays: number;
};

export function mapsLookbackSteps(
  maxSteps = MAPS_LOOKBACK_STEP_COUNT
): LookbackStep[] {
  const steps: LookbackStep[] = [
    { startDays: 0, endDays: MAPS_LOOKBACK_FIRST_DAYS },
  ];
  let start = MAPS_LOOKBACK_FIRST_DAYS;
  for (let i = 1; i < maxSteps; i++) {
    steps.push({ startDays: start, endDays: start + MAPS_LOOKBACK_NEXT_DAYS });
    start += MAPS_LOOKBACK_NEXT_DAYS;
  }
  return steps;
}

export function lookbackStepLabel(step: LookbackStep, index: number): string {
  if (index === 0) return "last 1 month";
  const from = Math.round(step.startDays / 30);
  const to = Math.round(step.endDays / 30);
  return `the 2 months before that (${from}–${to} months ago)`;
}

export function reviewAgeDays(date: Date | null, nowMs: number): number | null {
  if (!date) return null;
  return (nowMs - date.getTime()) / 86_400_000;
}

export function reviewsInLookbackStep(
  reviews: MapsReview[],
  step: LookbackStep,
  nowMs: number
): MapsReview[] {
  return reviews.filter((r) => {
    const age = reviewAgeDays(r.createTime, nowMs);
    if (age == null) return step.startDays === 0;
    return age >= step.startDays && age < step.endDays;
  });
}

export type LookbackDecision = {
  reviews: MapsReview[];
  step: LookbackStep | null;
  stepIndex: number;
  label: string;
  donePaging: boolean;
};

/**
 * Newest-first waterfall: keep last 1 month if any exist.
 * If that month is empty, take the 2 months before it; repeat.
 */
export function lookbackDecision(
  reviews: MapsReview[],
  nowMs = Date.now(),
  opts?: { noMorePages?: boolean }
): LookbackDecision {
  const steps = mapsLookbackSteps();
  const noMore = Boolean(opts?.noMorePages);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const inStep = reviewsInLookbackStep(reviews, step, nowMs);
    const passedEnd = reviews.some((r) => {
      const age = reviewAgeDays(r.createTime, nowMs);
      return age != null && age >= step.endDays;
    });

    if (inStep.length > 0) {
      return {
        reviews: inStep,
        step,
        stepIndex: i,
        label: lookbackStepLabel(step, i),
        donePaging: passedEnd || noMore,
      };
    }

    if (!passedEnd && !noMore) {
      return {
        reviews: [],
        step,
        stepIndex: i,
        label: lookbackStepLabel(step, i),
        donePaging: false,
      };
    }
  }

  return {
    reviews: [],
    step: null,
    stepIndex: -1,
    label: "no reviews in lookback",
    donePaging: true,
  };
}

export type MapsReview = {
  externalId: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  createTime: Date | null;
  updateTime: Date | null;
  replyComment: string | null;
  replyUpdateTime: Date | null;
  relativeTime: string | null;
  raw: unknown;
};

export function clampWindowDays(n?: number | null): ReviewWindowDays {
  if (n === 30 || n === 60 || n === 90) return n;
  return 90;
}

export function mapsReviewExternalId(opts: {
  reviewId?: string | null;
  placeKey?: string | null;
  author?: string | null;
  timeSec?: number | null;
  text?: string | null;
}): string {
  const id = opts.reviewId?.trim();
  if (id) return `maps:${id}`;
  const basis = [
    opts.placeKey || "",
    opts.author || "",
    opts.timeSec != null ? String(opts.timeSec) : "",
    (opts.text || "").slice(0, 80),
  ].join("|");
  let h = 0;
  for (let i = 0; i < basis.length; i++) {
    h = (h * 31 + basis.charCodeAt(i)) >>> 0;
  }
  return `maps:h:${h.toString(16).padStart(8, "0")}`;
}

export function stripXssiPrefix(text: string): string {
  return text.replace(/^\)]\}'\n?/, "").trim();
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

export function getNth(root: unknown, ...indexes: number[]): unknown {
  let cur: unknown = root;
  for (const i of indexes) {
    const arr = asArray(cur);
    if (!arr || i < 0 || i >= arr.length) return undefined;
    cur = arr[i];
  }
  return cur;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asString(v);
    if (s) return s;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = asNumber(v);
    if (n != null && n !== 0) return n;
  }
  return null;
}

/** Unix seconds, millis, or micros → Date, if it looks like a real review time. */
export function dateFromUnixish(n: number | null | undefined): Date | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  let ms = n;
  if (n > 1e16) ms = n / 1000; // nanos
  else if (n > 1e14) ms = n / 1000; // micros
  else if (n > 1e12) ms = n; // already ms
  else if (n > 1e9) ms = n * 1000; // seconds
  else return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() < 2007) return null;
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return d;
}

/**
 * "2 weeks ago", "a month ago", "3 bulan lalu", "seminggu lalu"
 */
export function parseRelativeReviewTime(
  text: string | null | undefined,
  nowMs = Date.now()
): Date | null {
  if (!text?.trim()) return null;
  const s = text
    .toLowerCase()
    .replace(/^edited\s+/i, "")
    .replace(/^diedit\s+/i, "")
    .trim();

  const unitMs: Record<string, number> = {
    second: 1000,
    seconds: 1000,
    detik: 1000,
    minute: 60_000,
    minutes: 60_000,
    menit: 60_000,
    hour: 3_600_000,
    hours: 3_600_000,
    jam: 3_600_000,
    day: 86_400_000,
    days: 86_400_000,
    hari: 86_400_000,
    week: 7 * 86_400_000,
    weeks: 7 * 86_400_000,
    minggu: 7 * 86_400_000,
    month: 30 * 86_400_000,
    months: 30 * 86_400_000,
    bulan: 30 * 86_400_000,
    year: 365 * 86_400_000,
    years: 365 * 86_400_000,
    tahun: 365 * 86_400_000,
  };

  const qty = (raw: string) => {
    if (!raw || /^(a|an|sebuah)$/i.test(raw)) return 1;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  let m = s.match(
    /(\d+|a|an)\s+(seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago/
  );
  if (m) {
    return new Date(nowMs - qty(m[1]) * unitMs[m[2]]);
  }

  m = s.match(
    /(\d+)\s+(detik|menit|jam|hari|minggu|bulan|tahun)\s+(yang\s+)?lalu/
  );
  if (m) {
    return new Date(nowMs - qty(m[1]) * unitMs[m[2]]);
  }

  m = s.match(
    /^(sehari|seminggu|sebulan|setahun|baru saja|just now|yesterday|kemarin)\b/
  );
  if (m) {
    const map: Record<string, number> = {
      "baru saja": 60_000,
      "just now": 60_000,
      yesterday: 86_400_000,
      kemarin: 86_400_000,
      sehari: 86_400_000,
      seminggu: 7 * 86_400_000,
      sebulan: 30 * 86_400_000,
      setahun: 365 * 86_400_000,
    };
    return new Date(nowMs - (map[m[1]] || 0));
  }

  return null;
}

export function withinWindow(
  date: Date | null,
  windowDays: ReviewWindowDays,
  nowMs = Date.now()
): boolean {
  if (!date) return true;
  const cutoff = nowMs - windowDays * 86_400_000;
  return date.getTime() >= cutoff;
}

function reviewFromRpcElement(el: unknown[], placeKey?: string | null): MapsReview | null {
  const reviewId = firstString(getNth(el, 0));
  const posted = firstNumber(getNth(el, 1, 2), getNth(el, 1, 3));
  const relative = firstString(getNth(el, 1, 6), getNth(el, 3, 3));
  const name = firstString(
    getNth(el, 1, 4, 5, 0),
    getNth(el, 1, 4, 4),
    getNth(el, 0, 1)
  );
  const ratingRaw = firstNumber(getNth(el, 2, 0, 0), getNth(el, 2, 0), getNth(el, 1, 0, 0));
  const rating = ratingRaw != null ? Math.round(ratingRaw) : 0;
  const comment = firstString(
    getNth(el, 2, 15, 0, 0),
    getNth(el, 2, 15, 0),
    getNth(el, 3, 0)
  );
  const reply = firstString(getNth(el, 3, 14, 1, 0), getNth(el, 3, 14, 0, 0));
  const replyPosted = firstNumber(getNth(el, 3, 1), getNth(el, 3, 2));

  if (!name && rating < 1 && !comment) return null;
  if (rating < 0 || rating > 5) return null;

  const createTime =
    dateFromUnixish(posted) || parseRelativeReviewTime(relative);

  return {
    externalId: mapsReviewExternalId({
      reviewId,
      placeKey,
      author: name,
      timeSec: createTime ? Math.floor(createTime.getTime() / 1000) : null,
      text: comment,
    }),
    reviewerName: name || "Anonymous",
    starRating: rating >= 1 && rating <= 5 ? rating : 0,
    comment,
    createTime,
    updateTime: dateFromUnixish(firstNumber(getNth(el, 1, 3))) || createTime,
    replyComment: reply,
    replyUpdateTime: dateFromUnixish(replyPosted),
    relativeTime: relative,
    raw: el,
  };
}

export function parseListUgcPosts(text: string, placeKey?: string | null): {
  reviews: MapsReview[];
  nextPageToken: string | null;
} {
  const stripped = stripXssiPrefix(text);
  if (!stripped || stripped.startsWith("<")) {
    return { reviews: [], nextPageToken: null };
  }

  let jd: unknown;
  try {
    jd = JSON.parse(stripped);
  } catch {
    return { reviews: [], nextPageToken: null };
  }

  const token = asString(getNth(jd, 1));
  let rows = asArray(getNth(jd, 2));
  if (!rows) rows = asArray(getNth(jd, 0));
  if (!rows) return { reviews: [], nextPageToken: token };

  const reviews: MapsReview[] = [];
  for (const row of rows) {
    const wrapped = asArray(row);
    const el = (wrapped && asArray(wrapped[0])) || wrapped;
    if (!el) continue;
    const parsed = reviewFromRpcElement(el, placeKey);
    if (parsed) reviews.push(parsed);
  }

  return { reviews, nextPageToken: token };
}

export function parsePlacesReviews(
  result: {
    place_id?: string;
    reviews?: Array<{
      author_name?: string;
      rating?: number;
      text?: string;
      time?: number;
      relative_time_description?: string;
    }>;
  } | null
): MapsReview[] {
  if (!result?.reviews?.length) return [];
  const placeKey = result.place_id || null;
  return result.reviews
    .map((r) => {
      const createTime =
        dateFromUnixish(r.time ?? null) ||
        parseRelativeReviewTime(r.relative_time_description);
      const rating = Math.round(Number(r.rating) || 0);
      return {
        externalId: mapsReviewExternalId({
          placeKey,
          author: r.author_name || null,
          timeSec: r.time ?? (createTime ? Math.floor(createTime.getTime() / 1000) : null),
          text: r.text || null,
        }),
        reviewerName: r.author_name || "Anonymous",
        starRating: rating >= 1 && rating <= 5 ? rating : 0,
        comment: r.text?.trim() || null,
        createTime,
        updateTime: createTime,
        replyComment: null,
        replyUpdateTime: null,
        relativeTime: r.relative_time_description || null,
        raw: r,
      } satisfies MapsReview;
    })
    .filter((r) => r.starRating > 0 || r.comment);
}

export function filterReviewsByWindow(
  reviews: MapsReview[],
  windowDays: ReviewWindowDays,
  nowMs = Date.now()
): { kept: MapsReview[]; droppedOlder: number } {
  const kept: MapsReview[] = [];
  let droppedOlder = 0;
  for (const r of reviews) {
    if (withinWindow(r.createTime, windowDays, nowMs)) kept.push(r);
    else droppedOlder += 1;
  }
  return { kept, droppedOlder };
}

/** True when a page of newest-first reviews has crossed the window. */
export function pageIsOlderThanWindow(
  reviews: MapsReview[],
  windowDays: ReviewWindowDays,
  nowMs = Date.now()
): boolean {
  if (!reviews.length) return false;
  return reviews.every((r) => r.createTime && !withinWindow(r.createTime, windowDays, nowMs));
}

export function buildListUgcPostsUrl(opts: {
  featureId: string;
  pageToken?: string;
  pageSize?: number;
  requestId: string;
  hl?: string;
  gl?: string;
}): string {
  const pageSize = opts.pageSize ?? 20;
  const token = opts.pageToken || "";
  const encodedId = encodeURIComponent(opts.featureId);
  const encodedToken = encodeURIComponent(token);
  // Dec 2025 pb layout. !13m1!1e2 = newest first.
  const pb = [
    `!1m6!1s${encodedId}`,
    `!6m4!4m1!1e1!4m1!1e3`,
    `!2m2!1i${pageSize}!2s${encodedToken}`,
    `!5m2!1s${opts.requestId}!7e81`,
    `!8m9!2b1!3b1!5b1!7b1`,
    `!12m4!1b1!2b1!4m1!1e1!11m0!13m1!1e2`,
  ].join("");
  const hl = opts.hl || "en";
  const gl = opts.gl || "id";
  return `https://www.google.com/maps/rpc/listugcposts?authuser=0&hl=${hl}&gl=${gl}&pb=${pb}`;
}
