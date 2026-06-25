require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const { data: cache, error: err1 } = await supabase.from('external_expenses_cache').select('count', { count: 'exact' });
    console.log('Cache Error:', err1);
    console.log('Cache Count:', cache);
    
    const { data: conn, error: err2 } = await supabase.from('odoo_connections').select('last_sync_status, last_sync_message');
    console.log('Conn Error:', err2);
    console.log('Connections Status:', conn);
}
run();
