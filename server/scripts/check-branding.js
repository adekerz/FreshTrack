/**
 * Check branding settings in database
 */

import { query } from '../db/postgres.js'

async function checkBranding() {
    try {
        // Check all color settings
        const colorSettings = await query(
            "SELECT key, value, scope, hotel_id FROM settings WHERE key LIKE '%color%' OR key LIKE '%Color%' ORDER BY key"
        )
        console.log('\n=== Color Settings in DB ===')
        console.log(JSON.stringify(colorSettings.rows, null, 2))

        // Check all branding.* settings
        const brandingSettings = await query(
            "SELECT key, value, scope, hotel_id FROM settings WHERE key LIKE 'branding.%' ORDER BY key"
        )
        console.log('\n=== Branding.* Settings in DB ===')
        console.log(JSON.stringify(brandingSettings.rows, null, 2))

        // Check legacy settings
        const legacySettings = await query(
            "SELECT key, value, scope, hotel_id FROM settings WHERE key IN ('primary_color', 'secondary_color', 'accent_color', 'danger_color', 'app_name', 'logo_url') ORDER BY key"
        )
        console.log('\n=== Legacy Settings in DB ===')
        console.log(JSON.stringify(legacySettings.rows, null, 2))

        process.exit(0)
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

checkBranding()
