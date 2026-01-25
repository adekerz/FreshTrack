/**
 * Settings Page - Страница настроек
 * Настройки системы и профиля пользователя
 * Расширенная админ-панель для управления всем
 * Updated: 2024-12-14
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { useOnboarding } from '../context/OnboardingContext'
import { departments } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../services/api'
import {
  User,
  Users,
  Bell,
  Languages,
  Shield,
  Settings,
  Check,
  AlertCircle,
  Tags,
  FileBox,
  Send,
  Mail,
  Palette,
  Database,
  RefreshCw,
  Building2,
  Crown,
  Wrench,
  UserPlus
} from 'lucide-react'
import NotificationRulesSettings from '../components/NotificationRulesSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import OrganizationSettings from '../components/settings/OrganizationSettings'
import DirectoriesSettings from '../components/settings/DirectoriesSettings'
import TemplatesSettings from '../components/settings/TemplatesSettings'
import NotificationsSettings from '../components/settings/NotificationsSettings'
import ImportExportSettings from '../components/settings/ImportExportSettings'
import BrandingSettings from '../components/settings/BrandingSettings'
import JoinRequestsSettings from '../components/settings/JoinRequestsSettings'
import CacheManagement from '../components/settings/CacheManagement'

const SETTINGS_TAB_IDS = new Set([
  'profile', 'language', 'general', 'users', 'join-requests', 'directories',
  'templates', 'rules', 'notifications', 'branding', 'cache', 'import-export', 'system'
])

export default function SettingsPage() {
  const { t } = useTranslation()
  const {
    user,
    hasPermission,
    canManage,
    isHotelAdmin,
    isSuperAdmin,
    isDepartmentManager,
    isStaff: isStaffRole,
    updateUser
  } = useAuth()
  const { language, changeLanguage } = useLanguage()
  const { startOnboarding, resetOnboarding } = useOnboarding()
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && SETTINGS_TAB_IDS.has(tab)) setActiveTab(tab)
  }, [searchParams])
  
  // Состояние для профиля
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState(null)

  // Обновляем profileData при изменении user
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || ''
      })
    }
  }, [user])

  // Настройки уведомлений (удалены - теперь управляются через правила уведомлений)

  // Языки - все 8 поддерживаемых
  const languages = [
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  ]

  // Проверка прав доступа к управлению настройками (только админы)
  // STAFF видит только личные настройки (профиль, язык)
  // Используем capabilities/helper функции вместо hardcoded ролей
  const userIsAdmin = isHotelAdmin()
  const userIsSuperAdmin = isSuperAdmin()
  const userIsStaff = isStaffRole()
  const userIsDepartmentManager = isDepartmentManager()

  // Табы для DEPARTMENT_MANAGER (управление своим департаментом)
  const departmentManagerTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'templates', icon: FileBox, label: t('settings.tabs.templates') || 'Шаблоны' },
    { id: 'categories', icon: Tags, label: t('settings.tabs.categories') || 'Категории' },
    { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications') },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') }
  ]

  // Табы для обычных пользователей (MANAGER)
  const managerTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications') },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') }
  ]

  // Табы для STAFF (без уведомлений, с шаблонами)
  const staffTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'templates', icon: FileBox, label: t('settings.tabs.templates') || 'Шаблоны' },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') }
  ]

  // Выбор табов для не-админов
  const userTabs = userIsStaff
    ? staffTabs
    : userIsDepartmentManager
      ? departmentManagerTabs
      : managerTabs

  // Базовые табы для админа (личные настройки)
  const personalTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') }
  ]

  // Табы управления системой (HOTEL_ADMIN и SUPER_ADMIN)
  // Для SUPER_ADMIN убираем "Пользователи" - есть "Организация"
  const managementTabs = [
    { id: 'general', icon: Settings, label: t('settings.tabs.general') || 'Общие' },
    // "Пользователи" только для HOTEL_ADMIN - SUPER_ADMIN управляет через "Организация"
    ...(userIsSuperAdmin
      ? []
      : [{ id: 'users', icon: Users, label: t('settings.tabs.users') || 'Пользователи' }]),
    { id: 'join-requests', icon: UserPlus, label: t('settings.tabs.joinRequests') || 'Заявки' },
    { id: 'directories', icon: Tags, label: t('settings.tabs.directories') || 'Справочники' },
    { id: 'templates', icon: FileBox, label: t('settings.tabs.templates') || 'Шаблоны' },
    { id: 'rules', icon: Bell, label: t('settings.tabs.rules') || 'Правила' },
    { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications') || 'Уведомления' },
    { id: 'branding', icon: Palette, label: t('settings.tabs.branding') || 'Брендинг' },
    { id: 'cache', icon: Database, label: t('settings.tabs.cache') || 'Кэш' },
    {
      id: 'import-export',
      icon: RefreshCw,
      label: t('settings.tabs.importExport') || 'Импорт/Экспорт'
    }
  ]

  // Табы только для SUPER_ADMIN (уникальные возможности)
  const superAdminTabs = [
    { id: 'organization', icon: Building2, label: 'Организация' },
    { id: 'system', icon: Shield, label: t('settings.tabs.system') }
  ]

  // Сохранение настроек
  const handleSave = async () => {
    setSaving(true)
    try {
      // Симуляция сохранения (в реальности - API запрос)
      await new Promise((resolve) => setTimeout(resolve, 500))
      setMessage({ type: 'success', text: t('settings.saved') })
      addToast(t('toast.settingsSaved'), 'success')
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') })
      addToast(t('toast.settingsSaveError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  // Сохранение профиля
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileMessage(null)
    
    try {
      // Валидация email
      if (profileData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
        setProfileMessage({ type: 'error', text: 'Неверный формат email адреса' })
        setSavingProfile(false)
        return
      }

      const result = await apiFetch('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email || null
        })
      })

      if (result.success) {
        setProfileMessage({ type: 'success', text: t('settings.profile.saved') || 'Профиль обновлен' })
        addToast(t('settings.profile.saved') || 'Профиль обновлен', 'success')
        
        // Обновляем данные пользователя в контексте
        if (result.user && updateUser) {
          updateUser(result.user)
        }
        
        setTimeout(() => setProfileMessage(null), 3000)
      } else {
        setProfileMessage({ type: 'error', text: result.error || t('settings.profile.saveError') || 'Ошибка сохранения' })
      }
    } catch (error) {
      setProfileMessage({ 
        type: 'error', 
        text: error.error || error.message || t('settings.profile.saveError') || 'Ошибка сохранения' 
      })
    } finally {
      setSavingProfile(false)
    }
  }

  // Рендер профиля
  const renderProfile = () => (
    <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground mb-4">{t('settings.profile.title')}</h3>

          {profileMessage && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                profileMessage.type === 'success'
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-danger/10 text-danger border border-danger/20'
              }`}
            >
              {profileMessage.type === 'success' ? (
                <Check className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              {profileMessage.text}
            </div>
          )}

          <div className="space-y-4">
            {/* Аватар */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-charcoal dark:bg-accent rounded-full flex items-center justify-center text-white text-xl font-light">
                {profileData.name?.[0] || user?.name?.[0] || 'U'}
              </div>
              <div>
                <p className="font-medium text-foreground">{profileData.name || user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {profileData.email || user?.email || t('settings.profile.noEmail') || 'Email не указан'}
                </p>
              </div>
            </div>

            {/* Информация */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  {t('settings.profile.name') || 'Имя'}
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  {t('settings.profile.email') || 'Email'}
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  placeholder={t('settings.profile.emailPlaceholder') || 'example@email.com'}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
                {!user?.email && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.profile.emailHint') || 'Добавьте email для получения уведомлений'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  {t('settings.profile.login')}
                </label>
                <input
                  type="text"
                  value={user?.login || ''}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  {t('settings.profile.role')}
                </label>
                <input
                  type="text"
                  value={user?.roleLabel || t(`settings.profile.role${user?.role}`) || user?.role}
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground"
                />
              </div>
            </div>

            {/* Доступные отделы */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                {t('settings.profile.departments')}
              </label>
              <div className="flex flex-wrap gap-2">
                {user?.departments?.map((deptId) => {
                  const dept = departments.find((d) => d.id === deptId)
                  return (
                    <span
                      key={deptId}
                      className="px-3 py-1 bg-muted text-foreground text-sm rounded-full"
                    >
                      {dept?.name || deptId}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Кнопка сохранения */}
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || (profileData.name === user?.name && profileData.email === (user?.email || ''))}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t('common.save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
  )

  // Рендер настроек уведомлений (для обычных пользователей)
  // Настройки уведомлений теперь управляются администратором через правила уведомлений
  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="p-6 border border-border rounded-xl bg-card">
        <h3 className="text-lg font-medium text-foreground mb-4">
          {t('settings.notifications.title')}
        </h3>
        <p className="text-muted-foreground">
          {t('settings.notifications.userNote') || 'Настройки уведомлений (дни предупреждения, критические дни, время отправки) управляются администратором в разделе "Правила уведомлений".'}
        </p>
      </div>
    </div>
  )

  // Рендер языковых настроек
  const renderLanguage = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">{t('settings.language.title')}</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border transition-all ${
                language === lang.code
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span
                className={`text-sm font-medium ${
                  language === lang.code ? 'text-accent' : 'text-foreground'
                }`}
              >
                {lang.name}
              </span>
              {language === lang.code && <Check className="w-4 h-4 text-accent ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding Tour Reset */}
      <div className="pt-6 border-t border-border">
        <h3 className="text-lg font-medium text-foreground mb-4">
          {t('settings.onboarding.title') || 'Guided Tour'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('settings.onboarding.description') ||
            'Restart the guided tour to learn about the app features.'}
        </p>
        <button
          onClick={() => {
            resetOnboarding()
            startOnboarding()
            addToast(t('settings.onboarding.restarted') || 'Tour restarted', 'success')
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          {t('settings.onboarding.restart') || 'Restart Tour'}
        </button>
      </div>
    </div>
  )

  // Рендер системных настроек (только для админа)
  const [systemHealth, setSystemHealth] = useState(null)
  const [systemLoading, setSystemLoading] = useState(false)

  const checkSystemHealth = async () => {
    setSystemLoading(true)
    try {
      const response = await fetch('/api/health/detailed')
      const data = await response.json()
      setSystemHealth(data)
    } catch (error) {
      setSystemHealth({
        success: false,
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message
      })
    } finally {
      setSystemLoading(false)
    }
  }

  // Автопроверка при открытии вкладки "Система"
  useEffect(() => {
    if (activeTab === 'system' && !systemHealth) {
      checkSystemHealth()
    }
  }, [activeTab, systemHealth])

  const renderSystem = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground mb-4">{t('settings.system.title')}</h3>

        <div className="space-y-4">
          {/* Статус системы */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-foreground" />
                <span className="font-medium text-foreground">
                  {t('settings.system.healthStatus')}
                </span>
              </div>
              <button
                onClick={checkSystemHealth}
                disabled={systemLoading}
                className="p-2 hover:bg-muted-foreground/10 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${systemLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {systemLoading ? (
              <div className="text-sm text-muted-foreground">{t('common.loading')}...</div>
            ) : systemHealth ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('settings.system.status')}</span>
                  <span
                    className={`font-medium ${systemHealth.success ? 'text-success' : 'text-destructive'}`}
                  >
                    {systemHealth.success
                      ? t('settings.system.healthy')
                      : t('settings.system.unhealthy')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('settings.system.database')}</span>
                  <span
                    className={`font-medium ${systemHealth.database === 'connected' ? 'text-success' : 'text-destructive'}`}
                  >
                    {systemHealth.database === 'connected'
                      ? t('settings.system.connected')
                      : t('settings.system.disconnected')}
                  </span>
                </div>
                {systemHealth.server_time && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('settings.system.serverTime')}</span>
                    <span className="text-foreground font-mono text-xs">
                      {new Date(systemHealth.server_time).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={checkSystemHealth} className="text-sm text-primary hover:underline">
                {t('settings.system.checkHealth')}
              </button>
            )}
          </div>

          {/* Версия */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">{t('settings.system.version')}</span>
            <span className="text-sm text-foreground font-mono">
              {systemHealth?.version || '2.0.0'}
            </span>
          </div>

          {/* Окружение */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {t('settings.system.environment')}
            </span>
            <span className="text-sm text-foreground font-mono">
              {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6 p-1 sm:p-0">
      {/* Заголовок */}
      <div>
        <h1 className="text-xl sm:text-2xl font-light text-foreground">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      {/* Сообщение */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 sm:p-4 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          )}
          <span className="truncate">{message.text}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Табы - горизонтальная прокрутка на мобильных */}
        <div className="lg:w-64 shrink-0 space-y-3">
          {/* Личные настройки */}
          {userIsAdmin ? (
            <>
              {/* Личные */}
              <div className="bg-card rounded-xl border border-border p-1.5 sm:p-2">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Личные
                </div>
                <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                  {personalTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full ${
                        activeTab === tab.id
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Управление */}
              <div className="bg-card rounded-xl border border-border p-1.5 sm:p-2">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Управление
                </div>
                <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                  {managementTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full ${
                        activeTab === tab.id
                          ? 'bg-foreground text-background'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Super Admin раздел */}
              {userIsSuperAdmin && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/30 p-1.5 sm:p-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Супер-Админ
                  </div>
                  <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                    {superAdminTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full ${
                          activeTab === tab.id
                            ? 'bg-amber-500 text-white'
                            : 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Обычный пользователь */
            <div className="bg-card rounded-xl border border-border p-1.5 sm:p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {userTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full ${
                    activeTab === tab.id
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Контент */}
        <div className="flex-1 bg-card rounded-xl border border-border p-4 sm:p-6">
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'notifications' && !userIsAdmin && renderNotifications()}
          {activeTab === 'language' && renderLanguage()}
          {activeTab === 'general' && userIsAdmin && <GeneralSettings />}
          {activeTab === 'users' && userIsAdmin && <OrganizationSettings />}
          {activeTab === 'join-requests' && userIsAdmin && <JoinRequestsSettings />}
          {activeTab === 'organization' && userIsSuperAdmin && <OrganizationSettings />}
          {activeTab === 'directories' && userIsAdmin && <DirectoriesSettings />}
          {activeTab === 'directories' && userIsDepartmentManager && !userIsAdmin && (
            <DirectoriesSettings readOnly />
          )}
          {/* Шаблоны: админы и DEPARTMENT_MANAGER - полный доступ, STAFF - только чтение */}
          {activeTab === 'templates' && userIsAdmin && <TemplatesSettings />}
          {activeTab === 'templates' && userIsDepartmentManager && !userIsAdmin && (
            <TemplatesSettings />
          )}
          {activeTab === 'templates' && userIsStaff && <TemplatesSettings readOnly />}
          {activeTab === 'rules' && userIsAdmin && <NotificationRulesSettings />}
          {activeTab === 'notifications' && userIsAdmin && <NotificationsSettings />}
          {activeTab === 'branding' && userIsAdmin && <BrandingSettings />}
          {activeTab === 'cache' && userIsAdmin && <CacheManagement />}
          {activeTab === 'import-export' && userIsAdmin && <ImportExportSettings />}
          {activeTab === 'system' && userIsSuperAdmin && renderSystem()}

          {/* Кнопка сохранения удалена - настройки уведомлений теперь управляются через правила уведомлений */}
        </div>
      </div>
    </div>
  )
}
