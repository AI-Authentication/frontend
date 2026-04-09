const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const endpoints = {
  health: '/api/health',
  profiles: '/api/profiles',
  recognition: '/api/recognitions',
  fgsmAttack: '/api/attacks/fgsm',
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function request(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.error || payload?.message || `Request failed with status ${response.status}`

    throw new Error(message)
  }

  return payload
}

function pickProfileImage(profile) {
  return (
    profile.image ||
    profile.imageUrl ||
    profile.thumbnailUrl ||
    profile.previewImage ||
    profile.photos?.[0] ||
    ''
  )
}

export function normalizeProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    image: pickProfileImage(profile),
    photos: Array.isArray(profile.photos) ? profile.photos : [],
  }
}

export async function getHealth() {
  return request(endpoints.health)
}

export async function listProfiles() {
  const payload = await request(endpoints.profiles)
  const profiles = Array.isArray(payload) ? payload : payload?.profiles || []
  return profiles.map(normalizeProfile)
}

export async function createProfile({ name, captures }) {
  const payload = await request(endpoints.profiles, {
    method: 'POST',
    body: JSON.stringify({
      name,
      captures,
    }),
  })

  return normalizeProfile(payload?.profile || payload)
}

export async function recognizeFace({ image }) {
  return request(endpoints.recognition, {
    method: 'POST',
    body: JSON.stringify({ image }),
  })
}

export async function runFgsmAttack({ image, targetProfileId, epsilon }) {
  return request(endpoints.fgsmAttack, {
    method: 'POST',
    body: JSON.stringify({
      image,
      targetProfileId,
      epsilon,
    }),
  })
}

export { API_BASE_URL, endpoints }
