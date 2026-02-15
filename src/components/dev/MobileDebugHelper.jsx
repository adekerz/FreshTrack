import { useState, useEffect } from 'react'

/**
 * Development helper to test responsive breakpoints
 * Remove in production or hide behind DEV flag
 */
export default function MobileDebugHelper() {
  const [screenInfo, setScreenInfo] = useState({})

  useEffect(() => {
    const getBreakpoint = () => {
      const w = window.innerWidth
      if (w < 640) return 'mobile'
      if (w < 768) return 'sm'
      if (w < 1024) return 'md'
      if (w < 1280) return 'lg'
      if (w < 1536) return 'xl'
      return '2xl'
    }

    const updateInfo = () => {
      setScreenInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        breakpoint: getBreakpoint(),
        orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
        touchEnabled: 'ontouchstart' in window,
        devicePixelRatio: window.devicePixelRatio
      })
    }

    updateInfo()
    window.addEventListener('resize', updateInfo)
    return () => window.removeEventListener('resize', updateInfo)
  }, [])

  if (!import.meta.env.DEV) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-black/85 text-white text-[10px] sm:text-xs px-2 py-1.5 font-mono flex flex-wrap items-center gap-x-4 gap-y-0.5"
      role="status"
      aria-live="polite"
      aria-label="Mobile debug info"
    >
      <span>📐 {screenInfo.width ?? 0}×{screenInfo.height ?? 0}</span>
      <span>📱 {screenInfo.breakpoint ?? '—'}</span>
      <span>🔄 {screenInfo.orientation ?? '—'}</span>
      <span>👆 Touch: {screenInfo.touchEnabled ? 'Yes' : 'No'}</span>
      <span>🖥️ DPR: {screenInfo.devicePixelRatio ?? '—'}</span>
    </div>
  )
}
