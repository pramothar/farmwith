# FarmWith identity stack

This repository contains a dockerised authentication stack for **FarmWith** consisting of:

- **FastAPI** backend with JWT issuance, local username/password authentication, MFA/TOTP, and optional Authentik OIDC single sign-on.
- **React (Vite)** frontend that exposes buyer and enterprise login experiences, including MFA management and SSO hand-off.
- **PostgreSQL** database (Postgres 15) for local development. In production you can point the backend at your Supabase instance.

## Features

- Secure password storage using Argon2.
- MFA/TOTP provisioning and enforcement for all username/password logins.
- Configurable Authentik OIDC integration (enabled via `ENABLE_SSO=true`).
- JWT-based session handling with `/auth/me` endpoint for profile introspection.
- Frontend SSO callback workflow with session persistence.

## Prerequisites

- Docker and Docker Compose.
- Supabase/PostgreSQL connection string (for production, replace the example in `.env.example`).
- Authentik OIDC provider details (client ID/secret, issuer/authorize/token endpoints).

## Configuration

Copy the example environment file and adjust values:

```bash
cp .env.example .env
```

### Core settings

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Use the Supabase URI or the local `db` container. |
| `JWT_SECRET_KEY` | Secret for signing API JWTs (generate a long random string). |
| `SESSION_SECRET_KEY` | Secret for encrypting session cookies used during the Authentik handshake. |
| `FRONTEND_URL` | External URL that serves the React app. Used for OIDC redirect after login. |
| `BACKEND_URL` | External URL for the FastAPI service (used as the redirect base). |
| `API_BASE_URL` | Internal URL that the frontend uses to contact the backend when running in Docker (defaults to `http://backend:8000`). |

### Authentik SSO

Set `ENABLE_SSO=true` to expose the SSO option on the enterprise login card. Provide either the discovery URL (`OIDC_CONFIGURATION_URL`) **or** the individual authorize/token/userinfo/logout endpoints. Populate `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` with the values from your Authentik application (`farmwith`).

## Running locally

```bash
docker compose up --build
```

Services exposed:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>
- Local Postgres (optional for dev): `localhost:5432`

### Using Supabase instead of the local Postgres container

Update `DATABASE_URL` in `.env` to the Supabase connection string, then comment out or remove the `db` service in `docker-compose.yml` if not needed.

## API overview

| Endpoint | Method | Description |
| --- | --- | --- |
| `/auth/register` | POST | Register buyer/enterprise users with password. |
| `/auth/login` | POST | Username/password login. Requires MFA code once enabled. |
| `/auth/mfa/setup` | POST | Generates a TOTP secret for the authenticated user. |
| `/auth/mfa/verify` | POST | Verifies a TOTP code and enables MFA for the user. |
| `/auth/config` | GET | Returns whether SSO is enabled for the frontend. |
| `/auth/me` | GET | Returns current user profile (requires Bearer token). |
| `/auth/sso/login` | GET | Starts the Authentik OIDC flow (browser redirect). |
| `/auth/sso/callback` | GET | Handles the Authentik callback and redirects to the frontend with a JWT. |

## Frontend workflow

- Buyers use email/password plus MFA when enabled.
- Enterprise buyers can either use MFA-enabled password login or single sign-on if SSO is active.
- MFA setup buttons appear after a successful login and display the TOTP secret + provisioning link.

## Security notes

- Always run behind HTTPS in production and set strong secrets.
- Rotate `JWT_SECRET_KEY` and `SESSION_SECRET_KEY` periodically.
- Enforce MFA for enterprise users by policy and leverage Authentik conditional access for additional assurance.

## Development tips

- The backend automatically applies database migrations via SQLAlchemy metadata creation. For production, manage migrations explicitly (e.g., Alembic).
- Update `VITE_API_BASE_URL` through the frontend service environment if the backend URL differs between environments.
