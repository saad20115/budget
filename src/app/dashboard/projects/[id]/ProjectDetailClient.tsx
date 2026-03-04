'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProjectAnalytics } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/analytics'
import { BudgetVsActualChart, ExpensePieChart } from '@/components/Charts'
import AIAssistant from '@/components/AIAssistant'
import ExpenseTrendChart from '@/components/ExpenseTrendChart'
import ExportButtons from '@/components/ExportButtons'
import Link from 'next/link'

interface Props { analytics: ProjectAnalytics }

export default function ProjectDetailClient({ analytics }: Props) {
    const {
        project, staffingItems, expenseItems, actualExpenses,
        totalStaffingBudget, totalExpensesBudget, totalBudget,
        totalActual, variance, variancePercent, netProfit, profitMargin, healthStatus,
    } = analytics

    const router = useRouter()
    const supabase = createClient()
    const [tab, setTab] = useState<'overview' | 'staffing' | 'budget' | 'actual'>('overview')
    const [showStaffForm, setShowStaffForm] = useState(false)
    const [showExpForm, setShowExpForm] = useState(false)
    const [staffForm, setStaffForm] = useState({ role_name: '', staff_count: '1', monthly_salary: '', duration_months: String(project.duration_months) })
    const [expForm, setExpForm] = useState({ name: '', target_amount: '' })
    const [actForm, setActForm] = useState({ amount: '', expense_date: '', notes: '', staffing_id: '', expense_id: '' })
    const [showActForm, setShowActForm] = useState(false)
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null)
    const [editingExpId, setEditingExpId] = useState<string | null>(null)
    const [editingActId, setEditingActId] = useState<string | null>(null)

    // Selection state for bulk actions
    const [selectedStaffing, setSelectedStaffing] = useState<string[]>([])
    const [selectedExp, setSelectedExp] = useState<string[]>([])
    const [selectedAct, setSelectedAct] = useState<string[]>([])

    const [loading, setLoading] = useState(false)

    const healthColors = {
        green: 'text-green-700 bg-green-50 border-green-200',
        yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
        red: 'text-red-700 bg-red-50 border-red-200',
    }
    const healthLabels = { green: '🟢 جيد', yellow: '🟡 تنبيه', red: '🔴 خطر' }

    // الرواتب الفعلية = كل ما هو مرتبط بـ staffing_id
    const staffingActual = actualExpenses
        .filter(a => a.staffing_id)
        .reduce((sum, a) => sum + a.amount, 0)

    const barData = [
        // بند الكوادر والرواتب المجمّع
        ...(staffingItems.length > 0 ? [{
            name: 'الكوادر والرواتب',
            budget: totalStaffingBudget,
            actual: staffingActual,
        }] : []),
        // بنود المصاريف الأخرى
        ...expenseItems.map(e => ({
            name: e.name,
            budget: e.target_amount,
            actual: actualExpenses.filter(a => a.expense_id === e.id).reduce((sum, a) => sum + a.amount, 0),
        })),
    ]

    const pieData = barData.filter(d => d.actual > 0).map(d => ({ name: d.name, value: d.actual }))

    const saveStaffing = async () => {
        setLoading(true)
        if (editingStaffId) {
            await supabase.from('project_staffing').update({
                role_name: staffForm.role_name,
                staff_count: parseFloat(staffForm.staff_count),
                monthly_salary: parseFloat(staffForm.monthly_salary),
                duration_months: parseInt(staffForm.duration_months),
            }).eq('id', editingStaffId)
        } else {
            await supabase.from('project_staffing').insert({
                project_id: project.id,
                role_name: staffForm.role_name,
                staff_count: parseFloat(staffForm.staff_count),
                monthly_salary: parseFloat(staffForm.monthly_salary),
                duration_months: parseInt(staffForm.duration_months),
            })
        }
        setShowStaffForm(false)
        setEditingStaffId(null)
        setStaffForm({ role_name: '', staff_count: '1', monthly_salary: '', duration_months: String(project.duration_months) })
        setLoading(false)
        router.refresh()
    }

    const deleteStaffing = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الكادر؟')) return
        setLoading(true)
        await supabase.from('project_staffing').delete().eq('id', id)
        setSelectedStaffing(prev => prev.filter(sel => sel !== id))
        setLoading(false)
        router.refresh()
    }

    const deleteSelectedStaffing = async () => {
        if (selectedStaffing.length === 0 || !confirm(`هل أنت متأكد من حذف ${selectedStaffing.length} عناصر؟`)) return
        setLoading(true)
        await supabase.from('project_staffing').delete().in('id', selectedStaffing)
        setSelectedStaffing([])
        setLoading(false)
        router.refresh()
    }

    const startEditingStaff = (s: { id: string, role_name: string, staff_count: number, monthly_salary: number, duration_months: number }) => {
        setStaffForm({ role_name: s.role_name, staff_count: String(s.staff_count), monthly_salary: String(s.monthly_salary), duration_months: String(s.duration_months) })
        setEditingStaffId(s.id)
        setShowStaffForm(true)
    }

    const saveExpense = async () => {
        setLoading(true)
        if (editingExpId) {
            await supabase.from('project_expenses').update({
                name: expForm.name,
                target_amount: parseFloat(expForm.target_amount),
            }).eq('id', editingExpId)
        } else {
            await supabase.from('project_expenses').insert({
                project_id: project.id,
                name: expForm.name,
                target_amount: parseFloat(expForm.target_amount),
            })
        }
        setShowExpForm(false)
        setEditingExpId(null)
        setExpForm({ name: '', target_amount: '' })
        setLoading(false)
        router.refresh()
    }

    const deleteExpense = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا البند؟')) return
        setLoading(true)
        await supabase.from('project_expenses').delete().eq('id', id)
        setSelectedExp(prev => prev.filter(sel => sel !== id))
        setLoading(false)
        router.refresh()
    }

    const deleteSelectedExp = async () => {
        if (selectedExp.length === 0 || !confirm(`هل أنت متأكد من حذف ${selectedExp.length} عناصر؟`)) return
        setLoading(true)
        await supabase.from('project_expenses').delete().in('id', selectedExp)
        setSelectedExp([])
        setLoading(false)
        router.refresh()
    }

    const startEditingExp = (e: { id: string, name: string, target_amount: number }) => {
        setExpForm({ name: e.name, target_amount: String(e.target_amount) })
        setEditingExpId(e.id)
        setShowExpForm(true)
    }

    const saveActual = async () => {
        setLoading(true)
        const payload = {
            staffing_id: actForm.staffing_id || null,
            expense_id: actForm.expense_id || null,
            amount: parseFloat(actForm.amount),
            expense_date: actForm.expense_date,
            notes: actForm.notes || null,
        }
        if (editingActId) {
            await supabase.from('actual_expenses').update(payload).eq('id', editingActId)
        } else {
            await supabase.from('actual_expenses').insert({ ...payload, project_id: project.id })
        }
        setShowActForm(false)
        setEditingActId(null)
        setActForm({ amount: '', expense_date: '', notes: '', staffing_id: '', expense_id: '' })
        setLoading(false)
        router.refresh()
    }

    const deleteActual = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
        setLoading(true)
        await supabase.from('actual_expenses').delete().eq('id', id)
        setSelectedAct(prev => prev.filter(sel => sel !== id))
        setLoading(false)
        router.refresh()
    }

    const deleteSelectedAct = async () => {
        if (selectedAct.length === 0 || !confirm(`هل أنت متأكد من حذف ${selectedAct.length} عناصر؟`)) return
        setLoading(true)
        await supabase.from('actual_expenses').delete().in('id', selectedAct)
        setSelectedAct([])
        setLoading(false)
        router.refresh()
    }

    const startEditingAct = (a: { id: string, amount: number, expense_date: string, notes?: string | null, staffing_id?: string | null, expense_id?: string | null }) => {
        setActForm({ amount: String(a.amount), expense_date: a.expense_date, notes: a.notes || '', staffing_id: a.staffing_id || '', expense_id: a.expense_id || '' })
        setEditingActId(a.id)
        setShowActForm(true)
    }

    const inputCls = "w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
    const labelCls = "block text-gray-600 text-xs mb-1 font-medium"

    return (
        <div className="p-4 md:p-8" dir="rtl">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 text-sm mb-4 flex items-center gap-2 transition-colors">
                → رجوع إلى قائمة المشاريع
            </button>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                        <p className="text-gray-500">{project.client} · {project.duration_months} شهر</p>
                        <Link href={`/dashboard/projects/${project.id}/edit`} className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2.5 py-0.5 rounded-md transition-colors">
                            تعديل المشروع
                        </Link>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className={`px-4 py-1.5 rounded-full border text-sm font-semibold ${healthColors[healthStatus]}`}>
                        {healthLabels[healthStatus]}
                    </span>
                    <ExportButtons analytics={analytics} />
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
                {[
                    { label: 'قيمة العقد', value: formatCurrency(project.total_value), color: 'text-gray-900' },
                    { label: 'إجمالي الموازنة', value: formatCurrency(totalBudget), color: 'text-blue-600' },
                    { label: 'المصروف الفعلي', value: formatCurrency(totalActual), color: totalActual > totalBudget ? 'text-red-600' : 'text-green-600' },
                    { label: 'الانحراف', value: formatCurrency(Math.abs(variance)), color: variance < 0 ? 'text-red-600' : 'text-green-600' },
                    { label: 'صافي الربح', value: formatCurrency(netProfit), color: netProfit < 0 ? 'text-red-600' : 'text-emerald-600' },
                    { label: 'هامش الربح', value: formatPercent(profitMargin), color: profitMargin < 0 ? 'text-red-600' : 'text-emerald-600' },
                    { label: 'نسبة الصرف', value: formatPercent(variancePercent), color: variancePercent >= 100 ? 'text-red-600' : variancePercent >= 80 ? 'text-yellow-600' : 'text-green-600' },
                    { label: 'الربح المستهدف', value: formatPercent(project.target_profit_margin), color: 'text-gray-600' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <p className="text-gray-500 text-xs mb-1">{kpi.label}</p>
                        <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto hide-scrollbar">
                {[
                    { key: 'overview', label: 'نظرة عامة' },
                    { key: 'staffing', label: 'الكوادر' },
                    { key: 'budget', label: 'الموازنة المستهدفة' },
                    { key: 'actual', label: 'المصاريف الفعلية' },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key as typeof tab)}
                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${tab === t.key
                            ? 'border-blue-600 text-blue-700 bg-blue-50'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW TAB */}
            {tab === 'overview' && (
                <div className="space-y-6">
                    {/* AI Assistant */}
                    <AIAssistant analytics={analytics} />

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-gray-900 font-semibold mb-4">الموازنة مقابل الفعلي</h3>
                            {barData.length > 0 ? <BudgetVsActualChart data={barData} /> : <p className="text-gray-400 text-sm text-center py-12">أضف بنود الموازنة أولاً</p>}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-gray-900 font-semibold mb-4">توزيع المصاريف الفعلية</h3>
                            {pieData.length > 0 ? <ExpensePieChart data={pieData} /> : <p className="text-gray-400 text-sm text-center py-12">لا توجد مصاريف فعلية بعد</p>}
                        </div>
                    </div>

                    {/* Line Chart */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="text-gray-900 font-semibold mb-4">الاتجاه الزمني للمصاريف</h3>
                        <ExpenseTrendChart actualExpenses={actualExpenses} totalBudget={totalBudget} />
                    </div>

                    {/* Variance table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-gray-900 font-semibold">تحليل الانحراف</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs whitespace-nowrap">
                                        <th className="text-right px-5 py-3">البند</th>
                                        <th className="text-right px-5 py-3">الموازنة المستهدفة</th>
                                        <th className="text-right px-5 py-3">الفعلي</th>
                                        <th className="text-right px-5 py-3">الانحراف</th>
                                        <th className="text-right px-5 py-3">نسبة الصرف</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barData.map((row, i) => {
                                        const v = row.actual - row.budget
                                        const pct = row.budget > 0 ? (row.actual / row.budget) * 100 : 0
                                        return (
                                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 whitespace-nowrap">
                                                <td className="px-5 py-3 text-gray-900">{row.name}</td>
                                                <td className="px-5 py-3 text-gray-600">{formatCurrency(row.budget)}</td>
                                                <td className="px-5 py-3 text-gray-600">{formatCurrency(row.actual)}</td>
                                                <td className={`px-5 py-3 font-semibold ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {v > 0 ? '+' : ''}{formatCurrency(v)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${pct >= 100 ? 'text-red-700 bg-red-50 border-red-200'
                                                        : pct >= 80 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                                                            : 'text-green-700 bg-green-50 border-green-200'
                                                        }`}>
                                                        {formatPercent(pct)}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {barData.length === 0 && (
                                        <tr><td colSpan={5} className="text-center text-gray-400 py-8">أضف بنود الموازنة من تبويب الكوادر والمصاريف</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* STAFFING TAB */}
            {tab === 'staffing' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-gray-900 font-semibold">الكوادر البشرية</h2>
                        <button onClick={() => { setShowStaffForm(!showStaffForm); setEditingStaffId(null); setStaffForm({ role_name: '', staff_count: '1', monthly_salary: '', duration_months: String(project.duration_months) }) }} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                            + إضافة كادر
                        </button>
                    </div>

                    {showStaffForm && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-gray-900 font-medium mb-4">{editingStaffId ? 'تعديل بيانات الكادر' : 'إضافة كادر جديد'}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div><label className={labelCls}>المسمى الوظيفي</label><input className={inputCls} value={staffForm.role_name} onChange={e => setStaffForm(p => ({ ...p, role_name: e.target.value }))} placeholder="مثال: مهندس" /></div>
                                <div><label className={labelCls}>العدد</label><input className={inputCls} type="number" step="any" min="0.01" value={staffForm.staff_count} onChange={e => setStaffForm(p => ({ ...p, staff_count: e.target.value }))} placeholder="1" /></div>
                                <div><label className={labelCls}>متوسط الراتب الشهري (ر.س)</label><input className={inputCls} type="number" value={staffForm.monthly_salary} onChange={e => setStaffForm(p => ({ ...p, monthly_salary: e.target.value }))} placeholder="0" /></div>
                                <div><label className={labelCls}>عدد الشهور</label><input className={inputCls} type="number" min="1" value={staffForm.duration_months} onChange={e => setStaffForm(p => ({ ...p, duration_months: e.target.value }))} /></div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                <button onClick={saveStaffing} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">حفظ</button>
                                <button onClick={() => { setShowStaffForm(false); setEditingStaffId(null); setStaffForm({ role_name: '', staff_count: '1', monthly_salary: '', duration_months: String(project.duration_months) }) }} className="text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">إلغاء</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                        {/* Bulk Action Bar */}
                        {selectedStaffing.length > 0 && (
                            <div className="bg-blue-50 border-b border-blue-100 flex items-center justify-between px-5 py-3 fade-in">
                                <span className="text-blue-700 font-medium text-sm">تم تحديد {selectedStaffing.length} عنصر</span>
                                <button onClick={deleteSelectedStaffing} disabled={loading} className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-2">
                                    <Trash2 size={16} /> حذف المحدد
                                </button>
                            </div>
                        )}

                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs whitespace-nowrap">
                                        <th className="px-5 py-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={staffingItems.length > 0 && selectedStaffing.length === staffingItems.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedStaffing(staffingItems.map(s => s.id))
                                                    else setSelectedStaffing([])
                                                }}
                                            />
                                        </th>
                                        <th className="text-right px-5 py-3">المسمى الوظيفي</th>
                                        <th className="text-right px-5 py-3">العدد</th>
                                        <th className="text-right px-5 py-3">الراتب الشهري</th>
                                        <th className="text-right px-5 py-3">الشهور</th>
                                        <th className="text-right px-5 py-3">الإجمالي</th>
                                        <th className="text-center px-5 py-3 w-20">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffingItems.map(s => (
                                        <tr key={s.id} className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedStaffing.includes(s.id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-5 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedStaffing.includes(s.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedStaffing(prev => [...prev, s.id])
                                                        else setSelectedStaffing(prev => prev.filter(id => id !== s.id))
                                                    }}
                                                />
                                            </td>
                                            <td className="px-5 py-3 text-gray-900">{s.role_name}</td>
                                            <td className="px-5 py-3 text-gray-600">{s.staff_count}</td>
                                            <td className="px-5 py-3 text-gray-600">{formatCurrency(s.monthly_salary)}</td>
                                            <td className="px-5 py-3 text-gray-600">{s.duration_months}</td>
                                            <td className="px-5 py-3 text-blue-600 font-semibold">{formatCurrency(s.staff_count * s.monthly_salary * s.duration_months)}</td>
                                            <td className="px-5 py-3 flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditingStaff(s)} className="text-gray-400 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={16} /></button>
                                                <button onClick={() => deleteStaffing(s.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="حذف"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                    {staffingItems.length === 0 && (
                                        <tr><td colSpan={7} className="text-center text-gray-400 py-8">لا توجد كوادر. أضف أول كادر.</td></tr>
                                    )}
                                    {staffingItems.length > 0 && (
                                        <tr className="bg-blue-50 font-semibold">
                                            <td />
                                            <td colSpan={4} className="px-5 py-3 text-gray-700">إجمالي موازنة الكوادر</td>
                                            <td className="px-5 py-3 text-blue-700">{formatCurrency(totalStaffingBudget)}</td>
                                            <td />
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* BUDGET TAB */}
            {tab === 'budget' && (
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-gray-900 font-semibold">بنود المصاريف المستهدفة</h2>
                            <button onClick={() => { setShowExpForm(!showExpForm); setEditingExpId(null); setExpForm({ name: '', target_amount: '' }) }} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                                + إضافة بند
                            </button>
                        </div>

                        {showExpForm && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
                                <h3 className="text-gray-900 font-medium mb-4">{editingExpId ? 'تعديل بيانات البند' : 'إضافة بند جديد'}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div><label className={labelCls}>اسم البند</label><input className={inputCls} title="اسم البند" value={expForm.name} onChange={e => setExpForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: مواد، نقل، استشارات" /></div>
                                    <div><label className={labelCls}>القيمة المستهدفة (ر.س)</label><input className={inputCls} title="القيمة" type="number" value={expForm.target_amount} onChange={e => setExpForm(p => ({ ...p, target_amount: e.target.value }))} placeholder="0" /></div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button onClick={saveExpense} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">حفظ</button>
                                    <button onClick={() => { setShowExpForm(false); setEditingExpId(null); setExpForm({ name: '', target_amount: '' }) }} className="text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-300">إلغاء</button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                            {/* Bulk Action Bar */}
                            {selectedExp.length > 0 && (
                                <div className="bg-blue-50 border-b border-blue-100 flex items-center justify-between px-5 py-3 fade-in">
                                    <span className="text-blue-700 font-medium text-sm">تم تحديد {selectedExp.length} بند</span>
                                    <button onClick={deleteSelectedExp} disabled={loading} className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-2">
                                        <Trash2 size={16} /> حذف المحدد
                                    </button>
                                </div>
                            )}

                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-sm min-w-[400px]">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs whitespace-nowrap">
                                            <th className="px-5 py-3 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={expenseItems.length > 0 && selectedExp.length === expenseItems.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedExp(expenseItems.map(x => x.id))
                                                        else setSelectedExp([])
                                                    }}
                                                />
                                            </th>
                                            <th className="text-right px-5 py-3">اسم البند</th>
                                            <th className="text-right px-5 py-3">القيمة المستهدفة</th>
                                            <th className="text-center px-5 py-3 w-20">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expenseItems.map(e => (
                                            <tr key={e.id} className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedExp.includes(e.id) ? 'bg-blue-50/50' : ''}`}>
                                                <td className="px-5 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        checked={selectedExp.includes(e.id)}
                                                        onChange={(event) => {
                                                            if (event.target.checked) setSelectedExp(prev => [...prev, e.id])
                                                            else setSelectedExp(prev => prev.filter(id => id !== e.id))
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-5 py-3 text-gray-900">{e.name}</td>
                                                <td className="px-5 py-3 text-blue-600 font-semibold">{formatCurrency(e.target_amount)}</td>
                                                <td className="px-5 py-3 flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditingExp(e)} className="text-gray-400 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={16} /></button>
                                                    <button onClick={() => deleteExpense(e.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="حذف"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                        {expenseItems.length === 0 && (
                                            <tr><td colSpan={4} className="text-center text-gray-400 py-8">لا توجد بنود. أضف أول بند مصروف.</td></tr>
                                        )}
                                        {expenseItems.length > 0 && (
                                            <tr className="bg-blue-50 font-semibold">
                                                <td />
                                                <td className="px-5 py-3 text-gray-700">الإجمالي</td>
                                                <td className="px-5 py-3 text-blue-700">{formatCurrency(totalExpensesBudget)}</td>
                                                <td />
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ACTUAL EXPENSES TAB */}
            {tab === 'actual' && (
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-gray-900 font-semibold">المصاريف الفعلية</h2>
                            <button onClick={() => { setShowActForm(!showActForm); setEditingActId(null); setActForm({ amount: '', expense_date: '', notes: '', staffing_id: '', expense_id: '' }) }} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                                + تسجيل مصروف فعلي
                            </button>
                        </div>

                        {showActForm && (
                            <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4 shadow-sm">
                                <h3 className="text-gray-900 font-medium mb-4">{editingActId ? 'تعديل المصروف الفعلي' : 'تسجيل مصروف جديد'}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <div><label className={labelCls}>المبلغ (ر.س)</label><input className={inputCls} title="المبلغ" type="number" value={actForm.amount} onChange={e => setActForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" /></div>
                                    <div><label className={labelCls}>التاريخ</label><input className={inputCls} title="التاريخ" type="date" value={actForm.expense_date} onChange={e => setActForm(p => ({ ...p, expense_date: e.target.value }))} /></div>
                                    <div>
                                        <label className={labelCls}>ربط بكادر (اختياري)</label>
                                        <select title="اختر الكادر" className={inputCls} value={actForm.staffing_id} onChange={e => setActForm(p => ({ ...p, staffing_id: e.target.value, expense_id: '' }))}>
                                            <option value="">-- بدون --</option>
                                            {staffingItems.map(s => <option key={s.id} value={s.id}>{s.role_name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelCls}>ربط ببند (اختياري)</label>
                                        <select title="اختر البند" className={inputCls} value={actForm.expense_id} onChange={e => setActForm(p => ({ ...p, expense_id: e.target.value, staffing_id: '' }))}>
                                            <option value="">-- بدون --</option>
                                            {expenseItems.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2"><label className={labelCls}>ملاحظات</label><input className={inputCls} title="الملاحظات" value={actForm.notes} onChange={e => setActForm(p => ({ ...p, notes: e.target.value }))} placeholder="وصف المصروف..." /></div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button onClick={saveActual} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg">حفظ</button>
                                    <button onClick={() => { setShowActForm(false); setEditingActId(null); setActForm({ amount: '', expense_date: '', notes: '', staffing_id: '', expense_id: '' }) }} className="text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-300">إلغاء</button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">

                            {/* Bulk Action Bar */}
                            {selectedAct.length > 0 && (
                                <div className="bg-emerald-50 border-b border-emerald-100 flex items-center justify-between px-5 py-3 fade-in">
                                    <span className="text-emerald-800 font-medium text-sm">تم تحديد {selectedAct.length} مصروف</span>
                                    <button onClick={deleteSelectedAct} disabled={loading} className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-2">
                                        <Trash2 size={16} /> حذف المحدد
                                    </button>
                                </div>
                            )}

                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-sm min-w-[640px]">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs whitespace-nowrap">
                                            <th className="px-5 py-3 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    checked={actualExpenses.length > 0 && selectedAct.length === actualExpenses.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedAct(actualExpenses.map(a => a.id))
                                                        else setSelectedAct([])
                                                    }}
                                                />
                                            </th>
                                            <th className="text-right px-5 py-3">التاريخ</th>
                                            <th className="text-right px-5 py-3">بند الصرف</th>
                                            <th className="text-right px-5 py-3">المبلغ</th>
                                            <th className="text-right px-5 py-3">ملاحظات</th>
                                            <th className="text-center px-5 py-3 w-20">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {actualExpenses.map(a => {
                                            const linkedStaff = a.staffing_id ? staffingItems.find(s => s.id === a.staffing_id) : null
                                            const linkedExp = a.expense_id ? expenseItems.find(e => e.id === a.expense_id) : null
                                            const linkedLabel = linkedStaff?.role_name ?? linkedExp?.name ?? a.notes ?? null
                                            return (
                                                <tr key={a.id} className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedAct.includes(a.id) ? 'bg-emerald-50/50' : ''}`}>
                                                    <td className="px-5 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                            checked={selectedAct.includes(a.id)}
                                                            onChange={(event) => {
                                                                if (event.target.checked) setSelectedAct(prev => [...prev, a.id])
                                                                else setSelectedAct(prev => prev.filter(id => id !== a.id))
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-500">{a.expense_date}</td>
                                                    <td className="px-5 py-3">
                                                        {linkedLabel ? (
                                                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${linkedStaff
                                                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                                                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                }`}>
                                                                {linkedStaff ? '👥' : '💼'} {linkedLabel}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-emerald-600 font-semibold">{formatCurrency(a.amount)}</td>
                                                    <td className="px-5 py-3 text-gray-600">
                                                        {/* إظهار الملاحظات فقط إذا لم تُستخدم بالفعل كاسم للبند */}
                                                        {(!linkedStaff && !linkedExp && a.notes) ? '-' : (a.notes ?? '-')}
                                                    </td>
                                                    <td className="px-5 py-3 flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditingAct(a)} className="text-gray-400 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={16} /></button>
                                                        <button onClick={() => deleteActual(a.id)} className="text-gray-400 hover:text-red-600 transition-colors" title="حذف"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {actualExpenses.length === 0 && (
                                            <tr><td colSpan={6} className="text-center text-gray-400 py-8">لا توجد مصاريف فعلية بعد.</td></tr>
                                        )}
                                        {actualExpenses.length > 0 && (
                                            <tr className="bg-emerald-50 font-semibold">
                                                <td />
                                                <td className="px-5 py-3 text-gray-700">الإجمالي الفعلي</td>
                                                <td />
                                                <td className="px-5 py-3 text-emerald-700">{formatCurrency(totalActual)}</td>
                                                <td colSpan={2} />
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
