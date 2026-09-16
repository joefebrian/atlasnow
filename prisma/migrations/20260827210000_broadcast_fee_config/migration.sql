-- AtlasNow PAYG fees for WhatsApp broadcast (editable in Settings).
CREATE TABLE "BroadcastFeeConfig" (
    "id" TEXT NOT NULL,
    "sessionIdr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketingIdr" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "utilityIdr" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "authenticationIdr" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "marginPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastFeeConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BroadcastFeeConfig" ("id", "sessionIdr", "marketingIdr", "utilityIdr", "authenticationIdr", "marginPct", "updatedAt")
VALUES ('default', 0, 150, 90, 90, 0, CURRENT_TIMESTAMP);
