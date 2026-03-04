'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronLeft, Pencil, Check, X, Merge, Unlink, CheckSquare, Square } from 'lucide-react'

function formatCurrency(val: number) {
    return new Intl.NumberFormat('ar-SA', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' ر.س'
}

function formatPercent(val: number) {
    return val.toFixed(1) + '%'
}

export interface ExpenseEntry {
    id: string
    project_id: string
    project_name: string
    target_amount: number
    actualAmount: number
}

export interface ComparisonRow {
    name: string
    entries: ExpenseEntry[]
    totalBudget: number
    totalActual: number
}

export interface StaffingEntry {
    id: string
    project_id: string
    project_name: string
    role_name: string
    staff_count: number
    monthly_salary: number
    duration_months: number
    actualAmount: number
}

interface MergeGroup {
    id: string
    displayName: string
    memberNames: string[]
}

interface DisplayRow extends ComparisonRow {
    isMerged?: boolean
    mergeGroupId?: string
}

interface Props {
    rows: ComparisonRow[]
    staffingRow: {
        entries: StaffingEntry[]
        totalBudget: number
        totalActual: number
    }
}

const STORAGE_KEY = 'budget-merge-groups'

export default function BudgetComparisonClient({ rows: initialRows, staffingRow }: Props) {
    const supabase = createClient()

    const [rows, setRows] = useState<ComparisonRow[]>(initialRows)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const [staffingExpanded, setStaffingExpanded] = useState(false)

    // ─── Merge state (lazy initializer: تحميل من localStorage عند أول تهيئة فقط) ───
    const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return saved ? (JSON.parse(saved) as MergeGroup[]) : []
        } catch { return [] }
    })
    const [mergeMode, setMergeMode] = useState(false)
    const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set())
    const [showMergeDialog, setShowMergeDialog] = useState(false)
    const [mergeNameInput, setMergeNameInput] = useState('')

    // احفظ مجموعات الدمج في localStorage عند كل تغيير
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeGroups))
        } catch { /* ignore */ }
    }, [mergeGroups])

    // ─── Compute display rows (with merges applied) ───
    const displayRows: DisplayRow[] = useMemo(() => {
        const mergedNames = new Set<string>()
        const mergedDisplayRows: DisplayRow[] = []

        mergeGroups.forEach(group => {
            const groupRows = rows.filter(r => group.memberNames.includes(r.name))
            if (groupRows.length === 0) return
            groupRows.forEach(r => mergedNames.add(r.name))
            mergedDisplayRows.push({
                name: group.displayName,
                entries: groupRows.flatMap(r => r.entries),
                totalBudget: groupRows.reduce((s, r) => s + r.totalBudget, 0),
                totalActual: groupRows.reduce((s, r) => s + r.totalActual, 0),
                isMerged: true,
                mergeGroupId: group.id,
            })
        })

        const unmerggedRows: DisplayRow[] = rows
            .filter(r => !mergedNames.has(r.name))
            .map(r => ({ ...r, isMerged: false }))

        return [...mergedDisplayRows, ...unmerggedRows].sort((a, b) => b.totalBudget - a.totalBudget)
    }, [rows, mergeGroups])

    // ─── Totals ───
    const totalBudget = useMemo(() =>
        rows.reduce((s, r) => s + r.totalBudget, 0) + staffingRow.totalBudget, [rows, staffingRow])

    const totalActual = useMemo(() =>
        rows.reduce((s, r) => s + r.totalActual, 0) + staffingRow.totalActual, [rows, staffingRow])

    const totalVariance = totalBudget - totalActual
    const totalPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0

    // ─── Merge actions ───
    const confirmMerge = () => {
        const name = mergeNameInput.trim()
        if (!name || selectedForMerge.size < 2) return
        const group: MergeGroup = {
            id: Date.now().toString(),
            displayName: name,
            memberNames: Array.from(selectedForMerge),
        }
        setMergeGroups(prev => [...prev, group])
        setSelectedForMerge(new Set())
        setMergeNameInput('')
        setShowMergeDialog(false)
        setMergeMode(false)
        setMsg('✅ تم دمج البنود')
        setTimeout(() => setMsg(''), 2500)
    }

    const unmerge = (mergeGroupId: string) => {
        setMergeGroups(prev => prev.filter(g => g.id !== mergeGroupId))
        setMsg('تم فك الدمج')
        setTimeout(() => setMsg(''), 2000)
    }

    const toggleSelectForMerge = (name: string) => {
        setSelectedForMerge(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    // ─── Expand ───
    const toggleExpand = (name: string) => {
        if (mergeMode) return
        setExpanded(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    // ─── Edit ───
    const startEdit = (entry: ExpenseEntry) => {
        setEditingId(entry.id)
        setEditValue(String(entry.target_amount))
    }

    const cancelEdit = () => { setEditingId(null); setEditValue('') }

    const saveEdit = async (rowName: string, entryId: string) => {
        const newAmount = parseFloat(editValue)
        if (isNaN(newAmount) || newAmount < 0) { setMsg('قيمة غير صالحة'); return }
        setSaving(true)
        const { error } = await supabase.from('project_expenses').update({ target_amount: newAmount }).eq('id', entryId)
        setSaving(false)
        if (error) { setMsg('خطأ: ' + error.message); return }

        setRows(prev => prev.map(r => {
            if (r.name !== rowName) return r
            const newEntries = r.entries.map(e => e.id === entryId ? { ...e, target_amount: newAmount } : e)
            return { ...r, entries: newEntries, totalBudget: newEntries.reduce((s, e) => s + e.target_amount, 0) }
        }))
        setEditingId(null)
        setEditValue('')
        setMsg('✅ تم الحفظ')
        setTimeout(() => setMsg(''), 2500)
    }

    // ─── Variance badge ───
    const varianceBadge = (variance: number, pct: number) => {
        const isOver = variance < 0
        return (
            <div className="flex flex-col gap-0.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOver ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    <span dir="ltr">{variance < 0 ? '-' : '+'}</span> {formatCurrency(Math.abs(variance))}
                </span>
                <span className={`text-[10px] font-medium ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                    {formatPercent(pct)} صرف
                </span>
            </div>
        )
    }

    return (
        <div className="space-y-4" dir="rtl">
            {/* ─── Merge Dialog ─── */}
            {showMergeDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowMergeDialog(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()} dir="rtl">
                        <h3 className="text-gray-900 font-bold text-lg mb-1">دمج البنود المحددة</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            سيتم دمج <span className="font-bold text-blue-600">{selectedForMerge.size} بنود</span> كعرض واحد دون تغيير البيانات الأصلية.
                        </p>
                        <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
                            {Array.from(selectedForMerge).map(n => (
                                <div key={n} className="flex items-center gap-2 text-sm text-gray-700">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                    {n}
                                </div>
                            ))}
                        </div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">اسم البند الموحّد</label>
                        <input
                            type="text"
                            value={mergeNameInput}
                            onChange={e => setMergeNameInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && confirmMerge()}
                            placeholder="مثال: مصاريف التشغيل"
                            title="اسم البند الموحّد"
                            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={confirmMerge}
                                disabled={!mergeNameInput.trim()}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 transition-colors"
                            >
                                تأكيد الدمج
                            </button>
                            <button
                                onClick={() => { setShowMergeDialog(false); setMergeNameInput('') }}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── KPI Strip ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'إجمالي الموازنة', value: formatCurrency(totalBudget), color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: 'إجمالي المصاريف الفعلية', value: formatCurrency(totalActual), color: totalActual > totalBudget ? 'text-red-700' : 'text-emerald-700', bg: totalActual > totalBudget ? 'bg-red-50' : 'bg-emerald-50', border: totalActual > totalBudget ? 'border-red-100' : 'border-emerald-100' },
                    { label: 'الوفر / التجاوز', value: (totalVariance < 0 ? '- ' : '+ ') + formatCurrency(Math.abs(totalVariance)), color: totalVariance >= 0 ? 'text-emerald-700' : 'text-red-700', bg: totalVariance >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: totalVariance >= 0 ? 'border-emerald-100' : 'border-red-100' },
                    { label: 'معدل الصرف الإجمالي', value: formatPercent(totalPct), color: totalPct >= 100 ? 'text-red-700' : totalPct >= 80 ? 'text-amber-700' : 'text-blue-700', bg: totalPct >= 100 ? 'bg-red-50' : totalPct >= 80 ? 'bg-amber-50' : 'bg-blue-50', border: totalPct >= 100 ? 'border-red-100' : totalPct >= 80 ? 'border-amber-100' : 'border-blue-100' },
                ].map(kpi => (
                    <div key={kpi.label} className={`${kpi.bg} border ${kpi.border} rounded-xl p-4`}>
                        <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
                        <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* ─── Notification ─── */}
            {msg && (
                <div className={`text-sm px-4 py-2 rounded-lg font-medium border ${msg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {msg}
                </div>
            )}

            {/* ─── Toolbar ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    {!mergeMode ? (
                        <button
                            onClick={() => { setMergeMode(true); setSelectedForMerge(new Set()) }}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-xl text-sm font-medium transition-colors"
                        >
                            <Merge size={15} />
                            دمج البنود المكررة
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-violet-700 font-medium bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-200">
                                وضع الدمج — حدد {selectedForMerge.size} بند
                            </span>
                            <button
                                onClick={() => {
                                    if (selectedForMerge.size >= 2) {
                                        setMergeNameInput(Array.from(selectedForMerge)[0])
                                        setShowMergeDialog(true)
                                    }
                                }}
                                disabled={selectedForMerge.size < 2}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                            >
                                <Merge size={14} /> دمج المحدد
                            </button>
                            <button
                                onClick={() => { setMergeMode(false); setSelectedForMerge(new Set()) }}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    )}

                    {mergeGroups.length > 0 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                            {mergeGroups.length} دمج نشط
                        </span>
                    )}
                </div>

                {mergeMode && (
                    <p className="text-xs text-gray-400">
                        البيانات الأصلية لن تتأثر — الدمج للعرض فقط
                    </p>
                )}
            </div>

            {/* ─── Main Table ─── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 whitespace-nowrap">
                    {mergeMode && <div className="col-span-1 text-center">✓</div>}
                    <div className={mergeMode ? 'col-span-3' : 'col-span-4'}>البند</div>
                    <div className="col-span-2">الموازنة الإجمالية</div>
                    <div className="col-span-2">المصاريف الفعلية</div>
                    <div className="col-span-3">الانحراف / معدل الصرف</div>
                    <div className="col-span-2 text-center">إجراءات</div>
                </div>

                {/* Staffing Row */}
                <div>
                    <div
                        className="grid grid-cols-12 gap-2 px-5 py-4 border-b border-gray-100 hover:bg-violet-50/30 transition-colors cursor-pointer"
                        onClick={() => !mergeMode && setStaffingExpanded(v => !v)}
                    >
                        {mergeMode && <div className="col-span-1" />}
                        <div className={`${mergeMode ? 'col-span-3' : 'col-span-4'} flex items-center gap-2`}>
                            <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-base shrink-0">👥</span>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">الكوادر والرواتب</p>
                                <p className="text-xs text-violet-500">{staffingRow.entries.length} مشروع</p>
                            </div>
                        </div>
                        <div className="col-span-2 flex items-center text-blue-700 font-semibold text-sm">{formatCurrency(staffingRow.totalBudget)}</div>
                        <div className="col-span-2 flex items-center text-emerald-700 font-semibold text-sm">{formatCurrency(staffingRow.totalActual)}</div>
                        <div className="col-span-3 flex items-center">
                            {varianceBadge(staffingRow.totalBudget - staffingRow.totalActual, staffingRow.totalBudget > 0 ? (staffingRow.totalActual / staffingRow.totalBudget) * 100 : 0)}
                        </div>
                        <div className="col-span-2 flex items-center justify-center">
                            {staffingExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronLeft size={16} className="text-gray-400" />}
                        </div>
                    </div>

                    {staffingExpanded && (
                        <div className="bg-violet-50/20 border-b border-violet-100/50">
                            {/* Header sub-row */}
                            <div className="grid grid-cols-12 gap-2 px-8 py-2 text-[10px] font-bold text-gray-400 border-b border-violet-100/50 uppercase tracking-wide">
                                <div className="col-span-4">المشروع / الدور</div>
                                <div className="col-span-3">الموازنة (كوادر)</div>
                                <div className="col-span-3">المصاريف الفعلية</div>
                                <div className="col-span-2">الانحراف</div>
                            </div>
                            {staffingRow.entries.map(s => {
                                const rowBudget = s.staff_count * s.monthly_salary * s.duration_months
                                const rowVariance = rowBudget - s.actualAmount
                                return (
                                    <div key={s.id} className="grid grid-cols-12 gap-2 px-8 py-3 border-b border-violet-100/30 last:border-0 text-xs hover:bg-violet-50/30 transition-colors">
                                        <div className="col-span-4">
                                            <p className="font-medium text-gray-800">{s.project_name}</p>
                                            <p className="text-gray-400">{s.role_name} · {s.staff_count} × {formatCurrency(s.monthly_salary)} × {s.duration_months}م</p>
                                        </div>
                                        <div className="col-span-3 flex items-center text-blue-600 font-semibold">{formatCurrency(rowBudget)}</div>
                                        <div className="col-span-3 flex items-center">
                                            {s.actualAmount > 0
                                                ? <span className="text-emerald-700 font-semibold">{formatCurrency(s.actualAmount)}</span>
                                                : <span className="text-gray-300">—</span>
                                            }
                                        </div>
                                        <div className="col-span-2 flex items-center">
                                            {s.actualAmount > 0 && (
                                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rowVariance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                                    <span dir="ltr">{rowVariance < 0 ? '-' : '+'}</span> {formatCurrency(Math.abs(rowVariance))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Expense Rows */}
                {displayRows.map((row, ri) => {
                    const variance = row.totalBudget - row.totalActual
                    const pct = row.totalBudget > 0 ? (row.totalActual / row.totalBudget) * 100 : 0
                    const isExpanded = expanded.has(row.name)
                    const isSelected = mergeMode && selectedForMerge.has(row.name)

                    return (
                        <div key={row.mergeGroupId ?? row.name} className={`${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                            {/* Main Row */}
                            <div
                                className={`grid grid-cols-12 gap-2 px-5 py-4 border-b border-gray-100 transition-colors ${mergeMode ? 'cursor-pointer hover:bg-blue-50/40' : 'cursor-pointer hover:bg-blue-50/20'}`}
                                onClick={() => mergeMode ? toggleSelectForMerge(row.name) : toggleExpand(row.name)}
                            >
                                {/* Merge checkbox */}
                                {mergeMode && !row.isMerged && (
                                    <div className="col-span-1 flex items-center justify-center">
                                        {isSelected
                                            ? <CheckSquare size={18} className="text-blue-600" />
                                            : <Square size={18} className="text-gray-300" />
                                        }
                                    </div>
                                )}
                                {mergeMode && row.isMerged && <div className="col-span-1" />}

                                <div className={`${mergeMode ? 'col-span-3' : 'col-span-4'} flex items-center gap-2`}>
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${row.isMerged ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {row.isMerged ? '🔗' : '💼'}
                                    </span>
                                    <div>
                                        <p className="font-bold text-gray-900 text-sm">{row.name}</p>
                                        <p className={`text-xs ${row.isMerged ? 'text-blue-400' : 'text-indigo-400'}`}>
                                            {row.isMerged ? `مدموج (${row.entries.length} بند)` : `${row.entries.length} مشروع`}
                                        </p>
                                    </div>
                                </div>

                                <div className="col-span-2 flex items-center text-blue-700 font-semibold text-sm">{formatCurrency(row.totalBudget)}</div>
                                <div className="col-span-2 flex items-center text-emerald-700 font-semibold text-sm">
                                    {row.totalActual > 0 ? formatCurrency(row.totalActual) : <span className="text-gray-300 text-xs">لا يوجد</span>}
                                </div>
                                <div className="col-span-3 flex items-center">{varianceBadge(variance, pct)}</div>
                                <div className="col-span-2 flex items-center justify-center gap-2">
                                    {row.isMerged && (
                                        <button
                                            onClick={e => { e.stopPropagation(); unmerge(row.mergeGroupId!) }}
                                            className="flex items-center gap-1 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                                            title="فك الدمج"
                                        >
                                            <Unlink size={14} />
                                        </button>
                                    )}
                                    {!mergeMode && (
                                        isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronLeft size={16} className="text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded Breakdown */}
                            {!mergeMode && isExpanded && (
                                <div className="bg-blue-50/10 border-b border-blue-100/50">
                                    <div className="grid grid-cols-12 gap-2 px-8 py-2 text-[10px] font-bold text-gray-400 border-b border-blue-100/50 uppercase tracking-wide">
                                        <div className="col-span-4">المشروع {row.isMerged && '/ البند'}</div>
                                        <div className="col-span-3">الموازنة المستهدفة</div>
                                        <div className="col-span-3">المصاريف الفعلية</div>
                                        <div className="col-span-2 text-center">تعديل</div>
                                    </div>
                                    {row.entries.map(entry => {
                                        const isEditing = editingId === entry.id
                                        return (
                                            <div key={entry.id} className="grid grid-cols-12 gap-2 px-8 py-3 border-b border-blue-100/20 last:border-0 text-xs hover:bg-blue-50/30 transition-colors">
                                                <div className="col-span-4">
                                                    <p className="font-medium text-gray-800">{entry.project_name}</p>
                                                    {row.isMerged && <p className="text-gray-400 text-[10px]">{entry.id}</p>}
                                                </div>
                                                <div className="col-span-3 flex items-center">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            title="الموازنة المستهدفة"
                                                            placeholder="0"
                                                            className="w-full border border-blue-400 rounded-lg px-2 py-1 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="text-blue-700 font-semibold">{formatCurrency(entry.target_amount)}</span>
                                                    )}
                                                </div>
                                                <div className="col-span-3 flex items-center">
                                                    {entry.actualAmount > 0
                                                        ? <span className="text-emerald-700 font-semibold">{formatCurrency(entry.actualAmount)}</span>
                                                        : <span className="text-gray-300">—</span>
                                                    }
                                                </div>
                                                <div className="col-span-2 flex items-center justify-center gap-2">
                                                    {isEditing ? (
                                                        <>
                                                            <button onClick={() => saveEdit(row.name, entry.id)} disabled={saving} className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 disabled:opacity-50" title="حفظ">
                                                                <Check size={13} />
                                                            </button>
                                                            <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600" title="إلغاء">
                                                                <X size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); startEdit(entry) }}
                                                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                            title="تعديل الموازنة"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Progress bar */}
                <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-700">معدل الصرف الإجمالي</span>
                        <span className={`text-sm font-bold ${totalPct >= 100 ? 'text-red-600' : totalPct >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {formatPercent(totalPct)}
                        </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${totalPct >= 100 ? 'bg-red-500' : totalPct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(totalPct, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Grand Total */}
                <div className="grid grid-cols-12 gap-2 px-5 py-4 bg-gradient-to-l from-blue-600 to-indigo-700 text-white">
                    <div className="col-span-4">
                        <p className="font-black text-base">Σ الإجمالي الكلي</p>
                        <p className="text-blue-200 text-xs">{displayRows.length + 1} بند</p>
                    </div>
                    <div className="col-span-2 font-black text-base">{formatCurrency(totalBudget)}</div>
                    <div className="col-span-2 font-black text-base">{formatCurrency(totalActual)}</div>
                    <div className="col-span-3">
                        <p className={`font-black text-base ${totalVariance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            <span dir="ltr">{totalVariance < 0 ? '- ' : '+ '}</span>
                            {formatCurrency(Math.abs(totalVariance))}
                        </p>
                        <p className="text-blue-200 text-xs">{formatPercent(totalPct)} معدل الصرف</p>
                    </div>
                    <div className="col-span-1" />
                </div>
            </div>
        </div>
    )
}
