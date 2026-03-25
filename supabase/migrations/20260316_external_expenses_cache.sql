-- Table to store external expenses data with future mapping columns
CREATE TABLE IF NOT EXISTS external_expenses_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id integer NOT NULL,
    company_name text NOT NULL,
    cost_center text NOT NULL,
    group_id integer,
    group_name text,
    account_code text NOT NULL,
    account_name text NOT NULL,
    expenses numeric NOT NULL DEFAULT 0,
    month integer,
    
    -- Future mapping columns (to be filled when linking to internal system)
    linked_project_id uuid REFERENCES projects(id),
    linked_expense_category text,
    mapping_notes text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id, cost_center, account_code, month)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_external_expenses_lookup 
    ON external_expenses_cache(company_id, cost_center, account_code, month);

-- Enable RLS
ALTER TABLE external_expenses_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage external expenses"
    ON external_expenses_cache FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
