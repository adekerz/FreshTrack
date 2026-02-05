/**
 * Animation Utilities
 * Lightweight CSS-based animations for optimal performance
 * No framer-motion dependency to keep bundle size small
 */

/**
 * Page transition classes (CSS-based)
 * Use with existing Tailwind animations
 */
export const pageTransition = {
  enter: 'animate-fade-in-up',
  exit: 'opacity-0 -translate-y-2 transition-all duration-200'
}

/**
 * Modal animation classes
 */
export const modalTransition = {
  backdrop: {
    enter: 'animate-fade-in',
    exit: 'opacity-0 transition-opacity duration-200'
  },
  content: {
    enter: 'animate-scale-in',
    exit: 'opacity-0 scale-95 transition-all duration-200'
  }
}

/**
 * Card hover effects
 */
export const cardHover = {
  default: 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg',
  interactive: 'transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg active:translate-y-0 active:shadow-soft cursor-pointer',
  subtle: 'transition-all duration-200 hover:shadow-soft'
}

/**
 * Button micro-interactions
 */
export const buttonInteraction = {
  primary: 'transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]',
  secondary: 'transition-all duration-150 hover:bg-muted/80 active:bg-muted',
  ghost: 'transition-all duration-150 hover:bg-muted/50 active:bg-muted/70',
  danger: 'transition-all duration-150 hover:bg-danger/90 active:bg-danger'
}

/**
 * List stagger delays (use with animate-fade-in-up or animate-slide-up)
 */
export const staggerDelays = [
  '',
  'animation-delay-[50ms]',
  'animation-delay-[100ms]',
  'animation-delay-[150ms]',
  'animation-delay-[200ms]',
  'animation-delay-[250ms]',
  'animation-delay-[300ms]',
  'animation-delay-[350ms]'
]

/**
 * Get stagger delay class for index
 */
export function getStaggerDelay(index) {
  return `[animation-delay:${index * 50}ms]`
}

/**
 * Fade in animation with delay
 */
export function fadeInWithDelay(index, maxDelay = 400) {
  const delay = Math.min(index * 50, maxDelay)
  return `animate-fade-in-up [animation-delay:${delay}ms]`
}

/**
 * Loading skeleton pulse
 */
export const skeletonPulse = 'animate-pulse-soft'

/**
 * Success celebration animation
 */
export const successAnimation = 'animate-success-pop'

/**
 * Danger/warning shake animation
 */
export const dangerShake = 'animate-danger-shake'

/**
 * Smooth scroll behavior
 */
export function smoothScrollTo(elementId) {
  const element = document.getElementById(elementId)
  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }
}

/**
 * Apply entrance animation to element
 */
export function applyEntranceAnimation(element, delay = 0) {
  if (!element) return

  element.style.opacity = '0'
  element.style.transform = 'translateY(20px)'

  setTimeout(() => {
    element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out'
    element.style.opacity = '1'
    element.style.transform = 'translateY(0)'
  }, delay)
}

/**
 * Stagger children entrance animations
 */
export function staggerChildren(parentElement, childSelector = '*', delayIncrement = 50) {
  if (!parentElement) return

  const children = parentElement.querySelectorAll(childSelector)
  children.forEach((child, index) => {
    applyEntranceAnimation(child, index * delayIncrement)
  })
}

/**
 * Toast notification transition
 */
export const toastTransition = {
  enter: 'animate-toast-in',
  exit: 'translate-x-full opacity-0 transition-all duration-200'
}

/**
 * Drawer/Sheet transitions (mobile modals)
 */
export const drawerTransition = {
  enter: 'animate-slide-up',
  exit: 'translate-y-full transition-transform duration-300'
}

/**
 * Focus ring animation
 */
export const focusRing = 'transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2'

/**
 * Hover lift effect
 */
export const hoverLift = 'transition-transform duration-200 hover:-translate-y-0.5'

/**
 * Icon spin (for loading states)
 */
export const iconSpin = 'animate-spin'

/**
 * Bounce animation (for notifications)
 */
export const bounce = 'animate-bounce'

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Apply animation only if user doesn't prefer reduced motion
 */
export function conditionalAnimation(animationClass) {
  return prefersReducedMotion() ? '' : animationClass
}

export default {
  pageTransition,
  modalTransition,
  cardHover,
  buttonInteraction,
  staggerDelays,
  getStaggerDelay,
  fadeInWithDelay,
  skeletonPulse,
  successAnimation,
  dangerShake,
  smoothScrollTo,
  applyEntranceAnimation,
  staggerChildren,
  toastTransition,
  drawerTransition,
  focusRing,
  hoverLift,
  iconSpin,
  bounce,
  prefersReducedMotion,
  conditionalAnimation
}
