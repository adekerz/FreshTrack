import React, { createContext, useContext, useRef, useEffect } from 'react'

const TabsContext = createContext(null)

export function Tabs({ value, onChange, children, className = '' }) {
  const tabsRef = useRef([])

  // Collect all tab values for keyboard navigation
  useEffect(() => {
    const tabs = []
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === TabsList) {
        React.Children.forEach(child.props.children, (tab) => {
          if (React.isValidElement(tab) && tab.type === Tab && tab.props.value) {
            tabs.push(tab.props.value)
          }
        })
      }
    })
    tabsRef.current = tabs
  }, [children])

  return (
    <TabsContext.Provider value={{ value, onChange, tabs: tabsRef.current }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = '' }) {
  return (
    <div
      className={`flex gap-1 p-1 bg-muted rounded-lg ${className}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {children}
    </div>
  )
}

export function Tab({ value, children, icon: Icon }) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tab must be used within Tabs')
  const { value: activeValue, onChange, tabs } = ctx
  const isActive = value === activeValue

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const currentIndex = tabs.indexOf(value)
      const nextIndex = (currentIndex + 1) % tabs.length
      onChange(tabs[nextIndex])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const currentIndex = tabs.indexOf(value)
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length
      onChange(tabs[prevIndex])
    }
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onChange(value)}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function TabPanel({ value, children }) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('TabPanel must be used within Tabs')
  const { value: activeValue } = ctx

  if (value !== activeValue) return null

  return (
    <div className="mt-6" role="tabpanel">
      {children}
    </div>
  )
}
