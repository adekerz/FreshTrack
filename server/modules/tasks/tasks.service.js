/**
 * Task Planner Service
 * Core business logic for the Task Planner module
 *
 * Adapted from taskplanner package → ESM + project DB patterns
 * @module modules/tasks
 */

import { query, getClient } from '../../db/postgres.js'
import sseManager from '../../services/SSEManager.js'
import { logError as logErr } from '../../utils/logger.js'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate lexicographic order hint for drag & drop
 * @param {string|null} before - order_hint of item above
 * @param {string|null} after  - order_hint of item below
 * @returns {string}
 */
function generateOrderHint(before = null, after = null) {
  if (!before && !after) return 'a'

  if (!before) {
    // Insert at the beginning
    const firstChar = after.charCodeAt(0)
    if (firstChar > 97) {
      // 'a' = 97
      return String.fromCharCode(firstChar - 1)
    }
    return 'A' + after
  }

  if (!after) {
    // Insert at the end
    return before + 'a'
  }

  // Insert between
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const bChar = i < before.length ? before.charCodeAt(i) : 96
    const aChar = i < after.length ? after.charCodeAt(i) : 123

    if (aChar - bChar > 1) {
      return (
        before.substring(0, i) +
        String.fromCharCode(Math.floor((bChar + aChar) / 2))
      )
    }
  }

  return before + 'a'
}

/**
 * Broadcast a task event via SSE to the board's hotel
 */
async function broadcastTaskEvent(
  boardId,
  eventType,
  data,
  _excludeUserId = null
) {
  try {
    const boardResult = await query(
      'SELECT hotel_id FROM task_boards WHERE id = $1',
      [boardId]
    )
    if (boardResult.rows.length === 0) return

    const hotelId = boardResult.rows[0].hotel_id
    const eventData = {
      ...data,
      boardId,
      eventType: `task:${eventType}`,
    }

    // Broadcast to all hotel clients
    sseManager.broadcast(hotelId, `task:${eventType}`, eventData)
  } catch (err) {
    logErr('TaskService', `SSE broadcast error: ${err.message}`)
  }
}

// ═══════════════════════════════════════════════════════════════
// BOARDS
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new task board
 */
export async function createBoard({
  name,
  description,
  hotelId,
  departmentId,
  userId,
  settings,
}) {
  const result = await query(
    `INSERT INTO task_boards (name, description, hotel_id, department_id, created_by, settings)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb))
     RETURNING *`,
    [
      name,
      description || null,
      hotelId,
      departmentId || null,
      userId,
      settings ? JSON.stringify(settings) : null,
    ]
  )
  const board = result.rows[0]

  // Default buckets are created by trigger (tr_create_default_buckets)

  // Fetch the auto-created buckets
  const bucketsResult = await query(
    'SELECT * FROM task_buckets WHERE board_id = $1 ORDER BY position',
    [board.id]
  )
  board.buckets = bucketsResult.rows

  await broadcastTaskEvent(board.id, 'board:created', { board })
  return board
}

/**
 * Get all boards accessible by user
 */
export async function getBoards(hotelId, departmentId, userRole) {
  let sql = `
    SELECT tb.*, 
           u.name as creator_name,
           (SELECT COUNT(*) FROM tasks t WHERE t.board_id = tb.id) as task_count,
           (SELECT COUNT(*) FROM tasks t WHERE t.board_id = tb.id AND t.status = 'COMPLETED') as completed_count
    FROM task_boards tb
    LEFT JOIN users u ON tb.created_by = u.id
    WHERE tb.hotel_id = $1 AND tb.is_archived = FALSE
  `
  const params = [hotelId]

  // STAFF sees only their department board(s) + hotel-wide boards
  if (userRole === 'STAFF' && departmentId) {
    sql += ` AND (tb.department_id = $2 OR tb.department_id IS NULL)`
    params.push(departmentId)
  } else if (departmentId) {
    // Optionally filter by department for managers
    sql += ` AND (tb.department_id = $2 OR tb.department_id IS NULL)`
    params.push(departmentId)
  }

  sql += ' ORDER BY tb.created_at DESC'

  const result = await query(sql, params)
  return result.rows
}

/**
 * Get single board with buckets and tasks
 */
export async function getBoardById(boardId) {
  const boardResult = await query(
    `SELECT tb.*, u.name as creator_name
     FROM task_boards tb
     LEFT JOIN users u ON tb.created_by = u.id
     WHERE tb.id = $1`,
    [boardId]
  )

  if (boardResult.rows.length === 0) return null

  const board = boardResult.rows[0]

  // Fetch buckets
  const bucketsResult = await query(
    'SELECT * FROM task_buckets WHERE board_id = $1 ORDER BY position',
    [boardId]
  )
  board.buckets = bucketsResult.rows

  // Fetch tasks with assignments and labels for each bucket
  const tasksResult = await query(
    `SELECT t.*,
            creator.name as creator_name,
            json_agg(DISTINCT jsonb_build_object(
              'user_id', ta.user_id,
              'user_name', assignee.name
            )) FILTER (WHERE ta.user_id IS NOT NULL) as assignees,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object(
                'id', l.id, 'name', l.name, 'color', l.color
              )) FILTER (WHERE l.id IS NOT NULL),
              '[]'::json
            ) as labels
     FROM tasks t
     LEFT JOIN users creator ON t.created_by = creator.id
     LEFT JOIN task_assignments ta ON ta.task_id = t.id
     LEFT JOIN users assignee ON ta.user_id = assignee.id
     LEFT JOIN task_label_assignments tla ON tla.task_id = t.id
     LEFT JOIN task_plan_labels l ON l.id = tla.label_id
     WHERE t.board_id = $1
     GROUP BY t.id, creator.name
     ORDER BY t.order_hint`,
    [boardId]
  )

  // Group tasks by bucket
  const tasksByBucket = {}
  for (const task of tasksResult.rows) {
    if (!tasksByBucket[task.bucket_id]) {
      tasksByBucket[task.bucket_id] = []
    }
    tasksByBucket[task.bucket_id].push(task)
  }

  for (const bucket of board.buckets) {
    bucket.tasks = tasksByBucket[bucket.id] || []
  }

  return board
}

/**
 * Update board
 */
export async function updateBoard(boardId, updates) {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`)
    values.push(updates.description)
  }
  if (updates.is_archived !== undefined) {
    fields.push(`is_archived = $${paramIndex++}`)
    values.push(updates.is_archived)
  }
  if (updates.settings !== undefined) {
    fields.push(`settings = $${paramIndex++}::jsonb`)
    values.push(JSON.stringify(updates.settings))
  }

  if (fields.length === 0) return null

  values.push(boardId)
  const result = await query(
    `UPDATE task_boards SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  if (result.rows.length > 0) {
    await broadcastTaskEvent(boardId, 'board:updated', {
      board: result.rows[0],
    })
  }

  return result.rows[0] || null
}

/**
 * Delete board (hard delete — cascades to tasks, buckets, etc.)
 */
export async function deleteBoard(boardId) {
  const result = await query(
    'DELETE FROM task_boards WHERE id = $1 RETURNING id, hotel_id',
    [boardId]
  )

  if (result.rows.length > 0) {
    await broadcastTaskEvent(boardId, 'board:deleted', { boardId })
  }

  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// BUCKETS
// ═══════════════════════════════════════════════════════════════

/**
 * Create bucket
 */
export async function createBucket({ boardId, name, color, position }) {
  // If position not specified, add at end
  if (position === undefined || position === null) {
    const maxResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM task_buckets WHERE board_id = $1',
      [boardId]
    )
    position = maxResult.rows[0].next_pos
  }

  const result = await query(
    `INSERT INTO task_buckets (board_id, name, color, position)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [boardId, name, color || '#6B7280', position]
  )

  const bucket = result.rows[0]
  await broadcastTaskEvent(boardId, 'bucket:created', { bucket })
  return bucket
}

/**
 * Update bucket
 */
export async function updateBucket(bucketId, updates) {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`)
    values.push(updates.name)
  }
  if (updates.color !== undefined) {
    fields.push(`color = $${paramIndex++}`)
    values.push(updates.color)
  }
  if (updates.position !== undefined) {
    fields.push(`position = $${paramIndex++}`)
    values.push(updates.position)
  }
  if (updates.is_default !== undefined) {
    fields.push(`is_default = $${paramIndex++}`)
    values.push(updates.is_default)
  }
  if (updates.is_completed_bucket !== undefined) {
    fields.push(`is_completed_bucket = $${paramIndex++}`)
    values.push(updates.is_completed_bucket)
  }

  if (fields.length === 0) return null

  values.push(bucketId)
  const result = await query(
    `UPDATE task_buckets SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  if (result.rows.length > 0) {
    await broadcastTaskEvent(result.rows[0].board_id, 'bucket:updated', {
      bucket: result.rows[0],
    })
  }

  return result.rows[0] || null
}

/**
 * Delete bucket (move tasks to default bucket first)
 */
export async function deleteBucket(bucketId) {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Get bucket info
    const bucketResult = await client.query(
      'SELECT * FROM task_buckets WHERE id = $1',
      [bucketId]
    )
    if (bucketResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return false
    }

    const bucket = bucketResult.rows[0]

    // Prevent deleting the last bucket
    const countResult = await client.query(
      'SELECT COUNT(*) as cnt FROM task_buckets WHERE board_id = $1',
      [bucket.board_id]
    )
    if (parseInt(countResult.rows[0].cnt) <= 1) {
      await client.query('ROLLBACK')
      throw new Error('Cannot delete the last bucket')
    }

    // Move tasks to default bucket
    const defaultBucket = await client.query(
      'SELECT id FROM task_buckets WHERE board_id = $1 AND is_default = TRUE AND id != $2 LIMIT 1',
      [bucket.board_id, bucketId]
    )

    let targetBucketId
    if (defaultBucket.rows.length > 0) {
      targetBucketId = defaultBucket.rows[0].id
    } else {
      // Pick first bucket that's not this one
      const anyBucket = await client.query(
        'SELECT id FROM task_buckets WHERE board_id = $1 AND id != $2 ORDER BY position LIMIT 1',
        [bucket.board_id, bucketId]
      )
      targetBucketId = anyBucket.rows[0].id
    }

    await client.query('UPDATE tasks SET bucket_id = $1 WHERE bucket_id = $2', [
      targetBucketId,
      bucketId,
    ])

    await client.query('DELETE FROM task_buckets WHERE id = $1', [bucketId])
    await client.query('COMMIT')

    await broadcastTaskEvent(bucket.board_id, 'bucket:deleted', {
      bucketId,
      targetBucketId,
    })
    return true
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ═══════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════

/**
 * Create task
 */
export async function createTask({
  boardId,
  bucketId,
  title,
  description,
  priority,
  startDate,
  dueDate,
  relatedProductId,
  relatedBatchId,
  isRecurring,
  recurrencePattern,
  parentTaskId,
  userId,
}) {
  // Get last order hint in bucket
  const lastTask = await query(
    'SELECT order_hint FROM tasks WHERE bucket_id = $1 ORDER BY order_hint DESC LIMIT 1',
    [bucketId]
  )
  const orderHint = generateOrderHint(
    lastTask.rows.length > 0 ? lastTask.rows[0].order_hint : null,
    null
  )

  const result = await query(
    `INSERT INTO tasks (
      board_id, bucket_id, title, description, priority,
      start_date, due_date, order_hint,
      related_product_id, related_batch_id,
      is_recurring, recurrence_pattern, parent_task_id,
      created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
    RETURNING *`,
    [
      boardId,
      bucketId,
      title,
      description || null,
      priority || 'MEDIUM',
      startDate || null,
      dueDate || null,
      orderHint,
      relatedProductId || null,
      relatedBatchId || null,
      isRecurring || false,
      recurrencePattern ? JSON.stringify(recurrencePattern) : null,
      parentTaskId || null,
      userId,
    ]
  )

  const task = result.rows[0]

  // Log activity
  await logTaskActivity(task.id, boardId, userId, 'TASK_CREATED', {
    title: task.title,
    bucketId: task.bucket_id,
    priority: task.priority,
  })

  await broadcastTaskEvent(boardId, 'task:created', { task })
  return task
}

/**
 * Get task by ID with full details
 */
export async function getTaskById(taskId) {
  const result = await query(
    `SELECT t.*,
            creator.name as creator_name,
            updater.name as updater_name
     FROM tasks t
     LEFT JOIN users creator ON t.created_by = creator.id
     LEFT JOIN users updater ON t.updated_by = updater.id
     WHERE t.id = $1`,
    [taskId]
  )

  if (result.rows.length === 0) return null

  const task = result.rows[0]

  // Fetch assignments
  const assignments = await query(
    `SELECT ta.*, u.name as user_name, u.role as user_role
     FROM task_assignments ta
     JOIN users u ON ta.user_id = u.id
     WHERE ta.task_id = $1`,
    [taskId]
  )
  task.assignees = assignments.rows

  // Fetch checklist
  const checklist = await query(
    `SELECT * FROM task_checklist_items 
     WHERE task_id = $1 ORDER BY order_hint`,
    [taskId]
  )
  task.checklist = checklist.rows

  // Fetch comments (latest 20)
  const comments = await query(
    `SELECT tc.*, u.name as user_name
     FROM task_comments tc
     JOIN users u ON tc.user_id = u.id
     WHERE tc.task_id = $1
     ORDER BY tc.created_at DESC
     LIMIT 20`,
    [taskId]
  )
  task.comments = comments.rows

  // Fetch attachments
  const attachments = await query(
    `SELECT ta.*, u.name as uploader_name
     FROM task_attachments ta
     JOIN users u ON ta.uploaded_by = u.id
     WHERE ta.task_id = $1
     ORDER BY ta.uploaded_at DESC`,
    [taskId]
  )
  task.attachments = attachments.rows

  return task
}

/**
 * Update task
 */
export async function updateTask(taskId, updates, userId) {
  const fields = []
  const values = []
  let paramIndex = 1

  const fieldMap = {
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    start_date: 'start_date',
    due_date: 'due_date',
    percent_complete: 'percent_complete',
    is_recurring: 'is_recurring',
  }

  for (const [key, column] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = $${paramIndex++}`)
      values.push(updates[key])
    }
  }

  if (updates.recurrence_pattern !== undefined) {
    fields.push(`recurrence_pattern = $${paramIndex++}::jsonb`)
    values.push(JSON.stringify(updates.recurrence_pattern))
  }

  // Handle status changes
  if (updates.status === 'COMPLETED') {
    fields.push(`completed_at = CURRENT_TIMESTAMP`)
    fields.push(`percent_complete = 100`)
  } else if (updates.status && updates.status !== 'COMPLETED') {
    fields.push(`completed_at = NULL`)
  }

  if (fields.length === 0) return null

  // Always update updated_by
  fields.push(`updated_by = $${paramIndex++}`)
  values.push(userId)

  values.push(taskId)
  const result = await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  if (result.rows.length === 0) return null

  const task = result.rows[0]

  // Determine activity type
  let activityType = 'TASK_UPDATED'
  if (updates.status === 'COMPLETED') activityType = 'TASK_COMPLETED'
  else if (updates.status && updates.status !== 'COMPLETED')
    activityType = 'STATUS_CHANGED'
  else if (updates.priority !== undefined) activityType = 'PRIORITY_CHANGED'
  else if (updates.due_date !== undefined) activityType = 'DUE_DATE_CHANGED'

  await logTaskActivity(task.id, task.board_id, userId, activityType, {
    changes: Object.keys(updates),
  })

  await broadcastTaskEvent(task.board_id, 'task:updated', { task })
  return task
}

/**
 * Move task to different bucket (and/or reorder)
 */
export async function moveTask(taskId, targetBucketId, position, userId) {
  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Get current task
    const taskResult = await client.query('SELECT * FROM tasks WHERE id = $1', [
      taskId,
    ])
    if (taskResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return null
    }

    const task = taskResult.rows[0]
    const sourceBucketId = task.bucket_id

    // Calculate new order hint
    const tasksInTarget = await client.query(
      'SELECT order_hint FROM tasks WHERE bucket_id = $1 AND id != $2 ORDER BY order_hint',
      [targetBucketId, taskId]
    )

    let orderHint
    if (tasksInTarget.rows.length === 0) {
      orderHint = 'a'
    } else if (position <= 0) {
      orderHint = generateOrderHint(null, tasksInTarget.rows[0].order_hint)
    } else if (position >= tasksInTarget.rows.length) {
      orderHint = generateOrderHint(
        tasksInTarget.rows[tasksInTarget.rows.length - 1].order_hint,
        null
      )
    } else {
      orderHint = generateOrderHint(
        tasksInTarget.rows[position - 1].order_hint,
        tasksInTarget.rows[position].order_hint
      )
    }

    await client.query(
      'UPDATE tasks SET bucket_id = $1, order_hint = $2, updated_by = $3 WHERE id = $4',
      [targetBucketId, orderHint, userId, taskId]
    )

    // Check if moved to completed bucket → auto-complete
    const bucketResult = await client.query(
      'SELECT is_completed_bucket FROM task_buckets WHERE id = $1',
      [targetBucketId]
    )
    if (bucketResult.rows[0]?.is_completed_bucket) {
      await client.query(
        `UPDATE tasks SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, percent_complete = 100 
         WHERE id = $1 AND status != 'COMPLETED'`,
        [taskId]
      )
    }

    await client.query('COMMIT')

    await logTaskActivity(taskId, task.board_id, userId, 'TASK_MOVED', {
      from_bucket: sourceBucketId,
      to_bucket: targetBucketId,
      position,
    })

    await broadcastTaskEvent(task.board_id, 'task:moved', {
      taskId,
      sourceBucketId,
      targetBucketId,
      orderHint,
      position,
    })

    return { taskId, sourceBucketId, targetBucketId, orderHint }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Delete task
 */
export async function deleteTask(taskId, _userId) {
  const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId])
  if (taskResult.rows.length === 0) return false

  const task = taskResult.rows[0]

  await query('DELETE FROM tasks WHERE id = $1', [taskId])

  await broadcastTaskEvent(task.board_id, 'task:deleted', { taskId })
  return true
}

// ═══════════════════════════════════════════════════════════════
// ASSIGNMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Assign user to task
 */
export async function assignUser(taskId, targetUserId, assignedBy) {
  const result = await query(
    `INSERT INTO task_assignments (task_id, user_id, assigned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (task_id, user_id) DO NOTHING
     RETURNING *`,
    [taskId, targetUserId, assignedBy]
  )

  if (result.rows.length > 0) {
    const taskResult = await query('SELECT board_id FROM tasks WHERE id = $1', [
      taskId,
    ])
    if (taskResult.rows.length > 0) {
      const boardId = taskResult.rows[0].board_id

      await logTaskActivity(taskId, boardId, assignedBy, 'TASK_ASSIGNED', {
        assigned_user_id: targetUserId,
      })

      await broadcastTaskEvent(boardId, 'task:assigned', {
        taskId,
        assignedUserId: targetUserId,
        assignedBy,
      })
    }
  }

  return result.rows[0] || null
}

/**
 * Unassign user from task
 */
export async function unassignUser(taskId, targetUserId, removedBy) {
  const result = await query(
    'DELETE FROM task_assignments WHERE task_id = $1 AND user_id = $2 RETURNING *',
    [taskId, targetUserId]
  )

  if (result.rows.length > 0) {
    const taskResult = await query('SELECT board_id FROM tasks WHERE id = $1', [
      taskId,
    ])
    if (taskResult.rows.length > 0) {
      const boardId = taskResult.rows[0].board_id

      await logTaskActivity(taskId, boardId, removedBy, 'TASK_UNASSIGNED', {
        removed_user_id: targetUserId,
      })

      await broadcastTaskEvent(boardId, 'task:unassigned', {
        taskId,
        removedUserId: targetUserId,
        removedBy,
      })
    }
  }

  return result.rowCount > 0
}

/**
 * Get tasks assigned to a user
 */
export async function getMyTasks(userId, hotelId) {
  const result = await query(
    `SELECT t.*, 
            tb.name as board_name,
            tk.name as bucket_name,
            tk.color as bucket_color
     FROM tasks t
     JOIN task_assignments ta ON ta.task_id = t.id
     JOIN task_boards tb ON t.board_id = tb.id
     JOIN task_buckets tk ON t.bucket_id = tk.id
     WHERE ta.user_id = $1 AND tb.hotel_id = $2 AND t.status != 'COMPLETED'
     ORDER BY 
       CASE t.priority 
         WHEN 'URGENT' THEN 0 
         WHEN 'HIGH' THEN 1 
         WHEN 'MEDIUM' THEN 2 
         WHEN 'LOW' THEN 3 
       END,
       t.due_date NULLS LAST`,
    [userId, hotelId]
  )
  return result.rows
}

// ═══════════════════════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════════════════════

/**
 * Add checklist item
 */
export async function addChecklistItem(taskId, title, userId) {
  const lastItem = await query(
    'SELECT order_hint FROM task_checklist_items WHERE task_id = $1 ORDER BY order_hint DESC LIMIT 1',
    [taskId]
  )
  const orderHint = generateOrderHint(
    lastItem.rows.length > 0 ? lastItem.rows[0].order_hint : null,
    null
  )

  const result = await query(
    `INSERT INTO task_checklist_items (task_id, title, order_hint)
     VALUES ($1, $2, $3) RETURNING *`,
    [taskId, title, orderHint]
  )

  const item = result.rows[0]

  const taskResult = await query('SELECT board_id FROM tasks WHERE id = $1', [
    taskId,
  ])
  if (taskResult.rows.length > 0) {
    await logTaskActivity(
      taskId,
      taskResult.rows[0].board_id,
      userId,
      'CHECKLIST_ITEM_ADDED',
      {
        item_title: title,
      }
    )
    await broadcastTaskEvent(taskResult.rows[0].board_id, 'checklist:added', {
      taskId,
      item,
    })
  }

  return item
}

/**
 * Toggle checklist item (flips current is_checked value)
 */
export async function toggleChecklistItem(itemId, userId) {
  const result = await query(
    `UPDATE task_checklist_items
     SET is_checked = NOT is_checked,
         checked_by = CASE WHEN NOT is_checked THEN $1::uuid ELSE NULL END,
         checked_at = CASE WHEN NOT is_checked THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id = $2
     RETURNING *`,
    [userId, itemId]
  )

  if (result.rows.length === 0) return null

  const item = result.rows[0]
  const taskResult = await query('SELECT board_id FROM tasks WHERE id = $1', [
    item.task_id,
  ])
  if (taskResult.rows.length > 0) {
    const activityType = item.is_checked
      ? 'CHECKLIST_ITEM_CHECKED'
      : 'CHECKLIST_ITEM_UNCHECKED'
    await logTaskActivity(
      item.task_id,
      taskResult.rows[0].board_id,
      userId,
      activityType,
      {
        item_title: item.title,
      }
    )
    await broadcastTaskEvent(taskResult.rows[0].board_id, 'checklist:toggled', {
      taskId: item.task_id,
      item,
    })
  }

  return item
}

/**
 * Delete checklist item
 */
export async function deleteChecklistItem(itemId) {
  const result = await query(
    'DELETE FROM task_checklist_items WHERE id = $1 RETURNING *',
    [itemId]
  )
  return result.rowCount > 0
}

// ═══════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Add comment
 */
export async function addComment(
  taskId,
  content,
  userId,
  parentCommentId = null
) {
  const result = await query(
    `INSERT INTO task_comments (task_id, user_id, content, parent_comment_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [taskId, userId, content, parentCommentId]
  )

  const comment = result.rows[0]

  // Fetch user name
  const userResult = await query('SELECT name FROM users WHERE id = $1', [
    userId,
  ])
  comment.user_name = userResult.rows[0]?.name || 'Unknown'

  const taskResult = await query('SELECT board_id FROM tasks WHERE id = $1', [
    taskId,
  ])
  if (taskResult.rows.length > 0) {
    await logTaskActivity(
      taskId,
      taskResult.rows[0].board_id,
      userId,
      'COMMENT_ADDED',
      {
        comment_preview: content.substring(0, 100),
      }
    )
    await broadcastTaskEvent(taskResult.rows[0].board_id, 'comment:added', {
      taskId,
      comment,
    })
  }

  return comment
}

/**
 * Update comment
 */
export async function updateComment(commentId, content, userId) {
  const result = await query(
    `UPDATE task_comments 
     SET content = $1, updated_at = CURRENT_TIMESTAMP, is_edited = TRUE
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [content, commentId, userId]
  )
  return result.rows[0] || null
}

/**
 * Delete comment
 */
export async function deleteComment(commentId, userId) {
  // Allow admin or comment owner to delete
  const result = await query(
    'DELETE FROM task_comments WHERE id = $1 AND user_id = $2 RETURNING *',
    [commentId, userId]
  )
  return result.rowCount > 0
}

/**
 * Get comments for a task
 */
export async function getTaskComments(taskId, limit = 50, offset = 0) {
  const result = await query(
    `SELECT tc.*, u.name as user_name
     FROM task_comments tc
     JOIN users u ON tc.user_id = u.id
     WHERE tc.task_id = $1
     ORDER BY tc.created_at ASC
     LIMIT $2 OFFSET $3`,
    [taskId, limit, offset]
  )
  return result.rows
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Log task activity
 */
async function logTaskActivity(
  taskId,
  boardId,
  userId,
  activityType,
  data = {}
) {
  try {
    await query(
      `INSERT INTO task_activities (task_id, board_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [taskId, boardId, userId, activityType, JSON.stringify(data)]
    )
  } catch (err) {
    logErr('TaskService', `Activity log error: ${err.message}`)
    // Non-fatal — don't break the operation
  }
}

/**
 * Get activities for a task
 */
export async function getTaskActivities(taskId, limit = 30) {
  const result = await query(
    `SELECT ta.*, u.name as user_name
     FROM task_activities ta
     JOIN users u ON ta.user_id = u.id
     WHERE ta.task_id = $1
     ORDER BY ta.created_at DESC
     LIMIT $2`,
    [taskId, limit]
  )
  return result.rows
}

/**
 * Get activities for a board
 */
export async function getBoardActivities(boardId, limit = 50) {
  const result = await query(
    `SELECT ta.*, u.name as user_name, t.title as task_title
     FROM task_activities ta
     JOIN users u ON ta.user_id = u.id
     LEFT JOIN tasks t ON ta.task_id = t.id
     WHERE ta.board_id = $1
     ORDER BY ta.created_at DESC
     LIMIT $2`,
    [boardId, limit]
  )
  return result.rows
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD / STATS
// ═══════════════════════════════════════════════════════════════

/**
 * Get task stats for a hotel dashboard
 */
export async function getTaskStats(hotelId, departmentId = null) {
  let whereClause = 'WHERE tb.hotel_id = $1 AND tb.is_archived = FALSE'
  const params = [hotelId]

  if (departmentId) {
    whereClause += ' AND (tb.department_id = $2 OR tb.department_id IS NULL)'
    params.push(departmentId)
  }

  const result = await query(
    `
    SELECT 
      COUNT(*) FILTER (WHERE t.status = 'TODO') as todo_count,
      COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS') as in_progress_count,
      COUNT(*) FILTER (WHERE t.status = 'BLOCKED') as blocked_count,
      COUNT(*) FILTER (WHERE t.status = 'COMPLETED') as completed_count,
      COUNT(*) FILTER (WHERE t.due_date < CURRENT_DATE AND t.status NOT IN ('COMPLETED', 'CANCELLED')) as overdue_count,
      COUNT(*) FILTER (WHERE t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' AND t.status NOT IN ('COMPLETED', 'CANCELLED')) as due_soon_count,
      COUNT(*) as total_count
    FROM tasks t
    JOIN task_boards tb ON t.board_id = tb.id
    ${whereClause}
  `,
    params
  )

  return result.rows[0] || {}
}
