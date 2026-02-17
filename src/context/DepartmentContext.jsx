import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useHotel } from './HotelContext'
import { useDepartmentsQuery } from '../hooks/useDepartmentsQuery'
import { getDepartmentIconComponent } from '../utils/departmentClassifications'

const DepartmentContext = createContext(null)

export function DepartmentProvider({ children }) {
    const { selectedHotelId } = useHotel()

    // Загружаем отделы напрямую здесь
    const { data: departments = [], isLoading: loading } = useDepartmentsQuery(selectedHotelId)

    const [selectedDepartmentId, setSelectedDepartmentId] = useState(null)
    const prevHotelIdRef = useRef(selectedHotelId)

    // Helper для иконок
    const getDepartmentIcon = useCallback((deptOrId) => {
        const dept =
            typeof deptOrId === 'object' && deptOrId !== null
                ? deptOrId
                : departments.find((d) => d.id === deptOrId || d.code === deptOrId)
        return getDepartmentIconComponent(dept)
    }, [departments])

    // Сброс при смене отеля
    useEffect(() => {
        if (prevHotelIdRef.current !== selectedHotelId && prevHotelIdRef.current !== null) {
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
        () => departments.find((d) => d.id === selectedDepartmentId || d.code === selectedDepartmentId) || null,
        [departments, selectedDepartmentId]
    )

    // Показывать ли селектор (больше 1 отдела)
    const showDepartmentSelector = departments.length > 1

    const value = useMemo(() => ({
        // Данные
        departments,
        selectedDepartmentId,
        selectedDepartment,
        loading,

        // Действия
        selectDepartment,

        // UI helpers
        showDepartmentSelector,
        getDepartmentIcon
    }), [
        departments, selectedDepartmentId, selectedDepartment, loading,
        selectDepartment, showDepartmentSelector, getDepartmentIcon
    ])

    return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>
}

export function useDepartment() {
    const context = useContext(DepartmentContext)
    if (!context) {
        throw new Error('useDepartment must be used within a DepartmentProvider')
    }
    return context
}
