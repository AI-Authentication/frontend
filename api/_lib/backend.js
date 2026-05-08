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

async function callBackend(path, payload) {
  const baseUrl = getBackendBaseUrl()

  if (!baseUrl) {
    throw new Error('BACKEND_API_BASE_URL is not configured.')
  }

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
    const error = new Error(message)
    error.status = backendResponse.status
    error.details = body
    throw error
  }

  return body
}

export async function requestBackendJson(path, payload) {
  return callBackend(path, payload)
}

export async function proxyBackendJson(response, path, payload) {
  try {
    const body = await callBackend(path, payload)
    return sendJson(response, body)
  } catch (error) {
    const status = Number(error?.status) || 502
    return sendJson(
      response,
      { error: error.message || 'External backend request failed.', ...(error?.details ? { details: error.details } : {}) },
      status,
    )
  }
}
