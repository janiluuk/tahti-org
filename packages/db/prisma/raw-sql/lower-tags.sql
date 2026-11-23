CREATE OR REPLACE FUNCTION "channel"."lower_tags"(text[]) RETURNS text[]
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT ARRAY(SELECT lower(t) FROM unnest($1) AS t) $$;
