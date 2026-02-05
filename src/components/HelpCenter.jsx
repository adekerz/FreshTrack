/**
 * HelpCenter Component
 * Comprehensive help modal with keyboard shortcuts, FAQ, and contacts
 * Accessible with keyboard navigation and focus trap
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Book, Keyboard, Mail, MessageSquare, X, ExternalLink, Accessibility } from 'lucide-react'
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
    { keys: ['Ctrl', 'K'], keysMac: ['Cmd', 'K'], description: 'Открыть поиск' },
    { keys: ['Ctrl', 'N'], keysMac: ['Cmd', 'N'], description: 'Создать новый товар' },
    { keys: ['Ctrl', 'E'], keysMac: ['Cmd', 'E'], description: 'Экспорт данных' },
    { keys: ['Ctrl', 'S'], keysMac: ['Cmd', 'S'], description: 'Сохранить изменения' },
    { keys: ['Esc'], keysMac: ['Esc'], description: 'Закрыть модальное окно' },
    { keys: ['?'], keysMac: ['?'], description: 'Открыть помощь' },
    { keys: ['/'], keysMac: ['/'], description: 'Фокус на поиск' },
    { keys: ['Tab'], keysMac: ['Tab'], description: 'Навигация по элементам' }
  ]

  // FAQ
  const faqs = [
    {
      q: 'Как настроить Telegram уведомления?',
      a: 'Создайте групповой чат, добавьте бота @freshtrack_bot, отправьте команду /getchatid и скопируйте полученный Chat ID в настройки отдела. После этого вы будете получать уведомления о критических товарах.'
    },
    {
      q: 'Как импортировать товары из Excel?',
      a: 'Перейдите в Настройки → Импорт/Экспорт, скачайте шаблон Excel, заполните его данными (название, категория, срок годности) и загрузите обратно через форму импорта. Система автоматически создаст товары и партии.'
    },
    {
      q: 'Как настроить автоматические отчеты?',
      a: 'В настройках отдела включите "Запланированные экспорты", выберите периодичность (ежедневно/еженедельно/ежемесячно), формат файла и email получателей. Отчеты будут отправляться автоматически.'
    },
    {
      q: 'Что означают цветовые статусы товаров?',
      a: 'Зеленый (Хорошо) - срок годности >7 дней, Желтый (Внимание) - 3-7 дней, Оранжевый (Критично) - 1-2 дня, Красный (Просрочено) - истек срок годности.'
    },
    {
      q: 'Как работает система FIFO?',
      a: 'First In, First Out - система автоматически предлагает использовать товары с ближайшим сроком годности первыми. При сборе товаров система выбирает партии в правильном порядке.'
    },
    {
      q: 'Можно ли редактировать уже созданные партии?',
      a: 'Да, нажмите на товар в инвентаре, выберите партию и нажмите "Редактировать". Вы можете изменить количество, срок годности и примечания. История изменений сохраняется в журнале аудита.'
    }
  ]

  // Tabs configuration
  const tabs = [
    {
      id: 'shortcuts',
      label: 'Горячие клавиши',
      icon: Keyboard
    },
    {
      id: 'faq',
      label: 'FAQ',
      icon: Book
    },
    {
      id: 'contact',
      label: 'Контакты',
      icon: MessageSquare
    }
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
                <h2 id="help-center-title" className="text-lg sm:text-xl font-semibold text-foreground">
                  Центр помощи
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Горячие клавиши, FAQ и контакты
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
                  Используйте горячие клавиши для быстрой навигации и выполнения действий.
                </p>
                {shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 sm:py-3 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
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

            {/* FAQ */}
            {activeTab === 'faq' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="pb-4 sm:pb-6 border-b border-border last:border-0"
                  >
                    <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">
                      {faq.q}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
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
                    <p className="font-medium text-foreground text-sm sm:text-base">Email поддержка</p>
                    <a
                      href="mailto:support@freshtrack.com"
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      support@freshtrack.com
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
                    <p className="font-medium text-foreground text-sm sm:text-base">Telegram поддержка</p>
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
                    <p className="font-medium text-foreground text-sm sm:text-base">Документация</p>
                    <a
                      href="https://docs.freshtrack.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-xs sm:text-sm flex items-center gap-1 mt-1"
                    >
                      docs.freshtrack.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      Полное руководство пользователя
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg border border-accent/20">
                  <Accessibility className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm sm:text-base">Заявление о доступности</p>
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
              Нажмите <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-xs font-mono">?</kbd> чтобы открыть помощь
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
