import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClaimsCalendarClient from './ClaimsCalendarClient'
import { Project } from '@/lib/types'

export default async function ClaimsCalendarPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch projects to pass down, we need them for project names in the calendar
    const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching projects:', error)
    }

    return (
        <div className="p-4 md:p-8 w-full h-[calc(100vh-6rem)] flex flex-col space-y-6">
            <div className="flex-none">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">تقويم المطالبات</h1>
                <p className="text-gray-500 text-sm">عرض مواعيد استحقاق مطالبات المشاريع في جدول تقويمي</p>
            </div>

            <div className="flex-1 min-h-0 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <ClaimsCalendarClient initialProjects={(projects || []) as Project[]} />
            </div>
        </div>
    )
}
