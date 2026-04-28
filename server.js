import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import adminLoginHandler from './api/admin/login.js'
import fgsmHandler from './api/attacks/fgsm.js'
import healthHandler from './api/health.js'
import profilesHandler from './api/profiles.js'
import profileByIdHandler from './api/profiles/[id].js'
import recognitionHandler from './api/recognitions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = Number(process.env.PORT || 3000)
const distDir = path.join(__dirname, 'dist')

app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: false, limit: '25mb' }))

app.get('/api/health', healthHandler)
app.all('/api/profiles', profilesHandler)
app.all('/api/profiles/:id', (request, response) => {
  return profileByIdHandler(request, response)
})
app.post('/api/admin/login', adminLoginHandler)
app.post('/api/recognitions', recognitionHandler)
app.post('/api/attacks/fgsm', fgsmHandler)

app.use(express.static(distDir))

app.use((request, response) => {
  response.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`Home server listening on http://0.0.0.0:${port}`)
})
