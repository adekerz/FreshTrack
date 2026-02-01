/**
 * Terms Acceptance Modal Component
 * Shown when user logs in but hasn't accepted the current version of Terms.
 * Uses partialToken pattern for multi-step auth flow.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Shield, Check, ExternalLink } from 'lucide-react'
import { TouchButton } from './ui'
import Modal from './ui/Modal'
import { apiFetch } from '../services/api'

const CURRENT_TERMS_VERSION = '1.0'

export default function TermsAcceptanceModal({
  isOpen,
  onAccept,
  onCancel,
  partialToken,
  loading: externalLoading = false
}) {
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleAccept = async () => {
    if (!accepted) {
      setError('Необходимо принять условия использования')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Call the accept-terms endpoint with the partial token
      const response = await apiFetch('/auth/accept-terms', {
        method: 'POST',
        body: JSON.stringify({
          partialToken,
          termsVersion: CURRENT_TERMS_VERSION
        })
      })

      if (response.success && response.token) {
        // Pass the full token back to the parent
        onAccept(response.token, response.user)
      } else {
        setError(response.error || 'Ошибка при принятии условий')
      }
    } catch (err) {
      setError(err.message || 'Ошибка сервера. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  const isLoading = loading || externalLoading

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Условия использования"
      size="medium"
      showCloseButton={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-accent" />
          </div>
          <p className="text-muted-foreground">
            Для продолжения работы необходимо ознакомиться и принять условия использования
            системы FreshTrack.
          </p>
        </div>

        {/* Documents links */}
        <div className="space-y-3">
          <Link
            to="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium text-foreground">Условия использования</p>
                <p className="text-sm text-muted-foreground">Версия {CURRENT_TERMS_VERSION}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Link>

          <Link
            to="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-accent" />
              <div>
                <p className="font-medium text-foreground">Политика конфиденциальности</p>
                <p className="text-sm text-muted-foreground">Версия {CURRENT_TERMS_VERSION}</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Acceptance checkbox */}
        <label className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked)
              if (e.target.checked) setError(null)
            }}
            className="mt-0.5 w-5 h-5 rounded border-border text-accent focus:ring-accent focus:ring-offset-0"
          />
          <span className="text-sm text-foreground leading-relaxed">
            Я прочитал(а) и принимаю{' '}
            <Link to="/terms" target="_blank" className="text-accent hover:underline">
              Условия использования
            </Link>{' '}
            и{' '}
            <Link to="/privacy" target="_blank" className="text-accent hover:underline">
              Политику конфиденциальности
            </Link>{' '}
            системы FreshTrack
          </span>
        </label>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <TouchButton
            variant="primary"
            onClick={handleAccept}
            disabled={!accepted || isLoading}
            loading={isLoading}
            icon={Check}
            iconPosition="left"
            className="flex-1"
          >
            Принять и продолжить
          </TouchButton>

          <TouchButton
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
          >
            Отмена
          </TouchButton>
        </div>

        {/* Info */}
        <p className="text-xs text-center text-muted-foreground">
          Принимая условия, вы подтверждаете, что вам исполнилось 18 лет
          и вы уполномочены использовать данную систему.
        </p>
      </div>
    </Modal>
  )
}
