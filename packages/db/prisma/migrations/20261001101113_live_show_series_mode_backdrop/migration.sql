-- CreateEnum
CREATE TYPE "channel"."LiveShowMode" AS ENUM ('SINGLE', 'SERIES');

-- AlterTable
ALTER TABLE "channel"."LiveShowSeries" ADD COLUMN     "backdropUrl" TEXT,
ADD COLUMN     "mode" "channel"."LiveShowMode" NOT NULL DEFAULT 'SERIES';

