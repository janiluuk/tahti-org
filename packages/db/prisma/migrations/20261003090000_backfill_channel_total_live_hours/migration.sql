-- Channel.totalLiveHours was never written before ended broadcasts started adding to it,
-- so recompute it from the public live time (wentLiveAt -> endedAt) of every ended session.
UPDATE "channel"."Channel" AS c
SET "totalLiveHours" = s.hours
FROM (
  SELECT
    "channelId",
    SUM(GREATEST(EXTRACT(EPOCH FROM ("endedAt" - "wentLiveAt")), 0)) / 3600.0 AS hours
  FROM "channel"."Broadcast"
  WHERE "wentLiveAt" IS NOT NULL AND "endedAt" IS NOT NULL
  GROUP BY "channelId"
) AS s
WHERE c."id" = s."channelId";
