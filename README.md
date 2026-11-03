# Daymark — Personal Productivity Workspace

Daymark is a MERN personal workspace for tasks, projects, diary entries, habits, calendar events, and personal finance. It uses a modular Express/Mongoose API and a React/Vite TypeScript client.

## Project layout

- `client/` — React, Vite, TypeScript and the responsive web application
- `server/` — Express API, authentication and modular domain services
- `docs/` — architecture and implementation notes

## Requirements

- Node.js 22+
- MongoDB 7+ running locally or a MongoDB connection string
- npm

## Local environment setup (Windows PowerShell)

From the repository root, copy the example environment files:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

The server example uses a local MongoDB database at `mongodb://127.0.0.1:27017/productivity_workspace`. Start MongoDB before starting the API.

The committed `SESSION_SECRET` is a development-only example so a fresh local setup can start. Replace it with a newly generated random value before deploying. Never commit your actual `.env` files.

## Install and run

Open two terminals from the repository root.

**Terminal 1 — API**

```powershell
cd server
npm install
npm run dev
```

The API listens on `http://localhost:5000`. Health check: `http://localhost:5000/health`.

**Terminal 2 — web client**

```powershell
cd client
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`.

## Optional integrations

The local example intentionally leaves Google OAuth, SMTP and Cloudinary credentials blank. The app can be developed without connecting those providers. To enable them, use your own credentials in the ignored local `server/.env` file:

- **Google OAuth:** configure the OAuth client and exact callback URL `http://localhost:5000/api/v1/auth/google/callback`.
- **SMTP:** configure host, port, username, password and sender address for real verification and password-reset email delivery.
- **Cloudinary:** configure cloud name, API key and API secret for image uploads.

Do not add secrets to `client/.env`: Vite variables prefixed with `VITE_` are exposed to browser code. The only client variable in the example is the public API base URL.

## Production security notes

Use HTTPS, set `COOKIE_SECURE=true`, configure the exact deployed `CLIENT_URL`, use a strong unique `SESSION_SECRET`, and store credentials in your hosting provider's secret manager. Review the cookie SameSite/domain and trusted-proxy settings for the deployment topology. Do not use the local development values in production.

See `docs/architecture.md` for the current architecture. Check the GitHub Actions tab for the latest build and test status; the existence of a workflow does not mean that its latest run passed.
