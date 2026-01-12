/**
 * Типы для UI компонентов
 */

import type { ReactNode, ComponentPropsWithoutRef, ElementType } from 'react'

// ========================================
// Полиморфные компоненты
// ========================================

/**
 * Тип для полиморфного компонента (as prop)
 */
export type AsProps<C extends ElementType> = {
  as?: C
}

export type PolymorphicRef<C extends ElementType> = 
  ComponentPropsWithoutRef<C>['ref']

export type PolymorphicProps<C extends ElementType, Props = {}> = 
  AsProps<C> & 
  Props & 
  Omit<ComponentPropsWithoutRef<C>, keyof Props | 'as'>

// ========================================
// Общие UI типы
// ========================================

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type Variant = 
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ghost'
  | 'link'
  | 'outline'

export type ColorScheme = 
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'

// ========================================
// Button
// ========================================

export interface ButtonProps {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  isDisabled?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
}

// ========================================
// Input
// ========================================

export interface InputProps {
  label?: string
  error?: string
  helperText?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
  isRequired?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  size?: Size
}

// ========================================
// Modal
// ========================================

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  children: ReactNode
}

// ========================================
// Toast / Notification
// ========================================

export type ToastPosition = 
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'

export interface ToastOptions {
  id?: string
  title?: string
  description?: string
  status?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  isClosable?: boolean
  position?: ToastPosition
}

export interface Toast extends Required<ToastOptions> {
  createdAt: number
}

// ========================================
// Table
// ========================================

export interface Column<T> {
  key: keyof T | string
  header: string
  width?: string | number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (value: unknown, row: T, index: number) => ReactNode
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  isLoading?: boolean
  emptyText?: string
  onRowClick?: (row: T, index: number) => void
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string) => void
}

// ========================================
// Pagination
// ========================================

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  showFirstLast?: boolean
  isDisabled?: boolean
}

// ========================================
// Form
// ========================================

export interface FormFieldProps {
  name: string
  label?: string
  error?: string
  helperText?: string
  isRequired?: boolean
  children: ReactNode
}

export interface SelectOption<T = string> {
  value: T
  label: string
  disabled?: boolean
  group?: string
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[]
  value?: T
  onChange?: (value: T) => void
  placeholder?: string
  isSearchable?: boolean
  isMulti?: boolean
  isClearable?: boolean
  isDisabled?: boolean
  isLoading?: boolean
}

// ========================================
// Badge / Status
// ========================================

export interface BadgeProps {
  variant?: Variant
  colorScheme?: ColorScheme
  size?: Size
  children: ReactNode
}

export interface StatusBadgeProps {
  status: 'fresh' | 'expiring' | 'expired' | 'collected'
  size?: Size
  showLabel?: boolean
}

// ========================================
// Empty State
// ========================================

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

// ========================================
// Loading
// ========================================

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  count?: number
  className?: string
}

export interface SpinnerProps {
  size?: Size
  color?: string
  thickness?: number
  label?: string
}

// ========================================
// Card
// ========================================

export interface CardProps {
  variant?: 'elevated' | 'outline' | 'filled'
  padding?: Size
  onClick?: () => void
  isClickable?: boolean
  children: ReactNode
}

// ========================================
// Navigation
// ========================================

export interface NavItem {
  key: string
  label: string
  icon?: ReactNode
  path: string
  badge?: number | string
  roles?: string[] | null  // null = все роли
}

export interface BreadcrumbItem {
  label: string
  href?: string
  isCurrentPage?: boolean
}
