import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Store, X, Command } from 'lucide-react'
import { useProducts, departments, categories } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function GlobalSearch() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { getProductsByDepartment } = useProducts()
  const { hasAccessToDepartment, getAccessibleDepartments } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ products: [], departments: [] })
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Горячие клавиши Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Поиск при изменении запроса
  useEffect(() => {
    if (!query.trim()) {
      setResults({ products: [], departments: [] })
      return
    }

    const searchQuery = query.toLowerCase()
    const accessibleDepts = getAccessibleDepartments()

    // Поиск по товарам
    const productResults = []

    for (const deptId of accessibleDepts) {
      if (!hasAccessToDepartment(deptId)) continue

      const deptProducts = getProductsByDepartment(deptId)
      for (const product of deptProducts) {
        const productName = product.name.toLowerCase()
        const categoryName = getCategoryName(product.categoryId).toLowerCase()
        const deptName = getDepartmentName(deptId).toLowerCase()

        if (
          productName.includes(searchQuery) ||
          categoryName.includes(searchQuery) ||
          deptName.includes(searchQuery)
        ) {
          productResults.push({
            ...product,
            departmentId: deptId,
            departmentName: getDepartmentName(deptId),
            categoryName: getCategoryName(product.categoryId)
          })
        }
      }
    }

    // Поиск по отделам
    const departmentResults = departments
      .filter((dept) => hasAccessToDepartment(dept.id))
      .filter((dept) => dept.name.toLowerCase().includes(searchQuery))
      .map((dept) => {
        const products = getProductsByDepartment(dept.id)
        return {
          ...dept,
          productCount: products.length
        }
      })

    setResults({
      products: productResults.slice(0, 10),
      departments: departmentResults
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Получить название категории
  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId)
    if (!category) return ''
    if (language === 'ru') return category.nameRu
    if (language === 'kk') return category.nameKz
    return category.name
  }

  // Получить название отдела
  const getDepartmentName = (deptId) => {
    const dept = departments.find((d) => d.id === deptId)
    return dept?.name || deptId
  }

  // Подсветка совпадений
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-warning/30 text-charcoal px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  // Переход к товару
  const handleProductClick = (product) => {
    navigate(`/inventory/${product.departmentId}`)
    setIsOpen(false)
    setQuery('')
  }

  // Переход к отделу
  const handleDepartmentClick = (dept) => {
    navigate(`/inventory/${dept.id}`)
    setIsOpen(false)
    setQuery('')
  }

  const hasResults = results.products.length > 0 || results.departments.length > 0

  return (
    <div className="relative" ref={containerRef}>
      {/* Поле поиска */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer',
          isOpen
            ? 'bg-white border-accent shadow-md w-80'
            : 'bg-sand/50 border-transparent hover:bg-sand w-48'
        )}
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
      >
        <Search className="w-4 h-4 text-warmgray flex-shrink-0" />

        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-charcoal placeholder:text-warmgray"
            placeholder={t('search.placeholder')}
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-warmgray truncate">{t('search.placeholder')}</span>
        )}

        {isOpen && query && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setQuery('')
            }}
            className="p-0.5 hover:bg-sand rounded"
          >
            <X className="w-3 h-3 text-warmgray" />
          </button>
        )}

        {!isOpen && (
          <div className="flex items-center gap-0.5 text-xs text-warmgray">
            <Command className="w-3 h-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Dropdown с результатами */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-sand overflow-hidden z-50',
            'animate-fade-in'
          )}
        >
          {!query.trim() ? (
            <div className="p-4 text-center text-warmgray text-sm">{t('search.hint')}</div>
          ) : !hasResults ? (
            <div className="p-4 text-center text-warmgray text-sm">{t('search.noResults')}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {/* Товары */}
              {results.products.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-warmgray">
                    {t('search.products')}
                  </div>
                  {results.products.map((product, index) => (
                    <button
                      key={`${product.id}-${product.departmentId}-${index}`}
                      onClick={() => handleProductClick(product)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sand/50 transition-colors text-left"
                    >
                      <Package className="w-4 h-4 text-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-charcoal truncate">
                          {highlightMatch(product.name, query)}
                        </p>
                        <p className="text-xs text-warmgray truncate">
                          {highlightMatch(product.departmentName, query)} •{' '}
                          {highlightMatch(product.categoryName, query)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Разделитель */}
              {results.products.length > 0 && results.departments.length > 0 && (
                <div className="h-px bg-sand mx-2" />
              )}

              {/* Отделы */}
              {results.departments.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-warmgray">
                    {t('search.departments')}
                  </div>
                  {results.departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleDepartmentClick(dept)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sand/50 transition-colors text-left"
                    >
                      <Store className="w-4 h-4 flex-shrink-0" style={{ color: dept.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-charcoal">{highlightMatch(dept.name, query)}</p>
                        <p className="text-xs text-warmgray">
                          {dept.productCount} {t('search.productsCount')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
