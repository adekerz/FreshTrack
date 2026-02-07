/**
 * Auth cookie helpers — shared across auth sub-controllers.
 */

const COOKIE_NAME = 'freshtrack_token'
const isProduction = process.env.NODE_ENV === 'production'

export function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/api'
  })
}

export function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/api' })
}
