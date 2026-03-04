'use client'

import { useState } from 'react'
import { BarChart3, GitCompare } from 'lucide-react'
import ReportTableClient from './ReportTableClient'
import BudgetComparisonClient, { ComparisonRow, StaffingEntry } from './BudgetComparisonClient'
import { BudgetVsActualChart, ExpensePieChart } from '@/components/Charts'

interface ProjectRow {
    id: string
    name: string
    client?: string
    status: string
    category?: string
    total_value: number
    budget: number
    actual: number
    variance: number
    profit: number
    invoiced: number
}

interface Props {
    tableData: ProjectRow[]
    chartData: { name: string; budget: number; actual: number }[]
    pieChartData: { name: string; value: number }[]
    comparisonRows: ComparisonRow[]
    staffingRow: {
        entries: StaffingEntry[]
        totalBudget: number
        totalActual: number
    }
}

export default function ReportTabsClient({ tableData, chartData, pieChartData, comparisonRows, staffingRow }: Props) {
    const [tab, setTab] = useState<'overview' | 'comparison'>('overview')

    const tabs = [
        { key: 'overview' as const, label: 'التقرير الشامل', icon: <BarChart3 size={15} /> },
        { key: 'comparison' as const, label: 'مقارنة الموازنة', icon: <GitCompare size={15} /> },
    ]

    return (
        <div className="space-y-6">
            {/* Tab Bar */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit" dir="rtl">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key
                            ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-800'
                            }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab 1: Overview */}
            {tab === 'overview' && (
                <div className="space-y-6">
                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-2 h-5 bg-blue-500 rounded-full" />
                                توزيع حالات المشاريع
                            </h3>
                            {pieChartData.length > 0
                                ? <ExpensePieChart data={pieChartData} />
                                : <div className="h-[240px] flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">لا توجد بيانات كافية</div>
                            }
                        </div>

                        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                    <div className="w-2 h-5 bg-indigo-500 rounded-full" />
                                    مقارنة الموازنة والصرف الفعلي (أعلى {chartData.length} مشروع)
                                </h3>
                                <div className="flex items-center gap-3 text-xs">
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-gray-600">الموازنة</span></div>
                                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-gray-600">الفعلي</span></div>
                                </div>
                            </div>
                            {chartData.length > 0
                                ? <BudgetVsActualChart data={chartData} />
                                : <div className="h-[260px] flex items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl">لا توجد بيانات</div>
                            }
                        </div>
                    </div>

                    {/* Table */}
                    <ReportTableClient data={tableData} />
                </div>
            )}

            {/* Tab 2: Budget Comparison */}
            {tab === 'comparison' && (
                <BudgetComparisonClient
                    rows={comparisonRows}
                    staffingRow={staffingRow}
                />
            )}
        </div>
    )
}
