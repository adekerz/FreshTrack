/**
 * About Page
 * Public page describing FreshTrack product for domain verification
 * and general business information.
 * Accessible without authentication.
 */

import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  CheckCircle,
  Users,
  Mail,
  Globe,
  FileText,
  Shield,
  BarChart2,
  ArrowRight,
  Code2,
  Briefcase,
} from 'lucide-react'
import { TouchButton } from '../components/ui'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../context/LanguageContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function AboutPage() {
  const navigate = useNavigate()
  useTheme()
  const { t } = useTranslation()

  useEffect(() => {
    document.title = 'About FreshTrack — Expiration Date Tracking for Hotels'
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical)
      canonical.setAttribute('href', 'https://freshtrack.systems/about')
    return () => {
      document.title = 'FreshTrack | Inventory Management'
      if (canonical)
        canonical.setAttribute('href', 'https://freshtrack.systems/')
    }
  }, [])

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
            aria-label={t('common.back') || 'Back'}
            icon={ArrowLeft}
          />
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">
              {t('about.pageTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">freshtrack.systems</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {/* 1. Hero */}
          <section className="mb-8">
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-8 h-8 text-accent flex-shrink-0" />
                <div>
                  <h2 className="text-3xl font-semibold text-foreground m-0">
                    FreshTrack
                  </h2>
                  <p className="text-muted-foreground text-sm m-0">
                    {t('about.subtitle')}
                  </p>
                </div>
              </div>
              <p className="text-foreground leading-relaxed m-0">
                {t('about.heroDescription')}
              </p>
            </div>
          </section>

          {/* 2. What We Do */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.whatWeDoTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <ul className="space-y-3 m-0">
                {[
                  t('about.feature1'),
                  t('about.feature2'),
                  t('about.feature3'),
                  t('about.feature4'),
                  t('about.feature5'),
                  t('about.feature6'),
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* 3. Who We Serve */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.whoWeServeTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border space-y-4">
              <p className="text-foreground leading-relaxed m-0">
                {t('about.whoWeServeText')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">
                    {t('about.clientsTitle')}
                  </h4>
                  <p className="text-sm text-muted-foreground m-0">
                    {t('about.clientsText')}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">
                    {t('about.departmentsTitle')}
                  </h4>
                  <p className="text-sm text-muted-foreground m-0">
                    {t('about.departmentsText')}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Product Status */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <BarChart2 className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.productTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-3">
                    {t('about.statusTitle')}
                  </h4>
                  <ul className="space-y-2 m-0">
                    {[
                      t('about.statusVersion'),
                      t('about.statusSince'),
                      t('about.statusDeployment'),
                      t('about.statusStatus'),
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-3">
                    {t('about.scaleTitle')}
                  </h4>
                  <ul className="space-y-2 m-0">
                    {[
                      t('about.scaleTests'),
                      t('about.scaleModules'),
                      t('about.scaleMigrations'),
                      t('about.scaleLanguages'),
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                        <span className="text-sm text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 5. How It Works */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <ArrowRight className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.howItWorksTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  {
                    num: '1',
                    title: t('about.step1Title'),
                    text: t('about.step1Text'),
                  },
                  {
                    num: '2',
                    title: t('about.step2Title'),
                    text: t('about.step2Text'),
                  },
                  {
                    num: '3',
                    title: t('about.step3Title'),
                    text: t('about.step3Text'),
                  },
                ].map((step) => (
                  <div key={step.num} className="text-center sm:text-left">
                    <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center mx-auto sm:mx-0 mb-3">
                      <span className="text-accent font-semibold">
                        {step.num}
                      </span>
                    </div>
                    <h4 className="font-medium text-foreground mb-2">
                      {step.title}
                    </h4>
                    <p className="text-sm text-muted-foreground m-0">
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Technology */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Code2 className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.techTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    title: t('about.techFrontendTitle'),
                    text: t('about.techFrontend'),
                  },
                  {
                    title: t('about.techBackendTitle'),
                    text: t('about.techBackend'),
                  },
                  {
                    title: t('about.techIntegrationsTitle'),
                    text: t('about.techIntegrations'),
                  },
                ].map((group, i) => (
                  <div key={i} className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">
                      {group.title}
                    </h4>
                    <p className="text-sm text-muted-foreground m-0">
                      {group.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 7. Business Information (static for verification bots) */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Briefcase className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.businessTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('about.businessText')}
              </p>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessIndustryLabel')}:
                  </strong>{' '}
                  {t('about.businessIndustryValue')}
                </p>
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessProductTypeLabel')}:
                  </strong>{' '}
                  {t('about.businessProductTypeValue')}
                </p>
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessModelLabel')}:
                  </strong>{' '}
                  {t('about.businessModelValue')}
                </p>
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessGeographyLabel')}:
                  </strong>{' '}
                  {t('about.businessGeographyValue')}
                </p>
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessWebsiteLabel')}:
                  </strong>{' '}
                  freshtrack.systems
                </p>
                <p className="m-0">
                  <strong className="text-foreground">
                    {t('about.businessSupportLabel')}:
                  </strong>{' '}
                  support@freshtrack.systems
                </p>
              </div>
            </div>
          </section>

          {/* 8. Contact */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.contactTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('about.contactText')}
              </p>
              <ul className="space-y-3 m-0">
                <li className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">
                    Email:{' '}
                    <a
                      href="mailto:support@freshtrack.systems"
                      className="text-accent hover:underline"
                    >
                      support@freshtrack.systems
                    </a>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">
                    Website:{' '}
                    <span className="font-medium">freshtrack.systems</span>
                  </span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-4 m-0">
                {t('about.contactPurpose')}
              </p>
            </div>
          </section>

          {/* 9. Legal */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-accent" />
              <h2 className="text-2xl font-semibold text-foreground m-0">
                {t('about.legalTitle')}
              </h2>
            </div>
            <div className="bg-card rounded-lg p-6 border border-border">
              <p className="text-foreground leading-relaxed mb-4">
                {t('about.legalText')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/privacy"
                  className="flex items-center gap-2 text-accent hover:underline font-medium"
                >
                  <Shield className="w-4 h-4" />
                  <span>{t('about.privacyLink')}</span>
                </Link>
                <Link
                  to="/terms"
                  className="flex items-center gap-2 text-accent hover:underline font-medium"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('about.termsLink')}</span>
                </Link>
              </div>
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
            {t('common.back') || 'Back'}
          </TouchButton>
        </div>
      </main>
    </div>
  )
}
