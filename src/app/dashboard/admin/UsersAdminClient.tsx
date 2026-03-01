'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserRole {
    id: string
    user_id: string
    email: string
    role: 'admin' | 'viewer'
    created_at: string
}

interface Props {
    users: UserRole[]
    currentUserId: string
    currentUserEmail: string
    setupRequired?: boolean
    setupError?: string
}

const SQL_SETUP = `-- 1. أنشئ جدول الأدوار
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email      text,
  role       text DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. سياسات القراءة
CREATE POLICY "users_read_own_role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_manage_all_roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles r
            WHERE r.user_id = auth.uid() AND r.role = 'admin')
  );

-- 3. سجّل نفسك كـ admin (تم تعبئة بياناتك تلقائياً)
INSERT INTO public.user_roles (user_id, email, role)
VALUES ('YOUR_USER_ID', 'YOUR_EMAIL', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 4. استيراد كل المستخدمين الموجودين بالفعل (viewer بشكل افتراضي)
INSERT INTO public.user_roles (user_id, email, role)
SELECT id, email, 'viewer'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- بعد التشغيل: ارجع لصفحة الإدارة وغيّر دور أي مستخدم كما تشاء

-- 4. Trigger للمستخدمين الجدد
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();`


const ROLE_CONFIG = {
    admin: { label: 'مدير', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    viewer: { label: 'مشاهد', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
}

export default function UsersAdminClient({ users: initialUsers, currentUserId, currentUserEmail, setupRequired, setupError }: Props) {
    const [users, setUsers] = useState<UserRole[]>(initialUsers)
    const [loading, setLoading] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [copied, setCopied] = useState(false)
    const supabase = createClient()

    // Replace placeholders in SQL with actual values
    const finalSql = SQL_SETUP
        .replace('YOUR_USER_ID', currentUserId)
        .replace('YOUR_EMAIL', currentUserEmail)

    function copySql() {
        navigator.clipboard.writeText(finalSql)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // ── Setup screen ──────────────────────────────────────────────────────────
    if (setupRequired) {
        return (
            <div className="p-4 md:p-8 space-y-6" dir="rtl">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">إعداد نظام الصلاحيات</h1>
                    <p className="text-gray-500 mt-1 text-sm">يجب تشغيل هذا الـ SQL في Supabase مرة واحدة فقط لتفعيل النظام</p>
                </div>

                {setupError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                        <span className="font-semibold">⚠️ الخطأ:</span> {setupError}
                    </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-2">
                    <p className="font-bold text-amber-800">📋 خطوات الإعداد:</p>
                    <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                        <li>اذهب إلى <strong>Supabase Dashboard → SQL Editor</strong></li>
                        <li>انسخ الكود أدناه (تم تعبئة بياناتك تلقائياً)</li>
                        <li>الصقه في المحرر واضغط <strong>Run</strong></li>
                        <li>ارجع لهذه الصفحة — ستعمل مباشرة</li>
                    </ol>
                </div>

                <div className="relative">
                    <div className="absolute top-3 left-3 flex gap-2">
                        <button
                            onClick={copySql}
                            className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition-all"
                        >
                            {copied ? '✅ تم النسخ!' : '📋 نسخ'}
                        </button>
                    </div>
                    <pre className="bg-gray-900 text-green-400 text-xs p-4 pt-10 rounded-2xl overflow-x-auto leading-relaxed whitespace-pre-wrap">{finalSql}</pre>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                    <strong>ملاحظة:</strong> بياناتك (User ID والإيميل) تم تعبئتها تلقائياً في السطر 43-44. لا تحتاج لتعديل شيء.
                </div>
            </div>
        )
    }

    async function toggleRole(user: UserRole) {
        if (user.user_id === currentUserId) return // لا تغيير دور نفسك
        const newRole = user.role === 'admin' ? 'viewer' : 'admin'
        setLoading(user.user_id)
        setMessage(null)

        const { error } = await supabase
            .from('user_roles')
            .update({ role: newRole })
            .eq('user_id', user.user_id)

        if (error) {
            setMessage({ type: 'error', text: 'فشل تغيير الدور: ' + error.message })
        } else {
            setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, role: newRole } : u))
            setMessage({ type: 'success', text: `✅ تم تغيير دور ${user.email} إلى "${ROLE_CONFIG[newRole].label}"` })
        }
        setLoading(null)
    }

    const adminCount = users.filter(u => u.role === 'admin').length
    const viewerCount = users.filter(u => u.role === 'viewer').length

    return (
        <div className="p-4 md:p-8 space-y-6" dir="rtl">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">إدارة المستخدمين</h1>
                <p className="text-gray-500 mt-1 text-sm">تحكم في صلاحيات الوصول لكل مستخدم مسجل في النظام</p>
            </div>

            {/* Banner */}
            {message && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
                    <p className="text-3xl font-bold text-gray-900">{users.length}</p>
                    <p className="text-gray-500 text-sm mt-1">إجمالي المستخدمين</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
                    <p className="text-3xl font-bold text-blue-600">{adminCount}</p>
                    <p className="text-gray-500 text-sm mt-1">مدراء</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-center">
                    <p className="text-3xl font-bold text-gray-400">{viewerCount}</p>
                    <p className="text-gray-500 text-sm mt-1">مشاهدون</p>
                </div>
            </div>

            {/* Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <span className="font-semibold">📌 ملاحظة:</span> المدير يمكنه إضافة وتعديل وحذف البيانات. المشاهد يعرض البيانات فقط بدون تعديل.
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                            <th className="text-right px-5 py-4 font-semibold text-gray-700">المستخدم</th>
                            <th className="text-center px-4 py-4 font-semibold text-gray-700">الدور الحالي</th>
                            <th className="text-center px-4 py-4 font-semibold text-gray-700">تاريخ الانضمام</th>
                            <th className="text-center px-4 py-4 font-semibold text-gray-700">الإجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="text-center py-12 text-gray-400">
                                    <span className="text-4xl block mb-2">👥</span>
                                    لا يوجد مستخدمون مسجلون في جدول الأدوار بعد
                                </td>
                            </tr>
                        ) : users.map(user => {
                            const cfg = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.viewer
                            const isMe = user.user_id === currentUserId
                            const joinDate = new Date(user.created_at).toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })

                            return (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                {(user.email?.[0] ?? '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{user.email ?? 'غير معروف'}</p>
                                                {isMe && <span className="text-xs text-blue-600 font-medium">أنت</span>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                            {cfg.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center text-gray-500 text-xs">{joinDate}</td>
                                    <td className="px-4 py-4 text-center">
                                        {isMe ? (
                                            <span className="text-xs text-gray-300">لا يمكن تعديل دورك</span>
                                        ) : (
                                            <button
                                                onClick={() => toggleRole(user)}
                                                disabled={loading === user.user_id}
                                                className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-all disabled:opacity-50 ${user.role === 'admin'
                                                    ? 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                                    }`}
                                            >
                                                {loading === user.user_id ? '⏳' : user.role === 'admin' ? 'تحويل إلى مشاهد' : 'تحويل إلى مدير'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Help */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
                <p className="font-semibold">💡 لإضافة مستخدم جديد:</p>
                <p>اطلب منه التسجيل من صفحة تسجيل الدخول — سيظهر هنا تلقائياً بدور «مشاهد» ويمكنك ترقيته.</p>
            </div>
        </div>
    )
}
