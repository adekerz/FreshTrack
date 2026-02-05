/**
 * Accessibility Statement Page
 * Заявление о доступности — WCAG 2.1 AA, горячие клавиши, обратная связь
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Accessibility, Keyboard, MessageSquare, Mail } from 'lucide-react'
import { TouchButton } from '../components/ui'
import { useTranslation } from '../context/LanguageContext'

export default function AccessibilityStatementPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border" role="banner">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <TouchButton
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('common.back')}
            icon={ArrowLeft}
          />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t('a11y.statementTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('a11y.statementUpdated')}
            </p>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-8" role="main">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <section className="mb-8" aria-labelledby="a11y-intro">
            <div className="flex items-center gap-3 mb-4">
              <Accessibility className="w-6 h-6 text-accent" aria-hidden="true" />
              <h2 id="a11y-intro" className="text-2xl font-semibold text-foreground m-0">
                {t('a11y.statementIntroTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('a11y.statementIntro')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('a11y.statementWCAG')}
              </p>
            </div>
          </section>

          <section className="mb-8" aria-labelledby="a11y-keyboard">
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="w-6 h-6 text-accent" aria-hidden="true" />
              <h2 id="a11y-keyboard" className="text-2xl font-semibold text-foreground m-0">
                {t('a11y.statementKeyboardTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('a11y.statementKeyboardIntro')}
              </p>
              <ul className="list-disc list-inside text-foreground space-y-2">
                <li><kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">Ctrl</kbd> / <kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">K</kbd> — {t('a11y.shortcutSearch')}</li>
                <li><kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">Ctrl</kbd> / <kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">E</kbd> — {t('a11y.shortcutExport')}</li>
                <li><kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">?</kbd> — {t('a11y.shortcutHelp')}</li>
                <li><kbd className="px-1.5 py-0.5 bg-muted rounded text-sm">Esc</kbd> — {t('a11y.shortcutClose')}</li>
              </ul>
              <p className="text-muted-foreground text-sm mt-4">
                {t('a11y.statementKeyboardMore')}
              </p>
            </div>
          </section>

          <section className="mb-8" aria-labelledby="a11y-feedback">
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="w-6 h-6 text-accent" aria-hidden="true" />
              <h2 id="a11y-feedback" className="text-2xl font-semibold text-foreground m-0">
                {t('a11y.statementFeedbackTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('a11y.statementFeedbackIntro')}
              </p>
              <div className="flex items-start gap-3 p-4 bg-accent/5 rounded-lg border border-accent/20">
                <Mail className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm sm:text-base">
                    {t('a11y.statementContact')}
                  </p>
                  <a
                    href="mailto:accessibility@freshtrack.com"
                    className="text-accent hover:underline text-xs sm:text-sm mt-1 inline-block"
                  >
                    accessibility@freshtrack.com
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
