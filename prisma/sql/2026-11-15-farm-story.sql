-- Phase 3, part 5 (2026-11-15): the farm directory. Each farm's story (Tamil, English) for its Farm For You profile
-- page. Additive only: safe for the running app. Run in the Supabase SQL editor. Safe to run twice.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storyTa" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storyEn" TEXT;
