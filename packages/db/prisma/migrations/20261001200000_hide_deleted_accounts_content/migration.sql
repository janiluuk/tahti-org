-- Deleting an account anonymized the user but left their tracks and
-- collections public, so they kept streaming under "Deleted user" on track
-- pages, top lists, collections and embeds. Account deletion now makes them
-- private; this applies the same to accounts deleted before that change.
UPDATE "channel"."Sound" AS s
SET "isPublic" = false
FROM "channel"."Channel" AS c
JOIN "core"."User" AS u ON u."id" = c."userId"
WHERE s."channelId" = c."id"
  AND u."deletedAt" IS NOT NULL
  AND s."isPublic" = true;

UPDATE "media"."Collection" AS col
SET "isPublic" = false, "visibility" = 'DRAFT'
FROM "core"."User" AS u
WHERE col."userId" = u."id"
  AND u."deletedAt" IS NOT NULL
  AND (col."isPublic" = true OR col."visibility" <> 'DRAFT');
