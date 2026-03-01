'use client'

import { ProjectAnalytics } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/analytics'

interface Props { analytics: ProjectAnalytics }

export default function ExportButtons({ analytics }: Props) {
    const handleExcelExport = async () => {
        const XLSX = await import('xlsx')
        const { project, staffingItems, expenseItems, actualExpenses,
            totalStaffingBudget, totalExpensesBudget, totalBudget,
            totalActual, variance, variancePercent, netProfit, profitMargin } = analytics

        const wb = XLSX.utils.book_new()

        // Summary sheet
        const summaryData = [
            ['بيان', 'القيمة'],
            ['اسم المشروع', project.name],
            ['العميل', project.client],
            ['قيمة العقد', project.total_value],
            ['إجمالي الموازنة', totalBudget],
            ['المصروف الفعلي', totalActual],
            ['الانحراف', variance],
            ['نسبة الصرف %', variancePercent.toFixed(1)],
            ['صافي الربح', netProfit],
            ['هامش الربح %', profitMargin.toFixed(1)],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'ملخص')

        // Staffing sheet
        const staffData = [
            ['المسمى الوظيفي', 'العدد', 'الراتب الشهري', 'الشهور', 'الإجمالي'],
            ...staffingItems.map(s => [s.role_name, s.staff_count, s.monthly_salary, s.duration_months, s.staff_count * s.monthly_salary * s.duration_months]),
            ['الإجمالي', '', '', '', totalStaffingBudget],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(staffData), 'الكوادر')

        // Budget items sheet
        const expData = [
            ['البند', 'القيمة المستهدفة'],
            ...expenseItems.map(e => [e.name, e.target_amount]),
            ['الإجمالي', totalExpensesBudget],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), 'بنود المصاريف')

        // Actual expenses sheet
        const actualData = [
            ['التاريخ', 'المبلغ', 'ملاحظات'],
            ...actualExpenses.map(a => [a.expense_date, a.amount, a.notes ?? '']),
            ['الإجمالي', totalActual, ''],
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(actualData), 'المصاريف الفعلية')

        XLSX.writeFile(wb, `${project.name}-تقرير.xlsx`)
    }

    const handlePdfExport = async () => {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const { project, staffingItems, totalBudget, totalActual, variance, netProfit, profitMargin } = analytics

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

        // Header
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.text('Project Budget Report', 105, 20, { align: 'center' })

        doc.setFontSize(12)
        doc.setFont('helvetica', 'normal')
        doc.text(`Project: ${project.name}`, 14, 35)
        doc.text(`Client: ${project.client}`, 14, 42)
        doc.text(`Date: ${new Date().toLocaleDateString('ar-SA')}`, 14, 49)

        // KPIs
        autoTable(doc, {
            startY: 58,
            head: [['KPI', 'Value']],
            body: [
                ['Contract Value', formatCurrency(project.total_value)],
                ['Total Budget', formatCurrency(totalBudget)],
                ['Actual Spent', formatCurrency(totalActual)],
                ['Variance', formatCurrency(variance)],
                ['Net Profit', formatCurrency(netProfit)],
                ['Profit Margin', formatPercent(profitMargin)],
            ],
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] },
        })

        // Staffing
        // @ts-expect-error plugin property
        const staffY = doc.lastAutoTable.finalY + 10
        autoTable(doc, {
            startY: staffY,
            head: [['Role', 'Count', 'Monthly Salary', 'Months', 'Total']],
            body: staffingItems.map(s => [
                s.role_name, s.staff_count,
                formatCurrency(s.monthly_salary),
                s.duration_months,
                formatCurrency(s.staff_count * s.monthly_salary * s.duration_months),
            ]),
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
        })

        doc.save(`${project.name}-report.pdf`)
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={handleExcelExport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
            >
                📊 تصدير Excel
            </button>
            <button
                onClick={handlePdfExport}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors"
            >
                📄 تصدير PDF
            </button>
        </div>
    )
}
