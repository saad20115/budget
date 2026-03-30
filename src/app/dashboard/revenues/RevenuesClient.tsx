'use client'

import { useState, useEffect } from 'react'
import { Project, ProjectClaim } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Edit2, Download, Search, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface RevenuesClientProps {
    initialProjects: Project[]
}

export default function RevenuesClient({ initialProjects }: RevenuesClientProps) {
    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [claims, setClaims] = useState<ProjectClaim[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const supabase = createClient()

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingClaim, setEditingClaim] = useState<ProjectClaim | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // Form state
    const [formData, setFormData] = useState({
        project_id: initialProjects[0]?.id || '',
        title: '',
        amount: '',
        paid_amount: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pending' as 'Pending' | 'Invoiced' | 'Paid' | 'Overdue' | 'Sent' | 'NotYetDue' | 'PartiallyPaid',
        collection_date: '',
        notes: ''
    })

    useEffect(() => {
        if (projects.length > 0) {
            fetchClaims()
        } else {
            setIsLoading(false)
        }
    }, [projects])

    const fetchClaims = async () => {
        try {
            setIsLoading(true)
            const projectIds = projects.map(p => p.id)
            if (projectIds.length === 0) return

            const { data, error } = await supabase
                .from('project_claims')
                .select('*')
                .in('project_id', projectIds)
                .order('due_date', { ascending: true })

            if (error) throw error

            // Update statuses to Overdue or Due if due_date passed and not paid
            const today = new Date().toISOString().split('T')[0]
            const toUpdateIds: { id: string, newStatus: string }[] = []

            const updatedData = data.map(claim => {
                if (claim.status === 'Paid') return claim
                
                const dueParts = claim.due_date.split('-');
                const todayParts = today.split('-');
                const d1 = new Date(Date.UTC(Number(dueParts[0]), Number(dueParts[1])-1, Number(dueParts[2])));
                const d2 = new Date(Date.UTC(Number(todayParts[0]), Number(todayParts[1])-1, Number(todayParts[2])));
                const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
                
                let newStatus = claim.status;
                if (diffDays >= 0 && diffDays <= 5) {
                    newStatus = 'Due';
                } else if (diffDays > 5) {
                    newStatus = 'Overdue';
                } else if (diffDays < 0 && (claim.status === 'Overdue' || claim.status === 'Due')) {
                    newStatus = (claim.paid_amount || 0) > 0 ? 'PartiallyPaid' : 'Pending';
                }

                if (newStatus !== claim.status) {
                    toUpdateIds.push({ id: claim.id, newStatus })
                    return { ...claim, status: newStatus as any }
                }
                
                return claim
            })

            // Run an optimistic set
            setClaims(updatedData as ProjectClaim[])

            // Background persist
            if (toUpdateIds.length > 0) {
                const statusGroups = toUpdateIds.reduce((acc, curr) => {
                    if (!acc[curr.newStatus]) acc[curr.newStatus] = [];
                    acc[curr.newStatus].push(curr.id);
                    return acc;
                }, {} as Record<string, string[]>);

                const promises = Object.entries(statusGroups).map(([status, ids]) => 
                    supabase.from('project_claims').update({ status }).in('id', ids)
                );
                Promise.all(promises).catch(err => console.error("Auto-sync claims error:", err))
            }
        } catch (error: any) {
            console.error('Error fetching claims:', error)
            alert(`حدث خطأ أثناء جلب المطالبات: ${error?.message || 'تأكد من إنشاء جدول المطالبات'}`)
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenAddModal = () => {
        setFormData({
            project_id: initialProjects[0]?.id || '',
            title: '',
            amount: '',
            paid_amount: '',
            due_date: format(new Date(), 'yyyy-MM-dd'),
            status: 'Pending',
            collection_date: '',
            notes: ''
        })
        setEditingClaim(null)
        setIsAddModalOpen(true)
    }

    const handleOpenEditModal = (claim: ProjectClaim) => {
        setFormData({
            project_id: claim.project_id,
            title: claim.title,
            amount: claim.amount.toString(),
            paid_amount: (claim.paid_amount || 0).toString(),
            due_date: claim.due_date,
            status: claim.status,
            collection_date: claim.collection_date || '',
            notes: claim.notes || ''
        })
        setEditingClaim(claim)
        setIsAddModalOpen(true)
    }

    const recalculateProjectPaidAmount = async (projectId: string) => {
        try {
            // Get all claims for the project (sum paid_amount for all)
            const { data: allClaims, error: claimsError } = await supabase
                .from('project_claims')
                .select('paid_amount')
                .eq('project_id', projectId)

            if (claimsError) throw claimsError

            const totalPaid = allClaims?.reduce((sum, claim) => sum + Number(claim.paid_amount || 0), 0) || 0

            // Update local state (Optimistic)
            setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, paid_amount: totalPaid } : p
            ))

            // Update project in DB
            const { error: updateError } = await supabase
                .from('projects')
                .update({ paid_amount: totalPaid })
                .eq('id', projectId)

            if (updateError) {
                console.warn('DB Update Error (Optimistic UI still applied):', updateError.message)
            }

            return totalPaid

        } catch (error) {
            console.error('Error recalculating paid amount:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            setIsSubmitting(true)

            if (!formData.project_id || !formData.title || !formData.amount || !formData.due_date) {
                throw new Error('يرجى تعبئة جميع الحقول المطلوبة')
            }

            const amount = parseFloat(formData.amount)
            const paidAmt = parseFloat(formData.paid_amount) || 0

            // Auto-determine status based on paid_amount
            let status = formData.status
            if (paidAmt >= amount && amount > 0) {
                status = 'Paid'
            } else if (paidAmt > 0 && paidAmt < amount) {
                status = 'PartiallyPaid'
            }

            const claimData = {
                project_id: formData.project_id,
                title: formData.title,
                amount: amount,
                paid_amount: paidAmt,
                due_date: formData.due_date,
                status: status,
                collection_date: (status === 'Paid' || status === 'PartiallyPaid') ? (formData.collection_date || format(new Date(), 'yyyy-MM-dd')) : null,
                notes: formData.notes
            }

            if (editingClaim) {
                const { error } = await supabase
                    .from('project_claims')
                    .update(claimData)
                    .eq('id', editingClaim.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('project_claims')
                    .insert([claimData])

                if (error) throw error
            }

            setIsAddModalOpen(false)
            await fetchClaims()
        } catch (error: any) {
            console.error('Error saving claim:', error)
            alert(error.message || 'حدث خطأ أثناء الحفظ')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (claim: ProjectClaim) => {
        if (!confirm('هل أنت متأكد من حذف هذه المطالبة؟')) return

        try {
            const { error } = await supabase
                .from('project_claims')
                .delete()
                .eq('id', claim.id)

            if (error) throw error
            await fetchClaims()
        } catch (error) {
            console.error('Error deleting claim:', error)
            alert('حدث خطأ أثناء الحذف')
        }
    }

    const handleStatusChange = async (claim: ProjectClaim, newStatus: string) => {
        try {
            const updateData: any = { status: newStatus }
            if (newStatus === 'Paid') {
                updateData.collection_date = format(new Date(), 'yyyy-MM-dd')
            } else {
                updateData.collection_date = null
            }

            const { error } = await supabase
                .from('project_claims')
                .update(updateData)
                .eq('id', claim.id)

            if (error) throw error
            await fetchClaims()
        } catch (error) {
            console.error('Error updating status:', error)
            alert('حدث خطأ أثناء تحديث الحالة')
        }
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'Due': return 'bg-orange-100 text-orange-700 border-orange-200'
            case 'Paid': return 'bg-green-100 text-green-700 border-green-200'
            case 'PartiallyPaid': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'Invoiced': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'Overdue': return 'bg-red-100 text-red-700 border-red-200'
            case 'Sent': return 'bg-purple-100 text-purple-700 border-purple-200'
            case 'NotYetDue': return 'bg-gray-100 text-gray-700 border-gray-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Due': return <Clock className="w-4 h-4 mr-1 ml-1" />
            case 'Paid': return <CheckCircle className="w-4 h-4 mr-1 ml-1" />
            case 'Pending': return <Clock className="w-4 h-4 mr-1 ml-1" />
            case 'Invoiced': return <Edit2 className="w-4 h-4 mr-1 ml-1" />
            case 'Overdue': return <AlertCircle className="w-4 h-4 mr-1 ml-1" />
            default: return null
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Due': return 'مستحقة'
            case 'Paid': return 'مدفوع'
            case 'PartiallyPaid': return 'مسدد جزئياً'
            case 'Pending': return 'قيد الانتظار'
            case 'Invoiced': return 'مفوتر'
            case 'Overdue': return 'متأخر'
            case 'Sent': return 'مرسل'
            case 'NotYetDue': return 'لم تستحق'
            default: return status
        }
    }

    const filteredClaims = claims.filter(claim => {
        const matchesSearch = claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            projects.find(p => p.id === claim.project_id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || claim.status === statusFilter
        return matchesSearch && matchesStatus
    })

    // Account for 15% VAT in total expected revenues from projects
    // user said: "الايرادات هي عبارة عن قيمة العقود مضاف عليها 15% ضريبة"
    const totalProjectsValueBase = projects.reduce((sum, p) => sum + (Number(p.total_value) || 0), 0)
    const totalExpected = totalProjectsValueBase * 1.15 // Adding 15% VAT

    const totalCollected = claims.reduce((sum, c) => sum + Number(c.paid_amount || 0), 0)
    const totalOverdue = claims.filter(c => c.status === 'Overdue').reduce((sum, c) => sum + c.amount, 0)
    const overallRemaining = totalExpected - totalCollected

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الإيرادات المتوقعة <span className="text-xs text-blue-500">(شامل الضريبة)</span></p>
                        <h3 className="text-3xl font-bold text-gray-900">{totalExpected.toLocaleString('en-US')} <span className="text-base font-normal text-gray-500">ر.س</span></h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي المبالغ المحصلة</p>
                        <h3 className="text-3xl font-bold text-green-600">{totalCollected.toLocaleString('en-US')} <span className="text-base font-normal text-gray-500">ر.س</span></h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي المبالغ المتبقية</p>
                        <h3 className="text-3xl font-bold text-orange-600">{overallRemaining.toLocaleString('en-US')} <span className="text-base font-normal text-gray-500">ر.س</span></h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-gray-500 text-sm font-medium mb-1">المطالبات المتأخرة</p>
                        <h3 className="text-3xl font-bold text-red-600">{totalOverdue.toLocaleString('en-US')} <span className="text-base font-normal text-gray-500">ر.س</span></h3>
                    </div>
                </div>
            </div>

            {/* Project Summaries Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900">تفاصيل عقود المشاريع <span className="text-sm font-normal text-gray-500">(شاملة ضريبة القيمة المضافة 15%)</span></h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">المشروع</th>
                                <th className="px-6 py-4 font-semibold">قيمة العقد الأساسية</th>
                                <th className="px-6 py-4 font-semibold">قيمة الضريبة (15%)</th>
                                <th className="px-6 py-4 font-semibold">إجمالي قيمة العقد</th>
                                <th className="px-6 py-4 font-semibold text-green-600">إجمالي المدفوع</th>
                                <th className="px-6 py-4 font-semibold text-orange-600">إجمالي المتبقي</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {projects.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">لا توجد مشاريع مضافة.</td>
                                </tr>
                            ) : (
                                projects.map((p) => {
                                    const baseValue = Number(p.total_value) || 0;
                                    const vatValue = baseValue * 0.15;
                                    const totalValue = baseValue + vatValue;
                                    const paidAmount = claims.filter(c => c.project_id === p.id).reduce((sum, c) => sum + Number(c.paid_amount || 0), 0);
                                    const remainingAmount = totalValue - paidAmount;

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900 border-r-2" style={{ borderRightColor: '#3B82F6' }}>
                                                {p.name}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700">{baseValue.toLocaleString('en-US')} ر.س</td>
                                            <td className="px-6 py-4 text-blue-600">{vatValue.toLocaleString('en-US')} ر.س</td>
                                            <td className="px-6 py-4 font-bold text-gray-900">{totalValue.toLocaleString('en-US')} ر.س</td>
                                            <td className="px-6 py-4 font-bold text-green-600">
                                                {paidAmount.toLocaleString('en-US')} ر.س
                                            </td>
                                            <td className={`px-6 py-4 font-bold ${remainingAmount > 0 ? 'text-orange-600' : remainingAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {remainingAmount.toLocaleString('en-US')} ر.س
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Actions & Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex flex-1 w-full gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="بحث في المطالبات..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="Paid">مدفوع</option>
                        <option value="PartiallyPaid">مسدد جزئياً</option>
                        <option value="Pending">قيد الانتظار</option>
                        <option value="Invoiced">مفوتر</option>
                        <option value="Overdue">متأخر</option>
                        <option value="Sent">مرسل</option>
                        <option value="NotYetDue">لم تستحق</option>
                    </select>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button onClick={handleOpenAddModal} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة مطالبة
                    </Button>
                </div>
            </div>

            {/* Claims Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">المشروع</th>
                                <th className="px-6 py-4 font-semibold">عنوان المطالبة</th>
                                <th className="px-6 py-4 font-semibold">المبلغ</th>
                                <th className="px-6 py-4 font-semibold text-green-600">المسدد</th>
                                <th className="px-6 py-4 font-semibold">تاريخ الاستحقاق</th>
                                <th className="px-6 py-4 font-semibold">الحالة</th>
                                <th className="px-6 py-4 font-semibold text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        جاري تحميل البيانات...
                                    </td>
                                </tr>
                            ) : filteredClaims.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                <AlertCircle className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <p className="text-base font-medium">لا توجد مطالبات</p>
                                            <p className="text-sm text-gray-400">لم يتم العثور على أي مطالبات مطابقة للبحث</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredClaims.map((claim) => (
                                    <tr key={claim.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900 border-r-2" style={{ borderRightColor: '#3B82F6' }}>
                                            {projects.find(p => p.id === claim.project_id)?.name || 'مشروع غير معروف'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-700">{claim.title}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{Number(claim.amount).toLocaleString('en-US')} ر.س</td>
                                        <td className="px-4 py-4">
                                            {(() => {
                                                const paid = Number(claim.paid_amount || 0)
                                                const total = Number(claim.amount)
                                                const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0
                                                const remaining = total - paid
                                                return (
                                                    <div>
                                                        <span className="font-bold text-green-600 text-sm">{paid.toLocaleString('en-US')}</span>
                                                        {remaining > 0 && <span className="text-xs text-gray-400 mr-1">({remaining.toLocaleString('en-US')} متبقي)</span>}
                                                        <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-emerald-400' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{format(new Date(claim.due_date), 'yyyy/MM/dd')}</td>
                                        <td className="px-6 py-4">
                                            <select
                                                value={claim.status}
                                                onChange={(e) => handleStatusChange(claim, e.target.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center outline-none cursor-pointer appearance-none ${getStatusStyle(claim.status)}`}
                                            >
                                                <option value="Pending">قيد الانتظار</option>
                                                <option value="Invoiced">مفوتر</option>
                                                <option value="PartiallyPaid">مسدد جزئياً</option>
                                                <option value="Paid">مدفوع</option>
                                                <option value="Overdue">متأخر</option>
                                                <option value="Due">مستحقة</option>
                                                <option value="Sent">مرسل</option>
                                                <option value="NotYetDue">لم تستحق</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleOpenEditModal(claim)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="تعديل"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(claim)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold">{editingClaim ? 'تعديل مطالبة' : 'إضافة مطالبة جديدة'}</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="sr-only">إغلاق</span>
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المشروع</label>
                                <select
                                    required
                                    value={formData.project_id}
                                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="" disabled>اختر المشروع...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان المطالبة</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="مثال: الدفعة الأولى"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (ر.س)</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-1">المبلغ المسدد (ر.س)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        max={formData.amount || undefined}
                                        value={formData.paid_amount}
                                        onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                                        className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-green-50/30"
                                        placeholder="0"
                                    />
                                    {parseFloat(formData.paid_amount) > 0 && parseFloat(formData.amount) > 0 && (
                                        <p className="text-xs mt-1 text-gray-500">
                                            {parseFloat(formData.paid_amount) >= parseFloat(formData.amount) ? (
                                                <span className="text-green-600 font-medium">✅ سيتم تعيين الحالة: مدفوع</span>
                                            ) : (
                                                <span className="text-emerald-600 font-medium">⚡ سيتم تعيين الحالة: مسدد جزئياً ({((parseFloat(formData.paid_amount) / parseFloat(formData.amount)) * 100).toFixed(0)}%)</span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الاستحقاق</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                                    <select
                                        required
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="Pending">قيد الانتظار</option>
                                        <option value="Invoiced">مفوتر</option>
                                        <option value="PartiallyPaid">مسدد جزئياً</option>
                                        <option value="Paid">مدفوع</option>
                                        <option value="Overdue">متأخر</option>
                                        <option value="Due">مستحقة</option>
                                        <option value="Sent">مرسل</option>
                                        <option value="NotYetDue">لم تستحق</option>
                                    </select>
                                </div>
                                {(formData.status === 'Paid' || formData.status === 'PartiallyPaid') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التحصيل</label>
                                        <input
                                            type="date"
                                            value={formData.collection_date}
                                            onChange={(e) => setFormData({ ...formData, collection_date: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    placeholder="أي تفاصيل إضافية..."
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1"
                                >
                                    إلغاء
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
