'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Flag, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useUser } from '@/lib/hooks/useUser'
import { AddPriorityTaskModal } from './AddPriorityTaskModal'
import type { PriorityTask } from '@/lib/types/database'

interface TaskWithBrand extends PriorityTask {
  brands: { name: string; slug: string } | null
}

export function PriorityTasksList() {
  const { isAdmin, user } = useUser()
  const [tasks, setTasks] = useState<TaskWithBrand[]>([])
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('priority_tasks')
      .select('*, brands(name, slug)')
      .eq('is_active', true)
      .order('set_at', { ascending: false })
    setTasks((data as TaskWithBrand[]) || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function complete(id: string) {
    const supabase = createClient()
    await supabase
      .from('priority_tasks')
      .update({ is_active: false, completed_at: new Date().toISOString(), completed_by: user?.id })
      .eq('id', id)
    load()
  }

  const priorityColor: Record<string, string> = {
    urgent: 'text-red-600',
    high: 'text-orange-600',
    normal: 'text-gray-600',
    low: 'text-gray-400',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Flag className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900">Priority Tasks</h3>
        <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
          {tasks.length} active
        </span>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Add task">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No active priority tasks</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3">
              {isAdmin && (
                <button
                  onClick={() => complete(task.id)}
                  className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0"
                  title="Mark complete"
                >
                  <CheckSquare className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                {task.brands && (
                  <p className="text-xs font-medium text-blue-600 mb-0.5">{task.brands.name}</p>
                )}
                <p className="text-sm text-gray-900">{task.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-400">{formatDate(task.set_at)}</p>
                  {task.priority !== 'normal' && (
                    <span className={`text-xs font-medium capitalize ${priorityColor[task.priority]}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <AddPriorityTaskModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />
    </div>
  )
}
