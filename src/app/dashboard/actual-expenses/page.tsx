import ActualExpensesClient from './ActualExpensesClient'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ActualExpensesPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return <ActualExpensesClient />
}
