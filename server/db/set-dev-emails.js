/**
 * Script to set esimadilet@gmail.com for all active departments
 * Run with: node server/db/set-dev-emails.js
 */

import { query } from './postgres.js'

async function setDevEmails() {
  try {
    console.log('📧 Setting esimadilet@gmail.com for all active departments...')
    
    const result = await query(`
      UPDATE departments
      SET email = 'esimadilet@gmail.com'
      WHERE is_active = TRUE
        AND (email IS NULL OR TRIM(email) = '')
      RETURNING id, name, email
    `)
    
    console.log(`✅ Updated ${result.rowCount} departments`)
    
    if (result.rows.length > 0) {
      console.log('\nUpdated departments:')
      result.rows.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.id}) → ${dept.email}`)
      })
    }
    
    // Also check if there are departments that already have email
    const allDepts = await query(`
      SELECT id, name, email, is_active
      FROM departments
      WHERE is_active = TRUE
      ORDER BY name
    `)
    
    console.log(`\n📊 Total active departments: ${allDepts.rows.length}`)
    const withEmail = allDepts.rows.filter(d => d.email && d.email.trim())
    const withoutEmail = allDepts.rows.filter(d => !d.email || !d.email.trim())
    
    console.log(`  ✅ With email: ${withEmail.length}`)
    console.log(`  ⚠️  Without email: ${withoutEmail.length}`)
    
    if (withoutEmail.length > 0) {
      console.log('\nDepartments without email:')
      withoutEmail.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.id})`)
      })
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

setDevEmails()
