'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface ProjectRow {
    id: string
    name: string
    client?: string
    status: string
    category?: string
    total_value: number
    budget: number
    actual: number
    variance: number
    profit: number
    invoiced: number
}

function formatCurrency(val: number) {
    return new Intl.NumberFormat('ar-SA', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' ر.س'
}

function SortIcon({ k, sortKey, sortDir }: { k: string; sortKey: string; sortDir: 'asc' | 'desc' }) {
    return (
        <span className={`inline-block ml-1 text-[10px] ${sortKey === k ? 'text-blue-500' : 'text-gray-300'}`}>
            {sortKey === k ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
        </span>
    )
}

export default function ReportTableClient({ data }: { data: ProjectRow[] }) {
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [sortKey, setSortKey] = useState<keyof ProjectRow>('total_value')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const categories = useMemo(() => Array.from(new Set(data.map(p => p.category).filter(Boolean))), [data])

    const filtered = useMemo(() => {
        return data
            .filter(p => {
                if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.client || '').toLowerCase().includes(search.toLowerCase())) return false
                if (filterStatus && p.status !== filterStatus) return false
                if (filterCategory && p.category !== filterCategory) return false
                return true
            })
            .sort((a, b) => {
                const av = a[sortKey] as number | string
                const bv = b[sortKey] as number | string
                if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'desc' ? bv - av : av - bv
                return sortDir === 'desc' ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv))
            })
    }, [data, search, filterStatus, filterCategory, sortKey, sortDir])

    const totals = useMemo(() => filtered.reduce((acc, p) => ({
        total_value: acc.total_value + p.total_value,
        budget: acc.budget + p.budget,
        actual: acc.actual + p.actual,
        variance: acc.variance + p.variance,
        invoiced: acc.invoiced + p.invoiced,
    }), { total_value: 0, budget: 0, actual: 0, variance: 0, invoiced: 0 }), [filtered])

    const toggleSort = (key: keyof ProjectRow) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('desc') }
    }

    const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterCategory('') }
    const hasFilter = search || filterStatus || filterCategory

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm slide-in-bottom">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                        <div className="w-2 h-6 bg-gray-800 rounded-full"></div>
                        التفاصيل المالية والربحية للمشاريع
                    </h2>
                    <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                        {filtered.length} من {data.length} مشروع
                    </span>
                </div>

                {/* Search & Filters Row */}
                <div className="flex flex-wrap gap-3" dir="rtl">
                    <div className="relative flex-1 min-w-[200px]">
                        <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="ابحث باسم المشروع أو العميل..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-9 rounded-lg border border-gray-200 bg-white text-gray-800 pr-9 pl-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {categories.length > 0 && (
                        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} title="تصفية حسب المجموعة"
                            className="h-9 rounded-lg border border-gray-200 bg-white text-gray-700 px-3 text-sm focus:border-blue-500 focus:outline-none transition-colors">
                            <option value="">كل المجموعات</option>
                            {categories.map(c => <option key={c} value={c!}>{c}</option>)}
                        </select>
                    )}

                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} title="تصفية حسب الحالة"
                        className="h-9 rounded-lg border border-gray-200 bg-white text-gray-700 px-3 text-sm focus:border-blue-500 focus:outline-none transition-colors">
                        <option value="">كل الحالات</option>
                        <option value="Active">نشط</option>
                        <option value="Completed">مكتمل</option>
                        <option value="On Hold">معلق</option>
                    </select>

                    {hasFilter && (
                        <button onClick={clearFilters}
                            className="h-9 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            مسح
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1000px]">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-100/50 text-gray-600 text-xs whitespace-nowrap">
                            <th className="text-right px-6 py-4 font-bold border-l border-gray-200 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('name')}>
                                المشروع <SortIcon k="name" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('total_value')}>
                                قيمة العقد <SortIcon k="total_value" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('invoiced')}>
                                الإيرادات المفوترة <SortIcon k="invoiced" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('budget')}>
                                الموازنة التشغيلية <SortIcon k="budget" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('actual')}>
                                الصرف الفعلي <SortIcon k="actual" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('variance')}>
                                وفر / تجاوز <SortIcon k="variance" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-right px-6 py-4 font-bold cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('profit')}>
                                الربح المؤقت <SortIcon k="profit" sortKey={String(sortKey)} sortDir={sortDir} />
                            </th>
                            <th className="text-center px-4 py-4 font-bold">تفاصيل</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map(project => (
                            <tr key={project.id} className="hover:bg-blue-50/40 transition-colors bg-white group whitespace-nowrap">
                                <td className="px-6 py-4 border-l border-gray-100">
                                    <p className="text-gray-900 font-bold text-sm">{project.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {project.client && <p className="text-gray-500 text-xs">{project.client}</p>}
                                        {project.category && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">{project.category}</span>}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : project.status === 'Completed' ? 'bg-gray-100 text-gray-600' : 'bg-amber-50 text-amber-700'}`}>
                                            {project.status === 'Active' ? 'نشط' : project.status === 'Completed' ? 'مكتمل' : 'معلق'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(project.total_value)}</td>
                                <td className="px-6 py-4 font-medium text-indigo-700">{formatCurrency(project.invoiced)}</td>
                                <td className="px-6 py-4 text-blue-700 font-medium">{formatCurrency(project.budget)}</td>
                                <td className="px-6 py-4 text-emerald-700 font-medium">{formatCurrency(project.actual)}</td>
                                <td className="px-6 py-4 font-bold">
                                    <span className={project.variance >= 0 ? 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded' : 'text-red-600 bg-red-50 px-2 py-0.5 rounded'}>
                                        <span dir="ltr">{project.variance < 0 ? '-' : '+'}</span> {formatCurrency(Math.abs(project.variance))}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(project.profit)}</td>
                                <td className="px-4 py-4 text-center">
                                    <Link href={`/dashboard/projects/${project.id}`}
                                        className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                        title="عرض التفاصيل">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </Link>
                                </td>
                            </tr>
                        ))}

                        {filtered.length > 0 && (
                            <tr className="bg-gray-50 border-t-2 border-gray-200">
                                <td className="px-6 py-4 border-l border-gray-200 font-black text-gray-900">
                                    <div className="flex items-center gap-2"><span className="text-xl">Σ</span> الإجمالي</div>
                                </td>
                                <td className="px-6 py-4 font-black text-gray-900">{formatCurrency(totals.total_value)}</td>
                                <td className="px-6 py-4 font-black text-indigo-700">{formatCurrency(totals.invoiced)}</td>
                                <td className="px-6 py-4 font-black text-blue-700">{formatCurrency(totals.budget)}</td>
                                <td className="px-6 py-4 font-black text-emerald-700">{formatCurrency(totals.actual)}</td>
                                <td className="px-6 py-4 font-black">
                                    <span className={totals.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                        <span dir="ltr">{totals.variance < 0 ? '-' : '+'}</span> {formatCurrency(Math.abs(totals.variance))}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-black text-gray-900">-</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{filtered.length} عقد</span>
                                </td>
                            </tr>
                        )}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center text-gray-400 py-16 bg-gray-50/50">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl">🔍</div>
                                        <p className="font-medium text-gray-500">لا توجد نتائج مطابقة للبحث أو الفلتر</p>
                                        <button onClick={clearFilters} className="text-sm text-blue-600 underline">مسح الفلتر</button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
