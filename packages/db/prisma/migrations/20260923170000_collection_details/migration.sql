-- Collection editor details that were sent but had nowhere to be stored:
-- release date, genres (max 5, enforced by the API) and backdrop image.
ALTER TABLE "media"."Collection" ADD COLUMN     "releaseDate" DATE,
ADD COLUMN     "genres" TEXT[],
ADD COLUMN     "backdropUrl" TEXT;
