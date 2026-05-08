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
APP_URL=http://localhost
PUBLIC_URL=http://localhost
```

### 2. Build and start

```bash
docker compose up --build
```

This starts three services:
- **postgres** — PostgreSQL database
- **api** — Express API server (internal port 5000, not exposed)
- **frontend** — React app served by nginx (port 80)

### 3. Initialize the database

On first run, apply the schema:

```bash
docker compose exec api npx drizzle-kit push
```

### 4. Open the app

Visit **[http://localhost](http://localhost)** in your browser.

---

## Facebook OAuth Setup

In your Facebook Developer App settings → Facebook Login → Valid OAuth redirect URIs, add:

```
http://localhost/api/auth/facebook/callback
```

Then go to the **Pages** section in the app and click **Connect with Facebook**.

---

## Services

| Service  | URL                  | Purpose              |
|----------|----------------------|----------------------|
| Frontend | http://localhost     | React UI (nginx)     |
| API      | http://localhost/api | Proxied by nginx     |
| Database | internal only        | PostgreSQL           |

---

## Stopping

```bash
docker compose down          # Stop services
docker compose down -v       # Stop and delete all data (database + uploads)
```

## Upgrading

```bash
docker compose pull
docker compose up --build -d
docker compose exec api npx drizzle-kit push   # run if schema changed
```

---

## Environment Variables Reference

| Variable              | Required | Default          | Description                                           |
|-----------------------|----------|------------------|-------------------------------------------------------|
| `POSTGRES_PASSWORD`   | No       | `sociallocal`    | PostgreSQL password                                   |
| `FACEBOOK_APP_ID`     | Yes      | —                | Facebook Developer App ID                             |
| `FACEBOOK_APP_SECRET` | Yes      | —                | Facebook Developer App Secret                         |
| `APP_URL`             | Yes      | `http://localhost`| Base URL for OAuth callbacks                         |
| `PUBLIC_URL`          | No       | `http://localhost`| Base URL for uploaded file URLs                      |
| `PORT`                | No       | `80`             | Host port for the frontend                            |
| `HUGGING_FACE_API_KEY`| No       | —                | HuggingFace key for AI image generation              |
