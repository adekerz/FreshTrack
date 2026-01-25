import { useState, useEffect, useRef } from 'react'
import { cn } from '../../utils/classNames'

const DEFAULT_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23e5e7eb' width='1' height='1'/%3E%3C/svg%3E"

/**
 * Lazy-loaded image with:
 * - Intersection Observer
 * - Blur/placeholder until loaded
 * - Error handling
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  placeholder = DEFAULT_PLACEHOLDER,
  onError,
  ...props
}) {
  const [imageSrc, setImageSrc] = useState(placeholder)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!src || errored) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageLoaded(false)
            setImageSrc(src)
            observer.disconnect()
          }
        })
      },
      { rootMargin: '50px' }
    )

    const el = imgRef.current
    if (el) observer.observe(el)

    return () => observer.disconnect()
  }, [src, errored])

  const handleLoad = () => setImageLoaded(true)

  const handleError = (e) => {
    setErrored(true)
    onError?.(e)
  }

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
      className={cn(
        'transition-opacity duration-300',
        imageLoaded ? 'opacity-100' : 'opacity-0',
        errored && 'opacity-50',
        className
      )}
      {...props}
    />
  )
}
