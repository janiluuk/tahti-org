-- Radio Nova and NRJ: browsers reject Bauer's stream-redirect host as a media
-- source; the streaming.radioplay.fi URL it redirects to plays and allows CORS.
UPDATE "core"."InternetRadioPreset"
SET "streamUrl" = replace("streamUrl", 'https://stream-redirect.bauermedia.fi/', 'https://streaming.radioplay.fi/')
WHERE "streamUrl" LIKE 'https://stream-redirect.bauermedia.fi/%';

UPDATE "core"."InternetRadioStation"
SET "streamUrl" = replace("streamUrl", 'https://stream-redirect.bauermedia.fi/', 'https://streaming.radioplay.fi/')
WHERE "streamUrl" LIKE 'https://stream-redirect.bauermedia.fi/%';
