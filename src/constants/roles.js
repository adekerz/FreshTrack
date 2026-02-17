/**
 * Role constants — single source of truth.
 * Used in AccountsSettings, OrganizationSettings, CreateUserModal, etc.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOTEL_ADMIN: 'HOTEL_ADMIN',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  STAFF: 'STAFF'
}

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  HOTEL_ADMIN: 'Hotel Admin',
  DEPARTMENT_MANAGER: 'Dept Manager',
  STAFF: 'Staff'
}

export const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  HOTEL_ADMIN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DEPARTMENT_MANAGER: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  STAFF: 'bg-muted text-muted-foreground'
}
