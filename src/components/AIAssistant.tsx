'use client'

import { ProjectAnalytics } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/analytics'
import { useState } from 'react'

interface Props {
    analytics: ProjectAnalytics
}

function generateInsights(analytics: ProjectAnalytics): string[] {
    const {
        project, staffingItems, expenseItems, actualExpenses,
        totalBudget, totalActual, variance, variancePercent,
        netProfit, profitMargin, healthStatus,
    } = analytics

    const insights: string[] = []

    // Overall health
    if (healthStatus === 'green') {
        insights.push(`✅ المشروع في وضع صحي جيد — نسبة الصرف ${formatPercent(variancePercent)} فقط من الموازنة المستهدفة.`)
    } else if (healthStatus === 'yellow') {
        insights.push(`⚠️ تنبيه: المشروع وصل إلى ${formatPercent(variancePercent)} من الموازنة. يُنصح بمراجعة بنود الإنفاق.`)
    } else if (healthStatus === 'red') {
        insights.push(`🚨 خطر: تجاوز الإنفاق الفعلي الموازنة المرصودة! الانحراف الحالي ${formatCurrency(Math.abs(variance))}.`)
    }

    // Profit analysis
    if (netProfit > 0) {
        insights.push(`💰 صافي الربح الحالي ${formatCurrency(netProfit)} بهامش ${formatPercent(profitMargin)} من قيمة العقد.`)
    } else if (netProfit < 0) {
        insights.push(`📉 المشروع يسير نحو خسارة بقيمة ${formatCurrency(Math.abs(netProfit))} — يجب اتخاذ إجراء عاجل.`)
    }

    // Compare target margin vs actual
    const gap = profitMargin - project.target_profit_margin
    if (gap < 0 && totalActual > 0) {
        insights.push(`🎯 هامش الربح الحالي (${formatPercent(profitMargin)}) أقل من المستهدف (${formatPercent(project.target_profit_margin)}) بفارق ${formatPercent(Math.abs(gap))}.`)
    } else if (gap >= 0 && totalActual > 0) {
        insights.push(`🌟 هامش الربح الحالي يتجاوز المستهدف — أداء ممتاز!`)
    }

    // High variance items — staffing
    const highVarianceStaff = staffingItems.filter(s => {
        const budget = s.staff_count * s.monthly_salary * s.duration_months
        const actual = actualExpenses.filter(a => a.staffing_id === s.id).reduce((sum, a) => sum + a.amount, 0)
        return budget > 0 && (actual / budget) >= 0.8
    })
    if (highVarianceStaff.length > 0) {
        insights.push(`👥 كوادر تجاوزت 80% من موازنتها: ${highVarianceStaff.map(s => s.role_name).join('، ')}.`)
    }

    // High variance expense items
    const highVarianceExp = expenseItems.filter(e => {
        const actual = actualExpenses.filter(a => a.expense_id === e.id).reduce((sum, a) => sum + a.amount, 0)
        return e.target_amount > 0 && (actual / e.target_amount) >= 0.8
    })
    if (highVarianceExp.length > 0) {
        insights.push(`📋 بنود مصاريف تجاوزت 80% من الموازنة: ${highVarianceExp.map(e => e.name).join('، ')}.`)
    }

    // No spending yet
    if (totalActual === 0) {
        insights.push(`📌 لم يبدأ تسجيل المصاريف الفعلية بعد. الموازنة المرصودة: ${formatCurrency(totalBudget)}.`)
    }

    // Budget coverage
    if (totalBudget > 0 && totalBudget < project.total_value * 0.5) {
        insights.push(`🔍 الموازنة المرصودة (${formatCurrency(totalBudget)}) أقل من 50% من قيمة العقد — تأكد من اكتمال بنود الموازنة.`)
    }

    return insights
}

export default function AIAssistant({ analytics }: Props) {
    const [open, setOpen] = useState(false)
    const insights = generateInsights(analytics)

    return (
        <div className="bg-white border border-blue-200 rounded-2xl shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-blue-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <p className="text-gray-900 font-semibold text-sm">المساعد الذكي</p>
                        <p className="text-gray-500 text-xs">تحليل تلقائي لحالة المشروع</p>
                    </div>
                </div>
                <span className={`text-gray-400 text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {open && (
                <div className="border-t border-blue-100 px-5 py-4 bg-blue-50/50">
                    <p className="text-xs text-gray-500 mb-3 font-medium">التقرير التنفيذي — تحليل آلي بناءً على بيانات المشروع:</p>
                    <ul className="space-y-2">
                        {insights.map((insight, i) => (
                            <li key={i} className="text-sm text-gray-700 bg-white border border-blue-100 rounded-xl px-4 py-3 leading-relaxed">
                                {insight}
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-gray-400 mt-3 text-center">
                        * التحليل يعتمد على البيانات المدخلة. يمكن ربط مفتاح AI API لتحليل أعمق.
                    </p>
                </div>
            )}
        </div>
    )
}
