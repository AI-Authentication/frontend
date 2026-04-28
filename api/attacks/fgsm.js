import { listStoredProfiles } from '../_lib/db.js'
import { methodNotAllowed, readJsonBody, sendJson } from '../_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(response)
  }

  const body = await readJsonBody(request)
  const image = String(body?.image || '')
  const targetProfileId = body?.targetProfileId
  const epsilon = Number(body?.epsilon || 0)

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

    return sendJson(response, {
      targetProfileId: target.id,
      targetName: target.name,
      epsilon,
      adversarialImage: image,
      perturbationImage: '',
      message:
        'Placeholder FGSM response. Replace this with the backend attack pipeline that generates perturbation output.',
    })
  } catch (error) {
    return sendJson(response, { error: error.message || 'FGSM attack failed.' }, 500)
  }
}
