# Social Local — Docker Setup

A Facebook post scheduler and automation tool, fully containerized for Docker Desktop.

## Quick Start

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Facebook Developer App](https://developers.facebook.com/) with OAuth configured

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Facebook App credentials:
```
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
APP_URL=http://localhost
PUBLIC_URL=http://localhost:5000
```

### 3. Run with Docker Compose

```bash
docker compose up --build
```

This starts three services:
- **postgres** — PostgreSQL database (port 5432)
- **api** — Express API server (port 5000)
- **frontend** — React frontend served by nginx (port 80)

### 4. Initialize the database

On first run, apply the database schema:

```bash
docker compose exec api pnpm --filter @workspace/db run push
```

Or run migrations via the workspace (if you have Node/pnpm locally):

```bash
DATABASE_URL=postgresql://sociallocal:sociallocal@localhost:5432/sociallocal pnpm --filter @workspace/db run push
```

### 5. Open the app

Visit **http://localhost** in your browser.

## Facebook OAuth Setup

In your Facebook Developer App settings, add the following as a valid OAuth redirect URI:

```
http://localhost/api/auth/facebook/callback
```

Then connect your Facebook pages via the **Pages** section in the app.

## Services

| Service  | URL                      | Purpose             |
|----------|--------------------------|---------------------|
| Frontend | http://localhost         | React UI            |
| API      | http://localhost:5000    | Express REST API    |
| Database | localhost:5432           | PostgreSQL          |

## Development (without Docker)

```bash
# Install dependencies
pnpm install

# Start the API server
PORT=5000 DATABASE_URL=postgresql://... pnpm --filter @workspace/api-server run dev

# Start the frontend
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/social-local run dev
```

## Stopping

```bash
docker compose down          # Stop services
docker compose down -v       # Stop and remove volumes (deletes all data)
```
