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
    if (!isAuthenticated) {
      setHotels([])
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
          // Для HOTEL_ADMIN - автоматически их отель
          if (!isSuperAdmin && user?.hotel_id) {
            setSelectedHotelId(user.hotel_id)
          } else {
            // Для SUPER_ADMIN - первый из списка или сохранённый
            const saved = localStorage.getItem('freshtrack_selected_hotel')
            const savedId = saved ? parseInt(saved) : null
            const validSaved = savedId && response.hotels.some(h => h.id === savedId)
            setSelectedHotelId(validSaved ? savedId : response.hotels[0].id)
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
  }, [isAuthenticated, isSuperAdmin, user?.hotel_id])

  // Загружаем отели при авторизации
  useEffect(() => {
    fetchHotels()
  }, [fetchHotels])

  // Смена отеля (только для SUPER_ADMIN)
  const selectHotel = useCallback((hotelId) => {
    if (!isSuperAdmin) return // HOTEL_ADMIN не может менять отель
    
    const numId = typeof hotelId === 'string' ? parseInt(hotelId) : hotelId
    if (hotels.some(h => h.id === numId)) {
      setSelectedHotelId(numId)
      localStorage.setItem('freshtrack_selected_hotel', String(numId))
    }
  }, [isSuperAdmin, hotels])

  // Получить текущий выбранный отель
  const selectedHotel = hotels.find(h => h.id === selectedHotelId) || null

  // Может ли пользователь выбирать отель
  const canSelectHotel = isSuperAdmin && hotels.length > 1

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
    loading,
    error,
    refreshHotels,
    isSuperAdmin
  }

  return (
    <HotelContext.Provider value={value}>
      {children}
    </HotelContext.Provider>
  )
}

export function useHotel() {
  const context = useContext(HotelContext)
  if (!context) {
    throw new Error('useHotel must be used within a HotelProvider')
  }
  return context
}
