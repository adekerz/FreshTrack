/**
 * Documentation Page
 * Comprehensive user guide and documentation
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Book, FileText, Settings, ShieldCheck, Key } from 'lucide-react'
import { TouchButton } from '../components/ui'
import { useTranslation } from '../context/LanguageContext'

export default function DocumentationPage() {
    const navigate = useNavigate()
    const { t } = useTranslation()

    const sections = [
        {
            id: 'getting-started',
            icon: Book,
            title: t('docs.gettingStarted.title', 'Начало работы'),
            content: t('docs.gettingStarted.content', 'Добро пожаловать в FreshTrack. Система предназначена для управления инвентарем и сроками годности продуктов в отелях. Начните с создания отделов и настройки пользователей.')
        },
        {
            id: 'inventory',
            icon: FileText,
            title: t('docs.inventory.title', 'Управление инвентарем'),
            content: t('docs.inventory.content', 'Инвентарь разделен по отделам. Используйте сканер штрих-кодов или ручной вводите данные о товарах. Следите за цветовыми индикаторами сроков годности (зеленый - ок, желтый - внимание, красный - критично).')
        },
        {
            id: 'reports',
            icon: FileText,
            title: t('docs.reports.title', 'Отчеты и экспорт'),
            content: t('docs.reports.content', 'Вы можете экспортировать данные в Excel, PDF или CSV форматы. Экспорт доступен в разделе "Статистика" и "Инвентарь".')
        },
        {
            id: 'security',
            icon: ShieldCheck,
            title: t('docs.security.title', 'Безопасность и MFA'),
            content: t('docs.security.content', 'Для защиты аккаунта включите двухфакторную аутентификацию (MFA/TOTP). Используйте Google Authenticator или Authy для генерации кодов.')
        },
        {
            id: 'hotkeys',
            icon: Key,
            title: t('docs.hotkeys.title', 'Горячие клавиши'),
            content: t('docs.hotkeys.content', 'Ctrl+K (Поиск), Ctrl+N (Новый товар), Ctrl+E (Экспорт), Esc (Закрыть). Полный список доступен в Центре помощи (?).')
        }
    ]

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border" role="banner">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
                    <TouchButton
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t('common.back', 'Назад')}
                        icon={ArrowLeft}
                    />
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">
                            {t('docs.pageTitle', 'Документация')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {t('docs.pageSubtitle', 'Полное руководство пользователя')}
                        </p>
                    </div>
                </div>
            </header>

            <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-8" role="main">
                <div className="grid gap-6 md:grid-cols-2">
                    {sections.map(section => {
                        const Icon = section.icon
                        return (
                            <div key={section.id} className="bg-card rounded-lg p-6 border border-border hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-accent/10 rounded-lg text-accent">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-foreground">
                                        {section.title}
                                    </h2>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {section.content}
                                </p>
                            </div>
                        )
                    })}
                </div>

                <div className="mt-12 p-6 bg-muted/30 rounded-lg border border-border">
                    <h3 className="text-lg font-medium text-foreground mb-2">
                        {t('docs.needMoreHelp', 'Нужна дополнительная помощь?')}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4">
                        {t('docs.contactSupport', 'Если вы не нашли ответ на свой вопрос, свяжитесь с нашей службой поддержки.')}
                    </p>
                    <div className="flex gap-4">
                        <a href="mailto:support@freshtrack.com" className="text-accent hover:underline text-sm font-medium">
                            support@freshtrack.com
                        </a>
                    </div>
                </div>
            </main>
        </div>
    )
}
