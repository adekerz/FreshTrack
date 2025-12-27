import { useState, useEffect, useRef } from 'react'
import { Upload, Image, Loader2, RotateCcw, Edit3, Check, X } from 'lucide-react'
import { useTranslation } from '../context/LanguageContext'
import { logError } from '../utils/logger'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('freshtrack_token')
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return response.json()
}

export default function CustomContentSettings() {
  const { t } = useTranslation()
  const [content, setContent] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const fileInputRef = useRef(null)

  const editableFields = [
    { key: 'app_name', label: 'Название приложения', placeholder: 'FreshTrack' },
    { key: 'app_tagline', label: 'Слоган', placeholder: 'Совершенство управления' },
    { key: 'company_name', label: 'Название компании', placeholder: 'Моя компания' },
    { key: 'dashboard_title', label: 'Заголовок дашборда', placeholder: 'Панель управления' },
    { key: 'welcome_message', label: 'Приветственное сообщение', placeholder: 'Добро пожаловать!' }
  ]

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`${API_URL}/custom-content`)
      setContent(data.content || {})
    } catch (error) {
      logError('Error loading content:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (key) => {
    setEditingField(key)
    setEditValue(content[key] || '')
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveField = async (key) => {
    setSaving(true)
    try {
      await apiFetch(`${API_URL}/custom-content/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue })
      })

      setContent((prev) => ({ ...prev, [key]: editValue }))
      setEditingField(null)
      setEditValue('')
    } catch (error) {
      logError('Error saving content:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)

      const token = localStorage.getItem('freshtrack_token')
      const response = await fetch(`${API_URL}/custom-content/upload-logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const data = await response.json()
      setContent((prev) => ({ ...prev, logo_url: data.logoUrl }))
    } catch (error) {
      logError('Error uploading logo:', error)
    } finally {
      setUploadingLogo(false)
    }
  }

  const resetLogo = async () => {
    try {
      await apiFetch(`${API_URL}/custom-content/logo`, {
        method: 'DELETE'
      })
      setContent((prev) => ({ ...prev, logo_url: '/default-logo.svg' }))
    } catch (error) {
      logError('Error resetting logo:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Logo Section */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-primary-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('customContent.logo') || 'Логотип компании'}
          </h3>
        </div>

        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden">
            {content.logo_url ? (
              <img
                src={content.logo_url}
                alt="Logo"
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  e.target.src = '/default-logo.svg'
                }}
              />
            ) : (
              <Image className="w-8 h-8 text-gray-400" />
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
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {uploadingLogo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {t('customContent.uploadLogo') || 'Загрузить'}
            </button>

            {content.logo_url && content.logo_url !== '/default-logo.svg' && (
              <button
                onClick={resetLogo}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                {t('customContent.resetLogo') || 'Сбросить'}
              </button>
            )}

            <p className="text-xs text-gray-500">
              {t('customContent.logoHint') || 'PNG, JPG, SVG до 5MB'}
            </p>
          </div>
        </div>
      </div>

      {/* Text Fields */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Edit3 className="w-5 h-5 text-primary-600" />
          <h3 className="font-medium text-gray-900 dark:text-white">
            {t('customContent.texts') || 'Тексты интерфейса'}
          </h3>
        </div>

        <div className="space-y-4">
          {editableFields.map((field) => (
            <div key={field.key} className="flex items-center gap-4">
              <div className="w-1/3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                </label>
              </div>

              <div className="flex-1">
                {editingField === field.key ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={field.placeholder}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => saveField(field.key)}
                      disabled={saving}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-gray-900 dark:text-white">
                      {content[field.key] || (
                        <span className="text-gray-400 italic">{field.placeholder}</span>
                      )}
                    </span>
                    <button
                      onClick={() => startEditing(field.key)}
                      className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
