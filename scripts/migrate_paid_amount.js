const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function migrate() {
    // Check if column exists
    const { data, error: testErr } = await supabase
        .from('project_claims')
        .select('paid_amount')
        .limit(1)
    
    if (testErr && testErr.message.includes('paid_amount')) {
        console.log('Column does not exist. Please run this SQL in Supabase Dashboard > SQL Editor:')
        console.log('ALTER TABLE public.project_claims ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;')
        console.log("UPDATE public.project_claims SET paid_amount = amount WHERE status = 'Paid';")
        return
    }
    
    console.log('Column paid_amount exists! Updating paid claims...')

    // Set paid_amount for already-paid claims that have paid_amount = 0 or null
    const { data: paidClaims } = await supabase
        .from('project_claims')
        .select('id, amount, paid_amount')
        .eq('status', 'Paid')

    if (paidClaims) {
        let updated = 0
        for (const claim of paidClaims) {
            if (!claim.paid_amount || Number(claim.paid_amount) === 0) {
                await supabase
                    .from('project_claims')
                    .update({ paid_amount: claim.amount })
                    .eq('id', claim.id)
                updated++
            }
        }
        console.log(`Updated ${updated}/${paidClaims.length} paid claims`)
    }
    console.log('Done!')
}

migrate().catch(console.error)
