import { useState, useMemo } from 'react'
import {
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Search,
  Package,
  Bell,
  Calendar,
  ClipboardList,
  Users,
  Settings,
  Shield,
  Zap,
  ArrowLeft
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from '../context/LanguageContext'
import { cn } from '../utils/classNames'
import { TouchButton } from '../components/ui'

/**
 * FAQ Page - Role-based help and documentation
 * Shows relevant FAQ items based on user role
 */
export default function FAQPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isHotelAdmin, isSuperAdmin } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [selectedCategory, setSelectedCategory] = useState('all')

  const userRole = user?.role?.toUpperCase() || 'STAFF'
  const isAdmin = isHotelAdmin() || isSuperAdmin()
  const isManager = userRole === 'DEPARTMENT_MANAGER' || isAdmin

  // FAQ categories with icons
  const categories = [
    { id: 'all', icon: HelpCircle, label: t('faq.categories.all') || 'Все' },
    { id: 'inventory', icon: Package, label: t('faq.categories.inventory') || 'Инвентарь' },
    { id: 'notifications', icon: Bell, label: t('faq.categories.notifications') || 'Уведомления' },
    { id: 'calendar', icon: Calendar, label: t('faq.categories.calendar') || 'Календарь' },
    { id: 'collections', icon: ClipboardList, label: t('faq.categories.collections') || 'Сборы' },
    ...(isManager ? [{ id: 'management', icon: Users, label: t('faq.categories.management') || 'Управление' }] : []),
    ...(isAdmin ? [{ id: 'admin', icon: Shield, label: t('faq.categories.admin') || 'Администрирование' }] : []),
    { id: 'settings', icon: Settings, label: t('faq.categories.settings') || 'Настройки' },
  ]

  // FAQ items - filtered by role
  const faqItems = useMemo(() => {
    const items = [
      // === INVENTORY ===
      {
        id: 'what-is-freshtrack',
        category: 'inventory',
        question: t('faq.items.whatIsFreshtrack.question') || 'Что такое FreshTrack?',
        answer: t('faq.items.whatIsFreshtrack.answer') ||
          'FreshTrack — это система управления инвентарём для отелей, которая помогает отслеживать сроки годности продуктов. Система предупреждает о скором истечении сроков, помогает минимизировать потери и поддерживает стандарты качества.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'what-is-batch',
        category: 'inventory',
        question: t('faq.items.whatIsBatch.question') || 'Что такое партия (batch)?',
        answer: t('faq.items.whatIsBatch.answer') ||
          'Партия — это конкретная поставка продукта с определённым сроком годности и количеством. Например, у вас может быть 3 партии молока с разными сроками годности. Система отслеживает каждую партию отдельно.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'how-to-add-batch',
        category: 'inventory',
        question: t('faq.items.howToAddBatch.question') || 'Как добавить новую партию продукта?',
        answer: t('faq.items.howToAddBatch.answer') ||
          '1. Перейдите на страницу "Инвентарь"\n2. Найдите нужный продукт и нажмите на него\n3. В открывшемся окне нажмите "Добавить партию"\n4. Укажите срок годности и количество\n5. Нажмите "Сохранить"\n\nСовет: используйте шаблоны быстрого добавления для часто используемых продуктов.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'batch-statuses',
        category: 'inventory',
        question: t('faq.items.batchStatuses.question') || 'Что означают цветные индикаторы статуса?',
        answer: t('faq.items.batchStatuses.answer') ||
          '• Зелёный — продукт в хорошем состоянии (более 7 дней до истечения)\n• Жёлтый — предупреждение (4-7 дней до истечения)\n• Оранжевый — критический статус (1-3 дня до истечения)\n• Красный — просрочено (срок годности истёк)\n\nПороговые значения можно настроить в разделе "Правила уведомлений".',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'filter-inventory',
        category: 'inventory',
        question: t('faq.items.filterInventory.question') || 'Как фильтровать и сортировать инвентарь?',
        answer: t('faq.items.filterInventory.answer') ||
          '• Используйте категории вверху страницы для фильтрации по типу продуктов\n• Нажмите на иконку сортировки для выбора порядка: по дате истечения, названию или количеству\n• Используйте глобальный поиск (иконка лупы в шапке) для быстрого поиска по всему инвентарю',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === COLLECTIONS (FIFO) ===
      {
        id: 'what-is-fifo',
        category: 'collections',
        question: t('faq.items.whatIsFifo.question') || 'Что такое FIFO и как это работает?',
        answer: t('faq.items.whatIsFifo.answer') ||
          'FIFO (First-In-First-Out) — метод списания, при котором сначала используются продукты с самым ранним сроком годности. Это помогает минимизировать потери от просрочки.\n\nКогда вы делаете сбор, система автоматически выбирает самые старые партии.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'how-to-collect',
        category: 'collections',
        question: t('faq.items.howToCollect.question') || 'Как списать/использовать продукт?',
        answer: t('faq.items.howToCollect.answer') ||
          '1. Откройте карточку продукта в инвентаре\n2. Нажмите кнопку "FIFO сбор" (иконка молнии)\n3. Укажите количество для списания\n4. Выберите причину: использовано на кухне, просрочено, повреждено и т.д.\n5. При необходимости добавьте комментарий\n6. Подтвердите списание\n\nСистема автоматически спишет из самых старых партий.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'collection-reasons',
        category: 'collections',
        question: t('faq.items.collectionReasons.question') || 'Какие причины списания доступны?',
        answer: t('faq.items.collectionReasons.answer') ||
          '• Кухня — использовано в приготовлении блюд\n• Просрочено — срок годности истёк\n• Повреждено — продукт испорчен или повреждён\n• Возврат — возвращено поставщику\n• Комплимент — подарено гостю\n• Другое — иная причина (укажите в комментарии)',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === NOTIFICATIONS ===
      {
        id: 'notification-types',
        category: 'notifications',
        question: t('faq.items.notificationTypes.question') || 'Какие уведомления я получаю?',
        answer: t('faq.items.notificationTypes.answer') ||
          'Система отправляет уведомления о:\n• Просроченных продуктах (требуют немедленного внимания)\n• Критических — истекают в ближайшие 1-3 дня\n• Предупреждающих — истекают через 4-7 дней\n\nУведомления отображаются на главной странице, странице уведомлений и могут приходить в Telegram.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'telegram-notifications',
        category: 'notifications',
        question: t('faq.items.telegramNotifications.question') || 'Как настроить уведомления в Telegram?',
        answer: t('faq.items.telegramNotifications.answer') ||
          '1. Найдите бота @freshtracksystemsbot в Telegram\n2. Добавьте его в групповой чат вашего отдела\n3. Отправьте команду /link MARSHA_КОД (например, /link NYCVZ)\n4. Бот подтвердит привязку\n\nТеперь уведомления будут приходить в этот чат автоматически.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === CALENDAR ===
      {
        id: 'calendar-usage',
        category: 'calendar',
        question: t('faq.items.calendarUsage.question') || 'Как использовать календарь?',
        answer: t('faq.items.calendarUsage.answer') ||
          'Календарь показывает визуальное представление сроков годности:\n\n• Цвет дня показывает статус продуктов, истекающих в этот день\n• Нажмите на день, чтобы увидеть список продуктов\n• Используйте стрелки для навигации по месяцам\n• Кнопка "Сегодня" вернёт к текущей дате\n\nЭто помогает планировать закупки и использование продуктов.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === SETTINGS ===
      {
        id: 'change-password',
        category: 'settings',
        question: t('faq.items.changePassword.question') || 'Как изменить пароль?',
        answer: t('faq.items.changePassword.answer') ||
          '1. Нажмите на своё имя в правом верхнем углу\n2. Выберите "Настройки"\n3. В разделе "Профиль" нажмите "Изменить пароль"\n4. Введите текущий и новый пароль\n5. Подтвердите изменение\n\nПароль должен содержать минимум 8 символов, включая буквы и цифры.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'change-language',
        category: 'settings',
        question: t('faq.items.changeLanguage.question') || 'Как изменить язык интерфейса?',
        answer: t('faq.items.changeLanguage.answer') ||
          'Система поддерживает 8 языков: русский, английский, казахский, немецкий, французский, испанский, итальянский и арабский.\n\n1. Откройте "Настройки"\n2. Перейдите на вкладку "Язык"\n3. Выберите нужный язык\n\nИзменения применяются мгновенно.',
        roles: ['STAFF', 'DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === MANAGEMENT (for Managers+) ===
      {
        id: 'notification-rules',
        category: 'management',
        question: t('faq.items.notificationRules.question') || 'Как настроить правила уведомлений?',
        answer: t('faq.items.notificationRules.answer') ||
          '1. Откройте "Настройки" → "Правила уведомлений"\n2. Установите пороговые значения:\n   • Критический порог (по умолчанию 3 дня)\n   • Предупреждающий порог (по умолчанию 7 дней)\n3. Сохраните изменения\n\nЭти настройки влияют на цветовую индикацию и время отправки уведомлений.',
        roles: ['DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'view-collection-history',
        category: 'management',
        question: t('faq.items.viewCollectionHistory.question') || 'Как посмотреть историю списаний?',
        answer: t('faq.items.viewCollectionHistory.answer') ||
          '1. Перейдите в раздел "История сборов" в боковом меню\n2. Используйте фильтры:\n   • По отделу\n   • По причине списания\n   • По дате\n3. Экспортируйте данные в Excel или PDF при необходимости',
        roles: ['DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'use-templates',
        category: 'management',
        question: t('faq.items.useTemplates.question') || 'Как использовать шаблоны быстрого добавления?',
        answer: t('faq.items.useTemplates.answer') ||
          'Шаблоны ускоряют добавление часто используемых продуктов:\n\n1. Откройте "Настройки" → "Шаблоны"\n2. Создайте шаблон с набором продуктов\n3. При добавлении инвентаря выберите "Быстрое добавление"\n4. Выберите шаблон и укажите сроки годности\n\nЭто экономит время при регулярных поставках.',
        roles: ['DEPARTMENT_MANAGER', 'HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === ADMIN ===
      {
        id: 'manage-users',
        category: 'admin',
        question: t('faq.items.manageUsers.question') || 'Как управлять пользователями?',
        answer: t('faq.items.manageUsers.answer') ||
          '1. Откройте "Настройки" → "Аккаунты"\n2. Здесь вы можете:\n   • Просмотреть всех пользователей отеля\n   • Активировать/деактивировать аккаунты\n   • Фильтровать по роли и статусу\n   • Экспортировать список пользователей\n\nДля создания нового пользователя перейдите в "Пользователи".',
        roles: ['HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'manage-departments',
        category: 'admin',
        question: t('faq.items.manageDepartments.question') || 'Как управлять отделами и категориями?',
        answer: t('faq.items.manageDepartments.answer') ||
          '1. Откройте "Настройки" → "Справочники"\n2. Управляйте:\n   • Отделами (Бар, Ресторан, Мини-бар и т.д.)\n   • Категориями продуктов (Алкоголь, Напитки, Снэки и т.д.)\n   • Продуктами (типы продуктов для инвентаря)\n\nКаждый отдел изолирован — сотрудники видят только свой отдел.',
        roles: ['HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'view-audit-logs',
        category: 'admin',
        question: t('faq.items.viewAuditLogs.question') || 'Как просмотреть журнал действий?',
        answer: t('faq.items.viewAuditLogs.answer') ||
          '1. Перейдите в "Журнал действий" в боковом меню\n2. Система записывает все действия:\n   • Входы и выходы пользователей\n   • Создание и редактирование данных\n   • Списания и сборы\n   • Изменения настроек\n3. Фильтруйте по типу действия, пользователю, дате\n4. Экспортируйте для аудита',
        roles: ['HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'import-export',
        category: 'admin',
        question: t('faq.items.importExport.question') || 'Как импортировать/экспортировать данные?',
        answer: t('faq.items.importExport.answer') ||
          'Экспорт:\n1. "Настройки" → "Импорт/Экспорт"\n2. Выберите формат (Excel или PDF)\n3. Укажите фильтры (отдел, категория, период)\n4. Нажмите "Экспорт"\n\nИмпорт:\n1. Скачайте шаблон Excel\n2. Заполните данные по образцу\n3. Загрузите файл в систему\n4. Проверьте предпросмотр и подтвердите',
        roles: ['HOTEL_ADMIN', 'SUPER_ADMIN']
      },
      {
        id: 'what-is-marsha',
        category: 'admin',
        question: t('faq.items.whatIsMarsha.question') || 'Что такое MARSHA код?',
        answer: t('faq.items.whatIsMarsha.answer') ||
          'MARSHA — это уникальный 5-символьный код отеля в системе Marriott.\n\nНапример: NYCVZ — Marriott New York.\n\nЭтот код используется для:\n• Идентификации отеля в системе\n• Интеграции с PMS (Property Management System)\n• Связывания Telegram-уведомлений с отелем\n\nMARSHA коды управляются только супер-администраторами.',
        roles: ['HOTEL_ADMIN', 'SUPER_ADMIN']
      },

      // === SUPER_ADMIN ONLY ===
      {
        id: 'manage-marsha-codes',
        category: 'admin',
        question: t('faq.items.manageMarshaCode.question') || 'Как управлять MARSHA кодами?',
        answer: t('faq.items.manageMarshaCode.answer') ||
          '1. Откройте "Настройки" → "Марша коды"\n2. Найдите нужный код по стране, региону или бренду\n3. Назначьте код отелю или освободите его\n\nБаза содержит коды всех отелей Marriott. При создании нового отеля в системе, назначьте ему соответствующий MARSHA код.',
        roles: ['SUPER_ADMIN']
      },
      {
        id: 'manage-hotels',
        category: 'admin',
        question: t('faq.items.manageHotels.question') || 'Как управлять несколькими отелями?',
        answer: t('faq.items.manageHotels.answer') ||
          'Как супер-администратор вы можете:\n\n1. Переключаться между отелями через селектор в шапке\n2. Просматривать данные любого отеля\n3. Управлять пользователями всех отелей в "Аккаунты"\n4. Назначать MARSHA коды новым отелям\n5. Просматривать общую статистику по всей сети',
        roles: ['SUPER_ADMIN']
      },
    ]

    // Filter by user role
    return items.filter(item => item.roles.includes(userRole))
  }, [t, userRole])

  // Filter FAQ items by search and category
  const filteredItems = useMemo(() => {
    return faqItems.filter(item => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
      const matchesSearch = !searchQuery ||
        item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [faqItems, selectedCategory, searchQuery])

  const toggleItem = (id) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedItems(new Set(filteredItems.map(item => item.id)))
  }

  const collapseAll = () => {
    setExpandedItems(new Set())
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <TouchButton
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
              icon={ArrowLeft}
            />
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">
                {t('faq.title') || 'Помощь и FAQ'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('faq.subtitle') || 'Ответы на часто задаваемые вопросы'}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('faq.searchPlaceholder') || 'Поиск по вопросам...'}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Categories */}
        <div className="flex gap-2 flex-wrap mb-6">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <TouchButton
                key={cat.id}
                variant="ghost"
                size="small"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm whitespace-nowrap flex items-center gap-2 min-h-0 h-auto font-medium transition-all',
                  selectedCategory === cat.id
                    ? 'bg-primary-600 text-white hover:bg-primary-600/90'
                    : 'bg-card border border-border text-foreground hover:bg-muted/80'
                )}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </TouchButton>
            )
          })}
        </div>

        {/* Expand/Collapse buttons */}
        <div className="flex justify-end gap-2 mb-4">
          <TouchButton
            variant="ghost"
            size="small"
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('faq.expandAll') || 'Развернуть все'}
          </TouchButton>
          <span className="text-muted-foreground">|</span>
          <TouchButton
            variant="ghost"
            size="small"
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('faq.collapseAll') || 'Свернуть все'}
          </TouchButton>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {t('faq.noResults') || 'Ничего не найдено'}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {t('faq.tryDifferentSearch') || 'Попробуйте изменить поисковый запрос'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = expandedItems.has(item.id)
              const CategoryIcon = categories.find(c => c.id === item.category)?.icon || HelpCircle

              return (
                <div
                  key={item.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      'bg-accent/10 text-accent'
                    )}>
                      <CategoryIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground pr-8">
                        {item.question}
                      </h3>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-11 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.answer}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Contact support */}
        <div className="mt-8 p-6 bg-accent/5 border border-accent/20 rounded-xl text-center">
          <Zap className="w-8 h-8 text-accent mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-2">
            {t('faq.needMoreHelp') || 'Нужна дополнительная помощь?'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('faq.contactSupport') || 'Свяжитесь с администратором вашего отеля или службой поддержки'}
          </p>
          <TouchButton
            variant="primary"
            onClick={() => navigate('/settings')}
            className="inline-flex"
          >
            {t('faq.openSettings') || 'Открыть настройки'}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
