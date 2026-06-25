require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const { data: test, error } = await supabase.from('external_expenses_cache').insert({
        company_id: 1,
        company_name: 'Test',
        cost_center: 'Test',
        account_code: '123',
        account_name: 'Test',
        expenses: 10,
        expense_date: '2026-05-15'
    });
    console.log('Insert Error Analysis:', JSON.stringify(error, null, 2));
}

run();
