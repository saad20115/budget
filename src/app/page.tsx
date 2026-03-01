import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, BarChart3, PieChart, ShieldCheck, Zap, Bot } from 'lucide-react'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg">
              <PieChart className="w-6 h-6 text-primary" />
            </div>
            <span className="font-bold text-xl tracking-tight">نظام الموازنات</span>
          </div>
          <nav>
            {user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25"
              >
                لوحة التحكم
                <ArrowLeft className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25"
              >
                تسجيل الدخول
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32">
          {/* Background Decorations */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-chart-1/5 rounded-full blur-3xl -z-10" />

          <div className="container mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8 border border-primary/20 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-sm font-medium">الجيل الجديد من إدارة موازنات المشاريع</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-foreground mb-8 leading-[1.2] md:leading-[1.15] tracking-tight max-w-4xl mx-auto">
              تحكم في <span className="text-transparent bg-clip-text bg-gradient-to-l from-primary to-chart-1">موازنات مشاريعك</span> بذكاء وسهولة
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              منصة متكاملة تتيح لك تتبع المصروفات، تحليل الميزانيات، واتخاذ قرارات مالية دقيقة مدعومة بالذكاء الاصطناعي في الوقت الفعلي.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard" : "/login"}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-base font-semibold bg-primary text-primary-foreground px-8 py-4 rounded-full hover:bg-primary/90 transition-all shadow-xl hover:shadow-primary/30 hover:-translate-y-1"
              >
                {user ? "الذهاب إلى لوحة التحكم" : "ابدأ تجربتك مجاناً"}
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>

            {/* Dashboard Preview / Mockup shape */}
            <div className="mt-20 mx-auto max-w-5xl rounded-t-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 md:p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
              <div className="rounded-xl border border-border/50 bg-background shadow-sm overflow-hidden flex flex-col h-[300px] md:h-[500px] relative">
                {/* Mockup Header */}
                <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/20">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                {/* Mockup Body Content - Abstract */}
                <div className="flex-1 p-6 flex flex-col gap-6 opacity-60">
                  <div className="flex gap-4">
                    <div className="w-1/4 h-24 rounded-lg bg-primary/10 animate-pulse" />
                    <div className="w-1/4 h-24 rounded-lg bg-blue-500/10 animate-pulse delay-75" />
                    <div className="w-1/4 h-24 rounded-lg bg-purple-500/10 animate-pulse delay-150" />
                    <div className="w-1/4 h-24 rounded-lg bg-emerald-500/10 animate-pulse delay-200" />
                  </div>
                  <div className="flex-1 flex gap-4">
                    <div className="w-2/3 h-full rounded-lg bg-muted/40" />
                    <div className="w-1/3 h-full rounded-lg bg-muted/40" />
                  </div>
                </div>
                {/* Fade out bottom gradient */}
                <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">كل ما تحتاجه لإدارة مالية ناجحة</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                وفرنا لك أحدث الأدوات التقنية لتوفير الوقت والجهد في إدارة حسابات مشاريعك.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <div key={index} className="group p-8 rounded-3xl bg-card border border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${feature.color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5 -z-10" />
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <h2 className="text-4xl font-bold mb-6">هل أنت مستعد لتغيير طريقة إدارتك للموازنات؟</h2>
            <p className="text-xl text-muted-foreground mb-10">
              انضم إلينا الآن وابدأ في تحسين الكفاءة المالية لمشاريعك بخطوات بسيطة.
            </p>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="inline-flex items-center justify-center gap-2 text-lg font-semibold bg-primary text-primary-foreground px-10 py-5 rounded-full hover:bg-primary/90 transition-all shadow-xl hover:shadow-primary/30 hover:-translate-y-1"
            >
              {user ? "متابعة أعمالك" : "سجل مجاناً وانطلق"}
              <ArrowLeft className="w-6 h-6" />
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border/50 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-90">
            <PieChart className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl">نظام الموازنات</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} كافة الحقوق محفوظة لحلّنا التقني الذكي.
          </p>
        </div>
      </footer>
    </div>
  )
}

const features = [
  {
    title: "تتبع دقيق للمصروفات",
    description: "راقب كل مصروفات مشاريعك لحظة بلحظة مع تصنيفات مفصلة وتنبيهات عند تجاوز الميزانية المحددة.",
    icon: <BarChart3 className="w-7 h-7" />,
    color: "from-blue-500 to-cyan-400"
  },
  {
    title: "مساعد ذكي AI",
    description: "احصل على تحليلات وتوصيات مالية متقدمة من مساعد الذكاء الاصطناعي الخاص بنا لمساعدتك على توفير التكاليف.",
    icon: <Bot className="w-7 h-7" />,
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "تقارير وتقييم شامل",
    description: "صدّر تقاريرك المالية بصيغ PDF و Excel بكل سهولة، أو شاركها مع فريق عملك بنقرة واحدة.",
    icon: <PieChart className="w-7 h-7" />,
    color: "from-emerald-500 to-teal-400"
  },
  {
    title: "أمان وموثوقية عالية",
    description: "بياناتك المالية محمية بأعلى معايير التشفير والأمان مع خوادم سحابية سريعة ومستقرة.",
    icon: <ShieldCheck className="w-7 h-7" />,
    color: "from-orange-500 to-amber-400"
  },
  {
    title: "مزامنة سحابية فورية",
    description: "الوصول إلى بياناتك من أي جهاز وفي أي وقت مع مزامنة سحابية فورية لجميع التغييرات التي تجريها.",
    icon: <Zap className="w-7 h-7" />,
    color: "from-red-500 to-rose-400"
  },
]
