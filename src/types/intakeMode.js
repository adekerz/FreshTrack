/**
 * IntakeMode - Explicit enum for template intake modes
 * 
 * 'standard' - Standard mode: edit all items, apply once, close modal
 * 'fast'     - Fast mode: rapid repetitive intake, keep modal open
 * 
 * Usage:
 *   import { IntakeMode } from '../types/intakeMode'
 *   const currentMode = IntakeMode.FAST
 */
export const IntakeMode = Object.freeze({
  STANDARD: 'standard',
  FAST: 'fast'
})

/**
 * Type guard for IntakeMode
 * @param {string} mode - Mode to validate
 * @returns {boolean} - True if mode is valid
 */
export const isValidIntakeMode = (mode) => {
  return mode === IntakeMode.STANDARD || mode === IntakeMode.FAST
}

/**
 * TypeScript type definition (for JSDoc comments in JS files)
 * @typedef {'standard' | 'fast'} IntakeModeType
 */
