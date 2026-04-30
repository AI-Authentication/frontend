import { proxyBackendJson } from '../_lib/backend.js'
import { listStoredProfiles } from '../_lib/db.js'
import { methodNotAllowed, readJsonBody, sendJson } from '../_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(response)
  }

  const body = await readJsonBody(request)
  const image = String(body?.image || '')
  const targetProfileId = body?.targetProfileId
  const requestedTargetProfile =
    body?.targetProfile && typeof body.targetProfile === 'object' ? body.targetProfile : null

  if (!image) {
    return sendJson(response, { error: 'An image is required.' }, 400)
  }

  try {
    const profiles = await listStoredProfiles()
    const target =
      profiles.find((profile) => String(profile.id) === String(targetProfileId)) || profiles[0] || null

    if (!target) {
      return sendJson(response, { error: 'No target profile is available.' }, 404)
    }

    return proxyBackendJson(response, '/fgsm', {
      image,
      targetProfileId,
      targetProfile: target,
    })
  } catch (error) {
    if (!requestedTargetProfile) {
      return sendJson(response, { error: error.message || 'FGSM attack failed.' }, 500)
    }

    return proxyBackendJson(response, '/fgsm', {
      image,
      targetProfileId,
      targetProfile: requestedTargetProfile,
    })
  }
}
