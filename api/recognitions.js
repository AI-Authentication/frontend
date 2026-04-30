import { proxyBackendJson } from './_lib/backend.js'
import { listStoredProfiles } from './_lib/db.js'
import { methodNotAllowed, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(response)
  }

  const body = await readJsonBody(request)
  const image = String(body?.image || '')
  const selectedProfileId = body?.selectedProfileId
  const requestedReferenceProfile =
    body?.referenceProfile && typeof body.referenceProfile === 'object' ? body.referenceProfile : null

  if (!image) {
    return sendJson(response, { error: 'An image is required.' }, 400)
  }

  try {
    const profiles = await listStoredProfiles()
    const selected =
      profiles.find((profile) => String(profile.id) === String(selectedProfileId)) || profiles[0] || null

    if (!selected) {
      return sendJson(response, { error: 'No enrolled profiles are available.' }, 404)
    }

    return proxyBackendJson(response, '/recognition', {
      image,
      selectedProfileId,
      referenceProfile: selected,
    })
  } catch (error) {
    if (!requestedReferenceProfile) {
      return sendJson(response, { error: error.message || 'Recognition failed.' }, 500)
    }

    return proxyBackendJson(response, '/recognition', {
      image,
      selectedProfileId,
      referenceProfile: requestedReferenceProfile,
    })
  }
}
