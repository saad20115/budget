-- Table to store Odoo API connections for auto-sync
CREATE TABLE IF NOT EXISTS odoo_connections (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    label text NOT NULL DEFAULT '',
    url text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    sync_interval_hours integer NOT NULL DEFAULT 4,
    last_sync_at timestamptz,
    last_sync_status text,       -- 'success' | 'error'
    last_sync_message text,
    last_sync_records integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE odoo_connections ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage odoo connections"
    ON odoo_connections FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow anon role full access (for server-side API routes without service role key)
CREATE POLICY "Anon can manage odoo connections"
    ON odoo_connections FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
