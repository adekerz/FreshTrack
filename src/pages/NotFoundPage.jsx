/**
 * NotFoundPage — страница 404
 *
 * Два режима отображения:
 * 1. Публичный (неавторизованный пользователь) — полноэкранный с логотипом
 * 2. Внутренний (авторизованный пользователь) — встроен в Layout с сайдбаром
 */

import { useNavigate, Link } from 'react-router-dom'
import { Home, ArrowLeft, Leaf } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { TouchButton } from '../components/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Определяем режим по наличию пользователя
  const isAuthenticated = !!user

  // Публичная версия — полноэкранная, для неавторизованных
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 animate-fade-in">
        {/* Основной контент */}
        <div className="text-center max-w-md mx-auto">
          {/* 404 */}
          <h1
            className="text-[120px] sm:text-[160px] font-bold leading-none mb-4"
            style={{
              color: '#e8653a',
              textShadow: '0 4px 24px rgba(232, 101, 58, 0.3)'
            }}
          >
            404
          </h1>

          {/* Заголовок */}
          <h2 className="text-2xl sm:text-3xl font-serif text-foreground mb-3">
            Страница не найдена
          </h2>

          {/* Описание */}
          <p className="text-muted-foreground mb-8">
            Проверьте адрес в строке браузера
          </p>

          {/* Кнопка */}
          <TouchButton
            variant="primary"
            size="large"
            onClick={() => navigate('/login')}
            icon={Home}
            iconPosition="left"
            className="min-h-[48px]"
          >
            На главную
          </TouchButton>
        </div>

        {/* Логотип внизу */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <Link
            to="/login"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-8 h-8 border border-muted-foreground/30 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-accent" />
            </div>
            <span className="font-serif text-lg tracking-wide">FreshTrack</span>
          </Link>
        </div>
      </div>
    )
  }

  // Внутренняя версия — встроена в Layout
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <div className="text-center max-w-lg mx-auto">
        {/* 404 */}
        <h1
          className="text-[80px] sm:text-[100px] font-bold leading-none mb-4"
          style={{
            color: '#e8653a',
            textShadow: '0 4px 16px rgba(232, 101, 58, 0.25)'
          }}
        >
          404
        </h1>

        {/* Заголовок */}
        <h2 className="text-xl sm:text-2xl font-serif text-foreground mb-3">
          Страница не найдена
        </h2>

        {/* Описание */}
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Такой страницы в системе нет. Возможно, ссылка устарела или набрана с ошибкой.
        </p>

        {/* Кнопки */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <TouchButton
            variant="primary"
            size="large"
            onClick={() => navigate('/')}
            icon={Home}
            iconPosition="left"
            className="min-h-[48px] w-full sm:w-auto"
          >
            На главную
          </TouchButton>

          <TouchButton
            variant="outline"
            size="large"
            onClick={() => navigate(-1)}
            icon={ArrowLeft}
            iconPosition="left"
            className="min-h-[48px] w-full sm:w-auto"
          >
            Назад
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
