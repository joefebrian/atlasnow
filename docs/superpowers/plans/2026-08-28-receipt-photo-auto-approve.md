# Receipt photo auto-Approve — implementation plan

> Inline execution in this session. Door 1 (kasir) only. Guest upload + POS are later PRs.

**Goal:** Kasir wajib foto struk. Atlas baca nomor+Rp. MATCH → stamp otomatis. Buram/beda → antrian HQ. Setting merek “Kantor cek semua”.

**Architecture:** Photo JPEG on `LoyaltyIntake` (compressed). Tesseract on the VPS (fail → UNREADABLE, never guess). Pure `matchReceiptPhoto()` decides MATCH/MISMATCH/UNREADABLE. `reviewIntake` reused for auto with actor `system:ocr-match`.

**Tech:** Prisma, sharp, tesseract-ocr (Docker), existing loyalty service.

**Out of this build:** Guest PWA/WA upload, POS API.

## Tasks

1. Schema: `photoImage`, `photoMime`, `ocrJson`, `matchStatus` on intake; `receiptAuditMode` on program.
2. `receipt-ocr.ts` + tests (normalize trx, IDR parse, match rules).
3. Compress + tesseract spawn (UNREADABLE if binary missing).
4. `submitIntake` requires photo+amount; auto-approve on MATCH unless audit.
5. Multipart POST `/api/loyalty/intakes`; GET photo; list omits bytes.
6. Desk: camera, required Rp, queue photo + badge; hide Approve for BRANCH.
7. Settings stamp: “Kantor cek semua”.
8. Dockerfile tesseract; migrate; deploy.
