import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Project, ProjectClaim } from '@/lib/types'
import ClaimsReportClient from './ClaimsReportClient'

export const metadata = { title: 'تقرير المطالبات | نظام الموازنات' }
export const dynamic = 'force-dynamic'

export default async function ClaimsReportPage() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) redirect('/login')

    const [
        { data: projectsData }, 
        { data: claimsData },
        { data: categoriesData },
        { data: divisionsData }
    ] = await Promise.all([
        supabase.from('projects').select('*').order('total_value', { ascending: false }),
        supabase.from('project_claims').select('*').order('due_date', { ascending: true }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('divisions').select('*').order('name')
    ])

    const projects: Project[] = projectsData ?? []
    const claims: ProjectClaim[] = claimsData ?? []
    const dbCategories = (categoriesData ?? []).map(c => c.name)
    const dbDivisions = (divisionsData ?? []).map(d => d.name)

    return (
        <ClaimsReportClient 
            projects={projects} 
            claims={claims} 
            dbCategories={dbCategories}
            dbDivisions={dbDivisions}
        />
    )
}
