import { useState, useCallback } from 'react'
import { Save, AlertCircle } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../context/LanguageContext'
import { SectionLoader, ButtonLoader } from '../ui'

/**
 * Universal layout for all settings pages
 * Handles: loading, saving, error states, save button
 *
 * Usage:
 * <SettingsLayout
 *   title="My Settings"
 *   description="Configure something"
 *   onSave={async () => { await saveData() }}
 *   loading={isLoading}
 * >
 *   <YourSettingsContent />
 * </SettingsLayout>
 */
export default function SettingsLayout({
  title,
  description,
  icon: Icon,
  children,
  onSave,
  loading = false,
  saveButtonText,
  saveDisabled = false,
  hideSaveButton = false,
  actionsLeft,
  headerExtra,
  headerActions,
  className = ''
}) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleSave = useCallback(async () => {
    if (!onSave) return

    setSaving(true)
    setSaveError(null)

    try {
      const result = await onSave()

      addToast(
        {
          type: 'success',
          title: `✓ ${t('settings.saved') || t('common.saved') || 'Настройки сохранены'}`,
          message: result?.message || '',
          duration: 4000
        }
      )
    } catch (error) {
      setSaveError(error.message)

      addToast(
        {
          type: 'error',
          title: `✗ ${t('settings.saveError') || 'Ошибка сохранения'}`,
          message: error.message,
          duration: 10000
        }
      )
    } finally {
      setSaving(false)
    }
  }, [onSave, addToast, t])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className={headerActions ? 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4' : ''}>
        <div className="min-w-0">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
              <Icon className="w-6 h-6 text-accent" />
            </div>
          )}
          <h2 className="text-xl font-semibold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
          {headerExtra && <div className="mt-3">{headerExtra}</div>}
        </div>
        {headerActions && <div className="flex-shrink-0">{headerActions}</div>}
      </div>

      {/* Error banner */}
      {saveError && (
        <div
          className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-danger">
              {t('settings.saveError') || 'Ошибка сохранения'}
            </p>
            <p className="text-xs text-danger/80 mt-1">
              {saveError}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <SectionLoader
          message={t('common.loading') || 'Загрузка...'}
          className="py-12"
        />
      ) : (
        <div className="space-y-6">
          {children}
        </div>
      )}

      {/* Footer: save button and/or actionsLeft */}
      {!loading && (hideSaveButton ? !!actionsLeft : true) && (
        <div className={`flex items-center gap-3 pt-6 border-t border-border ${
          hideSaveButton ? 'justify-start' : actionsLeft ? 'justify-between' : 'justify-end'
        }`}>
          {actionsLeft && <div>{actionsLeft}</div>}
          {!hideSaveButton && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saveDisabled}
                aria-busy={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                {saving ? (
                  <>
                    <ButtonLoader />
                    {t('common.saving') || 'Сохранение...'}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {saveButtonText || t('common.save') || 'Сохранить'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Reusable card section for settings
 */
export function SettingsSection({ title, description, icon: Icon, children, className = '' }) {
  return (
    <div className={`p-6 border border-border rounded-xl bg-card ${className}`}>
      {(title || Icon) && (
        <div className="mb-4">
          {Icon && (
            <div className="flex items-center gap-3 mb-2">
              <Icon className="w-5 h-5 text-foreground" aria-hidden="true" />
              <h3 className="font-medium text-foreground">{title}</h3>
            </div>
          )}
          {!Icon && title && (
            <h3 className="font-medium text-foreground mb-2">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
