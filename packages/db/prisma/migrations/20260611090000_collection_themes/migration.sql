-- M26: per-collection backdrop themes (gallery + text layer)

CREATE TYPE "media"."CollectionGalleryMode" AS ENUM (
  'NONE',
  'STATIC_SLIDESHOW',
  'TWISTED_WAVE_GLSL',
  'ZOOM_BLUR_GLSL',
  'RGB_SHIFT_GLSL',
  'POSTER_WALL_GLSL',
  'SHATTER_CAROUSEL_GLSL'
);

CREATE TYPE "media"."CollectionTextLayerMode" AS ENUM (
  'NONE',
  'GRADIENT_SHIMMER',
  'COSMIC_NEON',
  'LAYERED_WAVE_3D',
  'SHIMMER_LINES',
  'GHOST_ECHO'
);

CREATE TYPE "media"."CollectionTextLayerAlign" AS ENUM (
  'LEFT',
  'CENTER',
  'RIGHT'
);

ALTER TABLE "media"."Collection"
  ADD COLUMN "galleryMode" "media"."CollectionGalleryMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "slideshowImages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "videoBackgroundUrl" TEXT,
  ADD COLUMN "textLayerMode" "media"."CollectionTextLayerMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "textLayerText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "textLayerAlign" "media"."CollectionTextLayerAlign" NOT NULL DEFAULT 'CENTER';
