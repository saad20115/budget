export default function Loading() {
    return (
        <div className="p-8 space-y-8" dir="rtl">
            <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse mb-4" />

            <div className="flex justify-between items-center mb-8">
                <div className="space-y-2">
                    <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
                    <div className="h-4 w-48 bg-gray-200 rounded-lg animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded-full animate-pulse" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm h-20 animate-pulse">
                        <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                        <div className="h-6 w-16 bg-gray-200 rounded" />
                    </div>
                ))}
            </div>

            <div className="h-10 w-full max-w-md bg-gray-200 rounded-lg animate-pulse mb-6" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-80 animate-pulse" />
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-80 animate-pulse" />
            </div>
        </div>
    )
}
