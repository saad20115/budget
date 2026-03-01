'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewProjectPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '', client: '', total_value: '', target_profit_margin: '10',
        status: 'Active', category: 'مشاريع الحج', start_date: '', end_date: '', duration_months: '1',
    })

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('يجب تسجيل الدخول أولاً'); setLoading(false); return }

        const { data, error: err } = await supabase.from('projects').insert({
            user_id: user.id,
            name: form.name,
            client: form.client,
            total_value: parseFloat(form.total_value) || 0,
            target_profit_margin: parseFloat(form.target_profit_margin) || 0,
            status: form.status,
            category: form.category,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            duration_months: parseInt(form.duration_months) || 1,
        }).select().single()

        if (err) { setError(err.message); setLoading(false); return }
        router.push(`/dashboard/projects/${data.id}`)
    }

    const inputClass = "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
    const labelClass = "text-gray-700 text-sm font-medium"

    return (
        <div className="p-8 max-w-3xl mx-auto" dir="rtl">
            <div className="mb-6">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 text-sm mb-4 flex items-center gap-2 transition-colors">
                    → رجوع
                </button>
                <h1 className="text-2xl font-bold text-gray-900">إضافة مشروع جديد</h1>
                <p className="text-gray-500 text-sm mt-1">أدخل تفاصيل المشروع لبدء تتبع الموازنة</p>
            </div>

            <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-gray-900 text-lg">بيانات المشروع</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className={labelClass}>اسم المشروع *</Label>
                                <Input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} required placeholder="مثال: مشروع دليل الزوار" />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>اسم العميل *</Label>
                                <Input className={inputClass} value={form.client} onChange={e => set('client', e.target.value)} required placeholder="مثال: شركة XYZ" />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>قيمة العقد (ريال) *</Label>
                                <Input className={inputClass} type="number" value={form.total_value} onChange={e => set('total_value', e.target.value)} required placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>نسبة الربح المستهدفة (%)</Label>
                                <Input className={inputClass} type="number" value={form.target_profit_margin} onChange={e => set('target_profit_margin', e.target.value)} placeholder="10" />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>مدة المشروع (شهور) *</Label>
                                <Input className={inputClass} type="number" min={1} value={form.duration_months} onChange={e => set('duration_months', e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>الحالة</Label>
                                <select
                                    value={form.status}
                                    onChange={e => set('status', e.target.value)}
                                    title="حالة المشروع"
                                    className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="Active">نشط</option>
                                    <option value="Completed">مكتمل</option>
                                    <option value="On Hold">معلق</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>تصنيف المشروع</Label>
                                <select
                                    value={form.category}
                                    onChange={e => set('category', e.target.value)}
                                    title="تصنيف المشروع"
                                    className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="مشاريع الحج">مشاريع الحج</option>
                                    <option value="المجلس التنسيقي">المجلس التنسيقي</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>تاريخ البداية</Label>
                                <Input className={inputClass} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className={labelClass}>تاريخ النهاية</Label>
                                <Input className={inputClass} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                            </div>
                        </div>

                        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

                        <div className="flex gap-3 pt-2">
                            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                                {loading ? 'جارٍ الحفظ...' : 'حفظ المشروع'}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.back()} className="border-gray-300 text-gray-600 hover:text-gray-900">
                                إلغاء
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
