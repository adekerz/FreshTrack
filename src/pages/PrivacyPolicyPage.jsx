/**
 * Privacy Policy Page
 * Public page displaying the privacy policy in Russian.
 * Covers GDPR compliance and Kazakhstan data protection laws.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Database, Clock, Lock, UserCheck, Trash2, Mail } from 'lucide-react'
import { TouchButton } from '../components/ui'
import { useTheme } from '../context/ThemeContext'

const CURRENT_VERSION = '1.0'
const LAST_UPDATED = '1 февраля 2024 г.'

export default function PrivacyPolicyPage() {
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
            <h1 className="text-xl font-semibold text-foreground">Политика конфиденциальности</h1>
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
              <Shield className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">1. Введение</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Настоящая Политика конфиденциальности описывает, как система FreshTrack («Система», «мы», «нас»)
                собирает, использует и защищает персональные данные пользователей («вы», «пользователь»).
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                FreshTrack — это система управления инвентарём для гостиничной индустрии, предназначенная для
                отслеживания сроков годности продуктов, управления запасами и организации рабочих процессов.
              </p>
              <p className="text-muted-foreground text-sm">
                Используя Систему, вы соглашаетесь с условиями обработки данных, изложенными в настоящей Политике.
              </p>
            </div>
          </section>

          {/* Data Collected */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">2. Собираемые данные</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <h3 className="text-lg font-medium text-foreground mb-4">2.1. Данные, предоставляемые пользователем</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Логин</strong> — уникальный идентификатор для входа в систему</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Имя и фамилия</strong> — для идентификации в системе</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Адрес электронной почты</strong> — для уведомлений и восстановления доступа</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Пароль</strong> — хранится в зашифрованном виде (bcrypt)</span>
                </li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-4">2.2. Данные, собираемые автоматически</h3>
              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>IP-адрес</strong> — для обеспечения безопасности и аудита</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>User-Agent</strong> — информация о браузере и устройстве</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Cookies и JWT-токены</strong> — для поддержания сессии</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-warning rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Временные метки</strong> — дата и время действий в системе</span>
                </li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mb-4">2.3. Данные о деятельности</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-info rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>История действий</strong> — аудит лог всех операций в системе</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-info rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Принадлежность к отелю</strong> — связь с организацией</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-info rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground"><strong>Принадлежность к отделу</strong> — для разграничения доступа</span>
                </li>
              </ul>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">3. Сроки хранения данных</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Учётные записи</h4>
                  <p className="text-sm text-muted-foreground">
                    Данные учётной записи хранятся в течение всего периода использования сервиса и
                    до 7 лет после деактивации согласно законодательству Республики Казахстан.
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Аудит логи</h4>
                  <p className="text-sm text-muted-foreground">
                    Журналы аудита хранятся 7 лет в соответствии с требованиями
                    налогового и бухгалтерского законодательства.
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Сессии</h4>
                  <p className="text-sm text-muted-foreground">
                    Данные сессий (токены) автоматически удаляются через 7 дней неактивности
                    или при явном выходе из системы.
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Уведомления</h4>
                  <p className="text-sm text-muted-foreground">
                    История уведомлений хранится согласно настройкам ретенции данных
                    вашей организации (по умолчанию 90 дней).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">4. Защита данных</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Мы применяем современные меры защиты для обеспечения безопасности ваших данных:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">Шифрование паролей</strong>
                    <p className="text-sm text-muted-foreground">
                      Пароли хешируются с использованием алгоритма bcrypt с солью
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">HTTPS/TLS</strong>
                    <p className="text-sm text-muted-foreground">
                      Все соединения защищены протоколом TLS 1.3
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">Двухфакторная аутентификация</strong>
                    <p className="text-sm text-muted-foreground">
                      Опциональная MFA через TOTP (Google Authenticator, Authy и др.)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Database className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <strong className="text-foreground">Изоляция данных</strong>
                    <p className="text-sm text-muted-foreground">
                      Каждый отель видит только свои данные благодаря разграничению доступа
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* User Rights */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">5. Права пользователя</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                В соответствии с GDPR и законодательством Республики Казахстан о персональных данных,
                вы имеете следующие права:
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4 text-accent" />
                    Право на доступ
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Вы можете запросить копию всех ваших персональных данных через настройки профиля
                    или обратившись к администратору.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-danger" />
                    Право на удаление
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Вы можете запросить удаление вашей учётной записи. Данные аудита сохраняются
                    согласно законодательным требованиям.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-warning" />
                    Право на исправление
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Вы можете обновить свои персональные данные (имя, email) через настройки профиля.
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-info" />
                    Право на ограничение
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Вы можете запросить ограничение обработки ваших данных, обратившись к администратору.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">6. Файлы Cookie</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Система использует следующие типы cookies:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium text-foreground">Название</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">Назначение</th>
                      <th className="text-left py-2 px-3 font-medium text-foreground">Срок</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-foreground font-mono text-xs">freshtrack_token</td>
                      <td className="py-2 px-3 text-muted-foreground">Авторизация (JWT)</td>
                      <td className="py-2 px-3 text-muted-foreground">7 дней</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-foreground font-mono text-xs">freshtrack_theme</td>
                      <td className="py-2 px-3 text-muted-foreground">Предпочтения темы</td>
                      <td className="py-2 px-3 text-muted-foreground">1 год</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-3 text-foreground font-mono text-xs">freshtrack_lang</td>
                      <td className="py-2 px-3 text-muted-foreground">Выбранный язык</td>
                      <td className="py-2 px-3 text-muted-foreground">1 год</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-foreground font-mono text-xs">cookie_consent</td>
                      <td className="py-2 px-3 text-muted-foreground">Согласие на cookies</td>
                      <td className="py-2 px-3 text-muted-foreground">1 год</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Мы не используем сторонние трекинговые cookies и не передаём данные рекламным сетям.
              </p>
            </div>
          </section>

          {/* Third Parties */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">7. Передача данных третьим лицам</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                Мы можем передавать ваши данные следующим категориям получателей:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">
                    <strong>Почтовые сервисы</strong> — для отправки уведомлений по email (только адрес email)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">
                    <strong>Telegram API</strong> — для отправки уведомлений (только ID чата, без персональных данных)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">
                    <strong>Администраторы отеля</strong> — имеют доступ к данным пользователей своего отеля
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <span className="text-foreground">
                    <strong>Правоохранительные органы</strong> — по законному запросу в соответствии с законодательством РК
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">8. Контактная информация</h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                По вопросам, связанным с обработкой персональных данных, вы можете обратиться:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-accent mt-1 flex-shrink-0" />
                  <span className="text-foreground">Email: privacy@freshtrack.kz</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-4">
                Мы ответим на ваш запрос в течение 30 календарных дней.
              </p>
            </div>
          </section>

          {/* Changes */}
          <section className="mb-8">
            <div className="bg-muted/50 rounded-lg p-6 border border-border">
              <h3 className="text-lg font-medium text-foreground mb-2">Изменения политики</h3>
              <p className="text-muted-foreground">
                Мы оставляем за собой право изменять настоящую Политику конфиденциальности.
                При существенных изменениях мы уведомим вас через систему или по электронной почте.
                Продолжая использовать Систему после изменений, вы принимаете обновлённую политику.
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
