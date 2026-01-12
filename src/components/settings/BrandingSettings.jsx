/**
 * BrandingSettings - Настройки брендинга
 * Управление логотипом, цветами, названием сайта
 * Real-time обновления через SSE
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
import { useAuth } from '../../context/AuthContext'
import {
  Save,
  RotateCcw,
  Upload,
  Image,
  Palette,
  Type,
  RefreshCw,
  Check,
  AlertCircle,
  AlertTriangle,
  LogIn,
  ShieldCheck,
  Bell,
  BarChart3
} from 'lucide-react'
import { ButtonLoader, SectionLoader } from '../ui'
import { API_BASE_URL, getStaticUrl, apiFetch } from '../../services/api'

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
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Login page branding (SUPER_ADMIN only)
  const [loginBranding, setLoginBranding] = useState({
    title: 'Точность в каждой',
    highlight: 'Детали',
    description:
      'Поднимаем управление запасами на новый уровень. Умный контроль сроков годности, минимизация потерь и максимальная эффективность.',
    feature1: 'Безопасно',
    feature2: 'Умные оповещения',
    feature3: 'Аналитика'
  })
  const [loginLoading, setLoginLoading] = useState(false)

  // Load login branding for SUPER_ADMIN
  useEffect(() => {
    if (isSuperAdmin) {
      loadLoginBranding()
    }
  }, [isSuperAdmin])

  const loadLoginBranding = async () => {
    setLoginLoading(true)
    try {
      const response = await apiFetch('/settings/login-branding')
      if (response.success && response.loginBranding) {
        setLoginBranding(response.loginBranding)
      }
    } catch (error) {
      console.error('Failed to load login branding:', error)
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLoginBrandingChange = (key, value) => {
    setLoginBranding((prev) => ({ ...prev, [key]: value }))
  }
  const [message, setMessage] = useState(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const fileInputRef = useRef(null)

  // Sync local state when branding changes (SSE updates)
  useEffect(() => {
    setLocalBranding({ ...branding })
  }, [branding])

  const handleChange = (key, value) => {
    setLocalBranding((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // Save general branding
      const result = await updateBranding(localBranding)

      // Also save login branding if SUPER_ADMIN
      if (isSuperAdmin) {
        await apiFetch('/settings/login-branding', {
          method: 'PUT',
          body: JSON.stringify({ branding: loginBranding })
        })
      }

      if (result.success) {
        setMessage({ type: 'success', text: t('settings.saved') || 'Настройки сохранены' })
        addToast(t('toast.settingsSaved') || 'Брендинг обновлен', 'success')
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.saveError') })
        addToast(t('toast.settingsSaveError') || 'Ошибка сохранения', 'error')
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
      addToast(t('toast.settingsSaveError') || 'Ошибка сохранения', 'error')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleReset = async () => {
    setResetConfirm(true)
  }

  const handleConfirmReset = async () => {
    setResetConfirm(false)
    setResetting(true)
    try {
      const result = await resetBranding()

      if (result.success) {
        // Update local branding from server response
        if (result.branding) {
          setLocalBranding({ ...result.branding })
        } else {
          setLocalBranding({ ...branding })
        }

        // Reset login branding if returned (SUPER_ADMIN only)
        if (result.loginBranding) {
          setLoginBranding(result.loginBranding)
        }

        setMessage({ type: 'success', text: t('branding.reset') || 'Брендинг сброшен' })
        addToast(t('branding.reset') || 'Брендинг сброшен', 'success')
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setResetting(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
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
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()

      if (data.success && data.logoUrl) {
        setLocalBranding((prev) => ({ ...prev, logoUrl: data.logoUrl }))
        // Also update via branding API
        await updateBranding({ logoUrl: data.logoUrl })
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
    addToast(t('branding.logoRemoved') || 'Логотип удален', 'success')
  }

  if (brandingLoading) {
    return <SectionLoader />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t('settings.branding') || 'Брендинг'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.brandingDescription') || 'Настройте внешний вид приложения'}
          </p>
        </div>

        {/* SSE Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
            isConnected
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`}
          />
          {isConnected ? 'Real-time' : 'Offline'}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-muted/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">{t('branding.logo') || 'Логотип'}</h3>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-card rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
            {localBranding.logoUrl ? (
              <img
                src={getStaticUrl(localBranding.logoUrl)}
                alt="Logo"
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  e.target.src = '/default-logo.svg'
                }}
              />
            ) : (
              <Image className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
              aria-busy={uploadingLogo}
            >
              {uploadingLogo ? <ButtonLoader /> : <Upload className="w-4 h-4" />}
              {t('branding.uploadLogo') || 'Загрузить'}
            </button>

            {localBranding.logoUrl && (
              <button
                onClick={removeLogo}
                className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                {t('branding.removeLogo') || 'Удалить'}
              </button>
            )}

            <p className="text-xs text-muted-foreground">PNG, JPG, SVG до 5MB</p>
          </div>
        </div>
      </div>

      {/* Site Name Section */}
      <div className="bg-muted/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">
            {t('branding.siteName') || 'Название сайта'}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('branding.siteNameLabel') || 'Название'}
            </label>
            <input
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
        </div>
      </div>

      {/* Colors Section */}
      <div className="bg-muted/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">{t('branding.colors') || 'Цвета'}</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('branding.primaryColor') || 'Основной'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localBranding.primaryColor || '#FF8D6B'}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.primaryColor || '#FF8D6B'}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-card"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('branding.secondaryColor') || 'Вторичный'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localBranding.secondaryColor || '#4A7C59'}
                onChange={(e) => handleChange('secondaryColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.secondaryColor || '#4A7C59'}
                onChange={(e) => handleChange('secondaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-card"
              />
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('branding.accentColor') || 'Акцент'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localBranding.accentColor || '#F59E0B'}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.accentColor || '#F59E0B'}
                onChange={(e) => handleChange('accentColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-card"
              />
            </div>
          </div>

          {/* Danger Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('branding.dangerColor') || 'Опасность'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={localBranding.dangerColor || '#C4554D'}
                onChange={(e) => handleChange('dangerColor', e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.dangerColor || '#C4554D'}
                onChange={(e) => handleChange('dangerColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono bg-card"
              />
            </div>
          </div>
        </div>

        {/* Color Preview */}
        <div className="mt-4 p-4 bg-card rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            {t('branding.preview') || 'Превью цветов:'}
          </p>
          <div className="flex gap-2">
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: localBranding.primaryColor || '#FF8D6B' }}
              title="Primary"
            />
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: localBranding.secondaryColor || '#4A7C59' }}
              title="Secondary"
            />
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: localBranding.accentColor || '#F59E0B' }}
              title="Accent"
            />
            <div
              className="w-12 h-12 rounded-lg"
              style={{ backgroundColor: localBranding.dangerColor || '#C4554D' }}
              title="Danger"
            />
          </div>
        </div>
      </div>

      {/* Login Page Branding - SUPER_ADMIN only */}
      {isSuperAdmin && (
        <div className="bg-muted/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <LogIn className="w-5 h-5 text-accent" />
            <h3 className="font-medium text-foreground">
              {t('branding.loginPage') || 'Страница входа'}
            </h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            {t('branding.loginPageDescription') ||
              'Настройте тексты, отображаемые на странице входа для всех пользователей'}
          </p>

          {loginLoading ? (
            <SectionLoader />
          ) : (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('branding.loginTitle') || 'Заголовок'}
                </label>
                <input
                  type="text"
                  value={loginBranding.title || ''}
                  onChange={(e) => handleLoginBrandingChange('title', e.target.value)}
                  placeholder="Точность в каждой"
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                />
              </div>

              {/* Highlight */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('branding.loginHighlight') || 'Выделенное слово'}
                </label>
                <input
                  type="text"
                  value={loginBranding.highlight || ''}
                  onChange={(e) => handleLoginBrandingChange('highlight', e.target.value)}
                  placeholder="Детали"
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('branding.loginHighlightHint') || 'Это слово будет выделено акцентным цветом'}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('branding.loginDescription') || 'Описание'}
                </label>
                <textarea
                  value={loginBranding.description || ''}
                  onChange={(e) => handleLoginBrandingChange('description', e.target.value)}
                  placeholder="Поднимаем управление запасами на новый уровень..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card resize-none"
                />
              </div>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    {t('branding.loginFeature1') || 'Особенность 1'}
                  </label>
                  <input
                    type="text"
                    value={loginBranding.feature1 || ''}
                    onChange={(e) => handleLoginBrandingChange('feature1', e.target.value)}
                    placeholder="Безопасно"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    {t('branding.loginFeature2') || 'Особенность 2'}
                  </label>
                  <input
                    type="text"
                    value={loginBranding.feature2 || ''}
                    onChange={(e) => handleLoginBrandingChange('feature2', e.target.value)}
                    placeholder="Умные оповещения"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    {t('branding.loginFeature3') || 'Особенность 3'}
                  </label>
                  <input
                    type="text"
                    value={loginBranding.feature3 || ''}
                    onChange={(e) => handleLoginBrandingChange('feature3', e.target.value)}
                    placeholder="Аналитика"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="mt-4 p-4 bg-charcoal rounded-lg text-cream">
                <p className="text-xs text-muted-foreground mb-2">
                  {t('branding.loginPreview') || 'Превью:'}
                </p>
                <h2 className="font-serif text-2xl leading-tight">
                  {loginBranding.title || 'Точность в каждой'}
                  <br />
                  <span className="text-accent">{loginBranding.highlight || 'Детали'}</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {loginBranding.description || 'Описание...'}
                </p>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {loginBranding.feature1 || 'Безопасно'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {loginBranding.feature2 || 'Умные оповещения'}
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    {loginBranding.feature3 || 'Аналитика'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          aria-busy={resetting}
        >
          {resetting ? <ButtonLoader /> : <RotateCcw className="w-4 h-4" />}
          {t('branding.resetToDefault') || 'Сбросить к умолчанию'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
          aria-busy={saving}
        >
          {saving ? <ButtonLoader /> : <Save className="w-4 h-4" />}
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      {/* Модальное окно подтверждения сброса */}
      {resetConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('branding.resetTitle') || 'Сбросить брендинг?'}
                </h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t('branding.resetWarning') ||
                'Все настройки брендинга будут сброшены к значениям по умолчанию.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {t('branding.resetToDefault') || 'Сбросить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
