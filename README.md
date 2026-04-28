# frontend

Frontend webapp for face-auth registration, recognition, FGSM demo flow, and admin user management.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to your local env file if you want a custom API origin or a local Postgres connection.
3. Run `npm run dev`.

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
