'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface GroupedActualExpense {
    key: string
    notes: string
    expense_date: string
    total_amount: number
    count: number
    ids: string[]
}

export default function ActualExpensesClient() {
    const supabase = createClient()
    const [groupedExpenses, setGroupedExpenses] = useState<GroupedActualExpense[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
    const [editingGroup, setEditingGroup] = useState<GroupedActualExpense | null>(null)

    // Form State
    const [formNotes, setFormNotes] = useState('')
    const [formDate, setFormDate] = useState('')
    const [formTargetAmount, setFormTargetAmount] = useState<number | ''>('')
    const [formSubmitting, setFormSubmitting] = useState(false)

    // Bulk Actions
    const [selectedGroups, setSelectedGroups] = useState<string[]>([])
    const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setMessage(null)
        try {
            const { data: expensesData, error: expensesError } = await supabase
                .from('actual_expenses')
                .select('id, amount, expense_date, notes')

            if (expensesError) throw expensesError

            // Group by combination of date and notes to bundle distributed expenses
            const grouped = (expensesData || []).reduce((acc: Record<string, GroupedActualExpense>, curr) => {
                const notes = (curr.notes || '').trim()
                const date = curr.expense_date
                const key = `${date}-${notes}`

                if (!acc[key]) {
                    acc[key] = { key, notes, expense_date: date, total_amount: 0, count: 0, ids: [] }
                }
                acc[key].total_amount += Number(curr.amount)
                acc[key].count += 1
                acc[key].ids.push(curr.id)
                return acc
            }, {})

            setGroupedExpenses(Object.values(grouped).sort((a, b) => b.expense_date.localeCompare(a.expense_date)))

        } catch (error: any) {
            console.error('Error fetching data:', error)
            setMessage({ text: error.message || 'حدث خطأ أثناء جلب البيانات', type: 'error' })
        } finally {
            setLoading(false)
            setSelectedGroups([])
        }
    }, [supabase])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Filter Logic
    const filteredGroups = groupedExpenses.filter(group => {
        const query = searchQuery.toLowerCase()
        return group.notes.toLowerCase().includes(query) || group.expense_date.includes(query)
    })

    const openAddModal = () => {
        setModalMode('add')
        setEditingGroup(null)
        setFormNotes('')
        setFormDate(new Date().toISOString().split('T')[0])
        setFormTargetAmount('')
        setIsModalOpen(true)
    }

    const openEditModal = (group: GroupedActualExpense) => {
        setModalMode('edit')
        setEditingGroup(group)
        setFormNotes(group.notes)
        setFormDate(group.expense_date)
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
        if (!formDate || formTargetAmount === '' || Number(formTargetAmount) <= 0) {
            setMessage({ text: 'الرجاء تعبئة جميع الحقول بشكل صحيح', type: 'error' })
            return
        }

        setFormSubmitting(true)
        setMessage(null)

        try {
            const { data: projects } = await supabase.from('projects').select('id, total_value').eq('status', 'Active')
            const activeProjects = projects || []

            if (activeProjects.length === 0) {
                throw new Error('لا توجد مشاريع نشطة لتوزيع المصاريف عليها.')
            }

            const groupTotalValue = activeProjects.reduce((sum, p) => sum + Number(p.total_value), 0)
            if (groupTotalValue <= 0) throw new Error('إجمالي قيمة المشاريع النشطة يساوي صفر.')

            const amount = Number(formTargetAmount)

            if (modalMode === 'add') {
                const inserts = activeProjects.map(p => {
                    const projectShare = Number(p.total_value) / groupTotalValue
                    return {
                        project_id: p.id,
                        expense_date: formDate,
                        notes: formNotes.trim(),
                        amount: amount * projectShare
                    }
                })

                const { error } = await supabase.from('actual_expenses').insert(inserts)
                if (error) throw error
                setMessage({ text: 'تم تسجيل المصروف الفعلي وتوزيعه بنجاح', type: 'success' })

            } else if (modalMode === 'edit' && editingGroup) {

                // Delete old ones across projects
                const { error: deleteError } = await supabase.from('actual_expenses').delete().in('id', editingGroup.ids)
                if (deleteError) throw deleteError

                // Insert re-distributed ones
                const inserts = activeProjects.map(p => {
                    const projectShare = Number(p.total_value) / groupTotalValue
                    return {
                        project_id: p.id,
                        expense_date: formDate,
                        notes: formNotes.trim(),
                        amount: amount * projectShare
                    }
                })

                const { error: insertError } = await supabase.from('actual_expenses').insert(inserts)
                if (insertError) throw insertError

                setMessage({ text: 'تم تحديث تفاصيل المصروف وتوزيعه بنجاح', type: 'success' })
            }
            closeAndResetModal()
            fetchData()
        } catch (error: any) {
            setMessage({ text: error.message || 'حدث خطأ أثناء الحفظ', type: 'error' })
            setFormSubmitting(false)
        }
    }

    const confirmDelete = (ids: string[]) => {
        setDeleteIds(ids)
    }

    const handleDelete = async () => {
        if (!deleteIds || deleteIds.length === 0) return
        setDeleteSubmitting(true)
        setMessage(null)
        try {
            const { error } = await supabase.from('actual_expenses').delete().in('id', deleteIds)
            if (error) throw error
            setMessage({ text: 'تم حذف المصروف من جميع المشاريع بنجاح', type: 'success' })
            fetchData()
        } catch (error: any) {
            setMessage({ text: error.message || 'حدث خطأ أثناء الحذف', type: 'error' })
        } finally {
            setDeleteSubmitting(false)
            setDeleteIds(null)
            setSelectedGroups([])
        }
    }

    // Calculate KPIs
    const totalTransactions = groupedExpenses.length
    const totalSpent = groupedExpenses.reduce((sum, g) => sum + Number(g.total_amount), 0)
    const avgTransSize = totalTransactions > 0 ? totalSpent / totalTransactions : 0
    let latestDate = '-'
    if (groupedExpenses.length > 0) {
        // Since groupedExpenses is already sorted by date desc
        latestDate = groupedExpenses[0].expense_date
    }

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">المصاريف الفعلية الشاملة</h1>
                    <p className="text-gray-500 mt-1">تتبع وإدارة جميع المصاريف الفعلية الموزعة على المشاريع المختلفة</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
                        + مصروف فعلي جديد
                    </Button>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                {/* KPI 1 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الصرف الفعلي</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{Number(totalSpent).toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س</p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">عدد الدفعات/العمليات</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{totalTransactions}</p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">متوسط حجم العملية</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{Number(avgTransSize).toLocaleString(undefined, { maximumFractionDigits: 0 })} ر.س</p>
                </div>

                {/* KPI 4 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">تاريخ أحدث عملية</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight" dir="ltr">{latestDate}</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.text}
                </div>
            )}

            <Card className="border-gray-200 shadow-sm overflow-hidden slide-in-bottom">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <CardTitle className="text-gray-800 text-lg">سجل المصاريف الفعلية</CardTitle>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="بحث في الملاحظات أو التاريخ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-1 focus:border-blue-500 focus:outline-none text-sm w-full md:w-80"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {selectedGroups.length > 0 && (
                        <div className="bg-emerald-50 border-b border-emerald-100 flex items-center justify-between px-6 py-3 fade-in">
                            <span className="text-emerald-800 font-medium text-sm">تم تحديد {selectedGroups.length} مصاريف/دفعات</span>
                            <button
                                onClick={() => {
                                    const idsToDelete = groupedExpenses
                                        .filter(g => selectedGroups.includes(g.key))
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
                                <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                <p>جارٍ تحميل البيانات...</p>
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <span className="text-4xl mb-4 block">💸</span>
                                <p className="text-lg font-medium text-gray-900 mb-1">لا توجد مصاريف فعلية</p>
                                <p className="text-sm">لم يتم العثور على أي بيانات تطابق بحثك أو لم يتم إضافة مصاريف قط.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left rtl:text-right">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                title="تحديد الكل"
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                checked={filteredGroups.length > 0 && selectedGroups.length === filteredGroups.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedGroups(filteredGroups.map(g => g.key))
                                                    else setSelectedGroups([])
                                                }}
                                            />
                                        </th>
                                        <th className="px-6 py-4 font-semibold">تاريخ الصرف</th>
                                        <th className="px-6 py-4 font-semibold">ملاحظات البند</th>
                                        <th className="px-6 py-4 font-semibold">المبلغ المُسدد</th>
                                        <th className="px-6 py-4 font-semibold">عدد المشاريع الموزع عليها</th>
                                        <th className="px-6 py-4 font-semibold text-center w-32">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredGroups.map((group) => (
                                        <tr key={group.key} className={`hover:bg-gray-50/50 transition-colors ${selectedGroups.includes(group.key) ? 'bg-emerald-50/50' : ''}`}>
                                            <td className="px-5 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    title="تحديد"
                                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                    checked={selectedGroups.includes(group.key)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedGroups(prev => [...prev, group.key])
                                                        else setSelectedGroups(prev => prev.filter(key => key !== group.key))
                                                    }}
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 font-medium">
                                                {group.expense_date}
                                            </td>
                                            <td className="px-6 py-4 text-gray-900">
                                                {group.notes || <span className="text-gray-400 italic">بدون ملاحظات</span>}
                                            </td>
                                            <td className="px-6 py-4 text-emerald-600 font-semibold dir-ltr text-right">
                                                {Number(group.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {group.count} مشروع
                                            </td>
                                            <td className="px-6 py-4 flex gap-2 justify-center">
                                                <button
                                                    onClick={() => openEditModal(group)}
                                                    className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                                                    title="تعديل"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(group.ids)}
                                                    className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors"
                                                    title="حذف"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
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
                                {modalMode === 'add' ? 'إضافة مصروف فعلي جديد' : 'تعديل المصروف الفعلي'}
                            </h2>
                            <button onClick={closeAndResetModal} title="إغلاق" aria-label="إغلاق" className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">تاريخ الصرف</label>
                                <input
                                    type="date"
                                    required
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    title="تاريخ الدفعة أو الصرف"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">وصف/ملاحظات المصروف</label>
                                <input
                                    type="text"
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    placeholder="مثال: سداد الفاتورة رقم 102 للمورد..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 outline-none transition-all shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">المبلغ الفعلي المُنفق (ر.س)</label>
                                <p className="text-xs text-gray-500 mb-2">سيتم خصم وتوزيع هذا المبلغ تلقائياً على جميع المشاريع النشطة.</p>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    required
                                    value={formTargetAmount}
                                    onChange={(e) => setFormTargetAmount(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 outline-none transition-all shadow-sm"
                                    dir="ltr"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="button"
                                    onClick={closeAndResetModal}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl"
                                    disabled={formSubmitting}
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm shadow-emerald-200"
                                    disabled={formSubmitting}
                                >
                                    {formSubmitting ? 'جاري الحفظ...' : 'حفظ'}
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
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative z-10 transform transition-all">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">تأكيد الحذف</h3>
                        <p className="text-center text-gray-500 mb-6">
                            هل أنت متأكد من رغبتك في حذف المصروف المحدد؟ سيتم حذفه من سجلات جميع المشاريع المتصلة به.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                onClick={() => setDeleteIds(null)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl"
                                disabled={deleteSubmitting}
                            >
                                إلغاء
                            </Button>
                            <Button
                                type="button"
                                onClick={handleDelete}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm shadow-red-200"
                                disabled={deleteSubmitting}
                            >
                                {deleteSubmitting ? 'جاري الحذف...' : 'نعم، احذف'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
