import { Pool } from 'pg'

let schemaReadyPromise
let pool

function getPool() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl })
  }

  return pool
}

async function ensureSchema(db) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        captures JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  await schemaReadyPromise
}

function mapProfileRow(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image_url,
    imageUrl: row.image_url,
    captures: row.captures || {},
    photos: row.captures ? Object.values(row.captures).filter(Boolean) : [],
    createdAt: row.created_at,
  }
}

export async function listStoredProfiles() {
  const db = getPool()
  await ensureSchema(db)
  const { rows } = await db.query(
    `SELECT id, name, image_url, captures, created_at
     FROM profiles
     ORDER BY created_at DESC, id DESC`,
  )
  return rows.map(mapProfileRow)
}

export async function createStoredProfile({ name, captures }) {
  const db = getPool()
  await ensureSchema(db)

  const imageUrl = captures.front || Object.values(captures).find(Boolean) || ''

  const { rows } = await db.query(
    `INSERT INTO profiles (name, image_url, captures)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, name, image_url, captures, created_at`,
    [name, imageUrl, JSON.stringify(captures)],
  )

  return mapProfileRow(rows[0])
}

export async function deleteStoredProfile(profileId) {
  const db = getPool()
  await ensureSchema(db)

  const { rows } = await db.query(
    `DELETE FROM profiles
     WHERE id = $1
     RETURNING id`,
    [Number(profileId)],
  )

  return rows[0] || null
}
