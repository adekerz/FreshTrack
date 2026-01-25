import { useEffect, useRef, useState } from 'react'

/**
 * Pull-to-refresh gesture for mobile.
 * Works on touch devices; no-op when touch unavailable.
 */
export function usePullToRefresh(onRefresh, threshold = 80) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const pullDistanceRef = useRef(0)

  useEffect(() => {
    if (!('ontouchstart' in window)) return

    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        touchStartY.current = e.touches[0].clientY
        pullDistanceRef.current = 0
      }
    }

    const handleTouchMove = (e) => {
      if (window.scrollY !== 0) return

      const touchY = e.touches[0].clientY
      const distance = touchY - touchStartY.current

      if (distance > 0 && distance < threshold * 2) {
        pullDistanceRef.current = distance
        setPullDistance(distance)
      }
    }

    const handleTouchEnd = async () => {
      const distance = pullDistanceRef.current
      setPullDistance(0)
      pullDistanceRef.current = 0

      if (distance > threshold) {
        setIsRefreshing(true)
        try {
          await (typeof onRefresh === 'function' ? onRefresh() : Promise.resolve())
        } finally {
          setIsRefreshing(false)
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, threshold])

  return { isRefreshing, pullDistance }
}
