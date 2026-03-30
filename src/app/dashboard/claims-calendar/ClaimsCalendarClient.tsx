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
            const toUpdateIds: { id: string, newStatus: string }[] = []

            const updatedData = data.map(claim => {
                if (claim.status === 'Paid') return claim
                
                const dueParts = claim.due_date.split('-');
                const todayParts = today.split('-');
                const d1 = new Date(Date.UTC(Number(dueParts[0]), Number(dueParts[1])-1, Number(dueParts[2])));
                const d2 = new Date(Date.UTC(Number(todayParts[0]), Number(todayParts[1])-1, Number(todayParts[2])));
                const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
                
                let newStatus = claim.status;
                if (diffDays >= 0 && diffDays <= 5) {
                    newStatus = 'Due';
                } else if (diffDays > 5) {
                    newStatus = 'Overdue';
                } else if (diffDays < 0 && (claim.status === 'Overdue' || claim.status === 'Due')) {
                    newStatus = (claim.paid_amount || 0) > 0 ? 'PartiallyPaid' : 'Pending';
                }

                if (newStatus !== claim.status) {
                    toUpdateIds.push({ id: claim.id, newStatus })
                    return { ...claim, status: newStatus as any }
                }
                
                return claim
            })

            setClaims(updatedData as ProjectClaim[])

            // Background persist
            if (toUpdateIds.length > 0) {
                const statusGroups = toUpdateIds.reduce((acc, curr) => {
                    if (!acc[curr.newStatus]) acc[curr.newStatus] = [];
                    acc[curr.newStatus].push(curr.id);
                    return acc;
                }, {} as Record<string, string[]>);

                const promises = Object.entries(statusGroups).map(([status, ids]) => 
                    supabase.from('project_claims').update({ status }).in('id', ids)
                );
                Promise.all(promises).catch(err => console.error("Auto-sync claims error:", err))
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
            case 'Due': return '#F97316' // orange-500
            case 'PartiallyPaid': return '#059669' // emerald-600
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
                        <div className="flex flex-wrap items-center gap-4 mb-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10B981]"></div> مدفوعة</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#059669]"></div> جزئياً</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div> مفوترة</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#A855F7]"></div> مرسلة</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#F97316]"></div> مستحقة</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div> قيد الانتظار</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#6B7280]"></div> لم تحن</div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#EF4444]"></div> متأخرة</div>
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
