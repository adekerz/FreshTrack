import { useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

function escapeHtml(s) {
  if (typeof s !== 'string') return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Advanced template editor with:
 * - Quick variable insertion buttons
 * - Real-time validation
 * - Live preview
 */
export default function TemplateEditor({
  label,
  value = '',
  onChange,
  availableVars = [],
  placeholder = 'Введите шаблон сообщения...',
  rows = 4
}) {
  const textareaRef = useRef(null)
  const [validationError, setValidationError] = useState(null)

  const insertVariable = (varName) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + `{${varName}}` + value.substring(end)

    onChange(newValue)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + varName.length + 2
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const validateTemplate = (text) => {
    const foundVars = (text.match(/\{(\w+)\}/g) || []).map((v) => v.slice(1, -1))
    const invalidVars = foundVars.filter((v) => !availableVars.includes(v))

    if (invalidVars.length > 0) {
      return `Неизвестные переменные: ${invalidVars.map((v) => `{${v}}`).join(', ')}`
    }
    return null
  }

  const generatePreview = () => {
    const allSamples = {
      good: '5',
      warning: '3  ',
      expired: '1',
      total: '8',
      date: '15.02.2026',
      department: 'Кухня',
      expiringList: '⚠️ Истекают в ближайшее время:\n  • Молоко 3.2% — 2 шт. (истекает 20.02.2026, осталось 5 дн.)\n  • Хлеб белый — 1 шт. (истекает 18.02.2026, осталось 3 дн.)',
      expiredList: '🔴 Просрочено:\n  • Йогурт — 1 шт. (просрочено с 10.02.2026, 5 дн. назад)'
    }

    const sampleData = Object.fromEntries(
      Object.entries(allSamples).filter(([k]) => availableVars.includes(k))
    )

    let preview = escapeHtml(value)
    Object.entries(sampleData).forEach(([key, val]) => {
      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), `**${escapeHtml(String(val))}**`)
    })

    return preview.replace(
      /\*\*(.*?)\*\*/g,
      (_, inner) => `<strong class="text-accent">${inner}</strong>`
    )
  }

  const handleChange = (e) => {
    const newValue = e.target.value
    onChange(newValue)
    setValidationError(validateTemplate(newValue))
  }

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {availableVars.map((varName) => (
          <button
            key={varName}
            type="button"
            onClick={() => insertVariable(varName)}
            className="px-2.5 py-1 text-xs bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            title={`Вставить {${varName}}`}
          >
            + {varName}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 border border-border rounded-lg bg-card text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        aria-invalid={!!validationError}
        aria-describedby={validationError ? 'template-error' : undefined}
      />

      {validationError && (
        <div
          id="template-error"
          className="flex items-start gap-2 text-xs text-danger"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}

      {value && !validationError && (
        <div className="bg-muted/50 rounded-lg p-4 border-l-4 border-accent">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Превью с примерными данными:
          </div>
          <div
            className="text-sm whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: generatePreview() }}
          />
        </div>
      )}
    </div>
  )
}
