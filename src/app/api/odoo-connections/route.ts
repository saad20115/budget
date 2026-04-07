import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service-role key to bypass RLS for API routes
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

// GET - list all connections
export async function GET() {
    try {
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from('odoo_connections')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) throw error
        return NextResponse.json(data || [])
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to fetch connections' }, { status: 500 })
    }
}

// POST - create or update a connection
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, label, url, username, password, is_active, sync_interval_hours, mapping_config, filter_config } = body

        if (!url || !username || !password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()

        const record = {
            label: label || '',
            url,
            username,
            password,
            is_active: is_active !== false,
            sync_interval_hours: sync_interval_hours || 4,
            mapping_config: mapping_config || {},
            filter_config: filter_config || {},
            updated_at: new Date().toISOString(),
        }

        let result
        if (id) {
            // Update existing
            result = await supabase.from('odoo_connections').update(record).eq('id', id).select().single()
        } else {
            // Insert new
            result = await supabase.from('odoo_connections').insert(record).select().single()
        }

        if (result.error) throw result.error
        return NextResponse.json(result.data)
    } catch (error: unknown) {
        console.error('❌ Save connection error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save connection' }, { status: 500 })
    }
}

// DELETE - delete a connection by id
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        const supabase = getSupabaseAdmin()
        const { error } = await supabase.from('odoo_connections').delete().eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete connection' }, { status: 500 })
    }
}
