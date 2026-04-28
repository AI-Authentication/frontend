import { createStoredProfile, listStoredProfiles } from './_lib/db.js'
import { methodNotAllowed, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(request, response) {
  if (request.method === 'GET') {
    try {
      const profiles = await listStoredProfiles()
      return sendJson(response, { profiles })
    } catch (error) {
      return sendJson(response, { error: error.message || 'Failed to load profiles.' }, 500)
    }
  }

  if (request.method === 'POST') {
    const body = await readJsonBody(request)
    const name = String(body?.name || '').trim()
    const captures = body?.captures && typeof body.captures === 'object' ? body.captures : {}

    if (!name) {
      return sendJson(response, { error: 'Name is required.' }, 400)
    }

    if (!captures.front) {
      return sendJson(response, { error: 'At least a front capture is required.' }, 400)
    }

    try {
      const profile = await createStoredProfile({ name, captures })
      return sendJson(response, { profile }, 201)
    } catch (error) {
      return sendJson(response, { error: error.message || 'Failed to create profile.' }, 500)
    }
  }

  return methodNotAllowed(response)
}
