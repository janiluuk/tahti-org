-- The YleX logo on Yle's image CDN was removed (404); use the copy tahti-web serves.
UPDATE "core"."InternetRadioPreset"
SET "iconUrl" = 'https://tahti.live/radio-logos/ylex.png'
WHERE "iconUrl" = 'https://images.cdn.yle.fi/f_auto,w_512,h_512,c_fit/v1496664710/yle-areena-app.png';
