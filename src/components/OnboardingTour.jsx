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

  // Find and highlight target element
  useEffect(() => {
    if (!isActive || !currentStepData?.target) {
      setTargetRect(null)
      return
    }

    const findTarget = () => {
      const target = document.querySelector(currentStepData.target)
      if (target) {
        const rect = target.getBoundingClientRect()
        setTargetRect({
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          // Original element rect for tooltip positioning
          originalTop: rect.top,
          originalLeft: rect.left,
          originalWidth: rect.width,
          originalHeight: rect.height,
        })
      } else {
        setTargetRect(null)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(findTarget, 50)
    window.addEventListener('resize', findTarget)
    window.addEventListener('scroll', findTarget, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', findTarget)
      window.removeEventListener('scroll', findTarget)
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
      })
      return
    }

    const placement = currentStepData?.placement || 'bottom'
    let top = 0
    let left = 0

    switch (placement) {
      case 'top':
        top = targetRect.originalTop - tooltipRect.height - padding
        left = targetRect.originalLeft + targetRect.originalWidth / 2 - tooltipRect.width / 2
        break
      case 'bottom':
        top = targetRect.originalTop + targetRect.originalHeight + padding
        left = targetRect.originalLeft + targetRect.originalWidth / 2 - tooltipRect.width / 2
        break
      case 'left':
        top = targetRect.originalTop + targetRect.originalHeight / 2 - tooltipRect.height / 2
        left = targetRect.originalLeft - tooltipRect.width - padding
        break
      case 'right':
        top = targetRect.originalTop + targetRect.originalHeight / 2 - tooltipRect.height / 2
        left = targetRect.originalLeft + targetRect.originalWidth + padding
        break
    }

    // Bounds checking - keep tooltip within viewport
    left = Math.max(padding, Math.min(left, viewportWidth - tooltipRect.width - padding))
    top = Math.max(padding, Math.min(top, viewportHeight - tooltipRect.height - padding))

    setTooltipPos({ top, left })
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
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White = visible (overlay shown), Black = hidden (spotlight hole) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
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
          className="absolute rounded-xl ring-2 ring-accent pointer-events-none"
          style={{
            zIndex: 2,
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)',
          }}
        />
      )}

      {/* Click blocker - allows clicking on highlighted element */}
      <div 
        className="absolute inset-0" 
        style={{ zIndex: 3 }}
        onClick={(e) => {
          // Allow clicks on the highlighted area to pass through
          if (targetRect) {
            const x = e.clientX
            const y = e.clientY
            if (
              x >= targetRect.left &&
              x <= targetRect.left + targetRect.width &&
              y >= targetRect.top &&
              y <= targetRect.top + targetRect.height
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
          'absolute bg-card rounded-2xl shadow-2xl border border-border',
          'p-6 max-w-sm w-[calc(100vw-2rem)]',
          'transition-opacity duration-200',
          tooltipPos ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          zIndex: 10,
          top: tooltipPos?.top ?? '50%',
          left: tooltipPos?.left ?? '50%',
          transform: tooltipPos ? 'none' : 'translate(-50%, -50%)',
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
