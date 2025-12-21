import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const OnboardingContext = createContext(null)

const STORAGE_KEY = 'freshtrack_onboarding_completed'

// Onboarding steps configuration
export const onboardingSteps = [
  {
    id: 'welcome',
    target: null, // No target - just a welcome modal
    title: 'onboarding.welcome.title',
    description: 'onboarding.welcome.description',
    placement: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-onboarding="dashboard"]',
    title: 'onboarding.dashboard.title',
    description: 'onboarding.dashboard.description',
    placement: 'bottom',
  },
  {
    id: 'add-batch',
    target: '[data-onboarding="add-batch"]',
    title: 'onboarding.addBatch.title',
    description: 'onboarding.addBatch.description',
    placement: 'bottom',
  },
  {
    id: 'inventory',
    target: '[data-onboarding="inventory"]',
    title: 'onboarding.inventory.title',
    description: 'onboarding.inventory.description',
    placement: 'right',
  },
  {
    id: 'notifications',
    target: '[data-onboarding="notifications"]',
    title: 'onboarding.notifications.title',
    description: 'onboarding.notifications.description',
    placement: 'right',
  },
  {
    id: 'complete',
    target: null,
    title: 'onboarding.complete.title',
    description: 'onboarding.complete.description',
    placement: 'center',
  },
]

export function OnboardingProvider({ children }) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })

  // Start onboarding for new users
  useEffect(() => {
    if (!hasCompleted) {
      // Delay to allow page to render
      const timer = setTimeout(() => {
        setIsActive(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [hasCompleted])

  const startOnboarding = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      completeOnboarding()
    }
  }, [currentStep])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const skipOnboarding = useCallback(() => {
    completeOnboarding()
  }, [])

  const completeOnboarding = useCallback(() => {
    setIsActive(false)
    setHasCompleted(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  const resetOnboarding = useCallback(() => {
    setHasCompleted(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = {
    isActive,
    currentStep,
    totalSteps: onboardingSteps.length,
    currentStepData: onboardingSteps[currentStep],
    hasCompleted,
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

export default OnboardingContext
