import BudgetClient from "./BudgetClient"

export const metadata = {
    title: 'الموازنة الشاملة | نظام تحليل المشاريع',
    description: 'إدارة بنود الموازنة لجميع المشاريع',
}

export default async function BudgetPage() {
    return <BudgetClient />
}
