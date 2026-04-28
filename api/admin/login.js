import { validateAdminRequest } from '../_lib/auth.js'
import { methodNotAllowed, sendJson } from '../_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(response)
  }

  if (!validateAdminRequest(request, response)) {
    return
  }

  return sendJson(response, { ok: true })
}
