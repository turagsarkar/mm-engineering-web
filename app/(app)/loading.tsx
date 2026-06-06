export default function Loading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* TopBar skeleton */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="h-10 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 last:border-0">
              <div className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
