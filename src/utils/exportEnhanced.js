/**
 * Enhanced Export Utilities
 * Расширенные функции экспорта с поддержкой метаданных и фильтров
 */

/**
 * Экспорт в Excel с метаданными и фильтрами
 * @param {Array} data - данные для экспорта
 * @param {Array} columns - колонки [{key, title}]
 * @param {string} filename - имя файла
 * @param {Object} metadata - метаданные {title, subtitle, filters, timestamp, totalRecords, companyName}
 */
export function exportToExcel(
  data,
  columns,
  filename = 'export',
  metadata = {}
) {
  const {
    title = 'Экспорт',
    filters = null,
    timestamp = new Date(),
    totalRecords = data.length,
  } = metadata

  const escapeXml = (str) => {
    if (str === null || str === undefined) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // Создание XML для Excel с улучшенными стилями
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Size="11" ss:FontName="Arial" ss:Color="#2D2D2D"/>
      <Interior ss:Color="#F5F0E8" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C4A35A"/>
      </Borders>
    </Style>
    <Style ss:ID="cell">
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E4DC"/>
      </Borders>
    </Style>
    <Style ss:ID="cellAlt">
      <Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E4DC"/>
      </Borders>
    </Style>
    <Style ss:ID="metaHeader">
      <Font ss:Bold="1" ss:Size="13" ss:FontName="Arial" ss:Color="#2D2D2D"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="metaLabel">
      <Font ss:Bold="1" ss:Size="10" ss:FontName="Arial" ss:Color="#666666"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="metaValue">
      <Font ss:Size="10" ss:FontName="Arial" ss:Color="#333333"/>
      <Alignment ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Данные">
    <Table>`

  // Добавляем метаданные в начало листа
  if (filters && filters.count > 0) {
    // Заголовок отчета
    xml += `\n      <Row ss:Height="25">
        <Cell ss:MergeAcross="${columns.length - 1}" ss:StyleID="metaHeader">
          <Data ss:Type="String">${escapeXml(title)}</Data>
        </Cell>
      </Row>`

    // Дата создания
    xml += `\n      <Row ss:Height="18">
        <Cell ss:StyleID="metaLabel"><Data ss:Type="String">Дата создания:</Data></Cell>
        <Cell ss:MergeAcross="${columns.length - 2}" ss:StyleID="metaValue">
          <Data ss:Type="String">${timestamp.toLocaleString('ru-RU')}</Data>
        </Cell>
      </Row>`

    // Всего записей
    xml += `\n      <Row ss:Height="18">
        <Cell ss:StyleID="metaLabel"><Data ss:Type="String">Всего записей:</Data></Cell>
        <Cell ss:MergeAcross="${columns.length - 2}" ss:StyleID="metaValue">
          <Data ss:Type="String">${totalRecords}</Data>
        </Cell>
      </Row>`

    // Фильтры
    xml += `\n      <Row ss:Height="18">
        <Cell ss:StyleID="metaLabel"><Data ss:Type="String">Примененные фильтры:</Data></Cell>
        <Cell ss:MergeAcross="${columns.length - 2}" ss:StyleID="metaValue">
          <Data ss:Type="String">${escapeXml(filters.description)}</Data>
        </Cell>
      </Row>`

    // Пустая строка
    xml += `\n      <Row ss:Height="10"/>`
  }

  // Ширина колонок
  columns.forEach((col, idx) => {
    const width = col.width || (col.title.length > 20 ? 150 : 100)
    xml += `\n      <Column ss:Index="${idx + 1}" ss:AutoFitWidth="0" ss:Width="${width}"/>`
  })

  // Заголовки
  xml += '\n      <Row ss:Height="25">'
  columns.forEach((col) => {
    xml += `\n        <Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(col.title)}</Data></Cell>`
  })
  xml += '\n      </Row>'

  // Данные
  data.forEach((item, rowIndex) => {
    const isAltRow = rowIndex % 2 === 1
    xml += `\n      <Row ss:Height="22">`
    columns.forEach((col) => {
      let value = item[col.key]

      // Обработка вложенных ключей
      if (col.key.includes('.')) {
        const keys = col.key.split('.')
        value = keys.reduce((obj, key) => obj?.[key], item)
      }

      let type = 'String'
      let style = isAltRow ? 'cellAlt' : 'cell'

      if (typeof value === 'number') {
        type = 'Number'
      } else if (value instanceof Date) {
        type = 'DateTime'
        value = value.toISOString()
      }

      value = value ?? '-'

      xml += `\n        <Cell ss:StyleID="${style}"><Data ss:Type="${type}">${escapeXml(String(value))}</Data></Cell>`
    })
    xml += '\n      </Row>'
  })

  xml += `
    </Table>
  </Worksheet>
</Workbook>`

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  downloadBlob(blob, `${filename}.xls`)

  return { success: true, filename: `${filename}.xls` }
}

/**
 * Экспорт в PDF с метаданными и фильтрами
 * @param {string} title - заголовок отчёта
 * @param {Array} data - данные
 * @param {Array} columns - колонки
 * @param {Object} metadata - метаданные
 */
export function exportToPDF(title, data, columns, metadata = {}) {
  const {
    subtitle = '',
    companyName = 'FreshTrack',
    filters = null,
    timestamp = new Date(),
    totalRecords = data.length,
    orientation = 'landscape',
    summary = null,
  } = metadata

  // Проверяем данные
  if (!data || data.length === 0) {
    alert('Нет данных для экспорта')
    return { success: false }
  }

  // Создание нового окна для печати
  const printWindow = window.open('', '_blank', 'width=1200,height=800')

  if (
    !printWindow ||
    printWindow.closed ||
    typeof printWindow.closed === 'undefined'
  ) {
    alert('Пожалуйста, разрешите всплывающие окна для создания PDF')
    return { success: false }
  }

  // HTML для печати
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 15mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1A1A1A;
      background: white;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #1A1A1A;
    }

    .logo {
      font-size: 14pt;
      font-weight: 600;
      color: #1A1A1A;
    }

    .logo-sub {
      font-size: 9pt;
      color: #6B6560;
    }

    .report-info {
      text-align: right;
      font-size: 9pt;
      color: #6B6560;
    }

    h1 {
      font-size: 16pt;
      font-weight: 500;
      margin-bottom: 5px;
    }

    .subtitle {
      font-size: 10pt;
      color: #6B6560;
      margin-bottom: 15px;
    }

    .filters {
      background: #FFF8E1;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 15px;
      border-left: 4px solid #FFA726;
    }

    .filters-title {
      font-weight: 600;
      font-size: 9pt;
      margin-bottom: 5px;
      color: #E65100;
    }

    .filters-content {
      font-size: 9pt;
      color: #5D4037;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
      padding: 15px;
      background: #FAF8F5;
      border-radius: 8px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 18pt;
      font-weight: 600;
    }

    .summary-label {
      font-size: 8pt;
      color: #6B6560;
      text-transform: uppercase;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    th {
      background: #F5F0E8;
      font-weight: 600;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #1A1A1A;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E5E2DE;
      font-size: 9pt;
    }

    tr:nth-child(even) {
      background: #FAFAFA;
    }

    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 10px 15mm;
      font-size: 8pt;
      color: #6B6560;
      border-top: 1px solid #E5E2DE;
      display: flex;
      justify-content: space-between;
    }

    @media print {
      .no-print { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }

    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #1A1A1A;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12pt;
      z-index: 1000;
    }

    .print-button:hover {
      background: #333;
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print(); setTimeout(() => window.close(), 100);">
    Печать / Сохранить PDF
  </button>

  <div class="header">
    <div>
      <div class="logo">${companyName}</div>
      <div class="logo-sub">FreshTrack System</div>
    </div>
    <div class="report-info">
      <div>Дата отчёта: ${timestamp.toLocaleString('ru-RU')}</div>
      <div>Всего записей: ${totalRecords}</div>
    </div>
  </div>

  <h1>${title}</h1>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}

  ${
    filters && filters.count > 0
      ? `
  <div class="filters">
    <div class="filters-title">Примененные фильтры (${filters.count}):</div>
    <div class="filters-content">${filters.description}</div>
  </div>
  `
      : ''
  }

  ${
    summary
      ? `
  <div class="summary">
    ${Object.entries(summary)
      .map(
        ([label, value]) => `
      <div class="summary-item">
        <div class="summary-value">${value}</div>
        <div class="summary-label">${label}</div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <table>
    <thead>
      <tr>
        ${columns.map((col) => `<th>${col.title}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (item) => `
        <tr>
          ${columns
            .map((col) => {
              let value = item[col.key]

              // Обработка вложенных ключей
              if (col.key.includes('.')) {
                const keys = col.key.split('.')
                value = keys.reduce((obj, key) => obj?.[key], item)
              }

              // Форматирование
              if (value instanceof Date) {
                value = value.toLocaleDateString('ru-RU')
              }

              return `<td>${value !== null && value !== undefined ? value : '-'}</td>`
            })
            .join('')}
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>© ${new Date().getFullYear()} ${companyName} - FreshTrack</span>
    <span>Страница 1</span>
  </div>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()

  // Фокус на окне и автоматический вызов печати после загрузки
  printWindow.focus()
  printWindow.onload = function () {
    printWindow.focus()
  }

  return { success: true }
}

/**
 * Вспомогательная функция для скачивания Blob
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default {
  exportToExcel,
  exportToPDF,
}
