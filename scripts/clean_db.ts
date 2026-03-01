import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clean() {
    console.log('Cleaning garbled data...')
    const { error: err1 } = await supabase.from('project_expenses').delete().like('name', '%Ù%')
    if (err1) console.error('Error cleaning project_expenses:', err1)
    else console.log('Cleaned garbled project_expenses')

    const { error: err2 } = await supabase.from('actual_expenses').delete().like('notes', '%Ù%')
    if (err2) console.error('Error cleaning actual_expenses:', err2)
    else console.log('Cleaned garbled actual_expenses')
}
clean()
