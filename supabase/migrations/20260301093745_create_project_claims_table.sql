CREATE TABLE IF NOT EXISTS public.project_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    collection_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.project_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all authenticated users" ON public.project_claims FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert access for all authenticated users" ON public.project_claims FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update access for all authenticated users" ON public.project_claims FOR
UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete access for all authenticated users" ON public.project_claims FOR DELETE TO authenticated USING (true);