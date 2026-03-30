'use client'

import { Project, ProjectClaim } from '@/lib/types'

type ReportType = 'all' | 'overdue' | 'notYetDue'

const REPORT_TITLES: Record<ReportType, string> = {
    all: 'التقرير الشامل للمطالبات',
    overdue: 'تقرير المطالبات المتأخرة',
    notYetDue: 'تقرير المطالبات التي لم يحن وقتها',
}

const STATUS_LABELS: Record<string, string> = {
    Paid: '✅ مدفوعة',
    PartiallyPaid: '🔄 جزئياً',
    Due: '⏰ مستحقة',
    Pending: '⏳ معلقة',
    Sent: '📤 مرسلة',
    Overdue: '🔴 متأخرة',
    Invoiced: '📋 مفوترة',
    NotYetDue: '⏰ لم يحن',
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    Paid: { bg: '#d1fae5', text: '#065f46' },
    PartiallyPaid: { bg: '#ccfbf1', text: '#0f766e' },
    Due: { bg: '#ffedd5', text: '#c2410c' },
    Pending: { bg: '#fef3c7', text: '#92400e' },
    Sent: { bg: '#dbeafe', text: '#1e40af' },
    Overdue: { bg: '#fee2e2', text: '#991b1b' },
    Invoiced: { bg: '#e0e7ff', text: '#3730a3' },
    NotYetDue: { bg: '#f3f4f6', text: '#374151' },
}

function fmt(n: number): string {
    return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function generatePrintHTML(
    projects: Project[],
    claims: ProjectClaim[],
    reportType: ReportType,
): string {
    const title = REPORT_TITLES[reportType]
    const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    // Filter claims by type
    let filteredClaims = [...claims]
    if (reportType === 'overdue') {
        filteredClaims = claims.filter(c => c.status === 'Overdue')
    } else if (reportType === 'notYetDue') {
        filteredClaims = claims.filter(c => c.status === 'NotYetDue')
    }

    // Build project map & claims by project
    const projectMap: Record<string, Project> = {}
    projects.forEach(p => { projectMap[p.id] = p })

    const claimsByProject: Record<string, ProjectClaim[]> = {}
    filteredClaims.forEach(c => {
        if (!claimsByProject[c.project_id]) claimsByProject[c.project_id] = []
        claimsByProject[c.project_id].push(c)
    })

    const relevantProjects = projects.filter(p => (claimsByProject[p.id] ?? []).length > 0)

    // KPIs
    const totalAmount = filteredClaims.reduce((s, c) => s + Number(c.amount), 0)
    const paidAmount = filteredClaims.reduce((s, c) => s + Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0)), 0)
    const overdueAmount = filteredClaims.filter(c => c.status === 'Overdue').reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0))), 0)
    const pendingAmount = filteredClaims.filter(c => ['Pending', 'Sent', 'Invoiced', 'PartiallyPaid', 'Due'].includes(c.status)).reduce((s, c) => s + Math.max(0, Number(c.amount) - Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0))), 0)
    const collectionRate = totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : '0'

    // Max claims for column count
    const maxClaims = Math.max(...relevantProjects.map(p => (claimsByProject[p.id] ?? []).length), 0)

    // Claim column headers
    const claimHeaders = Array.from({ length: maxClaims }, (_, i) =>
        `<th style="padding:4px 3px;font-size:8px;text-align:center">${i + 1}</th>`
    ).join('')

    // Generate project rows — compact horizontal layout
    const projectRows = relevantProjects.map((p, pi) => {
        const pClaims = (claimsByProject[p.id] ?? []).sort((a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )
        const projectClaimsTotal = pClaims.reduce((s, c) => s + Number(c.amount), 0)
        const projectPaid = pClaims.reduce((s, c) => s + Number(c.paid_amount || (c.status === 'Paid' ? c.amount : 0)), 0)
        const projectRemaining = projectClaimsTotal - projectPaid
        const contractWithVat = Number(p.total_value) * 1.15
        const collRate = projectClaimsTotal > 0 ? ((projectPaid / projectClaimsTotal) * 100).toFixed(0) : '0'
        const bgColor = pi % 2 === 1 ? '#f8fafc' : '#fff'
        const bd = 'border-right:1px solid #d1d5db;'

        // Compact claim cells — small inline cards
        const claimCells = Array.from({ length: maxClaims }, (_, i) => {
            const c = pClaims[i]
            if (!c) return `<td style="padding:2px;background:${bgColor};${bd}"></td>`

            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.Pending
            const sl = STATUS_LABELS[c.status] || c.status

            return `<td style="padding:2px 3px;vertical-align:top;background:${bgColor};${bd}">
                <div style="background:${sc.bg};border-radius:4px;padding:3px 4px;line-height:1.3">
                    ${c.status === 'PartiallyPaid' 
                        ? `<b style="font-size:10px;color:#1e3a5f;display:block;direction:ltr">${fmt(Number(c.amount))}</b><b style="font-size:8px;color:#059669;display:block">م: ${fmt(Number(c.paid_amount || 0))}</b>` 
                        : `<b style="font-size:10px;color:#1e3a5f;display:block;direction:ltr">${fmt(Number(c.amount))}</b>`
                    }
                    <span style="font-size:7px;color:${sc.text}">${sl}</span>
                    <span style="font-size:7px;color:#6b7280;display:block">${fmtDate(c.due_date)}</span>${c.notes ? `<span style="font-size:7px;color:#9ca3af;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px" title="${c.notes}">📝${c.notes}</span>` : ''}
                </div>
            </td>`
        }).join('')

        return `<tr style="border-bottom:2px solid #94a3b8">
            <td style="padding:4px 6px;font-size:10px;font-weight:700;color:#1f2937;vertical-align:middle;background:${bgColor};border-left:3px solid #1e3a5f;${bd}">
                ${p.name}<br><span style="font-size:8px;color:#9ca3af;font-weight:400">${p.client || ''}</span>
            </td>
            <td style="padding:4px;text-align:center;font-size:10px;font-weight:700;color:#7c3aed;background:${bgColor};${bd}">${fmt(contractWithVat)}</td>
            <td style="padding:4px;text-align:center;font-size:10px;font-weight:700;color:#1e40af;background:${bgColor};${bd}">${fmt(projectClaimsTotal)}<br><span style="font-size:8px;color:#9ca3af;font-weight:400">${pClaims.length} مط</span></td>
            <td style="padding:4px;text-align:center;font-size:10px;font-weight:700;color:#059669;background:${bgColor};${bd}">${fmt(projectPaid)}</td>
            <td style="padding:4px;text-align:center;font-size:10px;font-weight:700;color:${projectRemaining > 0 ? '#d97706' : '#9ca3af'};background:${bgColor};${bd}">${fmt(projectRemaining)}</td>
            <td style="padding:4px;text-align:center;font-size:10px;font-weight:700;color:${Number(collRate) >= 100 ? '#059669' : Number(collRate) > 50 ? '#d97706' : '#dc2626'};background:${bgColor};${bd}">${collRate}%</td>
            ${claimCells}
        </tr>`
    }).join('')

    const grandContractWithVat = relevantProjects.reduce((s, p) => s + Number(p.total_value) * 1.15, 0)

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1f2937; background: #fff; direction: rtl; }
        @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 5mm; }
        }
        table { border-collapse: collapse; width: 100%; table-layout: fixed; }
        th { background: #1e3a5f; color: #fff; border-right: 1px solid #2d5a8e; white-space: nowrap; }
        th:last-child, td:last-child { border-right: none; }
    </style>
</head>
<body>
    <div class="no-print" style="padding:10px;text-align:center;background:#f1f5f9;border-bottom:1px solid #e2e8f0">
        <button onclick="window.print()" style="padding:8px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">
            🖨️ طباعة / حفظ PDF
        </button>
        <button onclick="window.close()" style="padding:8px 20px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-right:8px">
            إغلاق
        </button>
    </div>

    <div style="padding:8px 12px">
        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:2px solid #1e3a5f;padding-bottom:6px">
            <div>
                <h1 style="font-size:16px;font-weight:800;color:#1e3a5f">${title}</h1>
                <p style="font-size:9px;color:#6b7280">${today} · ${filteredClaims.length} مطالبة · ${relevantProjects.length} مشروع</p>
            </div>
            <div style="display:flex;gap:10px;font-size:10px;font-weight:700">
                <span style="color:#1e40af">المطالبات: ${fmt(totalAmount)}</span>
                <span style="color:#059669">المحصّل: ${fmt(paidAmount)}</span>
                <span style="color:#d97706">المعلق: ${fmt(pendingAmount)}</span>
                <span style="color:#dc2626">المتأخر: ${fmt(overdueAmount)}</span>
                <span style="color:#5b21b6">التحصيل: ${collectionRate}%</span>
            </div>
        </div>

        <!-- Table -->
        <table>
            <colgroup>
                <col style="width:12%">
                <col style="width:8%">
                <col style="width:8%">
                <col style="width:7%">
                <col style="width:7%">
                <col style="width:5%">
                ${Array.from({ length: maxClaims }, () => `<col style="width:${Math.floor(53 / maxClaims)}%">`).join('')}
            </colgroup>
            <thead>
                <tr>
                    <th style="padding:5px 6px;font-size:9px;text-align:right">المشروع</th>
                    <th style="padding:5px 3px;font-size:9px;text-align:center">العقد+ض</th>
                    <th style="padding:5px 3px;font-size:9px;text-align:center">المطالبات</th>
                    <th style="padding:5px 3px;font-size:9px;text-align:center">المحصّل</th>
                    <th style="padding:5px 3px;font-size:9px;text-align:center">المتبقي</th>
                    <th style="padding:5px 3px;font-size:9px;text-align:center">%</th>
                    ${claimHeaders}
                </tr>
            </thead>
            <tbody>
                ${projectRows}
            </tbody>
            <tfoot>
                <tr style="background:#1e3a5f;color:#fff;font-weight:700">
                    <td style="padding:5px 6px;font-size:10px">${relevantProjects.length} مشروع</td>
                    <td style="padding:5px;text-align:center;font-size:10px">${fmt(grandContractWithVat)}</td>
                    <td style="padding:5px;text-align:center;font-size:10px">${fmt(totalAmount)}</td>
                    <td style="padding:5px;text-align:center;font-size:10px">${fmt(paidAmount)}</td>
                    <td style="padding:5px;text-align:center;font-size:10px">${fmt(totalAmount - paidAmount)}</td>
                    <td style="padding:5px;text-align:center;font-size:10px">${collectionRate}%</td>
                    <td colspan="${maxClaims}" style="padding:5px;font-size:9px;text-align:center;color:#94a3b8">
                        ${filteredClaims.length} مطالبة إجمالية
                    </td>
                </tr>
            </tfoot>
        </table>

        <p style="margin-top:6px;font-size:8px;color:#9ca3af;text-align:center">نظام إدارة الموازنات · ${today}</p>
    </div>
</body>
</html>`
}

export function openPrintWindow(
    projects: Project[],
    claims: ProjectClaim[],
    reportType: ReportType,
) {
    const html = generatePrintHTML(projects, claims, reportType)
    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) {
        alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير')
        return
    }
    printWindow.document.write(html)
    printWindow.document.close()
}

export type { ReportType }
