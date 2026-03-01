'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface GroupedExpense {
    name: string
    total_amount: number
    count: number
    ids: string[]
    type: 'expense'
}

interface StaffingGroup {
    role_name: string
    total_amount: number
    count: number         // num projects
    totalStaff: number
    type: 'staffing'
}

type BudgetRow = GroupedExpense | StaffingGroup

export default function BudgetClient() {
    const supabase = createClient()
    const [groupedExpenses, setGroupedExpenses] = useState<GroupedExpense[]>([])
    const [staffingGroups, setStaffingGroups] = useState<StaffingGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
    const [activeTab, setActiveTab] = useState<'all' | 'expenses' | 'staffing'>('all')

    // Filters
    const [searchQuery, setSearchQuery] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
    const [editingGroup, setEditingGroup] = useState<GroupedExpense | null>(null)

    // Bulk Actions
    const [selectedGroups, setSelectedGroups] = useState<string[]>([])

    // Form State
    const [formName, setFormName] = useState('')
    const [formTargetAmount, setFormTargetAmount] = useState<number | ''>('')
    const [formSubmitting, setFormSubmitting] = useState(false)

    // Delete Confirmation
    const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setMessage(null)
        try {
            // Fetch expenses
            const { data: expensesData, error: expensesError } = await supabase
                .from('project_expenses')
                .select('id, name, target_amount')
            if (expensesError) throw expensesError

            // Fetch staffing
            const { data: staffingData, error: staffingError } = await supabase
                .from('project_staffing')
                .select('id, project_id, role_name, staff_count, monthly_salary, duration_months')
            if (staffingError) throw staffingError

            // Group expenses by name
            const grouped = (expensesData || []).reduce((acc: Record<string, GroupedExpense>, curr) => {
                const name = curr.name.trim()
                if (!acc[name]) {
                    acc[name] = { name, total_amount: 0, count: 0, ids: [], type: 'expense' }
                }
                acc[name].total_amount += Number(curr.target_amount)
                acc[name].count += 1
                acc[name].ids.push(curr.id)
                return acc
            }, {})

            // Group staffing by role_name
            const staffGrouped = (staffingData || []).reduce((acc: Record<string, StaffingGroup>, curr) => {
                const role = curr.role_name.trim()
                const cost = Number(curr.staff_count) * Number(curr.monthly_salary) * Number(curr.duration_months)
                if (!acc[role]) {
                    acc[role] = { role_name: role, total_amount: 0, count: 0, totalStaff: 0, type: 'staffing' }
                }
                acc[role].total_amount += cost
                acc[role].count += 1
                acc[role].totalStaff += Number(curr.staff_count)
                return acc
            }, {})

            setGroupedExpenses(Object.values(grouped).sort((a, b) => b.total_amount - a.total_amount))
            setStaffingGroups(Object.values(staffGrouped).sort((a, b) => b.total_amount - a.total_amount))

        } catch (error: unknown) {
            const err = error as { message?: string }
            console.error('Error fetching data:', error)
            setMessage({ text: err.message || 'حدث خطأ أثناء جلب البيانات', type: 'error' })
        } finally {
            setLoading(false)
            setSelectedGroups([])
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Combined rows
    const allRows: BudgetRow[] = [
        ...groupedExpenses,
        ...staffingGroups,
    ]

    const displayedRows = (activeTab === 'expenses' ? groupedExpenses
        : activeTab === 'staffing' ? staffingGroups
            : allRows
    ).filter(row => {
        const name = row.type === 'expense' ? row.name : row.role_name
        return name.toLowerCase().includes(searchQuery.toLowerCase())
    })

    const openAddModal = () => {
        setModalMode('add')
        setEditingGroup(null)
        setFormName('')
        setFormTargetAmount('')
        setIsModalOpen(true)
    }

    const openEditModal = (group: GroupedExpense) => {
        setModalMode('edit')
        setEditingGroup(group)
        setFormName(group.name)
        setFormTargetAmount(group.total_amount)
        setIsModalOpen(true)
    }

    const closeAndResetModal = () => {
        setIsModalOpen(false)
        setEditingGroup(null)
        setFormSubmitting(false)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formName.trim() || formTargetAmount === '' || Number(formTargetAmount) <= 0) {
            setMessage({ text: 'الرجاء تعبئة جميع الحقول بشكل صحيح', type: 'error' })
            return
        }

        setFormSubmitting(true)
        setMessage(null)

        try {
            const { data: projects } = await supabase.from('projects').select('id, total_value').eq('status', 'Active')
            const activeProjects = projects || []

            if (modalMode === 'add') {
                if (activeProjects.length === 0) throw new Error('لا توجد مشاريع نشطة لتوزيع الموازنة عليها.')
                const groupTotalValue = activeProjects.reduce((sum, p) => sum + Number(p.total_value), 0)
                if (groupTotalValue <= 0) throw new Error('إجمالي قيمة المشاريع النشطة يساوي صفر.')

                const amount = Number(formTargetAmount)
                const inserts = activeProjects.map(p => ({
                    project_id: p.id,
                    name: formName.trim(),
                    target_amount: amount * (Number(p.total_value) / groupTotalValue)
                }))

                const { error } = await supabase.from('project_expenses').insert(inserts)
                if (error) throw error
                setMessage({ text: 'تمت إضافة بند الموازنة وتوزيعه بنجاح', type: 'success' })

            } else if (modalMode === 'edit' && editingGroup) {
                if (activeProjects.length === 0) throw new Error('لا توجد مشاريع نشطة لإعادة توزيع الموازنة.')
                const groupTotalValue = activeProjects.reduce((sum, p) => sum + Number(p.total_value), 0)

                const { error: deleteError } = await supabase.from('project_expenses').delete().in('id', editingGroup.ids)
                if (deleteError) throw deleteError

                const amount = Number(formTargetAmount)
                const inserts = activeProjects.map(p => ({
                    project_id: p.id,
                    name: formName.trim(),
                    target_amount: amount * (Number(p.total_value) / groupTotalValue)
                }))

                const { error: insertError } = await supabase.from('project_expenses').insert(inserts)
                if (insertError) throw insertError

                setMessage({ text: 'تم تحديث أرقام وتوزيع بند الموازنة بنجاح', type: 'success' })
            }
            closeAndResetModal()
            fetchData()
        } catch (error: unknown) {
            const err = error as { message?: string }
            setMessage({ text: err.message || 'حدث خطأ أثناء الحفظ', type: 'error' })
            setFormSubmitting(false)
        }
    }

    const confirmDelete = (ids: string[]) => setDeleteIds(ids)

    const handleDelete = async () => {
        if (!deleteIds || deleteIds.length === 0) return
        setDeleteSubmitting(true)
        setMessage(null)
        try {
            const { error } = await supabase.from('project_expenses').delete().in('id', deleteIds)
            if (error) throw error
            setMessage({ text: 'تم حذف البند من جميع المشاريع بنجاح', type: 'success' })
            fetchData()
        } catch (error: unknown) {
            const err = error as { message?: string }
            let errorMsg = err.message || ''
            if (errorMsg?.includes('foreign key constraint')) {
                errorMsg = 'لا يمكن حذف هذا البند لوجود مصاريف فعلية مرتبطة به.'
            }
            setMessage({ text: errorMsg || 'حدث خطأ أثناء الحذف', type: 'error' })
        } finally {
            setDeleteSubmitting(false)
            setDeleteIds(null)
        }
    }

    // KPIs
    const totalExpensesBudget = groupedExpenses.reduce((s, g) => s + g.total_amount, 0)
    const totalStaffingBudget = staffingGroups.reduce((s, g) => s + g.total_amount, 0)
    const totalBudget = totalExpensesBudget + totalStaffingBudget
    const totalStaffCount = staffingGroups.reduce((s, g) => s + g.totalStaff, 0)

    const fmt = (n: number) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(n) + ' ر.س'

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">الموازنة الشاملة</h1>
                    <p className="text-gray-500 mt-1 text-sm">إدارة بنود الموازنة (مصاريف + كوادر) لجميع المشاريع النشطة</p>
                </div>
                <Button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
                    + إضافة بند مصاريف جديد
                </Button>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                {/* Total Budget */}
                <div className="lg:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                    <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full" />
                    <p className="text-blue-100 text-xs font-semibold uppercase mb-1">إجمالي الموازنة</p>
                    <p className="text-2xl font-bold tracking-tight">{fmt(totalBudget)}</p>
                    <p className="text-blue-200 text-xs mt-1">مصاريف + كوادر</p>
                </div>

                {/* Expenses */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">بنود المصاريف</p>
                    <p className="text-2xl font-bold text-gray-900">{fmt(totalExpensesBudget)}</p>
                    <p className="text-indigo-600 text-xs mt-1">{groupedExpenses.length} بند موزع</p>
                </div>

                {/* Staffing */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-violet-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">موازنة الكوادر</p>
                    <p className="text-2xl font-bold text-gray-900">{fmt(totalStaffingBudget)}</p>
                    <p className="text-violet-600 text-xs mt-1">{totalStaffCount} موظف · {staffingGroups.length} وظيفة</p>
                </div>

                {/* Ratio */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">نسبة الكوادر من الموازنة</p>
                    <p className="text-2xl font-bold text-gray-900">
                        {totalBudget > 0 ? ((totalStaffingBudget / totalBudget) * 100).toFixed(1) : '0'}%
                    </p>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-violet-500 rounded-full transition-all duration-700"
                            style={{ width: totalBudget > 0 ? String((totalStaffingBudget / totalBudget * 100).toFixed(1)) + '%' : '0%' }}
                        />
                    </div>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl font-medium flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success'
                        ? <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    }
                    {message.text}
                </div>
            )}

            <Card className="border-gray-200 shadow-sm overflow-hidden slide-in-bottom">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                        <CardTitle className="text-gray-800 text-lg">بنود الموازنة الشاملة</CardTitle>
                        <p className="text-gray-500 text-xs mt-0.5">مصاريف + كوادر من جميع المشاريع</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Tabs */}
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white text-sm">
                            {([
                                { key: 'all', label: 'الكل', color: 'bg-blue-600 text-white' },
                                { key: 'expenses', label: 'المصاريف', color: 'bg-indigo-600 text-white' },
                                { key: 'staffing', label: 'الكوادر', color: 'bg-violet-600 text-white' },
                            ] as const).map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-3 py-2 font-medium transition-colors ${activeTab === tab.key ? tab.color : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="بحث في البنود..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-1 focus:border-blue-500 focus:outline-none text-sm w-full md:w-52"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {selectedGroups.length > 0 && (
                        <div className="bg-blue-50 border-b border-blue-100 flex items-center justify-between px-6 py-3 fade-in">
                            <span className="text-blue-700 font-medium text-sm">تم تحديد {selectedGroups.length} بنود مصاريف</span>
                            <button
                                onClick={() => {
                                    const idsToDelete = groupedExpenses
                                        .filter(g => selectedGroups.includes(g.name))
                                        .flatMap(g => g.ids)
                                    setDeleteIds(idsToDelete)
                                }}
                                disabled={deleteSubmitting}
                                className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                حذف المحدد
                            </button>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500 font-medium flex flex-col items-center justify-center space-y-3">
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                <p>جارٍ تحميل البيانات...</p>
                            </div>
                        ) : displayedRows.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <span className="text-4xl mb-4 block">📭</span>
                                <p className="text-lg font-medium text-gray-900 mb-1">لا توجد بنود</p>
                                <p className="text-sm">لم يتم العثور على أي بنود تطابق معايير البحث.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                title="تحديد الكل"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={groupedExpenses.filter(g =>
                                                    g.name.toLowerCase().includes(searchQuery.toLowerCase())
                                                ).length > 0 && selectedGroups.length === groupedExpenses.filter(g =>
                                                    g.name.toLowerCase().includes(searchQuery.toLowerCase())
                                                ).length}
                                                onChange={(e) => {
                                                    const expenseRows = groupedExpenses.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    if (e.target.checked) setSelectedGroups(expenseRows.map(g => g.name))
                                                    else setSelectedGroups([])
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 font-semibold">نوع البند</th>
                                        <th className="px-6 py-4 font-semibold">اسم البند / الوظيفة</th>
                                        <th className="px-6 py-4 font-semibold">المبلغ الإجمالي</th>
                                        <th className="px-6 py-4 font-semibold">التوزيع</th>
                                        <th className="px-6 py-4 font-semibold text-center w-28">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayedRows.map((row, i) => {
                                        const isExpense = row.type === 'expense'
                                        const name = isExpense ? (row as GroupedExpense).name : (row as StaffingGroup).role_name
                                        const amount = row.total_amount
                                        const dist = isExpense
                                            ? `${(row as GroupedExpense).count} مشروع`
                                            : `${(row as StaffingGroup).totalStaff} موظف · ${(row as StaffingGroup).count} مشروع`

                                        return (
                                            <tr key={`${row.type}-${i}`} className={`hover:bg-gray-50/50 transition-colors ${isExpense && selectedGroups.includes(name) ? 'bg-blue-50/40' : ''}`}>
                                                <td className="px-5 py-3 text-center">
                                                    {isExpense ? (
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`تحديد ${name}`}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            checked={selectedGroups.includes(name)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedGroups(prev => [...prev, name])
                                                                else setSelectedGroups(prev => prev.filter(n => n !== name))
                                                            }}
                                                        />
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${isExpense ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                                                        {isExpense ? '💼 مصاريف' : '👥 كوادر'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">{name}</td>
                                                <td className="px-6 py-4 text-emerald-600 font-semibold" dir="ltr">
                                                    {Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 text-sm">{dist}</td>
                                                <td className="px-6 py-4 flex gap-2 justify-center">
                                                    {isExpense ? (
                                                        <>
                                                            <button
                                                                onClick={() => openEditModal(row as GroupedExpense)}
                                                                className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                                                                title="تعديل"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                onClick={() => confirmDelete((row as GroupedExpense).ids)}
                                                                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                                                                title="حذف"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs col-span-2 text-center">
                                                            من صفحة المشروع
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                                        <td colSpan={3} className="px-6 py-4 text-gray-800">
                                            الإجمالي ({displayedRows.length} بند)
                                        </td>
                                        <td className="px-6 py-4 text-blue-700" dir="ltr">
                                            {Number(displayedRows.reduce((s, r) => s + r.total_amount, 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س
                                        </td>
                                        <td colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center z-[100]">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAndResetModal}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative z-10 mx-4 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold tracking-tight text-gray-900">
                                {modalMode === 'add' ? 'إضافة بند مصاريف جديد' : 'تعديل بند المصاريف'}
                            </h2>
                            <button onClick={closeAndResetModal} title="إغلاق" aria-label="إغلاق" className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 mb-4 text-xs text-violet-700">
                            💡 لإدارة <strong>موازنة الكوادر</strong>، استخدم صفحة مشروع أو صفحة <strong>توزيع الرواتب</strong>.
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم البند</label>
                                <input
                                    type="text"
                                    required
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="مثال: تجهيزات، تنقلات، مطبوعات..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">المبلغ الإجمالي المستهدف (ر.س)</label>
                                <p className="text-xs text-gray-500 mb-2">سيتم توزيعه تلقائياً على جميع المشاريع النشطة بنسبة قيمها.</p>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={formTargetAmount}
                                    onChange={(e) => setFormTargetAmount(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 outline-none transition-all shadow-sm"
                                    dir="ltr"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button type="button" onClick={closeAndResetModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl" disabled={formSubmitting}>
                                    إلغاء
                                </Button>
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm shadow-blue-200" disabled={formSubmitting}>
                                    {formSubmitting ? 'جاري الحفظ...' : 'حفظ البند'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteIds && deleteIds.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleteSubmitting && setDeleteIds(null)}></div>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative z-10">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">تأكيد الحذف</h3>
                        <p className="text-center text-gray-500 mb-6">
                            هل أنت متأكد من رغبتك في حذف البند/البنود المحددة؟ سيتم الحذف من جميع المشاريع. لا يمكن التراجع.
                        </p>
                        <div className="flex gap-3">
                            <Button type="button" onClick={() => setDeleteIds(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl" disabled={deleteSubmitting}>
                                إلغاء
                            </Button>
                            <Button type="button" onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm shadow-red-200" disabled={deleteSubmitting}>
                                {deleteSubmitting ? 'جاري الحذف...' : 'نعم، احذف'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
