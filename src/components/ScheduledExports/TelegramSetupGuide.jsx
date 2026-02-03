/**
 * TelegramSetupGuide
 * Модальное окно с инструкцией по настройке Telegram для scheduled exports
 */

import { X, ExternalLink, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '../../context/LanguageContext'
import { useToast } from '../../context/ToastContext'
import Modal from '../ui/Modal'
import { TouchButton } from '../ui'

export function TelegramSetupGuide({ onClose }) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [copiedBotName, setCopiedBotName] = useState(false)

  const botUsername = '@FreshTrackReportsBot' // Замените на ваш реальный бот

  const copyBotName = () => {
    navigator.clipboard.writeText(botUsername)
    setCopiedBotName(true)
    addToast(t('common.copied') || 'Скопировано', 'success')
    setTimeout(() => setCopiedBotName(false), 2000)
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('telegram.setupTitle') || 'Настройка Telegram для отчётов'}
      size="lg"
      footer={
        <TouchButton variant="primary" onClick={onClose}>
          {t('common.close') || 'Закрыть'}
        </TouchButton>
      }
    >
      <div className="space-y-6">
        {/* Введение */}
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <p className="text-sm text-foreground">
            {t('telegram.setupIntro') ||
              'Для автоматической отправки отчётов в Telegram необходимо настроить бот и получить Chat ID вашего чата.'}
          </p>
        </div>

        {/* Шаг 1: Найти бота */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </span>
            {t('telegram.step1Title') || 'Найдите FreshTrack Reports Bot'}
          </h3>
          <div className="ml-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('telegram.step1Desc') || 'Откройте Telegram и найдите бота FreshTrack Reports:'}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-foreground font-mono text-sm">
                {botUsername}
              </code>
              <TouchButton
                variant="secondary"
                size="sm"
                onClick={copyBotName}
                icon={copiedBotName ? Check : Copy}
              >
                {copiedBotName ? t('common.copied') : t('common.copy')}
              </TouchButton>
            </div>
            <a
              href={`https://t.me/${botUsername.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-accent hover:underline text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {t('telegram.openInTelegram') || 'Открыть в Telegram'}
            </a>
          </div>
        </div>

        {/* Шаг 2: Запустить бота */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </span>
            {t('telegram.step2Title') || 'Запустите бота'}
          </h3>
          <div className="ml-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('telegram.step2Desc') ||
                'Нажмите кнопку "Start" или отправьте команду:'}
            </p>
            <code className="block px-3 py-2 bg-muted rounded-lg text-foreground font-mono text-sm">
              /start
            </code>
          </div>
        </div>

        {/* Шаг 3: Получить Chat ID */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </span>
            {t('telegram.step3Title') || 'Получите Chat ID'}
          </h3>
          <div className="ml-8 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('telegram.step3Desc') ||
                'Отправьте команду для получения Chat ID:'}
            </p>
            <code className="block px-3 py-2 bg-muted rounded-lg text-foreground font-mono text-sm">
              /getchatid
            </code>
            <p className="text-sm text-muted-foreground">
              {t('telegram.step3Result') ||
                'Бот отправит вам сообщение с вашим Chat ID. Скопируйте его и используйте в настройках департамента или расписания экспорта.'}
            </p>
          </div>
        </div>

        {/* Для групповых чатов */}
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            {t('telegram.groupChatTitle') || 'Для групповых чатов'}
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">1.</span>
              <span>
                {t('telegram.groupStep1') ||
                  'Добавьте бота в групповой чат'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">2.</span>
              <span>
                {t('telegram.groupStep2') ||
                  'Сделайте бота администратором (для отправки сообщений)'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">3.</span>
              <span>
                {t('telegram.groupStep3') ||
                  'Отправьте команду /getchatid в групповом чате'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">4.</span>
              <span>
                {t('telegram.groupStep4') ||
                  'Скопируйте Chat ID группы (обычно начинается с "-")'}
              </span>
            </li>
          </ul>
        </div>

        {/* Пример Chat ID */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">
            {t('telegram.exampleTitle') || 'Примеры Chat ID:'}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <code className="px-2 py-1 bg-muted rounded text-foreground font-mono">
                123456789
              </code>
              <span className="text-muted-foreground">
                {t('telegram.personalChat') || 'Личный чат'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <code className="px-2 py-1 bg-muted rounded text-foreground font-mono">
                -1001234567890
              </code>
              <span className="text-muted-foreground">
                {t('telegram.groupChat') || 'Групповой чат'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
