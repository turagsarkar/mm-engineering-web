'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Flag, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useUser } from '@/lib/hooks/useUser'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AddPriorityTaskModal } from './AddPriorityTaskModal'
import type { PriorityTask } from '@/lib/types/database'

interface TaskWithBrand extends PriorityTask {
  brands: { name: string; slug: string } | null
}

// Tasks stay open until an admin closes them. Work submitted under a
// priority brand (new suppliers / price comparisons) goes through the
// admin approval queue; the task itself is only closed by an admin,
// optionally awarding 3 points to the user who did the work.
export function PriorityTasksList() {
  const { isAdmin } = useUser()
  const { toast } = useToast()
  const [tasks, setTasks] = useState<TaskWithBrand[]>([])
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string }[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState<TaskWithBrand | null>(null)
  const [closeTask, setCloseTask] = useState<TaskWithBrand | null>(null)
  const [awardUser, setAwardUser] = useState('')
  const [closing, setClosing] = useState(false)
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

  useEffect(() => {
    if (!isAdmin) return
    createClient().from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name')
      .then(({ data }) => setProfiles(data || []))
  }, [isAdmin])

  async function submitClose(e: React.FormEvent) {
    e.preventDefault()
    if (!closeTask) return
    setClosing(true)
    const res = await fetch('/api/tasks/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: closeTask.id, action: 'close', award_user_id: awardUser || null }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast(json.error || 'Failed to close task', 'error')
    } else {
      toast(awardUser ? 'Task closed — 3 points awarded' : 'Task closed', 'success')
      setCloseTask(null); setAwardUser('')
      load()
    }
    setClosing(false)
  }

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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Flag className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900">Priority Tasks</h3>
        <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
          {tasks.length} open
        </span>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Add task (admin only)">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No open priority tasks</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 px-4 py-3">
              <Flag className={`h-4 w-4 mt-0.5 shrink-0 ${priorityColor[task.priority] || 'text-gray-400'}`} />
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
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setCloseTask(task); setAwardUser('') }}
                    className="p-1 text-gray-300 hover:text-green-600 transition-colors"
                    title="Close task (fully complete)"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
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
                      title="Remove task (no points)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AddPriorityTaskModal
        open={showAdd || !!editTask}
        onClose={() => { setShowAdd(false); setEditTask(null) }}
        onCreated={load}
        task={editTask}
      />

      {/* Close task modal — task only completes when admin says so */}
      <Modal open={!!closeTask} onClose={() => setCloseTask(null)} title="Close priority task" size="sm">
        <form onSubmit={submitClose} className="space-y-4">
          <p className="text-sm text-gray-600">
            Close <strong>{closeTask?.message}</strong>? This marks the task fully complete and removes it from the list.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Award 3 points to (optional)</label>
            <select
              value={awardUser}
              onChange={e => setAwardUser(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No points awarded</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={closing}>Close task</Button>
            <Button type="button" variant="secondary" onClick={() => setCloseTask(null)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
