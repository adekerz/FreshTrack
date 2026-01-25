/**
 * Dropdown Component
 * Accessible dropdown menu with keyboard navigation
 * Follows Hick's Law - limit options, use grouping
 */

import { useState, useRef, useEffect, createContext, useContext } from 'react'
import { ChevronDown } from 'lucide-react'
import TouchButton from './TouchButton'

const DropdownContext = createContext({})

export default function Dropdown({ children, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const dropdownRef = useRef(null)
  const itemsRef = useRef([])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
        setActiveIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => 
          prev < itemsRef.current.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        itemsRef.current[activeIndex]?.click()
        setIsOpen(false)
        break
    }
  }

  return (
    <DropdownContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      activeIndex, 
      setActiveIndex,
      itemsRef 
    }}>
      <div 
        ref={dropdownRef} 
        className={`relative ${className}`}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

// Dropdown Trigger
export function DropdownTrigger({ children, className = '' }) {
  const { isOpen, setIsOpen } = useContext(DropdownContext)

  return (
    <TouchButton
      variant="ghost"
      size="small"
      onClick={() => setIsOpen(!isOpen)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium min-h-0 h-auto [&>svg]:transition-transform ${isOpen ? '[&>svg]:rotate-180' : ''} ${className}`}
      aria-expanded={isOpen}
      aria-haspopup="true"
      icon={ChevronDown}
      iconPosition="right"
    >
      {children}
    </TouchButton>
  )
}

// Dropdown Menu
export function DropdownMenu({ children, align = 'left', className = '' }) {
  const { isOpen } = useContext(DropdownContext)

  if (!isOpen) return null

  const alignClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  }

  return (
    <div
      className={`
        absolute top-full mt-1 z-50
        min-w-[180px] py-1
        bg-card rounded-lg shadow-soft-lg border border-border
        animate-fade-in
        ${alignClasses[align]}
        ${className}
      `}
      role="menu"
    >
      {children}
    </div>
  )
}

// Dropdown Item
export function DropdownItem({ 
  children, 
  onClick, 
  icon: Icon,
  danger = false,
  disabled = false,
  className = '' 
}) {
  const { setIsOpen, activeIndex, itemsRef } = useContext(DropdownContext)
  const itemRef = useRef(null)
  const index = itemsRef.current.length

  useEffect(() => {
    itemsRef.current.push(itemRef.current)
    return () => {
      itemsRef.current = itemsRef.current.filter((ref) => ref !== itemRef.current)
    }
  }, [itemsRef])

  const handleClick = () => {
    if (disabled) return
    onClick?.()
    setIsOpen(false)
  }

  const isActive = activeIndex === index

  return (
    <TouchButton
      ref={itemRef}
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={disabled}
      className={`
        w-full justify-start gap-2 px-3 py-2 text-left text-sm min-h-0 h-auto rounded-none
        ${danger ? 'text-danger hover:bg-danger/5' : 'text-foreground hover:bg-muted'}
        ${isActive ? 'bg-muted' : ''}
        ${className}
      `}
      role="menuitem"
      icon={Icon}
      iconPosition="left"
    >
      {children}
    </TouchButton>
  )
}

// Dropdown Separator
export function DropdownSeparator() {
  return <div className="my-1 border-t border-border" />
}

// Dropdown Label
export function DropdownLabel({ children }) {
  return (
    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </div>
  )
}
