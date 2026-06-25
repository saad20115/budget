require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const sql = `
        DROP TABLE IF EXISTS public.external_expenses_cache;
        
        CREATE TABLE public.external_expenses_cache (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            company_id integer NOT NULL,
            company_name text,
            cost_center text NOT NULL,
            account_code text NOT NULL,
            account_name text,
            expenses numeric DEFAULT 0,
            expense_date text NOT NULL, 
            updated_at timestamptz DEFAULT now(),
            UNIQUE(company_id, cost_center, account_code, expense_date)
        );
    `
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Successfully recreated external_expenses_cache table!');
    }
}
run();
