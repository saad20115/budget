-- =====================================================
-- نظام صلاحيات المستخدمين
-- شغّل هذا في Supabase Dashboard → SQL Editor
-- =====================================================
-- 1. إنشاء جدول الأدوار
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email text,
    role text DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);
-- 2. تمكين RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- 3. سياسات user_roles
-- كل مستخدم يرى دوره هو
CREATE POLICY "users_read_own_role" ON public.user_roles FOR
SELECT USING (user_id = auth.uid());
-- Admin يرى ويعدل أدوار الجميع
CREATE POLICY "admin_manage_all_roles" ON public.user_roles FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles r
        WHERE r.user_id = auth.uid()
            AND r.role = 'admin'
    )
);
-- 4. السياسات: جميع المستخدمين يقرؤون كل البيانات
-- جدول projects
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "authenticated_read_projects" ON public.projects FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write_projects" ON public.projects FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );
CREATE POLICY "admin_update_projects" ON public.projects FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.user_roles
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );
CREATE POLICY "admin_delete_projects" ON public.projects FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- جدول project_staffing
DROP POLICY IF EXISTS "Users can manage own project staffing" ON public.project_staffing;
ALTER TABLE public.project_staffing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_staffing" ON public.project_staffing FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write_staffing" ON public.project_staffing FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- جدول project_expenses
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_expenses" ON public.project_expenses FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write_expenses" ON public.project_expenses FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- جدول actual_expenses
ALTER TABLE public.actual_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_actual" ON public.actual_expenses FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write_actual" ON public.actual_expenses FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- جدول project_claims
ALTER TABLE public.project_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_claims" ON public.project_claims FOR
SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "admin_write_claims" ON public.project_claims FOR ALL USING (
    EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
            AND role = 'admin'
    )
);
-- 5. تسجيل المستخدم الأول كـ admin تلقائياً
-- استبدل  'YOUR_USER_ID' بمعرف حسابك من: Supabase → Authentication → Users
-- INSERT INTO public.user_roles (user_id, email, role)
-- VALUES ('YOUR_USER_ID', 'your@email.com', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
-- 6. Trigger: إنشاء دور viewer تلقائياً عند تسجيل مستخدم جديد
CREATE OR REPLACE FUNCTION public.handle_new_user_role() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN
INSERT INTO public.user_roles (user_id, email, role)
VALUES (NEW.id, NEW.email, 'viewer') ON CONFLICT (user_id) DO NOTHING;
RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();