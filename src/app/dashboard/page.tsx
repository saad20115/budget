import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatPercent } from '@/lib/analytics'
import Link from 'next/link'
import { BudgetVsActualChart } from '@/components/Charts'
import DashboardFilter from '@/components/DashboardFilter'
import { Suspense } from 'react'

export default async function DashboardOverview({
    searchParams,
}: {
    searchParams?: Promise<{ category?: string; status?: string; project?: string }>
}) {
    const supabase = await createClient()
    const resolvedParams = await searchParams
    const filterCategory = resolvedParams?.category || ''
    const filterStatus = resolvedParams?.status || ''
    const filterProject = resolvedParams?.project || ''

    // Fetch basic project data
    const { data: projectsData } = await supabase.from('projects').select('id, name, total_value, status, target_profit_margin, category')
    const allProjects = projectsData ?? []

    // Apply filters
    const projects = allProjects.filter(p => {
        if (filterCategory && p.category !== filterCategory) return false
        if (filterStatus && p.status !== filterStatus) return false
        if (filterProject && p.id !== filterProject) return false
        return true
    })

    // Filtered project IDs for scoping all sub-queries
    const projectIds = projects.map(p => p.id)

    // Fetch claims (invoices) scoped to filtered projects
    const { data: claimsData } = await supabase.from('project_claims').select('id, title, project_id, amount, status, due_date')
    const claims = (claimsData ?? []).filter(c => projectIds.includes(c.project_id))

    // Fetch staffing for accurate budget, scoped to filtered projects
    const { data: staffingData } = await supabase.from('project_staffing').select('project_id, staff_count, monthly_salary, duration_months')
    const staffing = (staffingData ?? []).filter(s => projectIds.includes(s.project_id))

    // Calculate basic portfolio KPIs
    const totalPortfolioValue = projects.reduce((sum, p) => sum + Number(p.total_value), 0)
    const activeCount = projects.filter(p => p.status === 'Active').length

    // Calculate Claims/Revenues KPIs
    const collectedRevenue = claims.filter(c => c.status === 'Paid').reduce((sum, c) => sum + Number(c.amount), 0)
    const pendingRevenue = claims.filter(c => ['Pending', 'Sent', 'Overdue'].includes(c.status)).reduce((sum, c) => sum + Number(c.amount), 0)

    // Fetch and calculate total actual spending scoped to filtered projects dynamically from Odoo Cache
    const { data: cache } = await supabase.from('external_expenses_cache').select('cost_center, account_code, account_name, expenses')
    const { data: mappings } = await supabase.from('expense_mapping').select('external_cost_center, external_account_code, linked_project_id')

    const actualMap: Record<string, number> = {}
    let unmappedTotal = 0

    cache?.forEach(row => {
        const amt = Number(row.expenses)
        const mapping = mappings?.find(m => m.external_cost_center === row.cost_center && m.external_account_code === row.account_code)
        
        if (mapping && mapping.linked_project_id) {
            actualMap[mapping.linked_project_id] = (actualMap[mapping.linked_project_id] || 0) + amt
        } else {
            unmappedTotal += amt
        }
    })

    const activeProjects = allProjects.filter(p => p.status === 'Active')
    const activeProjectsTotalValue = activeProjects.reduce((s, p) => s + Number(p.total_value), 0)
    
    if (activeProjectsTotalValue > 0 && unmappedTotal > 0) {
        activeProjects.forEach(p => {
            const share = Number(p.total_value) / activeProjectsTotalValue
            actualMap[p.id] = (actualMap[p.id] || 0) + (unmappedTotal * share)
        })
    }

    let totalActualSpending = 0
    projects.forEach(p => {
        totalActualSpending += actualMap[p.id] || 0
    })

    // Fetch budget items scoped to filtered projects
    const { data: budgetItemsData } = await supabase.from('project_expenses').select('project_id, target_amount')
    const { data: staffingBudgetData } = await supabase.from('project_staffing').select('project_id, staff_count, monthly_salary, duration_months')

    // Total Budget = filtered project_expenses + filtered staffing costs
    const totalBudgetFromItems = (budgetItemsData ?? []).filter(e => projectIds.includes(e.project_id)).reduce((sum, e) => sum + Number(e.target_amount), 0)
    const totalBudgetFromStaffing = (staffingBudgetData ?? []).filter(s => projectIds.includes(s.project_id)).reduce((sum, s) => sum + (Number(s.staff_count) * Number(s.monthly_salary) * Number(s.duration_months)), 0)
    const totalBudget = totalBudgetFromItems + totalBudgetFromStaffing

    // Weighted average target profit margin across all projects
    const projectsWithMargin = projects.filter(p => p.target_profit_margin && Number(p.total_value) > 0)
    const weightedProfitNumerator = projectsWithMargin.reduce((sum, p) => sum + (Number(p.target_profit_margin) * Number(p.total_value)), 0)
    const weightedProfitDenominator = projectsWithMargin.reduce((sum, p) => sum + Number(p.total_value), 0)
    const avgTargetProfitMargin = weightedProfitDenominator > 0 ? (weightedProfitNumerator / weightedProfitDenominator) : 0
    const targetProfitValue = totalPortfolioValue * (avgTargetProfitMargin / 100)

    // Budget Deviation Rate = (Actual - Budget) / Budget * 100
    const budgetDeviationRate = totalBudget > 0 ? ((totalActualSpending - totalBudget) / totalBudget * 100) : 0

    // Data for charts
    // 1. Project Status Distribution
    const statusCounts = projects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const pieChartData = [
        { name: 'نشط', value: statusCounts['Active'] || 0 },
        { name: 'مكتمل', value: statusCounts['Completed'] || 0 },
        { name: 'معلق', value: statusCounts['On Hold'] || 0 }
    ].filter(d => d.value > 0)

    // 2. Budget vs Actual for Top projects
    const { data: projectExpenses } = await supabase.from('project_expenses').select('project_id, target_amount')

    const budgetMap: Record<string, number> = {}

    // Include staffing in budget
    staffing.forEach(st => {
        budgetMap[st.project_id] = (budgetMap[st.project_id] || 0) + (Number(st.staff_count) * Number(st.monthly_salary) * Number(st.duration_months))
    })

    projectExpenses?.filter(pe => projectIds.includes(pe.project_id)).forEach(pe => {
        budgetMap[pe.project_id] = (budgetMap[pe.project_id] || 0) + Number(pe.target_amount)
    })

    // Actual map is already populated with the distributed values!

    const chartData = projects.map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        budget: budgetMap[p.id] || 0,
        actual: actualMap[p.id] || 0
    })).sort((a, b) => b.budget - a.budget).slice(0, 5) // Top 5 by budget

    // Upcoming or Overdue Claims Data
    const urgentClaims = claims
        .filter(c => ['Pending', 'Sent', 'Overdue', 'NotYetDue'].includes(c.status))
        .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime())
        .slice(0, 4)

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">
            {/* Header & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">النظرة العامة للمحفظة</h1>
                    <p className="text-gray-500 mt-2 text-sm">مرحباً بك! إليك ملخص أداء جميع المشاريع حتى اليوم.</p>
                </div>

                {/* Filters */}
                <div className="flex-1 overflow-x-auto">
                    <Suspense fallback={<div className="h-9" />}>
                        <DashboardFilter projects={allProjects} />
                    </Suspense>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3">
                    <a
                        href="https://reports.jalbait.com/"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>🏠</span>
                        الصفحة الرئيسية (التقارير المالية)
                    </a>
                    <Link
                        href="/dashboard/projects/new"
                        className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                    >
                        <span>+</span>
                        مشروع جديد
                    </Link>
                    <Link
                        href="/dashboard/report"
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center gap-2 border border-emerald-100"
                    >
                        <span className="text-lg leading-none">📊</span>
                        التقارير التحليلية
                    </Link>
                </div>
            </div>

            {/* Premium KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                {/* KPI 1: Total Portfolio Value */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-400 to-blue-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي قيمة المحفظة</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalPortfolioValue)}</p>
                    </div>
                </div>

                {/* KPI 2 - NEW: Collected Revenues */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الإيرادات المحصلة</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(collectedRevenue)}</p>
                        <p className="text-rose-600 text-xs font-semibold mt-2 inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded">
                            <span>متأخرات ومستحقات:</span>
                            <span dir="ltr">{formatCurrency(pendingRevenue)}</span>
                        </p>
                    </div>
                </div>

                {/* KPI 3: Total Actual Expenses */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-amber-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الصرف الفعلي</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalActualSpending)}</p>
                    </div>
                </div>

                {/* KPI 4: Active Projects */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-indigo-400 to-indigo-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">المشاريع النشطة</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-gray-900 tracking-tight">{activeCount}</p>
                            <p className="text-gray-500 text-sm">من أصل {projects.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Second KPIs Row: Budget, Profit, Deviation */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                {/* KPI 5: Total Budget */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-purple-400 to-purple-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">إجمالي الموازنة المخصصة</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalBudget)}</p>
                        <p className="text-purple-600 text-xs font-medium mt-2">كوادر + بنود المصاريف</p>
                    </div>
                </div>

                {/* KPI 6: Target Profit Margin */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-teal-400 to-teal-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">نسبة الربح المستهدف (مرجّحة)</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatPercent(avgTargetProfitMargin)}</p>
                        <p className="text-teal-600 text-xs font-medium mt-2">مرجّح بقيمة كل مشروع</p>
                    </div>
                </div>

                {/* KPI 7: Target Profit Value */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">قيمة الربح المستهدف</p>
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(targetProfitValue)}</p>
                        <p className="text-cyan-600 text-xs font-medium mt-2">{formatPercent(avgTargetProfitMargin)} من إجمالي القيمة</p>
                    </div>
                </div>

                {/* KPI 8: Budget Deviation Rate */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b ${budgetDeviationRate > 10 ? 'from-red-400 to-red-600' : budgetDeviationRate > 0 ? 'from-amber-400 to-amber-600' : 'from-emerald-400 to-emerald-600'}`} />
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${budgetDeviationRate > 10 ? 'bg-red-50 text-red-600' : budgetDeviationRate > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">معدل الانحراف عن الموازنة</p>
                        <p className={`text-3xl font-bold tracking-tight ${budgetDeviationRate > 10 ? 'text-red-600' : budgetDeviationRate > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {budgetDeviationRate > 0 ? '+' : ''}{budgetDeviationRate.toFixed(1)}%
                        </p>
                        <p className={`text-xs font-medium mt-2 ${budgetDeviationRate > 10 ? 'text-red-500' : budgetDeviationRate > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {budgetDeviationRate > 0 ? 'تجاوز في الصرف' : budgetDeviationRate < 0 ? 'وفر في الميزانية' : 'في حدود الموازنة'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 slide-in-bottom">

                {/* Urgent Claims Sidebar - NEW */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <div className="w-2 h-6 bg-rose-500 rounded-full"></div>
                            أحدث المطالبات
                        </h3>
                        <Link href="/dashboard/revenues" className="text-sm text-blue-600 hover:text-blue-700 font-medium">عرض الكل</Link>
                    </div>

                    {urgentClaims.length > 0 ? (
                        <div className="space-y-4 flex-1">
                            {urgentClaims.map(claim => {
                                const project = projects.find(p => p.id === claim.project_id)
                                const isOverdue = claim.status === 'Overdue' || (new Date(claim.due_date) < new Date() && claim.status !== 'Paid')
                                return (
                                    <div key={claim.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-50">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{claim.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{project?.name || 'مشروع غير معروف'}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {isOverdue ? 'متأخرة' : 'قادمة'}
                                                </span>
                                                <span className="text-xs font-medium text-gray-500 dir-ltr">{new Date(claim.due_date).toLocaleDateString('ar-EG')}</span>
                                            </div>
                                        </div>
                                        <div className="text-left font-sans">
                                            <p className="text-sm font-bold text-emerald-600" dir="ltr">{formatCurrency(claim.amount)}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl p-6 text-center">
                            <span className="text-3xl mb-2">✨</span>
                            <p className="text-sm">لا توجد مطالبات متأخرة أو قادمة قريباً</p>
                        </div>
                    )}
                </div>

                {/* Top Projects Budget vs Actual + Staffing */}
                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                            مقارنة الموازنة (شاملة الكوادر) والصرف
                        </h3>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-gray-600">الموازنة (كوادر + مصاريف)</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-gray-600">الفعلي</span></div>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="h-[280px]">
                            <BudgetVsActualChart data={chartData} />
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">لا توجد بيانات كافية لعرض المقارنة</div>
                    )}
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden slide-in-bottom">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500 blur-[80px] rounded-full opacity-30" />
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-3">النظرة المالية المحدثة</h3>
                    <p className="text-blue-100 text-sm mb-6 max-w-xl leading-relaxed">
                        دُعمت لوحة التحكم الآن ببيانات إضافية مثل إيرادات الفواتير والمبالغ المحصلة بالإضافة إلى الموازنات الدقيقة التي تشمل تكاليف الكوادر والمصاريف الأخرى مما يوفر نظرة أدق لأداء المحفظة.
                    </p>
                    <Link href="/dashboard/projects" className="inline-flex bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-sm">
                        استعراض كافة المشاريع &larr;
                    </Link>
                </div>
            </div>
        </div>
    )
}
