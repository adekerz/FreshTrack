/**
 * UI Components Index
 * Centralized exports for all UI components
 */

export { default as Button } from './Button'
export { default as Input } from './Input'
export { default as Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
export { default as StatusBadge } from './StatusBadge'
export { default as Modal } from './Modal'
export { default as EmptyState } from './EmptyState'
export { default as ConfirmDialog } from './ConfirmDialog'
export { default as Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSeparator, DropdownLabel } from './Dropdown'
export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonStat,
  SkeletonList
} from './Skeleton'

// Mobile-first компоненты
export { default as QuantityStepper } from './QuantityStepper'
export { default as ExpirationBadge, useExpirationColor } from './ExpirationBadge'
export { default as BottomSheet, BottomSheetActions, FilterChips } from './BottomSheet'
export { default as SwipeableCard, useSwipeSupport } from './SwipeableCard'
export { default as FAB, SpeedDial } from './FAB'
export { default as OfflineIndicator, useOnlineStatus, usePendingSync } from './OfflineIndicator'
export { default as MobileInventoryCard, MobileInventoryList } from './MobileInventoryCard'
export { default as PullToRefresh, usePullToRefresh } from './PullToRefresh'
export { default as TouchButton, IconButton } from './TouchButton'
export { Tabs, TabsList, Tab, TabPanel } from './Tabs'

// Unified Loader — единственный loader в проекте
export {
  default as Loader,
  default as GridLoader, // Legacy alias
  PageLoader,
  SectionLoader,
  InlineLoader,
  ButtonLoader,
  ButtonLoader as ButtonSpinner, // Legacy alias
  FullscreenLoader
} from './GridLoader'
