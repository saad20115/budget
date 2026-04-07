import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { computeProjectAnalytics, formatCurrency, formatPercent } from '@/lib/analytics'
import ProjectDetailClient from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const [{ data: project }, { data: staffing }, { data: expenses }, { data: cache }, { data: mappings }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', id).single(),
        supabase.from('project_staffing').select('*').eq('project_id', id),
        supabase.from('project_expenses').select('*').eq('project_id', id),
        supabase.from('external_expenses_cache').select('cost_center, account_code, account_name, expenses, expense_date'),
        supabase.from('expense_mapping').select('external_cost_center, external_account_code, internal_expense_name, linked_project_id')
    ])

    if (!project) notFound()

    const { data: allProjectsData } = await supabase.from('projects').select('id, total_value, status')
    const activeProjects = allProjectsData?.filter(p => p.status === 'Active') || []
    const totalVal = activeProjects.reduce((s, p) => s + Number(p.total_value), 0)

    // Map external cache to actual expenses dynamically
    const actual: { id: string, project_id: string, amount: number, expense_date: string, created_at: string }[] = []
    let unmappedTotal = 0
    const SALARY_KEYWORDS = ['رواتب', 'أجور', 'مرتبات']
    const isSalaryExpense = (name: string) => SALARY_KEYWORDS.some(k => name.includes(k))

    cache?.forEach((row, index) => {
        const mapping = mappings?.find(m => m.external_cost_center === row.cost_center && m.external_account_code === row.account_code)
        if (mapping && mapping.linked_project_id) {
            if (mapping.linked_project_id === id) {
                const intName = mapping.internal_expense_name || row.account_name
                let expenseId: string | null = null
                let staffingId: string | null = null

                if (isSalaryExpense(intName)) {
                    const staff = staffing?.find(s => s.role_name === intName || isSalaryExpense(s.role_name))
                    if (staff) {
                        staffingId = staff.id
                    } else {
                        const newFakeId = `fake-staff-${id}-${intName}`
                        if (staffing) {
                            staffing.push({
                                id: newFakeId,
                                project_id: id,
                                role_name: intName,
                                staff_count: 1,
                                monthly_salary: 0,
                                duration_months: 0
                            })
                        }
                        staffingId = newFakeId
                    }
                } else {
                    const exp = expenses?.find(e => e.name === intName)
                    if (exp) {
                        expenseId = exp.id
                    } else {
                        const newFakeId = `fake-exp-${id}-${intName}`
                        if (expenses) {
                            expenses.push({
                                id: newFakeId,
                                project_id: id,
                                name: intName,
                                target_amount: 0
                            })
                        }
                        expenseId = newFakeId
                    }
                }

                actual.push({
                    id: `dynamic-${index}`,
                    project_id: id,
                    amount: Number(row.expenses),
                    expense_date: row.expense_date,
                    created_at: new Date().toISOString(),
                    expense_id: expenseId,
                    staffing_id: staffingId
                } as any)
            }
        } else if (mapping?.internal_expense_name) {
            // Unassigned project but MAPPED to name -> PRORATE to this project if active
            if (project.status === 'Active') {
                if (totalVal > 0) {
                    const share = Number(project.total_value) / totalVal
                    const proratedAmount = Number(row.expenses) * share
                    
                    const intName = mapping.internal_expense_name
                    let expenseId: string | null = null
                    let staffingId: string | null = null

                    if (isSalaryExpense(intName)) {
                        const staff = staffing?.find(s => s.role_name === intName || isSalaryExpense(s.role_name))
                        if (staff) {
                            staffingId = staff.id
                        } else {
                            const newFakeId = `fake-staff-${id}-${intName}`
                            if (staffing) {
                                staffing.push({ id: newFakeId, project_id: id, role_name: intName, staff_count: 1, monthly_salary: 0, duration_months: 0 })
                            }
                            staffingId = newFakeId
                        }
                    } else {
                        const exp = expenses?.find(e => e.name === intName)
                        if (exp) {
                            expenseId = exp.id
                        } else {
                            const newFakeId = `fake-exp-${id}-${intName}`
                            if (expenses) {
                                expenses.push({ id: newFakeId, project_id: id, name: intName, target_amount: 0 })
                            }
                            expenseId = newFakeId
                        }
                    }

                    actual.push({
                        id: `dynamic-prorated-${index}`,
                        project_id: id,
                        amount: proratedAmount,
                        expense_date: row.expense_date,
                        created_at: new Date().toISOString(),
                        expense_id: expenseId,
                        staffing_id: staffingId
                    } as any)
                }
            }
        } else {
            unmappedTotal += Number(row.expenses)
        }
    })

    if (unmappedTotal > 0) {
        if (project.status === 'Active' && totalVal > 0) {
            const share = Number(project.total_value) / totalVal
            const proratedAmount = unmappedTotal * share
            actual.push({
                id: 'prorated-unmapped',
                project_id: id,
                amount: proratedAmount,
                expense_date: new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString()
            })
        }
    }

    const analytics = computeProjectAnalytics(
        project,
        staffing ?? [],
        expenses ?? [],
        actual
    )

    return <ProjectDetailClient analytics={analytics} />
}
