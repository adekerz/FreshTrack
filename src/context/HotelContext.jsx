/**
 * HotelContext - Контекст для выбора отеля
 * SUPER_ADMIN может переключаться между отелями
 * HOTEL_ADMIN видит только свой отель
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { apiFetch } from '../services/api'

const HotelContext = createContext(null)

export function HotelProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [hotels, setHotels] = useState([])
  const [selectedHotelId, setSelectedHotelId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Загружаем список отелей
  const fetchHotels = useCallback(async () => {
    // Не загружаем для неавторизованных или pending пользователей
    // Pending проверяем по status или отсутствию hotel_id (для не-SUPER_ADMIN)
    const isPending =
      user?.status === 'pending' || (!user?.hotel_id && user?.role !== 'SUPER_ADMIN')
    if (!isAuthenticated || isPending) {
      setHotels([])
      setSelectedHotelId(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await apiFetch('/hotels')

      if (response.success) {
        setHotels(response.hotels || [])

        // Устанавливаем выбранный отель
        if (response.hotels?.length > 0) {
          // Для НЕ-SUPER_ADMIN - автоматически их отель (без вариантов)
          if (!isSuperAdmin) {
            // Очищаем сохранённый hotel от предыдущего пользователя
            localStorage.removeItem('freshtrack_selected_hotel')
            // Используем hotel_id пользователя
            if (user?.hotel_id) {
              setSelectedHotelId(user.hotel_id)
            } else {
              // Fallback на первый отель (не должно случаться для HOTEL_ADMIN)
              setSelectedHotelId(response.hotels[0].id)
            }
          } else {
            // Для SUPER_ADMIN - сохранённый или первый из списка
            const savedId = localStorage.getItem('freshtrack_selected_hotel')
            const validSaved = savedId && response.hotels.some((h) => h.id === savedId)
            const hotelToSelect = validSaved ? savedId : response.hotels[0].id
            setSelectedHotelId(hotelToSelect)
            // Сохраняем в localStorage для API вызовов
            localStorage.setItem('freshtrack_selected_hotel', hotelToSelect)
          }
        }
      } else {
        setError(response.error || 'Ошибка загрузки отелей')
      }
    } catch (err) {
      setError(err.message || 'Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isSuperAdmin, user?.hotel_id, user?.status])

  // Загружаем отели при авторизации
  useEffect(() => {
    fetchHotels()
  }, [fetchHotels])

  // Смена отеля (только для SUPER_ADMIN)
  const selectHotel = useCallback(
    (hotelId) => {
      if (!isSuperAdmin) return // HOTEL_ADMIN не может менять отель

      // UUID — всегда строки, не конвертируем в число
      const id = String(hotelId)
      if (hotels.some((h) => h.id === id)) {
        setSelectedHotelId(id)
        localStorage.setItem('freshtrack_selected_hotel', id)
      }
    },
    [isSuperAdmin, hotels]
  )

  // Получить текущий выбранный отель
  const selectedHotel = hotels.find((h) => h.id === selectedHotelId) || null

  // Может ли пользователь выбирать отель (для выпадающего списка)
  const canSelectHotel = isSuperAdmin && hotels.length > 1

  // Показывать ли селектор отеля вообще (для SUPER_ADMIN всегда, если есть отели)
  const showHotelSelector = isSuperAdmin && hotels.length > 0

  // Обновить список отелей (после создания/редактирования)
  const refreshHotels = useCallback(() => {
    fetchHotels()
  }, [fetchHotels])

  const value = {
    hotels,
    selectedHotelId,
    selectedHotel,
    selectHotel,
    canSelectHotel,
    showHotelSelector,
    loading,
    error,
    refreshHotels,
    isSuperAdmin
  }

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>
}

export function useHotel() {
  const context = useContext(HotelContext)
  if (!context) {
    throw new Error('useHotel must be used within a HotelProvider')
  }
  return context
}
