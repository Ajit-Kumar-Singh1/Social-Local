# Social Local

A Facebook post scheduler and automator — manage pages, create posts (image/video/text), bulk schedule, and generate AI images. Fully compatible with Docker Desktop for local self-hosting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 via workflow)
- `pnpm --filter @workspace/social-local run dev` — run the React frontend (port 20771 via workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + shadcn/ui + TailwindCSS + TanStack Query + wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all endpoints)
- `lib/db/src/schema/` — Drizzle DB schema (`facebook_pages.ts`, `posts.ts`)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (don't edit manually)
- `lib/api-zod/src/generated/api.ts` — Generated Zod schemas for server validation (don't edit manually)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/scheduler.ts` — Cron job that publishes scheduled posts
- `artifacts/social-local/src/pages/` — React page components
- `artifacts/social-local/src/components/` — Shared UI components + shadcn components

## Architecture decisions

- Contract-first API: OpenAPI spec → orval codegen → React Query hooks + Zod schemas. Always update `openapi.yaml` first.
- Docker-compatible: `vite.config.ts` uses no Replit plugins; `PORT`/`BASE_PATH` are env-configurable.
- `PUBLIC_URL` env var controls upload file URL prefix (for Docker); defaults to detecting Replit domains.
- `APP_URL` env var controls Facebook OAuth callback URL (for Docker); defaults to Replit dev domain.
- Post scheduler runs inside the API server process, checking every 60 seconds for due scheduled posts.
- Uploads stored on disk at `artifacts/api-server/uploads/`; Docker volume mounts this path for persistence.

## Product

- **Dashboard** — overview stats (total pages, scheduled, published, drafts, failed) + upcoming posts + recent activity
- **Pages** — connect Facebook pages via OAuth or access token, view/disconnect connected pages
- **Posts** — list all posts with status filter, create/edit/delete posts, publish immediately
- **Create Post** — full form with post type (text/image/video), AI image generation, file upload, schedule picker
- **Bulk Scheduler** — create and schedule many posts at once across multiple pages
- **Post Scheduler** — background cron that auto-publishes scheduled posts via Facebook Graph API

## User preferences

- Docker Desktop compatibility is a primary requirement — no Replit-specific plugins in frontend build
- Keep all Facebook API calls in the server, never expose page access tokens to the browser

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` — it regenerates both React hooks and Zod schemas
- After codegen, `lib/api-zod/src/index.ts` is regenerated; it must only export `./generated/api` (not `./generated/types` which would cause duplicate export errors). The orval config `schemas` option was removed to prevent this.
- The `cleanupUploadedFile` helper in `api-server/src/lib/cleanupUpload.ts` safely deletes local upload files on post delete/publish.
- For Docker: run `docker compose exec api pnpm --filter @workspace/db run push` on first startup to create tables.

## Pointers

- See `README-docker.md` for Docker Desktop quick-start instructions
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Facebook Developer App: https://developers.facebook.com/ — add `{APP_URL}/api/auth/facebook/callback` as OAuth redirect URI
