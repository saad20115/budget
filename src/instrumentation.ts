/**
 * Next.js Instrumentation — runs once on server startup.
 * Sets up a recurring timer to auto-sync Odoo connections every N hours.
 */
export async function register() {
    // Only run on the Node.js server (not in Edge runtime)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

        // Small delay to let the server fully start
        setTimeout(() => {
            console.log('[Odoo Auto-Sync] Scheduler started — syncing every 4 hours')

            // Run first sync after 30 seconds (let connections load)
            setTimeout(async () => {
                await triggerSync()
            }, 30_000)

            // Then repeat every 4 hours
            setInterval(async () => {
                await triggerSync()
            }, SYNC_INTERVAL_MS)
        }, 5_000)
    }
}

async function triggerSync() {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3050}`
        console.log(`[Odoo Auto-Sync] Triggering sync at ${new Date().toISOString()}...`)

        const response = await fetch(`${baseUrl}/api/odoo-sync/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        })

        const data = await response.json()
        console.log(`[Odoo Auto-Sync] Result: ${data.message || JSON.stringify(data)}`)
    } catch (error) {
        console.error('[Odoo Auto-Sync] Failed to trigger sync:', error)
    }
}
