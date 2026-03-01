import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditProjectClient from './EditProjectClient'

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

    if (!project) notFound()

    return <EditProjectClient project={project} />
}
