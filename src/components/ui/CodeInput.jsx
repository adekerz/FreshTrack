/**
 * CodeInput - Компонент для ввода 6-значного кода
 * Используется для email verification
 */

import { useState, useEffect } from 'react'
import { cn } from '../../utils/classNames'

export default function CodeInput({ onComplete, disabled = false, autoFocus = true }) {
  const [code, setCode] = useState(['', '', '', '', '', ''])

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return
    
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`)
      if (nextInput) nextInput.focus()
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6 && onComplete) {
        setTimeout(() => onComplete(fullCode), 100)
      }
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const newCode = pasted.split('')
      setCode(newCode)
      // Auto-submit
      if (onComplete) {
        setTimeout(() => onComplete(pasted), 100)
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`)
      if (prevInput) prevInput.focus()
    }
  }

  // Reset code when disabled changes
  useEffect(() => {
    if (disabled) {
      setCode(['', '', '', '', '', ''])
    }
  }, [disabled])

  return (
    <div className="flex items-center gap-2" onPaste={handlePaste}>
      {code.map((digit, index) => (
        <input
          key={index}
          id={`code-input-${index}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={cn(
            "w-12 h-12 text-center text-lg font-semibold rounded-lg border-2",
            "border-border bg-background focus:border-accent focus:outline-none",
            "transition-colors",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
        />
      ))}
    </div>
  )
}
