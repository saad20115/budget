import { createClient } from '@/lib/supabase/server'
import RevenuesClient from './RevenuesClient'
import { redirect } from 'next/navigation'
import { Project, ProjectClaim } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function RevenuesPage() {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    // Fetch projects to allow assigning claims to them
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

    if (projectsError) {
        console.error('Error fetching projects:', projectsError)
    }

    // Let the client fetch the claims as it will need to update them frequently
    // Just pass the initial projects list

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">إدارة الإيرادات والمطالبات</h1>
            <RevenuesClient initialProjects={(projects as Project[]) || []} />
        </div>
    )
}
