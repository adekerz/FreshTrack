import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from '../context/LanguageContext'
import { API_BASE_URL } from '../services/api'
import { useAuth } from '../context/AuthContext'

const base = API_BASE_URL.replace('/api', '')

export default function DownloadPage() {
  const { bundleToken } = useParams()
  const { user } = useAuth()
  const { t } = useTranslation()

  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pin, setPin] = useState('')
  const [login, setLogin] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showLogin] = useState(!user)
  const [verifyError, setVerifyError] = useState(null)
  const [verifiedFiles, setVerifiedFiles] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [downloading, setDownloading] = useState(new Set())

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(`${base}/api/downloads/bundle/${bundleToken}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || t('download.fetchError'))
        } else {
          setMeta(data.data)
        }
      } catch {
        setError(t('download.fetchError'))
      } finally {
        setLoading(false)
      }
    }
    fetchMeta()
  }, [bundleToken, t])

  async function handleVerify(e) {
    e.preventDefault()
    setVerifyError(null)
    setVerifying(true)
    try {
      const body = { pin, ...(showLogin && login ? { login } : {}) }
      const res = await fetch(
        `${base}/api/downloads/bundle/${bundleToken}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) setVerifyError(t('download.tooManyAttempts'))
        else if (res.status === 403) setVerifyError(t('download.invalidPin'))
        else setVerifyError(data?.error || t('download.fetchError'))
      } else {
        setVerifiedFiles(data.data.files)
        setSelected(new Set(data.data.files.map((f) => f.token)))
      }
    } catch {
      setVerifyError(t('download.fetchError'))
    } finally {
      setVerifying(false)
    }
  }

  function toggleFile(token) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === verifiedFiles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(verifiedFiles.map((f) => f.token)))
    }
  }

  async function handleDownload() {
    const filesToDownload = verifiedFiles.filter((f) => selected.has(f.token))
    for (const file of filesToDownload) {
      setDownloading((prev) => new Set(prev).add(file.token))
      // Use iframe to trigger download without navigating away
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = `${base}/api/downloads/${file.token}/file?ticket=${file.ticket}`
      document.body.appendChild(iframe)
      // Stagger downloads slightly
      await new Promise((r) => setTimeout(r, 300))
      setDownloading((prev) => {
        const next = new Set(prev)
        next.delete(file.token)
        return next
      })
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getFileIcon(name) {
    if (name?.endsWith('.xlsx')) return '📊'
    if (name?.endsWith('.csv')) return '📄'
    if (name?.endsWith('.pdf')) return '📕'
    return '📎'
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif text-[#2D2D2D]">FreshTrack</h1>
          <p className="text-sm text-gray-500 mt-1">{t('download.title')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#E8E4DC] p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-[#2D2D2D] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error && !meta ? (
            <div className="text-center py-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          ) : meta?.isExpired ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">⏳</p>
              <p className="text-[#2D2D2D] font-medium">
                {t('download.expired')}
              </p>
            </div>
          ) : !verifiedFiles ? (
            /* PIN entry form */
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="bg-[#FAF9F7] rounded-lg p-3 border border-[#E8E4DC]">
                <p className="text-sm font-medium text-[#2D2D2D]">
                  {meta?.files?.length || 0}{' '}
                  {t('download.filesReady') || 'файлов готово к скачиванию'}
                </p>
              </div>

              {showLogin && (
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder={t('download.enterLogin')}
                  className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]/20 focus:border-[#2D2D2D] placeholder-gray-400"
                />
              )}

              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder={t('download.enterPin')}
                autoFocus
                className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2.5 text-sm text-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]/20 focus:border-[#2D2D2D] placeholder-gray-400"
              />

              {verifyError && (
                <p className="text-red-600 text-sm">{verifyError}</p>
              )}

              <button
                type="submit"
                disabled={verifying || !pin}
                className="w-full bg-[#2D2D2D] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
              >
                {verifying ? '...' : t('download.downloadBtn') || 'Продолжить'}
              </button>
            </form>
          ) : (
            /* File list after verification */
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.size === verifiedFiles.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-[#2D2D2D] focus:ring-[#2D2D2D]"
                  />
                  <span className="text-sm font-medium text-[#2D2D2D]">
                    {t('download.selectAll') || 'Выбрать все'} (
                    {verifiedFiles.length})
                  </span>
                </label>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {verifiedFiles.map((file) => (
                  <label
                    key={file.token}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.has(file.token)
                        ? 'border-[#2D2D2D] bg-[#FAF9F7]'
                        : 'border-[#E8E4DC] hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(file.token)}
                      onChange={() => toggleFile(file.token)}
                      className="w-4 h-4 rounded border-gray-300 text-[#2D2D2D] focus:ring-[#2D2D2D]"
                    />
                    <span className="text-lg">
                      {getFileIcon(file.fileName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2D2D2D] truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatSize(file.fileSize)}
                      </p>
                    </div>
                    {downloading.has(file.token) && (
                      <div className="w-4 h-4 border-2 border-[#2D2D2D] border-t-transparent rounded-full animate-spin" />
                    )}
                  </label>
                ))}
              </div>

              <button
                onClick={handleDownload}
                disabled={selected.size === 0 || downloading.size > 0}
                className="w-full bg-[#2D2D2D] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors mt-3"
              >
                {downloading.size > 0
                  ? t('download.downloading')
                  : `${t('download.downloadBtn')} (${selected.size})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
