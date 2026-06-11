'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Flag, Plus, Pencil, Trash2, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { AddPriorityTaskModal } from './AddPriorityTaskModal'
import type { PriorityTask } from '@/lib/types/database'

interface TaskWithBrand extends PriorityTask {
  brands: { name: string; slug: string } | null
}

// Task lifecycle:
//   active   = is_active true, completed_at null
//   pending  = is_active true, completed_at set  -> waiting for admin approval (3 pts on approve)
//   done     = is_active false (hidden)
export function PriorityTasksList() {
  const { isAdmin, user } = useUser()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<TaskWithBrand[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState<TaskWithBrand | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

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

  // Member (or admin) marks a task complete -> goes to pending approval
  async function requestComplete(task: TaskWithBrand) {
    const supabase = createClient()
    const { error } = await supabase
      .from('priority_tasks')
      .update({ completed_by: user?.id, completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Sent to admin for approval (3 pts on approval)', 'success')
    load()
  }

  async function decide(task: TaskWithBrand, action: 'approve' | 'reject') {
    const res = await fetch('/api/tasks/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task.id, action }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed', 'error')
      return
    }
    toast(action === 'approve' ? 'Approved — 3 points awarded' : 'Rejected — task is active again', 'success')
    load()
  }

  // Admin removes a task without awarding points
  async function removeTask(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('priority_tasks')
      .update({ is_active: false, completed_by: null, completed_at: null })
      .eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setConfirmRemove(null)
    toast('Task removed', 'success')
    load()
  }

  const priorityColor: Record<string, string> = {
    urgent: 'text-red-600',
    high: 'text-orange-600',
    normal: 'text-gray-600',
    low: 'text-gray-400',
  }

  const pendingCount = tasks.filter(t => t.completed_at).length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Flag className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900">Priority Tasks</h3>
        <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
          {tasks.length} active
        </span>
        {isAdmin && pendingCount > 0 && (
          <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
            {pendingCount} to approve
          </span>
        )}
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Add task (admin only)">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No active priority tasks</p>
        ) : (
          tasks.map(task => {
            const pending = !!task.completed_at
            return (
              <div key={task.id} className={`flex items-start gap-3 px-4 py-3 ${pending ? 'bg-purple-50/50' : ''}`}>
                {!pending && (
                  <button
                    onClick={() => requestComplete(task)}
                    className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0"
                    title="Mark complete — sent to admin for approval (3 pts)"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                )}
                {pending && (
                  <Clock className="h-4 w-4 mt-0.5 text-purple-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  {task.brands && (
                    <p className="text-xs font-medium text-blue-600 mb-0.5">{task.brands.name}</p>
                  )}
                  <p className="text-sm text-gray-900">{task.message}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-gray-400">{formatDate(task.set_at)}</p>
                    {task.priority !== 'normal' && (
                      <span className={`text-xs font-medium capitalize ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                    )}
                    {pending && (
                      <span className="text-xs font-medium text-purple-600">Pending admin approval</span>
                    )}
                  </div>
                  {/* Admin approval controls */}
                  {pending && isAdmin && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => decide(task, 'approve')}
                        className="text-xs font-medium px-2.5 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      >
                        Approve (+3 pts)
                      </button>
                      <button
                        onClick={() => decide(task, 'reject')}
                        className="text-xs font-medium px-2.5 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {/* Admin edit / remove */}
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditTask(task)}
                      className="p-1 text-gray-300 hover:text-blue-600 transition-colors"
                      title="Edit task"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmRemove === task.id ? (
                      <button
                        onClick={() => removeTask(task.id)}
                        className="text-xs font-medium text-white bg-red-600 px-2 py-0.5 rounded hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(task.id)}
                        className="p-1 text-gray-300 hover:text-red-600 transition-colors"
                        title="Remove task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <AddPriorityTaskModal
        open={showAdd || !!editTask}
        onClose={() => { setShowAdd(false); setEditTask(null) }}
        onCreated={load}
        task={editTask}
      />
    </div>
  )
}
