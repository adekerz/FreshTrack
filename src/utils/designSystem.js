/**
 * Design System Utilities
 * Centralized design tokens for consistency across the app
 * Based on existing CSS variables and Tailwind theme
 */

/**
 * Colors - semantic color tokens
 * Uses CSS variables for theme support
 */
export const colors = {
  // Status colors
  status: {
    good: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    critical: 'text-critical bg-critical/10',
    danger: 'text-danger bg-danger/10',
    expired: 'text-danger bg-danger/10',
  },

  // Badge colors
  badge: {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  },

  // Button variants
  button: {
    primary: 'bg-foreground text-background hover:bg-foreground/90',
    secondary: 'bg-muted text-foreground hover:bg-muted/80',
    ghost: 'bg-transparent text-foreground hover:bg-muted',
    danger: 'bg-danger text-white hover:bg-danger/90',
  },
}

/**
 * Spacing - consistent spacing scale
 * Based on Tailwind's spacing scale
 */
export const spacing = {
  page: 'p-4 sm:p-6 lg:p-8',
  pageY: 'py-4 sm:py-6 lg:py-8',
  pageX: 'px-4 sm:px-6 lg:px-8',
  section: 'space-y-4 sm:space-y-6',
  card: 'p-4 sm:p-6',
  cardCompact: 'p-3 sm:p-4',
  inline: 'space-x-2 sm:space-x-3',
  stack: 'space-y-2 sm:space-y-3',
  stackLarge: 'space-y-4 sm:space-y-6',
  gap: {
    xs: 'gap-1 sm:gap-2',
    sm: 'gap-2 sm:gap-3',
    md: 'gap-3 sm:gap-4',
    lg: 'gap-4 sm:gap-6',
  },
}

/**
 * Border radius - consistent rounded corners
 */
export const borderRadius = {
  sm: 'rounded-md',    // 6px
  md: 'rounded-lg',    // 8px
  lg: 'rounded-xl',    // 12px
  xl: 'rounded-2xl',   // 16px
  full: 'rounded-full',
}

/**
 * Shadows - elevation levels
 */
export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-soft',
  lg: 'shadow-soft-lg',
  inner: 'shadow-inner-soft',
}

/**
 * Typography - text styles
 */
export const typography = {
  // Headings
  h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground',
  h2: 'text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground',
  h3: 'text-lg sm:text-xl lg:text-2xl font-semibold text-foreground',
  h4: 'text-base sm:text-lg font-semibold text-foreground',

  // Body text
  body: 'text-sm sm:text-base text-foreground',
  bodySmall: 'text-xs sm:text-sm text-foreground',
  bodyLarge: 'text-base sm:text-lg text-foreground',

  // Utility text
  label: 'text-xs sm:text-sm font-medium text-foreground',
  caption: 'text-xs text-muted-foreground',
  muted: 'text-sm text-muted-foreground',

  // Mobile-optimized headings (prevent text from being too small)
  mobileH1: 'text-xl sm:text-2xl font-bold text-foreground',
  mobileH2: 'text-lg sm:text-xl font-semibold text-foreground',
  mobileH3: 'text-base sm:text-lg font-semibold text-foreground',
}

/**
 * Layout - common layout patterns
 */
export const layout = {
  // Containers
  container: 'max-w-7xl mx-auto',
  containerFluid: 'w-full',
  containerTight: 'max-w-4xl mx-auto',

  // Grids
  gridAuto: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  grid2: 'grid grid-cols-1 sm:grid-cols-2',
  grid3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  grid4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',

  // Flex layouts
  flexRow: 'flex flex-row items-center',
  flexCol: 'flex flex-col',
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexWrap: 'flex flex-wrap',

  // Mobile-specific
  mobileStack: 'flex flex-col sm:flex-row',
  mobileReverse: 'flex flex-col-reverse sm:flex-row',
}

/**
 * Touch targets - WCAG 2.5.5 compliant
 */
export const touchTarget = {
  sm: 'min-h-[44px] min-w-[44px]',  // Apple HIG minimum
  md: 'min-h-[48px] min-w-[48px]',  // Material Design minimum
  lg: 'min-h-[56px] min-w-[56px]',  // Large touch target
}

/**
 * Focus states - WCAG 2.4.7 compliant
 */
export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2',
  ringVisible: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2',
  outline: 'focus:outline-2 focus:outline-accent focus:outline-offset-2',
}

/**
 * Transitions - smooth state changes
 */
export const transition = {
  default: 'transition-all duration-200',
  fast: 'transition-all duration-150',
  slow: 'transition-all duration-300',
  colors: 'transition-colors duration-200',
  transform: 'transition-transform duration-200',
  shadow: 'transition-shadow duration-200',
}

/**
 * Interactive states - hover, active, disabled
 */
export const interactive = {
  hover: 'hover:bg-muted/50 active:bg-muted',
  hoverLift: 'hover:-translate-y-0.5 transition-transform duration-200',
  hoverShadow: 'hover:shadow-soft transition-shadow duration-200',
  active: 'active:scale-[0.98] transition-transform duration-100',
  disabled: 'opacity-50 cursor-not-allowed pointer-events-none',
}

/**
 * Status badges - consistent badge styling
 */
export function getStatusBadge(status) {
  const badges = {
    good: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success',
    warning: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning',
    critical: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-critical/10 text-critical',
    danger: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger',
    expired: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger',
    active: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success',
    inactive: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground',
  }

  return badges[status] || badges.inactive
}

/**
 * Card variants - consistent card styling
 */
export function getCardVariant(variant = 'default') {
  const variants = {
    default: `bg-card border border-border ${borderRadius.lg} ${spacing.card}`,
    elevated: `bg-card ${shadows.md} ${borderRadius.lg} ${spacing.card}`,
    interactive: `bg-card border border-border ${borderRadius.lg} ${spacing.card} cursor-pointer ${interactive.hover} ${interactive.hoverLift}`,
    ghost: `bg-transparent ${spacing.card}`,
    accent: `bg-accent/5 border border-accent/20 ${borderRadius.lg} ${spacing.card}`,
  }

  return variants[variant] || variants.default
}

/**
 * Button sizes - consistent button sizing
 */
export function getButtonSize(size = 'md') {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs sm:text-sm min-h-[40px]',
    md: 'px-4 py-2 text-sm sm:text-base min-h-[44px] sm:min-h-[48px]',
    lg: 'px-6 py-3 text-base sm:text-lg min-h-[48px] sm:min-h-[56px]',
  }

  return sizes[size] || sizes.md
}

/**
 * Input sizes - consistent input sizing
 */
export function getInputSize(size = 'md') {
  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[40px]',
    md: 'px-3 py-2 text-sm sm:text-base min-h-[44px]',
    lg: 'px-4 py-3 text-base sm:text-lg min-h-[48px]',
  }

  return sizes[size] || sizes.md
}

export default {
  colors,
  spacing,
  borderRadius,
  shadows,
  typography,
  layout,
  touchTarget,
  focus,
  transition,
  interactive,
  getStatusBadge,
  getCardVariant,
  getButtonSize,
  getInputSize,
}
