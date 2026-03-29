'use client'

import { useState, useEffect } from 'react'
import { Project, ProjectClaim } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import './calendar.css'

interface ClaimsCalendarClientProps {
    initialProjects: Project[]
}

export default function ClaimsCalendarClient({ initialProjects }: ClaimsCalendarClientProps) {
    const [claims, setClaims] = useState<ProjectClaim[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (initialProjects.length > 0) {
            fetchClaims()
        } else {
            setIsLoading(false)
        }
    }, [initialProjects])

    const fetchClaims = async () => {
        try {
            setIsLoading(true)
            const projectIds = initialProjects.map(p => p.id)
            if (projectIds.length === 0) return

            const { data, error } = await supabase
                .from('project_claims')
                .select('*')
                .in('project_id', projectIds)

            if (error) throw error

            // Update statuses to Overdue if due_date passed and not paid
            const today = new Date().toISOString().split('T')[0]
            const toUpdateIds: { id: string, status: string }[] = []

            const updatedData = data.map(claim => {
                if (!['Paid', 'PartiallyPaid', 'Overdue'].includes(claim.status) && claim.due_date < today) {
                    toUpdateIds.push({ id: claim.id, status: 'Overdue' })
                    return { ...claim, status: 'Overdue' as const }
                }
                if (claim.status === 'Overdue' && claim.due_date >= today) {
                    toUpdateIds.push({ id: claim.id, status: 'Pending' })
                    return { ...claim, status: 'Pending' as const }
                }
                return claim
            })

            setClaims(updatedData as ProjectClaim[])

            // Background persist
            if (toUpdateIds.length > 0) {
                const overdues = toUpdateIds.filter(u => u.status === 'Overdue').map(u => u.id)
                const pendings = toUpdateIds.filter(u => u.status === 'Pending').map(u => u.id)
                
                Promise.all([
                    overdues.length > 0 ? supabase.from('project_claims').update({ status: 'Overdue' }).in('id', overdues) : Promise.resolve(),
                    pendings.length > 0 ? supabase.from('project_claims').update({ status: 'Pending' }).in('id', pendings) : Promise.resolve()
                ]).catch(err => console.error("Auto-sync claims error:", err))
            }
        } catch (error: any) {
            console.error('Error fetching claims:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getEventColor = (status: string) => {
        switch (status) {
            case 'Paid': return '#10B981' // emerald-500
            case 'Pending': return '#F59E0B' // amber-500
            case 'Invoiced': return '#3B82F6' // blue-500
            case 'Overdue': return '#EF4444' // red-500
            case 'Sent': return '#A855F7' // purple-500
            case 'NotYetDue': return '#6B7280' // gray-500
            default: return '#6B7280' // gray-500
        }
    }

    const events = claims.map(claim => {
        const projectName = initialProjects.find(p => p.id === claim.project_id)?.name || 'مشروع غير معروف'
        return {
            id: claim.id,
            title: `${projectName} - ${claim.amount.toLocaleString('en-US')} ر.س`,
            date: claim.due_date,
            backgroundColor: getEventColor(claim.status),
            borderColor: getEventColor(claim.status),
            extendedProps: {
                claimTitle: claim.title,
                status: claim.status,
                projectName
            }
        }
    })

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="flex flex-col flex-1 min-h-0 min-w-[800px]">
                    <div className="mb-4 flex gap-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100 flex-wrap">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> مدفوع</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> مفوتر</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> مرسل</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> قيد الانتظار</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-500"></div> لم تستحق</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div> متأخر</div>
                    </div>

                    <FullCalendar
                        plugins={[dayGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        events={events}
                        locale="ar"
                        direction="rtl"
                        headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'dayGridMonth,dayGridWeek'
                        }}
                        buttonText={{
                            today: 'اليوم',
                            month: 'شهر',
                            week: 'أسبوع'
                        }}
                        height="100%"
                        eventContent={(eventInfo) => {
                            return (
                                <div className="p-1 overflow-hidden text-xs truncate" title={`${eventInfo.event.extendedProps.projectName}\n${eventInfo.event.extendedProps.claimTitle}\n${eventInfo.event.title}`}>
                                    <b>{eventInfo.event.title}</b>
                                    <div className="opacity-80 text-[10px] truncate">{eventInfo.event.extendedProps.claimTitle}</div>
                                </div>
                            )
                        }}
                    />
                </div>
            )}
        </div>
    )
}
