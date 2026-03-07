/**
 * Task Planner Page — Full MS Planner-style implementation
 * Views: Board (Kanban) | Grid | Schedule | Charts
 * Features: Labels, GroupBy, Filters, Completion toggle, Drag & Drop
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Plus,
  LayoutGrid,
  Search,
  Trash2,
  ChevronDown,
  Loader2,
  ClipboardList,
  Calendar,
  MessageSquare,
  CheckSquare,
  AlertCircle,
  Clock,
  TrendingUp,
  Flag,
  X,
  GripVertical,
  SlidersHorizontal,
  LayoutList,
  CalendarDays,
  BarChart2,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Tag,
  Pencil,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { useHotel } from '../context/HotelContext'
import { useToast } from '../context/ToastContext'
import {
  useBoards,
  useBoard,
  useCreateBoard,
  useDeleteBoard,
  useCreateBucket,
  useDeleteBucket,
  useCreateTask,
  useUpdateTask,
  useMoveTask,
  useDeleteTask,
  useTask,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useComments,
  useAddComment,
  useDeleteComment,
  useTaskStats,
  useBoardLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  useAssignLabel,
  useRemoveLabel,
} from '../hooks/useTasks'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─────────────────────────────────────────────
// DEV MOCK
// ─────────────────────────────────────────────
const DEV_MOCK = false
const today = new Date()
const d = (n) => {
  const dt = new Date(today)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString()
}

const MOCK_STATS = {
  todo_count: 5,
  in_progress_count: 3,
  completed_count: 8,
  overdue_count: 2,
}
const MOCK_BOARD_ID = 'mock-board-1'
const MOCK_BOARDS = [
  {
    id: MOCK_BOARD_ID,
    name: 'Hotel Operations',
    description: 'Daily hotel tasks',
  },
  {
    id: 'mock-board-2',
    name: 'Maintenance',
    description: 'Facility maintenance',
  },
]
const MOCK_BUCKETS = [
  {
    id: 'bucket-1',
    name: 'To Do',
    position: 0,
    color: '#6366f1',
    tasks: [
      {
        id: 'task-1',
        bucket_id: 'bucket-1',
        title: 'Inspect kitchen refrigeration units',
        description: 'Check temperature logs.',
        priority: 'URGENT',
        status: 'TODO',
        due_date: d(-1),
        checklist_item_count: 4,
        completed_checklist_item_count: 1,
        comment_count: 2,
        percent_complete: 25,
        assignees: [
          { user_id: 'u1', user_name: 'Alex Kim' },
          { user_id: 'u2', user_name: 'Maria S' },
        ],
        labels: [
          { id: 'l1', color: '#ef4444', name: 'Urgent' },
          { id: 'l3', color: '#3b82f6', name: 'Kitchen' },
        ],
        order_hint: 'a',
      },
      {
        id: 'task-2',
        bucket_id: 'bucket-1',
        title: 'Order new cleaning supplies',
        description: '',
        priority: 'MEDIUM',
        status: 'TODO',
        due_date: d(3),
        checklist_item_count: 0,
        completed_checklist_item_count: 0,
        comment_count: 0,
        percent_complete: 0,
        assignees: [{ user_id: 'u3', user_name: 'James W' }],
        labels: [{ id: 'l2', color: '#10b981', name: 'Supplies' }],
        order_hint: 'b',
      },
      {
        id: 'task-3',
        bucket_id: 'bucket-1',
        title: 'Update staff schedule for March',
        description: 'Coordinate with department heads.',
        priority: 'HIGH',
        status: 'TODO',
        due_date: d(5),
        checklist_item_count: 3,
        completed_checklist_item_count: 0,
        comment_count: 1,
        percent_complete: 0,
        assignees: [],
        labels: [],
        order_hint: 'c',
      },
    ],
  },
  {
    id: 'bucket-2',
    name: 'In Progress',
    position: 1,
    color: '#f59e0b',
    tasks: [
      {
        id: 'task-4',
        bucket_id: 'bucket-2',
        title: 'Deep clean rooms 301–310',
        description: 'Full room refresh after guest checkout.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        due_date: d(1),
        checklist_item_count: 6,
        completed_checklist_item_count: 4,
        comment_count: 3,
        percent_complete: 65,
        assignees: [
          { user_id: 'u4', user_name: 'Sophie L' },
          { user_id: 'u5', user_name: 'Dmitri P' },
        ],
        labels: [{ id: 'l4', color: '#f59e0b', name: 'Housekeeping' }],
        order_hint: 'a',
      },
      {
        id: 'task-5',
        bucket_id: 'bucket-2',
        title: 'Fix lobby elevator B',
        description: 'Technician scheduled for tomorrow morning.',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        due_date: d(0),
        checklist_item_count: 2,
        completed_checklist_item_count: 1,
        comment_count: 5,
        percent_complete: 50,
        assignees: [{ user_id: 'u1', user_name: 'Alex Kim' }],
        labels: [
          { id: 'l1', color: '#ef4444', name: 'Urgent' },
          { id: 'l5', color: '#8b5cf6', name: 'Maintenance' },
        ],
        order_hint: 'b',
      },
    ],
  },
  {
    id: 'bucket-3',
    name: 'Review',
    position: 2,
    color: '#8b5cf6',
    tasks: [
      {
        id: 'task-6',
        bucket_id: 'bucket-3',
        title: 'Verify fire safety compliance report',
        description: 'Annual inspection documents need GM signature.',
        priority: 'HIGH',
        status: 'REVIEW',
        due_date: d(2),
        checklist_item_count: 5,
        completed_checklist_item_count: 5,
        comment_count: 2,
        percent_complete: 100,
        assignees: [{ user_id: 'u2', user_name: 'Maria S' }],
        labels: [{ id: 'l6', color: '#06b6d4', name: 'Compliance' }],
        order_hint: 'a',
      },
    ],
  },
  {
    id: 'bucket-4',
    name: 'Done',
    position: 3,
    color: '#10b981',
    tasks: [
      {
        id: 'task-7',
        bucket_id: 'bucket-4',
        title: 'Staff safety training session',
        description: 'Q1 mandatory training completed.',
        priority: 'LOW',
        status: 'COMPLETED',
        due_date: d(-5),
        checklist_item_count: 3,
        completed_checklist_item_count: 3,
        comment_count: 1,
        percent_complete: 100,
        assignees: [{ user_id: 'u3', user_name: 'James W' }],
        labels: [],
        order_hint: 'a',
      },
    ],
  },
]
const MOCK_BOARD_DATA = {
  id: MOCK_BOARD_ID,
  name: 'Hotel Operations',
  buckets: MOCK_BUCKETS,
}
const MOCK_COMMENTS = {
  'task-1': [
    {
      id: 'c1',
      task_id: 'task-1',
      user_name: 'Alex Kim',
      content: 'Found unit #3 running at +6°C.',
      created_at: d(-2),
    },
  ],
}
const MOCK_CHECKLIST = {
  'task-1': [
    { id: 'cl1', title: 'Check unit #1 temperature', is_completed: true },
    { id: 'cl2', title: 'Check unit #2 temperature', is_completed: false },
    { id: 'cl3', title: 'Update temperature log', is_completed: false },
  ],
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const PRIORITIES = {
  URGENT: {
    key: 'urgent',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dot: 'bg-red-500',
    hex: '#ef4444',
  },
  HIGH: {
    key: 'high',
    badge:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    dot: 'bg-orange-500',
    hex: '#f97316',
  },
  MEDIUM: {
    key: 'medium',
    badge:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    dot: 'bg-yellow-500',
    hex: '#eab308',
  },
  LOW: {
    key: 'low',
    badge:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    dot: 'bg-green-500',
    hex: '#22c55e',
  },
}
const COLUMN_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#FF8D6B',
]
const VIEWS = [
  { id: 'board', label: 'Доска', icon: LayoutGrid },
  { id: 'grid', label: 'Таблица', icon: LayoutList },
  { id: 'schedule', label: 'Календарь', icon: CalendarDays },
  { id: 'charts', label: 'Графики', icon: BarChart2 },
]
const GROUP_OPTIONS = [
  { id: 'bucket', label: 'По колонке' },
  { id: 'priority', label: 'По приоритету' },
  { id: 'assignee', label: 'По исполнителю' },
  { id: 'dueDate', label: 'По дате' },
]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  const diff = date - new Date()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return `${Math.abs(days)}д просрочено`
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Завтра'
  return date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })
}
function dueDateColor(d) {
  if (!d) return 'text-muted-foreground'
  const days = Math.ceil((new Date(d) - new Date()) / 86400000)
  if (days < 0) return 'text-red-500'
  if (days <= 1) return 'text-orange-500'
  if (days <= 3) return 'text-yellow-500'
  return 'text-muted-foreground'
}
function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
function eachDayOfMonth(year, month) {
  const days = []
  const date = new Date(year, month, 1)
  while (date.getMonth() === month) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

// ─────────────────────────────────────────────
// Modal Backdrop
// ─────────────────────────────────────────────
function ModalBackdrop({ onClose, children }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className="relative animate-slide-up"
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Avatar Stack
// ─────────────────────────────────────────────
function AvatarStack({ assignees, max = 3 }) {
  if (!assignees?.length) return null
  const shown = assignees.slice(0, max)
  const rest = assignees.length - max
  return (
    <div className="flex -space-x-1.5">
      {shown.map((a, i) => (
        <div
          key={a.user_id || i}
          title={a.user_name}
          className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center border border-card"
        >
          {getInitials(a.user_name)}
        </div>
      ))}
      {rest > 0 && (
        <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[9px] font-medium flex items-center justify-center border border-card">
          +{rest}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// LabelStrips — MS Planner style color bars on top of card
// ─────────────────────────────────────────────
function LabelStrips({ labels }) {
  if (!labels?.length) return null
  return (
    <div className="flex gap-1 mb-2.5">
      {labels.map((label) => (
        <div
          key={label.id}
          className="h-2 rounded-full flex-1 min-w-[28px] max-w-[80px]"
          style={{ backgroundColor: label.color }}
          title={label.name}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// TaskCard — MS Planner card design
// ─────────────────────────────────────────────
function TaskCard({ task, onClick, onComplete, t }) {
  const prio = PRIORITIES[task.priority] || PRIORITIES.MEDIUM
  const checkTotal = task.checklist_item_count || 0
  const checkDone = task.completed_checklist_item_count || 0
  const progress =
    checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
  const isCompleted =
    task.status === 'COMPLETED' || task.percent_complete === 100

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(task)
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onClick(task)}
      className={`group relative bg-card border border-border/60 rounded-xl p-3.5 cursor-pointer hover:shadow-md hover:-translate-y-px transition-all duration-150 select-none ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* MS Planner: color label strips on top */}
      <LabelStrips labels={task.labels} />

      {/* Title row with completion circle */}
      <div className="flex items-start gap-2 mb-2.5">
        {/* Completion toggle — MS Planner style circle */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete && onComplete(task)
          }}
          title={
            isCompleted ? 'Отметить как незавершённое' : 'Завершить задачу'
          }
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-0.5
                        ${
                          isCompleted
                            ? 'bg-accent border-accent'
                            : 'border-border hover:border-accent group-hover:border-accent/60'
                        }`}
        >
          {isCompleted && (
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          )}
        </button>

        <p
          className={`font-medium text-sm leading-snug line-clamp-2 flex-1 group-hover:text-accent transition-colors
                    ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}
        >
          {task.title}
        </p>

        {/* Drag grip */}
        <div className="opacity-0 group-hover:opacity-30 transition-opacity flex-shrink-0">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>

      {/* Checklist progress bar */}
      {checkTotal > 0 && (
        <div className="mb-2.5 ml-7">
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="h-1 rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {checkDone}/{checkTotal}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 ml-7">
        <div className="flex items-center gap-2">
          {/* Priority dot */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${prio.dot}`}
            title={t(`tasks.priorities.${prio.key}`)}
          />
          {/* Due date */}
          {task.due_date && (
            <span
              className={`flex items-center gap-0.5 text-[11px] font-medium ${dueDateColor(task.due_date)}`}
            >
              {isOverdue ? (
                <AlertCircle className="w-3 h-3" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {task.comment_count > 0 && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              {task.comment_count}
            </span>
          )}
          <AvatarStack assignees={task.assignees} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// BucketColumn
// ─────────────────────────────────────────────
function BucketColumn({
  bucket,
  tasks,
  colorIndex,
  onTaskClick,
  onTaskComplete,
  onAddTask,
  onDrop,
  onDelete,
  t,
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const accentColor =
    bucket.color || COLUMN_COLORS[colorIndex % COLUMN_COLORS.length]

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])
  const handleDragLeave = useCallback(() => setIsDragOver(false), [])
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragOver(false)
      const taskId = e.dataTransfer.getData('text/plain')
      if (taskId && onDrop) onDrop(taskId, bucket.id, tasks.length)
    },
    [bucket.id, tasks.length, onDrop]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col w-[280px] lg:w-[300px] flex-shrink-0 rounded-2xl border transition-all duration-200
                ${isDragOver ? 'border-accent/50 bg-accent/5 shadow-lg shadow-accent/10' : 'border-border/60 bg-card/50'}`}
    >
      {/* Top color strip */}
      <div
        className="h-1.5 rounded-t-2xl"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 group/header">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground">
            {bucket.name}
          </h3>
          <span
            className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
            style={{ backgroundColor: accentColor + 'cc' }}
          >
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {onDelete && (
            <button
              onClick={() => onDelete(bucket)}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover/header:opacity-100"
              title={t('tasks.deleteColumn')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => onAddTask(bucket.id)}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="flex-1 px-3 space-y-2 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[60px]">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={onTaskClick}
            onComplete={onTaskComplete}
            t={t}
          />
        ))}
        {tasks.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed transition-colors
                        ${isDragOver ? 'border-accent/40 text-accent' : 'border-border/40 text-muted-foreground/40'}`}
          >
            <ClipboardList className="w-7 h-7 mb-1.5" />
            <span className="text-xs">Перетащите задачу сюда</span>
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="px-3 py-3">
        <button
          onClick={() => onAddTask(bucket.id)}
          className="w-full py-2 rounded-xl text-xs text-muted-foreground hover:text-accent hover:bg-accent/8 border border-dashed border-border/50 hover:border-accent/40 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('tasks.createTask')}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// GRID VIEW — MS Planner table style
// ─────────────────────────────────────────────
function GridView({ groups, onTaskClick, onTaskComplete, t }) {
  const allTasks = groups.flatMap((g) =>
    g.tasks.map((task) => ({ ...task, _groupName: g.name }))
  )
  if (!allTasks.length)
    return (
      <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
        <ClipboardList className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Нет задач</p>
      </div>
    )
  return (
    <div className="p-4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left pb-3 pr-2 w-8"></th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs min-w-[200px]">
              Задача
            </th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs">
              Статус
            </th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs">
              Приоритет
            </th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs">
              Срок
            </th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs">
              Исполнитель
            </th>
            <th className="text-left pb-3 pr-4 font-medium text-muted-foreground text-xs">
              Прогресс
            </th>
            <th className="text-left pb-3 font-medium text-muted-foreground text-xs">
              Метки
            </th>
          </tr>
        </thead>
        <tbody>
          {allTasks.map((task) => {
            const prio = PRIORITIES[task.priority] || PRIORITIES.MEDIUM
            const isCompleted =
              task.status === 'COMPLETED' || task.percent_complete === 100
            return (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors group"
              >
                <td className="py-2.5 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskComplete && onTaskComplete(task)
                    }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                            ${isCompleted ? 'bg-accent border-accent' : 'border-border hover:border-accent'}`}
                  >
                    {isCompleted && (
                      <Check
                        className="w-2.5 h-2.5 text-white"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`font-medium text-foreground group-hover:text-accent transition-colors
                                        ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {task.title}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {task._groupName}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${prio.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
                    {t(`tasks.priorities.${prio.key}`)}
                  </span>
                </td>
                <td
                  className={`py-2.5 pr-4 text-xs ${dueDateColor(task.due_date)}`}
                >
                  {task.due_date ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.due_date)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <AvatarStack assignees={task.assignees} />
                </td>
                <td className="py-2.5 pr-4">
                  {task.checklist_item_count > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{
                            width: `${Math.round((task.completed_checklist_item_count / task.checklist_item_count) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {task.completed_checklist_item_count}/
                        {task.checklist_item_count}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{ width: `${task.percent_complete || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {task.percent_complete || 0}%
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2.5">
                  <div className="flex gap-1">
                    {task.labels?.slice(0, 3).map((l) => (
                      <span
                        key={l.id}
                        className="h-2 w-6 rounded-full"
                        style={{ backgroundColor: l.color }}
                        title={l.name}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────
// SCHEDULE VIEW — Calendar
// ─────────────────────────────────────────────
function ScheduleView({ allTasks, onTaskClick }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const days = eachDayOfMonth(year, month)
  const firstDayOfWeek = new Date(year, month, 1).getDay() // 0=Sun
  const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const MONTHS = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ]

  const tasksByDate = useMemo(() => {
    return allTasks.reduce((acc, task) => {
      if (!task.due_date) return acc
      const key = new Date(task.due_date).toISOString().split('T')[0]
      acc[key] = [...(acc[key] || []), task]
      return acc
    }, {})
  }, [allTasks])

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  return (
    <div className="p-4 lg:p-6 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setYear(now.getFullYear())
              setMonth(now.getMonth())
            }}
            className="px-3 h-8 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Сегодня
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {/* Empty cells for first week offset */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-card/30 min-h-[90px] p-1.5" />
        ))}

        {days.map((day) => {
          const key = day.toISOString().split('T')[0]
          const dayTasks = tasksByDate[key] || []
          const isToday = key === now.toISOString().split('T')[0]
          const isWeekend = day.getDay() === 0 || day.getDay() === 6

          return (
            <div
              key={key}
              className={`min-h-[90px] p-1.5 transition-colors
                            ${isWeekend ? 'bg-muted/20' : 'bg-card'}
                            ${dayTasks.length ? 'hover:bg-muted/40' : ''}`}
            >
              {/* Day number */}
              <div
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1
                                ${isToday ? 'bg-accent text-white' : 'text-muted-foreground'}`}
              >
                {day.getDate()}
              </div>
              {/* Tasks on this day */}
              {dayTasks.slice(0, 3).map((task) => {
                const prio = PRIORITIES[task.priority] || PRIORITIES.MEDIUM
                return (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="w-full text-left text-[10px] px-1.5 py-1 rounded mb-0.5 truncate hover:opacity-80 transition-opacity border border-transparent"
                    style={{
                      backgroundColor: prio.hex + '25',
                      color: prio.hex,
                      borderColor: prio.hex + '40',
                    }}
                  >
                    {task.title}
                  </button>
                )
              })}
              {dayTasks.length > 3 && (
                <div className="text-[10px] text-muted-foreground px-1">
                  +{dayTasks.length - 3} ещё
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// CHARTS VIEW
// ─────────────────────────────────────────────
function ChartsView({ buckets, stats, allTasks, t }) {
  const statusData = [
    { name: 'К выполнению', value: stats?.todo_count || 0, color: '#6366f1' },
    {
      name: 'В работе',
      value: stats?.in_progress_count || 0,
      color: '#f59e0b',
    },
    { name: 'Готово', value: stats?.completed_count || 0, color: '#10b981' },
    { name: 'Просрочено', value: stats?.overdue_count || 0, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const bucketData = buckets.map((b) => ({
    name: b.name,
    Задач: b.tasks.length,
    color: b.color || '#6366f1',
  }))

  const priorityData = Object.entries(PRIORITIES)
    .map(([key, val]) => ({
      name: t(`tasks.priorities.${val.key}`),
      value: allTasks.filter((t) => t.priority === key).length,
      color: val.hex,
    }))
    .filter((d) => d.value > 0)

  // Member workload
  const memberMap = {}
  allTasks.forEach((task) => {
    task.assignees?.forEach((a) => {
      memberMap[a.user_name] = (memberMap[a.user_name] || 0) + 1
    })
  })
  const memberData = Object.entries(memberMap).map(([name, count]) => ({
    name,
    Задач: count,
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-card border border-border rounded-xl px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-foreground mb-1">
          {label || payload[0].name}
        </p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name || 'Задач'}: <span className="font-bold">{p.value}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Status pie */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          По статусу
        </h3>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Нет данных
          </p>
        )}
      </div>

      {/* Buckets bar */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          По колонкам
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={bucketData}
            margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-muted-foreground"
            />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Задач" radius={[4, 4, 0, 0]}>
              {bucketData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color || COLUMN_COLORS[i % COLUMN_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Priority pie */}
      {priorityData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            По приоритету
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
              >
                {priorityData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Member workload */}
      {memberData.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            Нагрузка по сотрудникам
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={memberData}
              layout="vertical"
              margin={{ top: 5, right: 5, bottom: 5, left: 10 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10 }}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Задач" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// StatsBar
// ─────────────────────────────────────────────
function StatsBar({ stats }) {
  if (!stats) return null
  const items = [
    {
      label: 'К выполнению',
      value: stats.todo_count || 0,
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'В работе',
      value: stats.in_progress_count || 0,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Готово',
      value: stats.completed_count || 0,
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Просрочено',
      value: stats.overdue_count || 0,
      icon: <AlertCircle className="w-3.5 h-3.5" />,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
  ]
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      {items.map((item) => (
        <div
          key={item.label}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${item.color} ${item.bg}`}
        >
          {item.icon}
          <span className="font-bold">{item.value}</span>
          <span className="font-normal opacity-80">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// BoardSelector
// ─────────────────────────────────────────────
function BoardSelector({ boards, currentBoardId, onSelect, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const currentBoard = boards?.find((b) => b.id === currentBoardId)
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl border border-border bg-background text-foreground text-sm hover:border-accent/50 focus:ring-2 focus:ring-accent outline-none transition-all"
      >
        <span className="max-w-[120px] truncate font-medium">
          {currentBoard?.name || '—'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
          {boards.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-2 px-3 py-2 group hover:bg-muted/60 transition-colors ${b.id === currentBoardId ? 'bg-accent/8' : ''}`}
            >
              <button
                className="flex-1 text-left text-sm truncate text-foreground"
                onClick={() => {
                  onSelect(b.id)
                  setOpen(false)
                }}
              >
                {b.id === currentBoardId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block mr-1.5 mb-0.5" />
                )}
                {b.name}
              </button>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(b)
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// FilterPanel — MS Planner style filter bar
// ─────────────────────────────────────────────
function FilterPanel({ filters, onChange, allTasks, t }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const allAssignees = useMemo(() => {
    const map = {}
    allTasks.forEach((t) =>
      t.assignees?.forEach((a) => {
        map[a.user_id] = a.user_name
      })
    )
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  }, [allTasks])

  const activeCount =
    filters.priorities.length +
    filters.assignees.length +
    (filters.dueDate ? 1 : 0)

  const togglePriority = (p) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter((x) => x !== p)
      : [...filters.priorities, p]
    onChange({ ...filters, priorities: next })
  }
  const toggleAssignee = (id) => {
    const next = filters.assignees.includes(id)
      ? filters.assignees.filter((x) => x !== id)
      : [...filters.assignees, id]
    onChange({ ...filters, assignees: next })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-all
                    ${activeCount > 0 ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-accent/50'}`}
      >
        <Filter className="w-3.5 h-3.5" />
        Фильтры
        {activeCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-card border border-border rounded-2xl shadow-xl z-50 p-4 space-y-4">
          {/* Priority filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Приоритет
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRIORITIES).map(([key, val]) => {
                const active = filters.priorities.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => togglePriority(key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                                            ${active ? val.badge + ' border-current' : 'border-border text-muted-foreground hover:border-accent/50'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${val.dot}`} />
                    {t(`tasks.priorities.${val.key}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Assignee filter */}
          {allAssignees.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Исполнитель
              </p>
              <div className="space-y-1">
                {allAssignees.map((a) => {
                  const active = filters.assignees.includes(a.id)
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleAssignee(a.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all text-left
                                                ${active ? 'bg-accent/10 text-accent' : 'hover:bg-muted text-foreground'}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0
                                                ${active ? 'bg-accent text-white' : 'bg-muted text-muted-foreground'}`}
                      >
                        {getInitials(a.name)}
                      </div>
                      {a.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Due date filter */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Срок
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'overdue', label: 'Просрочено' },
                { id: 'today', label: 'Сегодня' },
                { id: 'week', label: 'Эта неделя' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    onChange({
                      ...filters,
                      dueDate: filters.dueDate === opt.id ? '' : opt.id,
                    })
                  }
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all
                                        ${filters.dueDate === opt.id ? 'bg-accent/10 border-accent text-accent' : 'border-border text-muted-foreground hover:border-accent/50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeCount > 0 && (
            <button
              onClick={() =>
                onChange({ priorities: [], assignees: [], dueDate: '' })
              }
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
            >
              Сбросить все фильтры
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// GroupBy Selector
// ─────────────────────────────────────────────
function GroupBySelector({ groupBy, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const current = GROUP_OPTIONS.find((o) => o.id === groupBy)
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
      >
        <ArrowUpDown className="w-3.5 h-3.5" />
        {current?.label}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden py-1">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left
                                ${groupBy === opt.id ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-muted/60'}`}
            >
              {groupBy === opt.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              {groupBy !== opt.id && <span className="w-1.5 h-1.5" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// AddBucketButton
// ─────────────────────────────────────────────
function AddBucketButton({ boardId, t }) {
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName] = useState('')
  const createBucket = useCreateBucket()
  const inputRef = useRef(null)
  useEffect(() => {
    if (isAdding) inputRef.current?.focus()
  }, [isAdding])
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    createBucket.mutate(
      { boardId, name: name.trim() },
      {
        onSuccess: () => {
          setName('')
          setIsAdding(false)
        },
      }
    )
  }
  if (!isAdding)
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full h-12 rounded-2xl border-2 border-dashed border-border hover:border-accent/50 text-muted-foreground hover:text-accent text-sm font-medium transition-all flex items-center justify-center gap-2 hover:bg-accent/5"
      >
        <Plus className="w-4 h-4" />
        {t('tasks.addColumn')}
      </button>
    )
  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 rounded-2xl bg-card border border-border space-y-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('tasks.columnNamePlaceholder')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsAdding(false)
            setName('')
          }
        }}
        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim() || createBucket.isPending}
          className="flex-1 py-1.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50 transition-all"
        >
          {createBucket.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
          ) : (
            t('common.add')
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsAdding(false)
            setName('')
          }}
          className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────
// CreateTaskModal
// ─────────────────────────────────────────────
function CreateTaskModal({ boardId, bucketId, buckets, onClose, t, isMock }) {
  const createTask = useCreateTask()
  const titleRef = useRef(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    due_date: '',
    bucket_id: bucketId || (buckets?.[0]?.id ?? ''),
  })
  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || isMock) return
    createTask.mutate(
      {
        board_id: boardId,
        bucket_id: form.bucket_id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        due_date: form.due_date || undefined,
      },
      { onSuccess: () => onClose() }
    )
  }
  const prio = PRIORITIES[form.priority] || PRIORITIES.MEDIUM
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {t('tasks.createTask')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <input
            ref={titleRef}
            type="text"
            value={form.title}
            onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            placeholder={t('tasks.taskTitlePlaceholder')}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-sm font-medium transition-all"
          />
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((s) => ({ ...s, description: e.target.value }))
            }
            placeholder={t('tasks.descriptionPlaceholder')}
            rows={2}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none text-sm resize-none transition-all"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t('tasks.column')}
              </label>
              <select
                value={form.bucket_id}
                onChange={(e) =>
                  setForm((s) => ({ ...s, bucket_id: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
              >
                {(buckets || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t('tasks.priority')}
              </label>
              <div className="relative">
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, priority: e.target.value }))
                  }
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(`tasks.priorities.${v.key}`)}
                    </option>
                  ))}
                </select>
                <span
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ${prio.dot}`}
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('tasks.dueDate')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm((s) => ({ ...s, due_date: e.target.value }))
                }
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || createTask.isPending}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
            >
              {createTask.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t('tasks.createTask')}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  )
}

// ─────────────────────────────────────────────
// CreateBoardModal
// ─────────────────────────────────────────────
function CreateBoardModal({ onClose, t }) {
  const createBoard = useCreateBoard()
  const nameRef = useRef(null)
  const [form, setForm] = useState({ name: '', description: '' })
  useEffect(() => {
    nameRef.current?.focus()
  }, [])
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    createBoard.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      },
      { onSuccess: () => onClose() }
    )
  }
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {t('tasks.createBoard')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('tasks.boardName')} *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder={t('tasks.boardNamePlaceholder')}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('tasks.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
              placeholder={t('tasks.boardDescriptionPlaceholder')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none resize-none text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || createBoard.isPending}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
            >
              {createBoard.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              {t('tasks.createBoard')}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  )
}

// ─────────────────────────────────────────────
// PRESET COLORS for labels (MS Planner palette)
// ─────────────────────────────────────────────
const LABEL_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#6b7280',
  '#0f172a',
]

// ─────────────────────────────────────────────
// LabelsPicker — assign/remove/create labels
// ─────────────────────────────────────────────
function LabelsPicker({ taskId, boardId, taskLabels, isMock }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', color: '#6366f1' })
  const ref = useRef(null)

  const { data: boardLabels = [] } = useBoardLabels(boardId)
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const assignLabel = useAssignLabel()
  const removeLabel = useRemoveLabel()

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const assignedIds = new Set((taskLabels ?? []).map((l) => l.id))

  const handleToggleLabel = (label) => {
    if (isMock) return
    if (assignedIds.has(label.id)) {
      removeLabel.mutate({ taskId, labelId: label.id, boardId })
    } else {
      assignLabel.mutate({
        taskId,
        labelId: label.id,
        boardId,
        labelData: label,
      })
    }
  }

  const handleCreate = (e) => {
    e.preventDefault()
    if (isMock || createLabel.isPending) return
    createLabel.mutate(
      { boardId, name: form.name.trim(), color: form.color },
      {
        onSuccess: () => {
          setCreating(false)
          setForm({ name: '', color: '#6366f1' })
        },
      }
    )
  }

  const handleUpdate = (e) => {
    e.preventDefault()
    if (isMock || updateLabel.isPending) return
    updateLabel.mutate(
      {
        boardId,
        labelId: editingId,
        name: form.name.trim(),
        color: form.color,
      },
      {
        onSuccess: () => {
          setEditingId(null)
          setForm({ name: '', color: '#6366f1' })
        },
      }
    )
  }

  const handleStartEdit = (label, e) => {
    e.stopPropagation()
    setEditingId(label.id)
    setCreating(false)
    setForm({ name: label.name, color: label.color })
  }

  const handleDeleteLabel = (label, e) => {
    e.stopPropagation()
    if (!confirm(`Удалить метку "${label.name || label.color}"?`)) return
    deleteLabel.mutate({ boardId, labelId: label.id })
    if (editingId === label.id) setEditingId(null)
  }

  const isFormMode = creating || !!editingId

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setCreating(false)
          setEditingId(null)
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/50 transition-all"
      >
        <Tag className="w-3 h-3" />
        Метки
        {(taskLabels?.length ?? 0) > 0 && (
          <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
            {taskLabels.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Метки доски
            </p>
          </div>

          {/* Board labels list */}
          <div className="px-1 pb-1 max-h-52 overflow-y-auto">
            {boardLabels.length === 0 && !isFormMode && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Нет меток. Создайте первую.
              </p>
            )}
            {boardLabels.map((label) =>
              editingId === label.id ? null : (
                <div
                  key={label.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 group cursor-pointer transition-colors"
                  onClick={() => handleToggleLabel(label)}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${assignedIds.has(label.id) ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                  >
                    {label.name || (
                      <span className="italic opacity-60">Без названия</span>
                    )}
                  </span>
                  {assignedIds.has(label.id) && (
                    <Check className="w-3 h-3 text-accent flex-shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleStartEdit(label, e)}
                    className="p-0.5 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteLabel(label, e)}
                    className="p-0.5 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            )}
          </div>

          {/* Edit / Create form */}
          {isFormMode && (
            <form
              onSubmit={editingId ? handleUpdate : handleCreate}
              className="px-3 pb-3 pt-2 border-t border-border space-y-2"
            >
              <p className="text-[11px] font-semibold text-muted-foreground">
                {editingId ? 'Изменить метку' : 'Новая метка'}
              </p>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Название метки..."
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
              />
              {/* Color picker */}
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
                    className={`w-5 h-5 rounded-md transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-accent scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                style={{ backgroundColor: form.color + '22' }}
              >
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: form.color }}
                />
                <span className="text-xs font-medium text-foreground truncate">
                  {form.name || 'Предпросмотр'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={(editingId ? updateLabel : createLabel).isPending}
                  className="flex-1 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-50 transition-all"
                >
                  {editingId ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false)
                    setEditingId(null)
                    setForm({ name: '', color: '#6366f1' })
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {/* Footer: Add label button */}
          {!isFormMode && (
            <div className="border-t border-border px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  setCreating(true)
                  setEditingId(null)
                  setForm({ name: '', color: '#6366f1' })
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="w-3 h-3" />
                Создать метку
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// TaskDetailModal — Full MS Planner detail panel
// ─────────────────────────────────────────────
function TaskDetailModal({
  task: initialTask,
  onClose,
  t,
  mockComments,
  mockChecklist,
  isMock,
  buckets,
  boardId,
}) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const moveTask = useMoveTask()
  const addChecklistItem = useAddChecklistItem()
  const toggleChecklistItem = useToggleChecklistItem()
  const deleteChecklistItem = useDeleteChecklistItem()
  const { data: liveTask } = useTask(mockChecklist ? null : initialTask.id)
  const task = liveTask ?? initialTask
  const { data: commentsReal } = useComments(
    mockComments ? null : initialTask.id
  )
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()
  const comments = mockComments ?? commentsReal

  const [activeTab, setActiveTab] = useState('details')
  const [newCheckItem, setNewCheckItem] = useState('')
  const [newComment, setNewComment] = useState('')
  const [editTitle, setEditTitle] = useState(initialTask.title)
  const [editDesc, setEditDesc] = useState(initialTask.description || '')
  const [descFocused, setDescFocused] = useState(false)
  const [localBucketId, setLocalBucketId] = useState(initialTask.bucket_id)
  const [localPriority, setLocalPriority] = useState(initialTask.priority)
  const [localDueDate, setLocalDueDate] = useState(
    initialTask.due_date ? initialTask.due_date.split('T')[0] : ''
  )
  const [localPercent, setLocalPercent] = useState(
    initialTask.percent_complete || 0
  )
  const checkInputRef = useRef(null)
  const commentInputRef = useRef(null)

  useEffect(() => {
    if (activeTab === 'checklist') checkInputRef.current?.focus()
    if (activeTab === 'comments') commentInputRef.current?.focus()
  }, [activeTab])

  useEffect(() => {
    if (!liveTask) return
    setLocalBucketId(liveTask.bucket_id)
    setLocalPriority(liveTask.priority)
    setLocalDueDate(liveTask.due_date ? liveTask.due_date.split('T')[0] : '')
    setLocalPercent(liveTask.percent_complete || 0)
    if (!descFocused) setEditDesc(liveTask.description || '')
  }, [liveTask]) // eslint-disable-line

  const handleUpdateField = (field, value) => {
    if (isMock) return
    updateTask.mutate({ taskId: task.id, boardId, updates: { [field]: value } })
  }
  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== task.title)
      handleUpdateField('title', editTitle.trim())
  }
  const handleSaveDesc = () => {
    setDescFocused(false)
    const trimmed = editDesc.trim()
    if (trimmed !== (task.description || '').trim())
      handleUpdateField('description', trimmed)
  }
  const handleAddCheckItem = (e) => {
    e.preventDefault()
    if (!newCheckItem.trim() || isMock) return
    addChecklistItem.mutate({ taskId: task.id, title: newCheckItem.trim() })
    setNewCheckItem('')
  }
  const handleAddComment = (e) => {
    e.preventDefault()
    if (!newComment.trim() || isMock) return
    addComment.mutate({ taskId: task.id, content: newComment.trim() })
    setNewComment('')
  }
  const handleDelete = () => {
    if (isMock) return
    if (confirm(t('tasks.detail.deleteConfirm')))
      deleteTask.mutate(
        { taskId: task.id, boardId: task.board_id },
        { onSuccess: () => onClose() }
      )
  }

  const prio = PRIORITIES[localPriority] || PRIORITIES.MEDIUM
  const checklist = mockChecklist ?? task.checklist ?? []
  const checkDone = checklist.filter(
    (c) => c.is_checked ?? c.is_completed
  ).length

  useEffect(() => {
    if (checklist.length === 0 || isMock) return
    const auto = Math.round((checkDone / checklist.length) * 100)
    if (auto !== localPercent) {
      setLocalPercent(auto)
      updateTask.mutate({
        taskId: task.id,
        updates: { percent_complete: auto },
      })
    }
  }, [checkDone, checklist.length]) // eslint-disable-line

  const tabs = [
    {
      id: 'details',
      label: 'Детали',
      icon: <SlidersHorizontal className="w-3.5 h-3.5" />,
    },
    {
      id: 'checklist',
      label: 'Чеклист',
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      badge: checklist.length ? `${checkDone}/${checklist.length}` : null,
    },
    {
      id: 'comments',
      label: 'Комментарии',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      badge: task.comment_count || null,
    },
  ]

  return (
    <ModalBackdrop onClose={onClose}>
      <div
        className="bg-card border border-border rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ width: 'min(90vw, 720px)', maxHeight: '88vh' }}
      >
        {/* Priority color strip on top */}
        <div className="h-1.5 w-full" style={{ backgroundColor: prio.hex }} />

        {/* MS Planner: label strips + picker */}
        <div className="flex items-center gap-2 flex-wrap px-5 pt-3">
          {(task.labels ?? []).map((l) => (
            <span
              key={l.id}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name || <span className="opacity-70">●</span>}
            </span>
          ))}
          <LabelsPicker
            taskId={task.id}
            boardId={boardId}
            taskLabels={task.labels}
            isMock={isMock}
          />
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 px-5 pt-3 pb-3 border-b border-border">
          {/* Completion circle in header */}
          <button
            onClick={() => {
              if (!isMock) {
                const next = localPercent === 100 ? 0 : 100
                setLocalPercent(next)
                handleUpdateField('percent_complete', next)
              }
            }}
            className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all mt-2
                            ${localPercent === 100 ? 'bg-accent border-accent' : 'border-border hover:border-accent'}`}
          >
            {localPercent === 100 && (
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className="text-lg font-semibold w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-accent/40 rounded-lg px-2 py-1 -mx-2 text-foreground transition-all"
              aria-label="Task title"
            />
            <div className="flex items-center gap-2 mt-1.5 px-2">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${prio.badge}`}
              >
                <Flag className="w-2.5 h-2.5" />
                {t(`tasks.priorities.${prio.key}`)}
              </span>
              {task.due_date && (
                <span
                  className={`flex items-center gap-1 text-xs ${dueDateColor(task.due_date)}`}
                >
                  <Clock className="w-3 h-3" />
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 pt-1">
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title={t('tasks.detail.deleteTask')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px
                                ${activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge != null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-muted-foreground">
                    {t('tasks.description')}
                  </label>
                  {updateTask.isPending && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Сохранение...
                    </span>
                  )}
                </div>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onFocus={() => setDescFocused(true)}
                  onBlur={handleSaveDesc}
                  placeholder={t('tasks.descriptionPlaceholder')}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none resize-none text-sm"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    {t('tasks.status')}
                  </label>
                  <select
                    value={localBucketId}
                    onChange={(e) => {
                      const id = e.target.value
                      if (!isMock && id !== task.bucket_id) {
                        setLocalBucketId(id)
                        moveTask.mutate({
                          taskId: task.id,
                          bucket_id: id,
                          position: 999,
                          boardId,
                        })
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
                  >
                    {(buckets || []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    {t('tasks.priority')}
                  </label>
                  <select
                    value={localPriority}
                    onChange={(e) => {
                      setLocalPriority(e.target.value)
                      handleUpdateField('priority', e.target.value)
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
                  >
                    {Object.entries(PRIORITIES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {t(`tasks.priorities.${v.key}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    {t('tasks.dueDate')}
                  </label>
                  <input
                    type="date"
                    value={localDueDate}
                    onChange={(e) => {
                      setLocalDueDate(e.target.value)
                      handleUpdateField('due_date', e.target.value || null)
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Прогресс:{' '}
                    <span className="text-accent font-semibold">
                      {localPercent}%
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={localPercent}
                    onChange={(e) => {
                      setLocalPercent(parseInt(e.target.value))
                      handleUpdateField(
                        'percent_complete',
                        parseInt(e.target.value)
                      )
                    }}
                    className="w-full accent-accent"
                  />
                </div>

                {/* Assignees display */}
                {task.assignees?.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                      Исполнители
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {task.assignees.map((a, i) => (
                        <div
                          key={a.user_id || i}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted text-xs text-foreground"
                        >
                          <div className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center">
                            {getInitials(a.user_name)}
                          </div>
                          {a.user_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <form onSubmit={handleAddCheckItem} className="flex gap-2">
                <input
                  ref={checkInputRef}
                  type="text"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  placeholder={t('tasks.detail.addChecklistItem')}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={!newCheckItem.trim()}
                  className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
                >
                  {t('common.add')}
                </button>
              </form>
              {checklist.length > 0 && (
                <div className="flex items-center gap-3 px-1">
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-accent transition-all duration-500"
                      style={{
                        width: `${(checkDone / checklist.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {checkDone}/{checklist.length}
                  </span>
                </div>
              )}
              <div className="space-y-1">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 group transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!(item.is_checked ?? item.is_completed)}
                      onChange={() =>
                        !isMock &&
                        toggleChecklistItem.mutate({
                          itemId: item.id,
                          taskId: task.id,
                        })
                      }
                      className="w-4 h-4 rounded accent-accent cursor-pointer flex-shrink-0"
                    />
                    <span
                      className={`flex-1 text-sm ${(item.is_checked ?? item.is_completed) ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                    >
                      {item.title}
                    </span>
                    <button
                      onClick={() =>
                        !isMock &&
                        deleteChecklistItem.mutate({
                          itemId: item.id,
                          taskId: task.id,
                        })
                      }
                      className="p-1 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {checklist.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {t('tasks.detail.addChecklistItem')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('tasks.detail.addComment')}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || addComment.isPending}
                  className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 transition-all"
                >
                  {t('tasks.detail.post')}
                </button>
              </form>
              <div className="space-y-2">
                {(comments || []).map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-3 p-3.5 rounded-xl bg-muted/40 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(c.user_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {c.user_name || 'User'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() =>
                              !isMock &&
                              deleteComment.mutate({
                                commentId: c.id,
                                taskId: task.id,
                              })
                            }
                            className="p-1 rounded text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
                {(!comments || comments.length === 0) && (
                  <div className="text-center py-10 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{t('tasks.detail.noComments')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─────────────────────────────────────────────
// GROUP TASKS — core logic
// ─────────────────────────────────────────────
function groupTasks(allTasks, buckets, groupBy) {
  switch (groupBy) {
    case 'bucket':
      return buckets.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color || COLUMN_COLORS[0],
        tasks: allTasks
          .filter((t) => t.bucket_id === b.id)
          .sort((a, b) =>
            (a.order_hint || '').localeCompare(b.order_hint || '')
          ),
      }))

    case 'priority':
      return Object.entries(PRIORITIES)
        .map(([key, val]) => ({
          id: key,
          name: {
            urgent: 'Срочно',
            high: 'Высокий',
            medium: 'Средний',
            low: 'Низкий',
          }[val.key],
          color: val.hex,
          tasks: allTasks.filter((t) => t.priority === key),
        }))
        .filter((g) => g.tasks.length > 0)

    case 'assignee': {
      const map = {}
      allTasks.forEach((task) => {
        if (!task.assignees?.length) {
          map['__unassigned__'] = map['__unassigned__'] || {
            id: '__unassigned__',
            name: 'Не назначено',
            color: '#6b7280',
            tasks: [],
          }
          map['__unassigned__'].tasks.push(task)
        } else {
          task.assignees.forEach((a) => {
            if (!map[a.user_id])
              map[a.user_id] = {
                id: a.user_id,
                name: a.user_name,
                color: '#6366f1',
                tasks: [],
              }
            if (!map[a.user_id].tasks.find((t) => t.id === task.id))
              map[a.user_id].tasks.push(task)
          })
        }
      })
      return Object.values(map)
    }

    case 'dueDate': {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(now)
      endOfWeek.setDate(now.getDate() + 7)
      const groups = [
        { id: 'overdue', name: 'Просрочено', color: '#ef4444', tasks: [] },
        { id: 'today', name: 'Сегодня', color: '#f59e0b', tasks: [] },
        { id: 'week', name: 'На этой неделе', color: '#6366f1', tasks: [] },
        { id: 'later', name: 'Позже', color: '#10b981', tasks: [] },
        { id: 'none', name: 'Без даты', color: '#6b7280', tasks: [] },
      ]
      allTasks.forEach((task) => {
        if (!task.due_date) {
          groups[4].tasks.push(task)
          return
        }
        const due = new Date(task.due_date)
        due.setHours(0, 0, 0, 0)
        if (due < now) groups[0].tasks.push(task)
        else if (due.getTime() === now.getTime()) groups[1].tasks.push(task)
        else if (due <= endOfWeek) groups[2].tasks.push(task)
        else groups[3].tasks.push(task)
      })
      return groups.filter((g) => g.tasks.length > 0)
    }

    default:
      return buckets.map((b) => ({
        id: b.id,
        name: b.name,
        color: b.color,
        tasks: allTasks.filter((t) => t.bucket_id === b.id),
      }))
  }
}

// ─────────────────────────────────────────────
// APPLY FILTERS
// ─────────────────────────────────────────────
function applyFilters(tasks, filters, searchQuery) {
  let result = tasks
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
    )
  }
  if (filters.priorities.length > 0)
    result = result.filter((t) => filters.priorities.includes(t.priority))
  if (filters.assignees.length > 0)
    result = result.filter((t) =>
      t.assignees?.some((a) => filters.assignees.includes(a.user_id))
    )
  if (filters.dueDate) {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(now)
    endOfWeek.setDate(now.getDate() + 7)
    result = result.filter((t) => {
      if (!t.due_date) return false
      const due = new Date(t.due_date)
      due.setHours(0, 0, 0, 0)
      if (filters.dueDate === 'overdue') return due < now
      if (filters.dueDate === 'today') return due.getTime() === now.getTime()
      if (filters.dueDate === 'week') return due >= now && due <= endOfWeek
      return true
    })
  }
  return result
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function TaskPlannerPage() {
  useAuth()
  const { t } = useTranslation()
  const { selectedHotelId } = useHotel()
  const toast = useToast()

  const { data: boardsReal, isLoading: boardsLoadingReal } =
    useBoards(selectedHotelId)
  const { data: statsReal } = useTaskStats(selectedHotelId)
  const useMock = DEV_MOCK
  const boards = useMock ? MOCK_BOARDS : boardsReal
  const boardsLoading = useMock ? false : boardsLoadingReal
  const stats = useMock ? MOCK_STATS : statsReal

  const [selectedBoardId, setSelectedBoardId] = useState(null)
  const [currentView, setCurrentView] = useState('board')
  const [groupBy, setGroupBy] = useState('bucket')
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    priorities: [],
    assignees: [],
    dueDate: '',
  })
  const [showCreateBoard, setShowCreateBoard] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [createTaskBucketId, setCreateTaskBucketId] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)

  const moveTask = useMoveTask()
  const deleteBoard = useDeleteBoard()
  const deleteBucket = useDeleteBucket()
  const updateTask = useUpdateTask()

  const currentBoardId =
    selectedBoardId || (boards?.length > 0 ? boards[0].id : null)
  const { data: boardDataReal, isLoading: boardLoadingReal } = useBoard(
    useMock ? null : currentBoardId
  )
  const boardData = useMock ? MOCK_BOARD_DATA : boardDataReal
  const boardLoading = useMock ? false : boardLoadingReal
  const buckets = boardData?.buckets || []

  const allTasks = useMemo(
    () =>
      buckets.flatMap((b) =>
        (b.tasks || []).map((t) => ({ ...t, _bucketName: b.name }))
      ),
    [buckets]
  )
  const filteredTasks = useMemo(
    () => applyFilters(allTasks, filters, searchQuery),
    [allTasks, filters, searchQuery]
  )
  const groups = useMemo(
    () => groupTasks(filteredTasks, buckets, groupBy),
    [filteredTasks, buckets, groupBy]
  )

  const activeFilterCount =
    filters.priorities.length +
    filters.assignees.length +
    (filters.dueDate ? 1 : 0)

  const handleAddTask = (bucketId) => {
    setCreateTaskBucketId(bucketId)
    setShowCreateTask(true)
  }
  const handleTaskDrop = useCallback(
    (taskId, bucketId, position) => {
      moveTask.mutate({
        taskId,
        bucket_id: bucketId,
        position,
        boardId: currentBoardId,
      })
    },
    [moveTask, currentBoardId]
  )

  const handleTaskComplete = useCallback(
    (task) => {
      if (useMock) return
      const isCompleted =
        task.status === 'COMPLETED' || task.percent_complete === 100
      updateTask.mutate({
        taskId: task.id,
        boardId: currentBoardId,
        updates: { percent_complete: isCompleted ? 0 : 100 },
      })
    },
    [updateTask, useMock, currentBoardId]
  )

  const handleDeleteBoard = (board) => {
    if (
      !confirm(
        `Удалить доску "${board.name}"? Все колонки и задачи будут удалены.`
      )
    )
      return
    deleteBoard.mutate(board.id, {
      onSuccess: () => {
        toast.success('Доска удалена')
        if (selectedBoardId === board.id) setSelectedBoardId(null)
      },
      onError: () => toast.error('Не удалось удалить доску'),
    })
  }
  const handleDeleteBucket = (bucket) => {
    if (!confirm(`Удалить колонку "${bucket.name}"?`)) return
    deleteBucket.mutate(
      { bucketId: bucket.id, boardId: currentBoardId },
      {
        onSuccess: () => toast.success('Колонка удалена'),
        onError: () => toast.error('Не удалось удалить колонку'),
      }
    )
  }

  if (boardsLoading)
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-accent" />
          <span className="text-sm text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    )

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="px-4 lg:px-6 py-4 border-b border-border/60 bg-card/40 backdrop-blur-sm flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                <LayoutGrid className="w-4 h-4 text-accent" />
              </div>
              Планировщик задач
            </h1>
            <StatsBar stats={stats} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск задач..."
                className="pl-8 pr-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm w-44 sm:w-52 focus:ring-2 focus:ring-accent focus:border-transparent outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Board selector */}
            {boards && boards.length > 0 && (
              <BoardSelector
                boards={boards}
                currentBoardId={currentBoardId}
                onSelect={setSelectedBoardId}
                onDelete={useMock ? undefined : handleDeleteBoard}
              />
            )}

            {/* New board */}
            <button
              onClick={() => setShowCreateBoard(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Новая доска</span>
            </button>
          </div>
        </div>

        {/* ── Toolbar: Views + GroupBy + Filters ── */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* View switcher — MS Planner style */}
          <div className="flex items-center bg-muted/50 rounded-xl p-0.5 border border-border/60">
            {VIEWS.map((view) => {
              const Icon = view.icon
              return (
                <button
                  key={view.id}
                  onClick={() => setCurrentView(view.id)}
                  title={view.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                        ${currentView === view.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{view.label}</span>
                </button>
              )
            })}
          </div>

          {/* GroupBy — only for board and grid */}
          {(currentView === 'board' || currentView === 'grid') && (
            <GroupBySelector groupBy={groupBy} onChange={setGroupBy} />
          )}

          {/* Filters */}
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            allTasks={allTasks}
            t={t}
          />

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.priorities.map((p) => {
                const val = PRIORITIES[p]
                return (
                  <span
                    key={p}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${val.badge}`}
                  >
                    {t(`tasks.priorities.${val.key}`)}
                    <button
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          priorities: f.priorities.filter((x) => x !== p),
                        }))
                      }
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )
              })}
              {filters.dueDate && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
                  {filters.dueDate === 'overdue'
                    ? 'Просрочено'
                    : filters.dueDate === 'today'
                      ? 'Сегодня'
                      : 'Эта неделя'}
                  <button
                    onClick={() => setFilters((f) => ({ ...f, dueDate: '' }))}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto">
        {!currentBoardId ? (
          <div className="flex flex-col items-center justify-center h-full py-20 px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
              <LayoutGrid className="w-8 h-8 text-accent/60" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              {t('tasks.noBoardsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-6 leading-relaxed">
              {t('tasks.noBoardsDescription')}
            </p>
            <button
              onClick={() => setShowCreateBoard(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              {t('tasks.createFirstBoard')}
            </button>
          </div>
        ) : boardLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* BOARD VIEW */}
            {currentView === 'board' && (
              <div className="flex gap-4 p-4 lg:p-5 h-full items-start overflow-x-auto overflow-y-hidden">
                {groupBy === 'bucket' ? (
                  // Standard bucket columns (support drag & drop)
                  <>
                    {buckets
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .map((bucket, index) => {
                        const bucketTasks = filteredTasks
                          .filter((t) => t.bucket_id === bucket.id)
                          .sort((a, b) =>
                            (a.order_hint || '').localeCompare(
                              b.order_hint || ''
                            )
                          )
                        return (
                          <BucketColumn
                            key={bucket.id}
                            bucket={bucket}
                            tasks={bucketTasks}
                            colorIndex={index}
                            onTaskClick={setSelectedTask}
                            onTaskComplete={handleTaskComplete}
                            onAddTask={handleAddTask}
                            onDrop={handleTaskDrop}
                            onDelete={useMock ? undefined : handleDeleteBucket}
                            t={t}
                          />
                        )
                      })}
                    <div className="flex-shrink-0 w-[200px]">
                      <AddBucketButton boardId={currentBoardId} t={t} />
                    </div>
                  </>
                ) : (
                  // Group by other — render as columns
                  groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex flex-col w-[280px] lg:w-[300px] flex-shrink-0 rounded-2xl border border-border/60 bg-card/50"
                    >
                      <div
                        className="h-1.5 rounded-t-2xl"
                        style={{ backgroundColor: group.color }}
                      />
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm text-foreground">
                            {group.name}
                          </h3>
                          <span
                            className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                            style={{ backgroundColor: group.color + 'cc' }}
                          >
                            {group.tasks.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 px-3 space-y-2 overflow-y-auto max-h-[calc(100vh-330px)] min-h-[60px]">
                        {group.tasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={setSelectedTask}
                            onComplete={handleTaskComplete}
                            t={t}
                          />
                        ))}
                        {group.tasks.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground/40">
                            <ClipboardList className="w-7 h-7 mb-1.5" />
                            <span className="text-xs">Нет задач</span>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-3">
                        <button
                          onClick={() => handleAddTask(buckets[0]?.id)}
                          className="w-full py-2 rounded-xl text-xs text-muted-foreground hover:text-accent hover:bg-accent/8 border border-dashed border-border/50 hover:border-accent/40 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t('tasks.createTask')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* GRID VIEW */}
            {currentView === 'grid' && (
              <GridView
                groups={groups}
                onTaskClick={setSelectedTask}
                onTaskComplete={handleTaskComplete}
                t={t}
              />
            )}

            {/* SCHEDULE VIEW */}
            {currentView === 'schedule' && (
              <ScheduleView
                allTasks={filteredTasks}
                onTaskClick={setSelectedTask}
              />
            )}

            {/* CHARTS VIEW */}
            {currentView === 'charts' && (
              <ChartsView
                buckets={buckets}
                stats={stats}
                allTasks={allTasks}
                t={t}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreateBoard && (
        <CreateBoardModal onClose={() => setShowCreateBoard(false)} t={t} />
      )}
      {showCreateTask && (
        <CreateTaskModal
          boardId={currentBoardId}
          bucketId={createTaskBucketId}
          buckets={buckets}
          t={t}
          isMock={useMock}
          onClose={() => {
            setShowCreateTask(false)
            setCreateTaskBucketId(null)
          }}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          t={t}
          isMock={useMock}
          buckets={buckets}
          boardId={currentBoardId}
          mockComments={
            useMock ? (MOCK_COMMENTS[selectedTask.id] ?? []) : undefined
          }
          mockChecklist={
            useMock ? (MOCK_CHECKLIST[selectedTask.id] ?? []) : undefined
          }
        />
      )}
    </div>
  )
}
