import { createClient } from '@/lib/supabase/server'
import SalaryDistributionClient from './SalaryDistributionClient'
import { Project } from '@/lib/types'

export const metadata = {
    title: 'توزيع موازنة الرواتب | نظام الموازنات',
    description: 'توزيع موازنة الرواتب على المجلس التنسيقي ومشاريع الحج',
}

export default async function SalaryDistributionPage() {
    const supabase = await createClient()
    const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .order('total_value', { ascending: false })

    const list: Project[] = projects ?? []

    return <SalaryDistributionClient projects={list} />
}
