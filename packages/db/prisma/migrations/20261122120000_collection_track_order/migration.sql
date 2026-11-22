-- Board reorders of an album's tracks are audited.
ALTER TYPE "governance"."AuditAction" ADD VALUE IF NOT EXISTS 'COLLECTION_ADMIN_REORDER';

-- Removing tracks used to leave gaps in a collection's numbering. Renumber
-- every collection 1..n in its current order. Two passes through negative
-- numbers because @@unique([collectionId, position]) is checked row by row.
UPDATE "media"."CollectionItem" AS ci
SET "position" = -ranked.rn
FROM (
  SELECT "id",
         row_number() OVER (PARTITION BY "collectionId" ORDER BY "position", "createdAt", "id") AS rn
  FROM "media"."CollectionItem"
) AS ranked
WHERE ci."id" = ranked."id";

UPDATE "media"."CollectionItem" SET "position" = -"position" WHERE "position" < 0;
