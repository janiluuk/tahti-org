-- Adds 4 Three.js (WebGL) slideshow transition presets alongside the existing CSS ones.
ALTER TYPE "channel"."SlideshowPreset" ADD VALUE IF NOT EXISTS 'PARTICLE_DISSOLVE';
ALTER TYPE "channel"."SlideshowPreset" ADD VALUE IF NOT EXISTS 'GLITCH_WIPE';
ALTER TYPE "channel"."SlideshowPreset" ADD VALUE IF NOT EXISTS 'CUBE_FLIP';
ALTER TYPE "channel"."SlideshowPreset" ADD VALUE IF NOT EXISTS 'LIQUID_DISTORTION';
