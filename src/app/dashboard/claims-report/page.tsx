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
        if (claim.status === 'Paid') return claim
        
        const dueParts = claim.due_date.split('-');
        const todayParts = today.split('-');
        const d1 = new Date(Date.UTC(Number(dueParts[0]), Number(dueParts[1])-1, Number(dueParts[2])));
        const d2 = new Date(Date.UTC(Number(todayParts[0]), Number(todayParts[1])-1, Number(todayParts[2])));
        const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
        
        let newStatus = claim.status;
        if (diffDays >= 0 && diffDays <= 5) {
            newStatus = 'Due';
        } else if (diffDays > 5) {
            newStatus = 'Overdue';
        } else if (diffDays < 0 && (claim.status === 'Overdue' || claim.status === 'Due')) {
            newStatus = (claim.paid_amount || 0) > 0 ? 'PartiallyPaid' : 'Pending';
        }

        if (newStatus !== claim.status) {
            return { ...claim, status: newStatus as any }
        }
        
        return claim
    })

    return (
        <ClaimsReportClient projects={projects} claims={claims} />
    )
}
