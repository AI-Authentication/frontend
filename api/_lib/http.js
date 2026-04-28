export function sendJson(response, payload, status = 200) {
  response.status(status).setHeader('Cache-Control', 'no-store').json(payload)
}

export async function readJsonBody(request) {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body)
    } catch {
      return {}
    }
  }

  if (request.body && typeof request.body === 'object') {
    return request.body
  }

  try {
    const chunks = []
    for await (const chunk of request) {
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function methodNotAllowed(response) {
  return sendJson(response, { error: 'Method not allowed.' }, 405)
}
