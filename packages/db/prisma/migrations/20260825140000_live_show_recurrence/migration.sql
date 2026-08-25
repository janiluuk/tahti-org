-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Recurring auto-scheduling for live show series: weekly cadence generation
-- (day-of-week + time-of-day + timezone), rolled forward by a worker job.
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceTimeOfDay" TEXT;
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceDurationMin" INTEGER;
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceTimezone" TEXT;
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN "recurrenceHorizonDays" INTEGER NOT NULL DEFAULT 28;
