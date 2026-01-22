/**
 * BrandingSettings - Настройки брендинга
 * Управление логотипом, цветами, названием сайта
 * Real-time обновления через SSE
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
import { useAuth } from '../../context/AuthContext'
import {
  RotateCcw,
  Upload,
  Image,
  Palette,
  Type,
  AlertTriangle,
  LogIn,
  ShieldCheck,
  Bell,
  BarChart3
} from 'lucide-react'
import { ButtonLoader, SectionLoader } from '../ui'
import { API_BASE_URL, getStaticUrl, apiFetch } from '../../services/api'
import SettingsLayout, { SettingsSection } from './SettingsLayout'
import { useSimpleUnsavedChanges } from '../../hooks/useUnsavedChanges'

const defaultLoginBranding = {
  title: 'Точность в каждой',
  highlight: 'Детали',
  description:
    'Поднимаем управление запасами на новый уровень. Умный контроль сроков годности, минимизация потерь и максимальная эффективность.',
  feature1: 'Безопасно',
  feature2: 'Умные оповещения',
  feature3: 'Аналитика'
}

export default function BrandingSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { user } = useAuth()
  const {
    branding,
    updateBranding,
    resetBranding,
    loading: brandingLoading,
    isConnected
  } = useBranding()

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [localBranding, setLocalBranding] = useState({ ...branding })
  const [resetting, setResetting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const fileInputRef = useRef(null)

  const [initialBranding, setInitialBranding] = useState({ ...branding })
  const [loginBranding, setLoginBranding] = useState(defaultLoginBranding)
  const [initialLoginBranding, setInitialLoginBranding] = useState(defaultLoginBranding)
  const [loginLoading, setLoginLoading] = useState(false)

  const initialSnapshot = useMemo(
    () => ({ b: initialBranding, l: isSuperAdmin ? initialLoginBranding : null }),
    [initialBranding, initialLoginBranding, isSuperAdmin]
  )
  const currentSnapshot = useMemo(
    () => ({ b: localBranding, l: isSuperAdmin ? loginBranding : null }),
    [localBranding, loginBranding, isSuperAdmin]
  )
  const hasUnsavedChanges = useSimpleUnsavedChanges(initialSnapshot, currentSnapshot)

  useEffect(() => {
    if (isSuperAdmin) loadLoginBranding()
  }, [isSuperAdmin])

  const loadLoginBranding = async () => {
    setLoginLoading(true)
    try {
      const response = await apiFetch('/settings/login-branding')
      if (response.success && response.loginBranding) {
        const next = { ...defaultLoginBranding, ...response.loginBranding }
        setLoginBranding(next)
        setInitialLoginBranding(next)
      }
    } catch (error) {
      console.error('Failed to load login branding:', error)
    } finally {
      setLoginLoading(false)
    }
  }

  const initialSyncedRef = useRef(false)
  useEffect(() => {
    setLocalBranding({ ...branding })
    if (!initialSyncedRef.current && (branding.siteName || Object.keys(branding).length > 0)) {
      setInitialBranding({ ...branding })
      initialSyncedRef.current = true
    }
  }, [branding])

  const handleChange = (key, value) => {
    setLocalBranding((prev) => ({ ...prev, [key]: value }))
  }

  const handleLoginBrandingChange = (key, value) => {
    setLoginBranding((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const result = await updateBranding(localBranding)
    if (!result.success) {
      throw new Error(result.error || t('settings.saveError'))
    }
    if (isSuperAdmin) {
      await apiFetch('/settings/login-branding', {
        method: 'PUT',
        body: JSON.stringify({ branding: loginBranding })
      })
    }
    setInitialBranding(localBranding)
    if (isSuperAdmin) setInitialLoginBranding(loginBranding)
    return { message: t('toast.settingsSaved') || 'Брендинг обновлен' }
  }

  const handleReset = () => setResetConfirm(true)

  const handleConfirmReset = async () => {
    setResetConfirm(false)
    setResetting(true)
    try {
      const result = await resetBranding()
      if (!result.success) throw new Error(result.error)
      if (result.branding) {
        setLocalBranding({ ...result.branding })
        setInitialBranding({ ...result.branding })
      } else {
        setLocalBranding({ ...branding })
        setInitialBranding({ ...branding })
      }
      if (result.loginBranding && isSuperAdmin) {
        const next = { ...defaultLoginBranding, ...result.loginBranding }
        setLoginBranding(next)
        setInitialLoginBranding(next)
      }
      addToast(t('branding.reset') || 'Брендинг сброшен', 'success')
    } catch (error) {
      addToast(error.message, 'error')
    } finally {
      setResetting(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast(t('branding.invalidFileType') || 'Только изображения', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast(t('branding.fileTooLarge') || 'Файл слишком большой (макс 5MB)', 'error')
      return
    }
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const token = localStorage.getItem('freshtrack_token')
      const response = await fetch(`${API_BASE_URL}/custom-content/upload-logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      if (data.success && data.logoUrl) {
        setLocalBranding((prev) => ({ ...prev, logoUrl: data.logoUrl }))
        await updateBranding({ logoUrl: data.logoUrl })
        setInitialBranding((prev) => ({ ...prev, logoUrl: data.logoUrl }))
        addToast(t('branding.logoUploaded') || 'Логотип загружен', 'success')
      }
    } catch (error) {
      addToast(t('branding.logoUploadError') || 'Ошибка загрузки логотипа', 'error')
    } finally {
      setUploadingLogo(false)
    }
  }

  const removeLogo = async () => {
    setLocalBranding((prev) => ({ ...prev, logoUrl: null }))
    await updateBranding({ logoUrl: null })
    setInitialBranding((prev) => ({ ...prev, logoUrl: null }))
    addToast(t('branding.logoRemoved') || 'Логотип удален', 'success')
  }

  const headerExtra = (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
        isConnected
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
      {isConnected ? 'Real-time' : 'Offline'}
    </div>
  )

  if (brandingLoading) {
    return <SectionLoader />
  }

  return (
    <>
      <SettingsLayout
        title={t('settings.branding') || 'Брендинг'}
        description={t('settings.brandingDescription') || 'Настройте внешний вид приложения'}
        icon={Palette}
        onSave={handleSave}
        loading={false}
        headerExtra={headerExtra}
        saveButtonText={hasUnsavedChanges ? '● ' + (t('common.save') || 'Сохранить') : (t('common.save') || 'Сохранить')}
        actionsLeft={
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50"
            aria-busy={resetting}
          >
            {resetting ? <ButtonLoader /> : <RotateCcw className="w-4 h-4" aria-hidden="true" />}
            {t('branding.resetToDefault') || 'Сбросить к умолчанию'}
          </button>
        }
      >
        <SettingsSection title={t('branding.logo') || 'Логотип'} icon={Image}>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-card rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
              {localBranding.logoUrl ? (
                <img
                  src={getStaticUrl(localBranding.logoUrl)}
                  alt={t('branding.logo') || 'Логотип'}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => { e.target.src = '/default-logo.svg' }}
                />
              ) : (
                <Image className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                aria-busy={uploadingLogo}
              >
                {uploadingLogo ? <ButtonLoader /> : <Upload className="w-4 h-4" aria-hidden="true" />}
                {t('branding.uploadLogo') || 'Загрузить'}
              </button>
              {localBranding.logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                  aria-label={t('branding.removeLogo') || 'Удалить логотип'}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  {t('branding.removeLogo') || 'Удалить'}
                </button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG до 5MB</p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title={t('branding.siteName') || 'Название сайта'} icon={Type}>
          <div>
            <label htmlFor="branding-site-name" className="block text-sm font-medium text-foreground mb-2">
              {t('branding.siteNameLabel') || 'Название'}
            </label>
            <input
              id="branding-site-name"
              type="text"
              value={localBranding.siteName || ''}
              onChange={(e) => handleChange('siteName', e.target.value)}
              placeholder="FreshTrack"
              className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
            />
            <p className="text-sm text-muted-foreground mt-2">
              {t('branding.siteNameHint') || 'Название отображается в шапке и по всему сайту'}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title={t('branding.colors') || 'Цвета'} icon={Palette}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'primaryColor', label: t('branding.primaryColor') || 'Основной', def: '#FF8D6B' },
              { key: 'secondaryColor', label: t('branding.secondaryColor') || 'Вторичный', def: '#4A7C59' },
              { key: 'accentColor', label: t('branding.accentColor') || 'Акцент', def: '#F59E0B' },
              { key: 'dangerColor', label: t('branding.dangerColor') || 'Опасность', def: '#C4554D' }
            ].map(({ key, label, def }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localBranding[key] || def}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                    aria-label={label}
                  />
                  <input
                    type="text"
                    value={localBranding[key] || def}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-card focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-2">{t('branding.preview') || 'Превью цветов:'}</p>
            <div className="flex gap-2">
              {['primaryColor', 'secondaryColor', 'accentColor', 'dangerColor'].map((key, i) => (
                <div
                  key={key}
                  className="w-12 h-12 rounded-lg"
                  style={{ backgroundColor: localBranding[key] || '#888' }}
                  title={key}
                />
              ))}
            </div>
          </div>
        </SettingsSection>

        {isSuperAdmin && (
          <SettingsSection title={t('branding.loginPage') || 'Страница входа'} icon={LogIn}>
            <p className="text-sm text-muted-foreground mb-4">
              {t('branding.loginPageDescription') ||
                'Настройте тексты, отображаемые на странице входа для всех пользователей'}
            </p>
            {loginLoading ? (
              <SectionLoader />
            ) : (
              <div className="space-y-4">
                {[
                  { key: 'title', label: t('branding.loginTitle') || 'Заголовок', placeholder: 'Точность в каждой' },
                  { key: 'highlight', label: t('branding.loginHighlight') || 'Выделенное слово', placeholder: 'Детали' }
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label htmlFor={`login-${key}`} className="block text-sm font-medium text-foreground mb-2">{label}</label>
                    <input
                      id={`login-${key}`}
                      type="text"
                      value={loginBranding[key] || ''}
                      onChange={(e) => handleLoginBrandingChange(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                    />
                    {key === 'highlight' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('branding.loginHighlightHint') || 'Это слово будет выделено акцентным цветом'}
                      </p>
                    )}
                  </div>
                ))}
                <div>
                  <label htmlFor="login-description" className="block text-sm font-medium text-foreground mb-2">
                    {t('branding.loginDescription') || 'Описание'}
                  </label>
                  <textarea
                    id="login-description"
                    value={loginBranding.description || ''}
                    onChange={(e) => handleLoginBrandingChange('description', e.target.value)}
                    placeholder="Поднимаем управление запасами на новый уровень..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: 'feature1', icon: ShieldCheck, placeholder: 'Безопасно' },
                    { key: 'feature2', icon: Bell, placeholder: 'Умные оповещения' },
                    { key: 'feature3', icon: BarChart3, placeholder: 'Аналитика' }
                  ].map(({ key, icon: Icon, placeholder }) => (
                    <div key={key}>
                      <label htmlFor={`login-${key}`} className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        {t(`branding.login${key.charAt(0).toUpperCase() + key.slice(1)}`) || key}
                      </label>
                      <input
                        id={`login-${key}`}
                        type="text"
                        value={loginBranding[key] || ''}
                        onChange={(e) => handleLoginBrandingChange(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-charcoal rounded-lg text-cream">
                  <p className="text-xs text-muted-foreground mb-2">{t('branding.loginPreview') || 'Превью:'}</p>
                  <h2 className="font-serif text-2xl leading-tight">
                    {loginBranding.title || 'Точность в каждой'}
                    <br />
                    <span className="text-accent">{loginBranding.highlight || 'Детали'}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {loginBranding.description || 'Описание...'}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    {[ShieldCheck, Bell, BarChart3].map((Icon, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Icon className="w-3 h-3" aria-hidden="true" />
                        {loginBranding[`feature${i + 1}`] || ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SettingsSection>
        )}
      </SettingsLayout>

      {resetConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-warning" aria-hidden="true" />
              </div>
              <h3 id="reset-title" className="font-semibold text-foreground">
                {t('branding.resetTitle') || 'Сбросить брендинг?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('branding.resetWarning') ||
                'Все настройки брендинга будут сброшены к значениям по умолчанию.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-warning"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                {t('branding.resetToDefault') || 'Сбросить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
