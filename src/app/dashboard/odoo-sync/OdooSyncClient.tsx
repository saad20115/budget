'use client'

import { useState, useCallback, useEffect } from 'react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from '@/components/ui/button'
import Link from 'next/link'
// ─── Types ───────────────────────────────────────────────────────────────────
interface ApiConnection {
    id: string
    label: string
    url: string
    username: string
    password: string
    is_active: boolean
    sync_interval_hours: number
    mapping_config?: Record<string, any>
    filter_config?: {
        dateFrom?: string
        dateTo?: string
        allowedCostCenters?: string[]
        allowedAccountTypes?: string[]
        allowedAccountCodes?: string[]
    }
    last_sync_at?: string | null
    last_sync_status?: string | null
    last_sync_message?: string | null
    last_sync_records?: number | null
    _isNew?: boolean
    _isDirty?: boolean
}

// ─── Helpers & Components ──────────────────────────────────────────────────────
const generateId = () => 'new_' + Math.random().toString(36).substring(2, 9)

function CreatableMultiSelect({ 
    options, 
    values, 
    onChange, 
    placeholder, 
    emptyMessage 
}: { 
    options: string[], 
    values: string[], 
    onChange: (v: string[]) => void, 
    placeholder: string, 
    emptyMessage: string 
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')

    const filteredOptions = options.filter(o => o.toLowerCase().includes(search.toLowerCase()) && !values.includes(o))
    
    return (
        <div className="relative">
            <div 
                className="min-h-[38px] p-1 border border-gray-300 rounded-lg bg-white flex flex-wrap gap-1 cursor-text items-center transition-colors focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
                onClick={() => setOpen(true)}
                dir="rtl"
            >
                {values.map(v => (
                    <span key={v} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded flex items-center gap-1" dir="ltr">
                        {v}
                        <button 
                            className="font-bold text-blue-500 hover:text-blue-900 mx-1" 
                            onClick={(e) => { e.stopPropagation(); onChange(values.filter(x => x !== v)) }}
                        >×</button>
                    </span>
                ))}
                <input 
                    value={search} 
                    onChange={e => {setSearch(e.target.value); setOpen(true)}} 
                    onFocus={() => setOpen(true)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            if (search.trim() && !values.includes(search.trim())) {
                                onChange([...values, search.trim()])
                                setSearch('')
                            }
                        }
                    }}
                    placeholder={values.length === 0 ? placeholder : ''}
                    className="flex-1 outline-none text-sm min-w-[50px] bg-transparent p-1"
                />
            </div>
            {open && (
                <>
                    <div className="fixed inset-0 z-0" onClick={() => setOpen(false)}></div>
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div 
                                    key={opt} 
                                    className="p-2 hover:bg-gray-100 cursor-pointer text-sm text-right border-b border-gray-50 flex items-center justify-between"
                                    onClick={() => {
                                        onChange([...values, opt])
                                        setSearch('')
                                    }}
                                >
                                    <span>{opt}</span>
                                    <span className="text-gray-400 text-xs">+ إضافة</span>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-xs text-gray-500 text-center bg-gray-50 m-2 rounded-lg border border-dashed border-gray-200">
                                {search ? (
                                    <>
                                        <span className="block mb-1">غير موجود في القائمة</span>
                                        <span className="font-bold text-blue-600 block text-sm">اضغط Enter لإضافته كفلتر: "{search}"</span>
                                    </>
                                ) : emptyMessage}
                            </div>
                        )}
                        <button 
                            className="w-full text-center text-xs p-2 text-gray-500 bg-white hover:bg-gray-50 border-t" 
                            onClick={(e) => { e.preventDefault(); setOpen(false); }}
                        >
                            إغلاق القائمة
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

const createEmptyConnection = (): ApiConnection => ({
    id: generateId(),
    label: '',
    url: '',
    username: '',
    password: '',
    is_active: true,
    sync_interval_hours: 4,
    mapping_config: {
        companyId: 'company_id',
        companyName: 'company_name',
        costCenter: 'cost_center',
        accountCode: 'account_code',
        accountName: 'account_name',
        accountType: 'account_type',
        date: 'date',
        expenses: 'expenses',
    },
    filter_config: {
        allowedCostCenters: [],
        allowedAccountTypes: [],
        allowedAccountCodes: [],
    },
    _isNew: true,
    _isDirty: true,
})

const fmt = (n: number) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `منذ ${mins} دقيقة`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `منذ ${hrs} ساعة`
    const days = Math.floor(hrs / 24)
    return `منذ ${days} يوم`
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function OdooSyncClient() {
    const [connections, setConnections] = useState<ApiConnection[]>([])
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<Set<string>>(new Set())
    const [caching, setCaching] = useState<Set<string>>(new Set())
    const [syncing, setSyncing] = useState(false)

    // View states per connection (tabs within card)
    const [activeTab, setActiveTab] = useState<Map<string, string>>(new Map())
    const getTab = (id: string) => activeTab.get(id) || 'config'
    const setTab = (id: string, tab: string) => setActiveTab(prev => new Map(prev).set(id, tab))

    const [dataPage, setDataPage] = useState<Map<string, number>>(new Map())
    const getPage = (id: string) => dataPage.get(id) || 0
    const setPage = (id: string, p: number) => setDataPage(prev => new Map(prev).set(id, p))
    const PAGE_SIZE = 25

    // ─── Load saved connections on mount ─────────────────────────────────────
    const loadConnections = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/odoo-connections')
            const data = await res.json()
            if (Array.isArray(data)) {
                setConnections(data.map((c: ApiConnection) => ({ ...c, _isNew: false, _isDirty: false })))
            }
        } catch {
            setMessage({ text: 'خطأ في تحميل المصادر المحفوظة', type: 'error' })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadConnections() }, [loadConnections])

    // ─── State Management ────────────────────────────────────────────────────
    const addConnection = () => {
        const newConn = createEmptyConnection()
        setConnections(prev => [newConn, ...prev])
    }

    const updateConnection = (id: string, field: keyof ApiConnection, value: any) => {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, [field]: value, _isDirty: true } : c))
    }

    const updateMapping = (id: string, key: string, value: string) => {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, mapping_config: { ...c.mapping_config, [key]: value }, _isDirty: true } : c))
    }

    const updateFilter = (id: string, key: string, value: any) => {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, filter_config: { ...c.filter_config, [key]: value }, _isDirty: true } : c))
    }

    // ─── Save Connection to DB ───────────────────────────────────────────────
    const saveConnection = useCallback(async (conn: ApiConnection, showMsg = true) => {
        if (!conn.url || !conn.username || !conn.password) {
            setMessage({ text: 'الرجاء تعبئة جميع الحقول (الرابط، المستخدم، كلمة المرور) قبل الحفظ', type: 'error' })
            return
        }

        setSaving(prev => new Set(prev).add(conn.id))
        try {
            const body: Record<string, any> = {
                label: conn.label,
                url: conn.url,
                username: conn.username,
                password: conn.password,
                is_active: conn.is_active,
                sync_interval_hours: conn.sync_interval_hours,
                mapping_config: conn.mapping_config,
                filter_config: conn.filter_config,
            }
            if (!conn._isNew) body.id = conn.id

            const res = await fetch('/api/odoo-connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save')

            setConnections(prev => prev.map(c => c.id === conn.id ? { ...data, _isNew: false, _isDirty: false } : c))
            if (showMsg) setMessage({ text: `✅ تم حفظ "${conn.label || 'المصدر'}" بنجاح`, type: 'success' })
        } catch (error: any) {
            setMessage({ text: `خطأ في الحفظ: ${error.message || 'Unknown'}`, type: 'error' })
        } finally {
            setSaving(prev => { const n = new Set(prev); n.delete(conn.id); return n })
        }
    }, [])

    const deleteConnection = useCallback(async (conn: ApiConnection) => {
        if (conn._isNew) {
            setConnections(prev => prev.filter(c => c.id !== conn.id))
            return
        }
        if (!confirm(`هل أنت متأكد من حذف الاتصال بـ "${conn.label || conn.url}" بشكل نهائي؟`)) return

        try {
            const res = await fetch(`/api/odoo-connections?id=${conn.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')

            setConnections(prev => prev.filter(c => c.id !== conn.id))
            setMessage({ text: `🗑️ تم حذف اتصال أودو بنجاح`, type: 'success' })
        } catch {
            setMessage({ text: 'خطأ في الحذف', type: 'error' })
        }
    }, [])

    // ─── Fetch Raw Data into Cache (Decoupled Workflow) ──────────────────────
    const fetchToCache = useCallback(async (conn: ApiConnection) => {
        if (!conn.url || !conn.username || !conn.password) {
            setMessage({ text: 'تأكد من إدخال الرابط ومعلومات الدخول قبل جلب العينة', type: 'error' })
            return
        }

        setCaching(prev => new Set(prev).add(conn.id))
        setMessage({ text: 'جاري جلب البيانات من السيرفر وتحليلها لإنشاء المسودة... قد تستغرق بضعة ثوانٍ بناءً على سرعة سيرفركم.', type: 'info' })

        try {
            const response = await fetch('/api/odoo-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url: conn.url, 
                    username: conn.username, 
                    password: conn.password,
                    config: conn.mapping_config
                }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)

            // Save the returned data locally into the mapping_config payload inside the _cached property
            const newMappingConfig = { 
                ...conn.mapping_config, 
                _cached: {
                    fetchedAt: new Date().toISOString(),
                    sampleRecords: data.sampleRecords || [],
                    allKeys: data.meta?.allKeys || [],
                    uniqueCostCenters: data.meta?.uniqueCostCenters || [],
                    uniqueAccountTypes: data.meta?.uniqueAccountTypes || []
                }
            }
            
            // Immediately update react state
            setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, mapping_config: newMappingConfig, _isDirty: true } : c))
            
            setMessage({ text: '✅ تم تنزيل عينة البيانات والمراكز بشكل كاش محلي بنجاح! يمكنك الآن تعديل الفلاتر بدون تأخير.', type: 'success' })
            
            // Switch tab to "mappings" seamlessly
            setTab(conn.id, 'mappings')
            setPage(conn.id, 0)
            
            // Auto save so the cached mapping config persists if user refreshes!
            await saveConnection({ ...conn, mapping_config: newMappingConfig }, false)

        } catch (error: any) {
            setMessage({ text: `فشل السحب من السيرفر: ${error.message || 'Unknown'}`, type: 'error' })
        } finally {
            setCaching(prev => { const n = new Set(prev); n.delete(conn.id); return n })
        }
    }, [saveConnection])

    // Trigger Full Background Sync
    const triggerSync = useCallback(async () => {
        setSyncing(true)
        setMessage({ text: 'جارٍ إطلاق أمر المزامنة الشاملة بالخلفية لجميع المصادر النشطة...', type: 'info' })

        try {
            const res = await fetch('/api/odoo-sync/auto', { method: 'POST' })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Sync failed')

            setMessage({ text: `✅ ${data.message}`, type: 'success' })
            await loadConnections()
        } catch (error: any) {
            setMessage({ text: `خطأ في المزامنة: ${error.message || 'Unknown'}`, type: 'error' })
        } finally {
            setSyncing(false)
        }
    }, [loadConnections])


    const getFilteredPreview = (conn: ApiConnection, sampleRecords: any[]) => {
        const mc = conn.mapping_config || {}
        const fc = conn.filter_config || {}

        return sampleRecords.filter(r => {
            const rawDate = r[mc.date || 'date']
            if (fc.dateFrom || fc.dateTo) {
                if (!rawDate) return false
                const d = new Date(rawDate as string)
                if (fc.dateFrom && d < new Date(fc.dateFrom)) return false
                if (fc.dateTo && d > new Date(fc.dateTo)) return false
            }

            const cc = String(r[mc.costCenter || 'cost_center'] || '')
            if (fc.allowedCostCenters && fc.allowedCostCenters.length > 0) {
                if (!fc.allowedCostCenters.includes(cc)) return false
            }

            const at = String(r[mc.accountType || 'account_type'] || '')
            if (fc.allowedAccountTypes && fc.allowedAccountTypes.length > 0) {
                if (!fc.allowedAccountTypes.some(allowed => at.toLowerCase().includes(allowed.toLowerCase()))) return false
            }

            const ac = String(r[mc.accountCode || 'account_code'] || '')
            if (fc.allowedAccountCodes && fc.allowedAccountCodes.length > 0) {
                if (!fc.allowedAccountCodes.some(allowed => ac.startsWith(allowed))) return false
            }

            return true
        })
    }

    return (
        <div className="space-y-6 fade-in" dir="rtl">
            {message && (
                <div className={`p-4 rounded-xl font-medium transition-all ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                    message.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-4 border-b border-gray-100">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">إدارة المصادر الخارجية (Odoo)</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        أضف مصادر الـ APIs واجلب مسودة الفلاتر ثم احفظها للمزامنة التلقائية.
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <Link href="/dashboard/odoo-sync/report" className="w-full md:w-auto">
                        <Button variant="outline" className="w-full md:w-auto border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-semibold shadow-sm">
                            📊 تقرير المزامنة
                        </Button>
                    </Link>
                    <Button onClick={addConnection} className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto">
                        + إضافة رابط API جديد
                    </Button>
                    <Button onClick={triggerSync} disabled={syncing || connections.length === 0} variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700 w-full md:w-auto">
                        {syncing ? 'جار المزامنة...' : '🔄 مزامنة فعلية فورية للجميع'}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">جاري تحميل الإعدادات...</div>
            ) : connections.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                    لا يوجد أي مصدر بيانات حالياً، أضف مصدراً جديداً لتبدأ.
                </div>
            ) : (
                <div className="space-y-8">
                    {connections.map((conn) => {
                        const isSaving = saving.has(conn.id)
                        const isCaching = caching.has(conn.id)
                        const cache = conn.mapping_config?._cached || null
                        const tab = getTab(conn.id)

                        return (
                            <div key={conn.id} className={`bg-white rounded-2xl shadow-sm border ${conn._isDirty ? 'border-amber-300' : 'border-gray-200'} overflow-hidden transition-all duration-300 hover:shadow-md`}>
                                {/* Header / Status Bar */}
                                <div className="bg-gray-50 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                                            O
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">
                                                {conn.label || (conn.url ? conn.url.split('?')[0] : 'مصدر جديد')}
                                            </h3>
                                            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                <span className={`inline-block w-2 h-2 rounded-full ${conn.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                {conn.is_active ? 'المزامنة مُفعلة' : 'المزامنة متوقفة'}
                                                {conn.last_sync_at && (
                                                    <span className="text-gray-400">| آخر مزامنة: {timeAgo(conn.last_sync_at)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <Button 
                                            onClick={() => saveConnection(conn)} 
                                            disabled={!conn._isDirty || isSaving}
                                            className={`${conn._isDirty ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            {isSaving ? 'جارِ الحفظ...' : conn._isDirty ? 'حفظ التغييرات' : 'تم الحفظ ✔️'}
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => deleteConnection(conn)}>حذف</Button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="flex border-b border-gray-100 bg-white px-2 overflow-x-auto hide-scrollbar">
                                    <button onClick={() => setTab(conn.id, 'config')} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'config' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        1. إعدادات الاتصال وجلب الرابط
                                    </button>
                                    <button onClick={() => setTab(conn.id, 'mappings')} disabled={!cache} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${!cache ? 'opacity-50 cursor-not-allowed' : ''} ${tab === 'mappings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        2. مطابقة الأعمدة (سريع)
                                    </button>
                                    <button onClick={() => setTab(conn.id, 'filters')} disabled={!cache} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${!cache ? 'opacity-50 cursor-not-allowed' : ''} ${tab === 'filters' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        3. ضبط فلاتر السحب الذكية
                                    </button>
                                    <button onClick={() => setTab(conn.id, 'preview')} disabled={!cache} className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${!cache ? 'opacity-50 cursor-not-allowed' : ''} ${tab === 'preview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        4. معاينة البيانات المسحوبة
                                    </button>
                                </div>

                                {/* Tab Contents */}
                                <div className="p-6 bg-white min-h-[300px]">
                                    
                                    {/* 1. CONFIG TAB */}
                                    {tab === 'config' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-gray-800 border-b pb-2">بيانات الرابط والصلاحيات</h4>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-600 block mb-1">اسم تعريفي للمصدر (اختياري)</label>
                                                    <input 
                                                        value={conn.label || ''} 
                                                        onChange={(e) => updateConnection(conn.id, 'label', e.target.value)} 
                                                        placeholder="مثال: مصاريف أودو الرئيسي"
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-gray-600 block mb-1">رابط النظام (API URL)</label>
                                                    <input 
                                                        dir="ltr"
                                                        value={conn.url} 
                                                        onChange={(e) => updateConnection(conn.id, 'url', e.target.value)} 
                                                        placeholder="https://example.com/api/xyz"
                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-left font-mono" 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-600 block mb-1">اسم المستخدم</label>
                                                        <input 
                                                            dir="ltr"
                                                            value={conn.username} 
                                                            onChange={(e) => updateConnection(conn.id, 'username', e.target.value)} 
                                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-gray-600 block mb-1">كلمة المرور</label>
                                                        <input 
                                                            type="password" 
                                                            dir="ltr"
                                                            value={conn.password} 
                                                            onChange={(e) => updateConnection(conn.id, 'password', e.target.value)} 
                                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg" 
                                                        />
                                                    </div>
                                                </div>

                                                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 mt-4">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={conn.is_active} 
                                                        onChange={(e) => updateConnection(conn.id, 'is_active', e.target.checked)}
                                                        className="w-5 h-5 rounded text-blue-600" 
                                                    />
                                                    <div>
                                                        <span className="text-sm font-semibold text-gray-800 block">تفعيل المزامنة التلقائية</span>
                                                        <span className="text-xs text-gray-500">سيتم جلب البيانات الجديدة آلياً كل يوم.</span>
                                                    </div>
                                                </label>
                                            </div>

                                            <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 flex flex-col justify-center items-center text-center">
                                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
                                                    ☁️
                                                </div>
                                                <h4 className="font-bold text-blue-900 mb-2">جلب العينة المحلية لمعرفة الفلاتر</h4>
                                                <p className="text-sm text-blue-700/80 mb-6 max-w-sm">
                                                    بدلاً من الانتظار وتوقف الواجهة كل مرة تود فيها إضافة فلتر، يمكنك تحميل مسودة للبيانات وحفظها للعمل عليها بسلاسة!
                                                </p>
                                                <Button 
                                                    onClick={() => fetchToCache(conn)}
                                                    disabled={isCaching || !conn.url}
                                                    className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 shadow-md text-white py-6 rounded-xl text-md font-bold"
                                                >
                                                    {isCaching ? 'جاري الاتصال وسحب البيانات...' : '⬇️ جلب العينة والكاش من النظام'}
                                                </Button>
                                                {cache && cache.fetchedAt && (
                                                    <p className="text-xs text-green-600 mt-4 font-medium flex items-center gap-1">
                                                        <span>✔️ مسودة محفوظة</span>
                                                        <span dir="ltr">({timeAgo(cache.fetchedAt)})</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. MAPPINGS TAB */}
                                    {tab === 'mappings' && cache && (
                                        <div className="space-y-6">
                                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                                <h4 className="text-sm font-bold text-amber-900 mb-1">مطابقة أعمدة النظام (رؤوس الأعمدة)</h4>
                                                <p className="text-xs text-amber-700">لقد تم التعرف على جميع الأعمدة في نظامكم. يرجى اختيار العمود المقابل لكل حقل مطلوب في نظامنا.</p>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                {[
                                                    { key: 'companyId', label: 'كود الشركة' },
                                                    { key: 'companyName', label: 'اسم الشركة' },
                                                    { key: 'costCenter', label: 'مركز التكلفة / تحليلي' },
                                                    { key: 'date', label: 'التاريخ' },
                                                    { key: 'accountCode', label: 'رقم الحساب' },
                                                    { key: 'accountName', label: 'اسم الحساب' },
                                                    { key: 'accountType', label: 'نوع الحساب' },
                                                    { key: 'expenses', label: 'المبلغ / التكلفة' }
                                                ].map((field) => (
                                                    <div key={field.key} className="space-y-1">
                                                        <label className="text-xs font-bold text-gray-700 block">{field.label}</label>
                                                        <select 
                                                            value={conn.mapping_config?.[field.key] || ''} 
                                                            onChange={(e) => updateMapping(conn.id, field.key, e.target.value)}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                                            dir="ltr"
                                                        >
                                                            <option value="">اكتب يدوياً...</option>
                                                            {cache.allKeys?.map((k: string) => <option key={k} value={k}>{k}</option>)}
                                                        </select>
                                                        {(!cache.allKeys?.includes(conn.mapping_config?.[field.key])) && (
                                                            <input 
                                                                type="text" 
                                                                value={conn.mapping_config?.[field.key] || ''} 
                                                                onChange={(e) => updateMapping(conn.id, field.key, e.target.value)} 
                                                                placeholder="أو اكتب اسم الحقل"
                                                                className="w-full mt-1 px-3 py-1.5 text-xs border border-blue-200 rounded text-blue-700 bg-blue-50 outline-none" 
                                                                dir="ltr"
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. FILTERS TAB */}
                                    {tab === 'filters' && cache && (
                                        <div className="space-y-6">
                                            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                                                <h4 className="text-sm font-bold text-indigo-900 mb-1">فلاتر المزامنة الذكية</h4>
                                                <p className="text-xs text-indigo-700 max-w-3xl">لن يتم استيراد أي مصروف من النظام الخارجي إلا إذا طابق جميع الشروط المحددة هنا. يمكنك تصفية المصروفات بناءً عليها. اترك الشروط فارغة إذا أردت سحب كل شيء.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                
                                                {/* Account Types Filter */}
                                                <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition-colors">
                                                    <h5 className="font-bold text-gray-800 mb-1">💸 أنواع الحسابات المستهدفة (Account Types)</h5>
                                                    <p className="text-xs text-gray-500 mb-4 block">مثال: Expenses, Cost of Revenue... حدد من القائمة المستخرجة من نظامك.</p>
                                                    <CreatableMultiSelect 
                                                        values={conn.filter_config?.allowedAccountTypes || []}
                                                        onChange={(vals) => updateFilter(conn.id, 'allowedAccountTypes', vals)}
                                                        options={cache.uniqueAccountTypes || []}
                                                        placeholder="اضغط لفتح القائمة، أو اكتب النوع..."
                                                        emptyMessage="اكتب اسم نوع الحساب واضغط Enter"
                                                    />
                                                </div>

                                                {/* Cost Centers Filter */}
                                                <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition-colors">
                                                    <h5 className="font-bold text-gray-800 mb-1">🏢 المراكز التحليلية المطلوبة (Analytic/Cost Centers)</h5>
                                                    <p className="text-xs text-gray-500 mb-4 block">حدد المراكز الفرعية المراد سحب ميزانيتها (مثل: الفرع الرئيسي، التسويق).</p>
                                                    <CreatableMultiSelect 
                                                        values={conn.filter_config?.allowedCostCenters || []}
                                                        onChange={(vals) => updateFilter(conn.id, 'allowedCostCenters', vals)}
                                                        options={cache.uniqueCostCenters || []}
                                                        placeholder="اضغط لفتح القائمة، أو اكتب المركز..."
                                                        emptyMessage="اكتب اسم مركز التكلفة واضغط Enter"
                                                    />
                                                </div>

                                                {/* Account Codes Prefix Filter */}
                                                <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition-colors">
                                                    <h5 className="font-bold text-gray-800 mb-1">🔢 أرقام تبدأ بـ (Account Codes Filters)</h5>
                                                    <p className="text-xs text-gray-500 mb-4 block">إذا كانت حسابات المصروفات تبدأ بأرقام معينة (مثل: 5 أو 301)، فاكتبها مفصولة بفاصلة.</p>
                                                    <input 
                                                        type="text" 
                                                        dir="ltr" 
                                                        placeholder="5, 301, 40" 
                                                        value={conn.filter_config?.allowedAccountCodes?.join(', ') || ''} 
                                                        onChange={(e) => updateFilter(conn.id, 'allowedAccountCodes', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} 
                                                        className="w-full px-4 h-10 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-mono tracking-widest text-left" 
                                                    />
                                                </div>

                                                {/* Date range missing, wait let's add Date Filters */}
                                                <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:border-blue-300 transition-colors">
                                                    <h5 className="font-bold text-gray-800 mb-1">📅 الفلترة بالتواريخ (اختياري)</h5>
                                                    <p className="text-xs text-gray-500 mb-4 block">اسحب الدفعات من تاريخ محدد فقط وإلى اليوم.</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-gray-500">من تاريخ</label>
                                                            <input 
                                                                type="date" 
                                                                value={conn.filter_config?.dateFrom || ''} 
                                                                onChange={(e) => {
                                                                    const newFrom = e.target.value
                                                                    const today = new Date().toISOString().split('T')[0]
                                                                    updateConnection(conn.id, 'filter_config', { ...conn.filter_config, dateFrom: newFrom, dateTo: today })
                                                                }} 
                                                                className="w-full px-3 h-10 rounded-lg border border-gray-300 text-sm focus:border-blue-500" 
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-xs text-gray-500">إلى تاريخ</label>
                                                            <input type="date" disabled value={conn.filter_config?.dateTo || ''} className="w-full px-3 h-10 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400" title="يتم تعيينه تلقائياً لليوم" />
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )}

                                    {/* 4. PREVIEW TAB */}
                                    {tab === 'preview' && cache && (
                                        <div className="space-y-4">
                                            <div className="flex flex-col md:flex-row items-center gap-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 justify-between">
                                                <div>
                                                    <h4 className="text-sm font-bold text-emerald-800">معاينة النتائج وفق الفلاتر 🔍</h4>
                                                    <p className="text-xs text-emerald-700 mt-1 max-w-xl">
                                                        هذا الجدول يطبق الفلاتر التي حددتها على مسودة الـ 500 سجل الموجودة بالاكاش. إذا كانت الفلاتر صحيحة، سترى المصروفات المقطّرة أدناه!
                                                    </p>
                                                </div>
                                                <div className="flex bg-white rounded-lg shadow-sm font-bold text-xs">
                                                    <div className="px-4 py-2 border-l border-gray-100 text-center">
                                                        <span className="block text-gray-400 mb-1 font-normal text-[10px]">المسودة الكاملة</span>
                                                        <span className="text-gray-800">{cache.sampleRecords?.length || 0}</span>
                                                    </div>
                                                    <div className="px-4 py-2 text-center text-emerald-600 bg-emerald-50/30">
                                                        <span className="block text-emerald-600/70 mb-1 font-normal text-[10px]">المدخلات المجتازة</span>
                                                        <span>{getFilteredPreview(conn, cache.sampleRecords || []).length}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Preview Table */}
                                            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                                                <table className="w-full text-xs text-right whitespace-nowrap">
                                                    <thead className="bg-gray-100 text-gray-600">
                                                        <tr>
                                                            <th className="px-4 py-3 border-b font-semibold">#</th>
                                                            <th className="px-4 py-3 border-b font-semibold">التاريخ</th>
                                                            <th className="px-4 py-3 border-b font-semibold">رقم الحساب</th>
                                                            <th className="px-4 py-3 border-b font-semibold">اسم الحساب</th>
                                                            <th className="px-4 py-3 border-b font-semibold">المركز / الشريك</th>
                                                            <th className="px-4 py-3 border-b font-semibold">النوع</th>
                                                            <th className="px-4 py-3 border-b font-semibold">المبلغ المسجل</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {getFilteredPreview(conn, cache.sampleRecords || []).slice(0, 50).map((row: any, i: number) => {
                                                            const m = conn.mapping_config || {}
                                                            let code = String(row[m.accountCode || 'account_code'] || '—')
                                                            let name = String(row[m.accountName || 'account_name'] || '—')
                                                            
                                                            if (code === name || code === '—' || name === '—') {
                                                                const sourceText = name !== '—' ? name : code
                                                                const match = sourceText.match(/^(\d+(?:\.\d+)?)\s+(.+)$/)
                                                                if (match) {
                                                                    code = match[1]
                                                                    name = match[2]
                                                                }
                                                            }

                                                            return (
                                                                <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                                                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                                                                    <td className="px-4 py-2.5 text-gray-700" dir="ltr">{String(row[m.date || 'date'] || '—')}</td>
                                                                    <td className="px-4 py-2.5 text-blue-600 font-mono tracking-wide">{code}</td>
                                                                    <td className="px-4 py-2.5 text-gray-800 font-medium truncate max-w-[200px]" title={name}>{name}</td>
                                                                    <td className="px-4 py-2.5 text-gray-600">{String(row[m.costCenter || 'cost_center'] || '—')}</td>
                                                                    <td className="px-4 py-2.5 text-[10px] text-gray-400 font-medium bg-gray-50/50 rounded">{String(row[m.accountType || 'account_type'] || '—')}</td>
                                                                    <td className="px-4 py-2.5 font-bold text-rose-600 font-mono" dir="ltr">{fmt(Number(row[m.expenses || 'expenses'] || 0))}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                        {getFilteredPreview(conn, cache.sampleRecords || []).length === 0 && (
                                                            <tr>
                                                                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                                                    لا توجد سجلات تطابق الفلاتر في مسودة العينة، جرب تخفيف الفلاتر قليلاً!
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
