import { neon } from '@neondatabase/serverless'

let schemaReadyPromise

function getSql() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured.')
  }

  return neon(databaseUrl)
}

async function ensureSchema(sql) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        captures JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
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
  const sql = getSql()
  await ensureSchema(sql)
  const rows = await sql`
    SELECT id, name, image_url, captures, created_at
    FROM profiles
    ORDER BY created_at DESC, id DESC
  `
  return rows.map(mapProfileRow)
}

export async function createStoredProfile({ name, captures }) {
  const sql = getSql()
  await ensureSchema(sql)
  const imageUrl = captures.front || Object.values(captures).find(Boolean) || ''

  const [row] = await sql`
    INSERT INTO profiles (name, image_url, captures)
    VALUES (${name}, ${imageUrl}, ${JSON.stringify(captures)}::jsonb)
    RETURNING id, name, image_url, captures, created_at
  `

  return mapProfileRow(row)
}

export async function deleteStoredProfile(profileId) {
  const sql = getSql()
  await ensureSchema(sql)
  const [row] = await sql`
    DELETE FROM profiles
    WHERE id = ${Number(profileId)}
    RETURNING id
  `
  return row || null
}
