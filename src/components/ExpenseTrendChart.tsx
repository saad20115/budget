'use client'

import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { formatCurrency } from '@/lib/analytics'
import { ActualExpense } from '@/lib/types'

interface Props {
    actualExpenses: ActualExpense[]
    totalBudget: number
}

function TrendTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm" dir="rtl">
            <p className="font-bold text-gray-700 mb-2 border-b border-gray-100 pb-1.5">{label}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600">{entry.name}:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(Number(entry.value))}</span>
                </div>
            ))}
        </div>
    )
}

export default function ExpenseTrendChart({ actualExpenses, totalBudget }: Props) {
    const sorted = [...actualExpenses].sort((a, b) => a.expense_date.localeCompare(b.expense_date))

    const monthlyMap: Record<string, number> = {}
    for (const exp of sorted) {
        const month = exp.expense_date.slice(0, 7)
        monthlyMap[month] = (monthlyMap[month] ?? 0) + exp.amount
    }

    let cumulative = 0
    const data = Object.entries(monthlyMap).map(([month, amount]) => {
        cumulative += amount
        // تنسيق الشهر بالعربي
        const [y, m] = month.split('-')
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
        const label = `${monthNames[parseInt(m) - 1]} ${y}`
        return { month: label, monthly: amount, cumulative }
    })

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="opacity-40">
                    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                </svg>
                <p className="text-sm font-medium">لا توجد بيانات كافية لعرض الاتجاه الزمني</p>
            </div>
        )
    }

    const budgetPct = totalBudget > 0 ? ((cumulative / totalBudget) * 100).toFixed(1) : null

    return (
        <div className="space-y-3">
            {/* Mini KPIs */}
            <div className="flex gap-4 flex-wrap">
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-blue-500 font-medium">الإجمالي التراكمي</span>
                    <p className="font-bold text-blue-700 mt-0.5">{formatCurrency(cumulative)}</p>
                </div>
                {budgetPct && (
                    <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs">
                        <span className="text-emerald-500 font-medium">نسبة الصرف من الموازنة</span>
                        <p className="font-bold text-emerald-700 mt-0.5">{budgetPct}%</p>
                    </div>
                )}
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-gray-500 font-medium">عدد الأشهر</span>
                    <p className="font-bold text-gray-700 mt-0.5">{data.length} شهر</p>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                        dataKey="month"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        angle={data.length > 6 ? -30 : 0}
                        textAnchor={data.length > 6 ? 'end' : 'middle'}
                        height={data.length > 6 ? 50 : 30}
                    />
                    <YAxis
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickFormatter={(v) => {
                            if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
                            if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
                            return String(v)
                        }}
                        tickLine={false}
                        axisLine={false}
                        width={55}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: 12, color: '#374151', paddingTop: 8 }}
                        iconType="circle"
                        iconSize={10}
                    />
                    {totalBudget > 0 && (
                        <ReferenceLine
                            y={totalBudget}
                            stroke="#ef4444"
                            strokeDasharray="6 3"
                            strokeWidth={1.5}
                            label={{ value: 'حد الموازنة', fill: '#ef4444', fontSize: 11, position: 'insideTopRight' }}
                        />
                    )}
                    <Line
                        type="monotone"
                        dataKey="cumulative"
                        name="الإجمالي التراكمي"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#3b82f6' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="monthly"
                        name="الشهري"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
