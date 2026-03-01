'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

interface Project {
    id: string
    name: string
    category?: string
    status: string
}

export default function DashboardFilter({ projects = [] }: { projects?: Project[] }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const currentCategory = searchParams.get('category') || ''
    const currentStatus = searchParams.get('status') || ''
    const currentProject = searchParams.get('project') || ''

    // When category changes, reset the project filter if it doesn't belong to new category
    useEffect(() => {
        if (currentProject && currentCategory) {
            const proj = projects.find(p => p.id === currentProject)
            if (proj && proj.category !== currentCategory) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete('project')
                router.push(`/dashboard?${params.toString()}`)
            }
        }
    }, [currentCategory])

    const setFilter = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
        // When changing category, reset project
        if (key === 'category') params.delete('project')
        router.push(`/dashboard?${params.toString()}`)
    }, [router, searchParams])

    const clearAll = () => router.push('/dashboard')

    const hasFilter = currentCategory || currentStatus || currentProject

    // Projects filtered by selected category
    const filteredProjects = currentCategory
        ? projects.filter(p => p.category === currentCategory)
        : projects

    return (
        <div className="flex flex-wrap items-center gap-3" dir="rtl">
            {/* Category Filter */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 font-medium whitespace-nowrap">المجموعة:</label>
                <select
                    value={currentCategory}
                    onChange={e => setFilter('category', e.target.value)}
                    title="تصفية حسب المجموعة"
                    className="h-9 rounded-lg border border-gray-200 bg-white text-gray-800 px-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                    <option value="">الكل</option>
                    <option value="مشاريع الحج">مشاريع الحج</option>
                    <option value="المجلس التنسيقي">المجلس التنسيقي</option>
                </select>
            </div>

            {/* Project Filter */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 font-medium whitespace-nowrap">المشروع:</label>
                <select
                    value={currentProject}
                    onChange={e => setFilter('project', e.target.value)}
                    title="تصفية حسب المشروع"
                    disabled={filteredProjects.length === 0}
                    className="h-9 rounded-lg border border-gray-200 bg-white text-gray-800 px-3 text-sm focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
                >
                    <option value="">الكل</option>
                    {filteredProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 font-medium whitespace-nowrap">الحالة:</label>
                <select
                    value={currentStatus}
                    onChange={e => setFilter('status', e.target.value)}
                    title="تصفية حسب الحالة"
                    className="h-9 rounded-lg border border-gray-200 bg-white text-gray-800 px-3 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                >
                    <option value="">الكل</option>
                    <option value="Active">نشط</option>
                    <option value="Completed">مكتمل</option>
                    <option value="On Hold">معلق</option>
                </select>
            </div>

            {/* Clear filters */}
            {hasFilter && (
                <button
                    onClick={clearAll}
                    className="h-9 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    مسح الفلتر
                </button>
            )}

            {hasFilter && (
                <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    فلتر نشط
                </span>
            )}
        </div>
    )
}
