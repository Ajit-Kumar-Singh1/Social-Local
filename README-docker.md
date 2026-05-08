# Social Local — Docker Desktop Quick Start

A Facebook post scheduler and automation tool, fully containerized for Docker Desktop.
No pnpm, no Node.js, no workspace tooling required on your host machine.

## Architecture

```
docker-compose.yml
├── postgres   — PostgreSQL 16
├── api        — Express 5 API  (builds from ./api/)
└── frontend   — React + nginx  (builds from ./frontend/, proxies /api → api:5000)
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Facebook Developer App](https://developers.facebook.com/) with OAuth configured

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Facebook App credentials:

```
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
APP_URL=http://localhost:8080
PUBLIC_URL=http://localhost:8080
```

### 2. Build and start

```bash
docker compose up --build
```

This starts three services:
- **postgres** — PostgreSQL database (internal only)
- **api** — Express API server (internal port 5000, not exposed to host)
- **frontend** — React app served by nginx (host port **8080**)

### 3. Open the app

Visit **[http://localhost:8080](http://localhost:8080)** in your browser.

> The database tables are created automatically on first startup — no manual migration step needed.

---

## Facebook OAuth Setup

In your Facebook Developer App settings → Facebook Login → Valid OAuth redirect URIs, add:

```
http://localhost:8080/api/auth/facebook/callback
```

Then go to the **Pages** section in the app and click **Connect with Facebook**.

---

## Services

| Service  | URL                       | Purpose              |
|----------|---------------------------|----------------------|
| Frontend | http://localhost:8080     | React UI (nginx)     |
| API      | http://localhost:8080/api | Proxied by nginx     |
| Database | internal only             | PostgreSQL           |

---

## Stopping

```bash
docker compose down          # Stop services
docker compose down -v       # Stop and delete all data (database + uploads)
```

## Upgrading

```bash
docker compose up --build -d
```

> Database schema changes are applied automatically on startup.

---

## Environment Variables Reference

| Variable              | Required | Default                  | Description                              |
|-----------------------|----------|--------------------------|------------------------------------------|
| `POSTGRES_PASSWORD`   | No       | `sociallocal`            | PostgreSQL password                      |
| `FACEBOOK_APP_ID`     | Yes      | —                        | Facebook Developer App ID                |
| `FACEBOOK_APP_SECRET` | Yes      | —                        | Facebook Developer App Secret            |
| `APP_URL`             | Yes      | `http://localhost:8080`  | Base URL for OAuth callbacks             |
| `PUBLIC_URL`          | No       | `http://localhost:8080`  | Base URL for uploaded file URLs          |
| `PORT`                | No       | `8080`                   | Host port for the frontend               |
| `HUGGING_FACE_API_KEY`| No       | —                        | HuggingFace key for AI image generation  |
