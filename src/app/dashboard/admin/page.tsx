import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersAdminClient from './UsersAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) redirect('/login')

    // Try to fetch user_roles — if table doesn't exist, show setup page
    const { data: users, error: tableError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true })

    // If table doesn't exist yet, show setup instructions
    if (tableError) {
        return <UsersAdminClient
            users={[]}
            currentUserId={session.user.id}
            currentUserEmail={session.user.email ?? ''}
            setupRequired
            setupError={tableError.message}
        />
    }

    // Check if current user is admin
    const myRole = users?.find(u => u.user_id === session.user.id)

    // If no users at all → first run, treat current user as admin for setup
    const isAdmin = myRole?.role === 'admin' || (users?.length === 0)

    if (!isAdmin) {
        redirect('/dashboard')
    }

    return (
        <UsersAdminClient
            users={users ?? []}
            currentUserId={session.user.id}
            currentUserEmail={session.user.email ?? ''}
            setupRequired={false}
        />
    )
}
