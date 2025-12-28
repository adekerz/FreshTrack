/**
 * ThemeSwitcher Component
 * Toggle between light/dark/system themes
 */

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme, themes } from '../context/ThemeContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function ThemeSwitcher({ variant = 'toggle', className = '' }) {
  const { theme, isDark, toggleTheme, changeTheme } = useTheme()
  const { t } = useTranslation()

  const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  // Simple toggle button
  if (variant === 'toggle') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          'p-2 rounded-lg transition-colors',
          'hover:bg-muted',
          'focus-visible:ring-2 focus-visible:ring-accent',
          className
        )}
        aria-label={isDark ? t('theme.switchToLight') || 'Switch to light mode' : t('theme.switchToDark') || 'Switch to dark mode'}
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-muted-foreground" />
        ) : (
          <Moon className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
    )
  }

  // Segmented control for settings
  if (variant === 'segmented') {
    return (
      <div 
        className={cn(
          'flex gap-1 p-1 bg-muted rounded-lg',
          className
        )}
        role="radiogroup"
        aria-label={t('theme.label') || 'Theme preference'}
      >
        {themes.map(({ id, name }) => {
          const Icon = icons[id]
          const isActive = theme === id
          
          return (
            <button
              key={id}
              onClick={() => changeTheme(id)}
              role="radio"
              aria-checked={isActive}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
                isActive
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t(`theme.${id}`) || name}</span>
            </button>
          )
        })}
      </div>
    )
  }

  // Dropdown for compact spaces
  if (variant === 'dropdown') {
    const CurrentIcon = icons[theme]
    
    return (
      <div className={cn('relative group', className)}>
        <button
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
            'hover:bg-muted',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={t('theme.label') || 'Theme preference'}
        >
          <CurrentIcon className="w-5 h-5" />
          <span className="text-sm">{t(`theme.${theme}`) || theme}</span>
        </button>
        
        <div className="absolute right-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
          <div className="bg-card rounded-lg shadow-lg border border-border py-1 min-w-[140px]">
            {themes.map(({ id, name }) => {
              const Icon = icons[id]
              const isActive = theme === id
              
              return (
                <button
                  key={id}
                  onClick={() => changeTheme(id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'text-accent bg-accent/5'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(`theme.${id}`) || name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return null
}
