/**
 * BrandingSettings - Настройки брендинга
 * Управление логотипом, цветами, названием сайта
 * Real-time обновления через SSE
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import { useBranding } from '../../context/BrandingContext'
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
  Loader2
} from 'lucide-react'
import { API_BASE_URL, getStaticUrl } from '../../services/api'

export default function BrandingSettings() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { 
    branding, 
    updateBranding, 
    resetBranding, 
    loading: brandingLoading,
    isConnected 
  } = useBranding()
  
  const [localBranding, setLocalBranding] = useState({ ...branding })
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

  // Sync local state when branding changes (SSE updates)
  useEffect(() => {
    setLocalBranding({ ...branding })
  }, [branding])

  const handleChange = (key, value) => {
    setLocalBranding(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const result = await updateBranding(localBranding)
      
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
    if (!confirm(t('branding.confirmReset') || 'Сбросить брендинг к настройкам по умолчанию?')) {
      return
    }
    
    setResetting(true)
    try {
      const result = await resetBranding()
      
      if (result.success) {
        setLocalBranding({ ...branding })
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
        setLocalBranding(prev => ({ ...prev, logoUrl: data.logoUrl }))
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
    setLocalBranding(prev => ({ ...prev, logoUrl: null }))
    await updateBranding({ logoUrl: null })
    addToast(t('branding.logoRemoved') || 'Логотип удален', 'success')
  }

  if (brandingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
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
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
          isConnected 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500'}`} />
          {isConnected ? 'Real-time' : 'Offline'}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-muted/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-accent" />
          <h3 className="font-medium text-foreground">
            {t('branding.logo') || 'Логотип'}
          </h3>
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
            >
              {uploadingLogo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
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

            <p className="text-xs text-muted-foreground">
              PNG, JPG, SVG до 5MB
            </p>
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
          <h3 className="font-medium text-foreground">
            {t('branding.colors') || 'Цвета'}
          </h3>
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
          <p className="text-sm text-muted-foreground mb-2">{t('branding.preview') || 'Превью цветов:'}</p>
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

      {/* Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
        >
          {resetting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {t('branding.resetToDefault') || 'Сбросить к умолчанию'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  )
}
