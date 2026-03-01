'use client'

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { formatCurrency } from '@/lib/analytics'
import { ActualExpense } from '@/lib/types'

interface Props {
    actualExpenses: ActualExpense[]
    totalBudget: number
}

export default function ExpenseTrendChart({ actualExpenses, totalBudget }: Props) {
    // Group by month and compute cumulative spending
    const sorted = [...actualExpenses].sort((a, b) => a.expense_date.localeCompare(b.expense_date))

    const monthlyMap: Record<string, number> = {}
    for (const exp of sorted) {
        const month = exp.expense_date.slice(0, 7) // YYYY-MM
        monthlyMap[month] = (monthlyMap[month] ?? 0) + exp.amount
    }

    let cumulative = 0
    const data = Object.entries(monthlyMap).map(([month, amount]) => {
        cumulative += amount
        return {
            month,
            monthly: amount,
            cumulative,
        }
    })

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                لا توجد بيانات كافية لعرض الاتجاه الزمني
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    formatter={(value: any) => formatCurrency(value)}
                />
                {totalBudget > 0 && (
                    <ReferenceLine y={totalBudget} stroke="#ef4444" strokeDasharray="6 3" label={{ value: 'الموازنة', fill: '#ef4444', fontSize: 11 }} />
                )}
                <Line type="monotone" dataKey="cumulative" name="الإجمالي التراكمي" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="monthly" name="الشهري" stroke="#10b981" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: '#10b981' }} />
            </LineChart>
        </ResponsiveContainer>
    )
}
