-- Mapping table: links external accounts to internal budget expense names and projects
CREATE TABLE IF NOT EXISTS expense_mapping (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    external_cost_center text NOT NULL,
    external_account_code text NOT NULL,
    internal_expense_name text NOT NULL,
    linked_project_id uuid REFERENCES projects(id),
    notes text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(external_cost_center, external_account_code)
);

ALTER TABLE expense_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage expense_mapping"
    ON expense_mapping FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
