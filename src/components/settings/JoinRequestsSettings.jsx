import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { apiFetch } from '../../services/api'
import { TouchButton, Modal, Button } from '../ui'
import {
  UserPlus,
  Check,
  X,
  Clock,
  Building2,
  User,
  Mail,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  Shield
} from 'lucide-react'
import SettingsLayout from './SettingsLayout'

export default function JoinRequestsSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user } = useAuth()

  const [requests, setRequests] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState(null)

  // Approve modal state
  const [approveModal, setApproveModal] = useState({ open: false, request: null })
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedRole, setSelectedRole] = useState('STAFF')

  // Reject modal state
  const [rejectModal, setRejectModal] = useState({ open: false, request: null })
  const [rejectNotes, setRejectNotes] = useState('')

  const fetchRequests = useCallback(async () => {
    try {
      const response = await apiFetch('/auth/join-requests')
      if (response.success) {
        setRequests(response.requests || [])
      }
    } catch (err) {
      console.error('Failed to fetch join requests:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Загружаем отделы для конкретного отеля (из заявки)
  const fetchDepartmentsForHotel = useCallback(async (hotelId) => {
    if (!hotelId) return
    try {
      const response = await apiFetch(`/departments?hotelId=${hotelId}`)
      if (response.success) {
        setDepartments(response.departments || [])
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchRequests()
  }

  const openApproveModal = (request) => {
    setApproveModal({ open: true, request })
    setSelectedDepartment('')
    setSelectedRole('STAFF')
    // Загружаем отделы для отеля из заявки
    if (request.hotel_id) {
      fetchDepartmentsForHotel(request.hotel_id)
    }
  }

  const openRejectModal = (request) => {
    setRejectModal({ open: true, request })
    setRejectNotes('')
  }

  const handleApprove = async () => {
    if (!approveModal.request) return

    // Для STAFF и DEPARTMENT_MANAGER требуется департамент
    if (
      (selectedRole === 'STAFF' || selectedRole === 'DEPARTMENT_MANAGER') &&
      !selectedDepartment
    ) {
      addToast('Выберите отдел', 'error')
      return
    }

    setProcessingId(approveModal.request.id)
    try {
      const response = await apiFetch(`/auth/join-requests/${approveModal.request.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          // departmentId отправляется для STAFF и DEPARTMENT_MANAGER
          departmentId:
            selectedRole === 'STAFF' || selectedRole === 'DEPARTMENT_MANAGER'
              ? selectedDepartment
              : null,
          role: selectedRole
        })
      })

      if (response.success) {
        addToast(t('joinRequests.approvedSuccess') || 'Заявка одобрена', 'success')
        setRequests((prev) => prev.filter((r) => r.id !== approveModal.request.id))
        setApproveModal({ open: false, request: null })
      } else {
        addToast(response.error || t('common.error'), 'error')
      }
    } catch (err) {
      addToast(err.message || t('common.error'), 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!rejectModal.request) return

    setProcessingId(rejectModal.request.id)
    try {
      const response = await apiFetch(`/auth/join-requests/${rejectModal.request.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: rejectNotes })
      })

      if (response.success) {
        addToast(t('joinRequests.rejectedSuccess') || 'Заявка отклонена', 'success')
        setRequests((prev) => prev.filter((r) => r.id !== rejectModal.request.id))
        setRejectModal({ open: false, request: null })
      } else {
        addToast(response.error || t('common.error'), 'error')
      }
    } catch (err) {
      addToast(err.message || t('common.error'), 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <SettingsLayout loading />
  }

  return (
    <SettingsLayout
      title={t('joinRequests.title') || 'Заявки на присоединение'}
      description={t('joinRequests.description') || 'Подтвердите или отклоните запросы сотрудников'}
      icon={UserPlus}
      headerActions={
        <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshing}>
          {!refreshing && <RefreshCw className="w-4 h-4 mr-2" />}
          {t('common.refresh') || 'Обновить'}
        </Button>
      }
    >

      {/* Requests list */}
      {requests.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="font-medium mb-2">{t('joinRequests.noRequests') || 'Нет новых заявок'}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {t('joinRequests.noRequestsDescription') ||
              'Когда сотрудники зарегистрируются с кодом вашего отеля, их заявки появятся здесь'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium truncate">{request.user_name}</h4>
                    <p className="text-sm text-muted-foreground truncate">@{request.user_login}</p>
                    {request.user_email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" />
                        {request.user_email}
                      </p>
                    )}
                    {/* Показываем отель для SUPER_ADMIN */}
                    {request.hotel_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="w-3 h-3" />
                        {request.hotel_name} {request.hotel_code && `(${request.hotel_code})`}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(request.requested_at || request.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openRejectModal(request)}
                    disabled={processingId === request.id}
                    className="text-danger border-danger/30 hover:bg-danger/10"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">
                      {t('common.reject') || 'Отклонить'}
                    </span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openApproveModal(request)}
                    disabled={processingId === request.id}
                  >
                    <Check className="w-4 h-4" />
                    <span className="hidden sm:inline ml-1">
                      {t('common.approve') || 'Одобрить'}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badge with count */}
      {requests.length > 0 && (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning rounded-full text-sm">
            <AlertCircle className="w-4 h-4" />
            {t('joinRequests.pendingCount', { count: requests.length }) ||
              `${requests.length} заявок ожидают рассмотрения`}
          </span>
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={approveModal.open}
        onClose={() => setApproveModal({ open: false, request: null })}
        title={t('joinRequests.approveTitle') || 'Одобрить заявку'}
      >
        <div className="space-y-4">
          {approveModal.request && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-1">
              <p className="font-medium">{approveModal.request.user_name}</p>
              <p className="text-sm text-muted-foreground">@{approveModal.request.user_login}</p>
              {approveModal.request.hotel_name && (
                <p className="text-sm text-accent flex items-center gap-1 mt-2">
                  <Building2 className="w-4 h-4" />
                  {approveModal.request.hotel_name}{' '}
                  {approveModal.request.hotel_code && `(${approveModal.request.hotel_code})`}
                </p>
              )}
            </div>
          )}

          {/* Выбор роли */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('joinRequests.selectRole') || 'Назначить роль'}
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <select
                value={selectedRole}
                onChange={(e) => {
                  setSelectedRole(e.target.value)
                  if (e.target.value === 'HOTEL_ADMIN') {
                    setSelectedDepartment('')
                  }
                }}
                className="w-full h-12 pl-10 pr-10 bg-card border border-border rounded-lg appearance-none cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              >
                <option value="STAFF">{t('roles.staff') || 'Сотрудник'}</option>
                <option value="DEPARTMENT_MANAGER">
                  {t('roles.departmentManager') || 'Менеджер отдела'}
                </option>
                <option value="HOTEL_ADMIN">
                  {t('roles.hotelAdmin') || 'Администратор отеля'}
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Выбор отдела (для STAFF и DEPARTMENT_MANAGER) */}
          {(selectedRole === 'STAFF' || selectedRole === 'DEPARTMENT_MANAGER') && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('joinRequests.selectDepartment') || 'Назначить в отдел'}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full h-12 pl-10 pr-10 bg-card border border-border rounded-lg appearance-none cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                >
                  <option value="">{t('joinRequests.chooseDepartment') || 'Выберите отдел'}</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <TouchButton
              variant="outline"
              className="flex-1"
              onClick={() => setApproveModal({ open: false, request: null })}
            >
              {t('common.cancel') || 'Отмена'}
            </TouchButton>
            <TouchButton
              variant="primary"
              icon={Check}
              iconPosition="left"
              className="flex-1"
              onClick={handleApprove}
              disabled={
                (selectedRole === 'STAFF' || selectedRole === 'DEPARTMENT_MANAGER') &&
                !selectedDepartment
              }
              loading={processingId === approveModal.request?.id}
            >
              {t('common.approve') || 'Одобрить'}
            </TouchButton>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false, request: null })}
        title={t('joinRequests.rejectTitle') || 'Отклонить заявку'}
      >
        <div className="space-y-4">
          {rejectModal.request && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium">{rejectModal.request.user_name}</p>
              <p className="text-sm text-muted-foreground">@{rejectModal.request.user_login}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('joinRequests.rejectReason') || 'Причина отклонения (опционально)'}
            </label>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder={t('joinRequests.rejectPlaceholder') || 'Укажите причину...'}
              className="w-full h-24 p-3 bg-card border border-border rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <TouchButton
              variant="outline"
              className="flex-1"
              onClick={() => setRejectModal({ open: false, request: null })}
            >
              {t('common.cancel') || 'Отмена'}
            </TouchButton>
            <TouchButton
              variant="danger"
              icon={X}
              iconPosition="left"
              className="flex-1"
              onClick={handleReject}
              loading={processingId === rejectModal.request?.id}
            >
              {t('common.reject') || 'Отклонить'}
            </TouchButton>
          </div>
        </div>
      </Modal>
    </SettingsLayout>
  )
}
