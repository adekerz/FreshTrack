/**
 * Fix branding colors to coral/salmon theme
 */

import { query } from '../db/postgres.js'

const CORRECT_COLORS = {
    primaryColor: '#FF8D6B',    // Coral/Salmon
    secondaryColor: '#10B981',  // Emerald
    accentColor: '#F59E0B',     // Amber
    dangerColor: '#C4554D'      // Terracotta
}

async function fixBrandingColors() {
    try {
        console.log('Updating branding colors to coral theme...\n')

        // Update branding.primaryColor for all scopes
        await query(
            "UPDATE settings SET value = $1 WHERE key = 'branding.primaryColor'",
            [JSON.stringify(CORRECT_COLORS.primaryColor)]
        )
        console.log('✅ Updated branding.primaryColor to', CORRECT_COLORS.primaryColor)

        // Update legacy primary_color
        await query(
            "UPDATE settings SET value = $1 WHERE key = 'primary_color'",
            [JSON.stringify(CORRECT_COLORS.primaryColor)]
        )
        console.log('✅ Updated primary_color to', CORRECT_COLORS.primaryColor)

        // Verify
        const result = await query(
            "SELECT key, value FROM settings WHERE key LIKE '%primaryColor%' OR key = 'primary_color'"
        )
        console.log('\n=== Verification ===')
        console.log(JSON.stringify(result.rows, null, 2))

        console.log('\n✅ Done! Restart the server and refresh the page.')
        process.exit(0)
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

fixBrandingColors()
