# frontend

Frontend webapp for face-auth registration, recognition, FGSM demo flow, and admin user management.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` if you want a custom API origin or a local Neon/Postgres connection.
3. Run `npm run dev`.

## Home server deployment

This repo can now run as a single Node process on your own server instead of depending on Vercel routing.

1. Set your environment variables on the server:
   - `DATABASE_URL`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `BACKEND_API_BASE_URL`
   - `BACKEND_API_USERNAME`
   - `BACKEND_API_PASSWORD`
   - `PORT`
2. Build the frontend with `npm run build`.
3. Start the app with `npm run server`.
4. Put Nginx, Caddy, or another reverse proxy in front of it if you want HTTPS on your home server.

The Node server serves:
- the built React app from `dist/`
- the API routes from `/api/*`

## Vercel + Neon

- Add your Neon connection string as `DATABASE_URL` in Vercel.
- Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Vercel for the admin login.
- Add `BACKEND_API_BASE_URL`, `BACKEND_API_USERNAME`, and `BACKEND_API_PASSWORD` in Vercel if your real backend is hosted elsewhere and requires login.
- Leave `VITE_API_BASE_URL` empty in Vercel so the frontend uses same-origin `/api/*` routes.
- The Vercel serverless functions under `api/` auto-create the `profiles` table on first use.
- The current admin login is checked server-side against those environment variables.

## External backend auth

- Yes: if you deploy on Vercel, you should add the backend credentials there as environment variables too.
- Do not expose backend credentials through `VITE_*` variables.
- The safe pattern is:
  browser frontend -> your Vercel `api/*` routes -> external backend
- That way the username and password stay server-side only.
