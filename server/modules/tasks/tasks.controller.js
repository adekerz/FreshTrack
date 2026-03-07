/**
 * Tasks Controller
 * REST API endpoints for Task Planner module
 *
 * Routes: /api/tasks/*
 * @module modules/tasks
 */

import { Router } from 'express'
import { logError, logInfo } from '../../utils/logger.js'
import {
  authMiddleware,
  hotelIsolation,
  requirePermission,
} from '../../middleware/auth.js'
import {
  createBoard,
  getBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  createBucket,
  updateBucket,
  deleteBucket,
  createTask,
  getTaskById,
  updateTask,
  moveTask,
  deleteTask,
  assignUser,
  unassignUser,
  getMyTasks,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addComment,
  updateComment,
  deleteComment,
  getTaskComments,
  getTaskActivities,
  getBoardActivities,
  getTaskStats,
} from './tasks.service.js'
import { logAudit } from '../../db/database.js'
import { query } from '../../db/postgres.js'

/** Check a checklist item belongs to the user's hotel. Returns hotel_id or null. */
async function getChecklistItemHotelId(itemId) {
  const result = await query(
    `SELECT tb.hotel_id FROM task_checklist_items tci
         JOIN tasks t ON t.id = tci.task_id
         JOIN task_boards tb ON tb.id = t.board_id
         WHERE tci.id = $1`,
    [itemId]
  )
  return result.rows[0]?.hotel_id ?? null
}

/** Check a comment belongs to the user's hotel. Returns hotel_id or null. */
async function getCommentHotelId(commentId) {
  const result = await query(
    `SELECT tb.hotel_id FROM task_comments tc
         JOIN tasks t ON t.id = tc.task_id
         JOIN task_boards tb ON tb.id = t.board_id
         WHERE tc.id = $1`,
    [commentId]
  )
  return result.rows[0]?.hotel_id ?? null
}

const router = Router()

// ═══════════════════════════════════════════════════════════════
// BOARDS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/tasks/boards
 * List all boards accessible by user
 */
router.get(
  '/boards',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const boards = await getBoards(
        req.hotelId,
        req.departmentId,
        req.user.role
      )
      res.json({ success: true, boards })
    } catch (error) {
      logError('Get boards error', error)
      res.status(500).json({ success: false, error: 'Failed to get boards' })
    }
  }
)

/**
 * GET /api/tasks/boards/:boardId
 * Get board with buckets and tasks
 */
router.get(
  '/boards/:boardId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const board = await getBoardById(req.params.boardId)
      if (!board) {
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      }

      // Hotel isolation check
      if (board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      // Department isolation for STAFF
      if (
        req.user.role === 'STAFF' &&
        board.department_id &&
        board.department_id !== req.departmentId
      ) {
        return res
          .status(403)
          .json({
            success: false,
            error: 'Access denied to this department board',
          })
      }

      res.json({ success: true, board })
    } catch (error) {
      logError('Get board error', error)
      res.status(500).json({ success: false, error: 'Failed to get board' })
    }
  }
)

/**
 * POST /api/tasks/boards
 * Create new board
 */
router.post(
  '/boards',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'create'),
  async (req, res) => {
    try {
      const { name, description, department_id, settings } = req.body

      if (!name || name.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Board name is required' })
      }

      const board = await createBoard({
        name: name.trim(),
        description,
        hotelId: req.hotelId,
        departmentId: department_id || req.departmentId,
        userId: req.user.id,
        settings,
      })

      await logAudit({
        hotel_id: req.hotelId,
        user_id: req.user.id,
        user_name: req.user.name,
        action: 'create',
        entity_type: 'task_board',
        entity_id: board.id,
        details: { name: board.name, department_id: board.department_id },
        ip_address: req.ip,
      })

      logInfo('Tasks', `Board created: "${board.name}" by ${req.user.name}`)
      res.status(201).json({ success: true, board })
    } catch (error) {
      logError('Create board error', error)
      res.status(500).json({ success: false, error: 'Failed to create board' })
    }
  }
)

/**
 * PATCH /api/tasks/boards/:boardId
 * Update board
 */
router.patch(
  '/boards/:boardId',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'update'),
  async (req, res) => {
    try {
      const existing = await getBoardById(req.params.boardId)
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      }
      if (existing.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const { name, description, is_archived, settings } = req.body
      const board = await updateBoard(req.params.boardId, {
        name,
        description,
        is_archived,
        settings,
      })

      res.json({ success: true, board })
    } catch (error) {
      logError('Update board error', error)
      res.status(500).json({ success: false, error: 'Failed to update board' })
    }
  }
)

/**
 * DELETE /api/tasks/boards/:boardId
 * Delete board
 */
router.delete(
  '/boards/:boardId',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'delete'),
  async (req, res) => {
    try {
      const existing = await getBoardById(req.params.boardId)
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      }
      if (existing.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const success = await deleteBoard(req.params.boardId)

      if (success) {
        await logAudit({
          hotel_id: req.hotelId,
          user_id: req.user.id,
          user_name: req.user.name,
          action: 'delete',
          entity_type: 'task_board',
          entity_id: req.params.boardId,
          details: { name: existing.name },
          ip_address: req.ip,
        })
      }

      res.json({ success })
    } catch (error) {
      logError('Delete board error', error)
      res.status(500).json({ success: false, error: 'Failed to delete board' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// BUCKETS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/tasks/boards/:boardId/buckets
 * Create bucket in board
 */
router.post(
  '/boards/:boardId/buckets',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'update'),
  async (req, res) => {
    try {
      const { name, color, position } = req.body

      if (!name || name.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Bucket name is required' })
      }

      const bucket = await createBucket({
        boardId: req.params.boardId,
        name: name.trim(),
        color,
        position,
      })

      res.status(201).json({ success: true, bucket })
    } catch (error) {
      logError('Create bucket error', error)
      res.status(500).json({ success: false, error: 'Failed to create bucket' })
    }
  }
)

/**
 * PATCH /api/tasks/buckets/:bucketId
 * Update bucket
 */
router.patch(
  '/buckets/:bucketId',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'update'),
  async (req, res) => {
    try {
      const { name, color, position, is_default, is_completed_bucket } =
        req.body
      const bucket = await updateBucket(req.params.bucketId, {
        name,
        color,
        position,
        is_default,
        is_completed_bucket,
      })

      if (!bucket) {
        return res
          .status(404)
          .json({ success: false, error: 'Bucket not found' })
      }

      res.json({ success: true, bucket })
    } catch (error) {
      logError('Update bucket error', error)
      res.status(500).json({ success: false, error: 'Failed to update bucket' })
    }
  }
)

/**
 * DELETE /api/tasks/buckets/:bucketId
 * Delete bucket (tasks moved to default bucket)
 */
router.delete(
  '/buckets/:bucketId',
  authMiddleware,
  hotelIsolation,
  requirePermission('task_boards', 'update'),
  async (req, res) => {
    try {
      const success = await deleteBucket(req.params.bucketId)
      res.json({ success })
    } catch (error) {
      if (error.message === 'Cannot delete the last bucket') {
        return res.status(400).json({ success: false, error: error.message })
      }
      logError('Delete bucket error', error)
      res.status(500).json({ success: false, error: 'Failed to delete bucket' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/tasks
 * Create task
 */
router.post(
  '/',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'create'),
  async (req, res) => {
    try {
      const {
        board_id,
        bucket_id,
        title,
        description,
        priority,
        start_date,
        due_date,
        related_product_id,
        related_batch_id,
        is_recurring,
        recurrence_pattern,
        parent_task_id,
      } = req.body

      if (!board_id) {
        return res
          .status(400)
          .json({ success: false, error: 'board_id is required' })
      }
      if (!title || title.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Task title is required' })
      }

      // Verify board belongs to user's hotel
      const board = await getBoardById(board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res
          .status(403)
          .json({ success: false, error: 'Board not found or access denied' })
      }

      // If no bucket specified, use default
      let targetBucketId = bucket_id
      if (!targetBucketId) {
        const defaultBucket = board.buckets.find((b) => b.is_default)
        targetBucketId = defaultBucket ? defaultBucket.id : board.buckets[0]?.id
      }

      if (!targetBucketId) {
        return res
          .status(400)
          .json({ success: false, error: 'No bucket available' })
      }

      const task = await createTask({
        boardId: board_id,
        bucketId: targetBucketId,
        title: title.trim(),
        description,
        priority,
        startDate: start_date,
        dueDate: due_date,
        relatedProductId: related_product_id,
        relatedBatchId: related_batch_id,
        isRecurring: is_recurring,
        recurrencePattern: recurrence_pattern,
        parentTaskId: parent_task_id,
        userId: req.user.id,
      })

      res.status(201).json({ success: true, task })
    } catch (error) {
      logError('Create task error', error)
      res.status(500).json({ success: false, error: 'Failed to create task' })
    }
  }
)

/**
 * GET /api/tasks/my
 * Get current user's assigned tasks
 */
router.get(
  '/my',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const tasks = await getMyTasks(req.user.id, req.hotelId)
      res.json({ success: true, tasks })
    } catch (error) {
      logError('Get my tasks error', error)
      res.status(500).json({ success: false, error: 'Failed to get tasks' })
    }
  }
)

/**
 * GET /api/tasks/stats
 * Get task statistics for dashboard
 */
router.get(
  '/stats',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const stats = await getTaskStats(req.hotelId, req.departmentId)
      res.json({ success: true, stats })
    } catch (error) {
      logError('Get task stats error', error)
      res.status(500).json({ success: false, error: 'Failed to get stats' })
    }
  }
)

/**
 * GET /api/tasks/:taskId
 * Get task with full details
 */
router.get(
  '/:taskId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      // Verify hotel access via board
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      res.json({ success: true, task })
    } catch (error) {
      logError('Get task error', error)
      res.status(500).json({ success: false, error: 'Failed to get task' })
    }
  }
)

/**
 * PATCH /api/tasks/:taskId
 * Update task
 */
router.patch(
  '/:taskId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const {
        title,
        description,
        priority,
        status,
        start_date,
        due_date,
        percent_complete,
        is_recurring,
        recurrence_pattern,
      } = req.body

      const existingTask = await getTaskById(req.params.taskId)
      if (!existingTask)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const taskBoard = await getBoardById(existingTask.board_id)
      if (!taskBoard || taskBoard.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const task = await updateTask(
        req.params.taskId,
        {
          title,
          description,
          priority,
          status,
          start_date,
          due_date,
          percent_complete,
          is_recurring,
          recurrence_pattern,
        },
        req.user.id
      )

      if (!task) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      res.json({ success: true, task })
    } catch (error) {
      logError('Update task error', error)
      res.status(500).json({ success: false, error: 'Failed to update task' })
    }
  }
)

/**
 * POST /api/tasks/:taskId/move
 * Move task to different bucket
 */
router.post(
  '/:taskId/move',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const { target_bucket_id, position } = req.body

      if (!target_bucket_id) {
        return res
          .status(400)
          .json({ success: false, error: 'target_bucket_id is required' })
      }

      // Verify task and target bucket both belong to user's hotel & same board
      const taskToMove = await getTaskById(req.params.taskId)
      if (!taskToMove)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const sourceBoard = await getBoardById(taskToMove.board_id)
      if (!sourceBoard || sourceBoard.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }
      const bucketCheck = await query(
        'SELECT board_id FROM task_buckets WHERE id = $1',
        [target_bucket_id]
      )
      if (
        !bucketCheck.rows.length ||
        bucketCheck.rows[0].board_id !== taskToMove.board_id
      ) {
        return res
          .status(400)
          .json({ success: false, error: 'Invalid target bucket' })
      }

      const result = await moveTask(
        req.params.taskId,
        target_bucket_id,
        position ?? 0,
        req.user.id
      )

      if (!result) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      res.json({ success: true, ...result })
    } catch (error) {
      logError('Move task error', error)
      res.status(500).json({ success: false, error: 'Failed to move task' })
    }
  }
)

/**
 * DELETE /api/tasks/:taskId
 * Delete task
 */
router.delete(
  '/:taskId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'delete'),
  async (req, res) => {
    try {
      const taskToDelete = await getTaskById(req.params.taskId)
      if (!taskToDelete)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const deleteBoard = await getBoardById(taskToDelete.board_id)
      if (!deleteBoard || deleteBoard.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const success = await deleteTask(req.params.taskId, req.user.id)

      if (!success) {
        return res.status(404).json({ success: false, error: 'Task not found' })
      }

      res.json({ success: true })
    } catch (error) {
      logError('Delete task error', error)
      res.status(500).json({ success: false, error: 'Failed to delete task' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/tasks/:taskId/assign
 * Assign user to task
 */
router.post(
  '/:taskId/assign',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const { user_id } = req.body
      if (!user_id) {
        return res
          .status(400)
          .json({ success: false, error: 'user_id is required' })
      }

      const taskToAssign = await getTaskById(req.params.taskId)
      if (!taskToAssign)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const assignBoard = await getBoardById(taskToAssign.board_id)
      if (!assignBoard || assignBoard.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const assignment = await assignUser(
        req.params.taskId,
        user_id,
        req.user.id
      )
      res.json({ success: true, assignment })
    } catch (error) {
      logError('Assign user error', error)
      res.status(500).json({ success: false, error: 'Failed to assign user' })
    }
  }
)

/**
 * DELETE /api/tasks/:taskId/assign/:userId
 * Unassign user from task
 */
router.delete(
  '/:taskId/assign/:userId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const success = await unassignUser(
        req.params.taskId,
        req.params.userId,
        req.user.id
      )
      res.json({ success })
    } catch (error) {
      logError('Unassign user error', error)
      res.status(500).json({ success: false, error: 'Failed to unassign user' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/tasks/:taskId/checklist
 * Add checklist item
 */
router.post(
  '/:taskId/checklist',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const { title } = req.body
      if (!title || title.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Title is required' })
      }

      const item = await addChecklistItem(
        req.params.taskId,
        title.trim(),
        req.user.id
      )
      res.status(201).json({ success: true, item })
    } catch (error) {
      logError('Add checklist item error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to add checklist item' })
    }
  }
)

/**
 * PATCH /api/tasks/checklist/:itemId
 * Toggle checklist item
 */
router.patch(
  '/checklist/:itemId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const hotelId = await getChecklistItemHotelId(req.params.itemId)
      if (!hotelId)
        return res
          .status(404)
          .json({ success: false, error: 'Checklist item not found' })
      if (hotelId !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const item = await toggleChecklistItem(req.params.itemId, req.user.id)
      if (!item) {
        return res
          .status(404)
          .json({ success: false, error: 'Checklist item not found' })
      }

      res.json({ success: true, item })
    } catch (error) {
      logError('Toggle checklist error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to toggle checklist' })
    }
  }
)

/**
 * DELETE /api/tasks/checklist/:itemId
 * Delete checklist item
 */
router.delete(
  '/checklist/:itemId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const hotelId = await getChecklistItemHotelId(req.params.itemId)
      if (!hotelId)
        return res
          .status(404)
          .json({ success: false, error: 'Checklist item not found' })
      if (hotelId !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const success = await deleteChecklistItem(req.params.itemId)
      res.json({ success })
    } catch (error) {
      logError('Delete checklist error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete checklist item' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/tasks/:taskId/comments
 * Get comments for task
 */
router.get(
  '/:taskId/comments',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
      const offset = Math.max(parseInt(req.query.offset) || 0, 0)
      const comments = await getTaskComments(req.params.taskId, limit, offset)
      res.json({ success: true, comments })
    } catch (error) {
      logError('Get comments error', error)
      res.status(500).json({ success: false, error: 'Failed to get comments' })
    }
  }
)

/**
 * POST /api/tasks/:taskId/comments
 * Add comment
 */
router.post(
  '/:taskId/comments',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const { content, parent_comment_id } = req.body
      if (!content || content.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Comment content is required' })
      }

      const comment = await addComment(
        req.params.taskId,
        content.trim(),
        req.user.id,
        parent_comment_id
      )
      res.status(201).json({ success: true, comment })
    } catch (error) {
      logError('Add comment error', error)
      res.status(500).json({ success: false, error: 'Failed to add comment' })
    }
  }
)

/**
 * PATCH /api/tasks/comments/:commentId
 * Update comment
 */
router.patch(
  '/comments/:commentId',
  authMiddleware,
  hotelIsolation,
  async (req, res) => {
    try {
      const hotelId = await getCommentHotelId(req.params.commentId)
      if (!hotelId)
        return res
          .status(404)
          .json({ success: false, error: 'Comment not found' })
      if (hotelId !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const { content } = req.body
      if (!content || content.trim() === '') {
        return res
          .status(400)
          .json({ success: false, error: 'Content is required' })
      }

      const comment = await updateComment(
        req.params.commentId,
        content.trim(),
        req.user.id
      )
      if (!comment) {
        return res
          .status(404)
          .json({ success: false, error: 'Comment not found or access denied' })
      }

      res.json({ success: true, comment })
    } catch (error) {
      logError('Update comment error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update comment' })
    }
  }
)

/**
 * DELETE /api/tasks/comments/:commentId
 * Delete comment (own comments only)
 */
router.delete(
  '/comments/:commentId',
  authMiddleware,
  hotelIsolation,
  async (req, res) => {
    try {
      const hotelId = await getCommentHotelId(req.params.commentId)
      if (!hotelId)
        return res
          .status(404)
          .json({ success: false, error: 'Comment not found' })
      if (hotelId !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const success = await deleteComment(req.params.commentId, req.user.id)
      if (!success) {
        return res
          .status(404)
          .json({ success: false, error: 'Comment not found or access denied' })
      }
      res.json({ success })
    } catch (error) {
      logError('Delete comment error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete comment' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// LABELS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/tasks/boards/:boardId/labels
 * List all labels for a board
 */
router.get(
  '/boards/:boardId/labels',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const board = await getBoardById(req.params.boardId)
      if (!board)
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      if (board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const result = await query(
        'SELECT * FROM task_plan_labels WHERE board_id = $1 ORDER BY position',
        [req.params.boardId]
      )
      res.json({ success: true, labels: result.rows })
    } catch (error) {
      logError('Get labels error', error)
      res.status(500).json({ success: false, error: 'Failed to get labels' })
    }
  }
)

/**
 * POST /api/tasks/boards/:boardId/labels
 * Create a label { name, color }
 */
router.post(
  '/boards/:boardId/labels',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const board = await getBoardById(req.params.boardId)
      if (!board)
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      if (board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const { name = '', color = '#6366f1' } = req.body

      const posResult = await query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_plan_labels WHERE board_id = $1',
        [req.params.boardId]
      )
      const position = posResult.rows[0].next_pos

      const result = await query(
        'INSERT INTO task_plan_labels (board_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.params.boardId, name, color, position]
      )
      res.status(201).json({ success: true, label: result.rows[0] })
    } catch (error) {
      logError('Create label error', error)
      res.status(500).json({ success: false, error: 'Failed to create label' })
    }
  }
)

/**
 * PATCH /api/tasks/boards/:boardId/labels/:labelId
 * Update a label { name?, color? }
 */
router.patch(
  '/boards/:boardId/labels/:labelId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const board = await getBoardById(req.params.boardId)
      if (!board)
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      if (board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const { name, color } = req.body
      const fields = []
      const values = []
      let i = 1
      if (name !== undefined) {
        fields.push(`name = $${i++}`)
        values.push(name)
      }
      if (color !== undefined) {
        fields.push(`color = $${i++}`)
        values.push(color)
      }
      if (fields.length === 0)
        return res
          .status(400)
          .json({ success: false, error: 'Nothing to update' })

      values.push(req.params.labelId, req.params.boardId)
      const result = await query(
        `UPDATE task_plan_labels SET ${fields.join(', ')} WHERE id = $${i++} AND board_id = $${i} RETURNING *`,
        values
      )
      if (!result.rows.length)
        return res
          .status(404)
          .json({ success: false, error: 'Label not found' })
      res.json({ success: true, label: result.rows[0] })
    } catch (error) {
      logError('Update label error', error)
      res.status(500).json({ success: false, error: 'Failed to update label' })
    }
  }
)

/**
 * DELETE /api/tasks/boards/:boardId/labels/:labelId
 */
router.delete(
  '/boards/:boardId/labels/:labelId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const board = await getBoardById(req.params.boardId)
      if (!board)
        return res
          .status(404)
          .json({ success: false, error: 'Board not found' })
      if (board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const result = await query(
        'DELETE FROM task_plan_labels WHERE id = $1 AND board_id = $2 RETURNING id',
        [req.params.labelId, req.params.boardId]
      )
      res.json({ success: result.rowCount > 0 })
    } catch (error) {
      logError('Delete label error', error)
      res.status(500).json({ success: false, error: 'Failed to delete label' })
    }
  }
)

/**
 * POST /api/tasks/:taskId/labels/:labelId
 * Assign a label to a task
 */
router.post(
  '/:taskId/labels/:labelId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      await query(
        'INSERT INTO task_label_assignments (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.taskId, req.params.labelId]
      )
      res.status(201).json({ success: true })
    } catch (error) {
      logError('Assign label error', error)
      res.status(500).json({ success: false, error: 'Failed to assign label' })
    }
  }
)

/**
 * DELETE /api/tasks/:taskId/labels/:labelId
 * Remove a label from a task
 */
router.delete(
  '/:taskId/labels/:labelId',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'update'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId)
        return res.status(403).json({ success: false, error: 'Access denied' })

      const result = await query(
        'DELETE FROM task_label_assignments WHERE task_id = $1 AND label_id = $2 RETURNING *',
        [req.params.taskId, req.params.labelId]
      )
      res.json({ success: result.rowCount > 0 })
    } catch (error) {
      logError('Remove label error', error)
      res.status(500).json({ success: false, error: 'Failed to remove label' })
    }
  }
)

// ═══════════════════════════════════════════════════════════════
// ACTIVITIES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/tasks/:taskId/activities
 * Get activity log for a task
 */
router.get(
  '/:taskId/activities',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const task = await getTaskById(req.params.taskId)
      if (!task)
        return res.status(404).json({ success: false, error: 'Task not found' })
      const board = await getBoardById(task.board_id)
      if (!board || board.hotel_id !== req.hotelId) {
        return res.status(403).json({ success: false, error: 'Access denied' })
      }

      const limit = parseInt(req.query.limit) || 30
      const activities = await getTaskActivities(req.params.taskId, limit)
      res.json({ success: true, activities })
    } catch (error) {
      logError('Get activities error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to get activities' })
    }
  }
)

/**
 * GET /api/tasks/boards/:boardId/activities
 * Get activity log for a board
 */
router.get(
  '/boards/:boardId/activities',
  authMiddleware,
  hotelIsolation,
  requirePermission('tasks', 'read'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50
      const activities = await getBoardActivities(req.params.boardId, limit)
      res.json({ success: true, activities })
    } catch (error) {
      logError('Get board activities error', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to get board activities' })
    }
  }
)

export default router
