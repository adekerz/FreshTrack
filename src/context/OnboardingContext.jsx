import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const OnboardingContext = createContext(null)

const STORAGE_KEY = 'freshtrack_onboarding_completed'

// Onboarding steps configuration
export const onboardingSteps = [
  {
    id: 'welcome',
    target: null,
    title: 'onboarding.welcome.title',
    description: 'onboarding.welcome.description',
    placement: 'center',
    route: null,
  },
  {
    id: 'dashboard',
    target: '[data-onboarding="dashboard"]',
    title: 'onboarding.dashboard.title',
    description: 'onboarding.dashboard.description',
    placement: 'right',
    route: '/',
  },
  {
    id: 'add-batch',
    target: '[data-onboarding="add-batch"]',
    title: 'onboarding.addBatch.title',
    description: 'onboarding.addBatch.description',
    placement: 'bottom',
    route: '/',
  },
  {
    id: 'inventory',
    target: '[data-onboarding="inventory"]',
    title: 'onboarding.inventory.title',
    description: 'onboarding.inventory.description',
    placement: 'right',
    route: null,
  },
  {
    id: 'notifications',
    target: '[data-onboarding="notifications"]',
    title: 'onboarding.notifications.title',
    description: 'onboarding.notifications.description',
    placement: 'right',
    route: null,
  },
  {
    id: 'calendar',
    target: '[data-onboarding="calendar"]',
    title: 'onboarding.calendar.title',
    description: 'onboarding.calendar.description',
    placement: 'right',
    route: null,
  },
  {
    id: 'complete',
    target: null,
    title: 'onboarding.complete.title',
    description: 'onboarding.complete.description',
    placement: 'center',
    route: null,
  },
]

export function OnboardingProvider({ children }) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const navigate = useNavigate()
  const location = useLocation()

  // Start onboarding for new users
  useEffect(() => {
    if (!hasCompleted) {
      // Delay to allow page to render
      const timer = setTimeout(() => {
        setIsActive(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [hasCompleted])

  // Navigate to the required route when step changes
  useEffect(() => {
    if (!isActive) return
    const step = onboardingSteps[currentStep]
    if (step?.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [isActive, currentStep, navigate, location.pathname])

  const startOnboarding = useCallback(() => {
    setCurrentStep(0)
    setIsActive(true)
  }, [])

  const completeOnboarding = useCallback(() => {
    setIsActive(false)
    setHasCompleted(true)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  const nextStep = useCallback(() => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      completeOnboarding()
    }
  }, [currentStep, completeOnboarding])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const skipOnboarding = useCallback(() => {
    completeOnboarding()
  }, [completeOnboarding])

  const resetOnboarding = useCallback(() => {
    setHasCompleted(false)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo(
    () => ({
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
    }),
    [
      isActive,
      currentStep,
      hasCompleted,
      startOnboarding,
      nextStep,
      prevStep,
      skipOnboarding,
      completeOnboarding,
      resetOnboarding,
    ]
  )

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
