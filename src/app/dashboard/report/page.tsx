import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatPercent } from '@/lib/analytics'
import { Project } from '@/lib/types'
import Link from 'next/link'
import { BudgetVsActualChart, ExpensePieChart } from '@/components/Charts'
import ReportTableClient from './ReportTableClient'

export default async function ReportPage() {
    const supabase = await createClient()

    // 1. Fetch Projects
    const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .order('total_value', { ascending: false })

    const projects: Project[] = projectsData ?? []

    // 2. Fetch Budget (Project Expenses + Staffing)
    const { data: expenses } = await supabase.from('project_expenses').select('project_id, target_amount')
    const { data: staffing } = await supabase.from('project_staffing').select('project_id, monthly_salary, staff_count, duration_months')

    // 3. Fetch Actual Expenses
    const { data: actuals } = await supabase.from('actual_expenses').select('project_id, amount')

    // 4. Fetch Claims (Invoices)
    const { data: claims } = await supabase.from('project_claims').select('project_id, amount, status')

    // Calculate Maps
    const budgetMap: Record<string, number> = {}
    const actualMap: Record<string, number> = {}
    const invoicedMap: Record<string, number> = {}

    // Process Budget
    expenses?.forEach(e => {
        budgetMap[e.project_id] = (budgetMap[e.project_id] || 0) + Number(e.target_amount)
    })
    staffing?.forEach(s => {
        const staffCost = Number(s.monthly_salary) * Number(s.staff_count) * Number(s.duration_months)
        budgetMap[s.project_id] = (budgetMap[s.project_id] || 0) + staffCost
    })

    // Process Actuals
    actuals?.forEach(a => {
        actualMap[a.project_id] = (actualMap[a.project_id] || 0) + Number(a.amount)
    })

    // Process Invoices/Claims
    let totalCollected = 0
    let totalPending = 0
    claims?.forEach(c => {
        invoicedMap[c.project_id] = (invoicedMap[c.project_id] || 0) + Number(c.amount)
        if (c.status === 'Paid') totalCollected += Number(c.amount)
        if (['Pending', 'Sent', 'Overdue'].includes(c.status)) totalPending += Number(c.amount)
    })

    // Overall KPIs
    const totalPortfolioValue = projects.reduce((s, p) => s + Number(p.total_value), 0)
    const totalOperatingBudget = Object.values(budgetMap).reduce((s, b) => s + b, 0)
    const totalActualSpent = Object.values(actualMap).reduce((s, a) => s + a, 0)
    const overallVariance = totalOperatingBudget - totalActualSpent
    const avgMargin = projects.length > 0 ? projects.reduce((s, p) => s + Number(p.target_profit_margin), 0) / projects.length : 0

    // Prepare table and chart data
    const tableData = projects.map(p => {
        const budget = budgetMap[p.id] || 0
        const actual = actualMap[p.id] || 0
        const invoiced = invoicedMap[p.id] || 0
        const variance = budget - actual

        // Define actual profit dynamically. If there's collected/invoiced revenue, use that logic.
        // Otherwise fallback to basic TotalValue - Actual
        const profit = invoiced > 0 ? invoiced - actual : Number(p.total_value) - actual
        const share = totalPortfolioValue > 0 ? (Number(p.total_value) / totalPortfolioValue) * 100 : 0

        return {
            ...p,
            budget,
            actual,
            variance,
            profit,
            share,
            invoiced
        }
    })

    const chartData = tableData.map(p => ({
        name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
        budget: p.budget,
        actual: p.actual
    })).sort((a, b) => b.budget - a.budget) // Sort by budget size for the chart

    // Status Distribution Chart Data
    const statusCounts = projects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const pieChartData = [
        { name: 'نشط', value: statusCounts['Active'] || 0 },
        { name: 'مكتمل', value: statusCounts['Completed'] || 0 },
        { name: 'معلق', value: statusCounts['On Hold'] || 0 }
    ].filter(d => d.value > 0)

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 fade-in">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">التقرير الشامل والأرباح</h1>
                    <p className="text-gray-500 mt-2 max-w-2xl">
                        تحليل مالي استراتيجي لجميع المشاريع، يغطي مؤشرات المحفظة، الإيرادات والمطالبات، والموازنات التشغيلية.
                    </p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-bold border border-blue-100 flex items-center gap-2 shadow-sm">
                    <span className="text-lg">📊</span>
                    <span>{projects.length} مشاريع مسجلة</span>
                </div>
            </div>

            {/* Premium KPIs Grid (Top level) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 text-sm font-medium">إجمالي المحفظة (العقود)</p>
                        <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded text-xs">قيمة كلية</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalPortfolioValue)}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 text-sm font-medium">الإيرادات المحصلة</p>
                        <span className="text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded text-xs">فواتير مدفوعة</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalCollected)}</p>
                    <p className="text-rose-500 text-xs font-medium mt-2 bg-rose-50 inline-block px-2 py-0.5 rounded">
                        متأخرات ومستحقة: <span dir="ltr">{formatCurrency(totalPending)}</span>
                    </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 text-sm font-medium">الموازنة التشغيلية المعتمدة</p>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalOperatingBudget)}</p>
                    <p className="text-gray-500 text-xs font-medium mt-2 bg-gray-50 inline-block px-2 py-0.5 rounded border border-gray-100">
                        التكلفة الفعلية: <span className="font-bold text-gray-700" dir="ltr">{formatCurrency(totalActualSpent)}</span>
                    </p>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl" />
                    <p className="text-emerald-100 text-sm font-medium mb-2 relative z-10">متوسط هامش الربح المستهدف</p>
                    <p className="text-4xl font-bold relative z-10">{formatPercent(avgMargin)}</p>
                    <div className="mt-2 text-sm text-emerald-50 opacity-90 relative z-10 flex justify-between items-center">
                        <span>إجمالي التوفير:</span>
                        <span className="font-bold" dir="ltr">{formatCurrency(overallVariance)}</span>
                    </div>
                </div>
            </div>

            {/* Visual Overview Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 slide-in-bottom">

                {/* Status Breakdown Chart */}
                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                        توزيع حالات المشاريع
                    </h3>
                    {pieChartData.length > 0 ? (
                        <div className="flex justify-center items-center h-[280px]">
                            <ExpensePieChart data={pieChartData} />
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">لا توجد بيانات كافية</div>
                    )}
                </div>

                {/* Budget vs Actual for All Projects */}
                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                            مقارنة الموازنة والصرف الفعلي للمشاريع
                        </h3>
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-gray-600">الموازنة التشغيلية</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-gray-600">الصرف الفعلي</span></div>
                        </div>
                    </div>

                    {chartData.length > 0 ? (
                        <div className="h-[280px]">
                            <BudgetVsActualChart data={chartData} />
                        </div>
                    ) : (
                        <div className="h-[280px] flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">لا توجد بيانات للعرض</div>
                    )}
                </div>
            </div>

            {/* Detailed Data Table - Client component with search & filter */}
            <ReportTableClient data={tableData} />
        </div>
    )
}
