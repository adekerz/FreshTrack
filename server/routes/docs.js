/**
 * Swagger/OpenAPI Documentation Routes
 * 
 * Предоставляет документацию API через Swagger UI
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

/**
 * GET /api/docs/openapi.yaml
 * Возвращает OpenAPI спецификацию в YAML формате
 */
router.get('/openapi.yaml', (req, res) => {
  try {
    const specPath = path.join(__dirname, '../../docs/api/openapi.yaml')
    
    if (!fs.existsSync(specPath)) {
      return res.status(404).json({ error: 'OpenAPI specification not found' })
    }
    
    res.setHeader('Content-Type', 'application/yaml')
    res.sendFile(specPath)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load API specification' })
  }
})

/**
 * GET /api/docs/openapi.json
 * Возвращает OpenAPI спецификацию в JSON формате
 */
router.get('/openapi.json', async (req, res) => {
  try {
    const specPath = path.join(__dirname, '../../docs/api/openapi.yaml')
    
    if (!fs.existsSync(specPath)) {
      return res.status(404).json({ error: 'OpenAPI specification not found' })
    }
    
    // Dynamic import of yaml parser
    const yaml = await import('yaml')
    const yamlContent = fs.readFileSync(specPath, 'utf8')
    const jsonSpec = yaml.parse(yamlContent)
    
    res.json(jsonSpec)
  } catch (error) {
    // If yaml module not available, return error
    res.status(500).json({ 
      error: 'Failed to parse API specification',
      hint: 'Install yaml package: npm install yaml'
    })
  }
})

/**
 * GET /api/docs
 * Swagger UI HTML страница
 */
router.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreshTrack API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 2em; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>
  `.trim()
  
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

export default router
