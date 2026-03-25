import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const targetUrl = searchParams.get('url')

        if (!targetUrl) {
            return NextResponse.json(
                { error: 'Missing "url" query parameter' },
                { status: 400 }
            )
        }

        const response = await fetch(targetUrl, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: `External API returned ${response.status}: ${response.statusText}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: unknown) {
        console.error('Error proxying external expenses:', error)
        const msg = error instanceof Error ? error.message : 'Failed to fetch external expenses'
        return NextResponse.json(
            { error: msg },
            { status: 500 }
        )
    }
}
