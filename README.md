# frontend

Frontend webapp for face-auth registration, recognition, FGSM demo flow, and admin user management.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. If you want the repo-managed local Postgres, keep `POSTGRES_DB`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, and `DATABASE_URL` aligned in `.env.local`.
4. Start the local database with `npm run db:up`.
5. Run `npm run dev`.

This repo defaults to host port `6543` for Docker Postgres so it does not collide with an existing local Postgres on `5432`.

If writes fail with `password authentication failed for user "postgres"`, first make sure your app is pointing at the repo-managed port from `.env.local`. If the container was initialized earlier with a different password, run `npm run db:reset`, then `npm run db:up` to recreate the local database with the password from `.env.local`.

## Home server deployment

This repo runs as a single Node process on your own server.

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
4. Put Nginx, Caddy, or another reverse proxy in front of it if you want HTTPS.

The Node server serves:
- the built React app from `dist/`
- the API routes from `/api/*`

## External backend auth

- Do not expose backend credentials through `VITE_*` variables.
- The safe pattern is:
  browser frontend -> your server `api/*` routes -> external backend
- That keeps the backend username and password server-side only.
