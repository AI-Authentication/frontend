# frontend

Frontend webapp for face-auth registration, recognition, FGSM demo flow, and admin user management.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` if you want a custom API origin or a local Neon/Postgres connection.
3. Run `npm run dev`.

## Vercel + Neon

- Add your Neon connection string as `DATABASE_URL` in Vercel.
- Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Vercel for the admin login.
- Leave `VITE_API_BASE_URL` empty in Vercel so the frontend uses same-origin `/api/*` routes.
- The Vercel serverless functions under `api/` auto-create the `profiles` table on first use.
- The current admin login is checked server-side against those environment variables.
