/**
 * InventoryAdapter - адаптер для экспорта инвентаря
 */
import { BaseAdapter } from './BaseAdapter'

export class InventoryAdapter extends BaseAdapter {
  normalize(rawData) {
    const statusMap = {
      good: this.t('common.good', 'Хорошо'),
      warning: this.t('common.warning', 'Внимание'),
      critical: this.t('common.critical', 'Критично'),
      expired: this.t('common.expired', 'Просрочено'),
      today: this.t('common.today', 'Сегодня'),
      noBatches: this.t('common.noBatches', 'Нет партий')
    }

    return rawData.map((item) => ({
      productName: item.product_name || item.name || '-',
      category: item.category_name || '-',
      department: item.department_name || item.department || '-',
      expiryDate: this.formatDate(item.expiry_date || item.nearest_expiry),
      status: statusMap[item.status] || item.status || '-',
      daysLeft: item.days_until_expiry ?? item.daysLeft ?? '-',
      quantity: item.quantity || item.total_quantity || 0,
      unit: item.unit || 'шт'
    }))
  }

  getRequiredFields() {
    return ['productName']
  }
}
