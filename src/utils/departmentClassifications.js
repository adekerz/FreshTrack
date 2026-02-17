/**
 * Department Classifications
 * Single source of truth for department types, labels and icons.
 *
 * Each classification maps to a `type` field stored in the DB.
 * Icons are actual Lucide-React components (not strings).
 */

import {
  Utensils,
  Martini,
  ConciergeBell,
  Warehouse,
  ChefHat,
  Refrigerator,
  Package
} from 'lucide-react'

/**
 * Ordered list of department classifications.
 * `type`  — value stored in departments.type column in the DB
 * `label` — human-readable Russian label shown in the UI
 * `icon`  — Lucide React component
 */
export const DEPARTMENT_CLASSIFICATIONS = [
  {
    type: 'restaurant',
    label: 'Ресторан',
    icon: Utensils
  },
  {
    type: 'bar',
    label: 'Лаундж Бар, Бар',
    icon: Martini
  },
  {
    type: 'room_service',
    label: 'Отдел Обслуживания Номеров',
    icon: ConciergeBell
  },
  {
    type: 'storage',
    label: 'Склад',
    icon: Warehouse
  },
  {
    type: 'kitchen',
    label: 'Кухня',
    icon: ChefHat
  },
  {
    type: 'minibar',
    label: 'Minibar',
    icon: Refrigerator
  }
]

/**
 * Fast lookup map: type → classification object
 */
export const CLASSIFICATION_BY_TYPE = Object.fromEntries(
  DEPARTMENT_CLASSIFICATIONS.map((c) => [c.type, c])
)

/**
 * Get the Lucide icon component for a department object or type string.
 * Accepts a full department object OR a type/code/id string.
 * Always returns a valid React component (never null).
 *
 * @param {object|string} deptOrType - Full dept object or type string
 * @returns {React.ComponentType} Lucide icon component
 */
export function getDepartmentIconComponent(deptOrType) {
  let type

  if (deptOrType && typeof deptOrType === 'object') {
    // Prefer explicit type, fall back to code
    type = deptOrType.type || deptOrType.code
  } else {
    type = deptOrType
  }

  return CLASSIFICATION_BY_TYPE[type]?.icon ?? Package
}
