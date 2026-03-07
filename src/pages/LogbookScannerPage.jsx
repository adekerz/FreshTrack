import { ScanLine, Clock } from 'lucide-react'
import PageContainer from '../components/PageContainer'

export default function LogbookScannerPage() {
  return (
    <PageContainer
      title="IRD Logbook Scanner"
      subtitle="Сканирование чеков гостей"
      stickyHeader={true}
      titleIcon={ScanLine}
    >
      <div className="flex-1 flex items-center justify-center py-24 animate-fade-in">
        <div className="flex flex-col items-center gap-6 text-center px-4 max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center">
            <ScanLine className="w-10 h-10 text-accent" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Скоро
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-3">
              IRD Logbook Scanner
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Модуль сканирования чеков гостей находится в разработке. Здесь вы
              сможете сканировать чеки, автоматически заполнять логбук и
              экспортировать отчёты.
            </p>
          </div>
          <div className="w-full p-4 rounded-xl bg-muted/30 border border-border text-left space-y-2">
            <p className="text-sm font-medium text-foreground">
              Будет доступно:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                Сканирование чеков с камеры
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                Автоматическое заполнение логбука
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                Экспорт в Excel и отправка в группу
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
