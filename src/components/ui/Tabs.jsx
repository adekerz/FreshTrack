import { createContext, useContext } from 'react'

const TabsContext = createContext(null)

export function Tabs({ value, onChange, children, className = '' }) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = '' }) {
  return (
    <div className={`flex gap-1 p-1 bg-muted rounded-lg ${className}`} role="tablist">
      {children}
    </div>
  )
}

export function Tab({ value, children, icon: Icon }) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('Tab must be used within Tabs')
  const { value: activeValue, onChange } = ctx
  const isActive = value === activeValue

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onChange(value)}
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
