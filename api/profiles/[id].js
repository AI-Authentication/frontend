import { validateAdminRequest } from '../_lib/auth.js'
import { deleteStoredProfile } from '../_lib/db.js'
import { methodNotAllowed, sendJson } from '../_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'DELETE') {
    return methodNotAllowed(response)
  }

  if (!validateAdminRequest(request, response)) {
    return
  }

  const profileId = request.query?.id

  if (!profileId || Number.isNaN(Number(profileId))) {
    return sendJson(response, { error: 'A numeric profile id is required.' }, 400)
  }

  try {
    const deleted = await deleteStoredProfile(profileId)
    if (!deleted) {
      return sendJson(response, { error: 'Profile not found.' }, 404)
    }

    return sendJson(response, { ok: true, deletedProfileId: Number(profileId) })
  } catch (error) {
    return sendJson(response, { error: error.message || 'Failed to delete profile.' }, 500)
  }
}
