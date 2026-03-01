'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const navItems = [
    { label: 'لوحة التحكم', href: '/dashboard', icon: '📊' },
    { label: 'المشاريع', href: '/dashboard/projects', icon: '🏗️' },
    { label: 'الإيرادات والمطالبات', href: '/dashboard/revenues', icon: '💰' },
    { label: 'تقويم المطالبات', href: '/dashboard/claims-calendar', icon: '📅' },
    { label: 'تقرير المطالبات', href: '/dashboard/claims-report', icon: '📑' },
    { label: 'الموازنة الشاملة', href: '/dashboard/budget', icon: '📋' },
    { label: 'المصاريف الفعلية الشاملة', href: '/dashboard/actual-expenses', icon: '💸' },
    { label: 'توزيع الرواتب', href: '/dashboard/salary-distribution', icon: '👥' },
    { label: 'استيراد المصاريف', href: '/dashboard/expenses/import', icon: '📥' },
    { label: 'تقرير شامل', href: '/dashboard/report', icon: '📈' },
    { label: 'إدارة المستخدمين', href: '/dashboard/admin', icon: '👤' },
]

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [isOpen, setIsOpen] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <>
            {/* Mobile Header Menu Button */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow shadow-blue-200">
                        <span className="text-sm">📊</span>
                    </div>
                    <span className="font-bold text-gray-800 text-sm">نظام الموازنات</span>
                </div>
                <button
                    aria-label="القائمة"
                    onClick={() => setIsOpen(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200 flex flex-col h-screen shadow-sm transition-transform duration-300 md:sticky md:top-0 md:translate-x-0 pt-16 md:pt-0",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Close Button Mobile */}
                <button aria-label="إغلاق القائمة" onClick={() => setIsOpen(false)} className="md:hidden absolute top-4 left-4 p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Logo Desktop */}
                <div className="hidden md:block p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow shadow-blue-200">
                            <span className="text-lg">📊</span>
                        </div>
                        <div>
                            <p className="text-gray-800 font-bold text-sm leading-tight">نظام الموازنات</p>
                            <p className="text-gray-400 text-xs">تحليل المشاريع</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                                pathname === item.href
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                            )}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                    >
                        <span>🚪</span>
                        تسجيل الخروج
                    </button>
                </div>
            </aside>
        </>
    )
}
