-- Why a sound's processing failed, in plain words for its owner.
ALTER TABLE "channel"."Sound" ADD COLUMN     "processingError" TEXT;
