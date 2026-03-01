import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking connection to Supabase:', supabaseUrl);

    // Quick test against projects
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .limit(1);

    console.log('Projects check:', projectsError ? projectsError.message : 'OK (Found data or empty)');

    // Test the project_claims table
    const { data, error } = await supabase
        .from('project_claims')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching project_claims:', error);
    } else {
        console.log('Successfully queried project_claims! Data:', data);
    }
}

checkTable();
