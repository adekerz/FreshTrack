/**
 * Task Planner Hooks - React Query integration
 *
 * Hooks for task boards, tasks, checklists, comments, activities
 * Follows the same pattern as useInventory.js
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../services/api'

// === QUERY KEYS ===

export const taskKeys = {
  all: ['tasks'],
  boards: (hotelId) => ['tasks', 'boards', hotelId],
  board: (boardId) => ['tasks', 'board', boardId],
  myTasks: (filters) => ['tasks', 'my-tasks', filters],
  task: (taskId) => ['tasks', 'task', taskId],
  comments: (taskId) => ['tasks', 'comments', taskId],
  activities: (taskId) => ['tasks', 'activities', taskId],
  boardActivities: (boardId) => ['tasks', 'board-activities', boardId],
  stats: (hotelId) => ['tasks', 'stats', hotelId],
}

// === BOARDS ===

export function useBoards(hotelId) {
  return useQuery({
    queryKey: taskKeys.boards(hotelId),
    queryFn: () => apiFetch('/tasks/boards').then((r) => r.boards ?? r),
    enabled: !!hotelId,
  })
}

export function useBoard(boardId) {
  return useQuery({
    queryKey: taskKeys.board(boardId),
    queryFn: () =>
      apiFetch(`/tasks/boards/${boardId}`).then((r) => r.board ?? r),
    enabled: !!boardId,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (boardData) =>
      apiFetch('/tasks/boards', {
        method: 'POST',
        body: JSON.stringify(boardData),
      }).then((r) => r.board ?? r),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'boards'] })
      // Optimistically set the new board in cache
      if (board?.id) {
        queryClient.setQueryData(taskKeys.board(board.id), board)
      }
    },
  })
}

export function useUpdateBoard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ boardId, updates }) =>
      apiFetch(`/tasks/boards/${boardId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.boards('current') })
      queryClient.invalidateQueries({
        queryKey: taskKeys.board(variables.boardId),
      })
    },
  })
}

export function useDeleteBoard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (boardId) =>
      apiFetch(`/tasks/boards/${boardId}`, { method: 'DELETE' }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'boards'] })
    },
  })
}

// === BUCKETS ===

export function useCreateBucket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ boardId, name, color }) =>
      apiFetch(`/tasks/boards/${boardId}/buckets`, {
        method: 'POST',
        body: JSON.stringify({ name, color }),
      }),
    onMutate: async ({ boardId, name, color }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
      const prev = queryClient.getQueryData(taskKeys.board(boardId))
      if (prev) {
        const optimistic = {
          id: `temp-${Date.now()}`,
          board_id: boardId,
          name,
          color: color ?? '#6366f1',
          position: 9999,
          tasks: [],
        }
        queryClient.setQueryData(taskKeys.board(boardId), {
          ...prev,
          buckets: [...(prev.buckets ?? []), optimistic],
        })
      }
      return { prev }
    },
    onError: (_err, { boardId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.board(boardId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.board(variables.boardId),
      })
    },
  })
}

export function useUpdateBucket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ bucketId, boardId: _boardId, updates }) =>
      apiFetch(`/tasks/buckets/${bucketId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.board(variables.boardId),
      })
    },
  })
}

export function useDeleteBucket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ bucketId, boardId: _boardId }) =>
      apiFetch(`/tasks/buckets/${bucketId}`, { method: 'DELETE' }),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.board(variables.boardId),
      })
    },
  })
}

// === TASKS ===

export function useMyTasks(filters = {}) {
  return useQuery({
    queryKey: taskKeys.myTasks(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v != null && v !== '') params.set(k, String(v))
      })
      const qs = params.toString()
      return apiFetch(`/tasks/my${qs ? '?' + qs : ''}`)
    },
  })
}

export function useTaskStats(hotelId) {
  return useQuery({
    queryKey: taskKeys.stats(hotelId),
    queryFn: () => apiFetch('/tasks/stats').then((r) => r.stats ?? r),
    enabled: !!hotelId,
  })
}

export function useTask(taskId) {
  return useQuery({
    queryKey: taskKeys.task(taskId),
    queryFn: () => apiFetch(`/tasks/${taskId}`).then((r) => r.task ?? r),
    enabled: !!taskId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskData) =>
      apiFetch('/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
      }),
    onMutate: async (taskData) => {
      const { board_id, bucket_id } = taskData
      await queryClient.cancelQueries({ queryKey: taskKeys.board(board_id) })
      const prev = queryClient.getQueryData(taskKeys.board(board_id))
      if (prev && bucket_id) {
        const optimistic = {
          id: `temp-${Date.now()}`,
          ...taskData,
          status: taskData.status ?? 'TODO',
          priority: taskData.priority ?? 'MEDIUM',
          checklist_total: 0,
          checklist_done: 0,
          assignees: [],
          created_at: new Date().toISOString(),
        }
        queryClient.setQueryData(taskKeys.board(board_id), {
          ...prev,
          buckets: prev.buckets?.map((b) =>
            b.id === bucket_id
              ? { ...b, tasks: [...(b.tasks ?? []), optimistic] }
              : b
          ),
        })
      }
      return { prev }
    },
    onError: (_err, variables, context) => {
      if (context?.prev)
        queryClient.setQueryData(
          taskKeys.board(variables.board_id),
          context.prev
        )
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.board(variables.board_id),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.myTasks({}) })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'stats'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, updates }) =>
      apiFetch(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onMutate: async ({ taskId, updates, boardId }) => {
      // Optimistically update single-task cache
      await queryClient.cancelQueries({ queryKey: taskKeys.task(taskId) })
      const prevTask = queryClient.getQueryData(taskKeys.task(taskId))
      if (prevTask) {
        queryClient.setQueryData(taskKeys.task(taskId), {
          ...prevTask,
          ...updates,
        })
      }

      // Optimistically update board cache so cards reflect changes immediately
      let prevBoard = null
      if (boardId) {
        await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
        prevBoard = queryClient.getQueryData(taskKeys.board(boardId))
        if (prevBoard?.buckets) {
          queryClient.setQueryData(taskKeys.board(boardId), {
            ...prevBoard,
            buckets: prevBoard.buckets.map((b) => ({
              ...b,
              tasks: (b.tasks ?? []).map((t) =>
                t.id === taskId ? { ...t, ...updates } : t
              ),
            })),
          })
        }
      }

      return { prevTask, prevBoard, boardId }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prevTask)
        queryClient.setQueryData(taskKeys.task(taskId), context.prevTask)
      if (context?.prevBoard && context?.boardId) {
        queryClient.setQueryData(
          taskKeys.board(context.boardId),
          context.prevBoard
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      if (variables.boardId) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.board(variables.boardId),
        })
      } else {
        queryClient.invalidateQueries({ queryKey: taskKeys.all })
      }
    },
  })
}

export function useMoveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, bucket_id, position }) =>
      apiFetch(`/tasks/${taskId}/move`, {
        method: 'POST',
        body: JSON.stringify({ target_bucket_id: bucket_id, position }),
      }),
    onMutate: async ({ taskId, bucket_id, boardId }) => {
      if (!boardId) return {}
      await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
      const prev = queryClient.getQueryData(taskKeys.board(boardId))
      if (prev?.buckets) {
        let movedTask = null
        const bucketsWithout = prev.buckets.map((b) => {
          const found = b.tasks?.find((t) => t.id === taskId)
          if (found) movedTask = found
          return { ...b, tasks: (b.tasks ?? []).filter((t) => t.id !== taskId) }
        })
        if (movedTask) {
          const updated = bucketsWithout.map((b) =>
            b.id === bucket_id
              ? {
                  ...b,
                  tasks: [...(b.tasks ?? []), { ...movedTask, bucket_id }],
                }
              : b
          )
          queryClient.setQueryData(taskKeys.board(boardId), {
            ...prev,
            buckets: updated,
          })
        }
      }
      return { prev }
    },
    onError: (_err, { boardId }, context) => {
      if (context?.prev && boardId)
        queryClient.setQueryData(taskKeys.board(boardId), context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId }) =>
      apiFetch(`/tasks/${taskId}`, { method: 'DELETE' }),
    onMutate: async ({ taskId, boardId }) => {
      if (!boardId) return {}
      await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
      const prev = queryClient.getQueryData(taskKeys.board(boardId))
      if (prev?.buckets) {
        queryClient.setQueryData(taskKeys.board(boardId), {
          ...prev,
          buckets: prev.buckets.map((b) => ({
            ...b,
            tasks: (b.tasks ?? []).filter((t) => t.id !== taskId),
          })),
        })
      }
      return { prev }
    },
    onError: (_err, { boardId }, context) => {
      if (context?.prev && boardId)
        queryClient.setQueryData(taskKeys.board(boardId), context.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

// === ASSIGNMENTS ===

export function useAssignTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, user_id }) =>
      apiFetch(`/tasks/${taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id }),
      }),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUnassignTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, userId }) =>
      apiFetch(`/tasks/${taskId}/assign/${userId}`, { method: 'DELETE' }),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

// === CHECKLIST ===

export function useAddChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, title }) =>
      apiFetch(`/tasks/${taskId}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
    onMutate: async ({ taskId, title }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.task(taskId) })
      const prev = queryClient.getQueryData(taskKeys.task(taskId))
      if (prev) {
        const optimistic = {
          id: `temp-${Date.now()}`,
          task_id: taskId,
          title,
          is_checked: false,
          order_hint: 'z',
        }
        queryClient.setQueryData(taskKeys.task(taskId), {
          ...prev,
          checklist: [...(prev.checklist ?? []), optimistic],
        })
      }
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.task(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId }) =>
      apiFetch(`/tasks/checklist/${itemId}`, { method: 'PATCH' }),
    onMutate: async ({ itemId, taskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.task(taskId) })
      const prev = queryClient.getQueryData(taskKeys.task(taskId))
      if (prev?.checklist) {
        queryClient.setQueryData(taskKeys.task(taskId), {
          ...prev,
          checklist: prev.checklist.map((item) =>
            item.id === itemId
              ? { ...item, is_checked: !item.is_checked }
              : item
          ),
        })
      }
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.task(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId }) =>
      apiFetch(`/tasks/checklist/${itemId}`, { method: 'DELETE' }),
    onMutate: async ({ itemId, taskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.task(taskId) })
      const prev = queryClient.getQueryData(taskKeys.task(taskId))
      if (prev?.checklist) {
        queryClient.setQueryData(taskKeys.task(taskId), {
          ...prev,
          checklist: prev.checklist.filter((item) => item.id !== itemId),
        })
      }
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.task(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

// === COMMENTS ===

export function useComments(taskId) {
  return useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn: () =>
      apiFetch(`/tasks/${taskId}/comments`).then((r) => r.comments ?? r),
    enabled: !!taskId,
  })
}

export function useAddComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, content }) =>
      apiFetch(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onMutate: async ({ taskId, content }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.comments(taskId) })
      const prev = queryClient.getQueryData(taskKeys.comments(taskId))
      const optimistic = {
        id: `temp-${Date.now()}`,
        task_id: taskId,
        content,
        user_name: '...',
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData(taskKeys.comments(taskId), [
        ...(prev ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.comments(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.comments(variables.taskId),
      })
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
    },
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, taskId: _taskId, content }) =>
      apiFetch(`/tasks/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      }),
    onMutate: async ({ commentId, taskId, content }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.comments(taskId) })
      const prev = queryClient.getQueryData(taskKeys.comments(taskId))
      if (prev) {
        queryClient.setQueryData(
          taskKeys.comments(taskId),
          prev.map((c) => (c.id === commentId ? { ...c, content } : c))
        )
      }
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.comments(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.comments(variables.taskId),
      })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ commentId, taskId: _taskId }) =>
      apiFetch(`/tasks/comments/${commentId}`, { method: 'DELETE' }),
    onMutate: async ({ commentId, taskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.comments(taskId) })
      const prev = queryClient.getQueryData(taskKeys.comments(taskId))
      if (prev) {
        queryClient.setQueryData(
          taskKeys.comments(taskId),
          prev.filter((c) => c.id !== commentId)
        )
      }
      return { prev }
    },
    onError: (_err, { taskId }, context) => {
      if (context?.prev)
        queryClient.setQueryData(taskKeys.comments(taskId), context.prev)
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: taskKeys.comments(variables.taskId),
      })
      queryClient.invalidateQueries({
        queryKey: taskKeys.task(variables.taskId),
      })
    },
  })
}

// === ACTIVITIES ===

export function useTaskActivities(taskId) {
  return useQuery({
    queryKey: taskKeys.activities(taskId),
    queryFn: () => apiFetch(`/tasks/${taskId}/activities`),
    enabled: !!taskId,
  })
}

export function useBoardActivities(boardId) {
  return useQuery({
    queryKey: taskKeys.boardActivities(boardId),
    queryFn: () => apiFetch(`/tasks/boards/${boardId}/activities`),
    enabled: !!boardId,
  })
}

// === LABELS ===

export function useBoardLabels(boardId) {
  return useQuery({
    queryKey: ['tasks', 'labels', boardId],
    queryFn: () =>
      apiFetch(`/tasks/boards/${boardId}/labels`).then((r) => r.labels ?? []),
    enabled: !!boardId,
  })
}

export function useCreateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, name, color }) =>
      apiFetch(`/tasks/boards/${boardId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name, color }),
      }).then((r) => r.label),
    onSuccess: (_data, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'labels', boardId] })
    },
  })
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, labelId, name, color }) =>
      apiFetch(`/tasks/boards/${boardId}/labels/${labelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, color }),
      }).then((r) => r.label),
    onSuccess: (_data, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'labels', boardId] })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ boardId, labelId }) =>
      apiFetch(`/tasks/boards/${boardId}/labels/${labelId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, { boardId, labelId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'labels', boardId] })
      // Remove from all tasks in board cache
      const boardKey = taskKeys.board(boardId)
      const board = queryClient.getQueryData(boardKey)
      if (board?.buckets) {
        queryClient.setQueryData(boardKey, {
          ...board,
          buckets: board.buckets.map((b) => ({
            ...b,
            tasks: (b.tasks ?? []).map((t) => ({
              ...t,
              labels: (t.labels ?? []).filter((l) => l.id !== labelId),
            })),
          })),
        })
      }
    },
  })
}

export function useAssignLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, labelId }) =>
      apiFetch(`/tasks/${taskId}/labels/${labelId}`, { method: 'POST' }),
    onMutate: async ({ taskId, labelId, boardId, labelData }) => {
      if (!boardId || !labelData) return {}
      await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
      const prev = queryClient.getQueryData(taskKeys.board(boardId))
      if (prev?.buckets) {
        queryClient.setQueryData(taskKeys.board(boardId), {
          ...prev,
          buckets: prev.buckets.map((b) => ({
            ...b,
            tasks: (b.tasks ?? []).map((t) =>
              t.id === taskId && !(t.labels ?? []).find((l) => l.id === labelId)
                ? { ...t, labels: [...(t.labels ?? []), labelData] }
                : t
            ),
          })),
        })
      }
      return { prev, boardId }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev && context?.boardId) {
        queryClient.setQueryData(taskKeys.board(context.boardId), context.prev)
      }
    },
    onSettled: (_data, _error, { boardId }) => {
      if (boardId)
        queryClient.invalidateQueries({ queryKey: taskKeys.board(boardId) })
    },
  })
}

export function useRemoveLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, labelId }) =>
      apiFetch(`/tasks/${taskId}/labels/${labelId}`, { method: 'DELETE' }),
    onMutate: async ({ taskId, labelId, boardId }) => {
      if (!boardId) return {}
      await queryClient.cancelQueries({ queryKey: taskKeys.board(boardId) })
      const prev = queryClient.getQueryData(taskKeys.board(boardId))
      if (prev?.buckets) {
        queryClient.setQueryData(taskKeys.board(boardId), {
          ...prev,
          buckets: prev.buckets.map((b) => ({
            ...b,
            tasks: (b.tasks ?? []).map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    labels: (t.labels ?? []).filter((l) => l.id !== labelId),
                  }
                : t
            ),
          })),
        })
      }
      return { prev, boardId }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev && context?.boardId) {
        queryClient.setQueryData(taskKeys.board(context.boardId), context.prev)
      }
    },
    onSettled: (_data, _error, { boardId }) => {
      if (boardId)
        queryClient.invalidateQueries({ queryKey: taskKeys.board(boardId) })
    },
  })
}
