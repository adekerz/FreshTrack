/**
 * FreshTrack Department Utilities
 * Shared utilities for department icons and formatting
 */

import {
  Utensils,
  Wine,
  ChefHat,
  Warehouse,
  Coffee,
  Package,
  UtensilsCrossed,
  Beer,
  Croissant,
  Refrigerator
} from 'lucide-react'

/**
 * Default department icon mapping
 */
export const DEPARTMENT_ICONS = {
  restaurant: Utensils,
  bar: Wine,
  kitchen: ChefHat,
  storage: Warehouse,
  minibar: Coffee,
  cafe: Coffee,
  banquet: UtensilsCrossed,
  pub: Beer,
  bakery: Croissant,
  cold_storage: Refrigerator,
  default: Package
}

/**
 * Keywords to match department names (EN + RU)
 */
const DEPARTMENT_KEYWORDS = {
  restaurant: ['restaurant', 'ресторан'],
  bar: ['bar', 'бар'],
  kitchen: ['kitchen', 'кухня'],
  storage: ['storage', 'склад'],
  minibar: ['minibar'],
  cafe: ['cafe', 'кафе'],
  banquet: ['banquet'],
  pub: ['pub'],
  bakery: ['bakery'],
  cold_storage: ['cold_storage']
}

/**
 * Get icon component for department
 * @param {object} department - Department object with name or icon field
 * @returns {React.ComponentType} - Lucide icon component
 */
export function getDepartmentIcon(department) {
  if (!department) return Package

  // Check if department has explicit icon field
  if (department.icon && DEPARTMENT_ICONS[department.icon]) {
    return DEPARTMENT_ICONS[department.icon]
  }

  // Try to match by name (case insensitive, EN + RU keywords)
  const name = (department.name || department.code || '').toLowerCase()

  for (const [key, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (keywords.some(kw => name.includes(kw))) {
      return DEPARTMENT_ICONS[key]
    }
  }

  return Package
}

/**
 * Get icon color class for department
 * @param {object} department 
 * @returns {string} - Tailwind color class
 */
export function getDepartmentColor(department) {
  if (!department) return 'text-gray-500'
  
  const name = (department.name || '').toLowerCase()
  
  if (name.includes('restaurant') || name.includes('kitchen')) return 'text-orange-500'
  if (name.includes('bar') || name.includes('pub')) return 'text-purple-500'
  if (name.includes('storage') || name.includes('warehouse')) return 'text-blue-500'
  if (name.includes('minibar') || name.includes('cafe')) return 'text-amber-500'
  if (name.includes('bakery')) return 'text-yellow-600'
  
  return 'text-gray-500'
}

export default {
  DEPARTMENT_ICONS,
  getDepartmentIcon,
  getDepartmentColor
}
