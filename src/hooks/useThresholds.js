/**
 * Hook for getting expiry thresholds from server
 * Thresholds are based on notification_rules for current hotel
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../services/api'

// Default thresholds (fallback)
const DEFAULT_THRESHOLDS = {
    warning: 7,
    critical: 3
}

// Cache thresholds to avoid repeated requests
let cachedThresholds = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1 minute

export function useThresholds() {
    const [thresholds, setThresholds] = useState(cachedThresholds || DEFAULT_THRESHOLDS)
    const [loading, setLoading] = useState(!cachedThresholds)

    const fetchThresholds = useCallback(async () => {
        // Use cache if fresh
        if (cachedThresholds && Date.now() - cacheTimestamp < CACHE_TTL) {
            setThresholds(cachedThresholds)
            setLoading(false)
            return
        }

        try {
            const data = await apiFetch('/settings/thresholds')
            if (data.success && data.thresholds) {
                cachedThresholds = data.thresholds
                cacheTimestamp = Date.now()
                setThresholds(data.thresholds)
            }
        } catch {
            // Use defaults on error
            setThresholds(DEFAULT_THRESHOLDS)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchThresholds()
    }, [fetchThresholds])

    // Function to get status based on thresholds
    const getStatus = useCallback((daysLeft) => {
        if (daysLeft < 0) return 'expired'
        if (daysLeft === 0) return 'today'
        if (daysLeft <= thresholds.critical) return 'critical'
        if (daysLeft <= thresholds.warning) return 'warning'
        return 'good'
    }, [thresholds])

    // Function to get status color
    const getStatusColor = useCallback((daysLeft) => {
        const status = getStatus(daysLeft)
        switch (status) {
            case 'expired':
            case 'today':
            case 'critical':
                return 'danger'
            case 'warning':
                return 'warning'
            default:
                return 'success'
        }
    }, [getStatus])

    // Function to refresh thresholds (after rule changes)
    const refresh = useCallback(() => {
        cachedThresholds = null
        cacheTimestamp = 0
        fetchThresholds()
    }, [fetchThresholds])

    return {
        thresholds,
        loading,
        getStatus,
        getStatusColor,
        refresh
    }
}

// Export for direct use without hook
export function getDefaultThresholds() {
    return cachedThresholds || DEFAULT_THRESHOLDS
}

export default useThresholds
