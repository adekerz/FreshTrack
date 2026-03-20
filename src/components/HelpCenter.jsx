/**
 * HelpCenter Component
 * Comprehensive help modal with keyboard shortcuts, FAQ, and contacts
 * Accessible with keyboard navigation and focus trap
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Book,
  Keyboard,
  Mail,
  MessageSquare,
  X,
  ExternalLink,
  Accessibility,
  HelpCircle,
} from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useEscapeKey } from '../hooks/useKeyboardNav'
import Button from './ui/Button'

/**
 * HelpCenter - модальное окно центра помощи
 * @param {boolean} isOpen - Открыто/закрыто
 * @param {Function} onClose - Callback закрытия
 */
export default function HelpCenter({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('shortcuts')
  const modalRef = useFocusTrap(isOpen, { autoFocus: true, returnFocus: true })

  // ESC для закрытия
  useEscapeKey(onClose, isOpen)

  if (!isOpen) return null

  // Keyboard shortcuts
  const shortcuts = [
    {
      keys: ['Ctrl', 'K'],
      keysMac: ['Cmd', 'K'],
      description: 'Открыть поиск',
    },
    {
      keys: ['Ctrl', 'N'],
      keysMac: ['Cmd', 'N'],
      description: 'Создать новый товар',
    },
    {
      keys: ['Ctrl', 'E'],
      keysMac: ['Cmd', 'E'],
      description: 'Экспорт данных',
    },
    {
      keys: ['Ctrl', 'S'],
      keysMac: ['Cmd', 'S'],
      description: 'Сохранить изменения',
    },
    { keys: ['Esc'], keysMac: ['Esc'], description: 'Закрыть модальное окно' },
    { keys: ['?'], keysMac: ['?'], description: 'Открыть помощь' },
    { keys: ['/'], keysMac: ['/'], description: 'Фокус на поиск' },
    { keys: ['Tab'], keysMac: ['Tab'], description: 'Навигация по элементам' },
  ]

  // Tabs configuration
  const tabs = [
    {
      id: 'shortcuts',
      label: 'Горячие клавиши',
      icon: Keyboard,
    },
    {
      id: 'contact',
      label: 'Контакты',
      icon: MessageSquare,
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-center-title"
          className="
            bg-card border border-border rounded-xl
            w-full max-w-3xl max-h-[90vh]
            overflow-hidden
            shadow-soft-lg
            pointer-events-auto
            animate-scale-in
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                <Book className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2
                  id="help-center-title"
                  className="text-lg sm:text-xl font-semibold text-foreground"
                >
                  Центр помощи
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Горячие клавиши и контакты поддержки
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Закрыть"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 sm:gap-2 px-4 sm:px-6 pt-4 border-b border-border overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5
                    border-b-2 transition-all duration-150
                    text-xs sm:text-sm font-medium
                    whitespace-nowrap
                    ${
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Keyboard Shortcuts */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-3 animate-fade-in-up">
                <p className="text-sm text-muted-foreground mb-4">
                  Используйте горячие клавиши для быстрой навигации и выполнения
                  действий.
                </p>
                {shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 sm:py-3 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, idx) => (
                        <kbd
                          key={idx}
                          className="
                            px-2 py-1 bg-muted border border-border rounded
                            text-xs font-mono text-foreground
                            min-w-[32px] text-center
                          "
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contact */}
            {activeTab === 'contact' && (
              <div className="space-y-4 animate-fade-in-up">
                <p className="text-sm text-muted-foreground mb-4">
                  Свяжитесь с нами для получения дополнительной помощи.
                </p>

                <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <Mail className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      Email поддержка
                    </p>
                    <a
                      href="mailto:support@freshtrack.systems"
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      support@freshtrack.systems
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      Время ответа: 24-48 часов
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-success/5 rounded-lg border border-success/20">
                  <MessageSquare className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      Telegram поддержка
                    </p>
                    <a
                      href="https://t.me/freshtrack_support"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      @freshtrack_support
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      Быстрые ответы в рабочее время
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <Book className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      Документация
                    </p>
                    <Link
                      to="/docs"
                      onClick={onClose}
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      Перейти к документации
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      Полное руководство пользователя
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-success/5 rounded-lg border border-success/20">
                  <HelpCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      FAQ и Помощь
                    </p>
                    <Link
                      to="/faq"
                      onClick={onClose}
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      Открыть полный FAQ
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ответы на часто задаваемые вопросы
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <Accessibility
                    className="w-5 h-5 text-accent flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">
                      Заявление о доступности
                    </p>
                    <Link
                      to="/accessibility"
                      onClick={onClose}
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      Перейти к заявлению о доступности
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">
                      WCAG 2.1 AA, горячие клавиши, обратная связь
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-t border-border bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Нажмите{' '}
              <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-xs font-mono">
                ?
              </kbd>{' '}
              чтобы открыть помощь
            </p>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
