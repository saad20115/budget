import CacheReportClient from './CacheReportClient'

export const metadata = {
    title: 'تقرير بيانات المزامنة | الميزانية',
    description: 'Staging area for reviewing synced expenses from Odoo.',
}

export default function ReportPage() {
    return <CacheReportClient />
}
