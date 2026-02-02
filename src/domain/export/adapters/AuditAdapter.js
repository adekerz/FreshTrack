  /**
   * AuditAdapter - адаптер для экспорта журнала аудита
   */
  import { BaseAdapter } from './BaseAdapter'

  export class AuditAdapter extends BaseAdapter {
    normalize(rawData) {
      const actionMap = {
        create: this.t('audit.action.create', 'Создание'),
        update: this.t('audit.action.update', 'Обновление'),
        delete: this.t('audit.action.delete', 'Удаление'),
        collect: this.t('audit.action.collect', 'Списание'),
        fifo_collect: this.t('audit.action.fifo_collect', 'FIFO списание'),
        login: this.t('audit.action.login', 'Вход'),
        logout: this.t('audit.action.logout', 'Выход'),
        export: this.t('audit.action.export', 'Экспорт')
      }

      return rawData.map((item) => ({
        timestamp: this.formatDateTime(item.created_at || item.timestamp),
        userName: item.user_name || '-',
        action: actionMap[item.action?.toLowerCase()] || item.action || '-',
        entityType: item.entity_type || '-',
        entityId: item.entity_id || '-',
        details:
          typeof item.details === 'object'
            ? JSON.stringify(item.details, null, 2)
            : item.details || '-',
        ipAddress: item.ip_address || '-'
      }))
    }

    getRequiredFields() {
      return ['timestamp', 'userName', 'action']
    }
  }
