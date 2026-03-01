import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { computeProjectAnalytics, formatCurrency, formatPercent } from '@/lib/analytics'
import ProjectDetailClient from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const [{ data: project }, { data: staffing }, { data: expenses }, { data: actual }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_staffing').select('*').eq('project_id', id),
        supabase.from('project_expenses').select('*').eq('project_id', id),
        supabase.from('actual_expenses').select('*').eq('project_id', id),
    ])

    if (!project) notFound()

    const analytics = computeProjectAnalytics(
        project,
        staffing ?? [],
        expenses ?? [],
        actual ?? []
    )

    return <ProjectDetailClient analytics={analytics} />
}
