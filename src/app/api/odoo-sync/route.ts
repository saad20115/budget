import { NextRequest, NextResponse } from 'next/server'

// Robust fast array finder (BFS instead of deep recursion, limits depth)
function findRecordsArrayFast(obj: unknown): Record<string, unknown>[] | null {
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') return obj as Record<string, unknown>[]
    if (typeof obj === 'object' && obj !== null) {
        // Common Odoo/REST wrappers
        const commonKeys = ['data', 'result', 'items', 'records', 'response']
        for (const k of commonKeys) {
            if ((obj as any)[k] && Array.isArray((obj as any)[k]) && (obj as any)[k].length > 0 && typeof (obj as any)[k][0] === 'object') {
                return (obj as any)[k]
            }
        }
        // General search depth 1
        for (const key of Object.keys(obj)) {
            const val = (obj as any)[key]
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') return val
        }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { url, username, password, config } = body

        if (!url || !username || !password) {
            return NextResponse.json(
                { error: 'Missing url, username, or password in request body' },
                { status: 400 }
            )
        }

        const base64Credentials = Buffer.from(`${username}:${password}`).toString('base64')

        // Fetch data from Odoo
        const fetchStartTime = Date.now()
        // Add limit=500 to fetch only latest 500 rows if the API supports it
        const fetchUrl = url.includes('limit=') ? url : (url.includes('?') ? `${url}&limit=500` : `${url}?limit=500`)
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${base64Credentials}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            cache: 'no-store',
            // Odoo requests can take time
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: `Odoo API returned ${response.status}: ${response.statusText}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        const fetchTime = Date.now() - fetchStartTime

        const records = findRecordsArrayFast(data) || []
        
        // 1. Gather all keys
        const keySet = new Set<string>()
        
        // 2. Gather unique options dynamically (to prevent heavy lifting on frontend)
        const costCenterKeysToTry = [config?.costCenter, 'cost_center', 'analytic', 'analytic_account', 'analytic_account_name', 'analytic_account_id'].filter(Boolean) as string[]
        const accountTypeKeysToTry = [config?.accountType, 'account_type', 'account_type_name', 'user_type_id_name', 'user_type_id', 'user_type_name', 'user_type'].filter(Boolean) as string[]

        const uniqueCostCenters = new Set<string>()
        const uniqueAccountTypes = new Set<string>()

        // Fast iteration for massive arrays in Node.js
        for (let i = 0; i < records.length; i++) {
            const r = records[i]
            // Sample first 1000 rows for keys to avoid looping all keys everywhere
            if (i < 1000) {
                Object.keys(r).forEach(k => keySet.add(k))
            }
            
            // Extract uniques with fallback
            for (const k of costCenterKeysToTry) {
                if (r[k] != null) {
                    const val = String(r[k]).trim()
                    if (val && val !== 'false' && val !== 'null') {
                        uniqueCostCenters.add(val)
                        break
                    }
                }
            }

            for (const k of accountTypeKeysToTry) {
                if (r[k] != null) {
                    const val = String(r[k]).trim()
                    if (val && val !== 'false' && val !== 'null') {
                        uniqueAccountTypes.add(val)
                        break
                    }
                }
            }
        }

        // Send a lightweight summary back to the frontend!
        return NextResponse.json({
            status: 'success',
            meta: {
                totalRecords: records.length,
                fetchTimeMs: fetchTime,
                allKeys: Array.from(keySet),
                uniqueCostCenters: Array.from(uniqueCostCenters).sort(),
                uniqueAccountTypes: Array.from(uniqueAccountTypes).sort(),
            },
            // Only send 100 sample records for preview UI to prevent browser freezing
            sampleRecords: records.slice(0, 100)
        })

    } catch (error: unknown) {
        console.error('Error proxying to Odoo:', error)
        const msg = error instanceof Error ? error.message : 'Failed to fetch from Odoo'
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        )
    }
}
