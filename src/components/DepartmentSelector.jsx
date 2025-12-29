/**
 * DepartmentSelector - Компонент выбора отдела
 * Показывает карточки отделов для выбора
 */

import { Wine, Coffee, Utensils, ChefHat, Warehouse, Package, Users } from 'lucide-react'
import { useTranslation, useLanguage } from '../context/LanguageContext'

// Иконки для отделов
const ICON_MAP = {
  Wine,
  Coffee,
  Utensils,
  ChefHat,
  Warehouse,
  Package,
  Users
}

// Получить иконку по имени или типу
const getDeptIcon = (dept) => {
  if (dept?.icon && ICON_MAP[dept.icon]) return ICON_MAP[dept.icon]
  const name = (dept?.name || dept?.code || '').toLowerCase()
  if (name.includes('bar') || name.includes('бар')) return Wine
  if (name.includes('kitchen') || name.includes('кухня')) return ChefHat
  if (name.includes('restaurant') || name.includes('ресторан')) return Utensils
  if (name.includes('storage') || name.includes('склад')) return Warehouse
  if (name.includes('cafe') || name.includes('кафе')) return Coffee
  return Package
}

export default function DepartmentSelector({ 
  departments, 
  selectedDepartment, 
  onSelect,
  title,
  showStats = false,
  stats = {}
}) {
  const { t } = useTranslation()
  const { language } = useLanguage()

  // Получить название отдела в зависимости от языка
  const getDeptName = (dept) => {
    if (language === 'ru') return dept.name || dept.name_en
    if (language === 'kk') return dept.name_kk || dept.name || dept.name_en
    return dept.name_en || dept.name
  }

  if (!departments || departments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="w-16 h-16 text-text-muted mb-4" />
        <h3 className="text-lg font-medium text-text-secondary mb-2">
          {t('departments.noDepartments') || 'Нет отделов'}
        </h3>
        <p className="text-text-muted">
          {t('departments.createFirst') || 'Создайте отделы в настройках'}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {title && (
        <h2 className="text-xl font-semibold text-text-primary mb-6">
          {title}
        </h2>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const Icon = getDeptIcon(dept)
          const isSelected = selectedDepartment === dept.id
          const deptStats = stats[dept.id] || {}
          
          return (
            <button
              key={dept.id}
              onClick={() => onSelect(dept.id)}
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-200
                text-left group hover:shadow-lg
                ${isSelected 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border-primary bg-surface-primary hover:border-primary/50'
                }
              `}
              style={{
                '--dept-color': dept.color || '#FF8D6B'
              }}
            >
              {/* Иконка */}
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ 
                  backgroundColor: `${dept.color || '#FF8D6B'}20`,
                  color: dept.color || '#FF8D6B'
                }}
              >
                <Icon className="w-6 h-6" />
              </div>
              
              {/* Название */}
              <h3 className="font-semibold text-text-primary mb-1">
                {getDeptName(dept)}
              </h3>
              
              {/* Тип отдела */}
              <p className="text-sm text-text-muted capitalize">
                {dept.type || 'other'}
              </p>
              
              {/* Статистика (опционально) */}
              {showStats && (
                <div className="mt-4 pt-4 border-t border-border-secondary flex items-center gap-4 text-sm">
                  {deptStats.totalProducts !== undefined && (
                    <span className="text-text-secondary">
                      <span className="font-medium">{deptStats.totalProducts}</span> товаров
                    </span>
                  )}
                  {deptStats.expiringCount !== undefined && deptStats.expiringCount > 0 && (
                    <span className="text-warning">
                      <span className="font-medium">{deptStats.expiringCount}</span> истекает
                    </span>
                  )}
                </div>
              )}
              
              {/* Индикатор выбора */}
              {isSelected && (
                <div 
                  className="absolute top-3 right-3 w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color || '#FF8D6B' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
