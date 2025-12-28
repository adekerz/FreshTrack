/**
 * FreshTrack Role Constants
 * Centralized role definitions to avoid hardcoding
 */

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HOTEL_ADMIN: 'HOTEL_ADMIN',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  USER: 'USER'
}

// Roles that have hotel-wide access
export const HOTEL_WIDE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOTEL_ADMIN
]

// Roles that can manage users
export const USER_MANAGEMENT_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.HOTEL_ADMIN
]

// All available roles for selection
export const ALL_ROLES = Object.values(UserRole)

export default UserRole
