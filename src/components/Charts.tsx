'use client'

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer, Sector
} from 'recharts'
import { formatCurrency } from '@/lib/analytics'
import { useState } from 'react'

const COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
    '#84cc16', '#14b8a6',
]

interface BudgetChartProps {
    data: { name: string; budget: number; actual: number }[]
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { fill: string; name: string; value: number }[]; label?: string }) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm" dir="rtl">
            <p className="font-bold text-gray-800 mb-2 border-b border-gray-100 pb-1.5 max-w-[200px] truncate">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                    <span className="text-gray-600">{entry.name}:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(Number(entry.value))}</span>
                </div>
            ))}
        </div>
    )
}

export function BudgetVsActualChart({ data }: BudgetChartProps) {
    const height = Math.max(300, data.length * 55)
    const bottomMargin = data.length > 4 ? 80 : 50

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                margin={{ top: 10, right: 20, left: 20, bottom: bottomMargin }}
                barCategoryGap="30%"
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                    dataKey="name"
                    tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    tickFormatter={(v: number) => {
                        if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
                        if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k'
                        return String(v)
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Legend
                    wrapperStyle={{ fontSize: 12, color: '#374151', paddingTop: 16 }}
                    iconType="circle"
                    iconSize={10}
                />
                <Bar dataKey="budget" name="الموازنة المستهدفة" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="actual" name="الفعلي" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
        </ResponsiveContainer>
    )
}

// ── Active Pie Slice ──
function renderActiveShape(props: {
    cx: number; cy: number; innerRadius: number; outerRadius: number
    startAngle: number; endAngle: number; fill: string
    payload: { name: string }; percent: number; value: number
}) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props
    const shortName = payload.name.length > 12 ? payload.name.slice(0, 12) + '…' : payload.name
    return (
        <g>
            <text x={cx} y={cy - 12} textAnchor="middle" fill="#111827" fontSize={13} fontWeight={700}>{shortName}</text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#3b82f6" fontSize={12} fontWeight={600}>{formatCurrency(value)}</text>
            <text x={cx} y={cy + 28} textAnchor="middle" fill="#6b7280" fontSize={11}>{((percent || 0) * 100).toFixed(1)}%</text>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
                startAngle={startAngle} endAngle={endAngle} fill={fill} />
            <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 14}
                startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
    )
}

interface PieChartProps {
    data: { name: string; value: number }[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomPie = Pie as any

export function ExpensePieChart({ data }: PieChartProps) {
    const [activeIndex, setActiveIndex] = useState(0)
    const total = data.reduce((s, d) => s + d.value, 0)

    return (
        <div className="flex flex-col lg:flex-row items-center gap-4">
            {/* الدائرة */}
            <div className="shrink-0">
                <PieChart width={220} height={220}>
                    <CustomPie
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={data}
                        cx={110}
                        cy={110}
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                    >
                        {data.map((_: unknown, index: number) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </CustomPie>
                </PieChart>
            </div>

            {/* Legend مخصص */}
            <div className="flex-1 w-full overflow-y-auto max-h-[220px] space-y-1.5 pr-1" dir="rtl">
                {data.map((entry, index) => {
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
                    return (
                        <div
                            key={index}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${activeIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-gray-700 flex-1 truncate" title={entry.name}>{entry.name}</span>
                            <span className="font-semibold text-gray-800 shrink-0">{formatCurrency(entry.value)}</span>
                            <span className="text-gray-400 shrink-0 w-10 text-left">{pct}%</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
