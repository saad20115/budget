import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    return (
        <div className="flex min-h-screen bg-gray-50 text-gray-900">
            <Sidebar />
            <main className="flex-1 overflow-auto pt-16 md:pt-0">
                {children}
            </main>
        </div>
    )
}
