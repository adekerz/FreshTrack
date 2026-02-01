/**
 * User Agent Parser Utility
 * Parses user agent strings to extract browser, OS, and device information.
 * Uses ua-parser-js library for reliable parsing.
 */

import { UAParser } from 'ua-parser-js'

/**
 * Parse a user agent string and return structured information
 * @param {string} userAgentString - The User-Agent header value
 * @returns {Object} Parsed user agent information
 */
export function parseUserAgent(userAgentString) {
  if (!userAgentString) {
    return {
      browser: { name: 'Unknown', version: null },
      os: { name: 'Unknown', version: null },
      device: { type: 'desktop', vendor: null, model: null },
      raw: null
    }
  }

  const parser = new UAParser(userAgentString)
  const result = parser.getResult()

  return {
    browser: {
      name: result.browser.name || 'Unknown',
      version: result.browser.version || null,
      major: result.browser.major || null
    },
    os: {
      name: result.os.name || 'Unknown',
      version: result.os.version || null
    },
    device: {
      type: result.device.type || 'desktop', // mobile, tablet, desktop
      vendor: result.device.vendor || null,
      model: result.device.model || null
    },
    engine: {
      name: result.engine.name || null,
      version: result.engine.version || null
    },
    cpu: {
      architecture: result.cpu.architecture || null
    },
    raw: userAgentString
  }
}

/**
 * Get a human-readable summary of the user agent
 * @param {string} userAgentString - The User-Agent header value
 * @returns {string} Human-readable summary
 */
export function getUserAgentSummary(userAgentString) {
  const ua = parseUserAgent(userAgentString)

  const parts = []

  // Browser
  if (ua.browser.name !== 'Unknown') {
    parts.push(`${ua.browser.name}${ua.browser.major ? ' ' + ua.browser.major : ''}`)
  }

  // OS
  if (ua.os.name !== 'Unknown') {
    parts.push(`${ua.os.name}${ua.os.version ? ' ' + ua.os.version : ''}`)
  }

  // Device type
  if (ua.device.type && ua.device.type !== 'desktop') {
    parts.push(ua.device.type)
  }

  return parts.length > 0 ? parts.join(' / ') : 'Unknown client'
}

/**
 * Extract user agent from Express request
 * @param {Object} req - Express request object
 * @returns {Object} Parsed user agent information
 */
export function parseRequestUserAgent(req) {
  const userAgentString = req.headers['user-agent'] || req.get('User-Agent') || ''
  return parseUserAgent(userAgentString)
}

/**
 * Get client IP address from request, handling proxies
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
export function getClientIP(req) {
  // Check common proxy headers
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one (original client)
    return forwardedFor.split(',')[0].trim()
  }

  // Check other common headers
  const realIP = req.headers['x-real-ip']
  if (realIP) {
    return realIP
  }

  // Fallback to connection remote address
  return req.ip || req.connection?.remoteAddress || 'unknown'
}

/**
 * Get full client info from request (IP + User Agent)
 * @param {Object} req - Express request object
 * @returns {Object} Full client information
 */
export function getClientInfo(req) {
  return {
    ip: getClientIP(req),
    userAgent: parseRequestUserAgent(req),
    userAgentSummary: getUserAgentSummary(req.headers['user-agent']),
    timestamp: new Date().toISOString()
  }
}

export default {
  parseUserAgent,
  getUserAgentSummary,
  parseRequestUserAgent,
  getClientIP,
  getClientInfo
}
