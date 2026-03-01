import { ProjectAnalytics, ProjectStaffing, ProjectExpense, ActualExpense, Project } from './types'

export function computeStaffingBudget(staffingItems: ProjectStaffing[]): number {
    return staffingItems.reduce((sum, s) => sum + s.staff_count * s.monthly_salary * s.duration_months, 0)
}

export function computeExpensesBudget(expenseItems: ProjectExpense[]): number {
    return expenseItems.reduce((sum, e) => sum + e.target_amount, 0)
}

export function computeProjectAnalytics(
    project: Project,
    staffingItems: ProjectStaffing[],
    expenseItems: ProjectExpense[],
    actualExpenses: ActualExpense[]
): ProjectAnalytics {
    const totalStaffingBudget = computeStaffingBudget(staffingItems)
    const totalExpensesBudget = computeExpensesBudget(expenseItems)
    const totalBudget = totalStaffingBudget + totalExpensesBudget
    const totalActual = actualExpenses.reduce((sum, e) => sum + e.amount, 0)

    const variance = totalBudget - totalActual
    const variancePercent = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0
    const netProfit = project.total_value - totalActual
    const profitMargin = project.total_value > 0 ? (netProfit / project.total_value) * 100 : 0

    let healthStatus: 'green' | 'yellow' | 'red' = 'green'
    if (variancePercent >= 100) healthStatus = 'red'
    else if (variancePercent >= 80) healthStatus = 'yellow'

    return {
        project,
        staffingItems,
        expenseItems,
        actualExpenses,
        totalStaffingBudget,
        totalExpensesBudget,
        totalBudget,
        totalActual,
        variance,
        variancePercent,
        netProfit,
        profitMargin,
        healthStatus,
    }
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('ar-SA', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value) + ' ر.س'
}

export function formatPercent(value: number): string {
    return value.toFixed(1) + '%'
}
