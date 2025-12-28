import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Store, X } from 'lucide-react'
import { useProducts, departments, categories } from '../context/ProductContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation, useLanguage } from '../context/LanguageContext'
import { cn } from '../utils/classNames'

export default function GlobalSearch({ onSearch, autoFocus = false, fullWidth = false }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { batches, getProductsByDepartment } = useProducts()
  const { hasAccessToDepartment } = useAuth()

  const [isOpen, setIsOpen] = useState(autoFocus)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ products: [], departments: [] })
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Автофокус при открытии
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

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

    // Поиск по партиям (batches) - это реальные данные
    const productResults = []
    const seenProducts = new Set() // Чтобы избежать дубликатов

    batches.forEach(batch => {
      const deptId = batch.departmentId || batch.department
      if (!deptId || !hasAccessToDepartment(deptId)) return
      
      const productName = (batch.productName || batch.product_name || '').toLowerCase()
      const deptName = getDepartmentName(deptId).toLowerCase()
      
      // Уникальный ключ для товара
      const productKey = `${productName}-${deptId}`
      if (seenProducts.has(productKey)) return
      
      if (productName.includes(searchQuery) || deptName.includes(searchQuery)) {
        seenProducts.add(productKey)
        productResults.push({
          id: batch.productId || batch.product_id || batch.id,
          name: batch.productName || batch.product_name,
          departmentId: deptId,
          departmentName: getDepartmentName(deptId),
          categoryId: batch.categoryId || batch.category_id,
          categoryName: getCategoryName(batch.categoryId || batch.category_id)
        })
      }
    })

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
  }, [query, batches])

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
        <mark key={i} className="bg-warning/30 text-foreground px-0.5 rounded">
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
    onSearch?.()
  }

  // Переход к отделу
  const handleDepartmentClick = (dept) => {
    navigate(`/inventory/${dept.id}`)
    setIsOpen(false)
    setQuery('')
    onSearch?.()
  }

  const hasResults = results.products.length > 0 || results.departments.length > 0

  return (
    <div className={cn("relative", fullWidth && "w-full")} ref={containerRef}>
      {/* Поле поиска */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all cursor-pointer',
          fullWidth 
            ? 'bg-card border-border w-full'
            : isOpen
              ? 'bg-card border-accent shadow-md w-80'
              : 'bg-muted border-transparent hover:bg-muted w-48'
        )}
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 100)
        }}
      >
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        {(isOpen || fullWidth) ? (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            placeholder={t('search.placeholder')}
            autoFocus={autoFocus || isOpen}
          />
        ) : (
          <span className="flex-1 text-sm text-muted-foreground truncate">{t('search.placeholder')}</span>
        )}

        {(isOpen || fullWidth) && query && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setQuery('')
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown с результатами */}
      {(isOpen || fullWidth) && query.trim() && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-lg border border-border overflow-hidden z-50',
            'animate-fade-in'
          )}
        >
          {!hasResults ? (
            <div className="p-4 text-center text-muted-foreground text-sm">{t('search.noResults')}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {/* Товары */}
              {results.products.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {t('search.products')}
                  </div>
                  {results.products.map((product, index) => (
                    <button
                      key={`${product.id}-${product.departmentId}-${index}`}
                      onClick={() => handleProductClick(product)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <Package className="w-4 h-4 text-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {highlightMatch(product.name, query)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
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
                <div className="h-px bg-border mx-2" />
              )}

              {/* Отделы */}
              {results.departments.length > 0 && (
                <div className="p-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {t('search.departments')}
                  </div>
                  {results.departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleDepartmentClick(dept)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <Store className="w-4 h-4 flex-shrink-0" style={{ color: dept.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{highlightMatch(dept.name, query)}</p>
                        <p className="text-xs text-muted-foreground">
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
