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

    const [{ data: projectsData }, { data: claimsData }] = await Promise.all([
        supabase
            .from('projects')
            .select('*')
            .order('total_value', { ascending: false }),
        supabase
            .from('project_claims')
            .select('*')
            .order('due_date', { ascending: true }),
    ])

    const projects: Project[] = projectsData ?? []
    
    const today = new Date().toISOString().split('T')[0]
    const claims: ProjectClaim[] = (claimsData ?? []).map(claim => {
        if (!['Paid', 'PartiallyPaid', 'Overdue'].includes(claim.status) && claim.due_date < today) {
            return { ...claim, status: 'Overdue' as const }
        }
        if (claim.status === 'Overdue' && claim.due_date >= today) {
            return { ...claim, status: 'Pending' as const }
        }
        return claim
    })

    return (
        <ClaimsReportClient projects={projects} claims={claims} />
    )
}
