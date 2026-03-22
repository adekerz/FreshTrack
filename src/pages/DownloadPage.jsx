import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from '../context/LanguageContext'
import { API_BASE_URL, SERVER_BASE_URL } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  Lock,
  AlertCircle,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react'

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
  const [showLogin, setShowLogin] = useState(!user)
  const [verifyError, setVerifyError] = useState(null)
  const [verifiedFiles, setVerifiedFiles] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [downloading, setDownloading] = useState(new Set())

  // Update showLogin if auth state resolves after mount
  useEffect(() => {
    setShowLogin(!user)
  }, [user])

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/downloads/bundle/${bundleToken}`,
          {
            credentials: 'include',
          }
        )
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
        `${API_BASE_URL}/downloads/bundle/${bundleToken}/verify`,
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
      // Use anchor click instead of iframe (CSP blocks cross-origin frames)
      const a = document.createElement('a')
      a.href = `${SERVER_BASE_URL}/api/downloads/${file.token}/file?ticket=${file.ticket}`
      a.download = file.fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      await new Promise((r) => setTimeout(r, 400))
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
    if (name?.endsWith('.xlsx')) return FileSpreadsheet
    if (name?.endsWith('.csv')) return FileText
    if (name?.endsWith('.pdf')) return FileText
    return File
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-foreground tracking-wide">
            FreshTrack
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('download.title') || 'Скачивание отчёта'}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
            </div>
          ) : error && !meta ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
              <p className="text-foreground font-medium">{error}</p>
            </div>
          ) : meta?.isExpired ? (
            <div className="p-8 text-center">
              <p className="text-4xl mb-3">⏳</p>
              <p className="text-foreground font-medium">
                {t('download.expired') || 'Ссылка истекла'}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Запросите новый отчёт
              </p>
            </div>
          ) : !verifiedFiles ? (
            /* PIN entry form */
            <form onSubmit={handleVerify} className="p-6 space-y-4">
              {/* Files count */}
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3 border border-border">
                <Download className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {meta?.files?.length || 0}{' '}
                  {t('download.filesReady') || 'файлов готово к скачиванию'}
                </p>
              </div>

              {showLogin && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    {t('download.enterLogin') || 'Логин'}
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder={t('download.enterLogin') || 'Ваш логин'}
                    autoComplete="username"
                    className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground placeholder-muted-foreground"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  <Lock className="w-3 h-3 inline mr-1" />
                  {t('download.enterPin') || 'PIN-код'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  autoComplete="off"
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground placeholder-muted-foreground"
                />
              </div>

              {verifyError && (
                <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                  <p className="text-danger text-sm">{verifyError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || !pin}
                className="w-full bg-foreground text-background rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Проверяем...</span>
                  </>
                ) : (
                  t('download.downloadBtn') || 'Скачать'
                )}
              </button>
            </form>
          ) : (
            /* File list after verification */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
                >
                  {selected.size === verifiedFiles.length ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {t('download.selectAll') || 'Выбрать все'} (
                  {verifiedFiles.length})
                </button>
                <span className="text-xs text-muted-foreground">
                  Выбрано: {selected.size}
                </span>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto -mx-2 px-2">
                {verifiedFiles.map((file) => {
                  const Icon = getFileIcon(file.fileName)
                  return (
                    <label
                      key={file.token}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected.has(file.token)
                          ? 'border-foreground bg-muted/30'
                          : 'border-border hover:bg-muted/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(file.token)}
                        onChange={() => toggleFile(file.token)}
                        className="w-4 h-4 rounded border-border text-foreground focus:ring-foreground/20"
                      />
                      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(file.fileSize)}
                        </p>
                      </div>
                      {downloading.has(file.token) && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                      )}
                    </label>
                  )
                })}
              </div>

              <button
                onClick={handleDownload}
                disabled={selected.size === 0 || downloading.size > 0}
                className="w-full bg-foreground text-background rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {downloading.size > 0 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('download.downloading') || 'Скачиваем...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>
                      {t('download.downloadBtn') || 'Скачать'} ({selected.size})
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
