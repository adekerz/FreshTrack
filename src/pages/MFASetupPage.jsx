/**
 * MFA Setup Page
 * Guides user through enabling two-factor authentication
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '../context/ToastContext'
import { useTranslation } from '../context/LanguageContext'
import CodeInput from '../components/ui/CodeInput'
import { API_BASE_URL } from '../services/api'

export default function MFASetupPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { t } = useTranslation()
  const [step, setStep] = useState('initial') // initial, qr, verify, backup, complete
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState([])
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const startSetup = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('freshtrack_token')
      const response = await fetch(`${API_BASE_URL}/auth/mfa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to setup MFA')
      }

      setQrCode(data.qrCode)
      setSecret(data.secret)
      setBackupCodes(data.backupCodes)
      setStep('qr')
      addToast('MFA setup started', 'success')
    } catch (error) {
      addToast(error.message || 'Failed to start MFA setup', 'error')
    } finally {
      setLoading(false)
    }
  }

  const verifyAndEnable = async (code = null) => {
    // Use provided code or state code
    const codeToVerify = code || verificationCode
    
    if (!codeToVerify || codeToVerify.length !== 6) {
      addToast('Please enter a 6-digit code', 'error')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('freshtrack_token')
      const response = await fetch(`${API_BASE_URL}/auth/mfa/verify-setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: codeToVerify })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Verification failed')
      }

      setStep('backup')
      addToast('MFA verified successfully', 'success')
    } catch (error) {
      addToast(error.message || 'Verification failed', 'error')
      setVerificationCode('')
    } finally {
      setLoading(false)
    }
  }

  const downloadBackupCodes = () => {
    const content = `FreshTrack Backup Codes\n\nSave these codes securely. Each can only be used once.\n\n${backupCodes.join('\n')}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'freshtrack-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    addToast('Backup codes downloaded', 'success')
  }

  const confirmBackupSaved = () => {
    setStep('complete')
    setTimeout(() => {
      navigate('/dashboard')
    }, 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        
        {step === 'initial' && (
          <>
            <div className="flex items-center justify-center mb-6">
              <ShieldCheck className="w-16 h-16 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center">Enable Two-Factor Authentication</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
              Add an extra layer of security to your account using an authenticator app like Google Authenticator or Authy.
            </p>
            <button
              onClick={startSetup}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Setting up...' : 'Start Setup'}
            </button>
          </>
        )}

        {step === 'qr' && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center">Scan QR Code</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-center">
              Open your authenticator app and scan this QR code:
            </p>
            <div className="flex justify-center mb-6">
              <img src={qrCode} alt="QR Code" className="w-64 h-64 border-2 border-gray-300 dark:border-gray-600 rounded-lg" />
            </div>
            <details className="mb-6">
              <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">
                Can't scan? Enter manually
              </summary>
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded font-mono text-sm break-all">
                {showSecret ? secret : '••••••••••••••••'}
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="ml-2 text-blue-600 dark:text-blue-400 text-xs"
                >
                  {showSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </details>
            <button
              onClick={() => setStep('verify')}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          </>
        )}

        {step === 'verify' && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center">Verify Setup</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-center">
              Enter the 6-digit code from your authenticator app:
            </p>
            <div className="flex justify-center mb-6">
              <CodeInput
                onComplete={(code) => {
                  setVerificationCode(code)
                  verifyAndEnable(code)
                }}
                disabled={loading}
              />
            </div>
            {loading && (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4">Verifying...</p>
            )}
            <button
              onClick={() => setStep('qr')}
              className="w-full mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Back
            </button>
          </>
        )}

        {step === 'backup' && (
          <>
            <h2 className="text-2xl font-bold mb-4 text-center">Save Backup Codes</h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">⚠️ Important</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Save these codes securely. You'll need them if you lose access to your authenticator app.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4 font-mono text-sm">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, i) => (
                  <div key={i} className="text-center py-2">{code}</div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={downloadBackupCodes}
                className="w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Codes
              </button>
              <button
                onClick={confirmBackupSaved}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                I've Saved My Codes
              </button>
            </div>
          </>
        )}

        {step === 'complete' && (
          <>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">MFA Enabled</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your account is now protected with two-factor authentication.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

