/**
 * TelegramI18n — Translations for Telegram bot messages
 * Supports: en (English), ru (Russian), kk (Kazakh)
 */

export const i18n = {
  en: {
    // ── Welcome / Help ───────────────────────────────────────────────
    welcome: (isGroup) =>
      [
        '<b>FreshTrack Inventory Bot</b>',
        '',
        'This bot delivers real-time inventory alerts and daily reports from FreshTrack.',
        '',
        isGroup
          ? '1. Use <code>/link HOTEL_CODE:Department</code> to connect this chat\n2. Use <code>/help</code> to view all commands'
          : 'Use <code>/help</code> to see all commands.',
      ].join('\n'),

    help: (marshaExample) =>
      [
        '<b>FreshTrack Bot — Commands</b>',
        '',
        '<b>Setup</b>',
        '/link <code>CODE[:Dept]</code> — Connect to hotel or department',
        '/unlink — Disconnect this chat',
        '/status — Show connection details',
        '/departments — List available departments',
        '',
        '<b>Inventory</b>',
        '/report — On-demand full inventory report',
        '/summary — Quick alert count dashboard',
        '',
        '<b>Notifications</b>',
        '/notify <code>on|off</code> — Enable or disable notifications',
        '/filter <code>critical|warning|expired|all</code> — Filter types',
        '/silent <code>on|off</code> — Toggle sound',
        '/snooze <code>1|2|4|8|24</code> — Pause for N hours',
        '/snooze <code>off</code> — Cancel snooze',
        '/lang <code>en|ru|kk</code> — Set message language',
        '',
        '<b>Other</b>',
        '/test — Send a test notification',
        '/help — Show this message',
        '',
        '<b>Examples:</b>',
        `<code>/link ${marshaExample}</code> — entire hotel`,
        `<code>/link ${marshaExample}:Bar</code> — Bar department only`,
        '',
        'HOTEL_CODE is your MARSHA code from FreshTrack Settings → Organization',
      ].join('\n'),

    // ── /link ────────────────────────────────────────────────────────
    linkUsage: () =>
      '<b>Usage:</b>\n' +
      '<code>/link HOTEL_CODE</code> — all hotel notifications\n' +
      '<code>/link HOTEL_CODE:Department</code> — one department only\n\n' +
      '<b>Examples:</b>\n' +
      '<code>/link TSEXR</code> — entire hotel\n' +
      '<code>/link TSEXR:Bar</code> — Bar department only\n\n' +
      'Find your MARSHA code in FreshTrack Settings → Organization',

    linkHotelNotFound: (code) =>
      `Hotel not found\n\nCode <code>${code}</code> was not found in FreshTrack.\n\nCheck your MARSHA code in Settings → Organization`,

    linkDeptNotFound: (deptName, hotelName, deptList, marshaCode) =>
      `Department not found: "${deptName}"\n\n<b>Available in ${hotelName}:</b>\n${deptList}\n\nTry: <code>/link ${marshaCode}:Department Name</code>`,

    linkSuccess: (hotelName, deptName) =>
      `<b>Chat linked</b>\n\n<b>Hotel:</b> ${hotelName}\n<b>Department:</b> ${deptName}\n\nYou will now receive inventory alerts in this chat.\nUse /status to view connection details or /report for an immediate report.`,

    noDepts: '<i>No departments configured</i>',
    allDepts: 'All departments',

    // ── /unlink ──────────────────────────────────────────────────────
    unlinkSuccess: () =>
      '<b>Chat disconnected</b>\n\nThis chat has been unlinked from FreshTrack. You will no longer receive alerts.\n\nUse /link to reconnect at any time.',

    // ── /status ──────────────────────────────────────────────────────
    statusTitle: 'Connection Status',
    statusNotLinked:
      'Not connected\n\nUse /link to connect your FreshTrack account.',
    statusConnected: 'Connected',
    statusInactive: 'Inactive',
    statusHotel: 'Hotel',
    statusDept: 'Department',
    statusLang: 'Language',
    statusNotifications: 'Notifications',
    statusSilent: 'Silent mode',
    statusActive: 'Active',
    statusOn: 'On',
    statusOff: 'Off',
    statusSnoozedUntil: (time) =>
      `Snoozed until: ${time} (use /snooze off to cancel)`,
    statusNotifTypes: 'Notification types',

    // ── /departments ─────────────────────────────────────────────────
    deptsNotLinked:
      'This chat is not linked to a hotel yet.\n\nUse /link to connect first.',
    deptsNone: (hotelName) =>
      `<b>Departments — ${hotelName}</b>\n\n<i>No departments configured yet.</i>`,
    deptsList: (hotelName, list, marshaCode) =>
      `<b>Departments — ${hotelName}</b>\n\n${list}\n\nTo receive alerts for a specific department:\n<code>/link ${marshaCode}:Department Name</code>`,

    // ── /report ──────────────────────────────────────────────────────
    reportNotLinked:
      'This chat is not linked to a hotel.\n\nUse /link to connect first.',
    reportAllClear: (days) =>
      `<b>All Clear</b>\n\nNo expired or expiring items found within the next ${days} days.\n\n`,
    reportGenerated: 'Report generated',
    reportHeader: (expiredCount, criticalCount, warningCount) =>
      `<b>Inventory Report</b>\n\n🔴 Expired: <b>${expiredCount}</b>   🟠 Critical: <b>${criticalCount}</b>   🟡 Warning: <b>${warningCount}</b>`,
    reportExpired: 'Expired',
    reportCritical: (days) => `Expiring within ${days} days`,
    reportWarning: (days) => `Expiring within ${days} days`,
    reportQty: 'Qty',
    reportExp: 'Exp',
    reportMore: (n) => `...and ${n} more items`,

    // ── /summary ─────────────────────────────────────────────────────
    summaryTitle: 'Inventory Summary',
    summaryExpired: 'Expired',
    summaryCritical: (days) => `Critical (≤${days} days)`,
    summaryWarning: (days) => `Warning (≤${days} days)`,
    summaryOk: 'OK',
    summaryTotal: 'Total tracked',
    summaryNoAttention: 'No items require attention today.',
    summaryUseReport: 'Use /report to see the full item list.',

    // ── /snooze ──────────────────────────────────────────────────────
    snoozeUsage: (opts) =>
      `<b>Snooze Notifications</b>\n\n${opts}\n<code>/snooze off</code> — Cancel snooze\n\n<i>Snooze pauses all incoming alerts for this chat for the specified duration.</i>`,
    snoozeCancelled: 'Snooze cancelled\n\nNotifications are active again.',
    snoozeInvalidDuration: (allowed) =>
      `Invalid duration. Allowed: ${allowed} hours, or <code>off</code>`,
    snoozeSet: (until) =>
      `Notifications snoozed until <b>${until}</b>.\n\nUse <code>/snooze off</code> to cancel early.`,

    // ── /lang ─────────────────────────────────────────────────────────
    langUsage: () =>
      '<b>Set Chat Language</b>\n\n' +
      '<code>/lang en</code> — English\n' +
      '<code>/lang ru</code> — Русский\n' +
      '<code>/lang kk</code> — Қазақша',
    langUnsupported: (lang, supported) =>
      `Unsupported language: <code>${lang}</code>\n\nSupported: ${supported}`,
    langSet: (name) =>
      `<b>Language set: ${name}</b>\n\nNotifications for this chat will now be sent in ${name}.`,

    // ── /notify ───────────────────────────────────────────────────────
    notifyUsage: () =>
      '<b>Usage:</b>\n' +
      '<code>/notify on</code> — Enable notifications\n' +
      '<code>/notify off</code> — Disable notifications',
    notifyEnabled:
      'Notifications enabled\n\nYou will receive inventory alerts in this chat.',
    notifyDisabled:
      'Notifications disabled\n\nUse <code>/notify on</code> to re-enable.',

    // ── /filter ───────────────────────────────────────────────────────
    filterUsage: () =>
      '<b>Usage:</b>\n' +
      '<code>/filter critical</code> — Critical only (≤3 days)\n' +
      '<code>/filter warning</code> — Warning (4–7 days)\n' +
      '<code>/filter expired</code> — Expired only\n' +
      '<code>/filter all</code> — All notification types',
    filterUnknown: (type, allowed) =>
      `Unknown type: <code>${type}</code>\n\nAllowed: ${allowed}`,
    filterUpdated: (label) => `<b>Filter updated</b>\n\nReceiving: ${label}`,

    // ── /silent ───────────────────────────────────────────────────────
    silentUsage: () =>
      '<b>Usage:</b>\n' +
      '<code>/silent on</code> — Notifications without sound\n' +
      '<code>/silent off</code> — Notifications with sound',
    silentEnabled:
      'Silent mode enabled\n\nNotifications will arrive without sound.',
    silentDisabled:
      'Silent mode disabled\n\nNotifications will arrive with sound.',

    // ── /test ─────────────────────────────────────────────────────────
    testTitle: 'Test notification',
    testWorking: 'Notifications are working correctly for this chat.',
    testHotel: 'Hotel',
    testDept: 'Department',
    testSentAt: 'Sent at',
    testNotLinked: 'Not linked',

    // ── Errors ────────────────────────────────────────────────────────
    error: (msg) => `<b>Error:</b> ${msg}`,
  },

  ru: {
    // ── Welcome / Help ───────────────────────────────────────────────
    welcome: (isGroup) =>
      [
        '<b>FreshTrack — Бот инвентаризации</b>',
        '',
        'Этот бот отправляет уведомления об истечении сроков годности и ежедневные отчёты из FreshTrack.',
        '',
        isGroup
          ? '1. Используйте <code>/link КОД_ОТЕЛЯ:Отдел</code> для подключения\n2. Используйте <code>/help</code> для просмотра команд'
          : 'Используйте <code>/help</code> для просмотра всех команд.',
      ].join('\n'),

    help: (marshaExample) =>
      [
        '<b>FreshTrack Bot — Команды</b>',
        '',
        '<b>Настройка</b>',
        '/link <code>КОД[:Отдел]</code> — Подключить к отелю или отделу',
        '/unlink — Отключить этот чат',
        '/status — Показать детали подключения',
        '/departments — Список отделов отеля',
        '',
        '<b>Инвентарь</b>',
        '/report — Полный отчёт по инвентарю',
        '/summary — Краткая сводка',
        '',
        '<b>Уведомления</b>',
        '/notify <code>on|off</code> — Включить или выключить уведомления',
        '/filter <code>critical|warning|expired|all</code> — Фильтр типов',
        '/silent <code>on|off</code> — Переключить звук',
        '/snooze <code>1|2|4|8|24</code> — Пауза на N часов',
        '/snooze <code>off</code> — Отменить паузу',
        '/lang <code>en|ru|kk</code> — Язык сообщений',
        '',
        '<b>Прочее</b>',
        '/test — Тестовое уведомление',
        '/help — Показать это сообщение',
        '',
        '<b>Примеры:</b>',
        `<code>/link ${marshaExample}</code> — весь отель`,
        `<code>/link ${marshaExample}:Бар</code> — только отдел Бар`,
        '',
        'КОД_ОТЕЛЯ — это ваш MARSHA-код из FreshTrack Настройки → Организация',
      ].join('\n'),

    // ── /link ────────────────────────────────────────────────────────
    linkUsage: () =>
      '<b>Использование:</b>\n' +
      '<code>/link КОД_ОТЕЛЯ</code> — уведомления по всему отелю\n' +
      '<code>/link КОД_ОТЕЛЯ:Отдел</code> — только один отдел\n\n' +
      '<b>Примеры:</b>\n' +
      '<code>/link TSEXR</code> — весь отель\n' +
      '<code>/link TSEXR:Бар</code> — только Бар\n\n' +
      'Найдите MARSHA-код в FreshTrack Настройки → Организация',

    linkHotelNotFound: (code) =>
      `Отель не найден\n\nКод <code>${code}</code> не найден в FreshTrack.\n\nПроверьте MARSHA-код в Настройки → Организация`,

    linkDeptNotFound: (deptName, hotelName, deptList, marshaCode) =>
      `Отдел не найден: "${deptName}"\n\n<b>Доступные отделы в ${hotelName}:</b>\n${deptList}\n\nПопробуйте: <code>/link ${marshaCode}:Название отдела</code>`,

    linkSuccess: (hotelName, deptName) =>
      `<b>Чат подключён</b>\n\n<b>Отель:</b> ${hotelName}\n<b>Отдел:</b> ${deptName}\n\nТеперь вы будете получать уведомления об инвентаре в этом чате.\nИспользуйте /status для просмотра деталей или /report для немедленного отчёта.`,

    noDepts: '<i>Отделы не настроены</i>',
    allDepts: 'Все отделы',

    // ── /unlink ──────────────────────────────────────────────────────
    unlinkSuccess: () =>
      '<b>Чат отключён</b>\n\nЭтот чат был отвязан от FreshTrack. Уведомления больше не будут приходить.\n\nИспользуйте /link для повторного подключения.',

    // ── /status ──────────────────────────────────────────────────────
    statusTitle: 'Статус подключения',
    statusNotLinked: 'Не подключён\n\nИспользуйте /link для подключения.',
    statusConnected: 'Подключён',
    statusInactive: 'Неактивен',
    statusHotel: 'Отель',
    statusDept: 'Отдел',
    statusLang: 'Язык',
    statusNotifications: 'Уведомления',
    statusSilent: 'Тихий режим',
    statusActive: 'Активны',
    statusOn: 'Вкл',
    statusOff: 'Выкл',
    statusSnoozedUntil: (time) =>
      `Пауза до: ${time} (используйте /snooze off для отмены)`,
    statusNotifTypes: 'Типы уведомлений',

    // ── /departments ─────────────────────────────────────────────────
    deptsNotLinked:
      'Этот чат ещё не подключён к отелю.\n\nИспользуйте /link для подключения.',
    deptsNone: (hotelName) =>
      `<b>Отделы — ${hotelName}</b>\n\n<i>Отделы пока не настроены.</i>`,
    deptsList: (hotelName, list, marshaCode) =>
      `<b>Отделы — ${hotelName}</b>\n\n${list}\n\nДля уведомлений по конкретному отделу:\n<code>/link ${marshaCode}:Название отдела</code>`,

    // ── /report ──────────────────────────────────────────────────────
    reportNotLinked:
      'Этот чат не подключён к отелю.\n\nИспользуйте /link для подключения.',
    reportAllClear: (days) =>
      `<b>Всё в норме</b>\n\nПросроченных или истекающих позиций в ближайшие ${days} дн. не найдено.\n\n`,
    reportGenerated: 'Отчёт сформирован',
    reportHeader: (expiredCount, criticalCount, warningCount) =>
      `<b>Отчёт по инвентарю</b>\n\n🔴 Просрочено: <b>${expiredCount}</b>   🟠 Критично: <b>${criticalCount}</b>   🟡 Внимание: <b>${warningCount}</b>`,
    reportExpired: 'Просрочено',
    reportCritical: (days) => `Истекает через ${days} дн.`,
    reportWarning: (days) => `Истекает через ${days} дн.`,
    reportQty: 'Кол',
    reportExp: 'Дата',
    reportMore: (n) => `...и ещё ${n} позиций`,

    // ── /summary ─────────────────────────────────────────────────────
    summaryTitle: 'Сводка по инвентарю',
    summaryExpired: 'Просрочено',
    summaryCritical: (days) => `Критично (≤${days} дн.)`,
    summaryWarning: (days) => `Внимание (≤${days} дн.)`,
    summaryOk: 'В норме',
    summaryTotal: 'Всего партий',
    summaryNoAttention: 'Позиций, требующих внимания, нет.',
    summaryUseReport: 'Используйте /report для полного списка.',

    // ── /snooze ──────────────────────────────────────────────────────
    snoozeUsage: (opts) =>
      `<b>Пауза уведомлений</b>\n\n${opts}\n<code>/snooze off</code> — Отменить паузу\n\n<i>Пауза временно останавливает все уведомления в этом чате.</i>`,
    snoozeCancelled: 'Пауза отменена\n\nУведомления снова активны.',
    snoozeInvalidDuration: (allowed) =>
      `Недопустимая длительность. Разрешено: ${allowed} часов, или <code>off</code>`,
    snoozeSet: (until) =>
      `Уведомления поставлены на паузу до <b>${until}</b>.\n\nИспользуйте <code>/snooze off</code> для досрочной отмены.`,

    // ── /lang ─────────────────────────────────────────────────────────
    langUsage: () =>
      '<b>Язык чата</b>\n\n' +
      '<code>/lang en</code> — English\n' +
      '<code>/lang ru</code> — Русский\n' +
      '<code>/lang kk</code> — Қазақша',
    langUnsupported: (lang, supported) =>
      `Неподдерживаемый язык: <code>${lang}</code>\n\nДоступные: ${supported}`,
    langSet: (name) =>
      `<b>Язык установлен: ${name}</b>\n\nСообщения в этом чате теперь будут на ${name}.`,

    // ── /notify ───────────────────────────────────────────────────────
    notifyUsage: () =>
      '<b>Использование:</b>\n' +
      '<code>/notify on</code> — Включить уведомления\n' +
      '<code>/notify off</code> — Выключить уведомления',
    notifyEnabled:
      'Уведомления включены\n\nВы будете получать уведомления об инвентаре в этом чате.',
    notifyDisabled:
      'Уведомления выключены\n\nИспользуйте <code>/notify on</code> для включения.',

    // ── /filter ───────────────────────────────────────────────────────
    filterUsage: () =>
      '<b>Использование:</b>\n' +
      '<code>/filter critical</code> — Только критичные (≤3 дн.)\n' +
      '<code>/filter warning</code> — Внимание (4–7 дн.)\n' +
      '<code>/filter expired</code> — Только просроченные\n' +
      '<code>/filter all</code> — Все типы уведомлений',
    filterUnknown: (type, allowed) =>
      `Неизвестный тип: <code>${type}</code>\n\nДопустимые: ${allowed}`,
    filterUpdated: (label) => `<b>Фильтр обновлён</b>\n\nПолучаете: ${label}`,

    // ── /silent ───────────────────────────────────────────────────────
    silentUsage: () =>
      '<b>Использование:</b>\n' +
      '<code>/silent on</code> — Уведомления без звука\n' +
      '<code>/silent off</code> — Уведомления со звуком',
    silentEnabled:
      'Тихий режим включён\n\nУведомления будут приходить без звука.',
    silentDisabled:
      'Тихий режим выключен\n\nУведомления будут приходить со звуком.',

    // ── /test ─────────────────────────────────────────────────────────
    testTitle: 'Тестовое уведомление',
    testWorking: 'Уведомления в этом чате работают корректно.',
    testHotel: 'Отель',
    testDept: 'Отдел',
    testSentAt: 'Отправлено',
    testNotLinked: 'Не подключено',

    // ── Errors ────────────────────────────────────────────────────────
    error: (msg) => `<b>Ошибка:</b> ${msg}`,
  },

  kk: {
    // ── Welcome / Help ───────────────────────────────────────────────
    welcome: (isGroup) =>
      [
        '<b>FreshTrack — Инвентарь боты</b>',
        '',
        'Бұл бот FreshTrack жүйесінен жарамдылық мерзімі туралы хабарландырулар мен күнделікті есептерді жібереді.',
        '',
        isGroup
          ? '1. Осы чатты қосу үшін <code>/link ҚОНАҚҮЙ_КОДЫ:Бөлім</code> қолданыңыз\n2. Барлық командаларды көру үшін <code>/help</code>'
          : 'Барлық командаларды көру үшін <code>/help</code> қолданыңыз.',
      ].join('\n'),

    help: (marshaExample) =>
      [
        '<b>FreshTrack Bot — Командалар</b>',
        '',
        '<b>Баптау</b>',
        '/link <code>КОД[:Бөлім]</code> — Қонақүй немесе бөлімге қосу',
        '/unlink — Чатты ажырату',
        '/status — Қосылым мәліметтері',
        '/departments — Қонақүй бөлімдерінің тізімі',
        '',
        '<b>Инвентарь</b>',
        '/report — Толық инвентарь есебі',
        '/summary — Қысқаша шолу',
        '',
        '<b>Хабарландырулар</b>',
        '/notify <code>on|off</code> — Хабарландыруларды қосу/өшіру',
        '/filter <code>critical|warning|expired|all</code> — Түрлерді сүзу',
        '/silent <code>on|off</code> — Дыбысты ауыстыру',
        '/snooze <code>1|2|4|8|24</code> — N сағатқа кідірту',
        '/snooze <code>off</code> — Кідіртуді болдырмау',
        '/lang <code>en|ru|kk</code> — Хабарлама тілі',
        '',
        '<b>Басқа</b>',
        '/test — Сынақ хабарландыру',
        '/help — Осы хабарламаны көрсету',
        '',
        '<b>Мысалдар:</b>',
        `<code>/link ${marshaExample}</code> — бүкіл қонақүй`,
        `<code>/link ${marshaExample}:Бар</code> — тек Бар бөлімі`,
        '',
        'ҚОНАҚҮЙ_КОДЫ — FreshTrack Баптаулар → Ұйым бөлімінен алатын MARSHA коды',
      ].join('\n'),

    // ── /link ────────────────────────────────────────────────────────
    linkUsage: () =>
      '<b>Пайдалану:</b>\n' +
      '<code>/link ҚОНАҚҮЙ_КОДЫ</code> — бүкіл қонақүй хабарландырулары\n' +
      '<code>/link ҚОНАҚҮЙ_КОДЫ:Бөлім</code> — тек бір бөлім\n\n' +
      '<b>Мысалдар:</b>\n' +
      '<code>/link TSEXR</code> — бүкіл қонақүй\n' +
      '<code>/link TSEXR:Бар</code> — тек Бар бөлімі\n\n' +
      'MARSHA кодын FreshTrack Баптаулар → Ұйым бөлімінен табыңыз',

    linkHotelNotFound: (code) =>
      `Қонақүй табылмады\n\n<code>${code}</code> коды FreshTrack жүйесінде жоқ.\n\nБаптаулар → Ұйым бөлімінде MARSHA кодыңызды тексеріңіз`,

    linkDeptNotFound: (deptName, hotelName, deptList, marshaCode) =>
      `Бөлім табылмады: "${deptName}"\n\n<b>${hotelName} қонақүйіндегі бөлімдер:</b>\n${deptList}\n\nКөріңіз: <code>/link ${marshaCode}:Бөлім аты</code>`,

    linkSuccess: (hotelName, deptName) =>
      `<b>Чат қосылды</b>\n\n<b>Қонақүй:</b> ${hotelName}\n<b>Бөлім:</b> ${deptName}\n\nЕнді инвентарь туралы хабарландыруларды осы чатта аласыз.\nМәліметтер үшін /status немесе есеп үшін /report қолданыңыз.`,

    noDepts: '<i>Бөлімдер баптанбаған</i>',
    allDepts: 'Барлық бөлімдер',

    // ── /unlink ──────────────────────────────────────────────────────
    unlinkSuccess: () =>
      '<b>Чат ажыратылды</b>\n\nБұл чат FreshTrack жүйесінен ажыратылды. Хабарландырулар жіберілмейді.\n\nҚайта қосу үшін /link қолданыңыз.',

    // ── /status ──────────────────────────────────────────────────────
    statusTitle: 'Қосылым күйі',
    statusNotLinked: 'Қосылмаған\n\nҚосылу үшін /link қолданыңыз.',
    statusConnected: 'Қосылған',
    statusInactive: 'Белсенді емес',
    statusHotel: 'Қонақүй',
    statusDept: 'Бөлім',
    statusLang: 'Тіл',
    statusNotifications: 'Хабарландырулар',
    statusSilent: 'Үнсіз режим',
    statusActive: 'Белсенді',
    statusOn: 'Қосулы',
    statusOff: 'Өшірулі',
    statusSnoozedUntil: (time) =>
      `Кідіртілген: ${time} дейін (/snooze off — болдырмау)`,
    statusNotifTypes: 'Хабарландыру түрлері',

    // ── /departments ─────────────────────────────────────────────────
    deptsNotLinked:
      'Бұл чат әлі қонақүйге қосылмаған.\n\nҚосылу үшін /link қолданыңыз.',
    deptsNone: (hotelName) =>
      `<b>Бөлімдер — ${hotelName}</b>\n\n<i>Бөлімдер әлі баптанбаған.</i>`,
    deptsList: (hotelName, list, marshaCode) =>
      `<b>Бөлімдер — ${hotelName}</b>\n\n${list}\n\nБелгілі бір бөлім үшін:\n<code>/link ${marshaCode}:Бөлім аты</code>`,

    // ── /report ──────────────────────────────────────────────────────
    reportNotLinked:
      'Бұл чат қонақүйге қосылмаған.\n\nҚосылу үшін /link қолданыңыз.',
    reportAllClear: (days) =>
      `<b>Бәрі жақсы</b>\n\nКелесі ${days} күнде мерзімі өткен немесе аяқталатын тауарлар жоқ.\n\n`,
    reportGenerated: 'Есеп жасалды',
    reportHeader: (expiredCount, criticalCount, warningCount) =>
      `<b>Инвентарь есебі</b>\n\n🔴 Мерзімі өткен: <b>${expiredCount}</b>   🟠 Сын: <b>${criticalCount}</b>   🟡 Назар: <b>${warningCount}</b>`,
    reportExpired: 'Мерзімі өткен',
    reportCritical: (days) => `${days} күн ішінде аяқталады`,
    reportWarning: (days) => `${days} күн ішінде аяқталады`,
    reportQty: 'Саны',
    reportExp: 'Күні',
    reportMore: (n) => `...және тағы ${n} позиция`,

    // ── /summary ─────────────────────────────────────────────────────
    summaryTitle: 'Инвентарь жиынтығы',
    summaryExpired: 'Мерзімі өткен',
    summaryCritical: (days) => `Сын (≤${days} күн)`,
    summaryWarning: (days) => `Назар (≤${days} күн)`,
    summaryOk: 'Жақсы',
    summaryTotal: 'Барлық партия',
    summaryNoAttention: 'Назар аударуды қажет ететін тауарлар жоқ.',
    summaryUseReport: 'Толық тізім үшін /report қолданыңыз.',

    // ── /snooze ──────────────────────────────────────────────────────
    snoozeUsage: (opts) =>
      `<b>Хабарландыруларды кідірту</b>\n\n${opts}\n<code>/snooze off</code> — Кідіртуді болдырмау\n\n<i>Кідірту осы чаттағы барлық хабарландыруларды уақытша тоқтатады.</i>`,
    snoozeCancelled: 'Кідірту болдырылмады\n\nХабарландырулар қайта белсенді.',
    snoozeInvalidDuration: (allowed) =>
      `Қате ұзақтық. Рұқсат етілген: ${allowed} сағат, немесе <code>off</code>`,
    snoozeSet: (until) =>
      `Хабарландырулар <b>${until}</b> дейін кідіртілді.\n\nМезгілсіз болдырмау үшін <code>/snooze off</code>.`,

    // ── /lang ─────────────────────────────────────────────────────────
    langUsage: () =>
      '<b>Чат тілі</b>\n\n' +
      '<code>/lang en</code> — English\n' +
      '<code>/lang ru</code> — Русский\n' +
      '<code>/lang kk</code> — Қазақша',
    langUnsupported: (lang, supported) =>
      `Қолдау көрсетілмейтін тіл: <code>${lang}</code>\n\nҚолжетімді: ${supported}`,
    langSet: (name) =>
      `<b>Тіл орнатылды: ${name}</b>\n\nБұл чаттағы хабарламалар ${name} тілінде жіберіледі.`,

    // ── /notify ───────────────────────────────────────────────────────
    notifyUsage: () =>
      '<b>Пайдалану:</b>\n' +
      '<code>/notify on</code> — Хабарландыруларды қосу\n' +
      '<code>/notify off</code> — Хабарландыруларды өшіру',
    notifyEnabled:
      'Хабарландырулар қосылды\n\nИнвентарь туралы хабарландырулар осы чатқа жіберіледі.',
    notifyDisabled:
      'Хабарландырулар өшірілді\n\nҚосу үшін <code>/notify on</code> қолданыңыз.',

    // ── /filter ───────────────────────────────────────────────────────
    filterUsage: () =>
      '<b>Пайдалану:</b>\n' +
      '<code>/filter critical</code> — Тек сыни (≤3 күн)\n' +
      '<code>/filter warning</code> — Назар (4–7 күн)\n' +
      '<code>/filter expired</code> — Тек мерзімі өткен\n' +
      '<code>/filter all</code> — Барлық түрлер',
    filterUnknown: (type, allowed) =>
      `Белгісіз түр: <code>${type}</code>\n\nРұқсат етілген: ${allowed}`,
    filterUpdated: (label) => `<b>Сүзгі жаңартылды</b>\n\nАласыз: ${label}`,

    // ── /silent ───────────────────────────────────────────────────────
    silentUsage: () =>
      '<b>Пайдалану:</b>\n' +
      '<code>/silent on</code> — Дыбыссыз хабарландырулар\n' +
      '<code>/silent off</code> — Дыбыспен хабарландырулар',
    silentEnabled: 'Үнсіз режим қосылды\n\nХабарландырулар дыбыссыз келеді.',
    silentDisabled: 'Үнсіз режим өшірілді\n\nХабарландырулар дыбыспен келеді.',

    // ── /test ─────────────────────────────────────────────────────────
    testTitle: 'Сынақ хабарландыру',
    testWorking: 'Осы чаттағы хабарландырулар дұрыс жұмыс істейді.',
    testHotel: 'Қонақүй',
    testDept: 'Бөлім',
    testSentAt: 'Жіберілді',
    testNotLinked: 'Қосылмаған',

    // ── Errors ────────────────────────────────────────────────────────
    error: (msg) => `<b>Қате:</b> ${msg}`,
  },
}

/**
 * Get translations for a given language code.
 * Falls back to English for unknown or missing keys.
 */
export function t(lang) {
  return i18n[lang] || i18n.en
}
