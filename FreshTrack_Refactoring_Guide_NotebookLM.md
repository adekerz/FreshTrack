# FreshTrack: Полное руководство по рефакторингу архитектуры

## Оглавление

1. [Архитектурное решение](#архитектурное-решение)
2. [Фаза 0: Подготовка](#фаза-0-подготовка)
3. [Фаза 1: Система разрешений](#фаза-1-система-разрешений)
4. [Фаза 2: Контекст владения данными](#фаза-2-контекст-владения-данными)
5. [Фаза 3: Backend как источник логики](#фаза-3-backend-как-источник-логики)
6. [Фаза 4: Централизованный аудит](#фаза-4-централизованный-аудит)
7. [Фаза 5: Notification Engine](#фаза-5-notification-engine)
8. [Фаза 6: Унификация данных](#фаза-6-унификация-данных)
9. [Фаза 7: Настройки как правила](#фаза-7-настройки-как-правила)
10. [Фаза 8: Рефакторинг логики сбора](#фаза-8-рефакторинг-логики-сбора)
11. [Checklist для проверки](#checklist-для-проверки)
12. [Следующие шаги](#следующие-шаги)

---

## Архитектурное решение

### Фундаментальная проблема

FreshTrack страдает от отсутствия единой модели владения данными. Система не понимает кому принадлежат данные, кто имеет право их видеть и изменять, откуда приходят расчёты статусов. Это порождает все описанные баги как следствие, а не как независимые проблемы.

**Корневая причина:** backend не является единственным источником истины, а frontend дублирует бизнес-логику.

### 1. Иерархия владения данными

Каждая сущность в системе должна иметь обязательный контекст владения:

```
Organization (неявно, один для всей системы)
  └─ Hotel (может быть несколько)
      └─ Department (может быть несколько на отель)
          └─ User (привязан к одному отелю + одному или нескольким департаментам)
              └─ Данные (инвентарь, партии, история, уведомления)
```

**Текущая проблема в коде:**
- `backend/src/models/User.ts` имеет `hotelId`
- `backend/src/models/Department.ts` имеет `hotelId`
- НО связи User → Department нет
- `backend/src/models/Product.ts` НЕ имеет ни `hotelId`, ни `departmentId`
- `backend/src/models/Batch.ts` имеет `userId`, но не `departmentId`

**Решение:**
Каждая таблица получает поля:
- `hotelId` (обязательное, indexed)
- `departmentId` (обязательное для операционных данных, indexed)

**Последствия:**
- Все запросы автоматически фильтруются по контексту пользователя
- Календарь показывает только данные департамента
- Статистика считается корректно по своим данным
- Категории не превращаются в "другое"

### 2. Система разрешений вместо ролей

**Текущая проблема:**
```typescript
// backend/src/middleware/auth.ts
export const requireRole = (roles: UserRole[]) => {
  // Проверка if (roles.includes(user.role))
}
```

Это объясняет почему HOTEL_ADMIN = SUPER_ADMIN но функции не работают.

**Решение:**
Разрешения описывают **что можно делать**, а не **кто ты такой**.

```
Permission = Resource + Action + Scope
  Resource: inventory | users | settings | reports | batches
  Action: read | create | update | delete | export
  Scope: own | department | hotel | all
```

**Примеры:**
- `inventory:read:department` - читать инвентарь своего департамента
- `users:create:hotel` - создавать пользователей в рамках отеля
- `settings:update:all` - менять глобальные настройки

**Роли становятся наборами разрешений:**
- `SUPER_ADMIN`: все разрешения со scope=all
- `HOTEL_ADMIN`: все разрешения со scope=hotel (ограничен своим hotelId)
- `DEPARTMENT_MANAGER`: управление инвентарем, пользователями, статистикой со scope=department
- `USER`: только чтение и базовые операции со scope=own или department (read-only)

### 3. Backend как единственный источник бизнес-логики

**Текущая проблема:**
Изучая `frontend/src/`, вижу что статусы сроков годности, цветовые индикаторы, критичность, агрегация статистики считаются на фронтенде.

**Решение:**
Backend возвращает готовые к отображению данные, frontend только рендерит.

Для продукта/партии backend возвращает:
```typescript
{
  id: string
  name: string
  expiryDate: string
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'EXPIRED'
  daysUntilExpiry: number
  color: 'green' | 'yellow' | 'red' | 'gray'
  category: { id, name, color }
  department: { id, name }
  hotel: { id, name }
}
```

Для статистики backend возвращает:
```typescript
{
  byCategory: [{ categoryName, categoryColor, count, value }]
  byStatus: [{ status, count, percentage }]
  trends: [{ date, expired, warning, ok }]
  departmentId: string
  dateRange: { from, to }
}
```

### 4. Централизованная система аудита

Единый механизм логирования через middleware или сервис:

Каждое действие записывается с:
- Кто (userId)
- Что (action: create | update | delete | login | export)
- Где (entityType: user | product | batch | settings)
- Какой объект (entityId)
- Полный snapshot данных ДО и ПОСЛЕ
- Контекст (hotelId, departmentId, IP, timestamp)

### 5. Унифицированная система уведомлений

**Notification Engine состоит из:**

**Правила уведомлений (настраиваемые):**
- За сколько дней до истечения отправлять WARNING (по умолчанию 7)
- За сколько дней до истечения отправлять CRITICAL (по умолчанию 3)
- Какие каналы использовать (app, telegram, email)
- Кому отправлять (роли, конкретные пользователи)

**Движок уведомлений:**
- Background job проверяет партии каждый час
- Рассчитывает статус на основе правил
- Создаёт notification record в БД
- Ставит в очередь для отправки
- Отправляет через нужный канал
- Логирует результат (success/failure)
- Retry при ошибке (3 попытки с exponential backoff)

### 6. Приоритизация изменений

**Критичные (блокируют безопасность):**
1. Система разрешений
2. Блокировка пользователей
3. Контекст владения для User

**Важные (влияют на корректность данных):**
1. Контекст владения для Product/Batch
2. Backend-логика статусов
3. Централизованный аудит

**Необходимые (для полноты функционала):**
1. Notification Engine
2. Унифицированные фильтры
3. Настройки как правила

### 7. Эффект от внедрения

**Исчезнут автоматически:**
- Календарь показывает неправильные цвета → backend даёт готовый цвет
- Статистика "другое" вместо категории → backend резолвит категорию по ID
- История сборов "-" → backend берёт из snapshot
- HOTEL_ADMIN = SUPER_ADMIN → проверка permissions с учётом scope
- Блокировка не работает → permission check перед действием
- Telegram не отправляет → централизованный движок с retry

**Станут тривиальными:**
- Добавление роли Department Manager → просто новый набор permissions
- Выбор департамента в календаре → стандартный фильтр
- Экспорт везде → единая функция export с фильтрами
- Настройка правил уведомлений → изменение записи в settings

---

## Фаза 0: Подготовка

### Цель
Обезопасить процесс рефакторинга, создать точки отката, зафиксировать текущее состояние.

### Задачи

#### 0.1 Backup и версионирование
```bash
# Создать полный backup базы данных
pg_dump freshtrack_db > backup_$(date +%Y%m%d).sql

# Создать git tag текущего состояния
git tag -a v1.0-before-refactor -m "State before architecture refactor"
git push origin v1.0-before-refactor

# Создать ветку для рефакторинга
git checkout -b refactor/architecture-v2
```

#### 0.2 Документация текущего состояния
Создать файл `CURRENT_STATE.md`:
```markdown
# Текущее состояние FreshTrack

## Модели данных
- User: имеет hotelId, НЕ имеет departmentId
- Department: имеет hotelId
- Product: НЕ имеет hotelId, НЕ имеет departmentId
- Batch: имеет userId, НЕ имеет departmentId
- ActivityLog: существует, но неполный

## Роли
- SUPER_ADMIN
- HOTEL_ADMIN (проблема: права = SUPER_ADMIN)
- USER

## Критичные endpoints
- POST /api/users (создание пользователя)
- POST /api/products (создание товара)
- POST /api/batches (создание партии)
- GET /api/inventory (список инвентаря)
- GET /api/statistics (статистика)
```

#### 0.3 Создание тестового окружения
```bash
# Клонировать production БД в test БД
createdb freshtrack_test
pg_dump freshtrack_db | psql freshtrack_test

# Обновить .env.test
DATABASE_URL=postgresql://user:pass@localhost:5432/freshtrack_test
NODE_ENV=test
```

#### 0.4 Настройка миграций
```bash
# Установить миграционный инструмент если нет
npm install --save-dev db-migrate db-migrate-pg

# Инициализировать систему миграций
npx db-migrate init
```

### Критерии завершения фазы 0
- [ ] Backup базы данных создан и проверен
- [ ] Git tag создан
- [ ] Тестовая база развернута
- [ ] Система миграций настроена
- [ ] Документация текущего состояния написана

---

## Фаза 1: Система разрешений

### Цель
Заменить проверку ролей на проверку разрешений (permissions). Решает проблему HOTEL_ADMIN = SUPER_ADMIN.

### Задачи

#### 1.1 Создать модель Permission
Файл: `backend/src/models/Permission.ts`
```typescript
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export enum PermissionResource {
  INVENTORY = 'inventory',
  PRODUCTS = 'products',
  BATCHES = 'batches',
  USERS = 'users',
  SETTINGS = 'settings',
  REPORTS = 'reports',
  DEPARTMENTS = 'departments',
  HOTELS = 'hotels'
}

export enum PermissionAction {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  MANAGE = 'manage'
}

export enum PermissionScope {
  OWN = 'own',           // Только свои записи
  DEPARTMENT = 'department', // В рамках департамента
  HOTEL = 'hotel',       // В рамках отеля
  ALL = 'all'            // Без ограничений
}

export interface PermissionAttributes {
  id: string;
  resource: PermissionResource;
  action: PermissionAction;
  scope: PermissionScope;
  description?: string;
}

class Permission extends Model<PermissionAttributes> implements PermissionAttributes {
  public id!: string;
  public resource!: PermissionResource;
  public action!: PermissionAction;
  public scope!: PermissionScope;
  public description?: string;
}

Permission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    resource: {
      type: DataTypes.ENUM(...Object.values(PermissionResource)),
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM(...Object.values(PermissionAction)),
      allowNull: false,
    },
    scope: {
      type: DataTypes.ENUM(...Object.values(PermissionScope)),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'permissions',
    indexes: [
      {
        unique: true,
        fields: ['resource', 'action', 'scope']
      }
    ]
  }
);

export default Permission;
```

#### 1.2 Создать связующую таблицу RolePermission
Файл: `backend/src/models/RolePermission.ts`
```typescript
import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { UserRole } from './User';

export interface RolePermissionAttributes {
  id: string;
  role: UserRole;
  permissionId: string;
}

class RolePermission extends Model<RolePermissionAttributes> implements RolePermissionAttributes {
  public id!: string;
  public role!: UserRole;
  public permissionId!: string;
}

RolePermission.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    role: {
      type: DataTypes.ENUM('SUPER_ADMIN', 'HOTEL_ADMIN', 'DEPARTMENT_MANAGER', 'USER'),
      allowNull: false,
    },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'permissions',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'role_permissions',
    indexes: [
      {
        unique: true,
        fields: ['role', 'permissionId']
      }
    ]
  }
);

export default RolePermission;
```

#### 1.3 Создать сервис проверки разрешений
Файл: `backend/src/services/permissionService.ts`
```typescript
import Permission, { PermissionResource, PermissionAction, PermissionScope } from '../models/Permission';
import RolePermission from '../models/RolePermission';
import User from '../models/User';

export interface PermissionCheckContext {
  user: User;
  targetHotelId?: string;
  targetDepartmentId?: string;
  targetUserId?: string;
}

export class PermissionService {
  /**
   * Проверить имеет ли пользователь разрешение
   */
  static async hasPermission(
    context: PermissionCheckContext,
    resource: PermissionResource,
    action: PermissionAction
  ): Promise<boolean> {
    const { user, targetHotelId, targetDepartmentId, targetUserId } = context;

    // Получить все permissions для роли пользователя
    const rolePermissions = await RolePermission.findAll({
      where: { role: user.role },
      include: [{ model: Permission }],
    });

    // Найти подходящие permissions
    for (const rp of rolePermissions) {
      const permission = rp.permission;
      
      if (permission.resource !== resource || permission.action !== action) {
        continue;
      }

      // Проверить scope
      const hasScope = await this.checkScope(user, permission.scope, {
        targetHotelId,
        targetDepartmentId,
        targetUserId,
      });

      if (hasScope) {
        return true;
      }
    }

    return false;
  }

  /**
   * Проверить соответствует ли scope
   */
  private static async checkScope(
    user: User,
    scope: PermissionScope,
    target: {
      targetHotelId?: string;
      targetDepartmentId?: string;
      targetUserId?: string;
    }
  ): Promise<boolean> {
    switch (scope) {
      case PermissionScope.ALL:
        return true;

      case PermissionScope.HOTEL:
        if (!target.targetHotelId) return true;
        return user.hotelId === target.targetHotelId;

      case PermissionScope.DEPARTMENT:
        if (!target.targetDepartmentId) return true;
        return user.departmentId === target.targetDepartmentId;

      case PermissionScope.OWN:
        if (!target.targetUserId) return true;
        return user.id === target.targetUserId;

      default:
        return false;
    }
  }

  /**
   * Проверить может ли пользователь управлять другим пользователем
   */
  static async canManageUser(actor: User, targetUser: User): Promise<boolean> {
    // Нельзя управлять самим собой
    if (actor.id === targetUser.id) return false;

    // SUPER_ADMIN может всех
    if (actor.role === 'SUPER_ADMIN') return true;

    // HOTEL_ADMIN может пользователей своего отеля
    if (actor.role === 'HOTEL_ADMIN' && actor.hotelId === targetUser.hotelId) {
      // Но не может управлять другими HOTEL_ADMIN или SUPER_ADMIN
      if (targetUser.role === 'HOTEL_ADMIN' || targetUser.role === 'SUPER_ADMIN') {
        return false;
      }
      return true;
    }

    return false;
  }
}
```

#### 1.4 Создать middleware для проверки permissions
Файл: `backend/src/middleware/permission.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permissionService';
import { PermissionResource, PermissionAction } from '../models/Permission';

export const requirePermission = (
  resource: PermissionResource,
  action: PermissionAction,
  options?: {
    getTargetHotelId?: (req: Request) => string | undefined;
    getTargetDepartmentId?: (req: Request) => string | undefined;
    getTargetUserId?: (req: Request) => string | undefined;
  }
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const context = {
        user: req.user,
        targetHotelId: options?.getTargetHotelId?.(req),
        targetDepartmentId: options?.getTargetDepartmentId?.(req),
        targetUserId: options?.getTargetUserId?.(req),
      };

      const hasPermission = await PermissionService.hasPermission(
        context,
        resource,
        action
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `You don't have permission to ${action} ${resource}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
```

### Критерии завершения фазы 1
- [ ] Модели Permission и RolePermission созданы
- [ ] Миграции выполнены успешно
- [ ] Seed данных загружен
- [ ] PermissionService работает корректно
- [ ] Middleware requirePermission создан
- [ ] Минимум 3 роута обновлены с новым middleware
- [ ] Блокировка пользователей работает (проверено вручную)

---

## Фаза 2: Контекст владения данными

### Цель
Добавить `hotelId` и `departmentId` ко всем сущностям. Решает проблемы с фильтрацией, статистикой, категориями.

### Задачи

#### 2.1 Добавить departmentId в User
Файл: `backend/migrations/20240101000002-add-department-to-user.js`
```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'departments',
        key: 'id',
      },
    });

    await queryInterface.addIndex('users', ['departmentId']);

    // Заполнить дефолтными значениями
    await queryInterface.sequelize.query(`
      UPDATE users u
      SET "departmentId" = (
        SELECT id FROM departments d
        WHERE d."hotelId" = u."hotelId"
        LIMIT 1
      )
      WHERE u."departmentId" IS NULL
    `);

    await queryInterface.changeColumn('users', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'departmentId');
  }
};
```

#### 2.2 Добавить hotelId и departmentId в Product
Файл: `backend/migrations/20240101000003-add-context-to-product.js`
```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('products', 'hotelId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'hotels', key: 'id' },
    });

    await queryInterface.addColumn('products', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
    });

    await queryInterface.addIndex('products', ['hotelId']);
    await queryInterface.addIndex('products', ['departmentId']);

    // Заполнить данными
    await queryInterface.sequelize.query(`
      UPDATE products p
      SET 
        "hotelId" = (SELECT "hotelId" FROM users LIMIT 1),
        "departmentId" = (SELECT "departmentId" FROM users LIMIT 1)
      WHERE p."hotelId" IS NULL
    `);

    await queryInterface.changeColumn('products', 'hotelId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.changeColumn('products', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('products', 'departmentId');
    await queryInterface.removeColumn('products', 'hotelId');
  }
};
```

#### 2.3 Добавить hotelId и departmentId в Batch
```javascript
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('batches', 'hotelId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'hotels', key: 'id' },
    });

    await queryInterface.addColumn('batches', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
    });

    await queryInterface.addIndex('batches', ['hotelId']);
    await queryInterface.addIndex('batches', ['departmentId']);

    // Заполнить из связанного пользователя
    await queryInterface.sequelize.query(`
      UPDATE batches b
      SET 
        "hotelId" = u."hotelId",
        "departmentId" = u."departmentId"
      FROM users u
      WHERE b."userId" = u.id
        AND b."hotelId" IS NULL
    `);

    await queryInterface.changeColumn('batches', 'hotelId', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.changeColumn('batches', 'departmentId', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('batches', 'departmentId');
    await queryInterface.removeColumn('batches', 'hotelId');
  }
};
```

### Критерии завершения фазы 2
- [ ] Миграции для User, Product, Batch, Category выполнены
- [ ] Все существующие данные заполнены корректно
- [ ] Индексы созданы
- [ ] Модели Sequelize обновлены
- [ ] Тесты проходят

---

## Фаза 3: Backend как источник логики

### Цель
Перенести всю бизнес-логику на backend. Frontend только отображает данные.

### Задачи

#### 3.1 Создать StatusService
Файл: `backend/src/services/statusService.ts`
```typescript
export enum ExpiryStatus {
  EXPIRED = 'EXPIRED',
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  OK = 'OK'
}

export interface StatusColors {
  bg: string;
  text: string;
  border: string;
}

export class StatusService {
  private static warningDays = 7;
  private static criticalDays = 3;

  static calculateStatus(expiryDate: Date): ExpiryStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return ExpiryStatus.EXPIRED;
    if (daysUntilExpiry <= this.criticalDays) return ExpiryStatus.CRITICAL;
    if (daysUntilExpiry <= this.warningDays) return ExpiryStatus.WARNING;
    return ExpiryStatus.OK;
  }

  static getColors(status: ExpiryStatus): StatusColors {
    switch (status) {
      case ExpiryStatus.EXPIRED:
        return { bg: '#FEE2E2', text: '#DC2626', border: '#DC2626' };
      case ExpiryStatus.CRITICAL:
        return { bg: '#FEF3C7', text: '#D97706', border: '#D97706' };
      case ExpiryStatus.WARNING:
        return { bg: '#FEF9C3', text: '#CA8A04', border: '#CA8A04' };
      case ExpiryStatus.OK:
        return { bg: '#DCFCE7', text: '#16A34A', border: '#16A34A' };
    }
  }

  static getDaysUntilExpiry(expiryDate: Date): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
```

#### 3.2 Обновить API responses
```typescript
// В контроллере batches
export async function getBatches(req: Request, res: Response) {
  const batches = await Batch.findAll({
    where: { departmentId: req.user.departmentId },
    include: [{ model: Product, include: [Category] }]
  });

  const enrichedBatches = batches.map(batch => {
    const status = StatusService.calculateStatus(batch.expiryDate);
    const colors = StatusService.getColors(status);
    const daysUntilExpiry = StatusService.getDaysUntilExpiry(batch.expiryDate);

    return {
      ...batch.toJSON(),
      status,
      daysUntilExpiry,
      colors,
      category: batch.product?.category ? {
        id: batch.product.category.id,
        name: batch.product.category.name,
        color: batch.product.category.color
      } : null
    };
  });

  res.json({ batches: enrichedBatches });
}
```

### Критерии завершения фазы 3
- [ ] StatusService создан и протестирован
- [ ] Все API endpoints возвращают enriched данные
- [ ] Frontend убран расчёт статусов
- [ ] Календарь показывает правильные цвета
- [ ] Статистика "по категориям" работает корректно

---

## Фаза 4: Централизованный аудит

### Цель
Создать полную историю всех действий в системе.

### Задачи

#### 4.1 Расширить модель ActivityLog
```typescript
export enum ActivityAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  BLOCK = 'block',
  UNBLOCK = 'unblock',
  COLLECT = 'collect'
}

export enum ActivityEntityType {
  USER = 'user',
  PRODUCT = 'product',
  BATCH = 'batch',
  CATEGORY = 'category',
  DEPARTMENT = 'department',
  HOTEL = 'hotel',
  SETTINGS = 'settings',
  COLLECTION = 'collection'
}

export interface ActivityLogAttributes {
  id: string;
  userId: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName?: string;
  snapshotBefore?: object;
  snapshotAfter?: object;
  metadata?: object;
  hotelId: string;
  departmentId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

#### 4.2 Создать AuditService
```typescript
export class AuditService {
  static async log(params: {
    user: User;
    action: ActivityAction;
    entityType: ActivityEntityType;
    entityId: string;
    entityName?: string;
    snapshotBefore?: object;
    snapshotAfter?: object;
    metadata?: object;
    request?: Request;
  }) {
    const { user, action, entityType, entityId, entityName, 
            snapshotBefore, snapshotAfter, metadata, request } = params;

    await ActivityLog.create({
      userId: user.id,
      action,
      entityType,
      entityId,
      entityName,
      snapshotBefore,
      snapshotAfter,
      metadata,
      hotelId: user.hotelId,
      departmentId: user.departmentId,
      ipAddress: request?.ip,
      userAgent: request?.get('User-Agent'),
    });
  }

  static formatDescription(log: ActivityLog): string {
    const actionTexts = {
      create: 'создал',
      update: 'обновил',
      delete: 'удалил',
      login: 'вошёл в систему',
      logout: 'вышел из системы',
      export: 'экспортировал',
      block: 'заблокировал',
      unblock: 'разблокировал',
      collect: 'списал'
    };

    const entityTexts = {
      user: 'пользователя',
      product: 'товар',
      batch: 'партию',
      category: 'категорию',
      department: 'отдел',
      hotel: 'отель',
      settings: 'настройки',
      collection: 'списание'
    };

    const action = actionTexts[log.action] || log.action;
    const entity = entityTexts[log.entityType] || log.entityType;
    const name = log.entityName ? `"${log.entityName}"` : '';

    return `${action} ${entity} ${name}`.trim();
  }
}
```

### Критерии завершения фазы 4
- [ ] ActivityLog модель расширена
- [ ] AuditService создан
- [ ] Все контроллеры логируют действия
- [ ] История действий полная и читаемая
- [ ] Экспорт журнала работает

---

## Фаза 5: Notification Engine

### Цель
Создать надёжную систему уведомлений с retry и историей.

### Задачи

#### 5.1 Создать модель Notification
```typescript
export enum NotificationChannel {
  APP = 'app',
  TELEGRAM = 'telegram',
  EMAIL = 'email'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  READ = 'read'
}

export interface NotificationAttributes {
  id: string;
  userId: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  message: string;
  data?: object;
  status: NotificationStatus;
  attempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  readAt?: Date;
  hotelId: string;
  departmentId?: string;
  createdAt: Date;
}
```

#### 5.2 Создать NotificationService
```typescript
export class NotificationService {
  private static maxRetries = 3;

  static async send(params: {
    userId: string;
    channel: NotificationChannel;
    type: string;
    title: string;
    message: string;
    data?: object;
  }) {
    const notification = await Notification.create({
      ...params,
      status: NotificationStatus.PENDING,
      attempts: 0,
    });

    await this.deliver(notification);
    return notification;
  }

  private static async deliver(notification: Notification) {
    try {
      notification.attempts++;
      notification.lastAttemptAt = new Date();

      switch (notification.channel) {
        case NotificationChannel.TELEGRAM:
          await TelegramService.send(notification);
          break;
        case NotificationChannel.EMAIL:
          await EmailService.send(notification);
          break;
        case NotificationChannel.APP:
          // App notifications are stored in DB only
          break;
      }

      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (error) {
      console.error('Notification delivery failed:', error);
      
      if (notification.attempts >= this.maxRetries) {
        notification.status = NotificationStatus.FAILED;
      }
    }

    await notification.save();
  }
}
```

#### 5.3 Создать ExpiryCheckJob
```typescript
export class ExpiryCheckJob {
  static async run() {
    console.log('Running expiry check job...');

    const settings = await SettingsService.get('notifications.warningDays');
    const warningDays = settings?.value || 7;

    const criticalSettings = await SettingsService.get('notifications.criticalDays');
    const criticalDays = criticalSettings?.value || 3;

    // Найти партии требующие уведомления
    const batchesNeedingAlert = await Batch.findAll({
      where: {
        expiryDate: {
          [Op.lte]: new Date(Date.now() + warningDays * 24 * 60 * 60 * 1000)
        },
        quantity: { [Op.gt]: 0 }
      },
      include: [Product, { model: User, as: 'department' }]
    });

    for (const batch of batchesNeedingAlert) {
      const status = StatusService.calculateStatus(batch.expiryDate);
      const daysLeft = StatusService.getDaysUntilExpiry(batch.expiryDate);

      // Определить получателей
      const recipients = await this.getRecipients(batch);

      for (const user of recipients) {
        // Проверить не отправляли ли уже
        const existing = await Notification.findOne({
          where: {
            userId: user.id,
            type: 'expiry_warning',
            'data.batchId': batch.id,
            createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        });

        if (existing) continue;

        await NotificationService.send({
          userId: user.id,
          channel: user.preferredChannel || NotificationChannel.APP,
          type: 'expiry_warning',
          title: status === ExpiryStatus.CRITICAL ? '⚠️ Критичный срок!' : '📅 Срок годности',
          message: `${batch.product.name}: ${daysLeft} дн. до истечения`,
          data: { batchId: batch.id, productId: batch.productId, daysLeft, status }
        });
      }
    }
  }

  private static async getRecipients(batch: Batch): Promise<User[]> {
    return User.findAll({
      where: {
        departmentId: batch.departmentId,
        isBlocked: false
      }
    });
  }
}
```

### Критерии завершения фазы 5
- [ ] Notification модель создана
- [ ] NotificationService с retry создан
- [ ] ExpiryCheckJob работает по расписанию
- [ ] Telegram уведомления доставляются
- [ ] История уведомлений сохраняется

---

## Фаза 6: Унификация данных

### Цель
Создать единый формат запросов и ответов для всех разделов.

### Задачи

#### 6.1 Создать стандартные типы фильтров
```typescript
export interface StandardFilters {
  hotelId?: string;
  departmentIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  status?: ExpiryStatus[];
  categoryIds?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StandardResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    applied: Partial<StandardFilters>;
    available: {
      categories: { id: string; name: string }[];
      departments: { id: string; name: string }[];
      statuses: ExpiryStatus[];
    };
  };
  summary?: {
    totalQuantity?: number;
    byStatus?: Record<ExpiryStatus, number>;
  };
}
```

#### 6.2 Создать QueryBuilder
```typescript
export class QueryBuilder {
  static buildWhereClause(filters: StandardFilters, user: User) {
    const where: any = {};

    // Автоматически добавить контекст пользователя
    if (user.role !== 'SUPER_ADMIN') {
      where.hotelId = user.hotelId;
    }

    if (user.role === 'USER' || user.role === 'DEPARTMENT_MANAGER') {
      where.departmentId = user.departmentId;
    }

    // Применить явные фильтры
    if (filters.departmentIds?.length) {
      where.departmentId = { [Op.in]: filters.departmentIds };
    }

    if (filters.categoryIds?.length) {
      where.categoryId = { [Op.in]: filters.categoryIds };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.expiryDate = {};
      if (filters.dateFrom) where.expiryDate[Op.gte] = filters.dateFrom;
      if (filters.dateTo) where.expiryDate[Op.lte] = filters.dateTo;
    }

    if (filters.search) {
      where.name = { [Op.iLike]: `%${filters.search}%` };
    }

    return where;
  }

  static buildPagination(filters: StandardFilters) {
    return {
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      order: [[filters.sortBy || 'createdAt', filters.sortOrder || 'desc']]
    };
  }
}
```

### Критерии завершения фазы 6
- [ ] StandardFilters и StandardResponse типы созданы
- [ ] QueryBuilder реализован
- [ ] Все API используют единый формат
- [ ] Фильтры работают корректно
- [ ] Пагинация работает

---

## Фаза 7: Настройки как правила

### Цель
Сделать настройки источником бизнес-правил системы.

### Задачи

#### 7.1 Создать модель Settings
```typescript
export enum SettingsScope {
  SYSTEM = 'system',
  HOTEL = 'hotel',
  DEPARTMENT = 'department',
  USER = 'user'
}

export interface SettingsAttributes {
  id: string;
  scope: SettingsScope;
  scopeId?: string;
  key: string;
  value: any;
  description?: string;
}
```

#### 7.2 Создать SettingsService с иерархией
```typescript
export class SettingsService {
  /**
   * Получить настройку с учётом иерархии
   * User → Department → Hotel → System
   */
  static async get(key: string, user?: User): Promise<any> {
    if (user) {
      // Попробовать user-level
      const userSetting = await Settings.findOne({
        where: { key, scope: SettingsScope.USER, scopeId: user.id }
      });
      if (userSetting) return userSetting.value;

      // Попробовать department-level
      const deptSetting = await Settings.findOne({
        where: { key, scope: SettingsScope.DEPARTMENT, scopeId: user.departmentId }
      });
      if (deptSetting) return deptSetting.value;

      // Попробовать hotel-level
      const hotelSetting = await Settings.findOne({
        where: { key, scope: SettingsScope.HOTEL, scopeId: user.hotelId }
      });
      if (hotelSetting) return hotelSetting.value;
    }

    // System-level (default)
    const systemSetting = await Settings.findOne({
      where: { key, scope: SettingsScope.SYSTEM }
    });
    return systemSetting?.value;
  }

  static async set(key: string, value: any, scope: SettingsScope, scopeId?: string) {
    const [setting] = await Settings.upsert({
      key,
      value,
      scope,
      scopeId
    });
    return setting;
  }
}
```

#### 7.3 Seed дефолтных настроек
```typescript
const defaultSettings = [
  { scope: SettingsScope.SYSTEM, key: 'branding.logo', value: '/assets/logo.png' },
  { scope: SettingsScope.SYSTEM, key: 'branding.primaryColor', value: '#3B82F6' },
  { scope: SettingsScope.SYSTEM, key: 'branding.secondaryColor', value: '#10B981' },
  { scope: SettingsScope.SYSTEM, key: 'branding.companyName', value: 'FreshTrack' },
  { scope: SettingsScope.SYSTEM, key: 'locale.language', value: 'en' },
  { scope: SettingsScope.SYSTEM, key: 'locale.timezone', value: 'UTC' },
  { scope: SettingsScope.SYSTEM, key: 'locale.dateFormat', value: 'MM/DD/YYYY' },
  { scope: SettingsScope.SYSTEM, key: 'notifications.warningDays', value: 7 },
  { scope: SettingsScope.SYSTEM, key: 'notifications.criticalDays', value: 3 },
];
```

### Критерии завершения фазы 7
- [ ] Settings модель создана
- [ ] SettingsService реализован с иерархией
- [ ] API для настроек создано
- [ ] Seed дефолтных настроек загружен
- [ ] Сохранение настроек работает
- [ ] Брендинг применяется корректно

---

## Фаза 8: Рефакторинг логики сбора

### Проблема
Текущая логика сбора работает **по партиям (batches)** — пользователь списывает целую партию продукта за раз. В реальных условиях отеля с 160 мини-барами это неприменимо:

- Сотрудник собирает продукты из разных мини-баров
- Он не знает из какой именно партии взят каждый продукт
- Ему нужно просто указать: "Собрал 15 штук Coca-Cola"

### Решение: Сбор по количеству с FIFO

#### Новый flow пользователя:
```
1. Пользователь выбирает продукт из списка
2. Видит:
   - Общее количество на складе (сумма всех партий)
   - Разбивку по партиям с датами (для информации)
   - Ближайший срок годности
3. Вводит количество для списания (например: 15)
4. Выбирает причину списания:
   - collected (собрано/продано)
   - expired (просрочено)
   - damaged (повреждено)
   - other (другое)
5. Опционально добавляет комментарий
6. Нажимает "Списать"
7. Система автоматически применяет FIFO:
   - Сортирует партии по expiry_date (ASC)
   - Списывает из партий с ближайшим сроком
   - Если одной партии не хватает — берёт из следующей
   - Партии с quantity=0 удаляются
```

#### Пример FIFO алгоритма:
```
Coca-Cola на складе:
├─ Batch #1: exp 25.12.2025 — 50 шт
├─ Batch #2: exp 28.12.2025 — 30 шт
└─ Batch #3: exp 05.01.2026 — 20 шт
Всего: 100 шт

Пользователь списывает: 65 шт

Результат:
├─ Batch #1: 50 → 0 шт (списано 50) → DELETE
├─ Batch #2: 30 → 15 шт (списано 15)
└─ Batch #3: без изменений

Записи в collections:
├─ { batchId: 1, quantity: 50, reason: 'collected' }
└─ { batchId: 2, quantity: 15, reason: 'collected' }
```

### Задачи

#### 8.1 Обновить модель Collection
Файл: `backend/src/models/Collection.ts`
```typescript
export interface CollectionAttributes {
  id: string;
  productId: string;
  batchId: string | null;
  quantity: number;
  reason: 'collected' | 'expired' | 'damaged' | 'other';
  notes: string | null;
  collectedBy: string;
  departmentId: string;
  hotelId: string;
  batchSnapshot: {
    expiryDate: string;
    productionDate: string | null;
    originalQuantity: number;
  } | null;
  createdAt: Date;
}
```

#### 8.2 Создать CollectionService с FIFO
Файл: `backend/src/services/CollectionService.ts`
```typescript
import { Transaction, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { Collection } from '../models/Collection';
import { Batch } from '../models/Batch';
import { AuditService } from './auditService';

export interface CollectRequest {
  productId: string;
  quantity: number;
  reason: 'collected' | 'expired' | 'damaged' | 'other';
  notes?: string;
  departmentId: string;
}

export interface CollectResult {
  success: boolean;
  totalCollected: number;
  batchesAffected: Array<{
    batchId: string;
    collected: number;
    remaining: number;
    deleted: boolean;
    expiryDate: string;
  }>;
  collections: Collection[];
  error?: string;
}

export class CollectionService {
  /**
   * Списать указанное количество продукта используя FIFO
   */
  async collectProduct(
    request: CollectRequest,
    userId: string,
    hotelId: string
  ): Promise<CollectResult> {
    const { productId, quantity, reason, notes, departmentId } = request;

    // Валидация
    if (quantity <= 0) {
      return {
        success: false,
        totalCollected: 0,
        batchesAffected: [],
        collections: [],
        error: 'Количество должно быть больше 0',
      };
    }

    // Получить все партии продукта, отсортированные по сроку годности (FIFO)
    const batches = await Batch.findAll({
      where: {
        productId,
        hotelId,
        quantity: { [Op.gt]: 0 },
      },
      order: [['expiryDate', 'ASC']],
    });

    // Проверить общее количество
    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalAvailable < quantity) {
      return {
        success: false,
        totalCollected: 0,
        batchesAffected: [],
        collections: [],
        error: `Недостаточно товара. Доступно: ${totalAvailable}, запрошено: ${quantity}`,
      };
    }

    // Выполнить списание в транзакции
    const result = await sequelize.transaction(async (transaction: Transaction) => {
      let remainingToCollect = quantity;
      const batchesAffected: CollectResult['batchesAffected'] = [];
      const collections: Collection[] = [];

      for (const batch of batches) {
        if (remainingToCollect <= 0) break;

        const toCollectFromBatch = Math.min(batch.quantity, remainingToCollect);
        const newQuantity = batch.quantity - toCollectFromBatch;
        const shouldDelete = newQuantity === 0;

        // Создать snapshot перед изменением
        const batchSnapshot = {
          expiryDate: batch.expiryDate.toISOString(),
          productionDate: batch.productionDate?.toISOString() || null,
          originalQuantity: batch.quantity,
        };

        // Создать запись о списании
        const collection = await Collection.create({
          productId,
          batchId: batch.id,
          quantity: toCollectFromBatch,
          reason,
          notes,
          collectedBy: userId,
          departmentId,
          hotelId,
          batchSnapshot,
        }, { transaction });

        collections.push(collection);

        // Обновить или удалить партию
        if (shouldDelete) {
          await batch.destroy({ transaction });
        } else {
          batch.quantity = newQuantity;
          await batch.save({ transaction });
        }

        batchesAffected.push({
          batchId: batch.id,
          collected: toCollectFromBatch,
          remaining: newQuantity,
          deleted: shouldDelete,
          expiryDate: batch.expiryDate.toISOString(),
        });

        remainingToCollect -= toCollectFromBatch;
      }

      return { batchesAffected, collections };
    });

    return {
      success: true,
      totalCollected: quantity,
      ...result,
    };
  }

  /**
   * Предпросмотр FIFO списания (без фактического изменения)
   */
  async previewCollection(
    productId: string,
    quantity: number,
    hotelId: string
  ): Promise<Array<{ batchId: string; expiryDate: string; toCollect: number; remaining: number }>> {
    const batches = await Batch.findAll({
      where: {
        productId,
        hotelId,
        quantity: { [Op.gt]: 0 },
      },
      order: [['expiryDate', 'ASC']],
    });

    let remainingToCollect = quantity;
    const preview = [];

    for (const batch of batches) {
      if (remainingToCollect <= 0) break;

      const toCollect = Math.min(batch.quantity, remainingToCollect);
      preview.push({
        batchId: batch.id,
        expiryDate: batch.expiryDate.toISOString(),
        toCollect,
        remaining: batch.quantity - toCollect,
      });

      remainingToCollect -= toCollect;
    }

    return preview;
  }
}
```

#### 8.3 Создать API endpoint
Файл: `backend/src/routes/collections.ts`
```typescript
import express from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { PermissionResource, PermissionAction } from '../models/Permission';
import { CollectionService } from '../services/CollectionService';
import { AuditService } from '../services/auditService';
import { ActivityAction, ActivityEntityType } from '../models/ActivityLog';

const router = express.Router();
const collectionService = new CollectionService();

// POST /api/collections/collect - Списать продукт по количеству
router.post(
  '/collect',
  requireAuth,
  requirePermission(PermissionResource.BATCHES, PermissionAction.UPDATE),
  async (req, res) => {
    try {
      const { productId, quantity, reason, notes } = req.body;
      const user = req.user;

      const result = await collectionService.collectProduct(
        {
          productId,
          quantity,
          reason,
          notes,
          departmentId: user.departmentId,
        },
        user.id,
        user.hotelId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Логировать действие
      await AuditService.log({
        user,
        action: ActivityAction.COLLECT,
        entityType: ActivityEntityType.COLLECTION,
        entityId: result.collections[0]?.id || 'bulk',
        entityName: `Списание ${quantity} шт`,
        snapshotAfter: {
          productId,
          quantity,
          reason,
          batchesAffected: result.batchesAffected,
        },
        request: req,
      });

      res.json(result);
    } catch (error) {
      console.error('Collection error:', error);
      res.status(500).json({ error: 'Failed to collect product' });
    }
  }
);

// GET /api/collections/preview - Предпросмотр FIFO списания
router.get(
  '/preview',
  requireAuth,
  async (req, res) => {
    try {
      const { productId, quantity } = req.query;
      const user = req.user;

      const preview = await collectionService.previewCollection(
        productId as string,
        parseInt(quantity as string),
        user.hotelId
      );

      res.json({ preview });
    } catch (error) {
      console.error('Preview error:', error);
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }
);

export default router;
```

#### 8.4 Создать frontend компонент
Файл: `frontend/src/components/CollectProductModal.tsx`
```typescript
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, AlertTriangle } from 'lucide-react';

interface Batch {
  id: string;
  expiryDate: string;
  quantity: number;
  status: string;
  daysUntilExpiry: number;
}

interface CollectProductModalProps {
  product: {
    id: string;
    name: string;
    totalQuantity: number;
    batches: Batch[];
  };
  isOpen: boolean;
  onClose: () => void;
  onCollect: (data: { quantity: number; reason: string; notes?: string }) => Promise<void>;
}

const REASONS = [
  { value: 'collected', labelKey: 'collection.reasons.collected' },
  { value: 'expired', labelKey: 'collection.reasons.expired' },
  { value: 'damaged', labelKey: 'collection.reasons.damaged' },
  { value: 'other', labelKey: 'collection.reasons.other' },
];

export function CollectProductModal({ product, isOpen, onClose, onCollect }: CollectProductModalProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('collected');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Array<{ batchId: string; toCollect: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузить preview при изменении количества
  useEffect(() => {
    if (quantity > 0 && quantity <= product.totalQuantity) {
      fetchPreview();
    }
  }, [quantity, product.id]);

  const fetchPreview = async () => {
    try {
      const res = await fetch(`/api/collections/preview?productId=${product.id}&quantity=${quantity}`);
      const data = await res.json();
      setPreview(data.preview);
    } catch (err) {
      console.error('Preview fetch error:', err);
    }
  };

  const handleSubmit = async () => {
    if (quantity <= 0 || quantity > product.totalQuantity) {
      setError(t('collection.error.invalid_quantity'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onCollect({ quantity, reason, notes: notes || undefined });
      onClose();
    } catch (err: any) {
      setError(err.message || t('collection.error.general'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const nearestExpiry = product.batches.length > 0
    ? product.batches.reduce((min, b) => 
        new Date(b.expiryDate) < new Date(min.expiryDate) ? b : min
      )
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('collection.title')}: {product.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Stock info */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('collection.in_stock')}:</span>
            <span className="font-medium">{product.totalQuantity} шт</span>
          </div>

          {nearestExpiry && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('collection.nearest_expiry')}:</span>
              <span className={`font-medium ${nearestExpiry.daysUntilExpiry <= 3 ? 'text-red-600' : ''}`}>
                {new Date(nearestExpiry.expiryDate).toLocaleDateString()} 
                ({nearestExpiry.daysUntilExpiry} дн.)
              </span>
            </div>
          )}

          {/* Batches list */}
          <div className="border rounded-lg p-3 bg-gray-50 max-h-32 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">{t('collection.batches')}:</div>
            {product.batches.map(batch => (
              <div key={batch.id} className="flex justify-between text-sm py-1">
                <span className={`
                  ${batch.status === 'EXPIRED' ? 'text-red-600' : ''}
                  ${batch.status === 'CRITICAL' ? 'text-orange-600' : ''}
                  ${batch.status === 'WARNING' ? 'text-yellow-600' : ''}
                  ${batch.status === 'OK' ? 'text-green-600' : ''}
                `}>
                  {new Date(batch.expiryDate).toLocaleDateString()}
                </span>
                <span>{batch.quantity} шт</span>
              </div>
            ))}
          </div>

          {/* Quantity selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('collection.quantity')}:
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-gray-100"
              >
                <Minus size={18} />
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(product.totalQuantity, parseInt(e.target.value) || 1)))}
                className="w-24 text-center text-xl font-bold border rounded-lg py-2"
                min={1}
                max={product.totalQuantity}
              />
              <button
                onClick={() => setQuantity(Math.min(product.totalQuantity, quantity + 1))}
                className="w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-gray-100"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Reason selector */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('collection.reason')}:</label>
            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>{t(r.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('collection.notes')}:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm"
              rows={2}
              placeholder={t('collection.notes_placeholder')}
            />
          </div>

          {/* FIFO Preview */}
          {preview.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-sm text-gray-600 mb-2">{t('collection.preview')}:</div>
              {preview.map(p => {
                const batch = product.batches.find(b => b.id === p.batchId);
                return (
                  <div key={p.batchId} className="text-sm flex justify-between">
                    <span>• {batch ? new Date(batch.expiryDate).toLocaleDateString() : p.batchId}</span>
                    <span className="font-medium">-{p.toCollect} шт</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 py-2 border rounded-lg hover:bg-gray-100"
          >
            {t('collection.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || quantity <= 0 || quantity > product.totalQuantity}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? '...' : `${t('collection.submit')} ${quantity} шт`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### 8.5 Добавить локализацию
Файл: `frontend/src/locales/ru.json` (добавить):
```json
{
  "collection": {
    "title": "Списание продукта",
    "quantity": "Количество для списания",
    "reason": "Причина списания",
    "reasons": {
      "collected": "Собрано/Продано",
      "expired": "Просрочено",
      "damaged": "Повреждено",
      "other": "Другое"
    },
    "notes": "Комментарий",
    "notes_placeholder": "Опционально...",
    "preview": "Будет списано из",
    "submit": "Списать",
    "cancel": "Отмена",
    "success": "Успешно списано {count} шт",
    "error": {
      "insufficient": "Недостаточно товара на складе",
      "invalid_quantity": "Введите корректное количество",
      "general": "Ошибка при списании"
    },
    "in_stock": "На складе",
    "nearest_expiry": "Ближайший срок",
    "batches": "Партии"
  }
}
```

### Критерии завершения фазы 8
- [ ] Collection модель обновлена с batchSnapshot
- [ ] CollectionService с FIFO логикой создан
- [ ] API endpoint /api/collections/collect работает
- [ ] Preview endpoint возвращает корректные данные
- [ ] Frontend компонент CollectProductModal создан
- [ ] Локализация добавлена (ru, en, kk)
- [ ] FIFO списание работает корректно
- [ ] Партии с quantity=0 удаляются
- [ ] История списаний сохраняет snapshot партий
- [ ] Тесты написаны

---

## Checklist для проверки

### После каждой фазы проверять:
- [ ] Миграции выполнены без ошибок
- [ ] Тесты (если есть) проходят
- [ ] Ручное тестирование основного функционала прошло успешно
- [ ] Нет console.error в логах
- [ ] Git commit сделан с понятным сообщением

### После завершения всех фаз:

#### Безопасность:
- [ ] Блокировка пользователей работает
- [ ] HOTEL_ADMIN не может управлять SUPER_ADMIN
- [ ] Каждый пользователь видит только свои данные
- [ ] Permissions проверяются на каждом endpoint

#### Функциональность:
- [ ] Календарь показывает правильные цвета
- [ ] Статистика "по категориям" не показывает "другое"
- [ ] История сборов показывает правильный срок годности
- [ ] Журнал действий полный и читаемый
- [ ] Telegram уведомления работают
- [ ] Экспорт работает во всех разделах
- [ ] Настройки сохраняются и применяются
- [ ] Сбор по количеству с FIFO работает корректно

#### Производительность:
- [ ] Запросы выполняются < 500ms
- [ ] Индексы созданы на всех foreign keys
- [ ] Нет N+1 queries

#### Документация:
- [ ] README обновлён
- [ ] API endpoints задокументированы
- [ ] Переменные окружения описаны

---

## Следующие шаги после завершения

1. **Добавление новой роли Department Manager** - теперь тривиально через permissions
2. **Сканирование чеков** - можно добавлять как независимую фичу
3. **Учёт продаж** - аналогично
4. **Тесты** - написать полное покрытие
5. **Monitoring** - добавить Sentry/LogRocket
6. **Performance optimization** - кеширование, CDN
7. **Quick Actions** - кнопки быстрого списания (5, 10, 25 шт)
8. **Bulk Collection** - массовое списание нескольких продуктов
9. **Mobile PWA** - оптимизация для мобильных устройств сотрудников
