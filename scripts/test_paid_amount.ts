import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testProjects() {
    // get projects
    const { data: projects, error: pError } = await supabase.from('projects').select('*').limit(1)

    if (pError) {
        console.error('Error fetching projects:', pError)
        return
    }

    console.log('Projects:', projects)

    if (projects && projects.length > 0) {
        const pId = projects[0].id
        // get claims
        const { data: claims } = await supabase.from('project_claims').select('*').eq('project_id', pId)
        console.log('Claims for project:', claims)

        // try to update paid_amount
        console.log('Attempting to update paid_amount to 999...')
        const { error: uError } = await supabase.from('projects').update({ paid_amount: 999 }).eq('id', pId)
        if (uError) {
            console.error('Update Error:', uError)
        } else {
            console.log('Update successful!')
        }
    }
}

testProjects()
