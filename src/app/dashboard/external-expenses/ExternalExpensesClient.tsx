'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ExternalExpenseRow {
    id: string
    companyId: number
    companyName: string
    costCenter: string
    groupId: number
    groupName: string
    accountCode: string
    accountName: string
    expenses: number
    expenseDate: string
    redistributable: boolean
}

type GroupByMode = 'none' | 'costCenter' | 'account' | 'month' | 'company'

const MONTH_NAMES: Record<number, string> = {
    1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
    5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
    9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ExternalExpensesClient() {
    const supabase = createClient()

    // Data state
    const [data, setData] = useState<ExternalExpenseRow[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

    // Input
    const [jsonInput, setJsonInput] = useState('')
    const [processing, setProcessing] = useState(false)

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [deleting, setDeleting] = useState(false)

    // View controls
    const [searchQuery, setSearchQuery] = useState('')
    const [groupBy, setGroupBy] = useState<GroupByMode>('none')
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

    // ─── Load saved data on mount ────────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: rows, error } = await supabase
                .from('external_expenses_cache')
                .select('*')
                .order('company_id')
                .order('cost_center')
                .order('account_code')
                .order('expense_date')

            if (error) throw error

            setData((rows || []).map(r => ({
                id: r.id,
                companyId: r.company_id,
                companyName: r.company_name,
                costCenter: r.cost_center,
                groupId: r.group_id,
                groupName: r.group_name,
                accountCode: r.account_code,
                accountName: r.account_name,
                expenses: Number(r.expenses),
                expenseDate: r.expense_date,
                redistributable: r.redistributable !== false,
            })))
            setSelectedIds(new Set())
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            // Table might not exist yet
            if (errMsg.includes('does not exist') || errMsg.includes('relation')) {
                setMessage({ text: '⚠️ الجدول غير موجود بعد — شغّل الـ SQL في Supabase أولاً (راجع ملف migration)', type: 'error' })
            } else {
                setMessage({ text: `خطأ في تحميل البيانات: ${errMsg}`, type: 'error' })
            }
        } finally {
            setLoading(false)
        }
    }, [supabase])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ─── Parse JSON and find expense rows ────────────────────────────────────
    const findExpenseRows = (obj: Record<string, unknown>): ExternalExpenseRow[] | null => {
        const keys = ['data', 'results', 'items', 'rows', 'expenses', 'records']
        for (const key of keys) {
            if (obj[key] && Array.isArray(obj[key])) return obj[key] as ExternalExpenseRow[]
        }
        for (const key of Object.keys(obj)) {
            const val = obj[key]
            if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && 'expenses' in val[0]) {
                return val as ExternalExpenseRow[]
            }
        }
        return null
    }

    const parseRows = (text: string): ExternalExpenseRow[] => {
        const parsed = JSON.parse(text.trim())
        let rows: ExternalExpenseRow[] | null = null

        if (Array.isArray(parsed)) {
            rows = parsed
        } else if (typeof parsed === 'object' && parsed !== null) {
            rows = findExpenseRows(parsed as Record<string, unknown>)
            if (!rows) {
                const allRows: ExternalExpenseRow[] = []
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

        if (!rows || rows.length === 0) {
            const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).join(', ') : typeof parsed
            throw new Error(`لم يتم العثور على بيانات المصاريف. المفاتيح الموجودة: [${keys}]`)
        }
        return rows
    }

    // ─── Update: only update expenses amounts for matching rows ──────────────
    // Mapping columns (linked_project_id, linked_expense_category) are NOT
    // included in the upsert, so Supabase preserves them automatically.
    const handleUpdate = useCallback(async () => {
        if (!jsonInput.trim()) {
            setMessage({ text: 'الرجاء لصق بيانات JSON', type: 'error' })
            return
        }

        setProcessing(true)
        setMessage(null)

        try {
            const rows = parseRows(jsonInput)

            // Check which rows already exist
            const { data: existing } = await supabase
                .from('external_expenses_cache')
                .select('company_id, cost_center, account_code, expense_date')

            const existingKeys = new Set(
                (existing || []).map(r => `${r.company_id}|${r.cost_center}|${r.account_code}|${r.expense_date}`)
            )

            // Build upsert data with proper field mapping
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawRows: any[] = rows.map((r: any) => {
                const companyId = r.companyId ?? r.company_id
                const companyName = r.companyName ?? r.company_name ?? ''
                const costCenter = r.costCenter ?? r.cost_center ?? ''
                const groupId = r.groupId ?? r.group_id ?? null
                const groupName = r.groupName ?? r.group_name ?? null
                const accountCode = r.accountCode ?? r.account_code ?? ''
                const accountName = r.accountName ?? r.account_name ?? ''
                const expenseDate = r.expenseDate ?? r.expense_date ?? r.date ?? new Date().toISOString().split('T')[0]
                // Use originalExpenses as the per-row expense amount
                const expenses = Number(r.originalExpenses ?? r.expenses ?? r.totalExpenses ?? 0)

                return {
                    company_id: Number(companyId),
                    company_name: String(companyName),
                    cost_center: String(costCenter),
                    group_id: groupId != null ? Number(groupId) : null,
                    group_name: groupName != null ? String(groupName) : null,
                    account_code: String(accountCode),
                    account_name: String(accountName),
                    expenses,
                    expense_date: expenseDate,
                    updated_at: new Date().toISOString(),
                }
            })

            // Deduplicate: sum expenses for rows with the same unique key
            // to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
            const deduped = new Map<string, typeof rawRows[0]>()
            for (const row of rawRows) {
                const key = `${row.company_id}|${row.cost_center}|${row.account_code}|${row.expense_date}`
                if (deduped.has(key)) {
                    deduped.get(key)!.expenses += row.expenses
                } else {
                    deduped.set(key, { ...row })
                }
            }
            const upsertData = Array.from(deduped.values())

            let updatedCount = 0
            let newCount = 0
            for (const row of upsertData) {
                const key = `${row.company_id}|${row.cost_center}|${row.account_code}|${row.expense_date}`
                if (existingKeys.has(key)) { updatedCount++ } else { newCount++ }
            }

            // Batch upsert in chunks of 500
            const CHUNK = 500
            for (let i = 0; i < upsertData.length; i += CHUNK) {
                const chunk = upsertData.slice(i, i + CHUNK)
                const { error } = await supabase
                    .from('external_expenses_cache')
                    .upsert(chunk, { onConflict: 'company_id,cost_center,account_code,expense_date' })
                if (error) throw error
            }

            const parts = []
            if (updatedCount > 0) parts.push(`تحديث ${updatedCount} سجل موجود`)
            if (newCount > 0) parts.push(`إضافة ${newCount} سجل جديد`)
            if (rawRows.length !== upsertData.length) parts.push(`(تم دمج ${rawRows.length - upsertData.length} سجل مكرر)`)

            setMessage({ text: `✅ ${parts.join(' + ')} — الربط مع المشاريع محفوظ`, type: 'success' })
            setJsonInput('')
            loadData()
        } catch (err: unknown) {
            if (err instanceof SyntaxError) {
                setMessage({ text: 'خطأ في صيغة JSON — تأكد من نسخ البيانات بشكل صحيح', type: 'error' })
            } else {
                setMessage({ text: err instanceof Error ? err.message : 'حدث خطأ', type: 'error' })
            }
        } finally {
            setProcessing(false)
        }
    }, [jsonInput, supabase, loadData])

    // ─── Bulk delete selected rows ────────────────────────────────────────────
    const handleBulkDelete = useCallback(async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} سجل؟`)) return

        setDeleting(true)
        setMessage(null)
        try {
            const ids = Array.from(selectedIds)
            const { error } = await supabase
                .from('external_expenses_cache')
                .delete()
                .in('id', ids)

            if (error) throw error

            setMessage({ text: `🗑️ تم حذف ${ids.length} سجل بنجاح`, type: 'success' })
            setSelectedIds(new Set())
            loadData()
        } catch (err: unknown) {
            setMessage({ text: err instanceof Error ? err.message : 'خطأ في الحذف', type: 'error' })
        } finally {
            setDeleting(false)
        }
    }, [selectedIds, supabase, loadData])

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // ─── Toggle redistributable ──────────────────────────────────────────────
    const toggleRedistributable = useCallback(async (id: string, currentValue: boolean) => {
        const newValue = !currentValue
        // Optimistic update
        setData(prev => prev.map(r => r.id === id ? { ...r, redistributable: newValue } : r))
        try {
            const { error } = await supabase
                .from('external_expenses_cache')
                .update({ redistributable: newValue })
                .eq('id', id)
            if (error) throw error
        } catch {
            // Revert on error
            setData(prev => prev.map(r => r.id === id ? { ...r, redistributable: currentValue } : r))
            setMessage({ text: 'خطأ في تحديث قابلية إعادة التوزيع', type: 'error' })
        }
    }, [supabase])

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredData.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredData.map(r => r.id)))
        }
    }

    // ─── Filtered data ───────────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        if (!data.length) return []
        if (!searchQuery.trim()) return data
        const q = searchQuery.toLowerCase()
        return data.filter(r =>
            r.costCenter.toLowerCase().includes(q) ||
            r.accountName.toLowerCase().includes(q) ||
            r.accountCode.includes(q) ||
            r.companyName.toLowerCase().includes(q)
        )
    }, [data, searchQuery])

    // ─── Grouped data ────────────────────────────────────────────────────────
    const groupedData = useMemo(() => {
        if (groupBy === 'none') return null
        const groups: Record<string, { label: string; rows: ExternalExpenseRow[]; total: number }> = {}
        filteredData.forEach(row => {
            let key: string, label: string
            switch (groupBy) {
                case 'costCenter': key = row.costCenter; label = row.costCenter; break
                case 'account': key = row.accountCode; label = `${row.accountCode} - ${row.accountName}`; break
                case 'month': key = row.expenseDate; label = row.expenseDate; break
                case 'company': key = String(row.companyId); label = row.companyName; break
                default: key = 'all'; label = 'الكل'
            }
            if (!groups[key]) groups[key] = { label, rows: [], total: 0 }
            groups[key].rows.push(row)
            groups[key].total += row.expenses
        })
        return Object.entries(groups).sort(([, a], [, b]) => b.total - a.total).map(([key, val]) => ({ key, ...val }))
    }, [filteredData, groupBy])

    const toggleGroup = (key: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev)
            if (next.has(key)) { next.delete(key) } else { next.add(key) }
            return next
        })
    }

    // ─── KPIs ────────────────────────────────────────────────────────────────
    const totalExpenses = data.reduce((s, r) => s + r.expenses, 0)
    const totalAccounts = new Set(data.map(r => r.accountCode)).size
    const uniqueCostCenters = new Set(data.map(r => r.costCenter)).size

    const fmt = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
    const fmtDec = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="p-4 md:p-8 space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">المصاريف الفعلية (خارجي)</h1>
                    <p className="text-gray-500 mt-1">بيانات المصاريف الفعلية المستوردة من النظام المحاسبي — محفوظة تلقائياً</p>
                </div>
                <Button
                    onClick={loadData}
                    disabled={loading}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 h-10 rounded-xl text-sm font-medium transition-colors"
                >
                    🔄 إعادة تحميل
                </Button>
            </div>

            {/* KPI Cards */}
            {data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي المصاريف</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{fmt(totalExpenses)} <span className="text-base font-medium text-gray-400">ر.س</span></p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                        <p className="text-gray-500 text-sm font-medium mb-1">عدد الحسابات</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{totalAccounts}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                        <p className="text-gray-500 text-sm font-medium mb-1">عدد السجلات</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{data.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
                        <p className="text-gray-500 text-sm font-medium mb-1">مراكز التكلفة</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{uniqueCostCenters}</p>
                    </div>
                </div>
            )}

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            {/* Input Card */}
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
                            placeholder="افتح الرابط في المتصفح → انسخ كل النص (Ctrl+A, Ctrl+C) → الصقه هنا (Ctrl+V)"
                            title="بيانات JSON"
                            className="w-full h-28 px-4 py-3 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono resize-y"
                            dir="ltr"
                        />
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleUpdate}
                                disabled={processing}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-11 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جارٍ التحديث...
                                    </span>
                                ) : '⚡ تحديث البيانات'}
                            </Button>
                            <span className="text-xs text-gray-400">يحدّث المبالغ فقط ويحافظ على الربط — سجلات جديدة تُضاف تلقائياً</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card className="border-gray-200 shadow-sm overflow-hidden slide-in-bottom">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-gray-800 text-lg">سجل المصاريف المحفوظة ({data.length} سجل)</CardTitle>
                        {selectedIds.size > 0 && (
                            <Button
                                onClick={handleBulkDelete}
                                disabled={deleting}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 h-9 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                            >
                                {deleting ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جارٍ الحذف...
                                    </span>
                                ) : `🗑️ حذف المحدد (${selectedIds.size})`}
                            </Button>
                        )}
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
                        <input
                            type="text"
                            placeholder="بحث في الحسابات أو مراكز التكلفة..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-1 focus:border-blue-500 focus:outline-none text-sm w-full md:w-72"
                        />
                        <select
                            value={groupBy}
                            onChange={(e) => { setGroupBy(e.target.value as GroupByMode); setCollapsedGroups(new Set()) }}
                            title="طريقة التجميع"
                            className="h-10 rounded-lg border border-gray-300 bg-white text-gray-900 px-3 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                            <option value="none">بدون تجميع</option>
                            <option value="costCenter">تجميع حسب مركز التكلفة</option>
                            <option value="account">تجميع حسب الحساب</option>
                            <option value="month">تجميع حسب التاريخ</option>
                            <option value="company">تجميع حسب الشركة</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500 font-medium flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                <p>جارٍ تحميل البيانات المحفوظة...</p>
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <span className="text-4xl mb-4 block">📭</span>
                                <p className="text-lg font-medium text-gray-900 mb-1">{data.length === 0 ? 'لا توجد بيانات محفوظة' : 'لا توجد نتائج'}</p>
                                <p className="text-sm">{data.length === 0 ? 'الصق بيانات JSON أعلاه واضغط "استبدال الكل" لحفظها' : 'جرب تعديل كلمة البحث'}</p>
                            </div>
                        ) : groupBy !== 'none' && groupedData ? (
                            <div className="divide-y divide-gray-100">
                                {groupedData.map((group) => (
                                    <div key={group.key}>
                                        <button onClick={() => toggleGroup(group.key)} className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-l from-gray-50 to-blue-50/50 hover:from-gray-100 hover:to-blue-50 transition-colors text-right">
                                            <div className="flex items-center gap-3">
                                                <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${collapsedGroups.has(group.key) ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                <span className="font-semibold text-gray-900 text-sm">{group.label}</span>
                                                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{group.rows.length}</span>
                                            </div>
                                            <span className="text-blue-700 font-bold text-sm">{fmtDec(group.total)} ر.س</span>
                                        </button>
                                        {!collapsedGroups.has(group.key) && (
                                            <table className="w-full text-sm text-right">
                                                <thead className="text-xs text-gray-500 uppercase bg-white border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-3 py-3 w-10"><input type="checkbox" title="تحديد المجموعة" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={group.rows.every(r => selectedIds.has(r.id))} onChange={() => { const allSelected = group.rows.every(r => selectedIds.has(r.id)); setSelectedIds(prev => { const next = new Set(prev); group.rows.forEach(r => allSelected ? next.delete(r.id) : next.add(r.id)); return next }) }} /></th>
                                                        <th className="px-6 py-3 font-semibold">الشركة</th>
                                                        <th className="px-6 py-3 font-semibold">مركز التكلفة</th>
                                                        <th className="px-6 py-3 font-semibold">كود الحساب</th>
                                                        <th className="px-6 py-3 font-semibold">اسم الحساب</th>
                                                        <th className="px-6 py-3 font-semibold">التاريخ</th>
                                                        <th className="px-6 py-3 font-semibold">المبلغ</th>
                                                        <th className="px-6 py-3 font-semibold">إعادة التوزيع</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {group.rows.map((row) => (
                                                        <tr key={row.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.has(row.id) ? 'bg-blue-50/50' : ''}`}>
                                                            <td className="px-3 py-3"><input type="checkbox" title="تحديد" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                                                            <td className="px-6 py-3 text-gray-700 text-xs max-w-[200px] truncate" title={row.companyName}>{row.companyName.length > 30 ? row.companyName.substring(0, 30) + '...' : row.companyName}</td>
                                                            <td className="px-6 py-3 text-gray-700">{row.costCenter}</td>
                                                            <td className="px-6 py-3 text-gray-500 font-mono text-xs" dir="ltr">{row.accountCode}</td>
                                                            <td className="px-6 py-3 text-gray-900">{row.accountName}</td>
                                                            <td className="px-6 py-3 text-gray-600"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-xs font-medium">{row.expenseDate}</span></td>
                                                            <td className="px-6 py-3 text-blue-700 font-semibold whitespace-nowrap" dir="ltr">{fmtDec(row.expenses)} ر.س</td>
                                                            <td className="px-6 py-3 text-center">
                                                                <button
                                                                    onClick={() => toggleRedistributable(row.id, row.redistributable)}
                                                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                                                                        row.redistributable
                                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                                    }`}
                                                                >
                                                                    {row.redistributable ? 'نعم' : 'لا'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ))}
                                <div className="flex items-center justify-between px-6 py-4 bg-blue-50 border-t-2 border-blue-200">
                                    <span className="font-bold text-blue-900">الإجمالي الكلي ({groupedData.reduce((s, g) => s + g.rows.length, 0)} سجل)</span>
                                    <span className="font-bold text-blue-900 text-lg">{fmtDec(groupedData.reduce((s, g) => s + g.total, 0))} ر.س</span>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-right">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-3 py-4 w-10"><input type="checkbox" title="تحديد الكل" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={filteredData.length > 0 && selectedIds.size === filteredData.length} onChange={toggleSelectAll} /></th>
                                        <th className="px-6 py-4 font-semibold">#</th>
                                        <th className="px-6 py-4 font-semibold">الشركة</th>
                                        <th className="px-6 py-4 font-semibold">مركز التكلفة</th>
                                        <th className="px-6 py-4 font-semibold">كود الحساب</th>
                                        <th className="px-6 py-4 font-semibold">اسم الحساب</th>
                                        <th className="px-6 py-4 font-semibold">التاريخ</th>
                                        <th className="px-6 py-4 font-semibold">المبلغ</th>
                                        <th className="px-6 py-4 font-semibold">إعادة التوزيع</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.map((row, idx) => (
                                        <tr key={row.id} className={`hover:bg-gray-50/50 transition-colors ${selectedIds.has(row.id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-3 py-4"><input type="checkbox" className="w-4 h-4 rounded cursor-pointer accent-blue-600" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} /></td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">{idx + 1}</td>
                                            <td className="px-6 py-4 text-gray-700 text-xs max-w-[200px] truncate" title={row.companyName}>{row.companyName.length > 30 ? row.companyName.substring(0, 30) + '...' : row.companyName}</td>
                                            <td className="px-6 py-4 text-gray-700">{row.costCenter}</td>
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs" dir="ltr">{row.accountCode}</td>
                                            <td className="px-6 py-4 text-gray-900">{row.accountName}</td>
                                            <td className="px-6 py-4 text-gray-600"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium">{row.expenseDate}</span></td>
                                            <td className="px-6 py-4 text-blue-700 font-semibold whitespace-nowrap" dir="ltr">{fmtDec(row.expenses)} ر.س</td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => toggleRedistributable(row.id, row.redistributable)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                                                        row.redistributable
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    }`}
                                                >
                                                    {row.redistributable ? 'نعم' : 'لا'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                                        <td colSpan={8} className="px-6 py-4 font-bold text-blue-900">الإجمالي ({filteredData.length} سجل)</td>
                                        <td className="px-6 py-4 font-bold text-blue-900 whitespace-nowrap" dir="ltr">{fmtDec(filteredData.reduce((s, r) => s + r.expenses, 0))} ر.س</td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
