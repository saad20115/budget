-- Add paid_amount column to project_claims for partial payments
ALTER TABLE public.project_claims ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Set paid_amount = amount for already-paid claims
UPDATE public.project_claims SET paid_amount = amount WHERE status = 'Paid' AND (paid_amount IS NULL OR paid_amount = 0);
