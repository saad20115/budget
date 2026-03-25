'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Project, ProjectClaim } from '@/lib/types'
import { openPrintWindow } from './ClaimsPrintTemplates'

interface Props {
    projects: Project[]
    claims: ProjectClaim[]
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    Paid: { label: 'مدفوعة', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    PartiallyPaid: { label: 'مدفوعة جزئياً', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
    Pending: { label: 'معلقة', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
    Sent: { label: 'مرسلة', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    Overdue: { label: 'متأخرة', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
    Invoiced: { label: 'مفوترة', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
    NotYetDue: { label: 'لم يحن', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
}

const ALL_STATUSES = Object.keys(STATUS_CONFIG)

function fmt(n: number) {
    return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(n) + ' ر.س'
}

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
        </span>
    )
}

export default function ClaimsReportClient({ projects, claims }: Props) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')

    // Dual scrollbar refs  
    const topScrollRef = useRef<HTMLDivElement>(null)
    const tableScrollRef = useRef<HTMLDivElement>(null)
    const topInnerRef = useRef<HTMLDivElement>(null)
    const isSyncing = useRef(false)

    // Sync top scrollbar width to actual table scroll width
    // NOTE: this effect runs after filteredProjects/maxClaims are computed (see below)
    // Sync scroll positions (handles RTL where scrollLeft may be negative/0-based from right)
    useEffect(() => {
        const top = topScrollRef.current
        const table = tableScrollRef.current
        if (!top || !table) return

        const onTopScroll = () => {
            if (isSyncing.current) return
            isSyncing.current = true
            table.scrollLeft = top.scrollLeft
            isSyncing.current = false
        }
        const onTableScroll = () => {
            if (isSyncing.current) return
            isSyncing.current = true
            top.scrollLeft = table.scrollLeft
            isSyncing.current = false
        }

        top.addEventListener('scroll', onTopScroll)
        table.addEventListener('scroll', onTableScroll)
        return () => {
            top.removeEventListener('scroll', onTopScroll)
            table.removeEventListener('scroll', onTableScroll)
        }
    }, [])

    // Map claims by projectId
    const claimsByProject = useMemo(() => {
        const map: Record<string, ProjectClaim[]> = {}
        claims.forEach(c => {
            if (!map[c.project_id]) map[c.project_id] = []
            map[c.project_id].push(c)
        })
        return map
    }, [claims])

    // Categories
    const categories = useMemo(() => {
        const cats = [...new Set(projects.map(p => p.category || 'غير محدد').filter(Boolean))]
        return cats.sort()
    }, [projects])

    // Filtered projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.client?.toLowerCase().includes(search.toLowerCase())) return false
            if (categoryFilter !== 'all' && (p.category || 'غير محدد') !== categoryFilter) return false
            // if status filter, keep projects that have at least one claim with that status
            if (statusFilter !== 'all') {
                const pClaims = claimsByProject[p.id] ?? []
                if (!pClaims.some(c => c.status === statusFilter)) return false
            }
            return true
        })
    }, [projects, search, statusFilter, categoryFilter, claimsByProject])

    // KPIs
    const kpis = useMemo(() => {
        const relevantClaims = claims.filter(c => filteredProjects.some(p => p.id === c.project_id))
        const total = relevantClaims.reduce((s, c) => s + Number(c.amount), 0)
        const paid = relevantClaims.reduce((s, c) => s + Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0)), 0)
        const pending = relevantClaims.filter(c => ['Pending', 'Sent', 'Invoiced', 'PartiallyPaid'].includes(c.status)).reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0))), 0)
        const overdue = relevantClaims.filter(c => c.status === 'Overdue').reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0))), 0)
        const collectionRate = total > 0 ? (paid / total) * 100 : 0
        return { total, paid, pending, overdue, collectionRate, count: relevantClaims.length }
    }, [claims, filteredProjects])

    // Contract totals with VAT
    const contractKpis = useMemo(() => {
        const totalWithVat = filteredProjects.reduce((s, p) => s + Number(p.total_value) * 1.15, 0)
        return { totalWithVat }
    }, [filteredProjects])

    // Max claims per row (for column width consistency)
    const maxClaims = useMemo(() => {
        if (filteredProjects.length === 0) return 0
        return Math.max(...filteredProjects.map(p => (claimsByProject[p.id] ?? []).length))
    }, [filteredProjects, claimsByProject])

    // Sync top scrollbar width to actual table scrollWidth (must come after filteredProjects & maxClaims)
    useEffect(() => {
        const table = tableScrollRef.current
        const topInner = topInnerRef.current
        if (!table || !topInner) return
        const updateWidth = () => {
            topInner.style.width = table.scrollWidth + 'px'
        }
        updateWidth()
        const ro = new ResizeObserver(updateWidth)
        ro.observe(table)
        return () => ro.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredProjects, maxClaims])

    return (
        <div className="p-4 md:p-8 space-y-6" dir="rtl">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">تقرير المطالبات</h1>
                    <p className="text-gray-500 mt-1 text-sm">عرض تفصيلي لجميع المطالبات مصنفةً حسب المشاريع</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Print Buttons */}
                    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => openPrintWindow(projects, claims, 'all')}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            title="طباعة التقرير الشامل"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
                            الشامل
                        </button>
                        <button
                            onClick={() => openPrintWindow(projects, claims, 'overdue')}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                            title="طباعة المطالبات المتأخرة"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
                            المتأخرة
                        </button>
                        <button
                            onClick={() => openPrintWindow(projects, claims, 'notYetDue')}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                            title="طباعة المطالبات التي لم يحن وقتها"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
                            لم يحن
                        </button>
                    </div>
                    <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-2">
                        <span className="text-xl">📋</span>
                        <span className="font-semibold text-gray-700">{claims.length}</span> مطالبة إجمالية
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

                {/* إجمالي العقود شامل الضريبة */}
                <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-5 text-white col-span-2 lg:col-span-1 shadow-lg shadow-violet-200 relative overflow-hidden">
                    <div className="absolute -left-2 -bottom-2 w-16 h-16 bg-white/10 rounded-full" />
                    <p className="text-violet-100 text-xs font-medium mb-1.5">إجمالي العقود + ضريبة 15%</p>
                    <p className="text-2xl font-bold">{fmt(contractKpis.totalWithVat)}</p>
                    <p className="text-violet-200 text-xs mt-1">{filteredProjects.length} مشروع</p>
                </div>

                {/* إجمالي المطالبات */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200 relative overflow-hidden">
                    <div className="absolute -left-2 -bottom-2 w-16 h-16 bg-white/10 rounded-full" />
                    <p className="text-blue-100 text-xs font-medium mb-1.5">إجمالي المطالبات</p>
                    <p className="text-xl font-bold">{fmt(kpis.total)}</p>
                    <p className="text-blue-200 text-xs mt-1">{kpis.count} مطالبة · {contractKpis.totalWithVat > 0 ? ((kpis.total / contractKpis.totalWithVat) * 100).toFixed(0) : 0}% من العقد</p>
                </div>

                {/* المحصل */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500 rounded-r-full" />
                    <p className="text-gray-500 text-xs font-medium mb-1">المحصَّل</p>
                    <p className="text-xl font-bold text-gray-900">{fmt(kpis.paid)}</p>
                    <p className="text-emerald-600 text-xs font-semibold mt-1">{kpis.collectionRate.toFixed(1)}% من المطالبات</p>
                </div>

                {/* المتبقي */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500 rounded-r-full" />
                    <p className="text-gray-500 text-xs font-medium mb-1">المتبقي (غير محصل)</p>
                    <p className="text-xl font-bold text-amber-700">{fmt(kpis.total - kpis.paid)}</p>
                    <p className="text-amber-600 text-xs font-semibold mt-1">منها متأخر: {fmt(kpis.overdue)}</p>
                </div>

                {/* نسبة التحصيل */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500 rounded-r-full" />
                    <p className="text-gray-500 text-xs font-medium mb-1">نسبة التحصيل</p>
                    <p className="text-3xl font-bold text-gray-900">{kpis.collectionRate.toFixed(1)}%</p>
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                            style={{ width: kpis.collectionRate.toFixed(1) + '%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Status Legend */}
            <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map(s => {
                    const cfg = STATUS_CONFIG[s]
                    const count = claims.filter(c => c.status === s).length
                    return (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(prev => prev === s ? 'all' : s)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${statusFilter === s
                                ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-offset-1 ring-current`
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label} ({count})
                        </button>
                    )
                })}
                {statusFilter !== 'all' && (
                    <button onClick={() => setStatusFilter('all')} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 underline">
                        مسح الفلتر
                    </button>
                )}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <svg className="absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                        type="text"
                        placeholder="بحث باسم المشروع أو العميل..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pr-9 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400 text-gray-900"
                    />
                </div>
                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue-400 text-gray-700 min-w-[180px]"
                    title="فلتر التصنيف"
                >
                    <option value="all">كل التصنيفات</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="text-xs text-gray-400 flex items-center px-2">
                    {filteredProjects.length} مشروع
                </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Top scrollbar mirror */}
                <div
                    ref={topScrollRef}
                    className="border-b border-gray-200 bg-gray-50"
                    style={{ overflowX: 'scroll', overflowY: 'hidden', height: '17px' }}
                >
                    <div ref={topInnerRef} style={{ height: '1px' }} />
                </div>

                <div ref={tableScrollRef} style={{ overflowX: 'auto' }}>
                    <table className="w-full text-sm" style={{ minWidth: Math.max(900, maxClaims * 220 + 560) + 'px' }}>
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-right px-5 py-4 font-semibold text-gray-700 sticky right-0 bg-gray-50 z-10 min-w-[220px] shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                                    المشروع
                                </th>
                                <th className="text-center px-4 py-4 font-semibold text-violet-700 min-w-[150px]">
                                    إجمالي العقد + ضريبة
                                </th>
                                <th className="text-center px-4 py-4 font-semibold text-gray-700 min-w-[130px]">
                                    إجمالي المطالبات
                                </th>
                                <th className="text-center px-4 py-4 font-semibold text-emerald-700 min-w-[130px]">
                                    المحصَّل
                                </th>
                                <th className="text-center px-4 py-4 font-semibold text-amber-700 min-w-[130px]">
                                    المتبقي
                                </th>
                                <th className="text-center px-4 py-4 font-semibold text-gray-500 min-w-[90px]">
                                    نسبة التحصيل
                                </th>
                                <th className="text-right px-4 py-4 font-semibold text-gray-700" colSpan={99}>
                                    تفاصيل المطالبات
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={99} className="text-center py-16 text-gray-400">
                                        <span className="text-4xl block mb-3">📭</span>
                                        <p className="font-medium text-gray-500">لا توجد نتائج</p>
                                        <p className="text-xs mt-1">جرّب تغيير معايير البحث أو الفلترة</p>
                                    </td>
                                </tr>
                            ) : filteredProjects.map(project => {
                                const pClaims = (claimsByProject[project.id] ?? [])
                                    .filter(c => statusFilter === 'all' || c.status === statusFilter)
                                    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())

                                const projectTotal = (claimsByProject[project.id] ?? []).reduce((s, c) => s + Number(c.amount), 0)
                                const projectPaid = (claimsByProject[project.id] ?? []).reduce((s, c) => s + Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0)), 0)
                                const collRate = projectTotal > 0 ? (projectPaid / projectTotal) * 100 : 0

                                return (
                                    <tr key={project.id} className="hover:bg-gray-50/50 transition-colors group">
                                        {/* Project Name */}
                                        <td className="px-5 py-4 sticky right-0 bg-white group-hover:bg-gray-50/50 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] transition-colors">
                                            <div>
                                                <p className="font-bold text-gray-900 truncate max-w-[200px]" title={project.name}>{project.name}</p>
                                                <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">{project.client}</p>
                                                {project.category && (
                                                    <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block">{project.category}</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Contract with VAT */}
                                        <td className="px-4 py-4 text-center">
                                            <p className="font-bold text-violet-700 text-sm">{fmt(Number(project.total_value) * 1.15)}</p>
                                            <p className="text-gray-400 text-xs mt-0.5">{fmt(Number(project.total_value))} + ضريبة</p>
                                        </td>

                                        {/* Summary */}
                                        <td className="px-4 py-4 text-center">
                                            <p className="font-bold text-gray-900 text-sm">{fmt(projectTotal)}</p>
                                            <p className="text-gray-400 text-xs mt-0.5">{(claimsByProject[project.id] ?? []).length} مطالبة</p>
                                        </td>

                                        {/* Collected */}
                                        <td className="px-4 py-4 text-center">
                                            <p className="font-bold text-emerald-600 text-sm">{fmt(projectPaid)}</p>
                                            <p className="text-gray-400 text-xs mt-0.5">{(claimsByProject[project.id] ?? []).filter(c => c.status === 'Paid' || c.status === 'PartiallyPaid').length} مطالبة تم تحصيلها</p>
                                        </td>

                                        {/* Remaining */}
                                        <td className="px-4 py-4 text-center">
                                            <p className={`font-bold text-sm ${projectTotal - projectPaid > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmt(projectTotal - projectPaid)}</p>
                                            <p className="text-gray-400 text-xs mt-0.5">{(claimsByProject[project.id] ?? []).filter(c => c.status !== 'Paid').length} مطالبة</p>
                                        </td>

                                        {/* Collection Rate */}
                                        <td className="px-4 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-sm font-bold ${collRate === 100 ? 'text-emerald-600' : collRate > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {collRate.toFixed(0)}%
                                                </span>
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${collRate === 100 ? 'bg-emerald-500' : collRate > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: collRate.toFixed(0) + '%' }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Claims detail cells */}
                                        {pClaims.length === 0 ? (
                                            <td className="px-6 py-4 text-gray-300 text-xs text-center">
                                                لا توجد مطالبات{statusFilter !== 'all' ? ` بحالة "${STATUS_CONFIG[statusFilter]?.label}"` : ''}
                                            </td>
                                        ) : pClaims.map(claim => {
                                            const cfg = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.Pending
                                            const isOverdue = claim.status === 'Overdue'
                                            const dueDate = claim.due_date ? new Date(claim.due_date).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
                                            const collectDate = claim.collection_date
                                                ? new Date(claim.collection_date).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : null

                                            return (
                                                <td key={claim.id} className="px-3 py-4 align-top min-w-[200px]">
                                                    <div className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border} relative`}>
                                                        {isOverdue && (
                                                            <span className="absolute top-2 left-2 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full border border-red-200 animate-pulse">!</span>
                                                        )}
                                                        <p className="font-semibold text-gray-900 text-xs leading-tight mb-2 pr-1">{claim.title}</p>
                                                        
                                                        {claim.status === 'PartiallyPaid' ? (
                                                            <div className="mb-2" dir="ltr">
                                                                <p className="text-base font-bold text-gray-900">{fmt(Number(claim.amount))}</p>
                                                                <p className="text-xs font-semibold text-emerald-600 mt-0.5 text-right" dir="rtl">محصّل: {fmt(Number(claim.paid_amount || 0))}</p>
                                                                <p className="text-xs font-semibold text-amber-600 text-right" dir="rtl">متبقي: {fmt(Number(claim.amount) - Number(claim.paid_amount || 0))}</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-base font-bold text-gray-900 mb-2" dir="ltr">{fmt(Number(claim.amount))}</p>
                                                        )}

                                                        <StatusBadge status={claim.status} />
                                                        <div className="mt-2 space-y-1">
                                                            <div className="flex items-center gap-1 text-[11px] text-gray-500">
                                                                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                                                <span>الاستحقاق: <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>{dueDate}</span></span>
                                                            </div>
                                                            {collectDate && (
                                                                <div className="flex items-center gap-1 text-[11px] text-emerald-600">
                                                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" /></svg>
                                                                    <span>التحصيل: <span className="font-semibold">{collectDate}</span></span>
                                                                </div>
                                                            )}
                                                            {claim.notes && (
                                                                <p className="text-[11px] text-gray-400 italic truncate" title={claim.notes}>{claim.notes}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>

                        {/* Footer totals */}
                        {filteredProjects.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-blue-50 font-bold">
                                    <td className="px-5 py-4 sticky right-0 bg-blue-50 z-10 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-gray-800">
                                        الإجمالي ({filteredProjects.length} مشروع)
                                    </td>
                                    <td className="px-4 py-4 text-center text-violet-700">{fmt(contractKpis.totalWithVat)}</td>
                                    <td className="px-4 py-4 text-center text-blue-700">{fmt(kpis.total)}</td>
                                    <td className="px-4 py-4 text-center text-emerald-700">{fmt(kpis.paid)}</td>
                                    <td className="px-4 py-4 text-center text-amber-700">{fmt(kpis.total - kpis.paid)}</td>
                                    <td className="px-4 py-4 text-center text-gray-700">{kpis.collectionRate.toFixed(1)}%</td>
                                    <td className="px-4 py-4 text-gray-500 text-xs" colSpan={99}>
                                        محصل: {fmt(kpis.paid)} · معلق: {fmt(kpis.pending)} · متأخر: {fmt(kpis.overdue)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    )
}
