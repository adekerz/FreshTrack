/**
 * Terms of Service Page
 * Public page displaying the terms of service in Russian.
 * Covers user responsibilities, system usage rules, and legal terms.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle, Scale, Users, Shield } from 'lucide-react'
import { TouchButton } from '../components/ui'
import { useTheme } from '../context/ThemeContext'

const CURRENT_VERSION = '1.0'
const LAST_UPDATED = '1 февраля 2024 г.'

export default function TermsOfServicePage() {
  const navigate = useNavigate()
  const { theme } = useTheme()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <TouchButton
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Назад"
            icon={ArrowLeft}
          />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Условия использования</h1>
            <p className="text-sm text-muted-foreground">Версия {CURRENT_VERSION} от {LAST_UPDATED}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">

          {/* Introduction */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">1. Общие положения</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Настоящие Условия использования («Условия») регулируют доступ к системе управления
                инвентарём FreshTrack («Система», «Сервис») и её использование.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Регистрируясь в Системе или используя её, вы подтверждаете, что:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Вам исполнилось 18 лет или вы достигли возраста совершеннолетия в вашей юрисдикции</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Вы уполномочены принимать данные Условия от имени вашей организации</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Вы ознакомились с Политикой конфиденциальности и согласны с ней</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Description of Service */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">2. Описание Сервиса</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                FreshTrack — это веб-приложение для управления инвентарём в гостиничной индустрии,
                предоставляющее следующие функции:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Отслеживание сроков годности продуктов</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Управление категориями и единицами измерения</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Уведомления о приближающихся сроках</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Планирование сборов продукции</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Аналитика и отчётность</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-foreground">Управление пользователями и ролями</span>
                </div>
              </div>
            </div>
          </section>

          {/* User Accounts */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">3. Учётные записи</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">3.1. Регистрация</h3>
              <p className="text-foreground leading-relaxed mb-4">
                Для использования Системы необходимо создать учётную запись. При регистрации вы обязуетесь:
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">Предоставлять достоверную и актуальную информацию</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">Поддерживать безопасность своего пароля</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">Немедленно уведомлять о несанкционированном доступе</span>
                </li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-4">3.2. Ответственность за учётную запись</h3>
              <p className="text-foreground leading-relaxed">
                Вы несёте полную ответственность за все действия, совершённые под вашей учётной записью.
                Администрация не несёт ответственности за убытки, возникшие в результате использования
                вашей учётной записи третьими лицами.
              </p>
            </div>
          </section>

          {/* Acceptable Use */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">4. Допустимое использование</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Используя Систему, вы соглашаетесь:
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Использовать Систему только в законных целях</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Соблюдать все применимые законы и правила</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Уважать права других пользователей</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Вносить достоверные данные об инвентаре</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Prohibited Actions */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="w-6 h-6 text-danger" />
              <h2 className="text-2xl font-semibold text-foreground m-0">5. Запрещённые действия</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-danger/20">
              <p className="text-foreground leading-relaxed mb-4">
                При использовании Системы запрещается:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Передавать данные для входа третьим лицам</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Пытаться получить несанкционированный доступ к данным других пользователей</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Вмешиваться в работу Системы или нарушать её функционирование</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Загружать вредоносное программное обеспечение</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Использовать автоматизированные средства для массового доступа</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-danger mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Копировать или распространять содержимое Системы без разрешения</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">6. Интеллектуальная собственность</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Все права интеллектуальной собственности на Систему, включая программный код,
                дизайн, торговые марки и контент, принадлежат разработчикам FreshTrack.
              </p>
              <p className="text-foreground leading-relaxed">
                Данные, которые вы вносите в Систему (информация о продуктах, настройки),
                остаются вашей собственностью. Вы предоставляете нам право использовать эти данные
                исключительно для предоставления услуг Системы.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <h2 className="text-2xl font-semibold text-foreground m-0">7. Ограничение ответственности</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-warning/20">
              <p className="text-foreground leading-relaxed mb-4">
                Система предоставляется «как есть» без каких-либо гарантий. Мы не несём ответственности за:
              </p>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Временную недоступность Системы по техническим причинам</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Убытки, вызванные неправильным использованием Системы</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Потерю данных в результате действий пользователя</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">Действия третьих лиц, получивших доступ к учётной записи</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Максимальная ответственность ограничивается суммой, уплаченной за использование Системы
                за последние 12 месяцев.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">8. Прекращение доступа</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">8.1. По инициативе пользователя</h3>
              <p className="text-foreground leading-relaxed mb-6">
                Вы можете прекратить использование Системы в любое время, обратившись к администратору
                вашей организации с просьбой о деактивации учётной записи.
              </p>

              <h3 className="text-lg font-medium text-foreground mb-4">8.2. По инициативе администрации</h3>
              <p className="text-foreground leading-relaxed">
                Мы оставляем за собой право приостановить или прекратить доступ к Системе
                в случае нарушения настоящих Условий, без предварительного уведомления.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">9. Применимое право</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Настоящие Условия регулируются законодательством Республики Казахстан.
                Все споры подлежат разрешению в судах Республики Казахстан.
              </p>
              <p className="text-foreground leading-relaxed">
                В случае если какое-либо положение настоящих Условий будет признано недействительным,
                остальные положения сохраняют свою силу.
              </p>
            </div>
          </section>

          {/* Changes */}
          <section className="mb-8">
            <div className="bg-muted/50 rounded-lg p-6 border border-border">
              <h3 className="text-lg font-medium text-foreground mb-2">Изменения условий</h3>
              <p className="text-muted-foreground">
                Мы оставляем за собой право изменять настоящие Условия использования.
                При существенных изменениях мы уведомим вас через Систему или по электронной почте.
                Продолжая использовать Систему после изменений, вы принимаете обновлённые условия.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <div className="bg-accent/5 rounded-lg p-6 border border-accent/20">
              <h3 className="text-lg font-medium text-foreground mb-2">Контакты</h3>
              <p className="text-foreground">
                По вопросам, связанным с настоящими Условиями, обращайтесь: legal@freshtrack.kz
              </p>
            </div>
          </section>

        </div>

        {/* Back button */}
        <div className="mt-8 pt-6 border-t border-border">
          <TouchButton
            variant="outline"
            onClick={() => navigate(-1)}
            icon={ArrowLeft}
            iconPosition="left"
          >
            Вернуться назад
          </TouchButton>
        </div>
      </main>
    </div>
  )
}
