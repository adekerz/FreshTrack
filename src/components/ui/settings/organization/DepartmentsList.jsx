/**
 * DepartmentsList - Список департаментов внутри отеля
 */

import { Plus, ChevronDown, ChevronRight, UserPlus, Trash2 } from 'lucide-react'

export default function DepartmentsList({
  departments,
  hotelId,
  expandedDepts,
  onToggleDept,
  onAddDepartment,
  onAddUser,
  onDeleteDepartment,
  renderUserRow
}) {
  if (departments?.length === 0) {
    return (
      <div className="p-4 bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-muted-foreground">Департаменты</h4>
          <button
            onClick={() => onAddDepartment(hotelId)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
          >
            <Plus className="w-3 h-3" />
            Добавить
          </button>
        </div>
        <p className="text-sm text-muted-foreground py-4 text-center">Нет департаментов</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-muted/20">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-muted-foreground">Департаменты</h4>
        <button
          onClick={() => onAddDepartment(hotelId)}
          className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
        >
          <Plus className="w-3 h-3" />
          Добавить
        </button>
      </div>
      <div className="space-y-3">
        {departments.map((dept) => (
          <div key={dept.id} className="bg-card rounded-lg border border-border overflow-hidden">
            <div
              className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onToggleDept(dept.id)}
            >
              {/* Chevron */}
              <div className="flex-shrink-0">
                {expandedDepts[dept.id] ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </div>

              {/* Название + счётчик — растягивается */}
              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-foreground font-medium truncate">{dept.name}</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-accent flex-shrink-0">
                  {dept.code}
                </code>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  • {dept.users?.length || 0} польз.
                </span>
              </div>

              {/* Кнопки — не сжимаются */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddUser(hotelId, dept.id)
                  }}
                  className="p-1.5 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded transition-colors"
                  title="Добавить пользователя"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteDepartment(dept.id, dept.name, hotelId)
                  }}
                  className="p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded transition-colors"
                  title="Удалить департамент"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {expandedDepts[dept.id] && (
              <div className="border-t border-border p-3 bg-muted/10 space-y-2">
                {dept.users?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">Нет пользователей</p>
                ) : (
                  dept.users?.map((user) => renderUserRow(user))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
