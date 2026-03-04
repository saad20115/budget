import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatPercent } from '@/lib/analytics'
import { Project } from '@/lib/types'
import ReportTabsClient from './ReportTabsClient'
import type { ComparisonRow } from './BudgetComparisonClient'

export default async function ReportPage() {
    const supabase = await createClient()

    // 1. Fetch Projects
    const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .order('total_value', { ascending: false })

    const projects: Project[] = projectsData ?? []
    const projectMap: Record<string, string> = {}
    projects.forEach(p => { projectMap[p.id] = p.name })

    // 2. Fetch Budget (Project Expenses + Staffing)
    const { data: expenses } = await supabase
        .from('project_expenses')
        .select('id, project_id, name, target_amount')

    const { data: staffing } = await supabase
        .from('project_staffing')
        .select('id, project_id, role_name, monthly_salary, staff_count, duration_months')

    // 3. Fetch Actual Expenses
    const { data: actuals } = await supabase
        .from('actual_expenses')
        .select('project_id, amount, expense_id, staffing_id')

    // 4. Fetch Claims (Invoices)
    const { data: claims } = await supabase
        .from('project_claims')
        .select('project_id, amount, status')

    // ─── Calculate Maps ───
    const budgetMap: Record<string, number> = {}
    const actualMap: Record<string, number> = {}
    const invoicedMap: Record<string, number> = {}

    expenses?.forEach(e => {
        budgetMap[e.project_id] = (budgetMap[e.project_id] || 0) + Number(e.target_amount)
    })
    staffing?.forEach(s => {
        const staffCost = Number(s.monthly_salary) * Number(s.staff_count) * Number(s.duration_months)
        budgetMap[s.project_id] = (budgetMap[s.project_id] || 0) + staffCost
    })

    actuals?.forEach(a => {
        actualMap[a.project_id] = (actualMap[a.project_id] || 0) + Number(a.amount)
    })

    let totalCollected = 0
    let totalPending = 0
    claims?.forEach(c => {
        invoicedMap[c.project_id] = (invoicedMap[c.project_id] || 0) + Number(c.amount)
        if (c.status === 'Paid') totalCollected += Number(c.amount)
        if (['Pending', 'Sent', 'Overdue'].includes(c.status)) totalPending += Number(c.amount)
    })

    // ─── Overall KPIs ───
    const totalPortfolioValue = projects.reduce((s, p) => s + Number(p.total_value), 0)
    const totalOperatingBudget = Object.values(budgetMap).reduce((s, b) => s + b, 0)
    const totalActualSpent = Object.values(actualMap).reduce((s, a) => s + a, 0)
    const overallVariance = totalOperatingBudget - totalActualSpent
    const avgMargin = projects.length > 0 ? projects.reduce((s, p) => s + Number(p.target_profit_margin), 0) / projects.length : 0

    // ─── Table Data ───
    const tableData = projects.map(p => {
        const budget = budgetMap[p.id] || 0
        const actual = actualMap[p.id] || 0
        const invoiced = invoicedMap[p.id] || 0
        const variance = budget - actual
        const profit = invoiced > 0 ? invoiced - actual : Number(p.total_value) - actual
        return { ...p, budget, actual, variance, profit, invoiced, share: 0 }
    })

    // ─── Chart Data (top 12) — نسخة منفصلة لتجنب تعديل tableData ───
    const chartData = [...tableData]
        .sort((a, b) => b.budget - a.budget)
        .slice(0, 12)
        .map(p => ({
            name: p.name.length > 16 ? p.name.substring(0, 16) + '…' : p.name,
            budget: p.budget,
            actual: p.actual,
        }))

    // ─── Pie Chart Data ───
    const statusCounts = projects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const pieChartData = [
        { name: 'نشط', value: statusCounts['Active'] || 0 },
        { name: 'مكتمل', value: statusCounts['Completed'] || 0 },
        { name: 'معلق', value: statusCounts['On Hold'] || 0 },
    ].filter(d => d.value > 0)

    // ─── Comparison Data (Budget vs Actual by expense name) ───
    // Map: expense.id → actuals sum
    const actualByExpenseId: Record<string, number> = {}
    actuals?.forEach(a => {
        if (a.expense_id) {
            actualByExpenseId[a.expense_id] = (actualByExpenseId[a.expense_id] || 0) + Number(a.amount)
        }
    })

    // Group expenses by name
    const expenseGroups: Record<string, { entries: { id: string; project_id: string; project_name: string; target_amount: number; actualAmount: number }[]; totalActual: number }> = {}
    expenses?.forEach(e => {
        if (!expenseGroups[e.name]) {
            expenseGroups[e.name] = { entries: [], totalActual: 0 }
        }
        const entryActual = actualByExpenseId[e.id] || 0
        expenseGroups[e.name].entries.push({
            id: e.id,
            project_id: e.project_id,
            project_name: projectMap[e.project_id] || e.project_id,
            target_amount: Number(e.target_amount),
            actualAmount: entryActual,
        })
        expenseGroups[e.name].totalActual += entryActual
    })

    const comparisonRows: ComparisonRow[] = Object.entries(expenseGroups).map(([name, data]) => ({
        name,
        entries: data.entries,
        totalBudget: data.entries.reduce((s, e) => s + e.target_amount, 0),
        totalActual: data.totalActual,
    })).sort((a, b) => b.totalBudget - a.totalBudget)
    // Staffing row
    // حساب المصاريف الفعلية لكل بند كوادر (staffing_id)
    const actualByStaffingId: Record<string, number> = {}
    actuals?.forEach(a => {
        if (a.staffing_id) {
            actualByStaffingId[a.staffing_id] = (actualByStaffingId[a.staffing_id] || 0) + Number(a.amount)
        }
    })
    const staffingActualTotal = Object.values(actualByStaffingId).reduce((s, v) => s + v, 0)

    const staffingRow = {
        entries: (staffing ?? []).map(s => ({
            id: s.id,
            project_id: s.project_id,
            project_name: projectMap[s.project_id] || s.project_id,
            role_name: s.role_name,
            staff_count: Number(s.staff_count),
            monthly_salary: Number(s.monthly_salary),
            duration_months: Number(s.duration_months),
            actualAmount: actualByStaffingId[s.id] || 0,
        })),
        totalBudget: (staffing ?? []).reduce((s, st) => s + Number(st.monthly_salary) * Number(st.staff_count) * Number(st.duration_months), 0),
        totalActual: staffingActualTotal,
    }

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

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-in-bottom">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 text-sm font-medium">إجمالي المحفظة (العقود)</p>
                        <span className="text-blue-500 bg-blue-50 px-2 py-0.5 rounded text-xs">قيمة كلية</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalPortfolioValue)}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
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

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
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

            {/* Tabs (charts + table + comparison) */}
            <ReportTabsClient
                tableData={tableData}
                chartData={chartData}
                pieChartData={pieChartData}
                comparisonRows={comparisonRows}
                staffingRow={staffingRow}
            />
        </div>
    )
}
