/**
 * OnboardingTour Component
 * Guided tour for new users with spotlight effect
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react'
import { useOnboarding, onboardingSteps } from '../context/OnboardingContext'
import { useTranslation } from '../context/LanguageContext'
import { TouchButton } from './ui'
import { cn } from '../utils/classNames'

export default function OnboardingTour() {
  const {
    isActive,
    currentStep,
    totalSteps,
    currentStepData,
    nextStep,
    prevStep,
    skipOnboarding
  } = useOnboarding()
  const { t } = useTranslation()
  const [targetRect, setTargetRect] = useState(null)
  const [tooltipPos, setTooltipPos] = useState(null)
  const tooltipRef = useRef(null)

  // Find and highlight target element with scroll support
  useEffect(() => {
    if (!isActive || !currentStepData?.target) {
      setTargetRect(null)
      return
    }

    const findTarget = () => {
      const target = document.querySelector(currentStepData.target)
      if (target) {
        // Scroll element into view smoothly
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center'
        })

        // Wait for scroll to complete before calculating position
        setTimeout(() => {
          const rect = target.getBoundingClientRect()
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

          setTargetRect({
            // Absolute positions including scroll
            top: rect.top + scrollTop - 8,
            left: rect.left + scrollLeft - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            // Viewport positions for tooltip
            viewportTop: rect.top,
            viewportLeft: rect.left,
            viewportWidth: rect.width,
            viewportHeight: rect.height,
          })
        }, 300)
      } else {
        setTargetRect(null)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(findTarget, 50)

    // Throttle scroll updates to avoid performance issues
    let scrollTimeout
    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(findTarget, 100)
    }

    window.addEventListener('resize', findTarget)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(timer)
      clearTimeout(scrollTimeout)
      window.removeEventListener('resize', findTarget)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isActive, currentStep, currentStepData])

  // Calculate tooltip position with bounds checking
  const calculateTooltipPosition = useCallback(() => {
    if (!tooltipRef.current) return

    const tooltip = tooltipRef.current
    const tooltipRect = tooltip.getBoundingClientRect()
    const padding = 16
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isCenterPlacement = currentStepData?.placement === 'center'

    // Center placement or no target
    if (!targetRect || isCenterPlacement) {
      setTooltipPos({
        top: Math.max(padding, (viewportHeight - tooltipRect.height) / 2),
        left: Math.max(padding, (viewportWidth - tooltipRect.width) / 2),
        fixed: true
      })
      return
    }

    const placement = currentStepData?.placement || 'bottom'
    let top = 0
    let left = 0

    // Use viewport positions for tooltip calculation
    switch (placement) {
      case 'top':
        top = targetRect.viewportTop - tooltipRect.height - padding
        left = targetRect.viewportLeft + targetRect.viewportWidth / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = targetRect.viewportTop + targetRect.viewportHeight + padding
        left = targetRect.viewportLeft + targetRect.viewportWidth / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = targetRect.viewportTop + targetRect.viewportHeight / 2 - tooltipRect.height / 2
        left = targetRect.viewportLeft - tooltipRect.width - padding
        break
      case 'right':
        top = targetRect.viewportTop + targetRect.viewportHeight / 2 - tooltipRect.height / 2
        left = targetRect.viewportLeft + targetRect.viewportWidth + padding
        break
    }

    // Smart positioning: if tooltip goes off screen, try alternate placement
    if (top < padding) {
      // Try bottom
      top = targetRect.viewportTop + targetRect.viewportHeight + padding
    } else if (top + tooltipRect.height > viewportHeight - padding) {
      // Try top
      top = targetRect.viewportTop - tooltipRect.height - padding
    }

    if (left < padding) {
      // Try right
      left = targetRect.viewportLeft + targetRect.viewportWidth + padding
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      // Try left
      left = targetRect.viewportLeft - tooltipRect.width - padding
    }

    // Final bounds checking - keep tooltip within viewport
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding))
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding))

    setTooltipPos({ top, left, fixed: true })
  }, [targetRect, currentStepData])

  // Recalculate tooltip position when target or step changes
  useEffect(() => {
    if (!isActive) return

    // Use requestAnimationFrame to ensure DOM is painted
    const frame = requestAnimationFrame(() => {
      calculateTooltipPosition()
    })

    return () => cancelAnimationFrame(frame)
  }, [isActive, targetRect, currentStep, calculateTooltipPosition])

  if (!isActive) return null

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      {/* Single overlay with spotlight cutout using SVG mask */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White = visible (overlay shown), Black = hidden (spotlight hole) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.viewportLeft - 8}
                y={targetRect.viewportTop - 8}
                width={targetRect.viewportWidth + 16}
                height={targetRect.viewportHeight + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight ring highlight */}
      {targetRect && (
        <div
          className="fixed rounded-xl ring-2 ring-accent pointer-events-none animate-pulse"
          style={{
            zIndex: 2,
            top: targetRect.viewportTop - 8,
            left: targetRect.viewportLeft - 8,
            width: targetRect.viewportWidth + 16,
            height: targetRect.viewportHeight + 16,
            boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)',
          }}
        />
      )}

      {/* Click blocker - allows clicking on highlighted element */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 3 }}
        onClick={(e) => {
          // Allow clicks on the highlighted area to pass through
          if (targetRect) {
            const x = e.clientX
            const y = e.clientY
            if (
              x >= targetRect.viewportLeft - 8 &&
              x <= targetRect.viewportLeft + targetRect.viewportWidth + 8 &&
              y >= targetRect.viewportTop - 8 &&
              y <= targetRect.viewportTop + targetRect.viewportHeight + 8
            ) {
              return
            }
          }
          e.stopPropagation()
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          'fixed bg-card rounded-2xl shadow-2xl border border-border',
          'p-5 sm:p-6 w-[calc(100vw-2rem)] sm:max-w-sm',
          'transition-opacity duration-200',
          tooltipPos ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          zIndex: 10,
          top: tooltipPos?.top ?? '50%',
          left: tooltipPos?.left ?? '50%',
          transform: tooltipPos?.fixed ? 'none' : 'translate(-50%, -50%)',
        }}
      >
        {/* Close button */}
        <TouchButton
          variant="ghost"
          size="small"
          onClick={skipOnboarding}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </TouchButton>

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          {isLastStep ? (
            <Check className="w-6 h-6 text-accent" />
          ) : (
            <Sparkles className="w-6 h-6 text-accent" />
          )}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t(currentStepData?.title) || currentStepData?.title}
        </h3>
        <p className="text-muted-foreground text-sm mb-6">
          {t(currentStepData?.description) || currentStepData?.description}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentStep
                  ? 'w-6 bg-accent'
                  : index < currentStep
                    ? 'bg-accent/50'
                    : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {!isFirstStep && (
            <TouchButton
              variant="ghost"
              size="small"
              onClick={prevStep}
              className="flex-1"
              icon={ChevronLeft}
              iconPosition="left"
            >
              {t('common.back')}
            </TouchButton>
          )}

          {isFirstStep && !isLastStep && (
            <TouchButton variant="ghost" size="small" onClick={skipOnboarding} className="flex-1">
              {t('onboarding.skip') || 'Skip tour'}
            </TouchButton>
          )}

          <TouchButton
            variant="primary"
            size="small"
            onClick={nextStep}
            className="flex-1"
            icon={isLastStep ? Check : ChevronRight}
            iconPosition="right"
          >
            {isLastStep ? t('onboarding.getStarted') || 'Get Started' : t('common.next')}
          </TouchButton>
        </div>
      </div>
    </div>,
    document.body
  )
}
