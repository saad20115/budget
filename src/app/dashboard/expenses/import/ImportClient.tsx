'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'

interface ExpenseRow {
    id: string
    project_id: string
    name: string
    target_amount: number
    projects?: { name: string }
}

interface ActualRow {
    id: string
    project_id: string
    amount: number
    expense_date: string
    notes?: string
    projects?: { name: string }
    project_expenses?: { name: string }
    project_staffing?: { role_name: string }
}

export default function ImportClient() {
    const [selectedCategory, setSelectedCategory] = useState<string>('')
    const [selectedProject, setSelectedProject] = useState<string>('all')
    const [availableProjects, setAvailableProjects] = useState<{ id: string, name: string }[]>([])
    const [loadingTargets, setLoadingTargets] = useState(false)
    const [loadingActuals, setLoadingActuals] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    // Quick Add States
    const [quickAddType, setQuickAddType] = useState<'target' | 'actual'>('target')
    const [quickAddProject, setQuickAddProject] = useState<string>('')
    const [quickAddName, setQuickAddName] = useState<string>('')
    const [quickAddAmount, setQuickAddAmount] = useState<string>('')
    const [quickAddDate, setQuickAddDate] = useState<string>(() => new Date().toISOString().split('T')[0])
    const [quickAddNotes, setQuickAddNotes] = useState<string>('')
    const [loadingQuickAdd, setLoadingQuickAdd] = useState(false)

    // Data states for tables
    const [targetExpenses, setTargetExpenses] = useState<ExpenseRow[]>([])
    const [actualExpenses, setActualExpenses] = useState<ActualRow[]>([])
    const [loadingData, setLoadingData] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    const fetchCategoryData = useCallback(async (category: string) => {
        if (!category) {
            setTargetExpenses([]); setActualExpenses([]); setAvailableProjects([]); return
        }
        setLoadingData(true)

        // Fetch projects in this category
        const { data: projectsData } = await supabase.from('projects').select('id, name').eq('category', category)
        const projects = projectsData || []
        const projectIds = projects.map(p => p.id)

        setAvailableProjects(projects)

        if (projectIds.length === 0) {
            setTargetExpenses([]); setActualExpenses([])
            setLoadingData(false)
            return
        }

        const [{ data: targets }, { data: actuals }] = await Promise.all([
            supabase.from('project_expenses').select('*, projects(name)').in('project_id', projectIds).order('created_at', { ascending: false }),
            supabase.from('actual_expenses').select('*, project_expenses(name), project_staffing(role_name), projects(name)').in('project_id', projectIds).order('expense_date', { ascending: false })
        ])
        setTargetExpenses(targets || [])
        setActualExpenses(actuals || [])
        setLoadingData(false)
    }, [supabase])

    useEffect(() => {
        fetchCategoryData(selectedCategory)
    }, [selectedCategory, fetchCategoryData])

    const parseExcel = async (file: File): Promise<unknown[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()

            if (file.name.toLowerCase().endsWith('.csv')) {
                reader.onload = (e) => {
                    try {
                        const text = e.target?.result as string
                        const workbook = XLSX.read(text, { type: 'string' })
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
                        resolve(json)
                    } catch (err) {
                        reject(err)
                    }
                }
                reader.onerror = (err) => reject(err)
                reader.readAsText(file, 'utf-8')
            } else {
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer)
                        const workbook = XLSX.read(data, { type: 'array' })
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
                        const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
                        resolve(json)
                    } catch (err) {
                        reject(err)
                    }
                }
                reader.onerror = (err) => reject(err)
                reader.readAsArrayBuffer(file)
            }
        })
    }

    const downloadTargetTemplate = () => {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([
            ['بند المصروف', 'سعر البند (اختياري)', 'العدد (اختياري)', 'الإجمالي'],
            ['رواتب واستشارات', '5000', '2', '10000'],
            ['تجهيزات تقنية', '', '', '15000'],
        ])

        ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 20 }]

        XLSX.utils.book_append_sheet(wb, ws, 'قالب الموازنة')

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([wbout], { type: 'application/octet-stream' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'قالب_استيراد_الموازنة.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }

    const downloadActualTemplate = () => {
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet([
            ['اسم البند (لربطه بالموازنة)', 'المبلغ الإجمالي الفعلي', 'تاريخ الصرف (YYYY-MM-DD)', 'ملاحظات'],
            ['رواتب واستشارات', '5000', '2024-05-01', 'راتب شهر مايو للخبراء'],
            ['تجهيزات تقنية', '12500', '2024-05-15', 'شراء حواسيب محمولة'],
        ])

        ws['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 40 }]

        XLSX.utils.book_append_sheet(wb, ws, 'قالب المصاريف الفعلية')

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([wbout], { type: 'application/octet-stream' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'قالب_استيراد_المصاريف_الفعلية.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }

    const filteredTargetExpenses = selectedProject === 'all' ? targetExpenses : targetExpenses.filter(e => e.project_id === selectedProject)
    const filteredActualExpenses = selectedProject === 'all' ? actualExpenses : actualExpenses.filter(e => e.project_id === selectedProject)

    const handleTargetImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedCategory) {
            setMessage({ text: 'الرجاء اختيار مجموعة المشاريع أولاً', type: 'error' })
            e.target.value = ''
            return
        }

        const file = e.target.files?.[0]
        if (!file) return

        setLoadingTargets(true)
        setMessage(null)
        try {
            const rows = await parseExcel(file)
            if (rows.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات')

            // Fetch projects in this category to calculate proportionality
            const { data: projects } = await supabase.from('projects').select('id, total_value').eq('category', selectedCategory).eq('status', 'Active')
            if (!projects || projects.length === 0) throw new Error('لا توجد مشاريع نشطة في هذه المجموعة لتوزيع المصاريف عليها.')

            const groupTotalValue = projects.reduce((sum, p) => sum + Number(p.total_value), 0)
            if (groupTotalValue <= 0) throw new Error('إجمالي قيمة مشاريع هذه المجموعة يساوي صفر. لا يمكن التوزيع النسبي.')

            const inserts: { project_id: string, name: string, target_amount: number }[] = []

            // Skip header (row 0), process rest
            rows.slice(1).forEach((row: unknown) => {
                const r = row as unknown[]
                const name = r[0]

                // Read from Column 4 (Total). If missing, calculate Price * Count. Fallback to Column 2.
                let amount = parseFloat(r[3] as string)
                if (isNaN(amount) || amount === 0) {
                    const price = parseFloat(r[1] as string)
                    const count = parseFloat(r[2] as string)
                    if (!isNaN(price) && !isNaN(count)) {
                        amount = price * count
                    } else {
                        amount = parseFloat(r[1] as string)
                    }
                }

                if (!name || isNaN(amount) || amount === 0) return

                // Prorate the amount across all projects
                projects.forEach(p => {
                    const projectShare = Number(p.total_value) / groupTotalValue
                    const proratedAmount = amount * projectShare
                    inserts.push({
                        project_id: p.id,
                        name: String(name).trim(),
                        target_amount: proratedAmount
                    })
                })
            })

            if (inserts.length === 0) throw new Error('لم يتم العثور على بيانات صالحة في الملف. تأكد من الأعمدة (الاسم، القيمة)')

            const { error } = await supabase.from('project_expenses').insert(inserts)
            if (error) throw error

            setMessage({ text: `تم استيراد بنود الموازنة وتوزيعها على ${projects.length} مشاريع بنجاح!`, type: 'success' })
            await fetchCategoryData(selectedCategory)
            router.refresh()
        } catch (err: unknown) {
            const errorObj = err as Error
            setMessage({ text: errorObj.message || 'حدث خطأ أثناء الاستيراد', type: 'error' })
        } finally {
            setLoadingTargets(false)
            e.target.value = ''
        }
    }

    const handleActualImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedCategory) {
            setMessage({ text: 'الرجاء اختيار مجموعة المشاريع أولاً', type: 'error' })
            e.target.value = ''
            return
        }

        const file = e.target.files?.[0]
        if (!file) return

        setLoadingActuals(true)
        setMessage(null)
        try {
            const rows = await parseExcel(file)
            if (rows.length < 2) throw new Error('الملف فارغ أو لا يحتوي على بيانات')

            // Fetch projects in this category to calculate proportionality
            const { data: projects } = await supabase.from('projects').select('id, total_value').eq('category', selectedCategory).eq('status', 'Active')
            if (!projects || projects.length === 0) throw new Error('لا توجد مشاريع نشطة في هذه المجموعة لتوزيع المصاريف عليها.')

            const groupTotalValue = projects.reduce((sum, p) => sum + Number(p.total_value), 0)
            if (groupTotalValue <= 0) throw new Error('إجمالي قيمة مشاريع هذه المجموعة يساوي صفر. لا يمكن التوزيع النسبي.')

            const projectIds = projects.map(p => p.id)

            // Try to match expense names with actual project_expenses table (across the whole category, might be dupes if distributed, but we can match by name and project id)
            const { data: existingExpenses, error: eeError } = await supabase
                .from('project_expenses')
                .select('id, name, project_id')
                .in('project_id', projectIds)

            if (eeError) throw eeError

            const inserts: { project_id: string, expense_id: string | null, amount: number, expense_date: string, notes: string }[] = []

            rows.slice(1).forEach((row: unknown) => {
                const r = row as unknown[]
                const expenseName = String(r[0] || '').trim()
                const amount = parseFloat(r[1] as string)

                let dateStr = r[2] as string | number
                if (typeof dateStr === 'number') {
                    const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000))
                    dateStr = d.toISOString().split('T')[0]
                } else {
                    dateStr = String(dateStr || '')
                }

                const notes = String(r[3] || '').trim()

                if (!amount || isNaN(amount) || !dateStr) return

                // Prorate the actual amount
                projects.forEach(p => {
                    const projectShare = Number(p.total_value) / groupTotalValue
                    const proratedAmount = amount * projectShare

                    // Try to find matching target expense ID for this specific project
                    const matchingExpense = existingExpenses?.find(e => e.project_id === p.id && e.name.trim() === expenseName)

                    inserts.push({
                        project_id: p.id,
                        expense_id: matchingExpense ? matchingExpense.id : null,
                        amount: proratedAmount,
                        expense_date: dateStr,
                        notes: notes,
                    })
                })
            })

            if (inserts.length === 0) throw new Error('لم يتم العثور على بيانات صالحة. الأعمدة (مصدر البند المدخل مسبقاً، المبلغ، التاريخ، ملاحظات)')

            const { error } = await supabase.from('actual_expenses').insert(inserts)
            if (error) throw error

            setMessage({ text: `تم استيراد وتوزيع المصاريف الفعلية على ${projects.length} مشاريع بنجاح!`, type: 'success' })
            await fetchCategoryData(selectedCategory)
            router.refresh()
        } catch (err: unknown) {
            const errorObj = err as Error
            setMessage({ text: errorObj.message || 'حدث خطأ أثناء الاستيراد', type: 'error' })
        } finally {
            setLoadingActuals(false)
            e.target.value = ''
        }
    }

    // Quick Add Handler
    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedCategory) {
            setMessage({ text: 'الرجاء اختيار مجموعة المشاريع أولاً', type: 'error' })
            return
        }
        if (!quickAddProject) {
            setMessage({ text: 'الرجاء اختيار المشروع', type: 'error' })
            return
        }
        if (!quickAddName || !quickAddAmount) {
            setMessage({ text: 'الرجاء إدخال البند المالي والمبلغ', type: 'error' })
            return
        }

        setLoadingQuickAdd(true)
        setMessage(null)
        try {
            if (quickAddType === 'target') {
                const { error } = await supabase.from('project_expenses').insert({
                    project_id: quickAddProject,
                    name: quickAddName.trim(),
                    target_amount: parseFloat(quickAddAmount)
                })
                if (error) throw error
                setMessage({ text: 'تمت إضافة بند الموازنة بنجاح!', type: 'success' })
            } else {
                // For actual expenses, try to match to an existing target expense
                const { data: existing } = await supabase.from('project_expenses').select('id, name').eq('project_id', quickAddProject)
                const matchingExpense = existing?.find(exp => exp.name.trim() === quickAddName.trim())

                const { error } = await supabase.from('actual_expenses').insert({
                    project_id: quickAddProject,
                    expense_id: matchingExpense ? matchingExpense.id : null,
                    amount: parseFloat(quickAddAmount),
                    expense_date: quickAddDate,
                    notes: quickAddNotes.trim()
                })
                if (error) throw error
                setMessage({ text: 'تمت إضافة المصروف الفعلي بنجاح!', type: 'success' })
            }

            setQuickAddName('')
            setQuickAddAmount('')
            setQuickAddNotes('')

            await fetchCategoryData(selectedCategory)
            router.refresh()
        } catch (err: unknown) {
            const errorObj = err as Error
            setMessage({ text: errorObj.message || 'حدث خطأ أثناء الإضافة', type: 'error' })
        } finally {
            setLoadingQuickAdd(false)
        }
    }

    return (
        <div className="p-4 md:p-8 w-full space-y-6" dir="rtl">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة واستيراد المصاريف</h1>
                <p className="text-gray-500 mt-2 text-sm md:text-base">قم بتحديد التصنيف للمشروع ثم يمكنك إضافة المصاريف بشكل فردي وسريع، أو استيرادها بشكل جماعي عبر رفع ملفات الإكسل (سيتم التوزيع التلقائي بناءً على نسب قيم المشاريع).</p>
            </div>

            {/* Selection Row */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="flex-1">
                    <label className="block text-gray-700 font-semibold mb-2 text-sm md:text-base">اختر مجموعة المشاريع <span className="text-red-500">*</span></label>
                    <select
                        value={selectedCategory}
                        onChange={e => { setSelectedCategory(e.target.value); setSelectedProject('all'); }}
                        className="w-full h-11 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 px-4 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
                    >
                        <option value="">-- اضغط لاختيار المجموعة --</option>
                        <option value="مشاريع الحج">مشاريع الحج</option>
                        <option value="المجلس التنسيقي">المجلس التنسيقي</option>
                    </select>
                </div>

                <div className="flex-1">
                    <label className="block text-gray-700 font-semibold mb-2 text-sm md:text-base flex items-center justify-between">
                        <span>تصفية حسب المشروع</span>
                        {selectedCategory && availableProjects.length === 0 && !loadingData && (
                            <span className="text-xs text-amber-500 font-normal">لا توجد مشاريع نشطة</span>
                        )}
                    </label>
                    <select
                        value={selectedProject}
                        onChange={e => setSelectedProject(e.target.value)}
                        disabled={!selectedCategory || availableProjects.length === 0}
                        className="w-full h-11 rounded-lg border border-gray-300 bg-gray-50 text-gray-900 px-4 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="all">-- جميع المشاريع --</option>
                        {availableProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl font-medium shadow-sm flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message.type === 'success' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    )}
                    {message.text}
                </div>
            )}

            {/* Actions Grid: Quick Add + Bulk Imports */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Quick Add Form */}
                <div className="xl:col-span-2 flex flex-col">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-full overflow-hidden relative">
                        <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                                </div>
                                <h2 className="text-base md:text-lg font-bold text-gray-900">إضافة بند مباشر</h2>
                            </div>
                            <span className="text-[10px] md:text-xs text-gray-500 font-medium bg-white px-2.5 py-1 rounded-md border border-gray-200 shadow-sm hidden sm:inline-block">إدخال مباشر بدون ملف</span>
                        </div>

                        <div className="p-5 md:p-6 flex-1 relative flex flex-col justify-center">
                            {!selectedCategory && (
                                <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
                                    <div className="bg-white px-5 md:px-6 py-3 md:py-4 rounded-xl shadow-lg border border-gray-100 text-gray-600 text-sm md:text-base font-medium flex items-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                        اختر التصنيف أولاً لفتح الإضافة
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleQuickAdd} className={`grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 items-end ${!selectedCategory ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">نوع العملية</label>
                                    <select
                                        value={quickAddType}
                                        onChange={e => setQuickAddType(e.target.value as 'target' | 'actual')}
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors"
                                    >
                                        <option value="target">بند موازنة مستهدفة</option>
                                        <option value="actual">مصروف فعلي</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">المشروع المستهدف <span className="text-red-500">*</span></label>
                                    <select
                                        value={quickAddProject}
                                        onChange={e => setQuickAddProject(e.target.value)}
                                        required
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors"
                                    >
                                        <option value="">-- اختر المشروع --</option>
                                        {availableProjects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">البند المالي <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={quickAddName}
                                        onChange={e => setQuickAddName(e.target.value)}
                                        list="quick-add-names"
                                        required
                                        placeholder={quickAddType === 'target' ? "اسم البند المستهدف" : "اسم البند لربط الموازنة"}
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors"
                                    />
                                    <datalist id="quick-add-names">
                                        {Array.from(new Set(targetExpenses.filter(e => e.project_id === quickAddProject).map(e => e.name))).map((n, i) => (
                                            <option key={i} value={n} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">المبلغ (ر.س) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={quickAddAmount}
                                        onChange={e => setQuickAddAmount(e.target.value)}
                                        required
                                        placeholder="0.00"
                                        className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors text-left"
                                        dir="ltr"
                                    />
                                </div>

                                {quickAddType === 'actual' && (
                                    <>
                                        <div>
                                            <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">تاريخ الصرف <span className="text-red-500">*</span></label>
                                            <input
                                                type="date"
                                                value={quickAddDate}
                                                onChange={e => setQuickAddDate(e.target.value)}
                                                required={quickAddType === 'actual'}
                                                className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 font-medium mb-1.5 text-xs md:text-sm">الملاحظات (اختياري)</label>
                                            <input
                                                type="text"
                                                value={quickAddNotes}
                                                onChange={e => setQuickAddNotes(e.target.value)}
                                                placeholder="أضف ملاحظات..."
                                                className="w-full h-10 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 px-3 focus:bg-white focus:border-blue-500 focus:outline-none text-sm transition-colors"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="md:col-span-2 mt-2">
                                    <Button
                                        type="submit"
                                        disabled={loadingQuickAdd}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm md:text-base font-semibold shadow-md transition-all active:scale-[0.98]"
                                    >
                                        {loadingQuickAdd ? 'جارٍ الإضافة...' : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 inline-block"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                                                إضافة {quickAddType === 'target' ? 'بند موازنة' : 'المصروف الفعلي'} المباشرة
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Import Files Column */}
                <div className="xl:col-span-1 flex flex-col gap-6">
                    {/* Bulk Target Upload */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm relative overflow-hidden flex-1 p-5 md:p-6 flex flex-col group hover:border-blue-300 transition-colors">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500"></div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-gray-900 font-bold text-base md:text-lg">استيراد موازنة مستهدفة</h3>
                                <span className="text-xl md:text-2xl opacity-80">🎯</span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                                إضافة مجموعة بنود موازنة عبر ملف Excel. ترتيب الأعمدة: بند المصروف، السعر، العدد، الإجمالي.
                            </p>

                            {!selectedCategory && (
                                <p className="text-xs text-amber-600 mt-2 font-medium">اختر المجموعة لتفعيل الاستيراد</p>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3 relative z-10">
                            <Button asChild disabled={loadingTargets || !selectedCategory} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-10 px-2 text-xs md:text-sm shadow-sm transition-all active:scale-[0.98]">
                                <label className={`flex items-center justify-center gap-1.5 ${(!selectedCategory || loadingTargets) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    {loadingTargets ? 'جارٍ...' : 'رفع الإكسل'}
                                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleTargetImport} disabled={loadingTargets || !selectedCategory} />
                                </label>
                            </Button>

                            <Button variant="outline" onClick={downloadTargetTemplate} className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 h-10 px-2 text-xs md:text-sm bg-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                النموذج
                            </Button>
                        </div>
                    </div>

                    {/* Bulk Actual Upload */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm relative overflow-hidden flex-1 p-5 md:p-6 flex flex-col group hover:border-emerald-300 transition-colors">
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-gray-900 font-bold text-base md:text-lg">استيراد مصاريف فعلية</h3>
                                <span className="text-xl md:text-2xl opacity-80">💸</span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
                                إضافة المنصرف الفعلي عبر ملف Excel. ترتيب الأعمدة: اسم البند (للربط)، الإجمالي الفعلي، التاريخ، الملاحظات.
                            </p>

                            {!selectedCategory && (
                                <p className="text-xs text-amber-600 mt-2 font-medium">اختر المجموعة لتفعيل الاستيراد</p>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3 relative z-10">
                            <Button asChild disabled={loadingActuals || !selectedCategory} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-2 text-xs md:text-sm shadow-sm transition-all active:scale-[0.98]">
                                <label className={`flex items-center justify-center gap-1.5 ${(!selectedCategory || loadingActuals) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                    {loadingActuals ? 'جارٍ...' : 'رفع الإكسل'}
                                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleActualImport} disabled={loadingActuals || !selectedCategory} />
                                </label>
                            </Button>

                            <Button variant="outline" onClick={downloadActualTemplate} className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-10 px-2 text-xs md:text-sm bg-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                النموذج
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tables Section always visible but maybe blocked */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
                {!selectedCategory && (
                    <div className="absolute inset-0 z-10 bg-gray-50/60 backdrop-blur-[2px] flex items-center justify-center rounded-2xl border border-gray-100/50">
                        <div className="bg-white/95 px-8 py-6 rounded-2xl shadow-lg border border-gray-100 text-gray-700 font-semibold flex flex-col items-center gap-4 max-w-sm text-center">
                            <div className="bg-gray-50 p-4 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><polyline points="14 2 14 8 20 8" /><path d="M2 15h10" /><path d="m9 18 3-3-3-3" /></svg>
                            </div>
                            <p className="text-lg">تصفح البيانات والفواتير</p>
                            <p className="text-sm text-gray-500 font-normal leading-relaxed">اختر مجموعة المشاريع من الأعلى لعرض الجداول المتعلقة بالموازنات المستهدفة والمصاريف الفعلية الخاصة بها.</p>
                        </div>
                    </div>
                )}

                {/* Target Expenses Table */}
                <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px] transition-opacity ${!selectedCategory ? 'opacity-40' : ''}`}>
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></div>
                            <h3 className="text-gray-900 font-bold">ملخص الموازنة (المستهدف)</h3>
                        </div>
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">{filteredTargetExpenses.length} بنود</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-0 relative bg-white">
                        {loadingData ? (
                            <div className="flex flex-col justify-center items-center h-full text-blue-600 gap-4">
                                <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-sm font-medium animate-pulse">جلب بيانات الموازنة...</span>
                            </div>
                        ) : filteredTargetExpenses.length === 0 && selectedCategory ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                <div className="bg-gray-50 p-4 rounded-full mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                </div>
                                <p className="font-medium text-gray-500">لا توجد بنود موازنة مسجلة</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                                    <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap bg-gray-50/50">
                                        <th className="text-right px-5 py-3.5 font-semibold">المشروع</th>
                                        <th className="text-right px-5 py-3.5 font-semibold">اسم البند</th>
                                        <th className="text-left px-5 py-3.5 font-semibold">القيمة المخصصة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTargetExpenses.map((exp, i) => (
                                        <tr key={exp.id || i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors group">
                                            <td className="px-5 py-3.5 text-gray-900 text-xs w-1/3 max-w-[120px]">
                                                <div className="truncate font-semibold group-hover:text-blue-700 transition-colors" title={exp.projects?.name}>{exp.projects?.name}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 text-xs font-medium">{exp.name}</td>
                                            <td className="px-5 py-3.5 text-left font-bold text-blue-600 truncate">
                                                <span dir="ltr">{Number(exp.target_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Actual Expenses Table */}
                <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[500px] transition-opacity ${!selectedCategory ? 'opacity-40' : ''}`}>
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                            <h3 className="text-gray-900 font-bold">المنصرف الفعلي من الموازنة</h3>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">{filteredActualExpenses.length} عملية</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-0 relative bg-white">
                        {loadingData ? (
                            <div className="flex flex-col justify-center items-center h-full text-emerald-600 gap-4">
                                <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-sm font-medium animate-pulse">جلب بيانات المصاريف...</span>
                            </div>
                        ) : filteredActualExpenses.length === 0 && selectedCategory ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                <div className="bg-gray-50 p-4 rounded-full mb-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
                                </div>
                                <p className="font-medium text-gray-500">لا توجد مصاريف فعلية مسجلة</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white/95 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
                                    <tr className="border-b border-gray-100 text-gray-500 text-xs whitespace-nowrap bg-gray-50/50">
                                        <th className="text-right px-5 py-3.5 font-semibold">التاريخ</th>
                                        <th className="text-right px-5 py-3.5 font-semibold">المشروع / البند</th>
                                        <th className="text-left px-5 py-3.5 font-semibold">المبلغ المُحمل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredActualExpenses.map((act, i) => (
                                        <tr key={act.id || i} className="border-b border-gray-50 hover:bg-emerald-50/40 transition-colors group">
                                            <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap text-xs">
                                                <div className="font-semibold text-gray-900">{act.expense_date}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-900 text-xs max-w-[140px]">
                                                <div className="truncate font-bold mb-1 group-hover:text-emerald-700 transition-colors" title={act.projects?.name}>{act.projects?.name}</div>
                                                <div className="truncate text-gray-500 text-[11px] bg-gray-50 inline-block px-1.5 py-0.5 rounded" title={act.project_expenses?.name || act.project_staffing?.role_name || act.notes || ''}>
                                                    {act.project_expenses?.name || act.project_staffing?.role_name || act.notes || '-'}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-left font-bold text-emerald-600 truncate">
                                                <span dir="ltr">{Number(act.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} ر.س</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
