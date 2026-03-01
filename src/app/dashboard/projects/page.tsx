import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/analytics'
import { Project } from '@/lib/types'
import Link from 'next/link'

function StatusBadge({ status }: { status: string }) {
    const map = {
        'Active': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Completed': 'bg-blue-100 text-blue-700 border-blue-200',
        'On Hold': 'bg-amber-100 text-amber-700 border-amber-200',
    } as Record<string, string>
    const labels = { 'Active': 'نشط', 'Completed': 'مكتمل', 'On Hold': 'معلق' } as Record<string, string>
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs box-border border font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {labels[status] ?? status}
        </span>
    )
}

export default async function ProjectsPage() {
    const supabase = await createClient()
    const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

    const list: Project[] = projects ?? []

    // Calculate KPIs
    const totalProjectsCount = list.length
    const totalContractValue = list.reduce((sum, p) => sum + Number(p.total_value), 0)
    const avgDuration = list.length > 0 ? list.reduce((sum, p) => sum + Number(p.duration_months), 0) / list.length : 0

    return (
        <div className="p-4 md:p-8" dir="rtl">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 fade-in">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة المشاريع</h1>
                    <p className="text-gray-500 mt-1">قائمة بجميع المشاريع المسجلة في النظام</p>
                </div>
                <Link
                    href="/dashboard/projects/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200 flex items-center justify-center gap-2"
                >
                    <span>+</span>
                    مشروع جديد
                </Link>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 slide-in-bottom">
                {/* KPI 1 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">إجمالي عدد المشاريع</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{totalProjectsCount}</p>
                </div>

                {/* KPI 2 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">إجمالي قيمة العقود</p>
                    <p className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalContractValue)}</p>
                </div>

                {/* KPI 3 */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
                    <p className="text-gray-500 text-sm font-medium mb-1">متوسط مدة المشاريع</p>
                    <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-bold text-gray-900 tracking-tight">{Math.round(avgDuration)}</p>
                        <p className="text-gray-500 text-sm">أشهر</p>
                    </div>
                </div>
            </div>

            {/* Projects Table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm slide-in-bottom">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/80 whitespace-nowrap">
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">اسم المشروع</th>
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">العميل</th>
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">قيمة العقد</th>
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">المدة</th>
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">الحالة</th>
                                <th className="text-right text-gray-500 text-xs font-semibold px-6 py-4">إجراء</th>
                            </tr>
                        </thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-gray-400 py-16">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="text-4xl">📁</span>
                                            <p>لا توجد مشاريع حالياً. أضف مشروعك الأول!</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                list.map((project) => (
                                    <tr key={project.id} className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors whitespace-nowrap">
                                        <td className="px-6 py-4 text-gray-900 font-medium">{project.name}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{project.client}</td>
                                        <td className="px-6 py-4 text-gray-900 font-semibold">{formatCurrency(project.total_value)}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{project.duration_months} شهر</td>
                                        <td className="px-6 py-4"><StatusBadge status={project.status} /></td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <Link
                                                    href={`/dashboard/projects/${project.id}/edit`}
                                                    className="text-gray-500 hover:text-blue-600 text-sm font-medium transition-colors"
                                                >
                                                    تعديل
                                                </Link>
                                                <Link
                                                    href={`/dashboard/projects/${project.id}`}
                                                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1"
                                                >
                                                    التحليل
                                                    <span className="mr-1">←</span>
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
