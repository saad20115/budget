import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OdooSyncClient from './OdooSyncClient'

export const dynamic = 'force-dynamic'

export default async function OdooSyncPage() {
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">مزامنة أودو (Odoo Sync)</h1>
            <OdooSyncClient />
        </div>
    )
}
