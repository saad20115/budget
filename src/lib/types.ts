export type ProjectStatus = 'Active' | 'Completed' | 'On Hold'

export interface Project {
    id: string
    user_id: string
    name: string
    client: string
    total_value: number
    target_profit_margin: number
    status: ProjectStatus
    category?: string
    start_date?: string
    end_date?: string
    duration_months: number
    paid_amount?: number
    created_at: string
}

export interface ProjectStaffing {
    id: string
    project_id: string
    role_name: string
    staff_count: number
    monthly_salary: number
    duration_months: number
    created_at: string
}

export interface ProjectExpense {
    id: string
    project_id: string
    name: string
    target_amount: number
    created_at: string
}

export interface ActualExpense {
    id: string
    project_id: string
    staffing_id?: string
    expense_id?: string
    amount: number
    expense_date: string
    notes?: string
    attachment_url?: string
    created_at: string
}

// Computed analytics for a project
export interface ProjectAnalytics {
    project: Project
    staffingItems: ProjectStaffing[]
    expenseItems: ProjectExpense[]
    actualExpenses: ActualExpense[]
    // Totals
    totalStaffingBudget: number    // sum of (count * salary * months)
    totalExpensesBudget: number    // sum of target_amount
    totalBudget: number            // staffing + expenses
    totalActual: number            // sum of actual amounts
    // KPIs
    variance: number               // budget - actual
    variancePercent: number        // (actual/budget)*100
    netProfit: number              // total_value - totalActual
    profitMargin: number           // (netProfit/total_value)*100
    healthStatus: 'green' | 'yellow' | 'red'
}

export interface ProjectClaim {
    id: string
    project_id: string
    title: string
    amount: number
    paid_amount: number
    due_date: string
    status: 'Pending' | 'Invoiced' | 'Paid' | 'Overdue' | 'Sent' | 'NotYetDue' | 'PartiallyPaid'
    collection_date?: string
    notes?: string
    created_at: string
}
