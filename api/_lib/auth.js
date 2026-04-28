import { sendJson } from './http.js'

function readBasicAuth(request) {
  const header = request.headers.authorization || request.headers.Authorization || ''
  if (!header.startsWith('Basic ')) {
    return null
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
    const separatorIndex = decoded.indexOf(':')
    if (separatorIndex === -1) {
      return null
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    }
  } catch {
    return null
  }
}

export function requireAdminEnv(response) {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    sendJson(
      response,
      { error: 'ADMIN_USERNAME and ADMIN_PASSWORD must be configured on the server.' },
      500,
    )
    return false
  }

  return true
}

export function validateAdminRequest(request, response) {
  if (!requireAdminEnv(response)) {
    return false
  }

  const credentials = readBasicAuth(request)
  if (
    !credentials ||
    credentials.username !== process.env.ADMIN_USERNAME ||
    credentials.password !== process.env.ADMIN_PASSWORD
  ) {
    sendJson(response, { error: 'Invalid admin credentials.' }, 401)
    return false
  }

  return true
}
