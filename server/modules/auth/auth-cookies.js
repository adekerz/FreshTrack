/**
 * Auth cookie helpers — shared across auth sub-controllers.
 */

const COOKIE_NAME = 'freshtrack_token'
const isProduction = process.env.NODE_ENV === 'production'

// Cookie durations
const SESSION_COOKIE_MAX_AGE = null               // null = session cookie (expires on browser close)
const REMEMBER_DEVICE_MAX_AGE = 30 * 24 * 60 * 60 * 1000  // 30 days

/**
 * Set auth cookie.
 * @param {import('express').Response} res
 * @param {string} token - JWT token
 * @param {boolean} rememberDevice - if true, cookie persists 30 days; if false, session cookie
 */
export function setTokenCookie(res, token, rememberDevice = false) {
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api'
  }

  if (rememberDevice) {
    cookieOptions.maxAge = REMEMBER_DEVICE_MAX_AGE
  }
  // If rememberDevice = false: no maxAge → session cookie (clears on browser close)

  res.cookie(COOKIE_NAME, token, cookieOptions)
}

export function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/api' })
}
