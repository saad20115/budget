'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    existingCategories: string[]
    existingClients: string[]
}

export default function QuickAddProjectModal({ isOpen, onClose, onSuccess, existingCategories, existingClients }: Props) {
    const supabase = createClient()
    const [isSaving, setIsSaving] = useState(false)
    
    // Project form
    const [name, setName] = useState('')
    const [client, setClient] = useState('')
    const [category, setCategory] = useState('')
    const [totalValue, setTotalValue] = useState('')
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    
    // Claims form
    const [numClaims, setNumClaims] = useState('1')
    const [claims, setClaims] = useState<{ amount: string; due_date: string; title: string }[]>([
        { amount: '', due_date: startDate, title: 'الدفعة 1' }
    ])

    const handleNumClaimsChange = (val: string) => {
        setNumClaims(val)
        const count = parseInt(val) || 0
        if (count > 0 && count <= 50) {
            const valNum = parseFloat(totalValue) || 0
            const avg = valNum / count
            
            const newClaims = Array.from({ length: count }).map((_, i) => {
                const date = new Date(startDate)
                date.setMonth(date.getMonth() + i)
                return {
                    amount: avg.toFixed(2),
                    due_date: date.toISOString().split('T')[0],
                    title: `الدفعة ${i + 1}`
                }
            })
            setClaims(newClaims)
        }
    }

    const handleTotalValueChange = (val: string) => {
        setTotalValue(val)
        const count = parseInt(numClaims) || 0
        if (count > 0 && count <= 50) {
            const valNum = parseFloat(val) || 0
            const avg = valNum / count
            setClaims(claims.map(c => ({ ...c, amount: avg.toFixed(2) })))
        }
    }

    const handleStartDateChange = (val: string) => {
        setStartDate(val)
        const count = parseInt(numClaims) || 0
        if (count > 0 && count <= 50) {
            const newClaims = claims.map((c, i) => {
                const date = new Date(val)
                date.setMonth(date.getMonth() + i)
                return { ...c, due_date: date.toISOString().split('T')[0] }
            })
            setClaims(newClaims)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !client || !totalValue || claims.length === 0) return

        setIsSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('يجب تسجيل الدخول أولاً')

            const { data: project, error: pErr } = await supabase.from('projects').insert({
                user_id: user.id,
                name,
                client,
                category: category || null,
                total_value: parseFloat(totalValue) || 0,
                target_profit_margin: 0,
                duration_months: parseInt(numClaims) || 1,
                start_date: startDate || null,
                status: 'Active'
            }).select('id').single()

            if (pErr) throw pErr

            const claimsData = claims.map(c => ({
                project_id: project.id,
                title: c.title || 'مطالبة',
                amount: parseFloat(c.amount) || 0,
                due_date: c.due_date,
                status: 'Pending'
            }))

            const { error: cErr } = await supabase.from('project_claims').insert(claimsData)
            if (cErr) throw cErr

            onSuccess()
            onClose()
            setName('')
            setClient('')
            setCategory('')
            setTotalValue('')
            setNumClaims('1')
            setClaims([{ amount: '', due_date: startDate, title: 'الدفعة 1' }])
        } catch (error: any) {
            console.error('Error adding project:', error)
            alert(error.message || 'حدث خطأ أثناء الحفظ')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">إضافة مشروع جديد وتوزيع المطالبات</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
                            بيانات المشروع
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">اسم المشروع *</label>
                                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">الشركة / العميل *</label>
                                <input required type="text" list="clients-list" value={client} onChange={e => setClient(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                <datalist id="clients-list">{existingClients.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">التصنيف</label>
                                <input type="text" list="cats-list" value={category} onChange={e => setCategory(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                <datalist id="cats-list">{existingCategories.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">إجمالي العقد (بدون ضريبة) *</label>
                                <input required type="number" min="0" step="0.01" value={totalValue} onChange={e => handleTotalValueChange(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">تاريخ بداية المشروع</label>
                                <input type="date" value={startDate} onChange={e => handleStartDateChange(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">عدد المطالبات المراد إنشاؤها *</label>
                                <input required type="number" min="1" max="50" value={numClaims} onChange={e => handleNumClaimsChange(e.target.value)} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">2</span>
                            توزيع المطالبات
                        </h3>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                            <div className="grid grid-cols-12 gap-3 text-xs font-bold text-gray-500 px-1">
                                <div className="col-span-4">عنوان المطالبة</div>
                                <div className="col-span-4">تاريخ الاستحقاق</div>
                                <div className="col-span-4">المبلغ (ريال)</div>
                            </div>
                            {claims.map((claim, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3">
                                    <div className="col-span-4">
                                        <input required type="text" value={claim.title} onChange={e => {
                                            const newClaims = [...claims]; newClaims[index].title = e.target.value; setClaims(newClaims);
                                        }} className="w-full text-sm p-2 border border-gray-200 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                    <div className="col-span-4">
                                        <input required type="date" value={claim.due_date} onChange={e => {
                                            const newClaims = [...claims]; newClaims[index].due_date = e.target.value; setClaims(newClaims);
                                        }} className="w-full text-sm p-2 border border-gray-200 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                    <div className="col-span-4 relative">
                                        <input required type="number" step="0.01" value={claim.amount} onChange={e => {
                                            const newClaims = [...claims]; newClaims[index].amount = e.target.value; setClaims(newClaims);
                                        }} className="w-full text-sm p-2 border border-gray-200 rounded focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    </div>
                                </div>
                            ))}
                            
                            <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between items-center px-1">
                                <span className="text-xs font-bold text-gray-500">إجمالي المطالبات:</span>
                                <span className={`text-sm font-bold ${Math.abs(claims.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0) - (parseFloat(totalValue) || 0)) > 0.1 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {claims.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </form>
                
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                        إلغاء
                    </button>
                    <button onClick={handleSubmit} disabled={isSaving || claims.length === 0} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                        {isSaving ? 'جارٍ الحفظ...' : 'حفظ وإنشاء'}
                    </button>
                </div>
            </div>
        </div>
    )
}
