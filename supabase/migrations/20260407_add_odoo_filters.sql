-- Add JSONB columns to store mapping and filtering configurations dynamically
ALTER TABLE odoo_connections
ADD COLUMN IF NOT EXISTS mapping_config jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS filter_config jsonb DEFAULT '{}'::jsonb;
