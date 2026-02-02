/**
 * CollectionsAdapter - адаптер для экспорта сборов/списаний
 */
import { BaseAdapter } from './BaseAdapter'

export class CollectionsAdapter extends BaseAdapter {
  normalize(rawData) {
    const reasonMap = {
      CONSUMPTION: this.t('collection.reason.consumption', 'Расход'),
      TRANSFER: this.t('collection.reason.transfer', 'Перемещение'),
      SAMPLE: this.t('collection.reason.sample', 'Образец'),
      ADJUSTMENT: this.t('collection.reason.adjustment', 'Корректировка'),
      expired: this.t('collection.reason.expired', 'Истек срок'),
      damaged: this.t('collection.reason.damaged', 'Повреждён'),
      quality: this.t('collection.reason.quality', 'Проблемы с качеством'),
      other: this.t('collection.reason.other', 'Другое')
    }

    return rawData.map((item) => ({
      timestamp: this.formatDateTime(item.collected_at || item.created_at || item.timestamp),
      productName: item.product_name || '-',
      department: item.department_name || '-',
      quantity: item.quantity || 0,
      unit: item.unit || 'шт',
      reason: reasonMap[item.reason] || item.reason || '-',
      collectedBy: item.collected_by_name || item.user_name || '-',
      batchNumber: item.batch_number || '-',
      expiryDate: this.formatDate(item.expiry_date)
    }))
  }

  getRequiredFields() {
    return ['timestamp', 'productName', 'quantity']
  }
}
