/**
 * OnboardingTour Component
 * Guided tour for new users with spotlight effect
 */

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react'
import { useOnboarding, onboardingSteps } from '../context/OnboardingContext'
import { useTranslation } from '../context/LanguageContext'
import { Button } from './ui'
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
        })
      }
    }

    findTarget()
    window.addEventListener('resize', findTarget)
    window.addEventListener('scroll', findTarget)

    return () => {
      window.removeEventListener('resize', findTarget)
      window.removeEventListener('scroll', findTarget)
    }
  }, [isActive, currentStep, currentStepData])

  if (!isActive) return null

  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === totalSteps - 1
  const isCenterPlacement = currentStepData?.placement === 'center'

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect || isCenterPlacement) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const padding = 16
    const placement = currentStepData?.placement || 'bottom'

    switch (placement) {
      case 'top':
        return {
          bottom: `calc(100vh - ${targetRect.top}px + ${padding}px)`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      case 'bottom':
        return {
          top: `${targetRect.top + targetRect.height + padding}px`,
          left: `${targetRect.left + targetRect.width / 2}px`,
          transform: 'translateX(-50%)',
        }
      case 'left':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          right: `calc(100vw - ${targetRect.left}px + ${padding}px)`,
          transform: 'translateY(-50%)',
        }
      case 'right':
        return {
          top: `${targetRect.top + targetRect.height / 2}px`,
          left: `${targetRect.left + targetRect.width + padding}px`,
          transform: 'translateY(-50%)',
        }
      default:
        return {}
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      {/* Backdrop with spotlight cutout */}
      <div className="absolute inset-0">
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-sm" />
        
        {/* Spotlight cutout */}
        {targetRect && (
          <div
            className="absolute bg-transparent rounded-xl ring-4 ring-accent ring-offset-4 ring-offset-transparent animate-pulse-soft"
            style={{
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              boxShadow: '0 0 0 9999px rgba(26, 26, 26, 0.7)',
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          'absolute bg-card rounded-2xl shadow-2xl',
          'p-6 max-w-sm w-[calc(100vw-2rem)]',
          'animate-scale-in'
        )}
        style={getTooltipStyle()}
      >
        {/* Close button */}
        <button
          onClick={skipOnboarding}
          className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>

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
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common.back')}
            </Button>
          )}
          
          {isFirstStep && !isLastStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={skipOnboarding}
              className="flex-1"
            >
              {t('onboarding.skip') || 'Skip tour'}
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={nextStep}
            className="flex-1"
          >
            {isLastStep ? (
              <>
                {t('onboarding.getStarted') || 'Get Started'}
                <Check className="w-4 h-4 ml-1" />
              </>
            ) : (
              <>
                {t('common.next')}
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
