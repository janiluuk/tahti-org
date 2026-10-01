-- Display names are public; an email address in one leaks it on every
-- surface (artist pages, chat, notifications, link previews, RSS). Signup
-- and profile edits have rejected them since #560, but rows stored before
-- that still carry one. Same rule as safeDisplayName in @tahti/shared:
-- fall back to the username.
UPDATE "core"."User"
SET "displayName" = "username"
WHERE "displayName" ~* '[^[:space:]@<>()\[\],;:"]+@[^[:space:]@<>()\[\],;:"]+\.[a-z]{2,}';
