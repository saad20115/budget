'use client'

import { useState, useMemo } from 'react'
import { Project } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

// ---- Types ----
interface StaffRow {
    id: number
    role: string
    count: number
    monthlySalary: number
    months: number
}

interface Props {
    projects: Project[]
}

// ---- Default staff data from user's table ----
const DEFAULT_STAFF: StaffRow[] = [
    { id: 1, role: 'مدير مشروع', count: 6, monthlySalary: 15000, months: 5 },
    { id: 2, role: 'نائب مدير مشروع', count: 14, monthlySalary: 10000, months: 5 },
    { id: 3, role: 'مهندس إشراف', count: 26, monthlySalary: 8500, months: 5 },
    { id: 4, role: 'مهندس موقع', count: 16, monthlySalary: 7500, months: 5 },
    { id: 5, role: 'مهندس مساح', count: 10, monthlySalary: 5000, months: 5 },
    { id: 6, role: 'مراقب موقع', count: 80, monthlySalary: 5500, months: 5 },
    { id: 7, role: 'فني (كهرباء / مياه / سلامة)', count: 0, monthlySalary: 0, months: 5 },
    { id: 8, role: 'المكتب الفني', count: 37, monthlySalary: 8000, months: 5 },
    { id: 9, role: 'إداري مشاريع', count: 13, monthlySalary: 5500, months: 5 },
    { id: 10, role: 'موظف دعم ميداني', count: 6, monthlySalary: 4000, months: 5 },
]

// ---- Utility ----
function fmt(n: number) {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ---- Component ----
export default function SalaryDistributionClient({ projects }: Props) {
    const supabase = createClient()
    const [staff, setStaff] = useState<StaffRow[]>(DEFAULT_STAFF)
    const [councilPct, setCouncilPct] = useState(30)
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [excludedProjects, setExcludedProjects] = useState<Set<string>>(new Set())

    function toggleExclude(projectId: string) {
        setExcludedProjects(prev => {
            const next = new Set(prev)
            if (next.has(projectId)) next.delete(projectId)
            else next.add(projectId)
            return next
        })
    }

    // Split projects by category
    const councilProjects = projects.filter(p => p.category === 'المجلس التنسيقي')
    const hajjProjects = projects.filter(p => p.category !== 'المجلس التنسيقي')

    // ---- Calculations ----
    const totalBudget = useMemo(
        () => staff.reduce((s, r) => s + r.count * r.monthlySalary * r.months, 0),
        [staff]
    )

    const projectsPct = 100 - councilPct
    const councilAmount = totalBudget * (councilPct / 100)
    const projectsAmount = totalBudget * (projectsPct / 100)

    // council sub-distribution (equal among council projects if any, else single line)
    const councilRows = councilProjects.length > 0
        ? councilProjects.map(p => ({
            project: p,
            projectValue: Number(p.total_value),
            ratio: councilProjects.length > 0
                ? Number(p.total_value) / Math.max(councilProjects.reduce((s, cp) => s + Number(cp.total_value), 0), 1)
                : 1 / councilProjects.length,
            share: councilProjects.length > 0
                ? (Number(p.total_value) / Math.max(councilProjects.reduce((s, cp) => s + Number(cp.total_value), 1), 1)) * councilAmount
                : councilAmount / councilProjects.length,
        }))
        : [{ project: null as unknown as Project, projectValue: 0, ratio: 1, share: councilAmount }]

    // مشاريع الحج مع مراعاة الاستبعاد
    const activeHajjProjects = hajjProjects.filter(p => !excludedProjects.has(String(p.id)))
    const activeHajjTotal = activeHajjProjects.reduce((s, p) => s + Number(p.total_value), 0)

    const hajjRows = hajjProjects.map(p => {
        const val = Number(p.total_value)
        const isExcluded = excludedProjects.has(String(p.id))
        const ratio = !isExcluded && activeHajjTotal > 0 ? val / activeHajjTotal : 0
        return { project: p, projectValue: val, ratio, share: ratio * projectsAmount, isExcluded }
    })

    // ---- Handlers ----
    function updateRow(id: number, field: keyof StaffRow, raw: string) {
        const val = field === 'role' ? raw : (parseFloat(raw) || 0)
        setStaff(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
    }

    function addRow() {
        const newId = Math.max(0, ...staff.map(r => r.id)) + 1
        setStaff(prev => [...prev, { id: newId, role: 'وظيفة جديدة', count: 1, monthlySalary: 5000, months: 5 }])
    }

    function removeRow(id: number) {
        setStaff(prev => prev.filter(r => r.id !== id))
    }

    function resetStaff() {
        setStaff(DEFAULT_STAFF)
        setCouncilPct(30)
        setSaveMsg(null)
        setExcludedProjects(new Set())
    }

    // ---- Save to DB ----
    async function saveDistribution() {
        if (projects.length === 0) {
            setSaveMsg({ text: 'لا توجد مشاريع لحفظ التوزيع عليها', type: 'error' })
            return
        }
        setSaving(true)
        setSaveMsg(null)
        try {
            // Label used to identify salary distribution rows
            const SALARY_LABEL = 'موازنة الرواتب (توزيع مركزي)'

            // Delete existing salary distribution rows for all projects
            await supabase
                .from('project_staffing')
                .delete()
                .eq('role_name', SALARY_LABEL)

            // Build inserts: one row per project (council + hajj)
            // Each row contains the project's share as a single staffing entry
            const allProjectRows = [
                ...councilRows
                    .filter(r => r.project?.id)
                    .map(r => ({
                        project_id: r.project.id,
                        role_name: SALARY_LABEL,
                        staff_count: 1,
                        monthly_salary: r.share,
                        duration_months: 1,
                    })),
                ...hajjRows
                    .filter(r => r.project?.id)
                    .map(r => ({
                        project_id: r.project.id,
                        role_name: SALARY_LABEL,
                        staff_count: 1,
                        monthly_salary: r.share,
                        duration_months: 1,
                    }))
            ]

            if (allProjectRows.length === 0) {
                throw new Error('لا توجد مشاريع بفئات معرّفة لحفظ التوزيع')
            }

            const { error } = await supabase.from('project_staffing').insert(allProjectRows)
            if (error) throw error

            setSaveMsg({
                text: `✅ تم حفظ التوزيع بنجاح على ${allProjectRows.length} مشروع — ستظهر الأرقام الآن في الموازنة الشاملة وصفحات المشاريع.`,
                type: 'success'
            })
        } catch (err: unknown) {
            const e = err as { message?: string }
            setSaveMsg({ text: e.message || 'حدث خطأ أثناء الحفظ', type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-4 md:p-8 space-y-8" dir="rtl">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">توزيع موازنة الرواتب</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        تحميل 30% على المجلس التنسيقي و70% على المشاريع بالتناسب مع قيمها
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={resetStaff}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                        إعادة تعيين
                    </button>
                    <button
                        onClick={saveDistribution}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-200"
                    >
                        {saving ? (
                            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                        )}
                        {saving ? 'جارٍ الحفظ...' : 'حفظ التوزيع في الموازنة'}
                    </button>
                </div>
            </div>

            {/* ── Save Banner ── */}
            {saveMsg && (
                <div className={`p-4 rounded-xl font-medium flex items-start gap-3 ${saveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span className="text-lg mt-0.5">{saveMsg.type === 'success' ? '✅' : '⚠️'}</span>
                    <p className="text-sm leading-relaxed">{saveMsg.text}</p>
                    <button onClick={() => setSaveMsg(null)} className="mr-auto text-current opacity-50 hover:opacity-100 shrink-0" aria-label="إغلاق">✕</button>
                </div>
            )}

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200">
                    <p className="text-blue-100 text-sm font-medium mb-1">إجمالي موازنة الرواتب</p>
                    <p className="text-3xl font-bold tracking-tight" dir="ltr">{fmt(totalBudget)}</p>
                    <p className="text-blue-200 text-xs mt-1">ريال سعودي</p>
                </div>
                {/* Council */}
                <div className="bg-gradient-to-br from-violet-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-violet-200">
                    <div className="flex justify-between items-start mb-1">
                        <p className="text-violet-100 text-sm font-medium">المجلس التنسيقي</p>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">{councilPct}%</span>
                    </div>
                    <p className="text-3xl font-bold tracking-tight" dir="ltr">{fmt(councilAmount)}</p>
                    <p className="text-violet-200 text-xs mt-1">ريال سعودي</p>
                </div>
                {/* Projects */}
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
                    <div className="flex justify-between items-start mb-1">
                        <p className="text-emerald-100 text-sm font-medium">مشاريع الحج</p>
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">{projectsPct}%</span>
                    </div>
                    <p className="text-3xl font-bold tracking-tight" dir="ltr">{fmt(projectsAmount)}</p>
                    <p className="text-emerald-200 text-xs mt-1">ريال سعودي</p>
                </div>
            </div>

            {/* ── Percentage Slider ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span>
                    ضبط نسبة التوزيع
                </h2>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 w-full">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                            <span>المجلس التنسيقي: <strong className="text-violet-700">{councilPct}%</strong></span>
                            <span>مشاريع الحج: <strong className="text-emerald-700">{projectsPct}%</strong></span>
                        </div>
                        <div className="relative h-2 bg-gray-200 rounded-full">
                            <div
                                className="absolute inset-y-0 right-0 bg-gradient-to-l from-violet-500 to-violet-400 rounded-full transition-all"
                                style={{ width: String(councilPct) + '%' }}
                            />
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={councilPct}
                            onChange={e => setCouncilPct(Number(e.target.value))}
                            className="w-full mt-2 accent-violet-600"
                            title="نسبة المجلس التنسيقي"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setCouncilPct(30)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${councilPct === 30 ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>30%</button>
                        <button onClick={() => setCouncilPct(25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${councilPct === 25 ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>25%</button>
                        <button onClick={() => setCouncilPct(20)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${councilPct === 20 ? 'bg-violet-600 text-white border-violet-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>20%</button>
                    </div>
                </div>
            </div>

            {/* ── Staff Table ── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block shadow-sm shadow-blue-400"></span>
                        كوادر الرواتب
                    </h2>
                    <button
                        onClick={addRow}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        إضافة صف
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 text-xs whitespace-nowrap">
                                <th className="text-center px-4 py-3 font-semibold w-10">#</th>
                                <th className="text-right px-4 py-3 font-semibold">المسمى الوظيفي</th>
                                <th className="text-center px-4 py-3 font-semibold">العدد</th>
                                <th className="text-center px-4 py-3 font-semibold">متوسط الراتب (ر.س)</th>
                                <th className="text-center px-4 py-3 font-semibold">الشهور</th>
                                <th className="text-left px-4 py-3 font-semibold">الإجمالي</th>
                                <th className="text-center px-4 py-3 font-semibold w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((row, i) => {
                                const rowTotal = row.count * row.monthlySalary * row.months
                                return (
                                    <tr key={row.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors group">
                                        <td className="text-center px-4 py-2.5 text-gray-400 font-medium text-xs">{i + 1}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                value={row.role}
                                                onChange={e => updateRow(row.id, 'role', e.target.value)}
                                                title="المسمى الوظيفي"
                                                placeholder="أدخل المسمى الوظيفي"
                                                className="w-full bg-transparent border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 focus:outline-none text-gray-900 text-sm py-0.5 transition-colors min-w-[160px]"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min={0} value={row.count}
                                                onChange={e => updateRow(row.id, 'count', e.target.value)}
                                                title="عدد الموظفين"
                                                placeholder="0"
                                                className="w-20 text-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:bg-white transition-colors mx-auto block"
                                                dir="ltr"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min={0} value={row.monthlySalary}
                                                onChange={e => updateRow(row.id, 'monthlySalary', e.target.value)}
                                                title="متوسط الراتب الشهري"
                                                placeholder="0"
                                                className="w-28 text-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:bg-white transition-colors mx-auto block"
                                                dir="ltr"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min={1} value={row.months}
                                                onChange={e => updateRow(row.id, 'months', e.target.value)}
                                                title="عدد الشهور"
                                                placeholder="1"
                                                className="w-16 text-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:bg-white transition-colors mx-auto block"
                                                dir="ltr"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-left">
                                            <span className="font-bold text-blue-700" dir="ltr">{fmt(rowTotal)}</span>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                onClick={() => removeRow(row.id)}
                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1 rounded"
                                                aria-label="حذف الصف"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-blue-50 border-t-2 border-blue-200">
                                <td colSpan={2} className="px-4 py-3 font-bold text-gray-800 text-sm">
                                    الإجمالي الكلي ({staff.reduce((s, r) => s + r.count, 0)} موظف)
                                </td>
                                <td colSpan={3}></td>
                                <td className="px-4 py-3 text-left">
                                    <span className="font-bold text-blue-800 text-base" dir="ltr">{fmt(totalBudget)} ر.س</span>
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* ── Distribution Tables ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Council */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 bg-violet-50/60 flex items-center justify-between">
                        <h2 className="font-bold text-violet-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block"></span>
                            المجلس التنسيقي
                        </h2>
                        <span className="bg-violet-100 text-violet-700 text-xs font-bold px-3 py-1 rounded-full border border-violet-200">
                            {councilPct}% — {fmt(councilAmount)} ر.س
                        </span>
                    </div>

                    {councilProjects.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <div className="text-4xl mb-3">🏛️</div>
                            <p className="font-medium text-sm">لا توجد مشاريع مصنفة كـ &quot;المجلس التنسيقي&quot;</p>
                            <p className="text-xs mt-1 text-gray-400">سيُحمَّل الإجمالي كمبلغ واحد</p>
                            <div className="mt-4 bg-violet-50 rounded-xl p-4 border border-violet-100">
                                <p className="text-violet-700 font-bold text-lg" dir="ltr">{fmt(councilAmount)} ر.س</p>
                                <p className="text-violet-500 text-xs mt-0.5">المبلغ الإجمالي للمجلس</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap bg-gray-50/50">
                                        <th className="text-right px-4 py-3 font-semibold">المشروع</th>
                                        <th className="text-left px-4 py-3 font-semibold">قيمة العقد</th>
                                        <th className="text-center px-4 py-3 font-semibold">النسبة</th>
                                        <th className="text-left px-4 py-3 font-semibold">المبلغ المخصص</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {councilRows.map((row, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-violet-50/30 transition-colors">
                                            <td className="px-4 py-3 text-gray-900 font-medium">{row.project?.name ?? 'المجلس التنسيقي'}</td>
                                            <td className="px-4 py-3 text-left text-gray-600" dir="ltr">{fmt(row.projectValue)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                                                    {(row.ratio * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-left font-bold text-violet-700" dir="ltr">{fmt(row.share)} ر.س</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-violet-50 border-t-2 border-violet-200">
                                        <td colSpan={3} className="px-4 py-3 font-bold text-violet-900 text-sm">الإجمالي</td>
                                        <td className="px-4 py-3 text-left font-bold text-violet-800" dir="ltr">{fmt(councilAmount)} ر.س</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Hajj Projects */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50/60 flex items-center justify-between">
                        <h2 className="font-bold text-emerald-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                            مشاريع الحج
                        </h2>
                        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
                            {projectsPct}% — {fmt(projectsAmount)} ر.س
                        </span>
                    </div>

                    {hajjProjects.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <div className="text-4xl mb-3">🏗️</div>
                            <p className="font-medium text-sm">لا توجد مشاريع مصنفة كـ &quot;مشاريع الحج&quot;</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            {excludedProjects.size > 0 && (
                                <div className="mx-4 mt-3 mb-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                                    <span>⚠️</span>
                                    <span>
                                        {excludedProjects.size} مشروع مستبعد — حصته موزعة على {activeHajjProjects.length} مشروع نشط
                                    </span>
                                </div>
                            )}
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap bg-gray-50/50">
                                        <th className="text-center px-3 py-3 font-semibold w-10">تضمين</th>
                                        <th className="text-right px-4 py-3 font-semibold">المشروع</th>
                                        <th className="text-left px-4 py-3 font-semibold">قيمة العقد</th>
                                        <th className="text-center px-4 py-3 font-semibold">النسبة</th>
                                        <th className="text-left px-4 py-3 font-semibold">المبلغ المخصص</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hajjRows.map((row, i) => (
                                        <tr
                                            key={i}
                                            className={`border-b transition-colors ${row.isExcluded
                                                ? 'bg-gray-50 opacity-50'
                                                : 'border-gray-50 hover:bg-emerald-50/30'
                                                }`}
                                        >
                                            <td className="px-3 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={!row.isExcluded}
                                                    onChange={() => toggleExclude(String(row.project.id))}
                                                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                                                    title={row.isExcluded ? 'انقر لتضمين المشروع' : 'انقر لاستبعاد المشروع'}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-medium max-w-[150px]">
                                                <div className={`truncate ${row.isExcluded ? 'text-gray-400 line-through' : 'text-gray-900'}`} title={row.project.name}>
                                                    {row.project.name}
                                                </div>
                                                {row.project.client && (
                                                    <div className="text-gray-400 text-xs truncate">{row.project.client}</div>
                                                )}
                                                {row.isExcluded && (
                                                    <span className="text-xs text-amber-600 font-medium">مستبعد</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-left text-gray-600" dir="ltr">{fmt(row.projectValue)}</td>
                                            <td className="px-4 py-3 text-center">
                                                {row.isExcluded ? (
                                                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">—</span>
                                                ) : (
                                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                                                        {(row.ratio * 100).toFixed(2)}%
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-left font-bold" dir="ltr">
                                                {row.isExcluded ? (
                                                    <span className="text-gray-400">0.00 ر.س</span>
                                                ) : (
                                                    <span className="text-emerald-700">{fmt(row.share)} ر.س</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                                        <td></td>
                                        <td className="px-4 py-3 font-bold text-emerald-900 text-sm">
                                            الإجمالي ({activeHajjProjects.length} مشروع نشط
                                            {excludedProjects.size > 0 && <span className="text-gray-400 font-normal"> / {hajjProjects.length} إجمالي</span>})
                                        </td>
                                        <td className="px-4 py-3 text-left text-emerald-800 font-bold" dir="ltr">{fmt(activeHajjTotal)}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">100%</span>
                                        </td>
                                        <td className="px-4 py-3 text-left font-bold text-emerald-800" dir="ltr">{fmt(projectsAmount)} ر.س</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Summary Card ── */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-lg">
                <h2 className="font-bold text-lg mb-4 text-gray-100">ملخص التوزيع الإجمالي</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div className="bg-white/10 rounded-xl p-4">
                        <p className="text-gray-300 text-xs mb-1">إجمالي الموازنة</p>
                        <p className="text-2xl font-bold" dir="ltr">{fmt(totalBudget)}</p>
                        <p className="text-gray-400 text-xs mt-0.5">ريال سعودي</p>
                    </div>
                    <div className="bg-violet-500/30 border border-violet-400/30 rounded-xl p-4">
                        <p className="text-violet-200 text-xs mb-1">المجلس التنسيقي ({councilPct}%)</p>
                        <p className="text-2xl font-bold text-violet-100" dir="ltr">{fmt(councilAmount)}</p>
                        <p className="text-violet-300 text-xs mt-0.5">ريال سعودي</p>
                    </div>
                    <div className="bg-emerald-500/30 border border-emerald-400/30 rounded-xl p-4">
                        <p className="text-emerald-200 text-xs mb-1">مشاريع الحج ({projectsPct}%)</p>
                        <p className="text-2xl font-bold text-emerald-100" dir="ltr">{fmt(projectsAmount)}</p>
                        <p className="text-emerald-300 text-xs mt-0.5">ريال سعودي · {hajjProjects.length} مشروع</p>
                    </div>
                </div>

                {/* Visual bar */}
                <div className="mt-5">
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                        <div
                            className="bg-violet-400 rounded-r-full transition-all duration-500"
                            style={{ width: String(councilPct) + '%' }}
                            title={'المجلس التنسيقي ' + councilPct + '%'}
                        />
                        <div
                            className="bg-emerald-400 rounded-l-full flex-1 transition-all duration-500"
                            title={'مشاريع الحج ' + projectsPct + '%'}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> مشاريع الحج {projectsPct}%</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400 inline-block" /> المجلس التنسيقي {councilPct}%</span>
                    </div>
                </div>
            </div>

        </div>
    )
}
