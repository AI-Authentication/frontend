import { sendJson } from './http.js'

function getBackendBaseUrl() {
  return String(process.env.BACKEND_API_BASE_URL || '').replace(/\/$/, '')
}

function buildBackendHeaders() {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }

  if (process.env.BACKEND_API_USERNAME && process.env.BACKEND_API_PASSWORD) {
    const token = Buffer.from(
      `${process.env.BACKEND_API_USERNAME}:${process.env.BACKEND_API_PASSWORD}`,
      'utf8',
    ).toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  return headers
}

export async function proxyBackendJson(response, path, payload) {
  const baseUrl = getBackendBaseUrl()

  if (!baseUrl) {
    return sendJson(response, { error: 'BACKEND_API_BASE_URL is not configured.' }, 500)
  }

  try {
    const backendResponse = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: buildBackendHeaders(),
      body: JSON.stringify(payload),
    })

    const contentType = backendResponse.headers.get('content-type') || ''
    const body = contentType.includes('application/json')
      ? await backendResponse.json()
      : { error: await backendResponse.text() }

    if (!backendResponse.ok) {
      const message = body?.error || body?.message || `Backend request failed with status ${backendResponse.status}`
      return sendJson(response, { error: message, details: body }, backendResponse.status)
    }

    return sendJson(response, body)
  } catch (error) {
    return sendJson(response, { error: error.message || 'External backend request failed.' }, 502)
  }
}
