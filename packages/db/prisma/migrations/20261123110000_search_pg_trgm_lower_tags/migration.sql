-- Search matches with ILIKE '%q%' (Prisma `contains` + `mode: 'insensitive'`),
-- which only a pg_trgm GIN index can serve. pg_trgm is a trusted extension, so
-- the database owner can create it; schema.prisma declares it (postgresqlExtensions).
--
-- lower_tags backs the case-insensitive tag search index. Prisma cannot manage
-- functions, so `prisma db push` test databases get it from
-- prisma/raw-sql/lower-tags.sql (db:migrate:test); keep the two identical
-- (src/migrations-schema.test.ts checks).
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";

CREATE OR REPLACE FUNCTION "channel"."lower_tags"(text[]) RETURNS text[]
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT ARRAY(SELECT lower(t) FROM unnest($1) AS t) $$;
