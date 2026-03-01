'use client'

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import { formatCurrency } from '@/lib/analytics'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface BudgetChartProps {
    data: { name: string; budget: number; actual: number }[]
}

export function BudgetVsActualChart({ data }: BudgetChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => (v / 1000).toFixed(0) + 'k'} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                />
                <Legend wrapperStyle={{ color: '#6b7280', fontSize: 12 }} />
                <Bar dataKey="budget" name="الموازنة المستهدفة" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="الفعلي" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    )
}

interface PieChartProps {
    data: { name: string; value: number }[]
}

export function ExpensePieChart({ data }: PieChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9ca3af' }}
                >
                    {data.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#111827' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                />
            </PieChart>
        </ResponsiveContainer>
    )
}
