-- AlterTable
ALTER TABLE "Alert" ADD COLUMN "repeatIntervalMinutes" INTEGER,
ADD COLUMN "repeatCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRepeatedAt" TIMESTAMP(3),
ADD COLUMN "repeatEndedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AlertEvent" ADD COLUMN "isReminder" BOOLEAN NOT NULL DEFAULT false;
