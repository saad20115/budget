import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

function findRecordsArray(obj: unknown): Record<string, unknown>[] | null {
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') return obj
    if (typeof obj === 'object' && obj !== null) {
        for (const key of Object.keys(obj)) {
            const val = (obj as Record<string, unknown>)[key]
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val as Record<string, unknown>[]
        }
        for (const key of Object.keys(obj)) {
            const val = (obj as Record<string, unknown>)[key]
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const found = findRecordsArray(val)
                if (found) return found
            }
        }
    }
    return null
}

async function syncConnection(conn: any, supabase: ReturnType<typeof getSupabaseAdmin>) {
    const base64Creds = Buffer.from(`${conn.username}:${conn.password}`).toString('base64')

    // Parse configs
    const mapConf = conn.mapping_config || {}
    const filtConf = conn.filter_config || {}

    // Map fields
    const fCompanyId = mapConf.companyId || 'company_id'
    const fCompanyName = mapConf.companyName || 'company_name'
    const fCostCenter = mapConf.costCenter || 'cost_center'
    const fAccountCode = mapConf.accountCode || 'account_code'
    const fAccountName = mapConf.accountName || 'account_name'
    const fAccountType = mapConf.accountType || 'account_type'
    const fDate = mapConf.date || 'date'
    const fExpenses = mapConf.expenses || 'expenses'

    // Filters
    const dateFrom = filtConf.dateFrom ? new Date(filtConf.dateFrom) : null
    const dateTo = filtConf.dateTo ? new Date(filtConf.dateTo) : null
    const allowedCCs = filtConf.allowedCostCenters || []
    const allowedTypes = filtConf.allowedAccountTypes || []
    const allowedCodes = filtConf.allowedAccountCodes || [] // e.g. prefixes ["5", "8"]

    const matchedRecords = []
    let totalRawCount = 0
    let offset = 0
    const limit = 100
    const CONCURRENCY = 1
    let hasMore = true

    while (hasMore) {
        const fetchPromises = []
        for (let i = 0; i < CONCURRENCY; i++) {
            const currentOffset = offset + (i * limit)
            let fetchUrl = conn.url
            if (!fetchUrl.includes('limit=')) {
                const separator = fetchUrl.includes('?') ? '&' : '?'
                fetchUrl = `${fetchUrl}${separator}limit=${limit}&offset=${currentOffset}`
            }
            
            console.log(`[Auto-Sync] Fetching ${fetchUrl}`)
            
            const p = fetch(fetchUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${base64Creds}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                cache: 'no-store',
            }).then(async res => {
                if (!res.ok) throw new Error(`Odoo API returned ${res.status}: ${res.statusText}`)
                const data = await res.json()
                const records = findRecordsArray(data)
                return records || []
            })
            
            fetchPromises.push(p)

            // If the URL has a hardcoded limit, parallel offset makes no sense since we can't inject
            if (conn.url.includes('limit=')) break 
        }

        const chunkSets = await Promise.all(fetchPromises)

        let allRecordsInLoop = 0
        for (let idx = 0; idx < chunkSets.length; idx++) {
            const records = chunkSets[idx]
            
            if (records.length === 0 && offset === 0 && idx === 0) {
                throw new Error('No records found in API response')
            }

            totalRawCount += records.length
            allRecordsInLoop += records.length

            for (const r of records) {
                const rCompanyId = r[fCompanyId] ?? r.companyId ?? r.company_id
                const rCompanyName = r[fCompanyName] ?? r.companyName ?? r.company_name ?? ''
                const rCostCenter = String(r[fCostCenter] ?? r.analytic ?? r.analytic_account ?? r.analytic_account_name ?? r.costCenter ?? r.cost_center ?? '')
                let rAccountCode = String(r[fAccountCode] ?? r.accountCode ?? r.account_code ?? '')
                let rAccountName = String(r[fAccountName] ?? r.accountName ?? r.account_name ?? '')

                // Smart separation: if they are combined "123456 Account Name"
                if (rAccountCode === rAccountName || !rAccountCode || !rAccountName) {
                    const sourceText = rAccountName || rAccountCode
                    const match = sourceText.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
                    if (match) {
                        rAccountCode = match[1]
                        rAccountName = match[2]
                    }
                }
                const rAccountType = String(r[fAccountType] ?? r.account_type ?? r.account_type_name ?? (r.account_type as any)?.name ?? r.user_type_id_name ?? r.user_type_name ?? '')
                const rDateRaw = r[fDate] ?? r.date ?? null
                const rExpenses = Number(r[fExpenses] ?? r.originalExpenses ?? r.totalExpenses ?? 0)

                if (dateFrom || dateTo) {
                    if (!rDateRaw) continue
                    const rowDate = new Date(rDateRaw as string)
                    if (dateFrom && rowDate < dateFrom) continue
                    if (dateTo && rowDate > dateTo) continue
                }
                if (allowedCCs.length > 0 && !allowedCCs.includes(rCostCenter)) continue
                if (allowedTypes.length > 0 && !allowedTypes.some((t: string) => rAccountType.toLowerCase().includes(t.toLowerCase()))) continue
                if (allowedCodes.length > 0 && !allowedCodes.some((code: string) => rAccountCode.startsWith(code))) continue

                const dateStr = rDateRaw ? String(rDateRaw).split(' ')[0] : new Date().toISOString().split('T')[0]
                matchedRecords.push({
                    company_id: Number(rCompanyId) || 0,
                    company_name: String(rCompanyName),
                    cost_center: rCostCenter,
                    account_code: rAccountCode,
                    account_name: rAccountName,
                    expenses: rExpenses,
                    expense_date: dateStr,
                    updated_at: new Date().toISOString()
                })
            }

            // If records returned are less than the limit, we've reached the end
            // If records returned are MORE than the limit, the Custom API ignored our &limit= param completely!
            // This means we just downloaded the entire database in one go, so we must stop.
            if (records.length < limit || records.length > limit) {
                hasMore = false
                break
            }
        }

        if (conn.url.includes('limit=')) hasMore = false
        if (hasMore) offset += (limit * CONCURRENCY)
    }

    if (matchedRecords.length === 0) {
        return { recordCount: 0, rawCount: totalRawCount }
    }

    // Deduplicate by summing expenses for same constraints (exact date)
    const deduped = new Map<string, typeof matchedRecords[0]>()
    for (const row of matchedRecords) {
        const key = `${row.company_id}|${row.cost_center}|${row.account_code}|${row.expense_date}`
        if (deduped.has(key)) {
            deduped.get(key)!.expenses += row.expenses
        } else {
            deduped.set(key, { ...row })
        }
    }
    const upsertData = Array.from(deduped.values())

    // Batch upsert
    const CHUNK = 500
    for (let i = 0; i < upsertData.length; i += CHUNK) {
        const chunk = upsertData.slice(i, i + CHUNK)
        const { error } = await supabase
            .from('external_expenses_cache')
            .upsert(chunk, { onConflict: 'company_id,cost_center,account_code,expense_date' })
        if (error) throw error
    }

    return { recordCount: upsertData.length, rawCount: totalRawCount }
}

export async function POST() {
    const supabase = getSupabaseAdmin()
    const results: { connectionId: string; label: string; status: string; message: string; records: number }[] = []

    try {
        const { data: connections, error: connError } = await supabase
            .from('odoo_connections')
            .select('*')
            .eq('is_active', true)

        if (connError) throw connError
        if (!connections || connections.length === 0) {
            return NextResponse.json({ message: 'No active connections found', results: [] })
        }

        console.log(`[Auto-Sync] Starting sync for ${connections.length} connections...`)

        for (const conn of connections) {
            try {
                const { recordCount, rawCount } = await syncConnection(conn, supabase)

                await supabase.from('odoo_connections').update({
                    last_sync_at: new Date().toISOString(),
                    last_sync_status: 'success',
                    last_sync_message: `تمت مزامنة ${recordCount} سجل بنجاح من أصل ${rawCount} سجل مسترد`,
                    last_sync_records: recordCount,
                }).eq('id', conn.id)

                results.push({
                    connectionId: conn.id,
                    label: conn.label || conn.url,
                    status: 'success',
                    message: `Synced ${recordCount} filtered from ${rawCount} raw`,
                    records: recordCount,
                })
                console.log(`[Auto-Sync] ✅ ${conn.label || conn.url}: ${recordCount} records saved.`)
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : (err && typeof err === 'object' ? JSON.stringify(err) : 'Unknown error')
                await supabase.from('odoo_connections').update({
                    last_sync_at: new Date().toISOString(),
                    last_sync_status: 'error',
                    last_sync_message: msg,
                    last_sync_records: 0,
                }).eq('id', conn.id)

                results.push({
                    connectionId: conn.id,
                    label: conn.label || conn.url,
                    status: 'error',
                    message: msg,
                    records: 0,
                })
                console.error(`[Auto-Sync] ❌ ${conn.label || conn.url}: ${msg}`)
            }
        }

        const successCount = results.filter(r => r.status === 'success').length
        const totalRecords = results.reduce((s, r) => s + r.records, 0)

        return NextResponse.json({
            message: `Synced ${successCount}/${connections.length} connections, ${totalRecords} total cached records inserted.`,
            results,
        })
    } catch (error: unknown) {
        console.error('[Auto-Sync] Fatal error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Auto-sync failed', results }, { status: 500 })
    }
}

export async function GET() {
    const supabase = getSupabaseAdmin()
    try {
        const { data: connections, error } = await supabase
            .from('odoo_connections')
            .select('id, label, url, is_active, last_sync_at, last_sync_status, last_sync_message, last_sync_records, sync_interval_hours')
            .order('created_at')

        if (error) throw error

        return NextResponse.json({ connections: connections || [], serverTime: new Date().toISOString() })
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 })
    }
}
