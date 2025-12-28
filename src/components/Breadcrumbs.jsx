/**
 * Breadcrumbs navigation component for FreshTrack
 * Based on MUI design principles with FreshTrack styling
 */

import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

/**
 * Get breadcrumb items based on current path
 */
const useBreadcrumbs = () => {
  const location = useLocation()
  const { t } = useTranslation()
  
  const pathParts = location.pathname.split('/').filter(Boolean)
  
  const breadcrumbs = [
    { label: t('nav.home') || 'Home', path: '/', icon: Home }
  ]
  
  // Build breadcrumb trail
  let currentPath = ''
  pathParts.forEach((part, index) => {
    currentPath += `/${part}`
    
    // Map path segments to readable labels
    const labelMap = {
      'inventory': t('nav.inventory') || 'Inventory',
      'notifications': t('nav.alerts') || 'Alerts',
      'settings': t('nav.settings') || 'Settings',
      'profile': t('settings.profile') || 'Profile',
      'departments': t('settings.departments') || 'Departments',
      'categories': t('settings.categories') || 'Categories',
      'history': t('nav.history') || 'History',
      'export': t('settings.export') || 'Export'
    }
    
    // Skip UUID-like segments or use as is if not in map
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
    
    if (!isUuid) {
      breadcrumbs.push({
        label: labelMap[part] || part.charAt(0).toUpperCase() + part.slice(1),
        path: currentPath,
        isLast: index === pathParts.length - 1
      })
    }
  })
  
  return breadcrumbs
}

/**
 * Breadcrumbs component
 */
export default function Breadcrumbs({ className, customItems }) {
  const autoBreadcrumbs = useBreadcrumbs()
  const breadcrumbs = customItems || autoBreadcrumbs
  
  // Don't show breadcrumbs on home page
  if (breadcrumbs.length <= 1) return null
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn('hidden sm:block mb-4', className)}
    >
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1
          const Icon = item.icon
          
          return (
            <li key={item.path} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground/50" aria-hidden="true" />
              )}
              
              {isLast ? (
                <span 
                  className="text-foreground font-medium flex items-center gap-1.5"
                  aria-current="page"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="hover:text-accent transition-colors flex items-center gap-1.5"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Breadcrumb item type for custom breadcrumbs
 * @typedef {Object} BreadcrumbItem
 * @property {string} label - Display text
 * @property {string} path - Link path
 * @property {import('lucide-react').LucideIcon} [icon] - Optional icon
 * @property {boolean} [isLast] - Is this the last item
 */
