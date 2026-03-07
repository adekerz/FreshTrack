import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useHotel } from './HotelContext'
import { useAuth } from './AuthContext'
import { useDepartmentsQuery } from '../hooks/useDepartmentsQuery'
import { getDepartmentIconComponent } from '../utils/departmentClassifications'

const DepartmentContext = createContext(null)

export function DepartmentProvider({ children }) {
  const { selectedHotelId } = useHotel()
  const { user } = useAuth()

  // Загружаем отделы напрямую здесь
  const { data: allDepartments = [], isLoading: loading } =
    useDepartmentsQuery(selectedHotelId)

  // Для не-администраторов показываем только их собственный отдел
  const isAdminRole =
    user?.role === 'SUPER_ADMIN' || user?.role === 'HOTEL_ADMIN'
  const departments = useMemo(() => {
    if (isAdminRole) return allDepartments
    if (!user?.department_id) return allDepartments
    const own = allDepartments.filter((d) => d.id === user.department_id)
    return own.length > 0 ? own : allDepartments
  }, [allDepartments, isAdminRole, user?.department_id])

  const [selectedDepartmentId, setSelectedDepartmentId] = useState(null)
  const prevHotelIdRef = useRef(selectedHotelId)

  // Helper для иконок
  const getDepartmentIcon = useCallback(
    (deptOrId) => {
      const dept =
        typeof deptOrId === 'object' && deptOrId !== null
          ? deptOrId
          : departments.find((d) => d.id === deptOrId || d.code === deptOrId)
      return getDepartmentIconComponent(dept)
    },
    [departments]
  )

  // Сброс при смене отеля
  useEffect(() => {
    if (
      prevHotelIdRef.current !== selectedHotelId &&
      prevHotelIdRef.current !== null
    ) {
      setSelectedDepartmentId(null)
    }
    prevHotelIdRef.current = selectedHotelId
  }, [selectedHotelId])

  // Автовыбор первого отдела когда отделы загружены и ничего не выбрано
  useEffect(() => {
    if (!selectedDepartmentId && departments.length > 0) {
      setSelectedDepartmentId(departments[0].id)
    }
  }, [departments, selectedDepartmentId])

  // Если текущий выбранный отдел удалён — сбрасываем на первый
  useEffect(() => {
    if (
      selectedDepartmentId &&
      departments.length > 0 &&
      !departments.some((d) => d.id === selectedDepartmentId)
    ) {
      setSelectedDepartmentId(departments[0].id)
    }
  }, [departments, selectedDepartmentId])

  // Выбрать отдел
  const selectDepartment = useCallback((deptId) => {
    setSelectedDepartmentId(deptId)
  }, [])

  // Текущий объект отдела
  const selectedDepartment = useMemo(
    () =>
      departments.find(
        (d) => d.id === selectedDepartmentId || d.code === selectedDepartmentId
      ) || null,
    [departments, selectedDepartmentId]
  )

  // Показывать ли селектор (только для администраторов с несколькими отделами)
  const showDepartmentSelector = isAdminRole && departments.length > 1

  const value = useMemo(
    () => ({
      // Данные
      departments,
      selectedDepartmentId,
      selectedDepartment,
      loading,

      // Действия
      selectDepartment,

      // UI helpers
      showDepartmentSelector,
      getDepartmentIcon,
    }),
    [
      departments,
      selectedDepartmentId,
      selectedDepartment,
      loading,
      selectDepartment,
      showDepartmentSelector,
      getDepartmentIcon,
    ]
  )

  return (
    <DepartmentContext.Provider value={value}>
      {children}
    </DepartmentContext.Provider>
  )
}

export function useDepartment() {
  const context = useContext(DepartmentContext)
  if (!context) {
    throw new Error('useDepartment must be used within a DepartmentProvider')
  }
  return context
}
