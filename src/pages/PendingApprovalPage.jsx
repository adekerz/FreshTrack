import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Leaf, Clock, RefreshCw, LogOut, CheckCircle, XCircle, Building2 } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { TouchButton } from '../components/ui'

export default function PendingApprovalPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { logout, user, updateUser } = useAuth()

  const [status, setStatus] = useState({
    loading: true,
    approved: false,
    rejected: false,
    data: null,
    error: null
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState(null)

  const checkStatus = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await apiFetch('/auth/pending-status')
      console.log('[PendingApprovalPage] Status response:', response)

      if (response.success) {
        if (response.status === 'active') {
          setStatus({
            loading: false,
            approved: true,
            rejected: false,
            data: response,
            error: null
          })
        } else if (response.status === 'rejected') {
          setStatus({
            loading: false,
            approved: false,
            rejected: true,
            data: response,
            error: null
          })
        } else {
          // pending или другой статус
          setStatus({
            loading: false,
            approved: false,
            rejected: false,
            data: response,
            error: null
          })
        }
      } else {
        setStatus({
          loading: false,
          approved: false,
          rejected: false,
          data: null,
          error: response.error || 'Неизвестная ошибка'
        })
      }
      setLastChecked(new Date())
    } catch (err) {
      console.error('Failed to check status:', err)
      setStatus((prev) => ({ ...prev, loading: false, error: err.message || 'Ошибка сети' }))
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Initial check
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [checkStatus])

  // Redirect if approved
  useEffect(() => {
    if (status.approved && status.data) {
      // Update user data in AuthContext before redirect
      // Полностью обновляем данные пользователя включая роль и permissions
      updateUser({
        status: 'active',
        role: status.data.role || user?.role || 'STAFF',
        hotel_id: status.data.hotel?.id || status.data.hotel_id,
        department_id: status.data.department_id,
        hotel: status.data.hotel,
        permissions: status.data.permissions || []
      })

      const timer = setTimeout(() => {
        // Force refresh to reload all contexts with new user data
        window.location.href = '/'
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status.approved, status.data, updateUser, user?.role])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatTime = (date) => {
    if (!date) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 border border-accent flex items-center justify-center">
            <Leaf className="w-6 h-6 text-accent" />
          </div>
          <span className="font-serif text-2xl tracking-wide">{t('common.appName')}</span>
        </div>

        {/* Main Card */}
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          {/* Approved State */}
          {status.approved && (
            <div className="animate-fade-in">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <h1 className="font-serif text-2xl mb-2">
                {t('pending.approved') || 'Заявка одобрена!'}
              </h1>
              <p className="text-muted-foreground mb-4">
                {t('pending.redirecting') || 'Перенаправление...'}
              </p>
              {status.data?.hotel && (
                <p className="text-sm flex items-center justify-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {status.data.hotel.name || status.data.hotel.marsha_code}
                </p>
              )}
            </div>
          )}

          {/* Rejected State */}
          {status.rejected && (
            <div className="animate-fade-in">
              <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-danger" />
              </div>
              <h1 className="font-serif text-2xl mb-2">
                {t('pending.rejected') || 'Заявка отклонена'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t('pending.rejectedMessage') ||
                  'К сожалению, ваша заявка была отклонена администратором.'}
              </p>
              {status.data?.notes && (
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t('pending.reason') || 'Причина:'}
                  </p>
                  <p className="text-sm">{status.data.notes}</p>
                </div>
              )}
              <TouchButton onClick={handleLogout} variant="outline" fullWidth icon={LogOut} iconPosition="left">
                {t('pending.backToLogin') || 'Вернуться к входу'}
              </TouchButton>
            </div>
          )}

          {/* Pending State */}
          {!status.approved && !status.rejected && !status.loading && !status.error && (
            <div className="animate-fade-in">
              <div className="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-warning" />
              </div>
              <h1 className="font-serif text-2xl mb-2">
                {t('pending.title') || 'Ожидание подтверждения'}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t('pending.message') ||
                  'Ваша заявка отправлена администратору. Пожалуйста, дождитесь подтверждения.'}
              </p>

              {status.data?.hotel && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-1">
                    {t('pending.requestedHotel') || 'Запрошенный отель:'}
                  </p>
                  <p className="font-medium flex items-center justify-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {status.data.hotel}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <TouchButton
                  onClick={checkStatus}
                  variant="outline"
                  loading={isRefreshing}
                  fullWidth
                  icon={RefreshCw}
                  iconPosition="left"
                >
                  {t('pending.checkStatus') || 'Проверить статус'}
                </TouchButton>

                {lastChecked && (
                  <p className="text-xs text-muted-foreground">
                    {t('pending.lastChecked') || 'Последняя проверка:'} {formatTime(lastChecked)}
                  </p>
                )}

                <div className="border-t border-border pt-4 mt-2">
                  <TouchButton onClick={handleLogout} variant="ghost" size="small" fullWidth icon={LogOut} iconPosition="left">
                    {t('pending.logout') || 'Выйти из аккаунта'}
                  </TouchButton>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {status.error && !status.loading && (
            <div className="animate-fade-in">
              <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-danger" />
              </div>
              <h1 className="font-serif text-2xl mb-2">Ошибка загрузки</h1>
              <p className="text-muted-foreground mb-6">{status.error}</p>
              <div className="flex flex-col gap-3">
                <TouchButton
                  onClick={checkStatus}
                  variant="outline"
                  loading={isRefreshing}
                  fullWidth
                  icon={RefreshCw}
                  iconPosition="left"
                >
                  Повторить
                </TouchButton>
                <TouchButton onClick={handleLogout} variant="ghost" size="small" fullWidth icon={LogOut} iconPosition="left">
                  {t('pending.logout') || 'Выйти из аккаунта'}
                </TouchButton>
              </div>
            </div>
          )}

          {/* Loading State */}
          {status.loading && (
            <div className="animate-pulse">
              <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-6" />
              <div className="h-8 bg-muted rounded w-2/3 mx-auto mb-4" />
              <div className="h-4 bg-muted rounded w-full mb-2" />
              <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          {t('pending.autoRefresh') || 'Статус обновляется автоматически каждые 30 секунд'}
        </p>
      </div>
    </div>
  )
}
