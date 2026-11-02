# Architecture

## Runtime boundaries

- The browser is a React/Vite SPA. It never receives access or refresh tokens in JavaScript-readable storage.
- The Express API owns authentication, authorization, validation, domain rules, and data access.
- MongoDB is connected once during server startup. Request handlers never establish connections.
- External services are adapters: Google OAuth and Cloudinary are optional and are disabled until configured.

## Authentication

Use an opaque server-managed session cookie containing a random session secret. Persist only a SHA-256 hash of the secret in MongoDB. Rotate the secret on refresh with an atomic compare-and-swap update. This avoids exposing bearer tokens to frontend code and makes replay detection deterministic. Cookies are HttpOnly, Secure in production, SameSite=Lax for same-site deployments, and scoped to the API path. For cross-site deployments, require HTTPS, SameSite=None, strict origin allowlists, and CSRF protection.

Google OAuth uses one-time state plus PKCE, validates the ID token with Google's maintained verification library, validates issuer/audience/expiry/email_verified, and does not accept client-supplied identity data. Linking requires an authenticated session and a verified Google identity.

## Data integrity

All owned documents include userId; service queries scope by userId from the authenticated principal. Relationships store canonical IDs on one side. Task/project progress is derived from eligible leaf tasks. Money is stored in integer minor units with a currency code. Habit completion uniqueness includes the user's local date and timezone.

## API and caching

The client uses one TanStack Query client and shared API transport. An auth bootstrap query fetches the current user once and is reused by all protected routes. Mutations invalidate only affected feature keys. Lists are paginated. Calendar reads are date-range based. Diary autosave is debounced and uses optimistic concurrency via a version field.

## Modules

The server is a modular monolith. Routes validate input and delegate to services; services enforce ownership and invariants; models define indexes. The media module is the only module allowed to call Cloudinary. The client is feature-organized and uses custom accessible UI primitives (no shadcn/ui).
