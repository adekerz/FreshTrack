/**
 * Axe Accessibility Testing Integration
 * Runs accessibility checks in development mode
 * 
 * Results appear in browser console with severity levels:
 * - critical: Must fix immediately
 * - serious: Should fix soon
 * - moderate: Should fix when possible
 * - minor: Nice to fix
 */

export const initAxe = async () => {
  // Only run in development
  if (import.meta.env.MODE !== 'development') {
    return
  }

  try {
    const axe = await import('@axe-core/react')
    const React = await import('react')
    const ReactDOM = await import('react-dom')

    // Configure axe with Russian locale support
    axe.default(React.default, ReactDOM.default, 1000, {
      // Rules configuration
      rules: [
        // Enable all WCAG 2.1 AA rules
        { id: 'color-contrast', enabled: true },
        { id: 'label', enabled: true },
        { id: 'link-name', enabled: true },
        { id: 'button-name', enabled: true },
        { id: 'image-alt', enabled: true },
        { id: 'duplicate-id', enabled: true },
        { id: 'landmark-one-main', enabled: true },
        { id: 'page-has-heading-one', enabled: true },
        { id: 'region', enabled: true },
        { id: 'bypass', enabled: true },
        { id: 'focus-order-semantics', enabled: true },
        { id: 'meta-viewport', enabled: true },
        { id: 'valid-lang', enabled: true },
        { id: 'html-has-lang', enabled: true },
      ],
      // Result types to log
      resultTypes: ['violations', 'incomplete'],
      // Reporter configuration  
      reporter: 'v2'
    })

    console.log('🔍 Axe accessibility testing initialized')
    console.log('   Check console for accessibility violations')
    
  } catch (error) {
    // Silently fail if axe is not installed
    if (error.code !== 'MODULE_NOT_FOUND') {
      console.warn('Axe accessibility testing not available:', error.message)
    }
  }
}

/**
 * Manual accessibility check function
 * Can be called from browser console: window.runAxeCheck()
 */
export const runManualAxeCheck = async () => {
  if (typeof window === 'undefined') return

  try {
    const axe = await import('axe-core')
    
    const results = await axe.default.run(document.body, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
      }
    })

    console.group('🔍 Axe Accessibility Report')
    
    if (results.violations.length === 0) {
      console.log('✅ No accessibility violations found!')
    } else {
      console.error(`❌ Found ${results.violations.length} accessibility violations:`)
      
      results.violations.forEach((violation, index) => {
        console.group(`${index + 1}. ${violation.help} (${violation.impact})`)
        console.log('Description:', violation.description)
        console.log('WCAG:', violation.tags.filter(t => t.startsWith('wcag')).join(', '))
        console.log('How to fix:', violation.helpUrl)
        console.log('Affected elements:', violation.nodes.length)
        violation.nodes.forEach((node, nodeIndex) => {
          console.log(`  ${nodeIndex + 1}. ${node.target.join(' > ')}`)
          console.log(`     Fix: ${node.failureSummary}`)
        })
        console.groupEnd()
      })
    }

    if (results.incomplete.length > 0) {
      console.warn(`⚠️ ${results.incomplete.length} elements need manual review`)
    }

    console.log(`📊 Total elements checked: ${results.passes.length + results.violations.length}`)
    console.groupEnd()

    return results
  } catch (error) {
    console.error('Failed to run axe check:', error)
  }
}

// Expose to window for manual testing
if (typeof window !== 'undefined') {
  window.runAxeCheck = runManualAxeCheck
}
