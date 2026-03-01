'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isSignUp, setIsSignUp] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (isSignUp) {
            const { error } = await supabase.auth.signUp({ email, password })
            if (error) setError(error.message)
            else setError('تم إنشاء الحساب. تحقق من بريدك الإلكتروني للتأكيد.')
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(error.message)
            else router.push('/dashboard')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">نظام تحليل الموازنات</h1>
                    <p className="text-gray-500 mt-2">إدارة وتحليل موازنات المشاريع</p>
                </div>

                <Card className="bg-white border-gray-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-gray-900 text-xl">{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</CardTitle>
                        <CardDescription className="text-gray-500">
                            {isSignUp ? 'أنشئ حسابك للبدء في تحليل موازنات مشاريعك' : 'أدخل بياناتك للوصول إلى لوحة التحكم'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-gray-700">البريد الإلكتروني</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                                    placeholder="example@company.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-gray-700">كلمة المرور</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white border-gray-300 text-gray-900"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5"
                            >
                                {loading ? 'جارٍ التحميل...' : isSignUp ? 'إنشاء الحساب' : 'تسجيل الدخول'}
                            </Button>

                            <button
                                type="button"
                                onClick={() => setIsSignUp(!isSignUp)}
                                className="w-full text-gray-500 hover:text-gray-800 text-sm transition-colors"
                            >
                                {isSignUp ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
                            </button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
