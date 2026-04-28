import { methodNotAllowed, sendJson } from './_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return methodNotAllowed(response)
  }

  return sendJson(response, { ok: true, service: 'face-auth-demo-api' })
}
