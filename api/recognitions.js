import { requestBackendJson } from './_lib/backend.js'
import { listStoredProfiles } from './_lib/db.js'
import { methodNotAllowed, readJsonBody, sendJson } from './_lib/http.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return methodNotAllowed(response)
  }

  const body = await readJsonBody(request)
  const image = String(body?.image || '')

  if (!image) {
    return sendJson(response, { error: 'An image is required.' }, 400)
  }

  try {
    const profiles = await listStoredProfiles()

    if (profiles.length === 0) {
      return sendJson(response, { error: 'No enrolled profiles are available.' }, 404)
    }

    let bestResult = null
    let bestProfile = null
    let bestConfidence = -Infinity
    let foundComparableResult = false

    for (const profile of profiles) {
      let result
      try {
        result = await requestBackendJson('/recognition', {
          image,
          selectedProfileId: String(profile.id),
          referenceProfile: profile,
        })
      } catch (error) {
        // A single invalid comparison should not fail full-database recognition.
        // Treat backend validation failures as a non-match and continue scanning.
        if (Number(error?.status) === 422) {
          continue
        }
        throw error
      }

      const confidence = Number(result?.confidence)
      const normalizedConfidence = Number.isFinite(confidence) ? confidence : -Infinity
      if (normalizedConfidence > bestConfidence) {
        bestResult = result
        bestProfile = profile
        bestConfidence = normalizedConfidence
        foundComparableResult = true
      }
    }

    if (!foundComparableResult) {
      return sendJson(response, {
        isMatch: false,
        matchFound: false,
        message: 'No match found.',
      })
    }

    return sendJson(response, {
      ...bestResult,
      isMatch: true,
      matchFound: true,
      matchedProfileId: bestProfile?.id,
      matchedName: bestProfile?.name,
      match: bestProfile,
      message: bestResult?.message || 'Recognition complete',
    })
  } catch (error) {
    return sendJson(response, { error: error.message || 'Recognition failed.' }, 500)
  }
}
