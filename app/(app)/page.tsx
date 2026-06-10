import { TopBar } from '@/components/layout/TopBar'
import { ActivityPanel } from '@/components/home/ActivityPanel'
import { Leaderboard } from '@/components/home/Leaderboard'
import { PriorityTasksList } from '@/components/home/PriorityTasksList'

export default function HomePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Home" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <PriorityTasksList />
          </div>
          <div className="lg:col-span-1">
            <ActivityPanel />
          </div>
          <div className="lg:col-span-1">
            <Leaderboard />
          </div>
        </div>
      </div>
    </div>
  )
}
