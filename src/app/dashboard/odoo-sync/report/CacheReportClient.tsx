'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface CachedRow {
    id: string
    expense_date: string
    account_code: string
    account_name: string
    expenses: number
    cost_center: string
    company_name: string
    updated_at: string
}

export default function CacheReportClient() {
    const [data, setData] = useState<CachedRow[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCompany, setSelectedCompany] = useState<string>('')
    const [selectedCostCenter, setSelectedCostCenter] = useState<string>('')
    const [sortConfig, setSortConfig] = useState<{ key: keyof CachedRow, direction: 'asc' | 'desc' } | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    const router = useRouter()
    const supabase = createClient()

    const fetchCache = useCallback(async () => {
        setLoading(true)
        const { data: result, error } = await supabase
            .from('external_expenses_cache')
            .select('*')
            .order('expense_date', { ascending: false })
            
        if (error) {
            console.error(error)
        } else {
            setData(result || [])
        }
        setLoading(false)
    }, [supabase])

    useEffect(() => {
        fetchCache()
    }, [fetchCache])

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا السجل بشكل نهائي؟')) return
        
        try {
            const { error } = await supabase
                .from('external_expenses_cache')
                .delete()
                .eq('id', id)
                
            if (error) throw error
            
            setData(prev => prev.filter(row => row.id !== id))
            setSelectedIds(prev => {
                const newSet = new Set(prev)
                newSet.delete(id)
                return newSet
            })
            
        } catch (err) {
            console.error('Error deleting record:', err)
            alert('حدث خطأ أثناء محاولة الحذف.')
        }
    }

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return
        if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} سجلات بشكل نهائي؟`)) return
        
        setLoading(true)
        try {
            const idsArray = Array.from(selectedIds)
            const { error } = await supabase
                .from('external_expenses_cache')
                .delete()
                .in('id', idsArray)
                
            if (error) throw error
            
            setData(prev => prev.filter(row => !selectedIds.has(row.id)))
            setSelectedIds(new Set())
        } catch (err) {
            console.error('Error bulk deleting:', err)
            alert('حدث خطأ أثناء الحذف المجمع.')
        }
        setLoading(false)
    }

    let filteredData = data.filter(r => {
        const matchesSearch = (r.account_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (r.account_code || '').includes(searchQuery) ||
                              (r.cost_center || '').toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesCompany = selectedCompany ? r.company_name === selectedCompany : true
        const matchesCostCenter = selectedCostCenter ? r.cost_center === selectedCostCenter : true

        return matchesSearch && matchesCompany && matchesCostCenter
    })

    if (sortConfig !== null) {
        filteredData.sort((a, b) => {
            const aVal = a[sortConfig.key] ?? ''
            const bVal = b[sortConfig.key] ?? ''
            
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
            }
            
            const aStr = String(aVal).toLowerCase()
            const bStr = String(bVal).toLowerCase()
            
            if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
            if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }

    const requestSort = (key: keyof CachedRow) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const getSortIcon = (key: keyof CachedRow) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 opacity-50 inline-block mr-1"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
        }
        return sortConfig.direction === 'asc' 
            ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 inline-block mr-1"><path d="m5 15 7-7 7 7"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 inline-block mr-1"><path d="m19 9-7 7-7-7"/></svg>
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredData.length && filteredData.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(filteredData.map(r => r.id)))
        }
    }

    const toggleSelectRow = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) newSet.delete(id)
            else newSet.add(id)
            return newSet
        })
    }

    const totalAmount = filteredData.reduce((acc, curr) => acc + Number(curr.expenses), 0)
    const uniqueAccounts = new Set(data.map(d => d.account_code)).size
    const uniqueCompanies = Array.from(new Set(data.map(d => d.company_name).filter(Boolean))).sort()
    const uniqueCostCenters = Array.from(new Set(data.map(d => d.cost_center).filter(Boolean))).sort()

    return (
        <div className="p-4 md:p-8 w-full space-y-6" dir="rtl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">تقرير المزامنة (Odoo)</h1>
                    <p className="text-gray-500 mt-2 text-sm md:text-base">
                        مراجعة البيانات المالية التي تمت مزامنتها للتو من أودو وتمهيدها للربط والمطابقة.
                    </p>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    {selectedIds.size > 0 && (
                        <Button onClick={handleBulkDelete} disabled={loading} variant="destructive" className="shadow-sm flex gap-2">
                            <span>حذف المحدد ({selectedIds.size})</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </Button>
                    )}
                    <Button onClick={fetchCache} disabled={loading} variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700 shadow-sm flex gap-2">
                        <span>تحديث البيانات</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "animate-spin" : ""}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                    </Button>
                    <Link href="/dashboard/expenses/import">
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md w-full md:w-auto flex gap-2">
                            <span>ترحيل للحسابات الفعلية</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border text-center border-gray-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">إجمالي المبالغ</p>
                    <p className="text-2xl font-black text-rose-600" dir="ltr">{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-sm font-normal text-gray-500">ر.س</span></p>
                </div>
                <div className="bg-white border text-center border-gray-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">العمليات المسجلة</p>
                    <p className="text-2xl font-black text-blue-600">{filteredData.length}</p>
                </div>
                <div className="bg-white border text-center border-gray-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">عدد الحسابات</p>
                    <p className="text-2xl font-black text-emerald-600">{uniqueAccounts}</p>
                </div>
                <div className="bg-white border text-center border-gray-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">الشركات المسجلة</p>
                    <p className="text-2xl font-black text-purple-600">{uniqueCompanies.length}</p>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                        type="search" 
                        placeholder="ابحث بالاسم أو الرقم..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 pl-4 pr-10 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    />
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none"
                        title="فلتر حسب الشركة"
                    >
                        <option value="">جميع الشركات</option>
                        {uniqueCompanies.map((comp, idx) => (
                            <option key={idx} value={comp}>{comp}</option>
                        ))}
                    </select>
                </div>
                <div className="w-full md:w-64">
                    <select
                        value={selectedCostCenter}
                        onChange={(e) => setSelectedCostCenter(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none"
                        title="فلتر حسب مركز التكلفة"
                    >
                        <option value="">جميع مراكز التكلفة</option>
                        {uniqueCostCenters.map((cc, idx) => (
                            <option key={idx} value={cc}>{cc}</option>
                        ))}
                    </select>
                </div>
                { (searchQuery || selectedCompany || selectedCostCenter) && (
                    <Button 
                        variant="ghost" 
                        onClick={() => { setSearchQuery(''); setSelectedCompany(''); setSelectedCostCenter(''); }}
                        className="h-11 text-gray-500 hover:text-red-600 hover:bg-red-50"
                        title="مسح الفلاتر"
                    >
                        مسح
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
                <div className="overflow-y-auto w-full relative">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10 text-gray-600 font-semibold text-right">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                                        onChange={toggleSelectAll}
                                        disabled={filteredData.length === 0}
                                    />
                                </th>
                                <th className="px-4 py-3">م</th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group" onClick={() => requestSort('expense_date')}>
                                    التاريخ {getSortIcon('expense_date')}
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group" onClick={() => requestSort('account_name')}>
                                    الحساب {getSortIcon('account_name')}
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group" onClick={() => requestSort('cost_center')}>
                                    م. التكلفة {getSortIcon('cost_center')}
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group" onClick={() => requestSort('company_name')}>
                                    الشركة {getSortIcon('company_name')}
                                </th>
                                <th className="px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors select-none group" onClick={() => requestSort('expenses')}>
                                    المبلغ (ر.س) {getSortIcon('expenses')}
                                </th>
                                <th className="px-4 py-3 text-center">الإجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">جاري جلب البيانات...</td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">لا توجد بيانات محفوظة مطابقة لبحثك.</td>
                                </tr>
                            ) : (
                                filteredData.map((row, i) => (
                                    <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-4 py-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                checked={selectedIds.has(row.id)}
                                                onChange={() => toggleSelectRow(row.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                                        <td className="px-4 py-3 font-medium text-gray-700" dir="ltr">{row.expense_date || '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-blue-600 font-mono tracking-wide">{row.account_code}</span>
                                                <span className="text-gray-800 truncate max-w-[200px]" title={row.account_name}>{row.account_name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{row.cost_center || '—'}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.company_name || '—'}</td>
                                        <td className="px-4 py-3 font-bold text-rose-600" dir="ltr">{Number(row.expenses).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleDelete(row.id)}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                                title="حذف هذا السجل"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
