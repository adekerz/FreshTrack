/**
 * Settings Page - Страница настроек
 * Настройки системы и профиля пользователя
 * Расширенная админ-панель для управления всем
 * Updated: 2024-12-14
 */

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { departments } from '../context/ProductContext'
import { useToast } from '../context/ToastContext'
import {
  User,
  Bell,
  Languages,
  Shield,
  Settings,
  Check,
  AlertCircle,
  Image,
  Users,
  Package,
  Tags,
  FileBox,
  Send,
  Palette,
  Database
} from 'lucide-react'
import NotificationRulesSettings from '../components/NotificationRulesSettings'
import CustomContentSettings from '../components/CustomContentSettings'
import GeneralSettings from '../components/settings/GeneralSettings'
import UsersSettings from '../components/settings/UsersSettings'
import CategoriesSettings from '../components/settings/CategoriesSettings'
import TemplatesSettings from '../components/settings/TemplatesSettings'
import TelegramSettings from '../components/settings/TelegramSettings'
import ImportExportSettings from '../components/settings/ImportExportSettings'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { language, changeLanguage } = useLanguage()
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Настройки уведомлений
  const [notificationSettings, setNotificationSettings] = useState({
    warningDays: 7,
    criticalDays: 3,
    notificationTime: '09:00',
    enableWeekends: true
  })

  // Языки
  const languages = [
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'kk', name: 'Қазақша', flag: '🇰🇿' }
  ]

  // Проверка является ли пользователь админом
  const isAdmin = () => {
    const role = user?.role?.toUpperCase()
    return role === 'SUPER_ADMIN' || role === 'HOTEL_ADMIN'
  }

  const userIsAdmin = isAdmin()

  // Табы для обычных пользователей
  const userTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'notifications', icon: Bell, label: t('settings.tabs.notifications') },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') }
  ]

  // Расширенные табы для админа
  const adminTabs = [
    { id: 'profile', icon: User, label: t('settings.tabs.profile') },
    { id: 'general', icon: Settings, label: t('settings.tabs.general') || 'Общие' },
    { id: 'users', icon: Users, label: t('settings.tabs.users') || 'Пользователи' },
    { id: 'categories', icon: Tags, label: t('settings.tabs.categories') || 'Категории' },
    { id: 'templates', icon: FileBox, label: t('settings.tabs.templates') || 'Шаблоны' },
    { id: 'rules', icon: Bell, label: t('settings.tabs.rules') || 'Правила' },
    { id: 'telegram', icon: Send, label: t('settings.tabs.telegram') || 'Telegram' },
    { id: 'branding', icon: Palette, label: t('settings.tabs.branding') || 'Брендинг' },
    { id: 'import-export', icon: Database, label: t('settings.tabs.importExport') || 'Импорт/Экспорт' },
    { id: 'language', icon: Languages, label: t('settings.tabs.language') },
    { id: 'system', icon: Shield, label: t('settings.tabs.system') }
  ]

  // Выбор табов в зависимости от роли
  const tabs = userIsAdmin ? adminTabs : userTabs

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

  // Рендер профиля
  const renderProfile = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-charcoal mb-4">{t('settings.profile.title')}</h3>

        <div className="space-y-4">
          {/* Аватар */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-charcoal rounded-full flex items-center justify-center text-white text-xl font-light">
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <p className="font-medium text-charcoal">{user?.name}</p>
              <p className="text-sm text-warmgray">{user?.email}</p>
            </div>
          </div>

          {/* Информация */}
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('settings.profile.login')}
              </label>
              <input
                type="text"
                value={user?.login || ''}
                disabled
                className="w-full px-3 py-2 border border-sand rounded-lg bg-cream/50 text-warmgray"
              />
            </div>
            <div>
              <label className="block text-sm text-warmgray mb-1">
                {t('settings.profile.role')}
              </label>
              <input
                type="text"
                value={
                  userIsAdmin
                    ? t('settings.profile.roleAdmin')
                    : t('settings.profile.roleManager')
                }
                disabled
                className="w-full px-3 py-2 border border-sand rounded-lg bg-cream/50 text-warmgray"
              />
            </div>
          </div>

          {/* Доступные отделы */}
          <div>
            <label className="block text-sm text-warmgray mb-2">
              {t('settings.profile.departments')}
            </label>
            <div className="flex flex-wrap gap-2">
              {user?.departments?.map((deptId) => {
                const dept = departments.find(d => d.id === deptId)
                return (
                  <span
                    key={deptId}
                    className="px-3 py-1 bg-sand/50 text-charcoal text-sm rounded-full"
                  >
                    {dept?.name || deptId}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Рендер настроек уведомлений
  const renderNotifications = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-charcoal mb-4">
          {t('settings.notifications.title')}
        </h3>

        <div className="space-y-4">
          {/* Дни предупреждения */}
          <div>
            <label className="block text-sm text-warmgray mb-1">
              {t('settings.notifications.warningDays')}
            </label>
            <select
              value={notificationSettings.warningDays}
              onChange={(e) =>
                setNotificationSettings((prev) => ({
                  ...prev,
                  warningDays: parseInt(e.target.value)
                }))
              }
              className="w-full sm:w-48 px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              {[3, 5, 7, 10, 14].map((days) => (
                <option key={days} value={days}>
                  {days} {t('settings.notifications.days')}
                </option>
              ))}
            </select>
          </div>

          {/* Критические дни */}
          <div>
            <label className="block text-sm text-warmgray mb-1">
              {t('settings.notifications.criticalDays')}
            </label>
            <select
              value={notificationSettings.criticalDays}
              onChange={(e) =>
                setNotificationSettings((prev) => ({
                  ...prev,
                  criticalDays: parseInt(e.target.value)
                }))
              }
              className="w-full sm:w-48 px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              {[1, 2, 3, 5].map((days) => (
                <option key={days} value={days}>
                  {days} {t('settings.notifications.days')}
                </option>
              ))}
            </select>
          </div>

          {/* Время уведомления */}
          <div>
            <label className="block text-sm text-warmgray mb-1">
              {t('settings.notifications.time')}
            </label>
            <input
              type="time"
              value={notificationSettings.notificationTime}
              onChange={(e) =>
                setNotificationSettings((prev) => ({
                  ...prev,
                  notificationTime: e.target.value
                }))
              }
              className="w-full sm:w-48 px-3 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {/* Выходные */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="weekends"
              checked={notificationSettings.enableWeekends}
              onChange={(e) =>
                setNotificationSettings((prev) => ({
                  ...prev,
                  enableWeekends: e.target.checked
                }))
              }
              className="w-4 h-4 text-accent border-sand rounded focus:ring-accent"
            />
            <label htmlFor="weekends" className="text-sm text-charcoal">
              {t('settings.notifications.weekends')}
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  // Рендер языковых настроек
  const renderLanguage = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-charcoal mb-4">{t('settings.language.title')}</h3>

        <div className="grid sm:grid-cols-3 gap-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                language === lang.code
                  ? 'border-accent bg-accent/5'
                  : 'border-sand hover:border-warmgray'
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span
                className={`text-sm font-medium ${
                  language === lang.code ? 'text-accent' : 'text-charcoal'
                }`}
              >
                {lang.name}
              </span>
              {language === lang.code && <Check className="w-4 h-4 text-accent ml-auto" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // Рендер системных настроек (только для админа)
  const renderSystem = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-charcoal mb-4">{t('settings.system.title')}</h3>

        <div className="space-y-4">
          {/* Telegram настройки */}
          <div className="p-4 bg-cream/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-charcoal" />
              <span className="font-medium text-charcoal">Telegram Bot</span>
            </div>
            <p className="text-sm text-warmgray mb-3">{t('settings.system.telegramDescription')}</p>
            <div className="text-sm">
              <p className="text-warmgray">
                Chat ID: <span className="text-charcoal font-mono">-5090103384</span>
              </p>
              <p className="text-warmgray">
                Bot: <span className="text-charcoal">@FreshTrackBot</span>
              </p>
            </div>
          </div>

          {/* Версия */}
          <div className="flex items-center justify-between py-3 border-t border-sand">
            <span className="text-sm text-warmgray">{t('settings.system.version')}</span>
            <span className="text-sm text-charcoal font-mono">1.0.0</span>
          </div>

          {/* База данных */}
          <div className="flex items-center justify-between py-3 border-t border-sand">
            <span className="text-sm text-warmgray">{t('settings.system.database')}</span>
            <span className="text-sm text-success font-medium">
              {t('settings.system.connected')}
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
        <h1 className="text-xl sm:text-2xl font-light text-charcoal">{t('settings.title')}</h1>
        <p className="text-warmgray text-xs sm:text-sm mt-1">{t('settings.subtitle')}</p>
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
        <div className="lg:w-64 shrink-0">
          <div className="bg-white rounded-xl border border-sand p-1.5 sm:p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 lg:w-full ${
                  activeTab === tab.id
                    ? 'bg-charcoal text-white'
                    : 'text-warmgray hover:bg-sand/50 hover:text-charcoal'
                }`}
              >
                <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 bg-white rounded-xl border border-sand p-4 sm:p-6">
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'notifications' && renderNotifications()}
          {activeTab === 'language' && renderLanguage()}
          {activeTab === 'general' && userIsAdmin && <GeneralSettings />}
          {activeTab === 'users' && userIsAdmin && <UsersSettings />}
          {activeTab === 'categories' && userIsAdmin && <CategoriesSettings />}
          {activeTab === 'templates' && userIsAdmin && <TemplatesSettings />}
          {activeTab === 'rules' && userIsAdmin && <NotificationRulesSettings />}
          {activeTab === 'telegram' && userIsAdmin && <TelegramSettings />}
          {activeTab === 'branding' && userIsAdmin && <CustomContentSettings />}
          {activeTab === 'import-export' && userIsAdmin && <ImportExportSettings />}
          {activeTab === 'system' && userIsAdmin && renderSystem()}

          {/* Кнопка сохранения (только для вкладок уведомлений у обычных пользователей) */}
          {activeTab === 'notifications' && !userIsAdmin && (
              <div className="flex justify-end pt-4 sm:pt-6 mt-4 sm:mt-6 border-t border-sand">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-charcoal text-white rounded-lg text-xs sm:text-sm hover:bg-charcoal/90 transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
                >
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
