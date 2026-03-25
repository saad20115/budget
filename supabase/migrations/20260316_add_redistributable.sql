-- Add redistributable column to external_expenses_cache
ALTER TABLE external_expenses_cache
ADD COLUMN IF NOT EXISTS redistributable boolean NOT NULL DEFAULT true;
