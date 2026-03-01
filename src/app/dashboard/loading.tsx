export default function Loading() {
    return (
        <div className="p-8 space-y-8" dir="rtl">
            <div className="space-y-2 mb-8">
                <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 rounded-lg animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-28 animate-pulse">
                        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
                        <div className="h-8 w-24 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 w-full bg-gray-100 rounded-lg" />
                ))}
            </div>
        </div>
    )
}
