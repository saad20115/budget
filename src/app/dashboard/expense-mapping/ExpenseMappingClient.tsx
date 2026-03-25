'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExternalRow {
    id: string
    companyId: number
    companyName: string
    costCenter: string
    accountCode: string
    accountName: string
    expenses: number
    month: number
}

interface MappingRow {
    id: string
    external_cost_center: string
    external_account_code: string
    internal_expense_name: string
    linked_project_id: string | null
}

interface ProjectInfo {
    id: string
    name: string
    total_value: number
    status: string
}

interface UniqueAccount {
    costCenter: string
    accountCode: string
    accountName: string
    totalExpenses: number
    count: number
    mappedTo: string | null
    mappedProjectId: string | null
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ExpenseMappingClient() {
    const supabase = createClient()

    // Data
    const [externalData, setExternalData] = useState<ExternalRow[]>([])
    const [mappings, setMappings] = useState<MappingRow[]>([])
    const [budgetNames, setBudgetNames] = useState<string[]>([])
    const [allProjects, setAllProjects] = useState<ProjectInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    // JSON input
    const [jsonInput, setJsonInput] = useState('')
    const [processing, setProcessing] = useState(false)

    // Search & sort
    const [searchQuery, setSearchQuery] = useState('')
    const [filterMapped, setFilterMapped] = useState<'all' | 'mapped' | 'unmapped'>('all')
    const [sortKey, setSortKey] = useState<'costCenter' | 'accountCode' | 'accountName' | 'totalExpenses' | 'mappedTo'>('totalExpenses')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    // Selection & bulk
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

    // ─── Load data ───────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [extRes, mapRes, budgetRes, projRes, staffRes] = await Promise.all([
                supabase.from('external_expenses_cache').select('*').order('cost_center').order('account_code'),
                supabase.from('expense_mapping').select('*'),
                supabase.from('project_expenses').select('name'),
                supabase.from('projects').select('id, name, total_value, status').order('name'),
                supabase.from('project_staffing').select('role_name'),
            ])

            if (extRes.error) throw extRes.error
            if (mapRes.error) throw mapRes.error

            setExternalData((extRes.data || []).map(r => ({
                id: r.id,
                companyId: r.company_id,
                companyName: r.company_name,
                costCenter: r.cost_center,
                accountCode: r.account_code,
                accountName: r.account_name,
                expenses: Number(r.expenses),
                month: r.month,
            })))

            setMappings(mapRes.data || [])

            // Combine expense names + staffing roles + hardcoded salary item
            const expenseNames = (budgetRes.data || []).map(r => r.name.trim())
            const staffingRoles = (staffRes.data || []).map(r => r.role_name.trim())
            const allNames = [...new Set([...expenseNames, ...staffingRoles, 'رواتب وأجور'])].sort()
            setBudgetNames(allNames)

            // All projects
            setAllProjects((projRes.data || []).map(p => ({
                id: p.id,
                name: p.name,
                total_value: Number(p.total_value),
                status: p.status,
            })))

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
                setMessage({ text: '⚠️ الجداول غير موجودة بعد — شغّل الـ SQL في Supabase أولاً', type: 'error' })
            } else {
                setMessage({ text: `خطأ: ${errMsg}`, type: 'error' })
            }
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => { loadData() }, [loadData])

    // ─── Unique accounts (grouped by costCenter + accountCode) ───────────────
    const uniqueAccounts = useMemo(() => {
        const map: Record<string, UniqueAccount> = {}
        externalData.forEach(r => {
            const key = `${r.costCenter}||${r.accountCode}`
            if (!map[key]) {
                const mapping = mappings.find(m => m.external_cost_center === r.costCenter && m.external_account_code === r.accountCode)
                map[key] = {
                    costCenter: r.costCenter,
                    accountCode: r.accountCode,
                    accountName: r.accountName,
                    totalExpenses: 0,
                    count: 0,
                    mappedTo: mapping?.internal_expense_name || null,
                    mappedProjectId: mapping?.linked_project_id || null,
                }
            }
            map[key].totalExpenses += r.expenses
            map[key].count++
        })
        return Object.values(map).sort((a, b) => b.totalExpenses - a.totalExpenses)
    }, [externalData, mappings])

    const filteredAccounts = useMemo(() => {
        let list = uniqueAccounts
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter(a =>
                a.costCenter.toLowerCase().includes(q) ||
                a.accountCode.includes(q) ||
                a.accountName.toLowerCase().includes(q) ||
                (a.mappedTo && a.mappedTo.toLowerCase().includes(q))
            )
        }
        if (filterMapped === 'mapped') list = list.filter(a => a.mappedTo)
        if (filterMapped === 'unmapped') list = list.filter(a => !a.mappedTo)
        // Sort
        list = [...list].sort((a, b) => {
            let cmp = 0
            if (sortKey === 'totalExpenses') {
                cmp = a.totalExpenses - b.totalExpenses
            } else {
                const av = (sortKey === 'mappedTo' ? a.mappedTo || '' : a[sortKey]).toLowerCase()
                const bv = (sortKey === 'mappedTo' ? b.mappedTo || '' : b[sortKey]).toLowerCase()
                cmp = av.localeCompare(bv, 'ar')
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [uniqueAccounts, searchQuery, filterMapped, sortKey, sortDir])

    const toggleSort = (key: typeof sortKey) => {
        if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
        else { setSortKey(key); setSortDir(key === 'totalExpenses' ? 'desc' : 'asc') }
    }

    const sortArrow = (key: typeof sortKey) => sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

    const rowKey = (a: UniqueAccount) => `${a.costCenter}||${a.accountCode}`

    const toggleSelect = (key: string) => {
        setSelectedKeys(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })
    }

    const toggleSelectAll = () => {
        if (selectedKeys.size === filteredAccounts.length) setSelectedKeys(new Set())
        else setSelectedKeys(new Set(filteredAccounts.map(rowKey)))
    }


    const mappedCount = uniqueAccounts.filter(a => a.mappedTo).length
    const unmappedCount = uniqueAccounts.length - mappedCount
    const totalMappedExpenses = uniqueAccounts.filter(a => a.mappedTo).reduce((s, a) => s + a.totalExpenses, 0)

    // ─── Save mapping (expense name or project) ─────────────────────────────
    const saveMapping = useCallback(async (
        costCenter: string,
        accountCode: string,
        field: 'expense' | 'project',
        value: string
    ) => {
        setMessage(null)
        try {
            // Get current mapping
            const existing = mappings.find(m => m.external_cost_center === costCenter && m.external_account_code === accountCode)

            if (field === 'expense' && !value && !existing?.linked_project_id) {
                // Remove mapping entirely if both empty
                await supabase
                    .from('expense_mapping')
                    .delete()
                    .eq('external_cost_center', costCenter)
                    .eq('external_account_code', accountCode)
            } else if (field === 'expense') {
                if (!value) {
                    // Remove expense name but keep project
                    if (existing) {
                        await supabase.from('expense_mapping').update({ internal_expense_name: '' }).eq('id', existing.id)
                    }
                } else {
                    await supabase
                        .from('expense_mapping')
                        .upsert({
                            external_cost_center: costCenter,
                            external_account_code: accountCode,
                            internal_expense_name: value,
                            linked_project_id: existing?.linked_project_id || null,
                        }, { onConflict: 'external_cost_center,external_account_code' })
                }
            } else {
                // field === 'project'
                const projectId = value || null
                await supabase
                    .from('expense_mapping')
                    .upsert({
                        external_cost_center: costCenter,
                        external_account_code: accountCode,
                        internal_expense_name: existing?.internal_expense_name || '',
                        linked_project_id: projectId,
                    }, { onConflict: 'external_cost_center,external_account_code' })
            }
            loadData()
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'خطأ في حفظ الربط', type: 'error' })
        }
    }, [supabase, loadData, mappings])

    // ─── Bulk mapping ────────────────────────────────────────────────────────
    const bulkAssign = useCallback(async (field: 'expense' | 'project', value: string) => {
        if (selectedKeys.size === 0) return
        setMessage(null)
        try {
            for (const key of selectedKeys) {
                const [costCenter, accountCode] = key.split('||')
                await saveMapping(costCenter, accountCode, field, value)
            }
            setSelectedKeys(new Set())
            setMessage({ text: `✅ تم تطبيق الربط على ${selectedKeys.size} حساب`, type: 'success' })
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'خطأ', type: 'error' })
        }
    }, [selectedKeys, saveMapping])

    // ─── Parse and update JSON ───────────────────────────────────────────────
    const findExpenseRows = (obj: Record<string, unknown>): ExternalRow[] | null => {
        const keys = ['data', 'results', 'items', 'rows', 'expenses', 'records']
        for (const key of keys) {
            if (obj[key] && Array.isArray(obj[key])) return obj[key] as ExternalRow[]
        }
        for (const key of Object.keys(obj)) {
            const val = obj[key]
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'expenses' in val[0]) {
                return val as ExternalRow[]
            }
        }
        return null
    }

    const handleJsonUpdate = useCallback(async () => {
        if (!jsonInput.trim()) { setMessage({ text: 'الرجاء لصق بيانات JSON', type: 'error' }); return }
        setProcessing(true)
        setMessage(null)
        try {
            const parsed = JSON.parse(jsonInput.trim())
            let rows: ExternalRow[] | null = null
            if (Array.isArray(parsed)) { rows = parsed }
            else if (typeof parsed === 'object' && parsed !== null) {
                rows = findExpenseRows(parsed as Record<string, unknown>)
                if (!rows) {
                    const allRows: ExternalRow[] = []
                    for (const key of Object.keys(parsed)) {
                        const val = (parsed as Record<string, unknown>)[key]
                        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                            const nested = findExpenseRows(val as Record<string, unknown>)
                            if (nested) allRows.push(...nested)
                        }
                    }
                    if (allRows.length > 0) rows = allRows
                }
            }
            if (!rows || rows.length === 0) throw new Error('لم يتم العثور على بيانات مصاريف في الـ JSON')

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const upsertData = rows.map((r: any) => {
                // Support both r.expenses and r.originalExpenses
                const expenses = Number(r.expenses ?? r.originalExpenses ?? 0)
                // Support month (integer) or derive from dateFrom (e.g. "2025-10-01" → 10)
                let month: number | null = null
                if (r.month != null) {
                    month = Number(r.month)
                } else if (r.dateFrom) {
                    const parts = String(r.dateFrom).split('-')
                    if (parts.length >= 2) month = Number(parts[1])
                }
                return {
                    company_id: r.companyId,
                    company_name: r.companyName,
                    cost_center: r.costCenter,
                    account_code: r.accountCode,
                    account_name: r.accountName,
                    expenses,
                    month,
                    updated_at: new Date().toISOString(),
                }
            })

            const { error } = await supabase
                .from('external_expenses_cache')
                .upsert(upsertData, { onConflict: 'company_id,cost_center,account_code,month' })

            if (error) throw error

            setMessage({ text: `✅ تم تحديث ${rows.length} سجل — الربط محفوظ`, type: 'success' })
            setJsonInput('')
            loadData()
        } catch (err: unknown) {
            if (err instanceof SyntaxError) {
                setMessage({ text: 'خطأ في صيغة JSON', type: 'error' })
            } else {
                setMessage({ text: err instanceof Error ? err.message : 'حدث خطأ', type: 'error' })
            }
        } finally {
            setProcessing(false)
        }
    }, [jsonInput, supabase, loadData])

    // ─── Sync to actual_expenses ─────────────────────────────────────────────
    const handleSync = useCallback(async () => {
        if (mappedCount === 0) {
            setMessage({ text: 'لا يوجد ربط. قم بربط الحسابات أولاً.', type: 'error' })
            return
        }

        setSyncing(true)
        setMessage(null)

        try {
            // 1. Get active projects
            const activeProjects = allProjects.filter(p => p.status === 'Active')
            if (activeProjects.length === 0) throw new Error('لا توجد مشاريع نشطة لتوزيع المصاريف عليها')

            const totalProjectValue = activeProjects.reduce((s, p) => s + p.total_value, 0)
            if (totalProjectValue <= 0) throw new Error('إجمالي قيمة المشاريع النشطة = صفر')

            // 2. Build expense entries: group by (expenseName, projectId)
            // If account has a specific project → goes to that project
            // Otherwise → distributed across all active by total_value ratio
            const entries: { projectId: string; expenseName: string; amount: number }[] = []

            for (const account of uniqueAccounts) {
                if (!account.mappedTo) continue
                const name = account.mappedTo

                if (account.mappedProjectId) {
                    // Direct to specific project
                    entries.push({
                        projectId: account.mappedProjectId,
                        expenseName: name,
                        amount: account.totalExpenses,
                    })
                } else {
                    // Distribute across active projects
                    for (const project of activeProjects) {
                        const share = project.total_value / totalProjectValue
                        entries.push({
                            projectId: project.id,
                            expenseName: name,
                            amount: account.totalExpenses * share,
                        })
                    }
                }
            }

            // 3. Merge entries with same (projectId, expenseName)
            const merged: Record<string, { projectId: string; expenseName: string; amount: number }> = {}
            for (const e of entries) {
                const key = `${e.projectId}||${e.expenseName}`
                if (!merged[key]) merged[key] = { ...e, amount: 0 }
                merged[key].amount += e.amount
            }

            // 4. Delete old synced actual_expenses (marked with [مزامنة خارجية])
            await supabase
                .from('actual_expenses')
                .delete()
                .like('notes', '[مزامنة خارجية]%')

            // 5. Insert
            const today = new Date().toISOString().split('T')[0]
            const inserts = Object.values(merged).map(e => ({
                project_id: e.projectId,
                amount: e.amount,
                expense_date: today,
                notes: `[مزامنة خارجية] ${e.expenseName}`,
            }))

            if (inserts.length > 0) {
                const { error } = await supabase.from('actual_expenses').insert(inserts)
                if (error) throw error
            }

            const totalAmount = inserts.reduce((s, i) => s + i.amount, 0)
            setMessage({
                text: `✅ تمت المزامنة: ${inserts.length} سجل — إجمالي ${Number(totalAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} ر.س`,
                type: 'success'
            })
            loadData()
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'خطأ في المزامنة', type: 'error' })
        } finally {
            setSyncing(false)
        }
    }, [supabase, uniqueAccounts, mappedCount, loadData, allProjects])

    const fmt = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-8 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ربط المصاريف 🔗</h1>
                    <p className="text-gray-500 mt-1">ربط حسابات النظام الخارجي ببنود الموازنة الداخلية وتحديث المصاريف الفعلية</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleSync}
                        disabled={syncing || mappedCount === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-11 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
                    >
                        {syncing ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                جارٍ المزامنة...
                            </span>
                        ) : '🔄 مزامنة المصاريف الفعلية'}
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الحسابات</p>
                    <p className="text-2xl font-bold text-gray-900">{uniqueAccounts.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">مربوط ✅</p>
                    <p className="text-2xl font-bold text-emerald-700">{mappedCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">غير مربوط ⚠️</p>
                    <p className="text-2xl font-bold text-amber-700">{unmappedCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">إجمالي المربوط</p>
                    <p className="text-2xl font-bold text-gray-900">{fmt(totalMappedExpenses)} <span className="text-sm font-medium text-gray-400">ر.س</span></p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* JSON Update */}
            <Card className="border-gray-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-l from-emerald-50 to-blue-50 border-b border-gray-100 py-4">
                    <CardTitle className="text-gray-800 text-base flex items-center gap-2">
                        <span>📋</span> تحديث البيانات المالية
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="space-y-3">
                        <textarea
                            value={jsonInput}
                            onChange={(e) => setJsonInput(e.target.value)}
                            placeholder="الصق JSON هنا — يحدّث المبالغ فقط ويحافظ على الربط"
                            title="بيانات JSON"
                            className="w-full h-24 px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono resize-y"
                            dir="ltr"
                        />
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleJsonUpdate}
                                disabled={processing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جارٍ التحديث...
                                    </span>
                                ) : '⚡ تحديث المبالغ'}
                            </Button>
                            <span className="text-xs text-gray-400">يحدّث المبالغ فقط — الربط محفوظ</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Mapping Table */}
            <Card className="border-gray-200 shadow-sm overflow-hidden slide-in-bottom">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <CardTitle className="text-gray-800 text-lg">جدول الربط</CardTitle>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-sm">
                            {([
                                { key: 'all', label: 'الكل' },
                                { key: 'mapped', label: `مربوط (${mappedCount})` },
                                { key: 'unmapped', label: `غير مربوط (${unmappedCount})` },
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilterMapped(tab.key)}
                                    className={`px-3 py-2 font-medium transition-colors ${filterMapped === tab.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="بحث..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-1 focus:border-blue-500 focus:outline-none text-sm w-full md:w-56"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500 font-medium flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                <p>جارٍ تحميل البيانات...</p>
                            </div>
                        ) : filteredAccounts.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <span className="text-4xl mb-4 block">📭</span>
                                <p className="text-lg font-medium text-gray-900 mb-1">لا توجد حسابات</p>
                                <p className="text-sm">{externalData.length === 0 ? 'الصق بيانات JSON في صفحة المصاريف الخارجية أولاً' : 'جرب تعديل البحث أو الفلتر'}</p>
                            </div>
                        ) : (
                            <>
                                {/* Bulk actions bar */}
                                {selectedKeys.size > 0 && (
                                    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex flex-wrap items-center gap-3">
                                        <span className="text-blue-800 text-sm font-medium">تم تحديد {selectedKeys.size} حساب —</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-blue-700">ربط ببند:</span>
                                            <select
                                                title="ربط المحدد ببند"
                                                className="h-8 px-2 rounded-lg border border-blue-300 bg-white text-sm text-gray-800 cursor-pointer focus:outline-none"
                                                defaultValue=""
                                                onChange={(e) => { if (e.target.value) { bulkAssign('expense', e.target.value); e.target.value = '' } }}
                                            >
                                                <option value="" disabled>اختر...</option>
                                                {budgetNames.map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-violet-700">ربط بمشروع:</span>
                                            <select
                                                title="ربط المحدد بمشروع"
                                                className="h-8 px-2 rounded-lg border border-violet-300 bg-white text-sm text-gray-800 cursor-pointer focus:outline-none"
                                                defaultValue=""
                                                onChange={(e) => { if (e.target.value) { bulkAssign('project', e.target.value); e.target.value = '' } }}
                                            >
                                                <option value="" disabled>اختر...</option>
                                                {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <button onClick={() => setSelectedKeys(new Set())} className="text-xs text-gray-500 hover:text-gray-700 mr-auto">إلغاء التحديد</button>
                                    </div>
                                )}
                                <table className="w-full text-sm text-right">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-3 py-3 w-10"><input type="checkbox" title="تحديد الكل" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={filteredAccounts.length > 0 && selectedKeys.size === filteredAccounts.length} onChange={toggleSelectAll} /></th>
                                            <th className="px-4 py-3 font-semibold cursor-pointer hover:text-blue-700 select-none" onClick={() => toggleSort('costCenter')}>مركز التكلفة{sortArrow('costCenter')}</th>
                                            <th className="px-4 py-3 font-semibold cursor-pointer hover:text-blue-700 select-none" onClick={() => toggleSort('accountCode')}>كود الحساب{sortArrow('accountCode')}</th>
                                            <th className="px-4 py-3 font-semibold cursor-pointer hover:text-blue-700 select-none" onClick={() => toggleSort('accountName')}>اسم الحساب{sortArrow('accountName')}</th>
                                            <th className="px-4 py-3 font-semibold cursor-pointer hover:text-blue-700 select-none" onClick={() => toggleSort('totalExpenses')}>المبلغ{sortArrow('totalExpenses')}</th>
                                            <th className="px-4 py-3 font-semibold cursor-pointer hover:text-blue-700 select-none min-w-[180px]" onClick={() => toggleSort('mappedTo')}>بند الموازنة{sortArrow('mappedTo')}</th>
                                            <th className="px-4 py-3 font-semibold min-w-[180px]">المشروع</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredAccounts.map((account) => {
                                            const key = rowKey(account)
                                            const selected = selectedKeys.has(key)
                                            return (
                                                <tr key={key} className={`hover:bg-gray-50/50 transition-colors ${selected ? 'bg-blue-50/50' : account.mappedTo ? '' : 'bg-amber-50/30'}`}>
                                                    <td className="px-3 py-3"><input type="checkbox" title="تحديد" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={selected} onChange={() => toggleSelect(key)} /></td>
                                                    <td className="px-4 py-3 text-gray-700 text-xs">{account.costCenter}</td>
                                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs" dir="ltr">{account.accountCode}</td>
                                                    <td className="px-4 py-3 text-gray-900 font-medium text-sm">{account.accountName}</td>
                                                    <td className="px-4 py-3 text-blue-700 font-semibold whitespace-nowrap text-sm" dir="ltr">{fmt(account.totalExpenses)} ر.س</td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={account.mappedTo || ''}
                                                            onChange={(e) => saveMapping(account.costCenter, account.accountCode, 'expense', e.target.value)}
                                                            title="بند الموازنة"
                                                            className={`w-full h-8 px-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${account.mappedTo ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-gray-300 text-gray-500'}`}
                                                        >
                                                            <option value="">—</option>
                                                            {budgetNames.map(name => <option key={name} value={name}>{name}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={account.mappedProjectId || ''}
                                                            onChange={(e) => saveMapping(account.costCenter, account.accountCode, 'project', e.target.value)}
                                                            title="المشروع"
                                                            className={`w-full h-8 px-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${account.mappedProjectId ? 'bg-violet-50 border-violet-300 text-violet-800' : 'bg-white border-gray-300 text-gray-500'}`}
                                                        >
                                                            <option value="">— تلقائي —</option>
                                                            {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                                            <td colSpan={4} className="px-4 py-4 font-bold text-blue-900">
                                                الإجمالي ({filteredAccounts.length} حساب)
                                            </td>
                                            <td className="px-4 py-4 font-bold text-blue-900 whitespace-nowrap" dir="ltr">
                                                {fmt(filteredAccounts.reduce((s, a) => s + a.totalExpenses, 0))} ر.س
                                            </td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Sync Summary at bottom */}
            {mappedCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="text-blue-800 text-sm">
                        <strong>{mappedCount}</strong> حساب مربوط بإجمالي <strong dir="ltr">{fmt(totalMappedExpenses)} ر.س</strong> — اضغط &quot;مزامنة&quot; لتحديث المصاريف الفعلية
                    </div>
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-10 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                    >
                        {syncing ? 'جارٍ المزامنة...' : '🔄 مزامنة'}
                    </Button>
                </div>
            )}
        </div>
    )
}
