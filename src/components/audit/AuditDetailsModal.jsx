import { useState } from 'react'
import { Clock, User, Monitor, Globe, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '../../context/LanguageContext'
import { formatDate } from '../../utils/dateUtils'
import Modal from '../ui/Modal'

export function AuditDetailsModal({ log, onClose }) {
  const { t } = useTranslation()
  const [showJson, setShowJson] = useState(false)

  if (!log) return null

  const showIP = [
    'LOGIN',
    'LOGOUT',
    'PASSWORD_CHANGED',
    'EMAIL_CHANGED',
    'MFA_ENABLED',
    'MFA_DISABLED'
  ].includes(log.action)

  return (
    <Modal
      isOpen={!!log}
      onClose={onClose}
      title={t('auditLogs.detailsTitle')}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
        >
          {t('common.close')}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Main Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {t('auditLogs.time')}
            </label>
            <p className="font-medium text-foreground mt-0.5">
              {formatDate(log.created_at, true)}
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="w-4 h-4" />
              {t('auditLogs.user')}
            </label>
            <p className="font-medium text-foreground mt-0.5">
              {log.user_name}
              {log.department_name && (
                <span className="block text-sm text-muted-foreground font-normal">
                  {log.department_name}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action & Description */}
        <div>
          <label className="text-sm text-muted-foreground">{t('auditLogs.action')}</label>
          <p className="font-medium text-foreground mt-0.5">
            {log.human_readable_description || log.action}
          </p>
        </div>

        {/* Details */}
        {log.human_readable_details && (
          <div>
            <label className="text-sm text-muted-foreground">{t('auditLogs.details')}</label>
            <p className="text-foreground text-sm mt-0.5 bg-muted p-3 rounded-lg">
              {log.human_readable_details}
            </p>
          </div>
        )}

        {/* Technical Details */}
        {(log.browser_name || log.os_name || showIP) && (
          <div>
            <label className="text-sm text-muted-foreground">
              {t('auditLogs.technicalDetails')}
            </label>
            <div className="mt-1 space-y-2">
              {log.browser_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('auditLogs.browser')}:</span>
                  <span className="text-foreground">{log.browser_name}</span>
                </div>
              )}
              {log.os_name && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('auditLogs.os')}:</span>
                  <span className="text-foreground">{log.os_name}</span>
                </div>
              )}
              {showIP && log.ip_address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('auditLogs.ipAddress')}:</span>
                  <span className="font-mono text-foreground">{log.ip_address}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Raw Snapshots (collapsible) */}
        {(log.snapshot_before || log.snapshot_after) && (
          <div>
            <button
              type="button"
              onClick={() => setShowJson(!showJson)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors"
            >
              {showJson ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {t('auditLogs.technicalDataJson')}
            </button>
            {showJson && (
              <div className="mt-2 space-y-3">
                {log.snapshot_before && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('auditLogs.beforeChange')}
                    </p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(log.snapshot_before, null, 2)}
                    </pre>
                  </div>
                )}
                {log.snapshot_after && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('auditLogs.afterChange')}
                    </p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
                      {JSON.stringify(log.snapshot_after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
