/**
 * Switch — единый переключатель в стиле iOS
 * Акцентный цвет проекта (primary), фиксированный размер на мобилке и десктопе
 */

export default function Switch({
  id,
  checked = false,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className = ''
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      className={`
        relative inline-flex shrink-0 items-center
        w-[50px] h-[28px] min-w-[50px] min-h-[28px] max-w-[50px] max-h-[28px]
        rounded-full cursor-pointer
        transition-colors duration-200 ease-out
        focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'switch-track-on' : 'bg-muted dark:bg-dark-border focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background'}
        ${className}
      `}
    >
      <span
        aria-hidden
        className={`
          pointer-events-none absolute top-[3px] left-0 w-[22px] h-[22px] rounded-full bg-white
          shadow-sm
          transition-transform duration-200 ease-out
          ${checked ? 'translate-x-[26px]' : 'translate-x-[3px]'}
        `}
      />
    </button>
  )
}
