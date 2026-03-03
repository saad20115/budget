// Import actual expenses for Hajj projects - until end of Feb 2026
// Run from: d:\budget\budget-tracker
// Command: node scripts\import_hajj_actuals.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mbgkjhlrfhlnzzsrxpjz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZ2tqaGxyZmhsbnp6c3J4cGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDM2NDAsImV4cCI6MjA4NzY3OTY0MH0.HMu63kwlbdXHB4i8W63FiU490Um5HGgnex5rqY7dlj4'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const EXPENSE_DATE = '2026-02-28'
const NOTES = 'استيراد مصاريف فعلية حتى نهاية فبراير 2026'

// Raw rows (44 entries, some names duplicated = different months)
const rawExpenses = [
    { name: 'مصروف تذاكر سفر وانتقالات', amount: 3800 },
    { name: 'مصروفات متنوعة', amount: 707.05 },
    { name: 'مصروف الاشتراكات', amount: 1745.32 },
    { name: 'رسوم مكتب عمل تشغيلي', amount: 4850 },
    { name: 'رسوم إصدار وتجديد إقامات إداري', amount: 325 },
    { name: 'مصروف تأمين طبي', amount: 1295 },
    { name: 'رواتب وأجور', amount: 391075 },
    { name: 'تأمينات اجتماعية', amount: 68705.67 },
    { name: 'مصروفات ورسوم حكومية', amount: 38931.95 },
    { name: 'أتعاب مهنية ومشتريات خارجية', amount: 40217.39 },
    { name: 'مصاريف ضيافة ووجبات', amount: 9185.68 },
    { name: 'مصروفات متنوعة', amount: 300 },
    { name: 'مصروف صيانة', amount: 305 },
    { name: 'مصروف الاشتراكات', amount: 32525.66 },
    { name: 'مكافآت وحوافز', amount: 12000 },
    { name: 'مصروف زيوت ومحروقات', amount: 200 },
    { name: 'عمولات بنكية', amount: 1096.86 },
    { name: 'مشتريات خارجية وخدمات استشارية', amount: 60000 },
    { name: 'مصروف سكن وفنادق', amount: 883 },
    { name: 'مصروف زي موحد', amount: 950 },
    { name: 'مصروفات متنوعة', amount: 3038 },
    { name: 'إيجار سيارات', amount: 6920 },
    { name: 'رواتب وأجور', amount: 89851 },
    { name: 'أدوات مكتبية ومطبوعات', amount: 11560.87 },
    { name: 'مصروفات ورسوم حكومية', amount: 11500 },
    { name: 'مصاريف ضيافة ووجبات', amount: 5780.16 },
    { name: 'مصروف تدريب', amount: 6478.63 },
    { name: 'مصروف صيانة', amount: 1086.96 },
    { name: 'مصروف المطبخ وبوفيه', amount: 333 },
    { name: 'مصروف نقل ومواصلات وإيجار سيارات', amount: 1800 },
    { name: 'مصروف زيوت ومحروقات', amount: 345 },
    { name: 'عمولات بنكية', amount: 1300 },
    { name: 'مصروف سكن وفنادق', amount: 6962 },
    { name: 'رسوم مكتب عمل تشغيلي', amount: 21850 },
    { name: 'رسوم إصدار وتجديد إقامات تشغيلي', amount: 2450 },
    { name: 'رواتب وأجور', amount: 39416.67 },
    { name: 'مصروفات ورسوم حكومية', amount: 3010 },
    { name: 'رسوم مكتب عمل تشغيلي', amount: 6375 },
    { name: 'رسوم إصدار وتجديد إقامات تشغيلي', amount: 487 },
    { name: 'رواتب وأجور', amount: 149270.84 },
    { name: 'مصروفات ورسوم حكومية', amount: 700 },
    { name: 'مصاريف ضيافة ووجبات', amount: 229.38 },
    { name: 'مكافآت وحوافز', amount: 1500 },
    { name: 'رسوم مكتب عمل تشغيلي', amount: 4250 },
]

// Aggregate by name
const aggMap = {}
for (const e of rawExpenses) {
    const n = e.name.trim()
    aggMap[n] = (aggMap[n] || 0) + e.amount
}
const expenses = Object.entries(aggMap).map(([name, amount]) => ({ name, amount }))

console.log(`\n📊 Aggregated ${rawExpenses.length} rows → ${expenses.length} unique items:`)
expenses.forEach(e => console.log(`  ${e.name}: ${e.amount.toLocaleString()} ر.س`))
const grandTotal = expenses.reduce((s, e) => s + e.amount, 0)
console.log(`\n  الإجمالي الكلي: ${grandTotal.toLocaleString()} ر.س`)

async function main() {
    // 1. Fetch Hajj projects
    const { data: projects, error: projErr } = await supabase
        .from('projects')
        .select('id, name, total_value')
        .eq('category', 'مشاريع الحج')

    if (projErr) { console.error('❌ Error:', projErr.message); process.exit(1) }
    if (!projects?.length) { console.error('❌ No Hajj projects found'); process.exit(1) }

    console.log(`\n✅ Found ${projects.length} Hajj projects:`)
    projects.forEach(p => console.log(`  ${p.name}: ${Number(p.total_value).toLocaleString()} ر.س`))

    const groupTotal = projects.reduce((s, p) => s + Number(p.total_value), 0)
    console.log(`\n  إجمالي قيم المجموعة: ${groupTotal.toLocaleString()} ر.س`)
    if (groupTotal <= 0) { console.error('❌ Total is 0'); process.exit(1) }

    const projectIds = projects.map(p => p.id)

    // 2. Fetch existing budget items
    const { data: existingItems } = await supabase
        .from('project_expenses')
        .select('id, name, project_id')
        .in('project_id', projectIds)

    // 3. Auto-create missing budget items (target_amount = 0)
    const toCreate = []
    for (const { name } of expenses) {
        for (const p of projects) {
            if (!existingItems?.find(ei => ei.project_id === p.id && ei.name.trim() === name)) {
                toCreate.push({ project_id: p.id, name, target_amount: 0 })
            }
        }
    }

    let allBudgetItems = [...(existingItems || [])]
    if (toCreate.length > 0) {
        console.log(`\n📝 Creating ${toCreate.length} missing budget items...`)
        const { data: created, error: ce } = await supabase
            .from('project_expenses').insert(toCreate).select('id, name, project_id')
        if (ce) { console.error('❌ Error creating budget items:', ce.message); process.exit(1) }
        allBudgetItems = [...allBudgetItems, ...(created || [])]
        console.log(`  ✅ Created ${created?.length} budget items`)
    }

    // 4. Build and insert actual expense records
    const inserts = []
    for (const { name, amount } of expenses) {
        for (const p of projects) {
            const share = Number(p.total_value) / groupTotal
            const proratedAmount = Math.round(amount * share * 100) / 100
            const matchingItem = allBudgetItems.find(bi => bi.project_id === p.id && bi.name.trim() === name)
            inserts.push({
                project_id: p.id,
                expense_id: matchingItem?.id || null,
                amount: proratedAmount,
                expense_date: EXPENSE_DATE,
                notes: NOTES,
            })
        }
    }

    console.log(`\n📥 Inserting ${inserts.length} records...`)
    const BATCH = 100
    let done = 0
    for (let i = 0; i < inserts.length; i += BATCH) {
        const { error: ie } = await supabase.from('actual_expenses').insert(inserts.slice(i, i + BATCH))
        if (ie) { console.error(`❌ Insert error:`, ie.message); process.exit(1) }
        done += Math.min(BATCH, inserts.length - i)
        process.stdout.write(`\r  Progress: ${done}/${inserts.length}`)
    }

    console.log(`\n\n✅ تم الاستيراد بنجاح!`)
    console.log(`  📌 ${expenses.length} بند مالي موزّع على ${projects.length} مشروع`)
    console.log(`  📌 ${inserts.length} سجل مُضاف إجمالاً`)
    console.log(`  📌 إجمالي المصاريف المُوزَّعة: ${grandTotal.toLocaleString()} ر.س`)
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1) })
