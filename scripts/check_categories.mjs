import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
    'https://mbgkjhlrfhlnzzsrxpjz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZ2tqaGxyZmhsbnp6c3J4cGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDM2NDAsImV4cCI6MjA4NzY3OTY0MH0.HMu63kwlbdXHB4i8W63FiU490Um5HGgnex5rqY7dlj4'
)
const { data, error } = await supabase.from('projects').select('id, name, category, status, total_value').limit(30)
if (error) { console.error(error.message); process.exit(1) }
console.log('Projects:', JSON.stringify(data, null, 2))
const categories = [...new Set(data.map(p => p.category))]
console.log('\nCategories found:', categories)
