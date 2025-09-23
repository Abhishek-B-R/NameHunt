import { Card } from "@/components/ui/card"

export function ProviderSkeleton() {
  return (
    <Card className="glass-card p-4 sm:p-6 animate-fade-in-up">
      <div className="animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-lg relative animate-shimmer">
            <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-gray-600 rounded-full"></div>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="h-4 sm:h-5 bg-gray-700 rounded w-20 sm:w-24"></div>
            <div className="h-3 bg-gray-800 rounded w-24 sm:w-32"></div>
          </div>
          <div className="w-5 h-5 bg-gray-700 rounded-full"></div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 sm:h-4 bg-gray-800 rounded w-12 sm:w-16"></div>
            <div className="h-5 sm:h-6 bg-gray-700 rounded-full w-16 sm:w-20"></div>
          </div>

          <div className="glass-card rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-800 rounded w-16 sm:w-20"></div>
              <div className="h-4 bg-gray-700 rounded w-12 sm:w-16"></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 bg-gray-800 rounded w-12 sm:w-16"></div>
              <div className="h-4 bg-gray-700 rounded w-10 sm:w-14"></div>
            </div>
          </div>

          <div className="h-8 sm:h-10 bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    </Card>
  )
}
