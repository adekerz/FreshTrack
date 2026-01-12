
/**
 * PUT Endpoints Audit
 * Проверка всех PUT endpoints в системе
 */

// ============================================
// BACKEND PUT ENDPOINTS (27 total)
// ============================================

const backendEndpoints = [
    // AUTH MODULE
    { path: 'PUT /api/auth/password', controller: 'auth.controller.js:403', status: '✅' },
    { path: 'PUT /api/auth/users/:id', controller: 'auth.controller.js:530', status: '✅' },
    { path: 'PATCH /api/auth/users/:id/toggle', controller: 'auth.controller.js:636', status: '✅' },

    // COLLECTIONS MODULE  
    { path: 'PUT /api/collections/:id', controller: 'collections.controller.js:106', status: '✅' },

    // CUSTOM CONTENT MODULE
    { path: 'PUT /api/custom-content/:key', controller: 'custom-content.controller.js:139', status: '✅' },
    { path: 'PUT /api/custom-content/', controller: 'custom-content.controller.js:173', status: '✅' },

    // DELIVERY TEMPLATES MODULE
    { path: 'PUT /api/delivery-templates/:id', controller: 'delivery-templates.controller.js:96', status: '✅' },

    // DEPARTMENT SETTINGS MODULE
    { path: 'PUT /api/department-settings/:departmentId', controller: 'department-settings.controller.js:99', status: '✅' },

    // DEPARTMENTS MODULE
    { path: 'PUT /api/departments/:id', controller: 'departments.controller.js:114', status: '✅' },

    // HOTELS MODULE
    { path: 'PUT /api/hotels/:id', controller: 'hotels.controller.js:112', status: '✅' },

    // INVENTORY MODULE
    { path: 'PUT /api/batches/:id', controller: 'inventory.controller.js:361', status: '✅' },
    { path: 'PUT /api/products/:id', controller: 'inventory.controller.js:854', status: '✅ NEW' },

    // NOTIFICATION RULES MODULE
    { path: 'PATCH /api/notification-rules/:id/toggle', controller: 'notification-rules.controller.js:82', status: '✅' },
    { path: 'PUT /api/notification-rules/telegram-chats/:id', controller: 'notification-rules.controller.js:156', status: '✅' },

    // NOTIFICATIONS MODULE
    { path: 'PUT /api/notifications/:id/read', controller: 'notifications.controller.js:212', status: '✅' },
    { path: 'PUT /api/notifications/read-all', controller: 'notifications.controller.js:240', status: '✅' },

    // SETTINGS MODULE
    { path: 'PUT /api/settings/branding', controller: 'settings.controller.js:108', status: '✅' },
    { path: 'PUT /api/settings/general', controller: 'settings.controller.js:229', status: '✅' },
    { path: 'PUT /api/settings/telegram', controller: 'settings.controller.js:309', status: '✅' },
    { path: 'PUT /api/settings/telegram/chats/:chatId', controller: 'settings.controller.js:366', status: '✅' },
    { path: 'PUT /api/settings/login-branding', controller: 'settings.controller.js:476', status: '✅' },
    { path: 'PUT /api/settings/user/:key', controller: 'settings.controller.js:577', status: '✅' },
    { path: 'PUT /api/settings/department/:key', controller: 'settings.controller.js:660', status: '✅' },
    { path: 'PUT /api/settings/hotel/:key', controller: 'settings.controller.js:726', status: '✅' },
    { path: 'PUT /api/settings/system/:key', controller: 'settings.controller.js:796', status: '✅' },
    { path: 'PUT /api/settings/notifications/rules', controller: 'settings.controller.js:984', status: '✅' },

    // WRITE-OFFS MODULE
    { path: 'PUT /api/write-offs/:id', controller: 'write-offs.controller.js:166', status: '✅' },
]

// ============================================
// FRONTEND PUT CALLS (10 total)
// ============================================

const frontendCalls = [
    { file: 'api.js:117', endpoint: 'PUT /products/:id', backend: 'inventory.controller.js:854', match: '✅' },
    { file: 'NotificationRulesPage.jsx:95', endpoint: 'PUT /settings/notifications/rules', backend: 'settings.controller.js:984', match: '✅' },
    { file: 'BrandingContext.jsx:195', endpoint: 'PUT /settings/branding', backend: 'settings.controller.js:108', match: '✅' },
    { file: 'DepartmentNotificationSettings.jsx:46', endpoint: 'PUT /department-settings/:id', backend: 'department-settings.controller.js:99', match: '✅' },
    { file: 'CustomContentSettings.jsx:54', endpoint: 'PUT /custom-content/:key', backend: 'custom-content.controller.js:139', match: '✅' },
    { file: 'BrandingSettings.jsx:109', endpoint: 'PUT /settings/branding', backend: 'settings.controller.js:108', match: '✅' },
    { file: 'TemplatesSettings.jsx:103', endpoint: 'PUT /delivery-templates/:id', backend: 'delivery-templates.controller.js:96', match: '✅' },
    { file: 'TelegramSettings.jsx:95', endpoint: 'PUT /settings/telegram', backend: 'settings.controller.js:309', match: '✅' },
    { file: 'TelegramSettings.jsx:136', endpoint: 'PUT /settings/telegram/chats/:chatId', backend: 'settings.controller.js:366', match: '✅' },
    { file: 'GeneralSettings.jsx:63', endpoint: 'PUT /settings/general', backend: 'settings.controller.js:229', match: '✅' },
]

// ============================================
// MISSING/UNUSED ENDPOINTS ANALYSIS
// ============================================

const analysis = {
    missingFrontendFor: [
        // Backend endpoints without frontend calls
        'PUT /api/auth/password - needs frontend in profile settings',
        'PUT /api/auth/users/:id - needs frontend in user management',
        'PATCH /api/auth/users/:id/toggle - may be used via different method',
        'PUT /api/collections/:id - inventory collection edit',
        'PUT /api/departments/:id - department edit',
        'PUT /api/hotels/:id - hotel edit',
        'PUT /api/batches/:id - batch edit',
        'PUT /api/notifications/:id/read - notification read',
        'PUT /api/notifications/read-all - read all notifications',
        'PUT /api/write-offs/:id - write-off edit',
    ],

    missingCategories: [
        'PUT /api/categories/:id - ❌ NOT IMPLEMENTED - needed for category edit',
    ],

    recommendations: [
        '1. Add PUT /api/categories/:id for category editing',
        '2. Verify all PUT endpoints use getEffectiveHotelId(req) for SUPER_ADMIN support',
        '3. Add frontend UI for editing departments, hotels, batches where missing',
    ]
}

console.log('=== PUT ENDPOINTS AUDIT ===')
console.log(`Backend endpoints: ${backendEndpoints.length}`)
console.log(`Frontend calls: ${frontendCalls.length}`)
console.log('\nMissing category edit endpoint!')
console.log('Run: node db/audit-put-endpoints.js for full report')
