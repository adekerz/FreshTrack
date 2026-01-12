/**
 * Shared Middleware
 * 
 * Barrel export для middleware.
 */

import { 
  authenticateToken, 
  requirePermission, 
  buildContextWhere,
  authMiddleware,
  hotelIsolation,
  generateToken 
} from '../../middleware/auth.js'

export {
  authenticateToken,
  authMiddleware,
  requirePermission,
  buildContextWhere,
  hotelIsolation,
  generateToken
}
